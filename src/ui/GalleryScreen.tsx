import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { MAX_PHOTOS } from '../config'
import type { Location, Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { pruneSelection, toggleSelection } from '../lib/selection'
import { Thumbnail } from './Thumbnail'

interface Props {
  services: Services
  location: Location
  selection: string[]
  onSelectionChange: Dispatch<SetStateAction<string[]>>
  onCreate: (photos: Photo[]) => void
  onError: (e: unknown) => void
}

export function GalleryScreen({ services, location, selection, onSelectionChange, onCreate, onError }: Props) {
  const { t } = useI18n()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [limitHint, setLimitHint] = useState(false)

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
      <div className="gallery-head">
        <div>
          <p className="crumbs">{t('gallery.location', { drive: driveName, folder: location.folder.name })}</p>
          {photos && <p className="muted">{t('gallery.count', { count: photos.length })}</p>}
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => {
            setPhotos(null)
            void load()
          }}
          disabled={!photos}>
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
