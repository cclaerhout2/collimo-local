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

/** Effet activable avec sa couleur. Les tailles sont relatives à la taille du texte. */
export interface TextEffects {
  /** Contour : épaisseur 0 à 1 (1 = 15 % de la taille du texte). */
  stroke: { on: boolean; color: string; width: number }
  /** Ombre portée : flou et décalage 0 à 1. */
  shadow: { on: boolean; color: string; blur: number; distance: number }
  /** Lueur : halo de couleur autour des lettres. */
  glow: { on: boolean; color: string; blur: number }
  /** Étiquette : rectangle de fond derrière le texte. */
  label: { on: boolean; color: string; padding: number; radius: number }
}

interface OverlayBase {
  id: string
  /** Centre, relatif au collage (0 à 1). */
  cx: number
  cy: number
  /** Rotation en degrés. */
  angle: number
  /** Opacité de 0 à 1. */
  opacity: number
}

export interface TextOverlay extends OverlayBase {
  type: 'text'
  text: string
  font: { family: string; weight: number; italic: boolean }
  /** Taille du texte, relative au plus petit côté du collage. */
  size: number
  /** Largeur maximale avant retour à la ligne, relative à la largeur du collage. */
  width: number
  align: 'left' | 'center' | 'right'
  color: string
  effects: TextEffects
}

export interface IconOverlay extends OverlayBase {
  type: 'icon'
  set: 'ph' | 'fluent'
  name: string
  /** Balise <svg> complète, gardée dans le projet pour le rouvrir à l'identique. */
  svg: string
  /** Couleur des icônes d'une couleur (Phosphor) ; sans effet sur les émojis. */
  color?: string
  /** Largeur, relative au plus petit côté du collage. */
  size: number
}

export interface ImageOverlay extends OverlayBase {
  type: 'image'
  fileId: string
  name: string
  mimeType: string
  /** Largeur, relative au plus petit côté du collage. */
  size: number
  /** Hauteur / largeur. */
  aspect: number
}

export type Overlay = TextOverlay | IconOverlay | ImageOverlay

export interface CollageDoc {
  version: 1
  ratio: string
  layoutId: string
  /** Photo de la case i = photos[i]. */
  photos: PlacedPhoto[]
  borders: Borders
  background: string
  /** Textes et stickers, du plus bas au plus haut. */
  overlays?: Overlay[]
  /** Découpe ajustée à la main (séparations déplacées) ; seulement pour les dispositions en découpe. */
  split?: string
  /** Nom du collage dont celui-ci a été tiré, s'il a été rouvert. */
  createdFrom?: string
}

export const DEFAULT_CROP: Crop = { zoom: 1, ox: 0, oy: 0, angle: 0, flip: false }
export const DEFAULT_BORDERS: Borders = { spacing: 0.35, margin: 0.35, radius: 0.15 }
export const DEFAULT_BACKGROUND = '#ffffff'
