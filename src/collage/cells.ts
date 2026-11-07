/**
 * Géométrie des cases en pixels, pour toutes les sortes de cases : rectangles (écart appliqué en
 * réduisant la case), polygones, chemins et formes (écart obtenu en traçant leur contour de la couleur
 * du fond, ce qui marche aussi entre deux formes imbriquées).
 */
import { cellBoxes, drawingArea, isolatedCells, MAX_SPACING, type CellBox } from './geometry'
import { mapPath, parsePath, pathBBox, polyPath, serializePath, type Pt, type Seg } from './path'
import { polyCutPath, SHAPES, type CellDef } from './shapes'
import type { Borders, Layout, Rect } from './types'

/** Géométrie d'une case en pixels, prête à dessiner. */
export interface CellGeom {
  /** Boîte de la photo : elle la couvre entièrement. */
  box: CellBox
  /** Contour en pixels (absent pour une case rectangulaire). */
  path?: string
  /** Remplissage pair-impair du contour (pour les chemins percés de trous). */
  evenodd?: boolean
  /**
   * Forme de la bibliothèque : l'écart est obtenu en la réduisant (pas de contour tracé, qui
   * ferait apparaître les traits intérieurs des formes composées), et le contour optionnel
   * est un aplat dessiné derrière (`under`).
   */
  shaped?: boolean
  /** Chemin en pixels de l'aplat de contour, dessiné derrière la forme. */
  under?: string
  /** Case isolée (aucune voisine) : pas d'écart tracé autour. */
  noGap?: boolean
}

/** Épaisseur maximale du contour optionnel, en part du plus petit côté. */
export const MAX_OUTLINE = 0.02

/** Chemins déjà lus, par texte du chemin : la bibliothèque et le catalogue réutilisent les mêmes. */
const parsed = new Map<string, Seg[]>()
/**
 * Lit un chemin SVG, en gardant le résultat pour les appels suivants.
 * @param d - chemin SVG
 * @returns les segments absolus (à ne pas modifier : ils sont partagés)
 */
function segs(d: string): Seg[] {
  let s = parsed.get(d)
  if (!s) {
    s = parsePath(d)
    parsed.set(d, s)
  }
  return s
}

/**
 * Chemin d'une case en forme, en coordonnées du cadre (0–1).
 * @param c - définition de la case
 * @param aspect - rapport largeur / hauteur de la zone de dessin, en pixels ; sert à garder les proportions des formes et à les faire tourner sans les déformer
 * @param scale - facteur de taille d'une forme de la bibliothèque autour de son centre (1 = taille de son rectangle)
 * @returns les segments et le mode de remplissage, ou `null` pour une case rectangulaire
 */
export function cellPathFrame(c: CellDef, aspect: number, scale = 1): { segs: Seg[]; evenodd?: boolean } | null {
  if (c.kind === 'rect') return null
  if (c.kind === 'poly') return { segs: segs(c.cuts?.some(Boolean) ? polyCutPath(c.points, c.cuts) : polyPath(c.points)) }
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

/**
 * Boîte englobante d'une case, en coordonnées du cadre (0–1).
 * @param c - définition de la case
 * @returns la boîte ; pour une forme, son rectangle de pose
 */
export function defBBox(c: CellDef): Rect {
  if (c.kind === 'rect' || c.kind === 'shape') return { x: c.x, y: c.y, w: c.w, h: c.h }
  return pathBBox(cellPathFrame(c, 1)!.segs)
}

/**
 * Cases d'une disposition en pixels, pour un collage de taille (width, height).
 * Les derniers résultats sont gardés : pendant un geste, l'aperçu, la couche des gestes et l'export
 * redemandent la même géométrie plusieurs fois par image.
 * @param layout - disposition
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns la géométrie de chaque case, dans l'ordre des cases (tableau partagé, à ne pas modifier)
 */
export function cellGeometry(layout: Layout, width: number, height: number, borders: Borders): CellGeom[] {
  const key = `${width}|${height}|${borders.spacing}|${borders.margin}|${borders.radius}|${borders.outline ?? 0}`
  let byKey = geomCache.get(layout)
  const hit = byKey?.get(key)
  if (hit) return hit
  const out = computeCellGeometry(layout, width, height, borders)
  if (!byKey) {
    byKey = new Map()
    geomCache.set(layout, byKey)
  }
  if (byKey.size >= 8) byKey.delete(byKey.keys().next().value!)
  byKey.set(key, out)
  return out
}

/** Derniers résultats de {@link cellGeometry}, par disposition puis par taille et bords (8 au plus par disposition). */
const geomCache = new WeakMap<Layout, Map<string, CellGeom[]>>()

/**
 * Calcule les cases d'une disposition en pixels (sans cache : voir {@link cellGeometry}).
 * @param layout - disposition
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns la géométrie de chaque case, dans l'ordre des cases
 */
function computeCellGeometry(layout: Layout, width: number, height: number, borders: Borders): CellGeom[] {
  if (!layout.geo) return cellBoxes(layout.cells, width, height, borders).map((box) => ({ box }))
  const { outer, areaW, areaH } = drawingArea(width, height, borders)
  const aspect = areaW / Math.max(1, areaH)
  const rectBoxes = cellBoxes(layout.cells, width, height, borders)
  const gap = gapPx(width, height, borders)
  const outline = outlinePx(width, height, borders)
  const toPx = (segs: Seg[]) => mapPath(segs, ([x, y]) => [outer + x * areaW, outer + y * areaH])
  const bboxes = layout.cells
  const iso = isolatedCells(bboxes)
  // Chevauchement « franc » : boîtes réduites de 15 % de chaque côté, pour que des formes voisines
  // dont seuls les coins des boîtes se touchent (fleurs, cœurs en grille) restent des formes pleines.
  const core = (r: Rect) => ({ x: r.x + r.w * 0.15, y: r.y + r.h * 0.15, w: r.w * 0.7, h: r.h * 0.7 })
  const overlapsEarlier = (i: number) =>
    bboxes.slice(0, i).some((full, j) => {
      const a = core(bboxes[i])
      const b = layout.geo![j].kind === 'shape' ? core(full) : full
      return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6
    })
  return layout.geo.map((c, i) => {
    if (c.kind === 'rect') return { box: rectBoxes[i] }
    // Forme posée sur une autre photo (médaillon) : contour tracé, pour que l'anneau d'écart se voie.
    if (c.kind === 'shape' && (c.over || overlapsEarlier(i))) {
      const px = toPx(cellPathFrame(c, aspect)!.segs)
      return { box: { ...pathBBox(px), radius: 0 }, path: serializePath(px) }
    }
    if (c.kind === 'shape') {
      // Taille de la forme en pixels (plus petit côté), pour retirer l'écart et ajouter le contour.
      const side = Math.max(1, Math.min(c.w * areaW, c.h * areaH))
      // Le contour est pris à l'intérieur de la forme : elle garde sa taille et ne touche pas ses voisines.
      const full = iso[i] ? 1 : Math.max(0.05, 1 - gap / side)
      const inner = Math.max(0.05, full - (2 * outline) / side)
      const px = toPx(cellPathFrame(c, aspect, inner)!.segs)
      const under = outline > 0 ? serializePath(toPx(cellPathFrame(c, aspect, full)!.segs)) : undefined
      return { box: { ...pathBBox(px), radius: 0 }, path: serializePath(px), shaped: true, under }
    }
    const fp = cellPathFrame(c, aspect)!
    const px = toPx(fp.segs)
    const bb = pathBBox(px)
    return { box: { ...bb, radius: 0 }, path: serializePath(px), evenodd: fp.evenodd, noGap: iso[i] || undefined }
  })
}

/**
 * Chemins du décor, en pixels.
 * @param layout - disposition
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords (la marge déplace la zone de dessin)
 * @returns les éléments de décor, chemin converti en pixels ; vide si la disposition n'en a pas
 */
export function decorGeometry(layout: Layout, width: number, height: number, borders: Borders) {
  if (!layout.decor) return []
  const { outer, areaW, areaH } = drawingArea(width, height, borders)
  return layout.decor.map((d) => ({
    ...d,
    d: serializePath(mapPath(segs(d.d), ([x, y]) => [outer + x * areaW, outer + y * areaH])),
  }))
}

/**
 * Écart en pixels (épaisseur du contour couleur du fond autour des cases en forme).
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns l'écart, en pixels
 */
export function gapPx(width: number, height: number, borders: Borders): number {
  return borders.spacing * MAX_SPACING * Math.min(width, height)
}

/**
 * Épaisseur en pixels du contour optionnel autour des cases en forme.
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param borders - réglages des bords
 * @returns l'épaisseur, en pixels (0 sans contour)
 */
export function outlinePx(width: number, height: number, borders: Borders): number {
  return (borders.outline ?? 0) * MAX_OUTLINE * Math.min(width, height)
}
