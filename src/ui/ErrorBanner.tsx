/**
 * Bandeau d'erreur affiché sous l'en-tête, avec au besoin un bouton pour se reconnecter ou réessayer.
 */
import { useI18n } from '../i18n'
import type { UiError } from '../lib/errors'

/** Propriétés du bandeau d'erreur. */
interface Props {
  /** Erreur à afficher (clé de traduction et variables). */
  error: UiError
  /** Relance la connexion ; le bouton n'apparaît que si l'erreur vient d'une session expirée. */
  onReconnect?: () => void
  /** Recommence l'opération qui a échoué ; bouton absent si non fourni. */
  onRetry?: () => void
}

/**
 * Bandeau qui affiche une erreur traduite, avec le bouton « Se reconnecter » si la session a expiré,
 * sinon le bouton « Réessayer » s'il est proposé.
 * @returns le bandeau d'erreur
 */
export function ErrorBanner({ error, onReconnect, onRetry }: Props) {
  const { t } = useI18n()
  return (
    <div className="banner banner-error" role="alert">
      <span>{t(error.key, error.vars)}</span>
      {error.reconnect && onReconnect ? (
        <button type="button" className="btn btn-small" onClick={onReconnect}>
          {t('error.reconnect')}
        </button>
      ) : (
        onRetry && (
          <button type="button" className="btn btn-small" onClick={onRetry}>
            {t('error.retry')}
          </button>
        )
      )}
    </div>
  )
}
