import { describe, expect, it } from 'vitest'
import { LayoutSyntaxError, splitToRects } from './layoutDsl'

const round = (rs: { x: number; y: number; w: number; h: number }[]) =>
  rs.map((r) => [r.x, r.y, r.w, r.h].map((v) => Math.round(v * 1000) / 1000))

describe('splitToRects', () => {
  it('une case = tout le cadre', () => {
    expect(round(splitToRects('x'))).toEqual([[0, 0, 1, 1]])
  })

  it('colonnes et lignes égales', () => {
    expect(round(splitToRects('c(x,x)'))).toEqual([
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 1],
    ])
    expect(round(splitToRects('r(x, x)'))).toEqual([
      [0, 0, 1, 0.5],
      [0, 0.5, 1, 0.5],
    ])
  })

  it('poids et imbrication, dans l’ordre de lecture', () => {
    expect(round(splitToRects('c(2*x, r(x, x))'))).toEqual([
      [0, 0, 0.667, 1],
      [0.667, 0, 0.333, 0.5],
      [0.667, 0.5, 0.333, 0.5],
    ])
  })

  it('accepte les poids décimaux', () => {
    expect(round(splitToRects('r(1.5*x, x)'))).toEqual([
      [0, 0, 1, 0.6],
      [0, 0.6, 1, 0.4],
    ])
  })

  it.each(['', 'c(x', 'c()', 'y', 'c(x,)', '2x', 'c(0*x,x)', 'x x'])('refuse « %s »', (spec) => {
    expect(() => splitToRects(spec)).toThrow(LayoutSyntaxError)
  })
})
