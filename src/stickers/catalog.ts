/**
 * Catalogue des stickers : index des icônes Phosphor et Fluent Emoji (générés dans public/data par
 * tools/gen-assets.mjs), chargés à la demande, et recherche en français ou en anglais.
 */
import { score, searchTerms } from './keywords'

/** Bibliothèque d'icônes : Phosphor (une couleur, recolorable) ou Fluent Emoji (en couleur). */
export type IconSet = 'ph' | 'fluent'
/** Style d'une icône Phosphor : contour (`regular`) ou plein (`fill`). */
export type PhWeight = 'regular' | 'fill'

/** Icône de l'index d'une bibliothèque. */
export interface IconEntry {
  set: IconSet
  /** Nom anglais, mots séparés par des tirets. */
  name: string
  /** Catégories de la bibliothèque (une seule pour Fluent, qui sert aussi à trouver le fichier de l'icône). */
  categories: string[]
  /** Mots-clés anglais (Phosphor seulement). */
  tags?: string[]
}

/** Catégories Phosphor, dans l'ordre d'affichage. */
export const PH_CATEGORIES = [
  'people',
  'communications',
  'objects',
  'office',
  'commerce',
  'finances',
  'nature',
  'weather',
  'maps & travel',
  'health & wellness',
  'games',
  'media',
  'design',
  'editor',
  'arrows',
  'system',
  'technology & development',
] as const

/** Catégories Fluent Emoji, dans l'ordre d'affichage. */
export const FLUENT_CATEGORIES = [
  'smileys-and-emotion',
  'people-and-body',
  'animals-and-nature',
  'food-and-drink',
  'activities',
  'travel-and-places',
  'objects',
  'symbols',
  'flags',
] as const

/** Libellés des catégories, FR puis EN. */
export const CATEGORY_LABELS: Record<string, [string, string]> = {
  people: ['Personnes', 'People'],
  communications: ['Communication', 'Communication'],
  objects: ['Objets', 'Objects'],
  office: ['Bureau', 'Office'],
  commerce: ['Commerce', 'Commerce'],
  finances: ['Finances', 'Finance'],
  nature: ['Nature', 'Nature'],
  weather: ['Météo', 'Weather'],
  'maps & travel': ['Voyage', 'Travel'],
  'health & wellness': ['Santé', 'Health'],
  games: ['Jeux', 'Games'],
  media: ['Médias', 'Media'],
  design: ['Design', 'Design'],
  editor: ['Texte', 'Text'],
  arrows: ['Flèches', 'Arrows'],
  system: ['Interface', 'Interface'],
  'technology & development': ['Technologie', 'Technology'],
  'smileys-and-emotion': ['Émotions', 'Smileys'],
  'people-and-body': ['Personnes', 'People'],
  'animals-and-nature': ['Animaux et nature', 'Animals & nature'],
  'food-and-drink': ['Nourriture', 'Food & drink'],
  activities: ['Activités', 'Activities'],
  'travel-and-places': ['Voyages et lieux', 'Travel & places'],
  symbols: ['Symboles', 'Symbols'],
  flags: ['Drapeaux', 'Flags'],
}

/** Dossier des catalogues générés. */
const ASSETS = '/data'
/** Fichiers JSON déjà demandés, par chemin. */
const cache = new Map<string, Promise<unknown>>()

/**
 * Lit un fichier JSON du catalogue, une seule fois (un échec est oublié pour pouvoir réessayer).
 * @param path - chemin relatif au dossier des catalogues
 * @returns le contenu du fichier
 */
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

/** Index Phosphor compact : nom (`n`), catégories (`c`), mots-clés (`t`). */
type PhIndex = { n: string; c: string[]; t: string[] }[]
/** Index Fluent compact : nom (`n`), catégorie (`c`). */
type FluentIndex = { n: string; c: string }[]

/**
 * Charge l'index d'une bibliothèque d'icônes.
 * @param set - bibliothèque voulue
 * @returns toutes ses icônes
 */
export async function loadIndex(set: IconSet): Promise<IconEntry[]> {
  if (set === 'ph') {
    const idx = await fetchJson<PhIndex>('ph/index.json')
    return idx.map((i) => ({ set, name: i.n, categories: i.c, tags: i.t }))
  }
  const idx = await fetchJson<FluentIndex>('fluent/index.json')
  return idx.map((i) => ({ set, name: i.n, categories: [i.c] }))
}

/**
 * Corps SVG d'une icône (sans la balise `<svg>`).
 * @param entry - icône voulue
 * @param weight - style Phosphor ; le style `regular` sert de repli si l'icône n'existe pas en `fill`
 * @returns le contenu SVG
 * @throws Error si l'icône est introuvable
 */
export async function iconBody(entry: Pick<IconEntry, 'set' | 'name' | 'categories'>, weight: PhWeight = 'regular'): Promise<string> {
  const bodies =
    entry.set === 'ph'
      ? await fetchJson<Record<string, string>>(`ph/${weight}.json`)
      : await fetchJson<Record<string, string>>(`fluent/${entry.categories[0]}.json`)
  const body =
    bodies[entry.name] ?? (entry.set === 'ph' ? (await fetchJson<Record<string, string>>('ph/regular.json'))[entry.name] : undefined)
  if (!body) throw new Error(`icône introuvable : ${entry.name}`)
  return body
}

/**
 * Balise `<svg>` complète, prête à dessiner.
 * @param set - bibliothèque de l'icône (fixe la taille : 256 pour Phosphor, 32 pour Fluent)
 * @param body - corps SVG de l'icône
 * @returns le document SVG
 */
export function iconSvg(set: IconSet, body: string): string {
  const size = set === 'ph' ? 256 : 32
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`
}

/**
 * Recherche : par mot (FR ou EN) dans les noms et mots-clés, meilleurs résultats d'abord.
 * @param entries - icônes où chercher
 * @param query - saisie de l'utilisateur
 * @param limit - nombre maximum de résultats
 * @returns les icônes trouvées ; sans saisie, les premières de la liste
 */
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
