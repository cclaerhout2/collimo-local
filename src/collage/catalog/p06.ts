import type { LayoutDef, Rect } from '../types'

/** Grille 3 × 3 dont on ne garde que certaines cases (col, ligne). */
const third = (cells: [number, number][]): Rect[] => cells.map(([c, r]) => ({ x: c / 3, y: r / 3, w: 1 / 3, h: 1 / 3 }))

/** Dispositions en rectangles pour 6 photo(s), dans l'ordre des captures de référence. */
export const P06: LayoutDef[] = [
  { id: 'p06-01', photos: 6, family: 'grille', split: 'r(c(x,x,x), c(x,x,x))' },
  { id: 'p06-02', photos: 6, family: 'grille', split: 'r(c(x,x), c(x,x), c(x,x))' },
  { id: 'p06-03', photos: 6, family: 'mixte', split: 'r(2*c(2*x, r(x,x)), c(x,x,x))' },
  { id: 'p06-04', photos: 6, family: 'mixte', split: 'r(c(x,x,x), 2*c(r(x,x), 2*x))' },
  { id: 'p06-05', photos: 6, family: 'mixte', split: 'c(r(5*x,3*x), r(x,x), r(x,2*x))' },
  { id: 'p06-06', photos: 6, family: 'mixte', split: 'r(c(5*x,3*x), c(x,x), c(x,2*x))' },
  { id: 'p06-09', photos: 6, family: 'mixte', split: 'c(r(2*x,x), r(x,2*x), r(2*x,x))' },
  { id: 'p06-10', photos: 6, family: 'mixte', split: 'r(c(5*x,3*x), c(x,2*x), c(5*x,3*x))' },
  { id: 'p06-11', photos: 6, family: 'fond', rects: third([[2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]) },
  {
    id: 'p06-13',
    photos: 6,
    family: 'fond',
    rects: [0, 1].flatMap((r) => [0, 1, 2].map((c) => ({ x: c / 3, y: r * 0.34, w: 1 / 3, h: 0.34 }))),
  },
  {
    id: 'p06-14',
    photos: 6,
    family: 'fond',
    rects: [0, 1, 2].flatMap((r) => [0, 1].map((c) => ({ x: 0.32 + c * 0.34, y: r / 3, w: 0.34, h: 1 / 3 }))),
  },
  { id: 'p06-15', photos: 6, family: 'mixte', split: 'r(2*c(x,x), c(x,x,x,x))' },
  { id: 'p06-16', photos: 6, family: 'mixte', split: 'r(2*x, c(x,x,x,x,x))' },
  { id: 'p06-21', photos: 6, family: 'mixte', split: 'r(c(x,x), 2*c(x,x), c(x,x))' },
  { id: 'p06-22', photos: 6, family: 'mixte', split: 'r(x, c(3*x,4*x,3*x), c(x,x))' },
  { id: 'p06-23', photos: 6, family: 'mixte', split: 'r(x, 2*c(2*r(c(x,x), c(x,x)), x))' },
  { id: 'p06-24', photos: 6, family: 'mixte', split: 'c(r(2*x,x,x), r(x,x,2*x))' },
  {
    id: 'p06-25',
    photos: 6,
    family: 'fond',
    rects: [0, 1].flatMap((r) => [0, 1, 2].map((c) => ({ x: c / 3, y: 0.25 + r * 0.25, w: 1 / 3, h: 0.25 }))),
  },
  {
    id: 'p06-26',
    photos: 6,
    family: 'fond',
    rects: [0, 1, 2].flatMap((r) => [0, 1].map((c) => ({ x: 0.25 + c * 0.25, y: r / 3, w: 0.25, h: 1 / 3 }))),
  },
  {
    id: 'p06-29',
    photos: 6,
    family: 'fond',
    rects: [0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 0.172, y: 0.5 - i * 0.1, w: 0.14, h: 0.5 })),
  },
  { id: 'p06-30', photos: 6, family: 'mixte', split: 'r(x, c(x,x), c(x,x,x))' },
]
