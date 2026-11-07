/**
 * Liens vers un dossier : lecture du paramètre `folder` de l'adresse de Collimo (identifiant ou
 * lien Google Drive), et fabrication du lien Collimo et du lien Drive d'un dossier.
 */

/** Nom du paramètre d'adresse qui désigne le dossier à ouvrir. */
export const FOLDER_PARAM = 'folder'

/** Élément Drive désigné par un lien : un dossier, ou un fichier (on ouvrira son dossier). */
export interface LinkTarget {
  id: string
  /** `file` pour un lien de fichier (photo), `folder` sinon. */
  kind: 'folder' | 'file'
}

/** Identifiant Drive : lettres, chiffres, tirets et soulignés, assez long pour ne pas être un mot. */
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/

/**
 * Lit la valeur du paramètre `folder` : un identifiant seul, ou un lien Google Drive
 * (`/drive/folders/ID`, `/drive/u/0/folders/ID`, `/file/d/ID/…`, `open?id=ID`).
 * @param value - valeur du paramètre, telle que dans l'adresse
 * @returns l'élément désigné, ou `null` si la valeur n'en contient pas
 */
export function parseFolderParam(value: string | null | undefined): LinkTarget | null {
  const v = (value ?? '').trim()
  if (!v) return null
  if (DRIVE_ID.test(v)) return { id: v, kind: 'folder' }
  let url: URL
  try {
    url = new URL(v)
  } catch {
    return null
  }
  if (!/(^|\.)google\.com$/i.test(url.hostname)) return null
  const folder = /\/folders\/([A-Za-z0-9_-]+)/.exec(url.pathname)
  if (folder && DRIVE_ID.test(folder[1])) return { id: folder[1], kind: 'folder' }
  const file = /\/(?:file\/)?d\/([A-Za-z0-9_-]+)/.exec(url.pathname)
  if (file && DRIVE_ID.test(file[1])) return { id: file[1], kind: 'file' }
  const id = url.searchParams.get('id')
  if (id && DRIVE_ID.test(id)) return { id, kind: 'folder' }
  return null
}

/**
 * Lien Collimo qui ouvre un dossier.
 * @param base - adresse de l'app (origine et chemin, sans paramètres)
 * @param folderId - identifiant du dossier
 * @returns le lien à partager
 */
export function collimoFolderLink(base: string, folderId: string): string {
  return `${base}?${FOLDER_PARAM}=${encodeURIComponent(folderId)}`
}

/**
 * Lien Google Drive d'un élément : la page Drive propose « Demander l'accès » à qui n'y a pas accès.
 * @param target - élément désigné par le lien
 * @returns l'adresse de la page Drive
 */
export function driveItemLink(target: LinkTarget): string {
  const id = encodeURIComponent(target.id)
  return target.kind === 'file' ? `https://drive.google.com/file/d/${id}/view` : `https://drive.google.com/drive/folders/${id}`
}
