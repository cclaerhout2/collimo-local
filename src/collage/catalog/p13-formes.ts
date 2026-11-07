import { hexes, poly, rect, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { chevronCols } from './p12-formes'
import { R, bandRow, clipAll, frameRing, ordered, stem } from './p11-formes'

type Pt = [number, number]

/**
 * Contour de cœur « pixel » sur une grille (pas g) : rectangles en (c0..c1, r0..r1) + intérieur.
 * Utilisé à 13 et 15 photos.
 */
export const pixG = (c: number, r: number): Pt => [0.022 + 0.1087 * c, 0.083 + 0.1087 * r]
export const pix = (c0: number, r0: number, c1: number, r1: number): Pt[] => {
  const [x0, y0] = pixG(c0, r0)
  const [x1, y1] = pixG(c1, r1)
  return R(x0, y0, x1, y1)
}

/** Feuille à nervures : bandes obliques de chaque côté de la nervure centrale. */
export function veinedLeaf(base: Pt, tip: Pt, halfW: number, sideA: number[], sideB: number[]): Pt[][] {
  const d: Pt = [tip[0] - base[0], tip[1] - base[1]]
  const L = Math.hypot(d[0], d[1])
  const u: Pt = [d[0] / L, d[1] / L]
  const n: Pt = [-u[1], u[0]]
  const P = (s: number): Pt => [base[0] + d[0] * s, base[1] + d[1] * s]
  const N = 48
  const w = (s: number) => halfW * Math.sin(Math.PI * s) ** 0.8
  const half = (sg: number): Pt[] => [
    ...Array.from({ length: N + 1 }, (_, k) => P(k / N)),
    ...Array.from({ length: N - 1 }, (_, k) => {
      const s = 1 - (k + 1) / N
      const p = P(s)
      return [p[0] + sg * n[0] * w(s), p[1] + sg * n[1] * w(s)] as Pt
    }),
  ]
  const strips = (sg: number, veins: number[]): Pt[][] => {
    const b = [-1, ...veins, 2]
    const off: Pt = [d[0] * 0.2 + sg * n[0] * 0.6, d[1] * 0.2 + sg * n[1] * 0.6]
    const wins: Pt[][] = []
    for (let k = 0; k + 1 < b.length; k++) {
      const a = P(b[k])
      const c = P(b[k + 1])
      wins.push([a, [a[0] + off[0], a[1] + off[1]], [c[0] + off[0], c[1] + off[1]], c])
    }
    return clipAll(half(sg), wins)
  }
  return [...strips(1, sideA), ...strips(-1, sideB)]
}

const G = (c: number, r: number) => rect(c * 0.25, r * 0.25, 0.25, 0.25)

export const P13_FORMES: LayoutDef[] = [
  {
    id: 'p13-06', photos: 13, family: 'coeurs',
    geo: [
      pix(2, 0, 4, 1), pix(4.8, 0, 6.8, 1), pix(1, 1, 2, 2), pix(4, 1, 4.8, 2), pix(6.8, 1, 7.8, 2), pix(0, 2, 1, 4),
      ([[2, 1], [4, 1], [4, 2], [4.8, 2], [4.8, 1], [6.8, 1], [6.8, 2], [7.8, 2], [7.8, 4], [6.8, 4], [6.8, 5], [5.8, 5], [5.8, 6], [3, 6], [3, 5], [2, 5], [2, 4], [1, 4], [1, 2], [2, 2]] as Pt[]).map(([c, r]) => pixG(c, r)),
      pix(7.8, 2, 8.8, 4), pix(1, 4, 2, 5), pix(6.8, 4, 7.8, 5), pix(2, 5, 3, 6), pix(5.8, 5, 6.8, 6), pix(3, 6, 5.8, 7),
    ].map((p) => poly(...p)),
  },
  {
    id: 'p13-08', photos: 13, family: 'geometrie',
    geo: hexes([[0, 0], [1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [2, 2], [3, 2], [0, 3], [1, 3], [2, 3]], 0.215, 0.13, 0.23),
  },
  {
    id: 'p13-09', photos: 13, family: 'coupe',
    geo: ordered([
      ...chevronCols([0, 0.25, 0.5, 0.75], [[0.3, 0.24, 0.34, 0.26], [0.7, 0.66, 0.74, 0.68]]),
      ...chevronCols([0.75, 1], [[0.26, 0.2], [0.47, 0.4], [0.68, 0.62]]),
    ], 'rows', 0.1),
  },
  {
    id: 'p13-10', photos: 13, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.21, 0.21, 0.81, 0.81]),
      [[0.21, 0.21], [0.51, 0.21], [0.51, 0.39], [0.39, 0.39], [0.39, 0.51], [0.21, 0.51]],
      [[0.51, 0.21], [0.81, 0.21], [0.81, 0.51], [0.63, 0.51], [0.63, 0.39], [0.51, 0.39]],
      R(0.39, 0.39, 0.63, 0.63),
      [[0.21, 0.51], [0.39, 0.51], [0.39, 0.63], [0.51, 0.63], [0.51, 0.81], [0.21, 0.81]],
      [[0.63, 0.51], [0.81, 0.51], [0.81, 0.81], [0.51, 0.81], [0.51, 0.63], [0.63, 0.63]],
    ]),
  },
  {
    id: 'p13-13', photos: 13, family: 'coupe',
    geo: [
      ...bandRow([0, 0], [0.37, 0.27], [0.21, 0.41, 0.62, 0.82]),
      ...bandRow([0.37, 0.27], [0.75, 0.65], [0.3, 0.72]),
      ...bandRow([0.75, 0.65], [1, 1], [0.21, 0.42, 0.63, 0.83]),
    ].map((p) => poly(...p)),
  },
  {
    id: 'p13-15', photos: 13, family: 'coeurs',
    geo: [
      shapeAt('heart', 0.5, 0.48, 0.42),
      ...[0.14, 0.38, 0.62, 0.87].map((x) => shapeAt('heart', x, 0.17, 0.17)),
      ...[0.4, 0.62].flatMap((y) => [shapeAt('heart', 0.14, y, 0.17), shapeAt('heart', 0.87, y, 0.17)]),
      ...[0.14, 0.38, 0.62, 0.87].map((x) => shapeAt('heart', x, 0.84, 0.17)),
    ],
  },
  {
    id: 'p13-20', photos: 13, family: 'coeurs',
    geo: [G(0, 0), G(1, 0), G(2, 0), G(3, 0), G(0, 1), shapeAt('heart', 0.5, 0.5, 0.44), G(3, 1), G(0, 2), G(3, 2), G(0, 3), G(1, 3), G(2, 3), G(3, 3)],
  },
  {
    id: 'p13-26', photos: 13, family: 'illustre',
    geo: ordered(veinedLeaf([0.19, 0.74], [0.92, 0.12], 0.2, [0.15, 0.3, 0.45, 0.6, 0.75], [0.12, 0.25, 0.38, 0.51, 0.64, 0.78])),
    decor: [{ d: stem([0.2, 0.73], [0.07, 0.9]), fill: 'ink' }],
  },
]
