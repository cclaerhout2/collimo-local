/**
 * Dispositions « en rectangles » du catalogue pour 8 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 8 photo(s), dans l'ordre des captures de référence. */
export const P08: LayoutDef[] = [
  { id: 'p08-01', photos: 8, family: 'grille', split: 'r(c(x,x), c(x,x), c(x,x), c(x,x))' },
  { id: 'p08-02', photos: 8, family: 'grille', split: 'r(c(x,x,x,x), c(x,x,x,x))' },
  { id: 'p08-03', photos: 8, family: 'mixte', split: 'r(c(5*x,3*x), c(3*x,5*x), c(5*x,3*x), c(3*x,5*x))' },
  { id: 'p08-04', photos: 8, family: 'mixte', split: 'c(r(5*x,3*x), r(3*x,5*x), r(5*x,3*x), r(3*x,5*x))' },
  {
    id: 'p08-11',
    photos: 8,
    family: 'fond',
    rects: (
      [
        [3, 0],
        [2, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [3, 2],
        [0, 3],
        [2, 3],
      ] as const
    ).map(([c, r]) => ({ x: c / 4, y: r / 4, w: 0.25, h: 0.25 })),
  },
  { id: 'p08-13', photos: 8, family: 'mixte', split: 'c(r(2*x,x,x), 2*r(x,x), r(x,x,2*x))' },
  { id: 'p08-14', photos: 8, family: 'mixte', split: 'c(r(x, 2*x, c(x,x)), r(c(x,x), 2*x, x))' },
  { id: 'p08-15', photos: 8, family: 'mixte', split: 'r(c(3*x,4*x,6*x), c(x,x,x), 2*c(6*x,7*x))' },
  { id: 'p08-16', photos: 8, family: 'mixte', split: 'r(x, c(x,x), c(x,x,x,x,x))' },
  { id: 'p08-17', photos: 8, family: 'mixte', split: 'r(c(x,x), c(x,x), c(x,x,x,x))' },
  { id: 'p08-18', photos: 8, family: 'mixte', split: 'r(c(27*x,73*x), c(38*x,62*x), c(55*x,45*x), c(67*x,33*x))' },
  { id: 'p08-19', photos: 8, family: 'mixte', split: 'c(r(7*x,3*x), r(6*x,4*x), r(4*x,6*x), r(3*x,7*x))' },
  { id: 'p08-20', photos: 8, family: 'mixte', split: 'r(2*c(4*x,5*x,4*x), 3*c(x,x), 2*c(4*x,5*x,4*x))' },
  { id: 'p08-21', photos: 8, family: 'mixte', split: 'c(2*r(3*x,4*x,3*x), 3*r(x,x), 2*r(3*x,4*x,3*x))' },
  { id: 'p08-22', photos: 8, family: 'mixte', split: 'r(c(c(x,x), r(x,x)), c(r(x,x), c(x,x)))' },
  { id: 'p08-23', photos: 8, family: 'mixte', split: 'r(c(r(x,x), c(x,x)), c(c(x,x), r(x,x)))' },
  { id: 'p08-24', photos: 8, family: 'mixte', split: 'c(r(x,x,x), r(x,x,x), r(x,x))' },
  { id: 'p08-25', photos: 8, family: 'mixte', split: 'c(7*r(x,x,x,x), 3*r(x,x,x,x))' },
  { id: 'p08-26', photos: 8, family: 'mixte', split: 'r(7*c(x,x,x,x), 3*c(x,x,x,x))' },
  {
    id: 'p08-27',
    photos: 8,
    family: 'fond',
    rects: [0, 1].flatMap((r) => [0, 1, 2, 3].map((c) => ({ x: c / 4, y: r * 0.34, w: 0.25, h: 0.34 }))),
  },
  {
    id: 'p08-28',
    photos: 8,
    family: 'fond',
    rects: (
      [
        [1, 0],
        [3, 0],
        [0, 1],
        [2, 1],
        [4, 1],
        [1, 2],
        [3, 2],
        [2, 3],
      ] as const
    ).map(([c, r]) => ({ x: c * 0.2, y: 0.09 + r * 0.2, w: 0.2, h: 0.2 })),
  },
  { id: 'p08-31', photos: 8, family: 'mixte', split: 'r(c(4*x,5*x,4*x), x, x, c(4*x,5*x,4*x))' },
  { id: 'p08-33', photos: 8, family: 'mixte', split: 'r(c(x,x,x), c(2*x,x), c(x,x,x))' },
  { id: 'p08-34', photos: 8, family: 'mixte', split: 'r(2*c(2*x,x), c(x,x,x), c(x,x,x))' },
]
