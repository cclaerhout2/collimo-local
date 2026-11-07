import { describe, expect, it } from 'vitest'
import { allLayouts } from '../catalog'
import { cellPathFrame } from '../cells'
import { serializePath } from '../path'
import type { CellDef } from '../shapes'
import { validateCells } from '../validate'
import { applyCut, dragSeparator, gridTemplate, insertPoint, movePoint, readingOrderOf, splitCell, toEditable } from './ops'

const rects = (cells: CellDef[]) => cells.map((c) => (c.kind === 'rect' ? [c.x, c.y, c.w, c.h] : c.kind))

describe('usine : opérations sur les cases', () => {
  it('modèle en grille', () => {
    const g = gridTemplate(2, 2)
    expect(rects(g)).toEqual([[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]])
    expect(validateCells(g, 4)).toEqual([])
  })

  it('coupe une case en deux', () => {
    const g = splitCell(gridTemplate(1, 1), 0, 'v')
    expect(rects(g)).toEqual([[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]])
    expect(validateCells(g, 2)).toEqual([])
  })

  it('déplace une séparation sur toute sa longueur', () => {
    // 2 × 2 : la séparation verticale traverse les deux rangées.
    const g = dragSeparator(gridTemplate(2, 2), 0, 'right', 0.3)
    expect(rects(g)).toEqual([[0, 0, 0.3, 0.5], [0.3, 0, 0.7, 0.5], [0, 0.5, 0.3, 0.5], [0.3, 0.5, 0.7, 0.5]])
    // Bornée : chaque case garde au moins 2 %.
    expect(rects(dragSeparator(gridTemplate(2, 1), 0, 'right', -1))[0]).toEqual([0, 0, 0.02, 1])
  })

  it('une séparation interrompue ne bouge que sa portion', () => {
    // Haut coupé à 0,5 ; bas coupé à 0,3 : déplacer la séparation du haut laisse celle du bas.
    const g: CellDef[] = [
      { kind: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 },
      { kind: 'rect', x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { kind: 'rect', x: 0, y: 0.5, w: 0.3, h: 0.5 },
      { kind: 'rect', x: 0.3, y: 0.5, w: 0.7, h: 0.5 },
    ]
    expect(rects(dragSeparator(g, 0, 'right', 0.6)).slice(2)).toEqual([[0, 0.5, 0.3, 0.5], [0.3, 0.5, 0.7, 0.5]])
  })

  it('sommets confondus déplacés ensemble', () => {
    let g = applyCut(splitCell(gridTemplate(1, 1), 0, 'v'), 0, 1, null) // deux polygones jointifs
    g = movePoint(g, 0, 1, [0.6, 0])
    expect(g[0].kind === 'poly' && g[0].points[1]).toEqual([0.6, 0])
    expect(g[1].kind === 'poly' && g[1].points[0]).toEqual([0.6, 0])
    expect(validateCells(g, 2)).toEqual([])
  })

  it('ajoute un sommet sur un côté partagé, des deux côtés', () => {
    let g = applyCut(splitCell(gridTemplate(1, 1), 0, 'v'), 0, 1, null)
    g = insertPoint(g, 0, 1)
    expect(g[0].kind === 'poly' && g[0].points.length).toBe(5)
    expect(g[1].kind === 'poly' && g[1].points.length).toBe(5)
  })

  it('coupe spéciale : même bord des deux côtés de la séparation', () => {
    for (const kind of ['curve', 'wave', 'zigzag', 'lightning', 'torn'] as const) {
      const g = applyCut(splitCell(gridTemplate(1, 1), 0, 'v'), 0, 1, { kind, amp: 0.05, n: 3, seed: 11 })
      expect(g.every((c) => c.kind === 'poly')).toBe(true)
      expect(validateCells(g, 2)).toEqual([])
      // Le tracé de la séparation de gauche, inversé, est celui de droite.
      const left = serializePath(cellPathFrame(g[0], 1)!.segs)
      const right = serializePath(cellPathFrame(g[1], 1)!.segs)
      const nums = (s: string) => (s.match(/-?\d*\.?\d+/g) ?? []).map((v) => Number(Number(v).toFixed(3)))
      const inner = (n: number[]) => [...new Set(n.filter((_, j) => j % 2 === 0).filter((x) => x > 0.2 && x < 0.8))].sort()
      expect(inner(nums(left))).toEqual(inner(nums(right)))
    }
  })

  it('coupe sur une séparation partagée en partie', () => {
    // Gauche pleine hauteur, droite coupée en deux : la coupe de la séparation touche les trois cases.
    const g: CellDef[] = [
      { kind: 'rect', x: 0, y: 0, w: 0.5, h: 1 },
      { kind: 'rect', x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ]
    const out = applyCut(g, 0, 1, { kind: 'wave', amp: 0.04, n: 2 })
    expect(out.map((c) => c.kind)).toEqual(['poly', 'poly', 'poly'])
    expect(out[0].kind === 'poly' && out[0].points.length).toBe(5)
    expect(validateCells(out, 3)).toEqual([])
  })

  it('ordre de lecture automatique', () => {
    const g = gridTemplate(2, 2)
    expect(readingOrderOf([g[3], g[0], g[2], g[1]])).toEqual([1, 3, 2, 0])
  })
})

describe('validation automatique', () => {
  it('signale nombre, chevauchement, case hors cadre', () => {
    const g = gridTemplate(2, 1)
    expect(validateCells(g, 3)).toEqual([{ code: 'count', expected: 3, got: 2 }])
    const over: CellDef[] = [...g, { kind: 'shape', shape: 'circle', x: 0.35, y: 0.35, w: 0.3, h: 0.3 }]
    expect(validateCells(over, 3).map((i) => i.code)).toEqual(['overlap', 'overlap'])
    over[2] = { ...over[2], over: true }
    expect(validateCells(over, 3)).toEqual([])
    expect(validateCells([{ kind: 'rect', x: 0.5, y: 0, w: 0.8, h: 1 }], 1).map((i) => i.code)).toEqual(['outside'])
  })

  it('toutes les dispositions du catalogue, une fois reprises dans l\'usine, sont valides', () => {
    const bad: string[] = []
    for (const l of allLayouts()) {
      const issues = validateCells(toEditable(l), l.photos)
      if (issues.length) bad.push(`${l.id} ${JSON.stringify(issues)}`)
    }
    expect(bad).toEqual([])
  }, 60_000)
})
