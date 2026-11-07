/**
 * Dispositions « en forme » du catalogue pour 12 photos : polygones, chemins SVG et formes de la bibliothèque
 * (champ `geo`), en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import { cutFrame, hexes, poly } from '../shapes'
import type { LayoutDef } from '../types'
import { R, frameRing, ordered } from './p11-formes'

/** Point (x, y) en coordonnées du cadre (0–1). */
type Pt = [number, number]

/**
 * Colonnes verticales coupées par des lignes brisées (chevrons).
 * @param xs - abscisses des bords de colonnes, de 0 à 1 compris
 * @param lines - lignes brisées intérieures, de haut en bas : hauteur de chaque ligne à chaque abscisse de `xs`
 * @returns les quadrilatères, rangée par rangée, de gauche à droite
 */
export function chevronCols(xs: number[], lines: number[][]): Pt[][] {
  const rows = [xs.map(() => 0), ...lines, xs.map(() => 1)]
  const out: Pt[][] = []
  for (let r = 0; r + 1 < rows.length; r++)
    for (let c = 0; c + 1 < xs.length; c++)
      out.push([
        [xs[c], rows[r][c]],
        [xs[c + 1], rows[r][c + 1]],
        [xs[c + 1], rows[r + 1][c + 1]],
        [xs[c], rows[r + 1][c]],
      ])
  return out
}

/** Dispositions en forme pour 12 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P12_FORMES: LayoutDef[] = [
  {
    id: 'p12-05',
    photos: 12,
    family: 'coupe',
    geo: cutFrame([
      [
        [0.24, 0],
        [0.24, 1],
      ],
      [
        [0.5, 0],
        [0.5, 1],
      ],
      [
        [0.76, 0],
        [0.76, 1],
      ],
      [
        [0, 0.39],
        [1, 0.24],
      ],
      [
        [0, 0.74],
        [1, 0.59],
      ],
    ]),
  },
  {
    id: 'p12-11',
    photos: 12,
    family: 'geometrie',
    geo: hexes(
      [
        [0, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [2, 3],
      ],
      0.22,
      0.2,
      0.22,
    ),
  },
  {
    id: 'p12-14',
    photos: 12,
    family: 'coupe',
    geo: chevronCols(
      [0, 0.24, 0.5, 0.76, 1],
      [
        [0.26, 0.34, 0.26, 0.34, 0.26],
        [0.6, 0.7, 0.6, 0.7, 0.6],
      ],
    ).map((p) => poly(...p)),
  },
  {
    id: 'p12-16',
    photos: 12,
    family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.19, 0.19, 0.8, 0.8]),
      R(0.19, 0.19, 0.495, 0.495),
      R(0.495, 0.19, 0.8, 0.495),
      R(0.19, 0.495, 0.495, 0.8),
      R(0.495, 0.495, 0.8, 0.8),
    ]),
  },
]
