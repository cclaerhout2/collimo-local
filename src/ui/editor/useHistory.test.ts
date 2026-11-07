import { describe, expect, it } from 'vitest'
import { COALESCE_MS, historyInit, historyRedo, historySet, historyUndo } from './useHistory'

describe('annuler / rétablir', () => {
  it('annule puis rétablit', () => {
    let h = historyInit(1)
    h = historySet(h, 2, 1000)
    h = historySet(h, 3, 5000)
    h = historyUndo(h)
    expect(h.present).toBe(2)
    h = historyUndo(h)
    expect(h.present).toBe(1)
    h = historyRedo(h)
    expect(h.present).toBe(2)
  })

  it('regroupe un glissé en une seule étape', () => {
    let h = historyInit(0)
    for (let i = 1; i <= 20; i++) h = historySet(h, i, 1000 + i * 16)
    expect(h.past).toEqual([0])
    expect(historyUndo(h).present).toBe(0)
  })

  it('une nouvelle modification efface ce qu’on pouvait rétablir', () => {
    let h = historyInit(1)
    h = historySet(h, 2, 1000)
    h = historyUndo(h)
    h = historySet(h, 5, 1000 + COALESCE_MS * 10)
    expect(h.future).toEqual([])
    expect(historyRedo(h).present).toBe(5)
  })

  it('après une annulation, la modification suivante n’est pas fusionnée', () => {
    let h = historyInit(1)
    h = historySet(h, 2, 1000)
    h = historySet(h, 3, 3000)
    h = historyUndo(h)
    h = historySet(h, 9, 3010)
    expect(historyUndo(h).present).toBe(2)
  })
})
