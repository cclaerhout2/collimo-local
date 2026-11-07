import Capacitor
import CryptoKit
import ImageIO
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/// Accès aux photos pour l'application iPhone de Collimo, avec les mêmes fonctions que le module
/// Android (voir `CollimoStoragePlugin.java`) et le même contrat côté page (`src/native/bridge.ts`).
///
/// L'iPhone n'a pas de dossiers de photos : les photos choisies dans la photothèque (sélecteur
/// d'Apple, sans autorisation à donner) sont copiées dans l'album de l'app, `Documents/Photos`,
/// visible aussi dans l'app Fichiers (« Sur mon iPhone › Collimo »). Les collages sont rangés dans
/// son sous-dossier `Collimo` et sortent par la feuille de partage (Enregistrer l'image, Messages…).
/// Un chemin est un chemin de fichier absolu dans le conteneur de l'app ; le contenu est lu par la page
/// à travers le serveur local de Capacitor (`Capacitor.convertFileSrc`).
@objc(CollimoStoragePlugin)
public class CollimoStoragePlugin: CAPPlugin, CAPBridgedPlugin, PHPickerViewControllerDelegate {
    public let identifier = "CollimoStoragePlugin"
    public let jsName = "CollimoStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "userInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "folderInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fileInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "findChild", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensureChildDir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "thumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendTemp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "commitTemp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "catalogueDir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "chooseCatalogueDir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testMode", returnType: CAPPluginReturnPromise),
    ]

    private let fm = FileManager.default
    private let queue = DispatchQueue(label: "fr.collimo.storage", qos: .userInitiated, attributes: .concurrent)
    /// Appel en attente du sélecteur de photos, et ce qu'il doit renvoyer (album ou fichier seul).
    private var pickerCall: CAPPluginCall?
    private var pickerSingle = false

    // MARK: - Emplacements

    private var documents: URL { fm.urls(for: .documentDirectory, in: .userDomainMask)[0] }
    private var support: URL { fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0] }
    private var caches: URL { fm.urls(for: .cachesDirectory, in: .userDomainMask)[0] }
    private var album: URL { documents.appendingPathComponent("Photos", isDirectory: true) }
    private var imports: URL { documents.appendingPathComponent("Imports", isDirectory: true) }
    private var catalogue: URL { support.appendingPathComponent("catalogue", isDirectory: true) }
    private var settingsFile: URL { support.appendingPathComponent("settings.json") }

    private func ensure(_ dir: URL) throws {
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    /// Dossier imposé par l'auto-test (versions de test seulement, argument de lancement `-collimoSelfTest`).
    private var testFolder: String? {
        #if DEBUG
        if let f = UserDefaults.standard.string(forKey: "collimoSelfTest"), !f.isEmpty { return f }
        #endif
        return nil
    }

    // MARK: - Outils

    private struct Failure: Error, LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    /// Exécute un appel hors du fil principal et renvoie toute erreur à la page.
    private func run(_ call: CAPPluginCall, _ work: @escaping () throws -> Void) {
        queue.async {
            do { try work() } catch { call.reject(error.localizedDescription) }
        }
    }

    private func required(_ call: CAPPluginCall, _ key: String) throws -> String {
        guard let v = call.getString(key), !v.isEmpty else { throw Failure(message: "Paramètre manquant : \(key)") }
        return v
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private func mime(_ name: String) -> String {
        let ext = (name as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg", "jfif": return "image/jpeg"
        case "heic": return "image/heic"
        case "heif": return "image/heif"
        case "json": return "application/json"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }

    private func isImage(_ name: String) -> Bool {
        let m = mime(name)
        return m.hasPrefix("image/") && m != "image/svg+xml" && !name.hasPrefix(".")
    }

    /// Nom libre dans un dossier : `photo.jpg`, sinon `photo (2).jpg`…
    private func freeName(_ name: String, in dir: URL) -> String {
        if !fm.fileExists(atPath: dir.appendingPathComponent(name).path) { return name }
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var i = 2
        while true {
            let candidate = ext.isEmpty ? "\(base) (\(i))" : "\(base) (\(i)).\(ext)"
            if !fm.fileExists(atPath: dir.appendingPathComponent(candidate).path) { return candidate }
            i += 1
        }
    }

    private func checkWritableName(_ name: String) throws {
        let n = name.lowercased()
        if name.isEmpty || name.contains("/") || name.hasPrefix(".") {
            throw Failure(message: "Nom de fichier refusé : \(name)")
        }
        if !(n.hasSuffix(".jpg") || n.hasSuffix(".jpeg") || n.hasSuffix(".png") || n.hasSuffix(".json")) {
            throw Failure(message: "Type de fichier refusé : \(name)")
        }
    }

    // MARK: - Description des fichiers

    private func folderObject(_ url: URL) throws -> JSObject {
        var isDir: ObjCBool = false
        guard fm.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue else {
            throw Failure(message: "Introuvable : \(url.lastPathComponent)")
        }
        let name = url.standardizedFileURL == album.standardizedFileURL ? "Mes photos" : url.lastPathComponent
        return ["path": url.path, "name": name, "writable": fm.isWritableFile(atPath: url.path)]
    }

    private func fileObject(_ url: URL, dimensions: Bool) throws -> JSObject {
        let attrs = try fm.attributesOfItem(atPath: url.path)
        if (attrs[.type] as? FileAttributeType) == .typeDirectory {
            throw Failure(message: "Ce n'est pas un fichier : \(url.lastPathComponent)")
        }
        let name = url.lastPathComponent
        var o: JSObject = [
            "path": url.path,
            "name": name,
            "size": (attrs[.size] as? NSNumber)?.intValue ?? 0,
            "modifiedTime": Self.iso.string(from: (attrs[.modificationDate] as? Date) ?? Date()),
            "mimeType": mime(name),
        ]
        if dimensions, isImage(name), let (w, h) = imageSize(url) {
            o["width"] = w
            o["height"] = h
        }
        return o
    }

    /// Largeur et hauteur affichées (orientation EXIF appliquée), lues dans l'en-tête.
    private func imageSize(_ url: URL) -> (Int, Int)? {
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
              let w = (props[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue,
              let h = (props[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue
        else { return nil }
        let orientation = (props[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
        return orientation >= 5 ? (h, w) : (w, h)
    }

    private func children(_ dir: URL, imagesOnly: Bool, contains: String?) throws -> [JSObject] {
        let names = try fm.contentsOfDirectory(atPath: dir.path)
        return names.compactMap { name -> JSObject? in
            if name.hasPrefix(".") { return nil }
            if let c = contains, !name.contains(c) { return nil }
            if imagesOnly && !isImage(name) { return nil }
            let url = dir.appendingPathComponent(name)
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: url.path, isDirectory: &isDir), !isDir.boolValue else { return nil }
            return try? fileObject(url, dimensions: false)
        }
    }

    // MARK: - Sélecteurs

    @objc func userInfo(_ call: CAPPluginCall) {
        let name = UIDevice.current.name
        call.resolve(["name": name, "email": "ios@\(UIDevice.current.model)"])
    }

    @objc func pickFolder(_ call: CAPPluginCall) {
        if let test = testFolder {
            run(call) { call.resolve(["folder": try self.folderObject(URL(fileURLWithPath: test))]) }
            return
        }
        present(call, single: false)
    }

    @objc func pickFile(_ call: CAPPluginCall) {
        present(call, single: true)
    }

    private func present(_ call: CAPPluginCall, single: Bool) {
        DispatchQueue.main.async {
            var config = PHPickerConfiguration()
            config.filter = .images
            config.selectionLimit = single ? 1 : 0
            // JPEG plutôt que HEIC : lisible partout (et le collage se partage tel quel).
            config.preferredAssetRepresentationMode = .compatible
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.pickerCall = call
            self.pickerSingle = single
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let call = pickerCall else { return }
        pickerCall = nil
        let single = pickerSingle
        let dir = single ? imports : album
        let group = DispatchGroup()
        let lock = NSLock()
        var copied: [URL] = []
        do { try ensure(dir) } catch { call.reject(error.localizedDescription); return }
        for result in results {
            let provider = result.itemProvider
            guard let type = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .image) == true }) else { continue }
            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: type) { tmp, _ in
                defer { group.leave() }
                guard let tmp = tmp else { return }
                lock.lock()
                defer { lock.unlock() }
                let suggested = provider.suggestedName ?? "Photo"
                let ext = tmp.pathExtension.isEmpty ? "jpg" : tmp.pathExtension
                let target = dir.appendingPathComponent(self.freeName("\(suggested).\(ext)", in: dir))
                if (try? self.fm.copyItem(at: tmp, to: target)) != nil { copied.append(target) }
            }
        }
        group.notify(queue: queue) {
            do {
                if single {
                    guard let first = copied.first else { call.resolve([:]); return }
                    call.resolve(["file": try self.fileObject(first, dimensions: true)])
                } else {
                    let hasPhotos = !((try? self.children(self.album, imagesOnly: true, contains: nil)) ?? []).isEmpty
                    call.resolve(hasPhotos ? ["folder": try self.folderObject(self.album)] : [:])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    // MARK: - Lecture

    @objc func folderInfo(_ call: CAPPluginCall) {
        run(call) { call.resolve(try self.folderObject(URL(fileURLWithPath: try self.required(call, "path")))) }
    }

    @objc func fileInfo(_ call: CAPPluginCall) {
        run(call) { call.resolve(try self.fileObject(URL(fileURLWithPath: try self.required(call, "path")), dimensions: true)) }
    }

    @objc func listImages(_ call: CAPPluginCall) {
        run(call) {
            let dir = URL(fileURLWithPath: try self.required(call, "path"))
            call.resolve(["files": try self.children(dir, imagesOnly: true, contains: nil)])
        }
    }

    @objc func listFiles(_ call: CAPPluginCall) {
        run(call) {
            let dir = URL(fileURLWithPath: try self.required(call, "path"))
            let files = (try? self.children(dir, imagesOnly: false, contains: call.getString("contains"))) ?? []
            call.resolve(["files": files])
        }
    }

    @objc func findChild(_ call: CAPPluginCall) {
        run(call) {
            let url = URL(fileURLWithPath: try self.required(call, "dir")).appendingPathComponent(try self.required(call, "name"))
            call.resolve(self.fm.fileExists(atPath: url.path) ? ["path": url.path] : [:])
        }
    }

    @objc func ensureChildDir(_ call: CAPPluginCall) {
        run(call) {
            let url = URL(fileURLWithPath: try self.required(call, "dir")).appendingPathComponent(try self.required(call, "name"), isDirectory: true)
            try self.ensure(url)
            call.resolve(["path": url.path])
        }
    }

    /// Miniature JPEG mise en cache (orientation appliquée) ; renvoie son chemin.
    @objc func thumbnail(_ call: CAPPluginCall) {
        run(call) {
            let path = try self.required(call, "path")
            let size = max(32, min(1024, call.getInt("size") ?? 400))
            let key = "\(path)|\(size)|\(call.getString("version") ?? "")"
            let hash = Insecure.SHA1.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
            let dir = self.caches.appendingPathComponent("miniatures", isDirectory: true)
            try self.ensure(dir)
            let out = dir.appendingPathComponent("\(hash).jpg")
            if !self.fm.fileExists(atPath: out.path) {
                let options: [CFString: Any] = [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: size,
                ]
                guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
                      let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, options as CFDictionary),
                      let data = UIImage(cgImage: cg).jpegData(compressionQuality: 0.82)
                else { throw Failure(message: "Miniature impossible : \((path as NSString).lastPathComponent)") }
                try data.write(to: out, options: .atomic)
            }
            call.resolve(["path": out.path])
        }
    }

    // MARK: - Écriture

    private func tempFile(_ id: String) throws -> URL {
        let dir = caches.appendingPathComponent("envois", isDirectory: true)
        try ensure(dir)
        let clean = id.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" }
        return dir.appendingPathComponent(String(clean))
    }

    /// Ajoute un morceau (base64) au fichier temporaire d'un envoi.
    @objc func appendTemp(_ call: CAPPluginCall) {
        run(call) {
            let tmp = try self.tempFile(try self.required(call, "id"))
            let data = Data(base64Encoded: call.getString("data") ?? "") ?? Data()
            if !self.fm.fileExists(atPath: tmp.path) { self.fm.createFile(atPath: tmp.path, contents: nil) }
            let handle = try FileHandle(forWritingTo: tmp)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            call.resolve()
        }
    }

    /// Termine un envoi : nouveau fichier (erreur s'il existe déjà) ou réécriture d'un JSON (`replace`).
    @objc func commitTemp(_ call: CAPPluginCall) {
        run(call) {
            let tmp = try self.tempFile(try self.required(call, "id"))
            defer { try? self.fm.removeItem(at: tmp) }
            let data = (try? Data(contentsOf: tmp)) ?? Data()
            let target: URL
            if let replace = call.getString("replace") {
                guard replace.lowercased().hasSuffix(".json") else { throw Failure(message: "Seuls les fichiers JSON peuvent être réécrits") }
                target = URL(fileURLWithPath: replace)
                try data.write(to: target, options: .atomic)
            } else {
                let name = try self.required(call, "name")
                try self.checkWritableName(name)
                let dir = URL(fileURLWithPath: try self.required(call, "dir"))
                try self.ensure(dir)
                target = dir.appendingPathComponent(name)
                if self.fm.fileExists(atPath: target.path) { throw Failure(message: "Ce fichier existe déjà : \(name)") }
                try data.write(to: target, options: .withoutOverwriting)
            }
            call.resolve(try self.fileObject(target, dimensions: false))
        }
    }

    // MARK: - Réglages, catalogue, partage

    @objc func loadSettings(_ call: CAPPluginCall) {
        run(call) {
            if let data = try? Data(contentsOf: self.settingsFile), let text = String(data: data, encoding: .utf8) {
                call.resolve(["data": text])
            } else {
                call.resolve([:])
            }
        }
    }

    @objc func saveSettings(_ call: CAPPluginCall) {
        run(call) {
            try self.ensure(self.support)
            try Data((call.getString("data") ?? "null").utf8).write(to: self.settingsFile, options: .atomic)
            call.resolve()
        }
    }

    @objc func catalogueDir(_ call: CAPPluginCall) {
        run(call) {
            try self.ensure(self.catalogue)
            call.resolve(try self.folderObject(self.catalogue))
        }
    }

    /// Pas de dossier partagé à choisir sur iPhone : le catalogue reste dans l'app.
    @objc func chooseCatalogueDir(_ call: CAPPluginCall) {
        call.resolve([:])
    }

    /// Feuille de partage d'iOS sur un collage : Enregistrer l'image (dans Photos), Messages, Mail, AirDrop…
    @objc func share(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else { call.reject("Paramètre manquant : path"); return }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.reject("Partage impossible"); return }
            let sheet = UIActivityViewController(activityItems: [URL(fileURLWithPath: path)], applicationActivities: nil)
            // iPad : la feuille s'ouvre en bulle, ancrée au centre de l'écran.
            sheet.popoverPresentationController?.sourceView = vc.view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 1, height: 1)
            sheet.popoverPresentationController?.permittedArrowDirections = []
            vc.present(sheet, animated: true) { call.resolve() }
        }
    }

    /// Auto-test de bout en bout (versions de test lancées avec `-collimoSelfTest dossier`).
    @objc func testMode(_ call: CAPPluginCall) {
        if let f = testFolder { call.resolve(["folder": f]) } else { call.resolve([:]) }
    }
}
