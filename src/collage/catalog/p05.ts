/**
 * Dispositions « en rectangles » du catalogue pour 5 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

const third = 1 / 3

/** Dispositions en rectangles pour 5 photo(s), dans l'ordre des captures de référence. */
export const P05: LayoutDef[] = [
  { id: 'p05-01', photos: 5, family: 'mixte', split: 'c(r(2*x,x),r(x,x,x))' },
  { id: 'p05-02', photos: 5, family: 'mixte', split: 'r(2*c(x,2*x),c(x,x,x))' },
  { id: 'p05-03', photos: 5, family: 'mixte', split: 'r(c(5*x,3*x),x,c(3*x,5*x))' },
  { id: 'p05-04', photos: 5, family: 'mixte', split: 'c(r(3*x,2*x),x,r(2*x,3*x))' },
  { id: 'p05-05', photos: 5, family: 'mixte', split: 'r(c(x,x),x,c(x,x))' },
  { id: 'p05-06', photos: 5, family: 'mixte', split: 'c(r(x,x),x,r(x,x))' },
  {
    // Moulinet : quatre rectangles autour d'un carré central.
    id: 'p05-07',
    photos: 5,
    family: 'mixte',
    rects: [
      { x: 0, y: 0, w: 0.67, h: 0.33 },
      { x: 0.67, y: 0, w: 0.33, h: 0.67 },
      { x: 0.33, y: 0.67, w: 0.67, h: 0.33 },
      { x: 0, y: 0.33, w: 0.33, h: 0.67 },
      { x: 0.33, y: 0.33, w: 0.34, h: 0.34 },
    ],
  },
  { id: 'p05-08', photos: 5, family: 'mixte', split: 'r(2*x,c(x,x,x,x))' },
  { id: 'p05-16', photos: 5, family: 'mixte', split: 'r(x,2*c(x,x,x),x)' },
  { id: 'p05-17', photos: 5, family: 'mixte', split: 'c(2*r(x,x),r(x,x,x))' },
  { id: 'p05-18', photos: 5, family: 'mixte', split: 'r(2*c(x,x),c(x,x,x))' },
  { id: 'p05-19', photos: 5, family: 'mixte', split: 'c(x,r(x,x,x),x)' },
  { id: 'p05-20', photos: 5, family: 'mixte', split: 'c(x,2*r(c(x,x),c(x,x)))' },
  { id: 'p05-21', photos: 5, family: 'mixte', split: 'c(r(2*x,x),2*r(c(x,x),2*x))' },
  { id: 'p05-22', photos: 5, family: 'mixte', split: 'r(2*c(2*x,r(x,x)),c(x,2*x))' },
  {
    id: 'p05-23',
    photos: 5,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: third, h: 0.5 },
      { x: third, y: 0, w: third, h: 0.5 },
      { x: 2 * third, y: 0, w: third, h: 0.5 },
      { x: 0, y: 0.5, w: third, h: 0.5 },
      { x: third, y: 0.5, w: third, h: 0.5 },
    ],
  },
  {
    id: 'p05-24',
    photos: 5,
    family: 'fond',
    rects: [
      { x: third, y: 0, w: third, h: 0.5 },
      { x: 2 * third, y: 0, w: third, h: 0.5 },
      { x: 0, y: 0.5, w: third, h: 0.5 },
      { x: third, y: 0.5, w: third, h: 0.5 },
      { x: 2 * third, y: 0.5, w: third, h: 0.5 },
    ],
  },
  { id: 'p05-29', photos: 5, family: 'mixte', split: 'c(2*x,r(x,x,x,x))' },
  { id: 'p05-30', photos: 5, family: 'mixte', split: 'r(x,2*c(r(x,x),r(x,x)))' },
  { id: 'p05-31', photos: 5, family: 'mixte', split: 'r(x,2*c(x,x,2*r(x,x)))' },
  { id: 'p05-33', photos: 5, family: 'bandes', split: 'r(x,x,x,x,x)' },
  { id: 'p05-34', photos: 5, family: 'bandes', split: 'c(x,x,x,x,x)' },
  { id: 'p05-35', photos: 5, family: 'mixte', split: 'r(c(x,x),c(x,x,x))' },
]
