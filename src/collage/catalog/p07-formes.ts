import type { Pt } from '../path'
import { path, poly, puzzle, rect, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { byReading, oval, radial } from './p06-formes'

// Obturateur : heptagone central (trou), chaque lame prolonge un côté jusqu'au cadre.
const SH: Pt[] = Array.from({ length: 7 }, (_, i) => {
  const a = ((-90 + (i * 360) / 7) * Math.PI) / 180
  return [0.5 + 0.08 * Math.cos(a), 0.5 + 0.08 * Math.sin(a)]
})
const shutter = radial(
  [0.5, 0.5],
  SH,
  SH.map((v, i) => {
    const p = SH[(i + 6) % 7]
    return [v[0] - p[0], v[1] - p[1]] as Pt
  }),
)

// Hexagone central à plat (r = 0.2) et rayons vers le cadre.
const HX: Pt[] = [[0.7, 0.5], [0.6, 0.673], [0.4, 0.673], [0.3, 0.5], [0.4, 0.327], [0.6, 0.327]]
const HT: Pt[] = [[1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5], [0.25, 0], [0.75, 0]]
const hexRays = radial([0.5, 0.5], HX, HX.map((v, i) => [HT[i][0] - v[0], HT[i][1] - v[1]] as Pt))

const a = 0.32
const b = 0.68

/** Dispositions en forme pour 7 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P07_FORMES: LayoutDef[] = [
  { id: 'p07-05', photos: 7, family: 'geometrie', geo: byReading(shutter) },
  { id: 'p07-06', photos: 7, family: 'geometrie', geo: byReading([...hexRays, poly(...HX)]) },
  { id: 'p07-07', photos: 7, family: 'puzzle', geo: puzzle(3, 3).filter((_, i) => i !== 2 && i !== 7) },
  {
    id: 'p07-08',
    photos: 7,
    family: 'geometrie',
    geo: [
      shapeAt('hexagon-flat', 0.500, 0.190, 0.36),
      shapeAt('hexagon-flat', 0.230, 0.345, 0.36),
      shapeAt('hexagon-flat', 0.770, 0.345, 0.36),
      shapeAt('hexagon-flat', 0.500, 0.500, 0.36),
      shapeAt('hexagon-flat', 0.230, 0.655, 0.36),
      shapeAt('hexagon-flat', 0.770, 0.655, 0.36),
      shapeAt('hexagon-flat', 0.500, 0.810, 0.36),
    ],
  },
  {
    id: 'p07-17',
    photos: 7,
    family: 'ronds',
    geo: [
      path('M0 0L0.5 0C0.5 0.276 0.276 0.5 0 0.5Z'),
      oval(0.72, 0.17, 0.3, 0.22),
      shapeAt('circle', 0.8, 0.43, 0.2),
      shapeAt('circle', 0.47, 0.52, 0.26),
      shapeAt('circle', 0.15, 0.64, 0.2),
      path('M0.02 1C0.02 0.9 0.1 0.82 0.2 0.82C0.3 0.82 0.38 0.9 0.38 1Z'),
      path('M1 1L0.5 1C0.5 0.724 0.724 0.5 1 0.5Z'),
    ],
  },
  {
    id: 'p07-18',
    photos: 7,
    family: 'ronds',
    geo: [
      oval(0.27, 0.17, 0.4, 0.26),
      oval(0.73, 0.17, 0.4, 0.26),
      shapeAt('circle', 0.16, 0.5, 0.24),
      oval(0.5, 0.5, 0.3, 0.4),
      shapeAt('circle', 0.84, 0.5, 0.24),
      oval(0.27, 0.83, 0.4, 0.26),
      oval(0.73, 0.83, 0.4, 0.26),
    ],
  },
  {
    id: 'p07-19',
    photos: 7,
    family: 'coeurs',
    geo: [
      shapeAt('heart', 0.35, 0.22, 0.32),
      shapeAt('heart', 0.65, 0.22, 0.32),
      shapeAt('heart', 0.18, 0.5, 0.32),
      shapeAt('heart', 0.5, 0.5, 0.32),
      shapeAt('heart', 0.82, 0.5, 0.32),
      shapeAt('heart', 0.35, 0.78, 0.32),
      shapeAt('heart', 0.65, 0.78, 0.32),
    ],
  },
  {
    id: 'p07-20',
    photos: 7,
    family: 'coeurs',
    geo: [
      shapeAt('heart', 0.5, 0.15, 0.34),
      shapeAt('heart', 0.2, 0.33, 0.34),
      shapeAt('heart', 0.8, 0.33, 0.34),
      shapeAt('heart', 0.5, 0.48, 0.34),
      shapeAt('heart', 0.2, 0.66, 0.34),
      shapeAt('heart', 0.8, 0.66, 0.34),
      shapeAt('heart', 0.5, 0.82, 0.34),
    ],
  },
  {
    id: 'p07-25',
    photos: 7,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.5, 0], [0.5, a], [a, a]),
      poly([0.5, 0], [1, 0], [b, a], [0.5, a]),
      poly([0, 0], [a, a], [a, b], [0, 1]),
      rect(a, a, b - a, b - a),
      poly([1, 0], [1, 1], [b, b], [b, a]),
      poly([0, 1], [a, b], [0.5, b], [0.5, 1]),
      poly([0.5, 1], [0.5, b], [b, b], [1, 1]),
    ],
  },
  {
    id: 'p07-26',
    photos: 7,
    family: 'coupe',
    geo: [
      poly([0.3, 0], [1, 0], [0.7, 0.32], [0.3, 0.32]),
      poly([0, 0], [0.3, 0], [0.3, 0.32], [0, 0.62]),
      poly([0, 0.62], [0.3, 0.32], [0.3, 0.68], [0, 1]),
      rect(0.3, 0.32, 0.4, 0.36),
      poly([1, 0], [1, 0.38], [0.7, 0.68], [0.7, 0.32]),
      poly([1, 0.38], [1, 1], [0.7, 1], [0.7, 0.68]),
      poly([0, 1], [0.3, 0.68], [0.7, 0.68], [0.7, 1]),
    ],
  },
]
