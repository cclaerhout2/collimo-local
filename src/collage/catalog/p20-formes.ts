import { cutFrame, hexes, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { R, frameRing, ordered, ovalAt } from './p11-formes'

export const P20_FORMES: LayoutDef[] = [
  {
    id: 'p20-07', photos: 20, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.22, 0.22, 0.78, 0.78]),
      ...frameRing([0.22, 0.22, 0.78, 0.78], [0.38, 0.38, 0.62, 0.62]),
      R(0.38, 0.38, 0.5, 0.5), R(0.5, 0.38, 0.62, 0.5), R(0.38, 0.5, 0.5, 0.62), R(0.5, 0.5, 0.62, 0.62),
    ], 'rows', 0.04),
  },
  {
    id: 'p20-13', photos: 20, family: 'coupe',
    geo: cutFrame([
      [[0.26, 0], [0.26, 1]], [[0.5, 0], [0.5, 1]], [[0.74, 0], [0.74, 1]],
      [[0, 0.27], [1, 0.14]], [[0, 0.48], [1, 0.34]], [[0, 0.67], [1, 0.53]], [[0, 0.86], [1, 0.74]],
    ], 'cols'),
  },
  {
    id: 'p20-14', photos: 20, family: 'ronds',
    geo: [
      ovalAt(0.26, 0.13, 0.1, 0.14), ovalAt(0.5, 0.14, 0.2, 0.12), ovalAt(0.73, 0.13, 0.1, 0.14),
      ovalAt(0.13, 0.27, 0.13, 0.09), shapeAt('circle', 0.29, 0.29, 0.09), shapeAt('circle', 0.71, 0.29, 0.09), ovalAt(0.87, 0.27, 0.13, 0.09),
      shapeAt('circle', 0.5, 0.36, 0.15),
      ovalAt(0.14, 0.5, 0.13, 0.25), shapeAt('circle', 0.36, 0.5, 0.15), shapeAt('circle', 0.64, 0.5, 0.15), ovalAt(0.86, 0.5, 0.13, 0.25),
      shapeAt('circle', 0.5, 0.64, 0.15),
      ovalAt(0.13, 0.74, 0.13, 0.09), shapeAt('circle', 0.29, 0.72, 0.09), shapeAt('circle', 0.71, 0.72, 0.09), ovalAt(0.87, 0.74, 0.13, 0.09),
      ovalAt(0.26, 0.87, 0.1, 0.14), ovalAt(0.5, 0.86, 0.2, 0.12), ovalAt(0.73, 0.87, 0.1, 0.14),
    ],
  },
  {
    id: 'p20-15', photos: 20, family: 'geometrie',
    geo: hexes([[0, 0], [1, 0], [3, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [-1, 3], [0, 3], [1, 3], [2, 3], [3, 3], [0, 4], [2, 4], [3, 4]], 0.17, 0.24, 0.2),
  },
]
