import { describe, expect, it } from 'vitest'
import { allLayouts, layoutsFor } from './index'
import { cellGeometry } from '../cells'

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

describe('formes composées', () => {
  // Une forme faite de plusieurs morceaux (fleur, trèfle…) tracée en mode « médaillon » montrerait
  // ses lignes internes : on vérifie qu'aucune n'en chevauche franchement une autre.
  it('aucune fleur, trèfle ou nuage ne passe en mode contour', () => {
    const compound = new Set(['flower', 'flower6', 'clover', 'club', 'bear', 'pumpkin', 'cloud'])
    const bad: string[] = []
    for (const n of Array.from({ length: 20 }, (_, i) => i + 1)) {
      for (const layout of layoutsFor(n)) {
        if (!layout.geo) continue
        const cells = cellGeometry(layout, 1000, 1000, { spacing: 0.3, margin: 0.3, radius: 0 })
        layout.geo.forEach((c, i) => {
          if (c.kind === 'shape' && compound.has(c.shape) && !cells[i].shaped) bad.push(`${layout.id}#${i + 1}`)
        })
      }
    }
    expect(bad).toEqual([])
  })
})
