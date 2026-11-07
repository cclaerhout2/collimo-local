/**
 * Galerie : projets déjà enregistrés, puis photos du dossier choisi, à sélectionner pour créer un collage.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { MAX_PHOTOS } from '../config'
import type { Location, Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { pruneSelection, toggleSelection } from '../lib/selection'
import { ProjectsList, type ProjectEntry } from './ProjectsList'
import { Thumbnail } from './Thumbnail'

/** Propriétés de l'écran de la galerie. */
interface Props {
  /** Services Google (Drive). */
  services: Services
  /** Emplacement de travail : Drive, dossier de photos et dossier Collimo. */
  location: Location
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
export function GalleryScreen({ services, location, selection, onSelectionChange, onCreate, onOpenProject, onError }: Props) {
  const { t } = useI18n()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [limitHint, setLimitHint] = useState(false)

  /** Charge la liste des photos et retire de la sélection celles qui ne sont plus disponibles. */
  const load = useCallback(async () => {
    try {
      const list = await services.drive.listPhotos(location.folder, location.drive.id)
      setPhotos(list)
      const available = list.filter((p) => p.supported).map((p) => p.id)
      onSelectionChange((prev) => pruneSelection(prev, available))
    } catch (e) {
      setPhotos([])
      onError(e)
    }
  }, [services, location, onError, onSelectionChange])

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

  const driveName = location.drive.id ? location.drive.name : t('setup.myDrive')
  const byId = new Map((photos ?? []).map((p) => [p.id, p]))

  return (
    <main className="screen gallery-screen">
      <ProjectsList services={services} collimoFolderId={location.collimoFolderId} onOpen={onOpenProject} onError={onError} />
      <div className="gallery-head">
        <div>
          <p className="crumbs">{t('gallery.location', { drive: driveName, folder: location.folder.name })}</p>
          {photos && <p className="muted">{t('gallery.count', { count: photos.length })}</p>}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => {
            setPhotos(null)
            void load()
          }}
          disabled={!photos}
        >
          {t('gallery.refresh')}
        </button>
      </div>

      {photos === null && (
        <div className="grid" aria-busy="true" aria-label={t('gallery.loading')}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="tile skeleton" />
          ))}
        </div>
      )}

      {photos?.length === 0 && (
        <div className="empty">
          <p>
            <strong>{t('gallery.empty')}</strong>
          </p>
          <p className="muted">{t('gallery.emptyHint')}</p>
        </div>
      )}

      {photos && photos.length > 0 && (
        <ul className="grid" aria-label={location.folder.name}>
          {photos.map((p) => {
            const order = selection.indexOf(p.id)
            const selected = order !== -1
            return (
              <li key={p.id}>
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
            disabled={!selection.length}
            onClick={() => onCreate(selection.map((id) => byId.get(id)).filter((p): p is Photo => !!p))}
          >
            {t('gallery.create')}
          </button>
        </div>
      </div>
    </main>
  )
}
