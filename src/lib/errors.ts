/** Traduction des erreurs techniques en messages affichables, et contrôle du domaine du compte. */
import { AuthError, SessionExpiredError } from '../google/types'
import type { MessageKey } from '../i18n/fr'

/** Erreur prête à afficher. */
export interface UiError {
  /** Clé du message à afficher. */
  key: MessageKey
  /** Valeurs à insérer dans le message. */
  vars?: Record<string, string>
  /** Afficher le bouton « Se reconnecter ». */
  reconnect?: boolean
}

/**
 * Convertit une erreur quelconque en message affichable.
 * @param e - erreur attrapée
 * @returns le message à afficher ; une session expirée propose de se reconnecter
 */
export function toUiError(e: unknown): UiError {
  if (e instanceof SessionExpiredError) return { key: 'error.expired', reconnect: true }
  if (e instanceof AuthError) {
    if (e.code === 'popup') return { key: 'error.popup' }
    if (e.code === 'scopes') return { key: 'error.scopes' }
    return { key: 'error.generic', vars: { message: e.detail ?? e.message } }
  }
  return { key: 'error.generic', vars: { message: e instanceof Error ? e.message : String(e) } }
}

/**
 * Liste des domaines autorisés.
 * @param allowedDomain - un domaine, ou plusieurs séparés par des virgules ; vide = aucun
 * @returns les domaines, en minuscules, sans espaces ni doublons
 */
export function allowedDomains(allowedDomain: string): string[] {
  const list = allowedDomain.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  return [...new Set(list)]
}

/**
 * Indique si le compte appartient à l'un des domaines autorisés.
 * @param email - adresse du compte
 * @param allowedDomain - un domaine, ou plusieurs séparés par des virgules ; vide = pas de contrôle
 * @returns `true` si le compte est accepté
 */
export function isAllowedEmail(email: string, allowedDomain: string): boolean {
  const domains = allowedDomains(allowedDomain)
  if (domains.length === 0) return true
  const address = email.toLowerCase()
  return domains.some((d) => address.endsWith(`@${d}`))
}
