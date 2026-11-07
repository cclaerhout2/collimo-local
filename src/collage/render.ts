/**
 * Dessin d'un collage sur un Canvas 2D : photos dans leurs cases, vignettage, écarts et contours
 * des cases en forme, décor, puis textes et stickers.
 */
import { cellGeometry, decorGeometry, gapPx, outlinePx, type CellGeom } from './cells'
import { vignetteFor } from './color'
import { placeImage, type CellBox } from './geometry'
import { drawOverlay } from './overlays'
import type { CollageDoc, Layout, Overlay } from './types'

/** Toute source que le Canvas sait dessiner et dont on connaît la taille. */
export interface Drawable {
  source: CanvasImageSource
  width: number
  height: number
}

/** Contexte de dessin 2D, à l'écran ou hors écran (export dans un worker). */
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Objets `Path2D` déjà construits, par texte du chemin ; vidé au-delà de 4000 pour borner la mémoire. */
const paths = new Map<string, Path2D>()
/**
 * Objet `Path2D` d'un chemin SVG, réutilisé d'un appel à l'autre.
 * @param d - chemin SVG, en pixels
 * @returns l'objet `Path2D` (partagé, à ne pas modifier)
 */
function path2d(d: string): Path2D {
  let p = paths.get(d)
  if (!p) {
    if (paths.size > 4000) paths.clear()
    p = new Path2D(d)
    paths.set(d, p)
  }
  return p
}

/**
 * Découpe le dessin à la forme de la case (chemin, ou rectangle aux coins arrondis).
 * @param ctx - contexte de dessin
 * @param cell - géométrie de la case, ou simple boîte en pixels
 */
function clipCell(ctx: Ctx, cell: CellGeom | CellBox) {
  const g = 'box' in cell ? cell : { box: cell }
  if (g.path) {
    ctx.clip(path2d(g.path), g.evenodd ? 'evenodd' : 'nonzero')
    return
  }
  const b = g.box
  ctx.beginPath()
  if (b.radius > 0.5 && 'roundRect' in ctx) ctx.roundRect(b.x, b.y, b.w, b.h, b.radius)
  else ctx.rect(b.x, b.y, b.w, b.h)
  ctx.clip()
}

/**
 * Dessine une photo dans sa case : couverture complète, décalage, zoom, rotation, miroir.
 * @param ctx - contexte de dessin
 * @param img - photo à dessiner
 * @param cell - géométrie de la case, ou simple boîte en pixels
 * @param crop - cadrage de la photo
 */
export function drawPhotoInCell(ctx: Ctx, img: Drawable, cell: CellGeom | CellBox, crop: CollageDoc['photos'][number]['crop']) {
  const box = 'box' in cell ? cell.box : cell
  const p = placeImage(img.width, img.height, box.w, box.h, crop)
  ctx.save()
  clipCell(ctx, cell)
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2)
  ctx.rotate((crop.angle * Math.PI) / 180)
  ctx.translate(p.dx, p.dy)
  ctx.scale(crop.flip ? -p.scale : p.scale, p.scale)
  ctx.drawImage(img.source, -img.width / 2, -img.height / 2, img.width, img.height)
  ctx.restore()
}

/**
 * Vignettage : assombrit les bords de la case.
 * @param ctx - contexte de dessin
 * @param cell - géométrie de la case, ou simple boîte en pixels
 * @param amount - intensité, de 0 (rien) à 1
 */
export function drawVignette(ctx: Ctx, cell: CellGeom | CellBox, amount: number) {
  if (amount <= 0) return
  const box = 'box' in cell ? cell.box : cell
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const r = Math.hypot(box.w, box.h) / 2
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, amount * 0.75)})`)
  ctx.save()
  clipCell(ctx, cell)
  ctx.fillStyle = g
  ctx.fillRect(box.x, box.y, box.w, box.h)
  ctx.restore()
}

/** Réglages de finition des cases, en pixels, pour une taille de collage donnée. */
export interface CellStyle {
  /** Couleur du fond, qui sert à tracer l'écart. */
  background: string
  /** Écart entre cases, en pixels. */
  gap: number
  /** Épaisseur du contour optionnel, en pixels (0 = aucun). */
  outline: number
  outlineColor: string
}

/**
 * Calcule la finition des cases d'un collage à une taille donnée.
 * @param doc - collage
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @returns couleurs, écart et épaisseur du contour (blanc par défaut)
 */
export function cellStyle(doc: CollageDoc, width: number, height: number): CellStyle {
  return {
    background: doc.background,
    gap: gapPx(width, height, doc.borders),
    outline: outlinePx(width, height, doc.borders),
    outlineColor: doc.borders.outlineColor ?? '#ffffff',
  }
}

/**
 * Contour optionnel d'une forme de la bibliothèque : aplat dessiné avant la photo.
 * @param ctx - contexte de dessin
 * @param cell - géométrie de la case
 * @param style - finition des cases
 */
export function underCell(ctx: Ctx, cell: CellGeom, style: CellStyle) {
  if (!cell.under) return
  ctx.fillStyle = style.outlineColor
  ctx.fill(path2d(cell.under))
}

/**
 * Finition d'une case en forme : écart (contour couleur du fond) puis contour optionnel.
 * Les rectangles n'en ont pas besoin, leur écart est déjà pris sur leur taille ; les formes de la
 * bibliothèque non plus, leur écart est obtenu en les réduisant (voir {@link underCell}).
 * @param ctx - contexte de dessin
 * @param cell - géométrie de la case
 * @param style - finition des cases
 */
export function finishCell(ctx: Ctx, cell: CellGeom, style: CellStyle) {
  if (!cell.path || cell.shaped) return
  const p = path2d(cell.path)
  ctx.save()
  ctx.lineJoin = 'round'
  if (style.gap > 0 && !cell.noGap) {
    ctx.strokeStyle = style.background
    ctx.lineWidth = style.gap
    ctx.stroke(p)
  }
  if (style.outline > 0) {
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outline
    ctx.stroke(p)
  }
  ctx.restore()
}

/** Couleur « encre » du décor : presque noir, moins dur qu'un noir pur. */
const INK = '#141414'

/**
 * Dessine le décor sans photo de la disposition (perforations, cadre…).
 * @param ctx - contexte de dessin
 * @param doc - collage (pour la couleur du fond et la marge)
 * @param layout - disposition
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 */
export function drawDecor(ctx: Ctx, doc: CollageDoc, layout: Layout, width: number, height: number) {
  for (const d of decorGeometry(layout, width, height, doc.borders)) {
    ctx.fillStyle = d.fill === 'ink' ? INK : d.fill === 'white' ? '#ffffff' : doc.background
    ctx.fill(path2d(d.d), d.evenodd ? 'evenodd' : 'nonzero')
  }
}

/** Options du rendu d'un collage. */
export interface RenderOptions {
  /** Couleur des cases dont la photo n'est pas encore chargée (aperçu). */
  placeholder?: string
  /** Comparaison avant/après : photos sans réglages ni filtre. */
  raw?: boolean
}

/**
 * Rendu complet d'un collage : fond, photos dans leurs cases, finitions, décor, puis textes et stickers.
 * La même fonction sert à l'aperçu et à l'export, ce qui garantit que l'image exportée correspond à ce qui est affiché.
 * @param ctx - contexte de dessin
 * @param doc - collage
 * @param layout - disposition
 * @param width - largeur du collage, en pixels
 * @param height - hauteur du collage, en pixels
 * @param imageFor - photo de la case d'indice donné (déjà filtrée), ou `undefined` si elle n'est pas chargée
 * @param options - options du rendu
 * @param overlayFor - image d'un sticker ou d'une icône, ou `undefined` si elle n'est pas chargée
 */
export function renderCollage(
  ctx: Ctx,
  doc: CollageDoc,
  layout: Layout,
  width: number,
  height: number,
  imageFor: (cellIndex: number) => Drawable | undefined,
  options: RenderOptions = {},
  overlayFor: (o: Overlay) => Drawable | undefined = () => undefined,
) {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = doc.background
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const cells = cellGeometry(layout, width, height, doc.borders)
  const style = cellStyle(doc, width, height)
  cells.forEach((cell, i) => {
    const photo = doc.photos[i]
    const img = imageFor(i)
    underCell(ctx, cell, style)
    if (photo && img) {
      drawPhotoInCell(ctx, img, cell, photo.crop)
      if (!options.raw) drawVignette(ctx, cell, vignetteFor(doc, i))
    } else if (options.placeholder) {
      ctx.save()
      clipCell(ctx, cell)
      ctx.fillStyle = options.placeholder
      ctx.fillRect(cell.box.x, cell.box.y, cell.box.w, cell.box.h)
      ctx.restore()
    }
    finishCell(ctx, cell, style)
  })
  drawDecor(ctx, doc, layout, width, height)
  for (const o of doc.overlays ?? []) drawOverlay(ctx, o, width, height, overlayFor(o))
  ctx.restore()
}
