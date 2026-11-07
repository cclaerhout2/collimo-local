/**
 * Raccourcis vers les emplacements et dossiers récents : ajout, retrait, historique, et reprise
 * des réglages de l'ancien format (un seul emplacement).
 */
import type { FolderPath, FolderRef, Shortcut, UserSettings } from '../google/types'

/** Nombre de dossiers récents gardés. */
export const MAX_RECENTS = 5

/** Identifiant de la racine de Mon Drive dans l'API Drive. */
export const MY_DRIVE_ROOT = 'root'

/**
 * Dossier affiché d'un chemin.
 * @param fp - chemin du dossier ouvert
 * @returns le dernier dossier du chemin
 */
export function currentFolder(fp: FolderPath): FolderRef {
  return fp.path[fp.path.length - 1]
}

/**
 * Nom à afficher pour un dossier : la racine de Mon Drive prend le libellé traduit.
 * @param folder - dossier
 * @param myDriveLabel - libellé de Mon Drive dans la langue choisie
 * @returns le nom du dossier
 */
export function folderLabel(folder: FolderRef, myDriveLabel: string): string {
  return folder.id === MY_DRIVE_ROOT ? myDriveLabel : folder.name
}

/**
 * Ajoute un raccourci à la fin de la liste, sauf s'il y est déjà (même dossier).
 * @param shortcuts - raccourcis actuels
 * @param shortcut - raccourci à ajouter
 * @returns la nouvelle liste
 */
export function addShortcut(shortcuts: Shortcut[], shortcut: Shortcut): Shortcut[] {
  return shortcuts.some((s) => s.folder.id === shortcut.folder.id) ? shortcuts : [...shortcuts, shortcut]
}

/**
 * Retire un raccourci de la liste (le dossier lui-même n'est pas touché).
 * @param shortcuts - raccourcis actuels
 * @param folderId - dossier du raccourci à retirer
 * @returns la nouvelle liste
 */
export function removeShortcut(shortcuts: Shortcut[], folderId: string): Shortcut[] {
  return shortcuts.filter((s) => s.folder.id !== folderId)
}

/**
 * Indique si un dossier a déjà son raccourci.
 * @param shortcuts - raccourcis actuels
 * @param folderId - dossier
 * @returns `true` si un raccourci pointe vers ce dossier
 */
export function isPinned(shortcuts: Shortcut[], folderId: string): boolean {
  return shortcuts.some((s) => s.folder.id === folderId)
}

/**
 * Place un dossier en tête des récents, sans doublon, dans la limite de `MAX_RECENTS`.
 * @param recents - dossiers récents actuels
 * @param fp - dossier qui vient d'être ouvert
 * @returns la nouvelle liste
 */
export function pushRecent(recents: FolderPath[], fp: FolderPath): FolderPath[] {
  const id = currentFolder(fp).id
  return [fp, ...recents.filter((r) => currentFolder(r).id !== id)].slice(0, MAX_RECENTS)
}

/**
 * Reprend les réglages de l'ancien format : l'emplacement unique devient le premier raccourci
 * et le dossier ouvert. Les réglages déjà au nouveau format sont rendus tels quels (listes vides au besoin).
 * @param saved - réglages lus sur Drive
 * @returns les réglages au nouveau format, sans `location`
 */
export function migrateSettings(saved: UserSettings): UserSettings {
  const { location, ...rest } = saved
  const shortcuts = rest.shortcuts ?? []
  const recents = (rest.recents ?? []).filter((r) => r.path.length > 0)
  let current = rest.current && rest.current.path.length > 0 ? rest.current : undefined
  if (!rest.shortcuts && location) {
    const folder = { id: location.folder.id, name: location.folder.name }
    return {
      ...rest,
      shortcuts: [{ drive: location.drive, folder }],
      current: current ?? { drive: location.drive, path: [folder] },
      recents,
    }
  }
  return { ...rest, shortcuts, current, recents }
}
