import { describe, expect, it } from 'vitest'
import { collageStamp, uniqueCollageBaseName } from './naming'

const date = new Date(2026, 10, 6, 23, 7, 12)

describe('collageStamp', () => {
  it('formate la date à la seconde, en heure locale', () => {
    expect(collageStamp(date)).toBe('Collimo_2026-11-06_23-07-12')
  })

  it('complète les nombres à deux chiffres', () => {
    expect(collageStamp(new Date(2027, 0, 2, 3, 4, 5))).toBe('Collimo_2027-01-02_03-04-05')
  })
})

describe('uniqueCollageBaseName', () => {
  it('garde le nom quand il est libre', () => {
    expect(uniqueCollageBaseName(date, ['Collimo_2026-11-06_23-00-00.jpg'])).toBe('Collimo_2026-11-06_23-07-12')
  })

  it('ajoute _2 quand l’image ou le projet existe déjà', () => {
    expect(uniqueCollageBaseName(date, ['Collimo_2026-11-06_23-07-12.collimo.json'])).toBe('Collimo_2026-11-06_23-07-12_2')
  })

  it('passe au premier suffixe libre', () => {
    const names = ['Collimo_2026-11-06_23-07-12.jpg', 'Collimo_2026-11-06_23-07-12_2.png', 'Collimo_2026-11-06_23-07-12_3.collimo.json']
    expect(uniqueCollageBaseName(date, names)).toBe('Collimo_2026-11-06_23-07-12_4')
  })
})
