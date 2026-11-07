/**
 * Drive simulé pour le développement et les captures d'écran (VITE_MOCK=1).
 * Aucune donnée réelle : les « photos » sont des images générées.
 */
import { COLLIMO_FOLDER_NAME } from '../config'
import { DriveApiError } from './drive'
import type { DriveFileInfo, DriveJsonFile, DriveRef, FolderInfo, Photo, Services, UserSettings } from './types'

/** Couleurs des dégradés des fausses photos. */
const PALETTE = ['#2dd4a7', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

/**
 * Fausse photo : une miniature SVG en dégradé, aux couleurs tirées de son numéro.
 * @param i - numéro de la photo (nom et couleurs)
 * @param portrait - `true` pour une photo en hauteur (600 × 800), sinon en largeur (800 × 600)
 * @returns la photo simulée
 */
function fakePhoto(i: number, portrait: boolean): Photo {
  const [w, h] = portrait ? [600, 800] : [800, 600]
  const c1 = PALETTE[i % PALETTE.length]
  const c2 = PALETTE[(i + 3) % PALETTE.length]
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w * 0.7}" cy="${h * 0.3}" r="${h * 0.12}" fill="#fff" fill-opacity="0.35"/>` +
    `<path d="M0 ${h} L${w * 0.35} ${h * 0.55} L${w * 0.6} ${h * 0.8} L${w * 0.8} ${h * 0.6} L${w} ${h} Z" fill="#000" fill-opacity="0.18"/>` +
    `</svg>`
  return {
    id: `photo-${i}`,
    name: `IMG_${String(1000 + i)}.jpg`,
    mimeType: 'image/jpeg',
    thumbnailUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    width: w,
    height: h,
    supported: true,
  }
}

/** Dossiers simulés, par identifiant : un dans Mon Drive, deux dans un Drive partagé (dont un en lecture seule). */
const folders: Record<string, FolderInfo & { photos: Photo[] }> = {
  seminaire: {
    id: 'seminaire',
    name: 'Séminaire 2026',
    driveId: null,
    canAddChildren: true,
    photos: [
      ...Array.from({ length: 23 }, (_, i) => fakePhoto(i, i % 3 === 0)),
      { id: 'tiff-1', name: 'SCAN_0001.TIF', mimeType: 'image/tiff', supported: false },
    ],
  },
  equipe: {
    id: 'equipe',
    name: 'Photos équipe',
    driveId: 'shared-com',
    canAddChildren: true,
    photos: Array.from({ length: 8 }, (_, i) => fakePhoto(i + 40, i % 2 === 0)),
  },
  archives: {
    id: 'archives',
    name: 'Archives (lecture seule)',
    driveId: 'shared-com',
    canAddChildren: false,
    photos: Array.from({ length: 4 }, (_, i) => fakePhoto(i + 60, false)),
  },
}

/** Drive partagés simulés. */
const sharedDrives: DriveRef[] = [
  { id: 'shared-com', name: 'Communication' },
  { id: 'shared-rh', name: 'Ressources humaines' },
]

/**
 * Renvoie une valeur après un délai, pour imiter la latence du réseau.
 * @param value - valeur à renvoyer
 * @param ms - délai en millisecondes
 * @returns une promesse résolue avec `value`
 */
const delay = <T>(value: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(value), ms))

/**
 * « Photo originale » simulée : un dégradé numéroté, pour vérifier l'ordre et le cadrage.
 * @param id - identifiant de la photo (son numéro est extrait des chiffres)
 * @returns une image PNG de 1600 × 1200 (ou 1200 × 1600 en hauteur)
 */
async function fakeOriginal(id: string): Promise<Blob> {
  const i = Number(id.replace(/\D/g, '')) || 0
  const portrait = Object.values(folders).some((f) => f.photos.some((p) => p.id === id && (p.height ?? 0) > (p.width ?? 0)))
  const [w, h] = portrait ? [1200, 1600] : [1600, 1200]
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, PALETTE[i % PALETTE.length])
  g.addColorStop(1, PALETTE[(i + 3) % PALETTE.length])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.arc(w * 0.7, h * 0.3, h * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(w * 0.35, h * 0.55)
  ctx.lineTo(w * 0.6, h * 0.8)
  ctx.lineTo(w * 0.8, h * 0.6)
  ctx.lineTo(w, h)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `bold ${Math.round(h * 0.22)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(i), w / 2, h / 2)
  return canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Drive partagé du catalogue simulé. `?catalogue=lecteur` dans l'adresse : simple lecteur (pas d'usine) ;
 * `?catalogue=autoriser` : catalogue existant, créé par un autre admin (il faut autoriser Collimo dessus).
 */
const CATALOGUE_DRIVE = { id: 'shared-catalogue', name: 'Collimo – Catalogue' }
/**
 * Mode du catalogue simulé, lu dans le paramètre `catalogue` de l'adresse.
 * @returns `admin` par défaut, sinon `lecteur` ou `autoriser`
 */
function catalogueMode(): 'admin' | 'lecteur' | 'autoriser' {
  const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('catalogue') : null
  return v === 'lecteur' || v === 'autoriser' ? v : 'admin'
}

/**
 * Crée les services simulés : connexion d'un clic sans Google, Drive en mémoire, sélecteur qui choisit tout seul.
 * @returns les services, à utiliser à la place des services Google
 */
export function createMockServices(): Services {
  const mode = catalogueMode()
  const json = new Map<string, DriveJsonFile & { parent: string; data: string; granted: boolean }>()
  if (mode === 'autoriser') {
    json.set('catalogue-1', {
      id: 'catalogue-1',
      name: 'collimo-catalogue.json',
      parent: CATALOGUE_DRIVE.id,
      canEdit: true,
      granted: false,
      modifiedTime: new Date().toISOString(),
      webViewLink: '#demo',
      data: JSON.stringify({ format: 'collimo-catalogue', version: 1, layouts: [], hiddenBuiltins: [] }),
    })
  }
  const publicJson = ({ id, name, modifiedTime, webViewLink, canEdit }: DriveJsonFile) => ({ id, name, modifiedTime, webViewLink, canEdit })
  let signedIn = false
  let settings: UserSettings | null = null
  const files = new Map<string, DriveFileInfo & { parent: string; data: Blob }>()

  return {
    kind: 'mock',
    auth: {
      async signIn() {
        await delay(null, 500)
        signedIn = true
      },
      getToken() {
        if (!signedIn) throw new Error('not signed in')
        return 'mock-token'
      },
      signOut() {
        signedIn = false
      },
    },
    drive: {
      currentUser: () => delay({ name: 'Cédric Démo', email: 'demo@entreprise.com' }),
      listSharedDrives: () => delay(sharedDrives),
      async getFolder(id) {
        const f = folders[id]
        if (!f) throw new Error('folder not found')
        return delay({ id: f.id, name: f.name, driveId: f.driveId, canAddChildren: f.canAddChildren })
      },
      listPhotos: (folder) => delay(folders[folder.id]?.photos ?? [], 600),
      async getPhoto(id) {
        const p = Object.values(folders)
          .flatMap((f) => f.photos)
          .find((x) => x.id === id)
        if (!p) throw new Error('photo not found')
        return delay(p, 150)
      },
      ensureCollimoFolder: (folderId) => delay(`${folderId}/${COLLIMO_FOLDER_NAME}`),
      loadSettings: () => delay(settings),
      async saveSettings(s) {
        settings = s
        await delay(null, 150)
      },
      async fetchFileBlob(id) {
        const stored = files.get(id)
        return stored ? stored.data : fakeOriginal(id)
      },
      folderLink: (folderId) => `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`,
      listFolderFiles: (folderId, namePrefix) =>
        delay(
          [...files.values()]
            .filter((f) => f.parent === folderId && (!namePrefix || f.name.includes(namePrefix)))
            .sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))
            .map(({ id, name, modifiedTime, webViewLink, thumbnailLink }) => ({ id, name, modifiedTime, webViewLink, thumbnailLink })),
        ),
      async findSharedDrive(ref) {
        const match = ref.id ? ref.id === CATALOGUE_DRIVE.id : ref.name === CATALOGUE_DRIVE.name
        return delay(match ? { ...CATALOGUE_DRIVE, canAddChildren: mode !== 'lecteur' } : null, 200)
      },
      async findRootFile(driveId, name) {
        const f = [...json.values()].find((x) => x.parent === driveId && x.name === name)
        return delay(f ? { ...publicJson(f), canEdit: mode !== 'lecteur' } : null, 200)
      },
      async createJsonFile(parentId, name, data) {
        const id = `catalogue-${json.size + 1}`
        const f = {
          id,
          name,
          parent: parentId,
          canEdit: true,
          granted: true,
          modifiedTime: new Date().toISOString(),
          webViewLink: '#demo',
          data: JSON.stringify(data),
        }
        json.set(id, f)
        return delay(publicJson(f), 300)
      },
      async updateJsonFile(id, data) {
        const f = json.get(id)
        if (!f) throw new DriveApiError(404, 'file not found')
        if (!f.granted || mode === 'lecteur') throw new DriveApiError(403, 'The user has not granted the app write access to the file')
        f.data = JSON.stringify(data)
        f.modifiedTime = new Date().toISOString()
        return delay(publicJson(f), 300)
      },
      async readJson(id) {
        const j = json.get(id)
        if (j) return delay(JSON.parse(j.data), 200)
        const f = files.get(id)
        if (!f) throw new Error('file not found')
        return JSON.parse(await f.data.text())
      },
      async uploadFile(folderId, name, data) {
        const id = `file-${files.size + 1}`
        const thumbnailLink = data.type.startsWith('image/') ? URL.createObjectURL(data) : undefined
        const info = { id, name, modifiedTime: new Date().toISOString(), webViewLink: '#demo', thumbnailLink }
        files.set(id, { ...info, parent: folderId, data })
        return delay(info, 500)
      },
    },
    picker: {
      async pickFile(drive) {
        // Démo : le sélecteur « choisit » le catalogue, ce qui autorise Collimo à le modifier.
        const f = [...json.values()].find((x) => x.parent === drive.id)
        if (f) f.granted = true
        return delay(f ? { id: f.id } : null, 300)
      },
      async pickImage(drive) {
        // Démo : la dernière photo du premier dossier de ce Drive.
        const f = Object.values(folders).find((x) => x.driveId === drive.id)
        const p = f?.photos.filter((x) => x.supported).at(-1)
        return delay(p ? { id: p.id } : null, 300)
      },
      async pickFolder(drive) {
        // Le vrai sélecteur Google est une fenêtre ; ici on choisit le premier dossier du Drive.
        const match = Object.values(folders).find((f) => f.driveId === drive.id)
        return delay(match ? { id: match.id, name: match.name } : null, 300)
      },
    },
  }
}
