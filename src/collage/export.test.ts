import { describe, expect, it } from 'vitest'
import { buildLayout } from './catalog'
import { DESKTOP_MAX_SIDE, exportSize, HD_SIDE, IOS_MAX_SIDE, isAppleMobile, nativeLongSide, STANDARD_SIDE } from './export'
import { DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc } from './types'

const layout = buildLayout({ id: 'p02-test', photos: 2, family: 'grille', split: 'c(x,x)' })

function doc(photoSize: [number, number]): CollageDoc {
  const photo = { id: 'a', name: 'a.jpg', mimeType: 'image/jpeg', width: photoSize[0], height: photoSize[1], crop: DEFAULT_CROP }
  return { version: 1, ratio: '1:1', layoutId: layout.id, photos: [photo, { ...photo, id: 'b' }], borders: DEFAULT_BORDERS, background: '#fff' }
}

describe('exportSize', () => {
  it('Standard et HD visent le plus grand côté', () => {
    expect(exportSize('standard', 1, doc([4000, 3000]), layout, false)).toMatchObject({ width: STANDARD_SIDE, height: STANDARD_SIDE })
    expect(exportSize('hd', 9 / 16, doc([4000, 3000]), layout, false)).toMatchObject({ height: HD_SIDE, cappedForIos: false })
  })

  it('HD est limité sur iPhone et iPad, et le signale', () => {
    expect(exportSize('hd', 1, doc([4000, 3000]), layout, true)).toEqual({ width: IOS_MAX_SIDE, height: IOS_MAX_SIDE, cappedForIos: true })
  })

  it('Maximum suit la résolution des photos, avec un plafond', () => {
    // Deux colonnes : une photo de 3000 px de haut remplit toute la hauteur → côté natif 3000.
    expect(exportSize('max', 1, doc([2000, 3000]), layout, false).width).toBe(3000)
    expect(exportSize('max', 1, doc([20000, 30000]), layout, false).width).toBe(DESKTOP_MAX_SIDE)
  })

  it('Maximum ne descend jamais sous Standard', () => {
    expect(exportSize('max', 1, doc([300, 200]), layout, false).width).toBe(STANDARD_SIDE)
  })
})

describe('nativeLongSide', () => {
  it('ignore les photos sans dimensions connues', () => {
    const d = doc([4000, 3000])
    d.photos = d.photos.map((p) => ({ ...p, width: undefined }))
    expect(nativeLongSide(d, layout, 1)).toBeNull()
  })
})

describe('isAppleMobile', () => {
  it('reconnaît iPhone, iPad et iPad « bureau »', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5)).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false)
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 15)', 'Linux armv8l', 5)).toBe(false)
  })
})
