/**
 * Client de l'API Google Drive v3 (appels `fetch` directs) : photos, dossiers, réglages de l'utilisateur,
 * fichiers JSON du catalogue et envoi des collages. Les erreurs passagères sont réessayées.
 */
import { COLLIMO_FOLDER_NAME, SUPPORTED_IMAGE_TYPES } from '../config'
import {
  SessionExpiredError,
  type DriveFileInfo,
  type DriveJsonFile,
  type DriveRef,
  type DriveService,
  type FolderInfo,
  type FolderRef,
  type Photo,
  type UserSettings,
} from './types'

/** Adresse de base de l'API Drive. */
const API = 'https://www.googleapis.com/drive/v3'
/** Adresse de base des envois de contenu. */
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
/** Type MIME d'un dossier Drive. */
export const FOLDER_MIME = 'application/vnd.google-apps.folder'
/** Nom du fichier de réglages dans l'espace caché de l'app (appDataFolder). */
const SETTINGS_FILE = 'collimo-settings.json'
/** Taille des miniatures affichées dans la galerie (plus grand côté, en pixels). */
const THUMB_SIZE = 480

/**
 * Échappe une valeur pour une requête Drive `q`.
 * @param value - texte brut
 * @returns la valeur entre apostrophes, barres obliques inverses et apostrophes échappées
 */
export const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/**
 * Requête des images directement dans un dossier (les sous-dossiers, dont « Collimo », sont exclus).
 * @param folderId - identifiant du dossier
 * @returns la requête `q`
 */
export function photosQuery(folderId: string): string {
  return `${quote(folderId)} in parents and mimeType contains 'image/' and trashed = false`
}

/**
 * Requête du sous-dossier « Collimo » d'un dossier.
 * @param parentId - identifiant du dossier parent
 * @returns la requête `q`
 */
export function collimoFolderQuery(parentId: string): string {
  return folderQuery(parentId, COLLIMO_FOLDER_NAME)
}

/**
 * Requête Drive d'un sous-dossier par son nom (hors corbeille).
 * @param parentId - dossier parent
 * @param name - nom exact du sous-dossier
 * @returns la requête `q`
 */
export function folderQuery(parentId: string, name: string): string {
  return `name = ${quote(name)} and mimeType = '${FOLDER_MIME}' and ${quote(parentId)} in parents and trashed = false`
}

/**
 * Requête Drive des sous-dossiers directs d'un dossier (hors corbeille).
 * @param parentId - dossier parent
 * @returns la requête `q`
 */
export function subfoldersQuery(parentId: string): string {
  return `mimeType = '${FOLDER_MIME}' and ${quote(parentId)} in parents and trashed = false`
}

/**
 * Paramètres de liste : Drive partagés activés, et recherche limitée au bon Drive.
 * @param driveId - Drive partagé, ou `null` pour Mon Drive
 * @returns les paramètres à ajouter à l'adresse
 */
export function listScope(driveId: string | null): Record<string, string> {
  const base = { supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' }
  return driveId ? { ...base, corpora: 'drive', driveId } : { ...base, corpora: 'user' }
}

/**
 * Agrandit la miniature Drive (le lien finit par `=s220`).
 * @param link - lien de miniature fourni par Drive
 * @param size - plus grand côté voulu, en pixels
 * @returns le lien redimensionné, inchangé s'il n'a pas le suffixe attendu, ou `undefined` sans lien
 */
export function sizedThumbnail(link: string | undefined, size = THUMB_SIZE): string | undefined {
  if (!link) return undefined
  // Miniature de l'application de bureau (collimo://thumb/?path=…&size=…) : même taille demandée.
  if (link.startsWith('collimo://thumb/')) return link.replace(/([?&])size=\d+/, `$1size=${size}`)
  return /=s\d+(-c)?$/.test(link) ? link.replace(/=s\d+(-c)?$/, `=s${size}`) : link
}

/**
 * Indique si le navigateur sait décoder ce format d'image.
 * @param mimeType - type MIME du fichier
 * @returns `true` pour un format pris en charge
 */
export const isSupportedImage = (mimeType: string) => (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)

/** Fichier image tel que renvoyé par l'API Drive. */
interface RawFile {
  id: string
  name: string
  mimeType: string
  thumbnailLink?: string
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number }
}

/**
 * Convertit un fichier Drive en photo de l'app.
 * @param f - fichier renvoyé par Drive
 * @returns la photo, dimensions corrigées de la rotation EXIF
 */
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

/** Erreur renvoyée par l'API Drive. */
export class DriveApiError extends Error {
  /** Code HTTP de la réponse. */
  readonly status: number
  /** Motif donné par Drive (`userRateLimitExceeded`, `insufficientFilePermissions`…), s'il y en a un. */
  readonly reason?: string
  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
    this.reason = reason
  }
  /**
   * Indique un quota dépassé : Drive répond 403 ou 429, et accepte la même requête un peu plus tard.
   * @returns `true` si l'erreur vient d'un quota
   */
  get isRateLimit() {
    return this.status === 429 || (this.status === 403 && /rateLimitExceeded/i.test(this.reason ?? ''))
  }
}

/** Signature de `fetch`, remplaçable dans les tests. */
type Fetch = typeof fetch

/** Erreurs passagères (quota, 5xx, réseau) : jusqu'à 3 réessais, en attendant 0,5 s, 1 s puis 2 s. */
export const RETRY_DELAYS_MS = [500, 1000, 2000]
/**
 * Attend un délai.
 * @param ms - durée en millisecondes
 * @returns une promesse résolue après le délai
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Crée le client Drive.
 * @param getToken - fournit le jeton d'accès courant (lève `SessionExpiredError` s'il est périmé)
 * @param fetchImpl - implémentation de `fetch` (remplacée dans les tests)
 * @param delays - attentes entre réessais, en millisecondes (vides dans les tests)
 * @returns le service Drive
 */
export function createDriveClient(
  getToken: () => string,
  fetchImpl: Fetch = fetch.bind(globalThis),
  delays = RETRY_DELAYS_MS,
): DriveService {
  /**
   * Une requête authentifiée, réessayée si Drive répond par une erreur passagère.
   * @param url - adresse complète
   * @param init - options de `fetch` ; l'en-tête d'autorisation est ajouté
   * @returns la réponse réussie
   * @throws `SessionExpiredError` sur une réponse 401, {@link DriveApiError} sur une autre erreur définitive
   */
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetchImpl(url, { ...init, headers: { Authorization: `Bearer ${getToken()}`, ...(init.headers ?? {}) } })
      } catch (e) {
        if (attempt >= delays.length) throw e
        await sleep(delays[attempt])
        continue
      }
      if (res.status === 401) throw new SessionExpiredError()
      if (res.ok) return res
      let message = res.statusText
      let reason: string | undefined
      try {
        const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[] } }
        message = body.error?.message ?? message
        reason = body.error?.errors?.[0]?.reason
      } catch {
        /* corps non JSON */
      }
      const err = new DriveApiError(res.status, message, reason)
      const transient = err.isRateLimit || res.status >= 500
      if (!transient || attempt >= delays.length) throw err
      await sleep(delays[attempt])
    }
  }

  /**
   * Une requête authentifiée, dont on lit le corps.
   * @param url - adresse complète
   * @param init - options de `fetch`
   * @param as - lecture du corps en JSON ou en Blob
   * @returns le corps lu
   */
  async function call<T>(url: string, init: RequestInit = {}, as: 'json' | 'blob' = 'json'): Promise<T> {
    const res = await request(url, init)
    return (as === 'json' ? res.json() : res.blob()) as Promise<T>
  }

  /** Identifiant du fichier de réglages, gardé après la première recherche (une requête de moins par enregistrement). */
  let settingsFileId: string | null | undefined

  /**
   * Adresse de l'API Drive.
   * @param path - chemin après `/drive/v3`
   * @param params - paramètres de requête
   * @returns l'adresse complète
   */
  const url = (path: string, params: Record<string, string>) => `${API}${path}?${new URLSearchParams(params).toString()}`

  /**
   * Liste complète, en suivant les pages (`nextPageToken`).
   * @param path - chemin de la liste, par exemple `/files`
   * @param key - champ de la réponse qui contient les éléments (`files`, `drives`)
   * @param params - paramètres de requête
   * @returns tous les éléments, toutes pages réunies
   */
  async function listAll<T>(path: string, key: string, params: Record<string, string>): Promise<T[]> {
    const items: T[] = []
    let pageToken: string | undefined
    do {
      const page = await call<Record<string, unknown>>(url(path, pageToken ? { ...params, pageToken } : params))
      items.push(...((page[key] as T[] | undefined) ?? []))
      pageToken = page.nextPageToken as string | undefined
    } while (pageToken)
    return items
  }

  /**
   * Cherche le fichier de réglages dans l'espace caché de l'app (une seule fois par session).
   * @returns son identifiant, ou `null` s'il n'existe pas encore
   */
  async function findSettingsFileId(): Promise<string | null> {
    if (settingsFileId !== undefined) return settingsFileId
    const files = await listAll<{ id: string }>('/files', 'files', {
      spaces: 'appDataFolder',
      q: `name = ${quote(SETTINGS_FILE)} and trashed = false`,
      fields: 'nextPageToken, files(id)',
      pageSize: '10',
    })
    settingsFileId = files[0]?.id ?? null
    return settingsFileId
  }

  /** Fichier JSON tel que renvoyé par l'API Drive. */
  type RawJsonFile = { id: string; name: string; modifiedTime?: string; webViewLink?: string; capabilities?: { canEdit?: boolean } }
  /** Champs demandés pour un fichier JSON. */
  const JSON_FIELDS = 'id,name,modifiedTime,webViewLink,capabilities(canEdit)'
  /**
   * Convertit un fichier JSON Drive en {@link DriveJsonFile}.
   * @param f - fichier renvoyé par Drive
   * @returns le fichier, droit de modification compris
   */
  const toJsonFile = (f: RawJsonFile): DriveJsonFile => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    canEdit: f.capabilities?.canEdit ?? false,
  })

  /**
   * Octets déjà reçus par une session d'envoi (0 si Drive ne répond pas).
   * @param session - adresse de la session d'envoi
   * @param size - taille totale du fichier, en octets
   * @returns le nombre d'octets reçus, d'où reprendre l'envoi
   */
  async function uploadedBytes(session: string, size: number): Promise<number> {
    try {
      const res = await fetchImpl(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${size}` } })
      const range = res.status === 308 ? res.headers.get('Range') : null
      const m = range?.match(/bytes=0-(\d+)/)
      return m ? Number(m[1]) + 1 : 0
    } catch {
      return 0
    }
  }

  /**
   * Sous-dossier « Collimo » d'un dossier, sans le créer.
   * @param folderId - dossier de photos
   * @returns l'identifiant du sous-dossier, ou null s'il n'existe pas
   */
  async function findCollimoFolder(folderId: string): Promise<string | null> {
    return findFolder(folderId, COLLIMO_FOLDER_NAME)
  }

  /**
   * Sous-dossier d'un dossier par son nom, sans le créer.
   * @param parentId - dossier parent
   * @param name - nom exact
   * @returns l'identifiant du sous-dossier, ou null
   */
  async function findFolder(parentId: string, name: string): Promise<string | null> {
    const existing = await listAll<{ id: string }>('/files', 'files', {
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      q: folderQuery(parentId, name),
      fields: 'nextPageToken, files(id)',
    })
    return existing[0]?.id ?? null
  }

  /**
   * Retrouve ou crée un sous-dossier.
   * @param parentId - dossier parent
   * @param name - nom exact
   * @returns l'identifiant du sous-dossier
   */
  async function ensureFolder(parentId: string, name: string): Promise<string> {
    const existing = await findFolder(parentId, name)
    if (existing) return existing
    const created = await call<{ id: string }>(url('/files', { supportsAllDrives: 'true', fields: 'id' }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    })
    return created.id
  }

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
        const found = await listAll<RawDrive>('/drives', 'drives', {
          q: `name = ${quote(ref.name)}`,
          pageSize: '10',
          fields: `nextPageToken, drives(${fields})`,
        })
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
      const f = await call<RawJsonFile>(
        `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(JSON_FIELDS)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipart,
        },
      )
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
      return drives.map<DriveRef>((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name))
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

    async getItem(id) {
      const f = await call<{
        id: string
        name: string
        mimeType: string
        driveId?: string
        parents?: string[]
        capabilities?: { canAddChildren?: boolean }
      }>(
        url(`/files/${encodeURIComponent(id)}`, {
          fields: 'id,name,mimeType,driveId,parents,capabilities(canAddChildren)',
          supportsAllDrives: 'true',
        }),
      )
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        driveId: f.driveId ?? null,
        parentId: f.parents?.[0] ?? null,
        canAddChildren: f.capabilities?.canAddChildren ?? false,
      }
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

    async listSubfolders(folderId, driveId) {
      const folders = await listAll<FolderRef>('/files', 'files', {
        ...listScope(driveId),
        q: subfoldersQuery(folderId),
        orderBy: 'name_natural',
        pageSize: '1000',
        fields: 'nextPageToken, files(id,name)',
      })
      return folders.filter((f) => f.name !== COLLIMO_FOLDER_NAME).map(({ id, name }) => ({ id, name }))
    },

    findCollimoFolder,

    ensureCollimoFolder: (folderId) => ensureFolder(folderId, COLLIMO_FOLDER_NAME),
    findFolder,
    ensureFolder,

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
      const created = await call<{ id: string }>(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      settingsFileId = created.id
    },

    fetchFileBlob(id) {
      return call<Blob>(url(`/files/${encodeURIComponent(id)}`, { alt: 'media', supportsAllDrives: 'true' }), {}, 'blob')
    },

    folderLink: (folderId) => `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`,

    listFolderFiles(folderId, namePrefix) {
      const prefix = namePrefix ? ` and name contains ${quote(namePrefix)}` : ''
      return listAll<DriveFileInfo>('/files', 'files', {
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        q: `${quote(folderId)} in parents and mimeType != '${FOLDER_MIME}' and trashed = false${prefix}`,
        orderBy: 'modifiedTime desc',
        pageSize: '1000',
        fields: 'nextPageToken, files(id,name,modifiedTime,webViewLink,thumbnailLink,appProperties)',
      })
    },

    readJson(id) {
      return call<unknown>(url(`/files/${encodeURIComponent(id)}`, { alt: 'media', supportsAllDrives: 'true' }))
    },

    async updateFileMeta(id, change, move) {
      return call<DriveFileInfo>(
        url(`/files/${encodeURIComponent(id)}`, {
          supportsAllDrives: 'true',
          fields: 'id,name,modifiedTime,webViewLink,thumbnailLink,appProperties',
          ...(move ?? {}),
        }),
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) },
      )
    },

    async uploadFile(folderId, name, data, mimeType, props) {
      // 1. Ouverture d'une session d'envoi : Drive renvoie l'adresse où déposer le contenu.
      const start = await request(
        `${UPLOAD}/files?${new URLSearchParams({ uploadType: 'resumable', supportsAllDrives: 'true', fields: 'id,name,modifiedTime,webViewLink,appProperties' })}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(data.size),
          },
          body: JSON.stringify({ name, mimeType, parents: [folderId], ...(props ? { appProperties: props } : {}) }),
        },
      )
      const session = start.headers.get('Location')
      if (!session) throw new DriveApiError(start.status, `envoi refusé (${start.status})`)
      // 2. Dépôt du contenu ; si la connexion lâche, Drive dit où il en est et on renvoie la suite.
      let from = 0
      for (let attempt = 0; ; attempt++) {
        let done: Response
        try {
          const chunk = from ? data.slice(from) : data
          const headers: Record<string, string> = { 'Content-Type': mimeType }
          if (from) headers['Content-Range'] = `bytes ${from}-${data.size - 1}/${data.size}`
          done = await fetchImpl(session, { method: 'PUT', headers, body: chunk })
        } catch (e) {
          if (attempt >= delays.length) throw e
          await sleep(delays[attempt])
          from = await uploadedBytes(session, data.size)
          continue
        }
        if (done.status === 401) throw new SessionExpiredError()
        if (done.ok) return (await done.json()) as DriveFileInfo
        if ((done.status < 500 && done.status !== 429) || attempt >= delays.length)
          throw new DriveApiError(done.status, `envoi interrompu (${done.status})`)
        await sleep(delays[attempt])
        from = await uploadedBytes(session, data.size)
      }
    },
  }
}
