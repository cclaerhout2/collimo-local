import { MAX_ZOOM, MIN_ZOOM } from '../../collage/gestures'
import type { Crop } from '../../collage/types'
import { useI18n } from '../../i18n'

export type PhotoAction = 'swap' | 'flip' | 'rotate' | 'crop' | 'adjust' | 'replace' | 'delete'

interface MenuProps {
  canDelete: boolean
  swapPick: boolean
  onAction: (action: PhotoAction) => void
  onDone: () => void
}

/** Menu de la photo sélectionnée, à la place des onglets. */
export function PhotoMenu({ canDelete, swapPick, onAction, onDone }: MenuProps) {
  const { t } = useI18n()
  const items: { id: PhotoAction; icon: string; disabled?: boolean }[] = [
    { id: 'swap', icon: 'M7 7h11l-3-3M17 17H6l3 3' },
    { id: 'flip', icon: 'M12 3v18M9 7 4 12l5 5V7zM15 7l5 5-5 5V7z' },
    { id: 'rotate', icon: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7' },
    { id: 'crop', icon: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14' },
    { id: 'adjust', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4' },
    { id: 'replace', icon: 'M4 7h10M4 7l3-3M4 7l3 3M20 17H10M20 17l-3-3M20 17l-3 3' },
    { id: 'delete', icon: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', disabled: !canDelete },
  ]
  return (
    <div className="photo-menu">
      <p className="panel-note">{swapPick ? t('photo.swapHint') : t('photo.gestures')}</p>
      <div className="photo-actions" role="toolbar" aria-label={t('editor.selectHint')}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`photo-action${it.id === 'swap' && swapPick ? ' active' : ''}${it.id === 'delete' ? ' danger' : ''}`}
            disabled={it.disabled}
            aria-pressed={it.id === 'swap' ? swapPick : undefined}
            onClick={() => onAction(it.id)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={it.icon} />
            </svg>
            <span>{t(`photo.${it.id}`)}</span>
          </button>
        ))}
        <button type="button" className="photo-action done" onClick={onDone}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
          <span>{t('photo.done')}</span>
        </button>
      </div>
    </div>
  )
}

interface CropProps {
  crop: Crop
  onZoom: (zoom: number) => void
  onAngle: (angle: number) => void
  onReset: () => void
  onDone: () => void
}

/** Mode « Recadrer » : réglages précis au curseur, en complément des gestes. */
export function CropPanel({ crop, onZoom, onAngle, onReset, onDone }: CropProps) {
  const { t } = useI18n()
  return (
    <div className="sliders">
      <label className="slider">
        <span className="slider-label">{t('crop.zoom')}</span>
        <input type="range" min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} step={1} value={Math.round(crop.zoom * 100)} onChange={(e) => onZoom(Number(e.target.value) / 100)} />
        <span className="slider-value">×{crop.zoom.toFixed(1)}</span>
      </label>
      <label className="slider">
        <span className="slider-label">{t('crop.angle')}</span>
        <input type="range" min={-180} max={180} step={0.5} value={crop.angle} onChange={(e) => onAngle(Number(e.target.value))} />
        <span className="slider-value">{Math.round(crop.angle)}°</span>
      </label>
      <div className="actions actions-tight">
        <button type="button" className="btn btn-ghost btn-small" onClick={onReset}>
          {t('crop.reset')}
        </button>
        <button type="button" className="btn btn-primary btn-small" onClick={onDone}>
          {t('photo.done')}
        </button>
      </div>
    </div>
  )
}
