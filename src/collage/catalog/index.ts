import { defBBox } from '../cells'
import { splitToRects } from '../layoutDsl'
import type { Layout, LayoutDef } from '../types'
import type { CatalogueData } from './custom'
import { CATALOG_DEFS } from './defs'

export class LayoutDefinitionError extends Error {}

/** Calcule les cases d'une définition et vérifie qu'elle annonce le bon nombre de photos. */
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
const builtinList = () => (builtins ??= CATALOG_DEFS.map(buildLayout))

/** Dispositions de l'usine (Drive partagé du catalogue), publiées ou masquées ; jamais les brouillons. */
let custom: { layouts: Layout[]; listed: Map<number, { start: Layout[]; end: Layout[] }>; hidden: Set<string> } = {
  layouts: [],
  listed: new Map(),
  hidden: new Set(),
}
let version = 0

/** Applique le catalogue lu sur Drive (null = aucun). Les brouillons ne sont visibles que dans l'usine. */
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

/** Change à chaque nouveau catalogue (pour rafraîchir les listes affichées). */
export const catalogueVersion = () => version

/** Dispositions intégrées au code (planche de recette, tests). */
export function builtinLayouts(): Layout[] {
  return builtinList()
}

export function isBuiltinHidden(id: string): boolean {
  return custom.hidden.has(id)
}

/** Toutes les dispositions connues, y compris masquées (pour rouvrir un ancien collage). */
export function allLayouts(): Layout[] {
  return custom.layouts.length ? [...builtinList(), ...custom.layouts] : builtinList()
}

/** Dispositions proposées pour un nombre de photos : intégrées non masquées, et celles de l'usine. */
export function layoutsFor(photoCount: number): Layout[] {
  const own = builtinList().filter((l) => l.photos === photoCount && !custom.hidden.has(l.id))
  const slot = custom.listed.get(photoCount)
  return slot ? [...slot.start, ...own, ...slot.end] : own
}

export function layoutById(id: string): Layout | undefined {
  return builtinList().find((l) => l.id === id) ?? custom.layouts.find((l) => l.id === id)
}

/** Disposition par défaut pour un nombre de photos : la première du catalogue. */
export function defaultLayoutFor(photoCount: number): Layout {
  const l = layoutsFor(photoCount)[0] ?? builtinList().find((x) => x.photos === photoCount)
  if (!l) throw new LayoutDefinitionError(`aucune disposition pour ${photoCount} photo(s)`)
  return l
}

/**
 * Disposition effective d'un collage : celle du catalogue, avec les séparations déplacées à la main
 * si le collage en a. Une découpe ajustée invalide est ignorée.
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
