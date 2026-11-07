/**
 * Catalogue de l'usine à dispositions : un fichier JSON sur le Drive partagé « Collimo – Catalogue ».
 * Il ajoute des dispositions créées par les admins et peut masquer des dispositions intégrées.
 * Le fichier vient de Drive : tout est vérifié à la lecture, une disposition invalide est ignorée.
 */
import { parsePath } from '../path'
import { SHAPE_NAMES, type CellDef, type Decor, type EdgeCut, type EdgeKind, type ShapeName } from '../shapes'
import type { LayoutDef, LayoutFamily } from '../types'
import { buildLayout } from './index'

/** Valeur du champ `format` qui identifie un fichier de catalogue. */
export const CATALOGUE_FORMAT = 'collimo-catalogue'
/** Nom du fichier de catalogue sur le Drive partagé. */
export const CATALOGUE_FILE_NAME = 'collimo-catalogue.json'

/** État d'une disposition de l'usine : brouillon (visible dans l'usine seulement), publiée ou masquée. */
export type CustomStatus = 'draft' | 'published' | 'hidden'

/** Disposition créée dans l'usine, avec son état et son historique. */
export interface CustomLayout extends LayoutDef {
  /** Cases libres, en coordonnées du cadre (0–1). */
  geo: CellDef[]
  status: CustomStatus
  /** Place dans la liste de son nombre de photos : en tête ou à la fin. */
  position: 'start' | 'end'
  /** Date de création (ISO 8601). */
  createdAt: string
  /** Adresse e-mail de l'auteur. */
  createdBy: string
  /** Date de dernière modification (ISO 8601). */
  updatedAt: string
  /** Adresse e-mail du dernier auteur. */
  updatedBy: string
}

/** Contenu du fichier de catalogue. */
export interface CatalogueData {
  format: typeof CATALOGUE_FORMAT
  version: 1
  updatedAt?: string
  updatedBy?: string
  layouts: CustomLayout[]
  /** Dispositions intégrées masquées (les collages qui les utilisent restent lisibles). */
  hiddenBuiltins: string[]
}

/** Erreur levée quand le fichier de catalogue, ou une de ses parties, est illisible. */
export class CatalogueFormatError extends Error {}

/** Familles de dispositions reconnues ; une famille inconnue devient « mixte ». */
export const FAMILIES: LayoutFamily[] = [
  'grille',
  'bandes',
  'mixte',
  'fond',
  'incrustation',
  'coupe',
  'ronds',
  'coeurs',
  'geometrie',
  'puzzle',
  'dechire',
  'illustre',
]
/** Sortes de bords découpés acceptées dans une case polygonale. */
export const EDGE_KINDS: EdgeKind[] = ['line', 'curve', 'wave', 'zigzag', 'lightning', 'torn']
const STATUSES: CustomStatus[] = ['draft', 'published', 'hidden']

/**
 * Crée un catalogue vide.
 * @returns un catalogue sans disposition ni disposition masquée
 */
export const emptyCatalogue = (): CatalogueData => ({ format: CATALOGUE_FORMAT, version: 1, layouts: [], hiddenBuiltins: [] })

/**
 * Tire un identifiant aléatoire pour une nouvelle disposition de l'usine.
 * @returns un identifiant « u- » suivi de 10 caractères en base 36 (le préfixe le distingue des « pNN-NN » intégrés)
 */
export function newCustomId(): string {
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('')
  return `u-${r.slice(0, 10)}`
}

/**
 * Indique si une valeur est un objet simple (ni `null`, ni tableau).
 * @param v - valeur lue dans le fichier
 * @returns `true` pour un objet
 */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/**
 * Vérifie un nombre lu dans le fichier.
 * @param v - valeur lue
 * @param lo - minimum accepté (par défaut -0,5 : une case peut déborder du cadre)
 * @param hi - maximum accepté (par défaut 1,5)
 * @returns le nombre
 * @throws {@link CatalogueFormatError} si ce n'est pas un nombre fini compris entre `lo` et `hi`
 */
const num = (v: unknown, lo = -0.5, hi = 1.5): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new CatalogueFormatError('nombre invalide')
  return v
}
/**
 * Lit un texte court du fichier.
 * @param v - valeur lue
 * @param max - longueur maximale
 * @returns le texte, ou une chaîne vide s'il est absent ou trop long
 */
const str = (v: unknown, max = 200): string => (typeof v === 'string' && v.length <= max ? v : '')
/** Caractères permis dans un chemin SVG (commandes et nombres seulement, pour écarter toute injection). */
const PATH_CHARS = /^[MLHVCSQTZmlhvcsqtz0-9.,\s\-e+]*$/

/**
 * Lit la découpe d'un bord de polygone.
 * @param v - valeur lue (`null` ou absente = bord droit)
 * @returns la découpe, ou `null` pour un bord droit
 * @throws {@link CatalogueFormatError} si la découpe est invalide
 */
function parseCut(v: unknown): EdgeCut | null {
  if (v === null || v === undefined) return null
  if (!isObj(v) || !EDGE_KINDS.includes(v.kind as EdgeKind)) throw new CatalogueFormatError('coupe invalide')
  const cut: EdgeCut = { kind: v.kind as EdgeKind }
  if (v.amp !== undefined) cut.amp = num(v.amp, 0, 0.5)
  if (v.n !== undefined) cut.n = Math.round(num(v.n, 1, 20))
  if (v.seed !== undefined) cut.seed = Math.round(num(v.seed, 0, 1e6))
  return cut
}

/**
 * Vérifie un chemin SVG : longueur, caractères permis, puis lecture complète.
 * @param v - valeur lue
 * @returns le chemin, inchangé
 * @throws {@link CatalogueFormatError} si le chemin est invalide
 */
function parsePathString(v: unknown): string {
  if (typeof v !== 'string' || v.length > 20000 || !PATH_CHARS.test(v)) throw new CatalogueFormatError('chemin invalide')
  parsePath(v)
  return v
}

/**
 * Lit et vérifie une case (rectangle, polygone, chemin ou forme de la bibliothèque).
 * @param v - valeur lue
 * @returns la case, sans champ inconnu
 * @throws {@link CatalogueFormatError} si la case est invalide
 */
export function parseCell(v: unknown): CellDef {
  if (!isObj(v)) throw new CatalogueFormatError('case invalide')
  const over = v.over === true ? { over: true } : {}
  switch (v.kind) {
    case 'rect':
      return { kind: 'rect', x: num(v.x), y: num(v.y), w: num(v.w, 0, 2), h: num(v.h, 0, 2), ...over }
    case 'poly': {
      if (!Array.isArray(v.points) || v.points.length < 3 || v.points.length > 200) throw new CatalogueFormatError('polygone invalide')
      const points = v.points.map((p) => {
        if (!Array.isArray(p) || p.length !== 2) throw new CatalogueFormatError('point invalide')
        return [num(p[0]), num(p[1])] as [number, number]
      })
      const cell: CellDef = { kind: 'poly', points, ...over }
      if (Array.isArray(v.cuts)) {
        const cuts = points.map((_, i) => parseCut((v.cuts as unknown[])[i]))
        if (cuts.some(Boolean)) cell.cuts = cuts
      }
      return cell
    }
    case 'path':
      return { kind: 'path', d: parsePathString(v.d), ...(v.evenodd === true ? { evenodd: true } : {}), ...over }
    case 'shape': {
      if (!SHAPE_NAMES.includes(v.shape as never)) throw new CatalogueFormatError('forme inconnue')
      const cell: CellDef = {
        kind: 'shape',
        shape: v.shape as ShapeName,
        x: num(v.x),
        y: num(v.y),
        w: num(v.w, 0, 2),
        h: num(v.h, 0, 2),
        ...over,
      }
      if (v.rotate !== undefined) cell.rotate = num(v.rotate, -720, 720)
      if (v.stretch === true) cell.stretch = true
      return cell
    }
    default:
      throw new CatalogueFormatError('sorte de case inconnue')
  }
}

/**
 * Lit et vérifie un élément de décor (chemin dessiné par-dessus les photos).
 * @param v - valeur lue
 * @returns le décor
 * @throws {@link CatalogueFormatError} si le décor est invalide
 */
function parseDecor(v: unknown): Decor {
  if (!isObj(v) || !['ink', 'white', 'bg'].includes(v.fill as string)) throw new CatalogueFormatError('décor invalide')
  return { d: parsePathString(v.d), fill: v.fill as Decor['fill'], ...(v.evenodd === true ? { evenodd: true } : {}) }
}

/**
 * Lit et vérifie une disposition de l'usine ; une disposition publiée ou masquée doit aussi se construire.
 * @param v - valeur lue
 * @returns la disposition
 * @throws {@link CatalogueFormatError} ou `LayoutDefinitionError` (de `buildLayout`) si elle est invalide
 */
function parseLayout(v: unknown): CustomLayout {
  if (!isObj(v)) throw new CatalogueFormatError('disposition invalide')
  const id = str(v.id, 40)
  if (!/^u-[a-z0-9]{4,20}$/.test(id)) throw new CatalogueFormatError('identifiant invalide')
  const photos = num(v.photos, 1, 20)
  if (!Number.isInteger(photos)) throw new CatalogueFormatError('nombre de photos invalide')
  if (!Array.isArray(v.geo)) throw new CatalogueFormatError('cases absentes')
  const layout: CustomLayout = {
    id,
    photos,
    family: FAMILIES.includes(v.family as LayoutFamily) ? (v.family as LayoutFamily) : 'mixte',
    geo: v.geo.map(parseCell),
    status: STATUSES.includes(v.status as CustomStatus) ? (v.status as CustomStatus) : 'draft',
    position: v.position === 'start' ? 'start' : 'end',
    createdAt: str(v.createdAt),
    createdBy: str(v.createdBy),
    updatedAt: str(v.updatedAt),
    updatedBy: str(v.updatedBy),
  }
  if (Array.isArray(v.decor) && v.decor.length) layout.decor = v.decor.map(parseDecor)
  // Nombre de cases et cases dans le cadre ; un brouillon peut être incomplet.
  if (layout.status !== 'draft') buildLayout(layout)
  return layout
}

/**
 * Lit le fichier du catalogue. Les dispositions illisibles sont écartées et comptées dans `rejected`.
 * @param raw - contenu JSON du fichier
 * @returns le catalogue vérifié et le nombre de dispositions écartées
 * @throws {@link CatalogueFormatError} si ce n'est pas un fichier de catalogue (format ou version inconnus)
 */
export function parseCatalogue(raw: unknown): { data: CatalogueData; rejected: number } {
  if (!isObj(raw) || raw.format !== CATALOGUE_FORMAT || raw.version !== 1) throw new CatalogueFormatError('fichier de catalogue inconnu')
  let rejected = 0
  const layouts: CustomLayout[] = []
  for (const l of Array.isArray(raw.layouts) ? raw.layouts : []) {
    try {
      const parsed = parseLayout(l)
      if (!layouts.some((x) => x.id === parsed.id)) layouts.push(parsed)
    } catch {
      rejected++
    }
  }
  const hiddenBuiltins = Array.isArray(raw.hiddenBuiltins)
    ? [...new Set(raw.hiddenBuiltins.filter((x): x is string => typeof x === 'string' && /^p\d{2}-\d{2}$/.test(x)))]
    : []
  return {
    data: { format: CATALOGUE_FORMAT, version: 1, updatedAt: str(raw.updatedAt), updatedBy: str(raw.updatedBy), layouts, hiddenBuiltins },
    rejected,
  }
}

/**
 * Remplace (ou ajoute) une disposition dans le catalogue.
 * @param c - catalogue actuel
 * @param l - disposition, reconnue par son identifiant
 * @returns un nouveau catalogue, l'ancien reste intact
 */
export function upsertLayout(c: CatalogueData, l: CustomLayout): CatalogueData {
  const i = c.layouts.findIndex((x) => x.id === l.id)
  const layouts = i < 0 ? [...c.layouts, l] : c.layouts.map((x, k) => (k === i ? l : x))
  return { ...c, layouts }
}

/**
 * Supprime un brouillon (une disposition déjà publiée se masque, elle ne se supprime pas).
 * @param c - catalogue actuel
 * @param id - identifiant du brouillon
 * @returns un nouveau catalogue, sans ce brouillon
 */
export function removeDraft(c: CatalogueData, id: string): CatalogueData {
  return { ...c, layouts: c.layouts.filter((x) => !(x.id === id && x.status === 'draft')) }
}

/**
 * Masque ou réaffiche une disposition intégrée.
 * @param c - catalogue actuel
 * @param id - identifiant de la disposition intégrée (« pNN-NN »)
 * @param hidden - `true` pour la masquer, `false` pour la réafficher
 * @returns un nouveau catalogue, la liste des masquées triée
 */
export function setBuiltinHidden(c: CatalogueData, id: string, hidden: boolean): CatalogueData {
  const set = new Set(c.hiddenBuiltins)
  if (hidden) set.add(id)
  else set.delete(id)
  return { ...c, hiddenBuiltins: [...set].sort() }
}
