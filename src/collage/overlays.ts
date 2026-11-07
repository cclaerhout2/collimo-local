/**
 * Textes et stickers posés sur le collage : création, styles prédéfinis, mise en page du texte
 * et dessin sur un Canvas 2D, avec les effets (contour, ombre, lueur, étiquette).
 */
import { DEFAULT_FONT } from '../stickers/fonts'
import type { Drawable } from './render'
import type { IconOverlay, ImageOverlay, Overlay, TextEffects, TextOverlay } from './types'

/** Contexte de dessin 2D, à l'écran ou hors écran. */
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Effets d'un nouveau texte : tous éteints, avec des réglages prêts si on les allume. */
export const DEFAULT_EFFECTS: TextEffects = {
  stroke: { on: false, color: '#000000', width: 0.35 },
  shadow: { on: false, color: '#000000', blur: 0.4, distance: 0.3 },
  glow: { on: false, color: '#2dd4a7', blur: 0.5 },
  label: { on: false, color: '#ffffff', padding: 0.35, radius: 0.3 },
}

/** Compteur qui distingue les identifiants créés dans la même milliseconde. */
let seq = 0
/**
 * Crée un identifiant d'élément unique (horodatage et compteur, en base 36).
 * @returns l'identifiant, commençant par `o`
 */
export function newOverlayId(): string {
  seq += 1
  return `o${Date.now().toString(36)}${seq.toString(36)}`
}

/**
 * Crée un texte au centre du collage, mis en forme selon un style prédéfini.
 * @param text - texte à afficher
 * @param preset - style prédéfini (le premier par défaut)
 * @returns le nouvel élément
 */
export function newText(text: string, preset: TextPreset = TEXT_PRESETS[0]): TextOverlay {
  return applyPreset(
    {
      id: newOverlayId(),
      type: 'text',
      cx: 0.5,
      cy: 0.5,
      angle: 0,
      opacity: 1,
      text,
      font: { family: DEFAULT_FONT, weight: 700, italic: false },
      size: 0.1,
      width: 0.8,
      align: 'center',
      color: '#ffffff',
      effects: structuredClone(DEFAULT_EFFECTS),
    },
    preset,
  )
}

/**
 * Crée une icône au centre du collage.
 * @param set - bibliothèque d'origine
 * @param name - nom de l'icône dans sa bibliothèque
 * @param svg - balise `<svg>` complète de l'icône
 * @param color - couleur, pour les icônes d'une couleur
 * @returns le nouvel élément
 */
export function newIcon(set: IconOverlay['set'], name: string, svg: string, color?: string): IconOverlay {
  return { id: newOverlayId(), type: 'icon', cx: 0.5, cy: 0.5, angle: 0, opacity: 1, set, name, svg, color, size: 0.25 }
}

/**
 * Crée une image (sticker) au centre du collage.
 * @param fileId - identifiant du fichier image dans le stockage local
 * @param name - nom du fichier d'origine
 * @param mimeType - type MIME du fichier
 * @param aspect - hauteur / largeur de l'image
 * @returns le nouvel élément
 */
export function newImage(fileId: string, name: string, mimeType: string, aspect: number): ImageOverlay {
  return { id: newOverlayId(), type: 'image', cx: 0.5, cy: 0.5, angle: 0, opacity: 1, fileId, name, mimeType, size: 0.35, aspect }
}

/**
 * Copie un élément, légèrement décalée vers le bas à droite pour qu'on la voie.
 * @param o - élément à copier
 * @returns la copie, avec un nouvel identifiant
 */
export function duplicateOverlay(o: Overlay): Overlay {
  const copy = structuredClone(o)
  copy.id = newOverlayId()
  copy.cx = Math.min(0.95, o.cx + 0.04)
  copy.cy = Math.min(0.95, o.cy + 0.04)
  return copy
}

// --- Styles prédéfinis du texte ---

/** Style prédéfini d'un texte : police, couleur et effets. */
export interface TextPreset {
  id: string
  /** Police du style ; ce qui manque reprend la police par défaut. */
  font?: Partial<TextOverlay['font']>
  /** Couleur CSS du texte. */
  color: string
  /** Effets du style ; ce qui manque reprend {@link DEFAULT_EFFECTS}. */
  effects?: { [K in keyof TextEffects]?: Partial<TextEffects[K]> }
}

/** Styles de texte proposés, dans l'ordre d'affichage ; le premier sert pour un nouveau texte. */
export const TEXT_PRESETS: TextPreset[] = [
  { id: 'shadow', color: '#ffffff', effects: { shadow: { on: true, color: '#000000', blur: 0.5, distance: 0.25 } } },
  { id: 'outline', color: '#ffffff', effects: { stroke: { on: true, color: '#111111', width: 0.45 } } },
  { id: 'label-light', color: '#111111', effects: { label: { on: true, color: '#ffffff', padding: 0.35, radius: 0.25 } } },
  { id: 'label-dark', color: '#ffffff', effects: { label: { on: true, color: '#111111', padding: 0.35, radius: 0.25 } } },
  {
    id: 'title-red',
    font: { family: 'Anton', weight: 400 },
    color: '#b3261e',
    effects: { shadow: { on: true, color: '#7f1d1d', blur: 0.15, distance: 0.35 } },
  },
  {
    id: 'neon',
    font: { family: 'Righteous', weight: 400 },
    color: '#ffffff',
    effects: { glow: { on: true, color: '#2dd4a7', blur: 0.7 } },
  },
  {
    id: 'script',
    font: { family: 'Pacifico', weight: 400 },
    color: '#ffffff',
    effects: { shadow: { on: true, color: '#000000', blur: 0.4, distance: 0.2 } },
  },
  {
    id: 'poster',
    font: { family: 'Bebas Neue', weight: 400 },
    color: '#facc15',
    effects: { stroke: { on: true, color: '#111111', width: 0.3 } },
  },
  {
    id: 'tag',
    font: { family: 'Montserrat', weight: 700 },
    color: '#062b21',
    effects: { label: { on: true, color: '#2dd4a7', padding: 0.45, radius: 1 } },
  },
  {
    id: 'marker',
    font: { family: 'Permanent Marker', weight: 400 },
    color: '#111111',
    effects: { label: { on: true, color: '#fde68a', padding: 0.3, radius: 0 } },
  },
]

/**
 * Applique un style : police, couleur et effets ; le texte, la position et la taille restent.
 * @param o - texte à modifier
 * @param p - style à appliquer
 * @returns une copie du texte avec le style
 */
export function applyPreset(o: TextOverlay, p: TextPreset): TextOverlay {
  const effects = structuredClone(DEFAULT_EFFECTS)
  for (const k of Object.keys(effects) as (keyof TextEffects)[]) Object.assign(effects[k], p.effects?.[k] ?? {})
  return {
    ...o,
    font: { family: DEFAULT_FONT, weight: 700, italic: false, ...p.font },
    color: p.color,
    effects,
  }
}

// --- Mise en page du texte ---

/**
 * Police au format CSS du Canvas (`ctx.font`), avec des polices de secours.
 * @param o - texte
 * @param px - taille de la police, en pixels
 * @returns la description de la police
 */
export function fontString(o: TextOverlay, px: number): string {
  return `${o.font.italic ? 'italic ' : ''}${o.font.weight} ${px}px "${o.font.family}", system-ui, sans-serif`
}

/** Hauteur d'une ligne de texte, en multiple de la taille de la police. */
export const LINE_HEIGHT = 1.2

/**
 * Découpe un texte en lignes : retours à la ligne saisis, puis coupure aux espaces sous la largeur max.
 * Un mot plus long que la largeur max reste seul sur sa ligne, sans être coupé.
 * @param measure - largeur d'un texte, en pixels
 * @param text - texte à découper
 * @param maxWidth - largeur maximale d'une ligne, en pixels
 * @returns les lignes, sans espaces en fin de ligne
 */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((w) => w.length > 0)
    let line = ''
    for (const w of words) {
      const next = line + w
      if (line.trim() && measure(next.trimEnd()) > maxWidth && !/^\s+$/.test(w)) {
        out.push(line.trimEnd())
        line = w
      } else line = next
    }
    out.push(line.trimEnd())
  }
  return out
}

/** Mise en page d'un texte, en pixels, pour une taille de collage donnée. */
export interface TextLayout {
  /** Taille de la police, en pixels. */
  px: number
  /** Lignes, après découpe. */
  lines: string[]
  /** Largeur de chaque ligne, en pixels. */
  widths: number[]
  /** Hauteur d'une ligne, en pixels. */
  lineHeight: number
  /** Largeur du bloc de texte, sans l'étiquette, en pixels. */
  textW: number
  /** Hauteur du bloc de texte, sans l'étiquette, en pixels. */
  textH: number
  /** Marge de l'étiquette, en pixels (0 si pas d'étiquette). */
  pad: number
}

/**
 * Met en page un texte : taille de police, découpe en lignes et dimensions du bloc.
 * @param ctx - contexte de dessin, qui sert à mesurer (sa police est modifiée)
 * @param o - texte
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @returns la mise en page, en pixels
 */
export function layoutText(ctx: Ctx, o: TextOverlay, width: number, height: number): TextLayout {
  const px = Math.max(1, o.size * Math.min(width, height))
  ctx.font = fontString(o, px)
  const lines = wrapLines((s) => ctx.measureText(s).width, o.text || ' ', o.width * width)
  const widths = lines.map((l) => ctx.measureText(l).width)
  const lineHeight = px * LINE_HEIGHT
  return {
    px,
    lines,
    widths,
    lineHeight,
    textW: Math.max(px * 0.3, ...widths),
    textH: lineHeight * lines.length,
    pad: o.effects.label.on ? o.effects.label.padding * px : 0,
  }
}

/** Contexte de dessin réservé aux mesures de texte, créé au premier besoin. */
let measureCtx: Ctx | null = null
/**
 * Contexte de dessin réservé aux mesures de texte.
 * @returns le contexte, partagé
 */
function measuring(): Ctx {
  if (!measureCtx) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas')
    measureCtx = c.getContext('2d') as Ctx
  }
  return measureCtx
}

/**
 * Taille en pixels du cadre de sélection d'un élément (étiquette comprise pour un texte).
 * @param o - élément
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @returns largeur et hauteur du cadre, en pixels, avant rotation
 */
export function overlayBox(o: Overlay, width: number, height: number): { w: number; h: number } {
  const unit = Math.min(width, height)
  if (o.type === 'text') {
    const l = layoutText(measuring(), o, width, height)
    return { w: l.textW + 2 * l.pad, h: l.textH + 2 * l.pad }
  }
  const w = o.size * unit
  return { w, h: o.type === 'image' ? w * o.aspect : w }
}

// --- Dessin ---

/**
 * Dessine un texte et ses effets autour de l'origine du contexte (déjà placée et tournée) :
 * étiquette, lueur, ombre, contour, puis le texte.
 * @param ctx - contexte de dessin
 * @param o - texte
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 */
function drawText(ctx: Ctx, o: TextOverlay, width: number, height: number) {
  const l = layoutText(ctx, o, width, height)
  const e = o.effects
  const top = -l.textH / 2
  const x = o.align === 'left' ? -l.textW / 2 : o.align === 'right' ? l.textW / 2 : 0
  ctx.textAlign = o.align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  const each = (fn: (line: string, y: number) => void) => l.lines.forEach((line, i) => fn(line, top + l.lineHeight * (i + 0.5)))
  const noShadow = () => {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  if (e.label.on) {
    const w = l.textW + 2 * l.pad
    const h = l.textH + 2 * l.pad
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, (Math.min(w, h) / 2) * e.label.radius)
    ctx.fillStyle = e.label.color
    ctx.fill()
  }
  const strokeWidth = e.stroke.on ? e.stroke.width * l.px * 0.3 : 0
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = e.stroke.color
  ctx.fillStyle = o.color

  if (e.glow.on) {
    ctx.shadowColor = e.glow.color
    ctx.shadowBlur = e.glow.blur * l.px * 0.8
    ctx.fillStyle = e.glow.color
    each((s, y) => ctx.fillText(s, x, y))
    each((s, y) => ctx.fillText(s, x, y))
    ctx.fillStyle = o.color
  }
  if (e.shadow.on) {
    // Le décalage des ombres ne suit pas la rotation du contexte : on le tourne nous-mêmes.
    const d = e.shadow.distance * l.px * 0.25
    const t = ctx.getTransform()
    const scale = Math.hypot(t.a, t.b) || 1
    ctx.shadowColor = e.shadow.color
    ctx.shadowBlur = e.shadow.blur * l.px * 0.5 * scale
    ctx.shadowOffsetX = d * scale * Math.SQRT1_2
    ctx.shadowOffsetY = d * scale * Math.SQRT1_2
    if (strokeWidth) each((s, y) => ctx.strokeText(s, x, y))
    else each((s, y) => ctx.fillText(s, x, y))
  }
  noShadow()
  if (strokeWidth) each((s, y) => ctx.strokeText(s, x, y))
  each((s, y) => ctx.fillText(s, x, y))
}

/**
 * Dessine un élément à sa place, tourné et avec son opacité. Les icônes et images ont besoin d'une
 * source déjà décodée (`img`) ; sans elle (aperçu en cours de chargement), rien n'est dessiné.
 * @param ctx - contexte de dessin
 * @param o - élément
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param img - image décodée, pour une icône ou une image
 */
export function drawOverlay(ctx: Ctx, o: Overlay, width: number, height: number, img?: Drawable) {
  if (o.type !== 'text' && !img) return
  ctx.save()
  ctx.translate(o.cx * width, o.cy * height)
  ctx.rotate((o.angle * Math.PI) / 180)
  ctx.globalAlpha = Math.max(0, Math.min(1, o.opacity))
  if (o.type === 'text') drawText(ctx, o, width, height)
  else if (img) {
    const box = overlayBox(o, width, height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.source, -box.w / 2, -box.h / 2, box.w, box.h)
  }
  ctx.restore()
}

// --- Icônes : SVG vers image ---

/**
 * SVG de l'icône avec sa couleur (les icônes d'une couleur utilisent `currentColor`).
 * @param o - icône
 * @returns le SVG, couleur remplacée s'il y en a une
 */
export function coloredSvg(o: IconOverlay): string {
  return o.color ? o.svg.replace(/currentColor/g, o.color) : o.svg
}

/**
 * Décode le SVG d'une icône en image carrée.
 * @param o - icône
 * @param side - côté voulu, en pixels (16 au moins)
 * @returns l'image décodée, à libérer avec `close()`
 */
export async function rasterizeIcon(o: IconOverlay, side: number): Promise<Drawable & { close(): void }> {
  const s = Math.max(16, Math.ceil(side))
  const svg = coloredSvg(o).replace(/width="\d+" height="\d+"/, `width="${s}" height="${s}"`)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const el = new Image()
    el.src = url
    await el.decode()
    const bitmap = await createImageBitmap(el, { resizeWidth: s, resizeHeight: s, resizeQuality: 'high' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Clé de cache d'une icône rasterisée : change si la couleur ou l'icône change.
 * @param o - icône
 * @returns la clé
 */
export const iconKey = (o: IconOverlay) => `${o.set}:${o.name}:${o.color ?? ''}`
