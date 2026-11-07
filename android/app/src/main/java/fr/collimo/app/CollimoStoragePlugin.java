package fr.collimo.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ThumbnailUtils;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.util.Base64;
import android.util.Size;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Accès aux dossiers pour l'application Android de Collimo : choix d'un dossier ou d'un fichier avec
 * le sélecteur d'Android (Storage Access Framework), liste des photos, miniatures, lecture des
 * dimensions, écriture des collages sans jamais écraser un fichier, réglages et catalogue de l'usine.
 *
 * Un chemin est soit une adresse {@code content://} d'un document (dossier ou fichier choisi par
 * l'utilisateur, ou contenu d'un tel dossier), soit un chemin de fichier absolu (données de l'app,
 * dossier de test). Collimo n'a accès qu'aux dossiers et fichiers que l'utilisateur lui a ouverts :
 * c'est Android qui le garantit, aucune autorisation de stockage générale n'est demandée.
 *
 * Le contenu des fichiers est lu par la page à travers le serveur local de Capacitor
 * ({@code Capacitor.convertFileSrc}) ; ce module ne fait passer que de petites données, sauf l'écriture
 * d'un collage, envoyée par morceaux dans un fichier temporaire puis copiée en une fois.
 */
@CapacitorPlugin(name = "CollimoStorage")
public class CollimoStoragePlugin extends Plugin {

    private static final String PREFS = "collimo";
    private static final String PREF_CATALOGUE = "catalogueDir";
    private static final String[] DOC_COLUMNS = {
        Document.COLUMN_DOCUMENT_ID,
        Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE,
        Document.COLUMN_SIZE,
        Document.COLUMN_LAST_MODIFIED,
        Document.COLUMN_FLAGS
    };

    /** Miniatures et listes : plusieurs à la fois, sans bloquer les autres appels. */
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    // ------------------------------------------------------------------ utilitaires

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    private static boolean isContent(String p) {
        return p != null && p.startsWith("content://");
    }

    private static String iso(long millis) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date(millis));
    }

    private static String mimeFromName(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (ext.equals("heic")) return "image/heic";
        if (ext.equals("heif")) return "image/heif";
        if (ext.equals("avif")) return "image/avif";
        if (ext.equals("jpg") || ext.equals("jpeg") || ext.equals("jfif")) return "image/jpeg";
        String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m != null ? m : "application/octet-stream";
    }

    /** Type MIME fiable : celui d'Android, sauf s'il est générique, auquel cas celui de l'extension. */
    private static String bestMime(String mime, String name) {
        if (mime == null || mime.isEmpty() || mime.equals("application/octet-stream")) return mimeFromName(name);
        return mime;
    }

    /** Fichiers que Collimo peut créer : images exportées et JSON, jamais un programme. */
    private static void checkWritableName(String name) throws IOException {
        if (name == null || name.isEmpty() || name.contains("/") || name.contains("\\") || name.startsWith(".") || name.equals("..")) {
            throw new IOException("Nom de fichier refusé : " + name);
        }
        String n = name.toLowerCase(Locale.ROOT);
        if (!(n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".json"))) {
            throw new IOException("Type de fichier refusé : " + name);
        }
    }

    private JSObject fileObject(String path, String name, long size, long modified, String mime) {
        JSObject o = new JSObject();
        o.put("path", path);
        o.put("name", name);
        o.put("size", size);
        o.put("modifiedTime", iso(modified > 0 ? modified : System.currentTimeMillis()));
        o.put("mimeType", bestMime(mime, name));
        return o;
    }

    private JSObject folderObject(String path, String name, boolean writable) {
        JSObject o = new JSObject();
        o.put("path", path);
        o.put("name", name);
        o.put("writable", writable);
        return o;
    }

    /** Adresse d'un document du même arbre (dossier choisi) que {@code base}. */
    private static Uri docInTree(Uri base, String documentId) {
        return DocumentsContract.buildDocumentUriUsingTree(base, documentId);
    }

    /** Fichier temporaire d'un envoi en cours ; l'identifiant vient de la page, il est nettoyé. */
    private File tempFile(String id) {
        File dir = new File(getContext().getCacheDir(), "envois");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, id.replaceAll("[^A-Za-z0-9_-]", "_"));
    }

    private interface Task {
        void run(PluginCall call) throws Exception;
    }

    /** Exécute un appel hors du fil d'exécution de Capacitor, et renvoie toute erreur à la page. */
    private void async(PluginCall call, Task task) {
        pool.execute(() -> {
            try {
                task.run(call);
            } catch (SecurityException e) {
                call.reject("Accès refusé. Choisissez de nouveau ce dossier avec « Changer d'emplacement ».");
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString());
            }
        });
    }

    private static String required(PluginCall call, String key) throws IOException {
        String v = call.getString(key);
        if (v == null || v.isEmpty()) throw new IOException("Paramètre manquant : " + key);
        return v;
    }

    // ------------------------------------------------------------------ description des documents

    private JSObject describeFolder(String path) throws IOException {
        if (!isContent(path)) {
            File f = new File(path);
            if (!f.isDirectory()) throw new IOException("Introuvable : " + path);
            return folderObject(path, f.getName(), f.canWrite());
        }
        Uri uri = Uri.parse(path);
        try (Cursor c = resolver().query(uri, DOC_COLUMNS, null, null, null)) {
            if (c == null || !c.moveToFirst()) throw new IOException("Introuvable : " + path);
            String mime = c.getString(2);
            if (!Document.MIME_TYPE_DIR.equals(mime)) throw new IOException("Ce n'est pas un dossier : " + c.getString(1));
            int flags = c.getInt(5);
            return folderObject(path, c.getString(1), (flags & Document.FLAG_DIR_SUPPORTS_CREATE) != 0);
        }
    }

    private JSObject describeFile(String path, boolean withSize) throws IOException {
        JSObject o;
        if (!isContent(path)) {
            File f = new File(path);
            if (!f.isFile()) throw new IOException("Introuvable : " + path);
            o = fileObject(path, f.getName(), f.length(), f.lastModified(), null);
        } else {
            Uri uri = Uri.parse(path);
            try (Cursor c = resolver().query(uri, DOC_COLUMNS, null, null, null)) {
                if (c == null || !c.moveToFirst()) throw new IOException("Introuvable : " + path);
                if (Document.MIME_TYPE_DIR.equals(c.getString(2))) throw new IOException("Ce n'est pas un fichier : " + c.getString(1));
                o = fileObject(path, c.getString(1), c.getLong(3), c.getLong(4), c.getString(2));
            }
        }
        if (withSize && o.getString("mimeType", "").startsWith("image/")) addDimensions(path, o);
        return o;
    }

    private InputStream open(String path) throws IOException {
        if (!isContent(path)) return new FileInputStream(path);
        InputStream in = resolver().openInputStream(Uri.parse(path));
        if (in == null) throw new IOException("Lecture impossible : " + path);
        return in;
    }

    private static int orientation(InputStream in) {
        try {
            return new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        } catch (Exception e) {
            return ExifInterface.ORIENTATION_NORMAL;
        }
    }

    /** Largeur et hauteur affichées (rotation EXIF appliquée), lues dans l'en-tête de l'image. */
    private void addDimensions(String path, JSObject o) {
        try {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            try (InputStream in = open(path)) {
                BitmapFactory.decodeStream(in, null, opts);
            }
            if (opts.outWidth <= 0 || opts.outHeight <= 0) return;
            int orient;
            try (InputStream in = open(path)) {
                orient = orientation(in);
            }
            boolean swap = orient >= ExifInterface.ORIENTATION_TRANSPOSE && orient <= ExifInterface.ORIENTATION_ROTATE_270;
            o.put("width", swap ? opts.outHeight : opts.outWidth);
            o.put("height", swap ? opts.outWidth : opts.outHeight);
        } catch (Exception ignored) {
            // dimensions inconnues : la page les lira au chargement de la photo
        }
    }

    /** Contenu direct d'un dossier : fichiers (ou dossiers) dont le nom contient {@code contains}. */
    private JSArray children(String dir, boolean imagesOnly, String contains, boolean dirs) throws IOException {
        JSArray out = new JSArray();
        if (!isContent(dir)) {
            File[] list = new File(dir).listFiles();
            if (list == null) throw new IOException("Introuvable : " + dir);
            for (File f : list) {
                String name = f.getName();
                if (name.startsWith(".") || f.isDirectory() != dirs) continue;
                if (contains != null && !name.contains(contains)) continue;
                String mime = dirs ? Document.MIME_TYPE_DIR : mimeFromName(name);
                if (imagesOnly && !mime.startsWith("image/")) continue;
                out.put(dirs ? folderObject(f.getAbsolutePath(), name, f.canWrite()) : fileObject(f.getAbsolutePath(), name, f.length(), f.lastModified(), mime));
            }
            return out;
        }
        Uri base = Uri.parse(dir);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(base, DocumentsContract.getDocumentId(base));
        try (Cursor c = resolver().query(childrenUri, DOC_COLUMNS, null, null, null)) {
            if (c == null) throw new IOException("Introuvable : " + dir);
            while (c.moveToNext()) {
                String name = c.getString(1);
                String mime = c.getString(2);
                boolean isDir = Document.MIME_TYPE_DIR.equals(mime);
                if (name == null || name.startsWith(".") || isDir != dirs) continue;
                if (contains != null && !name.contains(contains)) continue;
                String path = docInTree(base, c.getString(0)).toString();
                if (dirs) {
                    out.put(folderObject(path, name, (c.getInt(5) & Document.FLAG_DIR_SUPPORTS_CREATE) != 0));
                } else {
                    String m = bestMime(mime, name);
                    if (imagesOnly && !m.startsWith("image/")) continue;
                    if (imagesOnly && m.equals("image/svg+xml")) continue;
                    out.put(fileObject(path, name, c.getLong(3), c.getLong(4), m));
                }
            }
        }
        return out;
    }

    /** Fichier (ou dossier) de ce nom exact dans un dossier ; null s'il n'existe pas. */
    private String childPath(String dir, String name, boolean isDir) throws Exception {
        if (!isContent(dir)) {
            File f = new File(dir, name);
            return f.exists() && f.isDirectory() == isDir ? f.getAbsolutePath() : null;
        }
        JSArray list = children(dir, false, name, isDir);
        for (int i = 0; i < list.length(); i++) {
            JSObject o = JSObject.fromJSONObject(list.getJSONObject(i));
            if (name.equals(o.getString("name"))) return o.getString("path");
        }
        return null;
    }

    // ------------------------------------------------------------------ sélecteurs

    /** Dossier imposé par les tests automatiques (versions de développement seulement). */
    private static String testOverride(String prop) {
        if (!BuildConfig.DEBUG) return null;
        try {
            Process p = Runtime.getRuntime().exec(new String[] { "getprop", prop });
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String v = r.readLine();
                return v != null && !v.trim().isEmpty() ? v.trim() : null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void userInfo(PluginCall call) {
        JSObject o = new JSObject();
        String model = Build.MODEL != null ? Build.MODEL : "Android";
        o.put("name", model);
        o.put("email", "android@" + model.replaceAll("\\s+", "-"));
        call.resolve(o);
    }

    @PluginMethod
    public void pickFolder(PluginCall call) {
        String test = testOverride("debug.collimo.folder");
        if (test != null) {
            async(call, c -> c.resolve(new JSObject().put("folder", describeFolder(test))));
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFolderPicked");
    }

    @ActivityCallback
    private void onFolderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("folder", (Object) null));
            return;
        }
        Uri tree = result.getData().getData();
        async(call, c -> {
            resolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            String path = docInTree(tree, DocumentsContract.getTreeDocumentId(tree)).toString();
            if ("catalogue".equals(c.getString("purpose"))) {
                getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PREF_CATALOGUE, path).apply();
            }
            c.resolve(new JSObject().put("folder", describeFolder(path)));
        });
    }

    @PluginMethod
    public void pickFile(PluginCall call) {
        String test = testOverride("debug.collimo.file");
        if (test != null) {
            async(call, c -> c.resolve(new JSObject().put("file", describeFile(test, true))));
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("json".equals(call.getString("filter")) ? "application/json" : "image/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFilePicked");
    }

    @ActivityCallback
    private void onFilePicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.resolve(new JSObject().put("file", (Object) null));
            return;
        }
        Uri uri = result.getData().getData();
        async(call, c -> {
            try {
                resolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // certains fournisseurs n'accordent qu'un accès temporaire : suffisant pour cette session
            }
            c.resolve(new JSObject().put("file", describeFile(uri.toString(), true)));
        });
    }

    // ------------------------------------------------------------------ lecture

    @PluginMethod
    public void folderInfo(PluginCall call) {
        async(call, c -> c.resolve(describeFolder(required(c, "path"))));
    }

    @PluginMethod
    public void fileInfo(PluginCall call) {
        async(call, c -> c.resolve(describeFile(required(c, "path"), true)));
    }

    @PluginMethod
    public void listImages(PluginCall call) {
        async(call, c -> c.resolve(new JSObject().put("files", children(required(c, "path"), true, null, false))));
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        async(call, c -> {
            String dir = required(c, "path");
            try {
                c.resolve(new JSObject().put("files", children(dir, false, c.getString("contains"), false)));
            } catch (IOException e) {
                // Dossier absent (pas encore de collage) : liste vide, comme sur ordinateur.
                c.resolve(new JSObject().put("files", new JSArray()));
            }
        });
    }

    @PluginMethod
    public void findChild(PluginCall call) {
        async(call, c -> c.resolve(new JSObject().put("path", childPath(required(c, "dir"), required(c, "name"), false))));
    }

    @PluginMethod
    public void ensureChildDir(PluginCall call) {
        async(call, c -> {
            String dir = required(c, "dir");
            String name = required(c, "name");
            String existing = childPath(dir, name, true);
            if (existing != null) {
                c.resolve(new JSObject().put("path", existing));
                return;
            }
            if (!isContent(dir)) {
                File f = new File(dir, name);
                if (!f.mkdirs() && !f.isDirectory()) throw new IOException("Création impossible : " + f);
                c.resolve(new JSObject().put("path", f.getAbsolutePath()));
                return;
            }
            Uri created = DocumentsContract.createDocument(resolver(), Uri.parse(dir), Document.MIME_TYPE_DIR, name);
            if (created == null) throw new IOException("Création du dossier « " + name + " » impossible");
            c.resolve(new JSObject().put("path", created.toString()));
        });
    }

    /** Miniature JPEG mise en cache ; renvoie le chemin du fichier, lu par la page via Capacitor. */
    @PluginMethod
    public void thumbnail(PluginCall call) {
        async(call, c -> {
            String path = required(c, "path");
            int size = Math.max(32, Math.min(1024, c.getInt("size", 400)));
            String version = c.getString("version", "");
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] h = md.digest((path + "|" + size + "|" + version).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : h) hex.append(String.format(Locale.ROOT, "%02x", b));
            File dir = new File(getContext().getCacheDir(), "miniatures");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            File out = new File(dir, hex + ".jpg");
            if (!out.isFile()) {
                Bitmap bmp = makeThumbnail(path, size);
                if (bmp == null) throw new IOException("Miniature impossible : " + path);
                File tmp = new File(dir, hex + ".tmp");
                try (OutputStream os = new FileOutputStream(tmp)) {
                    bmp.compress(Bitmap.CompressFormat.JPEG, 82, os);
                }
                bmp.recycle();
                if (!tmp.renameTo(out)) throw new IOException("Miniature impossible : " + path);
            }
            c.resolve(new JSObject().put("path", out.getAbsolutePath()));
        });
    }

    private Bitmap makeThumbnail(String path, int size) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                if (isContent(path)) return resolver().loadThumbnail(Uri.parse(path), new Size(size, size), null);
                return ThumbnailUtils.createImageThumbnail(new File(path), new Size(size, size), null);
            } catch (Exception ignored) {
                // repli ci-dessous
            }
        }
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            try (InputStream in = open(path)) {
                BitmapFactory.decodeStream(in, null, bounds);
            }
            if (bounds.outWidth <= 0) return null;
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / (opts.inSampleSize * 2) >= size) opts.inSampleSize *= 2;
            Bitmap bmp;
            try (InputStream in = open(path)) {
                bmp = BitmapFactory.decodeStream(in, null, opts);
            }
            if (bmp == null) return null;
            int orient;
            try (InputStream in = open(path)) {
                orient = orientation(in);
            }
            float deg = orient == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : orient == ExifInterface.ORIENTATION_ROTATE_180 ? 180 : orient == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
            float k = Math.min(1f, (float) size / Math.max(bmp.getWidth(), bmp.getHeight()));
            Matrix m = new Matrix();
            m.postScale(k, k);
            m.postRotate(deg);
            Bitmap out = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
            if (out != bmp) bmp.recycle();
            return out;
        } catch (Exception e) {
            return null;
        }
    }

    // ------------------------------------------------------------------ écriture

    /** Ajoute un morceau (base64) au fichier temporaire d'un envoi. */
    @PluginMethod
    public void appendTemp(PluginCall call) {
        async(call, c -> {
            File tmp = tempFile(required(c, "id"));
            byte[] bytes = Base64.decode(c.getString("data", ""), Base64.NO_WRAP);
            try (OutputStream os = new FileOutputStream(tmp, true)) {
                os.write(bytes);
            }
            c.resolve();
        });
    }

    /**
     * Termine un envoi : crée un nouveau fichier (erreur s'il existe déjà) ou, avec {@code replace},
     * réécrit un fichier JSON existant ; le fichier temporaire est supprimé dans tous les cas.
     */
    @PluginMethod
    public void commitTemp(PluginCall call) {
        async(call, c -> {
            File tmp = tempFile(required(c, "id"));
            try {
                String replace = c.getString("replace");
                String target;
                if (replace != null) {
                    if (!replace.toLowerCase(Locale.ROOT).endsWith(".json") && !nameOf(replace).toLowerCase(Locale.ROOT).endsWith(".json")) {
                        throw new IOException("Seuls les fichiers JSON peuvent être réécrits");
                    }
                    target = replace;
                    copy(tmp, target, isContent(target) ? "wt" : null);
                } else {
                    String dir = required(c, "dir");
                    String name = required(c, "name");
                    checkWritableName(name);
                    if (childPath(dir, name, false) != null) throw new IOException("Ce fichier existe déjà : " + name);
                    if (isContent(dir)) {
                        Uri created = DocumentsContract.createDocument(resolver(), Uri.parse(dir), mimeFromName(name), name);
                        if (created == null) throw new IOException("Création impossible : " + name);
                        target = created.toString();
                        copy(tmp, target, "w");
                    } else {
                        File f = new File(dir, name);
                        if (!f.createNewFile()) throw new IOException("Ce fichier existe déjà : " + name);
                        target = f.getAbsolutePath();
                        copy(tmp, target, null);
                    }
                }
                c.resolve(describeFile(target, false));
            } finally {
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
            }
        });
    }

    private String nameOf(String path) {
        if (!isContent(path)) return new File(path).getName();
        try (Cursor cur = resolver().query(Uri.parse(path), new String[] { Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
            return cur != null && cur.moveToFirst() ? cur.getString(0) : "";
        } catch (Exception e) {
            return "";
        }
    }

    private void copy(File from, String to, String mode) throws IOException {
        OutputStream os = isContent(to) ? resolver().openOutputStream(Uri.parse(to), mode) : new FileOutputStream(to, false);
        if (os == null) throw new IOException("Écriture impossible : " + to);
        try (InputStream in = new FileInputStream(from); OutputStream out = os) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }

    // ------------------------------------------------------------------ réglages et catalogue

    private File settingsFile() {
        return new File(getContext().getFilesDir(), "settings.json");
    }

    @PluginMethod
    public void loadSettings(PluginCall call) {
        async(call, c -> {
            File f = settingsFile();
            if (!f.isFile()) {
                c.resolve(new JSObject().put("data", (Object) null));
                return;
            }
            byte[] bytes = new byte[(int) f.length()];
            try (InputStream in = new FileInputStream(f)) {
                int off = 0;
                while (off < bytes.length) {
                    int n = in.read(bytes, off, bytes.length - off);
                    if (n < 0) break;
                    off += n;
                }
            }
            c.resolve(new JSObject().put("data", new String(bytes, StandardCharsets.UTF_8)));
        });
    }

    @PluginMethod
    public void saveSettings(PluginCall call) {
        async(call, c -> {
            File f = settingsFile();
            File tmp = new File(f.getPath() + ".tmp");
            try (OutputStream os = new FileOutputStream(tmp)) {
                os.write(c.getString("data", "null").getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(f)) throw new IOException("Enregistrement des réglages impossible");
            c.resolve();
        });
    }

    @PluginMethod
    public void catalogueDir(PluginCall call) {
        async(call, c -> {
            String chosen = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_CATALOGUE, null);
            if (chosen != null) {
                try {
                    c.resolve(describeFolder(chosen));
                    return;
                } catch (Exception e) {
                    // dossier partagé disparu ou accès retiré : retour au catalogue de l'app
                }
            }
            File dir = new File(getContext().getFilesDir(), "catalogue");
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            c.resolve(describeFolder(dir.getAbsolutePath()));
        });
    }

    @PluginMethod
    public void chooseCatalogueDir(PluginCall call) {
        String test = testOverride("debug.collimo.catalogue");
        if (test != null) {
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(PREF_CATALOGUE, test).apply();
            async(call, c -> c.resolve(new JSObject().put("folder", describeFolder(test))));
            return;
        }
        call.getData().put("purpose", "catalogue");
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onFolderPicked");
    }
}
