/** Nommage des collages enregistrés sur Drive : horodatage local, sans collision avec un fichier existant. */

/**
 * Écrit un nombre sur deux chiffres.
 * @param n - nombre de 0 à 99
 * @returns le nombre complété d'un zéro à gauche si besoin
 */
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Horodatage d'un collage : « Collimo_AAAA-MM-JJ_HH-MM-SS », en heure locale.
 * @param date - date de création
 * @returns le nom horodaté, sans extension
 */
export function collageStamp(date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  return `Collimo_${d}_${t}`
}

/**
 * Nom de base d'un nouveau collage, jamais déjà pris : ajoute `_2`, `_3`…
 * si un collage porte le même horodatage.
 * @param date - date de création
 * @param existingNames - noms de fichiers du dossier Collimo (comparés sans leur extension)
 * @returns le nom de base libre, sans extension
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
