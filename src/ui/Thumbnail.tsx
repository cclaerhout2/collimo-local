/**
 * Miniature d'une photo Drive, qui se répare d'elle-même quand le lien fourni par Drive a expiré.
 */
import { useEffect, useRef, useState } from 'react'
import { isHeic, loadImage } from '../collage/images'
import { sizedThumbnail } from '../google/drive'
import type { Photo, Services } from '../google/types'

/**
 * Miniature JPEG d'une photo HEIC, que le navigateur ne sait pas afficher telle quelle.
 * @param blob - fichier HEIC
 * @param mimeType - type MIME du fichier
 * @returns une image JPEG de 400 px de côté au plus
 */
async function heicPreview(blob: Blob, mimeType: string): Promise<Blob> {
  const img = await loadImage(blob, mimeType, 400)
  try {
    const canvas = new OffscreenCanvas(img.width, img.height)
    canvas.getContext('2d')!.drawImage(img.source, 0, 0)
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  } finally {
    img.close()
  }
}

/**
 * Miniature d'une photo.
 * Utilise la miniature fournie par Drive ; si elle ne s'affiche pas (lien expiré), redemande
 * un lien frais à Drive (une petite requête), et en dernier recours lit le fichier lui-même
 * (décodé ici s'il est en HEIC).
 * À utiliser avec `key={photo.id}` pour repartir de zéro quand la photo change.
 * Avec `size`, la miniature Drive est demandée à cette taille (grande vue du diaporama).
 * @returns l'image de la miniature, ou un emplacement vide si aucune image n'a pu être obtenue
 */
export function Thumbnail({
  photo,
  services,
  size,
  className = 'thumb',
  eager = false,
}: {
  /** Photo à afficher. */
  photo: Photo
  /** Services Google, pour redemander un lien ou lire le fichier. */
  services: Services
  /** Plus grand côté voulu, en pixels ; absent = taille des miniatures de la galerie. */
  size?: number
  /** Classe CSS de l'image. */
  className?: string
  /** Charger tout de suite (image visible) plutôt qu'à l'approche de l'écran. */
  eager?: boolean
}) {
  const [src, setSrc] = useState(size ? sizedThumbnail(photo.thumbnailUrl, size) : photo.thumbnailUrl)
  const [stage, setStage] = useState<'drive' | 'fresh' | 'blob'>('drive')
  const alive = useRef(true)
  const placeholder = useRef<HTMLSpanElement>(null)
  // Miniature calculée à la demande (Android) : demandée seulement quand la case devient visible.
  const onDemand = !photo.thumbnailUrl && photo.supported && !!services.drive.loadThumbnail

  useEffect(() => {
    const el = placeholder.current
    if (!onDemand || !el) return
    let done = false
    const load = () => {
      if (done) return
      done = true
      void services.drive.loadThumbnail!(photo, size).then((url) => {
        if (!alive.current) return
        if (url) setSrc(url)
        else void fallback()
      })
    }
    if (typeof IntersectionObserver === 'undefined') return load()
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && load(), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
    // La photo ne change pas (composant utilisé avec key={photo.id}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDemand])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src)
    }
  }, [src])

  /**
   * Passe à la source suivante quand l'image ne s'affiche pas : lien frais demandé à Drive,
   * puis fichier lu en entier, puis emplacement vide.
   * @returns une promesse résolue une fois la nouvelle source choisie (sans valeur)
   */
  async function fallback() {
    if (!photo.supported) return setSrc(undefined)
    try {
      if (stage === 'drive') {
        setStage('fresh')
        const link = (await services.drive.getPhoto(photo.id)).thumbnailUrl
        const fresh = size ? sizedThumbnail(link, size) : link
        if (!alive.current) return
        if (fresh && fresh !== src) return setSrc(fresh)
      }
      if (stage === 'blob') return setSrc(undefined)
      setStage('blob')
      let blob = await services.drive.fetchFileBlob(photo.id)
      // HEIC sans miniature (Windows sans l'extension HEIF, par exemple) : décodé ici.
      if (isHeic(photo.mimeType)) blob = await heicPreview(blob, photo.mimeType)
      const url = URL.createObjectURL(blob)
      if (!alive.current) return URL.revokeObjectURL(url)
      setSrc(url)
    } catch {
      if (alive.current) setSrc(undefined)
    }
  }

  if (!src) return <span ref={placeholder} className={`${className} thumb-missing`} aria-hidden="true" />
  return (
    <img
      className={className}
      src={src}
      alt={photo.name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => void fallback()}
    />
  )
}
