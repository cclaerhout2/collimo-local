/**
 * Dispositions « en rectangles » du catalogue pour 2 photos : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 2 photo(s), dans l'ordre des captures de référence. */
export const P02: LayoutDef[] = [
  { id: 'p02-01', photos: 2, family: 'grille', split: 'c(x,x)' },
  { id: 'p02-02', photos: 2, family: 'grille', split: 'r(x,x)' },
  { id: 'p02-03', photos: 2, family: 'bandes', split: 'r(3*x,2*x)' },
  { id: 'p02-04', photos: 2, family: 'bandes', split: 'r(2*x,3*x)' },
  { id: 'p02-09', photos: 2, family: 'bandes', split: 'c(3*x,5*x)' },
  { id: 'p02-10', photos: 2, family: 'bandes', split: 'c(5*x,3*x)' },
  {
    id: 'p02-20',
    photos: 2,
    family: 'fond',
    rects: [
      { x: 0.53, y: 0, w: 0.47, h: 0.48 },
      { x: 0, y: 0.52, w: 0.47, h: 0.48 },
    ],
  },
  {
    id: 'p02-21',
    photos: 2,
    family: 'fond',
    rects: [
      { x: 0.52, y: 0, w: 0.48, h: 0.69 },
      { x: 0, y: 0.31, w: 0.48, h: 0.69 },
    ],
  },
  {
    id: 'p02-22',
    photos: 2,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: 0.69, h: 0.48 },
      { x: 0.31, y: 0.52, w: 0.69, h: 0.48 },
    ],
  },
  {
    id: 'p02-23',
    photos: 2,
    family: 'fond',
    rects: [
      { x: 0, y: 0.28, w: 0.48, h: 0.44 },
      { x: 0.52, y: 0.28, w: 0.48, h: 0.44 },
    ],
  },
  {
    id: 'p02-24',
    photos: 2,
    family: 'fond',
    rects: [
      { x: 0, y: 0, w: 0.47, h: 0.48 },
      { x: 0, y: 0.52, w: 0.47, h: 0.48 },
    ],
  },
  {
    id: 'p02-29',
    photos: 2,
    family: 'incrustation',
    rects: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.48, y: 0.48, w: 0.43, h: 0.43 },
    ],
  },
  {
    id: 'p02-32',
    photos: 2,
    family: 'incrustation',
    rects: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.28, y: 0.28, w: 0.44, h: 0.44 },
    ],
  },
]
