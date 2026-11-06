import { score, searchTerms } from './keywords'

/** Bibliothèque d'icônes : Phosphor (une couleur, recolorable) ou Fluent Emoji (en couleur). */
export type IconSet = 'ph' | 'fluent'
export type PhWeight = 'regular' | 'fill'

export interface IconEntry {
  set: IconSet
  name: string
  categories: string[]
  tags?: string[]
}

export const PH_CATEGORIES = [
  'people', 'communications', 'objects', 'office', 'commerce', 'finances', 'nature', 'weather', 'maps & travel',
  'health & wellness', 'games', 'media', 'design', 'editor', 'arrows', 'system', 'technology & development',
] as const

export const FLUENT_CATEGORIES = [
  'smileys-and-emotion', 'people-and-body', 'animals-and-nature', 'food-and-drink', 'activities', 'travel-and-places',
  'objects', 'symbols', 'flags',
] as const

/** Libellés des catégories, FR puis EN. */
export const CATEGORY_LABELS: Record<string, [string, string]> = {
  people: ['Personnes', 'People'], communications: ['Communication', 'Communication'], objects: ['Objets', 'Objects'],
  office: ['Bureau', 'Office'], commerce: ['Commerce', 'Commerce'], finances: ['Finances', 'Finance'], nature: ['Nature', 'Nature'],
  weather: ['Météo', 'Weather'], 'maps & travel': ['Voyage', 'Travel'], 'health & wellness': ['Santé', 'Health'],
  games: ['Jeux', 'Games'], media: ['Médias', 'Media'], design: ['Design', 'Design'], editor: ['Texte', 'Text'],
  arrows: ['Flèches', 'Arrows'], system: ['Interface', 'Interface'], 'technology & development': ['Technologie', 'Technology'],
  'smileys-and-emotion': ['Émotions', 'Smileys'], 'people-and-body': ['Personnes', 'People'],
  'animals-and-nature': ['Animaux et nature', 'Animals & nature'], 'food-and-drink': ['Nourriture', 'Food & drink'],
  activities: ['Activités', 'Activities'], 'travel-and-places': ['Voyages et lieux', 'Travel & places'], symbols: ['Symboles', 'Symbols'],
  flags: ['Drapeaux', 'Flags'],
}

const ASSETS = '/assets'
const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined
  if (!p) {
    p = fetch(`${ASSETS}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path} : ${r.status}`)
      return r.json() as Promise<T>
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p
}

type PhIndex = { n: string; c: string[]; t: string[] }[]
type FluentIndex = { n: string; c: string }[]

export async function loadIndex(set: IconSet): Promise<IconEntry[]> {
  if (set === 'ph') {
    const idx = await fetchJson<PhIndex>('ph/index.json')
    return idx.map((i) => ({ set, name: i.n, categories: i.c, tags: i.t }))
  }
  const idx = await fetchJson<FluentIndex>('fluent/index.json')
  return idx.map((i) => ({ set, name: i.n, categories: [i.c] }))
}

/** Corps SVG d'une icône (sans la balise <svg>). */
export async function iconBody(entry: Pick<IconEntry, 'set' | 'name' | 'categories'>, weight: PhWeight = 'regular'): Promise<string> {
  const bodies =
    entry.set === 'ph'
      ? await fetchJson<Record<string, string>>(`ph/${weight}.json`)
      : await fetchJson<Record<string, string>>(`fluent/${entry.categories[0]}.json`)
  const body = bodies[entry.name] ?? (entry.set === 'ph' ? (await fetchJson<Record<string, string>>('ph/regular.json'))[entry.name] : undefined)
  if (!body) throw new Error(`icône introuvable : ${entry.name}`)
  return body
}

/** Balise <svg> complète, prête à dessiner. */
export function iconSvg(set: IconSet, body: string): string {
  const size = set === 'ph' ? 256 : 32
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`
}

/** Recherche : par mot (FR ou EN) dans les noms et mots-clés, meilleurs résultats d'abord. */
export function searchIcons(entries: IconEntry[], query: string, limit = 240): IconEntry[] {
  const terms = searchTerms(query)
  if (!terms.length) return entries.slice(0, limit)
  return entries
    .map((e) => ({ e, s: score(e, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.e)
}
