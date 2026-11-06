/** Rectangle en coordonnées relatives (0 à 1) ou en pixels selon le contexte. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type LayoutFamily = 'grille' | 'bandes' | 'mixte' | 'fond' | 'incrustation'

/**
 * Une disposition du catalogue. Les cases sont décrites soit par une découpe imbriquée (`split`),
 * soit par des rectangles libres (`rects`, qui peuvent laisser voir le fond ou se superposer).
 * L'ordre des cases = l'ordre de remplissage par les photos.
 */
export interface LayoutDef {
  id: string
  photos: number
  family: LayoutFamily
  split?: string
  rects?: Rect[]
}

export interface Layout extends LayoutDef {
  /** Cases calculées, relatives à la zone de dessin. */
  cells: Rect[]
}

/** Cadrage d'une photo dans sa case, en valeurs relatives : survit aux changements de case. */
export interface Crop {
  /** 1 = la photo couvre juste la case. */
  zoom: number
  /** Décalage dans la marge disponible, de -1 à 1 (0 = centré). */
  ox: number
  oy: number
  /** Rotation en degrés. */
  angle: number
  /** Effet miroir horizontal. */
  flip: boolean
}

export interface PlacedPhoto {
  id: string
  name: string
  mimeType: string
  width?: number
  height?: number
  crop: Crop
}

/** Réglages des bords, chacun de 0 à 1. */
export interface Borders {
  spacing: number
  margin: number
  radius: number
}

export interface CollageDoc {
  version: 1
  ratio: string
  layoutId: string
  /** Photo de la case i = photos[i]. */
  photos: PlacedPhoto[]
  borders: Borders
  background: string
  /** Nom du collage dont celui-ci a été tiré, s'il a été rouvert. */
  createdFrom?: string
}

export const DEFAULT_CROP: Crop = { zoom: 1, ox: 0, oy: 0, angle: 0, flip: false }
export const DEFAULT_BORDERS: Borders = { spacing: 0.35, margin: 0.35, radius: 0.15 }
export const DEFAULT_BACKGROUND = '#ffffff'
