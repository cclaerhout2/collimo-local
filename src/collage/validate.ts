/**
 * Validation automatique d'une disposition (usine à dispositions) : nombre de cases, cases dans le
 * cadre, chevauchements non voulus, cases trop petites. Calcul par échantillonnage sur une grille,
 * sans canvas (fonctionne aussi dans les tests).
 */
import { cellPathFrame } from './cells'
import type { Pt, Seg } from './path'
import type { CellDef } from './shapes'

/**
 * Problème relevé dans une disposition : mauvais nombre de cases, case hors du cadre,
 * deux cases qui se chevauchent sans le vouloir, case trop petite, ou disposition vide.
 * Les cases sont désignées par leur indice.
 */
export type LayoutIssue =
  | { code: 'count'; expected: number; got: number }
  | { code: 'outside'; cell: number }
  | { code: 'overlap'; a: number; b: number }
  | { code: 'tiny'; cell: number }
  | { code: 'empty' }

/**
 * Contours d'une case en polylignes (courbes découpées), coordonnées du cadre (rapport 1).
 * @param c - définition de la case
 * @returns les contours fermés et la règle de remplissage
 */
export function cellPolylines(c: CellDef): { rings: Pt[][]; evenodd: boolean } {
  if (c.kind === 'rect') {
    return {
      rings: [
        [
          [c.x, c.y],
          [c.x + c.w, c.y],
          [c.x + c.w, c.y + c.h],
          [c.x, c.y + c.h],
        ],
      ],
      evenodd: false,
    }
  }
  const f = cellPathFrame(c, 1)!
  return { rings: flatten(f.segs), evenodd: !!f.evenodd }
}

/**
 * Découpe les courbes d'un chemin en segments droits.
 * @param segs - segments absolus du chemin
 * @param steps - nombre de segments droits par courbe
 * @returns un contour par sous-chemin (les contours de moins de 3 points sont ignorés)
 */
export function flatten(segs: Seg[], steps = 12): Pt[][] {
  const rings: Pt[][] = []
  let ring: Pt[] = []
  let cur: Pt = [0, 0]
  for (const s of segs) {
    if (s.c === 'M') {
      if (ring.length > 2) rings.push(ring)
      ring = [s.p]
      cur = s.p
    } else if (s.c === 'L') {
      ring.push(s.p)
      cur = s.p
    } else if (s.c === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        ring.push([
          u * u * u * cur[0] + 3 * u * u * t * s.p1[0] + 3 * u * t * t * s.p2[0] + t * t * t * s.p[0],
          u * u * u * cur[1] + 3 * u * u * t * s.p1[1] + 3 * u * t * t * s.p2[1] + t * t * t * s.p[1],
        ])
      }
      cur = s.p
    } else if (s.c === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        ring.push([u * u * cur[0] + 2 * u * t * s.p1[0] + t * t * s.p[0], u * u * cur[1] + 2 * u * t * s.p1[1] + t * t * s.p[1]])
      }
      cur = s.p
    }
  }
  if (ring.length > 2) rings.push(ring)
  return rings
}

/**
 * Indique si un point est à l'intérieur d'une forme, par lancer de rayon vers la droite.
 * @param rings - contours fermés de la forme
 * @param evenodd - règle pair-impair (sinon règle non nulle, celle du Canvas par défaut)
 * @param x - abscisse du point
 * @param y - ordonnée du point
 * @returns `true` si le point est dans la forme
 */
export function pointIn(rings: Pt[][], evenodd: boolean, x: number, y: number): boolean {
  let winding = 0
  let crossings = 0
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]
      const [xj, yj] = r[j]
      if (yj <= y !== yi <= y) {
        const xCross = xj + ((y - yj) * (xi - xj)) / (yi - yj)
        if (x < xCross) {
          crossings++
          winding += yi > yj ? 1 : -1
        }
      }
    }
  }
  return evenodd ? crossings % 2 === 1 : winding !== 0
}

/**
 * Part de la surface du cadre couverte par chaque case, et paires de cases qui se chevauchent,
 * par échantillonnage au centre de chaque maille d'une grille.
 * @param cells - cases de la disposition, coordonnées du cadre (0–1)
 * @param grid - nombre de mailles par côté
 * @returns la part couverte par chaque case (0–1), le nombre de points communs par paire (clé `"a-b"`),
 * la boîte englobante de chaque case et le nombre total de points
 */
export function coverage(cells: CellDef[], grid = 100) {
  const shapes = cells.map(cellPolylines)
  const boxes = shapes.map(({ rings }) => {
    const xs = rings.flat().map((p) => p[0])
    const ys = rings.flat().map((p) => p[1])
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  })
  const area = cells.map(() => 0)
  const pairs = new Map<string, number>()
  const step = 1 / grid
  for (let gy = 0; gy < grid; gy++) {
    const y = (gy + 0.5) * step
    for (let gx = 0; gx < grid; gx++) {
      const x = (gx + 0.5) * step
      const hit: number[] = []
      shapes.forEach((s, i) => {
        const b = boxes[i]
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return
        if (pointIn(s.rings, s.evenodd, x, y)) hit.push(i)
      })
      for (const i of hit) area[i]++
      for (let a = 0; a < hit.length; a++)
        for (let b = a + 1; b < hit.length; b++) {
          const k = `${hit[a]}-${hit[b]}`
          pairs.set(k, (pairs.get(k) ?? 0) + 1)
        }
    }
  }
  const total = grid * grid
  return { area: area.map((n) => n / total), pairs, boxes, total }
}

/**
 * Problèmes d'une disposition ; liste vide = publiable.
 * @param cells - cases de la disposition, coordonnées du cadre (0–1)
 * @param photos - nombre de photos annoncé
 * @returns les problèmes relevés
 */
export function validateCells(cells: CellDef[], photos: number): LayoutIssue[] {
  if (!cells.length) return [{ code: 'empty' }]
  const issues: LayoutIssue[] = []
  if (cells.length !== photos) issues.push({ code: 'count', expected: photos, got: cells.length })
  const { area, pairs, boxes, total } = coverage(cells)
  // Même tolérance que le catalogue : une forme peut déborder un peu (courbes, rotation).
  const tol = 0.05
  boxes.forEach((b, i) => {
    if (b.x0 < -tol || b.y0 < -tol || b.x1 > 1 + tol || b.y1 > 1 + tol) issues.push({ code: 'outside', cell: i })
  })
  area.forEach((a, i) => {
    if (a < 0.002) issues.push({ code: 'tiny', cell: i })
  })
  // Un chevauchement de quelques points d'échantillonnage (bords communs arrondis) est ignoré.
  const min = Math.max(4, total * 0.0015)
  for (const [k, n] of pairs) {
    if (n < min) continue
    const [a, b] = k.split('-').map(Number)
    if (cells[b].over || cells[a].over) continue
    issues.push({ code: 'overlap', a, b })
  }
  return issues
}
