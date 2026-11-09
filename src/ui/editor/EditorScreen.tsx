/**
 * Écran d'édition d'un collage : aperçu interactif, onglets de réglages (format, disposition, bordures,
 * fond, filtres, textes, stickers), menu de la photo sélectionnée, annuler / rétablir et export.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultLayoutFor, layoutById, layoutsFor, resolveLayout } from '../../collage/catalog'
import type { ExportImage } from '../../collage/export'
import { autoAdjust, isIdentity, paramsForPhoto, paramsKey } from '../../collage/color'
import { processPhoto, type Processed } from '../../collage/colorProcessor'
import { applyMasks, masksKey, type Mask } from '../../collage/masks'
import { loadNextDefaults, MaskEditor, MaskPanel, saveNextDefaults } from './MaskEditor'
import type { Drawable } from '../../collage/render'
import { normalizeAngle, rotateTo, zoomAt } from '../../collage/gestures'
import { createLimiter, fitWithin, loadImage, type LoadedImage } from '../../collage/images'
import { ratioValue } from '../../collage/ratios'
import { duplicateOverlay, newIcon, newImage, newText, type TextPreset } from '../../collage/overlays'
import { DEFAULT_CROP, type Adjustments, type CollageDoc, type Crop, type Layout, type Overlay } from '../../collage/types'
import type { Location, Services } from '../../google/types'
import { useI18n } from '../../i18n'
import { toUiError, type UiError } from '../../lib/errors'
import { ErrorBanner } from '../ErrorBanner'
import { CollageCanvas } from './CollageCanvas'
import { ExportSheet } from './ExportSheet'
import { InteractionLayer } from './InteractionLayer'
import { AdjustPanel, FilterList } from './FiltersPanel'
import { BackgroundPanel, BordersPanel, LayoutPanel, RatioPanel } from './Panels'
import { CropPanel, PhotoMenu, type PhotoAction } from './PhotoMenu'
import { OverlayPanel, PresetGrid } from './overlay/OverlayPanel'
import { StickerBrowser } from './overlay/StickerBrowser'
import { useHistory } from './useHistory'
import { useOverlayAssets } from './useOverlayAssets'

/** Taille des photos chargées pour l'aperçu (plus grand côté, en pixels de l'image). */
const PREVIEW_SIDE = 1600

/** Onglet de réglages de l'éditeur. */
type Tab = 'ratio' | 'layout' | 'borders' | 'background' | 'filters' | 'text' | 'stickers'
/** Onglets, dans l'ordre d'affichage. */
/** Clé de stockage local du repli du panneau d'outils. */
const TOOLS_COLLAPSED_KEY = 'collimo.toolsCollapsed'

const TABS: Tab[] = ['ratio', 'layout', 'borders', 'background', 'filters', 'text', 'stickers']

/** Taille maximale des photos traitées (filtres, réglages) pour l'aperçu (plus grand côté, en pixels de l'image). */
const PROCESSED_SIDE = 1200

/**
 * Petit échantillon RGBA d'une image, pour le réglage automatique.
 *
 * Réduire l'image avant de lire ses pixels suffit pour des statistiques de couleur et reste rapide.
 * @param img - image à échantillonner
 * @param side - plus grand côté de l'échantillon, en pixels
 * @returns les pixels de l'échantillon, quatre octets (R, V, B, A) par pixel
 */
function sampleRgba(img: ImageBitmap, side = 48): Uint8ClampedArray {
  const { width, height } = fitWithin(img.width, img.height, side)
  const c = new OffscreenCanvas(width, height)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height).data
}

/**
 * Couleur hexadécimale d'un pixel.
 * @param r - rouge, de 0 à 255
 * @param g - vert, de 0 à 255
 * @param b - bleu, de 0 à 255
 * @returns la couleur au format `#rrggbb`
 */
export const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/** Propriétés de {@link EditorScreen}. */
interface Props {
  /** Accès à Google Drive et au sélecteur de fichiers. */
  services: Services
  /** Dossiers Drive de l'utilisateur (sélecteur, dossier d'enregistrement Collimo). */
  location: Location
  /** Collage à ouvrir. */
  initialDoc: CollageDoc
  /** Retour à l'écran précédent. */
  onBack: () => void
  /** Relance la connexion Google quand une erreur l'exige. */
  onReconnect: () => void
  /** Signale une erreur de chargement (photo ou sticker illisible…). */
  onError: (e: unknown) => void
}

/**
 * Mélange une liste (algorithme de Fisher-Yates), sans modifier l'original.
 * @param items - éléments à mélanger
 * @param random - générateur dans [0, 1[, remplaçable dans les tests
 * @returns une copie mélangée de la liste
 */
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Après une suppression : disposition de la même famille pour une photo de moins, sinon la première.
 * @param photoCount - nombre de photos restantes
 * @param family - famille de la disposition actuelle
 * @returns la disposition à appliquer
 */
export function nearestLayout(photoCount: number, family: Layout['family']): Layout {
  const candidates = layoutsFor(photoCount)
  return candidates.find((l) => l.family === family) ?? defaultLayoutFor(photoCount)
}

/**
 * Écran d'édition d'un collage.
 *
 * Les photos sont chargées réduites (trois à la fois) pour l'aperçu ; l'export relit les originaux
 * à la taille utile. Toute modification du collage passe par l'historique, pour annuler / rétablir.
 * @returns la barre du haut, l'aperçu interactif, le panneau d'outils et, au besoin, la feuille d'export
 */
export function EditorScreen({ services, location, initialDoc, onBack, onReconnect, onError }: Props) {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)
  const [swapPick, setSwapPick] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  /** Édition des zones masquées de la photo sélectionnée. */
  const [maskMode, setMaskMode] = useState(false)
  const [maskSelected, setMaskSelected] = useState<string | null>(null)
  const [maskNext, setMaskNext] = useState(loadNextDefaults)
  const maskWrap = useRef<HTMLDivElement>(null)
  const [maskBox, setMaskBox] = useState({ width: 0, height: 0 })
  const [notice, setNotice] = useState<UiError | null>(null)
  const history = useHistory<CollageDoc>(() =>
    layoutById(initialDoc.layoutId) ? initialDoc : { ...initialDoc, layoutId: defaultLayoutFor(initialDoc.photos.length).id },
  )
  const doc = history.value
  const setDoc = history.set
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null)
  const [eyedropper, setEyedropper] = useState<((color: string) => void) | null>(null)
  const [focusText, setFocusText] = useState(0)
  const [filterMode, setFilterMode] = useState<'filters' | 'adjust'>('filters')
  const [photoAdjust, setPhotoAdjust] = useState(false)
  const [adjustScope, setAdjustScope] = useState<'collage' | 'photo'>('photo')
  const [compare, setCompare] = useState(false)
  const processed = useRef(new Map<string, { key: string; out: Processed }>())
  /** Photos masquées pour l'aperçu, par identifiant, avec la clé des réglages et des zones qui les ont produites. */
  const masked = useRef(
    new Map<string, { key: string; out: { close(): void; source: CanvasImageSource; width: number; height: number } }>(),
  )
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const overlays = useMemo(() => doc.overlays ?? [], [doc.overlays])
  const assets = useOverlayAssets(services, overlays, onError)
  const [tab, setTab] = useState<Tab>('layout')
  /** Panneau d'outils replié : seuls les onglets restent, le collage prend la place. Mémorisé sur l'appareil. */
  const [toolsCollapsed, setToolsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(TOOLS_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })

  /**
   * Replie ou déplie le panneau d'outils.
   * @param collapsed - `true` pour replier
   */
  function setCollapsed(collapsed: boolean) {
    setToolsCollapsed(collapsed)
    try {
      localStorage.setItem(TOOLS_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session.
    }
  }
  const [exporting, setExporting] = useState(false)
  const [version, setVersion] = useState(0)
  const images = useRef(new Map<string, LoadedImage>())
  const pending = useRef(new Set<string>())
  const mounted = useRef(true)
  const failed = useRef(new Set<string>())
  const limiter = useMemo(() => createLimiter(3), [])

  // Mémo : une découpe ajustée à la main donnerait sinon un nouvel objet à chaque rendu, donc un redessin.
  const layoutId = doc.layoutId
  const split = doc.split
  const photoCount = doc.photos.length
  const layout = useMemo(() => resolveLayout(layoutId, split, photoCount), [layoutId, split, photoCount])
  const ratio = ratioValue(doc.ratio)
  const photoKey = doc.photos
    .map((p) => p.id)
    .sort()
    .join('|')

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

  /** Photo de la case i pour l'aperçu : réglages, filtre puis zones masquées appliqués, résultat gardé en cache. */
  const imageFor = useCallback(
    (i: number) => {
      const p = doc.photos[i]
      const base = p ? images.current.get(p.id) : undefined
      if (!p || !base || compare) return base
      const params = paramsForPhoto(doc, i)
      let colored: Drawable = base
      if (!isIdentity(params)) {
        const key = paramsKey(params)
        const hit = processed.current.get(p.id)
        if (hit?.key === key) colored = hit.out
        else {
          hit?.out.close()
          const size = fitWithin(base.width, base.height, PROCESSED_SIDE)
          const out = processPhoto(base.source, size.width, size.height, params)
          processed.current.set(p.id, { key, out })
          colored = out
        }
      }
      const mk = masksKey(p.masks)
      if (!mk) return colored
      const key = `${paramsKey(params)}#${mk}`
      const hit = masked.current.get(p.id)
      if (hit?.key === key) return hit.out
      hit?.out.close()
      const out = applyMasks(colored, p.masks!)
      masked.current.set(p.id, { key, out })
      return out
    },
    [doc, compare],
  )

  useEffect(() => {
    const map = processed.current
    const maskedMap = masked.current
    return () => {
      map.forEach((v) => v.out.close())
      map.clear()
      maskedMap.forEach((v) => v.out.close())
      maskedMap.clear()
    }
  }, [])

  /** Échantillon pour les vignettes de filtres : la première photo chargée, réduite. */
  const [sample, setSample] = useState<ImageBitmap | null>(null)
  const firstLoaded = doc.photos.map((p) => images.current.get(p.id)).find(Boolean)
  useEffect(() => {
    if (!firstLoaded || sample) return
    const size = fitWithin(firstLoaded.width, firstLoaded.height, 120)
    void createImageBitmap(firstLoaded.source, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' }).then(
      setSample,
    )
  }, [firstLoaded, sample])

  /**
   * Réglage automatique : d'après la photo choisie, ou toutes les photos du collage.
   * @param scope - `'collage'`, ou l'indice de la photo
   * @returns les réglages calculés sur les échantillons réunis des photos chargées
   */
  function autoFor(scope: 'collage' | number): Partial<Adjustments> {
    const sources = (scope === 'collage' ? doc.photos : [doc.photos[scope]])
      .map((p) => images.current.get(p.id))
      .filter((x): x is LoadedImage => !!x)
    const chunks = sources.map((img) => sampleRgba(img.source))
    const all = new Uint8ClampedArray(chunks.reduce((s, c) => s + c.length, 0))
    let o = 0
    for (const c of chunks) {
      all.set(c, o)
      o += c.length
    }
    return autoAdjust(all)
  }

  /**
   * Remplace les réglages appliqués à tout le collage.
   * @param adjust - nouveaux réglages, ou `undefined` pour les retirer
   * @returns rien (résultat de `setDoc`)
   */
  const setCollageAdjust = (adjust: Partial<Adjustments> | undefined) => setDoc((d) => ({ ...d, adjust }))
  /**
   * Remplace les réglages propres à une photo.
   * @param i - indice de la photo
   * @param adjust - nouveaux réglages, ou `undefined` pour les retirer
   * @returns rien (résultat de `setDoc`)
   */
  const setPhotoAdjustValue = (i: number, adjust: Partial<Adjustments> | undefined) =>
    setDoc((d) => ({ ...d, photos: d.photos.map((p, k) => (k === i ? { ...p, adjust } : p)) }))
  const hasColor = !!doc.filter || !!doc.adjust || doc.photos.some((p) => p.adjust)

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

  /** Taille en pixels de la photo de la case i : celle de l'aperçu chargé, sinon celle connue de Drive. */
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

  /** Sélectionne une photo (ou rien) et quitte les modes en cours (échange, recadrage, réglages, pipette). */
  const select = useCallback((i: number | null) => {
    setSelected(i)
    setSelectedOverlay(null)
    setSwapPick(false)
    setCropMode(false)
    setMaskMode(false)
    setMaskSelected(null)
    setPhotoAdjust(false)
    setEyedropper(null)
  }, [])

  // Taille disponible pour l'éditeur de zones (mesurée tant qu'il est affiché).
  useEffect(() => {
    const el = maskWrap.current
    if (!maskMode || !el) return
    const observer = new ResizeObserver(([entry]) => setMaskBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [maskMode])

  /**
   * Remplace les zones masquées d'une photo.
   * @param i - indice de la photo
   * @param masks - nouvelles zones (vide = aucune)
   */
  function setMasks(i: number, masks: Mask[]) {
    setDoc((d) => ({ ...d, photos: d.photos.map((p, k) => (k === i ? { ...p, masks: masks.length ? masks : undefined } : p)) }))
  }

  /**
   * Change le mode ou l'intensité de la zone choisie, sinon des prochaines zones (mémorisé sur l'appareil).
   * @param change - mode et/ou intensité
   */
  function setMaskSetting(change: Partial<Pick<Mask, 'mode' | 'strength'>>) {
    const next = { ...maskNext, ...change }
    setMaskNext(next)
    saveNextDefaults(next)
    if (selected === null || !maskSelected) return
    setMasks(
      selected,
      (doc.photos[selected].masks ?? []).map((m) => (m.id === maskSelected ? { ...m, ...change } : m)),
    )
  }

  /** Sélectionne un texte ou un sticker (ou rien) ; désélectionne la photo. */
  const selectOverlay = useCallback((id: string | null) => {
    setSelectedOverlay(id)
    setSelected(null)
    setSwapPick(false)
    setCropMode(false)
    setEyedropper(null)
  }, [])

  /** Remplace un texte ou un sticker par sa version modifiée (même `id`). */
  const updateOverlay = useCallback(
    (o: Overlay) => setDoc((d) => ({ ...d, overlays: (d.overlays ?? []).map((x) => (x.id === o.id ? o : x)) })),
    [setDoc],
  )

  /** Ajoute un texte ou un sticker au premier plan et le sélectionne. */
  const addOverlay = useCallback(
    (o: Overlay) => {
      setDoc((d) => ({ ...d, overlays: [...(d.overlays ?? []), o] }))
      selectOverlay(o.id)
    },
    [setDoc, selectOverlay],
  )

  /**
   * Ajoute un texte et place le curseur dans son champ de saisie.
   * @param preset - style prédéfini ; à défaut, le style par défaut
   */
  function addText(preset?: TextPreset) {
    addOverlay(newText(t('text.default'), preset))
    setFocusText((n) => n + 1)
  }

  /**
   * Ajoute en sticker une image choisie dans Drive ; signale un format non pris en charge.
   * @returns une promesse résolue une fois le choix traité (les erreurs sont affichées, pas propagées)
   */
  async function addImageSticker() {
    setNotice(null)
    try {
      const picked = await services.picker.pickImage(location.drive, lang, t('sticker.mineTitle'))
      if (!picked) return
      const p = await services.drive.getPhoto(picked.id)
      if (!p.supported) {
        setNotice({ key: 'photo.unsupported', vars: { type: p.mimeType.replace('image/', '').toUpperCase() } })
        return
      }
      addOverlay(newImage(p.id, p.name, p.mimeType, p.width && p.height ? p.height / p.width : 1))
    } catch (e) {
      setNotice(toUiError(e))
    }
  }

  /**
   * Ordre des éléments : devant (+1) ou derrière (−1).
   * @param id - identifiant du texte ou du sticker
   * @param step - `1` pour avancer d'un rang, `-1` pour reculer
   */
  function moveOverlay(id: string, step: 1 | -1) {
    setDoc((d) => {
      const list = [...(d.overlays ?? [])]
      const i = list.findIndex((o) => o.id === id)
      const j = i + step
      if (i < 0 || j < 0 || j >= list.length) return d
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...d, overlays: list }
    })
  }

  /**
   * Pipette : couleur du pixel touché sur l'aperçu, transmise au réglage qui l'a demandée.
   * @param x - abscisse en pixels CSS, depuis le bord gauche de l'aperçu
   * @param y - ordonnée en pixels CSS, depuis le bord haut de l'aperçu
   */
  function pickColorAt(x: number, y: number) {
    const canvas = canvasEl.current
    const apply = eyedropper
    setEyedropper(null)
    if (!canvas || !apply) return
    const k = canvas.width / canvas.getBoundingClientRect().width
    const ctx = canvas.getContext('2d')
    const px = ctx?.getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data
    if (px) apply(toHex(px[0], px[1], px[2]))
  }

  // Annuler / rétablir au clavier.
  const { undo, redo } = history
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as Element)?.closest?.('input, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) undo()
      else if ((k === 'z' && e.shiftKey) || k === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /** Remplace le cadrage de la photo d'indice `i`. */
  const setCrop = useCallback(
    (i: number, crop: Crop) => {
      setDoc((d) => ({ ...d, photos: d.photos.map((p, k) => (k === i ? { ...p, crop } : p)) }))
    },
    [setDoc],
  )

  /** Échange les photos des cases `a` et `b`, puis sélectionne la case `b`. */
  const swap = useCallback(
    (a: number, b: number) => {
      setDoc((d) => {
        const photos = [...d.photos]
        ;[photos[a], photos[b]] = [photos[b], photos[a]]
        return { ...d, photos }
      })
      setSelected(b)
      setSwapPick(false)
    },
    [setDoc],
  )

  /**
   * Dimensions de la case sélectionnée et de sa photo, pour les réglages au curseur.
   * @returns la taille de la photo (`img`, en pixels) et celle de la case (`box`, ramenée à un collage
   * de 1000 unités de long), ou `null` sans sélection ou si la taille de la photo est inconnue
   */
  function selectedSizes() {
    if (selected === null) return null
    const img = imageSize(selected)
    const box = layout.cells[selected]
    if (!img || !box) return null
    // Les cadrages sont relatifs : la taille absolue de la case importe peu, seule sa forme compte.
    return { img, box: { w: box.w * (ratio >= 1 ? 1000 : 1000 * ratio), h: box.h * (ratio >= 1 ? 1000 / ratio : 1000) } }
  }

  /**
   * Exécute une action du menu de la photo sélectionnée.
   *
   * « Pivoter » arrondit l'angle au quart de tour puis ajoute 90° ; « Supprimer » choisit une disposition
   * pour une photo de moins.
   * @param action - action choisie
   * @returns une promesse résolue une fois l'action faite (« Remplacer » attend le sélecteur Drive)
   */
  async function onAction(action: PhotoAction) {
    if (selected === null) return
    const photo = doc.photos[selected]
    const s = selectedSizes()
    setNotice(null)
    if (action === 'swap') setSwapPick((v) => !v)
    else if (action === 'flip') setCrop(selected, { ...photo.crop, flip: !photo.crop.flip })
    else if (action === 'rotate' && s)
      setCrop(selected, rotateTo(photo.crop, s.img, s.box, normalizeAngle(Math.round(photo.crop.angle / 90) * 90 + 90)))
    else if (action === 'crop') setCropMode(true)
    else if (action === 'mask') {
      setMaskSelected(null)
      setMaskMode(true)
    } else if (action === 'adjust') {
      setAdjustScope('photo')
      setPhotoAdjust(true)
    } else if (action === 'delete' && doc.photos.length > 1) {
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
          photos: d.photos.map((x, k) =>
            k === index ? { id: p.id, name: p.name, mimeType: p.mimeType, width: p.width, height: p.height, crop: { ...DEFAULT_CROP } } : x,
          ),
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
        <div className="history-buttons">
          <button
            type="button"
            className="round-button small"
            onClick={history.undo}
            disabled={!history.canUndo}
            title={t('editor.undo')}
            aria-label={t('editor.undo')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
            </svg>
          </button>
          <button
            type="button"
            className="round-button small"
            onClick={history.redo}
            disabled={!history.canRedo}
            title={t('editor.redo')}
            aria-label={t('editor.redo')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
            </svg>
          </button>
        </div>
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
          if (!(e.target as Element).closest('.canvas-frame, .shuffle, .compare, .mask-wrap')) select(null)
        }}
      >
        {maskMode && selected !== null && doc.photos[selected] && images.current.get(doc.photos[selected].id) ? (
          <div ref={maskWrap} className="mask-wrap">
            {maskBox.width > 0 && (
              <MaskEditor
                image={images.current.get(doc.photos[selected].id)!}
                masks={doc.photos[selected].masks ?? []}
                onChange={(m) => setMasks(selected, m)}
                width={maskBox.width}
                height={maskBox.height}
                selected={maskSelected}
                onSelect={setMaskSelected}
                next={maskNext}
              />
            )}
          </div>
        ) : (
          <CollageCanvas
            doc={doc}
            layout={layout}
            ratio={ratio}
            imageFor={imageFor}
            overlayFor={assets.overlayFor}
            canvasRef={canvasEl}
            version={version + assets.version * 1000}
            raw={compare}
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
                selectedOverlay={selectedOverlay}
                onSelectOverlay={selectOverlay}
                onOverlay={updateOverlay}
                onEditText={(id) => {
                  selectOverlay(id)
                  setFocusText((n) => n + 1)
                }}
                onEyedropper={eyedropper ? pickColorAt : undefined}
              />
            )}
          />
        )}
        {hasColor && (
          <button
            type="button"
            className={`round-button compare${compare ? ' active' : ''}`}
            title={t('filters.compare')}
            aria-label={t('filters.compare')}
            aria-pressed={compare}
            onPointerDown={(e) => {
              e.stopPropagation()
              setCompare(true)
            }}
            onPointerUp={() => setCompare(false)}
            onPointerLeave={() => setCompare(false)}
            onPointerCancel={() => setCompare(false)}
            onKeyDown={(e) => e.key === ' ' && setCompare(true)}
            onKeyUp={() => setCompare(false)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 3v18M9 6H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4M15 6h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4" />
            </svg>
          </button>
        )}
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

      <div className={`editor-tools${toolsCollapsed ? ' collapsed' : ''}`}>
        {selectedOverlay && overlays.some((o) => o.id === selectedOverlay) ? (
          <div className="panel panel-tall">
            <OverlayPanel
              overlay={overlays.find((o) => o.id === selectedOverlay)!}
              onChange={updateOverlay}
              onDuplicate={() => {
                const o = overlays.find((x) => x.id === selectedOverlay)
                if (o) addOverlay(duplicateOverlay(o))
              }}
              onForward={() => moveOverlay(selectedOverlay, 1)}
              onBackward={() => moveOverlay(selectedOverlay, -1)}
              onDelete={() => {
                setDoc((d) => ({ ...d, overlays: (d.overlays ?? []).filter((o) => o.id !== selectedOverlay) }))
                selectOverlay(null)
              }}
              onDone={() => selectOverlay(null)}
              onEyedropper={(apply) => setEyedropper(() => apply)}
              eyedropperActive={!!eyedropper}
              focusTextToken={focusText}
            />
          </div>
        ) : selected !== null && doc.photos[selected] && photoAdjust ? (
          <div className="panel">
            <AdjustPanel
              value={adjustScope === 'photo' ? doc.photos[selected].adjust : doc.adjust}
              onChange={(v) => (adjustScope === 'photo' ? setPhotoAdjustValue(selected, v) : setCollageAdjust(v))}
              onAuto={() => {
                const v = autoFor(adjustScope === 'photo' ? selected : 'collage')
                if (adjustScope === 'photo') setPhotoAdjustValue(selected, v)
                else setCollageAdjust(v)
              }}
              scope={{ value: adjustScope, onChange: setAdjustScope }}
            />
            <div className="actions actions-tight">
              <button type="button" className="btn btn-primary btn-small" onClick={() => setPhotoAdjust(false)}>
                {t('photo.done')}
              </button>
            </div>
          </div>
        ) : selected !== null && doc.photos[selected] && maskMode ? (
          <div className="panel panel-tall">
            <MaskPanel
              masks={doc.photos[selected].masks ?? []}
              selected={(doc.photos[selected].masks ?? []).find((m) => m.id === maskSelected) ?? null}
              next={maskNext}
              onSetting={setMaskSetting}
              onClear={() => {
                setMasks(selected, [])
                setMaskSelected(null)
              }}
              onDone={() => {
                setMaskMode(false)
                setMaskSelected(null)
              }}
            />
          </div>
        ) : selected !== null && doc.photos[selected] ? (
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
              <PhotoMenu
                canDelete={doc.photos.length > 1}
                swapPick={swapPick}
                onAction={(a) => void onAction(a)}
                onDone={() => select(null)}
              />
            </div>
          )
        ) : (
          <>
            <div className="tabs-row">
              <div className="tabs" role="tablist">
                {TABS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id && !toolsCollapsed}
                    className={tab === id && !toolsCollapsed ? 'active' : ''}
                    onClick={() => {
                      setTab(id)
                      if (toolsCollapsed) setCollapsed(false)
                    }}
                  >
                    {t(`editor.tab.${id}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="tools-toggle"
                aria-expanded={!toolsCollapsed}
                aria-label={toolsCollapsed ? t('editor.toolsExpand') : t('editor.toolsCollapse')}
                title={toolsCollapsed ? t('editor.toolsExpand') : t('editor.toolsCollapse')}
                onClick={() => setCollapsed(!toolsCollapsed)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d={toolsCollapsed ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {!toolsCollapsed && (
              <div className={`panel${tab === 'stickers' || tab === 'filters' ? ' panel-tall' : ''}`} role="tabpanel">
                {tab === 'ratio' && <RatioPanel value={doc.ratio} onChange={(ratioId) => setDoc((d) => ({ ...d, ratio: ratioId }))} />}
                {tab === 'layout' && (
                  <LayoutPanel
                    photoCount={doc.photos.length}
                    value={layout.id}
                    onChange={(id) => setDoc((d) => ({ ...d, layoutId: id, split: undefined }))}
                  />
                )}
                {tab === 'borders' && (
                  <BordersPanel
                    value={doc.borders}
                    onChange={(b) => setDoc((d) => ({ ...d, borders: b }))}
                    shapes={!layout.geo ? 'none' : layout.geo.every((c) => c.kind !== 'rect') ? 'all' : 'some'}
                  />
                )}
                {tab === 'background' && (
                  <BackgroundPanel value={doc.background} onChange={(c) => setDoc((d) => ({ ...d, background: c }))} />
                )}
                {tab === 'filters' && (
                  <div className="filters-tab">
                    <div className="segmented segmented-small">
                      {(['filters', 'adjust'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={filterMode === m ? 'active' : ''}
                          aria-pressed={filterMode === m}
                          onClick={() => setFilterMode(m)}
                        >
                          {t(m === 'filters' ? 'filters.filters' : 'filters.adjust')}
                        </button>
                      ))}
                    </div>
                    {filterMode === 'filters' ? (
                      <FilterList value={doc.filter} onChange={(filter) => setDoc((d) => ({ ...d, filter }))} sample={sample} />
                    ) : (
                      <AdjustPanel value={doc.adjust} onChange={setCollageAdjust} onAuto={() => setCollageAdjust(autoFor('collage'))} />
                    )}
                  </div>
                )}
                {tab === 'text' && (
                  <div className="text-tab">
                    <button type="button" className="btn btn-primary" onClick={() => addText()}>
                      {t('text.add')}
                    </button>
                    <p className="panel-note">{t('text.stylesHint')}</p>
                    <PresetGrid onPick={(p) => addText(p)} />
                  </div>
                )}
                {tab === 'stickers' && (
                  <StickerBrowser
                    onPickIcon={(set, name, svg) => addOverlay(newIcon(set, name, svg, set === 'ph' ? '#111111' : undefined))}
                    onPickImage={() => void addImageSticker()}
                  />
                )}
              </div>
            )}
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
          loadOverlay={assets.loadOverlay}
          prepareText={assets.prepareText}
          onClose={() => setExporting(false)}
          onSaved={() => {}}
          onReconnect={onReconnect}
        />
      )}
    </main>
  )
}

/**
 * Icône « Mélanger ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function ShuffleIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>
  )
}
