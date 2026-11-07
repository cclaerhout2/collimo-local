import { describe, expect, it } from 'vitest'
import { buildLayout } from './catalog'
import { cellGeometry, cellPathFrame, defBBox } from './cells'
import { mapPath, parsePath, pathBBox, PathSyntaxError, serializePath } from './path'
import { hCut, hexes, pie, pieDisc, puzzle, ring, shape, shapeGrid, SHAPES, vBands, vCut } from './shapes'

describe('chemins', () => {
  it('lit les commandes absolues et relatives', () => {
    const segs = parsePath('M0 0 l10 0 v10 H0 z')
    expect(serializePath(segs)).toBe('M0 0L10 0L10 10L0 10Z')
  })

  it('lit les courbes, y compris S et T', () => {
    const segs = parsePath('M0 0C0 1 1 1 1 0S2 -1 2 0Q3 1 4 0T6 0')
    expect(segs.map((s) => s.c)).toEqual(['M', 'C', 'C', 'Q', 'Q'])
  })

  it('refuse les arcs et les chemins mal formés', () => {
    expect(() => parsePath('M0 0A1 1 0 0 1 2 2')).toThrow(PathSyntaxError)
    expect(() => parsePath('M0')).toThrow(PathSyntaxError)
  })

  it('transforme et mesure', () => {
    const segs = mapPath(parsePath('M0 0L1 0L1 1Z'), ([x, y]) => [x * 100 + 10, y * 50])
    expect(pathBBox(segs)).toEqual({ x: 10, y: 0, w: 100, h: 50 })
  })

  it('toutes les formes de la bibliothèque se lisent et tiennent dans le carré unité', () => {
    for (const [name, d] of Object.entries(SHAPES)) {
      const b = pathBBox(parsePath(d))
      expect(b.x, name).toBeGreaterThanOrEqual(-0.01)
      expect(b.y, name).toBeGreaterThanOrEqual(-0.01)
      expect(b.x + b.w, name).toBeLessThanOrEqual(1.01)
      expect(b.y + b.h, name).toBeLessThanOrEqual(1.01)
    }
  })
})

describe('formes dans un cadre', () => {
  it('une forme garde ses proportions dans un cadre allongé', () => {
    const c = shape('circle', 0, 0, 1, 1)
    const fp = cellPathFrame(c, 2)! // cadre deux fois plus large que haut
    const b = pathBBox(fp.segs)
    // En pixels : largeur b.w × 2, hauteur b.h → un cercle.
    expect(b.w * 2).toBeCloseTo(b.h, 3)
  })

  it('stretch déforme pour remplir', () => {
    const b = pathBBox(cellPathFrame(shape('circle', 0, 0, 1, 1, { stretch: true }), 2)!.segs)
    expect([b.w, b.h]).toEqual([1, 1])
  })
})

describe('générateurs', () => {
  const area = (d: ReturnType<typeof defBBox>) => d.w * d.h

  it('une coupe donne deux zones qui couvrent le cadre', () => {
    const [a, b] = vCut(0.4, 0.6, 'line')
    expect(area(defBBox(a)) + area(defBBox(b))).toBeGreaterThan(0.99)
    const [t, u] = hCut(0.5, 0.5, 'wave', 0.05, 3)
    expect(defBBox(t).y).toBeCloseTo(0)
    expect(defBBox(u).y + defBBox(u).h).toBeCloseTo(1)
  })

  it('bandes : n coupes donnent n + 1 zones', () => {
    expect(vBands([0.33, 0.66], [0.4, 0.75])).toHaveLength(3)
  })

  it('puzzle, camembert, ruche, grille et couronne donnent le bon nombre de cases', () => {
    expect(puzzle(3, 3)).toHaveLength(9)
    expect(pie(5)).toHaveLength(5)
    expect(pieDisc(3)).toHaveLength(3)
    expect(hexes([[0, 0], [1, 0], [0, 1]], 0.2, 0.3, 0.3)).toHaveLength(3)
    expect(shapeGrid('heart', 3, 2)).toHaveLength(6)
    expect(ring('circle', 8, 0.15, 0.35)).toHaveLength(8)
  })

  it('les parts du camembert vont jusqu’aux coins', () => {
    const boxes = pie(4).map(defBBox)
    const union = boxes.reduce((u, b) => ({ x0: Math.min(u.x0, b.x), y0: Math.min(u.y0, b.y), x1: Math.max(u.x1, b.x + b.w), y1: Math.max(u.y1, b.y + b.h) }), { x0: 1, y0: 1, x1: 0, y1: 0 })
    expect(union).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
  })
})

describe('dispositions en forme', () => {
  it('se construisent et donnent une géométrie en pixels', () => {
    const layout = buildLayout({ id: 'p03-test', photos: 3, family: 'ronds', geo: [...vCut(0.5, 0.5, 'curve'), shape('circle', 0.3, 0.3, 0.4, 0.4)] })
    const cells = cellGeometry(layout, 1000, 1000, { spacing: 0.5, margin: 0.5, radius: 0 })
    expect(cells).toHaveLength(3)
    expect(cells.every((c) => c.path && c.box.w > 0)).toBe(true)
  })

  it('refuse un mauvais nombre de cases', () => {
    expect(() => buildLayout({ id: 'p02-test', photos: 2, family: 'ronds', geo: [shape('circle', 0, 0, 1, 1)] })).toThrow()
  })
})

describe('médaillon', () => {
  it('une forme posée sur une autre case reçoit un contour tracé (anneau visible)', () => {
    const layout = buildLayout({ id: 'p02-medaillon', photos: 2, family: 'incrustation', geo: [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, shape('heart', 0.3, 0.3, 0.4, 0.4)] })
    const [, heart] = cellGeometry(layout, 1000, 1000, { spacing: 0.5, margin: 0, radius: 0 })
    expect(heart.shaped).toBeFalsy()
    const free = buildLayout({ id: 'p02-libre', photos: 2, family: 'coeurs', geo: [shape('heart', 0, 0, 0.45, 0.45), shape('heart', 0.55, 0.55, 0.45, 0.45)] })
    expect(cellGeometry(free, 1000, 1000, { spacing: 0.5, margin: 0, radius: 0 }).every((c) => c.shaped)).toBe(true)
  })
})
