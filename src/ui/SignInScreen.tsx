import { useI18n } from '../i18n'
import { Logo } from './Header'

interface Props {
  busy: boolean
  disabled?: boolean
  onSignIn: () => void
}

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

/** Pastille « G » neutre (pas le logo officiel Google). */
function GoogleMark() {
  return (
    <span className="g-mark" aria-hidden="true">
      G
    </span>
  )
}
