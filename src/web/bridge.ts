/**
 * Pont de la version web locale (iPhone, iPad, tout navigateur) : les mêmes fonctions que sur
 * ordinateur (voir `desktop/bridge.ts`), sans serveur ni compte. Le navigateur ne donne pas accès aux
 * dossiers : les photos choisies dans la photothèque sont copiées dans un album, rangé avec les collages
 * dans le stockage du navigateur (IndexedDB), sur l'appareil seulement. Les collages en sortent par le
 * bouton Partager (Enregistrer dans Photos, Messages…) ou le téléchargement.
 */
import { loadImage } from '../collage/images'
import type { DesktopBridge, LocalFile, LocalFolder, PickFilter } from '../desktop/bridge'

/** Dossier de l'album : les photos importées. */
export const ALBUM = '/Photos'
/** Nom affiché de l'album. */
export const ALBUM_NAME = 'Mes photos'
/** Dossier des images importées une à une (logo, photo de remplacement). */
const IMPORTS = '/Imports'
/** Dossier du catalogue de l'usine. */
const CATALOGUE = '/catalogue'

/** Fichier tel qu'il est utilisé par le pont. */
interface StoredFile {
  path: string
  dir: string
  name: string
  mimeType: string
  size: number
  modifiedTime: string
  blob: Blob
  width?: number
  height?: number
}

/**
 * Fichier tel qu'il est écrit dans IndexedDB : son contenu en octets, pas en Blob, car Safari en
 * navigation privée (et WebKit dans certains modes) refuse d'y ranger des Blob.
 */
type DbFile = Omit<StoredFile, 'blob'> & { bytes: ArrayBuffer }

/** Stockage de l'album : fichiers, miniatures, réglages. Remplaçable dans les tests. */
export interface AlbumStore {
  get(path: string): Promise<StoredFile | undefined>
  put(file: StoredFile): Promise<void>
  list(dir: string): Promise<StoredFile[]>
  getThumb(key: string): Promise<Blob | undefined>
  putThumb(key: string, blob: Blob): Promise<void>
  getSetting(key: string): Promise<unknown>
  putSetting(key: string, value: unknown): Promise<void>
}

/**
 * Exécute une requête IndexedDB.
 * @param req - requête
 * @returns son résultat
 */
const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'))
  })

/**
 * Stockage de l'album dans IndexedDB.
 * @param name - nom de la base
 * @returns le stockage
 */
export function indexedDbStore(name = 'collimo'): AlbumStore {
  let db: Promise<IDBDatabase> | null = null
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        const d = req.result
        d.createObjectStore('files', { keyPath: 'path' }).createIndex('dir', 'dir')
        d.createObjectStore('thumbs')
        d.createObjectStore('settings')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponible'))
    }))
  const store = async (s: string, mode: IDBTransactionMode = 'readonly') => (await open()).transaction(s, mode).objectStore(s)
  const fromDb = (f: DbFile | undefined): StoredFile | undefined => {
    if (!f) return undefined
    const { bytes, ...rest } = f
    return { ...rest, blob: new Blob([bytes], { type: f.mimeType }) }
  }
  const toDb = async ({ blob, ...rest }: StoredFile): Promise<DbFile> => ({ ...rest, bytes: await blob.arrayBuffer() })
  return {
    get: async (path) => fromDb((await done((await store('files')).get(path))) as DbFile | undefined),
    // Le contenu est lu avant d'ouvrir la transaction, qui se fermerait pendant une attente.
    put: async (file) => {
      const rec = await toDb(file)
      await done((await store('files', 'readwrite')).put(rec))
    },
    list: async (dir) => ((await done((await store('files')).index('dir').getAll(dir))) as DbFile[]).map((f) => fromDb(f)!),
    getThumb: async (key) => {
      const bytes = (await done((await store('thumbs')).get(key))) as ArrayBuffer | undefined
      return bytes ? new Blob([bytes], { type: 'image/jpeg' }) : undefined
    },
    putThumb: async (key, blob) => {
      const bytes = await blob.arrayBuffer()
      await done((await store('thumbs', 'readwrite')).put(bytes, key))
    },
    getSetting: async (key) => (await done((await store('settings')).get(key))) as unknown,
    putSetting: async (key, value) => void (await done((await store('settings', 'readwrite')).put(value, key))),
  }
}

/**
 * Type MIME d'une image d'après son nom, quand le navigateur ne le donne pas (HEIC souvent).
 * @param name - nom du fichier
 * @param given - type donné par le navigateur
 * @returns le type MIME
 */
export function mimeOf(name: string, given: string): string {
  if (given && given !== 'application/octet-stream') return given
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const known: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    json: 'application/json',
  }
  return known[ext] ?? 'application/octet-stream'
}

/**
 * Nom libre dans un dossier : `photo.jpg`, sinon `photo (2).jpg`, `photo (3).jpg`…
 * @param name - nom voulu
 * @param taken - noms déjà pris
 * @returns un nom qui n'est pas dans `taken`
 */
export function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 2; ; i++) if (!taken.has(`${base} (${i})${ext}`)) return `${base} (${i})${ext}`
}

/**
 * Fait choisir des fichiers à l'utilisateur (photothèque sur iPhone), par un champ de fichier caché.
 * À appeler depuis un geste de l'utilisateur.
 * @param accept - types acceptés
 * @param multiple - plusieurs fichiers
 * @returns les fichiers choisis ; vide si l'utilisateur annule
 */
function chooseFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.className = 'collimo-file-input'
    input.style.display = 'none'
    const finish = (files: File[]) => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish([...(input.files ?? [])]))
    input.addEventListener('cancel', () => finish([]))
    document.body.append(input)
    input.click()
  })
}

/**
 * Description d'un fichier rangé.
 * @param f - fichier rangé
 * @returns le fichier, au format du pont
 */
const describe = ({ path, name, size, modifiedTime, mimeType, width, height }: StoredFile): LocalFile => ({
  path,
  name,
  size,
  modifiedTime,
  mimeType,
  width,
  height,
})

/** Formats proposés dans le sélecteur de photos (HEIC compris, pour les navigateurs qui le donnent tel quel). */
const IMAGE_ACCEPT = 'image/*,.heic,.heif'

/**
 * Crée le pont de la version web locale.
 * @param store - stockage de l'album (IndexedDB par défaut)
 * @param pick - sélecteur de fichiers (remplaçable dans les tests)
 * @returns le pont, au format de l'application de bureau
 */
export function createWebBridge(store: AlbumStore = indexedDbStore(), pick = chooseFiles): DesktopBridge {
  /** Adresses `blob:` déjà créées, par clé (miniature ou fichier), pour ne pas les recréer. */
  const urls = new Map<string, string>()
  const urlFor = (key: string, blob: Blob) => {
    let u = urls.get(key)
    if (!u) urls.set(key, (u = URL.createObjectURL(blob)))
    return u
  }

  /**
   * Range des fichiers dans un dossier, sous des noms libres.
   * @param dir - dossier
   * @param files - fichiers choisis
   * @returns les fichiers rangés
   */
  async function importFiles(dir: string, files: File[]): Promise<StoredFile[]> {
    const taken = new Set((await store.list(dir)).map((f) => f.name))
    const out: StoredFile[] = []
    for (const file of files) {
      const name = freeName(file.name || 'photo.jpg', taken)
      taken.add(name)
      const rec: StoredFile = {
        path: `${dir}/${name}`,
        dir,
        name,
        mimeType: mimeOf(name, file.type),
        size: file.size,
        modifiedTime: new Date(file.lastModified || Date.now()).toISOString(),
        blob: file,
      }
      await store.put(rec)
      out.push(rec)
    }
    // Demande au navigateur de ne pas effacer l'album pour faire de la place (sans effet s'il refuse).
    void navigator.storage?.persist?.().catch(() => false)
    return out
  }

  /**
   * Écrit un fichier.
   * @param path - chemin
   * @param data - contenu
   * @returns le fichier écrit
   */
  async function write(path: string, data: Uint8Array): Promise<LocalFile> {
    const i = path.lastIndexOf('/')
    const name = path.slice(i + 1)
    const rec: StoredFile = {
      path,
      dir: path.slice(0, i),
      name,
      mimeType: mimeOf(name, ''),
      size: data.length,
      modifiedTime: new Date().toISOString(),
      blob: new Blob([data.slice()], { type: mimeOf(name, '') }),
    }
    await store.put(rec)
    return describe(rec)
  }

  const folder = (path: string): LocalFolder => ({
    path,
    name: path === ALBUM ? ALBUM_NAME : path.split('/').pop() || path,
    writable: true,
  })

  return {
    platform: 'web',
    userInfo: async () => ({ name: 'Mon album', email: 'Sur cet appareil' }),
    async pickFolder() {
      const files = (await pick(IMAGE_ACCEPT, true)).filter((f) => mimeOf(f.name, f.type).startsWith('image/'))
      if (!files.length) return (await store.list(ALBUM)).length ? folder(ALBUM) : null
      await importFiles(ALBUM, files)
      return folder(ALBUM)
    },
    async pickFile({ filter }: { title: string; filter: PickFilter }) {
      const [file] = await pick(filter === 'json' ? 'application/json,.json' : IMAGE_ACCEPT, false)
      if (!file) return null
      const [rec] = await importFiles(IMPORTS, [file])
      return describe(rec)
    },
    folderInfo: async (path) => folder(path),
    async fileInfo(path) {
      const rec = await store.get(path)
      if (!rec) throw new Error(`Introuvable : ${path}`)
      if (rec.mimeType.startsWith('image/') && !rec.width) {
        try {
          // Taille d'origine (rotation EXIF appliquée), lue une fois puis gardée.
          const img = await loadImage(rec.blob, rec.mimeType, 1e6)
          rec.width = img.width
          rec.height = img.height
          img.close()
          await store.put(rec)
        } catch {
          /* dimensions inconnues : la page les lira au chargement */
        }
      }
      return describe(rec)
    },
    async listImages(path) {
      const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })
      return (await store.list(path))
        .filter((f) => f.mimeType.startsWith('image/'))
        .sort((a, b) => collator.compare(a.name, b.name))
        .map(describe)
    },
    async listFiles(path, contains) {
      return (await store.list(path))
        .filter((f) => !contains || f.name.includes(contains))
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
        .map((f) => ({ ...describe(f), url: f.mimeType.startsWith('image/') ? urlFor(`file:${f.path}`, f.blob) : undefined }))
    },
    async writeNewFile(dir, name, data) {
      if (await store.get(`${dir}/${name}`)) throw new Error(`Ce fichier existe déjà : ${name}`)
      if (!/\.(jpe?g|png|json)$/i.test(name)) throw new Error(`Type de fichier refusé : ${name}`)
      return write(`${dir}/${name}`, data)
    },
    async replaceFile(path, data) {
      if (!path.toLowerCase().endsWith('.json')) throw new Error('Seuls les fichiers JSON peuvent être réécrits')
      return write(path, data)
    },
    async ensureDir() {},
    ensureChildDir: async (dir, name) => `${dir}/${name}`,
    findChild: async (dir, name) => ((await store.get(`${dir}/${name}`)) ? `${dir}/${name}` : null),
    loadSettings: () => store.getSetting('settings').then((v) => v ?? null),
    saveSettings: (data) => store.putSetting('settings', data),
    catalogueDir: async () => folder(CATALOGUE),
    chooseCatalogueDir: async () => null,
    async readFile(path) {
      const rec = await store.get(path)
      if (!rec) throw new Error(`Introuvable : ${path}`)
      return rec.blob
    },
    async thumbnail(path, size) {
      const key = `${path}|${size}`
      const cached = await store.getThumb(key)
      if (cached) return urlFor(key, cached)
      const rec = await store.get(path)
      if (!rec) throw new Error(`Introuvable : ${path}`)
      const img = await loadImage(rec.blob, rec.mimeType, size)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')!.drawImage(img.source, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('miniature'))), 'image/jpeg', 0.82),
        )
        await store.putThumb(key, blob)
        return urlFor(key, blob)
      } finally {
        img.close()
      }
    },
  }
}
