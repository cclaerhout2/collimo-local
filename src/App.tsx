/**
 * Composant racine de Collimo : enchaîne les phases de l'application (connexion, galerie avec ses
 * emplacements, éditeur de collage, usine à dispositions) et détient l'état partagé entre les écrans
 * (utilisateur, réglages, dossier ouvert, sélection de photos, erreur affichée, catalogue).
 */
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { config, missingConfig } from './config'
import { defaultLayoutFor, setCustomCatalogue } from './collage/catalog'
import { loadCatalogue, type CatalogueState } from './catalogue/store'
import { parseProject, ProjectFormatError } from './collage/project'
import { DEFAULT_RATIO } from './collage/ratios'
import { DEFAULT_BACKGROUND, DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc } from './collage/types'
import { createServices } from './google/services'
import type { FolderPath, Location, OpenFolder, Photo, Shortcut, SignedInUser, UserSettings } from './google/types'
import { useI18n, type Lang } from './i18n'
import { allowedDomains, isAllowedEmail, toUiError, type UiError } from './lib/errors'
import { addShortcut, currentFolder, isPinned, migrateSettings, pushRecent, removeShortcut } from './lib/locations'
import { AddLocationDialog } from './ui/AddLocationDialog'
import { EditorScreen } from './ui/editor/EditorScreen'

/** L'usine (admins seulement) n'est chargée qu'à l'ouverture. */
const FactoryScreen = lazy(() => import('./ui/factory/FactoryScreen').then((m) => ({ default: m.FactoryScreen })))
import { ErrorBanner } from './ui/ErrorBanner'
import { GalleryScreen } from './ui/GalleryScreen'
import type { ProjectEntry } from './ui/ProjectsList'
import { Header } from './ui/Header'
import { LocationsPanel } from './ui/LocationsPanel'
import { SignInScreen } from './ui/SignInScreen'

/** Phase de l'application, c'est-à-dire l'écran affiché ; l'éditeur porte le collage ouvert. */
type Phase =
  { name: 'signin' } | { name: 'loading' } | { name: 'gallery' } | { name: 'editor'; doc: CollageDoc; key: number } | { name: 'factory' }

/** Réglages d'un utilisateur qui n'a encore rien enregistré. */
const EMPTY_SETTINGS: UserSettings = { version: 1 }

/**
 * Crée un nouveau collage : carré, première disposition du catalogue, photos dans l'ordre de sélection.
 * @param photos - photos choisies dans la galerie, dans l'ordre de sélection
 * @returns le document du collage, avec recadrages, bordures et fond par défaut
 */
export function newCollage(photos: Photo[]): CollageDoc {
  return {
    version: 1,
    ratio: DEFAULT_RATIO,
    layoutId: defaultLayoutFor(photos.length).id,
    photos: photos.map((p) => ({
      id: p.id,
      name: p.name,
      mimeType: p.mimeType,
      width: p.width,
      height: p.height,
      crop: { ...DEFAULT_CROP },
    })),
    borders: { ...DEFAULT_BORDERS },
    background: DEFAULT_BACKGROUND,
  }
}

/**
 * Application complète : en-tête, bandeaux d'information et d'erreur, puis l'écran de la phase en cours.
 * @returns l'application, avec l'écran correspondant à la phase en cours
 */
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
  const [open, setOpen] = useState<OpenFolder | null>(null)
  const [opening, setOpening] = useState(false)
  const [adding, setAdding] = useState(false)
  /** Réglages les plus récents, pour enchaîner les modifications sans attendre un nouveau rendu. */
  const settingsRef = useRef<UserSettings>(EMPTY_SETTINGS)
  /** Numéro de la dernière ouverture de dossier demandée : une réponse plus ancienne est ignorée. */
  const openRequest = useRef(0)

  /**
   * Retient le catalogue de l'usine et le transmet au moteur de collage.
   * Le catalogue est chargé en arrière-plan ; s'il est absent ou illisible, seules les dispositions intégrées sont proposées.
   * @param c - catalogue lu sur le Drive partagé, ou `null` pour revenir aux seules dispositions intégrées
   */
  const applyCatalogue = useCallback((c: CatalogueState | null) => {
    setCatalogue(c)
    setCustomCatalogue(c?.data ?? null)
  }, [])

  /**
   * Affiche une erreur quelconque dans le bandeau, traduite en message pour l'utilisateur.
   * @param e - erreur attrapée
   */
  const handleError = useCallback((e: unknown) => setError(toUiError(e)), [])

  /**
   * Modifie les réglages et les enregistre sur Drive en arrière-plan.
   * @param change - transformation à appliquer aux réglages actuels
   */
  const updateSettings = useCallback(
    (change: (s: UserSettings) => UserSettings) => {
      const next = change(settingsRef.current)
      settingsRef.current = next
      setSettings(next)
      services.drive.saveSettings(next).catch(handleError)
    },
    [services, handleError],
  )

  /**
   * Ouvre un dossier dans la galerie : vérifie qu'il est accessible, lit ses droits et cherche son
   * dossier Collimo (sans le créer), puis le retient comme dossier courant et récent.
   * @param fp - chemin du dossier à ouvrir
   * @param quiet - `true` pour ne rien afficher si le dossier n'est plus accessible (réouverture à la connexion)
   */
  const openFolder = useCallback(
    async (fp: FolderPath, quiet = false) => {
      const request = ++openRequest.current
      setOpening(true)
      setError(null)
      try {
        const target = currentFolder(fp)
        const [info, collimoFolderId] = await Promise.all([
          services.drive.getFolder(target.id),
          services.drive.findCollimoFolder(target.id),
        ])
        if (request !== openRequest.current) return
        const path = [...fp.path.slice(0, -1), { id: target.id, name: target.id === 'root' ? target.name : info.name }]
        const next: FolderPath = { drive: fp.drive, path }
        setOpen({ ...next, canAddChildren: info.canAddChildren, collimoFolderId })
        setSelection([])
        updateSettings((s) => ({ ...s, current: next, recents: pushRecent(s.recents ?? [], next) }))
      } catch (e) {
        if (request !== openRequest.current) return
        if (!quiet) handleError(e)
        updateSettings((s) => ({ ...s, current: undefined }))
      } finally {
        if (request === openRequest.current) setOpening(false)
      }
    },
    [services, updateSettings, handleError],
  )

  /**
   * Ouvre un projet enregistré dans l'éditeur.
   * Un fichier projet illisible donne un message dédié plutôt qu'une erreur générique.
   * @param entry - projet choisi dans la liste de la galerie
   */
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

  /**
   * Connecte l'utilisateur, vérifie son domaine, charge ses réglages et ouvre la galerie
   * (ou le choix de l'emplacement si aucun dossier valide n'est enregistré).
   * Le catalogue de l'usine est chargé en parallèle sans bloquer l'ouverture : il ne sert
   * qu'à proposer des dispositions supplémentaires et à savoir si l'utilisateur est admin.
   */
  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      await services.auth.signIn()
      const me = await services.drive.currentUser()
      if (!isAllowedEmail(me.email, config.allowedDomain)) {
        services.auth.signOut()
        setError({ key: 'error.domain', vars: { email: me.email, domain: allowedDomains(config.allowedDomain).join(', ') } })
        return
      }
      setUser(me)
      setPhase({ name: 'loading' })
      loadCatalogue(services.drive, config)
        .then(applyCatalogue)
        .catch((e) => console.warn('Catalogue des dispositions indisponible', e))
      const saved = (await services.drive.loadSettings()) ?? EMPTY_SETTINGS
      if (saved.lang) setLang(saved.lang)
      const migrated = migrateSettings(saved)
      settingsRef.current = migrated
      setSettings(migrated)
      if (saved.location) services.drive.saveSettings(migrated).catch(handleError)
      setPhase({ name: 'gallery' })
      if (migrated.current) void openFolder(migrated.current, true)
      else if (!migrated.shortcuts?.length) setAdding(true)
    } catch (e) {
      handleError(e)
      setPhase((p) => (p.name === 'loading' ? { name: 'signin' } : p))
    } finally {
      setBusy(false)
    }
  }

  /** Reconnecte l'utilisateur après expiration du jeton, sans quitter l'écran en cours. */
  async function reconnect() {
    try {
      await services.auth.signIn()
      setError(null)
    } catch (e) {
      handleError(e)
    }
  }

  /** Déconnecte l'utilisateur et oublie tout ce qui lui appartient (réglages, sélection, catalogue). */
  function signOut() {
    services.auth.signOut()
    applyCatalogue(null)
    setUser(null)
    openRequest.current++
    setOpen(null)
    setOpening(false)
    setAdding(false)
    settingsRef.current = EMPTY_SETTINGS
    setSettings(EMPTY_SETTINGS)
    setSelection([])
    setError(null)
    setPhase({ name: 'signin' })
  }

  /**
   * Ajoute un raccourci, l'ouvre et ferme la fenêtre d'ajout.
   * @param shortcut - raccourci choisi
   */
  function addLocation(shortcut: Shortcut) {
    updateSettings((s) => ({ ...s, shortcuts: addShortcut(s.shortcuts ?? [], shortcut) }))
    setAdding(false)
    void openFolder({ drive: shortcut.drive, path: [shortcut.folder] })
  }

  /** Ajoute le dossier ouvert aux raccourcis. */
  function pinOpenFolder() {
    if (!open) return
    const folder = currentFolder(open)
    updateSettings((s) => ({ ...s, shortcuts: addShortcut(s.shortcuts ?? [], { drive: open.drive, folder }) }))
  }

  /**
   * Retire un raccourci de la liste ; le dossier ouvert reste affiché.
   * @param folderId - dossier du raccourci
   */
  function removeLocation(folderId: string) {
    updateSettings((s) => ({ ...s, shortcuts: removeShortcut(s.shortcuts ?? [], folderId) }))
  }

  /**
   * Crée un collage à partir de la sélection. Le sous-dossier Collimo du dossier ouvert, où vont
   * collages et projets, est créé à ce moment-là s'il n'existe pas encore.
   * @param photos - photos choisies, dans l'ordre de sélection
   */
  async function createCollage(photos: Photo[]) {
    if (!open?.canAddChildren) return
    try {
      const collimoFolderId = open.collimoFolderId ?? (await services.drive.ensureCollimoFolder(currentFolder(open).id))
      setOpen({ ...open, collimoFolderId })
      setPhase({ name: 'editor', doc: newCollage(photos), key: Date.now() })
    } catch (e) {
      handleError(e)
    }
  }

  /**
   * Change la langue de l'interface et, si l'utilisateur est connecté, la mémorise dans ses réglages.
   * @param lang - langue choisie
   */
  function changeLang(lang: Lang) {
    setLang(lang)
    if (!user) return
    updateSettings((s) => ({ ...s, lang }))
  }

  /** Emplacement de travail de l'éditeur : le dossier ouvert, une fois son dossier Collimo connu. */
  const location: Location | null =
    open && open.collimoFolderId ? { drive: open.drive, folder: currentFolder(open), collimoFolderId: open.collimoFolderId } : null
  const shortcuts = settings.shortcuts ?? []
  const configError: UiError | null = missing.length ? { key: 'error.config', vars: { vars: missing.join(', ') } } : null

  return (
    <div className="app">
      <Header
        user={user}
        onLangChange={changeLang}
        onOpenFactory={catalogue?.isAdmin && open && phase.name === 'gallery' ? () => setPhase({ name: 'factory' }) : undefined}
        onSignOut={user ? signOut : undefined}
      />
      {config.mock && <div className="banner banner-info">{t('mock.banner')}</div>}
      {(configError ?? error) && <ErrorBanner error={(configError ?? error)!} onReconnect={() => void reconnect()} />}

      {phase.name === 'signin' && <SignInScreen busy={busy} disabled={!!configError} onSignIn={() => void signIn()} />}

      {phase.name === 'loading' && (
        <main className="screen screen-center">
          <div className="spinner" aria-label={t('signin.loading')} />
        </main>
      )}

      {phase.name === 'gallery' && (
        <div className="workspace">
          <LocationsPanel
            shortcuts={shortcuts}
            recents={settings.recents ?? []}
            open={open}
            onOpen={(fp) => void openFolder(fp)}
            onRemove={removeLocation}
            onAdd={() => setAdding(true)}
          />
          {opening && !open && (
            <main className="screen screen-center">
              <div className="spinner" aria-label={t('locations.opening')} />
            </main>
          )}
          {!opening && !open && (
            <main className="screen screen-center">
              <div className="empty locations-empty">
                <p>
                  <strong>{shortcuts.length ? t('locations.pick') : t('locations.emptyTitle')}</strong>
                </p>
                {!shortcuts.length && <p className="muted">{t('locations.emptyText')}</p>}
                {!shortcuts.length && (
                  <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                    + {t('locations.add')}
                  </button>
                )}
              </div>
            </main>
          )}
          {open && (
            <GalleryScreen
              key={currentFolder(open).id}
              services={services}
              open={open}
              pinned={isPinned(shortcuts, currentFolder(open).id)}
              onNavigate={(fp) => void openFolder(fp)}
              onPin={pinOpenFolder}
              selection={selection}
              onSelectionChange={setSelection}
              onCreate={(photos) => void createCollage(photos)}
              onOpenProject={(entry) => void openProject(entry)}
              onError={handleError}
            />
          )}
        </div>
      )}

      {adding && user && (
        <AddLocationDialog services={services} shortcuts={shortcuts} onAdd={addLocation} onClose={() => setAdding(false)} />
      )}

      {phase.name === 'factory' && open && catalogue && user && (
        <Suspense
          fallback={
            <main className="screen screen-center">
              <div className="spinner" aria-label={t('signin.loading')} />
            </main>
          }
        >
          <FactoryScreen
            services={services}
            location={{ drive: open.drive, folder: currentFolder(open) }}
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
