/**
 * Édition des zones masquées d'une photo : la photo entière en grand, avec ses zones floutées en
 * direct ; on trace un rectangle pour en ajouter une, on déplace ou redimensionne une zone par ses
 * poignées, on la supprime d'une croix. Le panneau du bas règle le mode et l'intensité de la zone
 * choisie, ou de la prochaine zone tracée.
 */
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { applyMasks, DEFAULT_MASK, MIN_MASK_SIZE, newMaskId, normalizeRect, type Mask, type MaskMode } from '../../collage/masks'
import type { Drawable } from '../../collage/render'
import { useI18n } from '../../i18n'

/** Poignée saisie : un coin, un bord, ou toute la zone (déplacement). */
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Geste en cours : tracé d'une nouvelle zone, ou déplacement/redimensionnement d'une zone existante. */
type Gesture =
  { kind: 'draw'; id: string; x0: number; y0: number } | { kind: 'edit'; id: string; handle: Handle; x0: number; y0: number; start: Mask }

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
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const { t } = useI18n()

  // La photo tient dans l'espace disponible, sans déformation.
  const scale = Math.min(width / image.width, height / image.height)
  const w = Math.max(1, Math.floor(image.width * scale))
  const h = Math.max(1, Math.floor(image.height * scale))

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
    if (!gesture) return
    const p = at(e)
    onChange(
      masks.map((m) => {
        if (m.id !== gesture.id) return m
        if (gesture.kind === 'draw')
          return { ...m, ...normalizeRect({ x: gesture.x0, y: gesture.y0, w: p.x - gesture.x0, h: p.y - gesture.y0 }) }
        const dx = p.x - gesture.x0
        const dy = p.y - gesture.y0
        const s = gesture.start
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

  /** Termine le geste : une zone trop petite (simple clic) est retirée. */
  function end() {
    if (!gesture) return
    const m = masks.find((x) => x.id === gesture.id)
    if (m && (m.w < MIN_MASK_SIZE || m.h < MIN_MASK_SIZE)) {
      onChange(masks.filter((x) => x.id !== gesture.id))
      onSelect(null)
    }
    setGesture(null)
  }

  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  return (
    <div className="mask-stage" style={{ width, height }}>
      <div
        ref={boxRef}
        className={`mask-box${gesture ? ' dragging' : ''}`}
        style={{ width: w, height: h }}
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
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}
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
  /** Retire toutes les zones. */
  onClear: () => void
  /** Ferme l'éditeur. */
  onDone: () => void
}

/**
 * Panneau du bas : consigne, mode, intensité, tout effacer, terminé.
 * @returns le panneau
 */
export function MaskPanel({ masks, selected, next, onSetting, onClear, onDone }: PanelProps) {
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
