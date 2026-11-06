const pad = (n: number) => String(n).padStart(2, '0')

/** « Collimo_AAAA-MM-JJ_HH-MM-SS », en heure locale. */
export function collageStamp(date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `Collimo_${d}_${t}`
}

/**
 * Nom de base d'un nouveau collage, jamais déjà pris : ajoute `_2`, `_3`…
 * si un collage porte le même horodatage. `existingNames` = noms de fichiers du dossier Collimo.
 */
export function uniqueCollageBaseName(date: Date, existingNames: Iterable<string>): string {
  const base = collageStamp(date)
  const taken = new Set<string>()
  for (const name of existingNames) {
    const dot = name.indexOf('.')
    taken.add(dot === -1 ? name : name.slice(0, dot))
  }
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}
