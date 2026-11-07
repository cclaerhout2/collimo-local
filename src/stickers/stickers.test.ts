import { describe, expect, it } from 'vitest'
import { searchIcons, type IconEntry } from './catalog'
import { fontCssUrl, nearestWeight } from './fonts'
import { normalize, searchTerms } from './keywords'

const entries: IconEntry[] = [
  { set: 'ph', name: 'heart', categories: ['games'], tags: ['love', 'like'] },
  { set: 'ph', name: 'heart-break', categories: ['games'], tags: ['sad'] },
  { set: 'ph', name: 'cake', categories: ['commerce'], tags: ['birthday', 'party'] },
  { set: 'fluent', name: 'birthday-cake', categories: ['food-and-drink'] },
  { set: 'fluent', name: 'red-heart', categories: ['symbols'] },
]

describe('recherche de stickers', () => {
  it('normalise accents et casse', () => {
    expect(normalize('  Cœur Éclair ')).toBe('coeur eclair')
  })

  it('traduit les mots français, accepte le pluriel', () => {
    expect(searchTerms('cœurs')).toEqual(expect.arrayContaining(['heart']))
    expect(searchTerms('gâteau')).toEqual(expect.arrayContaining(['cake', 'birthday']))
  })

  it('trouve en français et en anglais, meilleurs résultats d’abord', () => {
    expect(searchIcons(entries, 'coeur').map((e) => e.name)).toEqual(['heart', 'heart-break', 'red-heart'])
    expect(searchIcons(entries, 'birthday').map((e) => e.name)).toEqual(['birthday-cake', 'cake'])
  })

  it('sans saisie, renvoie tout', () => {
    expect(searchIcons(entries, '  ')).toHaveLength(entries.length)
  })
})

describe('polices', () => {
  it('choisit la graisse la plus proche', () => {
    expect(nearestWeight([300, 400, 900], 700)).toBe(900)
    expect(nearestWeight([400], 700)).toBe(400)
  })

  it('construit l’adresse Google Fonts', () => {
    expect(fontCssUrl('Open Sans', [700, 400])).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap')
    expect(fontCssUrl('Lato', [400], true)).toBe('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;1,400&display=swap')
  })
})
