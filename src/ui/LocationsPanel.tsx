/**
 * Panneau des emplacements : raccourcis de l'utilisateur (à ouvrir, renommer, réordonner par
 * glisser-déposer ou au clavier, retirer), bouton d'ajout et dossiers récents. Colonne à gauche sur
 * grand écran, barre défilante en haut sur mobile.
 */
import { useRef, useState, type KeyboardEvent } from 'react'
import type { FolderPath, Shortcut } from '../google/types'
import { useI18n } from '../i18n'
import { currentFolder, folderLabel, shortcutLabel } from '../lib/locations'
import { FolderIcon } from './icons'
import { PrivacyNote } from './PrivacyNote'

/** Propriétés du panneau des emplacements. */
interface Props {
  /** Raccourcis de l'utilisateur, dans l'ordre choisi. */
  shortcuts: Shortcut[]
  /** Derniers dossiers ouverts. */
  recents: FolderPath[]
  /** Dossier ouvert, s'il y en a un : son raccourci et lui-même sont mis en évidence. */
  open: FolderPath | null
  /** Ouvre un dossier (départ d'un raccourci ou dossier récent). */
  onOpen: (fp: FolderPath) => void
  /** Retire un raccourci de la liste. */
  onRemove: (folderId: string) => void
  /** Renomme un raccourci ; un nom vide revient au nom du dossier. */
  onRename: (folderId: string, label: string) => void
  /** Déplace un raccourci d'une position à une autre. */
  onMove: (from: number, to: number) => void
  /** Ouvre la fenêtre d'ajout d'un emplacement. */
  onAdd: () => void
}

/**
 * Liste des raccourcis et des dossiers récents.
 * @returns le panneau
 */
export function LocationsPanel({ shortcuts, recents, open, onOpen, onRemove, onRename, onMove, onAdd }: Props) {
  const { t } = useI18n()
  const myDrive = t('setup.myDrive')
  const rootId = open?.path[0]?.id
  const openId = open ? currentFolder(open).id : undefined
  const otherRecents = recents.filter((r) => currentFolder(r).id !== openId)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  /** Saisie annulée par Échap : la perte du focus qui suit ne doit pas enregistrer le nom. */
  const cancelled = useRef(false)

  /**
   * Commence le renommage d'un raccourci.
   * @param s - raccourci à renommer
   */
  function startRename(s: Shortcut) {
    cancelled.current = false
    setEditing({ id: s.folder.id, value: shortcutLabel(s, myDrive) })
  }

  /** Valide le nom en cours de saisie et quitte l'édition (sauf après Échap). */
  function commitRename() {
    if (!editing || cancelled.current) return
    cancelled.current = true
    onRename(editing.id, editing.value)
    setEditing(null)
  }

  /**
   * Raccourcis clavier d'un raccourci : Alt + flèche pour le déplacer, F2 pour le renommer.
   * @param e - touche pressée sur le bouton du raccourci
   * @param index - position du raccourci
   * @param s - raccourci
   */
  function onItemKey(e: KeyboardEvent, index: number, s: Shortcut) {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
      e.preventDefault()
      onMove(index, index - 1)
    } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
      e.preventDefault()
      onMove(index, index + 1)
    } else if (e.key === 'F2') {
      e.preventDefault()
      startRename(s)
    }
  }

  /** Termine un glisser-déposer, qu'il ait abouti ou non. */
  function endDrag() {
    setDragFrom(null)
    setDragOver(null)
  }

  return (
    <nav className="locations" aria-label={t('locations.title')}>
      <p className="locations-title">{t('locations.title')}</p>
      <ul className="locations-list">
        {shortcuts.map((s, index) => {
          const name = shortcutLabel(s, myDrive)
          const folderName = folderLabel(s.folder, myDrive)
          const active = s.folder.id === rootId
          const isEditing = editing?.id === s.folder.id
          const place = s.drive.id && s.folder.id !== s.drive.id ? `${s.drive.name} › ${folderName}` : folderName
          const classes = [
            'location',
            active && 'active',
            dragFrom === index && 'dragging',
            dragOver === index && dragFrom !== index && 'drag-over',
          ]
          return (
            <li
              key={s.folder.id}
              className={classes.filter(Boolean).join(' ')}
              draggable={!isEditing}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', s.folder.id)
                setDragFrom(index)
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOver !== index) setDragOver(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom !== null) onMove(dragFrom, index)
                endDrag()
              }}
              onDragEnd={endDrag}
            >
              {isEditing ? (
                <form
                  className="location-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    commitRename()
                  }}
                >
                  <FolderIcon kind={s.folder.id === 'root' ? 'my' : s.folder.id === s.drive.id ? 'shared' : 'folder'} />
                  <input
                    autoFocus
                    value={editing.value}
                    maxLength={60}
                    placeholder={folderName}
                    aria-label={t('locations.renameLabel', { name })}
                    onChange={(e) => setEditing({ id: s.folder.id, value: e.target.value })}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelled.current = true
                        setEditing(null)
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="location-open"
                    aria-current={active ? 'location' : undefined}
                    title={`${s.label ? `${place}\n` : ''}${t('locations.reorderHint')}`}
                    onClick={() => onOpen({ drive: s.drive, path: [s.folder] })}
                    onDoubleClick={() => startRename(s)}
                    onKeyDown={(e) => onItemKey(e, index, s)}
                  >
                    <FolderIcon kind={s.folder.id === 'root' ? 'my' : s.folder.id === s.drive.id ? 'shared' : 'folder'} />
                    <span className="location-name">{name}</span>
                  </button>
                  <span className="location-tools">
                    <button
                      type="button"
                      className="location-tool"
                      aria-label={t('locations.rename', { name })}
                      title={t('locations.rename', { name })}
                      onClick={() => startRename(s)}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="location-tool"
                      aria-label={t('locations.remove', { name })}
                      title={t('locations.remove', { name })}
                      onClick={() => onRemove(s.folder.id)}
                    >
                      ×
                    </button>
                  </span>
                </>
              )}
            </li>
          )
        })}
        <li>
          <button type="button" className="location-add" onClick={onAdd}>
            <span aria-hidden="true">+</span> {t('locations.add')}
          </button>
        </li>
      </ul>
      {shortcuts.length > 1 && <p className="locations-hint">{t('locations.reorderHint')}</p>}

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

      <PrivacyNote className="privacy-in-panel" />
    </nav>
  )
}

/**
 * Icône de crayon du bouton « Renommer ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function PencilIcon() {
  return (
    <svg className="icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
