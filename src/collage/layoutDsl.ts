import type { Rect } from './types'

/**
 * Découpe imbriquée, notation compacte :
 *   x            une case
 *   c(a, b, …)   colonnes côte à côte
 *   r(a, b, …)   lignes empilées
 *   2*a          poids relatif (1 par défaut)
 * Exemple : « c(2*x, r(x, x)) » = une grande case à gauche, deux petites empilées à droite.
 */
type Node = { kind: 'leaf' } | { kind: 'split'; dir: 'c' | 'r'; children: { weight: number; node: Node }[] }

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
