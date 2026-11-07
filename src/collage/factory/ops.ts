/**
 * Opérations de l'usine à dispositions, sur une liste de cases (coordonnées du cadre 0–1).
 * Fonctions pures : elles renvoient une nouvelle liste, l'éditeur garde l'historique.
 */
import { coverage } from '../validate'
import type { Pt } from '../path'
import { splitPoly, type CellDef, type EdgeCut, type ShapeName } from '../shapes'
import type { Layout } from '../types'

type Rect = Extract<CellDef, { kind: 'rect' }>
type Poly = Extract<CellDef, { kind: 'poly' }>

export const EPS = 0.004
const MIN = 0.02
const round = (v: number) => Math.round(v * 10000) / 10000
const near = (a: number, b: number, e = EPS) => Math.abs(a - b) <= e
const samePt = (a: Pt, b: Pt, e = EPS) => near(a[0], b[0], e) && near(a[1], b[1], e)

const clone = (cells: CellDef[]): CellDef[] => structuredClone(cells)

/** Cases modifiables d'une disposition existante ; les cases posées sur une autre sont marquées « superposées ». */
export function toEditable(layout: Layout): CellDef[] {
  const cells: CellDef[] = layout.geo ? clone(layout.geo) : layout.cells.map((c) => ({ kind: 'rect', x: round(c.x), y: round(c.y), w: round(c.w), h: round(c.h) }))
  const { pairs, total } = coverage(cells)
  for (const [k, n] of pairs) {
    if (n < Math.max(4, total * 0.0015)) continue
    const b = Number(k.split('-')[1])
    cells[b] = { ...cells[b], over: true }
  }
  return cells
}

/** Grille de `cols` × `rows` rectangles, remplie ligne par ligne. */
export function gridTemplate(cols: number, rows: number): CellDef[] {
  const out: CellDef[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ kind: 'rect', x: round(c / cols), y: round(r / rows), w: round(1 / cols), h: round(1 / rows) })
  return out
}

export function rectToPoly(c: Rect): Poly {
  const { x, y, w, h } = c
  return { kind: 'poly', points: [[x, y], [round(x + w), y], [round(x + w), round(y + h)], [x, round(y + h)]], ...(c.over ? { over: true } : {}) }
}

export function centroid(points: Pt[]): Pt {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    const f = x0 * y1 - x1 * y0
    a += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  if (Math.abs(a) < 1e-12) {
    const n = points.length
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

/** Centre d'une case (pour placer son numéro ou une poignée). */
export function cellCenter(c: CellDef): Pt {
  if (c.kind === 'rect' || c.kind === 'shape') return [c.x + c.w / 2, c.y + c.h / 2]
  if (c.kind === 'poly') return centroid(c.points)
  const nums = (c.d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

/** Coupe une case en deux, à la verticale (`v`) ou à l'horizontale (`h`) ; la 2e moitié suit la 1re. */
export function splitCell(cells: CellDef[], i: number, dir: 'v' | 'h'): CellDef[] {
  const c = cells[i]
  let parts: CellDef[]
  if (c.kind === 'rect') {
    parts =
      dir === 'v'
        ? [{ ...c, w: round(c.w / 2) }, { ...c, x: round(c.x + c.w / 2), w: round(c.w - round(c.w / 2)) }]
        : [{ ...c, h: round(c.h / 2) }, { ...c, y: round(c.y + c.h / 2), h: round(c.h - round(c.h / 2)) }]
  } else if (c.kind === 'poly') {
    const [cx, cy] = centroid(c.points)
    const [a, b]: [Pt, Pt] = dir === 'v' ? [[cx, -1], [cx, 2]] : [[2, cy], [-1, cy]]
    const halves = splitPoly(c.points, a, b).filter((p) => p.length >= 3)
    if (halves.length < 2) return cells
    parts = halves.map((points) => ({ kind: 'poly', points: points.map(([x, y]) => [round(x), round(y)] as Pt) }))
  } else return cells
  return [...cells.slice(0, i), ...parts, ...cells.slice(i + 1)]
}

export function removeCell(cells: CellDef[], i: number): CellDef[] {
  return cells.filter((_, k) => k !== i)
}

export function duplicateCell(cells: CellDef[], i: number): CellDef[] {
  const copy = translate(clone([cells[i]])[0], 0.04, 0.04)
  return [...cells.slice(0, i + 1), copy, ...cells.slice(i + 1)]
}

export function translate(c: CellDef, dx: number, dy: number): CellDef {
  if (c.kind === 'rect' || c.kind === 'shape') return { ...c, x: round(c.x + dx), y: round(c.y + dy) }
  if (c.kind === 'poly') return { ...c, points: c.points.map(([x, y]) => [round(x + dx), round(y + dy)] as Pt) }
  const d = c.d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x, y) => `${round(Number(x) + dx)} ${round(Number(y) + dy)}`)
  return { ...c, d }
}

export function moveCell(cells: CellDef[], i: number, dx: number, dy: number): CellDef[] {
  return cells.map((c, k) => (k === i ? translate(c, dx, dy) : c))
}

export type Side = 'left' | 'right' | 'top' | 'bottom'

/**
 * Déplace une séparation : le côté `side` de la case rectangulaire `i`, avec tous les côtés alignés
 * qui le prolongent (cases voisines, sommets de polygones posés dessus). Les cases gardent au moins 2 %.
 */
export function dragSeparator(cells: CellDef[], i: number, side: Side, to: number): CellDef[] {
  const c = cells[i]
  if (c.kind !== 'rect') return cells
  const vertical = side === 'left' || side === 'right'
  const pos = side === 'left' ? c.x : side === 'right' ? c.x + c.w : side === 'top' ? c.y : c.y + c.h
  // Côtés alignés : [case, côté, début, fin le long de la séparation].
  type E = { k: number; s: Side; a: number; b: number }
  const edges: E[] = []
  cells.forEach((r, k) => {
    if (r.kind !== 'rect') return
    if (vertical) {
      if (near(r.x, pos)) edges.push({ k, s: 'left', a: r.y, b: r.y + r.h })
      if (near(r.x + r.w, pos)) edges.push({ k, s: 'right', a: r.y, b: r.y + r.h })
    } else {
      if (near(r.y, pos)) edges.push({ k, s: 'top', a: r.x, b: r.x + r.w })
      if (near(r.y + r.h, pos)) edges.push({ k, s: 'bottom', a: r.x, b: r.x + r.w })
    }
  })
  // Chaîne connexe à partir du côté saisi.
  const start = edges.find((e) => e.k === i && e.s === side)!
  const chain = new Set<E>([start])
  let lo = start.a
  let hi = start.b
  let grew = true
  while (grew) {
    grew = false
    for (const e of edges) {
      if (chain.has(e) || e.b < lo - EPS || e.a > hi + EPS) continue
      chain.add(e)
      lo = Math.min(lo, e.a)
      hi = Math.max(hi, e.b)
      grew = true
    }
  }
  // Limites : chaque case touchée garde une taille minimale.
  let min = -Infinity
  let max = Infinity
  for (const e of chain) {
    const r = cells[e.k] as Rect
    if (e.s === 'left') max = Math.min(max, r.x + r.w - MIN)
    if (e.s === 'right') min = Math.max(min, r.x + MIN)
    if (e.s === 'top') max = Math.min(max, r.y + r.h - MIN)
    if (e.s === 'bottom') min = Math.max(min, r.y + MIN)
  }
  const v = round(Math.min(max, Math.max(min, to)))
  const out = clone(cells)
  for (const e of chain) {
    const r = out[e.k] as Rect
    if (e.s === 'left') {
      r.w = round(r.x + r.w - v)
      r.x = v
    } else if (e.s === 'right') r.w = round(v - r.x)
    else if (e.s === 'top') {
      r.h = round(r.y + r.h - v)
      r.y = v
    } else r.h = round(v - r.y)
  }
  out.forEach((p) => {
    if (p.kind !== 'poly') return
    p.points = p.points.map(([x, y]) => {
      if (vertical && near(x, pos) && y >= lo - EPS && y <= hi + EPS) return [v, y]
      if (!vertical && near(y, pos) && x >= lo - EPS && x <= hi + EPS) return [x, v]
      return [x, y]
    })
  })
  return out
}

/** Déplace un sommet de polygone, et les sommets confondus des polygones voisins (la mosaïque reste jointive). */
export function movePoint(cells: CellDef[], i: number, k: number, to: Pt): CellDef[] {
  const c = cells[i]
  if (c.kind !== 'poly') return cells
  const from = c.points[k]
  const p: Pt = [round(Math.min(1, Math.max(0, to[0]))), round(Math.min(1, Math.max(0, to[1])))]
  return cells.map((q, n) => {
    if (q.kind !== 'poly') return q
    if (n === i) return { ...q, points: q.points.map((pt, j) => (j === k ? p : pt)) }
    return { ...q, points: q.points.map((pt) => (samePt(pt, from, 1e-6) ? p : pt)) }
  })
}

/** Ajoute un sommet au milieu du côté `k` (et dans la case voisine qui partage ce côté). */
export function insertPoint(cells: CellDef[], i: number, k: number): CellDef[] {
  let out = cells.map((c, n) => (n === i && c.kind === 'rect' ? rectToPoly(c) : c))
  const c = out[i]
  if (c.kind !== 'poly') return cells
  const a = c.points[k]
  const b = c.points[(k + 1) % c.points.length]
  const m: Pt = [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)]
  out = out.map((q) => {
    if (q.kind !== 'poly') return q
    for (let j = 0; j < q.points.length; j++) {
      const p0 = q.points[j]
      const p1 = q.points[(j + 1) % q.points.length]
      if ((samePt(p0, a, 1e-6) && samePt(p1, b, 1e-6)) || (samePt(p0, b, 1e-6) && samePt(p1, a, 1e-6))) {
        const points = [...q.points.slice(0, j + 1), m, ...q.points.slice(j + 1)]
        const cuts = q.cuts ? [...q.cuts.slice(0, j + 1), q.cuts[j] ?? null, ...q.cuts.slice(j + 1)] : undefined
        return { ...q, points, ...(cuts ? { cuts } : {}) }
      }
    }
    return q
  })
  return out
}

export function removePoint(cells: CellDef[], i: number, k: number): CellDef[] {
  const c = cells[i]
  if (c.kind !== 'poly' || c.points.length <= 3) return cells
  const points = c.points.filter((_, j) => j !== k)
  const cuts = c.cuts?.filter((_, j) => j !== k)
  return cells.map((q, n) => (n === i ? { ...c, points, ...(cuts ? { cuts } : {}) } : q))
}

function polyOf(c: CellDef): Poly | null {
  if (c.kind === 'poly') return c
  if (c.kind === 'rect') return rectToPoly(c)
  return null
}

/** Position de p le long de [a, b] (0 = a, 1 = b) s'il est sur la droite (a, b), sinon null. */
function along(a: Pt, b: Pt, p: Pt): number | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return null
  const cross = (p[0] - a[0]) * dy - (p[1] - a[1]) * dx
  if (Math.abs(cross) / Math.sqrt(len2) > EPS) return null
  return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
}

/** Insère dans le polygone, sur le côté j, les points donnés qui tombent à l'intérieur de ce côté. */
function splitEdgeAt(q: Poly, j: number, pts: Pt[]): Poly {
  const a = q.points[j]
  const b = q.points[(j + 1) % q.points.length]
  const inner = pts
    .map((p) => ({ p, t: along(a, b, p) }))
    .filter((x): x is { p: Pt; t: number } => x.t !== null && x.t > 0.001 && x.t < 0.999)
    .sort((x, y) => x.t - y.t)
  if (!inner.length) return q
  const points = [...q.points.slice(0, j + 1), ...inner.map((x) => x.p), ...q.points.slice(j + 1)]
  const cuts = q.cuts ? [...q.cuts.slice(0, j + 1), ...inner.map(() => q.cuts![j] ?? null), ...q.cuts.slice(j + 1)] : undefined
  return { ...q, points, ...(cuts ? { cuts } : {}) }
}

/**
 * Coupe spéciale (courbe, vague, zigzag, éclair, déchirure) sur le côté `k` de la case `i`, et sur la
 * même portion de séparation dans les cases voisines. Un rectangle devient un polygone ; un côté
 * partagé seulement en partie est d'abord découpé pour que le bord soit identique des deux côtés.
 */
export function applyCut(cells: CellDef[], i: number, k: number, cut: EdgeCut | null): CellDef[] {
  const base = polyOf(cells[i])
  if (!base) return cells
  const a = base.points[k]
  const b = base.points[(k + 1) % base.points.length]
  let out: CellDef[] = cells.map((c, n) => (n === i ? base : c))
  // Voisins : côtés colinéaires qui recouvrent [a, b].
  const touched = new Set<number>([i])
  const marks: Pt[] = [a, b]
  out.forEach((c, n) => {
    if (n === i) return
    const q = polyOf(c)
    if (!q) return
    for (let j = 0; j < q.points.length; j++) {
      const p0 = q.points[j]
      const p1 = q.points[(j + 1) % q.points.length]
      const t0 = along(a, b, p0)
      const t1 = along(a, b, p1)
      if (t0 === null || t1 === null) continue
      const lo = Math.max(0, Math.min(t0, t1))
      const hi = Math.min(1, Math.max(t0, t1))
      if (hi - lo < 0.01) continue
      touched.add(n)
      for (const t of [lo, hi]) marks.push([round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t)])
      for (const p of [p0, p1]) {
        const t = along(a, b, p)!
        if (t > 0 && t < 1) marks.push(p)
      }
    }
  })
  // Découpe des côtés concernés aux points de recouvrement, puis pose de la coupe.
  const uniq = marks.filter((p, n) => marks.findIndex((q) => samePt(p, q, 1e-4)) === n)
  out = out.map((c, n) => {
    if (!touched.has(n)) return c
    let q = polyOf(c)!
    for (let j = q.points.length - 1; j >= 0; j--) {
      const p0 = q.points[j]
      const p1 = q.points[(j + 1) % q.points.length]
      if (along(a, b, p0) !== null && along(a, b, p1) !== null) q = splitEdgeAt(q, j, uniq)
    }
    const cuts: (EdgeCut | null)[] = q.points.map((_, j) => q.cuts?.[j] ?? null)
    for (let j = 0; j < q.points.length; j++) {
      const t0 = along(a, b, q.points[j])
      const t1 = along(a, b, q.points[(j + 1) % q.points.length])
      if (t0 === null || t1 === null) continue
      if (Math.min(t0, t1) >= -0.001 && Math.max(t0, t1) <= 1.001 && Math.abs(t1 - t0) > 0.001) cuts[j] = cut
    }
    const has = cuts.some(Boolean)
    const { cuts: _old, ...rest } = q
    return has ? { ...rest, cuts } : rest
  })
  return out
}

export function shapeCell(name: ShapeName, cx = 0.5, cy = 0.5, size = 0.3): CellDef {
  return { kind: 'shape', shape: name, x: round(cx - size / 2), y: round(cy - size / 2), w: size, h: size }
}

/** Nouvel ordre : `order[n]` = indice actuel de la case qui devient la n-ième. */
export function reorder(cells: CellDef[], order: number[]): CellDef[] {
  return order.map((k) => cells[k])
}

/** Ordre de lecture automatique (lignes de haut en bas, puis de gauche à droite). */
export function readingOrderOf(cells: CellDef[]): number[] {
  const centers = cells.map(cellCenter)
  return centers
    .map((c, k) => ({ c, k }))
    .sort((p, q) => (Math.abs(p.c[1] - q.c[1]) > 0.06 ? p.c[1] - q.c[1] : p.c[0] - q.c[0]))
    .map((x) => x.k)
}

/** Les cases sont-elles toutes des rectangles ? */
export const allRects = (cells: CellDef[]) => cells.every((c) => c.kind === 'rect')
