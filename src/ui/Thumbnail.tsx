import { useEffect, useState } from 'react'
import type { Photo, Services } from '../google/types'

/**
 * Miniature d'une photo. Utilise la miniature fournie par Drive ; si elle ne s'affiche pas
 * (lien expiré, accès refusé), repli sur le contenu du fichier lu par l'API Drive.
 * À utiliser avec `key={photo.id}` pour repartir de zéro quand la photo change.
 */
export function Thumbnail({ photo, services }: { photo: Photo; services: Services }) {
  const [src, setSrc] = useState(photo.thumbnailUrl)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    return () => {
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src)
    }
  }, [src])

  async function fallback() {
    if (failed || !photo.supported) {
      setSrc(undefined)
      return
    }
    setFailed(true)
    try {
      const blob = await services.drive.fetchFileBlob(photo.id)
      setSrc(URL.createObjectURL(blob))
    } catch {
      setSrc(undefined)
    }
  }

  if (!src) return <span className="thumb thumb-missing" aria-hidden="true" />
  return <img className="thumb" src={src} alt={photo.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => void fallback()} />
}
