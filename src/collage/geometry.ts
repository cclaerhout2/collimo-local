/**
 * Géométrie de base du collage en pixels : zone de dessin, boîtes des cases rectangulaires
 * (écart et marge), taille d'un collage et placement d'une photo dans sa case.
 */
import type { Borders, Crop, Rect } from './types'

/** Écart maximal entre cases, en part du plus petit côté du collage (atteint quand `spacing` vaut 1). */
export const MAX_SPACING = 0.06
/** Marge maximale au bord du collage, en part du plus petit côté (atteinte quand `margin` vaut 1). */
export const MAX_MARGIN = 0.1

/** Boîte d'une case en pixels, avec l'arrondi de ses coins. */
export interface CellBox extends Rect {
  /** Rayon des coins, en pixels. */
  radius: number
}

/**
 * Zone de dessin des cases en pixels, une fois la marge retirée.
 * La zone est réduite de (marge − écart/2) seulement : chaque case retire ensuite écart/2 de chaque côté
 * (voir {@link cellBoxes}), ce qui donne la marge voulue au bord.
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns l'écart entre cases (`gap`), le retrait de la zone sur chaque bord (`outer`) et la taille de la zone (`areaW`, `areaH`), en pixels
 */
export function drawingArea(width: number, height: number, borders: Borders) {
  const unit = Math.min(width, height)
  const gap = borders.spacing * MAX_SPACING * unit
  const margin = borders.margin * MAX_MARGIN * unit
  const outer = margin - gap / 2
  return { gap, outer, areaW: width - 2 * outer, areaH: height - 2 * outer }
}

/**
 * Repère les cases isolées : aucune autre case ne les touche (à 1 % près).
 * L'écart sépare des photos voisines ; une case isolée (photos éparses sur le fond, photo seule) garde
 * la taille relevée sur la capture.
 * @param cells - boîtes des cases, relatives à la zone de dessin (0–1)
 * @returns pour chaque case, `true` si elle est isolée
 */
export function isolatedCells(cells: Rect[]): boolean[] {
  const e = 0.01
  return cells.map((a, i) =>
    cells.every((b, j) => j === i || a.x - e >= b.x + b.w || b.x >= a.x + a.w + e || a.y - e >= b.y + b.h || b.y >= a.y + a.h + e),
  )
}

/**
 * Cases en pixels. L'écart et la marge sont appliqués ainsi : la zone utile est réduite de
 * (marge − écart/2), puis chaque case est réduite de écart/2 de chaque côté. On obtient un écart
 * constant entre cases voisines et la marge voulue au bord, pour les découpes comme pour les
 * rectangles libres.
 * @param cells - boîtes des cases, relatives à la zone de dessin (0–1)
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns la boîte de chaque case en pixels, avec le rayon de ses coins
 */
export function cellBoxes(cells: Rect[], width: number, height: number, borders: Borders): CellBox[] {
  const { gap: g, outer, areaW, areaH } = drawingArea(width, height, borders)
  const iso = isolatedCells(cells)
  return cells.map((c, i) => {
    const gap = iso[i] ? 0 : g
    const x = outer + c.x * areaW + gap / 2
    const y = outer + c.y * areaH + gap / 2
    const w = Math.max(0, c.w * areaW - gap)
    const h = Math.max(0, c.h * areaH - gap)
    return { x, y, w, h, radius: (borders.radius * Math.min(w, h)) / 2 }
  })
}

/**
 * Taille en pixels d'un collage dont le plus grand côté vaut `long`.
 * @param ratio - largeur / hauteur du collage
 * @param long - longueur du plus grand côté, en pixels
 * @returns la largeur et la hauteur, arrondies au pixel
 */
export function sizeForLongSide(ratio: number, long: number): { width: number; height: number } {
  return ratio >= 1
    ? { width: Math.round(long), height: Math.round(long / ratio) }
    : { width: Math.round(long * ratio), height: Math.round(long) }
}

/** Position et échelle d'une image dans sa case, calculées par {@link placeImage}. */
export interface ImagePlacement {
  /** Échelle appliquée à l'image source. */
  scale: number
  /** Décalage horizontal du centre de l'image par rapport au centre de la case, en pixels, avant rotation. */
  dx: number
  /** Décalage vertical du centre de l'image par rapport au centre de la case, en pixels, avant rotation. */
  dy: number
}

/**
 * Place une image dans une case en la couvrant entièrement, même tournée de `crop.angle` degrés :
 * l'image doit couvrir la boîte englobante de la case vue dans le repère de l'image. Le décalage ox/oy
 * se déplace dans la marge restante, sans jamais laisser de vide.
 * @param iw - largeur de l'image, en pixels
 * @param ih - hauteur de l'image, en pixels
 * @param w - largeur de la case, en pixels
 * @param h - hauteur de la case, en pixels
 * @param crop - cadrage de la photo (un zoom inférieur à 1 est ramené à 1)
 * @returns l'échelle de l'image et le décalage de son centre, en pixels
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
