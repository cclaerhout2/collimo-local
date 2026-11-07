/**
 * Lecture et écriture du catalogue de l'usine sur le Drive partagé « Collimo – Catalogue ».
 * Les droits Drive font office d'administration : est admin qui peut ajouter des fichiers dans ce
 * Drive partagé (rôle « Gestionnaire de contenu » ou plus) ; tout le domaine peut le lire.
 */
import type { AppConfig } from '../config'
import { CATALOGUE_FILE_NAME, emptyCatalogue, parseCatalogue, type CatalogueData } from '../collage/catalog/custom'
import { DriveApiError } from '../google/drive'
import type { DriveJsonFile, DriveService, SharedDriveInfo } from '../google/types'

export interface CatalogueState {
  drive: SharedDriveInfo
  /** Fichier du catalogue ; null tant qu'aucun admin n'a rien enregistré. */
  file: DriveJsonFile | null
  data: CatalogueData
  /** Peut ouvrir l'usine (droit d'écriture sur le Drive du catalogue). */
  isAdmin: boolean
  /** Dispositions du fichier ignorées car illisibles. */
  rejected: number
}

/** Collimo n'est pas encore autorisé à modifier le fichier (autorisation « drive.file ») : passer par le sélecteur. */
export class CatalogueGrantError extends Error {
  constructor() {
    super('catalogue-grant')
    this.name = 'CatalogueGrantError'
  }
}

/** Le catalogue n'est pas accessible en écriture pour cet utilisateur. */
export class CatalogueReadOnlyError extends Error {}

/** Charge le catalogue ; null si le Drive partagé n'existe pas ou n'est pas visible pour l'utilisateur. */
export async function loadCatalogue(drive: DriveService, config: Pick<AppConfig, 'catalogueDriveId' | 'catalogueDriveName'>): Promise<CatalogueState | null> {
  const shared = await drive.findSharedDrive(config.catalogueDriveId ? { id: config.catalogueDriveId } : { name: config.catalogueDriveName })
  if (!shared) return null
  const file = await drive.findRootFile(shared.id, CATALOGUE_FILE_NAME)
  let data = emptyCatalogue()
  let rejected = 0
  if (file) ({ data, rejected } = parseCatalogue(await drive.readJson(file.id)))
  return { drive: shared, file, data, isAdmin: shared.canAddChildren, rejected }
}

/**
 * Enregistre une modification : relit d'abord le fichier sur Drive (un autre admin a pu publier
 * entre-temps), applique `change` à cette version, puis réécrit. Drive garde les versions précédentes.
 */
export async function saveCatalogue(
  drive: DriveService,
  state: CatalogueState,
  change: (c: CatalogueData) => CatalogueData,
  user: string,
): Promise<CatalogueState> {
  if (!state.isAdmin) throw new CatalogueReadOnlyError()
  const now = new Date().toISOString()
  let file = state.file ?? (await drive.findRootFile(state.drive.id, CATALOGUE_FILE_NAME))
  const latest = file ? parseCatalogue(await drive.readJson(file.id)) : { data: emptyCatalogue(), rejected: 0 }
  const next: CatalogueData = { ...change(latest.data), updatedAt: now, updatedBy: user }
  if (!file) {
    file = await drive.createJsonFile(state.drive.id, CATALOGUE_FILE_NAME, next)
  } else {
    try {
      file = await drive.updateJsonFile(file.id, next)
    } catch (e) {
      if (e instanceof DriveApiError && (e.status === 403 || e.status === 404)) throw new CatalogueGrantError()
      throw e
    }
  }
  return { ...state, file, data: next, rejected: latest.rejected }
}
