import { describe, expect, it } from 'vitest'
import { createLimiter, fitWithin, isHeic } from './images'

describe('fitWithin', () => {
  it('réduit sans déformer', () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750 })
    expect(fitWithin(3000, 4000, 1000)).toEqual({ width: 750, height: 1000 })
  })

  it('n’agrandit jamais', () => {
    expect(fitWithin(800, 600, 1000)).toEqual({ width: 800, height: 600 })
  })
})

describe('isHeic', () => {
  it('reconnaît les photos d’iPhone', () => {
    expect(isHeic('image/heic')).toBe(true)
    expect(isHeic('image/HEIF')).toBe(true)
    expect(isHeic('image/jpeg')).toBe(false)
  })
})

describe('createLimiter', () => {
  it('ne dépasse jamais la limite de tâches simultanées', async () => {
    const schedule = createLimiter(2)
    let running = 0
    let peak = 0
    const task = () =>
      schedule(async () => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
      })
    await Promise.all(Array.from({ length: 6 }, task))
    expect(peak).toBe(2)
  })
})
