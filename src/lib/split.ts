/**
 * Répartition d'une sélection de photos en plusieurs collages : groupes, déplacements entre
 * groupes, répartition automatique équilibrée, et validation (taille de chaque collage).
 * Fonctions pures, testées sans interface.
 */

/** Groupes de photos : chaque groupe deviendra un collage ; l'ordre des identifiants est l'ordre des cases. */
export type Groups = string[][]

/**
 * Nombre de collages nécessaires pour `count` photos avec au plus `max` par collage.
 * @param count - nombre de photos
 * @param max - maximum par collage
 * @returns le nombre de collages (au moins 1)
 */
export function groupsNeeded(count: number, max: number): number {
  return Math.max(1, Math.ceil(count / max))
}

/**
 * Répartit des photos, dans l'ordre, en `n` groupes de tailles équilibrées (les premiers reçoivent
 * la photo en plus) : 23 photos en 3 → 8, 8, 7.
 * @param ids - photos, dans l'ordre de sélection
 * @param n - nombre de groupes (au moins 1)
 * @returns les groupes
 */
export function autoSplit(ids: readonly string[], n: number): Groups {
  const count = Math.max(1, Math.min(Math.floor(n), ids.length || 1))
  const base = Math.floor(ids.length / count)
  const extra = ids.length % count
  const out: Groups = []
  let i = 0
  for (let g = 0; g < count; g++) {
    const size = base + (g < extra ? 1 : 0)
    out.push(ids.slice(i, i + size))
    i += size
  }
  return out
}

/**
 * Répartit des photos, dans l'ordre, en groupes d'environ `perGroup` photos.
 * @param ids - photos, dans l'ordre de sélection
 * @param perGroup - taille visée d'un groupe (au moins 1)
 * @returns les groupes, équilibrés
 */
export function splitBySize(ids: readonly string[], perGroup: number): Groups {
  return autoSplit(ids, Math.max(1, Math.round(ids.length / Math.max(1, perGroup))))
}

/**
 * Déplace une photo vers un groupe (ou hors de tout groupe avec `to = -1`), en fin de groupe.
 * @param groups - groupes actuels
 * @param id - photo à déplacer
 * @param to - indice du groupe de destination, ou -1 pour la remettre « à placer »
 * @returns les nouveaux groupes
 */
export function movePhoto(groups: Groups, id: string, to: number): Groups {
  const stripped = groups.map((g) => g.filter((x) => x !== id))
  if (to < 0 || to >= stripped.length) return stripped
  return stripped.map((g, i) => (i === to ? [...g, id] : g))
}

/**
 * Photos sélectionnées qui ne sont dans aucun groupe, dans l'ordre de sélection.
 * @param ids - sélection
 * @param groups - groupes
 * @returns les identifiants à placer
 */
export function unplaced(ids: readonly string[], groups: Groups): string[] {
  const placed = new Set(groups.flat())
  return ids.filter((id) => !placed.has(id))
}

/** Problème qui empêche de créer les collages. */
export type SplitIssue =
  { kind: 'unplaced'; count: number } | { kind: 'tooFew'; group: number; min: number } | { kind: 'tooMany'; group: number; max: number }

/**
 * Vérifie une répartition : tout est placé, et chaque groupe a entre `min` et `max` photos.
 * Un groupe vide est ignoré (il sera retiré à la création).
 * @param ids - sélection
 * @param groups - groupes
 * @param min - minimum par collage
 * @param max - maximum par collage
 * @returns les problèmes, dans l'ordre d'affichage ; vide si tout va bien
 */
export function splitIssues(ids: readonly string[], groups: Groups, min: number, max: number): SplitIssue[] {
  const issues: SplitIssue[] = []
  const left = unplaced(ids, groups).length
  if (left) issues.push({ kind: 'unplaced', count: left })
  groups.forEach((g, i) => {
    if (g.length === 0) return
    if (g.length < min) issues.push({ kind: 'tooFew', group: i, min })
    else if (g.length > max) issues.push({ kind: 'tooMany', group: i, max })
  })
  return issues
}
