/**
 * Géométrie des cases en pixels, pour toutes les sortes de cases : rectangles (écart appliqué en
 * réduisant la case), polygones, chemins et formes (écart obtenu en traçant leur contour de la couleur
 * du fond, ce qui marche aussi entre deux formes imbriquées).
 */
import { cellBoxes, drawingArea, MAX_SPACING, type CellBox } from './geometry'
import { mapPath, parsePath, pathBBox, polyPath, serializePath, type Pt, type Seg } from './path'
import { SHAPES, type CellDef } from './shapes'
import type { Borders, Layout, Rect } from './types'

export interface CellGeom {
  /** Boîte de la photo : elle la couvre entièrement. */
  box: CellBox
  /** Contour en pixels (absent pour une case rectangulaire). */
  path?: string
  evenodd?: boolean
  /**
   * Forme de la bibliothèque : l'écart est obtenu en la réduisant (pas de contour tracé, qui
   * ferait apparaître les traits intérieurs des formes composées), et le contour optionnel
   * est un aplat dessiné derrière (`under`).
   */
  shaped?: boolean
  under?: string
}

/** Épaisseur maximale du contour optionnel, en part du plus petit côté. */
export const MAX_OUTLINE = 0.02

const parsed = new Map<string, Seg[]>()
function segs(d: string): Seg[] {
  let s = parsed.get(d)
  if (!s) {
    s = parsePath(d)
    parsed.set(d, s)
  }
  return s
}

/** Chemin d'une case en forme, en coordonnées du cadre (0–1), à partir d'un cadre de rapport `aspect`. */
export function cellPathFrame(c: CellDef, aspect: number, scale = 1): { segs: Seg[]; evenodd?: boolean } | null {
  if (c.kind === 'rect') return null
  if (c.kind === 'poly') return { segs: segs(polyPath(c.points)) }
  if (c.kind === 'path') return { segs: segs(c.d), evenodd: c.evenodd }
  // Forme : carré unité posé dans le rectangle, proportions gardées en pixels (sauf stretch).
  let w = c.w
  let h = c.h
  if (!c.stretch) {
    const pw = c.w * aspect
    const side = Math.min(pw, c.h)
    w = side / aspect
    h = side
  }
  w *= scale
  h *= scale
  const x = c.x + (c.w - w) / 2
  const y = c.y + (c.h - h) / 2
  const a = ((c.rotate ?? 0) * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const fn = ([u, v]: Pt): Pt => {
    // Rotation autour du centre, dans un repère aux proportions réelles.
    const px = (u - 0.5) * w * aspect
    const py = (v - 0.5) * h
    return [x + w / 2 + (px * cos - py * sin) / aspect, y + h / 2 + px * sin + py * cos]
  }
  return { segs: mapPath(segs(SHAPES[c.shape]), fn) }
}

export function defBBox(c: CellDef): Rect {
  if (c.kind === 'rect' || c.kind === 'shape') return { x: c.x, y: c.y, w: c.w, h: c.h }
  return pathBBox(cellPathFrame(c, 1)!.segs)
}

/** Cases d'une disposition en pixels, pour un collage de taille (width, height). */
export function cellGeometry(layout: Layout, width: number, height: number, borders: Borders): CellGeom[] {
  if (!layout.geo) return cellBoxes(layout.cells, width, height, borders).map((box) => ({ box }))
  const { outer, areaW, areaH } = drawingArea(width, height, borders)
  const aspect = areaW / Math.max(1, areaH)
  const rectBoxes = cellBoxes(layout.cells, width, height, borders)
  const gap = gapPx(width, height, borders)
  const outline = outlinePx(width, height, borders)
  const toPx = (segs: Seg[]) => mapPath(segs, ([x, y]) => [outer + x * areaW, outer + y * areaH])
  return layout.geo.map((c, i) => {
    if (c.kind === 'rect') return { box: rectBoxes[i] }
    if (c.kind === 'shape') {
      // Taille de la forme en pixels (plus petit côté), pour retirer l'écart et ajouter le contour.
      const side = Math.max(1, Math.min(c.w * areaW, c.h * areaH))
      const inner = Math.max(0.05, 1 - gap / side)
      const px = toPx(cellPathFrame(c, aspect, inner)!.segs)
      const under = outline > 0 ? serializePath(toPx(cellPathFrame(c, aspect, inner + (2 * outline) / side)!.segs)) : undefined
      return { box: { ...pathBBox(px), radius: 0 }, path: serializePath(px), shaped: true, under }
    }
    const fp = cellPathFrame(c, aspect)!
    const px = toPx(fp.segs)
    const bb = pathBBox(px)
    return { box: { ...bb, radius: 0 }, path: serializePath(px), evenodd: fp.evenodd }
  })
}

/** Chemins du décor, en pixels. */
export function decorGeometry(layout: Layout, width: number, height: number, borders: Borders) {
  if (!layout.decor) return []
  const { outer, areaW, areaH } = drawingArea(width, height, borders)
  return layout.decor.map((d) => ({
    ...d,
    d: serializePath(mapPath(segs(d.d), ([x, y]) => [outer + x * areaW, outer + y * areaH])),
  }))
}

/** Écart en pixels (épaisseur du contour couleur du fond autour des cases en forme). */
export function gapPx(width: number, height: number, borders: Borders): number {
  return borders.spacing * MAX_SPACING * Math.min(width, height)
}

export function outlinePx(width: number, height: number, borders: Borders): number {
  return (borders.outline ?? 0) * MAX_OUTLINE * Math.min(width, height)
}
