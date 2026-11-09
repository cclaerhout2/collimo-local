/**
 * Galerie : projets déjà enregistrés, fil d'Ariane et sous-dossiers du dossier ouvert, puis ses
 * photos, à sélectionner pour créer un collage.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { MAX_PHOTOS } from '../config'
import type { FolderPath, FolderRef, OpenFolder, Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { collimoFolderLink } from '../lib/folderLink'
import { currentFolder, folderLabel } from '../lib/locations'
import { pruneSelection, toggleSelection } from '../lib/selection'
import { FolderIcon } from './icons'
import { PrivacyNote } from './PrivacyNote'
import { Slideshow } from './Slideshow'
import { ProjectsList, type ProjectEntry } from './ProjectsList'
import { Thumbnail } from './Thumbnail'

/** Propriétés de l'écran de la galerie. */
interface Props {
  /** Services Google (Drive). */
  services: Services
  /** Dossier ouvert, avec son chemin depuis le raccourci, ses droits et son dossier Collimo. */
  open: OpenFolder
  /** Le dossier ouvert a-t-il déjà son raccourci ? */
  pinned: boolean
  /** Ouvre un autre dossier (sous-dossier ou dossier du fil d'Ariane). */
  onNavigate: (fp: FolderPath) => void
  /** Ajoute le dossier ouvert aux raccourcis. */
  onPin: () => void
  /** Identifiants des photos sélectionnées, dans l'ordre de sélection. */
  selection: string[]
  /** Modifie la sélection ; elle est gardée par l'app pour survivre à un passage par l'éditeur. */
  onSelectionChange: Dispatch<SetStateAction<string[]>>
  /** Crée un collage avec les photos sélectionnées, dans l'ordre. */
  onCreate: (photos: Photo[]) => void
  /** Ouvre un projet enregistré. */
  onOpenProject: (entry: ProjectEntry) => void
  /** Signale une erreur à afficher. */
  onError: (e: unknown) => void
}

/**
 * Écran de la galerie, avec la barre de sélection en bas.
 * @returns l'écran de la galerie
 */
export function GalleryScreen({
  services,
  open,
  pinned,
  onNavigate,
  onPin,
  selection,
  onSelectionChange,
  onCreate,
  onOpenProject,
  onError,
}: Props) {
  const { t } = useI18n()
  const folder = currentFolder(open)
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [subfolders, setSubfolders] = useState<FolderRef[] | null>(null)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const [slideIndex, setSlideIndex] = useState<number | null>(null)
  const shareLink = collimoFolderLink(`${window.location.origin}${window.location.pathname}`, folder.id)

  /** Copie le lien Collimo du dossier ouvert ; si le navigateur refuse, le lien s'affiche pour une copie à la main. */
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied('done')
      window.setTimeout(() => setCopied('idle'), 2500)
    } catch {
      setCopied('failed')
    }
  }
  const [limitHint, setLimitHint] = useState(false)

  const folderId = folder.id
  const driveId = open.drive.id

  /** Charge les sous-dossiers et les photos, et retire de la sélection les photos qui ne sont plus disponibles. */
  const load = useCallback(async () => {
    try {
      const [folders, list] = await Promise.all([
        services.drive.listSubfolders(folderId, driveId),
        services.drive.listPhotos({ id: folderId }, driveId),
      ])
      setSubfolders(folders)
      setPhotos(list)
      const available = list.filter((p) => p.supported).map((p) => p.id)
      onSelectionChange((prev) => pruneSelection(prev, available))
    } catch (e) {
      setSubfolders([])
      setPhotos([])
      onError(e)
    }
  }, [services, folderId, driveId, onError, onSelectionChange])

  // Un autre dossier remonte l'écran (clé du dossier dans App) : l'état part toujours de « en chargement ».
  useEffect(() => {
    void load()
  }, [load])

  /**
   * Ajoute une photo à la sélection ou l'en retire, dans la limite du nombre maximal de photos.
   * @param photo - photo cliquée ; ignorée si son format n'est pas pris en charge
   */
  function toggle(photo: Photo) {
    if (!photo.supported) return
    const r = toggleSelection(selection, photo.id, MAX_PHOTOS)
    setLimitHint(r.limitReached)
    onSelectionChange(r.selection)
  }

  const myDrive = t('setup.myDrive')
  const byId = new Map((photos ?? []).map((p) => [p.id, p]))

  /** Crée un collage avec les photos sélectionnées, dans l'ordre de sélection. */
  function create() {
    onCreate(selection.map((id) => byId.get(id)).filter((p): p is Photo => !!p))
  }

  return (
    <main className="screen gallery-screen">
      {open.collimoFolderId && (
        <ProjectsList services={services} collimoFolderId={open.collimoFolderId} onOpen={onOpenProject} onError={onError} />
      )}
      <div className="gallery-head">
        <div>
          <ol className="crumbs">
            {open.path.map((p, i) => {
              const last = i === open.path.length - 1
              return (
                <li key={p.id}>
                  {last ? (
                    <span aria-current="page">{folderLabel(p, myDrive)}</span>
                  ) : (
                    <button
                      type="button"
                      className="crumb"
                      onClick={() => onNavigate({ drive: open.drive, path: open.path.slice(0, i + 1) })}
                    >
                      {folderLabel(p, myDrive)}
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
          {photos && <p className="muted">{t('gallery.count', { count: photos.length })}</p>}
        </div>
        <div className="gallery-tools">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setSlideIndex(0)} disabled={!photos?.length}>
            <PlayIcon /> {t('gallery.slideshow')}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void copyLink()}>
            <LinkIcon /> {copied === 'done' ? t('gallery.linkCopied') : t('gallery.copyLink')}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={onPin} disabled={pinned} aria-pressed={pinned}>
            <span aria-hidden="true">{pinned ? '★' : '☆'}</span> {pinned ? t('gallery.pinned') : t('gallery.pin')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setPhotos(null)
              setSubfolders(null)
              void load()
            }}
            disabled={!photos}
          >
            {t('gallery.refresh')}
          </button>
        </div>
      </div>

      {copied === 'failed' && (
        <p className="copy-fallback">
          {t('gallery.linkCopyFailed')}{' '}
          <input readOnly value={shareLink} onFocus={(e) => e.target.select()} aria-label={t('gallery.copyLink')} />
        </p>
      )}

      <PrivacyNote className="privacy-in-gallery" />

      {!open.canAddChildren && <div className="banner banner-info">{t('gallery.readOnly')}</div>}

      {subfolders && subfolders.length > 0 && (
        <section className="subfolders" aria-label={t('gallery.folders')}>
          <ul className="folder-grid">
            {subfolders.map((f) => (
              <li key={f.id}>
                <button type="button" className="folder-tile" onClick={() => onNavigate({ drive: open.drive, path: [...open.path, f] })}>
                  <FolderIcon />
                  <span>{f.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {photos === null && (
        <div className="grid" aria-busy="true" aria-label={t('gallery.loading')}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="tile skeleton" />
          ))}
        </div>
      )}

      {photos?.length === 0 && subfolders && subfolders.length > 0 && <p className="muted">{t('gallery.noPhotosHere')}</p>}

      {photos?.length === 0 && subfolders?.length === 0 && (
        <div className="empty">
          <p>
            <strong>{t('gallery.empty')}</strong>
          </p>
          <p className="muted">{t('gallery.emptyHint')}</p>
        </div>
      )}

      {photos && photos.length > 0 && (
        <ul className="grid" aria-label={folderLabel(folder, myDrive)}>
          {photos.map((p) => {
            const order = selection.indexOf(p.id)
            const selected = order !== -1
            return (
              <li key={p.id} className="tile-cell">
                <button
                  type="button"
                  className={`tile${selected ? ' selected' : ''}${p.supported ? '' : ' unsupported'}`}
                  aria-pressed={selected}
                  aria-disabled={!p.supported}
                  title={p.supported ? p.name : t('gallery.unsupported', { type: p.mimeType.replace('image/', '').toUpperCase() })}
                  onClick={() => toggle(p)}
                >
                  <Thumbnail key={p.id} photo={p} services={services} />
                  {selected && <span className="badge">{order + 1}</span>}
                  {!p.supported && <span className="tile-note">{p.mimeType.replace('image/', '').toUpperCase()}</span>}
                </button>
                <button
                  type="button"
                  className="tile-zoom"
                  aria-label={t('gallery.zoom', { name: p.name })}
                  title={t('gallery.zoom', { name: p.name })}
                  onClick={() => setSlideIndex(photos.indexOf(p))}
                >
                  <ZoomIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className={`selection-bar${selection.length ? ' visible' : ''}`}>
        <span className="selection-count">
          {limitHint ? t('gallery.max', { max: MAX_PHOTOS }) : t('gallery.selected', { count: selection.length, max: MAX_PHOTOS })}
        </span>
        <div className="selection-actions">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setLimitHint(false)
              onSelectionChange([])
            }}
            disabled={!selection.length}
          >
            {t('gallery.clear')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selection.length || !open.canAddChildren}
            title={open.canAddChildren ? undefined : t('gallery.readOnly')}
            onClick={create}
          >
            {t('gallery.create')}
          </button>
        </div>
      </div>
      {slideIndex !== null && photos && photos.length > 0 && (
        <Slideshow
          services={services}
          photos={photos}
          startIndex={slideIndex}
          selection={selection}
          max={MAX_PHOTOS}
          limitHint={limitHint}
          canCreate={open.canAddChildren}
          onToggle={toggle}
          onCreate={() => {
            setSlideIndex(null)
            create()
          }}
          onClose={() => setSlideIndex(null)}
        />
      )}
    </main>
  )
}

/**
 * Icône de lien du bouton « Copier le lien Collimo ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function LinkIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Icône « lecture » du bouton Diaporama.
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function PlayIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9v6l5-3z" fill="currentColor" />
    </svg>
  )
}

/**
 * Icône de loupe, pour voir une photo en grand.
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function ZoomIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5M11 8v6M8 11h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
