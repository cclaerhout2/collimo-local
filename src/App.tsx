import { useCallback, useMemo, useState } from 'react'
import { config, missingConfig } from './config'
import { createServices } from './google/services'
import type { DriveRef, FolderInfo, Photo, SignedInUser, UserSettings } from './google/types'
import { useI18n, type Lang } from './i18n'
import { isAllowedEmail, toUiError, type UiError } from './lib/errors'
import { CollagePlaceholder } from './ui/CollagePlaceholder'
import { ErrorBanner } from './ui/ErrorBanner'
import { GalleryScreen } from './ui/GalleryScreen'
import { Header } from './ui/Header'
import { SetupScreen } from './ui/SetupScreen'
import { SignInScreen } from './ui/SignInScreen'

type Phase =
  | { name: 'signin' }
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'gallery' }
  | { name: 'collage'; photos: Photo[] }

const EMPTY_SETTINGS: UserSettings = { version: 1 }

export default function App() {
  const { t, setLang } = useI18n()
  const services = useMemo(() => createServices(config), [])
  const missing = useMemo(() => missingConfig(config), [])

  const [phase, setPhase] = useState<Phase>({ name: 'signin' })
  const [user, setUser] = useState<SignedInUser | null>(null)
  const [settings, setSettings] = useState<UserSettings>(EMPTY_SETTINGS)
  const [selection, setSelection] = useState<string[]>([])
  const [error, setError] = useState<UiError | null>(null)
  const [busy, setBusy] = useState(false)

  const handleError = useCallback((e: unknown) => setError(toUiError(e)), [])

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      await services.auth.signIn()
      const me = await services.drive.currentUser()
      if (!isAllowedEmail(me.email, config.allowedDomain)) {
        services.auth.signOut()
        setError({ key: 'error.domain', vars: { email: me.email, domain: config.allowedDomain } })
        return
      }
      setUser(me)
      setPhase({ name: 'loading' })
      const saved = (await services.drive.loadSettings()) ?? EMPTY_SETTINGS
      if (saved.lang) setLang(saved.lang)
      if (saved.location) {
        try {
          const folder = await services.drive.getFolder(saved.location.folder.id)
          const location = { ...saved.location, folder: { id: folder.id, name: folder.name } }
          setSettings({ ...saved, location })
          setPhase({ name: 'gallery' })
          return
        } catch {
          // Dossier supprimé, déplacé ou plus accessible : on redemande l'emplacement.
        }
      }
      setSettings({ ...saved, location: undefined })
      setPhase({ name: 'setup' })
    } catch (e) {
      handleError(e)
      setPhase((p) => (p.name === 'loading' ? { name: 'signin' } : p))
    } finally {
      setBusy(false)
    }
  }

  /** Après expiration du jeton : nouvelle connexion, sans quitter l'écran en cours. */
  async function reconnect() {
    try {
      await services.auth.signIn()
      setError(null)
    } catch (e) {
      handleError(e)
    }
  }

  function signOut() {
    services.auth.signOut()
    setUser(null)
    setSettings(EMPTY_SETTINGS)
    setSelection([])
    setError(null)
    setPhase({ name: 'signin' })
  }

  async function saveLocation(drive: DriveRef, folder: FolderInfo) {
    const collimoFolderId = await services.drive.ensureCollimoFolder(folder.id)
    const next: UserSettings = {
      ...settings,
      location: { drive, folder: { id: folder.id, name: folder.name }, collimoFolderId },
    }
    await services.drive.saveSettings(next)
    setSettings(next)
    setSelection([])
    setError(null)
    setPhase({ name: 'gallery' })
  }

  function changeLang(lang: Lang) {
    setLang(lang)
    if (!user) return
    const next = { ...settings, lang }
    setSettings(next)
    services.drive.saveSettings(next).catch(handleError)
  }

  const location = settings.location
  const configError: UiError | null = missing.length ? { key: 'error.config', vars: { vars: missing.join(', ') } } : null

  return (
    <div className="app">
      <Header
        user={user}
        onLangChange={changeLang}
        onChangeLocation={user && phase.name !== 'setup' && phase.name !== 'loading' ? () => setPhase({ name: 'setup' }) : undefined}
        onSignOut={user ? signOut : undefined}
      />
      {config.mock && <div className="banner banner-info">{t('mock.banner')}</div>}
      {(configError ?? error) && (
        <ErrorBanner error={(configError ?? error)!} onReconnect={() => void reconnect()} />
      )}

      {phase.name === 'signin' && <SignInScreen busy={busy} disabled={!!configError} onSignIn={() => void signIn()} />}

      {phase.name === 'loading' && (
        <main className="screen screen-center">
          <div className="spinner" aria-label={t('signin.loading')} />
        </main>
      )}

      {phase.name === 'setup' && (
        <SetupScreen
          services={services}
          current={location}
          onDone={saveLocation}
          onCancel={location ? () => setPhase({ name: 'gallery' }) : undefined}
          onError={handleError}
        />
      )}

      {phase.name === 'gallery' && location && (
        <GalleryScreen
          services={services}
          location={location}
          selection={selection}
          onSelectionChange={setSelection}
          onCreate={(photos) => setPhase({ name: 'collage', photos })}
          onError={handleError}
        />
      )}

      {phase.name === 'collage' && (
        <CollagePlaceholder photos={phase.photos} services={services} onBack={() => setPhase({ name: 'gallery' })} />
      )}
    </div>
  )
}
