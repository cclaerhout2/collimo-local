/** Configuration lue au build depuis les variables d'environnement Vite (.env.local). */
export interface AppConfig {
  clientId: string
  apiKey: string
  appId: string
  /** Domaine Workspace autorisé, en minuscules ; vide = pas de contrôle côté app. */
  allowedDomain: string
  /** Mode démo : Drive simulé, aucun appel à Google. */
  mock: boolean
}

const env = import.meta.env

export const config: AppConfig = {
  clientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
  apiKey: env.VITE_GOOGLE_API_KEY ?? '',
  appId: env.VITE_GOOGLE_APP_ID ?? '',
  allowedDomain: (env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase(),
  mock: env.VITE_MOCK === '1',
}

/** Autorisations Drive demandées : lecture seule + écriture limitée aux fichiers créés par Collimo. */
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
] as const

/** Nom du sous-dossier créé à côté des photos. */
export const COLLIMO_FOLDER_NAME = 'Collimo'

/** Nombre maximum de photos dans un collage. */
export const MAX_PHOTOS = 20

/** Formats que le navigateur sait décoder pour le rendu et l'export. */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const

export function missingConfig(c: AppConfig): string[] {
  if (c.mock) return []
  const missing: string[] = []
  if (!c.clientId) missing.push('VITE_GOOGLE_CLIENT_ID')
  if (!c.apiKey) missing.push('VITE_GOOGLE_API_KEY')
  if (!c.appId) missing.push('VITE_GOOGLE_APP_ID')
  return missing
}
