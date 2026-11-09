/**
 * Répartition de la sélection en plusieurs collages : les photos à placer en haut, une carte par
 * collage en dessous. On glisse une photo vers une carte (souris), ou on la touche puis on touche
 * la carte (écran tactile). Répartition automatique, ajout et retrait de collages, puis création.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { MAX_PHOTOS, MIN_PHOTOS } from '../config'
import type { Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { autoSplit, groupsNeeded, movePhoto, splitBySize, splitIssues, unplaced, type Groups } from '../lib/split'
import { Thumbnail } from './Thumbnail'
import { FolderIcon } from './icons'

/** Propriétés de l'écran de répartition. */
interface Props {
  /** Services Google (miniatures). */
  services: Services
  /** Photos sélectionnées, dans l'ordre de sélection. */
  photos: Photo[]
  /** Revient à la galerie. */
  onCancel: () => void
  /** Crée les collages, un par groupe non vide, dans l'ordre. */
  onCreate: (groups: Photo[][]) => void
}

/**
 * Écran de répartition.
 * @returns l'écran
 */
export function SplitScreen({ services, photos, onCancel, onCreate }: Props) {
  const { t } = useI18n()
  const ids = photos.map((p) => p.id)
  const byId = new Map(photos.map((p) => [p.id, p]))
  // Au départ : le nombre de collages imposé par le maximum, et au moins deux puisqu'on vient répartir.
  const [groups, setGroups] = useState<Groups>(() =>
    autoSplit(ids, Math.max(ids.length >= MIN_PHOTOS * 2 ? 2 : 1, groupsNeeded(ids.length, MAX_PHOTOS))),
  )
  const [perGroup, setPerGroup] = useState(() => Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, Math.ceil(ids.length / groups.length))))
  /** Photo touchée, en attente d'une carte de destination (écran tactile ou clavier). */
  const [picked, setPicked] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  /** Photo affichée en grand, ou `null`. */
  const [viewing, setViewing] = useState<string | null>(null)

  const left = unplaced(ids, groups)
  const issues = splitIssues(ids, groups, MIN_PHOTOS, MAX_PHOTOS)
  const nonEmpty = groups.filter((g) => g.length > 0)
  const canCreate = issues.length === 0 && nonEmpty.length > 0

  /**
   * Place une photo dans un groupe (ou la remet à placer).
   * @param id - photo
   * @param to - groupe de destination, ou -1
   */
  function place(id: string, to: number) {
    setGroups((g) => movePhoto(g, id, to))
    setPicked(null)
  }

  /**
   * Touche sur une photo : la choisit, ou la relâche si c'était elle.
   * @param id - photo
   */
  function tap(id: string) {
    setPicked((cur) => (cur === id ? null : id))
  }

  /**
   * Touche sur une carte : y place la photo choisie, s'il y en a une.
   * @param to - groupe
   */
  function tapGroup(to: number) {
    if (picked) place(picked, to)
  }

  /**
   * Dépose une photo glissée sur un groupe.
   * @param e - événement de dépôt
   * @param to - groupe de destination, ou -1
   */
  function drop(e: DragEvent, to: number) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOver(null)
    if (id && byId.has(id)) place(id, to)
  }

  /**
   * Vignette déplaçable d'une photo.
   * @param id - photo
   * @returns la vignette
   */
  function tile(id: string) {
    const p = byId.get(id)
    if (!p) return null
    const isPicked = picked === id
    return (
      <li key={id} className="split-cell">
        <button
          type="button"
          className={`split-photo${isPicked ? ' picked' : ''}`}
          draggable
          aria-pressed={isPicked}
          aria-label={p.name}
          title={isPicked ? t('split.pickedHint') : p.name}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', id)
            e.dataTransfer.effectAllowed = 'move'
            setPicked(null)
          }}
          onClick={() => tap(id)}
          onDoubleClick={() => setViewing(id)}
        >
          <Thumbnail key={id} photo={p} services={services} />
        </button>
        <button
          type="button"
          className="tile-zoom split-zoom"
          aria-label={t('gallery.zoom', { name: p.name })}
          title={t('gallery.zoom', { name: p.name })}
          onClick={() => setViewing(id)}
        >
          <ZoomIcon />
        </button>
      </li>
    )
  }

  /**
   * Zone de dépôt (carte de collage ou bande « à placer »).
   * @param to - groupe, ou -1
   * @returns les attributs de dépôt
   */
  const dropProps = (to: number) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOver !== to) setDragOver(to)
    },
    onDragLeave: () => setDragOver((d) => (d === to ? null : d)),
    onDrop: (e: DragEvent) => drop(e, to),
  })

  return (
    <main className="screen split-screen">
      <div className="split-head">
        <div>
          <h1>{t('split.title', { count: ids.length })}</h1>
          <p className="muted">{t('split.hint')}</p>
        </div>
        <div className="split-tools">
          <label className="split-auto">
            <span>{t('split.perGroup')}</span>
            <input
              type="number"
              min={MIN_PHOTOS}
              max={MAX_PHOTOS}
              value={perGroup}
              onChange={(e) => setPerGroup(Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, Number(e.target.value) || MIN_PHOTOS)))}
            />
            <button type="button" className="btn btn-small" onClick={() => setGroups(splitBySize(ids, perGroup))}>
              {t('split.auto')}
            </button>
          </label>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setGroups((g) => [...g, []])}>
            + {t('split.newGroup')}
          </button>
        </div>
      </div>

      <section
        className={`split-pool${dragOver === -1 ? ' drag-over' : ''}${picked && groups.some((g) => g.includes(picked)) ? ' target' : ''}`}
        {...dropProps(-1)}
      >
        <h2>
          {t('split.pool')} <span className="muted">{t('split.count', { count: left.length })}</span>
          {picked && groups.some((g) => g.includes(picked)) && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => place(picked, -1)}>
              {t('split.placeHere')}
            </button>
          )}
        </h2>
        {left.length === 0 ? <p className="muted">{t('split.poolEmpty')}</p> : <ul className="split-grid">{left.map((id) => tile(id))}</ul>}
      </section>

      <div className="split-groups">
        {groups.map((g, i) => {
          const tooFew = g.length > 0 && g.length < MIN_PHOTOS
          const tooMany = g.length > MAX_PHOTOS
          return (
            <section
              key={i}
              className={`split-group${dragOver === i ? ' drag-over' : ''}${picked && !g.includes(picked) ? ' target' : ''}`}
              {...dropProps(i)}
              onClick={(e) => {
                if (picked && !(e.target as Element).closest('.split-photo, .split-remove')) tapGroup(i)
              }}
            >
              <h2>
                {t('split.group', { n: i + 1 })}
                <span className={`split-size${tooFew || tooMany ? ' bad' : ''}`}>
                  {t('split.count', { count: g.length })}
                  {tooFew && ` · ${t('split.min', { min: MIN_PHOTOS })}`}
                  {tooMany && ` · ${t('split.max', { max: MAX_PHOTOS })}`}
                </span>
                {picked && !g.includes(picked) && (
                  <button type="button" className="btn btn-small btn-primary split-place" onClick={() => tapGroup(i)}>
                    {t('split.placeHere')}
                  </button>
                )}
                {groups.length > 1 && (
                  <button
                    type="button"
                    className="split-remove"
                    aria-label={t('split.removeGroup', { n: i + 1 })}
                    title={t('split.removeGroup', { n: i + 1 })}
                    onClick={() => setGroups((gs) => gs.filter((_, k) => k !== i))}
                  >
                    ×
                  </button>
                )}
              </h2>
              {g.length === 0 ? (
                <p className="muted split-empty">{t('split.groupEmpty')}</p>
              ) : (
                <ul className="split-grid">{g.map((id) => tile(id))}</ul>
              )}
            </section>
          )
        })}
      </div>

      {viewing && byId.has(viewing) && (
        <SplitLightbox
          services={services}
          photos={photos}
          id={viewing}
          groups={groups}
          onChange={setViewing}
          onPlace={(to) => place(viewing, to)}
          onClose={() => setViewing(null)}
        />
      )}

      <div className="split-bar">
        <span className="split-status">
          {issues.length === 0
            ? t('split.ready', { count: nonEmpty.length })
            : issues
                .map((it) =>
                  it.kind === 'unplaced'
                    ? t('split.issueUnplaced', { count: it.count })
                    : it.kind === 'tooFew'
                      ? t('split.issueTooFew', { n: it.group + 1, min: it.min })
                      : t('split.issueTooMany', { n: it.group + 1, max: it.max }),
                )
                .join(' · ')}
        </span>
        <div className="split-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('split.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canCreate}
            onClick={() => onCreate(nonEmpty.map((g) => g.map((id) => byId.get(id)!).filter(Boolean)))}
          >
            {nonEmpty.length === 1 ? t('split.createOne') : t('split.create', { count: nonEmpty.length })}
          </button>
        </div>
      </div>
    </main>
  )
}

/** Propriétés de la grande vue d'une photo à répartir. */
interface LightboxProps {
  services: Services
  /** Toutes les photos, dans l'ordre de sélection (pour ← →). */
  photos: Photo[]
  /** Photo affichée. */
  id: string
  /** Groupes actuels, pour indiquer où est la photo et proposer les destinations. */
  groups: Groups
  /** Change de photo. */
  onChange: (id: string) => void
  /** Place la photo affichée dans un groupe (ou -1 : à placer). */
  onPlace: (to: number) => void
  /** Ferme la vue. */
  onClose: () => void
}

/**
 * Photo en grand, avec sa place actuelle et un bouton par collage pour l'y envoyer ; ← → pour
 * passer aux photos voisines, Échap pour fermer, 1 à 9 pour placer dans le collage correspondant.
 * @returns l'overlay
 */
function SplitLightbox({ services, photos, id, groups, onChange, onPlace, onClose }: LightboxProps) {
  const { t } = useI18n()
  const index = photos.findIndex((p) => p.id === id)
  const photo = photos[index]
  const where = groups.findIndex((g) => g.includes(id))
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [])

  useEffect(() => {
    /**
     * Raccourcis : ← → photo voisine, Échap fermer, chiffre = placer dans ce collage, 0 = à placer.
     * @param e - touche pressée
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onChange(photos[index - 1].id)
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onChange(photos[index + 1].id)
      else if (/^[0-9]$/.test(e.key)) {
        const n = Number(e.key)
        if (n === 0) onPlace(-1)
        else if (n <= groups.length) onPlace(n - 1)
        else return
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos, groups.length, onChange, onPlace, onClose])

  if (!photo) return null
  return (
    <div className="slideshow split-lightbox" role="dialog" aria-modal="true" aria-label={photo.name}>
      <div className="slideshow-top">
        <span className="slideshow-position">
          {t('slideshow.position', { index: index + 1, total: photos.length })}
          <span className="slideshow-name">{photo.name}</span>
        </span>
        <span className="slideshow-hint">{t('split.lightboxHint')}</span>
        <button
          ref={closeRef}
          type="button"
          className="slideshow-close"
          aria-label={t('slideshow.close')}
          title={t('slideshow.close')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="slideshow-stage">
        <button
          type="button"
          className="slideshow-nav prev"
          aria-label={t('slideshow.prev')}
          disabled={index === 0}
          onClick={() => onChange(photos[index - 1].id)}
        >
          ‹
        </button>
        <figure className="slideshow-figure">
          <Thumbnail key={photo.id} photo={photo} services={services} size={1600} className="slideshow-img" eager />
        </figure>
        <button
          type="button"
          className="slideshow-nav next"
          aria-label={t('slideshow.next')}
          disabled={index === photos.length - 1}
          onClick={() => onChange(photos[index + 1].id)}
        >
          ›
        </button>
      </div>
      <div className="slideshow-bar split-lightbox-bar">
        <span className="split-where">{where === -1 ? t('split.whereUnplaced') : t('split.whereGroup', { n: where + 1 })}</span>
        <span className="split-targets" role="group" aria-label={t('split.moveTo')}>
          <button
            type="button"
            className={`btn btn-small${where === -1 ? ' active' : ''}`}
            disabled={where === -1}
            onClick={() => onPlace(-1)}
          >
            {t('split.pool')}
          </button>
          {groups.map((g, i) => (
            <button
              key={i}
              type="button"
              className={`btn btn-small${where === i ? ' active' : ''}`}
              disabled={where === i}
              onClick={() => onPlace(i)}
            >
              <FolderIcon size={15} /> {t('split.group', { n: i + 1 })} <span className="muted">({g.length})</span>
            </button>
          ))}
        </span>
      </div>
    </div>
  )
}

/**
 * Icône de loupe des vignettes.
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
