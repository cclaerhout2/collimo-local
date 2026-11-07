/**
 * Choix de l'emplacement de travail : un Drive (personnel ou partagé), puis un dossier de photos
 * où l'utilisateur peut écrire, pour y créer le dossier Collimo.
 */
import { useEffect, useState } from 'react'
import type { DriveRef, FolderInfo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { toUiError, type UiError } from '../lib/errors'
import { ErrorBanner } from './ErrorBanner'

/** Clé qui représente « Mon Drive », dont l'identifiant est `null`, parmi les Drive proposés. */
const MY_DRIVE_KEY = '__my_drive__'

/** Propriétés de l'écran de choix de l'emplacement. */
interface Props {
  /** Services Google (Drive et sélecteur Picker). */
  services: Services
  /** Emplacement actuel, s'il y en a un : son Drive est présélectionné. */
  current?: { drive: DriveRef; folder: { id: string; name: string } }
  /** Enregistre l'emplacement choisi ; en cas d'échec, l'erreur s'affiche dans l'écran. */
  onDone: (drive: DriveRef, folder: FolderInfo) => Promise<void>
  /** Revient à l'écran précédent ; bouton absent quand aucun emplacement n'existe encore. */
  onCancel?: () => void
  /** Signale une erreur à afficher (liste des Drive partagés indisponible, par exemple). */
  onError: (e: unknown) => void
}

/**
 * Écran en deux étapes : choix du Drive, puis choix du dossier avec le sélecteur de Google.
 * @returns l'écran de choix de l'emplacement
 */
export function SetupScreen({ services, current, onDone, onCancel, onError }: Props) {
  const { t, lang } = useI18n()
  const myDrive: DriveRef = { id: null, name: t('setup.myDrive') }
  const [sharedDrives, setSharedDrives] = useState<DriveRef[] | null>(null)
  const [drive, setDrive] = useState<DriveRef>(current?.drive ?? myDrive)
  const [folder, setFolder] = useState<FolderInfo | null>(null)
  const [problem, setProblem] = useState<UiError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    services.drive
      .listSharedDrives()
      .then((d) => alive && setSharedDrives(d))
      .catch((e: unknown) => {
        if (alive) setSharedDrives([])
        onError(e)
      })
    return () => {
      alive = false
    }
  }, [services, onError])

  const driveKey = drive.id ?? MY_DRIVE_KEY
  const driveLabel = drive.id ? drive.name : t('setup.myDrive')

  /**
   * Sélectionne un Drive et oublie le dossier choisi auparavant, qui appartenait à un autre Drive.
   * @param d - Drive choisi
   */
  function chooseDrive(d: DriveRef) {
    setDrive(d)
    setFolder(null)
    setProblem(null)
  }

  /**
   * Ouvre le sélecteur de dossier de Google, puis vérifie le dossier choisi.
   * Le sélecteur permet de naviguer vers un autre Drive que celui choisi à l'étape 1 :
   * on le refuse, tout comme un dossier où l'utilisateur ne peut pas créer le dossier Collimo.
   */
  async function pick() {
    setProblem(null)
    try {
      const picked = await services.picker.pickFolder(drive, lang, t('setup.pickerTitle'))
      if (!picked) return
      setBusy(true)
      const info = await services.drive.getFolder(picked.id)
      if ((info.driveId ?? null) !== drive.id) {
        setFolder(null)
        setProblem({ key: 'setup.wrongDrive', vars: { drive: driveLabel } })
      } else if (!info.canAddChildren) {
        setFolder(null)
        setProblem({ key: 'setup.noWriteAccess', vars: { name: info.name } })
      } else {
        setFolder(info)
      }
    } catch (e) {
      setProblem(toUiError(e))
    } finally {
      setBusy(false)
    }
  }

  /** Valide l'emplacement choisi ; l'écran reste ouvert avec un message si l'enregistrement échoue. */
  async function confirm() {
    if (!folder) return
    setBusy(true)
    try {
      await onDone(drive, folder)
    } catch (e) {
      setProblem(toUiError(e))
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <div className="card setup">
        <h1>{t('setup.title')}</h1>

        <section>
          <h2>{t('setup.step1')}</h2>
          <div className="drive-list" role="radiogroup" aria-label={t('setup.step1')}>
            <DriveOption drive={myDrive} selected={driveKey === MY_DRIVE_KEY} onSelect={chooseDrive} icon="my" />
            <p className="drive-group">{t('setup.sharedDrives')}</p>
            {sharedDrives === null && <p className="muted">{t('setup.loadingDrives')}</p>}
            {sharedDrives?.length === 0 && <p className="muted">{t('setup.noSharedDrives')}</p>}
            {sharedDrives?.map((d) => (
              <DriveOption key={d.id} drive={d} selected={driveKey === d.id} onSelect={chooseDrive} icon="shared" />
            ))}
          </div>
        </section>

        <section>
          <h2>{t('setup.step2')}</h2>
          <p className="muted">{t('setup.pickHint')}</p>
          <button type="button" className="btn" onClick={pick} disabled={busy}>
            <FolderIcon />
            {t('setup.pickFolder')}
          </button>
          {busy && !folder && <p className="muted">{t('setup.checking')}</p>}
          {folder && (
            <div className="selected-folder">
              <p>
                <strong>{t('setup.selected', { name: folder.name })}</strong>
              </p>
              <p className="muted">{t('setup.collimoNote')}</p>
            </div>
          )}
          {problem && <ErrorBanner error={problem} />}
        </section>

        <div className="actions">
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              {t('setup.cancel')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={!folder || busy}>
            {t('setup.confirm')}
          </button>
        </div>
      </div>
    </main>
  )
}

/**
 * Choix d'un Drive, présenté comme un bouton radio.
 * @returns le bouton du Drive
 */
function DriveOption({
  drive,
  selected,
  onSelect,
  icon,
}: {
  /** Drive proposé. */
  drive: DriveRef
  /** Drive actuellement choisi. */
  selected: boolean
  /** Choisit ce Drive. */
  onSelect: (d: DriveRef) => void
  /** Icône : Drive personnel ou partagé. */
  icon: 'my' | 'shared'
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`drive-option${selected ? ' selected' : ''}`}
      onClick={() => onSelect(drive)}
    >
      <span className="drive-icon" aria-hidden="true">
        {icon === 'my' ? '◉' : '◎'}
      </span>
      <span>{drive.name}</span>
    </button>
  )
}

/**
 * Icône de dossier du bouton « Choisir un dossier ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}
