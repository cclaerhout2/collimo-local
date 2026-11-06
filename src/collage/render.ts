import { cellBoxes, placeImage, type CellBox } from './geometry'
import type { CollageDoc, Layout } from './types'

/** Toute source que le Canvas sait dessiner et dont on connaît la taille. */
export interface Drawable {
  source: CanvasImageSource
  width: number
  height: number
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function roundedRectPath(ctx: Ctx, b: CellBox) {
  ctx.beginPath()
  if (b.radius > 0.5 && 'roundRect' in ctx) ctx.roundRect(b.x, b.y, b.w, b.h, b.radius)
  else ctx.rect(b.x, b.y, b.w, b.h)
}

/** Dessine une photo dans sa case : couverture complète, décalage, zoom, rotation, miroir. */
export function drawPhotoInCell(ctx: Ctx, img: Drawable, box: CellBox, crop: CollageDoc['photos'][number]['crop']) {
  const p = placeImage(img.width, img.height, box.w, box.h, crop)
  ctx.save()
  roundedRectPath(ctx, box)
  ctx.clip()
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2)
  ctx.rotate((crop.angle * Math.PI) / 180)
  ctx.translate(p.dx, p.dy)
  ctx.scale(crop.flip ? -p.scale : p.scale, p.scale)
  ctx.drawImage(img.source, -img.width / 2, -img.height / 2, img.width, img.height)
  ctx.restore()
}

export interface RenderOptions {
  /** Couleur des cases dont la photo n'est pas encore chargée (aperçu). */
  placeholder?: string
}

/**
 * Rendu complet d'un collage. La même fonction sert à l'aperçu et à l'export,
 * ce qui garantit que l'image exportée correspond à ce qui est affiché.
 */
export function renderCollage(
  ctx: Ctx,
  doc: CollageDoc,
  layout: Layout,
  width: number,
  height: number,
  imageFor: (cellIndex: number) => Drawable | undefined,
  options: RenderOptions = {},
) {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = doc.background
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const boxes = cellBoxes(layout.cells, width, height, doc.borders)
  boxes.forEach((box, i) => {
    const photo = doc.photos[i]
    const img = imageFor(i)
    if (photo && img) {
      drawPhotoInCell(ctx, img, box, photo.crop)
    } else if (options.placeholder) {
      ctx.save()
      roundedRectPath(ctx, box)
      ctx.fillStyle = options.placeholder
      ctx.fill()
      ctx.restore()
    }
  })
  ctx.restore()
}
