import { useEffect, useRef, useState, type ReactNode } from 'react'
import { renderCollage, type Drawable } from '../../collage/render'
import type { CollageDoc, Layout } from '../../collage/types'

interface Props {
  doc: CollageDoc
  layout: Layout
  ratio: number
  imageFor: (cellIndex: number) => Drawable | undefined
  /** Change à chaque photo chargée, pour redessiner. */
  version: number
  /** Couche posée exactement sur l'aperçu (gestes, sélection). */
  overlay?: (size: { width: number; height: number }) => ReactNode
}

/** Aperçu du collage, ajusté à la place disponible et net sur les écrans haute densité. */
export function CollageCanvas({ doc, layout, ratio, imageFor, version, overlay }: Props) {
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
    canvas.width = Math.round(fit.width * dpr)
    canvas.height = Math.round(fit.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderCollage(ctx, doc, layout, canvas.width, canvas.height, imageFor, { placeholder: '#3a3a44' })
  }, [doc, layout, imageFor, version, fit.width, fit.height])

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
