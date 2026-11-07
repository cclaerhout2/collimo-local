import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { config, missingConfig } from './config'
import { defaultLayoutFor, setCustomCatalogue } from './collage/catalog'
import { loadCatalogue, type CatalogueState } from './catalogue/store'
import { parseProject, ProjectFormatError } from './collage/project'
import { DEFAULT_RATIO } from './collage/ratios'
import { DEFAULT_BACKGROUND, DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc } from './collage/types'
import { createServices } from './google/services'
import type { DriveRef, FolderInfo, Photo, SignedInUser, UserSettings } from './google/types'
import { useI18n, type Lang } from './i18n'
import { isAllowedEmail, toUiError, type UiError } from './lib/errors'
import { EditorScreen } from './ui/editor/EditorScreen'

/** L'usine (admins seulement) n'est chargée qu'à l'ouverture. */
const FactoryScreen = lazy(() => import('./ui/factory/FactoryScreen').then((m) => ({ default: m.FactoryScreen })))
import { ErrorBanner } from './ui/ErrorBanner'
import { GalleryScreen } from './ui/GalleryScreen'
import type { ProjectEntry } from './ui/ProjectsList'
import { Header } from './ui/Header'
import { SetupScreen } from './ui/SetupScreen'
import { SignInScreen } from './ui/SignInScreen'

type Phase =
  | { name: 'signin' }
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'gallery' }
  | { name: 'editor'; doc: CollageDoc; key: number }
  | { name: 'factory' }

const EMPTY_SETTINGS: UserSettings = { version: 1 }

/** Nouveau collage : carré, première disposition du catalogue, photos dans l'ordre de sélection. */
export function newCollage(photos: Photo[]): CollageDoc {
  return {
    version: 1,
    ratio: DEFAULT_RATIO,
    layoutId: defaultLayoutFor(photos.length).id,
    photos: photos.map((p) => ({ id: p.id, name: p.name, mimeType: p.mimeType, width: p.width, height: p.height, crop: { ...DEFAULT_CROP } })),
    borders: { ...DEFAULT_BORDERS },
    background: DEFAULT_BACKGROUND,
  }
}

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
  const [catalogue, setCatalogue] = useState<CatalogueState | null>(null)

  /** Catalogue de l'usine : chargé en arrière-plan ; s'il est absent ou illisible, seules les dispositions intégrées sont proposées. */
  const applyCatalogue = useCallback((c: CatalogueState | null) => {
    setCatalogue(c)
    setCustomCatalogue(c?.data ?? null)
  }, [])

  const handleError = useCallback((e: unknown) => setError(toUiError(e)), [])

  async function openProject(entry: ProjectEntry) {
    setError(null)
    try {
      const doc = parseProject(await services.drive.readJson(entry.project.id))
      setPhase({ name: 'editor', doc: { ...doc, createdFrom: entry.baseName }, key: Date.now() })
    } catch (e) {
      if (e instanceof ProjectFormatError || e instanceof SyntaxError) {
        setError({ key: 'projects.invalid', vars: { name: entry.baseName } })
      } else handleError(e)
    }
  }

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
      loadCatalogue(services.drive, config)
        .then(applyCatalogue)
        .catch((e) => console.warn('Catalogue des dispositions indisponible', e))
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
    applyCatalogue(null)
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
        onChangeLocation={user && phase.name === 'gallery' ? () => setPhase({ name: 'setup' }) : undefined}
        onOpenFactory={catalogue?.isAdmin && location && phase.name === 'gallery' ? () => setPhase({ name: 'factory' }) : undefined}
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
          onCreate={(photos) => setPhase({ name: 'editor', doc: newCollage(photos), key: Date.now() })}
          onOpenProject={(entry) => void openProject(entry)}
          onError={handleError}
        />
      )}

      {phase.name === 'factory' && location && catalogue && user && (
        <Suspense fallback={<main className="screen screen-center"><div className="spinner" aria-label={t('signin.loading')} /></main>}>
          <FactoryScreen
            services={services}
            location={location}
            catalogue={catalogue}
            userEmail={user.email}
            onCatalogueChange={applyCatalogue}
            onBack={() => setPhase({ name: 'gallery' })}
            onError={handleError}
          />
        </Suspense>
      )}

      {phase.name === 'editor' && location && (
        <EditorScreen
          key={phase.key}
          services={services}
          location={location}
          initialDoc={phase.doc}
          onBack={() => setPhase({ name: 'gallery' })}
          onReconnect={() => void reconnect()}
          onError={handleError}
        />
      )}
    </div>
  )
}
