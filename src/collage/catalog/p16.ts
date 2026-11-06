import type { LayoutDef } from '../types'

const C4 = 'c(x,x,x,x)'
const C6 = 'c(x,x,x,x,x,x)'
const R6 = 'r(x,x,x,x,x,x)'

/** Dispositions en rectangles pour 16 photo(s), dans l'ordre des captures de référence. */
export const P16: LayoutDef[] = [
  { id: 'p16-01', photos: 16, family: 'mixte', split: `r(3*c(x,x), 3*c(x,x), 2*${C6}, 2*${C6})` },
  { id: 'p16-02', photos: 16, family: 'mixte', split: `r(4.2*x, 2*c(x,x,x), 1.6*${C6}, 1.6*${C6})` },
  { id: 'p16-03', photos: 16, family: 'mixte', split: `r(1.3*${C6}, 1.3*${C6}, 2*c(x,x,x), 4.2*x)` },
  { id: 'p16-04', photos: 16, family: 'grille', split: `r(${C4}, ${C4}, ${C4}, ${C4})` },
  {
    id: 'p16-05',
    photos: 16,
    family: 'fond',
    rects: [
      { x: 0.12, y: 0.08, w: 0.132, h: 0.132 },
      { x: 0.294, y: 0.08, w: 0.132, h: 0.132 },
      { x: 0.582, y: 0.08, w: 0.132, h: 0.132 },
      { x: 0.756, y: 0.08, w: 0.132, h: 0.132 },
      { x: 0.044, y: 0.25, w: 0.152, h: 0.154 },
      { x: 0.236, y: 0.25, w: 0.152, h: 0.154 },
      { x: 0.428, y: 0.25, w: 0.152, h: 0.154 },
      { x: 0.62, y: 0.25, w: 0.152, h: 0.154 },
      { x: 0.812, y: 0.25, w: 0.152, h: 0.154 },
      { x: 0.178, y: 0.444, w: 0.132, h: 0.132 },
      { x: 0.352, y: 0.444, w: 0.132, h: 0.132 },
      { x: 0.524, y: 0.444, w: 0.132, h: 0.132 },
      { x: 0.698, y: 0.444, w: 0.132, h: 0.132 },
      { x: 0.332, y: 0.616, w: 0.152, h: 0.134 },
      { x: 0.524, y: 0.616, w: 0.152, h: 0.134 },
      { x: 0.436, y: 0.79, w: 0.132, h: 0.132 },
    ],
  },
  { id: 'p16-06', photos: 16, family: 'mixte', split: `r(${C4}, 2*c(r(x,x), 2*x, r(x,x)), c(x, 3*r(c(x,x,x), c(x,x,x))))` },
  { id: 'p16-07', photos: 16, family: 'mixte', split: `c(${R6}, 3.6*r(c(x,x), c(x,x)), ${R6})` },
  {
    id: 'p16-09',
    photos: 16,
    family: 'mixte',
    split: 'c(3*r(c(1.6*x, x), x, c(x, 1.4*x), 1.1*c(x,x,x)), 2*r(5*x, 3.4*x, 4*c(x,x), 3.2*c(x,x), 3.8*c(x,x)))',
  },
  { id: 'p16-10', photos: 16, family: 'mixte', split: `r(2*${C6}, 3*c(x,x), 3*c(x,x), 2*${C6})` },
  {
    id: 'p16-16',
    photos: 16,
    family: 'mixte',
    split:
      'r(c(3*x, 1.7*x, 1.7*x, 3.2*r(x,x)), c(1.5*x, 1.5*x, 3.3*r(x,x), 1.5*x, 1.5*x), c(3*r(x,x), 1.7*x, 1.7*x, 3.2*x))',
  },
  {
    id: 'p16-17',
    photos: 16,
    family: 'mixte',
    split: 'c(r(25*x, 21*x, 16*x, 30*x), r(29*x, 21*x, 15*x, 26*x), r(18*x, 21*x, 16*x, 35*x), r(24*x, 24*x, 21*x, 21*x))',
  },
  {
    id: 'p16-18',
    photos: 16,
    family: 'mixte',
    split: 'r(c(27*x, 18*x, 28*x, 20*x), c(17*x, 27*x, 16*x, 31*x), c(22*x, 22*x, 22*x, 25*x), c(17*x, 27*x, 28*x, 20*x))',
  },
  {
    id: 'p16-19',
    photos: 16,
    family: 'bandes',
    split: 'c(52*r(x,x), 38*r(x,x,x,x), 53*r(x,x), 53*r(x,x), 38*r(x,x,x,x), 53*r(x,x))',
  },
  { id: 'p16-20', photos: 16, family: 'mixte', split: `r(2*${C6}, 4.5*${C4}, 2*${C6})` },
]
