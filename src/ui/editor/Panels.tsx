/** Panneaux simples de l'éditeur : format, disposition, bordures et couleur de fond. */
import { layoutsFor } from '../../collage/catalog'
import { RATIOS } from '../../collage/ratios'
import type { Borders } from '../../collage/types'
import { useI18n } from '../../i18n'
import { LayoutIcon } from './LayoutIcon'

/**
 * Choix du format du collage ; chaque option montre un rectangle aux bonnes proportions (40 pixels CSS de long).
 * @returns le groupe de boutons radio des formats
 */
export function RatioPanel({
  value,
  onChange,
}: {
  /** Identifiant du format choisi. */
  value: string
  /** Appelé avec l'identifiant du nouveau format. */
  onChange: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="panel-scroll" role="radiogroup" aria-label={t('editor.tab.ratio')}>
      {RATIOS.map((r) => {
        const w = r.value >= 1 ? 40 : 40 * r.value
        const h = r.value >= 1 ? 40 / r.value : 40
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={r.id === value}
            className={`ratio-option${r.id === value ? ' selected' : ''}`}
            onClick={() => onChange(r.id)}
          >
            <span className="ratio-shape" style={{ width: w, height: h }} />
            <span className="ratio-label">{r.label}</span>
            {r.hint && <span className="ratio-hint">{t(r.hint)}</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Choix de la disposition parmi celles prévues pour le nombre de photos.
 * @returns le nombre de dispositions et la grille de leurs vignettes
 */
export function LayoutPanel({
  photoCount,
  value,
  onChange,
}: {
  /** Nombre de photos du collage. */
  photoCount: number
  /** Identifiant de la disposition choisie. */
  value: string
  /** Appelé avec l'identifiant de la nouvelle disposition. */
  onChange: (id: string) => void
}) {
  const { t } = useI18n()
  const layouts = layoutsFor(photoCount)
  return (
    <div>
      <p className="panel-note">{t('editor.layoutCount', { count: layouts.length, photos: photoCount })}</p>
      <div className="layout-grid" role="radiogroup" aria-label={t('editor.tab.layout')}>
        {layouts.map((l) => (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={l.id === value}
            title={l.id}
            className={`layout-option${l.id === value ? ' selected' : ''}`}
            onClick={() => onChange(l.id)}
          >
            <LayoutIcon layout={l} />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Réglage des bordures : espacement, marge, arrondi, et contour des cases en forme.
 *
 * Les curseurs vont de 0 à 100 ; les valeurs sont stockées divisées par 100 (relatives à la taille du collage).
 * L'arrondi est masqué quand toutes les cases ont une forme, puisqu'il ne s'y applique pas.
 * @returns les curseurs et, s'il y a des cases en forme, le contour et sa couleur
 */
export function BordersPanel({
  value,
  onChange,
  shapes = 'none',
}: {
  /** Bordures actuelles. */
  value: Borders
  /** Appelé avec les nouvelles bordures. */
  onChange: (b: Borders) => void
  /** Cases en forme (cœur, cercle…) dans la disposition : aucune, certaines ou toutes. */
  shapes?: 'none' | 'some' | 'all'
}) {
  const { t } = useI18n()
  const sliders: { key: 'spacing' | 'margin' | 'radius'; label: string }[] = [
    { key: 'spacing', label: t('borders.spacing') },
    { key: 'margin', label: t('borders.margin') },
    { key: 'radius', label: t('borders.radius') },
  ]
  const shown = shapes === 'all' ? sliders.filter((s) => s.key !== 'radius') : sliders
  return (
    <div className="sliders">
      {shown.map((s) => (
        <label key={s.key} className="slider">
          <span className="slider-label">{s.label}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(value[s.key] * 100)}
            onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) / 100 })}
          />
          <span className="slider-value">{Math.round(value[s.key] * 100)}</span>
        </label>
      ))}
      {shapes !== 'none' && (
        <>
          <label className="slider">
            <span className="slider-label">{t('borders.outline')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((value.outline ?? 0) * 100)}
              onChange={(e) => onChange({ ...value, outline: Number(e.target.value) / 100 })}
            />
            <span className="slider-value">{Math.round((value.outline ?? 0) * 100)}</span>
          </label>
          {(value.outline ?? 0) > 0 && (
            <div className="outline-colors" role="radiogroup" aria-label={t('borders.outlineColor')}>
              {['#ffffff', '#111111', '#2dd4a7', '#facc15', '#ef4444', '#3b82f6'].map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={(value.outlineColor ?? '#ffffff') === c}
                  aria-label={c}
                  className={`swatch small${(value.outlineColor ?? '#ffffff') === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => onChange({ ...value, outlineColor: c })}
                />
              ))}
            </div>
          )}
          {shapes === 'all' && <p className="panel-note">{t('borders.radiusShapes')}</p>}
        </>
      )}
    </div>
  )
}

/** Couleurs de fond proposées ; toute autre couleur passe par le sélecteur personnalisé. */
const SWATCHES = [
  '#ffffff',
  '#f5f1e8',
  '#e5e5e5',
  '#9ca3af',
  '#3f3f46',
  '#111111',
  '#fde68a',
  '#fecaca',
  '#bfdbfe',
  '#bbf7d0',
  '#ddd6fe',
  '#2dd4a7',
]

/**
 * Choix de la couleur de fond : pastilles prédéfinies et sélecteur de couleur libre.
 * @returns les pastilles et le sélecteur personnalisé (sélectionné si la couleur n'est pas une pastille)
 */
export function BackgroundPanel({
  value,
  onChange,
}: {
  /** Couleur actuelle, au format `#rrggbb`. */
  value: string
  /** Appelé avec la nouvelle couleur. */
  onChange: (color: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="swatches" role="radiogroup" aria-label={t('editor.tab.background')}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={c}
          className={`swatch${c === value ? ' selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <label className={`swatch swatch-custom${SWATCHES.includes(value) ? '' : ' selected'}`} title={t('background.custom')}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('background.custom')} />
      </label>
    </div>
  )
}
