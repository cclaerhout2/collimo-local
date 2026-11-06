import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExportImage } from '../../collage/export'
import { loadImage } from '../../collage/images'
import { iconKey, rasterizeIcon } from '../../collage/overlays'
import type { Drawable } from '../../collage/render'
import type { Overlay, TextOverlay } from '../../collage/types'
import type { Services } from '../../google/types'
import { ensureFont } from '../../stickers/fonts'

/** Taille des icônes et images d'aperçu (plus grand côté). */
const PREVIEW_ICON = 512
const PREVIEW_IMAGE = 1200

type Asset = Drawable & { close(): void }
const assetKey = (o: Exclude<Overlay, TextOverlay>) => (o.type === 'icon' ? iconKey(o) : `img:${o.fileId}`)

/**
 * Icônes rasterisées, images et polices des textes et stickers de l'aperçu.
 * Renvoie aussi les chargeurs pleine résolution utilisés par l'export.
 */
export function useOverlayAssets(services: Services, overlays: Overlay[], onError: (e: unknown) => void) {
  const assets = useRef(new Map<string, Asset | null>())
  const pending = useRef(new Set<string>())
  const [version, setVersion] = useState(0)
  // Vrai tant que l'éditeur est affiché : un chargement terminé doit toujours redessiner.
  const mounted = useRef(true)

  const key = overlays
    .map((o) => (o.type === 'text' ? `t:${o.font.family}:${o.font.weight}:${o.font.italic}` : assetKey(o)))
    .join('|')

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

  /** Export : icône redessinée à la taille finale (net à toute taille), image relue à la taille utile. */
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
