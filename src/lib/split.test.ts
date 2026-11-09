import { describe, expect, it } from 'vitest'
import { autoSplit, groupsNeeded, movePhoto, splitBySize, splitIssues, unplaced } from './split'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('répartition automatique', () => {
  it('équilibre les groupes, les premiers recevant la photo en plus', () => {
    expect(autoSplit(ids(23), 3).map((g) => g.length)).toEqual([8, 8, 7])
    expect(autoSplit(ids(23), 3).flat()).toEqual(ids(23))
    expect(autoSplit(ids(4), 2)).toEqual([
      ['p1', 'p2'],
      ['p3', 'p4'],
    ])
  })

  it('borne le nombre de groupes', () => {
    expect(autoSplit(ids(3), 10)).toHaveLength(3)
    expect(autoSplit(ids(5), 0)).toHaveLength(1)
    expect(autoSplit([], 3)).toEqual([[]])
  })

  it('répartit par taille visée et compte les collages nécessaires', () => {
    expect(splitBySize(ids(23), 8).map((g) => g.length)).toEqual([8, 8, 7])
    expect(splitBySize(ids(10), 4).map((g) => g.length)).toEqual([4, 3, 3])
    expect(groupsNeeded(45, 20)).toBe(3)
    expect(groupsNeeded(20, 20)).toBe(1)
    expect(groupsNeeded(0, 20)).toBe(1)
  })
})

describe('déplacements et validation', () => {
  it('déplace une photo en fin de groupe ou la remet à placer', () => {
    const g = [['a', 'b'], ['c']]
    expect(movePhoto(g, 'a', 1)).toEqual([['b'], ['c', 'a']])
    expect(movePhoto(g, 'c', -1)).toEqual([['a', 'b'], []])
    expect(unplaced(['a', 'b', 'c', 'd'], g)).toEqual(['d'])
  })

  it('signale les photos à placer et les groupes trop petits ou trop grands', () => {
    expect(splitIssues(['a', 'b', 'c', 'd'], [['a', 'b'], ['c']], 2, 20)).toEqual([
      { kind: 'unplaced', count: 1 },
      { kind: 'tooFew', group: 1, min: 2 },
    ])
    expect(splitIssues(ids(21), [ids(21)], 2, 20)).toEqual([{ kind: 'tooMany', group: 0, max: 20 }])
    expect(splitIssues(ids(4), [ids(4).slice(0, 2), ids(4).slice(2), []], 2, 20)).toEqual([])
  })
})
