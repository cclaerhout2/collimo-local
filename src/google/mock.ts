/**
 * Drive simulé pour le développement et les captures d'écran (VITE_MOCK=1).
 * Aucune donnée réelle : les « photos » sont des images générées.
 */
import { COLLIMO_FOLDER_NAME } from '../config'
import type { DriveFileInfo, DriveRef, FolderInfo, Photo, Services, UserSettings } from './types'

const PALETTE = ['#2dd4a7', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

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

const sharedDrives: DriveRef[] = [
  { id: 'shared-com', name: 'Communication' },
  { id: 'shared-rh', name: 'Ressources humaines' },
]

const delay = <T,>(value: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(value), ms))

/** « Photo originale » simulée : un dégradé numéroté, pour vérifier l'ordre et le cadrage. */
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

export function createMockServices(): Services {
  let signedIn = false
  let settings: UserSettings | null = null
  const files = new Map<string, DriveFileInfo & { parent: string; data: Blob }>()

  return {
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
      listFolderFiles: (folderId) =>
        delay(
          [...files.values()]
            .filter((f) => f.parent === folderId)
            .sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))
            .map(({ id, name, modifiedTime, webViewLink, thumbnailLink }) => ({ id, name, modifiedTime, webViewLink, thumbnailLink })),
        ),
      async readJson(id) {
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
      async pickFolder(drive) {
        // Le vrai sélecteur Google est une fenêtre ; ici on choisit le premier dossier du Drive.
        const match = Object.values(folders).find((f) => f.driveId === drive.id)
        return delay(match ? { id: match.id, name: match.name } : null, 300)
      },
    },
  }
}
