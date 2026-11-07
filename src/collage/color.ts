/**
 * Calculs de couleur des photos : réglages et filtres. Les mêmes formules existent en GLSL
 * (colorProcessor.ts) ; cette version sert aux tests et au secours sans carte graphique.
 * Couleurs de 0 à 1.
 */
import { ADJUST_KEYS, NEUTRAL, POSITIVE_ONLY, type AdjustKey, type Adjustments, type CollageDoc } from './types'

/** Couleur [rouge, vert, bleu], chaque composante de 0 à 1 (ou décalage de -1 à 1 pour un virage). */
export type RGB = [number, number, number]

/** « Look » d'un filtre : ses propres réglages, puis virage, fondu, noir et blanc. */
export interface FilterLook {
  /** Réglages propres au filtre, appliqués après ceux du collage et de la photo. */
  adjust?: Partial<Adjustments>
  /** Noir et blanc. */
  mono?: boolean
  /** Virage des ombres : couleur ajoutée aux tons sombres (décalages, de -1 à 1). */
  shadowTint?: RGB
  /** Virage des hautes lumières : couleur ajoutée aux tons clairs (décalages, de -1 à 1). */
  highlightTint?: RGB
  /** Fondu : noirs éclaircis, 0 à 1. */
  fade?: number
}

/** Famille de filtres, qui sert à les ranger par onglets. */
export type FilterFamily = 'naturel' | 'chaleur' | 'fraicheur' | 'film' | 'nb'

/** Un filtre du catalogue. */
export interface FilterDef {
  id: string
  family: FilterFamily
  /** Nom affiché, en français et en anglais. */
  label: [fr: string, en: string]
  look: FilterLook
}

/** Familles de filtres, dans l'ordre d'affichage, avec leur nom en français et en anglais. */
export const FILTER_FAMILIES: { id: FilterFamily; label: [string, string] }[] = [
  { id: 'naturel', label: ['Naturel', 'Natural'] },
  { id: 'chaleur', label: ['Chaleur', 'Warm'] },
  { id: 'fraicheur', label: ['Fraîcheur', 'Cool'] },
  { id: 'film', label: ['Film', 'Film'] },
  { id: 'nb', label: ['Noir et blanc', 'Black & white'] },
]

/** Catalogue des filtres, rangés par famille. */
export const FILTERS: FilterDef[] = [
  { id: 'clair', family: 'naturel', label: ['Clair', 'Clear'], look: { adjust: { exposure: 0.15, contrast: 0.1, vibrance: 0.2 } } },
  {
    id: 'lumineux',
    family: 'naturel',
    label: ['Lumineux', 'Bright'],
    look: { adjust: { exposure: 0.3, shadows: 0.3, highlights: -0.2, saturation: 0.05 } },
  },
  {
    id: 'doux',
    family: 'naturel',
    label: ['Doux', 'Soft'],
    look: { adjust: { contrast: -0.25, highlights: -0.2, saturation: -0.1 }, fade: 0.25 },
  },
  { id: 'vif', family: 'naturel', label: ['Vif', 'Vivid'], look: { adjust: { contrast: 0.3, saturation: 0.3, vibrance: 0.3 } } },

  {
    id: 'dore',
    family: 'chaleur',
    label: ['Doré', 'Golden'],
    look: { adjust: { warmth: 0.45, exposure: 0.08, saturation: 0.1 }, highlightTint: [0.06, 0.03, -0.04] },
  },
  {
    id: 'latte',
    family: 'chaleur',
    label: ['Latte', 'Latte'],
    look: { adjust: { warmth: 0.3, contrast: -0.15, saturation: -0.2 }, fade: 0.3, shadowTint: [0.04, 0.02, 0] },
  },
  {
    id: 'couchant',
    family: 'chaleur',
    label: ['Couchant', 'Sunset'],
    look: { adjust: { warmth: 0.6, tint: 0.2, contrast: 0.1 }, shadowTint: [0.05, -0.02, 0.05], highlightTint: [0.08, 0.02, -0.05] },
  },
  {
    id: 'miel',
    family: 'chaleur',
    label: ['Miel', 'Honey'],
    look: { adjust: { warmth: 0.35, vibrance: 0.25, highlights: -0.15 }, highlightTint: [0.05, 0.04, -0.03] },
  },

  {
    id: 'jade',
    family: 'fraicheur',
    label: ['Jade', 'Jade'],
    look: { adjust: { warmth: -0.2, tint: -0.25, saturation: -0.05 }, shadowTint: [-0.03, 0.04, 0.02] },
  },
  {
    id: 'brise',
    family: 'fraicheur',
    label: ['Brise', 'Breeze'],
    look: { adjust: { warmth: -0.35, exposure: 0.1, contrast: -0.1 }, fade: 0.15 },
  },
  {
    id: 'glacier',
    family: 'fraicheur',
    label: ['Glacier', 'Glacier'],
    look: { adjust: { warmth: -0.55, saturation: -0.2, contrast: 0.15 }, highlightTint: [-0.02, 0.02, 0.06] },
  },
  {
    id: 'menthe',
    family: 'fraicheur',
    label: ['Menthe', 'Mint'],
    look: { adjust: { tint: -0.35, vibrance: 0.2 }, shadowTint: [-0.02, 0.05, 0.03], fade: 0.1 },
  },

  {
    id: 'argentique',
    family: 'film',
    label: ['Argentique', 'Analog'],
    look: { adjust: { contrast: 0.15, saturation: -0.15, warmth: 0.1, vignette: 0.35 }, fade: 0.2, shadowTint: [0, 0.02, 0.04] },
  },
  {
    id: 'vintage',
    family: 'film',
    label: ['Vintage', 'Vintage'],
    look: { adjust: { warmth: 0.3, saturation: -0.3, contrast: -0.1, vignette: 0.4 }, fade: 0.35, highlightTint: [0.06, 0.04, -0.02] },
  },
  {
    id: 'delave',
    family: 'film',
    label: ['Délavé', 'Washed'],
    look: { adjust: { contrast: -0.35, saturation: -0.35, exposure: 0.1 }, fade: 0.45 },
  },
  {
    id: 'cine',
    family: 'film',
    label: ['Ciné', 'Cinema'],
    look: {
      adjust: { contrast: 0.25, saturation: -0.1, vignette: 0.3 },
      shadowTint: [-0.04, 0.03, 0.07],
      highlightTint: [0.07, 0.03, -0.04],
    },
  },

  { id: 'nb', family: 'nb', label: ['N&B', 'B&W'], look: { mono: true, adjust: { contrast: 0.1 } } },
  {
    id: 'contraste',
    family: 'nb',
    label: ['Contrasté', 'High contrast'],
    look: { mono: true, adjust: { contrast: 0.5, shadows: -0.2, vignette: 0.25 } },
  },
  {
    id: 'sepia',
    family: 'nb',
    label: ['Sépia', 'Sepia'],
    look: { mono: true, adjust: { contrast: 0.05 }, shadowTint: [0.05, 0.02, -0.03], highlightTint: [0.09, 0.05, -0.04], fade: 0.15 },
  },
  { id: 'mat', family: 'nb', label: ['Mat', 'Matte'], look: { mono: true, adjust: { contrast: -0.2 }, fade: 0.4 } },
]

/**
 * Cherche un filtre par son identifiant.
 * @param id - identifiant du filtre
 * @returns le filtre, ou `undefined` s'il n'existe pas (ou si `id` est absent)
 */
export const filterById = (id: string | undefined) => FILTERS.find((f) => f.id === id)

/**
 * Ramène une valeur entre 0 et 1.
 * @param v - valeur
 * @returns la valeur bornée
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/**
 * Ramène un réglage dans son intervalle : 0 à 1 ou -1 à 1 selon le réglage.
 * @param k - nom du réglage
 * @param v - valeur
 * @returns la valeur bornée
 */
const clampAdj = (k: AdjustKey, v: number) => Math.min(1, Math.max(POSITIVE_ONLY.has(k) ? 0 : -1, v))

/**
 * Réglages complets à partir de valeurs partielles, additionnées puis bornées.
 * @param parts - réglages partiels à additionner (les absents comptent pour 0)
 * @returns tous les réglages, chacun dans son intervalle
 */
export function combine(...parts: (Partial<Adjustments> | undefined)[]): Adjustments {
  const out = { ...NEUTRAL }
  for (const k of ADJUST_KEYS)
    out[k] = clampAdj(
      k,
      parts.reduce((s, p) => s + (p?.[k] ?? 0), 0),
    )
  return out
}

/**
 * Indique si des réglages ne changent rien (tous absents ou nuls).
 * @param a - réglages partiels
 * @returns `true` si aucun réglage n'est actif
 */
export const isNeutral = (a: Partial<Adjustments> | undefined) => !a || ADJUST_KEYS.every((k) => !a[k])

/**
 * Luminance d'une couleur (coefficients Rec. 709).
 * @param r - rouge, de 0 à 1
 * @param g - vert, de 0 à 1
 * @param b - bleu, de 0 à 1
 * @returns la luminance, de 0 à 1
 */
export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Transition douce de 0 à 1 entre deux seuils (comme `smoothstep` en GLSL).
 * @param e0 - seuil bas : 0 en dessous
 * @param e1 - seuil haut : 1 au-dessus
 * @param x - valeur
 * @returns 0 à 1, en courbe en S entre les seuils
 */
export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Applique les réglages à un pixel, sans la netteté (qui dépend des voisins) ni le vignettage (dessiné par case).
 * @param c - couleur du pixel
 * @param a - réglages complets
 * @returns la nouvelle couleur, bornée de 0 à 1
 */
export function adjustPixel(c: RGB, a: Adjustments): RGB {
  let [r, g, b] = c
  const k = 2 ** (a.exposure * 1.2)
  r *= k
  g *= k
  b *= k
  const br = a.brightness * 0.35
  if (br >= 0) {
    r += (1 - r) * br
    g += (1 - g) * br
    b += (1 - b) * br
  } else {
    r *= 1 + br
    g *= 1 + br
    b *= 1 + br
  }
  const ct = 1 + a.contrast * 0.75
  r = (r - 0.5) * ct + 0.5
  g = (g - 0.5) * ct + 0.5
  b = (b - 0.5) * ct + 0.5
  const L = luma(clamp01(r), clamp01(g), clamp01(b))
  const tone = a.shadows * 0.3 * (1 - smoothstep(0, 0.55, L)) + a.highlights * 0.3 * smoothstep(0.45, 1, L)
  r += tone
  g += tone
  b += tone
  r += a.warmth * 0.08 + a.tint * 0.03
  g -= a.tint * 0.06
  b += -a.warmth * 0.08 + a.tint * 0.03
  let L2 = luma(r, g, b)
  const s = 1 + a.saturation
  r = L2 + (r - L2) * s
  g = L2 + (g - L2) * s
  b = L2 + (b - L2) * s
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  const v = 1 + a.vibrance * (1 - clamp01(sat))
  L2 = luma(r, g, b)
  r = L2 + (r - L2) * v
  g = L2 + (g - L2) * v
  b = L2 + (b - L2) * v
  return [clamp01(r), clamp01(g), clamp01(b)]
}

/**
 * Applique le look d'un filtre à un pixel : ses réglages, puis noir et blanc, virage et fondu.
 * @param c - couleur du pixel, réglages du collage déjà appliqués
 * @param look - look du filtre
 * @param lookAdjust - réglages complets du filtre, à passer s'ils sont déjà calculés (pour ne pas les recalculer à chaque pixel)
 * @returns la nouvelle couleur, bornée de 0 à 1
 */
export function lookPixel(c: RGB, look: FilterLook, lookAdjust: Adjustments = combine(look.adjust)): RGB {
  let [r, g, b] = adjustPixel(c, lookAdjust)
  if (look.mono) r = g = b = luma(r, g, b)
  const L = luma(r, g, b)
  const st = look.shadowTint ?? [0, 0, 0]
  const ht = look.highlightTint ?? [0, 0, 0]
  r += st[0] * (1 - L) + ht[0] * L
  g += st[1] * (1 - L) + ht[1] * L
  b += st[2] * (1 - L) + ht[2] * L
  const f = (look.fade ?? 0) * 0.15
  r = f + r * (1 - f)
  g = f + g * (1 - f)
  b = f + b * (1 - f)
  return [clamp01(r), clamp01(g), clamp01(b)]
}

/** Paramètres complets du traitement d'une photo. */
export interface ColorParams {
  /** Réglages du collage et de la photo, additionnés. */
  adjust: Adjustments
  /** Look du filtre du collage, ou `null` sans filtre. */
  look: FilterLook | null
  /** Intensité du filtre, de 0 à 1. */
  intensity: number
}

/**
 * Traitement complet d'un pixel : réglages, puis filtre mélangé selon son intensité.
 * @param c - couleur du pixel
 * @param p - paramètres du traitement
 * @param lookAdjust - réglages complets du filtre, s'ils sont déjà calculés
 * @returns la nouvelle couleur, de 0 à 1
 */
export function colorPixel(c: RGB, p: ColorParams, lookAdjust?: Adjustments): RGB {
  const base = adjustPixel(c, p.adjust)
  if (!p.look || p.intensity <= 0) return base
  const f = lookPixel(base, p.look, lookAdjust)
  const t = clamp01(p.intensity)
  return [base[0] + (f[0] - base[0]) * t, base[1] + (f[1] - base[1]) * t, base[2] + (f[2] - base[2]) * t]
}

/**
 * Réglages effectifs de la photo de la case i : collage + photo, puis filtre du collage.
 * @param doc - collage (seuls ses réglages, son filtre et ses photos servent)
 * @param i - indice de la case
 * @returns les paramètres du traitement
 */
export function paramsForPhoto(doc: Pick<CollageDoc, 'adjust' | 'filter' | 'photos'>, i: number): ColorParams {
  const f = filterById(doc.filter?.id)
  return {
    adjust: combine(doc.adjust, doc.photos[i]?.adjust),
    look: f ? f.look : null,
    intensity: f ? (doc.filter?.intensity ?? 1) : 0,
  }
}

/**
 * Vignettage total de la case i : réglages, plus vignettage du filtre pondéré par son intensité.
 * @param doc - collage (seuls ses réglages, son filtre et ses photos servent)
 * @param i - indice de la case
 * @returns l'intensité du vignettage, de 0 à 1
 */
export function vignetteFor(doc: Pick<CollageDoc, 'adjust' | 'filter' | 'photos'>, i: number): number {
  const p = paramsForPhoto(doc, i)
  return clamp01(p.adjust.vignette + (p.look?.adjust?.vignette ?? 0) * p.intensity)
}

/**
 * Indique si le traitement ne change rien, pour dessiner la photo telle quelle.
 * Le vignettage n'est pas compté : il est dessiné à part, case par case.
 * @param p - paramètres du traitement
 * @returns `true` si la photo peut être dessinée sans traitement
 */
export function isIdentity(p: ColorParams): boolean {
  const { vignette: _v, ...rest } = p.adjust
  void _v
  return isNeutral(rest) && (!p.look || p.intensity <= 0)
}

/**
 * Clé de cache du traitement (le vignettage n'en fait pas partie : il est dessiné à part).
 * @param p - paramètres du traitement
 * @returns un texte identique pour deux traitements identiques (valeurs arrondies au millième)
 */
export function paramsKey(p: ColorParams): string {
  const a = ADJUST_KEYS.filter((k) => k !== 'vignette').map((k) => p.adjust[k].toFixed(3))
  return `${a.join(',')}|${p.look ? JSON.stringify(p.look) : '-'}|${p.intensity.toFixed(3)}`
}

/**
 * Réglage automatique à partir d'un échantillon de pixels :
 * exposition vers une luminosité moyenne, contraste selon l'étendue, balance des blancs douce.
 * @param rgba - pixels RGBA d'une version réduite de la photo (0 à 255)
 * @returns les réglages proposés (vide si l'échantillon est vide)
 */
export function autoAdjust(rgba: Uint8ClampedArray): Partial<Adjustments> {
  const n = rgba.length / 4
  if (!n) return {}
  const lum: number[] = []
  let sr = 0
  let sb = 0
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] / 255
    const g = rgba[i + 1] / 255
    const b = rgba[i + 2] / 255
    lum.push(luma(r, g, b))
    sr += r
    sb += b
  }
  lum.sort((x, y) => x - y)
  const mean = lum.reduce((s, v) => s + v, 0) / n
  const lo = lum[Math.floor(n * 0.02)]
  const hi = lum[Math.min(n - 1, Math.floor(n * 0.98))]
  const round = (v: number) => Math.round(v * 100) / 100
  const clampTo = (v: number, m: number) => Math.max(-m, Math.min(m, v))
  return {
    exposure: round(clampTo((0.47 - mean) * 1.6, 0.6)),
    contrast: round(clampTo((0.8 - (hi - lo)) * 1.1, 0.4)),
    shadows: round(lo > 0.12 ? -0.1 : mean < 0.35 ? 0.2 : 0),
    highlights: round(hi > 0.97 ? -0.2 : 0),
    warmth: round(clampTo(-((sr - sb) / n) * 1.5, 0.3)),
    vibrance: 0.15,
  }
}
