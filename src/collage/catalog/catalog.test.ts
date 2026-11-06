import { describe, expect, it } from 'vitest'
import { allLayouts, layoutsFor } from './index'

const counts = Array.from({ length: 20 }, (_, i) => i + 1)

describe('catalogue des dispositions', () => {
  it('se construit sans erreur (bon nombre de cases, cases dans le cadre)', () => {
    expect(() => allLayouts()).not.toThrow()
  })

  it('a des identifiants uniques, préfixés par le nombre de photos', () => {
    const ids = allLayouts().map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of allLayouts()) {
      expect(l.id.startsWith(`p${String(l.photos).padStart(2, '0')}-`), l.id).toBe(true)
    }
  })

  it.each(counts)('propose au moins une disposition pour %i photo(s)', (n) => {
    expect(layoutsFor(n).length).toBeGreaterThan(0)
  })

  it('ne fait pas se chevaucher les cases des découpes', () => {
    for (const l of allLayouts().filter((d) => d.split)) {
      const area = l.cells.reduce((s, c) => s + c.w * c.h, 0)
      expect(area, l.id).toBeCloseTo(1, 6)
    }
  })
})
