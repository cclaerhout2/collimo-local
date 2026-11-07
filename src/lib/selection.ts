/**
 * Sélection ordonnée de photos : l'ordre de sélection fixe l'ordre des cases dans le collage.
 * Fonctions pures, pour être testées sans interface.
 */
/** Résultat d'un clic sur une photo : la nouvelle sélection, et si le maximum a empêché l'ajout. */
export type ToggleResult = { selection: string[]; limitReached: boolean }

/**
 * Ajoute une photo à la sélection, ou l'en retire si elle y est déjà.
 * @param selection - sélection actuelle, dans l'ordre
 * @param id - photo cliquée
 * @param max - nombre maximum de photos
 * @returns la nouvelle sélection (inchangée si le maximum est atteint, avec `limitReached`)
 */
export function toggleSelection(selection: readonly string[], id: string, max: number): ToggleResult {
  if (selection.includes(id)) return { selection: selection.filter((s) => s !== id), limitReached: false }
  if (selection.length >= max) return { selection: [...selection], limitReached: true }
  return { selection: [...selection, id], limitReached: false }
}

/**
 * Retire de la sélection les photos qui ne sont plus dans le dossier.
 * @param selection - sélection actuelle, dans l'ordre
 * @param available - identifiants des photos du dossier
 * @returns la sélection filtrée, ordre conservé
 */
export function pruneSelection(selection: readonly string[], available: Iterable<string>): string[] {
  const ids = new Set(available)
  return selection.filter((id) => ids.has(id))
}
