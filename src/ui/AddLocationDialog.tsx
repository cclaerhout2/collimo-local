/**
 * Fenêtre d'ajout d'un emplacement : Mon Drive et les Drive partagés, chacun à ajouter en entier
 * ou par un dossier précis choisi avec le sélecteur de Google. Dans les applications locales
 * (ordinateur, Android), un seul choix : un dossier de l'appareil, par le sélecteur du système.
 */
import { useEffect, useState } from 'react'
import type { DriveRef, Services, Shortcut } from '../google/types'
import { useI18n } from '../i18n'
import { toUiError, type UiError } from '../lib/errors'
import { isPinned, MY_DRIVE_ROOT } from '../lib/locations'
import { ErrorBanner } from './ErrorBanner'
import { FolderIcon } from './icons'

/** Propriétés de la fenêtre d'ajout. */
interface Props {
  /** Services Google (Drive et sélecteur Picker). */
  services: Services
  /** Raccourcis déjà présents, pour signaler un Drive déjà ajouté. */
  shortcuts: Shortcut[]
  /** Ajoute le raccourci choisi et l'ouvre ; l'app ferme alors la fenêtre. */
  onAdd: (shortcut: Shortcut) => void
  /** Ferme la fenêtre. */
  onClose: () => void
}

/**
 * Fenêtre d'ajout d'un emplacement.
 * @returns la fenêtre
 */
export function AddLocationDialog({ services, shortcuts, onAdd, onClose }: Props) {
  const { t, lang } = useI18n()
  const myDrive: DriveRef = { id: null, name: t('setup.myDrive') }
  const [sharedDrives, setSharedDrives] = useState<DriveRef[] | null>(null)
  const [problem, setProblem] = useState<UiError | null>(null)
  const [busy, setBusy] = useState(false)

  const local = services.kind === 'desktop'

  useEffect(() => {
    if (local) return
    let alive = true
    services.drive
      .listSharedDrives()
      .then((d) => alive && setSharedDrives(d))
      .catch((e: unknown) => {
        if (!alive) return
        setSharedDrives([])
        setProblem(toUiError(e))
      })
    return () => {
      alive = false
    }
  }, [services, local])

  useEffect(() => {
    /**
     * Ferme la fenêtre avec Échap.
     * @param e - touche pressée
     */
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  /**
   * Identifiant du dossier racine d'un Drive.
   * @param drive - Drive
   * @returns `root` pour Mon Drive, sinon l'identifiant du Drive partagé
   */
  const rootOf = (drive: DriveRef) => drive.id ?? MY_DRIVE_ROOT

  /**
   * Ajoute un Drive entier.
   * @param drive - Drive choisi
   */
  function addWhole(drive: DriveRef) {
    setProblem(null)
    onAdd({ drive, folder: { id: rootOf(drive), name: drive.name } })
  }

  /**
   * Ouvre le sélecteur de Google sur un Drive, puis ajoute le dossier choisi s'il est bien dans ce Drive.
   * @param drive - Drive où choisir le dossier
   */
  async function addFolder(drive: DriveRef) {
    setProblem(null)
    try {
      const picked = await services.picker.pickFolder(drive, lang, t('add.pickerTitle'))
      if (!picked) return
      setBusy(true)
      const info = await services.drive.getFolder(picked.id)
      if ((info.driveId ?? null) !== drive.id) {
        setProblem({ key: 'add.wrongDrive', vars: { drive: drive.name } })
        return
      }
      onAdd({ drive, folder: { id: info.id, name: info.name } })
    } catch (e) {
      setProblem(toUiError(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Ligne d'un Drive, avec ses deux façons de l'ajouter.
   * @param drive - Drive proposé
   * @param kind - icône : Drive personnel ou partagé
   * @returns la ligne
   */
  function row(drive: DriveRef, kind: 'my' | 'shared') {
    const whole = isPinned(shortcuts, rootOf(drive))
    return (
      <li key={drive.id ?? MY_DRIVE_ROOT} className="add-row">
        <span className="add-name">
          <FolderIcon kind={kind} />
          {drive.name}
        </span>
        <span className="add-actions">
          <button type="button" className="btn btn-small" disabled={whole || busy} onClick={() => addWhole(drive)}>
            {whole ? t('add.added') : t('add.wholeDrive')}
          </button>
          <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => void addFolder(drive)}>
            {t('add.folder')}
          </button>
        </span>
      </li>
    )
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="add-title">{t('add.title')}</h2>
        <p className="muted">{t('add.text')}</p>
        {local ? (
          <div className="add-local">
            <button type="button" className="btn btn-large" disabled={busy} onClick={() => void addFolder(myDrive)}>
              <FolderIcon />
              {t('add.folder')}
            </button>
          </div>
        ) : (
          <ul className="add-list">
            {row(myDrive, 'my')}
            <li className="drive-group">{t('setup.sharedDrives')}</li>
            {sharedDrives === null && <li className="muted">{t('setup.loadingDrives')}</li>}
            {sharedDrives?.length === 0 && <li className="muted">{t('setup.noSharedDrives')}</li>}
            {sharedDrives?.map((d) => row(d, 'shared'))}
          </ul>
        )}
        {problem && <ErrorBanner error={problem} />}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onClose} disabled={busy}>
            {t('add.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
