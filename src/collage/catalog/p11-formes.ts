import { hexes, poly, readingOrder, shapeAt, splitPoly, type CellDef } from '../shapes'
import type { LayoutDef } from '../types'

type Pt = [number, number]
type Box = [number, number, number, number]

// --- Aides partagées par les dispositions en forme de 11 à 20 photos ---

/** Rectangle (x0, y0) → (x1, y1) sous forme de polygone. */
export const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

/** Polygones → cases, dans l'ordre de lecture. */
export const ordered = (polys: Pt[][], by: 'rows' | 'cols' = 'rows', tol = 0.06): CellDef[] =>
  readingOrder(polys, by, tol).map((p) => poly(...p))

const area = (p: Pt[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1] }, 0)) / 2

/** Découpe un polygone convexe par des droites infinies (morceaux non triés). */
export function cut(p: Pt[], lines: [Pt, Pt][]): Pt[][] {
  let polys = [p]
  for (const [a, b] of lines) polys = polys.flatMap((q) => splitPoly(q, a, b)).filter((q) => q.length >= 3 && area(q) > 1e-4)
  return polys
}

/** Intersection d'un polygone quelconque avec un polygone convexe (Sutherland–Hodgman). */
export function clip(subject: Pt[], window: Pt[]): Pt[] {
  let out = subject
  const sgn = window.reduce((s, a, i) => { const b = window[(i + 1) % window.length]; return s + a[0] * b[1] - b[0] * a[1] }, 0) > 0 ? 1 : -1
  for (let i = 0; i < window.length && out.length; i++) {
    const a = window[i]
    const b = window[(i + 1) % window.length]
    const side = (p: Pt) => sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))
    const input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j]
      const q = input[(j + 1) % input.length]
      const sp = side(p)
      const sq = side(q)
      if (sp >= 0) out.push(p)
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq)
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
      }
    }
  }
  return out
}

/** Cases = intersections de la forme avec chaque fenêtre convexe (les morceaux trop petits sont écartés). */
export const clipAll = (subject: Pt[], windows: Pt[][], min = 4e-4): Pt[][] =>
  windows.map((w) => clip(subject, w)).filter((p) => p.length >= 3 && area(p) > min)

/**
 * Anneau en perspective : 8 trapèzes entre le cadre `o` et le cadre intérieur `i` ([x0, y0, x1, y1]),
 * coupés au milieu de chaque côté.
 */
export function frameRing(o: Box, i: Box): Pt[][] {
  const [ox0, oy0, ox1, oy1] = o
  const [ix0, iy0, ix1, iy1] = i
  const mx = (ix0 + ix1) / 2
  const my = (iy0 + iy1) / 2
  return [
    [[ox0, oy0], [mx, oy0], [mx, iy0], [ix0, iy0]],
    [[mx, oy0], [ox1, oy0], [ix1, iy0], [mx, iy0]],
    [[ox0, oy0], [ix0, iy0], [ix0, my], [ox0, my]],
    [[ox1, oy0], [ox1, my], [ix1, my], [ix1, iy0]],
    [[ox0, my], [ix0, my], [ix0, iy1], [ox0, oy1]],
    [[ox1, my], [ox1, oy1], [ix1, iy1], [ix1, my]],
    [[ox0, oy1], [ix0, iy1], [mx, iy1], [mx, oy1]],
    [[mx, oy1], [mx, iy1], [ix1, iy1], [ox1, oy1]],
  ]
}

/**
 * Bande horizontale entre deux droites (hauteurs en x = 0 et x = 1), coupée par des séparateurs
 * obliques donnés par leur abscisse en haut et en bas de la bande.
 */
export function bandRow(top: [number, number], bot: [number, number], divs: ([number, number] | number)[]): Pt[][] {
  const yt = (x: number) => top[0] + (top[1] - top[0]) * x
  const yb = (x: number) => bot[0] + (bot[1] - bot[0]) * x
  const d = [[0, 0], ...divs.map((v) => (typeof v === 'number' ? [v, v] : v)), [1, 1]] as [number, number][]
  const out: Pt[][] = []
  for (let k = 0; k + 1 < d.length; k++) {
    const [a, b] = d[k]
    const [c, e] = d[k + 1]
    out.push([[a, yt(a)], [c, yt(c)], [e, yb(e)], [b, yb(b)]])
  }
  return out
}

/** Hexagone pointe en haut, de largeur `w`, centré. */
export const hexAt = (cx: number, cy: number, w: number): CellDef => shapeAt('hexagon', cx, cy, w / 0.866)

/** Ovale (cercle étiré) centré, w × h. */
export const ovalAt = (cx: number, cy: number, w: number, h: number): CellDef => shapeAt('circle', cx, cy, w, { h, stretch: true })

/** Tige fine (décor) d'un point à un autre. */
export function stem(a: Pt, b: Pt, w = 0.012): string {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy)
  const nx = (-dy / l) * w
  const ny = (dx / l) * w
  const f = (v: number) => +v.toFixed(4)
  return `M${f(a[0] + nx)} ${f(a[1] + ny)}L${f(b[0] + nx)} ${f(b[1] + ny)}L${f(b[0] - nx)} ${f(b[1] - ny)}L${f(a[0] - nx)} ${f(a[1] - ny)}Z`
}

// --- 11 photos ---

/** Feuille d'érable : contour relevé sur la vignette, partagé en 11 secteurs autour du point d'attache. */
function maple(): Pt[][] {
  const t = (x: number, y: number): Pt => [(x - 10) / 480, (y - 10) / 480]
  const outline = ([
    [190, 345], [120, 320], [60, 270], [55, 248], [110, 240], [85, 150], [125, 165], [118, 72], [160, 100], [185, 85], [215, 150],
    [225, 120], [258, 75], [290, 100], [305, 120], [355, 55], [360, 110], [350, 150], [392, 155], [345, 215], [415, 228], [445, 275],
    [400, 290], [410, 315], [350, 330], [320, 345], [330, 395], [290, 410], [250, 385], [215, 345],
  ] as Pt[]).map(([x, y]) => t(x, y))
  const c = t(232, 295)
  const ray = (deg: number): Pt => [c[0] + 2 * Math.cos((deg * Math.PI) / 180), c[1] + 2 * Math.sin((deg * Math.PI) / 180)]
  const step = 360 / 11
  return clipAll(outline, Array.from({ length: 11 }, (_, k) => [c, ray(140 + k * step), ray(140 + (k + 1) * step)]))
}

export const P11_FORMES: LayoutDef[] = [
  {
    id: 'p11-13', photos: 11, family: 'geometrie',
    geo: hexes([[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [2, 3]], 0.22, 0.21, 0.24),
  },
  {
    id: 'p11-14', photos: 11, family: 'ronds',
    geo: [
      ...[0.15, 0.38, 0.62, 0.85].map((x) => shapeAt('circle', x, 0.18, 0.17)),
      ...[0.2, 0.5, 0.8].map((x) => ovalAt(x, 0.5, 0.26, 0.4)),
      ...[0.15, 0.38, 0.62, 0.85].map((x) => shapeAt('circle', x, 0.82, 0.17)),
    ],
  },
  {
    id: 'p11-17', photos: 11, family: 'coupe',
    geo: [
      ...bandRow([0, 0], [0.2, 0.2], [[0.36, 0.34], [0.59, 0.57], [0.81, 0.79]]),
      ...bandRow([0.2, 0.2], [0.8, 0.8], [[0.34, 0.21], [0.84, 0.7]]),
      ...bandRow([0.8, 0.8], [1, 1], [[0.21, 0.19], [0.44, 0.42], [0.68, 0.66]]),
    ].map((p) => poly(...p)),
  },
  { id: 'p11-19', photos: 11, family: 'illustre', geo: ordered(maple()), decor: [{ d: stem([0.4, 0.69], [0.13, 0.9]), fill: 'ink' }] },
  {
    id: 'p11-20', photos: 11, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.21, 0.21, 0.79, 0.79]),
      [[0.21, 0.21], [0.5, 0.21], [0.5, 0.37], [0.37, 0.37], [0.37, 0.63], [0.5, 0.63], [0.5, 0.79], [0.21, 0.79]],
      R(0.37, 0.37, 0.63, 0.63),
      [[0.5, 0.21], [0.79, 0.21], [0.79, 0.79], [0.5, 0.79], [0.5, 0.63], [0.63, 0.63], [0.63, 0.37], [0.5, 0.37]],
    ]),
  },
]
