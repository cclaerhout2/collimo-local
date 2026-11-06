import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { detectLang, translate } from './index'

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('traductions', () => {
  it('FR et EN ont exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  it('chaque libellé a les mêmes variables dans les deux langues', () => {
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(fr[key]))
    }
  })

  it('aucun libellé vide', () => {
    for (const [key, value] of [...Object.entries(fr), ...Object.entries(en)]) {
      expect(value.trim(), key).not.toBe('')
    }
  })
})

describe('translate', () => {
  it('remplace les variables', () => {
    expect(translate('fr', 'gallery.selected', { count: 3, max: 20 })).toBe('3 / 20 sélectionnée(s)')
    expect(translate('en', 'gallery.selected', { count: 3, max: 20 })).toBe('3 / 20 selected')
  })
})

describe('detectLang', () => {
  it('prend la première langue reconnue', () => {
    expect(detectLang(['de-DE', 'en-GB', 'fr'])).toBe('en')
    expect(detectLang(['fr-BE'])).toBe('fr')
  })

  it('revient au français sinon', () => {
    expect(detectLang(['de-DE', 'es'])).toBe('fr')
    expect(detectLang([])).toBe('fr')
  })
})
