import { poly, rect, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'
import { R, bandRow, clipAll, cut, frameRing, ordered, ovalAt } from './p11-formes'

type Pt = [number, number]

/** Hexagone pointe à plat (rayon r) en polygone. */
export const flatHex = (cx: number, cy: number, r: number): Pt[] =>
  Array.from({ length: 6 }, (_, k) => [cx + r * Math.cos((k * Math.PI) / 3), cy + r * Math.sin((k * Math.PI) / 3)] as Pt)

const hexTiling = (): Pt[][] => {
  const r = 0.195
  const cols: [number, number[]][] = [
    [0.074, [0.157, 0.495, 0.833]],
    [0.363, [-0.008, 0.32, 0.66, 1.0]],
    [0.651, [0.157, 0.495, 0.833]],
    [0.94, [-0.008, 0.32, 0.66, 1.0]],
  ]
  return cols.flatMap(([x, ys]) => ys.map((y) => flatHex(x, y, r))).flatMap((h) => clipAll(h, [R(0, 0, 1, 1)], 2e-3))
}

const G = (c: number, r: number) => R(c * 0.25, r * 0.25, c * 0.25 + 0.25, r * 0.25 + 0.25)

export const P14_FORMES: LayoutDef[] = [
  {
    id: 'p14-07', photos: 14, family: 'geometrie',
    geo: ordered([
      ...frameRing([0, 0, 1, 1], [0.2, 0.18, 0.81, 0.81]),
      R(0.2, 0.18, 0.41, 0.45), R(0.41, 0.18, 0.61, 0.54), R(0.61, 0.18, 0.81, 0.37),
      R(0.2, 0.45, 0.41, 0.81), R(0.41, 0.54, 0.61, 0.81), R(0.61, 0.37, 0.81, 0.81),
    ]),
  },
  { id: 'p14-08', photos: 14, family: 'geometrie', geo: ordered(hexTiling()) },
  {
    id: 'p14-10', photos: 14, family: 'geometrie',
    geo: [
      shapeAt('circle', 0.18, 0.23, 0.2),
      rect(0.37, 0.08, 0.2, 0.28),
      rect(0.62, 0.08, 0.13, 0.14),
      rect(0.8, 0.08, 0.13, 0.14),
      rect(0.62, 0.26, 0.31, 0.38),
      rect(0.07, 0.41, 0.13, 0.23),
      rect(0.25, 0.41, 0.13, 0.13), rect(0.43, 0.41, 0.13, 0.13),
      rect(0.25, 0.59, 0.13, 0.13), rect(0.43, 0.59, 0.13, 0.13),
      rect(0.07, 0.68, 0.13, 0.22),
      rect(0.25, 0.77, 0.13, 0.13), rect(0.43, 0.77, 0.13, 0.13),
      ovalAt(0.78, 0.81, 0.26, 0.19),
    ],
  },
  {
    id: 'p14-11', photos: 14, family: 'geometrie',
    geo: [
      G(0, 0), G(1, 0), G(2, 0), G(3, 0), G(0, 1),
      [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75]] as Pt[],
      G(3, 1), G(0, 2),
      [[0.75, 0.25], [0.75, 0.75], [0.25, 0.75]] as Pt[],
      G(3, 2), G(0, 3), G(1, 3), G(2, 3), G(3, 3),
    ].map((p) => poly(...p)),
  },
  {
    id: 'p14-15', photos: 14, family: 'coupe',
    geo: (() => {
      const h = (y: number): [Pt, Pt] => [[0, y], [1, y]]
      const left = cut([[0, 0], [0.34, 0], [0.26, 1], [0, 1]], [h(0.23), h(0.5), h(0.75)])
      const right = cut([[0.74, 0], [1, 0], [1, 1], [0.66, 1]], [h(0.23), h(0.5), h(0.75)])
      const mid = (y0: number, y1: number): Pt[] => [[0.34 - 0.08 * y0, y0], [0.74 - 0.08 * y0, y0], [0.74 - 0.08 * y1, y1], [0.34 - 0.08 * y1, y1]]
      const centre = [
        ...cut(mid(0, 0.37), [[[0.56, 0], [0.48, 1]]]),
        mid(0.37, 0.5),
        mid(0.5, 0.63),
        ...cut(mid(0.63, 1), [[[0.52, 0], [0.44, 1]]]),
      ]
      return ordered([...left, ...centre, ...right], 'cols', 0.12)
    })(),
  },
  {
    id: 'p14-16', photos: 14, family: 'coupe',
    geo: [
      ...bandRow([0, 0], [0.26, 0.37], [0.21, 0.41, 0.61, 0.82]),
      ...bandRow([0.26, 0.37], [0.71, 0.63], [0.31, 0.52, 0.72]),
      ...bandRow([0.71, 0.63], [1, 1], [0.21, 0.41, 0.62, 0.82]),
    ].map((p) => poly(...p)),
  },
]
