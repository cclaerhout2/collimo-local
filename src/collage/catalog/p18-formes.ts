import { poly, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { R, clipAll, frameRing, hexAt, ordered } from './p11-formes'

type Pt = [number, number]

/** Cœur découpé en rangées de briques : `rows` = [haut, bas, séparateurs]. */
export function brickHeart(heart: Pt[], rows: [number, number, number[]][]): Pt[][] {
  const wins = rows.flatMap(([y0, y1, xs]) => {
    const b = [-0.1, ...xs, 1.1]
    return b.slice(0, -1).map((x, k) => R(x, y0, b[k + 1], y1))
  })
  return clipAll(heart, wins, 6e-4)
}

/** Cœur à deux lobes ronds et pointe droite, inscrit dans la boîte, en polygone. */
export function roundHeart(x0: number, y0: number, x1: number, y1: number, n = 24): Pt[] {
  const r = (x1 - x0) / 4
  const cy = y0 + r
  const arc = (cx: number, a0: number, a1: number): Pt[] =>
    Array.from({ length: n + 1 }, (_, k) => {
      const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt
    })
  return [...arc(x0 + r, 150, 360), ...arc(x1 - r, 180, 390).slice(1), [(x0 + x1) / 2, y1]]
}

/** Grille 5 × 5 dont un escalier de 8 cases forme une seule case. */
function stairs(): Pt[][] {
  const S = new Set(['4,0', '3,1', '4,1', '2,2', '3,2', '1,3', '2,3', '1,4'])
  const out: Pt[][] = []
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      if (r === 0 && c === 4)
        out.push([[0.8, 0], [1, 0], [1, 0.4], [0.8, 0.4], [0.8, 0.6], [0.6, 0.6], [0.6, 0.8], [0.4, 0.8], [0.4, 1], [0.2, 1], [0.2, 0.6], [0.4, 0.6], [0.4, 0.4], [0.6, 0.4], [0.6, 0.2], [0.8, 0.2]])
      else if (!S.has(`${c},${r}`)) out.push(R(c * 0.2, r * 0.2, c * 0.2 + 0.2, r * 0.2 + 0.2))
    }
  return out
}

export const P18_FORMES: LayoutDef[] = [
  {
    id: 'p18-05', photos: 18, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.21, 0.21, 0.79, 0.79]),
      ...[0, 1, 2, 3].map((k) => R(0.21 + k * 0.145, 0.21, 0.355 + k * 0.145, 0.36)),
      R(0.21, 0.36, 0.5, 0.64), R(0.5, 0.36, 0.79, 0.64),
      ...[0, 1, 2, 3].map((k) => R(0.21 + k * 0.145, 0.64, 0.355 + k * 0.145, 0.79)),
    ]),
  },
  { id: 'p18-06', photos: 18, family: 'coupe', geo: stairs().map((p) => poly(...p)) },
  {
    id: 'p18-09', photos: 18, family: 'coeurs',
    geo: brickHeart(roundHeart(0.06, 0.08, 0.94, 0.95), [
      [0, 0.3, [0.5]],
      [0.3, 0.46, [0.22, 0.4, 0.6, 0.78]],
      [0.46, 0.62, [0.27, 0.39, 0.5, 0.61, 0.73]],
      [0.62, 0.78, [0.39, 0.62]],
      [0.78, 1, [0.5]],
    ]).map((p) => poly(...p)),
  },
  {
    id: 'p18-15', photos: 18, family: 'coeurs',
    geo: [0.12, 0.27, 0.42, 0.58, 0.73, 0.88].flatMap((y) => [0.29, 0.5, 0.71].map((x) => shapeAt('heart', x, y, 0.15))),
  },
  {
    id: 'p18-16', photos: 18, family: 'geometrie',
    geo: Array.from({ length: 6 }, (_, r) => [0, 1, 2].map((c) => hexAt(0.1 + 0.087 * r + c * 0.17, 0.13 + r * 0.146, 0.17))).flat(),
  },
]
