import type { Pt } from '../path'
import { cutFrame, poly, shape, shapeAt, type CellDef, type ShapeName } from '../shapes'
import type { LayoutDef } from '../types'

// --- Outils locaux, partagés par p06 à p10 ---

/** Cellules dans l'ordre de lecture (rangées puis colonnes), d'après le centre de leur boîte. */
export function byReading(cells: CellDef[], tol = 0.08): CellDef[] {
  const c = (d: CellDef): Pt => {
    if (d.kind === 'poly') {
      const xs = d.points.map((p) => p[0])
      const ys = d.points.map((p) => p[1])
      return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
    }
    if (d.kind === 'rect' || d.kind === 'shape') return [d.x + d.w / 2, d.y + d.h / 2]
    return [0.5, 0.5]
  }
  return [...cells].sort((a, b) => {
    const [ax, ay] = c(a)
    const [bx, by] = c(b)
    return Math.abs(ay - by) > tol ? ay - by : ax - bx
  })
}

/**
 * Grille à séparations courbes : verticales x = v(y), horizontales y = h(x) (intérieures seulement,
 * les bords du cadre sont ajoutés). Cases échantillonnées en polygones, par rangées.
 */
export function curvedGrid(vs: ((y: number) => number)[], hs: ((x: number) => number)[], n = 14): CellDef[] {
  const V = [() => 0, ...vs, () => 1]
  const H = [() => 0, ...hs, () => 1]
  const cross = (v: (y: number) => number, h: (x: number) => number): Pt => {
    let y = 0.5
    for (let k = 0; k < 30; k++) y = h(v(y))
    return [v(y), y]
  }
  const out: CellDef[] = []
  for (let j = 0; j < H.length - 1; j++)
    for (let i = 0; i < V.length - 1; i++) {
      const p00 = cross(V[i], H[j])
      const p10 = cross(V[i + 1], H[j])
      const p11 = cross(V[i + 1], H[j + 1])
      const p01 = cross(V[i], H[j + 1])
      const pts: Pt[] = []
      for (let k = 0; k < n; k++) {
        const x = p00[0] + ((p10[0] - p00[0]) * k) / n
        pts.push([x, H[j](x)])
      }
      for (let k = 0; k < n; k++) {
        const y = p10[1] + ((p11[1] - p10[1]) * k) / n
        pts.push([V[i + 1](y), y])
      }
      for (let k = 0; k < n; k++) {
        const x = p11[0] + ((p01[0] - p11[0]) * k) / n
        pts.push([x, H[j + 1](x)])
      }
      for (let k = 0; k < n; k++) {
        const y = p01[1] + ((p00[1] - p01[1]) * k) / n
        pts.push([V[i](y), y])
      }
      out.push(poly(...pts))
    }
  return out
}

/** Point où la demi-droite (p, dir) sort du cadre. */
export function rayHit(p: Pt, dir: Pt): Pt {
  const [dx, dy] = dir
  const ts = [dx > 1e-9 ? (1 - p[0]) / dx : dx < -1e-9 ? -p[0] / dx : Infinity, dy > 1e-9 ? (1 - p[1]) / dy : dy < -1e-9 ? -p[1] / dy : Infinity]
  const t = Math.min(...ts)
  return [p[0] + dx * t, p[1] + dy * t]
}

/**
 * Zones entre des demi-droites qui partent d'un motif central : la demi-droite i part de starts[i]
 * dans la direction dirs[i] ; la zone i va de la demi-droite i à la suivante, en suivant le cadre,
 * puis revient par `inner[i]` (points du motif entre starts[i+1] et starts[i]).
 */
export function radial(c: Pt, starts: Pt[], dirs: Pt[], inner: Pt[][] = []): CellDef[] {
  const n = starts.length
  const hits = starts.map((s, i) => rayHit(s, dirs[i]))
  const ang = (p: Pt) => Math.atan2(p[1] - c[1], p[0] - c[0])
  const corners: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const out: CellDef[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a0 = ang(hits[i])
    let span = ang(hits[j]) - a0
    while (span <= 0) span += 2 * Math.PI
    const rel = (p: Pt) => {
      let d = ang(p) - a0
      while (d < 0) d += 2 * Math.PI
      return d
    }
    const cs = corners.filter((k) => rel(k) > 1e-9 && rel(k) < span).sort((a, b) => rel(a) - rel(b))
    out.push(poly(starts[i], hits[i], ...cs, hits[j], starts[j], ...(inner[i] ?? [])))
  }
  return out
}

/**
 * Grand cœur découpé : carré sur la pointe (sommets haut, droite, bas, gauche) divisé en nu × nv
 * losanges, plus deux lobes en demi-cercle sur les côtés hauts.
 */
export function heartPieces(nu: number, nv: number, T: Pt = [0.5, 0.22], R: Pt = [0.88, 0.6], B: Pt = [0.5, 0.98], L: Pt = [0.12, 0.6]): CellDef[] {
  const k = 0.5523
  // Lobe sur le segment a→b, bombé vers l'extérieur (côté opposé au centre du carré).
  const lobe = (a: Pt, b: Pt): CellDef => {
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2
    const ux = (b[0] - a[0]) / (2 * r)
    const uy = (b[1] - a[1]) / (2 * r)
    // Normale extérieure : côté opposé au centre (milieu de T et B).
    const cx = (T[0] + B[0]) / 2
    const cy = (T[1] + B[1]) / 2
    let nx = -uy
    let ny = ux
    if ((m[0] - cx) * nx + (m[1] - cy) * ny < 0) {
      nx = -nx
      ny = -ny
    }
    const apex: Pt = [m[0] + nx * r, m[1] + ny * r]
    const f = (p: Pt) => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`
    const p1: Pt = [a[0] + nx * k * r, a[1] + ny * k * r]
    const p2: Pt = [apex[0] - ux * k * r, apex[1] - uy * k * r]
    const p3: Pt = [apex[0] + ux * k * r, apex[1] + uy * k * r]
    const p4: Pt = [b[0] + nx * k * r, b[1] + ny * k * r]
    return { kind: 'path', d: `M${f(a)}C${f(p1)} ${f(p2)} ${f(apex)}C${f(p3)} ${f(p4)} ${f(b)}Z` }
  }
  // P(u, v) : u le long de L→T, v le long de L→B.
  const P = (u: number, v: number): Pt => [L[0] + u * (T[0] - L[0]) + v * (B[0] - L[0]), L[1] + u * (T[1] - L[1]) + v * (B[1] - L[1])]
  const pieces: CellDef[] = []
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) pieces.push(poly(P(i / nu, j / nv), P((i + 1) / nu, j / nv), P((i + 1) / nu, (j + 1) / nv), P(i / nu, (j + 1) / nv)))
  return [lobe(L, T), lobe(T, R), ...byReading(pieces, 0.04)]
}

/** Formes en couronne, pointe vers le centre (cœurs). */
export function ringToward(s: ShapeName, n: number, size: number, radius: number, cx = 0.5, cy = 0.5, start = 0): CellDef[] {
  return Array.from({ length: n }, (_, i) => {
    const deg = start - 90 + (i * 360) / n
    const a = (deg * Math.PI) / 180
    return shapeAt(s, cx + radius * Math.cos(a), cy + radius * Math.sin(a), size, { rotate: deg - 90 })
  })
}

/** Ovale (cercle étiré) centré en (cx, cy). */
export const oval = (cx: number, cy: number, w: number, h: number): CellDef => shape('circle', cx - w / 2, cy - h / 2, w, h, { stretch: true })

// --- 6 photos ---

const f1 = (y: number) => 0.31 + 0.08 * Math.sin(Math.PI * y) - 0.02 * y
const f2 = (y: number) => 0.69 - 0.08 * Math.sin(Math.PI * y) + 0.02 * y
const g1 = (x: number) => 0.56 - 0.1 * Math.sin(Math.PI * x)

/** Dispositions en forme pour 6 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P06_FORMES: LayoutDef[] = [
  {
    id: 'p06-07',
    photos: 6,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.5, 0], [0.5, 0.3], [0, 0.37]),
      poly([0.5, 0], [1, 0], [1, 0.25], [0.5, 0.3]),
      poly([0, 0.37], [0.5, 0.3], [0.5, 0.7], [0, 0.62]),
      poly([0.5, 0.3], [1, 0.25], [1, 0.75], [0.5, 0.7]),
      poly([0, 0.62], [0.5, 0.7], [0.5, 1], [0, 1]),
      poly([0.5, 0.7], [1, 0.75], [1, 1], [0.5, 1]),
    ],
  },
  { id: 'p06-08', photos: 6, family: 'coupe', geo: curvedGrid([f1, f2], [g1]) },
  {
    id: 'p06-12',
    photos: 6,
    family: 'ronds',
    geo: [oval(0.19, 0.26, 0.31, 0.47), oval(0.5, 0.26, 0.31, 0.47), oval(0.81, 0.26, 0.31, 0.47), oval(0.19, 0.74, 0.31, 0.47), oval(0.5, 0.74, 0.31, 0.47), oval(0.81, 0.74, 0.31, 0.47)],
  },
  { id: 'p06-17', photos: 6, family: 'coeurs', geo: ringToward('heart', 6, 0.34, 0.32) },
  { id: 'p06-18', photos: 6, family: 'ronds', geo: byReading([shapeAt('circle', 0.5, 0.17, 0.30), shapeAt('circle', 0.78, 0.33, 0.30), shapeAt('circle', 0.78, 0.67, 0.30), shapeAt('circle', 0.5, 0.83, 0.30), shapeAt('circle', 0.22, 0.67, 0.30), shapeAt('circle', 0.22, 0.33, 0.30)]) },
  {
    id: 'p06-19',
    photos: 6,
    family: 'geometrie',
    geo: byReading([
      shapeAt('hexagon-flat', 0.5, 0.18, 0.31),
      shapeAt('hexagon-flat', 0.78, 0.34, 0.31),
      shapeAt('hexagon-flat', 0.78, 0.66, 0.31),
      shapeAt('hexagon-flat', 0.5, 0.82, 0.31),
      shapeAt('hexagon-flat', 0.22, 0.66, 0.31),
      shapeAt('hexagon-flat', 0.22, 0.34, 0.31),
    ]),
  },
  {
    id: 'p06-20',
    photos: 6,
    family: 'coeurs',
    geo: [
      shapeAt('heart', 0.33, 0.21, 0.32, { rotate: -12 }),
      shapeAt('heart', 0.63, 0.2, 0.30, { rotate: 14 }),
      shapeAt('heart', 0.22, 0.48, 0.34, { rotate: -16 }),
      shapeAt('heart', 0.76, 0.42, 0.28, { rotate: 12 }),
      shapeAt('heart', 0.27, 0.77, 0.34, { rotate: 6 }),
      shapeAt('heart', 0.66, 0.69, 0.48, { rotate: -10 }),
    ],
  },
  { id: 'p06-27', photos: 6, family: 'coupe', geo: cutFrame([[[0.2, 0], [0.8, 1]], [[0.8, 0], [0.2, 1]], [[0, 0.5], [1, 0.5]]]) },
  { id: 'p06-28', photos: 6, family: 'coupe', geo: cutFrame([[[0, 0.33], [0.33, 0]], [[0, 0.67], [0.67, 0]], [[0, 1], [1, 0]], [[0.33, 1], [1, 0.33]], [[0.67, 1], [1, 0.67]]]) },
  { id: 'p06-31', photos: 6, family: 'coeurs', geo: heartPieces(2, 2) },
]
