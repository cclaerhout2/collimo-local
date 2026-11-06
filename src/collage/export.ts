import { cellBoxes, sizeForLongSide } from './geometry'
import { drawOverlay, overlayBox } from './overlays'
import { isIdentity, paramsForPhoto, vignetteFor } from './color'
import { processPhoto } from './colorProcessor'
import { drawPhotoInCell, drawVignette, renderCollage, type Drawable } from './render'
import type { CollageDoc, Layout, Overlay, TextOverlay } from './types'

export type ExportFormat = 'jpeg' | 'png'
export type ExportPreset = 'standard' | 'hd' | 'max'

export const STANDARD_SIDE = 2048
export const HD_SIDE = 5000
/** iPhone et iPad limitent la taille d'image du navigateur (environ 16 millions de pixels). */
export const IOS_MAX_SIDE = 4000
/** Plafond de sécurité du préréglage « Maximum » sur ordinateur et Android. */
export const DESKTOP_MAX_SIDE = 8000
export const DEFAULT_JPEG_QUALITY = 90

export function isAppleMobile(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)
}

/**
 * Plus grand côté nécessaire pour que chaque photo soit affichée sans agrandissement :
 * pour chaque case, la taille qui place la photo à l'échelle 1, puis la plus grande de ces tailles.
 */
export function nativeLongSide(doc: CollageDoc, layout: Layout, ratio: number): number | null {
  const rw = ratio >= 1 ? 1 : ratio
  const rh = ratio >= 1 ? 1 / ratio : 1
  let best: number | null = null
  layout.cells.forEach((cell, i) => {
    const p = doc.photos[i]
    if (!p?.width || !p.height) return
    const need = Math.max((cell.w * rw) / p.width, (cell.h * rh) / p.height) * Math.max(1, p.crop.zoom)
    const side = 1 / need
    best = best === null ? side : Math.max(best, side)
  })
  return best
}

export interface ExportSize {
  width: number
  height: number
  /** Taille réduite à cause de la limite iPhone/iPad. */
  cappedForIos: boolean
}

export function exportSize(preset: ExportPreset, ratio: number, doc: CollageDoc, layout: Layout, appleMobile: boolean): ExportSize {
  const cap = appleMobile ? IOS_MAX_SIDE : DESKTOP_MAX_SIDE
  let wanted: number
  if (preset === 'standard') wanted = STANDARD_SIDE
  else if (preset === 'hd') wanted = HD_SIDE
  else wanted = Math.round(nativeLongSide(doc, layout, ratio) ?? HD_SIDE)
  wanted = Math.max(STANDARD_SIDE, wanted)
  const long = Math.min(wanted, cap)
  return { ...sizeForLongSide(ratio, long), cappedForIos: appleMobile && wanted > IOS_MAX_SIDE }
}

export interface ExportImage extends Drawable {
  close(): void
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export impossible'))), type, quality),
  )
}

/**
 * Redessine le collage hors écran à la taille finale. Les photos sont chargées une par une
 * (`loadForCell` reçoit le plus grand côté utile) et libérées aussitôt dessinées.
 */
export async function exportCollage(args: {
  doc: CollageDoc
  layout: Layout
  width: number
  height: number
  format: ExportFormat
  /** Qualité JPEG de 1 à 100. */
  quality: number
  loadForCell: (cellIndex: number, maxSide: number) => Promise<ExportImage>
  /** Icône ou image d'un élément, décodée au plus grand côté utile. */
  loadOverlay?: (o: Exclude<Overlay, TextOverlay>, maxSide: number) => Promise<ExportImage>
  /** Attendre que la police d'un texte soit chargée. */
  prepareText?: (o: TextOverlay) => Promise<void>
  onProgress?: (done: number, total: number) => void
}): Promise<Blob> {
  const { doc, layout, width, height } = args
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('export impossible : pas de contexte de dessin')
  renderCollage(ctx, doc, layout, width, height, () => undefined)
  const boxes = cellBoxes(layout.cells, width, height, doc.borders)
  const photoCount = Math.min(boxes.length, doc.photos.length)
  const overlays = doc.overlays ?? []
  const total = photoCount + overlays.length
  for (let i = 0; i < photoCount; i++) {
    const photo = doc.photos[i]
    const box = boxes[i]
    // Marge pour le zoom et la rotation : √2 couvre une rotation quelconque.
    const maxSide = Math.ceil(Math.max(box.w, box.h) * Math.max(1, photo.crop.zoom) * Math.SQRT2)
    const img = await args.loadForCell(i, maxSide)
    try {
      ctx.imageSmoothingQuality = 'high'
      // Réglages et filtre à la résolution d'export, avec le même moteur que l'aperçu.
      const params = paramsForPhoto(doc, i)
      if (isIdentity(params)) drawPhotoInCell(ctx, img, box, photo.crop)
      else {
        const done = processPhoto(img.source as CanvasImageSource & TexImageSource, img.width, img.height, params)
        try {
          drawPhotoInCell(ctx, done, box, photo.crop)
        } finally {
          done.close()
        }
      }
      drawVignette(ctx, box, vignetteFor(doc, i))
    } finally {
      img.close()
    }
    args.onProgress?.(i + 1, total)
  }
  // Textes et stickers par-dessus, dans leur ordre, en pleine résolution.
  for (let k = 0; k < overlays.length; k++) {
    const o = overlays[k]
    if (o.type === 'text') {
      await args.prepareText?.(o)
      drawOverlay(ctx, o, width, height)
    } else if (args.loadOverlay) {
      const box = overlayBox(o, width, height)
      const img = await args.loadOverlay(o, Math.max(box.w, box.h))
      try {
        drawOverlay(ctx, o, width, height, img)
      } finally {
        img.close()
      }
    }
    args.onProgress?.(photoCount + k + 1, total)
  }
  const type = args.format === 'png' ? 'image/png' : 'image/jpeg'
  return toBlob(canvas, type, args.format === 'jpeg' ? args.quality / 100 : undefined)
}
