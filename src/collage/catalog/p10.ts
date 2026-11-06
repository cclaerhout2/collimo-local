import type { LayoutDef, Rect } from '../types'

const box = (x0: number, y0: number, x1: number, y1: number): Rect => ({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })

/** Dispositions en rectangles pour 10 photo(s), dans l'ordre des captures de référence. */
export const P10: LayoutDef[] = [
  { id: 'p10-01', photos: 10, family: 'mixte', split: 'r(2*c(x,x), c(x,x,x,x), c(x,x,x,x))' },
  { id: 'p10-02', photos: 10, family: 'mixte', split: 'r(c(x,x,x), 2.25*c(x, r(x,x), x), c(x,x,x))' },
  { id: 'p10-03', photos: 10, family: 'mixte', split: 'r(c(x,x), 2.3*c(2*x, 5*r(c(x,x), c(x,x)), 2*x), c(x,x))' },
  { id: 'p10-04', photos: 10, family: 'mixte', split: 'c(r(x,x), r(c(x,x), c(x,x), c(x,x), c(x,x)))' },
  { id: 'p10-05', photos: 10, family: 'mixte', split: 'r(c(x, r(c(x,x), c(x,x))), c(r(c(x,x), c(x,x)), x))' },
  { id: 'p10-06', photos: 10, family: 'mixte', split: 'c(r(x,x,x,x), 2*r(x,x), r(x,x,x,x))' },
  { id: 'p10-07', photos: 10, family: 'mixte', split: 'r(c(x,x,x,x), 2.2*c(x,x), c(x,x,x,x))' },
  { id: 'p10-08', photos: 10, family: 'mixte', split: 'r(c(2*x,x), c(2*x, c(x,x)), c(r(x,x), x, r(x,x)))' },
  { id: 'p10-09', photos: 10, family: 'mixte', split: 'r(c(x,2*x), c(x,x,x), c(x,x,x), c(2*x,x))' },
  { id: 'p10-10', photos: 10, family: 'mixte', split: 'r(c(x,2*x,x), 1.4*c(x,x,x,x), c(x,2*x,x))' },
  { id: 'p10-11', photos: 10, family: 'mixte', split: 'r(1.5*c(x,x), c(x,x,x), c(x,x,x), 1.5*c(x,x))' },
  {
    id: 'p10-17',
    photos: 10,
    family: 'mixte',
    rects: [
      box(0, 0, 0.39, 0.3),
      box(0.39, 0, 0.72, 0.3),
      box(0.72, 0, 1, 0.43),
      box(0, 0.3, 0.27, 0.63),
      box(0.27, 0.3, 0.72, 0.52),
      box(0.27, 0.52, 0.72, 0.72),
      box(0.72, 0.43, 1, 0.72),
      box(0, 0.63, 0.27, 1),
      box(0.27, 0.72, 0.6, 1),
      box(0.6, 0.72, 1, 1),
    ],
  },
  { id: 'p10-18', photos: 10, family: 'mixte', split: 'r(c(x,x,x,x), 2.7*c(r(52*x,54*x,32*c(x,x)), r(102*x,42*x)))' },
  { id: 'p10-20', photos: 10, family: 'mixte', split: 'r(c(x,x,x), c(x,x,x,x), c(x,x,x))' },
]
