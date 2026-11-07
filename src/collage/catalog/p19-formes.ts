/**
 * Dispositions « en forme » du catalogue pour 19 photos : polygones, chemins SVG et formes de la bibliothèque
 * (champ `geo`), en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import { hexes, poly, rect, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { R, bandRow, ordered } from './p11-formes'
import { brickHeart, roundHeart } from './p18-formes'

/** Point (x, y) en coordonnées du cadre (0–1). */
type Pt = [number, number]

const five: [number, number][] = [
  [0.29, 0.27],
  [0.48, 0.46],
  [0.67, 0.64],
  [0.86, 0.83],
]

/** Dispositions en forme pour 19 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P19_FORMES: LayoutDef[] = [
  {
    id: 'p19-06',
    photos: 19,
    family: 'coeurs',
    geo: brickHeart(roundHeart(0.07, 0.12, 0.93, 0.88), [
      [0, 0.27, [0.27, 0.5, 0.73]],
      [0.27, 0.44, [0.23, 0.41, 0.59, 0.77]],
      [0.44, 0.61, [0.28, 0.43, 0.57, 0.72]],
      [0.61, 0.76, [0.36, 0.5, 0.64]],
      [0.76, 1, []],
    ]).map((p) => poly(...p)),
  },
  {
    id: 'p19-12',
    photos: 19,
    family: 'geometrie',
    geo: [
      rect(0.06, 0.14, 0.15, 0.15),
      shapeAt('circle', 0.33, 0.21, 0.13),
      rect(0.46, 0.16, 0.11, 0.13),
      rect(0.61, 0.23, 0.11, 0.12),
      rect(0.1, 0.33, 0.2, 0.1),
      rect(0.34, 0.33, 0.23, 0.14),
      rect(0.77, 0.33, 0.17, 0.11),
      rect(0.61, 0.39, 0.11, 0.09),
      rect(0.04, 0.47, 0.12, 0.18),
      rect(0.19, 0.47, 0.11, 0.18),
      rect(0.77, 0.48, 0.17, 0.11),
      rect(0.34, 0.51, 0.23, 0.14),
      rect(0.61, 0.53, 0.11, 0.12),
      ...[0.06, 0.21, 0.36, 0.52, 0.67].map((x) => rect(x, 0.69, 0.11, 0.14)),
      shapeAt('circle', 0.88, 0.76, 0.13),
    ],
  },
  {
    id: 'p19-14',
    photos: 19,
    family: 'coupe',
    geo: [
      ...bandRow([0, 0], [0.26, 0.26], five),
      ...bandRow([0.26, 0.26], [0.51, 0.51], five),
      ...bandRow(
        [0.51, 0.51],
        [0.75, 0.75],
        [
          [0.24, 0.22],
          [0.51, 0.49],
          [0.77, 0.75],
        ],
      ),
      ...bandRow([0.75, 0.75], [1, 1], five),
    ].map((p) => poly(...p)),
  },
  {
    id: 'p19-16',
    photos: 19,
    family: 'geometrie',
    geo: ordered([
      R(0, 0, 0.25, 0.26),
      R(0.25, 0, 0.39, 0.26),
      R(0.39, 0, 0.6, 0.26),
      R(0.6, 0, 0.75, 0.26),
      R(0.75, 0, 1, 0.26),
      R(0, 0.26, 0.25, 0.4),
      R(0.75, 0.26, 1, 0.4),
      [
        [0.25, 0.26],
        [0.5, 0.26],
        [0.5, 0.4],
        [0.4, 0.4],
        [0.4, 0.61],
        [0.5, 0.61],
        [0.5, 0.75],
        [0.25, 0.75],
      ] as Pt[],
      [
        [0.5, 0.26],
        [0.75, 0.26],
        [0.75, 0.75],
        [0.5, 0.75],
        [0.5, 0.61],
        [0.6, 0.61],
        [0.6, 0.4],
        [0.5, 0.4],
      ] as Pt[],
      R(0.4, 0.4, 0.6, 0.61),
      R(0, 0.4, 0.25, 0.61),
      R(0.75, 0.4, 1, 0.61),
      R(0, 0.61, 0.25, 0.75),
      R(0.75, 0.61, 1, 0.75),
      R(0, 0.75, 0.25, 1),
      R(0.25, 0.75, 0.39, 1),
      R(0.39, 0.75, 0.6, 1),
      R(0.6, 0.75, 0.75, 1),
      R(0.75, 0.75, 1, 1),
    ]),
  },
  {
    id: 'p19-19',
    photos: 19,
    family: 'geometrie',
    geo: (() => {
      const ys = [0, 0.19, 0.35, 0.62, 0.79, 1]
      const cells: Pt[][] = []
      for (let r = 0; r < 5; r++) {
        const [y0, y1] = [ys[r], ys[r + 1]]
        cells.push(R(0, y0, 0.27, y1))
        if (r % 2) cells.push(R(0.27, y0, 0.42, y1), R(0.42, y0, 0.58, y1), R(0.58, y0, 0.73, y1))
        else cells.push(R(0.27, y0, 0.73, y1))
        cells.push(R(0.73, y0, 1, y1))
      }
      return cells.map((p) => poly(...p))
    })(),
  },
  {
    id: 'p19-20',
    photos: 19,
    family: 'coeurs',
    geo: hexes(
      [
        [1, 0],
        [2, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [-1, 3],
        [0, 3],
        [1, 3],
        [2, 3],
        [3, 3],
        [1, 4],
        [2, 4],
        [1, 5],
      ],
      0.17,
      0.24,
      0.143,
    ),
  },
]
