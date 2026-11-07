import type { DriveFileInfo, DriveService } from '../google/types'
import { collageStamp, uniqueCollageBaseName } from '../lib/naming'
import { exportCollage, type ExportFormat, type ExportImage } from './export'
import { PROJECT_SUFFIX, serializeProject } from './project'
import type { CollageDoc, Layout, Overlay, TextOverlay } from './types'

export interface SavedCollage {
  baseName: string
  image: DriveFileInfo
  project: DriveFileInfo
  blob: Blob
}

/**
 * Enregistre un NOUVEAU collage dans le dossier Collimo : l'image exportée et son fichier projet,
 * sous un même nom daté jamais déjà pris. Rien n'est écrasé.
 */
export async function saveCollage(args: {
  drive: DriveService
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
  onPhase?: (phase: 'rendering' | 'uploading', done?: number, total?: number) => void
  now?: Date
}): Promise<SavedCollage> {
  const now = args.now ?? new Date()
  // Seuls les fichiers de la même seconde comptent pour le suffixe : inutile de lister tout le dossier.
  const existing = await args.drive.listFolderFiles(args.collimoFolderId, collageStamp(now))
  const baseName = uniqueCollageBaseName(now, existing.map((f) => f.name))

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
