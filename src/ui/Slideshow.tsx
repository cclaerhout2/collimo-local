/**
 * Diaporama plein écran des photos du dossier ouvert : chaque photo en grand, pour la regarder de
 * près (arrière-plan compris) et l'ajouter à la sélection ou l'en retirer. Navigation par flèches,
 * clavier (← →, Espace, Échap), glissement du doigt ou bande de miniatures.
 */
import { useEffect, useRef, useState } from 'react'
import { sizedThumbnail } from '../google/drive'
import type { Photo, Services } from '../google/types'
import { MAX_PHOTOS } from '../config'
import { useI18n } from '../i18n'
import { Thumbnail } from './Thumbnail'

/** Plus grand côté demandé à Drive pour la grande vue, en pixels. */
const LARGE_SIZE = 1600

/** Déplacement horizontal minimal d'un glissement de doigt pour changer de photo, en pixels. */
const SWIPE_MIN = 50

/** Propriétés du diaporama. */
interface Props {
  /** Services Google (miniatures Drive). */
  services: Services
  /** Photos du dossier, dans l'ordre de la galerie. */
  photos: Photo[]
  /** Position de la photo affichée à l'ouverture. */
  startIndex: number
  /** Identifiants des photos sélectionnées, dans l'ordre de sélection. */
  selection: string[]
  /** Nombre maximal de photos sélectionnées à la fois. */
  max: number
  /** La limite vient d'être atteinte : le compteur l'indique. */
  limitHint: boolean
  /** Le dossier accepte-t-il un collage (droit d'écriture) ? */
  canCreate: boolean
  /** Ajoute la photo à la sélection ou l'en retire. */
  onToggle: (photo: Photo) => void
  /** Crée un collage avec la sélection. */
  onCreate: () => void
  /** Ferme le diaporama. */
  onClose: () => void
}

/**
 * Overlay du diaporama.
 * @returns l'overlay
 */
export function Slideshow({ services, photos, startIndex, selection, max, limitHint, canCreate, onToggle, onCreate, onClose }: Props) {
  const { t } = useI18n()
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), photos.length - 1))
  const photo = photos[index]
  const order = photo ? selection.indexOf(photo.id) : -1
  const closeRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLOListElement>(null)
  const swipeStart = useRef<number | null>(null)

  /**
   * Passe à une autre photo, en restant dans la liste.
   * @param i - position voulue
   */
  function go(i: number) {
    setIndex(Math.min(Math.max(i, 0), photos.length - 1))
  }

  // Focus sur « Fermer » à l'ouverture, page figée derrière, focus rendu à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.body.classList.add('no-scroll')
    return () => {
      document.body.classList.remove('no-scroll')
      previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    /**
     * Raccourcis clavier : ← → pour naviguer, Espace pour sélectionner, Échap pour fermer.
     * @param e - touche pressée
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, photos.length - 1))
      else if (e.key === ' ' && photo) onToggle(photo)
      else return
      // Espace ne doit pas aussi « cliquer » le bouton qui a le focus (Entrée reste disponible pour ça).
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photo, photos.length, onToggle, onClose])

  // Miniature de la photo affichée centrée dans la bande.
  useEffect(() => {
    const item = stripRef.current?.children[index] as HTMLElement | undefined
    item?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [index])

  // Précharge les photos voisines pour un passage sans attente.
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) {
      const src = p?.supported ? sizedThumbnail(p.thumbnailUrl, LARGE_SIZE) : undefined
      if (src) new Image().src = src
    }
  }, [index, photos])

  if (!photo) return null

  return (
    <div className="slideshow" role="dialog" aria-modal="true" aria-label={t('slideshow.title')}>
      <div className="slideshow-top">
        <span className="slideshow-position">
          {t('slideshow.position', { index: index + 1, total: photos.length })}
          <span className="slideshow-name">{photo.name}</span>
        </span>
        <span className="slideshow-hint">{t('slideshow.hint')}</span>
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

      <div
        className="slideshow-stage"
        onPointerDown={(e) => {
          swipeStart.current = e.clientX
        }}
        onPointerUp={(e) => {
          const start = swipeStart.current
          swipeStart.current = null
          if (start === null) return
          const dx = e.clientX - start
          if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? index + 1 : index - 1)
        }}
      >
        <button
          type="button"
          className="slideshow-nav prev"
          aria-label={t('slideshow.prev')}
          title={t('slideshow.prev')}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ‹
        </button>
        <figure className="slideshow-figure">
          <Thumbnail key={photo.id} photo={photo} services={services} size={LARGE_SIZE} className="slideshow-img" eager />
          {order !== -1 && <span className="badge slideshow-badge">{order + 1}</span>}
        </figure>
        <button
          type="button"
          className="slideshow-nav next"
          aria-label={t('slideshow.next')}
          title={t('slideshow.next')}
          disabled={index === photos.length - 1}
          onClick={() => go(index + 1)}
        >
          ›
        </button>
      </div>

      <div className="slideshow-bar">
        <button
          type="button"
          className={`btn slideshow-select${order !== -1 ? ' selected' : ''}`}
          aria-pressed={order !== -1}
          disabled={!photo.supported}
          onClick={() => onToggle(photo)}
        >
          {!photo.supported
            ? t('gallery.unsupported', { type: photo.mimeType.replace('image/', '').toUpperCase() })
            : order !== -1
              ? `✓ ${t('slideshow.selected', { order: order + 1 })}`
              : `+ ${t('slideshow.select')}`}
        </button>
        <span className="selection-count">
          {limitHint ? t('gallery.maxSelection', { max }) : t('gallery.selectedCount', { count: selection.length })}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!selection.length || !canCreate}
          title={canCreate ? undefined : t('gallery.readOnly')}
          onClick={onCreate}
        >
          {selection.length > MAX_PHOTOS ? t('gallery.split') : t('gallery.create')}
        </button>
      </div>

      <ol className="slideshow-strip" ref={stripRef}>
        {photos.map((p, i) => {
          const n = selection.indexOf(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`slideshow-thumb${i === index ? ' current' : ''}${n !== -1 ? ' selected' : ''}${p.supported ? '' : ' unsupported'}`}
                aria-label={p.name}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <Thumbnail key={p.id} photo={p} services={services} />
                {n !== -1 && <span className="badge">{n + 1}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
