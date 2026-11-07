/**
 * Dispositions « en rectangles » du catalogue pour 20 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef, Rect } from '../types'

const C4 = 'c(x,x,x,x)'
const C5 = 'c(x,x,x,x,x)'
const C6 = 'c(x,x,x,x,x,x)'

/**
 * Rectangle libre à partir de coordonnées relevées sur une vignette de 400 px.
 * @param x1 - bord gauche, en pixels de vignette
 * @param y1 - bord haut, en pixels de vignette
 * @param x2 - bord droit, en pixels de vignette
 * @param y2 - bord bas, en pixels de vignette
 * @returns le rectangle en coordonnées du cadre (0–1)
 */
const px = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: x1 / 400, y: y1 / 400, w: (x2 - x1) / 400, h: (y2 - y1) / 400 })

/**
 * Case d'un pavage relevée sur une vignette de 400 px (cadre de 15 à 385, gouttières de ~15 px) :
 * les gouttières sont retirées, l'écart réel vient du réglage « Bords ».
 * @param x1 - bord gauche, en pixels de vignette
 * @param y1 - bord haut, en pixels de vignette
 * @param x2 - bord droit, en pixels de vignette
 * @param y2 - bord bas, en pixels de vignette
 * @returns le rectangle en coordonnées du cadre (0–1)
 */
const tile = (x1: number, y1: number, x2: number, y2: number): Rect => {
  const s = (v: number) => (v - 15) / 385
  const e = (v: number) => v / 385
  return { x: s(x1), y: s(y1), w: e(x2) - s(x1), h: e(y2) - s(y1) }
}

/**
 * Grille 5 × 5 dont on retire les cases `holes`, en coordonnées de vignette.
 * @param holes - cases retirées, sous la forme « ligne,colonne »
 * @returns les cases restantes, rangée par rangée
 */
function gridWithHoles(holes: string[]): Rect[] {
  const edges = [15, 95, 172, 248, 325]
  const out: Rect[] = []
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if (holes.includes(`${r},${c}`)) continue
      out.push(px(edges[c], edges[r], edges[c] + 60, edges[r] + 60))
    }
  return out
}

/** Dispositions en rectangles pour 20 photo(s), dans l'ordre des captures de référence. */
export const P20: LayoutDef[] = [
  { id: 'p20-01', photos: 20, family: 'grille', split: `r(${C4}, ${C4}, ${C4}, ${C4}, ${C4})` },
  { id: 'p20-02', photos: 20, family: 'grille', split: `r(${C5}, ${C5}, ${C5}, ${C5})` },
  { id: 'p20-03', photos: 20, family: 'mixte', split: `r(${C5}, 3*c(r(x,x,x), 3*r(c(x,x), c(x,x)), r(x,x,x)), ${C5})` },
  {
    id: 'p20-04',
    photos: 20,
    family: 'mixte',
    split: 'r(c(2*x, x, x, x, x, x), 3.6*c(r(x,x,x), 3.4*x, r(x,x,x,x)), c(x, x, x, x, x, 2*x))',
  },
  {
    id: 'p20-05',
    photos: 20,
    family: 'mixte',
    rects: [
      tile(15, 15, 70, 108),
      tile(88, 15, 140, 70),
      tile(155, 15, 210, 70),
      tile(225, 15, 280, 70),
      tile(295, 15, 385, 70),
      tile(15, 125, 70, 178),
      tile(15, 195, 70, 245),
      tile(15, 262, 70, 315),
      tile(88, 87, 193, 208),
      tile(210, 87, 315, 178),
      tile(88, 225, 193, 315),
      tile(210, 195, 315, 315),
      tile(333, 87, 385, 140),
      tile(333, 155, 385, 210),
      tile(333, 225, 385, 278),
      tile(333, 293, 385, 385),
      tile(15, 332, 110, 385),
      tile(125, 332, 178, 385),
      tile(195, 332, 245, 385),
      tile(262, 332, 315, 385),
    ],
  },
  {
    id: 'p20-06',
    photos: 20,
    family: 'mixte',
    rects: [
      tile(15, 15, 78, 115),
      tile(95, 15, 193, 115),
      tile(210, 15, 290, 78),
      tile(305, 15, 385, 78),
      tile(15, 132, 68, 192),
      tile(85, 132, 128, 192),
      tile(145, 132, 193, 192),
      tile(210, 95, 310, 210),
      tile(325, 95, 385, 135),
      tile(325, 152, 385, 210),
      tile(15, 208, 98, 270),
      tile(113, 208, 193, 270),
      tile(210, 228, 258, 290),
      tile(275, 228, 320, 290),
      tile(335, 228, 385, 290),
      tile(15, 287, 115, 385),
      tile(133, 287, 193, 325),
      tile(133, 342, 193, 385),
      tile(210, 305, 290, 385),
      tile(305, 305, 385, 385),
    ],
  },
  {
    id: 'p20-08',
    photos: 20,
    family: 'fond',
    rects: [
      px(47, 87, 77, 115),
      px(93, 60, 135, 103),
      px(150, 80, 170, 100),
      px(227, 80, 272, 100),
      px(288, 63, 305, 100),
      px(328, 80, 357, 100),
      px(23, 132, 78, 162),
      px(93, 118, 135, 162),
      px(150, 118, 193, 162),
      px(208, 118, 258, 162),
      px(265, 118, 310, 198),
      px(325, 118, 375, 145),
      px(62, 178, 135, 238),
      px(150, 178, 250, 250),
      px(325, 162, 365, 200),
      px(265, 215, 335, 255),
      px(93, 255, 135, 295),
      px(150, 272, 193, 315),
      px(208, 272, 268, 315),
      px(170, 330, 230, 360),
    ],
  },
  {
    id: 'p20-09',
    photos: 20,
    family: 'mixte',
    split:
      'c(r(82*x, 80*x, 80*x, 80*x), r(63*x, 77*x, 80*x, 98*x), r(82*x, 97*x, 78*x, 60*x), r(63*x, 77*x, 60*x, 117*x), r(100*x, 60*x, 98*x, 60*x))',
  },
  {
    id: 'p20-10',
    photos: 20,
    family: 'mixte',
    split: `r(c(r(x,x), x, x, r(x,x)), ${C4}, ${C4}, c(r(x,x), x, x, r(x,x)))`,
  },
  {
    id: 'p20-11',
    photos: 20,
    family: 'fond',
    rects: [
      px(15, 15, 78, 78),
      px(95, 15, 155, 78),
      px(172, 15, 232, 78),
      px(248, 15, 308, 78),
      px(325, 15, 385, 78),
      px(15, 95, 78, 155),
      px(15, 172, 78, 232),
      px(15, 248, 78, 308),
      px(325, 95, 385, 155),
      px(325, 172, 385, 232),
      px(325, 248, 385, 308),
      px(133, 133, 193, 193),
      px(210, 133, 270, 193),
      px(133, 210, 193, 270),
      px(210, 210, 270, 270),
      px(15, 325, 78, 385),
      px(95, 325, 155, 385),
      px(172, 325, 232, 385),
      px(248, 325, 308, 385),
      px(325, 325, 385, 385),
    ],
  },
  { id: 'p20-12', photos: 20, family: 'fond', rects: gridWithHoles(['0,4', '1,3', '2,2', '3,1', '4,0']) },
  {
    id: 'p20-16',
    photos: 20,
    family: 'fond',
    rects: [
      px(62, 98, 85, 120),
      px(100, 105, 170, 175),
      px(185, 75, 230, 120),
      px(247, 122, 265, 158),
      px(285, 122, 305, 158),
      px(38, 138, 85, 182),
      px(185, 138, 230, 182),
      px(247, 175, 315, 245),
      px(330, 175, 375, 212),
      px(38, 198, 85, 228),
      px(100, 190, 170, 245),
      px(185, 198, 230, 245),
      px(330, 228, 350, 245),
      px(23, 245, 85, 290),
      px(100, 260, 160, 305),
      px(175, 260, 245, 328),
      px(262, 262, 315, 282),
      px(330, 262, 350, 298),
      px(262, 297, 280, 320),
      px(295, 297, 315, 320),
    ],
  },
  {
    id: 'p20-17',
    photos: 20,
    family: 'mixte',
    rects: [
      tile(15, 15, 68, 190),
      tile(83, 15, 133, 95),
      tile(148, 15, 255, 65),
      tile(270, 15, 320, 190),
      tile(335, 15, 385, 95),
      tile(148, 80, 255, 130),
      tile(83, 112, 133, 190),
      tile(148, 145, 193, 193),
      tile(208, 145, 255, 193),
      tile(335, 112, 385, 190),
      tile(15, 207, 68, 288),
      tile(83, 207, 133, 385),
      tile(148, 208, 193, 252),
      tile(208, 208, 255, 252),
      tile(270, 207, 320, 288),
      tile(335, 207, 385, 385),
      tile(148, 267, 255, 318),
      tile(15, 303, 68, 385),
      tile(270, 303, 320, 385),
      tile(148, 333, 255, 385),
    ],
  },
  { id: 'p20-18', photos: 20, family: 'bandes', split: `r(c(x,x), ${C6}, c(x,x), c(x,x), ${C6}, c(x,x))` },
  {
    id: 'p20-19',
    photos: 20,
    family: 'mixte',
    rects: [
      tile(15, 15, 98, 107),
      tile(113, 15, 152, 130),
      tile(167, 15, 213, 65),
      tile(228, 15, 308, 105),
      tile(323, 15, 385, 80),
      tile(167, 80, 213, 130),
      tile(323, 95, 385, 157),
      tile(15, 122, 98, 213),
      tile(228, 120, 308, 230),
      tile(113, 145, 213, 287),
      tile(323, 172, 385, 233),
      tile(15, 228, 98, 320),
      tile(228, 245, 262, 285),
      tile(277, 245, 308, 285),
      tile(323, 248, 385, 310),
      tile(113, 302, 213, 385),
      tile(228, 300, 308, 385),
      tile(15, 335, 50, 385),
      tile(65, 335, 98, 385),
      tile(323, 325, 385, 385),
    ],
  },
  {
    id: 'p20-20',
    photos: 20,
    family: 'mixte',
    rects: [
      tile(15, 15, 78, 100),
      tile(95, 15, 155, 100),
      tile(170, 15, 230, 50),
      tile(245, 15, 308, 50),
      tile(170, 65, 230, 100),
      tile(245, 65, 308, 100),
      tile(323, 15, 385, 100),
      tile(15, 115, 78, 190),
      tile(95, 115, 230, 250),
      tile(245, 115, 308, 192),
      tile(323, 115, 385, 192),
      tile(15, 205, 78, 240),
      tile(15, 255, 78, 295),
      tile(245, 207, 385, 307),
      tile(15, 310, 78, 385),
      tile(95, 265, 230, 385),
      tile(245, 322, 290, 385),
      tile(305, 322, 342, 350),
      tile(305, 365, 342, 385),
      tile(357, 322, 385, 385),
    ],
  },
]
