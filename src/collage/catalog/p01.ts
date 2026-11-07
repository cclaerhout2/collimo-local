/**
 * Dispositions « en rectangles » du catalogue pour 1 photo : découpes (`split`) ou rectangles libres (`rects`),
 * en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { LayoutDef } from '../types'

/** Dispositions en rectangles pour 1 photo(s), dans l'ordre des captures de référence. */
export const P01: LayoutDef[] = [
  { id: 'p01-01', photos: 1, family: 'grille', split: 'x' },
  { id: 'p01-02', photos: 1, family: 'fond', rects: [{ x: 0, y: 0, w: 1, h: 0.5 }] },
  { id: 'p01-03', photos: 1, family: 'fond', rects: [{ x: 0, y: 0, w: 0.5, h: 1 }] },
  { id: 'p01-10', photos: 1, family: 'fond', rects: [{ x: 0.23, y: 0.23, w: 0.54, h: 0.54 }] },
  { id: 'p01-11', photos: 1, family: 'fond', rects: [{ x: 0, y: 0.22, w: 1, h: 0.56 }] },
  { id: 'p01-12', photos: 1, family: 'fond', rects: [{ x: 0.22, y: 0, w: 0.56, h: 1 }] },
  // Façon Polaroid : marge plus large en bas.
  { id: 'p01-15', photos: 1, family: 'fond', rects: [{ x: 0.04, y: 0.04, w: 0.92, h: 0.73 }] },
]
