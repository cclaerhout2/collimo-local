import type { Borders, Crop, Rect } from './types'

/** Écart maximal entre cases et marge maximale, en part du plus petit côté du collage. */
export const MAX_SPACING = 0.06
export const MAX_MARGIN = 0.1

export interface CellBox extends Rect {
  /** Rayon des coins, en pixels. */
  radius: number
}

/**
 * Cases en pixels. L'écart et la marge sont appliqués ainsi : la zone utile est réduite de
 * (marge − écart/2), puis chaque case est réduite de écart/2 de chaque côté. On obtient un écart
 * constant entre cases voisines et la marge voulue au bord, pour les découpes comme pour les
 * rectangles libres.
 */
export function drawingArea(width: number, height: number, borders: Borders) {
  const unit = Math.min(width, height)
  const gap = borders.spacing * MAX_SPACING * unit
  const margin = borders.margin * MAX_MARGIN * unit
  const outer = margin - gap / 2
  return { gap, outer, areaW: width - 2 * outer, areaH: height - 2 * outer }
}

export function cellBoxes(cells: Rect[], width: number, height: number, borders: Borders): CellBox[] {
  const { gap, outer, areaW, areaH } = drawingArea(width, height, borders)
  return cells.map((c) => {
    const x = outer + c.x * areaW + gap / 2
    const y = outer + c.y * areaH + gap / 2
    const w = Math.max(0, c.w * areaW - gap)
    const h = Math.max(0, c.h * areaH - gap)
    return { x, y, w, h, radius: borders.radius * Math.min(w, h) / 2 }
  })
}

/** Taille en pixels (largeur, hauteur) d'un collage de ratio `ratio` dont le plus grand côté vaut `long`. */
export function sizeForLongSide(ratio: number, long: number): { width: number; height: number } {
  return ratio >= 1
    ? { width: Math.round(long), height: Math.round(long / ratio) }
    : { width: Math.round(long * ratio), height: Math.round(long) }
}

export interface ImagePlacement {
  /** Échelle appliquée à l'image source. */
  scale: number
  /** Position du centre de l'image par rapport au centre de la case, en pixels, avant rotation. */
  dx: number
  dy: number
}

/**
 * Place une image de taille (iw, ih) dans une case (w, h) en la couvrant entièrement, même tournée
 * de `crop.angle` degrés : l'image doit couvrir la boîte englobante de la case vue dans le repère de
 * l'image. Le décalage ox/oy se déplace dans la marge restante, sans jamais laisser de vide.
 */
export function placeImage(iw: number, ih: number, w: number, h: number, crop: Crop): ImagePlacement {
  const a = (crop.angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const needW = w * cos + h * sin
  const needH = w * sin + h * cos
  const scale = Math.max(needW / iw, needH / ih) * Math.max(1, crop.zoom)
  const slackX = Math.max(0, iw * scale - needW) / 2
  const slackY = Math.max(0, ih * scale - needH) / 2
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  return { scale, dx: clamp(crop.ox) * slackX, dy: clamp(crop.oy) * slackY }
}
