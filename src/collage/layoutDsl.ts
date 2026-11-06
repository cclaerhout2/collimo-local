import type { Rect } from './types'

/**
 * Découpe imbriquée, notation compacte :
 *   x            une case
 *   c(a, b, …)   colonnes côte à côte
 *   r(a, b, …)   lignes empilées
 *   2*a          poids relatif (1 par défaut)
 * Exemple : « c(2*x, r(x, x)) » = une grande case à gauche, deux petites empilées à droite.
 */
export type SplitNode = { kind: 'leaf' } | { kind: 'split'; dir: 'c' | 'r'; children: { weight: number; node: SplitNode }[] }
type Node = SplitNode

export class LayoutSyntaxError extends Error {
  constructor(spec: string, pos: number, expected: string) {
    super(`Disposition « ${spec} » : ${expected} attendu en position ${pos}`)
    this.name = 'LayoutSyntaxError'
  }
}

export function parseSplit(spec: string): Node {
  const src = spec.replace(/\s+/g, '')
  let i = 0

  const peek = () => src[i]
  const expect = (ch: string) => {
    if (src[i] !== ch) throw new LayoutSyntaxError(spec, i, `« ${ch} »`)
    i++
  }

  function number(): number | null {
    const m = /^\d+(\.\d+)?/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    return Number(m[0])
  }

  function item(): { weight: number; node: Node } {
    const start = i
    const n = number()
    if (n !== null) {
      if (peek() !== '*') {
        i = start
        throw new LayoutSyntaxError(spec, i, '« * » après un poids')
      }
      i++
      if (!(n > 0)) throw new LayoutSyntaxError(spec, start, 'un poids positif')
    }
    return { weight: n ?? 1, node: node() }
  }

  function node(): Node {
    const ch = peek()
    if (ch === 'x') {
      i++
      return { kind: 'leaf' }
    }
    if (ch === 'c' || ch === 'r') {
      i++
      expect('(')
      const children = [item()]
      while (peek() === ',') {
        i++
        children.push(item())
      }
      expect(')')
      return { kind: 'split', dir: ch, children }
    }
    throw new LayoutSyntaxError(spec, i, '« x », « c( » ou « r( »')
  }

  const root = node()
  if (i !== src.length) throw new LayoutSyntaxError(spec, i, 'la fin')
  return root
}

/** Cases d'une découpe, dans l'ordre de lecture (profondeur d'abord), relatives au carré unité. */
export function splitToRects(spec: string, area: Rect = { x: 0, y: 0, w: 1, h: 1 }): Rect[] {
  const out: Rect[] = []
  const walk = (n: Node, r: Rect) => {
    if (n.kind === 'leaf') {
      out.push(r)
      return
    }
    const total = n.children.reduce((s, c) => s + c.weight, 0)
    let offset = 0
    for (const c of n.children) {
      const share = c.weight / total
      const child =
        n.dir === 'c'
          ? { x: r.x + offset * r.w, y: r.y, w: share * r.w, h: r.h }
          : { x: r.x, y: r.y + offset * r.h, w: r.w, h: share * r.h }
      offset += share
      walk(c.node, child)
    }
  }
  walk(parseSplit(spec), area)
  return out
}

const fmt = (w: number) => (Math.abs(w - 1) < 1e-9 ? '' : `${Number(w.toFixed(4))}*`)

/** Réécrit un arbre en notation compacte (poids arrondis à 4 décimales). */
export function serializeSplit(node: SplitNode): string {
  if (node.kind === 'leaf') return 'x'
  return `${node.dir}(${node.children.map((c) => fmt(c.weight) + serializeSplit(c.node)).join(',')})`
}

/**
 * Une séparation déplaçable : la frontière entre l'enfant `index` et l'enfant `index + 1`
 * d'un nœud de découpe. `dir` = 'c' → trait vertical à l'abscisse `pos` ; 'r' → trait horizontal.
 */
export interface Divider {
  path: number[]
  index: number
  dir: 'c' | 'r'
  /** Position du trait, relative au cadre (0 à 1). */
  pos: number
  /** Étendue du trait le long de l'autre axe. */
  from: number
  to: number
  /** Bornes que le trait ne peut pas dépasser : début du premier enfant, fin du second. */
  min: number
  max: number
}

export function dividers(spec: string): Divider[] {
  const out: Divider[] = []
  const walk = (n: SplitNode, r: Rect, path: number[]) => {
    if (n.kind === 'leaf') return
    const total = n.children.reduce((s, c) => s + c.weight, 0)
    let offset = 0
    const starts: number[] = []
    n.children.forEach((c) => {
      starts.push(offset)
      offset += c.weight / total
    })
    n.children.forEach((c, i) => {
      const share = c.weight / total
      const childRect =
        n.dir === 'c'
          ? { x: r.x + starts[i] * r.w, y: r.y, w: share * r.w, h: r.h }
          : { x: r.x, y: r.y + starts[i] * r.h, w: r.w, h: share * r.h }
      if (i < n.children.length - 1) {
        const next = n.children[i + 1].weight / total
        if (n.dir === 'c') {
          const pos = r.x + (starts[i] + share) * r.w
          out.push({ path, index: i, dir: 'c', pos, from: r.y, to: r.y + r.h, min: r.x + starts[i] * r.w, max: pos + next * r.w })
        } else {
          const pos = r.y + (starts[i] + share) * r.h
          out.push({ path, index: i, dir: 'r', pos, from: r.x, to: r.x + r.w, min: r.y + starts[i] * r.h, max: pos + next * r.h })
        }
      }
      walk(c.node, childRect, [...path, i])
    })
  }
  walk(parseSplit(spec), { x: 0, y: 0, w: 1, h: 1 }, [])
  return out
}

/** Part minimale d'une case quand on déplace une séparation (part des deux cases concernées). */
export const MIN_SHARE = 0.12

/** Déplace une séparation à la position `pos` (relative au cadre) ; renvoie la nouvelle découpe. */
export function moveDivider(spec: string, d: Divider, pos: number): string {
  const root = parseSplit(spec)
  let node = root
  for (const i of d.path) {
    if (node.kind !== 'split') return spec
    node = node.children[i].node
  }
  if (node.kind !== 'split') return spec
  const a = node.children[d.index]
  const b = node.children[d.index + 1]
  const span = d.max - d.min
  if (!a || !b || span <= 0) return spec
  const f = Math.min(1 - MIN_SHARE, Math.max(MIN_SHARE, (pos - d.min) / span))
  const sum = a.weight + b.weight
  a.weight = sum * f
  b.weight = sum * (1 - f)
  return serializeSplit(root)
}
