import type { LayoutDef } from '../types'

const C4 = 'c(x,x,x,x)'
const C5 = 'c(x,x,x,x,x)'
const C6 = 'c(x,x,x,x,x,x)'
const R7 = 'r(x,x,x,x,x,x,x)'

/** Rectangle libre à partir de coordonnées relevées sur une vignette de 400 px. */
const px = (x1: number, y1: number, x2: number, y2: number) => ({ x: x1 / 400, y: y1 / 400, w: (x2 - x1) / 400, h: (y2 - y1) / 400 })

/** Dispositions en rectangles pour 17 photo(s), dans l'ordre des captures de référence. */
export const P17: LayoutDef[] = [
  {
    id: 'p17-01',
    photos: 17,
    family: 'mixte',
    split: 'c(r(27*x, 15*x, 15*x, 28*x), r(22*x, 12*x, 12*x, 12*x, 22*x), r(33*x, 15*x, 24*x, 14*x), r(17*x, 24*x, 19*x, 24*x))',
  },
  {
    id: 'p17-02',
    photos: 17,
    family: 'mixte',
    split:
      'r(c(63*x, 60*x, 118*x, 79*x), 2*c(63*r(x,x), 60*r(x,x), 118*r(2.6*x, c(x,x)), 79*r(x,x)), c(63*x, 60*x, 118*x, 79*x))',
  },
  {
    id: 'p17-03',
    photos: 17,
    family: 'mixte',
    split: 'r(c(x,x,x,x, 2.2*r(x,x)), 1.1*c(r(x,x), x, r(x,x)), c(2*r(x,x), x,x,x,x))',
  },
  {
    id: 'p17-04',
    photos: 17,
    family: 'mixte',
    split: 'r(c(2*r(x,x), x,x,x,x), 1.1*c(r(x,x), x, r(x,x)), c(x,x,x,x, 2*r(x,x)))',
  },
  { id: 'p17-05', photos: 17, family: 'mixte', split: `r(${C6}, 1.3*c(r(x,x), 1.35*x, r(x,x)), ${C6})` },
  { id: 'p17-06', photos: 17, family: 'mixte', split: `r(2.3*c(x,x), ${C5}, ${C5}, ${C5})` },
  {
    id: 'p17-07',
    photos: 17,
    family: 'mixte',
    split: `r(2.3*c(x, r(c(x,x), c(x,x,x))), ${C5}, 2.3*c(r(c(x,x,x), c(x,x)), x))`,
  },
  { id: 'p17-08', photos: 17, family: 'mixte', split: `r(${C4}, ${C4}, 3.5*x, ${C4}, ${C4})` },
  {
    id: 'p17-09',
    photos: 17,
    family: 'fond',
    rects: [
      px(52, 80, 78, 102),
      px(95, 62, 137, 103),
      px(152, 82, 170, 102),
      px(245, 62, 308, 102),
      px(325, 82, 345, 102),
      px(30, 118, 78, 160),
      px(95, 118, 137, 195),
      px(152, 118, 198, 148),
      px(213, 118, 260, 148),
      px(275, 118, 375, 205),
      px(48, 175, 78, 212),
      px(152, 163, 260, 252),
      px(95, 213, 137, 252),
      px(275, 222, 328, 275),
      px(137, 268, 190, 313),
      px(205, 268, 260, 313),
      px(178, 328, 225, 348),
    ],
  },
  { id: 'p17-13', photos: 17, family: 'mixte', split: `r(3.3*x, ${C4}, ${C4}, ${C4}, ${C4})` },
  { id: 'p17-14', photos: 17, family: 'mixte', split: `r(${C4}, ${C4}, ${C4}, ${C4}, 3.3*x)` },
  { id: 'p17-16', photos: 17, family: 'mixte', split: `r(${C5}, 3.4*c(r(x,x,x), 3.6*x, r(x,x,x)), ${C5})` },
  { id: 'p17-17', photos: 17, family: 'mixte', split: `c(${R7}, 2.2*r(x, 2.1*x, x), ${R7})` },
  {
    id: 'p17-18',
    photos: 17,
    family: 'mixte',
    split: `r(${C5}, 2.2*c(3*r(c(x,x,x), c(x,x,x)), 2*x), 2.2*c(3*x, 2*r(c(x,x), c(x,x))))`,
  },
  {
    id: 'p17-19',
    photos: 17,
    family: 'mixte',
    split: `r(c(1.55*x, r(c(x,x), c(x,x), c(x,x))), 1.1*r(${C5}, ${C5}))`,
  },
  {
    id: 'p17-20',
    photos: 17,
    family: 'mixte',
    split: `r(${C4}, c(1.2*x, 1.2*x, x), 3.5*c(70*r(x,x), 60*r(x,x,x), 91*r(x,x), 100*r(x,x,x)))`,
  },
  {
    id: 'p17-21',
    photos: 17,
    family: 'mixte',
    split: 'r(1.6*c(2.3*r(c(x,x), c(x,x), c(x,x)), 2.3*x, r(x,x,x)), c(140*x, 213*r(c(x,x,x), c(x,x,x))))',
  },
  {
    id: 'p17-22',
    photos: 17,
    family: 'mixte',
    split: `r(2.2*c(r(1.6*x, x), r(x, 1.6*x), r(1.6*x, x), r(x, 1.2*x)), ${C5}, ${C4})`,
  },
  {
    id: 'p17-23',
    photos: 17,
    family: 'mixte',
    split: `r(${C5}, c(x, 2*x, 1.35*x, x), c(x, 1.4*x, 2*x, x), ${C4})`,
  },
  {
    id: 'p17-24',
    photos: 17,
    family: 'mixte',
    split: 'c(r(x,x,x,x,x), r(63*x, 78*x, 118*x, 62*x), r(63*x, 117*x, 80*x, 62*x), r(82*x, 80*x, 80*x, 82*x))',
  },
]
