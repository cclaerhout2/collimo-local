import { COLLIMO_FOLDER_NAME, SUPPORTED_IMAGE_TYPES } from '../config'
import {
  SessionExpiredError,
  type DriveFileInfo,
  type DriveJsonFile,
  type DriveRef,
  type DriveService,
  type FolderInfo,
  type Photo,
  type UserSettings,
} from './types'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SETTINGS_FILE = 'collimo-settings.json'
/** Taille des miniatures affichées dans la galerie (plus grand côté, en pixels). */
const THUMB_SIZE = 480

/** Échappe une valeur pour une requête Drive `q`. */
export const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Requête des images directement dans un dossier (les sous-dossiers, dont « Collimo », sont exclus). */
export function photosQuery(folderId: string): string {
  return `${quote(folderId)} in parents and mimeType contains 'image/' and trashed = false`
}

export function collimoFolderQuery(parentId: string): string {
  return `name = ${quote(COLLIMO_FOLDER_NAME)} and mimeType = '${FOLDER_MIME}' and ${quote(parentId)} in parents and trashed = false`
}

/** Paramètres de liste : Drive partagés activés, et recherche limitée au bon Drive. */
export function listScope(driveId: string | null): Record<string, string> {
  const base = { supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }
  return driveId ? { ...base, corpora: 'drive', driveId } : { ...base, corpora: 'user' }
}

/** Agrandit la miniature Drive (le lien finit par `=s220`). */
export function sizedThumbnail(link: string | undefined, size = THUMB_SIZE): string | undefined {
  if (!link) return undefined
  return /=s\d+(-c)?$/.test(link) ? link.replace(/=s\d+(-c)?$/, `=s${size}`) : link
}

export const isSupportedImage = (mimeType: string) =>
  (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)

interface RawFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number }
}

export function toPhoto(f: RawFile): Photo {
  const m = f.imageMediaMetadata
  // Rotation 1 ou 3 (quart de tour) : largeur et hauteur affichées sont inversées.
  const swap = m?.rotation === 1 || m?.rotation === 3
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    thumbnailUrl: sizedThumbnail(f.thumbnailLink),
    width: swap ? m?.height : m?.width,
    height: swap ? m?.width : m?.height,
    supported: isSupportedImage(f.mimeType),
  }
}

export class DriveApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
  }
}

type Fetch = typeof fetch

export function createDriveClient(getToken: () => string, fetchImpl: Fetch = fetch.bind(globalThis)): DriveService {
  async function call<T>(url: string, init: RequestInit = {}, as: 'json' | 'blob' = 'json'): Promise<T> {
    const res = await fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) },
    })
    if (res.status === 401) throw new SessionExpiredError()
    if (!res.ok) {
      let message = res.statusText
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        message = body.error?.message ?? message
      } catch {
        /* corps non JSON */
      }
      throw new DriveApiError(res.status, message)
    }
    return (as === 'json' ? res.json() : res.blob()) as Promise<T>
  }

  const url = (path: string, params: Record<string, string>) =>
    `${API}${path}?${new URLSearchParams(params).toString()}`

  async function listAll<T>(path: string, key: string, params: Record<string, string>): Promise<T[]> {
    const items: T[] = []
    let pageToken: string | undefined
    do {
      const page = await call<Record<string, unknown>>(
        url(path, pageToken ? { ...params, pageToken } : params),
      )
      items.push(...((page[key] as T[] | undefined) ?? []))
      pageToken = page.nextPageToken as string | undefined
    } while (pageToken)
    return items
  }

  async function findSettingsFileId(): Promise<string | null> {
    const files = await listAll<{ id: string }>('/files', 'files', {
      spaces: 'appDataFolder',
      q: `name = ${quote(SETTINGS_FILE)} and trashed = false`,
      fields: 'nextPageToken, files(id)',
      pageSize: '10',
    })
    return files[0]?.id ?? null
  }

  type RawJsonFile = { id: string; name: string; modifiedTime?: string; webViewLink?: string; capabilities?: { canEdit?: boolean } }
  const JSON_FIELDS = 'id,name,modifiedTime,webViewLink,capabilities(canEdit)'
  const toJsonFile = (f: RawJsonFile): DriveJsonFile => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    canEdit: f.capabilities?.canEdit ?? false,
  })

  return {
    async findSharedDrive(ref) {
      type RawDrive = { id: string; name: string; capabilities?: { canAddChildren?: boolean } }
      const fields = 'id,name,capabilities(canAddChildren)'
      let d: RawDrive | undefined
      if (ref.id) {
        try {
          d = await call<RawDrive>(url(`/drives/${encodeURIComponent(ref.id)}`, { fields }))
        } catch (e) {
          if (e instanceof DriveApiError && (e.status === 404 || e.status === 403)) return null
          throw e
        }
      } else if (ref.name) {
        const found = await listAll<RawDrive>('/drives', 'drives', { q: `name = ${quote(ref.name)}`, pageSize: '10', fields: `nextPageToken, drives(${fields})` })
        d = found[0]
      }
      return d ? { id: d.id, name: d.name, canAddChildren: d.capabilities?.canAddChildren ?? false } : null
    },

    async findRootFile(driveId, name) {
      const files = await listAll<RawJsonFile>('/files', 'files', {
        ...listScope(driveId),
        q: `name = ${quote(name)} and ${quote(driveId)} in parents and trashed = false`,
        fields: `nextPageToken, files(${JSON_FIELDS})`,
        pageSize: '10',
      })
      return files[0] ? toJsonFile(files[0]) : null
    },

    async createJsonFile(parentId, name, data) {
      const boundary = `collimo-${Math.random().toString(36).slice(2)}`
      const metadata = JSON.stringify({ name, parents: [parentId], mimeType: 'application/json' })
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`
      const f = await call<RawJsonFile>(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(JSON_FIELDS)}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      return toJsonFile(f)
    },

    async updateJsonFile(id, data) {
      const f = await call<RawJsonFile>(
        `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&supportsAllDrives=true&fields=${encodeURIComponent(JSON_FIELDS)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
      )
      return toJsonFile(f)
    },

    async currentUser() {
      const about = await call<{ user: { displayName: string; emailAddress: string; photoLink?: string } }>(
        url('/about', { fields: 'user(displayName,emailAddress,photoLink)' }),
      )
      return { name: about.user.displayName, email: about.user.emailAddress, photoUrl: about.user.photoLink }
    },

    async listSharedDrives() {
      const drives = await listAll<{ id: string; name: string }>('/drives', 'drives', {
        pageSize: '100',
        fields: 'nextPageToken, drives(id,name)',
      })
      return drives
        .map<DriveRef>((d) => ({ id: d.id, name: d.name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    async getFolder(id) {
      const f = await call<{ id: string; name: string; driveId?: string; capabilities?: { canAddChildren?: boolean } }>(
        url(`/files/${encodeURIComponent(id)}`, {
          fields: 'id,name,driveId,capabilities(canAddChildren)',
          supportsAllDrives: 'true',
        }),
      )
      const info: FolderInfo = {
        id: f.id,
        name: f.name,
        driveId: f.driveId ?? null,
        canAddChildren: f.capabilities?.canAddChildren ?? false,
      }
      return info
    },

    async listPhotos(folder, driveId) {
      const files = await listAll<RawFile>('/files', 'files', {
        ...listScope(driveId),
        q: photosQuery(folder.id),
        orderBy: 'name_natural',
        pageSize: '1000',
        fields: 'nextPageToken, files(id,name,mimeType,thumbnailLink,imageMediaMetadata(width,height,rotation))',
      })
      return files.map(toPhoto)
    },

    async getPhoto(id) {
      const f = await call<RawFile>(
        url(`/files/${encodeURIComponent(id)}`, {
          supportsAllDrives: 'true',
          fields: 'id,name,mimeType,thumbnailLink,imageMediaMetadata(width,height,rotation)',
        }),
      )
      return toPhoto(f)
    },

    async ensureCollimoFolder(folderId) {
      const existing = await listAll<{ id: string }>('/files', 'files', {
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        corpora: 'allDrives',
        q: collimoFolderQuery(folderId),
        fields: 'nextPageToken, files(id)',
      })
      if (existing[0]) return existing[0].id
      const created = await call<{ id: string }>(url('/files', { supportsAllDrives: 'true', fields: 'id' }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: COLLIMO_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [folderId] }),
      })
      return created.id
    },

    async loadSettings() {
      const id = await findSettingsFileId()
      if (!id) return null
      const data = await call<UserSettings>(url(`/files/${id}`, { alt: 'media' }))
      return data?.version === 1 ? data : null
    },

    async saveSettings(settings) {
      const id = await findSettingsFileId()
      const body = JSON.stringify(settings)
      if (id) {
        await call(`${UPLOAD}/files/${id}?uploadType=media`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        return
      }
      const boundary = `collimo-${Math.random().toString(36).slice(2)}`
      const metadata = JSON.stringify({ name: SETTINGS_FILE, parents: ['appDataFolder'], mimeType: 'application/json' })
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
      await call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
    },

    fetchFileBlob(id) {
      return call<Blob>(url(`/files/${encodeURIComponent(id)}`, { alt: 'media', supportsAllDrives: 'true' }), {}, 'blob')
    },

    listFolderFiles(folderId) {
      return listAll<DriveFileInfo>('/files', 'files', {
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        corpora: 'allDrives',
        q: `${quote(folderId)} in parents and mimeType != '${FOLDER_MIME}' and trashed = false`,
        orderBy: 'modifiedTime desc',
        pageSize: '1000',
        fields: 'nextPageToken, files(id,name,modifiedTime,webViewLink,thumbnailLink)',
      })
    },

    readJson(id) {
      return call<unknown>(url(`/files/${encodeURIComponent(id)}`, { alt: 'media', supportsAllDrives: 'true' }))
    },

    async uploadFile(folderId, name, data, mimeType) {
      // 1. Ouverture d'une session d'envoi : Drive renvoie l'adresse où déposer le contenu.
      const start = await fetchImpl(
        `${UPLOAD}/files?${new URLSearchParams({ uploadType: 'resumable', supportsAllDrives: 'true', fields: 'id,name,modifiedTime,webViewLink' })}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(data.size),
          },
          body: JSON.stringify({ name, mimeType, parents: [folderId] }),
        },
      )
      if (start.status === 401) throw new SessionExpiredError()
      const session = start.headers.get('Location')
      if (!start.ok || !session) throw new DriveApiError(start.status, `envoi refusé (${start.status})`)
      // 2. Dépôt du contenu en une fois.
      const done = await fetchImpl(session, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: data })
      if (done.status === 401) throw new SessionExpiredError()
      if (!done.ok) throw new DriveApiError(done.status, `envoi interrompu (${done.status})`)
      return (await done.json()) as DriveFileInfo
    },
  }
}
