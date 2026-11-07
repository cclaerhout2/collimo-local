/**
 * Calculs de couleur des photos : réglages et filtres. Les mêmes formules existent en GLSL
 * (colorProcessor.ts) ; cette version sert aux tests et au secours sans carte graphique.
 * Couleurs de 0 à 1.
 */
import { ADJUST_KEYS, NEUTRAL, POSITIVE_ONLY, type AdjustKey, type Adjustments, type CollageDoc } from './types'

export type RGB = [number, number, number]

/** « Look » d'un filtre : ses propres réglages, puis virage, fondu, noir et blanc. */
export interface FilterLook {
  adjust?: Partial<Adjustments>
  /** Noir et blanc. */
  mono?: boolean
  /** Virage : couleur ajoutée aux ombres et aux hautes lumières (décalages, de -1 à 1). */
  shadowTint?: RGB
  highlightTint?: RGB
  /** Fondu : noirs éclaircis, 0 à 1. */
  fade?: number
}

export type FilterFamily = 'naturel' | 'chaleur' | 'fraicheur' | 'film' | 'nb'

export interface FilterDef {
  id: string
  family: FilterFamily
  label: [fr: string, en: string]
  look: FilterLook
}

export const FILTER_FAMILIES: { id: FilterFamily; label: [string, string] }[] = [
  { id: 'naturel', label: ['Naturel', 'Natural'] },
  { id: 'chaleur', label: ['Chaleur', 'Warm'] },
  { id: 'fraicheur', label: ['Fraîcheur', 'Cool'] },
  { id: 'film', label: ['Film', 'Film'] },
  { id: 'nb', label: ['Noir et blanc', 'Black & white'] },
]

export const FILTERS: FilterDef[] = [
  { id: 'clair', family: 'naturel', label: ['Clair', 'Clear'], look: { adjust: { exposure: 0.15, contrast: 0.1, vibrance: 0.2 } } },
  { id: 'lumineux', family: 'naturel', label: ['Lumineux', 'Bright'], look: { adjust: { exposure: 0.3, shadows: 0.3, highlights: -0.2, saturation: 0.05 } } },
  { id: 'doux', family: 'naturel', label: ['Doux', 'Soft'], look: { adjust: { contrast: -0.25, highlights: -0.2, saturation: -0.1 }, fade: 0.25 } },
  { id: 'vif', family: 'naturel', label: ['Vif', 'Vivid'], look: { adjust: { contrast: 0.3, saturation: 0.3, vibrance: 0.3 } } },

  { id: 'dore', family: 'chaleur', label: ['Doré', 'Golden'], look: { adjust: { warmth: 0.45, exposure: 0.08, saturation: 0.1 }, highlightTint: [0.06, 0.03, -0.04] } },
  { id: 'latte', family: 'chaleur', label: ['Latte', 'Latte'], look: { adjust: { warmth: 0.3, contrast: -0.15, saturation: -0.2 }, fade: 0.3, shadowTint: [0.04, 0.02, 0] } },
  { id: 'couchant', family: 'chaleur', label: ['Couchant', 'Sunset'], look: { adjust: { warmth: 0.6, tint: 0.2, contrast: 0.1 }, shadowTint: [0.05, -0.02, 0.05], highlightTint: [0.08, 0.02, -0.05] } },
  { id: 'miel', family: 'chaleur', label: ['Miel', 'Honey'], look: { adjust: { warmth: 0.35, vibrance: 0.25, highlights: -0.15 }, highlightTint: [0.05, 0.04, -0.03] } },

  { id: 'jade', family: 'fraicheur', label: ['Jade', 'Jade'], look: { adjust: { warmth: -0.2, tint: -0.25, saturation: -0.05 }, shadowTint: [-0.03, 0.04, 0.02] } },
  { id: 'brise', family: 'fraicheur', label: ['Brise', 'Breeze'], look: { adjust: { warmth: -0.35, exposure: 0.1, contrast: -0.1 }, fade: 0.15 } },
  { id: 'glacier', family: 'fraicheur', label: ['Glacier', 'Glacier'], look: { adjust: { warmth: -0.55, saturation: -0.2, contrast: 0.15 }, highlightTint: [-0.02, 0.02, 0.06] } },
  { id: 'menthe', family: 'fraicheur', label: ['Menthe', 'Mint'], look: { adjust: { tint: -0.35, vibrance: 0.2 }, shadowTint: [-0.02, 0.05, 0.03], fade: 0.1 } },

  { id: 'argentique', family: 'film', label: ['Argentique', 'Analog'], look: { adjust: { contrast: 0.15, saturation: -0.15, warmth: 0.1, vignette: 0.35 }, fade: 0.2, shadowTint: [0, 0.02, 0.04] } },
  { id: 'vintage', family: 'film', label: ['Vintage', 'Vintage'], look: { adjust: { warmth: 0.3, saturation: -0.3, contrast: -0.1, vignette: 0.4 }, fade: 0.35, highlightTint: [0.06, 0.04, -0.02] } },
  { id: 'delave', family: 'film', label: ['Délavé', 'Washed'], look: { adjust: { contrast: -0.35, saturation: -0.35, exposure: 0.1 }, fade: 0.45 } },
  { id: 'cine', family: 'film', label: ['Ciné', 'Cinema'], look: { adjust: { contrast: 0.25, saturation: -0.1, vignette: 0.3 }, shadowTint: [-0.04, 0.03, 0.07], highlightTint: [0.07, 0.03, -0.04] } },

  { id: 'nb', family: 'nb', label: ['N&B', 'B&W'], look: { mono: true, adjust: { contrast: 0.1 } } },
  { id: 'contraste', family: 'nb', label: ['Contrasté', 'High contrast'], look: { mono: true, adjust: { contrast: 0.5, shadows: -0.2, vignette: 0.25 } } },
  { id: 'sepia', family: 'nb', label: ['Sépia', 'Sepia'], look: { mono: true, adjust: { contrast: 0.05 }, shadowTint: [0.05, 0.02, -0.03], highlightTint: [0.09, 0.05, -0.04], fade: 0.15 } },
  { id: 'mat', family: 'nb', label: ['Mat', 'Matte'], look: { mono: true, adjust: { contrast: -0.2 }, fade: 0.4 } },
]

export const filterById = (id: string | undefined) => FILTERS.find((f) => f.id === id)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const clampAdj = (k: AdjustKey, v: number) => Math.min(1, Math.max(POSITIVE_ONLY.has(k) ? 0 : -1, v))

/** Réglages complets à partir de valeurs partielles (et éventuellement additionnées). */
export function combine(...parts: (Partial<Adjustments> | undefined)[]): Adjustments {
  const out = { ...NEUTRAL }
  for (const k of ADJUST_KEYS) out[k] = clampAdj(k, parts.reduce((s, p) => s + (p?.[k] ?? 0), 0))
  return out
}

export const isNeutral = (a: Partial<Adjustments> | undefined) => !a || ADJUST_KEYS.every((k) => !a[k])

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Réglages, sans la netteté (voisinage) ni le vignettage (dessiné par case). */
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
  adjust: Adjustments
  look: FilterLook | null
  intensity: number
}

export function colorPixel(c: RGB, p: ColorParams, lookAdjust?: Adjustments): RGB {
  const base = adjustPixel(c, p.adjust)
  if (!p.look || p.intensity <= 0) return base
  const f = lookPixel(base, p.look, lookAdjust)
  const t = clamp01(p.intensity)
  return [base[0] + (f[0] - base[0]) * t, base[1] + (f[1] - base[1]) * t, base[2] + (f[2] - base[2]) * t]
}

/** Réglages effectifs de la photo de la case i : collage + photo, puis filtre du collage. */
export function paramsForPhoto(doc: Pick<CollageDoc, 'adjust' | 'filter' | 'photos'>, i: number): ColorParams {
  const f = filterById(doc.filter?.id)
  return {
    adjust: combine(doc.adjust, doc.photos[i]?.adjust),
    look: f ? f.look : null,
    intensity: f ? (doc.filter?.intensity ?? 1) : 0,
  }
}

/** Vignettage total de la case i (réglages + filtre pondéré par son intensité), de 0 à 1. */
export function vignetteFor(doc: Pick<CollageDoc, 'adjust' | 'filter' | 'photos'>, i: number): number {
  const p = paramsForPhoto(doc, i)
  return clamp01(p.adjust.vignette + (p.look?.adjust?.vignette ?? 0) * p.intensity)
}

/** Le traitement ne change rien : on peut dessiner la photo telle quelle. */
export function isIdentity(p: ColorParams): boolean {
  const { vignette: _v, ...rest } = p.adjust
  void _v
  return isNeutral(rest) && (!p.look || p.intensity <= 0)
}

/** Clé de cache du traitement (le vignettage n'en fait pas partie : il est dessiné à part). */
export function paramsKey(p: ColorParams): string {
  const a = ADJUST_KEYS.filter((k) => k !== 'vignette').map((k) => p.adjust[k].toFixed(3))
  return `${a.join(',')}|${p.look ? JSON.stringify(p.look) : '-'}|${p.intensity.toFixed(3)}`
}

/**
 * Réglage automatique à partir d'un échantillon de pixels RGBA (une photo réduite) :
 * exposition vers une luminosité moyenne, contraste selon l'étendue, balance des blancs douce.
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
