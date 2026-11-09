/**
 * Miniature d'une photo Drive, qui se répare d'elle-même quand le lien fourni par Drive a expiré.
 */
import { useEffect, useRef, useState } from 'react'
import { sizedThumbnail } from '../google/drive'
import type { Photo, Services } from '../google/types'

/**
 * Miniature d'une photo.
 * Utilise la miniature fournie par Drive ; si elle ne s'affiche pas (lien expiré), redemande
 * un lien frais à Drive (une petite requête), et en dernier recours lit le fichier lui-même.
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
      const blob = await services.drive.fetchFileBlob(photo.id)
      const url = URL.createObjectURL(blob)
      if (!alive.current) return URL.revokeObjectURL(url)
      setSrc(url)
    } catch {
      if (alive.current) setSrc(undefined)
    }
  }

  if (!src) return <span className={`${className} thumb-missing`} aria-hidden="true" />
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
