import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { applyPreset, TEXT_PRESETS, type TextPreset } from '../../../collage/overlays'
import type { IconOverlay, Overlay, TextEffects, TextOverlay } from '../../../collage/types'
import { useI18n } from '../../../i18n'
import { ensureFont, nearestWeight } from '../../../stickers/fonts'
import { ColorPicker, Range } from './ColorPicker'
import { FontPicker } from './FontPicker'

/** Aperçu CSS d'un style (approximation du rendu Canvas, pour les vignettes). */
export function presetStyle(p: TextPreset): CSSProperties {
  const shadows: string[] = []
  if (p.effects?.glow?.on) shadows.push(`0 0 6px ${p.effects.glow.color}`, `0 0 12px ${p.effects.glow.color}`)
  if (p.effects?.shadow?.on) shadows.push(`2px 2px 3px ${p.effects.shadow.color ?? '#000'}`)
  return {
    color: p.color,
    fontFamily: `"${p.font?.family ?? 'Montserrat'}", system-ui`,
    fontWeight: p.font?.weight ?? 700,
    textShadow: shadows.join(', ') || undefined,
    WebkitTextStroke: p.effects?.stroke?.on ? `1.5px ${p.effects.stroke.color}` : undefined,
    paintOrder: 'stroke fill',
    background: p.effects?.label?.on ? p.effects.label.color : undefined,
    borderRadius: p.effects?.label?.on ? `${(p.effects.label.radius ?? 0) * 14}px` : undefined,
    padding: p.effects?.label?.on ? '2px 8px' : undefined,
  }
}

export function PresetGrid({ onPick }: { onPick: (p: TextPreset) => void }) {
  useEffect(() => {
    for (const p of TEXT_PRESETS) void ensureFont(p.font?.family ?? 'Montserrat', p.font?.weight ?? 700, false)
  }, [])
  return (
    <div className="preset-grid">
      {TEXT_PRESETS.map((p) => (
        <button key={p.id} type="button" className="preset-option" onClick={() => onPick(p)} title={p.id}>
          <span style={presetStyle(p)}>Aa</span>
        </button>
      ))}
    </div>
  )
}

type TextTab = 'edit' | 'styles' | 'font' | 'color' | 'align'
type ColorTab = 'text' | 'stroke' | 'shadow' | 'glow' | 'label' | 'opacity'

interface Props {
  overlay: Overlay
  onChange: (patch: Overlay) => void
  onDuplicate: () => void
  onForward: () => void
  onBackward: () => void
  onDelete: () => void
  onDone: () => void
  onEyedropper: (apply: (color: string) => void) => void
  eyedropperActive: boolean
  /** Demande de mettre le champ texte au premier plan (double-clic sur le texte). */
  focusTextToken: number
}

export function OverlayPanel(props: Props) {
  const { overlay: o, onChange, onEyedropper, eyedropperActive } = props
  const { t } = useI18n()
  const [tab, setTab] = useState<TextTab>('edit')
  const [colorTab, setColorTab] = useState<ColorTab>('text')
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Double-clic sur le texte ou nouveau texte : on revient au champ et on le sélectionne.
  const [seenToken, setSeenToken] = useState(props.focusTextToken)
  if (props.focusTextToken !== seenToken) {
    setSeenToken(props.focusTextToken)
    if (o.type === 'text') setTab('edit')
  }
  useEffect(() => {
    if (props.focusTextToken && o.type === 'text') {
      requestAnimationFrame(() => {
        textRef.current?.focus()
        textRef.current?.select()
      })
    }
  }, [props.focusTextToken, o.type])

  const actions = (
    <div className="overlay-actions">
      <button type="button" className="btn btn-small" onClick={props.onDuplicate}>
        {t('overlay.duplicate')}
      </button>
      <button type="button" className="btn btn-small" onClick={props.onForward}>
        {t('overlay.forward')}
      </button>
      <button type="button" className="btn btn-small" onClick={props.onBackward}>
        {t('overlay.backward')}
      </button>
      <button type="button" className="btn btn-small btn-danger" onClick={props.onDelete}>
        {t('overlay.delete')}
      </button>
      <button type="button" className="btn btn-small btn-primary" onClick={props.onDone}>
        {t('photo.done')}
      </button>
    </div>
  )

  const opacity = <Range label={t('color.opacity')} value={o.opacity} onChange={(v) => onChange({ ...o, opacity: v })} />
  const picker = (value: string, apply: (c: string) => void) => (
    <ColorPicker value={value} onChange={apply} onEyedropper={() => onEyedropper(apply)} eyedropperActive={eyedropperActive} />
  )

  if (o.type !== 'text') {
    const icon = o.type === 'icon' && o.set === 'ph' ? (o as IconOverlay) : null
    return (
      <div className="overlay-panel">
        {actions}
        <div className="overlay-body">
          {icon && picker(icon.color ?? '#111111', (c) => onChange({ ...icon, color: c }))}
          <div className="sliders">{opacity}</div>
        </div>
      </div>
    )
  }

  const text = o as TextOverlay
  const setEffect = <K extends keyof TextEffects>(k: K, patch: Partial<TextEffects[K]>) =>
    onChange({ ...text, effects: { ...text.effects, [k]: { ...text.effects[k], ...patch } } })
  const toggle = (k: Exclude<ColorTab, 'text' | 'opacity'>) => (
    <label className="toggle">
      <input type="checkbox" checked={text.effects[k].on} onChange={(e) => setEffect(k, { on: e.target.checked })} />
      <span>{t('color.enable')}</span>
    </label>
  )

  return (
    <div className="overlay-panel">
      {actions}
      <div className="subtabs" role="tablist">
        {(['edit', 'styles', 'font', 'color', 'align'] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {t(`text.tab.${id}`)}
          </button>
        ))}
      </div>
      <div className="overlay-body">
        {tab === 'edit' && (
          <textarea
            ref={textRef}
            className="text-input"
            value={text.text}
            placeholder={t('text.placeholder')}
            rows={2}
            onChange={(e) => onChange({ ...text, text: e.target.value })}
          />
        )}
        {tab === 'styles' && <PresetGrid onPick={(p) => onChange(applyPreset(text, p))} />}
        {tab === 'font' && (
          <>
            <div className="inline-toggles">
              <button
                type="button"
                className={`chip${text.font.weight >= 600 ? ' active' : ''}`}
                aria-pressed={text.font.weight >= 600}
                onClick={() => onChange({ ...text, font: { ...text.font, weight: text.font.weight >= 600 ? 400 : 700 } })}
              >
                <strong>{t('text.bold')}</strong>
              </button>
              <button
                type="button"
                className={`chip${text.font.italic ? ' active' : ''}`}
                aria-pressed={text.font.italic}
                onClick={() => onChange({ ...text, font: { ...text.font, italic: !text.font.italic } })}
              >
                <em>{t('text.italic')}</em>
              </button>
            </div>
            <FontPicker
              value={text.font.family}
              onChange={(f) => onChange({ ...text, font: { ...text.font, family: f.family, weight: nearestWeight(f.weights, text.font.weight) } })}
            />
          </>
        )}
        {tab === 'color' && (
          <>
            <div className="chips">
              {(['text', 'stroke', 'shadow', 'glow', 'label', 'opacity'] as const).map((c) => (
                <button key={c} type="button" className={`chip${colorTab === c ? ' active' : ''}`} onClick={() => setColorTab(c)}>
                  {t(`color.${c}`)}
                </button>
              ))}
            </div>
            {colorTab === 'text' && picker(text.color, (c) => onChange({ ...text, color: c }))}
            {colorTab === 'stroke' && (
              <>
                {toggle('stroke')}
                {picker(text.effects.stroke.color, (c) => setEffect('stroke', { color: c, on: true }))}
                <div className="sliders">
                  <Range label={t('effect.width')} value={text.effects.stroke.width} onChange={(v) => setEffect('stroke', { width: v, on: true })} />
                </div>
              </>
            )}
            {colorTab === 'shadow' && (
              <>
                {toggle('shadow')}
                {picker(text.effects.shadow.color, (c) => setEffect('shadow', { color: c, on: true }))}
                <div className="sliders">
                  <Range label={t('effect.blur')} value={text.effects.shadow.blur} onChange={(v) => setEffect('shadow', { blur: v, on: true })} />
                  <Range label={t('effect.distance')} value={text.effects.shadow.distance} onChange={(v) => setEffect('shadow', { distance: v, on: true })} />
                </div>
              </>
            )}
            {colorTab === 'glow' && (
              <>
                {toggle('glow')}
                {picker(text.effects.glow.color, (c) => setEffect('glow', { color: c, on: true }))}
                <div className="sliders">
                  <Range label={t('effect.blur')} value={text.effects.glow.blur} onChange={(v) => setEffect('glow', { blur: v, on: true })} />
                </div>
              </>
            )}
            {colorTab === 'label' && (
              <>
                {toggle('label')}
                {picker(text.effects.label.color, (c) => setEffect('label', { color: c, on: true }))}
                <div className="sliders">
                  <Range label={t('effect.padding')} value={text.effects.label.padding} onChange={(v) => setEffect('label', { padding: v, on: true })} />
                  <Range label={t('effect.radius')} value={text.effects.label.radius} onChange={(v) => setEffect('label', { radius: v, on: true })} />
                </div>
              </>
            )}
            {colorTab === 'opacity' && <div className="sliders">{opacity}</div>}
          </>
        )}
        {tab === 'align' && (
          <div className="segmented">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" className={text.align === a ? 'active' : ''} aria-pressed={text.align === a} onClick={() => onChange({ ...text, align: a })}>
                {t(`text.${a}`)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
