/**
 * Processus principal de l'application Windows de Collimo (Electron) : fenêtre, protocole
 * `collimo://` (page de l'app, fichiers et miniatures du PC), sélecteurs de Windows et accès aux
 * fichiers pour la page, limités aux dossiers que l'utilisateur a choisis.
 *
 * Variables d'environnement, pour le développement et les tests automatiques :
 * - `COLLIMO_DEV_URL` : charge la page depuis le serveur de développement Vite ;
 * - `COLLIMO_USER_DATA` : dossier des données de l'app (réglages, catalogue) ;
 * - `COLLIMO_TEST_PICK_FOLDER`, `COLLIMO_TEST_PICK_FILE` : réponses des sélecteurs, sans fenêtre.
 */
import { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol, session, shell, type IpcMainInvokeEvent } from 'electron'
import { appendFileSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { APP_SCHEME, CHANNELS, type LocalFile, type LocalFolder, type PickFilter } from '../src/desktop/bridge'
import {
  ensureDir,
  fileInfo,
  FileAccessError,
  folderInfo,
  listFiles,
  listImages,
  mimeFromName,
  PathGuard,
  readJsonFile,
  replaceFile,
  writeJsonFile,
  writeNewFile,
} from './files'

/** Journal des erreurs inattendues, pour le diagnostic sur un PC (dossier temporaire de l'utilisateur). */
const ERROR_LOG = path.join(os.tmpdir(), 'collimo-erreurs.log')

/**
 * Note une erreur inattendue dans le journal, sans jamais échouer.
 * @param where - origine de l'erreur
 * @param e - erreur
 */
function logError(where: string, e: unknown): void {
  try {
    appendFileSync(ERROR_LOG, `${new Date().toISOString()} [${where}] ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`)
  } catch {
    /* journal impossible : rien d'autre à faire */
  }
}
process.on('uncaughtException', (e) => {
  logError('exception', e)
  dialog.showErrorBox('Collimo', `Erreur inattendue : ${e.message}\n\nDétails dans ${ERROR_LOG}`)
})
process.on('unhandledRejection', (e) => logError('promesse', e))

if (process.env.COLLIMO_USER_DATA) app.setPath('userData', path.resolve(process.env.COLLIMO_USER_DATA))

// Le protocole doit être déclaré avant que l'app soit prête : origine sûre, fetch et streaming permis.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
  },
])

/** Dossier de la page construite par Vite (`dist/`), à côté de ce fichier une fois compilé. */
const DIST_DIR = path.join(__dirname, '..', 'dist')
/**
 * Fichier des réglages de l'utilisateur (emplacement, langue).
 * @returns son chemin, dans les données de l'app
 */
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
/**
 * Fichier des réglages propres à l'application Windows (dossiers autorisés, dossier du catalogue).
 * @returns son chemin, dans les données de l'app
 */
const desktopFile = () => path.join(app.getPath('userData'), 'desktop.json')
/**
 * Dossier du catalogue de l'usine par défaut.
 * @returns son chemin, dans les données de l'app
 */
const defaultCatalogueDir = () => path.join(app.getPath('userData'), 'catalogue')

/** Réglages propres à l'application Windows. */
interface DesktopState {
  /** Dossiers et fichiers ouverts par l'utilisateur. */
  roots: string[]
  /** Dossier du catalogue de l'usine, s'il a été changé. */
  catalogueDir?: string
}

let state: DesktopState = { roots: [] }
let guard = new PathGuard()
let mainWindow: BrowserWindow | null = null

/** Charge les réglages de l'application Windows et reconstruit la liste des chemins autorisés. */
async function loadState(): Promise<void> {
  const raw = (await readJsonFile(desktopFile())) as Partial<DesktopState> | null
  state = {
    roots: Array.isArray(raw?.roots) ? raw.roots.filter((r): r is string => typeof r === 'string') : [],
    catalogueDir: typeof raw?.catalogueDir === 'string' ? raw.catalogueDir : undefined,
  }
  guard = new PathGuard(process.platform, [app.getPath('userData'), ...state.roots])
  if (state.catalogueDir) guard.add(state.catalogueDir)
}

/** Enregistre les réglages de l'application Windows. */
async function saveState(): Promise<void> {
  await writeJsonFile(desktopFile(), state)
}

/**
 * Autorise un chemin choisi par l'utilisateur et le mémorise pour les prochains lancements.
 * @param p - dossier ou fichier
 */
async function allow(p: string): Promise<void> {
  if (guard.add(p)) {
    state.roots = [...new Set([...state.roots, p])]
    await saveState()
  }
}

/**
 * Fenêtre parente des sélecteurs.
 * @param e - événement de l'appel venu de la page
 * @returns la fenêtre qui a fait l'appel
 */
const ownerOf = (e: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender) ?? mainWindow

/**
 * Enregistre une fonction du pont : vérifie que l'appel vient bien de la page de Collimo.
 * @param channel - canal de l'appel
 * @param handler - traitement
 */
function handle<A extends unknown[], R>(channel: string, handler: (e: IpcMainInvokeEvent, ...args: A) => Promise<R>): void {
  ipcMain.handle(channel, (e, ...args) => {
    const url = e.senderFrame?.url ?? ''
    const devUrl = process.env.COLLIMO_DEV_URL
    if (!url.startsWith(`${APP_SCHEME}://app/`) && !(devUrl && url.startsWith(devUrl))) {
      throw new FileAccessError('Appel refusé : origine inconnue')
    }
    return handler(e, ...(args as A))
  })
}

/** Branche les fonctions du pont exposées à la page (voir `src/desktop/bridge.ts`). */
function registerIpc(): void {
  handle(CHANNELS.userInfo, async () => {
    const name = os.userInfo().username
    return { name, email: `${name}@${os.hostname()}` }
  })

  handle(CHANNELS.pickFolder, async (e, opts: { title: string; defaultPath?: string }): Promise<LocalFolder | null> => {
    let dir = process.env.COLLIMO_TEST_PICK_FOLDER
    if (!dir) {
      const r = await dialog.showOpenDialog(ownerOf(e)!, {
        title: opts.title,
        defaultPath: opts.defaultPath ?? app.getPath('pictures'),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (r.canceled || !r.filePaths[0]) return null
      dir = r.filePaths[0]
    }
    const info = await folderInfo(dir)
    await allow(dir)
    return info
  })

  handle(CHANNELS.pickFile, async (e, opts: { title: string; defaultPath?: string; filter: PickFilter }): Promise<LocalFile | null> => {
    let file = process.env.COLLIMO_TEST_PICK_FILE
    if (!file) {
      const filters =
        opts.filter === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif'] }]
      const r = await dialog.showOpenDialog(ownerOf(e)!, {
        title: opts.title,
        defaultPath: opts.defaultPath ?? app.getPath('pictures'),
        properties: ['openFile'],
        filters,
      })
      if (r.canceled || !r.filePaths[0]) return null
      file = r.filePaths[0]
    }
    const info = await fileInfo(file)
    await allow(file)
    return info
  })

  handle(CHANNELS.folderInfo, async (_e, p: string) => folderInfo(guard.check(p)))
  handle(CHANNELS.listImages, async (_e, p: string) => listImages(guard.check(p)))
  handle(CHANNELS.listFiles, async (_e, p: string, contains?: string) => listFiles(guard.check(p), contains))
  handle(CHANNELS.fileInfo, async (_e, p: string) => fileInfo(guard.check(p)))
  handle(CHANNELS.writeNewFile, async (_e, dir: string, name: string, data: Uint8Array) => writeNewFile(guard.check(dir), name, data))
  handle(CHANNELS.replaceFile, async (_e, p: string, data: Uint8Array) => replaceFile(guard.check(p), data))
  handle(CHANNELS.ensureDir, async (_e, p: string) => ensureDir(guard.check(p)))
  handle(CHANNELS.loadSettings, async () => readJsonFile(settingsFile()))
  handle(CHANNELS.saveSettings, async (_e, data: unknown) => writeJsonFile(settingsFile(), data))

  handle(CHANNELS.catalogueDir, async () => {
    const dir = state.catalogueDir ?? defaultCatalogueDir()
    if (!state.catalogueDir) await ensureDir(dir)
    return folderInfo(dir)
  })

  handle(CHANNELS.chooseCatalogueDir, async (e, title: string): Promise<LocalFolder | null> => {
    let dir = process.env.COLLIMO_TEST_PICK_FOLDER
    if (!dir) {
      const r = await dialog.showOpenDialog(ownerOf(e)!, {
        title,
        defaultPath: state.catalogueDir ?? defaultCatalogueDir(),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (r.canceled || !r.filePaths[0]) return null
      dir = r.filePaths[0]
    }
    const info = await folderInfo(dir)
    guard.add(dir)
    state.catalogueDir = dir
    await saveState()
    return info
  })

  handle(CHANNELS.openPath, async (_e, p: string) => {
    const err = await shell.openPath(guard.check(p))
    if (err) throw new FileAccessError(err)
  })
  handle(CHANNELS.showInFolder, async (_e, p: string) => shell.showItemInFolder(guard.check(p)))
}

/**
 * Réponse d'erreur simple du protocole.
 * @param status - code HTTP
 * @param text - message
 * @returns la réponse
 */
const fail = (status: number, text: string) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/** Politique de sécurité de la page : rien d'extérieur, sauf les polices Google. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: blob: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${APP_SCHEME}:`,
  `connect-src 'self' data: blob: ${APP_SCHEME}: https://fonts.googleapis.com https://fonts.gstatic.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/**
 * Sert un fichier de la page construite (`dist/`).
 * @param pathname - chemin demandé dans l'adresse
 * @returns le fichier, ou une erreur 404
 */
async function serveApp(pathname: string): Promise<Response> {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'
  const file = path.resolve(DIST_DIR, rel)
  if (!file.startsWith(path.resolve(DIST_DIR) + path.sep)) return fail(403, 'forbidden')
  try {
    const data = await fs.readFile(file)
    const ext = path.extname(file).toLowerCase()
    const type =
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.wasm': 'application/wasm',
      }[ext] ?? mimeFromName(file)
    const headers: Record<string, string> = { 'content-type': type }
    if (ext === '.html') headers['content-security-policy'] = CSP
    return new Response(data, { headers })
  } catch {
    return fail(404, 'not found')
  }
}

/**
 * Sert un fichier local autorisé (photo, projet, catalogue).
 * @param p - chemin demandé
 * @returns le contenu, avec son type MIME
 */
async function serveFile(p: string): Promise<Response> {
  if (!guard.allows(p)) return fail(403, 'forbidden')
  try {
    const data = await fs.readFile(p)
    return new Response(data, { headers: { 'content-type': mimeFromName(p), 'access-control-allow-origin': '*' } })
  } catch {
    return fail(404, 'not found')
  }
}

/** Miniatures déjà calculées (les plus récentes), par chemin, taille et date. */
const thumbCache = new Map<string, Buffer>()
/** Nombre maximal de miniatures gardées en mémoire. */
const THUMB_CACHE_MAX = 600

/**
 * Sert la miniature d'une image locale : calculée par Windows (comme dans l'Explorateur, HEIC compris
 * si l'extension HEIF est installée), sinon par Chromium pour les formats courants.
 * @param p - chemin de l'image
 * @param size - plus grand côté voulu
 * @param version - date de modification de l'image
 * @returns une image JPEG, ou une erreur 404 si aucune miniature n'a pu être calculée
 */
async function serveThumb(p: string, size: number, version: string): Promise<Response> {
  if (!guard.allows(p)) return fail(403, 'forbidden')
  const key = `${p}|${size}|${version}`
  let jpeg = thumbCache.get(key)
  if (!jpeg) {
    let img: Electron.NativeImage | null = null
    if (process.platform === 'win32' || process.platform === 'darwin') {
      try {
        img = await nativeImage.createThumbnailFromPath(p, { width: size, height: size })
      } catch {
        img = null
      }
    }
    if (!img || img.isEmpty()) {
      const full = nativeImage.createFromPath(p)
      if (!full.isEmpty()) {
        const { width, height } = full.getSize()
        const k = Math.min(1, size / Math.max(width, height))
        img = full.resize({ width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)), quality: 'good' })
      }
    }
    if (!img || img.isEmpty()) return fail(404, 'no thumbnail')
    jpeg = img.toJPEG(82)
    thumbCache.set(key, jpeg)
    if (thumbCache.size > THUMB_CACHE_MAX) thumbCache.delete(thumbCache.keys().next().value!)
  } else {
    // Remet la miniature en tête des plus récentes.
    thumbCache.delete(key)
    thumbCache.set(key, jpeg)
  }
  return new Response(new Uint8Array(jpeg), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600', 'access-control-allow-origin': '*' },
  })
}

/** Branche le protocole `collimo://` : `app` (page), `file` (fichier local), `thumb` (miniature). */
function registerProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const p = url.searchParams.get('path') ?? ''
    switch (url.host) {
      case 'app':
        return serveApp(url.pathname)
      case 'file':
        return serveFile(p)
      case 'thumb':
        return serveThumb(p, Math.min(1024, Math.max(32, Number(url.searchParams.get('size')) || 400)), url.searchParams.get('v') ?? '')
      default:
        return fail(404, 'not found')
    }
  })
}

/**
 * Traite un lien ouvert par la page : `collimo://shell/…` ouvre un fichier ou l'Explorateur, une
 * adresse web s'ouvre dans le navigateur par défaut ; rien ne s'ouvre dans une fenêtre de Collimo.
 * @param target - adresse du lien
 */
function openLink(target: string): void {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return
  }
  if (url.protocol === `${APP_SCHEME}:` && url.host === 'shell') {
    const p = url.searchParams.get('path') ?? ''
    if (!guard.allows(p)) return
    if (url.searchParams.get('action') === 'reveal') shell.showItemInFolder(p)
    else void shell.openPath(p)
  } else if (url.protocol === 'https:' || url.protocol === 'http:') {
    void shell.openExternal(url.toString())
  }
}

/** Ouvre la fenêtre principale. */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Collimo',
    backgroundColor: '#17171b',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  mainWindow.removeMenu()
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  const wc = mainWindow.webContents
  wc.on('render-process-gone', (_e, d) => logError('page', `${d.reason} (code ${d.exitCode})`))
  wc.on('preload-error', (_e, p, err) => logError(`préchargement ${p}`, err))
  wc.setWindowOpenHandler(({ url }) => {
    openLink(url)
    return { action: 'deny' }
  })
  // La page ne quitte jamais l'app : tout autre lien s'ouvre à l'extérieur.
  wc.on('will-navigate', (e, url) => {
    if (url.startsWith(`${APP_SCHEME}://app/`) || (process.env.COLLIMO_DEV_URL && url.startsWith(process.env.COLLIMO_DEV_URL))) return
    e.preventDefault()
    openLink(url)
  })
  // F12 ou Ctrl+Maj+I : outils de développement, pour le diagnostic ; Ctrl+R / F5 : recharger.
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      wc.toggleDevTools()
      e.preventDefault()
    } else if (input.key === 'F5' || (input.control && !input.shift && input.key.toLowerCase() === 'r')) {
      wc.reload()
      e.preventDefault()
    }
  })

  void mainWindow.loadURL(process.env.COLLIMO_DEV_URL ?? `${APP_SCHEME}://app/index.html`)
}

// Une seule instance : un second lancement remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.setAppUserModelId('fr.collimo.app')
  app.on('window-all-closed', () => app.quit())
  app.on('child-process-gone', (_e, d) => d.reason !== 'clean-exit' && logError(d.type, `${d.reason} (code ${d.exitCode})`))
  void app.whenReady().then(async () => {
    await loadState()
    registerProtocol()
    registerIpc()
    // « Enregistrer une copie sous… » : la boîte de dialogue s'ouvre dans le dossier Images.
    session.defaultSession.on('will-download', (_e, item) => {
      item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('pictures'), item.getFilename()) })
    })
    // Aucune autorisation du navigateur (caméra, notifications…) n'est utile à Collimo.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'))
    createWindow()
  })
}
