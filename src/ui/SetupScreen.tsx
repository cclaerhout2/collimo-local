import { useEffect, useState } from 'react'
import type { DriveRef, FolderInfo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { toUiError, type UiError } from '../lib/errors'
import { ErrorBanner } from './ErrorBanner'

const MY_DRIVE_KEY = '__my_drive__'

interface Props {
  services: Services
  /** Emplacement actuel, s'il y en a un (permet d'annuler). */
  current?: { drive: DriveRef; folder: { id: string; name: string } }
  onDone: (drive: DriveRef, folder: FolderInfo) => Promise<void>
  onCancel?: () => void
  onError: (e: unknown) => void
}

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

  function chooseDrive(d: DriveRef) {
    setDrive(d)
    setFolder(null)
    setProblem(null)
  }

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

function DriveOption({
  drive,
  selected,
  onSelect,
  icon,
}: {
  drive: DriveRef
  selected: boolean
  onSelect: (d: DriveRef) => void
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

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}
