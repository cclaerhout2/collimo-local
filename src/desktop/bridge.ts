/**
 * Contrat entre la fenêtre de Collimo et le processus principal de l'application Windows (Electron) :
 * types des fichiers locaux, fonctions exposées par le script de préchargement, adresses du protocole
 * `collimo://` qui sert les miniatures et les fichiers. Aucune dépendance au DOM : ce fichier est aussi
 * compilé avec le processus principal.
 */

/** Nom de la variable globale par laquelle le script de préchargement expose le pont. */
export const BRIDGE_GLOBAL = 'collimoDesktop'

/** Schéma d'adresse propre à l'application : page, miniatures, fichiers, ouverture dans Windows. */
export const APP_SCHEME = 'collimo'

/** Canaux d'échange entre la fenêtre et le processus principal (un par fonction du pont). */
export const CHANNELS = {
  userInfo: 'collimo:user-info',
  pickFolder: 'collimo:pick-folder',
  pickFile: 'collimo:pick-file',
  folderInfo: 'collimo:folder-info',
  listImages: 'collimo:list-images',
  listFiles: 'collimo:list-files',
  fileInfo: 'collimo:file-info',
  writeNewFile: 'collimo:write-new-file',
  replaceFile: 'collimo:replace-file',
  ensureDir: 'collimo:ensure-dir',
  loadSettings: 'collimo:load-settings',
  saveSettings: 'collimo:save-settings',
  catalogueDir: 'collimo:catalogue-dir',
  chooseCatalogueDir: 'collimo:choose-catalogue-dir',
} as const

/** Fichier local tel que décrit par le processus principal. */
export interface LocalFile {
  /** Chemin complet, qui sert d'identifiant dans l'app. */
  path: string
  /** Nom du fichier, extension comprise. */
  name: string
  /** Taille en octets. */
  size: number
  /** Date de dernière modification (ISO 8601). */
  modifiedTime: string
  /** Type MIME déduit de l'extension. */
  mimeType: string
  /** Largeur affichée (rotation EXIF appliquée), pour une image dont l'en-tête est lisible. */
  width?: number
  /** Hauteur affichée (rotation EXIF appliquée), pour une image dont l'en-tête est lisible. */
  height?: number
}

/** Dossier local, avec le droit d'y écrire. */
export interface LocalFolder {
  path: string
  name: string
  /** Collimo peut-il créer des fichiers dans ce dossier ? */
  writable: boolean
}

/** Utilisateur Windows de la session. */
export interface LocalUser {
  /** Nom affiché (nom du compte Windows). */
  name: string
  /** Identifiant du type `utilisateur@ordinateur`, noté dans le catalogue de l'usine. */
  email: string
}

/** Filtre du sélecteur de fichier Windows. */
export type PickFilter = 'image' | 'json'

/**
 * Fonctions exposées à la fenêtre par le script de préchargement. Chaque chemin passé doit se trouver
 * dans un dossier ouvert par l'utilisateur (sélecteur Windows) ou dans les données de l'app :
 * le processus principal refuse les autres.
 */
export interface DesktopBridge {
  /** Système d'exploitation (`win32`, `darwin`, `linux`). */
  platform: string
  /** Utilisateur Windows de la session. */
  userInfo(): Promise<LocalUser>
  /** Sélecteur de dossier de Windows ; null si l'utilisateur annule. */
  pickFolder(opts: { title: string; defaultPath?: string }): Promise<LocalFolder | null>
  /** Sélecteur de fichier de Windows ; null si l'utilisateur annule. */
  pickFile(opts: { title: string; defaultPath?: string; filter: PickFilter }): Promise<LocalFile | null>
  /** Un dossier ; erreur s'il n'existe pas ou n'est pas autorisé. */
  folderInfo(path: string): Promise<LocalFolder>
  /** Images directement dans un dossier, dans l'ordre naturel des noms. */
  listImages(path: string): Promise<LocalFile[]>
  /** Fichiers directement dans un dossier, du plus récent au plus ancien ; `contains` filtre sur le nom. */
  listFiles(path: string, contains?: string): Promise<LocalFile[]>
  /** Un fichier. */
  fileInfo(path: string): Promise<LocalFile>
  /** Crée un nouveau fichier (image JPG ou PNG, ou JSON) ; erreur s'il existe déjà (jamais d'écrasement). */
  writeNewFile(dir: string, name: string, data: Uint8Array): Promise<LocalFile>
  /** Remplace le contenu d'un fichier (écriture dans un fichier temporaire puis renommage). */
  replaceFile(path: string, data: Uint8Array): Promise<LocalFile>
  /** Crée un dossier (et ses parents) s'il n'existe pas. */
  ensureDir(path: string): Promise<void>
  /** Réglages enregistrés, non vérifiés ; null s'il n'y en a pas. */
  loadSettings(): Promise<unknown>
  /** Enregistre les réglages. */
  saveSettings(data: unknown): Promise<void>
  /** Dossier du catalogue de l'usine (par défaut dans les données de l'app). */
  catalogueDir(): Promise<LocalFolder>
  /** Fait choisir un autre dossier pour le catalogue (dossier réseau partagé, par exemple) ; null si annulé. */
  chooseCatalogueDir(title: string): Promise<LocalFolder | null>
}

/**
 * Adresse d'un fichier local servi par le protocole de l'app.
 * @param path - chemin complet du fichier
 * @returns l'adresse `collimo://file/?path=…`
 */
export function localFileUrl(path: string): string {
  return `${APP_SCHEME}://file/?path=${encodeURIComponent(path)}`
}

/**
 * Adresse de la miniature d'une image locale, calculée par Windows.
 * @param path - chemin complet de l'image
 * @param size - plus grand côté voulu, en pixels
 * @param version - date de modification, pour qu'une image modifiée ne reprenne pas l'ancienne miniature
 * @returns l'adresse `collimo://thumb/?path=…&size=…`
 */
export function localThumbUrl(path: string, size: number, version = ''): string {
  return `${APP_SCHEME}://thumb/?path=${encodeURIComponent(path)}&size=${size}&v=${encodeURIComponent(version)}`
}

/**
 * Adresse qui, ouverte comme un lien, demande à Windows d'ouvrir un fichier ou de le montrer dans l'Explorateur.
 * Seuls les dossiers, images JPG/PNG et fichiers JSON autorisés sont ouverts (jamais un programme).
 * @param action - `open` (application par défaut) ou `reveal` (Explorateur)
 * @param path - chemin complet
 * @returns l'adresse `collimo://shell/?action=…&path=…`
 */
export function shellUrl(action: 'open' | 'reveal', path: string): string {
  return `${APP_SCHEME}://shell/?action=${action}&path=${encodeURIComponent(path)}`
}
