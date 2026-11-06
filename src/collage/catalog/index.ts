import { splitToRects } from '../layoutDsl'
import type { CollageDoc, Layout, LayoutDef } from '../types'
import { CATALOG_DEFS } from './defs'

export class LayoutDefinitionError extends Error {}

/** Calcule les cases d'une définition et vérifie qu'elle annonce le bon nombre de photos. */
export function buildLayout(def: LayoutDef): Layout {
  let cells
  if (def.split) cells = splitToRects(def.split)
  else if (def.rects) cells = def.rects.map((r) => ({ ...r }))
  else throw new LayoutDefinitionError(`${def.id} : ni « split » ni « rects »`)
  if (cells.length !== def.photos) {
    throw new LayoutDefinitionError(`${def.id} : ${cells.length} cases pour ${def.photos} photo(s)`)
  }
  for (const c of cells) {
    const ok = c.w > 0 && c.h > 0 && c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9
    if (!ok) throw new LayoutDefinitionError(`${def.id} : case hors du cadre`)
  }
  return { ...def, cells }
}

let cache: Layout[] | null = null

export function allLayouts(): Layout[] {
  cache ??= CATALOG_DEFS.map(buildLayout)
  return cache
}

export function layoutsFor(photoCount: number): Layout[] {
  return allLayouts().filter((l) => l.photos === photoCount)
}

export function layoutById(id: string): Layout | undefined {
  return allLayouts().find((l) => l.id === id)
}

/** Disposition par défaut pour un nombre de photos : la première du catalogue. */
export function defaultLayoutFor(photoCount: number): Layout {
  const l = layoutsFor(photoCount)[0]
  if (!l) throw new LayoutDefinitionError(`aucune disposition pour ${photoCount} photo(s)`)
  return l
}

/**
 * Disposition effective d'un collage : celle du catalogue, avec les séparations déplacées à la main
 * si le collage en a. Une découpe ajustée invalide est ignorée.
 */
export function resolveLayout(doc: Pick<CollageDoc, 'layoutId' | 'split' | 'photos'>): Layout {
  const base = layoutById(doc.layoutId) ?? defaultLayoutFor(doc.photos.length)
  if (!doc.split || !base.split) return base
  try {
    const cells = splitToRects(doc.split)
    if (cells.length === base.photos) return { ...base, split: doc.split, cells }
  } catch {
    /* découpe illisible : on garde celle du catalogue */
  }
  return base
}
