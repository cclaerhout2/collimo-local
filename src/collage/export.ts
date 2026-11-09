/**
 * Export d'un collage en fichier image : choix de la taille selon le préréglage et l'appareil,
 * puis dessin hors écran en pleine résolution, photo par photo pour limiter la mémoire.
 */
import { cellGeometry } from './cells'
import { sizeForLongSide } from './geometry'
import { drawOverlay, overlayBox } from './overlays'
import { isIdentity, paramsForPhoto, vignetteFor } from './color'
import { processPhoto } from './colorProcessor'
import { applyMasks } from './masks'
import { cellStyle, drawDecor, drawPhotoInCell, drawVignette, finishCell, underCell, type Drawable } from './render'
import type { CollageDoc, Layout, Overlay, PlacedPhoto, TextOverlay } from './types'

/** Format du fichier exporté. */
export type ExportFormat = 'jpeg' | 'png'
/** Préréglage de taille d'export : standard, haute définition, ou taille native des photos. */
export type ExportPreset = 'standard' | 'hd' | 'max'

/** Plus grand côté de l'export standard, en pixels ; c'est aussi le minimum de tous les préréglages. */
export const STANDARD_SIDE = 2048
/** Plus grand côté de l'export haute définition, en pixels (et du préréglage « Maximum » si les tailles des photos sont inconnues). */
export const HD_SIDE = 5000
/** iPhone et iPad limitent la taille d'image du navigateur (environ 16 millions de pixels). */
export const IOS_MAX_SIDE = 4000
/** Plafond de sécurité du préréglage « Maximum » sur ordinateur et Android. */
export const DESKTOP_MAX_SIDE = 8000
/** Qualité JPEG par défaut, de 1 à 100. */
export const DEFAULT_JPEG_QUALITY = 90

/**
 * Indique si l'appareil est un iPhone, iPod ou iPad (y compris les iPad qui se présentent comme un Mac).
 * @param ua - chaîne d'identification du navigateur
 * @param platform - plateforme annoncée par le navigateur
 * @param touchPoints - nombre de points de contact tactile pris en charge
 * @returns `true` sur iPhone, iPod et iPad
 */
export function isAppleMobile(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)
}

/**
 * Plus grand côté nécessaire pour que chaque photo soit affichée sans agrandissement :
 * pour chaque case, la taille qui place la photo à l'échelle 1, puis la plus grande de ces tailles.
 * La rotation n'est pas prise en compte.
 * @param doc - collage
 * @param layout - disposition
 * @param ratio - largeur / hauteur du collage
 * @returns le plus grand côté en pixels, ou `null` si aucune photo n'a de dimensions connues
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

/**
 * Plus grand côté de la source nécessaire pour dessiner la photo dans une case sans
 * agrandissement, au zoom et à l'angle du cadrage. Sans dimensions connues, √2 couvre toute rotation.
 * @param w - largeur de la case, en pixels
 * @param h - hauteur de la case, en pixels
 * @param photo - dimensions d'origine et cadrage de la photo
 * @returns le plus grand côté utile de la photo décodée, en pixels (arrondi au-dessus)
 */
export function sourceLongSide(w: number, h: number, photo: Pick<PlacedPhoto, 'width' | 'height' | 'crop'>): number {
  const zoom = Math.max(1, photo.crop.zoom)
  if (!photo.width || !photo.height) return Math.ceil(Math.max(w, h) * zoom * Math.SQRT2)
  const a = (photo.crop.angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const needW = w * cos + h * sin
  const needH = w * sin + h * cos
  const scale = Math.max(needW / photo.width, needH / photo.height) * zoom
  return Math.ceil(Math.max(photo.width, photo.height) * scale)
}

/** Taille de l'image exportée, en pixels. */
export interface ExportSize {
  width: number
  height: number
  /** Taille réduite à cause de la limite iPhone/iPad. */
  cappedForIos: boolean
}

/**
 * Taille de l'image exportée pour un préréglage, plafonnée selon l'appareil.
 * @param preset - préréglage choisi
 * @param ratio - largeur / hauteur du collage
 * @param doc - collage (pour la taille native des photos, préréglage « Maximum »)
 * @param layout - disposition
 * @param appleMobile - `true` sur iPhone ou iPad, dont le navigateur limite la taille des images
 * @returns largeur et hauteur en pixels, et si la taille a été réduite à cause de la limite iPhone/iPad
 */
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

/** Image chargée pour l'export, à libérer après usage. */
export interface ExportImage extends Drawable {
  /** Libère la mémoire de l'image, dès qu'elle est dessinée. */
  close(): void
}

/** Canvas hors écran si le navigateur le permet, sinon élément `<canvas>`. */
type AnyCanvas = OffscreenCanvas | HTMLCanvasElement

/**
 * Crée un canvas de la taille donnée, hors écran si possible.
 * @param width - largeur, en pixels
 * @param height - hauteur, en pixels
 * @returns le canvas
 */
function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

/**
 * Encode le contenu d'un canvas en fichier image.
 * @param canvas - canvas à encoder
 * @param type - type MIME de l'image
 * @param quality - qualité de 0 à 1 (JPEG seulement)
 * @returns le fichier encodé
 * @throws Error si le navigateur n'a pas pu encoder l'image
 */
function toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export impossible'))), type, quality))
}

/**
 * Redessine le collage hors écran à la taille finale et l'encode.
 * Les photos sont chargées une par une (`loadForCell` reçoit le plus grand côté utile) et libérées
 * aussitôt dessinées, pour tenir dans la mémoire des téléphones.
 * @param args - collage, disposition, taille en pixels, format, qualité, et fonctions de chargement
 * @returns le fichier image
 * @throws Error si le navigateur ne fournit pas de contexte de dessin ou n'arrive pas à encoder l'image
 */
export async function exportCollage(args: {
  doc: CollageDoc
  layout: Layout
  /** Largeur de l'image exportée, en pixels. */
  width: number
  /** Hauteur de l'image exportée, en pixels. */
  height: number
  format: ExportFormat
  /** Qualité JPEG de 1 à 100. */
  quality: number
  /** Photo de la case d'indice donné, décodée au plus grand côté utile (`maxSide`, en pixels). */
  loadForCell: (cellIndex: number, maxSide: number) => Promise<ExportImage>
  /** Icône ou image d'un élément, décodée au plus grand côté utile. */
  loadOverlay?: (o: Exclude<Overlay, TextOverlay>, maxSide: number) => Promise<ExportImage>
  /** Attendre que la police d'un texte soit chargée. */
  prepareText?: (o: TextOverlay) => Promise<void>
  /** Avancement : nombre d'éléments dessinés sur le total (photos puis textes et stickers). */
  onProgress?: (done: number, total: number) => void
}): Promise<Blob> {
  const { doc, layout, width, height } = args
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('export impossible : pas de contexte de dessin')
  // Même ordre que l'aperçu : fond, chaque case (photo, vignettage, finition), décor, textes et stickers.
  ctx.fillStyle = doc.background
  ctx.fillRect(0, 0, width, height)
  const cells = cellGeometry(layout, width, height, doc.borders)
  const style = cellStyle(doc, width, height)
  const photoCount = Math.min(cells.length, doc.photos.length)
  const overlays = doc.overlays ?? []
  const total = photoCount + overlays.length
  for (let i = 0; i < photoCount; i++) {
    const photo = doc.photos[i]
    const cell = cells[i]
    const box = cell.box
    const img = await args.loadForCell(i, sourceLongSide(box.w, box.h, photo))
    underCell(ctx, cell, style)
    try {
      ctx.imageSmoothingQuality = 'high'
      // Réglages et filtre à la résolution d'export, avec le même moteur que l'aperçu, puis zones masquées.
      const params = paramsForPhoto(doc, i)
      const colored = isIdentity(params)
        ? null
        : processPhoto(img.source as CanvasImageSource & TexImageSource, img.width, img.height, params)
      const hidden = photo.masks?.length ? applyMasks(colored ?? img, photo.masks) : null
      try {
        drawPhotoInCell(ctx, hidden ?? colored ?? img, cell, photo.crop)
      } finally {
        hidden?.close()
        colored?.close()
      }
      drawVignette(ctx, cell, vignetteFor(doc, i))
      finishCell(ctx, cell, style)
    } finally {
      img.close()
    }
    args.onProgress?.(i + 1, total)
  }
  drawDecor(ctx, doc, layout, width, height)
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
