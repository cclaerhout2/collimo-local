/**
 * Calculs des gestes sur une photo dans sa case. Fonctions pures : elles prennent le cadrage actuel
 * et renvoient le nouveau, sans rien savoir de la souris ou du doigt.
 * Les distances sont en pixels de la case affichée ; les cadrages restent relatifs (voir Crop).
 */
import { placeImage } from './geometry'
import type { Crop } from './types'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4
/** Écart en degrés sous lequel l'angle « accroche » 0, 90, 180 ou 270°. */
export const SNAP_DEGREES = 4

interface Size {
  w: number
  h: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Vecteur écran → repère de la photo (qui est tournée de `angle` degrés). */
function toImageFrame(x: number, y: number, angle: number): [number, number] {
  const a = (-angle * Math.PI) / 180
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
}

/** Marge de déplacement disponible (demi-largeur, demi-hauteur), dans le repère de la photo. */
function slack(img: Size, box: Size, crop: Crop): [number, number] {
  const a = (crop.angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const needW = box.w * cos + box.h * sin
  const needH = box.w * sin + box.h * cos
  const { scale } = placeImage(img.w, img.h, box.w, box.h, crop)
  return [Math.max(0, img.w * scale - needW) / 2, Math.max(0, img.h * scale - needH) / 2]
}

/** Décalage actuel du centre de la photo, en pixels, dans son repère. */
function offset(img: Size, box: Size, crop: Crop): [number, number] {
  const p = placeImage(img.w, img.h, box.w, box.h, crop)
  return [p.dx, p.dy]
}

function fromOffset(img: Size, box: Size, crop: Crop, dx: number, dy: number): Crop {
  const [sx, sy] = slack(img, box, crop)
  return { ...crop, ox: sx > 0 ? clamp(dx / sx, -1, 1) : 0, oy: sy > 0 ? clamp(dy / sy, -1, 1) : 0 }
}

/** Faire glisser la photo de (dx, dy) pixels à l'écran : elle suit le doigt, sans quitter sa case. */
export function panBy(crop: Crop, img: Size, box: Size, dx: number, dy: number): Crop {
  const [ix, iy] = toImageFrame(dx, dy, crop.angle)
  const [ox, oy] = offset(img, box, crop)
  return fromOffset(img, box, crop, ox + ix, oy + iy)
}

/**
 * Zoomer en gardant immobile le point de la photo situé sous le curseur ou entre les doigts.
 * `px`, `py` = position du point par rapport au centre de la case, à l'écran.
 */
export function zoomAt(crop: Crop, img: Size, box: Size, nextZoom: number, px = 0, py = 0): Crop {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  if (zoom === crop.zoom) return crop
  const before = placeImage(img.w, img.h, box.w, box.h, crop)
  const next = { ...crop, zoom }
  const after = placeImage(img.w, img.h, box.w, box.h, next)
  const [qx, qy] = toImageFrame(px, py, crop.angle)
  const k = after.scale / before.scale
  return fromOffset(img, box, next, qx - (qx - before.dx) * k, qy - (qy - before.dy) * k)
}

/** Angle ramené entre -180 et 180°. */
export function normalizeAngle(deg: number): number {
  const a = ((deg % 360) + 540) % 360 - 180
  return a === -180 ? 180 : a
}

/** Aimantation : près de 0/90/180/270° on y accroche ; avec Maj, pas de 15°. */
export function snapAngle(deg: number, fineSteps = false): number {
  const a = normalizeAngle(deg)
  if (fineSteps) return normalizeAngle(Math.round(a / 15) * 15)
  const right = Math.round(a / 90) * 90
  return Math.abs(a - right) <= SNAP_DEGREES ? normalizeAngle(right) : Math.round(a * 10) / 10
}

/** Angle (degrés) du point (x, y) vu depuis le centre (cx, cy), 0 = vers le haut. */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI
}

/** Changer l'angle en gardant le décalage relatif dans les limites. */
export function rotateTo(crop: Crop, img: Size, box: Size, angle: number): Crop {
  const [ox, oy] = offset(img, box, crop)
  return fromOffset(img, box, { ...crop, angle }, ox, oy)
}
