/**
 * Types de données du collage : dispositions, cadrage et réglages des photos, bords,
 * textes et stickers, et document complet ({@link CollageDoc}), avec leurs valeurs par défaut.
 */

/** Rectangle en coordonnées relatives (0 à 1) ou en pixels selon le contexte. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

import type { CellDef, Decor } from './shapes'

/** Famille d'une disposition, qui sert à ranger le catalogue par onglets. */
export type LayoutFamily =
  | 'grille'
  | 'bandes'
  | 'mixte'
  | 'fond'
  | 'incrustation'
  // Étape 6 : dispositions en forme
  | 'coupe'
  | 'ronds'
  | 'coeurs'
  | 'geometrie'
  | 'puzzle'
  | 'dechire'
  | 'illustre'

/**
 * Une disposition du catalogue. Les cases sont décrites soit par une découpe imbriquée (`split`),
 * soit par des rectangles libres (`rects`, qui peuvent laisser voir le fond ou se superposer).
 * L'ordre des cases = l'ordre de remplissage par les photos.
 */
export interface LayoutDef {
  id: string
  /** Nombre de cases, donc de photos. */
  photos: number
  family: LayoutFamily
  /** Découpe imbriquée écrite dans le petit langage de `layoutDsl.ts`. */
  split?: string
  /** Rectangles libres, relatifs à la zone de dessin (0 à 1). */
  rects?: Rect[]
  /** Cases en forme (polygones, chemins, formes de la bibliothèque), dans l'ordre de remplissage. */
  geo?: CellDef[]
  /** Décor sans photo, dessiné par-dessus les cases (perforations, cadre…). */
  decor?: Decor[]
}

/** Disposition prête à dessiner : sa définition plus la boîte de chaque case. */
export interface Layout extends LayoutDef {
  /** Boîte englobante de chaque case, relative à la zone de dessin. */
  cells: Rect[]
}

/** Cadrage d'une photo dans sa case, en valeurs relatives : survit aux changements de case. */
export interface Crop {
  /** 1 = la photo couvre juste la case. */
  zoom: number
  /** Décalage horizontal dans la marge disponible, de -1 à 1 (0 = centré). */
  ox: number
  /** Décalage vertical dans la marge disponible, de -1 à 1 (0 = centré). */
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

/** Nom d'un réglage de couleur. */
export type AdjustKey = keyof Adjustments

/** Tous les réglages de couleur, dans l'ordre d'affichage des curseurs. */
export const ADJUST_KEYS: AdjustKey[] = [
  'exposure',
  'brightness',
  'contrast',
  'highlights',
  'shadows',
  'warmth',
  'tint',
  'saturation',
  'vibrance',
  'sharpness',
  'vignette',
]

/** Réglages qui ne vont que de 0 à 1. */
export const POSITIVE_ONLY: ReadonlySet<AdjustKey> = new Set(['sharpness', 'vignette'])

/** Réglages neutres : tout à 0, la photo n'est pas modifiée. */
export const NEUTRAL: Adjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  warmth: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  sharpness: 0,
  vignette: 0,
}

/** Photo placée dans une case du collage, avec son cadrage et ses réglages propres. */
export interface PlacedPhoto {
  /** Identifiant du fichier image dans le stockage local. */
  id: string
  /** Nom du fichier d'origine. */
  name: string
  mimeType: string
  /** Largeur de l'image d'origine, en pixels, si connue. */
  width?: number
  /** Hauteur de l'image d'origine, en pixels, si connue. */
  height?: number
  crop: Crop
  /** Réglages propres à cette photo. */
  adjust?: Partial<Adjustments>
}

/** Réglages des bords, chacun de 0 à 1. */
export interface Borders {
  /** Espace entre les cases. */
  spacing: number
  /** Marge entre les cases et le bord du collage. */
  margin: number
  /** Arrondi des coins des cases. */
  radius: number
  /** Contour autour des cases en forme, épaisseur 0 à 1 (0 = aucun). */
  outline?: number
  /** Couleur CSS du contour. */
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

/** Champs communs à tous les éléments posés par-dessus le collage (textes, icônes, images). */
interface OverlayBase {
  id: string
  /** Abscisse du centre, relative à la largeur du collage (0 à 1). */
  cx: number
  /** Ordonnée du centre, relative à la hauteur du collage (0 à 1). */
  cy: number
  /** Rotation en degrés. */
  angle: number
  /** Opacité de 0 à 1. */
  opacity: number
}

/** Texte posé sur le collage. */
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

/** Icône ou émoji posé sur le collage. */
export interface IconOverlay extends OverlayBase {
  type: 'icon'
  /** Bibliothèque d'origine : Phosphor (`ph`, une couleur) ou émojis Fluent (`fluent`, en couleurs). */
  set: 'ph' | 'fluent'
  /** Nom de l'icône dans sa bibliothèque. */
  name: string
  /** Balise <svg> complète, gardée dans le projet pour le rouvrir à l'identique. */
  svg: string
  /** Couleur des icônes d'une couleur (Phosphor) ; sans effet sur les émojis. */
  color?: string
  /** Largeur, relative au plus petit côté du collage. */
  size: number
}

/** Image (sticker) posée sur le collage. */
export interface ImageOverlay extends OverlayBase {
  type: 'image'
  /** Identifiant du fichier image dans le stockage local. */
  fileId: string
  name: string
  mimeType: string
  /** Largeur, relative au plus petit côté du collage. */
  size: number
  /** Hauteur / largeur. */
  aspect: number
}

/** Élément posé par-dessus le collage, quel que soit son type. */
export type Overlay = TextOverlay | IconOverlay | ImageOverlay

/** Document complet d'un collage, tel qu'il est enregistré et rouvert. */
export interface CollageDoc {
  /** Version du format, pour pouvoir le faire évoluer. */
  version: 1
  /** Identifiant du format du collage (voir `ratios.ts`). */
  ratio: string
  /** Identifiant de la disposition dans le catalogue. */
  layoutId: string
  /** Photo de la case i = photos[i]. */
  photos: PlacedPhoto[]
  borders: Borders
  /** Couleur CSS du fond. */
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

/** Cadrage par défaut : photo centrée, qui couvre juste la case, sans rotation. */
export const DEFAULT_CROP: Crop = { zoom: 1, ox: 0, oy: 0, angle: 0, flip: false }
/** Bords par défaut d'un nouveau collage. */
export const DEFAULT_BORDERS: Borders = { spacing: 0.35, margin: 0.35, radius: 0.15 }
/** Couleur de fond par défaut d'un nouveau collage. */
export const DEFAULT_BACKGROUND = '#ffffff'
