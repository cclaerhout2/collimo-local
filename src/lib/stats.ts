/**
 * Statistiques d'usage : événements envoyés au relais Apps Script de l'admin, modèle du script à
 * déployer, lecture de la Google Sheet (CSV) et calcul des indicateurs. Aucune photo, aucun nom :
 * le relais remplace l'adresse par un pseudonyme.
 */

import type { CollageDoc } from '../collage/types'

/** Version du relais attendue par cette version de Collimo. */
export const RELAY_VERSION = 1

/** Événement envoyé au relais. */
export interface StatsEvent {
  /** Connexion (une fois par jour et par appareil), collage enregistré, ou échec d'enregistrement. */
  event: 'signin' | 'collage' | 'export_error'
  device: 'mobile' | 'desktop'
  photos?: number
  /** Disposition utilisée. */
  layout?: string
  /** Disposition intégrée ou créée dans l'usine. */
  layoutSource?: 'builtin' | 'custom'
  format?: 'jpeg' | 'png'
  size?: 'standard' | 'hd' | 'max'
  ratio?: string
  /** Nombre de zones masquées dans le collage. */
  masks?: number
  texts?: number
  stickers?: number
  /** Filtre appliqué, « reglages » pour des réglages seuls, vide sinon. */
  filter?: string
  /** Taille de la série (0 pour un collage seul). */
  series?: number
  durationMs?: number
  /** Cause de l'échec (clé d'erreur). */
  error?: string
}

/** Réponse du relais à un test. */
export interface RelayInfo {
  version: number
  sheetId: string
  sheetUrl: string
}

/** Échec du test du relais, avec sa cause. */
export class RelayError extends Error {
  /** `network` : injoignable ; `refused` : jeton ou domaine refusé ; `version` : script à mettre à jour ; `other`. */
  readonly code: 'network' | 'refused' | 'version' | 'other'
  constructor(code: RelayError['code'], message?: string) {
    super(message ?? code)
    this.name = 'RelayError'
    this.code = code
  }
}

/** Adresse d'une application web Apps Script (y compris déployée pour un domaine Workspace). */
const RELAY_URL = /^https:\/\/script\.google\.com\/(a\/macros\/[a-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/

/**
 * Indique si une adresse est celle d'une application web Apps Script.
 * @param url - adresse collée par l'admin
 * @returns `true` si elle a la forme attendue
 */
export function isRelayUrl(url: string): boolean {
  return RELAY_URL.test(url.trim())
}

/**
 * Code du relais à déployer, avec l'ID client et les domaines de cette installation.
 * @param template - modèle (`tools/stats/Code.gs`)
 * @param clientId - ID client OAuth de Collimo
 * @param domains - domaines autorisés (vide = tous)
 * @returns le code prêt à coller dans Apps Script
 */
export function fillRelayTemplate(template: string, clientId: string, domains: string[]): string {
  return template
    .replace('__CLIENT_ID__', clientId.replace(/'/g, ''))
    .replace('__DOMAINS__', JSON.stringify(domains))
    .replace('__VERSION__', String(RELAY_VERSION))
}

/**
 * Appareil courant, d'après la taille d'écran et le pointeur.
 * @returns `mobile` sur un écran tactile étroit, sinon `desktop`
 */
export function currentDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  return window.matchMedia?.('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 820 ? 'mobile' : 'desktop'
}

/**
 * Appelle le relais. Le corps part en texte simple, ce qui évite la requête préalable CORS qu'Apps Script ne gère pas.
 * @param url - adresse du relais
 * @param body - contenu
 * @param fetchImpl - `fetch`, remplaçable dans les tests
 * @returns la réponse JSON
 * @throws {@link RelayError} si le relais est injoignable ou répond autre chose que du JSON
 */
async function post(url: string, body: unknown, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; [k: string]: unknown }> {
  let res: Response
  try {
    res = await fetchImpl(url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' })
  } catch {
    throw new RelayError('network')
  }
  try {
    return (await res.json()) as { ok: boolean }
  } catch {
    throw new RelayError('network', `réponse illisible (${res.status})`)
  }
}

/**
 * Teste le relais avec le jeton de l'admin et renvoie la Sheet qu'il remplit.
 * @param url - adresse du relais
 * @param token - jeton Google de l'admin
 * @param fetchImpl - `fetch`, remplaçable dans les tests
 * @returns la version et la Sheet
 * @throws {@link RelayError}
 */
export async function pingRelay(url: string, token: string, fetchImpl: typeof fetch = fetch): Promise<RelayInfo> {
  const r = await post(url, { action: 'ping', token }, fetchImpl)
  if (!r.ok) {
    const err = String(r.error ?? '')
    throw new RelayError(/token|domain/.test(err) ? 'refused' : 'other', err)
  }
  if (r.app !== 'collimo-stats') throw new RelayError('other', 'ce n’est pas un relais Collimo')
  if (Number(r.version) < RELAY_VERSION) throw new RelayError('version')
  return { version: Number(r.version), sheetId: String(r.sheetId), sheetUrl: String(r.sheetUrl) }
}

/**
 * Envoie un événement sans attendre ni signaler d'erreur : les statistiques ne doivent jamais gêner l'utilisateur.
 * @param url - adresse du relais
 * @param token - jeton Google de l'utilisateur
 * @param event - événement
 * @param fetchImpl - `fetch`, remplaçable dans les tests
 */
export function sendEvent(url: string, token: string, event: StatsEvent, fetchImpl: typeof fetch = fetch) {
  try {
    void fetchImpl(url, { method: 'POST', body: JSON.stringify({ action: 'event', token, event }), keepalive: true }).catch(() => {})
  } catch {
    // Ignoré : un événement perdu n'a pas de conséquence.
  }
}

/**
 * Indique si l'événement de connexion du jour a déjà été envoyé pour ce compte sur cet appareil, et le note sinon.
 * @param email - compte
 * @param today - date du jour (AAAA-MM-JJ)
 * @returns `true` s'il faut l'envoyer maintenant
 */
export function shouldSendSignin(email: string, today = new Date().toISOString().slice(0, 10)): boolean {
  const key = `collimo.statsSignin.${email.toLowerCase()}`
  try {
    if (localStorage.getItem(key) === today) return false
    localStorage.setItem(key, today)
  } catch {
    // Stockage indisponible : on envoie, au pire une connexion est comptée deux fois dans la journée.
  }
  return true
}

/** Ligne de la Sheet, relue. */
export interface StatsRow {
  date: Date
  user: string
  event: string
  device: string
  photos: number
  layout: string
  layoutSource: string
  format: string
  size: string
  ratio: string
  masks: number
  texts: number
  stickers: number
  filter: string
  series: number
  durationMs: number
  error: string
}

/**
 * Découpe un CSV (RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans un champ).
 * @param text - contenu CSV
 * @returns les lignes, chacune en liste de champs
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Relit l'export CSV de la Sheet : la première ligne donne les colonnes, les lignes illisibles sont ignorées.
 * @param csv - export CSV de la feuille « Événements »
 * @returns les lignes valides, dans l'ordre
 */
export function parseStatsCsv(csv: string): StatsRow[] {
  const [head, ...lines] = parseCsv(csv)
  if (!head) return []
  const col = (name: string) => head.indexOf(name)
  const idx = {
    date: col('date'),
    user: col('utilisateur'),
    event: col('evenement'),
    device: col('appareil'),
    photos: col('photos'),
    layout: col('disposition'),
    layoutSource: col('source_disposition'),
    format: col('format'),
    size: col('taille'),
    ratio: col('ratio'),
    masks: col('zones_masquees'),
    texts: col('textes'),
    stickers: col('stickers'),
    filter: col('filtre'),
    series: col('serie'),
    durationMs: col('duree_ms'),
    error: col('erreur'),
  }
  const s = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
  const n = (r: string[], i: number) => {
    const v = Number(s(r, i))
    return Number.isFinite(v) ? v : 0
  }
  const out: StatsRow[] = []
  for (const r of lines) {
    const date = new Date(s(r, idx.date))
    const user = s(r, idx.user)
    if (Number.isNaN(date.getTime()) || !user) continue
    out.push({
      date,
      user,
      event: s(r, idx.event),
      device: s(r, idx.device),
      photos: n(r, idx.photos),
      layout: s(r, idx.layout),
      layoutSource: s(r, idx.layoutSource),
      format: s(r, idx.format),
      size: s(r, idx.size),
      ratio: s(r, idx.ratio),
      masks: n(r, idx.masks),
      texts: n(r, idx.texts),
      stickers: n(r, idx.stickers),
      filter: s(r, idx.filter),
      series: n(r, idx.series),
      durationMs: n(r, idx.durationMs),
      error: s(r, idx.error),
    })
  }
  return out
}

/** Indicateurs d'une période. */
export interface StatsSummary {
  /** Utilisateurs ayant au moins un événement sur la période. */
  activeUsers: number
  /** Utilisateurs dont le premier événement connu tombe dans la période. */
  newUsers: number
  /** Collages enregistrés. */
  collages: number
  /** Collages par utilisateur actif. */
  collagesPerActive: number
  /** Photos par collage, en moyenne. */
  photosPerCollage: number
  /** Part des collages avec au moins une zone masquée (0 à 1). */
  maskedShare: number
  /** Répartition des collages par nombre de photos. */
  photoBuckets: { label: string; count: number }[]
  /** Collages et utilisateurs actifs par semaine (lundi), de la plus ancienne à la plus récente. */
  weeks: { start: Date; collages: number; activeUsers: number }[]
  /** Dispositions par nombre d'utilisations, la plus utilisée d'abord. */
  layouts: { id: string; source: string; count: number }[]
  /** Échecs d'enregistrement sur la période. */
  errors: number
}

/**
 * Lundi 00:00 (heure locale) de la semaine d'une date.
 * @param d - date
 * @returns le début de sa semaine
 */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/**
 * Calcule les indicateurs sur les `days` derniers jours.
 * @param rows - toutes les lignes de la Sheet
 * @param days - longueur de la période, en jours
 * @param now - date de référence (maintenant par défaut)
 * @returns les indicateurs
 */
export function summarize(rows: StatsRow[], days: number, now = new Date()): StatsSummary {
  const from = new Date(now.getTime() - days * 86400000)
  const firstSeen = new Map<string, number>()
  for (const r of rows) {
    const t = r.date.getTime()
    const prev = firstSeen.get(r.user)
    if (prev === undefined || t < prev) firstSeen.set(r.user, t)
  }
  const inPeriod = rows.filter((r) => r.date >= from && r.date <= now)
  const collages = inPeriod.filter((r) => r.event === 'collage')
  const active = new Set(inPeriod.map((r) => r.user))
  const newUsers = [...active].filter((u) => (firstSeen.get(u) ?? 0) >= from.getTime()).length
  const photoSum = collages.reduce((s, r) => s + r.photos, 0)
  const buckets = [
    { label: '1', min: 1, max: 1 },
    { label: '2–4', min: 2, max: 4 },
    { label: '5–9', min: 5, max: 9 },
    { label: '10–14', min: 10, max: 14 },
    { label: '15–20', min: 15, max: 20 },
  ].map((b) => ({ label: b.label, count: collages.filter((r) => r.photos >= b.min && r.photos <= b.max).length }))
  // Semaines de la période, même vides, pour un axe régulier.
  const weeks: StatsSummary['weeks'] = []
  for (let w = weekStart(from); w <= now; w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)) {
    const end = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)
    const inWeek = inPeriod.filter((r) => r.date >= w && r.date < end)
    weeks.push({
      start: w,
      collages: inWeek.filter((r) => r.event === 'collage').length,
      activeUsers: new Set(inWeek.map((r) => r.user)).size,
    })
  }
  const layoutCount = new Map<string, { id: string; source: string; count: number }>()
  for (const r of collages) {
    if (!r.layout) continue
    const cur = layoutCount.get(r.layout) ?? { id: r.layout, source: r.layoutSource, count: 0 }
    cur.count++
    layoutCount.set(r.layout, cur)
  }
  return {
    activeUsers: active.size,
    newUsers,
    collages: collages.length,
    collagesPerActive: active.size ? collages.length / active.size : 0,
    photosPerCollage: collages.length ? photoSum / collages.length : 0,
    maskedShare: collages.length ? collages.filter((r) => r.masks > 0).length / collages.length : 0,
    photoBuckets: buckets,
    weeks,
    layouts: [...layoutCount.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    errors: inPeriod.filter((r) => r.event === 'export_error').length,
  }
}

/** Événement sans l'appareil, que l'app ajoute à l'envoi. */
export type TrackedEvent = Omit<StatsEvent, 'device'>

/**
 * Compteurs d'un collage enregistré (jamais le contenu : ni photo, ni nom de fichier, ni texte).
 * @param doc - collage, avec sa disposition résolue
 * @param args - format et taille d'export, taille de la série, durée
 * @returns l'événement à envoyer
 */
export function collageEvent(
  doc: Pick<CollageDoc, 'photos' | 'layoutId' | 'ratio' | 'overlays' | 'filter' | 'adjust'>,
  args: { format: 'jpeg' | 'png'; size: 'standard' | 'hd' | 'max'; series: number; durationMs: number },
): TrackedEvent {
  const overlays = doc.overlays ?? []
  const adjusted = !!doc.adjust || doc.photos.some((p) => p.adjust)
  return {
    event: 'collage',
    photos: doc.photos.length,
    layout: doc.layoutId,
    layoutSource: doc.layoutId.startsWith('u-') ? 'custom' : 'builtin',
    format: args.format,
    size: args.size,
    ratio: doc.ratio,
    masks: doc.photos.reduce((n, p) => n + (p.masks?.length ?? 0), 0),
    texts: overlays.filter((o) => o.type === 'text').length,
    stickers: overlays.filter((o) => o.type !== 'text').length,
    filter: doc.filter?.id ?? (adjusted ? 'reglages' : ''),
    series: args.series,
    durationMs: Math.round(args.durationMs),
  }
}
