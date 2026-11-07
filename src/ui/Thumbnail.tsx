import { useEffect, useRef, useState } from 'react'
import type { Photo, Services } from '../google/types'

/**
 * Miniature d'une photo. Utilise la miniature fournie par Drive ; si elle ne s'affiche pas
 * (lien expiré), redemande un lien frais à Drive (une petite requête), et en dernier recours
 * lit le fichier lui-même. À utiliser avec `key={photo.id}` pour repartir de zéro quand la photo change.
 */
export function Thumbnail({ photo, services }: { photo: Photo; services: Services }) {
  const [src, setSrc] = useState(photo.thumbnailUrl)
  const [stage, setStage] = useState<'drive' | 'fresh' | 'blob'>('drive')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src)
    }
  }, [src])

  async function fallback() {
    if (!photo.supported) return setSrc(undefined)
    try {
      if (stage === 'drive') {
        setStage('fresh')
        const fresh = (await services.drive.getPhoto(photo.id)).thumbnailUrl
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

  if (!src) return <span className="thumb thumb-missing" aria-hidden="true" />
  return <img className="thumb" src={src} alt={photo.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => void fallback()} />
}
