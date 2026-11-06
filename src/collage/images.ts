import { HEIC_TYPES } from '../config'
import type { Drawable } from './render'

export interface LoadedImage extends Drawable {
  source: ImageBitmap
  close(): void
}

export const isHeic = (mimeType: string) => (HEIC_TYPES as readonly string[]).includes(mimeType.toLowerCase())

/** Taille cible : le plus grand côté ne dépasse pas `maxSide` (jamais d'agrandissement). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= maxSide) return { width, height }
  const k = maxSide / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

async function decode(blob: Blob, mimeType: string): Promise<ImageBitmap> {
  if (!isHeic(mimeType)) return createImageBitmap(blob)
  try {
    // Safari décode le HEIC nativement.
    return await createImageBitmap(blob)
  } catch {
    // Ailleurs : décodeur chargé seulement quand une photo HEIC est utilisée.
    const { heicTo } = await import('heic-to')
    return heicTo({ blob, type: 'bitmap' })
  }
}

/**
 * Décode une photo et la réduit si besoin, pour ménager la mémoire : l'aperçu demande des versions
 * réduites, l'export les tailles nécessaires, une photo à la fois.
 */
export async function loadImage(blob: Blob, mimeType: string, maxSide: number): Promise<LoadedImage> {
  let bitmap = await decode(blob, mimeType)
  const target = fitWithin(bitmap.width, bitmap.height, maxSide)
  if (target.width !== bitmap.width) {
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: target.width,
      resizeHeight: target.height,
      resizeQuality: 'high',
    })
    bitmap.close()
    bitmap = resized
  }
  const b = bitmap
  return { source: b, width: b.width, height: b.height, close: () => b.close() }
}

/** Exécute des tâches asynchrones avec au plus `limit` en parallèle. */
export function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= limit) return
    const run = queue.shift()
    if (run) {
      active++
      run()
    }
  }
  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
  }
}
