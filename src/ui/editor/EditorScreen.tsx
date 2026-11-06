import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultLayoutFor, layoutById } from '../../collage/catalog'
import type { ExportImage } from '../../collage/export'
import { createLimiter, loadImage, type LoadedImage } from '../../collage/images'
import { ratioValue } from '../../collage/ratios'
import type { CollageDoc } from '../../collage/types'
import type { Location, Services } from '../../google/types'
import { useI18n } from '../../i18n'
import { CollageCanvas } from './CollageCanvas'
import { ExportSheet } from './ExportSheet'
import { BackgroundPanel, BordersPanel, LayoutPanel, RatioPanel } from './Panels'

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

export function EditorScreen({ services, location, initialDoc, onBack, onReconnect, onError }: Props) {
  const { t } = useI18n()
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

  const layout = layoutById(doc.layoutId) ?? defaultLayoutFor(doc.photos.length)
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
              : ''}
        </span>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setExporting(true)} disabled={!allLoaded}>
          {t('editor.export')}
        </button>
      </div>

      <div className="editor-stage">
        <CollageCanvas doc={doc} layout={layout} ratio={ratio} imageFor={imageFor} version={version} />
        {doc.photos.length > 1 && (
          <button
            type="button"
            className="round-button shuffle"
            title={t('editor.shuffle')}
            aria-label={t('editor.shuffle')}
            onClick={() => setDoc((d) => ({ ...d, photos: shuffled(d.photos) }))}
          >
            <ShuffleIcon />
          </button>
        )}
      </div>

      <div className="editor-tools">
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
            <LayoutPanel photoCount={doc.photos.length} value={layout.id} onChange={(id) => setDoc((d) => ({ ...d, layoutId: id }))} />
          )}
          {tab === 'borders' && <BordersPanel value={doc.borders} onChange={(b) => setDoc((d) => ({ ...d, borders: b }))} />}
          {tab === 'background' && <BackgroundPanel value={doc.background} onChange={(c) => setDoc((d) => ({ ...d, background: c }))} />}
        </div>
      </div>

      {exporting && (
        <ExportSheet
          drive={services.drive}
          collimoFolderId={location.collimoFolderId}
          doc={{ ...doc, layoutId: layout.id }}
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
