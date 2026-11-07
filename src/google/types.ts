/** Types partagés des services Google (connexion, Drive, sélecteur), réels ou simulés, et leurs erreurs. */
import type { Lang } from '../i18n'

/** Utilisateur connecté. */
export interface SignedInUser {
  name: string
  email: string
  /** Adresse de la photo de profil, si Google en fournit une. */
  photoUrl?: string
}

/** Un Drive : `id` null = Mon Drive, sinon l'identifiant du Drive partagé. */
export interface DriveRef {
  id: string | null
  name: string
}

/** Dossier Drive, avec les droits de l'utilisateur. */
export interface FolderInfo {
  id: string
  name: string
  /** Drive partagé qui contient le dossier ; null = Mon Drive. */
  driveId: string | null
  /** L'utilisateur peut-il ajouter des fichiers dans ce dossier ? */
  canAddChildren: boolean
}

/** Photo d'un dossier Drive. */
export interface Photo {
  id: string
  name: string
  mimeType: string
  /** Miniature fournie par Drive (déjà dimensionnée), si disponible. */
  thumbnailUrl?: string
  /** Largeur affichée en pixels (rotation EXIF appliquée), si Drive la connaît. */
  width?: number
  /** Hauteur affichée en pixels (rotation EXIF appliquée), si Drive la connaît. */
  height?: number
  /** Le navigateur sait-il décoder ce format ? */
  supported: boolean
}

/** Emplacement de travail choisi par l'utilisateur : un dossier de photos et son sous-dossier « Collimo ». */
export interface Location {
  drive: DriveRef
  /** Dossier de photos. */
  folder: { id: string; name: string }
  /** Sous-dossier « Collimo » du dossier de photos. */
  collimoFolderId: string
}

/** Réglages propres à chaque utilisateur, stockés dans son espace caché Drive (appDataFolder). */
export interface UserSettings {
  /** Version du format, pour ignorer un fichier d'un format futur. */
  version: 1
  /** Dernier emplacement de travail. */
  location?: Location
  /** Langue choisie. */
  lang?: Lang
}

/** Le jeton d'accès a expiré (ou n'existe pas) : l'utilisateur doit se reconnecter. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session-expired')
    this.name = 'SessionExpiredError'
  }
}

/** Échec de la connexion Google. */
export class AuthError extends Error {
  /**
   * Cause : fenêtre fermée ou bloquée (`popup`), autorisations refusées (`scopes`), compte hors du
   * domaine autorisé (`domain`), ou autre.
   */
  readonly code: 'popup' | 'scopes' | 'domain' | 'other'
  /** Message technique de Google, pour le diagnostic. */
  readonly detail?: string
  constructor(code: AuthError['code'], detail?: string) {
    super(`auth-${code}`)
    this.name = 'AuthError'
    this.code = code
    this.detail = detail
  }
}

/** Service de connexion. */
export interface AuthService {
  /** Ouvre la fenêtre de connexion Google ; doit être appelé depuis un clic. */
  signIn(): Promise<void>
  /** Jeton d'accès valide, ou SessionExpiredError. */
  getToken(): string
  /** Révoque le jeton et oublie la session. */
  signOut(): void
}

/** Fichier Drive (collage enregistré, fichier envoyé). */
export interface DriveFileInfo {
  id: string
  name: string
  /** Date de dernière modification (ISO 8601). */
  modifiedTime?: string
  /** Lien d'ouverture dans Drive. */
  webViewLink?: string
  /** Lien de miniature fourni par Drive. */
  thumbnailLink?: string
}

/** Drive partagé, avec le droit d'y ajouter des fichiers (rôle « Gestionnaire de contenu » ou plus). */
export interface SharedDriveInfo {
  id: string
  name: string
  canAddChildren: boolean
}

/** Fichier JSON sur Drive (catalogue de l'usine). */
export interface DriveJsonFile {
  id: string
  name: string
  /** Date de dernière modification (ISO 8601). */
  modifiedTime?: string
  /** Lien d'ouverture dans Drive. */
  webViewLink?: string
  /** L'utilisateur a-t-il le droit de modifier ce fichier dans Drive ? */
  canEdit: boolean
}

/** Accès à Google Drive utilisé par l'app (réel ou simulé). */
export interface DriveService {
  /** Utilisateur connecté. */
  currentUser(): Promise<SignedInUser>
  /** Drive partagés visibles, triés par nom. */
  listSharedDrives(): Promise<DriveRef[]>
  /** Un dossier par son identifiant, avec les droits de l'utilisateur. */
  getFolder(id: string): Promise<FolderInfo>
  /** Images directement dans un dossier, dans l'ordre naturel des noms. */
  listPhotos(folder: { id: string }, driveId: string | null): Promise<Photo[]>
  /** Une photo par son identifiant (après un choix dans le sélecteur). */
  getPhoto(id: string): Promise<Photo>
  /** Retrouve ou crée le sous-dossier « Collimo » ; renvoie son identifiant. */
  ensureCollimoFolder(folderId: string): Promise<string>
  /** Réglages de l'utilisateur ; null s'il n'en a pas encore, ou dans un format inconnu. */
  loadSettings(): Promise<UserSettings | null>
  /** Enregistre les réglages de l'utilisateur. */
  saveSettings(settings: UserSettings): Promise<void>
  /** Miniature calculée à la demande, quand la photo n'a pas d'adresse de miniature (Android) ; `undefined` en cas d'échec. */
  loadThumbnail?(photo: Photo): Promise<string | undefined>
  /** Contenu d'un fichier (photos originales, repli des miniatures). */
  fetchFileBlob(id: string): Promise<Blob>
  /** Lien qui ouvre un dossier (dans Drive, ou dans l'Explorateur sur ordinateur) ; vide s'il n'y en a pas (Android). */
  folderLink(folderId: string): string
  /** Fichiers directement dans un dossier (hors sous-dossiers), du plus récent au plus ancien ; `namePrefix` limite aux noms qui le contiennent. */
  listFolderFiles(folderId: string, namePrefix?: string): Promise<DriveFileInfo[]>
  /** Contenu JSON d'un fichier, non vérifié. */
  readJson(id: string): Promise<unknown>
  /** Envoie un nouveau fichier dans un dossier (envoi « reprenable », sans limite de 5 Mo). */
  uploadFile(folderId: string, name: string, data: Blob, mimeType: string): Promise<DriveFileInfo>
  /** Drive partagé par son identifiant, ou par son nom exact ; null s'il n'existe pas ou n'est pas visible. */
  findSharedDrive(ref: { id?: string; name?: string }): Promise<SharedDriveInfo | null>
  /** Fichier par son nom, à la racine d'un Drive partagé. */
  findRootFile(driveId: string, name: string): Promise<DriveJsonFile | null>
  /** Crée un fichier JSON dans un dossier (ou à la racine d'un Drive partagé). */
  createJsonFile(parentId: string, name: string, data: unknown): Promise<DriveJsonFile>
  /** Réécrit un fichier JSON ; erreur 403/404 si Collimo n'a pas encore été autorisé sur ce fichier. */
  updateJsonFile(id: string, data: unknown): Promise<DriveJsonFile>
}

/** Sélecteur de fichiers Drive (Google Picker, ou simulé). */
export interface FolderPicker {
  /** Ouvre le sélecteur de dossier sur le Drive donné ; null si l'utilisateur annule. */
  pickFolder(drive: DriveRef, lang: Lang, title: string): Promise<{ id: string; name: string } | null>
  /** Ouvre le sélecteur de photos sur le Drive donné ; null si l'utilisateur annule. */
  pickImage(drive: DriveRef, lang: Lang, title: string): Promise<{ id: string } | null>
  /** Sélecteur sur un fichier précis (donne à Collimo le droit de le modifier) ; null si annulé. */
  pickFile(drive: DriveRef, lang: Lang, title: string, mimeType: string): Promise<{ id: string } | null>
}

/** Ensemble des services de l'app : Google Drive, Drive simulé, ou fichiers du PC (application Windows). */
export interface Services {
  /** Origine des fichiers ; `desktop` = application Windows, sans compte Google. */
  kind: 'google' | 'mock' | 'desktop'
  auth: AuthService
  drive: DriveService
  picker: FolderPicker
}
