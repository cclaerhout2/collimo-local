/**
 * Dispositions « en rectangles » du catalogue pour 11 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 11 photo(s), dans l'ordre des captures de référence. */
export const P11: LayoutDef[] = [
  { id: 'p11-01', photos: 11, family: 'mixte', split: 'c(r(x,x,x,x), 2*r(x,2*x,x), r(x,x,x,x))' },
  { id: 'p11-02', photos: 11, family: 'mixte', split: 'r(c(x,x,x,x), 2*c(x,2*x,x), c(x,x,x,x))' },
  { id: 'p11-03', photos: 11, family: 'mixte', split: 'c(r(x,x,x,x,x), 2*x, r(x,x,x,x,x))' },
  { id: 'p11-04', photos: 11, family: 'grille', split: 'r(c(x,x), c(x,x,x), c(x,x,x), c(x,x,x))' },
  { id: 'p11-05', photos: 11, family: 'mixte', split: 'r(3*c(r(x,x), 2*r(x,c(x,x),c(x,x)), r(x,x)), c(x,x))' },
  { id: 'p11-06', photos: 11, family: 'bandes', split: 'r(c(x,x,x,x,x), 2*x, c(x,x,x,x,x))' },
  { id: 'p11-07', photos: 11, family: 'mixte', split: 'c(r(3*x,3*x,4*x), r(x,x,x,x,x), r(2*x,x,2*x))' },
  { id: 'p11-08', photos: 11, family: 'grille', split: 'r(c(x,x), c(3*x,4*x,3*x), c(3*x,3*x,4*x), c(3*x,3*x,4*x))' },
  { id: 'p11-09', photos: 11, family: 'grille', split: 'r(c(3*x,4*r(x,x),3*x), c(x,x,x), c(x,x,x,x))' },
  {
    id: 'p11-10',
    photos: 11,
    family: 'mixte',
    split: 'r(74*c(35*r(22*x,22*x,30*x), 41*r(42*c(x,x),32*x), 24*r(22*x,52*x)), 26*c(35*x,41*x,24*x))',
  },
  {
    id: 'p11-11',
    photos: 11,
    family: 'mixte',
    split: 'r(60*c(37*r(55*x,75*x), 27*r(85*x,45*x), 36*r(x,x)), 19*c(x,x), 21*c(x,x,x))',
  },
  { id: 'p11-12', photos: 11, family: 'grille', split: 'r(33*c(x,x,r(x,x)), 22*c(x,x), 22*c(x,x,2*x), 23*c(x,x))' },
  {
    id: 'p11-15',
    photos: 11,
    family: 'fond',
    rects: [
      { x: 0.324, y: 0.302, w: 0.347, h: 0.382 },
      { x: 0.324, y: 0.093, w: 0.133, h: 0.173 },
      { x: 0.502, y: 0.147, w: 0.169, h: 0.12 },
      { x: 0.076, y: 0.302, w: 0.209, h: 0.173 },
      { x: 0.711, y: 0.302, w: 0.076, h: 0.133 },
      { x: 0.827, y: 0.302, w: 0.076, h: 0.133 },
      { x: 0.711, y: 0.476, w: 0.209, h: 0.209 },
      { x: 0.173, y: 0.511, w: 0.111, h: 0.098 },
      { x: 0.173, y: 0.649, w: 0.111, h: 0.098 },
      { x: 0.324, y: 0.724, w: 0.173, h: 0.173 },
      { x: 0.538, y: 0.724, w: 0.133, h: 0.133 },
    ],
  },
  {
    id: 'p11-16',
    photos: 11,
    family: 'fond',
    rects: [
      { x: 0.227, y: 0.124, w: 0.156, h: 0.156 },
      { x: 0.613, y: 0.124, w: 0.156, h: 0.156 },
      { x: 0.04, y: 0.32, w: 0.156, h: 0.156 },
      { x: 0.227, y: 0.32, w: 0.156, h: 0.156 },
      { x: 0.422, y: 0.32, w: 0.156, h: 0.156 },
      { x: 0.613, y: 0.32, w: 0.156, h: 0.156 },
      { x: 0.804, y: 0.32, w: 0.156, h: 0.156 },
      { x: 0.227, y: 0.511, w: 0.156, h: 0.156 },
      { x: 0.422, y: 0.511, w: 0.156, h: 0.156 },
      { x: 0.613, y: 0.511, w: 0.156, h: 0.156 },
      { x: 0.422, y: 0.707, w: 0.156, h: 0.156 },
    ],
  },
  { id: 'p11-18', photos: 11, family: 'grille', split: 'r(35*c(x,x,x), 29*c(x,x,x,x,x), 36*c(x,x,x))' },
  {
    id: 'p11-21',
    photos: 11,
    family: 'mixte',
    split: 'r(2*c(r(x,x), 2*x, r(x,x)), c(78*x,62*x,77*x), c(63*x,92*x,62*x))',
  },
  { id: 'p11-22', photos: 11, family: 'mixte', split: 'r(c(x,x,x,x), 2*c(3*x, 2*r(x,x)), c(x,x,x,x))' },
  { id: 'p11-23', photos: 11, family: 'mixte', split: 'r(49*c(x, r(c(x,x),c(x,x))), 51*c(r(x,x), r(x,x,x), 2*x))' },
  { id: 'p11-24', photos: 11, family: 'mixte', split: 'c(r(x,x,x,x), 2*r(2*c(x,x), 3*x), r(x,x,x,x))' },
  { id: 'p11-25', photos: 11, family: 'bandes', split: 'c(r(x,x,x,x,x), r(x,x,x,x,x,x))' },
]
