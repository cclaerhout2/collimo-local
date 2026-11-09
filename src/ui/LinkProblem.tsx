/**
 * Écran affiché quand le dossier d'un lien Collimo ne s'ouvre pas : Drive ne distingue pas un
 * dossier introuvable d'un dossier sans accès. Propose de demander l'accès dans Google Drive, puis
 * de réessayer, ou de continuer sans ce dossier.
 */
import { useI18n } from '../i18n'
import { driveItemLink, type LinkTarget } from '../lib/folderLink'

/** Propriétés de l'écran de lien sans accès. */
interface Props {
  /** Élément désigné par le lien. */
  target: LinkTarget
  /** Adresse du compte connecté, pour repérer un mauvais compte. */
  email: string
  /** Nouvel essai en cours. */
  busy: boolean
  /** Réessaie d'ouvrir le dossier (après avoir obtenu l'accès). */
  onRetry: () => void
  /** Abandonne le lien. */
  onDismiss: () => void
}

/**
 * Message, lien vers la page Drive (qui propose « Demander l'accès ») et nouvel essai.
 * @returns l'écran
 */
export function LinkProblem({ target, email, busy, onRetry, onDismiss }: Props) {
  const { t } = useI18n()
  return (
    <main className="screen screen-center">
      <div className="card link-problem" role="alert">
        <h1>{t('link.noAccessTitle')}</h1>
        <p>{t('link.noAccessText', { email })}</p>
        <ol className="link-steps">
          <li>{t('link.step1')}</li>
          <li>{t('link.step2')}</li>
        </ol>
        <p className="muted">{t('link.otherAccount')}</p>
        <div className="actions actions-wrap">
          <button type="button" className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
            {t('link.dismiss')}
          </button>
          <a className="btn" href={driveItemLink(target)} target="_blank" rel="noreferrer">
            {t('link.requestAccess')}
          </a>
          <button type="button" className="btn btn-primary" onClick={onRetry} disabled={busy}>
            {busy ? t('locations.opening') : t('link.retry')}
          </button>
        </div>
      </div>
    </main>
  )
}
