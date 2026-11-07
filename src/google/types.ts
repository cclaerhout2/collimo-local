import type { Lang } from '../i18n'

export interface SignedInUser {
  name: string
  email: string
  photoUrl?: string
}

/** Un Drive : `id` null = Mon Drive, sinon l'identifiant du Drive partagé. */
export interface DriveRef {
  id: string | null
  name: string
}

export interface FolderInfo {
  id: string
  name: string
  /** Drive partagé qui contient le dossier ; null = Mon Drive. */
  driveId: string | null
  /** L'utilisateur peut-il ajouter des fichiers dans ce dossier ? */
  canAddChildren: boolean
}

export interface Photo {
  id: string
  name: string
  mimeType: string
  /** Miniature fournie par Drive (déjà dimensionnée), si disponible. */
  thumbnailUrl?: string
  width?: number
  height?: number
  /** Le navigateur sait-il décoder ce format ? */
  supported: boolean
}

export interface Location {
  drive: DriveRef
  folder: { id: string; name: string }
  /** Sous-dossier « Collimo » du dossier de photos. */
  collimoFolderId: string
}

/** Réglages propres à chaque utilisateur, stockés dans son espace caché Drive (appDataFolder). */
export interface UserSettings {
  version: 1
  location?: Location
  lang?: Lang
}

export class SessionExpiredError extends Error {
  constructor() {
    super('session-expired')
    this.name = 'SessionExpiredError'
  }
}

export class AuthError extends Error {
  readonly code: 'popup' | 'scopes' | 'domain' | 'other'
  readonly detail?: string
  constructor(code: AuthError['code'], detail?: string) {
    super(`auth-${code}`)
    this.name = 'AuthError'
    this.code = code
    this.detail = detail
  }
}

export interface AuthService {
  /** Ouvre la fenêtre de connexion Google ; doit être appelé depuis un clic. */
  signIn(): Promise<void>
  /** Jeton d'accès valide, ou SessionExpiredError. */
  getToken(): string
  signOut(): void
}

export interface DriveFileInfo {
  id: string
  name: string
  modifiedTime?: string
  webViewLink?: string
  thumbnailLink?: string
}

/** Drive partagé, avec le droit d'y ajouter des fichiers (rôle « Gestionnaire de contenu » ou plus). */
export interface SharedDriveInfo {
  id: string
  name: string
  canAddChildren: boolean
}

export interface DriveJsonFile {
  id: string
  name: string
  modifiedTime?: string
  webViewLink?: string
  /** L'utilisateur a-t-il le droit de modifier ce fichier dans Drive ? */
  canEdit: boolean
}

export interface DriveService {
  currentUser(): Promise<SignedInUser>
  listSharedDrives(): Promise<DriveRef[]>
  getFolder(id: string): Promise<FolderInfo>
  listPhotos(folder: { id: string }, driveId: string | null): Promise<Photo[]>
  /** Une photo par son identifiant (après un choix dans le sélecteur). */
  getPhoto(id: string): Promise<Photo>
  /** Retrouve ou crée le sous-dossier « Collimo » ; renvoie son identifiant. */
  ensureCollimoFolder(folderId: string): Promise<string>
  loadSettings(): Promise<UserSettings | null>
  saveSettings(settings: UserSettings): Promise<void>
  /** Contenu d'un fichier (photos originales, repli des miniatures). */
  fetchFileBlob(id: string): Promise<Blob>
  /** Fichiers directement dans un dossier (hors sous-dossiers), du plus récent au plus ancien. */
  listFolderFiles(folderId: string): Promise<DriveFileInfo[]>
  readJson(id: string): Promise<unknown>
  /** Envoie un nouveau fichier dans un dossier (envoi « reprenable », sans limite de 5 Mo). */
  uploadFile(folderId: string, name: string, data: Blob, mimeType: string): Promise<DriveFileInfo>
  /** Drive partagé par son identifiant, ou par son nom exact ; null s'il n'existe pas ou n'est pas visible. */
  findSharedDrive(ref: { id?: string; name?: string }): Promise<SharedDriveInfo | null>
  /** Fichier par son nom, à la racine d'un Drive partagé. */
  findRootFile(driveId: string, name: string): Promise<DriveJsonFile | null>
  createJsonFile(parentId: string, name: string, data: unknown): Promise<DriveJsonFile>
  /** Réécrit un fichier JSON ; erreur 403/404 si Collimo n'a pas encore été autorisé sur ce fichier. */
  updateJsonFile(id: string, data: unknown): Promise<DriveJsonFile>
}

export interface FolderPicker {
  /** Ouvre le sélecteur de dossier sur le Drive donné ; null si l'utilisateur annule. */
  pickFolder(drive: DriveRef, lang: Lang, title: string): Promise<{ id: string; name: string } | null>
  /** Ouvre le sélecteur de photos sur le Drive donné ; null si l'utilisateur annule. */
  pickImage(drive: DriveRef, lang: Lang, title: string): Promise<{ id: string } | null>
  /** Sélecteur sur un fichier précis (donne à Collimo le droit de le modifier) ; null si annulé. */
  pickFile(drive: DriveRef, lang: Lang, title: string, mimeType: string): Promise<{ id: string } | null>
}

export interface Services {
  auth: AuthService
  drive: DriveService
  picker: FolderPicker
}
