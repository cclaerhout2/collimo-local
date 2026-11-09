/** Service de connexion Google réel (Google Identity Services), qui fournit le jeton d'accès aux API. */
import { SCOPES, type AppConfig } from '../config'
import { allowedDomains } from '../lib/errors'
import { loadScript } from './loadScript'
import { AuthError, SessionExpiredError, type AuthService } from './types'

/** Adresse du script Google Identity Services. */
const GIS_SRC = 'https://accounts.google.com/gsi/client'
/** Marge avant expiration : on considère le jeton périmé 60 s avant l'heure annoncée. */
const EXPIRY_MARGIN_MS = 60_000

/**
 * Connexion par Google Identity Services (jeton OAuth côté navigateur).
 * Le jeton dure environ une heure ; ensuite l'utilisateur se reconnecte d'un clic.
 * @param config - configuration de l'app (identifiant client OAuth, domaine autorisé)
 * @returns le service de connexion ; `signIn` lève une `AuthError` si la connexion échoue ou si
 * toutes les autorisations ne sont pas accordées
 */
export function createGoogleAuth(config: AppConfig): AuthService {
  let token: string | null = null
  let expiresAt = 0

  return {
    async signIn() {
      await loadScript(GIS_SRC)
      const response = await new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: SCOPES.join(' '),
          // `hd` n'accepte qu'un domaine : avec plusieurs domaines, seul le contrôle après connexion s'applique.
          hd: allowedDomains(config.allowedDomain).length === 1 ? allowedDomains(config.allowedDomain)[0] : undefined,
          include_granted_scopes: true,
          callback: (r) => (r.error ? reject(new AuthError('other', r.error_description ?? r.error)) : resolve(r)),
          error_callback: (e) => reject(new AuthError(e.type === 'unknown' ? 'other' : 'popup', e.message)),
        })
        client.requestAccessToken({ prompt: token ? '' : 'select_account' })
      })
      if (!google.accounts.oauth2.hasGrantedAllScopes(response, ...SCOPES)) {
        google.accounts.oauth2.revoke(response.access_token)
        throw new AuthError('scopes')
      }
      token = response.access_token
      expiresAt = Date.now() + response.expires_in * 1000 - EXPIRY_MARGIN_MS
    },

    getToken() {
      if (!token || Date.now() >= expiresAt) throw new SessionExpiredError()
      return token
    },

    signOut() {
      if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token)
      token = null
      expiresAt = 0
    },
  }
}
