import type { Pt } from '../path'
import { cutFrame, poly, puzzle, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { byReading, heartPieces, radial } from './p06-formes'

// Étoile à 7 branches au centre, rayons depuis les pointes jusqu'au cadre.
const polar = (r: number, deg: number): Pt => [0.5 + r * Math.cos((deg * Math.PI) / 180), 0.5 + r * Math.sin((deg * Math.PI) / 180)]
const TIPS: Pt[] = Array.from({ length: 7 }, (_, i) => polar(0.2, -90 + (i * 360) / 7))
const INNER: Pt[] = Array.from({ length: 7 }, (_, i) => polar(0.11, -90 + ((i + 0.5) * 360) / 7))
const STAR: Pt[] = TIPS.flatMap((t, i) => [t, INNER[i]])
const starRays = radial([0.5, 0.5], TIPS, TIPS.map((t) => [t[0] - 0.5, t[1] - 0.5] as Pt), INNER.map((p) => [p]))

const hx = (cx: number, cy: number, sz: number) => shapeAt('hexagon', cx, cy, sz)

/** Dispositions en forme pour 8 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P08_FORMES: LayoutDef[] = [
  {
    id: 'p08-05',
    photos: 8,
    family: 'geometrie',
    geo: [
      poly([0, 0], [0.365, 0], [0.23, 0.25], [0, 0.25]),
      poly([0.635, 0], [1, 0], [1, 0.25], [0.77, 0.25]),
      poly([0.365, 0], [0.635, 0], [0.77, 0.25], [0.635, 0.5], [0.365, 0.5], [0.23, 0.25]),
      poly([0, 0.25], [0.23, 0.25], [0.365, 0.5], [0.23, 0.75], [0, 0.75]),
      poly([1, 0.25], [1, 0.75], [0.77, 0.75], [0.635, 0.5], [0.77, 0.25]),
      poly([0.365, 0.5], [0.635, 0.5], [0.77, 0.75], [0.635, 1], [0.365, 1], [0.23, 0.75]),
      poly([0, 0.75], [0.23, 0.75], [0.365, 1], [0, 1]),
      poly([1, 0.75], [1, 1], [0.635, 1], [0.77, 0.75]),
    ],
  },
  { id: 'p08-06', photos: 8, family: 'puzzle', geo: puzzle(3, 3).filter((_, i) => i !== 4) },
  { id: 'p08-07', photos: 8, family: 'geometrie', geo: byReading([...starRays, poly(...STAR)]) },
  {
    id: 'p08-08',
    photos: 8,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.35, 0], [0.35, 0.33], [0, 0.33]),
      poly([0.35, 0], [0.65, 0], [0.65, 0.33], [0.5, 0.5], [0.35, 0.33]),
      poly([0.65, 0], [1, 0], [1, 0.33], [0.65, 0.33]),
      poly([0, 0.33], [0.35, 0.33], [0.5, 0.5], [0.35, 0.67], [0, 0.67]),
      poly([1, 0.33], [1, 0.67], [0.65, 0.67], [0.5, 0.5], [0.65, 0.33]),
      poly([0, 0.67], [0.35, 0.67], [0.35, 1], [0, 1]),
      poly([0.35, 0.67], [0.5, 0.5], [0.65, 0.67], [0.65, 1], [0.35, 1]),
      poly([0.65, 0.67], [1, 0.67], [1, 1], [0.65, 1]),
    ],
  },
  {
    id: 'p08-09',
    photos: 8,
    family: 'geometrie',
    geo: [
      shapeAt('diamond', 0.17, 0.2, 0.425),
      shapeAt('diamond', 0.5, 0.2, 0.425),
      shapeAt('diamond', 0.83, 0.2, 0.425),
      shapeAt('diamond', 0.33, 0.5, 0.425),
      shapeAt('diamond', 0.67, 0.5, 0.425),
      shapeAt('diamond', 0.17, 0.8, 0.425),
      shapeAt('diamond', 0.5, 0.8, 0.425),
      shapeAt('diamond', 0.83, 0.8, 0.425),
    ],
  },
  {
    id: 'p08-10',
    photos: 8,
    family: 'coeurs',
    geo: [
      shapeAt('heart', 0.22, 0.2, 0.360),
      shapeAt('heart', 0.78, 0.2, 0.360),
      shapeAt('heart', 0.5, 0.33, 0.360),
      shapeAt('heart', 0.22, 0.48, 0.360),
      shapeAt('heart', 0.78, 0.48, 0.360),
      shapeAt('heart', 0.5, 0.6, 0.360),
      shapeAt('heart', 0.22, 0.8, 0.360),
      shapeAt('heart', 0.78, 0.8, 0.360),
    ],
  },
  {
    id: 'p08-12',
    photos: 8,
    family: 'geometrie',
    geo: [hx(0.18, 0.3, 0.3), hx(0.4, 0.2, 0.3), hx(0.62, 0.32, 0.3), hx(0.4, 0.46, 0.3), hx(0.62, 0.52, 0.3), hx(0.84, 0.62, 0.3), hx(0.42, 0.74, 0.3), hx(0.64, 0.84, 0.3)],
  },
  { id: 'p08-29', photos: 8, family: 'coeurs', geo: heartPieces(3, 2) },
  {
    id: 'p08-30',
    photos: 8,
    family: 'coeurs',
    geo: [
      shapeAt('heart', 0.2, 0.15, 0.269),
      shapeAt('heart', 0.5, 0.15, 0.269),
      shapeAt('heart', 0.8, 0.15, 0.269),
      shapeAt('heart', 0.28, 0.47, 0.470),
      shapeAt('heart', 0.72, 0.47, 0.470),
      shapeAt('heart', 0.2, 0.83, 0.269),
      shapeAt('heart', 0.5, 0.83, 0.269),
      shapeAt('heart', 0.8, 0.83, 0.269),
    ],
  },
  { id: 'p08-32', photos: 8, family: 'coupe', geo: cutFrame([[[0, 0.28], [1, 0.2]], [[0, 0.47], [1, 0.53]], [[0, 0.78], [1, 0.72]], [[0.47, 0], [0.55, 1]]]) },
]
