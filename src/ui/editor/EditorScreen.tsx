import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultLayoutFor, layoutById, layoutsFor, resolveLayout } from '../../collage/catalog'
import type { ExportImage } from '../../collage/export'
import { normalizeAngle, rotateTo, zoomAt } from '../../collage/gestures'
import { createLimiter, loadImage, type LoadedImage } from '../../collage/images'
import { ratioValue } from '../../collage/ratios'
import { DEFAULT_CROP, type CollageDoc, type Crop, type Layout } from '../../collage/types'
import type { Location, Services } from '../../google/types'
import { useI18n } from '../../i18n'
import { toUiError, type UiError } from '../../lib/errors'
import { ErrorBanner } from '../ErrorBanner'
import { CollageCanvas } from './CollageCanvas'
import { ExportSheet } from './ExportSheet'
import { InteractionLayer } from './InteractionLayer'
import { BackgroundPanel, BordersPanel, LayoutPanel, RatioPanel } from './Panels'
import { CropPanel, PhotoMenu, type PhotoAction } from './PhotoMenu'

/** Taille des photos chargées pour l'aperçu (plus grand côté). */
const PREVIEW_SIDE = 1600

type Tab = 'ratio' | 'layout' | 'borders' | 'background'
const TABS: Tab[] = ['ratio', 'layout', 'borders', 'background']

interface Props {
  services: Services
  location: Location
  initialDoc: CollageDoc
  onBack: () => void
  onReconnect: () => void
  onError: (e: unknown) => void
}

export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Après une suppression : disposition de la même famille pour une photo de moins, sinon la première. */
export function nearestLayout(photoCount: number, family: Layout['family']): Layout {
  const candidates = layoutsFor(photoCount)
  return candidates.find((l) => l.family === family) ?? defaultLayoutFor(photoCount)
}

export function EditorScreen({ services, location, initialDoc, onBack, onReconnect, onError }: Props) {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)
  const [swapPick, setSwapPick] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [notice, setNotice] = useState<UiError | null>(null)
  const [doc, setDoc] = useState<CollageDoc>(() =>
    layoutById(initialDoc.layoutId) ? initialDoc : { ...initialDoc, layoutId: defaultLayoutFor(initialDoc.photos.length).id },
  )
  const [tab, setTab] = useState<Tab>('layout')
  const [exporting, setExporting] = useState(false)
  const [version, setVersion] = useState(0)
  const images = useRef(new Map<string, LoadedImage>())
  const pending = useRef(new Set<string>())
  const mounted = useRef(true)
  const failed = useRef(new Set<string>())
  const limiter = useMemo(() => createLimiter(3), [])

  const layout = resolveLayout(doc)
  const ratio = ratioValue(doc.ratio)
  const photoKey = doc.photos.map((p) => p.id).sort().join('|')

  // Chargement des photos de l'aperçu, trois à la fois, réduites pour ménager la mémoire.
  useEffect(() => {
    for (const p of doc.photos) {
      if (images.current.has(p.id) || pending.current.has(p.id) || failed.current.has(p.id)) continue
      pending.current.add(p.id)
      void limiter(async () => {
        try {
          const blob = await services.drive.fetchFileBlob(p.id)
          const img = await loadImage(blob, p.mimeType, PREVIEW_SIDE)
          if (!mounted.current) return img.close()
          images.current.set(p.id, img)
        } catch (e) {
          failed.current.add(p.id)
          if (mounted.current) onError(e)
        } finally {
          pending.current.delete(p.id)
          if (mounted.current) setVersion((v) => v + 1)
        }
      })
    }
    // Ne relance que quand l'ensemble des photos change, pas leur ordre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey, services, limiter, onError])

  // Libère les images à la fermeture de l'éditeur.
  useEffect(() => {
    mounted.current = true
    const map = images.current
    return () => {
      mounted.current = false
      map.forEach((img) => img.close())
      map.clear()
    }
  }, [])

  const imageFor = useCallback((i: number) => {
    const p = doc.photos[i]
    return p ? images.current.get(p.id) : undefined
  }, [doc.photos])

  /** Export : réutilise l'aperçu s'il est assez grand, sinon relit l'original à la taille utile. */
  const loadForCell = useCallback(
    async (i: number, maxSide: number): Promise<ExportImage> => {
      const p = doc.photos[i]
      const preview = images.current.get(p.id)
      if (preview && Math.max(preview.width, preview.height) >= maxSide) {
        return { source: preview.source, width: preview.width, height: preview.height, close: () => {} }
      }
      const blob = await services.drive.fetchFileBlob(p.id)
      return loadImage(blob, p.mimeType, maxSide)
    },
    [doc.photos, services],
  )

  const imageSize = useCallback(
    (i: number) => {
      const p = doc.photos[i]
      if (!p) return undefined
      const img = images.current.get(p.id)
      if (img) return { w: img.width, h: img.height }
      return p.width && p.height ? { w: p.width, h: p.height } : undefined
    },
    [doc.photos],
  )

  const select = useCallback((i: number | null) => {
    setSelected(i)
    setSwapPick(false)
    setCropMode(false)
  }, [])

  const setCrop = useCallback((i: number, crop: Crop) => {
    setDoc((d) => ({ ...d, photos: d.photos.map((p, k) => (k === i ? { ...p, crop } : p)) }))
  }, [])

  const swap = useCallback((a: number, b: number) => {
    setDoc((d) => {
      const photos = [...d.photos]
      ;[photos[a], photos[b]] = [photos[b], photos[a]]
      return { ...d, photos }
    })
    setSelected(b)
    setSwapPick(false)
  }, [])

  /** Dimensions de la case sélectionnée et de sa photo, pour les réglages au curseur. */
  function selectedSizes() {
    if (selected === null) return null
    const img = imageSize(selected)
    const box = layout.cells[selected]
    if (!img || !box) return null
    // Les cadrages sont relatifs : la taille absolue de la case importe peu, seule sa forme compte.
    return { img, box: { w: box.w * (ratio >= 1 ? 1000 : 1000 * ratio), h: box.h * (ratio >= 1 ? 1000 / ratio : 1000) } }
  }

  async function onAction(action: PhotoAction) {
    if (selected === null) return
    const photo = doc.photos[selected]
    const s = selectedSizes()
    setNotice(null)
    if (action === 'swap') setSwapPick((v) => !v)
    else if (action === 'flip') setCrop(selected, { ...photo.crop, flip: !photo.crop.flip })
    else if (action === 'rotate' && s) setCrop(selected, rotateTo(photo.crop, s.img, s.box, normalizeAngle(Math.round(photo.crop.angle / 90) * 90 + 90)))
    else if (action === 'crop') setCropMode(true)
    else if (action === 'delete' && doc.photos.length > 1) {
      const next = nearestLayout(doc.photos.length - 1, layout.family)
      setDoc((d) => ({ ...d, photos: d.photos.filter((_, k) => k !== selected), layoutId: next.id, split: undefined }))
      select(null)
    } else if (action === 'replace') {
      try {
        const picked = await services.picker.pickImage(location.drive, lang, t('photo.replaceTitle'))
        if (!picked) return
        const p = await services.drive.getPhoto(picked.id)
        if (!p.supported) {
          setNotice({ key: 'photo.unsupported', vars: { type: p.mimeType.replace('image/', '').toUpperCase() } })
          return
        }
        const index = selected
        setDoc((d) => ({
          ...d,
          photos: d.photos.map((x, k) => (k === index ? { id: p.id, name: p.name, mimeType: p.mimeType, width: p.width, height: p.height, crop: { ...DEFAULT_CROP } } : x)),
        }))
      } catch (e) {
        setNotice(toUiError(e))
      }
    }
  }

  void version // relit l'état des chargements à chaque photo arrivée
  const loaded = doc.photos.filter((p) => images.current.has(p.id)).length
  const settled = doc.photos.filter((p) => images.current.has(p.id) || failed.current.has(p.id)).length
  const allLoaded = settled === doc.photos.length

  return (
    <main className="editor">
      <div className="editor-bar">
        <button type="button" className="btn btn-ghost btn-small" onClick={onBack}>
          ‹ {t('editor.back')}
        </button>
        <span className="editor-status muted">
          {!allLoaded
            ? t('editor.loading', { done: loaded, total: doc.photos.length })
            : doc.createdFrom
              ? t('editor.fromProject', { name: doc.createdFrom })
              : selected === null
                ? t('editor.selectHint')
                : ''}
        </span>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setExporting(true)} disabled={!allLoaded}>
          {t('editor.export')}
        </button>
      </div>

      {notice && (
        <div className="editor-notice">
          <ErrorBanner error={notice} onReconnect={onReconnect} />
        </div>
      )}

      <div
        className="editor-stage"
        onPointerDown={(e) => {
          // Toucher à côté du collage : désélection.
          if (!(e.target as Element).closest('.canvas-frame, .shuffle')) select(null)
        }}
      >
        <CollageCanvas
          doc={doc}
          layout={layout}
          ratio={ratio}
          imageFor={imageFor}
          version={version}
          overlay={(size) => (
            <InteractionLayer
              width={size.width}
              height={size.height}
              doc={doc}
              layout={layout}
              selected={selected}
              swapPick={swapPick}
              imageSize={imageSize}
              onSelect={select}
              onCrop={setCrop}
              onSwap={swap}
              onSplit={(split) => setDoc((d) => ({ ...d, split }))}
            />
          )}
        />
        {doc.photos.length > 1 && (
          <button
            type="button"
            className="round-button shuffle"
            title={t('editor.shuffle')}
            aria-label={t('editor.shuffle')}
            onClick={() => {
              select(null)
              setDoc((d) => ({ ...d, photos: shuffled(d.photos) }))
            }}
          >
            <ShuffleIcon />
          </button>
        )}
      </div>

      <div className="editor-tools">
        {selected !== null && doc.photos[selected] ? (
          cropMode ? (
            <div className="panel">
              <CropPanel
                crop={doc.photos[selected].crop}
                onZoom={(z) => {
                  const s = selectedSizes()
                  if (s) setCrop(selected, zoomAt(doc.photos[selected].crop, s.img, s.box, z))
                }}
                onAngle={(a) => {
                  const s = selectedSizes()
                  if (s) setCrop(selected, rotateTo(doc.photos[selected].crop, s.img, s.box, a))
                }}
                onReset={() => setCrop(selected, { ...DEFAULT_CROP })}
                onDone={() => setCropMode(false)}
              />
            </div>
          ) : (
            <div className="panel">
              <PhotoMenu canDelete={doc.photos.length > 1} swapPick={swapPick} onAction={(a) => void onAction(a)} onDone={() => select(null)} />
            </div>
          )
        ) : (
          <>
        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {t(`editor.tab.${id}`)}
            </button>
          ))}
        </div>
        <div className="panel" role="tabpanel">
          {tab === 'ratio' && <RatioPanel value={doc.ratio} onChange={(ratioId) => setDoc((d) => ({ ...d, ratio: ratioId }))} />}
          {tab === 'layout' && (
            <LayoutPanel photoCount={doc.photos.length} value={layout.id} onChange={(id) => setDoc((d) => ({ ...d, layoutId: id, split: undefined }))} />
          )}
          {tab === 'borders' && <BordersPanel value={doc.borders} onChange={(b) => setDoc((d) => ({ ...d, borders: b }))} />}
          {tab === 'background' && <BackgroundPanel value={doc.background} onChange={(c) => setDoc((d) => ({ ...d, background: c }))} />}
        </div>
          </>
        )}
      </div>

      {exporting && (
        <ExportSheet
          drive={services.drive}
          collimoFolderId={location.collimoFolderId}
          doc={{ ...doc, layoutId: layout.id, split: layout.split && doc.split ? doc.split : undefined }}
          layout={layout}
          ratio={ratio}
          loadForCell={loadForCell}
          onClose={() => setExporting(false)}
          onSaved={() => {}}
          onReconnect={onReconnect}
        />
      )}
    </main>
  )
}

function ShuffleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  )
}
