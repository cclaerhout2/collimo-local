import { describe, expect, it } from 'vitest'
import { cellBoxes, MAX_MARGIN, MAX_SPACING, placeImage, sizeForLongSide } from './geometry'
import { splitToRects } from './layoutDsl'
import { DEFAULT_CROP } from './types'

describe('cellBoxes', () => {
  const W = 1000
  const borders = { spacing: 1, margin: 1, radius: 0 }
  const gap = MAX_SPACING * W
  const margin = MAX_MARGIN * W

  it('applique la marge au bord et l’écart entre cases', () => {
    const [a, b] = cellBoxes(splitToRects('c(x,x)'), W, W, borders)
    expect(a.x).toBeCloseTo(margin)
    expect(a.y).toBeCloseTo(margin)
    expect(b.x - (a.x + a.w)).toBeCloseTo(gap)
    expect(W - (b.x + b.w)).toBeCloseTo(margin)
    expect(a.w).toBeCloseTo(b.w)
  })

  it('sans écart ni marge, les cases couvrent tout', () => {
    const boxes = cellBoxes(splitToRects('r(x,c(x,x))'), 800, 600, { spacing: 0, margin: 0, radius: 0 })
    expect(boxes[0]).toMatchObject({ x: 0, y: 0, w: 800, h: 300 })
    expect(boxes[2].x + boxes[2].w).toBeCloseTo(800)
  })

  it('arrondi maximum = demi plus petit côté (case ovale)', () => {
    const [box] = cellBoxes([{ x: 0, y: 0, w: 1, h: 0.5 }], 1000, 1000, { spacing: 0, margin: 0, radius: 1 })
    expect(box.radius).toBeCloseTo(250)
  })
})

describe('placeImage', () => {
  it('couvre la case sans zoom ni décalage', () => {
    const p = placeImage(4000, 3000, 500, 500, DEFAULT_CROP)
    expect(3000 * p.scale).toBeCloseTo(500)
    expect(4000 * p.scale).toBeGreaterThan(500)
    expect([p.dx, p.dy]).toEqual([0, 0])
  })

  it('le décalage reste dans la marge disponible', () => {
    const p = placeImage(4000, 3000, 500, 500, { ...DEFAULT_CROP, ox: 5 })
    const slack = (4000 * p.scale - 500) / 2
    expect(p.dx).toBeCloseTo(slack)
  })

  it('une photo tournée couvre toujours la case', () => {
    const p = placeImage(1000, 1000, 500, 500, { ...DEFAULT_CROP, angle: 45 })
    expect(1000 * p.scale).toBeCloseTo(500 * Math.SQRT2)
  })

  it('le zoom agrandit', () => {
    const base = placeImage(1000, 1000, 500, 500, DEFAULT_CROP).scale
    expect(placeImage(1000, 1000, 500, 500, { ...DEFAULT_CROP, zoom: 2 }).scale).toBeCloseTo(base * 2)
  })
})

describe('sizeForLongSide', () => {
  it('le plus grand côté porte la taille demandée', () => {
    expect(sizeForLongSide(9 / 16, 5000)).toEqual({ width: 2813, height: 5000 })
    expect(sizeForLongSide(16 / 9, 2048)).toEqual({ width: 2048, height: 1152 })
    expect(sizeForLongSide(1, 2048)).toEqual({ width: 2048, height: 2048 })
  })
})
