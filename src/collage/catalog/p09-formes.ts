import type { Pt } from '../path'
import { cutFrame, poly, puzzle, shapeAt, shapeGrid, type CellDef } from '../shapes'
import type { LayoutDef } from '../types'
import { byReading, curvedGrid, ringToward } from './p06-formes'

// Grand losange central entouré de 8 petits losanges, deux le long de chaque côté.
const DM: Pt[] = [[0.5, 0.18], [0.82, 0.5], [0.5, 0.82], [0.18, 0.5]]
const around: CellDef[] = DM.flatMap((p, i) => {
  const q = DM[(i + 1) % 4]
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const len = Math.hypot(dx, dy)
  // Normale extérieure (sens horaire à l'écran → normale à gauche du trajet).
  const nx = dy / len
  const ny = -dx / len
  return [0.28, 0.72].map((t) => shapeAt('diamond', p[0] + dx * t + nx * 0.12, p[1] + dy * t + ny * 0.13, 0.26))
})

const S = Math.sin
const PI = Math.PI

/** Dispositions en forme pour 9 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P09_FORMES: LayoutDef[] = [
  { id: 'p09-05', photos: 9, family: 'puzzle', geo: puzzle(3, 3) },
  { id: 'p09-06', photos: 9, family: 'geometrie', geo: byReading([poly(...DM), ...around]) },
  { id: 'p09-08', photos: 9, family: 'ronds', geo: shapeGrid('circle', 3, 3, undefined, 0.02) },
  { id: 'p09-14', photos: 9, family: 'coupe', geo: cutFrame([[[0.28, 0], [0.38, 1]], [[0.62, 0], [0.7, 1]], [[0, 0.38], [1, 0.25]], [[0, 0.72], [1, 0.6]]]) },
  {
    id: 'p09-15',
    photos: 9,
    family: 'coupe',
    geo: curvedGrid(
      [(y) => 0.42 - 0.22 * y + 0.05 * S(PI * y), (y) => 0.8 - 0.25 * y + 0.05 * S(PI * y)],
      [(x) => 0.25 + 0.12 * x + 0.05 * S(PI * x), (x) => 0.68 + 0.08 * S(PI * x)],
    ),
  },
  { id: 'p09-17', photos: 9, family: 'coeurs', geo: byReading([shapeAt('heart', 0.5, 0.5, 0.46), ...ringToward('heart', 8, 0.23, 0.37)]) },
  {
    id: 'p09-18',
    photos: 9,
    family: 'geometrie',
    geo: byReading([
      shapeAt('hexagon-flat', 0.5, 0.15, 0.3),
      shapeAt('hexagon-flat', 0.5, 0.43, 0.3),
      shapeAt('hexagon-flat', 0.5, 0.7, 0.3),
      shapeAt('hexagon-flat', 0.24, 0.29, 0.3),
      shapeAt('hexagon-flat', 0.24, 0.57, 0.3),
      shapeAt('hexagon-flat', 0.24, 0.84, 0.3),
      shapeAt('hexagon-flat', 0.76, 0.29, 0.3),
      shapeAt('hexagon-flat', 0.76, 0.57, 0.3),
      shapeAt('hexagon-flat', 0.76, 0.84, 0.3),
    ], 0.04),
  },
  { id: 'p09-21', photos: 9, family: 'ronds', geo: shapeGrid('flower', 3, 3, undefined, 0.02) },
  {
    id: 'p09-22',
    photos: 9,
    family: 'illustre',
    geo: [
      shapeAt('spade', 0.25, 0.12, 0.25),
      shapeAt('spade', 0.75, 0.12, 0.25),
      shapeAt('spade', 0.25, 0.37, 0.25),
      shapeAt('spade', 0.75, 0.37, 0.25),
      shapeAt('spade', 0.5, 0.5, 0.25),
      shapeAt('spade', 0.25, 0.63, 0.25, { rotate: 180 }),
      shapeAt('spade', 0.75, 0.63, 0.25, { rotate: 180 }),
      shapeAt('spade', 0.25, 0.88, 0.25, { rotate: 180 }),
      shapeAt('spade', 0.75, 0.88, 0.25, { rotate: 180 }),
    ],
  },
  { id: 'p09-23', photos: 9, family: 'coeurs', geo: shapeGrid('heart', 3, 3, undefined, 0.02) },
]
