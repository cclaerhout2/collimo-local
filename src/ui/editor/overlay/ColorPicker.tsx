import { useI18n } from '../../../i18n'

export const PALETTE = [
  '#ffffff', '#d4d4d8', '#9ca3af', '#52525b', '#111111',
  '#fecdd3', '#f87171', '#dc2626', '#b3261e',
  '#fde68a', '#facc15', '#f59e0b', '#ea580c',
  '#bbf7d0', '#22c55e', '#2dd4a7', '#15803d',
  '#bfdbfe', '#3b82f6', '#1d4ed8', '#1e3a8a',
  '#ddd6fe', '#8b5cf6', '#ec4899',
]

interface Props {
  value: string
  onChange: (color: string) => void
  /** Active la pipette : le prochain toucher sur le collage donne la couleur. */
  onEyedropper: () => void
  eyedropperActive: boolean
}

/** Pipette, couleur libre et nuancier, comme dans l'app de référence. */
export function ColorPicker({ value, onChange, onEyedropper, eyedropperActive }: Props) {
  const { t } = useI18n()
  return (
    <div className="color-picker">
      <button
        type="button"
        className={`color-tool${eyedropperActive ? ' active' : ''}`}
        title={t('color.eyedropper')}
        aria-label={t('color.eyedropper')}
        aria-pressed={eyedropperActive}
        onClick={onEyedropper}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="m14 4 6 6M17 7l-9.5 9.5L4 20l3.5-3.5L17 7zM12 6l6 6" />
        </svg>
      </button>
      <label className="color-tool color-custom" title={t('color.custom')}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('color.custom')} />
      </label>
      <div className="color-swatches" role="radiogroup">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c.toLowerCase() === value.toLowerCase()}
            aria-label={c}
            className={`color-swatch${c.toLowerCase() === value.toLowerCase() ? ' selected' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  )
}

/** Curseur 0–100 sur une valeur 0–1. */
export function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span className="slider-value">{Math.round(value * 100)}</span>
    </label>
  )
}
