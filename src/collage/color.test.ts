import { describe, expect, it } from 'vitest'
import {
  adjustPixel,
  autoAdjust,
  colorPixel,
  combine,
  FILTERS,
  isIdentity,
  lookPixel,
  paramsForPhoto,
  vignetteFor,
  type RGB,
} from './color'
import { NEUTRAL } from './types'

const grey: RGB = [0.5, 0.5, 0.5]
const red: RGB = [0.8, 0.2, 0.2]
const close = (a: RGB, b: RGB) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5))

describe('réglages', () => {
  it('neutre = aucun changement', () => {
    close(adjustPixel(red, NEUTRAL), red)
    close(adjustPixel(grey, NEUTRAL), grey)
  })

  it('exposition et luminosité éclaircissent, valeurs négatives assombrissent', () => {
    expect(adjustPixel(grey, combine({ exposure: 0.5 }))[0]).toBeGreaterThan(0.5)
    expect(adjustPixel(grey, combine({ brightness: -0.5 }))[0]).toBeLessThan(0.5)
  })

  it('le contraste écarte les tons du gris moyen', () => {
    const c = combine({ contrast: 0.6 })
    expect(adjustPixel([0.7, 0.7, 0.7], c)[0]).toBeGreaterThan(0.7)
    expect(adjustPixel([0.3, 0.3, 0.3], c)[0]).toBeLessThan(0.3)
  })

  it('ombres : éclaircit le sombre, touche peu au clair', () => {
    const c = combine({ shadows: 1 })
    const dark = adjustPixel([0.1, 0.1, 0.1], c)[0] - 0.1
    const light = adjustPixel([0.9, 0.9, 0.9], c)[0] - 0.9
    expect(dark).toBeGreaterThan(0.2)
    expect(light).toBeLessThan(0.02)
  })

  it('chaleur : plus de rouge, moins de bleu', () => {
    const [r, , b] = adjustPixel(grey, combine({ warmth: 1 }))
    expect(r).toBeGreaterThan(0.5)
    expect(b).toBeLessThan(0.5)
  })

  it('saturation -1 donne du gris', () => {
    const [r, g, b] = adjustPixel(red, combine({ saturation: -1 }))
    expect(r).toBeCloseTo(g, 5)
    expect(g).toBeCloseTo(b, 5)
  })

  it('les réglages collage + photo s’additionnent et restent bornés', () => {
    expect(combine({ exposure: 0.7 }, { exposure: 0.6 }).exposure).toBe(1)
    expect(combine({ vignette: -0.5 }).vignette).toBe(0)
  })

  it('reste toujours entre 0 et 1', () => {
    for (const v of adjustPixel([1, 1, 1], combine({ exposure: 1, brightness: 1, contrast: 1 }))) expect(v).toBeLessThanOrEqual(1)
  })
})

describe('filtres', () => {
  it('20 filtres, 4 par famille, identifiants uniques', () => {
    expect(FILTERS).toHaveLength(20)
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(20)
  })

  it('noir et blanc : les trois canaux égaux', () => {
    const [r, g, b] = lookPixel(red, FILTERS.find((f) => f.id === 'nb')!.look)
    expect(r).toBeCloseTo(g, 5)
    expect(g).toBeCloseTo(b, 5)
  })

  it('intensité 0 = sans filtre, intensité partielle = entre les deux', () => {
    const look = FILTERS.find((f) => f.id === 'glacier')!.look
    close(colorPixel(red, { adjust: NEUTRAL, look, intensity: 0 }), red)
    const full = colorPixel(red, { adjust: NEUTRAL, look, intensity: 1 })
    const half = colorPixel(red, { adjust: NEUTRAL, look, intensity: 0.5 })
    expect(half[2]).toBeCloseTo((red[2] + full[2]) / 2, 5)
  })
})

describe('paramètres par photo', () => {
  const doc = {
    adjust: { exposure: 0.2, vignette: 0.3 },
    filter: { id: 'vintage', intensity: 0.5 },
    photos: [{ adjust: { exposure: 0.1 } }, {}] as never,
  }

  it('additionne collage et photo, garde le filtre du collage', () => {
    const p = paramsForPhoto(doc, 0)
    expect(p.adjust.exposure).toBeCloseTo(0.3)
    expect(p.look).not.toBeNull()
    expect(p.intensity).toBe(0.5)
  })

  it('vignettage = réglage + filtre pondéré', () => {
    expect(vignetteFor(doc, 1)).toBeCloseTo(0.3 + 0.4 * 0.5)
  })

  it('reconnaît un traitement sans effet', () => {
    expect(isIdentity({ adjust: combine({ vignette: 0.5 }), look: null, intensity: 0 })).toBe(true)
    expect(isIdentity({ adjust: combine({ contrast: 0.1 }), look: null, intensity: 0 })).toBe(false)
  })
})

describe('autoAdjust', () => {
  it('éclaircit une photo sombre, assombrit une photo claire', () => {
    const fill = (v: number) => new Uint8ClampedArray(Array.from({ length: 400 }, (_, i) => (i % 4 === 3 ? 255 : v)))
    expect(autoAdjust(fill(40)).exposure!).toBeGreaterThan(0)
    expect(autoAdjust(fill(220)).exposure!).toBeLessThan(0)
  })

  it('réchauffe une photo trop bleue', () => {
    const blue = new Uint8ClampedArray(Array.from({ length: 400 }, (_, i) => [90, 110, 200, 255][i % 4]))
    expect(autoAdjust(blue).warmth!).toBeGreaterThan(0)
  })
})
