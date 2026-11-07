/**
 * Panneau des emplacements : raccourcis de l'utilisateur (à ouvrir, à retirer), bouton d'ajout et
 * dossiers récents. Colonne à gauche sur grand écran, barre défilante en haut sur mobile.
 */
import type { FolderPath, Shortcut } from '../google/types'
import { useI18n } from '../i18n'
import { currentFolder, folderLabel } from '../lib/locations'
import { FolderIcon } from './icons'

/** Propriétés du panneau des emplacements. */
interface Props {
  /** Raccourcis de l'utilisateur. */
  shortcuts: Shortcut[]
  /** Derniers dossiers ouverts. */
  recents: FolderPath[]
  /** Dossier ouvert, s'il y en a un : son raccourci et lui-même sont mis en évidence. */
  open: FolderPath | null
  /** Ouvre un dossier (départ d'un raccourci ou dossier récent). */
  onOpen: (fp: FolderPath) => void
  /** Retire un raccourci de la liste. */
  onRemove: (folderId: string) => void
  /** Ouvre la fenêtre d'ajout d'un emplacement. */
  onAdd: () => void
}

/**
 * Liste des raccourcis et des dossiers récents.
 * @returns le panneau
 */
export function LocationsPanel({ shortcuts, recents, open, onOpen, onRemove, onAdd }: Props) {
  const { t } = useI18n()
  const myDrive = t('setup.myDrive')
  const rootId = open?.path[0]?.id
  const openId = open ? currentFolder(open).id : undefined
  const otherRecents = recents.filter((r) => currentFolder(r).id !== openId)

  return (
    <nav className="locations" aria-label={t('locations.title')}>
      <p className="locations-title">{t('locations.title')}</p>
      <ul className="locations-list">
        {shortcuts.map((s) => {
          const name = folderLabel(s.folder, myDrive)
          const active = s.folder.id === rootId
          return (
            <li key={s.folder.id} className={`location${active ? ' active' : ''}`}>
              <button
                type="button"
                className="location-open"
                aria-current={active ? 'location' : undefined}
                title={s.drive.id && s.folder.id !== s.drive.id ? `${s.drive.name} › ${name}` : name}
                onClick={() => onOpen({ drive: s.drive, path: [s.folder] })}
              >
                <FolderIcon kind={s.folder.id === 'root' ? 'my' : s.folder.id === s.drive.id ? 'shared' : 'folder'} />
                <span className="location-name">{name}</span>
              </button>
              <button
                type="button"
                className="location-remove"
                aria-label={t('locations.remove', { name })}
                title={t('locations.remove', { name })}
                onClick={() => onRemove(s.folder.id)}
              >
                ×
              </button>
            </li>
          )
        })}
        <li>
          <button type="button" className="location-add" onClick={onAdd}>
            <span aria-hidden="true">+</span> {t('locations.add')}
          </button>
        </li>
      </ul>

      {otherRecents.length > 0 && (
        <>
          <p className="locations-title locations-recents">{t('locations.recents')}</p>
          <ul className="locations-list">
            {otherRecents.map((r) => {
              const f = currentFolder(r)
              return (
                <li key={f.id} className="location recent">
                  <button
                    type="button"
                    className="location-open"
                    title={r.path.map((p) => folderLabel(p, myDrive)).join(' › ')}
                    onClick={() => onOpen(r)}
                  >
                    <FolderIcon kind="recent" />
                    <span className="location-name">{folderLabel(f, myDrive)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </nav>
  )
}
