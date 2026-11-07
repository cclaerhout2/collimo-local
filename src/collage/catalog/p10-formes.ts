import type { Pt } from '../path'
import { hexes, poly, rect, shapeAt, type CellDef } from '../shapes'
import type { LayoutDef } from '../types'
import { byReading, oval } from './p06-formes'

// Cœur à facettes (10 pièces triangulaires et quadrilatères).
const A: Pt = [0.5, 0.25]
const B: Pt = [0.2, 0.08]
const C: Pt = [0.38, 0.1]
const D: Pt = [0.62, 0.1]
const E: Pt = [0.8, 0.08]
const F: Pt = [0.05, 0.28]
const G: Pt = [0.95, 0.28]
const H: Pt = [0.1, 0.48]
const I: Pt = [0.9, 0.48]
const J: Pt = [0.5, 0.95]
const K: Pt = [0.3, 0.35]
const L: Pt = [0.7, 0.35]
const M: Pt = [0.5, 0.6]

// Feuille nervurée : axe de P0 à P1, demi-largeur hw(t), 4 nervures par côté → 5 pièces par côté.
const P0: Pt = [0.14, 0.86]
const P1: Pt = [0.94, 0.06]
const ax = (t: number): Pt => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t]
const hw = (t: number) => 0.3 * Math.sin(Math.PI * t) * (1 - 0.3 * t)
const NRM: Pt = [Math.SQRT1_2, Math.SQRT1_2]
const edgeAt = (t: number, s: number): Pt => {
  const p = ax(t)
  return [p[0] + s * hw(t) * NRM[0], p[1] + s * hw(t) * NRM[1]]
}
const AX_T = [0, 0.2, 0.38, 0.56, 0.74, 1]
const ED_T = [0, 0.32, 0.5, 0.68, 0.86, 1]
const leaf: CellDef[] = [-1, 1].flatMap((s) =>
  AX_T.slice(0, -1).map((a0, k) => {
    const a1 = AX_T[k + 1]
    const e0 = ED_T[k]
    const e1 = ED_T[k + 1]
    const n = 8
    const pts: Pt[] = []
    for (let i = 0; i <= n; i++) pts.push(ax(a0 + ((a1 - a0) * i) / n))
    for (let i = n; i >= 0; i--) pts.push(edgeAt(e0 + ((e1 - e0) * i) / n, s))
    // Retire les doublons aux extrémités (base et pointe).
    return poly(...pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6))
  }),
)

// Cadre en perspective : 4 trapèzes coupés en deux + centre coupé en deux.
const q = 0.22
const r = 0.78

/** Dispositions en forme pour 10 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P10_FORMES: LayoutDef[] = [
  {
    id: 'p10-12',
    photos: 10,
    family: 'coeurs',
    geo: [poly(F, B, C, K), poly(C, A, K), poly(A, D, L), poly(D, E, G, L), poly(F, K, H), poly(K, A, M), poly(A, L, M), poly(L, G, I), poly(H, K, M, J), poly(M, L, I, J)],
  },
  {
    id: 'p10-13',
    photos: 10,
    family: 'geometrie',
    geo: hexes([[0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 0.235, 0.267, 0.297),
  },
  {
    id: 'p10-14',
    photos: 10,
    family: 'coupe',
    geo: byReading([
      poly([0, 0], [0.5, 0], [0.5, q], [q, q]),
      poly([0.5, 0], [1, 0], [r, q], [0.5, q]),
      poly([0, 0], [q, q], [q, 0.5], [0, 0.5]),
      poly([0, 0.5], [q, 0.5], [q, r], [0, 1]),
      poly([1, 0], [1, 0.5], [r, 0.5], [r, q]),
      poly([1, 0.5], [1, 1], [r, r], [r, 0.5]),
      poly([0, 1], [q, r], [0.5, r], [0.5, 1]),
      poly([0.5, 1], [0.5, r], [r, r], [1, 1]),
      rect(q, q, 0.5 - q, r - q),
      rect(0.5, q, r - 0.5, r - q),
    ]),
  },
  {
    id: 'p10-15',
    photos: 10,
    family: 'coeurs',
    geo: byReading([
      shapeAt('heart', 0.16, 0.15, 0.29),
      shapeAt('heart', 0.5, 0.15, 0.29),
      shapeAt('heart', 0.84, 0.15, 0.29),
      shapeAt('heart', 0.5, 0.38, 0.29),
      shapeAt('heart', 0.16, 0.45, 0.29),
      shapeAt('heart', 0.84, 0.45, 0.29),
      shapeAt('heart', 0.5, 0.62, 0.29),
      shapeAt('heart', 0.16, 0.8, 0.29),
      shapeAt('heart', 0.84, 0.8, 0.29),
      shapeAt('heart', 0.5, 0.85, 0.29),
    ]),
  },
  {
    id: 'p10-16',
    photos: 10,
    family: 'illustre',
    geo: leaf,
    decor: [{ d: 'M0.135 0.855L0.155 0.875L0.06 0.97L0.04 0.95Z', fill: 'ink' }],
  },
  {
    id: 'p10-19',
    photos: 10,
    family: 'coupe',
    geo: [
      rect(0, 0, 0.47, 0.2),
      rect(0.47, 0, 0.53, 0.2),
      rect(0, 0.2, 0.25, 0.3),
      poly([0.25, 0.2], [0.75, 0.2], [0.25, 0.8]),
      rect(0.75, 0.2, 0.25, 0.3),
      rect(0, 0.5, 0.25, 0.3),
      poly([0.75, 0.2], [0.75, 0.8], [0.25, 0.8]),
      rect(0.75, 0.5, 0.25, 0.3),
      rect(0, 0.8, 0.47, 0.2),
      rect(0.47, 0.8, 0.53, 0.2),
    ],
  },
  {
    id: 'p10-21',
    photos: 10,
    family: 'ronds',
    geo: [
      oval(0.18, 0.2, 0.25, 0.32),
      shapeAt('circle', 0.5, 0.17, 0.18),
      oval(0.83, 0.2, 0.25, 0.32),
      shapeAt('circle', 0.43, 0.4, 0.18),
      oval(0.18, 0.5, 0.25, 0.32),
      oval(0.83, 0.5, 0.25, 0.32),
      shapeAt('circle', 0.57, 0.6, 0.18),
      oval(0.18, 0.82, 0.25, 0.32),
      shapeAt('circle', 0.5, 0.82, 0.18),
      oval(0.83, 0.82, 0.25, 0.32),
    ],
  },
  {
    id: 'p10-22',
    photos: 10,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.27, 0], [0.24, 0.27], [0, 0.27]),
      poly([0.27, 0], [0.5, 0], [0.47, 0.27], [0.24, 0.27]),
      poly([0.5, 0], [0.75, 0], [0.72, 0.27], [0.47, 0.27]),
      poly([0.75, 0], [1, 0], [1, 0.27], [0.72, 0.27]),
      poly([0, 0.27], [0.45, 0.27], [0.53, 0.68], [0, 0.68]),
      poly([0.45, 0.27], [1, 0.27], [1, 0.68], [0.53, 0.68]),
      poly([0, 0.68], [0.29, 0.68], [0.26, 1], [0, 1]),
      poly([0.29, 0.68], [0.52, 0.68], [0.49, 1], [0.26, 1]),
      poly([0.52, 0.68], [0.77, 0.68], [0.74, 1], [0.49, 1]),
      poly([0.77, 0.68], [1, 0.68], [1, 1], [0.74, 1]),
    ],
  },
]
