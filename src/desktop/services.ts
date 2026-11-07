/**
 * Services de l'application Windows : les mêmes que ceux de Google Drive (voir `google/types.ts`),
 * mais sur les fichiers du PC. Pas de compte : l'utilisateur est celui de la session Windows.
 * Un dossier est désigné par son chemin, une photo par le chemin de son fichier.
 * Les dossiers Google Drive restent accessibles par Google Drive pour ordinateur (lecteur G:).
 */
import { isSupportedImage } from '../google/drive'
import type { DriveFileInfo, DriveJsonFile, Photo, Services, UserSettings } from '../google/types'
import { BRIDGE_GLOBAL, localFileUrl, localThumbUrl, shellUrl, type DesktopBridge, type LocalFile } from './bridge'

/** Plus grand côté des miniatures de la galerie, en pixels. */
const THUMB_SIZE = 400

/**
 * Pont vers Windows exposé par le script de préchargement, s'il existe.
 * @returns le pont, ou `null` dans un navigateur (version web)
 */
export function getDesktopBridge(): DesktopBridge | null {
  const g = globalThis as unknown as Record<string, DesktopBridge | undefined>
  return g[BRIDGE_GLOBAL] ?? null
}

/**
 * Message lisible d'une erreur renvoyée par le processus principal.
 * Electron la préfixe de « Error invoking remote method '…': Error: », sans intérêt pour l'utilisateur.
 * @param e - erreur attrapée
 * @returns une erreur au message nettoyé
 */
export function cleanError(e: unknown): Error {
  const message = e instanceof Error ? e.message : String(e)
  return new Error(message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, ''))
}

/**
 * Appelle le pont et nettoie le message d'une éventuelle erreur.
 * @param run - appel à faire
 * @returns le résultat de l'appel
 */
async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    throw cleanError(e)
  }
}

/**
 * Chemin d'un élément dans un dossier, avec le séparateur du système.
 * @param dir - chemin du dossier
 * @param name - nom de l'élément
 * @param platform - système (`win32` : séparateur `\`)
 * @returns le chemin complet
 */
export function joinPath(dir: string, name: string, platform: string): string {
  const sep = platform === 'win32' ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + name
}

/**
 * Photo de la galerie à partir d'un fichier local.
 * @param f - fichier image
 * @returns la photo, avec l'adresse de sa miniature calculée par Windows
 */
export function toPhoto(f: LocalFile): Photo {
  return {
    id: f.path,
    name: f.name,
    mimeType: f.mimeType,
    thumbnailUrl: localThumbUrl(f.path, THUMB_SIZE, f.modifiedTime),
    width: f.width,
    height: f.height,
    supported: isSupportedImage(f.mimeType),
  }
}

/**
 * Fichier du dossier Collimo (collage, projet) à partir d'un fichier local.
 * @param f - fichier local
 * @returns le fichier ; son lien l'ouvre dans l'application par défaut de Windows
 */
export function toFileInfo(f: LocalFile): DriveFileInfo {
  return {
    id: f.path,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: shellUrl('open', f.path),
    thumbnailLink: f.mimeType.startsWith('image/') ? localThumbUrl(f.path, 320, f.modifiedTime) : undefined,
  }
}

/**
 * Fichier JSON (catalogue de l'usine) à partir d'un fichier local.
 * @param f - fichier local
 * @returns le fichier ; son lien le montre dans l'Explorateur
 */
function toJsonFile(f: LocalFile): DriveJsonFile {
  return { id: f.path, name: f.name, modifiedTime: f.modifiedTime, webViewLink: shellUrl('reveal', f.path), canEdit: true }
}

/** Photo introuvable à son chemin d'origine (supprimée, ou dossier déplacé et non retrouvé). */
export class MissingFileError extends Error {
  constructor(path: string, status: number) {
    super(status === 404 ? `Fichier introuvable : ${path}` : `Lecture impossible (${status}) : ${path}`)
    this.name = 'MissingFileError'
  }
}

/**
 * Lit un fichier local par le protocole de l'app.
 * @param path - chemin complet
 * @returns le contenu, avec son type MIME
 * @throws {@link MissingFileError} si le fichier est absent ou hors des dossiers autorisés
 */
async function readBlob(path: string): Promise<Blob> {
  const res = await fetch(localFileUrl(path))
  if (!res.ok) throw new MissingFileError(path, res.status)
  return res.blob()
}

/**
 * Nom de fichier d'un chemin Windows ou Unix.
 * @param path - chemin complet
 * @returns la dernière partie du chemin
 */
export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

/**
 * Contenu d'un objet JSON, en octets UTF-8.
 * @param data - valeur à écrire
 * @returns le JSON indenté, encodé
 */
const jsonBytes = (data: unknown) => new TextEncoder().encode(JSON.stringify(data, null, 2))

/**
 * Crée les services de l'application Windows.
 * @param bridge - pont vers le processus principal
 * @returns les services : connexion implicite, fichiers locaux, sélecteurs de Windows
 */
export function createDesktopServices(bridge: DesktopBridge): Services {
  const join = (dir: string, name: string) => joinPath(dir, name, bridge.platform)
  /** Dernier dossier de photos parcouru : on y cherche les photos d'un collage dont le dossier a bougé. */
  let photoFolder: string | null = null

  /**
   * Chemin de repli d'une photo introuvable : le fichier du même nom dans le dossier de photos en cours.
   * Couvre un dossier déplacé ou renommé, un autre lecteur, et un collage ouvert depuis un autre PC.
   * @param id - chemin d'origine
   * @returns le chemin de repli, ou null s'il n'y en a pas
   */
  const moved = (id: string) => {
    const candidate = photoFolder ? join(photoFolder, baseName(id)) : null
    return candidate && candidate !== id ? candidate : null
  }

  /**
   * Exécute une lecture sur le chemin d'une photo, puis sur son chemin de repli si elle a disparu.
   * @param id - chemin d'origine
   * @param read - lecture à faire
   * @returns le résultat de la lecture
   */
  const withMoved = async <T>(id: string, read: (path: string) => Promise<T>): Promise<T> => {
    try {
      return await read(id)
    } catch (e) {
      const other = moved(id)
      if (!other) throw e
      return read(other).catch(() => Promise.reject(e))
    }
  }

  return {
    kind: 'desktop',
    auth: {
      // Pas de compte : la session Windows suffit.
      signIn: async () => {},
      getToken: () => 'local',
      signOut: () => {},
    },
    drive: {
      currentUser: () => call(() => bridge.userInfo()),
      listSharedDrives: async () => [],
      async getFolder(id) {
        const f = await call(() => bridge.folderInfo(id))
        return { id: f.path, name: f.name, driveId: null, canAddChildren: f.writable }
      },
      async listPhotos(folder) {
        photoFolder = folder.id
        return (await call(() => bridge.listImages(folder.id))).map(toPhoto)
      },
      getPhoto: async (id) => toPhoto(await withMoved(id, (p) => call(() => bridge.fileInfo(p)))),
      async ensureCollimoFolder(folderId) {
        const path = join(folderId, 'Collimo')
        await call(() => bridge.ensureDir(path))
        return path
      },
      async loadSettings() {
        const raw = (await call(() => bridge.loadSettings())) as Partial<UserSettings> | null
        return raw && typeof raw === 'object' && raw.version === 1 ? (raw as UserSettings) : null
      },
      saveSettings: (s) => call(() => bridge.saveSettings(s)),
      fetchFileBlob: (id) => withMoved(id, readBlob),
      listFolderFiles: async (folderId, namePrefix) => (await call(() => bridge.listFiles(folderId, namePrefix))).map(toFileInfo),
      readJson: async (id) => JSON.parse(await (await readBlob(id)).text()) as unknown,
      async uploadFile(folderId, name, data) {
        const bytes = new Uint8Array(await data.arrayBuffer())
        return toFileInfo(await call(() => bridge.writeNewFile(folderId, name, bytes)))
      },
      folderLink: (folderId) => shellUrl('open', folderId),
      async findSharedDrive() {
        // Le « Drive du catalogue » est un dossier : dans les données de l'app, ou un dossier partagé choisi.
        const dir = await call(() => bridge.catalogueDir())
        return { id: dir.path, name: dir.path, canAddChildren: dir.writable }
      },
      async findRootFile(driveId, name) {
        const f = (await call(() => bridge.listFiles(driveId, name))).find((x) => x.name === name)
        return f ? toJsonFile(f) : null
      },
      createJsonFile: async (parentId, name, data) => toJsonFile(await call(() => bridge.writeNewFile(parentId, name, jsonBytes(data)))),
      updateJsonFile: async (id, data) => toJsonFile(await call(() => bridge.replaceFile(id, jsonBytes(data)))),
    },
    picker: {
      async pickFolder(_drive, _lang, title) {
        const f = await call(() => bridge.pickFolder({ title }))
        return f ? { id: f.path, name: f.name } : null
      },
      async pickImage(_drive, _lang, title) {
        const f = await call(() => bridge.pickFile({ title, filter: 'image' }))
        return f ? { id: f.path } : null
      },
      async pickFile(_drive, _lang, title) {
        const f = await call(() => bridge.pickFile({ title, filter: 'json' }))
        return f ? { id: f.path } : null
      },
    },
  }
}
