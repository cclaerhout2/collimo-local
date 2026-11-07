/**
 * Chargement des ressources des textes et stickers (icônes rasterisées, images Drive, polices)
 * pour l'aperçu de l'éditeur et pour l'export.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportImage } from '../../collage/export'
import { loadImage } from '../../collage/images'
import { iconKey, rasterizeIcon } from '../../collage/overlays'
import type { Drawable } from '../../collage/render'
import type { Overlay, TextOverlay } from '../../collage/types'
import type { Services } from '../../google/types'
import { ensureFont } from '../../stickers/fonts'

/** Taille des icônes et images d'aperçu (plus grand côté, en pixels du bitmap). */
const PREVIEW_ICON = 512
const PREVIEW_IMAGE = 1200

/** Image chargée pour l'aperçu, à libérer avec `close()` quand l'éditeur se ferme. */
type Asset = Drawable & { close(): void }
/**
 * Clé de cache d'un sticker : deux stickers identiques partagent la même image.
 * @param o - sticker icône ou image
 * @returns la clé de l'icône (forme, couleur…) ou celle du fichier Drive
 */
const assetKey = (o: Exclude<Overlay, TextOverlay>) => (o.type === 'icon' ? iconKey(o) : `img:${o.fileId}`)

/**
 * Icônes rasterisées, images et polices des textes et stickers de l'aperçu.
 * Renvoie aussi les chargeurs pleine résolution utilisés par l'export.
 *
 * Les ressources sont gardées dans une `Map` hors de l'état React ; seul le compteur `version`
 * change à chaque chargement, pour faire redessiner l'aperçu.
 * @param services - accès à Google Drive, pour lire les images
 * @param overlays - textes et stickers du collage
 * @param onError - appelé si un chargement échoue
 * @returns `overlayFor` (image d'aperçu d'un sticker, si prête), `loadOverlay` et `prepareText` pour l'export,
 * et `version`, qui change à chaque ressource chargée
 */
export function useOverlayAssets(services: Services, overlays: Overlay[], onError: (e: unknown) => void) {
  const assets = useRef(new Map<string, Asset | null>())
  const pending = useRef(new Set<string>())
  const [version, setVersion] = useState(0)
  // Vrai tant que l'éditeur est affiché : un chargement terminé doit toujours redessiner.
  const mounted = useRef(true)

  const key = overlays.map((o) => (o.type === 'text' ? `t:${o.font.family}:${o.font.weight}:${o.font.italic}` : assetKey(o))).join('|')

  useEffect(() => {
    for (const o of overlays) {
      const k = o.type === 'text' ? `t:${o.font.family}:${o.font.weight}:${o.font.italic}` : assetKey(o)
      if (assets.current.has(k) || pending.current.has(k)) continue
      pending.current.add(k)
      const job =
        o.type === 'text'
          ? ensureFont(o.font.family, o.font.weight, o.font.italic).then(() => null)
          : o.type === 'icon'
            ? rasterizeIcon(o, PREVIEW_ICON)
            : services.drive.fetchFileBlob(o.fileId).then((b) => loadImage(b, o.mimeType, PREVIEW_IMAGE))
      job
        .then((asset) => {
          if (!mounted.current) return asset?.close()
          assets.current.set(k, asset) // null = police prête
          setVersion((v) => v + 1)
        })
        .catch((e: unknown) => mounted.current && onError(e))
        .finally(() => pending.current.delete(k))
    }
    // Relance seulement quand la liste des icônes, images ou polices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, services, onError])

  useEffect(() => {
    mounted.current = true
    const map = assets.current
    return () => {
      mounted.current = false
      map.forEach((a) => a?.close())
      map.clear()
    }
  }, [])

  const overlayFor = useCallback((o: Overlay) => (o.type === 'text' ? undefined : (assets.current.get(assetKey(o)) ?? undefined)), [])

  /**
   * Export : icône redessinée à la taille finale (net à toute taille), image relue à la taille utile.
   * @param o - sticker icône ou image
   * @param maxSide - plus grand côté voulu, en pixels du collage exporté
   * @returns l'image prête à dessiner
   */
  const loadOverlay = useCallback(
    async (o: Exclude<Overlay, TextOverlay>, maxSide: number): Promise<ExportImage> => {
      if (o.type === 'icon') return rasterizeIcon(o, maxSide)
      const blob = await services.drive.fetchFileBlob(o.fileId)
      return loadImage(blob, o.mimeType, Math.ceil(maxSide))
    },
    [services],
  )

  const prepareText = useCallback((o: TextOverlay) => ensureFont(o.font.family, o.font.weight, o.font.italic), [])

  return { overlayFor, loadOverlay, prepareText, version }
}
