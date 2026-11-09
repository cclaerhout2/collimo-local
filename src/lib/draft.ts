/**
 * Brouillon du collage en cours, gardé dans le navigateur (localStorage) pour survivre à une coupure,
 * une fermeture d'onglet ou un plantage. Un seul brouillon par compte Google ; il ne contient que les
 * identifiants des photos et les réglages, jamais les images. Rien ne part sur Drive.
 */
import type { CollageDoc } from '../collage/types'
import type { FolderPath } from '../google/types'

/** Version du format du brouillon : un brouillon d'une autre version est ignoré. */
const DRAFT_VERSION = 1

/** Préfixe des clés de stockage ; la clé complète inclut l'adresse du compte. */
const KEY_PREFIX = 'collimo.draft.'

/** Brouillon enregistré : un collage seul, ou une série issue de la répartition. */
export interface Draft {
  version: typeof DRAFT_VERSION
  /** Compte à qui appartient le brouillon. */
  email: string
  /** Date de la dernière modification (ISO 8601). */
  updatedAt: string
  /** Dossier de photos ouvert au moment du collage (pour le rouvrir). */
  folder: FolderPath
  /** Collages de la série (un seul pour un collage simple). */
  docs: CollageDoc[]
  /** Collage affiché. */
  index: number
  /** Collages déjà enregistrés dans Drive. */
  saved: boolean[]
}

/**
 * Clé de stockage d'un compte.
 * @param email - adresse du compte
 * @returns la clé
 */
const keyFor = (email: string) => `${KEY_PREFIX}${email.toLowerCase()}`

/**
 * Enregistre le brouillon. Un échec (stockage plein ou interdit) est ignoré : le brouillon est une
 * sécurité, pas une fonction indispensable.
 * @param draft - brouillon à garder
 */
export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(keyFor(draft.email), JSON.stringify(draft))
  } catch {
    // Stockage indisponible : pas de brouillon.
  }
}

/**
 * Lit le brouillon d'un compte.
 * @param email - adresse du compte
 * @returns le brouillon, ou `null` s'il n'y en a pas ou s'il est illisible
 */
export function loadDraft(email: string): Draft | null {
  try {
    const raw = localStorage.getItem(keyFor(email))
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<Draft>
    if (d.version !== DRAFT_VERSION || d.email?.toLowerCase() !== email.toLowerCase()) return null
    if (!Array.isArray(d.docs) || d.docs.length === 0 || !d.folder?.path?.length) return null
    const index = typeof d.index === 'number' ? Math.min(Math.max(0, d.index), d.docs.length - 1) : 0
    const saved = Array.isArray(d.saved) && d.saved.length === d.docs.length ? d.saved.map(Boolean) : d.docs.map(() => false)
    return {
      version: DRAFT_VERSION,
      email: d.email,
      updatedAt: d.updatedAt ?? new Date(0).toISOString(),
      folder: d.folder,
      docs: d.docs,
      index,
      saved,
    }
  } catch {
    return null
  }
}

/**
 * Efface le brouillon d'un compte.
 * @param email - adresse du compte
 */
export function clearDraft(email: string) {
  try {
    localStorage.removeItem(keyFor(email))
  } catch {
    // Rien à effacer, ou stockage indisponible.
  }
}

/**
 * Indique si un brouillon vaut la peine d'être proposé : au moins un collage non enregistré.
 * @param draft - brouillon
 * @returns `true` s'il reste du travail non enregistré
 */
export function draftHasUnsaved(draft: Draft): boolean {
  return draft.saved.some((s) => !s)
}
