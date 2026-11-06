/**
 * Drive simulé pour le développement et les captures d'écran (VITE_MOCK=1).
 * Aucune donnée réelle : les « photos » sont des images générées.
 */
import { COLLIMO_FOLDER_NAME } from '../config'
import type { DriveRef, FolderInfo, Photo, Services, UserSettings } from './types'

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
      { id: 'heic-1', name: 'IMG_2000.HEIC', mimeType: 'image/heic', supported: false },
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

export function createMockServices(): Services {
  let signedIn = false
  let settings: UserSettings | null = null

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
      fetchFileBlob: async () => new Blob(),
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
