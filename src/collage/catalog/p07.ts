import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 7 photo(s), dans l'ordre des captures de référence. */
export const P07: LayoutDef[] = [
  { id: 'p07-01', photos: 7, family: 'mixte', split: 'r(c(2*x,x), c(x,x,x), c(x,2*x))' },
  { id: 'p07-02', photos: 7, family: 'mixte', split: 'c(r(2*x,x), r(x,x,x), r(x,2*x))' },
  { id: 'p07-03', photos: 7, family: 'mixte', split: 'r(c(x,x,x), c(x,x,x), x)' },
  { id: 'p07-04', photos: 7, family: 'mixte', split: 'c(2*r(c(x,x), c(x,x), c(x,x)), x)' },
  { id: 'p07-09', photos: 7, family: 'mixte', split: 'c(11*r(x,x,x), 9*r(x,x,x,x))' },
  { id: 'p07-10', photos: 7, family: 'mixte', split: 'r(c(x,x,x), c(x,x,x,x))' },
  { id: 'p07-11', photos: 7, family: 'mixte', split: 'r(2*c(x,x), c(x,x), c(x,x,x))' },
  { id: 'p07-12', photos: 7, family: 'mixte', split: 'r(2*x, c(x,x,x), c(x,x,x))' },
  { id: 'p07-13', photos: 7, family: 'mixte', split: 'c(r(x,x,x), x, r(x,x,x))' },
  { id: 'p07-14', photos: 7, family: 'mixte', split: 'r(c(x,x,x), c(x,x), c(2*x,x))' },
  { id: 'p07-15', photos: 7, family: 'mixte', split: 'c(r(x,x,x), r(x,x), r(2*x,x))' },
  { id: 'p07-16', photos: 7, family: 'mixte', split: 'c(r(x,x), r(2*x,3*x,2*x), r(x,x))' },
  { id: 'p07-21', photos: 7, family: 'mixte', split: 'r(c(x,x,x), x, c(x,x,x))' },
  { id: 'p07-22', photos: 7, family: 'mixte', split: 'r(3*c(2*x,x,x), 7*c(x, r(6*x, 5*c(x,x))))' },
  { id: 'p07-23', photos: 7, family: 'mixte', split: 'c(r(x,x,x), 2*r(x,x,c(x,x)))' },
  { id: 'p07-24', photos: 7, family: 'mixte', split: 'r(c(x,2*x), 2*c(x, 2*r(c(x,x), c(x,x))))' },
]
