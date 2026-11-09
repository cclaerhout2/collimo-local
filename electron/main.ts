/**
 * Processus principal de l'application de bureau de Collimo (Electron ; Windows, macOS, Linux) : fenêtre, protocole
 * `collimo://` (page de l'app, fichiers et miniatures du PC), sélecteurs de Windows et accès aux
 * fichiers pour la page, limités aux dossiers que l'utilisateur a choisis.
 *
 * Variables d'environnement, pour le développement et les tests automatiques :
 * - `COLLIMO_DEV_URL` : charge la page depuis le serveur de développement Vite (jamais dans l'app installée) ;
 * - `COLLIMO_USER_DATA` : dossier des données de l'app (réglages, catalogue) ;
 * - `COLLIMO_TEST_PICK_FOLDER`, `COLLIMO_TEST_PICK_FILE` : réponses des sélecteurs, sans fenêtre.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, session, shell, type IpcMainInvokeEvent } from 'electron'
import { appendFileSync, readFileSync, rmSync, statSync, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { APP_SCHEME, CHANNELS, type LocalFile, type LocalFolder, type PickFilter } from '../src/desktop/bridge'
import {
  assertWritableType,
  ensureDir,
  fileInfo,
  FileAccessError,
  folderInfo,
  listFiles,
  listFolders,
  listImages,
  moveFile,
  renameFile,
  mimeFromName,
  PathGuard,
  readJsonFile,
  replaceFile,
  writeJsonFile,
  writeNewFile,
} from './files'

/** Journal du démarrage et des erreurs inattendues, pour le diagnostic sur un PC (dossier temporaire de l'utilisateur). */
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
/**
 * Note une étape du démarrage dans le journal (utile quand l'app ne s'affiche pas, par exemple sur un PC d'entreprise).
 * @param message - étape
 */
function logStep(message: string): void {
  logError('démarrage', message)
}
// Le journal repart de zéro au-delà de 1 Mo.
try {
  if (statSync(ERROR_LOG).size > 1_000_000) rmSync(ERROR_LOG)
} catch {
  /* pas encore de journal */
}
logStep(`Collimo ${app.getVersion()} (${process.platform} ${os.release()}, ${process.arch}) : ${process.execPath}`)
process.on('uncaughtException', (e) => {
  logError('exception', e)
  dialog.showErrorBox('Collimo', `Erreur inattendue : ${e.message}\n\nDétails dans ${ERROR_LOG}`)
})
process.on('unhandledRejection', (e) => logError('promesse', e))

/**
 * Indique si le bac à sable de Chromium ne peut pas démarrer : AppImage (sans profil AppArmor, que seul
 * le paquet .deb installe) sur un Linux qui restreint les espaces de noms des utilisateurs (Ubuntu 24.04 et suivants).
 * @returns `true` dans ce seul cas
 */
function sandboxBlocked(): boolean {
  if (process.platform !== 'linux' || !process.env.APPIMAGE) return false
  try {
    return readFileSync('/proc/sys/kernel/apparmor_restrict_unprivileged_userns', 'utf8').trim() === '1'
  } catch {
    return false
  }
}
// Sans cela, l'AppImage s'arrêterait au démarrage. La page reste isolée (contextIsolation, aucun accès à Node).
if (sandboxBlocked()) app.commandLine.appendSwitch('no-sandbox')

if (process.env.COLLIMO_USER_DATA) app.setPath('userData', path.resolve(process.env.COLLIMO_USER_DATA))

/** Origine du serveur de développement Vite, hors app installée seulement ; null sinon. */
const DEV_ORIGIN = !app.isPackaged && process.env.COLLIMO_DEV_URL ? new URL(process.env.COLLIMO_DEV_URL).origin : null

/**
 * Indique si une adresse est celle de la page de Collimo (ou du serveur de développement).
 * @param url - adresse à vérifier
 * @returns `true` pour la page de l'app
 */
function isAppUrl(url: string): boolean {
  if (url.startsWith(`${APP_SCHEME}://app/`)) return true
  try {
    return DEV_ORIGIN !== null && new URL(url).origin === DEV_ORIGIN
  } catch {
    return false
  }
}

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
/** Droit d'écriture des dossiers vérifié par un vrai essai lors de leur choix, pour la session. */
const probed = new Map<string, boolean>()

/** Charge les réglages de l'application Windows et reconstruit la liste des chemins autorisés. */
async function loadState(): Promise<void> {
  const raw = (await readJsonFile(desktopFile())) as Partial<DesktopState> | null
  state = {
    roots: Array.isArray(raw?.roots) ? raw.roots.filter((r): r is string => typeof r === 'string') : [],
    catalogueDir: typeof raw?.catalogueDir === 'string' ? raw.catalogueDir : undefined,
  }
  // Des données de l'app, seul le catalogue est accessible à la page (pas les réglages ni ceux de Chromium).
  guard = new PathGuard(process.platform, [defaultCatalogueDir(), ...state.roots])
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
    if (!isAppUrl(e.senderFrame?.url ?? '')) {
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
        message: opts.title,
        defaultPath: opts.defaultPath ?? app.getPath('pictures'),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (r.canceled || !r.filePaths[0]) return null
      dir = r.filePaths[0]
    }
    const info = await folderInfo(dir, true)
    probed.set(dir, info.writable)
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
        message: opts.title,
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

  handle(CHANNELS.folderInfo, async (_e, p: string) => {
    const info = await folderInfo(guard.check(p))
    return { ...info, writable: probed.get(p) ?? info.writable }
  })
  handle(CHANNELS.listImages, async (_e, p: string) => listImages(guard.check(p)))
  handle(CHANNELS.listFiles, async (_e, p: string, contains?: string) => listFiles(guard.check(p), contains))
  handle(CHANNELS.fileInfo, async (_e, p: string) => fileInfo(guard.check(p)))
  handle(CHANNELS.listFolders, async (_e, p: string) => listFolders(guard.check(p)))
  handle(CHANNELS.renameFile, async (_e, p: string, name: string) => renameFile(guard.check(p), name))
  handle(CHANNELS.moveFile, async (_e, p: string, dir: string) => moveFile(guard.check(p), guard.check(dir)))
  handle(CHANNELS.writeNewFile, async (_e, dir: string, name: string, data: Uint8Array) => writeNewFile(guard.check(dir), name, data))
  handle(CHANNELS.replaceFile, async (_e, p: string, data: Uint8Array) => {
    assertWritableType(p)
    if (!p.toLowerCase().endsWith('.json')) throw new FileAccessError('Seuls les fichiers JSON peuvent être réécrits')
    return replaceFile(guard.check(p), data)
  })
  handle(CHANNELS.ensureDir, async (_e, p: string) => ensureDir(guard.check(p)))
  handle(CHANNELS.loadSettings, async () => readJsonFile(settingsFile()))
  handle(CHANNELS.saveSettings, async (_e, data: unknown) => writeJsonFile(settingsFile(), data))

  handle(CHANNELS.catalogueDir, async () => {
    const dir = state.catalogueDir ?? defaultCatalogueDir()
    if (!state.catalogueDir) await ensureDir(dir)
    const info = await folderInfo(dir)
    return { ...info, writable: probed.get(dir) ?? info.writable }
  })

  handle(CHANNELS.chooseCatalogueDir, async (e, title: string): Promise<LocalFolder | null> => {
    let dir = process.env.COLLIMO_TEST_PICK_FOLDER
    if (!dir) {
      const r = await dialog.showOpenDialog(ownerOf(e)!, {
        title,
        message: title,
        defaultPath: state.catalogueDir ?? defaultCatalogueDir(),
        properties: ['openDirectory', 'createDirectory'],
      })
      if (r.canceled || !r.filePaths[0]) return null
      dir = r.filePaths[0]
    }
    const info = await folderInfo(dir, true)
    probed.set(dir, info.writable)
    guard.add(dir)
    state.catalogueDir = dir
    await saveState()
    return info
  })
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
    // Repli décodé sur le processus principal : réservé aux fichiers raisonnables, pour ne pas figer la
    // fenêtre ; au-delà, la page décode elle-même la photo (voir Thumbnail.tsx).
    const bytes = (await fs.stat(p).catch(() => null))?.size ?? Infinity
    if ((!img || img.isEmpty()) && bytes < 12 * 1024 * 1024) {
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

/** Fichiers que la page peut faire ouvrir par Windows : images exportées et JSON, jamais un programme. */
const OPENABLE = ['.jpg', '.jpeg', '.png', '.json']

/**
 * Ouvre un dossier dans l'Explorateur, ou un fichier sans risque dans son application par défaut.
 * @param p - chemin autorisé
 * @param reveal - montrer le fichier dans l'Explorateur plutôt que l'ouvrir
 */
async function openLocal(p: string, reveal: boolean): Promise<void> {
  if (!guard.allows(p)) return
  const stat = await fs.stat(p).catch(() => null)
  if (!stat) return
  if (stat.isDirectory()) void shell.openPath(p)
  else if (reveal) shell.showItemInFolder(p)
  else if (stat.isFile() && OPENABLE.includes(path.extname(p).toLowerCase())) void shell.openPath(p)
}

/**
 * Traite un lien ouvert par la page : `collimo://shell/…` ouvre un dossier ou un fichier sans risque,
 * une adresse web s'ouvre dans le navigateur par défaut ; rien ne s'ouvre dans une fenêtre de Collimo.
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
    void openLocal(url.searchParams.get('path') ?? '', url.searchParams.get('action') === 'reveal')
  } else if (url.protocol === 'https:' || url.protocol === 'http:') {
    void shell.openExternal(url.toString())
  }
}

/**
 * Menu de macOS, où chaque application en a un : Collimo (À propos, Masquer, Quitter), Édition
 * (couper, copier, coller), Fenêtre. Annuler et Rétablir n'y sont pas : ⌘Z et ⌘⇧Z restent à l'éditeur
 * de collage, qui gère son propre historique. Sous Windows et Linux, la fenêtre n'a pas de menu.
 */
function setMacMenu(): void {
  const fr = app.getLocale().toLowerCase().startsWith('fr')
  const l = (frText: string, enText: string) => (fr ? frText : enText)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Collimo',
        submenu: [
          { role: 'about', label: l('À propos de Collimo', 'About Collimo') },
          { type: 'separator' },
          { role: 'hide', label: l('Masquer Collimo', 'Hide Collimo') },
          { role: 'hideOthers', label: l('Masquer les autres', 'Hide Others') },
          { role: 'unhide', label: l('Tout afficher', 'Show All') },
          { type: 'separator' },
          { role: 'quit', label: l('Quitter Collimo', 'Quit Collimo') },
        ],
      },
      {
        label: l('Édition', 'Edit'),
        submenu: [
          { role: 'cut', label: l('Couper', 'Cut') },
          { role: 'copy', label: l('Copier', 'Copy') },
          { role: 'paste', label: l('Coller', 'Paste') },
          { role: 'selectAll', label: l('Tout sélectionner', 'Select All') },
        ],
      },
      {
        label: l('Fenêtre', 'Window'),
        submenu: [
          { role: 'minimize', label: l('Placer dans le Dock', 'Minimize') },
          { role: 'zoom', label: l('Réduire/agrandir', 'Zoom') },
          { role: 'togglefullscreen', label: l('Plein écran', 'Full Screen') },
          { type: 'separator' },
          { role: 'close', label: l('Fermer la fenêtre', 'Close Window') },
        ],
      },
    ]),
  )
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
  if (process.platform !== 'darwin') mainWindow.removeMenu()
  mainWindow.once('ready-to-show', () => {
    logStep('fenêtre affichée')
    mainWindow?.show()
  })
  // Filet de sécurité : si la page tarde (logiciel de sécurité, carte graphique…), la fenêtre s'affiche quand même ;
  // sans cela, l'app resterait invisible et bloquerait tout nouveau lancement (une seule instance).
  setTimeout(() => {
    if (!mainWindow || mainWindow.isVisible()) return
    logStep('page pas prête après 10 s : affichage forcé de la fenêtre')
    mainWindow.show()
  }, 10_000)
  mainWindow.on('closed', () => (mainWindow = null))

  const wc = mainWindow.webContents
  wc.on('render-process-gone', (_e, d) => logError('page', `${d.reason} (code ${d.exitCode})`))
  wc.on('did-fail-load', (_e, code, desc, url) => logError('chargement', `${desc} (${code}) ${url}`))
  wc.on('unresponsive', () => logError('page', 'ne répond plus'))
  wc.on('preload-error', (_e, p, err) => logError(`préchargement ${p}`, err))
  wc.setWindowOpenHandler(({ url }) => {
    openLink(url)
    return { action: 'deny' }
  })
  // La page ne quitte jamais l'app : tout autre lien s'ouvre à l'extérieur.
  wc.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return
    e.preventDefault()
    openLink(url)
  })
  // F12 ou Ctrl+Maj+I (⌘⌥I sur Mac) : outils de développement, pour le diagnostic ; Ctrl+R (⌘R) ou F5 : recharger.
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    // Ctrl sous Windows et Linux, ⌘ sous macOS (avec ⌥ pour les outils de développement).
    const mod = process.platform === 'darwin' ? input.meta : input.control
    const key = input.key.toLowerCase()
    if (input.key === 'F12' || (mod && (input.shift || input.alt) && key === 'i')) {
      wc.toggleDevTools()
      e.preventDefault()
    } else if (input.key === 'F5' || (mod && !input.shift && key === 'r')) {
      wc.reload()
      e.preventDefault()
    }
  })

  void mainWindow.loadURL(DEV_ORIGIN && process.env.COLLIMO_DEV_URL ? process.env.COLLIMO_DEV_URL : `${APP_SCHEME}://app/index.html`)
}

// Une seule instance : un second lancement remet la fenêtre existante au premier plan.
if (!app.requestSingleInstanceLock()) {
  logStep('Collimo est déjà ouvert : la fenêtre existante passe au premier plan')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return void (app.isReady() && createWindow())
    if (!mainWindow.isVisible()) mainWindow.show()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.setAppUserModelId('fr.collimo.app')
  // macOS : l'app reste ouverte sans fenêtre, et en rouvre une quand on clique sur son icône du Dock.
  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
  app.on('activate', () => app.isReady() && !mainWindow && createWindow())
  app.on('child-process-gone', (_e, d) => d.reason !== 'clean-exit' && logError(d.type, `${d.reason} (code ${d.exitCode})`))
  void app
    .whenReady()
    .then(async () => {
      logStep('Electron prêt')
      await loadState()
      registerProtocol()
      registerIpc()
      // « Enregistrer une copie sous… » : la boîte de dialogue s'ouvre dans le dossier Images.
      session.defaultSession.on('will-download', (_e, item) => {
        item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('pictures'), item.getFilename()) })
      })
      // Aucune autorisation du navigateur (caméra, notifications…) n'est utile à Collimo.
      if (process.platform === 'darwin') setMacMenu()
      session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'))
      createWindow()
    })
    .catch((e: unknown) => {
      logError('démarrage', e)
      dialog.showErrorBox('Collimo', `Démarrage impossible : ${e instanceof Error ? e.message : String(e)}\n\nDétails dans ${ERROR_LOG}`)
      app.quit()
    })
}
