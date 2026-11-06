import { AuthError, SessionExpiredError } from '../google/types'
import type { MessageKey } from '../i18n/fr'

export interface UiError {
  key: MessageKey
  vars?: Record<string, string>
  /** Afficher le bouton « Se reconnecter ». */
  reconnect?: boolean
}

export function toUiError(e: unknown): UiError {
  if (e instanceof SessionExpiredError) return { key: 'error.expired', reconnect: true }
  if (e instanceof AuthError) {
    if (e.code === 'popup') return { key: 'error.popup' }
    if (e.code === 'scopes') return { key: 'error.scopes' }
    return { key: 'error.generic', vars: { message: e.detail ?? e.message } }
  }
  return { key: 'error.generic', vars: { message: e instanceof Error ? e.message : String(e) } }
}

/** Le compte appartient-il au domaine autorisé ? (vide = pas de contrôle) */
export function isAllowedEmail(email: string, allowedDomain: string): boolean {
  if (!allowedDomain) return true
  return email.toLowerCase().endsWith(`@${allowedDomain}`)
}
