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
  /** Rotation du rectangle autour de son centre, en degrés (0 = droit). */
  angle?: number
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
    const angle = typeof m.angle === 'number' && Number.isFinite(m.angle) ? normalizeMaskAngle(m.angle) : 0
    out.push({ id: typeof m.id === 'string' && m.id ? m.id : newMaskId(), ...r, mode, strength, ...(angle ? { angle } : {}) })
  }
  return out.length ? out : undefined
}

/**
 * Ramène un angle dans ]-180, 180], arrondi au dixième de degré.
 * @param a - angle en degrés
 * @returns l'angle normalisé
 */
export function normalizeMaskAngle(a: number): number {
  let v = ((((a + 180) % 360) + 360) % 360) - 180
  if (v === -180) v = 180
  return Math.round(v * 10) / 10
}

/**
 * Clé de cache d'une liste de zones : change dès qu'une zone change.
 * @param masks - zones
 * @returns une chaîne, vide sans zone
 */
export function masksKey(masks: Mask[] | undefined): string {
  if (!masks?.length) return ''
  return masks
    .map(
      (m) =>
        `${m.mode}:${m.strength.toFixed(2)}:${m.x.toFixed(4)},${m.y.toFixed(4)},${m.w.toFixed(4)},${m.h.toFixed(4)},${(m.angle ?? 0).toFixed(1)}`,
    )
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
  const b = m.angle ? rotatedBounds(m) : m
  const x = Math.max(0, Math.floor(b.x * width))
  const y = Math.max(0, Math.floor(b.y * height))
  const w = Math.max(1, Math.min(width, Math.ceil((b.x + b.w) * width)) - x)
  const h = Math.max(1, Math.min(height, Math.ceil((b.y + b.h) * height)) - y)
  return { x, y, w, h }
}

/**
 * Boîte englobante (en fractions) d'un rectangle tourné autour de son centre. Comme les fractions
 * ne sont pas isotropes (l'image n'est pas carrée), le calcul se fait en unités de l'image : la
 * largeur vaut 1, la hauteur `aspect` ; sans `aspect`, on suppose l'image carrée (approximation
 * suffisante pour la zone de calcul, le découpage exact se faisant au dessin).
 * @param m - zone tournée
 * @param aspect - hauteur / largeur de l'image
 * @returns la boîte englobante, en fractions
 */
export function rotatedBounds(m: Pick<Mask, 'x' | 'y' | 'w' | 'h' | 'angle'>, aspect = 1): { x: number; y: number; w: number; h: number } {
  const a = ((m.angle ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  // Demi-côtés en unités image (largeur 1, hauteur aspect).
  const hw = (m.w * 1) / 2
  const hh = (m.h * aspect) / 2
  const bw = hw * cos + hh * sin
  const bh = hw * sin + hh * cos
  const cx = m.x + m.w / 2
  const cy = m.y + m.h / 2
  return { x: cx - bw, y: cy - bh / aspect, w: bw * 2, h: (bh * 2) / aspect }
}

/**
 * Découpe le contexte au rectangle (tourné) d'une zone, en pixels de l'image.
 * @param ctx - contexte
 * @param m - zone
 * @param width - largeur de l'image, en pixels
 * @param height - hauteur de l'image, en pixels
 */
function clipToMask(ctx: Ctx2d, m: Mask, width: number, height: number) {
  const cx = (m.x + m.w / 2) * width
  const cy = (m.y + m.h / 2) * height
  const w = m.w * width
  const h = m.h * height
  ctx.beginPath()
  if (m.angle) {
    ctx.translate(cx, cy)
    ctx.rotate((m.angle * Math.PI) / 180)
    ctx.rect(-w / 2, -h / 2, w, h)
    ctx.rotate((-m.angle * Math.PI) / 180)
    ctx.translate(-cx, -cy)
  } else ctx.rect(m.x * width, m.y * height, w, h)
  ctx.clip()
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
 * Flou d'une zone avec l'intensité d'une zone de référence (pour les rectangles tournés, dont la
 * boîte englobante est plus grande que la zone).
 * @param ctx - contexte
 * @param r - zone à flouter (boîte englobante), en pixels
 * @param ref - taille de la zone de référence, en pixels
 * @param strength - intensité
 */
function blurZoneAs(ctx: Ctx2d, r: PxRect, ref: PxRect, strength: number) {
  const f = blurFraction(strength)
  // Même taille de « petit » canvas que pour la zone de référence : même flou perçu.
  const sw = Math.max(2, ref.w * f)
  const sh = Math.max(2, ref.h * f)
  const small = canvas2d(sw * (r.w / ref.w), sh * (r.h / ref.h))
  const mid = canvas2d(Math.max(2, r.w * Math.sqrt(f)), Math.max(2, r.h * Math.sqrt(f)))
  for (const c of [small.ctx, mid.ctx]) {
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
  }
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
 * Mosaïque d'une zone avec la taille de blocs d'une zone de référence.
 * @param ctx - contexte
 * @param r - zone (boîte englobante), en pixels
 * @param ref - taille de la zone de référence, en pixels
 * @param strength - intensité
 */
function pixelateZoneAs(ctx: Ctx2d, r: PxRect, ref: PxRect, strength: number) {
  const block = ref.w / pixelateBlocks(strength)
  const across = Math.max(1, Math.round(r.w / block))
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
    const withAspect = m.angle ? { ...m, ...rotatedBounds(m, canvas.height / canvas.width), angle: 0 } : m
    const r = toPx(withAspect, canvas.width, canvas.height)
    if (!m.angle) {
      if (m.mode === 'pixelate') pixelateZone(ctx, r, m.strength)
      else if (m.mode === 'fill') fillZone(ctx, r, m.strength)
      else blurZone(ctx, r, m.strength)
      continue
    }
    // Zone tournée : l'effet est calculé sur la boîte englobante dans une copie, puis reporté
    // à l'intérieur du rectangle tourné seulement. L'intensité reste relative à la zone elle-même.
    const zone = { x: r.x, y: r.y, w: r.w, h: r.h }
    const own = { x: Math.round(m.w * canvas.width), y: Math.round(m.h * canvas.height) }
    const tmp = canvas2d(canvas.width, canvas.height)
    tmp.ctx.drawImage(canvas, 0, 0)
    // Pour une intensité comparable à une zone droite de même taille, le rayon est basé sur la zone, pas sur sa boîte.
    const ref = { x: zone.x, y: zone.y, w: Math.max(1, own.x), h: Math.max(1, own.y) }
    if (m.mode === 'pixelate') pixelateZoneAs(tmp.ctx, zone, ref, m.strength)
    else if (m.mode === 'fill') fillZone(tmp.ctx, zone, m.strength)
    else blurZoneAs(tmp.ctx, zone, ref, m.strength)
    ctx.save()
    clipToMask(ctx, m, canvas.width, canvas.height)
    ctx.drawImage(tmp.canvas, zone.x, zone.y, zone.w, zone.h, zone.x, zone.y, zone.w, zone.h)
    ctx.restore()
    release(tmp.canvas)
  }
  return { source: canvas, width: canvas.width, height: canvas.height, close: () => release(canvas) }
}
