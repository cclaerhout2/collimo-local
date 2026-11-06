import { describe, expect, it } from 'vitest'
import { placeImage } from './geometry'
import { normalizeAngle, panBy, pointerAngle, rotateTo, snapAngle, zoomAt } from './gestures'
import { dividers, moveDivider, parseSplit, serializeSplit, splitToRects } from './layoutDsl'
import { DEFAULT_CROP } from './types'

const img = { w: 4000, h: 3000 }
const box = { w: 500, h: 500 }

describe('panBy', () => {
  it('la photo suit le doigt', () => {
    const c = panBy(DEFAULT_CROP, img, box, 40, 0)
    expect(placeImage(img.w, img.h, box.w, box.h, c).dx).toBeCloseTo(40)
  })

  it('ne sort jamais de sa case', () => {
    const c = panBy(DEFAULT_CROP, img, box, 10_000, 10_000)
    expect(c.ox).toBe(1)
    expect(c.oy).toBe(0) // aucune marge verticale : photo paysage dans une case carrée
  })

  it('suit le doigt même photo tournée', () => {
    const turned = { ...DEFAULT_CROP, angle: 90, zoom: 2 }
    const c = panBy(turned, img, box, 0, 30)
    // Tournée de 90°, un glissé vers le bas déplace la photo le long de son axe horizontal.
    expect(placeImage(img.w, img.h, box.w, box.h, c).dx).toBeCloseTo(30)
  })
})

describe('zoomAt', () => {
  it('borne le zoom entre 1 et 4', () => {
    expect(zoomAt(DEFAULT_CROP, img, box, 9).zoom).toBe(4)
    expect(zoomAt({ ...DEFAULT_CROP, zoom: 2 }, img, box, 0.2).zoom).toBe(1)
  })

  it('garde immobile le point sous le curseur', () => {
    const start = { ...DEFAULT_CROP, zoom: 1.5 }
    const px = 120
    const py = -80
    const a = placeImage(img.w, img.h, box.w, box.h, start)
    const pointBefore = [(px - a.dx) / a.scale, (py - a.dy) / a.scale]
    const next = zoomAt(start, img, box, 2, px, py)
    const b = placeImage(img.w, img.h, box.w, box.h, next)
    expect((px - b.dx) / b.scale).toBeCloseTo(pointBefore[0], 4)
    expect((py - b.dy) / b.scale).toBeCloseTo(pointBefore[1], 4)
  })
})

describe('angles', () => {
  it('ramène entre -180 et 180°', () => {
    expect(normalizeAngle(270)).toBe(-90)
    expect(normalizeAngle(-190)).toBe(170)
    expect(normalizeAngle(180)).toBe(180)
  })

  it('accroche près des quarts de tour, sinon garde l’angle', () => {
    expect(snapAngle(3)).toBe(0)
    expect(snapAngle(87.5)).toBe(90)
    expect(snapAngle(12.34)).toBe(12.3)
  })

  it('avec Maj, avance de 15° en 15°', () => {
    expect(snapAngle(22, true)).toBe(15)
    expect(snapAngle(23, true)).toBe(30)
  })

  it('angle du pointeur : 0 vers le haut, 90 à droite', () => {
    expect(pointerAngle(0, 0, 0, -10)).toBeCloseTo(0)
    expect(pointerAngle(0, 0, 10, 0)).toBeCloseTo(90)
  })

  it('une rotation garde la photo dans sa case', () => {
    const c = rotateTo({ ...DEFAULT_CROP, ox: 1 }, img, box, 30)
    expect(c.angle).toBe(30)
    expect(Math.abs(c.ox)).toBeLessThanOrEqual(1)
  })
})

describe('séparations', () => {
  it('réécrit la notation à l’identique', () => {
    for (const spec of ['x', 'c(x,x)', 'c(2*x,r(x,x))', 'r(1.5*x,c(x,x,x))']) {
      expect(serializeSplit(parseSplit(spec))).toBe(spec)
    }
  })

  it('trouve chaque séparation', () => {
    const ds = dividers('c(x,r(x,x))')
    expect(ds).toHaveLength(2)
    expect(ds[0]).toMatchObject({ dir: 'c', pos: 0.5, from: 0, to: 1, min: 0, max: 1 })
    expect(ds[1]).toMatchObject({ dir: 'r', pos: 0.5, from: 0.5, to: 1, min: 0, max: 1, path: [1] })
  })

  it('déplacer une séparation agrandit une case aux dépens de sa voisine', () => {
    const [d] = dividers('c(x,x)')
    const cells = splitToRects(moveDivider('c(x,x)', d, 0.7))
    expect(cells[0].w).toBeCloseTo(0.7)
    expect(cells[1].w).toBeCloseTo(0.3)
  })

  it('une case garde une taille minimale', () => {
    const [d] = dividers('c(x,x)')
    const cells = splitToRects(moveDivider('c(x,x)', d, 0.99))
    expect(cells[1].w).toBeGreaterThan(0.1)
  })

  it('ne touche que les deux cases voisines', () => {
    const spec = 'c(x,x,x)'
    const second = dividers(spec)[1]
    const cells = splitToRects(moveDivider(spec, second, 0.8))
    expect(cells[0].w).toBeCloseTo(1 / 3)
    expect(cells[1].w + cells[2].w).toBeCloseTo(2 / 3)
  })
})
