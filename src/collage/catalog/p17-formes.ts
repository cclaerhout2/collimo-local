import { hexes, rect, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { R, frameRing, ordered, ovalAt } from './p11-formes'

const holes = (y: number) => Array.from({ length: 8 }, (_, k) => rect(0.06 + k * 0.114, y, 0.08, 0.07))

export const P17_FORMES: LayoutDef[] = [
  { id: 'p17-10', photos: 17, family: 'illustre', geo: [...holes(0.2), rect(0.06, 0.31, 0.88, 0.39), ...holes(0.73)] },
  {
    id: 'p17-11', photos: 17, family: 'geometrie',
    geo: hexes([[0, 0], [1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [2, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3], [0, 4], [2, 4], [3, 4]], 0.2, 0.15, 0.15),
  },
  {
    id: 'p17-12', photos: 17, family: 'ronds',
    geo: [
      shapeAt('circle', 0.16, 0.12, 0.15), shapeAt('circle', 0.5, 0.12, 0.15), shapeAt('circle', 0.83, 0.12, 0.15),
      shapeAt('circle', 0.16, 0.31, 0.15), ovalAt(0.38, 0.31, 0.15, 0.2), ovalAt(0.61, 0.31, 0.15, 0.2), shapeAt('circle', 0.83, 0.31, 0.15),
      shapeAt('circle', 0.16, 0.5, 0.15), shapeAt('circle', 0.5, 0.5, 0.15), shapeAt('circle', 0.83, 0.5, 0.15),
      shapeAt('circle', 0.16, 0.69, 0.15), ovalAt(0.38, 0.69, 0.15, 0.2), ovalAt(0.61, 0.69, 0.15, 0.2), shapeAt('circle', 0.83, 0.69, 0.15),
      shapeAt('circle', 0.16, 0.88, 0.15), shapeAt('circle', 0.5, 0.89, 0.15), shapeAt('circle', 0.83, 0.88, 0.15),
    ],
  },
  {
    id: 'p17-15', photos: 17, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.21, 0.21, 0.79, 0.79]),
      R(0.21, 0.21, 0.41, 0.36), R(0.41, 0.21, 0.62, 0.36), R(0.62, 0.21, 0.79, 0.36),
      R(0.21, 0.36, 0.36, 0.57), R(0.36, 0.36, 0.62, 0.62), R(0.62, 0.36, 0.79, 0.62),
      R(0.21, 0.57, 0.36, 0.79), R(0.36, 0.62, 0.57, 0.79), R(0.57, 0.62, 0.79, 0.79),
    ]),
  },
]
