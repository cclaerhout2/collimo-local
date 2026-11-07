/**
 * Chargement des photos : décodage (HEIC compris), réduction à la taille utile, et file
 * qui limite le nombre de décodages en parallèle.
 */
import { HEIC_TYPES } from '../config'
import type { Drawable } from './render'

/** Photo décodée, à libérer avec `close()` quand elle ne sert plus. */
export interface LoadedImage extends Drawable {
  source: ImageBitmap
  /** Libère la mémoire du bitmap. */
  close(): void
}

/**
 * Indique si un type MIME est celui d'une photo HEIC/HEIF (format des iPhone).
 * @param mimeType - type MIME du fichier, en majuscules ou minuscules
 * @returns `true` pour une photo HEIC
 */
export const isHeic = (mimeType: string) => (HEIC_TYPES as readonly string[]).includes(mimeType.toLowerCase())

/**
 * Taille cible d'une image dont le plus grand côté ne doit pas dépasser `maxSide` (jamais d'agrandissement).
 * @param width - largeur d'origine, en pixels
 * @param height - hauteur d'origine, en pixels
 * @param maxSide - plus grand côté permis, en pixels
 * @returns la taille réduite (au moins 1 × 1), ou la taille d'origine si elle tient déjà
 */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= maxSide) return { width, height }
  const k = maxSide / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/**
 * Décode un fichier image en bitmap, HEIC compris.
 * @param blob - contenu du fichier
 * @param mimeType - type MIME du fichier
 * @returns le bitmap en pleine taille
 */
async function decode(blob: Blob, mimeType: string): Promise<ImageBitmap> {
  if (!isHeic(mimeType)) return createImageBitmap(blob)
  try {
    // Safari décode le HEIC nativement.
    return await createImageBitmap(blob)
  } catch {
    // Ailleurs : décodeur chargé seulement quand une photo HEIC est utilisée. Version « csp », sans
    // `new Function` : elle reste permise par la politique de sécurité de l'application Windows.
    const { heicTo } = await import('heic-to/csp')
    return heicTo({ blob, type: 'bitmap' })
  }
}

/**
 * Décode une photo et la réduit si besoin, pour ménager la mémoire : l'aperçu demande des versions
 * réduites, l'export les tailles nécessaires, une photo à la fois.
 * @param blob - contenu du fichier
 * @param mimeType - type MIME du fichier
 * @param maxSide - plus grand côté voulu, en pixels
 * @returns la photo décodée, à libérer avec `close()`
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

/**
 * Crée une file qui exécute des tâches asynchrones avec au plus `limit` en parallèle.
 * @param limit - nombre maximal de tâches en cours en même temps
 * @returns une fonction qui ajoute une tâche à la file
 */
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
  /**
   * Ajoute une tâche à la file ; elle démarre dès qu'une place se libère.
   * @param task - tâche à exécuter
   * @returns une promesse résolue (ou rejetée) comme celle de la tâche
   */
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
