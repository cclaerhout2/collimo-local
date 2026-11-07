/**
 * Cases en forme : bibliothèque de formes (dans un carré unité 0–1) et générateurs pour composer
 * les dispositions du catalogue (puzzle, camembert, ruche, coupes courbes, déchirures…).
 * Toutes les coordonnées des cases sont relatives au cadre du collage (0–1).
 */
import { polyPath, type Pt } from './path'

export const SHAPE_NAMES = [
  'circle', 'heart', 'star', 'star6', 'hexagon', 'hexagon-flat', 'diamond', 'triangle', 'triangle-down',
  'rounded', 'arch', 'leaf', 'petal', 'drop', 'flower', 'flower6', 'clover', 'spade', 'club',
  'bear', 'pumpkin', 'popsicle', 'cone', 'octagon', 'cross', 'shield', 'cloud',
] as const

export type ShapeName = (typeof SHAPE_NAMES)[number]

/**
 * Case d'une disposition.
 * - rect  : rectangle (comme les dispositions de l'étape 2) ;
 * - poly  : polygone, coordonnées du cadre ;
 * - path  : chemin SVG, coordonnées du cadre (plusieurs morceaux possibles : une photo vue à travers plusieurs fenêtres) ;
 * - shape : forme de la bibliothèque posée dans un rectangle, proportions gardées (sauf `stretch`).
 */
export type CellDef = (
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'poly'; points: Pt[]; cuts?: (EdgeCut | null)[] }
  | { kind: 'path'; d: string; evenodd?: boolean }
  | { kind: 'shape'; shape: ShapeName; x: number; y: number; w: number; h: number; rotate?: number; stretch?: boolean }
) & {
  /** Case posée volontairement sur une autre (médaillon) : chevauchement accepté, anneau d'écart tracé. */
  over?: boolean
}

/**
 * Coupe spéciale sur un côté de polygone (côté i = du point i au point i + 1).
 * Deux cases voisines qui partagent un côté avec la même coupe ont exactement le même bord.
 */
export interface EdgeCut {
  kind: EdgeKind
  amp?: number
  n?: number
  seed?: number
}

/** Élément de décor sans photo (perforations d'une pellicule, cadre d'appareil photo…). */
export interface Decor {
  d: string
  fill: 'ink' | 'white' | 'bg'
  evenodd?: boolean
}

// --- Bibliothèque (carré unité) ---

const K = 0.5523 // Bézier d'un quart de cercle

function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * K
  const ky = ry * K
  return (
    `M${cx} ${cy - ry}C${cx + kx} ${cy - ry} ${cx + rx} ${cy - ky} ${cx + rx} ${cy}` +
    `C${cx + rx} ${cy + ky} ${cx + kx} ${cy + ry} ${cx} ${cy + ry}` +
    `C${cx - kx} ${cy + ry} ${cx - rx} ${cy + ky} ${cx - rx} ${cy}` +
    `C${cx - rx} ${cy - ky} ${cx - kx} ${cy - ry} ${cx} ${cy - ry}Z`
  )
}

function regular(n: number, rOut: number, rIn: number | null, cx = 0.5, cy = 0.5, rot = -Math.PI / 2): string {
  const pts: Pt[] = []
  const steps = rIn === null ? n : n * 2
  for (let i = 0; i < steps; i++) {
    const r = rIn === null || i % 2 === 0 ? rOut : rIn
    const a = rot + (i * 2 * Math.PI) / steps
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return polyPath(pts)
}

/** Fleur à n pétales ronds. */
function lobes(n: number, rCenter: number, rPetal: number): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    d += ellipse(0.5 + rCenter * Math.cos(a), 0.5 + rCenter * Math.sin(a), rPetal, rPetal)
  }
  return d + ellipse(0.5, 0.5, rCenter * 1.05, rCenter * 1.05)
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const k = r * (1 - K)
  return (
    `M${x + r} ${y}H${x + w - r}C${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r}V${y + h - r}` +
    `C${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h}H${x + r}C${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r}` +
    `V${y + r}C${x} ${y + k} ${x + k} ${y} ${x + r} ${y}Z`
  )
}

const HEART = 'M0.5 1C0.18 0.78 0 0.56 0 0.32C0 0.14 0.14 0 0.29 0C0.39 0 0.46 0.05 0.5 0.14C0.54 0.05 0.61 0 0.71 0C0.86 0 1 0.14 1 0.32C1 0.56 0.82 0.78 0.5 1Z'

export const SHAPES: Record<ShapeName, string> = {
  circle: ellipse(0.5, 0.5, 0.5, 0.5),
  heart: HEART,
  star: regular(5, 0.5, 0.21, 0.5, 0.54),
  star6: regular(6, 0.5, 0.29),
  hexagon: polyPath([[0.5, 0], [0.933, 0.25], [0.933, 0.75], [0.5, 1], [0.067, 0.75], [0.067, 0.25]]),
  'hexagon-flat': polyPath([[0, 0.5], [0.25, 0.067], [0.75, 0.067], [1, 0.5], [0.75, 0.933], [0.25, 0.933]]),
  diamond: polyPath([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]),
  triangle: polyPath([[0.5, 0], [1, 1], [0, 1]]),
  'triangle-down': polyPath([[0, 0], [1, 0], [0.5, 1]]),
  octagon: regular(8, 0.5, null, 0.5, 0.5, -Math.PI / 8),
  rounded: roundedRect(0, 0, 1, 1, 0.18),
  arch: 'M0 1V0.5C0 0.22 0.22 0 0.5 0C0.78 0 1 0.22 1 0.5V1Z',
  leaf: 'M0.5 0C0.86 0.22 0.9 0.72 0.5 1C0.1 0.72 0.14 0.22 0.5 0Z',
  petal: 'M0.5 0C0.95 0.3 0.8 1 0.5 1C0.2 1 0.05 0.3 0.5 0Z',
  drop: 'M0.5 0C0.62 0.25 0.9 0.45 0.9 0.68C0.9 0.88 0.72 1 0.5 1C0.28 1 0.1 0.88 0.1 0.68C0.1 0.45 0.38 0.25 0.5 0Z',
  flower: lobes(5, 0.22, 0.27),
  flower6: lobes(6, 0.24, 0.24),
  clover: lobes(4, 0.24, 0.26),
  spade: 'M0.5 0C0.62 0.18 1 0.36 1 0.6C1 0.76 0.88 0.86 0.74 0.86C0.64 0.86 0.56 0.82 0.53 0.76L0.6 1H0.4L0.47 0.76C0.44 0.82 0.36 0.86 0.26 0.86C0.12 0.86 0 0.76 0 0.6C0 0.36 0.38 0.18 0.5 0Z',
  club: ellipse(0.5, 0.25, 0.23, 0.23) + ellipse(0.25, 0.58, 0.23, 0.23) + ellipse(0.75, 0.58, 0.23, 0.23) + 'M0.44 0.5L0.38 1H0.62L0.56 0.5Z',
  bear: ellipse(0.5, 0.58, 0.42, 0.4) + ellipse(0.2, 0.2, 0.17, 0.17) + ellipse(0.8, 0.2, 0.17, 0.17),
  pumpkin: ellipse(0.32, 0.6, 0.27, 0.36) + ellipse(0.68, 0.6, 0.27, 0.36) + ellipse(0.5, 0.6, 0.27, 0.38) + 'M0.46 0.26L0.48 0.06H0.56L0.54 0.26Z',
  popsicle: roundedRect(0.2, 0, 0.6, 0.78, 0.3) + 'M0.44 0.74H0.56V1H0.44Z',
  cone: ellipse(0.5, 0.3, 0.32, 0.3) + 'M0.2 0.38H0.8L0.5 1Z',
  cross: polyPath([[0.33, 0], [0.67, 0], [0.67, 0.33], [1, 0.33], [1, 0.67], [0.67, 0.67], [0.67, 1], [0.33, 1], [0.33, 0.67], [0, 0.67], [0, 0.33], [0.33, 0.33]]),
  shield: 'M0.5 0L1 0.15V0.5C1 0.76 0.78 0.92 0.5 1C0.22 0.92 0 0.76 0 0.5V0.15Z',
  cloud: ellipse(0.3, 0.6, 0.26, 0.24) + ellipse(0.55, 0.42, 0.3, 0.3) + ellipse(0.76, 0.62, 0.22, 0.22) + 'M0.3 0.84H0.76V0.6H0.3Z',
}

// --- Raccourcis pour écrire le catalogue ---

export const rect = (x: number, y: number, w: number, h: number): CellDef => ({ kind: 'rect', x, y, w, h })
export const poly = (...points: Pt[]): CellDef => ({ kind: 'poly', points })
export const path = (d: string, evenodd = false): CellDef => ({ kind: 'path', d, evenodd })
export const shape = (s: ShapeName, x: number, y: number, w: number, h: number, opts: { rotate?: number; stretch?: boolean } = {}): CellDef => ({
  kind: 'shape',
  shape: s,
  x,
  y,
  w,
  h,
  ...opts,
})
/** Forme centrée en (cx, cy), de largeur et hauteur `size` (relatives au cadre). */
export const shapeAt = (s: ShapeName, cx: number, cy: number, size: number, opts: { rotate?: number; stretch?: boolean; h?: number } = {}): CellDef =>
  shape(s, cx - size / 2, cy - (opts.h ?? size) / 2, size, opts.h ?? size, opts)

// --- Coupes entre deux zones ---

export type EdgeKind = 'line' | 'curve' | 'wave' | 'zigzag' | 'lightning' | 'torn'

/** Pseudo-hasard déterministe (même dessin à chaque fois). */
function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/**
 * Bord de A vers B (commandes SVG absolues, sans le point de départ).
 * `amp` = amplitude relative à la longueur du bord ; `n` = nombre d'ondulations ou de dents.
 */
export function edge(a: Pt, b: Pt, kind: EdgeKind, amp = 0.06, n = 3, seed = 7): string {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const at = (t: number, o: number): Pt => [a[0] + dx * t + nx * o * len, a[1] + dy * t + ny * o * len]
  const P = (p: Pt) => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`
  if (kind === 'line') return `L${P(b)}`
  if (kind === 'curve') return `C${P(at(0.33, amp * 2))} ${P(at(0.66, -amp * 2))} ${P(b)}`
  if (kind === 'wave') {
    let d = ''
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = (i + 1) / n
      const s = i % 2 ? -1 : 1
      d += `C${P(at(t0 + (t1 - t0) * 0.36, amp * 1.4 * s))} ${P(at(t0 + (t1 - t0) * 0.64, amp * 1.4 * s))} ${P(at(t1, 0))}`
    }
    return d
  }
  if (kind === 'zigzag') {
    let d = ''
    for (let i = 0; i < n * 2; i++) d += `L${P(at((i + 0.5) / (n * 2), i % 2 ? -amp : amp))}`
    return d + `L${P(b)}`
  }
  if (kind === 'lightning') return `L${P(at(0.42, amp * 1.6))}L${P(at(0.5, -amp * 0.8))}L${P(at(0.58, amp * 0.8))}L${P(at(0.66, -amp * 1.4))}L${P(b)}`
  const rnd = seeded(seed)
  let d = ''
  const steps = Math.max(8, n * 10)
  for (let i = 1; i < steps; i++) d += `L${P(at(i / steps + (rnd() - 0.5) * 0.4 / steps, (rnd() - 0.5) * amp * 1.2))}`
  return d + `L${P(b)}`
}

/** Coupe verticale de (xTop, 0) à (xBottom, 1) : [zone gauche, zone droite]. */
export function vCut(xTop: number, xBottom: number, kind: EdgeKind, amp?: number, n?: number, seed?: number): [CellDef, CellDef] {
  const e = edge([xTop, 0], [xBottom, 1], kind, amp, n, seed)
  return [path(`M${xTop} 0${e}L0 1L0 0Z`), path(`M${xTop} 0${e}L1 1L1 0Z`)]
}

/** Coupe horizontale de (0, yLeft) à (1, yRight) : [zone haute, zone basse]. */
export function hCut(yLeft: number, yRight: number, kind: EdgeKind, amp?: number, n?: number, seed?: number): [CellDef, CellDef] {
  const e = edge([0, yLeft], [1, yRight], kind, amp, n, seed)
  return [path(`M0 ${yLeft}${e}L1 0L0 0Z`), path(`M0 ${yLeft}${e}L1 1L0 1Z`)]
}

/** Bandes séparées par des coupes : positions des coupes en haut (`tops`) et en bas (`bottoms`). */
export function vBands(tops: number[], bottoms: number[], kind: EdgeKind = 'line', amp?: number, n?: number): CellDef[] {
  const xsT = [0, ...tops, 1]
  const xsB = [0, ...bottoms, 1]
  const out: CellDef[] = []
  for (let i = 0; i < xsT.length - 1; i++) {
    const left = i === 0 ? `L0 1` : edge([xsT[i], 0], [xsB[i], 1], kind, amp, n, i * 13)
    const right = i === xsT.length - 2 ? `L1 0` : reverseEdge([xsT[i + 1], 0], [xsB[i + 1], 1], kind, amp, n, (i + 1) * 13)
    out.push(path(`M${xsT[i]} 0${left}L${xsB[i + 1]} 1${right}Z`))
  }
  return out
}

/** Comme vBands, à l'horizontale. */
export function hBands(lefts: number[], rights: number[], kind: EdgeKind = 'line', amp?: number, n?: number): CellDef[] {
  const ysL = [0, ...lefts, 1]
  const ysR = [0, ...rights, 1]
  const out: CellDef[] = []
  for (let i = 0; i < ysL.length - 1; i++) {
    const top = i === 0 ? `L1 0` : edge([0, ysL[i]], [1, ysR[i]], kind, amp, n, i * 17)
    const bottom = i === ysL.length - 2 ? `L0 1` : reverseEdge([0, ysL[i + 1]], [1, ysR[i + 1]], kind, amp, n, (i + 1) * 17)
    out.push(path(`M0 ${ysL[i]}${top}L1 ${ysR[i + 1]}${bottom}Z`))
  }
  return out
}

/** Même bord que `edge(a, b)`, parcouru de B vers A (pour fermer une zone entre deux bords). */
export function reverseEdge(a: Pt, b: Pt, kind: EdgeKind, amp?: number, n?: number, seed?: number): string {
  const d = `M${a[0]} ${a[1]}${edge(a, b, kind, amp, n, seed)}`
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const cmds = d.match(/[MLC]/g) ?? []
  // Reconstruit la liste des points puis la parcourt à l'envers.
  type Step = { c: string; pts: Pt[] }
  const steps: Step[] = []
  let k = 0
  for (const c of cmds) {
    const count = c === 'C' ? 3 : 1
    const pts: Pt[] = []
    for (let j = 0; j < count; j++) pts.push([nums[k++], nums[k++]])
    steps.push({ c, pts })
  }
  let out = ''
  for (let i = steps.length - 1; i > 0; i--) {
    const s = steps[i]
    const prevEnd = steps[i - 1].pts.at(-1)!
    if (s.c === 'C') out += `C${s.pts[1][0]} ${s.pts[1][1]} ${s.pts[0][0]} ${s.pts[0][1]} ${prevEnd[0]} ${prevEnd[1]}`
    else out += `L${prevEnd[0]} ${prevEnd[1]}`
  }
  return out
}

// --- Puzzle ---

/** Grille de pièces de puzzle imbriquées (cols × rows) dans la zone donnée. */
export function puzzle(cols: number, rows: number, area = { x: 0, y: 0, w: 1, h: 1 }, seed = 3): CellDef[] {
  const rnd = seeded(seed)
  const cw = area.w / cols
  const ch = area.h / rows
  // Sens des tenons : +1 ou -1 pour chaque bord intérieur.
  const vTab = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => (rnd() < 0.5 ? 1 : -1)))
  const hTab = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => (rnd() < 0.5 ? 1 : -1)))
  const P = (p: Pt) => `${p[0].toFixed(4)} ${p[1].toFixed(4)}`
  /** Bord de a à b avec tenon de sens s (vers la gauche du trajet si s = 1). */
  const tab = (a: Pt, b: Pt, s: number) => {
    if (!s) return `L${P(b)}`
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    const nx = (-dy / len) * s
    const ny = (dx / len) * s
    const at = (t: number, o: number): Pt => [a[0] + dx * t + nx * o * len, a[1] + dy * t + ny * o * len]
    return `L${P(at(0.36, 0))}C${P(at(0.4, 0.06))} ${P(at(0.3, 0.24))} ${P(at(0.5, 0.24))}C${P(at(0.7, 0.24))} ${P(at(0.6, 0.06))} ${P(at(0.64, 0))}L${P(b)}`
  }
  const out: CellDef[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x0 = area.x + c * cw
      const y0 = area.y + r * ch
      const x1 = x0 + cw
      const y1 = y0 + ch
      const top = r === 0 ? 0 : -hTab[r - 1][c]
      const right = c === cols - 1 ? 0 : vTab[r][c]
      const bottom = r === rows - 1 ? 0 : hTab[r][c]
      const left = c === 0 ? 0 : -vTab[r][c - 1]
      out.push(
        path(
          `M${P([x0, y0])}` +
            tab([x0, y0], [x1, y0], -top) +
            tab([x1, y0], [x1, y1], -right) +
            tab([x1, y1], [x0, y1], -bottom) +
            tab([x0, y1], [x0, y0], -left) +
            'Z',
        ),
      )
    }
  return out
}

// --- Camembert, éventail ---

/** Point où le rayon parti de (cx, cy) dans la direction `a` sort du cadre 0–1. */
function rayToFrame(cx: number, cy: number, a: number): Pt {
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const ts = [dx > 0 ? (1 - cx) / dx : dx < 0 ? -cx / dx : Infinity, dy > 0 ? (1 - cy) / dy : dy < 0 ? -cy / dy : Infinity]
  const t = Math.min(...ts)
  return [cx + dx * t, cy + dy * t]
}

/** n parts autour de (cx, cy), jusqu'aux bords du cadre ; `start` en degrés (0 = vers le haut). */
export function pie(n: number, cx = 0.5, cy = 0.5, start = 0): CellDef[] {
  const corners: Pt[] = [[1, 0], [1, 1], [0, 1], [0, 0]]
  const angleOf = (p: Pt) => Math.atan2(p[1] - cy, p[0] - cx)
  const out: CellDef[] = []
  for (let i = 0; i < n; i++) {
    const a0 = ((start - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / n
    const a1 = a0 + (2 * Math.PI) / n
    const pts: Pt[] = [[cx, cy], rayToFrame(cx, cy, a0)]
    const norm = (a: number) => ((a - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
    corners
      .map((c) => ({ c, t: norm(angleOf(c)) }))
      .filter((x) => x.t > 0 && x.t < a1 - a0)
      .sort((x, y) => x.t - y.t)
      .forEach((x) => pts.push(x.c))
    pts.push(rayToFrame(cx, cy, a1))
    out.push({ kind: 'poly', points: pts })
  }
  return out
}

/** Disque découpé en n parts (dans le cercle de centre (cx, cy) et de rayon r). */
export function pieDisc(n: number, cx = 0.5, cy = 0.5, r = 0.5, start = 0): CellDef[] {
  const out: CellDef[] = []
  for (let i = 0; i < n; i++) {
    const a0 = ((start - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / n
    const a1 = a0 + (2 * Math.PI) / n
    // Arc découpé en segments de 45° au plus, chacun approché par une Bézier.
    const steps = Math.max(1, Math.ceil((a1 - a0) / (Math.PI / 4)))
    const da = (a1 - a0) / steps
    const k = (4 / 3) * Math.tan(da / 4)
    let d = `M${cx} ${cy}L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}`
    for (let s = 0; s < steps; s++) {
      const b0 = a0 + s * da
      const b1 = b0 + da
      const p0: Pt = [cx + r * Math.cos(b0), cy + r * Math.sin(b0)]
      const p3: Pt = [cx + r * Math.cos(b1), cy + r * Math.sin(b1)]
      const p1: Pt = [p0[0] - k * r * Math.sin(b0), p0[1] + k * r * Math.cos(b0)]
      const p2: Pt = [p3[0] + k * r * Math.sin(b1), p3[1] - k * r * Math.cos(b1)]
      d += `C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`
    }
    out.push(path(d + 'Z'))
  }
  return out
}

// --- Ruche ---

/**
 * Hexagones pointe en haut, en rangées décalées. `cells` = positions [colonne, rangée] ;
 * `size` = largeur d'un hexagone ; (x0, y0) = centre de la case [0, 0].
 */
export function hexes(cells: [number, number][], size: number, x0: number, y0: number): CellDef[] {
  const w = size
  const h = size / 0.866
  return cells.map(([c, r]) => {
    const cx = x0 + c * w + (r % 2 ? w / 2 : 0)
    const cy = y0 + r * h * 0.75
    return shape('hexagon', cx - h / 2, cy - h / 2, h, h)
  })
}

/** Formes identiques en grille régulière (cols × rows) dans la zone, avec une marge relative. */
export function shapeGrid(s: ShapeName, cols: number, rows: number, area = { x: 0, y: 0, w: 1, h: 1 }, pad = 0.08): CellDef[] {
  const cw = area.w / cols
  const ch = area.h / rows
  const size = Math.min(cw, ch) * (1 - pad)
  const out: CellDef[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(shapeAt(s, area.x + cw * (c + 0.5), area.y + ch * (r + 0.5), size))
  return out
}

/** Formes sur un cercle (couronne) : n formes de taille `size`, rayon `radius`. */
export function ring(s: ShapeName, n: number, size: number, radius: number, cx = 0.5, cy = 0.5, start = 0): CellDef[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start - 90) * Math.PI) / 180 + (i * 2 * Math.PI) / n
    return shapeAt(s, cx + radius * Math.cos(a), cy + radius * Math.sin(a), size)
  })
}

// --- Découpes du cadre par des droites ---

/** Coupe un polygone convexe par la droite (a, b) : [côté gauche, côté droit] (vides possibles). */
export function splitPoly(poly: Pt[], a: Pt, b: Pt): [Pt[], Pt[]] {
  const side = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    const sp = side(p)
    const sq = side(q)
    if (sp >= 0) left.push(p)
    if (sp <= 0) right.push(p)
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq)
      const x: Pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      left.push(x)
      right.push(x)
    }
  }
  return [left, right]
}

const polyArea = (p: Pt[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1] }, 0)) / 2
const centroid = (p: Pt[]): Pt => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]

/** Cases dans l'ordre de lecture : par rangées (haut → bas, puis gauche → droite), ou par colonnes. */
export function readingOrder(polys: Pt[][], by: 'rows' | 'cols' = 'rows', tol = 0.08): Pt[][] {
  return [...polys].sort((p, q) => {
    const [px, py] = centroid(p)
    const [qx, qy] = centroid(q)
    if (by === 'rows') return Math.abs(py - qy) > tol ? py - qy : px - qx
    return Math.abs(px - qx) > tol ? px - qx : py - qy
  })
}

/**
 * Découpe le cadre par des droites infinies (chacune donnée par deux points) et renvoie les zones,
 * dans l'ordre de lecture. Pour les diagonales, X, éventails, bandes obliques.
 */
export function cutFrame(lines: [Pt, Pt][], by: 'rows' | 'cols' = 'rows'): CellDef[] {
  const frame: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  let polys: Pt[][] = [frame]
  for (const [a, b] of lines) polys = polys.flatMap((p) => splitPoly(p, a, b)).filter((p) => p.length >= 3 && polyArea(p) > 1e-4)
  return readingOrder(polys, by).map((points) => ({ kind: 'poly', points }))
}

/** Points d'un bord droit, en zigzag ou déchiré (pour les assembler en polygones). */
export function edgePoints(a: Pt, b: Pt, kind: 'line' | 'zigzag' | 'torn', amp = 0.03, n = 4, seed = 5): Pt[] {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  if (kind === 'line') return [a, b]
  const rnd = seeded(seed)
  const steps = kind === 'zigzag' ? n * 2 : Math.max(10, n * 8)
  const pts: Pt[] = [a]
  for (let i = 1; i < steps; i++) {
    const o = kind === 'zigzag' ? (i % 2 ? amp : -amp) : (rnd() - 0.5) * amp * 1.2
    pts.push([a[0] + dx * (i / steps) + nx * o * len, a[1] + dy * (i / steps) + ny * o * len])
  }
  pts.push(b)
  return pts
}

/** Cadre coupé par une verticale et une horizontale qui se croisent en (x, y), bords déchirés ou en zigzag : 4 cases (HG, HD, BG, BD). */
export function crossCut(x: number, y: number, kind: 'line' | 'zigzag' | 'torn' = 'torn', amp = 0.03): CellDef[] {
  const top = edgePoints([x, 0], [x, y], kind, amp, 3, 11)
  const bottom = edgePoints([x, y], [x, 1], kind, amp, 3, 12)
  const left = edgePoints([0, y], [x, y], kind, amp, 3, 13)
  const right = edgePoints([x, y], [1, y], kind, amp, 3, 14)
  const rev = (p: Pt[]) => [...p].reverse()
  const cell = (pts: Pt[]): CellDef => ({ kind: 'poly', points: pts })
  return [
    cell([[0, 0], ...top, ...rev(left)]),
    cell([[1, 0], ...rev(right), ...rev(top)]),
    cell([...left, ...bottom, [0, 1]]),
    cell([[1, 1], ...rev(bottom), ...right]),
  ]
}

/** Répète une case dessinée dans le quart haut-gauche dans les quatre quarts (miroirs) : HG, HD, BG, BD. */
export function mirror4(d: string): CellDef[] {
  const flip = (sx: boolean, sy: boolean) =>
    d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, a: string, b: string) => `${sx ? 1 - Number(a) : Number(a)} ${sy ? 1 - Number(b) : Number(b)}`)
  return [path(d), path(flip(true, false)), path(flip(false, true)), path(flip(true, true))]
}

const before = (a: Pt, b: Pt) => a[0] < b[0] - 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] < b[1])

/**
 * Chemin d'un polygone dont certains côtés portent une coupe spéciale. Chaque côté est calculé dans
 * un sens fixe (du plus petit point au plus grand) : la case voisine, qui le parcourt à l'envers,
 * obtient le même tracé.
 */
export function polyCutPath(points: Pt[], cuts: (EdgeCut | null)[]): string {
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const cut = cuts[i]
    if (!cut || cut.kind === 'line') {
      d += `L${b[0]} ${b[1]}`
      continue
    }
    d += before(a, b) ? edge(a, b, cut.kind, cut.amp, cut.n, cut.seed) : reverseEdge(b, a, cut.kind, cut.amp, cut.n, cut.seed)
  }
  return d + 'Z'
}
