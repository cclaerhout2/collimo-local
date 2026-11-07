/**
 * Accès aux fichiers du PC pour l'application Windows : liste des photos d'un dossier (avec leurs
 * dimensions), fichiers du dossier Collimo, écriture sans écrasement, remplacement sûr, et contrôle
 * des chemins : Collimo ne touche qu'aux dossiers que l'utilisateur lui a ouverts.
 * Logique Node pure, sans Electron, testée par `files.test.ts`.
 */
import { randomBytes } from 'node:crypto'
import { constants, promises as fs, type Stats } from 'node:fs'
import path from 'node:path'
import { imageSizeFromFile } from 'image-size/fromFile'
import type { LocalFile, LocalFolder } from '../src/desktop/bridge'

/** Types MIME des extensions reconnues. */
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

/**
 * Type MIME d'un fichier d'après son extension.
 * @param name - nom ou chemin du fichier
 * @returns le type MIME, `application/octet-stream` si l'extension est inconnue
 */
export function mimeFromName(name: string): string {
  return MIME_BY_EXT[path.extname(name).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Indique si un fichier est une image d'après son nom (formats affichés dans la galerie).
 * @param name - nom du fichier
 * @returns `true` pour une image ; les fichiers cachés (`.xxx`) sont exclus
 */
export function isImageName(name: string): boolean {
  return !name.startsWith('.') && mimeFromName(name).startsWith('image/') && !name.toLowerCase().endsWith('.svg')
}

/** Comparateur « naturel » : IMG_2 avant IMG_10, sans tenir compte des majuscules ni des accents. */
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

/**
 * Trie des noms dans l'ordre naturel, comme l'Explorateur de Windows.
 * @param a - premier nom
 * @param b - second nom
 * @returns négatif si `a` vient avant `b`
 */
export const naturalCompare = (a: string, b: string) => collator.compare(a, b)

/** Erreur à montrer telle quelle à l'utilisateur. */
export class FileAccessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileAccessError'
  }
}

/**
 * Traduit une erreur du système de fichiers en message clair.
 * @param e - erreur attrapée
 * @param target - chemin concerné
 * @returns une erreur au message en français
 */
export function friendlyError(e: unknown, target: string): Error {
  const code = (e as NodeJS.ErrnoException)?.code
  if (code === 'ENOENT') return new FileAccessError(`Introuvable : ${target}`)
  if (code === 'EACCES' || code === 'EPERM') return new FileAccessError(`Accès refusé : ${target}`)
  if (code === 'EEXIST') return new FileAccessError(`Ce fichier existe déjà : ${target}`)
  if (code === 'ENOSPC') return new FileAccessError(`Disque plein : ${target}`)
  if (code === 'ENOTDIR') return new FileAccessError(`Ce n'est pas un dossier : ${target}`)
  return e instanceof Error ? e : new Error(String(e))
}

/**
 * Exécute une opération sur un fichier et traduit son éventuelle erreur.
 * @param target - chemin concerné, cité dans le message d'erreur
 * @param run - opération
 * @returns le résultat de l'opération
 */
async function guarded<T>(target: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    throw friendlyError(e, target)
  }
}

/**
 * Dimensions affichées d'une image, lues dans son en-tête (rotation EXIF appliquée).
 * @param file - chemin de l'image
 * @returns largeur et hauteur, ou rien si l'en-tête est illisible
 */
export async function imageDimensions(file: string): Promise<{ width?: number; height?: number }> {
  try {
    const s = await imageSizeFromFile(file)
    // Orientations EXIF 5 à 8 : photo tournée d'un quart de tour, largeur et hauteur échangées.
    const swap = (s.orientation ?? 1) >= 5
    return swap ? { width: s.height, height: s.width } : { width: s.width, height: s.height }
  } catch {
    return {}
  }
}

/**
 * Description d'un fichier.
 * @param file - chemin complet
 * @param stat - informations du système de fichiers
 * @param dims - dimensions de l'image, si connues
 * @returns le fichier, au format du pont
 */
function describe(file: string, stat: Stats, dims: { width?: number; height?: number } = {}): LocalFile {
  return {
    path: file,
    name: path.basename(file),
    size: stat.size,
    modifiedTime: stat.mtime.toISOString(),
    mimeType: mimeFromName(file),
    ...dims,
  }
}

/**
 * Exécute des tâches avec au plus `limit` en parallèle, en gardant l'ordre des résultats.
 * @param items - éléments à traiter
 * @param limit - nombre maximal de tâches simultanées
 * @param run - traitement d'un élément
 * @returns les résultats, dans l'ordre de `items`
 */
async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await run(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * Entrée de dossier qui peut être un fichier. Sous Windows, les fichiers à « point d'analyse »
 * (fichiers OneDrive ou Google Drive disponibles en ligne seulement, liens) sont annoncés comme des
 * liens : ils sont gardés, puis vérifiés par `stat`, qui ne les télécharge pas.
 * @param e - entrée lue par `readdir`
 * @returns `true` pour un fichier ou un lien
 */
const maybeFile = (e: { isFile(): boolean; isSymbolicLink(): boolean }) => e.isFile() || e.isSymbolicLink()

/**
 * Description des fichiers d'une liste de noms ; ceux qui ne sont plus des fichiers sont écartés.
 * @param dir - dossier
 * @param names - noms des fichiers
 * @returns les fichiers, dans l'ordre de `names`
 */
async function describeAll(dir: string, names: string[]): Promise<LocalFile[]> {
  const files = await mapLimit(names, 16, async (name) => {
    const file = path.join(dir, name)
    try {
      const stat = await fs.stat(file)
      return stat.isFile() ? describe(file, stat) : null
    } catch {
      return null // supprimé entre-temps, ou lien cassé
    }
  })
  return files.filter((f): f is LocalFile => f !== null)
}

/**
 * Images directement dans un dossier (sans les sous-dossiers), dans l'ordre naturel des noms.
 * Les dimensions ne sont pas lues ici : sur un dossier synchronisé (OneDrive, Google Drive), lire
 * l'en-tête de chaque photo la téléchargerait. Elles le sont par {@link fileInfo}, photo par photo.
 * @param dir - chemin du dossier
 * @returns les images
 */
export async function listImages(dir: string): Promise<LocalFile[]> {
  const entries = await guarded(dir, () => fs.readdir(dir, { withFileTypes: true }))
  const names = entries
    .filter((e) => maybeFile(e) && isImageName(e.name))
    .map((e) => e.name)
    .sort(naturalCompare)
  return describeAll(dir, names)
}

/**
 * Fichiers directement dans un dossier, du plus récent au plus ancien.
 * @param dir - chemin du dossier
 * @param contains - ne garder que les noms qui contiennent ce texte
 * @returns les fichiers ; un dossier absent donne une liste vide
 */
export async function listFiles(dir: string, contains?: string): Promise<LocalFile[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw friendlyError(e, dir)
  }
  const names = entries
    .filter((e) => maybeFile(e) && !e.name.startsWith('.') && (!contains || e.name.includes(contains)))
    .map((e) => e.name)
  return (await describeAll(dir, names)).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
}

/**
 * Un fichier.
 * @param file - chemin complet
 * @returns sa description, avec ses dimensions si c'est une image
 */
export async function fileInfo(file: string): Promise<LocalFile> {
  const stat = await guarded(file, () => fs.stat(file))
  if (!stat.isFile()) throw new FileAccessError(`Ce n'est pas un fichier : ${file}`)
  return describe(file, stat, isImageName(file) ? await imageDimensions(file) : {})
}

/**
 * Indique si Collimo peut créer des fichiers dans un dossier, par un vrai essai d'écriture
 * (les droits annoncés par Windows sont peu fiables sur les dossiers réseau et synchronisés).
 * À réserver au choix d'un dossier : sur un dossier synchronisé, l'essai laisse une trace dans la corbeille.
 * @param dir - chemin du dossier
 * @returns `true` si un fichier a pu y être créé puis supprimé
 */
export async function canWrite(dir: string): Promise<boolean> {
  const probe = path.join(dir, `.collimo-${randomBytes(6).toString('hex')}.tmp`)
  try {
    await fs.writeFile(probe, '', { flag: 'wx' })
  } catch {
    return false
  }
  // Le fichier a pu être créé : le dossier est inscriptible, même si la suppression est refusée.
  await fs.rm(probe, { force: true }).catch(() => {})
  return true
}

/**
 * Un dossier, avec le droit d'y écrire.
 * @param dir - chemin du dossier
 * @param probe - `true` : vrai essai d'écriture ({@link canWrite}) ; sinon, droits annoncés par le système, sans rien écrire
 * @returns sa description
 */
export async function folderInfo(dir: string, probe = false): Promise<LocalFolder> {
  const stat = await guarded(dir, () => fs.stat(dir))
  if (!stat.isDirectory()) throw new FileAccessError(`Ce n'est pas un dossier : ${dir}`)
  const writable = probe
    ? await canWrite(dir)
    : await fs.access(dir, constants.W_OK).then(
        () => true,
        () => false,
      )
  return { path: dir, name: path.basename(dir) || dir, writable }
}

/**
 * Vérifie qu'un nom de fichier est un simple nom (ni dossier, ni caractère interdit par Windows).
 * @param name - nom proposé
 * @throws FileAccessError si le nom est refusé
 */
export function assertPlainName(name: string): void {
  if (
    !name ||
    name !== path.basename(name) ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
    /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)
  ) {
    throw new FileAccessError(`Nom de fichier refusé : ${name}`)
  }
}

/** Extensions des fichiers que Collimo crée : images exportées et fichiers JSON (projets, catalogue). */
const WRITABLE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.json']

/**
 * Vérifie que Collimo a le droit de créer ou réécrire ce type de fichier : jamais un programme,
 * un raccourci ou un script, qu'un lien pourrait ensuite lancer.
 * @param name - nom ou chemin du fichier
 * @throws FileAccessError pour toute autre extension
 */
export function assertWritableType(name: string): void {
  if (!WRITABLE_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
    throw new FileAccessError(`Type de fichier refusé : ${path.basename(name)}`)
  }
}

/**
 * Crée un nouveau fichier ; ne remplace jamais un fichier existant.
 * @param dir - dossier de destination
 * @param name - nom du fichier : image JPG ou PNG, ou JSON
 * @param data - contenu
 * @returns le fichier créé
 */
export async function writeNewFile(dir: string, name: string, data: Uint8Array): Promise<LocalFile> {
  assertPlainName(name)
  assertWritableType(name)
  const file = path.join(dir, name)
  await guarded(file, () => fs.writeFile(file, data, { flag: 'wx' }))
  return fileInfo(file)
}

/**
 * Remplace le contenu d'un fichier sans risque de le laisser à moitié écrit : écriture dans un
 * fichier temporaire du même dossier, puis renommage.
 * @param file - chemin du fichier
 * @param data - nouveau contenu
 * @returns le fichier réécrit
 */
export async function replaceFile(file: string, data: Uint8Array): Promise<LocalFile> {
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
  await guarded(file, async () => {
    await fs.writeFile(tmp, data, { flag: 'wx' })
    try {
      await renameWithRetry(tmp, file)
    } finally {
      await fs.rm(tmp, { force: true }).catch(() => {})
    }
  })
  return fileInfo(file)
}

/** Codes d'erreur d'un fichier momentanément verrouillé (antivirus, synchronisation, aperçu de l'Explorateur). */
const LOCKED = new Set(['EPERM', 'EACCES', 'EBUSY'])

/**
 * Renomme un fichier temporaire sur le fichier visé, en réessayant pendant environ deux secondes si le
 * fichier visé est verrouillé ; en dernier recours, copie le contenu par-dessus.
 * @param tmp - fichier temporaire, complet
 * @param file - fichier à remplacer
 * @param delays - attentes successives entre les essais, en millisecondes
 * @returns une promesse résolue une fois le fichier remplacé
 */
export async function renameWithRetry(tmp: string, file: string, delays = [50, 100, 200, 400, 600, 800]): Promise<void> {
  for (const wait of [0, ...delays]) {
    if (wait) await new Promise((r) => setTimeout(r, wait))
    try {
      return await fs.rename(tmp, file)
    } catch (e) {
      if (!LOCKED.has((e as NodeJS.ErrnoException).code ?? '')) throw e
    }
  }
  await fs.copyFile(tmp, file)
}

/**
 * Crée un dossier et ses parents s'ils n'existent pas.
 * @param dir - chemin du dossier
 */
export async function ensureDir(dir: string): Promise<void> {
  await guarded(dir, () => fs.mkdir(dir, { recursive: true }))
}

/**
 * Lit un fichier JSON.
 * @param file - chemin du fichier
 * @returns son contenu, ou `null` s'il n'existe pas ou est illisible
 */
export async function readJsonFile(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as unknown
  } catch {
    return null
  }
}

/**
 * Écrit un fichier JSON en le remplaçant de façon sûre (voir {@link replaceFile}).
 * @param file - chemin du fichier ; son dossier est créé au besoin
 * @param data - valeur à écrire
 */
export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file))
  await replaceFile(file, new TextEncoder().encode(JSON.stringify(data, null, 2)))
}

/**
 * Liste blanche des chemins accessibles : dossiers et fichiers ouverts par l'utilisateur avec les
 * sélecteurs de Windows, et données de l'app. Tout autre chemin est refusé, même si la page le demande.
 */
export class PathGuard {
  /** Racines autorisées, normalisées. */
  private readonly roots = new Set<string>()
  /** Système ; sous Windows, les chemins sont comparés sans tenir compte des majuscules. */
  private readonly platform: string

  /**
   * @param platform - système (`win32`, `linux`…)
   * @param initial - racines autorisées dès le départ
   */
  constructor(platform: string = process.platform, initial: string[] = []) {
    this.platform = platform
    initial.forEach((r) => this.add(r))
  }

  /**
   * Forme comparable d'un chemin : absolu, sans `..`, en minuscules sous Windows.
   * @param p - chemin
   * @returns le chemin normalisé
   */
  private norm(p: string): string {
    const lib = this.platform === 'win32' ? path.win32 : path.posix
    const abs = lib.resolve(p)
    return this.platform === 'win32' ? abs.toLowerCase() : abs
  }

  /**
   * Indique si un chemin est complet : lecteur et dossier (`C:\…`) ou partage réseau (`\\serveur\partage`)
   * sous Windows, chemin absolu ailleurs. Les chemins relatifs, relatifs à un lecteur (`C:x`, `\x`) ou
   * de périphérique (`\\?\…`, `\\.\…`) sont refusés.
   * @param p - chemin
   * @returns `true` pour un chemin complet
   */
  private isFullPath(p: string): boolean {
    if (this.platform !== 'win32') return path.posix.isAbsolute(p)
    return /^[a-zA-Z]:[\\/]/.test(p) || /^[\\/]{2}[^\\/?.][^\\/]*[\\/][^\\/]/.test(p)
  }

  /**
   * Autorise un dossier (et tout son contenu) ou un fichier.
   * @param root - chemin à autoriser
   * @returns `true` s'il n'était pas déjà couvert
   */
  add(root: string): boolean {
    if (!root || !this.isFullPath(root) || this.allows(root)) return false
    this.roots.add(this.norm(root))
    return true
  }

  /**
   * Indique si un chemin est dans une racine autorisée.
   * @param p - chemin demandé
   * @returns `true` si l'accès est permis
   */
  allows(p: string): boolean {
    if (typeof p !== 'string' || !p || p.includes('\0') || !this.isFullPath(p)) return false
    const lib = this.platform === 'win32' ? path.win32 : path.posix
    const n = this.norm(p)
    for (const r of this.roots) {
      if (n === r) return true
      const rel = lib.relative(r, n)
      if (rel && !rel.startsWith('..') && !lib.isAbsolute(rel)) return true
    }
    return false
  }

  /**
   * Vérifie qu'un chemin est autorisé.
   * @param p - chemin demandé
   * @returns le chemin, inchangé
   * @throws FileAccessError s'il n'est pas autorisé
   */
  check(p: string): string {
    if (!this.allows(p)) {
      throw new FileAccessError(`Collimo n'a pas accès à « ${p} ». Choisissez ce dossier avec « Changer d'emplacement ».`)
    }
    return p
  }

  /**
   * Racines autorisées, pour les enregistrer.
   * @returns les chemins normalisés
   */
  list(): string[] {
    return [...this.roots]
  }
}
