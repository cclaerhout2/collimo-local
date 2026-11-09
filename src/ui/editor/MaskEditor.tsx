/**
 * Édition des zones masquées d'une photo : la photo entière en grand, avec ses zones floutées en
 * direct ; on trace un rectangle pour en ajouter une, on déplace ou redimensionne une zone par ses
 * poignées, on la supprime d'une croix. On zoome à la molette, au pincement ou aux boutons, et on
 * déplace la vue avec l'outil main, Espace + glisser, le bouton du milieu ou deux doigts. Le panneau
 * du bas règle le mode et l'intensité de la zone choisie, ou de la prochaine zone tracée.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  applyMasks,
  DEFAULT_MASK,
  MIN_MASK_SIZE,
  newMaskId,
  normalizeMaskAngle,
  normalizeRect,
  type Mask,
  type MaskMode,
} from '../../collage/masks'
import type { Drawable } from '../../collage/render'
import { useI18n } from '../../i18n'

/** Poignée saisie : un coin, un bord, ou toute la zone (déplacement). */
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'rotate'

/** Geste en cours : tracé d'une nouvelle zone, déplacement/redimensionnement d'une zone, ou déplacement de la vue. */
type Gesture =
  | { kind: 'draw'; id: string; x0: number; y0: number }
  | { kind: 'edit'; id: string; handle: Handle; x0: number; y0: number; start: Mask }
  | { kind: 'pan'; cx: number; cy: number; tx: number; ty: number }

/** Vue : facteur de zoom (1 = la photo tient dans l'espace) et décalage en pixels. */
interface View {
  z: number
  tx: number
  ty: number
}

/** Zoom maximal. */
const MAX_ZOOM = 8

/** Propriétés de l'éditeur de zones. */
interface Props {
  /** Photo d'origine, telle que chargée pour l'aperçu. */
  image: Drawable
  /** Zones actuelles. */
  masks: Mask[]
  /** Remplace les zones. */
  onChange: (masks: Mask[]) => void
  /** Taille disponible pour l'affichage, en pixels CSS. */
  width: number
  height: number
}

/**
 * Zone de dessin de l'éditeur de masques (photo et poignées). Le panneau de réglages est {@link MaskPanel}.
 * @returns la photo masquée en direct, avec les zones manipulables
 */
export function MaskEditor({ image, masks, onChange, width, height, selected, onSelect, next }: Props & MaskSelection) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [view, setView] = useState<View>({ z: 1, tx: 0, ty: 0 })
  /** Outil main actif (déplacement de la vue au lieu du tracé). */
  const [handTool, setHandTool] = useState(false)
  /** Barre d'espace enfoncée : déplacement de la vue temporaire. */
  const [spaceHeld, setSpaceHeld] = useState(false)
  /** Majuscule enfoncée : rotation libre, sans aimantation. */
  const shiftHeld = useRef(false)
  /** Pointeurs enfoncés (pincement à deux doigts). */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; z: number; cx: number; cy: number; tx: number; ty: number } | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    /**
     * Espace enfoncée : déplacer la vue au lieu de tracer.
     * @param e - touche
     */
    function down(e: KeyboardEvent) {
      if (e.key === 'Shift') shiftHeld.current = true
      const typing = e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLInputElement && e.target.type !== 'range')
      if (e.key === ' ' && !typing) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    /**
     * Espace relâchée.
     * @param e - touche
     */
    function up(e: KeyboardEvent) {
      if (e.key === 'Shift') shiftHeld.current = false
      if (e.key === ' ') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // La photo tient dans l'espace disponible, sans déformation.
  const scale = Math.min(width / image.width, height / image.height)
  const w = Math.max(1, Math.floor(image.width * scale))
  const h = Math.max(1, Math.floor(image.height * scale))
  /** Position de la photo non zoomée, centrée dans l'espace. */
  const baseX = (width - w) / 2
  const baseY = (height - h) / 2

  /**
   * Borne une vue : zoom entre 1 et MAX_ZOOM, photo jamais sortie de l'espace (centrée si plus petite).
   * @param v - vue voulue
   * @returns la vue bornée
   */
  function clampView(v: View): View {
    const z = Math.min(MAX_ZOOM, Math.max(1, v.z))
    const zw = w * z
    const zh = h * z
    const minX = Math.min(0, width - zw - baseX * 2) / 1
    const minY = Math.min(0, height - zh - baseY * 2) / 1
    const tx = zw <= width ? (width - zw) / 2 - baseX : Math.min(-baseX, Math.max(minX + baseX, v.tx))
    const ty = zh <= height ? (height - zh) / 2 - baseY : Math.min(-baseY, Math.max(minY + baseY, v.ty))
    return { z, tx, ty }
  }

  /**
   * Zoome autour d'un point de l'écran (en pixels de l'espace), pour que ce point reste fixe.
   * @param factor - multiplicateur de zoom
   * @param cx - abscisse du point, dans l'espace
   * @param cy - ordonnée du point, dans l'espace
   */
  function zoomAt(factor: number, cx: number, cy: number) {
    setView((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, v.z * factor))
      const k = z / v.z
      // Le point (cx, cy) correspond au point image (cx - baseX - tx) / z ; on garde cette correspondance.
      const tx = cx - baseX - (cx - baseX - v.tx) * k
      const ty = cy - baseY - (cy - baseY - v.ty) * k
      return clampView({ z, tx, ty })
    })
  }

  /**
   * Coordonnées d'un événement dans l'espace de l'éditeur, en pixels.
   * @param e - événement pointeur ou molette
   * @returns x et y
   */
  function stagePoint(e: { clientX: number; clientY: number }) {
    const r = stageRef.current!.getBoundingClientRect()
    return { cx: e.clientX - r.left, cy: e.clientY - r.top }
  }

  /**
   * Molette : zoom autour du curseur.
   * @param e - événement molette
   */
  function onWheel(e: ReactWheelEvent) {
    e.preventDefault()
    const { cx, cy } = stagePoint(e)
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, cx, cy)
  }

  const panning = handTool || spaceHeld

  // Aperçu : la photo réduite à l'écran, zones appliquées (même moteur que le collage et l'export).
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // La photo est d'abord réduite à l'échelle d'affichage, puis les zones sont appliquées à cette échelle :
    // comme leur intensité est relative à leur taille, le rendu est le même que dans le collage et à l'export.
    const base = applyMasks({ source: image.source, width: canvas.width, height: canvas.height }, [])
    const out = masks.length ? applyMasks(base, masks) : base
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(out.source, 0, 0)
    if (out !== base) out.close()
    base.close()
  }, [image, masks, w, h])

  /**
   * Position du pointeur en fractions de la photo.
   * @param e - événement pointeur
   * @returns x et y entre 0 et 1 (bornés)
   */
  function at(e: ReactPointerEvent | PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }

  /**
   * Commence un tracé sur le fond (nouvelle zone).
   * @param e - pointeur enfoncé sur la photo
   */
  function startDraw(e: ReactPointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // Deux doigts : pincement (zoom) et déplacement ; un tracé en cours est abandonné.
      const [a, b] = [...pointers.current.values()]
      const { cx, cy } = stagePoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, cx, cy, tx: view.tx, ty: view.ty }
      if (gesture?.kind === 'draw') {
        onChange(masks.filter((x) => x.id !== gesture.id))
        onSelect(null)
      }
      setGesture(null)
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      return
    }
    if (e.button === 1 || (e.button === 0 && panning)) {
      const { cx, cy } = stagePoint(e)
      setGesture({ kind: 'pan', cx, cy, tx: view.tx, ty: view.ty })
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = at(e)
    const id = newMaskId()
    onSelect(id)
    onChange([...masks, { id, x: p.x, y: p.y, w: 0, h: 0, ...next }])
    setGesture({ kind: 'draw', id, x0: p.x, y0: p.y })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  /**
   * Commence le déplacement ou le redimensionnement d'une zone.
   * @param e - pointeur enfoncé sur une zone ou une poignée
   * @param m - zone
   * @param handle - poignée saisie
   */
  function startEdit(e: ReactPointerEvent, m: Mask, handle: Handle) {
    e.stopPropagation()
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = at(e)
    onSelect(m.id)
    setGesture({ kind: 'edit', id: m.id, handle, x0: p.x, y0: p.y, start: m })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  /**
   * Met à jour la zone du geste en cours.
   * @param e - pointeur déplacé
   */
  function move(e: ReactPointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const { cx, cy } = stagePoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
      const start = pinch.current
      const z = Math.min(MAX_ZOOM, Math.max(1, (start.z * dist) / Math.max(1, start.dist)))
      const k = z / start.z
      setView(clampView({ z, tx: cx - baseX - (start.cx - baseX - start.tx) * k, ty: cy - baseY - (start.cy - baseY - start.ty) * k }))
      return
    }
    if (!gesture) return
    if (gesture.kind === 'pan') {
      const { cx, cy } = stagePoint(e)
      setView((v) => clampView({ z: v.z, tx: gesture.tx + (cx - gesture.cx), ty: gesture.ty + (cy - gesture.cy) }))
      return
    }
    const p = at(e)
    onChange(
      masks.map((m) => {
        if (m.id !== gesture.id) return m
        if (gesture.kind === 'draw')
          return { ...m, ...normalizeRect({ x: gesture.x0, y: gesture.y0, w: p.x - gesture.x0, h: p.y - gesture.y0 }) }
        const s = gesture.start
        if (gesture.handle === 'rotate') {
          // Angle entre le centre de la zone et le pointeur, en pixels d'écran (la photo n'est pas carrée).
          const cx = (s.x + s.w / 2) * w
          const cy = (s.y + s.h / 2) * h
          const a0 = Math.atan2(gesture.y0 * h - cy, gesture.x0 * w - cx)
          const a1 = Math.atan2(p.y * h - cy, p.x * w - cx)
          let angle = (s.angle ?? 0) + ((a1 - a0) * 180) / Math.PI
          // Aimantation aux multiples de 15° (Maj pour la désactiver).
          if (!shiftHeld.current) {
            const snap = Math.round(angle / 15) * 15
            if (Math.abs(snap - angle) < 3) angle = snap
          }
          return { ...m, angle: normalizeMaskAngle(angle) || undefined }
        }
        // Déplacement : dans le repère tourné de la zone, pour que les poignées suivent les bords.
        let dx = p.x - gesture.x0
        let dy = p.y - gesture.y0
        if (gesture.handle !== 'move' && s.angle) {
          const a = (-s.angle * Math.PI) / 180
          const px = dx * w
          const py = dy * h
          dx = (px * Math.cos(a) - py * Math.sin(a)) / w
          dy = (px * Math.sin(a) + py * Math.cos(a)) / h
        }
        if (gesture.handle === 'move') {
          return { ...m, x: Math.min(1 - s.w, Math.max(0, s.x + dx)), y: Math.min(1 - s.h, Math.max(0, s.y + dy)) }
        }
        let x1 = s.x
        let y1 = s.y
        let x2 = s.x + s.w
        let y2 = s.y + s.h
        if (gesture.handle.includes('w')) x1 = s.x + dx
        if (gesture.handle.includes('e')) x2 = s.x + s.w + dx
        if (gesture.handle.includes('n')) y1 = s.y + dy
        if (gesture.handle.includes('s')) y2 = s.y + s.h + dy
        return { ...m, ...normalizeRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }) }
      }),
    )
  }

  /**
   * Termine le geste : une zone trop petite (simple clic) est retirée.
   * @param e - pointeur relâché, s'il y en a un
   */
  function end(e?: ReactPointerEvent) {
    if (e) pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (!gesture) return
    if (gesture.kind === 'pan') {
      setGesture(null)
      return
    }
    const m = masks.find((x) => x.id === gesture.id)
    if (m && (m.w < MIN_MASK_SIZE || m.h < MIN_MASK_SIZE)) {
      onChange(masks.filter((x) => x.id !== gesture.id))
      onSelect(null)
    }
    setGesture(null)
  }

  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  const inv = 1 / view.z

  return (
    <div
      ref={stageRef}
      className={`mask-stage${panning ? ' panning' : ''}${gesture?.kind === 'pan' ? ' pan-active' : ''}`}
      style={{ width, height }}
      onWheel={onWheel}
    >
      <div className="mask-zoom" role="toolbar" aria-label={t('mask.zoom')}>
        <button
          type="button"
          aria-label={t('mask.zoomOut')}
          title={t('mask.zoomOut')}
          disabled={view.z <= 1}
          onClick={() => zoomAt(1 / 1.5, width / 2, height / 2)}
        >
          −
        </button>
        <span className="mask-zoom-value">{Math.round(view.z * 100)} %</span>
        <button
          type="button"
          aria-label={t('mask.zoomIn')}
          title={t('mask.zoomIn')}
          disabled={view.z >= MAX_ZOOM}
          onClick={() => zoomAt(1.5, width / 2, height / 2)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('mask.zoomFit')}
          title={t('mask.zoomFit')}
          disabled={view.z === 1}
          onClick={() => setView({ z: 1, tx: 0, ty: 0 })}
        >
          ⤢
        </button>
        <button
          type="button"
          className={handTool ? 'active' : ''}
          aria-pressed={handTool}
          aria-label={t('mask.hand')}
          title={t('mask.handHint')}
          onClick={() => setHandTool((v) => !v)}
        >
          ✋
        </button>
      </div>
      <div
        ref={boxRef}
        className={`mask-box${gesture ? ' dragging' : ''}`}
        style={{
          width: w,
          height: h,
          left: baseX,
          top: baseY,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`,
          ['--inv' as string]: inv,
        }}
        onPointerDown={startDraw}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <canvas ref={canvasRef} className="mask-canvas" style={{ width: w, height: h }} aria-label={t('mask.canvasLabel')} />
        {masks.map((m) => {
          const active = m.id === selected
          return (
            <div
              key={m.id}
              className={`mask-rect${active ? ' active' : ''}`}
              style={{
                left: `${m.x * 100}%`,
                top: `${m.y * 100}%`,
                width: `${m.w * 100}%`,
                height: `${m.h * 100}%`,
                transform: m.angle ? `rotate(${m.angle}deg)` : undefined,
              }}
              onPointerDown={(e) => startEdit(e, m, 'move')}
              role="button"
              tabIndex={0}
              aria-label={t(`mask.mode.${m.mode}`)}
              aria-pressed={active}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault()
                  onChange(masks.filter((x) => x.id !== m.id))
                  onSelect(null)
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(m.id)
                }
              }}
            >
              {active &&
                handles.map((hd) => (
                  <span key={hd} className={`mask-handle ${hd}`} onPointerDown={(e) => startEdit(e, m, hd)} aria-hidden="true" />
                ))}
              {active && (
                <span
                  className="mask-rotate"
                  onPointerDown={(e) => startEdit(e, m, 'rotate')}
                  title={t('mask.rotateHint')}
                  aria-hidden="true"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                  </svg>
                </span>
              )}
              {active && (
                <button
                  type="button"
                  className="mask-delete"
                  aria-label={t('mask.delete')}
                  title={t('mask.delete')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(masks.filter((x) => x.id !== m.id))
                    onSelect(null)
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Zone choisie dans l'éditeur, et réglages de la prochaine zone tracée. */
export interface MaskSelection {
  /** Identifiant de la zone choisie, ou `null`. */
  selected: string | null
  /** Choisit une zone. */
  onSelect: (id: string | null) => void
  /** Mode et intensité appliqués à la prochaine zone tracée. */
  next: Pick<Mask, 'mode' | 'strength'>
}

/** Propriétés du panneau de réglages des zones. */
interface PanelProps {
  masks: Mask[]
  /** Zone choisie, ou `null` : les réglages s'appliquent alors à la prochaine zone. */
  selected: Mask | null
  /** Réglages de la prochaine zone. */
  next: Pick<Mask, 'mode' | 'strength'>
  /** Change le mode ou l'intensité de la zone choisie (ou de la prochaine). */
  onSetting: (change: Partial<Pick<Mask, 'mode' | 'strength'>>) => void
  /** Change l'angle de la zone choisie. */
  onAngle: (angle: number) => void
  /** Retire toutes les zones. */
  onClear: () => void
  /** Ferme l'éditeur. */
  onDone: () => void
}

/**
 * Panneau du bas : consigne, mode, intensité, tout effacer, terminé.
 * @returns le panneau
 */
export function MaskPanel({ masks, selected, next, onSetting, onAngle, onClear, onDone }: PanelProps) {
  const { t } = useI18n()
  const current = selected ?? next
  const modes: MaskMode[] = ['blur', 'pixelate', 'fill']
  return (
    <div className="mask-panel">
      <p className="panel-note">{masks.length ? (selected ? t('mask.hintSelected') : t('mask.hintMore')) : t('mask.hintEmpty')}</p>
      <div className="mask-controls">
        <div className="segmented" role="group" aria-label={t('mask.modeLabel')}>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={current.mode === mode ? 'active' : ''}
              aria-pressed={current.mode === mode}
              onClick={() => onSetting({ mode })}
            >
              {t(`mask.mode.${mode}`)}
            </button>
          ))}
        </div>
        <label className="slider mask-slider">
          <span className="slider-label">{t('mask.strength')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(current.strength * 100)}
            onChange={(e) => onSetting({ strength: Number(e.target.value) / 100 })}
          />
          <span className="slider-value">{Math.round(current.strength * 100)}</span>
        </label>
        {selected && (
          <label className="slider mask-slider">
            <span className="slider-label">{t('mask.angle')}</span>
            <input
              type="range"
              min={-90}
              max={90}
              step={0.5}
              value={selected.angle ?? 0}
              onChange={(e) => onAngle(Number(e.target.value))}
            />
            <span className="slider-value">{Math.round(selected.angle ?? 0)}°</span>
          </label>
        )}
      </div>
      <div className="actions actions-tight">
        <button type="button" className="btn btn-ghost btn-small" onClick={onClear} disabled={!masks.length}>
          {t('mask.clear')}
        </button>
        <button type="button" className="btn btn-primary btn-small" onClick={onDone}>
          {t('photo.done')}
        </button>
      </div>
    </div>
  )
}

/**
 * Réglages par défaut des nouvelles zones, mémorisés sur l'appareil.
 * @returns le mode et l'intensité enregistrés, ou ceux par défaut
 */
export function loadNextDefaults(): Pick<Mask, 'mode' | 'strength'> {
  try {
    const raw = localStorage.getItem('collimo.maskDefaults')
    if (!raw) return DEFAULT_MASK
    const v = JSON.parse(raw) as Partial<Mask>
    const mode: MaskMode = v.mode === 'pixelate' || v.mode === 'fill' ? v.mode : 'blur'
    const strength = typeof v.strength === 'number' ? Math.min(1, Math.max(0, v.strength)) : DEFAULT_MASK.strength
    return { mode, strength }
  } catch {
    return DEFAULT_MASK
  }
}

/**
 * Mémorise les réglages des nouvelles zones sur l'appareil.
 * @param next - mode et intensité
 */
export function saveNextDefaults(next: Pick<Mask, 'mode' | 'strength'>) {
  try {
    localStorage.setItem('collimo.maskDefaults', JSON.stringify(next))
  } catch {
    // Stockage indisponible : les réglages valent pour la session.
  }
}
