import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 4 photo(s), dans l'ordre des captures de référence. */
export const P04: LayoutDef[] = [
  { id: 'p04-01', photos: 4, family: 'grille', split: 'r(c(x,x),c(x,x))' },
  { id: 'p04-02', photos: 4, family: 'grille', split: 'r(c(2*x,3*x),c(3*x,2*x))' },
  { id: 'p04-03', photos: 4, family: 'grille', split: 'c(r(2*x,3*x),r(3*x,2*x))' },
  { id: 'p04-04', photos: 4, family: 'mixte', split: 'c(x,r(x,x,x))' },
  { id: 'p04-05', photos: 4, family: 'mixte', split: 'r(x,c(x,x,x))' },
  { id: 'p04-06', photos: 4, family: 'mixte', split: 'r(c(x,x,x),2*x)' },
  { id: 'p04-11', photos: 4, family: 'grille', split: 'r(3*c(3*x,2*x),2*c(3*x,2*x))' },
  { id: 'p04-12', photos: 4, family: 'grille', split: 'r(2*c(2*x,3*x),3*c(2*x,3*x))' },
  { id: 'p04-17', photos: 4, family: 'mixte', split: 'c(3*x,5*r(5*x,4*c(x,x)))' },
  { id: 'p04-18', photos: 4, family: 'mixte', split: 'r(2*x,4*c(x,x),4*x)' },
  { id: 'p04-19', photos: 4, family: 'mixte', split: 'c(3*x,4*r(x,x),3*x)' },
  { id: 'p04-20', photos: 4, family: 'mixte', split: 'r(c(x,x),x,x)' },
  { id: 'p04-21', photos: 4, family: 'mixte', split: 'r(x,x,c(x,x))' },
  { id: 'p04-22', photos: 4, family: 'bandes', split: 'r(x,x,x,x)' },
  { id: 'p04-23', photos: 4, family: 'bandes', split: 'c(x,x,x,x)' },
  {
    id: 'p04-34',
    photos: 4,
    family: 'fond',
    rects: [
      { x: 0, y: 0.48, w: 0.21, h: 0.52 },
      { x: 0.265, y: 0.32, w: 0.21, h: 0.52 },
      { x: 0.53, y: 0.16, w: 0.21, h: 0.52 },
      { x: 0.79, y: 0, w: 0.21, h: 0.52 },
    ],
  },
]
