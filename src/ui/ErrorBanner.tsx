import { useI18n } from '../i18n'
import type { UiError } from '../lib/errors'

interface Props {
  error: UiError
  onReconnect?: () => void
  onRetry?: () => void
}

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
