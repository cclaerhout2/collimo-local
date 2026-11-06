/**
 * Sélection ordonnée de photos : l'ordre de sélection fixe l'ordre des cases dans le collage.
 * Fonctions pures, pour être testées sans interface.
 */
export type ToggleResult = { selection: string[]; limitReached: boolean }

export function toggleSelection(selection: readonly string[], id: string, max: number): ToggleResult {
  if (selection.includes(id)) return { selection: selection.filter((s) => s !== id), limitReached: false }
  if (selection.length >= max) return { selection: [...selection], limitReached: true }
  return { selection: [...selection, id], limitReached: false }
}

/** Retire de la sélection les photos qui ne sont plus dans le dossier. */
export function pruneSelection(selection: readonly string[], available: Iterable<string>): string[] {
  const ids = new Set(available)
  return selection.filter((id) => ids.has(id))
}
