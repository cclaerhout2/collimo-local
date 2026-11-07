/**
 * Catalogue des dispositions : construit les dispositions intégrées (une seule fois, à la demande), y ajoute
 * celles de l'usine lues sur le Drive partagé, et répond aux recherches par identifiant ou nombre de photos.
 */
import { defBBox } from '../cells'
import { splitToRects } from '../layoutDsl'
import type { Layout, LayoutDef } from '../types'
import type { CatalogueData } from './custom'
import { CATALOG_DEFS } from './defs'

/** Erreur levée quand une définition de disposition est incohérente ou introuvable. */
export class LayoutDefinitionError extends Error {}

/**
 * Calcule les cases d'une définition et vérifie qu'elle annonce le bon nombre de photos.
 * @param def - définition (découpe `split`, rectangles `rects` ou cases libres `geo`)
 * @returns la disposition, avec la boîte de chaque case en coordonnées du cadre (0–1)
 * @throws {@link LayoutDefinitionError} si la définition n'a pas de cases, n'a pas autant de cases que
 * de photos, ou si une case sort du cadre
 */
export function buildLayout(def: LayoutDef): Layout {
  let cells
  if (def.split) cells = splitToRects(def.split)
  else if (def.rects) cells = def.rects.map((r) => ({ ...r }))
  else if (def.geo) cells = def.geo.map(defBBox)
  else throw new LayoutDefinitionError(`${def.id} : ni « split », ni « rects », ni « geo »`)
  if (cells.length !== def.photos) {
    throw new LayoutDefinitionError(`${def.id} : ${cells.length} cases pour ${def.photos} photo(s)`)
  }
  for (const c of cells) {
    // Les formes peuvent déborder un peu (courbes, rotation) : tolérance de 5 %.
    const tol = def.geo ? 0.05 : 1e-9
    const ok = c.w > 0 && c.h > 0 && c.x >= -tol && c.y >= -tol && c.x + c.w <= 1 + tol && c.y + c.h <= 1 + tol
    if (!ok) throw new LayoutDefinitionError(`${def.id} : case hors du cadre`)
  }
  return { ...def, cells }
}

let builtins: Layout[] | null = null
/**
 * Dispositions intégrées, construites au premier appel puis gardées en mémoire.
 * @returns la liste construite
 */
const builtinList = () => (builtins ??= CATALOG_DEFS.map(buildLayout))

/** Dispositions de l'usine (Drive partagé du catalogue), publiées ou masquées ; jamais les brouillons. */
let custom: { layouts: Layout[]; listed: Map<number, { start: Layout[]; end: Layout[] }>; hidden: Set<string> } = {
  layouts: [],
  listed: new Map(),
  hidden: new Set(),
}
let version = 0

/**
 * Applique le catalogue lu sur Drive. Les brouillons ne sont visibles que dans l'usine.
 * @param data - catalogue lu, ou `null` s'il n'y en a pas ; les dispositions invalides sont ignorées
 */
export function setCustomCatalogue(data: CatalogueData | null) {
  const layouts: Layout[] = []
  const listed = new Map<number, { start: Layout[]; end: Layout[] }>()
  const hidden = new Set(data?.hiddenBuiltins ?? [])
  for (const l of data?.layouts ?? []) {
    if (l.status === 'draft') continue
    let built: Layout
    try {
      built = buildLayout(l)
    } catch {
      continue
    }
    layouts.push(built)
    if (l.status === 'hidden') {
      hidden.add(l.id)
      continue
    }
    const slot = listed.get(l.photos) ?? { start: [], end: [] }
    slot[l.position].push(built)
    listed.set(l.photos, slot)
  }
  custom = { layouts, listed, hidden }
  version++
}

/**
 * Numéro de version du catalogue, qui change à chaque nouveau catalogue (pour rafraîchir les listes affichées).
 * @returns le numéro courant
 */
export const catalogueVersion = () => version

/**
 * Dispositions intégrées au code (planche de recette, tests).
 * @returns toutes les dispositions intégrées, masquées comprises
 */
export function builtinLayouts(): Layout[] {
  return builtinList()
}

/**
 * Indique si une disposition est masquée par le catalogue de l'usine.
 * @param id - identifiant de la disposition
 * @returns `true` si elle est masquée
 */
export function isBuiltinHidden(id: string): boolean {
  return custom.hidden.has(id)
}

/**
 * Toutes les dispositions connues, y compris masquées (pour rouvrir un ancien collage).
 * @returns les intégrées puis celles de l'usine
 */
export function allLayouts(): Layout[] {
  return custom.layouts.length ? [...builtinList(), ...custom.layouts] : builtinList()
}

/**
 * Dispositions proposées pour un nombre de photos : intégrées non masquées, et celles de l'usine.
 * @param photoCount - nombre de photos du collage
 * @returns celles de l'usine placées en tête, les intégrées, puis celles de l'usine placées à la fin
 */
export function layoutsFor(photoCount: number): Layout[] {
  const own = builtinList().filter((l) => l.photos === photoCount && !custom.hidden.has(l.id))
  const slot = custom.listed.get(photoCount)
  return slot ? [...slot.start, ...own, ...slot.end] : own
}

/**
 * Cherche une disposition par son identifiant, intégrée ou de l'usine (même masquée).
 * @param id - identifiant, par exemple « p04-07 » ou « u-… »
 * @returns la disposition, ou `undefined` si elle est inconnue
 */
export function layoutById(id: string): Layout | undefined {
  return builtinList().find((l) => l.id === id) ?? custom.layouts.find((l) => l.id === id)
}

/**
 * Disposition par défaut pour un nombre de photos : la première du catalogue.
 * @param photoCount - nombre de photos du collage
 * @returns la première disposition proposée (ou la première intégrée si toutes sont masquées)
 * @throws {@link LayoutDefinitionError} s'il n'existe aucune disposition pour ce nombre de photos
 */
export function defaultLayoutFor(photoCount: number): Layout {
  const l = layoutsFor(photoCount)[0] ?? builtinList().find((x) => x.photos === photoCount)
  if (!l) throw new LayoutDefinitionError(`aucune disposition pour ${photoCount} photo(s)`)
  return l
}

/**
 * Disposition effective d'un collage : celle du catalogue, avec les séparations déplacées à la main
 * si le collage en a. Une découpe ajustée invalide est ignorée.
 * @param layoutId - identifiant de la disposition enregistrée dans le collage
 * @param split - découpe ajustée à la main, s'il y en a une
 * @param photoCount - nombre de photos, pour se rabattre sur la disposition par défaut si l'identifiant est inconnu
 * @returns la disposition à utiliser
 */
export function resolveLayout(layoutId: string, split: string | undefined, photoCount: number): Layout {
  const base = layoutById(layoutId) ?? defaultLayoutFor(photoCount)
  if (!split || !base.split) return base
  try {
    const cells = splitToRects(split)
    if (cells.length === base.photos) return { ...base, split, cells }
  } catch {
    /* découpe illisible : on garde celle du catalogue */
  }
  return base
}
