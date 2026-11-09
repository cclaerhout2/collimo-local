import { describe, expect, it } from 'vitest'
import type { DriveFileInfo, DriveService } from '../google/types'
import { groupProjects, migrateCollages, renamedFileNames, stripExtension } from './ProjectsList'

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

describe('migrateCollages', () => {
  /** Client Drive factice qui note les appels de mise à jour. */
  function fakeDrive() {
    const updates: { id: string; change: unknown; move: unknown }[] = []
    const drive = {
      ensureFolder: async () => 'projets',
      updateFileMeta: async (id: string, change: unknown, move?: unknown) => {
        updates.push({ id, change, move })
        return { id, name: 'x' }
      },
    } as unknown as DriveService
    return { drive, updates }
  }

  it('déplace les anciens projets dans Projets et relie image et projet par propriétés', async () => {
    const img: DriveFileInfo = { id: 'i', name: 'a.jpg' }
    const prj: DriveFileInfo = { id: 'p', name: 'a.collimo.json' }
    const { drive, updates } = fakeDrive()
    const changed = await migrateCollages(drive, 'collimo', [img, prj], [{ project: prj, image: img, baseName: 'a' }])
    expect(changed).toBe(true)
    expect(updates).toEqual([
      { id: 'p', change: { appProperties: { collimo: 'project', pair: 'i' } }, move: { addParents: 'projets', removeParents: 'collimo' } },
      { id: 'i', change: { appProperties: { collimo: 'image', pair: 'p' } }, move: undefined },
    ])
  })

  it('ne touche pas aux collages déjà au nouveau format', async () => {
    const img: DriveFileInfo = { id: 'i', name: 'a.jpg', appProperties: { collimo: 'image', pair: 'p' } }
    const prj: DriveFileInfo = { id: 'p', name: 'a.collimo.json', appProperties: { collimo: 'project', pair: 'i' } }
    const { drive, updates } = fakeDrive()
    // Le projet n'est pas à la racine (il est déjà dans Projets) : rien à faire.
    expect(await migrateCollages(drive, 'collimo', [img], [{ project: prj, image: img, baseName: 'a' }])).toBe(false)
    expect(updates).toEqual([])
  })

  it('déplace un projet sans image, sans lui inventer de lien', async () => {
    const prj: DriveFileInfo = { id: 'p', name: 'seul.collimo.json' }
    const { drive, updates } = fakeDrive()
    expect(await migrateCollages(drive, 'collimo', [prj], [{ project: prj, baseName: 'seul' }])).toBe(true)
    expect(updates).toEqual([{ id: 'p', change: {}, move: { addParents: 'projets', removeParents: 'collimo' } }])
  })
})
