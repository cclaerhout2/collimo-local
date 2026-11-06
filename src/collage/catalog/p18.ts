import type { LayoutDef } from '../types'

const C3 = 'c(x,x,x)'
const C4 = 'c(x,x,x,x)'
const C5 = 'c(x,x,x,x,x)'
const R4 = 'r(x,x,x,x)'
const R7 = 'r(x,x,x,x,x,x,x)'

/** Rectangle libre à partir de coordonnées relevées sur une vignette de 400 px. */
const px = (x1: number, y1: number, x2: number, y2: number) => ({ x: x1 / 400, y: y1 / 400, w: (x2 - x1) / 400, h: (y2 - y1) / 400 })

/** Dispositions en rectangles pour 18 photo(s), dans l'ordre des captures de référence. */
export const P18: LayoutDef[] = [
  { id: 'p18-01', photos: 18, family: 'grille', split: `r(${C3}, ${C3}, ${C3}, ${C3}, ${C3}, ${C3})` },
  { id: 'p18-02', photos: 18, family: 'mixte', split: `r(${C5}, ${C4}, ${C4}, ${C5})` },
  {
    id: 'p18-03',
    photos: 18,
    family: 'mixte',
    split: 'r(73*c(85*x, 87*x, 88*x, 55*x), 194*c(70*r(x,x,x), 188*r(c(x,x), c(x,x)), 72*r(x,x,x)), 73*c(55*x, 88*x, 87*x, 87*x))',
  },
  { id: 'p18-04', photos: 18, family: 'mixte', split: `r(63*${C5}, 137*c(100*x, 140*x, 100*x), 62*${C5}, 62*${C5})` },
  { id: 'p18-07', photos: 18, family: 'mixte', split: `r(${C5}, c(x, x, 2*x, x), c(x, 2*x, x, x), ${C5})` },
  {
    id: 'p18-08',
    photos: 18,
    family: 'mixte',
    split: 'r(1.6*c(215*r(c(x,x,x), c(x,x,x), c(x,x,x)), 138*r(x,x)), c(100*r(x,x), 100*x, 138*r(c(x,x), c(x,x))))',
  },
  {
    id: 'p18-10',
    photos: 18,
    family: 'mixte',
    split:
      'c(63*r(100*x, 100*x, 137*x), 98*r(75*c(x,x), 138*x, 40*x, 72*x), 177*r(53*c(x,x,x), 60*c(x,x), 139*c(100*x, 60*r(x,x)), 72*c(100*x, 60*x)))',
  },
  { id: 'p18-11', photos: 18, family: 'mixte', split: `c(${R7}, 2.2*r(63*x, 98*x, 100*x, 62*x), ${R7})` },
  {
    id: 'p18-12',
    photos: 18,
    family: 'fond',
    rects: [
      px(63, 75, 91, 115),
      px(108, 98, 168, 142),
      px(185, 48, 257, 142),
      px(273, 68, 333, 112),
      px(63, 133, 91, 173),
      px(273, 128, 310, 165),
      px(327, 128, 375, 165),
      px(108, 158, 153, 205),
      px(170, 158, 215, 205),
      px(232, 158, 257, 205),
      px(23, 190, 91, 242),
      px(273, 182, 333, 230),
      px(108, 222, 195, 288),
      px(210, 222, 257, 272),
      px(273, 248, 348, 308),
      px(63, 260, 91, 300),
      px(210, 290, 257, 327),
      px(165, 305, 195, 350),
    ],
  },
  {
    id: 'p18-13',
    photos: 18,
    family: 'mixte',
    split: `r(${C4}, 3.4*c(140*r(c(x,x), 2.3*x), 138*r(2.3*x, c(x,x)), 60*r(x,x,x)), ${C5})`,
  },
  { id: 'p18-14', photos: 18, family: 'mixte', split: `c(${R4}, r(x, 2.1*x, x), ${R4}, r(x, x, 2.1*x), ${R4})` },
  { id: 'p18-17', photos: 18, family: 'mixte', split: `r(${C5}, 2.2*c(r(x,x,x), 3.4*r(x,x), r(x,x,x)), ${C5})` },
  { id: 'p18-18', photos: 18, family: 'mixte', split: `r(${C5}, ${C5}, ${C5}, c(x, x, 3*x))` },
  { id: 'p18-19', photos: 18, family: 'mixte', split: `r(c(x, 2.7*x, x), ${C5}, ${C5}, ${C5})` },
  {
    id: 'p18-20',
    photos: 18,
    family: 'mixte',
    split: 'r(213*c(70*r(x,x), 60*r(x,x,x), 91*r(x,x), 100*r(x,x,x)), 60*c(80*x, 80*x, 60*x, 100*x), 63*c(x,x,x,x))',
  },
]
