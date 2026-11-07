import { useEffect, useMemo, useRef, useState } from 'react'
import { defBBox } from '../../collage/cells'
import type { Drawable } from '../../collage/render'
import { renderCollage } from '../../collage/render'
import { RATIOS } from '../../collage/ratios'
import type { CellDef, Decor } from '../../collage/shapes'
import { DEFAULT_BACKGROUND, DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc, type Layout } from '../../collage/types'
import type { Photo } from '../../google/types'
import { useI18n } from '../../i18n'

const PREVIEW_RATIOS = ['1:1', '4:5', '9:16', '16:9']

/** Miniatures Drive des photos du dossier en cours, chargées une fois pour tous les aperçus. */
export function usePreviewImages(photos: Photo[] | null): Drawable[] {
  const [images, setImages] = useState<Drawable[]>([])
  useEffect(() => {
    if (!photos) return
    let alive = true
    const list = photos.filter((p) => p.supported && p.thumbnailUrl).slice(0, 20)
    Promise.all(
      list.map(
        (p) =>
          new Promise<Drawable | null>((resolve) => {
            const img = new Image()
            img.referrerPolicy = 'no-referrer'
            img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight })
            img.onerror = () => resolve(null)
            img.src = p.thumbnailUrl!
          }),
      ),
    ).then((r) => alive && setImages(r.filter((x): x is Drawable => !!x)))
    return () => {
      alive = false
    }
  }, [photos])
  return images
}

interface Props {
  cells: CellDef[]
  decor?: Decor[]
  images: Drawable[]
}

/** Aperçu de la disposition en cours avec de vraies photos, sur plusieurs formats. */
export function FactoryPreview({ cells, decor, images }: Props) {
  const { t } = useI18n()
  const [ratio, setRatio] = useState('1:1')
  const canvas = useRef<HTMLCanvasElement>(null)
  const value = RATIOS.find((r) => r.id === ratio)!.value

  const layout = useMemo<Layout | null>(() => {
    if (!cells.length) return null
    try {
      return { id: 'apercu', photos: cells.length, family: 'mixte', geo: cells, decor, cells: cells.map(defBBox) }
    } catch {
      return null
    }
  }, [cells, decor])

  useEffect(() => {
    const el = canvas.current
    if (!el || !layout) return
    const long = 360
    const w = value >= 1 ? long : Math.round(long * value)
    const h = value >= 1 ? Math.round(long / value) : long
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = w * dpr
    el.height = h * dpr
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    const doc: CollageDoc = {
      version: 1,
      ratio,
      layoutId: layout.id,
      photos: layout.cells.map((_, i) => ({ id: `apercu-${i}`, name: '', mimeType: 'image/jpeg', crop: { ...DEFAULT_CROP } })),
      borders: { ...DEFAULT_BORDERS },
      background: DEFAULT_BACKGROUND,
    }
    const ctx = el.getContext('2d')
    if (!ctx) return
    try {
      renderCollage(ctx, doc, layout, el.width, el.height, (i) => (images.length ? images[i % images.length] : undefined), { placeholder: '#3a3a44' })
    } catch {
      /* chemin en cours de modification, illisible : on garde l'image précédente */
    }
  }, [layout, images, ratio, value])

  return (
    <section className="factory-preview">
      <h3>{t('factory.preview')}</h3>
      <div className="segmented small" role="radiogroup" aria-label={t('factory.preview')}>
        {PREVIEW_RATIOS.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={r === ratio} className={r === ratio ? 'active' : ''} onClick={() => setRatio(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="factory-preview-box">{layout ? <canvas ref={canvas} className="factory-preview-canvas" /> : <p className="muted">{t('factory.preview.none')}</p>}</div>
    </section>
  )
}
