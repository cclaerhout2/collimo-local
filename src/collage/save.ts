/**
 * Enregistrement d'un collage sur Google Drive : image exportée et fichier projet, sous un nom daté unique.
 */
import type { DriveFileInfo, DriveService } from '../google/types'
import { collageStamp, uniqueCollageBaseName } from '../lib/naming'
import { exportCollage, type ExportFormat, type ExportImage } from './export'
import { PROJECT_SUFFIX, serializeProject } from './project'
import type { CollageDoc, Layout, Overlay, TextOverlay } from './types'

/** Résultat de l'enregistrement d'un collage. */
export interface SavedCollage {
  /** Nom commun des deux fichiers, sans extension. */
  baseName: string
  /** Fichier image créé sur Drive. */
  image: DriveFileInfo
  /** Fichier projet créé sur Drive. */
  project: DriveFileInfo
  /** Contenu de l'image exportée. */
  blob: Blob
}

/**
 * Enregistre un NOUVEAU collage dans le dossier Collimo : l'image exportée et son fichier projet,
 * sous un même nom daté jamais déjà pris. Rien n'est écrasé.
 * @param args - service Drive et dossier de destination, puis les mêmes paramètres que {@link exportCollage}
 * @returns le nom commun, les deux fichiers créés et le contenu de l'image
 */
export async function saveCollage(args: {
  drive: DriveService
  /** Identifiant Drive du dossier Collimo. */
  collimoFolderId: string
  doc: CollageDoc
  layout: Layout
  width: number
  height: number
  format: ExportFormat
  quality: number
  loadForCell: (cellIndex: number, maxSide: number) => Promise<ExportImage>
  loadOverlay?: (o: Exclude<Overlay, TextOverlay>, maxSide: number) => Promise<ExportImage>
  prepareText?: (o: TextOverlay) => Promise<void>
  /** Avancement : rendu (avec nombre d'éléments dessinés sur le total), puis envoi. */
  onPhase?: (phase: 'rendering' | 'uploading', done?: number, total?: number) => void
  /** Date de l'enregistrement, qui donne le nom des fichiers (maintenant par défaut ; fixée dans les tests). */
  now?: Date
}): Promise<SavedCollage> {
  const now = args.now ?? new Date()
  // Seuls les fichiers de la même seconde comptent pour le suffixe : inutile de lister tout le dossier.
  const existing = await args.drive.listFolderFiles(args.collimoFolderId, collageStamp(now))
  const baseName = uniqueCollageBaseName(
    now,
    existing.map((f) => f.name),
  )

  args.onPhase?.('rendering', 0, args.doc.photos.length + (args.doc.overlays?.length ?? 0))
  const blob = await exportCollage({
    doc: args.doc,
    layout: args.layout,
    width: args.width,
    height: args.height,
    format: args.format,
    quality: args.quality,
    loadForCell: args.loadForCell,
    loadOverlay: args.loadOverlay,
    prepareText: args.prepareText,
    onProgress: (done, total) => args.onPhase?.('rendering', done, total),
  })

  args.onPhase?.('uploading')
  const ext = args.format === 'png' ? 'png' : 'jpg'
  const mime = args.format === 'png' ? 'image/png' : 'image/jpeg'
  const image = await args.drive.uploadFile(args.collimoFolderId, `${baseName}.${ext}`, blob, mime)
  const projectJson = serializeProject(args.doc, now)
  const project = await args.drive.uploadFile(
    args.collimoFolderId,
    `${baseName}${PROJECT_SUFFIX}`,
    new Blob([projectJson], { type: 'application/json' }),
    'application/json',
  )
  return { baseName, image, project, blob }
}
