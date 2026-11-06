import { crossCut, cutFrame, mirror4, pieDisc, poly, puzzle, shapeAt, path } from '../shapes'
import type { LayoutDef } from '../types'

/** Dispositions en forme pour 4 photos (étape 6), numérotées comme dans l'inventaire. */
export const P04_FORMES: LayoutDef[] = [
  { id: 'p04-07', photos: 4, family: 'puzzle', geo: puzzle(2, 2) },
  { id: 'p04-08', photos: 4, family: 'dechire', geo: crossCut(0.48, 0.5, 'torn', 0.035) },
  { id: 'p04-09', photos: 4, family: 'ronds', geo: [shapeAt('flower', 0.29, 0.27, 0.4), shapeAt('flower', 0.71, 0.38, 0.4), shapeAt('flower', 0.29, 0.62, 0.4), shapeAt('flower', 0.71, 0.76, 0.4)] },
  { id: 'p04-10', photos: 4, family: 'coeurs', geo: [shapeAt('rounded', 0.26, 0.26, 0.44), shapeAt('heart', 0.74, 0.26, 0.46), shapeAt('heart', 0.26, 0.74, 0.46), shapeAt('rounded', 0.74, 0.74, 0.44)] },
  { id: 'p04-13', photos: 4, family: 'coeurs', geo: [shapeAt('heart', 0.3, 0.47, 0.52), shapeAt('heart', 0.66, 0.2, 0.28), shapeAt('heart', 0.78, 0.47, 0.28), shapeAt('heart', 0.66, 0.77, 0.28)] },
  { id: 'p04-14', photos: 4, family: 'geometrie', geo: [shapeAt('hexagon', 0.42, 0.23, 0.32), shapeAt('hexagon', 0.76, 0.27, 0.32), shapeAt('hexagon', 0.59, 0.53, 0.32), shapeAt('hexagon', 0.25, 0.76, 0.32)] },
  {
    id: 'p04-15',
    photos: 4,
    family: 'coupe',
    geo: [
      path('M0 0H0.45C0.45 0.2 0.25 0.42 0 0.42Z'),
      path('M0.45 0H1V0.5C0.72 0.5 0.45 0.28 0.45 0Z'),
      path('M0 0.42C0.25 0.42 0.45 0.62 0.45 1H0Z'),
      path('M1 0.5V1H0.45C0.45 0.62 0.25 0.42 0 0.42V0.42C0.3 0.42 0.45 0.32 0.45 0C0.45 0.28 0.72 0.5 1 0.5Z'),
    ],
  },
  { id: 'p04-16', photos: 4, family: 'geometrie', geo: [shapeAt('triangle-down', 0.2, 0.22, 0.2), shapeAt('triangle-down', 0.5, 0.42, 0.5), shapeAt('triangle-down', 0.8, 0.22, 0.2), shapeAt('triangle-down', 0.5, 0.8, 0.2)] },
  { id: 'p04-24', photos: 4, family: 'coupe', geo: cutFrame([[[0.27, 0], [0.75, 1]], [[0, 0.72], [1, 0.27]]]) },
  { id: 'p04-25', photos: 4, family: 'coupe', geo: cutFrame([[[0.6, 0], [0.42, 1]], [[0, 0.5], [1, 0.5]]]) },
  { id: 'p04-26', photos: 4, family: 'coupe', geo: cutFrame([[[0.3, 0], [0.3, 1]], [[0.7, 0], [0.7, 1]], [[0.3, 0], [0.7, 1]]], 'cols') },
  { id: 'p04-27', photos: 4, family: 'coupe', geo: cutFrame([[[0, 0.3], [1, 0.3]], [[0, 0.7], [1, 0.7]], [[1, 0.3], [0, 0.7]]]) },
  {
    id: 'p04-28',
    photos: 4,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.6, 0], [0.6, 0.4], [0.4, 0.6], [0, 0.6]),
      poly([0.6, 0], [1, 0], [1, 0.4], [0.6, 0.4]),
      poly([0, 0.6], [0.4, 0.6], [0.4, 1], [0, 1]),
      poly([1, 0.4], [1, 1], [0.4, 1], [0.4, 0.6], [0.6, 0.4]),
    ],
  },
  { id: 'p04-29', photos: 4, family: 'ronds', geo: pieDisc(4, 0.5, 0.5, 0.45, -90) },
  { id: 'p04-30', photos: 4, family: 'ronds', geo: mirror4('M0.48 0.48H0.27C0.15 0.48 0.06 0.38 0.06 0.27C0.06 0.15 0.15 0.06 0.27 0.06C0.38 0.06 0.48 0.15 0.48 0.27Z') },
  { id: 'p04-31', photos: 4, family: 'ronds', geo: mirror4('M0.06 0.06H0.3C0.41 0.06 0.48 0.14 0.48 0.27V0.48H0.27C0.14 0.48 0.06 0.41 0.06 0.3Z') },
  {
    id: 'p04-32',
    photos: 4,
    family: 'geometrie',
    geo: [shapeAt('spade', 0.27, 0.27, 0.38), shapeAt('spade', 0.73, 0.3, 0.42, { rotate: 180 }), shapeAt('spade', 0.27, 0.71, 0.38), shapeAt('spade', 0.73, 0.73, 0.42, { rotate: 180 })],
  },
  { id: 'p04-33', photos: 4, family: 'geometrie', geo: [shapeAt('diamond', 0.27, 0.27, 0.5), shapeAt('diamond', 0.73, 0.27, 0.5), shapeAt('diamond', 0.27, 0.73, 0.5), shapeAt('diamond', 0.73, 0.73, 0.5)] },
  { id: 'p04-35', photos: 4, family: 'coupe', geo: cutFrame([[[0, 0], [1, 1]], [[1, 0], [0, 1]]]) },
  {
    id: 'p04-36',
    photos: 4,
    family: 'fond',
    geo: [
      poly([0, 0], [0.5, 0], [0.5, 0.3], [0.3, 0.3], [0.3, 0.5], [0, 0.5]),
      poly([0.5, 0], [1, 0], [1, 0.5], [0.7, 0.5], [0.7, 0.3], [0.5, 0.3]),
      poly([0, 0.5], [0.3, 0.5], [0.3, 0.7], [0.5, 0.7], [0.5, 1], [0, 1]),
      poly([0.7, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.7], [0.7, 0.7]),
    ],
  },
  { id: 'p04-37', photos: 4, family: 'coupe', geo: cutFrame([[[0, 0.5], [0.5, 0]], [[0, 1], [1, 0]], [[0.5, 1], [1, 0.5]]]) },
  { id: 'p04-38', photos: 4, family: 'coupe', geo: cutFrame([[[0.5, 0], [1, 0.5]], [[0, 0], [1, 1]], [[0, 0.5], [0.5, 1]]]) },
  { id: 'p04-39', photos: 4, family: 'coupe', geo: cutFrame([[[0, 0.38], [1, 0.06]], [[0, 0.38], [1, 0.78]], [[0, 1], [1, 0.78]]]) },
  {
    id: 'p04-40',
    photos: 4,
    family: 'coupe',
    geo: [
      poly([0, 0], [1, 0], [1, 0.06], [0.45, 0.45]),
      poly([1, 0.06], [1, 1], [0.45, 0.45]),
      poly([0, 0], [0.55, 0.55], [0, 0.94]),
      poly([0, 0.94], [0.55, 0.55], [1, 1], [0, 1]),
    ],
  },
]
