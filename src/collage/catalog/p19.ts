/**
 * Dispositions « en rectangles » du catalogue pour 19 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

const C4 = 'c(x,x,x,x)'
const C5 = 'c(x,x,x,x,x)'
const C6 = 'c(x,x,x,x,x,x)'
const R4 = 'r(x,x,x,x)'
const R5 = 'r(x,x,x,x,x)'

/**
 * Case d'un pavage relevée sur une vignette de 400 px (cadre de 15 à 385, gouttières de ~15 px) :
 * les gouttières sont retirées, l'écart réel vient du réglage « Bords ».
 * @param x1 - bord gauche, en pixels de vignette
 * @param y1 - bord haut, en pixels de vignette
 * @param x2 - bord droit, en pixels de vignette
 * @param y2 - bord bas, en pixels de vignette
 * @returns le rectangle en coordonnées du cadre (0–1)
 */
const tile = (x1: number, y1: number, x2: number, y2: number) => {
  const s = (v: number) => (v - 15) / 385
  const e = (v: number) => v / 385
  return { x: s(x1), y: s(y1), w: e(x2) - s(x1), h: e(y2) - s(y1) }
}

/** Dispositions en rectangles pour 19 photo(s), dans l'ordre des captures de référence. */
export const P19: LayoutDef[] = [
  { id: 'p19-01', photos: 19, family: 'mixte', split: `r(${C5}, 3*c(r(x,x,x), 3*r(2.1*x, c(x,x)), r(x,x,x)), ${C5})` },
  { id: 'p19-02', photos: 19, family: 'mixte', split: `r(${C5}, ${C4}, ${C5}, ${C5})` },
  {
    id: 'p19-03',
    photos: 19,
    family: 'mixte',
    split:
      'c(95*r(75*x, 57*x, 42*x, 80*x, 47*x), 290*r(78*c(60*x, 100*x, 80*x), 230*c(100*r(95*x, 43*x, 42*x), 60*r(77*x, 117*x), 80*r(x,x,x)), 62*c(100*x, 60*x, 80*x)))',
  },
  { id: 'p19-04', photos: 19, family: 'mixte', split: `r(${C5}, 1.6*c(x, 1.6*x, 1.6*x, x), 1.6*${C5}, ${C5})` },
  { id: 'p19-05', photos: 19, family: 'mixte', split: `r(${C6}, 3.4*c(120*r(x,x), 100*r(x,x,x), 120*r(x,x)), ${C6})` },
  {
    id: 'p19-07',
    photos: 19,
    family: 'mixte',
    split: 'r(c(45*x, 60*x, 60*x, 77*x, 60*x), 3.3*c(r(x,x,x), 4*r(1.6*c(1.4*x, x), x), r(x,x,x)), c(60*x, 80*x, 60*x, 60*x, 45*x))',
  },
  { id: 'p19-08', photos: 19, family: 'mixte', split: `c(${R5}, ${R5}, ${R5}, r(2.2*x, x, x, x))` },
  { id: 'p19-09', photos: 19, family: 'mixte', split: `r(4.5*c(${R4}, r(x, x, 2.2*x), r(x, 2.2*x, x), ${R4}), ${C5})` },
  {
    id: 'p19-10',
    photos: 19,
    family: 'mixte',
    rects: [
      tile(15, 15, 110, 70),
      tile(125, 15, 178, 108),
      tile(195, 15, 245, 108),
      tile(262, 15, 315, 108),
      tile(333, 15, 385, 108),
      tile(15, 87, 110, 140),
      tile(15, 155, 110, 210),
      tile(15, 225, 110, 278),
      tile(15, 295, 70, 385),
      tile(87, 295, 140, 385),
      tile(125, 125, 280, 278),
      tile(295, 125, 385, 178),
      tile(295, 195, 385, 248),
      tile(295, 262, 385, 317),
      tile(295, 332, 385, 385),
      tile(155, 295, 210, 330),
      tile(225, 295, 280, 330),
      tile(155, 347, 210, 385),
      tile(225, 347, 280, 385),
    ],
  },
  {
    id: 'p19-11',
    photos: 19,
    family: 'mixte',
    rects: [
      tile(15, 15, 72, 108),
      tile(88, 15, 140, 108),
      tile(155, 15, 210, 55),
      tile(225, 15, 280, 55),
      tile(155, 70, 280, 108),
      tile(295, 15, 385, 70),
      tile(15, 125, 110, 180),
      tile(15, 195, 110, 248),
      tile(15, 262, 110, 317),
      tile(15, 332, 110, 385),
      tile(125, 125, 280, 278),
      tile(295, 87, 385, 140),
      tile(295, 155, 385, 210),
      tile(295, 225, 385, 278),
      tile(125, 295, 248, 330),
      tile(125, 347, 180, 385),
      tile(195, 347, 248, 385),
      tile(262, 295, 317, 385),
      tile(333, 295, 385, 385),
    ],
  },
  {
    id: 'p19-13',
    photos: 19,
    family: 'mixte',
    split: `r(${C5}, c(100*x, 100*x, 137*x), c(82*x, 62*x, 80*x, 98*x), c(160*x, 92*x, 87*x), ${C4})`,
  },
  {
    id: 'p19-15',
    photos: 19,
    family: 'mixte',
    split:
      'c(r(53*x, 105*x, 91*x, 70*x), r(80*x, 175*x, 82*x), r(80*x, 106*x, 54*x, 82*x), r(80*x, 60*x, 99*x, 82*x), r(80*x, 78*x, 61*x, 100*x))',
  },
  {
    id: 'p19-17',
    photos: 19,
    family: 'mixte',
    split:
      'r(63*c(55*x, 107*x, 91*x, 68*x), 68*c(80*x, 177*x, 78*x), 55*c(75*x, 107*x, 72*x, 68*x), 60*c(63*x, 80*x, 100*x, 78*x), 63*c(80*x, 79*x, 61*x, 98*x))',
  },
  {
    id: 'p19-18',
    photos: 19,
    family: 'mixte',
    split: 'c(r(55*x, 45*x, 107*x, 47*x, 55*x), 2.1*r(63*x, 48*c(x,x,x), 90*x, 50*c(x,x,x), 60*x), r(55*x, 45*x, 107*x, 47*x, 55*x))',
  },
]
