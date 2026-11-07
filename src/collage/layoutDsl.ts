/**
 * Petit langage des découpes imbriquées, en notation compacte :
 *   x            une case
 *   c(a, b, …)   colonnes côte à côte
 *   r(a, b, …)   lignes empilées
 *   2*a          poids relatif (1 par défaut)
 * Exemple : « c(2*x, r(x, x)) » = une grande case à gauche, deux petites empilées à droite.
 *
 * Lecture et réécriture, conversion en rectangles, et séparations déplaçables à la main.
 */
import type { Rect } from './types'

/** Arbre d'une découpe : une case (`leaf`), ou des colonnes (`c`) ou lignes (`r`) pondérées. */
export type SplitNode = { kind: 'leaf' } | { kind: 'split'; dir: 'c' | 'r'; children: { weight: number; node: SplitNode }[] }
/** Raccourci local de {@link SplitNode}. */
type Node = SplitNode

/** Erreur levée quand une découpe est mal écrite ; le message indique la position fautive. */
export class LayoutSyntaxError extends Error {
  /**
   * Construit le message d'erreur.
   * @param spec - découpe telle qu'elle a été écrite
   * @param pos - position de l'erreur, en caractères, espaces retirés
   * @param expected - ce qui était attendu à cette position
   */
  constructor(spec: string, pos: number, expected: string) {
    super(`Disposition « ${spec} » : ${expected} attendu en position ${pos}`)
    this.name = 'LayoutSyntaxError'
  }
}

/**
 * Lit une découpe écrite en notation compacte.
 * @param spec - découpe, par exemple `c(2*x, r(x, x))` ; les espaces sont ignorés
 * @returns l'arbre de la découpe
 * @throws {@link LayoutSyntaxError} si la découpe est mal écrite
 */
export function parseSplit(spec: string): Node {
  const src = spec.replace(/\s+/g, '')
  let i = 0

  /**
   * Caractère à la position courante, sans avancer.
   * @returns le caractère, ou `undefined` en fin de texte
   */
  const peek = () => src[i]
  /**
   * Vérifie le caractère à la position courante et avance d'un caractère.
   * @param ch - caractère attendu
   */
  const expect = (ch: string) => {
    if (src[i] !== ch) throw new LayoutSyntaxError(spec, i, `« ${ch} »`)
    i++
  }

  /**
   * Lit un poids (nombre positif, décimales permises) à la position courante.
   * @returns le nombre, ou `null` s'il n'y en a pas
   */
  function number(): number | null {
    const m = /^\d+(\.\d+)?/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    return Number(m[0])
  }

  /**
   * Lit un enfant d'une découpe : un poids facultatif suivi de `*`, puis un nœud.
   * @returns l'enfant, de poids 1 par défaut
   */
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

  /**
   * Lit un nœud : une case `x`, ou une découpe `c(…)` ou `r(…)`.
   * @returns le nœud
   */
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

/**
 * Cases d'une découpe, dans l'ordre de lecture (profondeur d'abord).
 * @param spec - découpe en notation compacte
 * @param area - zone à découper ; par défaut le carré unité (coordonnées relatives 0–1)
 * @returns une boîte par case
 * @throws {@link LayoutSyntaxError} si la découpe est mal écrite
 */
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

/**
 * Préfixe de poids d'un enfant dans la notation compacte.
 * @param w - poids
 * @returns `''` pour un poids de 1, sinon le poids arrondi à 4 décimales suivi de `*`
 */
const fmt = (w: number) => (Math.abs(w - 1) < 1e-9 ? '' : `${Number(w.toFixed(4))}*`)

/**
 * Réécrit un arbre en notation compacte (poids arrondis à 4 décimales).
 * @param node - arbre de la découpe
 * @returns la découpe, sans espaces
 */
export function serializeSplit(node: SplitNode): string {
  if (node.kind === 'leaf') return 'x'
  return `${node.dir}(${node.children.map((c) => fmt(c.weight) + serializeSplit(c.node)).join(',')})`
}

/**
 * Une séparation déplaçable : la frontière entre l'enfant `index` et l'enfant `index + 1`
 * d'un nœud de découpe. `dir` = 'c' → trait vertical à l'abscisse `pos` ; 'r' → trait horizontal.
 */
export interface Divider {
  /** Chemin du nœud de découpe depuis la racine : indice de l'enfant à chaque niveau. */
  path: number[]
  /** Indice du premier des deux enfants séparés. */
  index: number
  dir: 'c' | 'r'
  /** Position du trait, relative au cadre (0 à 1). */
  pos: number
  /** Début du trait le long de l'autre axe, relatif au cadre (0 à 1). */
  from: number
  /** Fin du trait le long de l'autre axe, relative au cadre (0 à 1). */
  to: number
  /** Borne basse du trait : début du premier enfant, relatif au cadre. */
  min: number
  /** Borne haute du trait : fin du second enfant, relative au cadre. */
  max: number
}

/**
 * Toutes les séparations déplaçables d'une découpe, avec leur position et leurs bornes.
 * @param spec - découpe en notation compacte
 * @returns les séparations, parcourues en profondeur d'abord
 * @throws {@link LayoutSyntaxError} si la découpe est mal écrite
 */
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

/**
 * Déplace une séparation à la position `pos`. Chacune des deux cases concernées garde au moins
 * {@link MIN_SHARE} de leur place commune ; la somme de leurs poids ne change pas.
 * @param spec - découpe en notation compacte
 * @param d - séparation à déplacer, obtenue par {@link dividers} sur la même découpe
 * @param pos - nouvelle position du trait, relative au cadre (0 à 1)
 * @returns la nouvelle découpe, ou `spec` inchangée si la séparation ne correspond pas
 * @throws {@link LayoutSyntaxError} si la découpe est mal écrite
 */
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
