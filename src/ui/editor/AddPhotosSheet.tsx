/**
 * Panneau de choix de photos de l'éditeur, pour ajouter des photos au collage ou en remplacer une :
 * photos du dossier ouvert, ou d'un autre dossier choisi avec le sélecteur de Google Drive,
 * sans quitter le collage en cours.
 */
import { useEffect, useState } from 'react'
import type { Location, Photo, Services } from '../../google/types'
import { useI18n } from '../../i18n'
import { toUiError, type UiError } from '../../lib/errors'
import { ErrorBanner } from '../ErrorBanner'
import { Thumbnail } from '../Thumbnail'

/** Propriétés de {@link AddPhotosSheet}. */
interface Props {
  /** Ajouter des photos (choix multiple), ou remplacer la photo sélectionnée (une photo, choisie d'un toucher). */
  mode?: 'add' | 'replace'
  /** Services Google (Drive et sélecteur). */
  services: Services
  /** Dossier ouvert : ses photos sont proposées en premier. */
  location: Location
  /** Photos déjà dans le collage (affichées estompées, non choisissables). */
  presentIds: readonly string[]
  /** Nombre de photos qu'on peut encore ajouter. */
  room: number
  /** Ajoute les photos choisies (ou la photo de remplacement) ; l'éditeur ferme alors le panneau. */
  onAdd: (photos: Photo[]) => void
  /** Ferme le panneau sans rien ajouter. */
  onClose: () => void
}

/**
 * Bascule une photo dans le choix en cours, sans dépasser la place restante.
 * @param picked - identifiants choisis, dans l'ordre du choix
 * @param id - photo touchée
 * @param room - nombre de photos qu'on peut encore ajouter
 * @returns le nouveau choix (inchangé si la place manque)
 */
export function togglePick(picked: readonly string[], id: string, room: number): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id)
  return picked.length >= room ? [...picked] : [...picked, id]
}

/**
 * Panneau d'ajout de photos au collage, ou de remplacement d'une photo.
 * @returns le panneau
 */
export function AddPhotosSheet({ mode = 'add', services, location, presentIds, room, onAdd, onClose }: Props) {
  const replacing = mode === 'replace'
  const { t, lang } = useI18n()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [problem, setProblem] = useState<UiError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    services.drive
      .listPhotos(location.folder, location.drive.id)
      .then((list) => alive && setPhotos(list))
      .catch((e: unknown) => {
        if (!alive) return
        setPhotos([])
        setProblem(toUiError(e))
      })
    return () => {
      alive = false
    }
  }, [services, location.folder, location.drive.id])

  useEffect(() => {
    /**
     * Ferme le panneau avec Échap.
     * @param e - touche pressée
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const present = new Set(presentIds)

  /** Ajoute les photos cochées du dossier, dans l'ordre où elles ont été choisies. */
  function addPicked() {
    const byId = new Map((photos ?? []).map((p) => [p.id, p]))
    onAdd(picked.map((id) => byId.get(id)).filter((p): p is Photo => !!p))
  }

  /**
   * Ouvre le sélecteur Google Drive (choix multiple) et ajoute directement les photos choisies.
   * @returns une promesse résolue une fois les photos ajoutées, ou le choix annulé
   */
  async function pickElsewhere() {
    setProblem(null)
    try {
      const chosen = replacing
        ? await services.picker.pickImage(location.drive, lang, t('photo.replaceTitle')).then((c) => (c ? [c] : null))
        : await services.picker.pickImages(location.drive, lang, t('addPhotos.pickerTitle', { max: room }), room)
      if (!chosen?.length) return
      setBusy(true)
      const list = await Promise.all(chosen.map((c) => services.drive.getPhoto(c.id)))
      const usable = list.filter((p) => p.supported && !present.has(p.id))
      if (!usable.length) {
        const odd = list.find((p) => !p.supported)
        setProblem(
          odd
            ? { key: 'photo.unsupported', vars: { type: odd.mimeType.replace('image/', '').toUpperCase() } }
            : { key: 'addPhotos.alreadyIn' },
        )
        return
      }
      onAdd(usable)
    } catch (e) {
      setProblem(toUiError(e))
    } finally {
      setBusy(false)
    }
  }

  const full = !replacing && picked.length >= room

  return (
    <div className="sheet-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="sheet add-photos"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-photos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-photos-head">
          <h2 id="add-photos-title">{t(replacing ? 'addPhotos.replaceTitle' : 'addPhotos.title')}</h2>
          {!replacing && (
            <span className="pill">
              {t('addPhotos.count', { count: presentIds.length + picked.length, max: presentIds.length + room })}
            </span>
          )}
        </div>
        <div className="add-photos-sources">
          <span className="add-photos-folder">{t('addPhotos.thisFolder', { name: location.folder.name })}</span>
          <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => void pickElsewhere()}>
            {t('addPhotos.otherFolder')}
          </button>
        </div>

        {photos === null && <p className="muted">{t('gallery.loading')}</p>}
        {photos?.length === 0 && !problem && <p className="muted">{t('gallery.empty')}</p>}
        {photos && photos.length > 0 && (
          <ul className="grid add-photos-grid" aria-label={location.folder.name}>
            {photos.map((p) => {
              const inCollage = present.has(p.id)
              const order = picked.indexOf(p.id)
              const blocked = inCollage || !p.supported || (order === -1 && full)
              return (
                <li key={p.id} className="tile-cell">
                  <button
                    type="button"
                    className={`tile${order !== -1 ? ' selected' : ''}${inCollage ? ' in-collage' : ''}${p.supported ? '' : ' unsupported'}`}
                    aria-pressed={order !== -1}
                    aria-disabled={blocked}
                    title={
                      inCollage
                        ? t('addPhotos.inCollage', { name: p.name })
                        : p.supported
                          ? p.name
                          : t('gallery.unsupported', { type: p.mimeType.replace('image/', '').toUpperCase() })
                    }
                    onClick={() => {
                      if (inCollage || !p.supported) return
                      if (replacing) onAdd([p])
                      else setPicked((v) => togglePick(v, p.id, room))
                    }}
                  >
                    <Thumbnail key={p.id} photo={p} services={services} />
                    {order !== -1 && <span className="badge">{order + 1}</span>}
                    {inCollage && <span className="tile-note">{t('addPhotos.inCollageShort')}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {full && room > 0 && <p className="muted add-photos-hint">{t('addPhotos.full')}</p>}
        {replacing && photos && photos.length > 0 && <p className="muted add-photos-hint">{t('addPhotos.replaceHint')}</p>}
        {!replacing && room === 0 && <p className="muted add-photos-hint">{t('addPhotos.noRoom')}</p>}
        {problem && <ErrorBanner error={problem} />}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('addPhotos.cancel')}
          </button>
          {!replacing && (
            <button type="button" className="btn btn-primary" onClick={addPicked} disabled={busy || picked.length === 0}>
              {picked.length ? t('addPhotos.add', { count: picked.length }) : t('addPhotos.addNone')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
