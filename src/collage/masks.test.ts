import { describe, expect, it } from 'vitest'
import {
  blurFraction,
  DEFAULT_MASK,
  masksKey,
  MIN_MASK_SIZE,
  normalizeMaskAngle,
  normalizeRect,
  parseMasks,
  pixelateBlocks,
  rotatedBounds,
  type Mask,
} from './masks'

const mask = (over: Partial<Mask> = {}): Mask => ({ id: 'a', x: 0.1, y: 0.2, w: 0.3, h: 0.4, mode: 'blur', strength: 0.6, ...over })

describe('normalizeRect', () => {
  it('remet d’équerre un rectangle tracé à l’envers', () => {
    const r = normalizeRect({ x: 0.8, y: 0.7, w: -0.3, h: -0.2 })
    expect(r.x).toBeCloseTo(0.5)
    expect(r.y).toBeCloseTo(0.5)
    expect(r.w).toBeCloseTo(0.3)
    expect(r.h).toBeCloseTo(0.2)
  })

  it('borne le rectangle à l’image', () => {
    const r = normalizeRect({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 })
    expect(r.x).toBe(0)
    expect(r.w).toBeCloseTo(0.3)
    expect(r.y).toBeCloseTo(0.9)
    expect(r.h).toBeCloseTo(0.1)
  })
})

describe('parseMasks', () => {
  it('garde les zones valides et complète ce qui manque', () => {
    const out = parseMasks([
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { id: 'k', x: 0.5, y: 0.5, w: 0.1, h: 0.1, mode: 'fill', strength: 2 },
    ])!
    expect(out).toHaveLength(2)
    expect(out[0].mode).toBe(DEFAULT_MASK.mode)
    expect(out[0].strength).toBe(DEFAULT_MASK.strength)
    expect(out[0].id).toBeTruthy()
    expect(out[1]).toMatchObject({ id: 'k', mode: 'fill', strength: 1 })
  })

  it('ignore ce qui n’est pas une zone, les zones trop petites et un mode inconnu', () => {
    expect(parseMasks('x')).toBeUndefined()
    expect(parseMasks([null, { x: 'a' }, { x: 0, y: 0, w: MIN_MASK_SIZE / 2, h: 0.5 }])).toBeUndefined()
    expect(parseMasks([{ x: 0, y: 0, w: 0.5, h: 0.5, mode: 'invert' }])![0].mode).toBe('blur')
    expect(parseMasks([{ x: NaN, y: 0, w: 0.5, h: 0.5 }])).toBeUndefined()
  })
})

describe('intensité', () => {
  it('la mosaïque a au plus 14 blocs et au moins 4, la plus forte étant la plus grossière', () => {
    expect(pixelateBlocks(0)).toBe(14)
    expect(pixelateBlocks(1)).toBe(4)
    expect(pixelateBlocks(0.5)).toBeLessThan(pixelateBlocks(0))
    expect(pixelateBlocks(5)).toBe(4)
  })

  it('le flou réduit d’au moins 8 fois, et plus avec l’intensité', () => {
    expect(blurFraction(0)).toBeCloseTo(1 / 8)
    expect(blurFraction(1)).toBeCloseTo(1 / 40)
    expect(blurFraction(0.5)).toBeLessThan(blurFraction(0))
  })
})

describe('masksKey', () => {
  it('est vide sans zone et change avec chaque réglage', () => {
    expect(masksKey(undefined)).toBe('')
    expect(masksKey([])).toBe('')
    const a = masksKey([mask()])
    expect(masksKey([mask({ strength: 0.7 })])).not.toBe(a)
    expect(masksKey([mask({ mode: 'fill' })])).not.toBe(a)
    expect(masksKey([mask({ x: 0.11 })])).not.toBe(a)
    expect(masksKey([mask({ id: 'autre' })])).toBe(a)
  })
})

describe('rotation', () => {
  it('normalise l’angle dans ]-180, 180] au dixième', () => {
    expect(normalizeMaskAngle(0)).toBe(0)
    expect(normalizeMaskAngle(190)).toBe(-170)
    expect(normalizeMaskAngle(-180)).toBe(180)
    expect(normalizeMaskAngle(45.04)).toBe(45)
    expect(normalizeMaskAngle(725)).toBe(5)
  })

  it('la boîte englobante d’un rectangle droit est lui-même, et grandit avec la rotation', () => {
    const m = { x: 0.2, y: 0.3, w: 0.4, h: 0.2, angle: 0 }
    const b = rotatedBounds(m)
    expect([b.x, b.y, b.w, b.h].map((v) => Math.round(v * 1000) / 1000)).toEqual([0.2, 0.3, 0.4, 0.2])
    const r = rotatedBounds({ ...m, angle: 90 })
    expect(r.w).toBeCloseTo(0.2)
    expect(r.h).toBeCloseTo(0.4)
    expect(r.x + r.w / 2).toBeCloseTo(0.4)
    expect(r.y + r.h / 2).toBeCloseTo(0.4)
    const d = rotatedBounds({ ...m, angle: 45 })
    expect(d.w).toBeGreaterThan(0.4)
    expect(d.h).toBeGreaterThan(0.2)
  })

  it('tient compte du format de l’image pour la boîte englobante', () => {
    // Image deux fois plus haute que large : un carré « en fractions » est en fait un rectangle 1 × 2 ;
    // tourné de 90°, il devient 2 × 1, soit toute la largeur et un quart de la hauteur.
    const r = rotatedBounds({ x: 0.25, y: 0.25, w: 0.5, h: 0.5, angle: 90 }, 2)
    expect(r.w).toBeCloseTo(1)
    expect(r.h).toBeCloseTo(0.25)
  })

  it('relit l’angle d’une zone et l’omet s’il est nul', () => {
    const out = parseMasks([
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2, angle: 30 },
      { x: 0.5, y: 0.5, w: 0.1, h: 0.1, angle: 0 },
    ])!
    expect(out[0].angle).toBe(30)
    expect(out[1].angle).toBeUndefined()
    expect(masksKey([mask({ angle: 10 })])).not.toBe(masksKey([mask()]))
  })
})
