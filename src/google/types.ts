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

export interface DriveService {
  currentUser(): Promise<SignedInUser>
  listSharedDrives(): Promise<DriveRef[]>
  getFolder(id: string): Promise<FolderInfo>
  listPhotos(folder: { id: string }, driveId: string | null): Promise<Photo[]>
  /** Retrouve ou crée le sous-dossier « Collimo » ; renvoie son identifiant. */
  ensureCollimoFolder(folderId: string): Promise<string>
  loadSettings(): Promise<UserSettings | null>
  saveSettings(settings: UserSettings): Promise<void>
  /** Contenu d'un fichier (repli quand une miniature ne s'affiche pas). */
  fetchFileBlob(id: string): Promise<Blob>
}

export interface FolderPicker {
  /** Ouvre le sélecteur de dossier sur le Drive donné ; null si l'utilisateur annule. */
  pickFolder(drive: DriveRef, lang: Lang, title: string): Promise<{ id: string; name: string } | null>
}

export interface Services {
  auth: AuthService
  drive: DriveService
  picker: FolderPicker
}
