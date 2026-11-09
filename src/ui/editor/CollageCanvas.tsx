/**
 * Aperçu du collage dans l'éditeur : un Canvas ajusté à la place disponible, avec une couche
 * optionnelle posée exactement dessus pour les gestes et la sélection.
 */
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { renderCollage, type Drawable } from '../../collage/render'
import type { CollageDoc, Layout, Overlay } from '../../collage/types'

/** Propriétés de {@link CollageCanvas}. */
interface Props {
  /** Collage à dessiner. */
  doc: CollageDoc
  /** Disposition des cases. */
  layout: Layout
  /** Proportions du collage (largeur / hauteur). */
  ratio: number
  /** Photo chargée d'une case, ou `undefined` tant qu'elle ne l'est pas (case grisée). */
  imageFor: (cellIndex: number) => Drawable | undefined
  /** Image d'aperçu d'un sticker, si elle est prête. */
  overlayFor?: (o: Overlay) => Drawable | undefined
  /** Accès au Canvas (pipette). */
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>
  /** Change à chaque photo chargée, pour redessiner. */
  version: number
  /** Avant/après : photos sans réglages. */
  raw?: boolean
  /** Couche posée exactement sur l'aperçu (gestes, sélection) ; reçoit sa taille en pixels CSS. */
  overlay?: (size: { width: number; height: number }) => ReactNode
}

/**
 * Aperçu du collage, ajusté à la place disponible et net sur les écrans haute densité.
 *
 * Le cadre est mesuré en pixels CSS ; le bitmap du Canvas est multiplié par `devicePixelRatio`
 * (plafonné à 3 pour limiter la mémoire).
 * @returns le Canvas centré dans son cadre, et la couche `overlay` par-dessus
 */
export function CollageCanvas({ doc, layout, ratio, imageFor, overlayFor, canvasRef: externalRef, version, overlay, raw }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const fit =
    box.width / box.height > ratio
      ? { width: Math.floor(box.height * ratio), height: Math.floor(box.height) }
      : { width: Math.floor(box.width), height: Math.floor(box.width / ratio) }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || fit.width <= 0 || fit.height <= 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    // Ne redimensionne que si besoin : affecter la même taille vide et réalloue le canvas.
    // `reset()` remet le contexte à neuf sans réallouer ; à défaut, on réaffecte la taille.
    const w = Math.round(fit.width * dpr)
    const h = Math.round(fit.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (canvas.width !== w || canvas.height !== h || !('reset' in ctx)) {
      canvas.width = w
      canvas.height = h
    } else ctx.reset()
    renderCollage(ctx, doc, layout, canvas.width, canvas.height, imageFor, { placeholder: '#3a3a44', raw, maskBadge: true }, overlayFor)
    if (externalRef) externalRef.current = canvas
  }, [doc, layout, imageFor, overlayFor, externalRef, version, raw, fit.width, fit.height])

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-frame" style={{ width: fit.width, height: fit.height }}>
        <canvas
          ref={canvasRef}
          className="collage-canvas"
          style={{ width: fit.width, height: fit.height }}
          role="img"
          aria-label={`${doc.photos.length} photo(s), ${layout.id}`}
        />
        {overlay && fit.width > 0 && overlay(fit)}
      </div>
    </div>
  )
}
