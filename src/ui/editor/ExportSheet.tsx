/** Feuille d'export : choix du format, de la taille et de la qualité, puis enregistrement du collage dans Drive. */
import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_JPEG_QUALITY,
  exportSize,
  IOS_MAX_SIDE,
  isAppleMobile,
  type ExportFormat,
  type ExportImage,
  type ExportPreset,
} from '../../collage/export'
import { saveCollage, type SavedCollage } from '../../collage/save'
import type { CollageDoc, Layout, Overlay, TextOverlay } from '../../collage/types'
import type { DriveService } from '../../google/types'
import { useI18n } from '../../i18n'
import { toUiError, type UiError } from '../../lib/errors'
import { ErrorBanner } from '../ErrorBanner'

/** Propriétés de {@link ExportSheet}. */
interface Props {
  /** Accès à Google Drive, pour l'envoi. */
  drive: DriveService
  /** Dossier Collimo de l'utilisateur, où le collage est enregistré. */
  collimoFolderId: string
  /** Collage à exporter. */
  doc: CollageDoc
  /** Disposition résolue du collage. */
  layout: Layout
  /** Proportions du collage (largeur / hauteur). */
  ratio: number
  /** Charge la photo d'une case avec un plus grand côté d'au moins `maxSide` pixels. */
  loadForCell: (cellIndex: number, maxSide: number) => Promise<ExportImage>
  /** Charge l'image d'un sticker à la taille finale (`maxSide` en pixels). */
  loadOverlay?: (o: Exclude<Overlay, TextOverlay>, maxSide: number) => Promise<ExportImage>
  /** Attend que la police d'un texte soit prête avant de le dessiner. */
  prepareText?: (o: TextOverlay) => Promise<void>
  /** Ferme la feuille. */
  onClose: () => void
  /** Appelé une fois le collage enregistré dans Drive. */
  onSaved: (saved: SavedCollage) => void
  /** Relance la connexion Google quand une erreur l'exige. */
  onReconnect: () => void
}

/** Étape de l'export : réglages, dessin (photos traitées / total), envoi, puis terminé avec l'aperçu du fichier. */
type Status =
  | { name: 'idle' }
  | { name: 'rendering'; done: number; total: number }
  | { name: 'uploading' }
  | { name: 'done'; saved: SavedCollage; url: string }

/**
 * Feuille d'export du collage.
 *
 * Les tailles proposées sont en pixels du fichier final ; sur iPhone et iPad, elles sont plafonnées
 * pour rester sous la limite de mémoire des Canvas de Safari.
 * @returns la boîte de dialogue des réglages d'export, puis l'aperçu et les liens du collage enregistré
 */
export function ExportSheet({
  drive,
  collimoFolderId,
  doc,
  layout,
  ratio,
  loadForCell,
  loadOverlay,
  prepareText,
  onClose,
  onSaved,
  onReconnect,
}: Props) {
  const { t } = useI18n()
  const apple = useMemo(() => isAppleMobile(), [])
  const [format, setFormat] = useState<ExportFormat>('jpeg')
  const [preset, setPreset] = useState<ExportPreset>('hd')
  const [quality, setQuality] = useState(DEFAULT_JPEG_QUALITY)
  const [status, setStatus] = useState<Status>({ name: 'idle' })
  const [error, setError] = useState<UiError | null>(null)

  const sizes = {
    standard: exportSize('standard', ratio, doc, layout, apple),
    hd: exportSize('hd', ratio, doc, layout, apple),
    max: exportSize('max', ratio, doc, layout, apple),
  }
  const size = sizes[preset]
  const busy = status.name === 'rendering' || status.name === 'uploading'
  const doneUrl = status.name === 'done' ? status.url : null

  useEffect(
    () => () => {
      if (doneUrl) URL.revokeObjectURL(doneUrl)
    },
    [doneUrl],
  )

  /**
   * Dessine le collage à la taille choisie et l'enregistre dans Drive, en affichant la progression.
   * @returns une promesse résolue une fois l'enregistrement fini ou l'erreur affichée
   */
  async function save() {
    setError(null)
    try {
      const saved = await saveCollage({
        drive,
        collimoFolderId,
        doc,
        layout,
        width: size.width,
        height: size.height,
        format,
        quality,
        loadForCell,
        loadOverlay,
        prepareText,
        onPhase: (phase, done = 0, total = 0) =>
          setStatus(phase === 'rendering' ? { name: 'rendering', done, total } : { name: 'uploading' }),
      })
      setStatus({ name: 'done', saved, url: URL.createObjectURL(saved.blob) })
      onSaved(saved)
    } catch (e) {
      setStatus({ name: 'idle' })
      setError(toUiError(e))
    }
  }

  const folderUrl = `https://drive.google.com/drive/folders/${encodeURIComponent(collimoFolderId)}`

  return (
    <div className="sheet-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="export-title">{t('export.title')}</h2>

        {status.name === 'done' ? (
          <div className="export-done">
            <img src={status.url} alt="" className="export-preview" />
            <p>
              <strong>{t('export.done', { name: status.saved.baseName })}</strong>
            </p>
            <p className="muted">{t('export.doneHint')}</p>
            <div className="actions actions-wrap">
              {status.saved.image.webViewLink && (
                <a className="btn" href={status.saved.image.webViewLink} target="_blank" rel="noreferrer">
                  {t('export.openImage')}
                </a>
              )}
              <a className="btn" href={folderUrl} target="_blank" rel="noreferrer">
                {t('export.openFolder')}
              </a>
              <a className="btn" href={status.url} download={`${status.saved.baseName}.${format === 'png' ? 'png' : 'jpg'}`}>
                {t('export.download')}
              </a>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t('export.close')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <fieldset className="field" disabled={busy}>
              <legend>{t('export.format')}</legend>
              <div className="segmented">
                {(['jpeg', 'png'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={format === f ? 'active' : ''}
                    aria-pressed={format === f}
                    onClick={() => setFormat(f)}
                  >
                    {f === 'jpeg' ? 'JPG' : 'PNG'}
                  </button>
                ))}
              </div>
              {format === 'png' && <p className="muted small">{t('export.pngNote')}</p>}
            </fieldset>

            <fieldset className="field" disabled={busy}>
              <legend>{t('export.size')}</legend>
              <div className="size-options">
                {(['standard', 'hd', 'max'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`size-option${preset === p ? ' selected' : ''}`}
                    aria-pressed={preset === p}
                    onClick={() => setPreset(p)}
                  >
                    <strong>{t(`export.${p}`)}</strong>
                    <span>{t('export.pixels', { width: sizes[p].width, height: sizes[p].height })}</span>
                  </button>
                ))}
              </div>
              {size.cappedForIos && <p className="muted small">{t('export.iosCap', { side: IOS_MAX_SIDE })}</p>}
            </fieldset>

            {format === 'jpeg' && (
              <fieldset className="field" disabled={busy}>
                <legend>{t('export.quality')}</legend>
                <label className="slider">
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={1}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    aria-label={t('export.quality')}
                  />
                  <span className="slider-value">{quality}</span>
                </label>
              </fieldset>
            )}

            {status.name === 'rendering' && <p className="progress">{t('export.rendering', { done: status.done, total: status.total })}</p>}
            {status.name === 'uploading' && <p className="progress">{t('export.uploading')}</p>}
            {error && <ErrorBanner error={error} onReconnect={onReconnect} />}

            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                {t('export.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                {t('export.save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
