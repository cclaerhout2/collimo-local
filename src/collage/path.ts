/**
 * Petits outils sur les chemins SVG des cases en forme : lecture, transformation, boîte englobante.
 * Commandes acceptées : M L H V C S Q T Z, absolues et relatives (pas d'arcs A : les courbes
 * de la bibliothèque sont en Bézier).
 */

/** Point [x, y], dans les unités du chemin (relatives au cadre ou au carré unité, selon l'usage). */
export type Pt = [number, number]

/** Segment absolu, après lecture. */
export type Seg = { c: 'M' | 'L'; p: Pt } | { c: 'C'; p1: Pt; p2: Pt; p: Pt } | { c: 'Q'; p1: Pt; p: Pt } | { c: 'Z' }

/** Erreur levée quand un chemin SVG est mal écrit ou utilise une commande non prise en charge. */
export class PathSyntaxError extends Error {}

/**
 * Lit un chemin SVG et le convertit en segments absolus.
 * Les commandes H et V deviennent des L, S devient C et T devient Q (points de contrôle reflétés).
 * @param d - chemin SVG (attribut `d`)
 * @returns les segments, en coordonnées absolues
 * @throws {@link PathSyntaxError} si le chemin est mal écrit ou contient une commande non prise en charge (arcs A)
 */
export function parsePath(d: string): Seg[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  const out: Seg[] = []
  let i = 0
  let cmd = ''
  let cur: Pt = [0, 0]
  let start: Pt = [0, 0]
  let lastCtrl: Pt | null = null
  let lastQ: Pt | null = null
  const num = () => {
    const t = tokens[i++]
    if (t === undefined || /[a-zA-Z]/.test(t)) throw new PathSyntaxError(`chemin « ${d.slice(0, 40)} » : nombre attendu`)
    return Number(t)
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    else if (!cmd) throw new PathSyntaxError(`chemin « ${d.slice(0, 40)} » : commande attendue`)
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const pt = (): Pt => {
      const x = num()
      const y = num()
      return rel ? [cur[0] + x, cur[1] + y] : [x, y]
    }
    if (C === 'M') {
      cur = pt()
      start = cur
      out.push({ c: 'M', p: cur })
      cmd = rel ? 'l' : 'L'
      lastCtrl = lastQ = null
    } else if (C === 'L') {
      cur = pt()
      out.push({ c: 'L', p: cur })
      lastCtrl = lastQ = null
    } else if (C === 'H') {
      const x = num()
      cur = [rel ? cur[0] + x : x, cur[1]]
      out.push({ c: 'L', p: cur })
      lastCtrl = lastQ = null
    } else if (C === 'V') {
      const y = num()
      cur = [cur[0], rel ? cur[1] + y : y]
      out.push({ c: 'L', p: cur })
      lastCtrl = lastQ = null
    } else if (C === 'C' || C === 'S') {
      const p1: Pt = C === 'C' ? pt() : lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur
      const p2 = pt()
      const p = pt()
      out.push({ c: 'C', p1, p2, p })
      lastCtrl = p2
      lastQ = null
      cur = p
    } else if (C === 'Q' || C === 'T') {
      const p1: Pt = C === 'Q' ? pt() : lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur
      const p = pt()
      out.push({ c: 'Q', p1, p })
      lastQ = p1
      lastCtrl = null
      cur = p
    } else if (C === 'Z') {
      out.push({ c: 'Z' })
      cur = start
      lastCtrl = lastQ = null
    } else throw new PathSyntaxError(`chemin : commande « ${cmd} » non prise en charge`)
  }
  return out
}

/**
 * Nombre arrondi au millième, écrit sans zéros inutiles.
 * @param v - nombre à écrire
 * @returns le texte du nombre
 */
const f = (v: number) => (Math.round(v * 1000) / 1000).toString()

/**
 * Réécrit des segments en chemin SVG, coordonnées arrondies au millième.
 * @param segs - segments absolus
 * @returns le chemin SVG (attribut `d`)
 */
export function serializePath(segs: Seg[]): string {
  return segs
    .map((s) =>
      s.c === 'Z'
        ? 'Z'
        : s.c === 'C'
          ? `C${f(s.p1[0])} ${f(s.p1[1])} ${f(s.p2[0])} ${f(s.p2[1])} ${f(s.p[0])} ${f(s.p[1])}`
          : s.c === 'Q'
            ? `Q${f(s.p1[0])} ${f(s.p1[1])} ${f(s.p[0])} ${f(s.p[1])}`
            : `${s.c}${f(s.p[0])} ${f(s.p[1])}`,
    )
    .join('')
}

/**
 * Applique une transformation à tous les points d'un chemin (extrémités et points de contrôle).
 * @param segs - segments absolus
 * @param fn - transformation d'un point
 * @returns les nouveaux segments
 */
export function mapPath(segs: Seg[], fn: (p: Pt) => Pt): Seg[] {
  return segs.map((s) =>
    s.c === 'Z'
      ? s
      : s.c === 'C'
        ? { c: 'C', p1: fn(s.p1), p2: fn(s.p2), p: fn(s.p) }
        : s.c === 'Q'
          ? { c: 'Q', p1: fn(s.p1), p: fn(s.p) }
          : { c: s.c, p: fn(s.p) },
  )
}

/**
 * Boîte englobante d'un chemin, calculée sur les points de contrôle :
 * un peu large sur les courbes, jamais trop petite.
 * @param segs - segments absolus
 * @returns la boîte, dans les unités du chemin (vide en 0, 0 si le chemin n'a aucun point)
 */
export function pathBBox(segs: Seg[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = ([x, y]: Pt) => {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  for (const s of segs) {
    if (s.c === 'Z') continue
    add(s.p)
    if (s.c === 'C') {
      add(s.p1)
      add(s.p2)
    } else if (s.c === 'Q') add(s.p1)
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Polygone fermé en notation SVG.
 * @param points - sommets du polygone
 * @returns le chemin SVG fermé
 */
export function polyPath(points: Pt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + 'Z'
}
