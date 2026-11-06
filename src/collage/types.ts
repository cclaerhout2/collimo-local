/** Rectangle en coordonnées relatives (0 à 1) ou en pixels selon le contexte. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

import type { CellDef, Decor } from './shapes'

export type LayoutFamily =
  | 'grille' | 'bandes' | 'mixte' | 'fond' | 'incrustation'
  // Étape 6 : dispositions en forme
  | 'coupe' | 'ronds' | 'coeurs' | 'geometrie' | 'puzzle' | 'dechire' | 'illustre'

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
  /** Cases en forme (polygones, chemins, formes de la bibliothèque), dans l'ordre de remplissage. */
  geo?: CellDef[]
  /** Décor sans photo, dessiné par-dessus les cases (perforations, cadre…). */
  decor?: Decor[]
}

export interface Layout extends LayoutDef {
  /** Boîte englobante de chaque case, relative à la zone de dessin. */
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

/**
 * Réglages de couleur, chacun de -1 à 1 (0 = neutre), sauf netteté et vignettage de 0 à 1.
 * Réglages du collage et d'une photo s'additionnent.
 */
export interface Adjustments {
  exposure: number
  brightness: number
  contrast: number
  highlights: number
  shadows: number
  warmth: number
  tint: number
  saturation: number
  vibrance: number
  sharpness: number
  vignette: number
}

export type AdjustKey = keyof Adjustments

export const ADJUST_KEYS: AdjustKey[] = [
  'exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'warmth', 'tint', 'saturation', 'vibrance', 'sharpness', 'vignette',
]

/** Réglages qui ne vont que de 0 à 1. */
export const POSITIVE_ONLY: ReadonlySet<AdjustKey> = new Set(['sharpness', 'vignette'])

export const NEUTRAL: Adjustments = {
  exposure: 0, brightness: 0, contrast: 0, highlights: 0, shadows: 0, warmth: 0, tint: 0, saturation: 0, vibrance: 0, sharpness: 0, vignette: 0,
}

export interface PlacedPhoto {
  id: string
  name: string
  mimeType: string
  width?: number
  height?: number
  crop: Crop
  /** Réglages propres à cette photo. */
  adjust?: Partial<Adjustments>
}

/** Réglages des bords, chacun de 0 à 1. */
export interface Borders {
  spacing: number
  margin: number
  radius: number
  /** Contour autour des cases en forme, épaisseur 0 à 1 (0 = aucun). */
  outline?: number
  outlineColor?: string
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
  /** Filtre appliqué à toutes les photos, avec son intensité de 0 à 1. */
  filter?: { id: string; intensity: number }
  /** Réglages appliqués à toutes les photos. */
  adjust?: Partial<Adjustments>
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
