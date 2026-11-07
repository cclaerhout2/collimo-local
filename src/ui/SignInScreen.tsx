/**
 * Écran de connexion : présentation de l'application et bouton de connexion avec Google.
 */
import { useI18n } from '../i18n'
import { Logo } from './Header'

/** Propriétés de l'écran de connexion. */
interface Props {
  /** Connexion en cours : le bouton est désactivé et affiche un message d'attente. */
  busy: boolean
  /** Connexion impossible (configuration incomplète, par exemple). */
  disabled?: boolean
  /** Lance la connexion. */
  onSignIn: () => void
}

/**
 * Écran d'accueil d'un utilisateur non connecté.
 * @returns l'écran de connexion
 */
export function SignInScreen({ busy, disabled, onSignIn }: Props) {
  const { t } = useI18n()
  return (
    <main className="screen screen-center">
      <div className="card signin">
        <Logo />
        <h1>{t('signin.title')}</h1>
        <p className="tagline">{t('app.tagline')}</p>
        <p>{t('signin.text')}</p>
        <button type="button" className="btn btn-primary btn-large" onClick={onSignIn} disabled={busy || disabled}>
          <GoogleMark />
          {busy ? t('signin.loading') : t('signin.button')}
        </button>
        <p className="fine">{t('signin.privacy')}</p>
      </div>
    </main>
  )
}

/**
 * Pastille « G » neutre placée dans le bouton de connexion.
 * Ce n'est volontairement pas le logo officiel de Google, soumis à des règles d'usage.
 * @returns la pastille, masquée aux lecteurs d'écran
 */
function GoogleMark() {
  return (
    <span className="g-mark" aria-hidden="true">
      G
    </span>
  )
}
