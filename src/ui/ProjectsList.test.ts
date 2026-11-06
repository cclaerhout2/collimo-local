import { describe, expect, it } from 'vitest'
import { groupProjects } from './ProjectsList'

describe('groupProjects', () => {
  it('associe chaque projet à son image, et ignore les autres fichiers', () => {
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
})
