import { useEffect, useRef, useState } from 'react'
import { combine, FILTER_FAMILIES, FILTERS, type FilterFamily } from '../../collage/color'
import { processPhoto } from '../../collage/colorProcessor'
import { ADJUST_KEYS, NEUTRAL, POSITIVE_ONLY, type AdjustKey, type Adjustments } from '../../collage/types'
import { useI18n } from '../../i18n'

/** Vignette d'un filtre, calculée sur une petite version d'une photo du collage. */
function FilterThumb({ sample, filterId }: { sample: ImageBitmap | null; filterId: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !sample) return
    const f = FILTERS.find((x) => x.id === filterId)
    const out = f ? processPhoto(sample, sample.width, sample.height, { adjust: NEUTRAL, look: f.look, intensity: 1 }) : null
    c.width = sample.width
    c.height = sample.height
    c.getContext('2d')?.drawImage(out ? out.source : sample, 0, 0)
    out?.close()
  }, [sample, filterId])
  return <canvas ref={ref} className="filter-thumb" aria-hidden="true" />
}

interface FilterProps {
  value: { id: string; intensity: number } | undefined
  onChange: (v: { id: string; intensity: number } | undefined) => void
  sample: ImageBitmap | null
}

export function FilterList({ value, onChange, sample }: FilterProps) {
  const { t, lang } = useI18n()
  const current = FILTERS.find((f) => f.id === value?.id)
  const [family, setFamily] = useState<FilterFamily>(current?.family ?? 'naturel')
  const L = lang === 'fr' ? 0 : 1
  return (
    <div className="filters">
      <div className="chips">
        {FILTER_FAMILIES.map((f) => (
          <button key={f.id} type="button" className={`chip${family === f.id ? ' active' : ''}`} onClick={() => setFamily(f.id)}>
            {f.label[L]}
          </button>
        ))}
      </div>
      <div className="filter-strip" role="radiogroup" aria-label={t('filters.filters')}>
        <button type="button" role="radio" aria-checked={!current} className={`filter-option${!current ? ' selected' : ''}`} onClick={() => onChange(undefined)}>
          <FilterThumb sample={sample} filterId={null} />
          <span>{t('filters.original')}</span>
        </button>
        {FILTERS.filter((f) => f.family === family).map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={current?.id === f.id}
            className={`filter-option${current?.id === f.id ? ' selected' : ''}`}
            onClick={() => onChange({ id: f.id, intensity: value?.intensity ?? 1 })}
          >
            <FilterThumb sample={sample} filterId={f.id} />
            <span>{f.label[L]}</span>
          </button>
        ))}
      </div>
      {current && (
        <label className="slider">
          <span className="slider-label">{t('filters.intensity')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((value?.intensity ?? 1) * 100)}
            onChange={(e) => onChange({ id: current.id, intensity: Number(e.target.value) / 100 })}
          />
          <span className="slider-value">{Math.round((value?.intensity ?? 1) * 100)}</span>
        </label>
      )}
    </div>
  )
}

const ICONS: Record<AdjustKey | 'auto', string> = {
  auto: 'M5 19 15 9M14 4v2M19 9h2M17.5 6.5l1.5-1.5M12 3l.5 1.5M20 12l-1.5.5',
  exposure: 'M12 3v2M12 19v2M3 12h2M19 12h2M12 7a5 5 0 1 0 0 10z',
  brightness: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  contrast: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  highlights: 'M4 16h16M7 12h10M10 8h4',
  shadows: 'M4 8h16M7 12h10M10 16h4',
  warmth: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z',
  tint: 'M12 3l6 9a6 6 0 1 1-12 0z',
  saturation: 'M12 2.7 6 9a8 8 0 1 0 12 0z',
  vibrance: 'M12 2l2.4 6.6L21 9l-5 4.6L17.5 21 12 17.2 6.5 21 8 13.6 3 9l6.6-.4z',
  sharpness: 'M3 12h4l3-8 4 16 3-8h4',
  vignette: 'M3 5h18v14H3zM8 12a4 3 0 1 0 8 0 4 3 0 0 0-8 0',
}

interface AdjustProps {
  value: Partial<Adjustments> | undefined
  onChange: (v: Partial<Adjustments> | undefined) => void
  onAuto: () => void
  /** Choix de la portée : seulement quand une photo est sélectionnée. */
  scope?: { value: 'collage' | 'photo'; onChange: (s: 'collage' | 'photo') => void }
}

export function AdjustPanel({ value, onChange, onAuto, scope }: AdjustProps) {
  const { t } = useI18n()
  const [tool, setTool] = useState<AdjustKey>('brightness')
  const a = combine(value)
  const positive = POSITIVE_ONLY.has(tool)
  const v = Math.round(a[tool] * 100)

  function set(k: AdjustKey, n: number) {
    const next: Partial<Adjustments> = { ...value, [k]: n / 100 }
    if (!n) delete next[k]
    onChange(Object.keys(next).length ? next : undefined)
  }

  return (
    <div className="adjust">
      <div className="adjust-head">
        {scope ? (
          <div className="segmented segmented-small" role="group" aria-label={t('adjust.scope')}>
            {(['collage', 'photo'] as const).map((s) => (
              <button key={s} type="button" className={scope.value === s ? 'active' : ''} aria-pressed={scope.value === s} onClick={() => scope.onChange(s)}>
                {t(s === 'collage' ? 'adjust.scopeCollage' : 'adjust.scopePhoto')}
              </button>
            ))}
          </div>
        ) : (
          <span className="panel-note">{t('adjust.photoHint')}</span>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={() => onChange(undefined)} disabled={!value}>
          {t('adjust.reset')}
        </button>
      </div>
      <label className="slider slider-centered">
        <span className="slider-label">{t(`adjust.${tool}`)}</span>
        <input type="range" min={positive ? 0 : -100} max={100} step={1} value={v} onChange={(e) => set(tool, Number(e.target.value))} aria-label={t(`adjust.${tool}`)} />
        <span className="slider-value">{v > 0 && !positive ? `+${v}` : v}</span>
      </label>
      <div className="adjust-tools" role="toolbar">
        <button type="button" className="adjust-tool" onClick={onAuto}>
          <ToolIcon d={ICONS.auto} />
          <span>{t('adjust.auto')}</span>
        </button>
        {ADJUST_KEYS.map((k) => (
          <button key={k} type="button" className={`adjust-tool${tool === k ? ' active' : ''}${a[k] ? ' changed' : ''}`} aria-pressed={tool === k} onClick={() => setTool(k)}>
            <ToolIcon d={ICONS[k]} />
            <span>{t(`adjust.${k}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ToolIcon({ d }: { d: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
