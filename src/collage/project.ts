/**
 * Fichier projet d'un collage (JSON enregistré à côté de l'image exportée) : écriture, et relecture
 * prudente qui valide et borne chaque valeur.
 */
import { layoutById } from './catalog'
import { splitToRects } from './layoutDsl'
import { RATIOS } from './ratios'
import { filterById } from './color'
import { DEFAULT_EFFECTS } from './overlays'
import {
  ADJUST_KEYS,
  DEFAULT_CROP,
  POSITIVE_ONLY,
  type Adjustments,
  type CollageDoc,
  type Overlay,
  type PlacedPhoto,
  type TextEffects,
} from './types'

/** Extension des fichiers projet, rangés à côté des images exportées dans le dossier Collimo. */
export const PROJECT_SUFFIX = '.collimo.json'

/** Contenu d'un fichier projet (JSON) : le collage et de quoi le reconnaître. */
export interface ProjectFile {
  /** Marque du fichier, pour reconnaître un projet Collimo. */
  app: 'collimo'
  /** Version du format de fichier. */
  version: 1
  /** Date de l'enregistrement, au format ISO 8601. */
  savedAt: string
  doc: CollageDoc
}

/**
 * Écrit le fichier projet d'un collage.
 * @param doc - collage
 * @param savedAt - date de l'enregistrement
 * @returns le JSON, indenté pour rester lisible
 */
export function serializeProject(doc: CollageDoc, savedAt: Date): string {
  const file: ProjectFile = { app: 'collimo', version: 1, savedAt: savedAt.toISOString(), doc }
  return JSON.stringify(file, null, 2)
}

/** Erreur levée quand un fichier projet n'est pas un projet Collimo valide. */
export class ProjectFormatError extends Error {}

/**
 * Nombre relu, ramené dans ses limites.
 * @param v - valeur lue dans le fichier
 * @param fallback - valeur à prendre si `v` n'est pas un nombre fini
 * @param min - limite basse
 * @param max - limite haute
 * @returns le nombre borné, ou `fallback`
 */
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

/**
 * Relit un fichier projet en le validant : un fichier abîmé ou modifié à la main ne doit pas
 * faire planter l'app. Les valeurs hors limites sont ramenées dans les limites, les valeurs inconnues
 * remplacées par des valeurs par défaut.
 * @param raw - contenu du fichier, déjà lu comme JSON
 * @returns le collage relu ; `layoutId` est vide si la disposition n'existe plus ou n'a pas le bon nombre de cases
 * @throws {@link ProjectFormatError} si ce n'est pas un projet Collimo, s'il n'a aucune photo ou si une photo est invalide
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
      adjust: parseAdjust((p as { adjust?: unknown }).adjust),
    }
  })
  const layout = typeof d.layoutId === 'string' ? layoutById(d.layoutId) : undefined
  const b = (d.borders ?? {}) as Partial<CollageDoc['borders']>
  let split: string | undefined
  if (layout?.split && typeof d.split === 'string') {
    try {
      if (splitToRects(d.split).length === photos.length) split = d.split
    } catch {
      /* découpe ajustée illisible : ignorée */
    }
  }
  return {
    version: 1,
    ratio: RATIOS.some((r) => r.id === d.ratio) ? (d.ratio as string) : '1:1',
    // Disposition retirée du catalogue ou ne correspondant plus : l'éditeur en choisira une autre.
    layoutId: layout && layout.photos === photos.length ? layout.id : '',
    photos,
    borders: {
      spacing: num(b.spacing, 0, 0, 1),
      margin: num(b.margin, 0, 0, 1),
      radius: num(b.radius, 0, 0, 1),
      ...(num(b.outline, 0, 0, 1) ? { outline: num(b.outline, 0, 0, 1), outlineColor: color(b.outlineColor, '#ffffff') } : {}),
    },
    background: typeof d.background === 'string' && /^#[0-9a-f]{6}$/i.test(d.background) ? d.background : '#ffffff',
    split,
    overlays: parseOverlays(d.overlays),
    adjust: parseAdjust(d.adjust),
    filter:
      d.filter && typeof d.filter === 'object' && filterById((d.filter as { id?: string }).id)
        ? { id: (d.filter as { id: string }).id, intensity: num((d.filter as { intensity?: unknown }).intensity, 1, 0, 1) }
        : undefined,
    createdFrom: typeof d.createdFrom === 'string' ? d.createdFrom : undefined,
  }
}

/**
 * Réglages relus : clés connues seulement, valeurs bornées, valeurs nulles retirées.
 * @param raw - réglages lus dans le fichier
 * @returns les réglages non nuls, ou `undefined` s'il n'y en a aucun
 */
export function parseAdjust(raw: unknown): Partial<Adjustments> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: Partial<Adjustments> = {}
  for (const k of ADJUST_KEYS) {
    const v = num(r[k], 0, POSITIVE_ONLY.has(k) ? 0 : -1, 1)
    if (v) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/** Couleur CSS hexadécimale à six chiffres, seule forme acceptée dans un projet. */
const COLOR = /^#[0-9a-f]{6}$/i
/**
 * Couleur relue.
 * @param v - valeur lue dans le fichier
 * @param fallback - couleur à prendre si `v` n'est pas une couleur `#rrggbb`
 * @returns la couleur
 */
const color = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR.test(v) ? v : fallback)
/**
 * Texte relu.
 * @param v - valeur lue dans le fichier
 * @param fallback - texte à prendre si `v` n'est pas un texte
 * @returns le texte
 */
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
/**
 * Vérifie un SVG gardé dans le projet : il ne doit contenir ni script ni lien externe.
 * @param v - valeur lue dans le fichier
 * @returns le SVG tel quel s'il est sûr, sinon `null` (ou s'il dépasse 200 000 caractères)
 */
export function safeSvg(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim().startsWith('<svg') || v.length > 200_000) return null
  // Seuls les renvois internes (href="#…") sont permis : pas de lien vers l'extérieur.
  if (/<script|<foreignObject|\son\w+\s*=|javascript:|href\s*=\s*(?:["'](?!#)|(?!["'#]))/i.test(v)) return null
  return v
}

/**
 * Effets d'un texte relus, valeurs par défaut pour ce qui manque.
 * @param raw - effets lus dans le fichier
 * @returns les effets complets
 */
function parseEffects(raw: unknown): TextEffects {
  const r = (raw ?? {}) as Record<string, Record<string, unknown> | undefined>
  const d = DEFAULT_EFFECTS
  return {
    stroke: { on: r.stroke?.on === true, color: color(r.stroke?.color, d.stroke.color), width: num(r.stroke?.width, d.stroke.width, 0, 1) },
    shadow: {
      on: r.shadow?.on === true,
      color: color(r.shadow?.color, d.shadow.color),
      blur: num(r.shadow?.blur, d.shadow.blur, 0, 1),
      distance: num(r.shadow?.distance, d.shadow.distance, 0, 1),
    },
    glow: { on: r.glow?.on === true, color: color(r.glow?.color, d.glow.color), blur: num(r.glow?.blur, d.glow.blur, 0, 1) },
    label: {
      on: r.label?.on === true,
      color: color(r.label?.color, d.label.color),
      padding: num(r.label?.padding, d.label.padding, 0, 1),
      radius: num(r.label?.radius, d.label.radius, 0, 1),
    },
  }
}

/**
 * Textes et stickers relus : les éléments abîmés sont ignorés, les autres ramenés dans les limites.
 * @param raw - liste lue dans le fichier
 * @returns les éléments valides (200 au plus), dans leur ordre
 */
export function parseOverlays(raw: unknown): Overlay[] {
  if (!Array.isArray(raw)) return []
  const out: Overlay[] = []
  for (const r of raw.slice(0, 200) as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue
    const base = {
      id: str(r.id) || `o${out.length}`,
      cx: num(r.cx, 0.5, -0.5, 1.5),
      cy: num(r.cy, 0.5, -0.5, 1.5),
      angle: num(r.angle, 0, -360, 360),
      opacity: num(r.opacity, 1, 0, 1),
    }
    if (r.type === 'text') {
      const f = (r.font ?? {}) as Record<string, unknown>
      out.push({
        ...base,
        type: 'text',
        text: str(r.text).slice(0, 2000),
        font: { family: str(f.family, 'Montserrat').slice(0, 80), weight: num(f.weight, 700, 100, 900), italic: f.italic === true },
        size: num(r.size, 0.1, 0.01, 1),
        width: num(r.width, 0.8, 0.05, 1.5),
        align: r.align === 'left' || r.align === 'right' ? r.align : 'center',
        color: color(r.color, '#ffffff'),
        effects: parseEffects(r.effects),
      })
    } else if (r.type === 'icon') {
      const svg = safeSvg(r.svg)
      if (!svg) continue
      out.push({
        ...base,
        type: 'icon',
        set: r.set === 'fluent' ? 'fluent' : 'ph',
        name: str(r.name),
        svg,
        color: typeof r.color === 'string' && COLOR.test(r.color) ? r.color : undefined,
        size: num(r.size, 0.25, 0.01, 2),
      })
    } else if (r.type === 'image' && typeof r.fileId === 'string') {
      out.push({
        ...base,
        type: 'image',
        fileId: r.fileId,
        name: str(r.name, r.fileId),
        mimeType: str(r.mimeType, 'image/png'),
        size: num(r.size, 0.35, 0.01, 2),
        aspect: num(r.aspect, 1, 0.05, 20),
      })
    }
  }
  return out
}

/**
 * Nom d'un fichier projet sans son extension.
 * @param fileName - nom du fichier
 * @returns le nom sans {@link PROJECT_SUFFIX}, ou le nom tel quel s'il ne la porte pas
 * @example
 * projectBaseName('Collimo_2026-11-06_23-07-12.collimo.json') // 'Collimo_2026-11-06_23-07-12'
 */
export function projectBaseName(fileName: string): string {
  return fileName.endsWith(PROJECT_SUFFIX) ? fileName.slice(0, -PROJECT_SUFFIX.length) : fileName
}
