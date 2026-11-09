import { describe, expect, it } from 'vitest'
import { groupProjects, renamedFileNames, stripExtension } from './ProjectsList'

describe('groupProjects', () => {
  it('associe chaque projet à son image par le nom (anciens collages), et ignore les autres fichiers', () => {
    const entries = groupProjects([
      { id: '1', name: 'Collimo_2026-11-06_23-07-12.jpg' },
      { id: '2', name: 'Collimo_2026-11-06_23-07-12.collimo.json' },
      { id: '3', name: 'Collimo_2026-11-06_23-15-40.collimo.json' },
      { id: '4', name: 'notes.txt' },
    ])
    expect(entries.map((e) => [e.baseName, e.image?.id])).toEqual([
      ['Collimo_2026-11-06_23-07-12', '1'],
      ['Collimo_2026-11-06_23-15-40', undefined],
    ])
  })

  it('relie par les propriétés Collimo malgré un renommage, et prend le nom de l’image', () => {
    const entries = groupProjects([
      { id: 'img', name: 'Soirée équipe.jpg', appProperties: { collimo: 'image', pair: 'prj' } },
      { id: 'prj', name: 'Collimo_2026-11-09_11-59-02.collimo.json', appProperties: { collimo: 'project', pair: 'img' } },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0].image?.id).toBe('img')
    expect(entries[0].baseName).toBe('Soirée équipe')
  })

  it('reconnaît un projet renommé sans son suffixe grâce à sa propriété, et un lien dans un seul sens', () => {
    const entries = groupProjects([
      { id: 'img', name: 'photo.png', appProperties: { collimo: 'image', pair: 'prj' } },
      { id: 'prj', name: 'mon collage.json', appProperties: { collimo: 'project' } },
    ])
    expect(entries.map((e) => [e.baseName, e.image?.id])).toEqual([['photo', 'img']])
  })
})

describe('renommage', () => {
  it('retire l’extension', () => {
    expect(stripExtension('a.b.jpg')).toBe('a.b')
    expect(stripExtension('x.collimo.json')).toBe('x')
    expect(stripExtension('sans extension')).toBe('sans extension')
  })

  it('garde l’extension de l’image et nettoie les caractères interdits', () => {
    const entry = { project: { id: 'p', name: 'x.collimo.json' }, baseName: 'x', image: { id: 'i', name: 'x.PNG' } }
    expect(renamedFileNames(entry, ' Soirée : équipe / 2026 ')).toEqual({
      image: 'Soirée équipe 2026.PNG',
      project: 'Soirée équipe 2026.collimo.json',
    })
    expect(renamedFileNames({ ...entry, image: undefined }, 'a')).toEqual({ image: undefined, project: 'a.collimo.json' })
  })
})
