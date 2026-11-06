/** Polices Google : catalogue chargé à la demande, chaque police chargée seulement quand on l'utilise. */
export interface FontEntry {
  family: string
  category: string
  weights: number[]
  italic: boolean
}

/** Sélection affichée en tête de liste. */
export const POPULAR_FONTS = [
  'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins', 'Inter', 'Nunito', 'Raleway', 'Oswald', 'Bebas Neue', 'Anton',
  'Archivo Black', 'Playfair Display', 'Merriweather', 'Abril Fatface', 'Lobster', 'Pacifico', 'Dancing Script', 'Great Vibes',
  'Caveat', 'Permanent Marker', 'Shadows Into Light', 'Righteous', 'Comfortaa', 'Quicksand',
] as const

export const DEFAULT_FONT = 'Montserrat'

let catalog: Promise<FontEntry[]> | null = null

export function loadFontCatalog(): Promise<FontEntry[]> {
  catalog ??= fetch('/assets/fonts.json')
    .then((r) => {
      if (!r.ok) throw new Error(`fonts.json : ${r.status}`)
      return r.json() as Promise<{ f: string; c: string; w: number[]; i: boolean }[]>
    })
    .then((list) => list.map((x) => ({ family: x.f, category: x.c, weights: x.w, italic: x.i })))
  catalog.catch(() => (catalog = null))
  return catalog
}

/** Graisse la plus proche disponible. */
export function nearestWeight(available: number[], wanted: number): number {
  if (!available.length) return wanted
  return available.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best), available[0])
}

/** Adresse de la feuille de style Google Fonts pour une famille (graisses 400 et 700, italique si possible). */
export function fontCssUrl(family: string, weights: number[] = [400, 700], italic = false): string {
  const ws = [...new Set(weights)].sort((a, b) => a - b)
  const axis = italic ? `ital,wght@${[...ws.map((w) => `0,${w}`), ...ws.map((w) => `1,${w}`)].join(';')}` : `wght@${ws.join(';')}`
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axis}&display=swap`
}

const loaded = new Map<string, Promise<void>>()

/**
 * Charge une police et attend qu'elle soit prête : indispensable avant de dessiner du texte
 * dans le Canvas, sinon le navigateur utilise une police de secours.
 */
export function ensureFont(family: string, weight: number, italic: boolean, entry?: FontEntry): Promise<void> {
  const key = `${family}|${weight}|${italic}`
  let p = loaded.get(key)
  if (p) return p
  p = (async () => {
    if (typeof document === 'undefined') return
    const id = `gf-${family.replace(/\W+/g, '-')}`
    if (!document.getElementById(id)) {
      const weights = entry ? [nearestWeight(entry.weights, 400), nearestWeight(entry.weights, 700)] : [400, 700]
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = fontCssUrl(family, weights, entry?.italic ?? false)
      document.head.appendChild(link)
      await new Promise<void>((resolve) => {
        link.onload = () => resolve()
        link.onerror = () => resolve()
      })
    }
    await document.fonts.load(`${italic ? 'italic ' : ''}${weight} 48px "${family}"`)
  })()
  loaded.set(key, p)
  return p
}
