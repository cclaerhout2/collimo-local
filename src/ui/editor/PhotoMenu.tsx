/** Menu de la photo sélectionnée et panneau de recadrage précis. */
import { MAX_ZOOM, MIN_ZOOM } from '../../collage/gestures'
import type { Crop } from '../../collage/types'
import { useI18n } from '../../i18n'

/** Action proposée par le menu d'une photo. */
export type PhotoAction = 'swap' | 'flip' | 'rotate' | 'crop' | 'adjust' | 'mask' | 'replace' | 'delete'

/** Propriétés de {@link PhotoMenu}. */
interface MenuProps {
  /** Faux s'il ne reste qu'une photo : le collage ne peut pas être vide. */
  canDelete: boolean
  /** Vrai pendant l'échange : l'utilisateur doit toucher la case avec laquelle échanger. */
  swapPick: boolean
  /** Appelé avec l'action choisie. */
  onAction: (action: PhotoAction) => void
  /** Ferme le menu (bouton « OK »). */
  onDone: () => void
}

/**
 * Menu de la photo sélectionnée, à la place des onglets.
 * @returns la consigne des gestes et la barre d'actions
 */
export function PhotoMenu({ canDelete, swapPick, onAction, onDone }: MenuProps) {
  const { t } = useI18n()
  const items: { id: PhotoAction; icon: string; disabled?: boolean }[] = [
    { id: 'swap', icon: 'M7 7h11l-3-3M17 17H6l3 3' },
    { id: 'flip', icon: 'M12 3v18M9 7 4 12l5 5V7zM15 7l5 5-5 5V7z' },
    { id: 'rotate', icon: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7' },
    { id: 'crop', icon: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14' },
    { id: 'adjust', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4' },
    {
      id: 'mask',
      icon: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c5 0 9 4 10 7a13 13 0 0 1-3 4M6.6 6.6A13 13 0 0 0 2 12c1 3 5 7 10 7a10 10 0 0 0 4.4-1',
    },
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
              <path d={it.icon} />
            </svg>
            <span>{t(`photo.${it.id}`)}</span>
          </button>
        ))}
        <button type="button" className="photo-action done" onClick={onDone}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
          <span>{t('photo.done')}</span>
        </button>
      </div>
    </div>
  )
}

/** Propriétés de {@link CropPanel}. */
interface CropProps {
  /** Cadrage courant de la photo. */
  crop: Crop
  /** Nouveau zoom (facteur, 1 = photo qui couvre juste la case). */
  onZoom: (zoom: number) => void
  /** Nouvel angle, en degrés. */
  onAngle: (angle: number) => void
  /** Remet le cadrage par défaut. */
  onReset: () => void
  /** Quitte le mode recadrage. */
  onDone: () => void
}

/**
 * Mode « Recadrer » : réglages précis au curseur, en complément des gestes.
 *
 * Le curseur de zoom travaille en centièmes, pour un pas fin avec un `step` entier.
 * @returns les curseurs de zoom et d'angle, et les boutons « Réinitialiser » et « OK »
 */
export function CropPanel({ crop, onZoom, onAngle, onReset, onDone }: CropProps) {
  const { t } = useI18n()
  return (
    <div className="sliders">
      <label className="slider">
        <span className="slider-label">{t('crop.zoom')}</span>
        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          step={1}
          value={Math.round(crop.zoom * 100)}
          onChange={(e) => onZoom(Number(e.target.value) / 100)}
        />
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
