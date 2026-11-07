/**
 * Dispositions « en forme » du catalogue pour 16 photos : polygones, chemins SVG et formes de la bibliothèque
 * (champ `geo`), en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import { cutFrame, hexes, poly, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { bandRow, ordered, ovalAt } from './p11-formes'

/** Point (x, y) en coordonnées du cadre (0–1). */
type Pt = [number, number]

/**
 * Cœur à facettes : contour polygonal et triangles autour de points intérieurs.
 * @returns les 16 triangles : moitié gauche, puis moitié droite obtenue par symétrie
 */
function facetHeart(): Pt[][] {
  const A: Pt = [0.5, 0.22]
  const B: Pt = [0.37, 0.08]
  const C: Pt = [0.15, 0.1]
  const D: Pt = [0.05, 0.3]
  const E: Pt = [0.06, 0.5]
  const F: Pt = [0.22, 0.7]
  const Gt: Pt = [0.5, 0.95]
  const L: Pt = [0.3, 0.4]
  const M: Pt = [0.5, 0.56]
  const left: Pt[][] = [
    [C, B, L],
    [B, A, L],
    [C, L, D],
    [D, L, E],
    [L, A, M],
    [E, L, F],
    [L, M, F],
    [F, M, Gt],
  ]
  const right = left.map((tri) => tri.map(([x, y]) => [1 - x, y] as Pt).reverse())
  return [...left, ...right]
}

/** Mosaïque irrégulière : grille 4 × 4 aux sommets décalés. */
const MOSAIC: Pt[][] = [
  [
    [0, 0],
    [0.22, 0],
    [0.48, 0],
    [0.73, 0],
    [1, 0],
  ],
  [
    [0, 0.29],
    [0.27, 0.25],
    [0.52, 0.28],
    [0.74, 0.24],
    [1, 0.2],
  ],
  [
    [0, 0.47],
    [0.3, 0.5],
    [0.5, 0.45],
    [0.77, 0.5],
    [1, 0.45],
  ],
  [
    [0, 0.72],
    [0.24, 0.7],
    [0.55, 0.75],
    [0.72, 0.68],
    [1, 0.66],
  ],
  [
    [0, 1],
    [0.25, 1],
    [0.5, 1],
    [0.77, 1],
    [1, 1],
  ],
]
/**
 * Cases de la mosaïque irrégulière {@link MOSAIC}.
 * @returns les 16 quadrilatères, rangée par rangée
 */
const mosaic = (): Pt[][] => {
  const out: Pt[][] = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push([MOSAIC[r][c], MOSAIC[r][c + 1], MOSAIC[r + 1][c + 1], MOSAIC[r + 1][c]])
  return out
}

/**
 * Bande de pellicule : n cases étroites légèrement inclinées.
 * @param y0 - bord haut de la bande
 * @param y1 - bord bas de la bande
 * @param n - nombre de cases
 * @returns les cases, de gauche à droite
 */
const filmRow = (y0: number, y1: number, n: number): Pt[][] =>
  bandRow(
    [y0, y0],
    [y1, y1],
    Array.from({ length: n - 1 }, (_, k) => [(k + 1) / n + 0.008, (k + 1) / n - 0.008] as [number, number]),
  )

/** Dispositions en forme pour 16 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P16_FORMES: LayoutDef[] = [
  {
    id: 'p16-08',
    photos: 16,
    family: 'geometrie',
    geo: hexes(
      Array.from({ length: 16 }, (_, k) => [k % 4, Math.floor(k / 4)] as [number, number]),
      0.21,
      0.127,
      0.217,
    ),
  },
  { id: 'p16-11', photos: 16, family: 'coeurs', geo: ordered(facetHeart(), 'rows', 0.07) },
  { id: 'p16-12', photos: 16, family: 'coupe', geo: mosaic().map((p) => poly(...p)) },
  {
    id: 'p16-13',
    photos: 16,
    family: 'ronds',
    geo: [
      ...[0.138, 0.38, 0.62, 0.862].map((x) => shapeAt('circle', x, 0.12, 0.17)),
      ovalAt(0.138, 0.355, 0.24, 0.17),
      shapeAt('circle', 0.5, 0.362, 0.14),
      ovalAt(0.862, 0.355, 0.24, 0.17),
      shapeAt('circle', 0.366, 0.5, 0.14),
      shapeAt('circle', 0.634, 0.5, 0.14),
      ovalAt(0.138, 0.627, 0.24, 0.17),
      shapeAt('circle', 0.5, 0.627, 0.14),
      ovalAt(0.862, 0.627, 0.24, 0.17),
      ...[0.138, 0.38, 0.62, 0.862].map((x) => shapeAt('circle', x, 0.855, 0.17)),
    ],
  },
  {
    id: 'p16-14',
    photos: 16,
    family: 'coupe',
    geo: cutFrame([
      [
        [0.32, 0],
        [0.2, 1],
      ],
      [
        [0.57, 0],
        [0.46, 1],
      ],
      [
        [0.85, 0],
        [0.73, 1],
      ],
      [
        [0, 0.15],
        [1, 0.32],
      ],
      [
        [0, 0.42],
        [1, 0.55],
      ],
      [
        [0, 0.68],
        [1, 0.78],
      ],
    ]),
  },
  {
    id: 'p16-15',
    photos: 16,
    family: 'coupe',
    geo: [...filmRow(0, 0.2, 7), ...bandRow([0.2, 0.2], [0.8, 0.8], [[0.53, 0.48]]), ...filmRow(0.8, 1, 7)].map((p) => poly(...p)),
  },
]
