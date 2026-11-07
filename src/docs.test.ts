/**
 * Contrôle de la documentation du code (convention décrite dans le README, « Conventions de code ») :
 * chaque fichier commence par un bloc de présentation, chaque fonction et chaque élément exporté
 * a un commentaire `/** … *\/` juste au-dessus. Le contenu des blocs (@param, @returns) est vérifié par oxlint.
 */
import { describe, expect, it } from 'vitest'

/** Contenu de chaque fichier TypeScript du code de l'app (tests et déclarations de types externes exclus). */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}', '!./**/*.d.ts'], { query: '?raw', import: 'default', eager: true }),
  ).map(([path, text]) => [path.replace(/^\.\//, 'src/'), text as string]),
)

/** Ligne qui déclare une fonction, ou un élément exporté (constante, type, interface, classe). */
const DECLARATION =
  /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)|^\s*export\s+(?:const|let|interface|type|class|enum|abstract\s+class)\s+(\w+)/

/**
 * Déclarations sans bloc de documentation juste au-dessus.
 * @param source - contenu d'un fichier
 * @returns les noms des déclarations non documentées, avec leur numéro de ligne
 */
export function undocumented(source: string): string[] {
  const lines = source.split('\n')
  const missing: string[] = []
  lines.forEach((line, i) => {
    const m = DECLARATION.exec(line)
    if (!m) return
    let j = i - 1
    while (j >= 0 && (lines[j].trim() === '' || lines[j].trim().startsWith('//'))) j--
    if (j < 0 || !lines[j].trim().endsWith('*/')) missing.push(`${m[1] ?? m[2]} (ligne ${i + 1})`)
  })
  return missing
}

describe('documentation du code', () => {
  it('chaque fichier commence par un bloc de présentation', () => {
    const bad = Object.keys(SOURCES).filter((f) => !SOURCES[f].trimStart().startsWith('/**'))
    expect(bad).toEqual([])
  })

  it('chaque fonction et chaque élément exporté est documenté', () => {
    const bad = Object.entries(SOURCES).flatMap(([f, text]) => undocumented(text).map((d) => `${f} : ${d}`))
    expect(bad).toEqual([])
  })
})
