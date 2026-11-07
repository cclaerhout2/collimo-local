import { describe, expect, it } from 'vitest'
import { desktopTexts } from './desktop'
import { en } from './en'
import { fr } from './fr'
import { detectLang, enableDesktopTexts, translate } from './index'

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

describe('libellés de l’application Windows', () => {
  it('ne remplacent que des clés existantes, avec les mêmes variables (ou moins)', () => {
    for (const lang of ['fr', 'en'] as const) {
      const base = lang === 'fr' ? fr : en
      for (const [key, value] of Object.entries(desktopTexts[lang])) {
        expect(key in base, key).toBe(true)
        const allowed = placeholders(base[key as keyof typeof fr])
        for (const v of placeholders(value!)) expect(allowed, `${lang} ${key}`).toContain(v)
      }
    }
    expect(Object.keys(desktopTexts.en).sort()).toEqual(Object.keys(desktopTexts.fr).sort())
  })

  it('ne parlent plus de Google Drive', () => {
    enableDesktopTexts(true)
    try {
      expect(translate('fr', 'export.save')).toBe('Enregistrer')
      expect(translate('en', 'signin.button')).toBe('Get started')
      expect(translate('fr', 'gallery.location', { drive: 'X', folder: 'C:\\Photos' })).toBe('C:\\Photos')
    } finally {
      enableDesktopTexts(false)
    }
    expect(translate('fr', 'export.save')).toBe('Enregistrer dans Drive')
  })
})
