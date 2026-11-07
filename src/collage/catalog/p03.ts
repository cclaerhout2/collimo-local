/**
 * Dispositions « en rectangles » du catalogue pour 3 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 3 photo(s), dans l'ordre des captures de référence. */
export const P03: LayoutDef[] = [
  { id: 'p03-01', photos: 3, family: 'grille', split: 'c(x,x,x)' },
  { id: 'p03-02', photos: 3, family: 'grille', split: 'r(x,x,x)' },
  { id: 'p03-03', photos: 3, family: 'mixte', split: 'r(x,c(x,x))' },
  { id: 'p03-04', photos: 3, family: 'mixte', split: 'r(c(x,x),x)' },
  { id: 'p03-05', photos: 3, family: 'mixte', split: 'c(r(x,x),x)' },
  { id: 'p03-06', photos: 3, family: 'mixte', split: 'c(x,r(x,x))' },
  {
    id: 'p03-07',
    photos: 3,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: 0.31, h: 0.31 },
      { x: 0.345, y: 0.345, w: 0.31, h: 0.31 },
      { x: 0.69, y: 0.69, w: 0.31, h: 0.31 },
    ],
  },
  { id: 'p03-08', photos: 3, family: 'mixte', split: 'r(5*c(x,x),3*x)' },
  {
    id: 'p03-13',
    photos: 3,
    family: 'incrustation',
    rects: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
      { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'p03-17',
    photos: 3,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: 1 / 3, h: 0.6 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.6 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.6 },
    ],
  },
  {
    id: 'p03-18',
    photos: 3,
    family: 'fond',
    rects: [
      { x: 0, y: 0.44, w: 0.31, h: 0.56 },
      { x: 0.345, y: 0.22, w: 0.31, h: 0.56 },
      { x: 0.69, y: 0, w: 0.31, h: 0.56 },
    ],
  },
  { id: 'p03-19', photos: 3, family: 'mixte', split: 'c(x,r(3*x,5*x))' },
  {
    id: 'p03-30',
    photos: 3,
    family: 'fond',
    rects: [
      { x: 0, y: 0.4, w: 1 / 3, h: 0.6 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  { id: 'p03-31', photos: 3, family: 'bandes', split: 'c(x,2*x,x)' },
  {
    id: 'p03-32',
    photos: 3,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  { id: 'p03-34', photos: 3, family: 'mixte', split: 'c(x,2*r(x,x))' },
]
