import { describe, expect, it } from 'vitest'
import { pruneSelection, toggleSelection } from './selection'

describe('toggleSelection', () => {
  it('ajoute à la fin, dans l’ordre des clics', () => {
    let s: string[] = []
    s = toggleSelection(s, 'b', 20).selection
    s = toggleSelection(s, 'a', 20).selection
    expect(s).toEqual(['b', 'a'])
  })

  it('retire une photo déjà sélectionnée, sans changer l’ordre des autres', () => {
    expect(toggleSelection(['a', 'b', 'c'], 'b', 20).selection).toEqual(['a', 'c'])
  })

  it('refuse au-delà du maximum et le signale', () => {
    const r = toggleSelection(['a', 'b'], 'c', 2)
    expect(r).toEqual({ selection: ['a', 'b'], limitReached: true })
  })

  it('permet toujours de retirer une photo au maximum', () => {
    expect(toggleSelection(['a', 'b'], 'a', 2)).toEqual({ selection: ['b'], limitReached: false })
  })
})

describe('pruneSelection', () => {
  it('garde l’ordre et retire les photos disparues', () => {
    expect(pruneSelection(['c', 'a', 'x'], ['a', 'b', 'c'])).toEqual(['c', 'a'])
  })
})
