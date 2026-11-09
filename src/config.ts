/**
 * Configuration de l'app (identifiants Google, domaine, catalogue) et constantes générales :
 * autorisations demandées, nom du dossier Collimo, nombre maximum de photos, formats d'image.
 */

/** Configuration lue au build depuis les variables d'environnement Vite (.env.local). */
export interface AppConfig {
  /** Identifiant client OAuth (VITE_GOOGLE_CLIENT_ID). */
  clientId: string
  /** Clé d'API Google, pour le Picker (VITE_GOOGLE_API_KEY). */
  apiKey: string
  /** Numéro du projet Google Cloud, pour le Picker (VITE_GOOGLE_APP_ID). */
  appId: string
  /** Domaine(s) Workspace autorisé(s), séparés par des virgules, en minuscules ; vide = pas de contrôle côté app. */
  allowedDomain: string
  /** Mode démo : Drive simulé, aucun appel à Google. */
  mock: boolean
  /** Drive partagé du catalogue de l'usine à dispositions : identifiant (prioritaire) ou nom exact. */
  catalogueDriveId: string
  /** Nom exact du Drive partagé du catalogue, utilisé si `catalogueDriveId` est vide. */
  catalogueDriveName: string
}

const env = import.meta.env

/** Configuration de cette version de l'app. */
export const config: AppConfig = {
  clientId: env.VITE_GOOGLE_CLIENT_ID ?? '',
  apiKey: env.VITE_GOOGLE_API_KEY ?? '',
  appId: env.VITE_GOOGLE_APP_ID ?? '',
  allowedDomain: (env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase(),
  mock: env.VITE_MOCK === '1',
  catalogueDriveId: (env.VITE_CATALOGUE_DRIVE_ID ?? '').trim(),
  catalogueDriveName: (env.VITE_CATALOGUE_DRIVE_NAME ?? '').trim() || 'Collimo – Catalogue',
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
/** Nombre minimum de photos dans un collage. */
export const MIN_PHOTOS = 2
/** Nombre maximum de photos sélectionnées à la fois (à répartir en plusieurs collages au-delà de MAX_PHOTOS). */
export const MAX_SELECTION = 100

/** Formats que le navigateur sait décoder pour le rendu et l'export. */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
] as const

/** Formats HEIC/HEIF des iPhone : décodés par Safari, ou par un module chargé à la demande ailleurs. */
export const HEIC_TYPES = ['image/heic', 'image/heif'] as const

/**
 * Liste les variables d'environnement obligatoires absentes (aucune en mode démo).
 * @param c - configuration à vérifier
 * @returns les noms des variables manquantes, vide si tout est en place
 */
export function missingConfig(c: AppConfig): string[] {
  if (c.mock) return []
  const missing: string[] = []
  if (!c.clientId) missing.push('VITE_GOOGLE_CLIENT_ID')
  if (!c.apiKey) missing.push('VITE_GOOGLE_API_KEY')
  if (!c.appId) missing.push('VITE_GOOGLE_APP_ID')
  return missing
}
