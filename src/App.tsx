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
import { DriveApiError, FOLDER_MIME } from './google/drive'
import { createServices } from './google/services'
import type { DriveRef, FolderPath, Location, OpenFolder, Photo, Shortcut, SignedInUser, UserSettings } from './google/types'
import { useI18n, type Lang } from './i18n'
import { allowedDomains, isAllowedEmail, toUiError, type UiError } from './lib/errors'
import { FOLDER_PARAM, parseFolderParam, type LinkTarget } from './lib/folderLink'
import {
  addShortcut,
  currentFolder,
  isPinned,
  migrateSettings,
  moveShortcut,
  pushRecent,
  removeShortcut,
  renameShortcut,
} from './lib/locations'
import { AddLocationDialog } from './ui/AddLocationDialog'
import { EditorScreen } from './ui/editor/EditorScreen'
import { SplitScreen } from './ui/SplitScreen'

/** L'usine (admins seulement) n'est chargée qu'à l'ouverture. */
const FactoryScreen = lazy(() => import('./ui/factory/FactoryScreen').then((m) => ({ default: m.FactoryScreen })))
import { ErrorBanner } from './ui/ErrorBanner'
import { GalleryScreen } from './ui/GalleryScreen'
import type { ProjectEntry } from './ui/ProjectsList'
import { Header } from './ui/Header'
import { LinkProblem } from './ui/LinkProblem'
import { LocationsPanel } from './ui/LocationsPanel'
import { SignInScreen } from './ui/SignInScreen'

/** Phase de l'application, c'est-à-dire l'écran affiché ; l'éditeur porte le collage ouvert. */
type Phase =
  | { name: 'signin' }
  | { name: 'loading' }
  | { name: 'gallery' }
  | { name: 'editor'; doc: CollageDoc; key: number }
  | { name: 'split'; photos: Photo[] }
  | { name: 'factory' }

/**
 * Lit le dossier demandé dans l'adresse (`?folder=…`).
 * @returns l'élément désigné, `invalid` si le paramètre est présent mais illisible, ou `null`
 */
function readFolderParam(): LinkTarget | 'invalid' | null {
  const raw = new URLSearchParams(window.location.search).get(FOLDER_PARAM)
  if (raw === null) return null
  return parseFolderParam(raw) ?? 'invalid'
}

/** Retire `?folder=…` de l'adresse, une fois le dossier ouvert ou le lien abandonné. */
function clearFolderParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(FOLDER_PARAM)) return
  url.searchParams.delete(FOLDER_PARAM)
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

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
  const [link, setLink] = useState<LinkTarget | 'invalid' | null>(readFolderParam)
  /** Série de collages issue d'une répartition : documents (mis à jour quand on en quitte un), position, enregistrés. */
  const [queue, setQueue] = useState<{ docs: CollageDoc[]; index: number; saved: boolean[] } | null>(null)
  const [linkProblem, setLinkProblem] = useState(false)
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
   * Ouvre le dossier d'un lien Collimo (`?folder=…`). Un lien de fichier ouvre le dossier qui le
   * contient. Sans accès, Drive répond « introuvable » : l'écran propose alors de demander l'accès.
   * @param target - élément désigné par le lien
   */
  async function openLink(target: LinkTarget) {
    setOpening(true)
    setLinkProblem(false)
    setError(null)
    try {
      const item = await services.drive.getItem(target.id)
      const folder = item.mimeType === FOLDER_MIME ? item : item.parentId ? await services.drive.getFolder(item.parentId) : null
      if (!folder) throw new DriveApiError(404, 'Parent folder not visible')
      let drive: DriveRef = { id: null, name: t('setup.myDrive') }
      if (folder.driveId) {
        const shared = await services.drive.findSharedDrive({ id: folder.driveId })
        drive = { id: folder.driveId, name: shared?.name ?? folder.name }
      }
      setLink(null)
      clearFolderParam()
      await openFolder({ drive, path: [{ id: folder.id, name: folder.id === folder.driveId ? drive.name : folder.name }] })
    } catch (e) {
      if (e instanceof DriveApiError && !e.isRateLimit && (e.status === 404 || e.status === 403)) {
        setOpen(null)
        setLinkProblem(true)
      } else handleError(e)
      setOpening(false)
    }
  }

  /** Abandonne le lien (invalide ou sans accès) et revient au dernier dossier ouvert. */
  function dismissLink() {
    setLink(null)
    setLinkProblem(false)
    clearFolderParam()
    const current = settingsRef.current.current
    if (current) void openFolder(current, true)
  }

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
      if (link && link !== 'invalid') void openLink(link)
      else if (migrated.current) void openFolder(migrated.current, true)
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
    setLinkProblem(false)
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
      setQueue(null)
      setPhase({ name: 'editor', doc: newCollage(photos), key: Date.now() })
    } catch (e) {
      handleError(e)
    }
  }

  /**
   * Crée une série de collages à partir d'une répartition, et ouvre le premier dans l'éditeur.
   * @param groups - photos de chaque collage, dans l'ordre
   */
  async function createSeries(groups: Photo[][]) {
    if (!open?.canAddChildren || groups.length === 0) return
    try {
      const collimoFolderId = open.collimoFolderId ?? (await services.drive.ensureCollimoFolder(currentFolder(open).id))
      setOpen({ ...open, collimoFolderId })
      const docs = groups.map(newCollage)
      setQueue({ docs, index: 0, saved: docs.map(() => false) })
      setPhase({ name: 'editor', doc: docs[0], key: Date.now() })
    } catch (e) {
      handleError(e)
    }
  }

  /**
   * Va à un collage de la série, en gardant l'état du collage quitté.
   * @param target - indice du collage visé
   * @param current - collage affiché, dans son état actuel
   */
  function goInSeries(target: number, current: CollageDoc) {
    if (!queue) return
    const docs = queue.docs.map((d, i) => (i === queue.index ? current : d))
    const index = Math.max(0, Math.min(docs.length - 1, target))
    setQueue({ ...queue, docs, index })
    setPhase({ name: 'editor', doc: docs[index], key: Date.now() })
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
      {link && link !== 'invalid' && phase.name === 'signin' && <div className="banner banner-info">{t('link.signinHint')}</div>}
      {link === 'invalid' && (
        <div className="banner banner-error" role="alert">
          <span>{t('link.invalid')}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={dismissLink}>
            {t('link.dismiss')}
          </button>
        </div>
      )}

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
            onRename={(id, label) =>
              updateSettings((s) => ({ ...s, shortcuts: renameShortcut(s.shortcuts ?? [], id, label, t('setup.myDrive')) }))
            }
            onMove={(from, to) => updateSettings((s) => ({ ...s, shortcuts: moveShortcut(s.shortcuts ?? [], from, to) }))}
            onAdd={() => setAdding(true)}
          />
          {linkProblem && link && link !== 'invalid' && user && (
            <LinkProblem target={link} email={user.email} busy={opening} onRetry={() => void openLink(link)} onDismiss={dismissLink} />
          )}
          {!linkProblem && opening && !open && (
            <main className="screen screen-center">
              <div className="spinner" aria-label={t('locations.opening')} />
            </main>
          )}
          {!linkProblem && !opening && !open && (
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
          {!linkProblem && open && (
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
              onSplit={(photos) => setPhase({ name: 'split', photos })}
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

      {phase.name === 'split' && (
        <SplitScreen
          services={services}
          photos={phase.photos}
          onCancel={() => setPhase({ name: 'gallery' })}
          onCreate={(groups) => void createSeries(groups)}
        />
      )}

      {phase.name === 'editor' && location && (
        <EditorScreen
          key={phase.key}
          services={services}
          location={location}
          initialDoc={phase.doc}
          queue={
            queue
              ? {
                  index: queue.index,
                  total: queue.docs.length,
                  saved: queue.saved[queue.index],
                  savedAll: queue.saved,
                  onGo: goInSeries,
                  onSaved: () => setQueue((q) => (q ? { ...q, saved: q.saved.map((v, i) => (i === q.index ? true : v)) } : q)),
                }
              : undefined
          }
          onBack={() => {
            setQueue(null)
            setPhase({ name: 'gallery' })
          }}
          onReconnect={() => void reconnect()}
          onError={handleError}
        />
      )}
    </div>
  )
}
