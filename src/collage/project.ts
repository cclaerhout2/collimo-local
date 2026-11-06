import { layoutById } from './catalog'
import { RATIOS } from './ratios'
import { DEFAULT_CROP, type CollageDoc, type PlacedPhoto } from './types'

/** Extension des fichiers projet, rangés à côté des images exportées dans le dossier Collimo. */
export const PROJECT_SUFFIX = '.collimo.json'

export interface ProjectFile {
  app: 'collimo'
  version: 1
  savedAt: string
  doc: CollageDoc
}

export function serializeProject(doc: CollageDoc, savedAt: Date): string {
  const file: ProjectFile = { app: 'collimo', version: 1, savedAt: savedAt.toISOString(), doc }
  return JSON.stringify(file, null, 2)
}

export class ProjectFormatError extends Error {}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/**
 * Relit un fichier projet en le validant : un fichier abîmé ou modifié à la main ne doit pas
 * faire planter l'app. Les valeurs hors limites sont ramenées dans les limites.
 */
export function parseProject(raw: unknown): CollageDoc {
  const f = raw as Partial<ProjectFile> | null
  if (!f || f.app !== 'collimo' || f.version !== 1 || !f.doc) throw new ProjectFormatError('fichier projet Collimo invalide')
  const d = f.doc as Partial<CollageDoc>
  if (!Array.isArray(d.photos) || d.photos.length === 0) throw new ProjectFormatError('aucune photo')
  const photos: PlacedPhoto[] = d.photos.map((p, i) => {
    if (!p || typeof p.id !== 'string') throw new ProjectFormatError(`photo ${i + 1} invalide`)
    const c = (p.crop ?? {}) as Partial<PlacedPhoto['crop']>
    return {
      id: p.id,
      name: typeof p.name === 'string' ? p.name : p.id,
      mimeType: typeof p.mimeType === 'string' ? p.mimeType : 'image/jpeg',
      width: typeof p.width === 'number' ? p.width : undefined,
      height: typeof p.height === 'number' ? p.height : undefined,
      crop: {
        zoom: num(c.zoom, DEFAULT_CROP.zoom, 1, 8),
        ox: num(c.ox, 0, -1, 1),
        oy: num(c.oy, 0, -1, 1),
        angle: num(c.angle, 0, -360, 360),
        flip: c.flip === true,
      },
    }
  })
  const layout = typeof d.layoutId === 'string' ? layoutById(d.layoutId) : undefined
  const b = (d.borders ?? {}) as Partial<CollageDoc['borders']>
  return {
    version: 1,
    ratio: RATIOS.some((r) => r.id === d.ratio) ? (d.ratio as string) : '1:1',
    // Disposition retirée du catalogue ou ne correspondant plus : l'éditeur en choisira une autre.
    layoutId: layout && layout.photos === photos.length ? layout.id : '',
    photos,
    borders: { spacing: num(b.spacing, 0, 0, 1), margin: num(b.margin, 0, 0, 1), radius: num(b.radius, 0, 0, 1) },
    background: typeof d.background === 'string' && /^#[0-9a-f]{6}$/i.test(d.background) ? d.background : '#ffffff',
    createdFrom: typeof d.createdFrom === 'string' ? d.createdFrom : undefined,
  }
}

/** « Collimo_2026-11-06_23-07-12.collimo.json » → « Collimo_2026-11-06_23-07-12 ». */
export function projectBaseName(fileName: string): string {
  return fileName.endsWith(PROJECT_SUFFIX) ? fileName.slice(0, -PROJECT_SUFFIX.length) : fileName
}
