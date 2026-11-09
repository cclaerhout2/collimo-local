/**
 * Zones masquées d'une photo (flou, mosaïque ou aplat) : nettoyage des rectangles, et application
 * sur l'image avant son dessin dans la case. Les zones sont en coordonnées relatives à l'image
 * d'origine (de 0 à 1), donc indépendantes du cadrage, du zoom, de la rotation et du miroir ; leur
 * intensité est relative à la taille de la zone, donc identique à l'aperçu et à l'export.
 */
import type { Drawable } from './render'

/** Façon de masquer une zone. */
export type MaskMode = 'blur' | 'pixelate' | 'fill'

/** Zone masquée d'une photo, en fractions de l'image d'origine. */
export interface Mask {
  /** Identifiant, pour l'édition. */
  id: string
  /** Bord gauche (0 à 1). */
  x: number
  /** Bord haut (0 à 1). */
  y: number
  /** Largeur (0 à 1). */
  w: number
  /** Hauteur (0 à 1). */
  h: number
  mode: MaskMode
  /** Intensité, de 0 (minimum encore efficace) à 1 (maximum). */
  strength: number
}

/** Mode et intensité par défaut d'une nouvelle zone. */
export const DEFAULT_MASK: Pick<Mask, 'mode' | 'strength'> = { mode: 'blur', strength: 0.6 }

/** Plus petite dimension gardée pour une zone (en fraction de l'image), pour écarter un simple clic. */
export const MIN_MASK_SIZE = 0.01

/** Image masquée, à libérer une fois dessinée. */
export interface Masked extends Drawable {
  source: HTMLCanvasElement | OffscreenCanvas
  close(): void
}

/**
 * Nouvel identifiant de zone.
 * @returns une chaîne courte unique à la session
 */
export function newMaskId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Borne un nombre.
 * @param v - valeur
 * @param lo - minimum
 * @param hi - maximum
 * @returns la valeur bornée
 */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Arrondit une fraction à quatre décimales : assez fin pour une image de 10 000 px, et stable dans le fichier projet.
 * @param v - valeur
 * @returns la valeur arrondie
 */
const round4 = (v: number) => Math.round(v * 10000) / 10000

/**
 * Normalise un rectangle tracé dans n'importe quel sens, le borne à l'image et arrondit ses coordonnées.
 * @param r - rectangle, largeur ou hauteur éventuellement négatives
 * @returns le rectangle remis d'équerre et borné à [0, 1]
 */
export function normalizeRect(r: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  const x1 = clamp(Math.min(r.x, r.x + r.w), 0, 1)
  const x2 = clamp(Math.max(r.x, r.x + r.w), 0, 1)
  const y1 = clamp(Math.min(r.y, r.y + r.h), 0, 1)
  const y2 = clamp(Math.max(r.y, r.y + r.h), 0, 1)
  return { x: round4(x1), y: round4(y1), w: round4(x2 - x1), h: round4(y2 - y1) }
}

/**
 * Lit une liste de zones d'un fichier projet : ignore ce qui n'est pas une zone valide.
 * @param raw - valeur lue dans le fichier
 * @returns les zones valides, ou `undefined` s'il n'y en a aucune
 */
export function parseMasks(raw: unknown): Mask[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: Mask[] = []
  for (const m of raw as Partial<Mask>[]) {
    if (!m || typeof m.x !== 'number' || typeof m.y !== 'number' || typeof m.w !== 'number' || typeof m.h !== 'number') continue
    if (![m.x, m.y, m.w, m.h].every(Number.isFinite)) continue
    const r = normalizeRect({ x: m.x, y: m.y, w: m.w, h: m.h })
    if (r.w < MIN_MASK_SIZE || r.h < MIN_MASK_SIZE) continue
    const mode: MaskMode = m.mode === 'pixelate' || m.mode === 'fill' ? m.mode : 'blur'
    const strength = typeof m.strength === 'number' && Number.isFinite(m.strength) ? clamp(m.strength, 0, 1) : DEFAULT_MASK.strength
    out.push({ id: typeof m.id === 'string' && m.id ? m.id : newMaskId(), ...r, mode, strength })
  }
  return out.length ? out : undefined
}

/**
 * Clé de cache d'une liste de zones : change dès qu'une zone change.
 * @param masks - zones
 * @returns une chaîne, vide sans zone
 */
export function masksKey(masks: Mask[] | undefined): string {
  if (!masks?.length) return ''
  return masks
    .map((m) => `${m.mode}:${m.strength.toFixed(2)}:${m.x.toFixed(4)},${m.y.toFixed(4)},${m.w.toFixed(4)},${m.h.toFixed(4)}`)
    .join('|')
}

/**
 * Nombre de blocs sur la largeur d'une zone en mosaïque : de 14 (intensité 0) à 4 (intensité 1).
 * Indépendant de la résolution, donc un texte illisible à l'aperçu l'est aussi à l'export.
 * @param strength - intensité de 0 à 1
 * @returns le nombre de blocs (entier, au moins 4)
 */
export function pixelateBlocks(strength: number): number {
  return Math.max(4, Math.round(14 - clamp(strength, 0, 1) * 10))
}

/**
 * Facteur de réduction du flou : la zone est réduite à cette fraction de sa largeur puis
 * ré-agrandie, en plusieurs passes. De 1/8 (intensité 0) à 1/40 (intensité 1).
 * @param strength - intensité de 0 à 1
 * @returns la fraction de réduction (entre 0 et 1)
 */
export function blurFraction(strength: number): number {
  return 1 / (8 + clamp(strength, 0, 1) * 32)
}

/** Canvas 2D, hors écran si le navigateur le permet. */
type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type Ctx2d = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

/**
 * Crée un canvas avec son contexte 2D.
 * @param w - largeur, en pixels (au moins 1)
 * @param h - hauteur, en pixels (au moins 1)
 * @returns le canvas et son contexte
 * @throws Error si le navigateur ne fournit pas de contexte 2D
 */
function canvas2d(w: number, h: number): { canvas: AnyCanvas; ctx: Ctx2d } {
  const width = Math.max(1, Math.round(w))
  const height = Math.max(1, Math.round(h))
  let canvas: AnyCanvas
  if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height)
  else {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d') as Ctx2d | null
  if (!ctx) throw new Error('masquage impossible : pas de contexte de dessin')
  return { canvas, ctx }
}

/**
 * Libère un canvas (taille 0 : la mémoire est rendue tout de suite).
 * @param c - canvas à libérer
 */
function release(c: AnyCanvas) {
  c.width = 0
  c.height = 0
}

/** Zone en pixels, entière, d'au moins 1 × 1. */
interface PxRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Convertit une zone relative en pixels de l'image.
 * @param m - zone
 * @param width - largeur de l'image, en pixels
 * @param height - hauteur de l'image, en pixels
 * @returns la zone en pixels entiers, d'au moins 1 × 1
 */
function toPx(m: Mask, width: number, height: number): PxRect {
  const x = Math.floor(m.x * width)
  const y = Math.floor(m.y * height)
  const w = Math.max(1, Math.ceil((m.x + m.w) * width) - x)
  const h = Math.max(1, Math.ceil((m.y + m.h) * height) - y)
  return { x, y, w, h }
}

/**
 * Floute une zone : réduction forte puis ré-agrandissement lissé, en trois passes, ce qui donne un
 * flou doux sans dépendre de `ctx.filter` (absent de certains navigateurs).
 * @param ctx - contexte de l'image en cours de masquage
 * @param r - zone en pixels
 * @param strength - intensité
 */
function blurZone(ctx: Ctx2d, r: PxRect, strength: number) {
  const f = blurFraction(strength)
  const small = canvas2d(Math.max(2, r.w * f), Math.max(2, r.h * f))
  const mid = canvas2d(Math.max(2, r.w * Math.sqrt(f)), Math.max(2, r.h * Math.sqrt(f)))
  for (const c of [small.ctx, mid.ctx]) {
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
  }
  // Descente en deux paliers (lissage à chaque étape), puis remontée en deux paliers.
  mid.ctx.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, mid.canvas.width, mid.canvas.height)
  small.ctx.drawImage(mid.canvas, 0, 0, small.canvas.width, small.canvas.height)
  mid.ctx.clearRect(0, 0, mid.canvas.width, mid.canvas.height)
  mid.ctx.drawImage(small.canvas, 0, 0, mid.canvas.width, mid.canvas.height)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mid.canvas, 0, 0, mid.canvas.width, mid.canvas.height, r.x, r.y, r.w, r.h)
  ctx.restore()
  release(small.canvas)
  release(mid.canvas)
}

/**
 * Mosaïque : la zone est réduite à quelques blocs puis ré-agrandie sans lissage.
 * @param ctx - contexte de l'image en cours de masquage
 * @param r - zone en pixels
 * @param strength - intensité
 */
function pixelateZone(ctx: Ctx2d, r: PxRect, strength: number) {
  const across = pixelateBlocks(strength)
  const block = r.w / across
  const down = Math.max(1, Math.round(r.h / block))
  const small = canvas2d(across, down)
  small.ctx.imageSmoothingEnabled = true
  small.ctx.imageSmoothingQuality = 'high'
  small.ctx.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, across, down)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small.canvas, 0, 0, across, down, r.x, r.y, r.w, r.h)
  ctx.restore()
  release(small.canvas)
}

/**
 * Aplat : la zone est remplie de sa couleur moyenne (réduction à un pixel), un peu assombrie
 * avec l'intensité pour rester discret sur un fond clair.
 * @param ctx - contexte de l'image en cours de masquage
 * @param r - zone en pixels
 * @param strength - intensité
 */
function fillZone(ctx: Ctx2d, r: PxRect, strength: number) {
  const one = canvas2d(1, 1)
  one.ctx.imageSmoothingEnabled = true
  one.ctx.imageSmoothingQuality = 'high'
  one.ctx.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, 1, 1)
  const [cr, cg, cb] = one.ctx.getImageData(0, 0, 1, 1).data
  release(one.canvas)
  const k = 1 - clamp(strength, 0, 1) * 0.35
  ctx.save()
  ctx.fillStyle = `rgb(${Math.round(cr * k)},${Math.round(cg * k)},${Math.round(cb * k)})`
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}

/**
 * Applique les zones masquées à une image et renvoie la copie masquée. Sans zone, renvoie une
 * copie telle quelle (pour un appel uniforme) ; le résultat est à libérer avec `close()`.
 * @param img - image d'origine (déjà filtrée, le cas échéant)
 * @param masks - zones à appliquer
 * @returns l'image masquée, de la même taille
 */
export function applyMasks(img: Drawable, masks: Mask[]): Masked {
  const { canvas, ctx } = canvas2d(img.width, img.height)
  ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height)
  for (const m of masks) {
    const r = toPx(m, canvas.width, canvas.height)
    if (m.mode === 'pixelate') pixelateZone(ctx, r, m.strength)
    else if (m.mode === 'fill') fillZone(ctx, r, m.strength)
    else blurZone(ctx, r, m.strength)
  }
  return { source: canvas, width: canvas.width, height: canvas.height, close: () => release(canvas) }
}
