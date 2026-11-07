import { describe, expect, it } from 'vitest'
import type { FolderPath, Shortcut } from '../google/types'
import { addShortcut, currentFolder, folderLabel, isPinned, MAX_RECENTS, migrateSettings, pushRecent, removeShortcut } from './locations'

const drive = { id: 'd1', name: 'Com' }
const sc = (id: string): Shortcut => ({ drive, folder: { id, name: id.toUpperCase() } })
const fp = (...ids: string[]): FolderPath => ({ drive, path: ids.map((id) => ({ id, name: id })) })

describe('raccourcis', () => {
  it('ajoute à la fin, sans doublon', () => {
    expect(addShortcut([sc('a')], sc('b')).map((s) => s.folder.id)).toEqual(['a', 'b'])
    const list = [sc('a')]
    expect(addShortcut(list, sc('a'))).toBe(list)
  })

  it('retire par dossier et sait si un dossier est épinglé', () => {
    expect(removeShortcut([sc('a'), sc('b')], 'a').map((s) => s.folder.id)).toEqual(['b'])
    expect(isPinned([sc('a')], 'a')).toBe(true)
    expect(isPinned([sc('a')], 'b')).toBe(false)
  })

  it('affiche la racine de Mon Drive avec le libellé traduit', () => {
    expect(folderLabel({ id: 'root', name: 'My Drive' }, 'Mon Drive')).toBe('Mon Drive')
    expect(folderLabel({ id: 'x', name: 'Photos' }, 'Mon Drive')).toBe('Photos')
  })
})

describe('récents', () => {
  it('place le dossier en tête, sans doublon, dans la limite', () => {
    const r = pushRecent([fp('a', 'b'), fp('c')], fp('x', 'b'))
    expect(r.map((x) => currentFolder(x).id)).toEqual(['b', 'c'])
    expect(r[0].path.map((p) => p.id)).toEqual(['x', 'b'])
    let many: FolderPath[] = []
    for (let i = 0; i < 10; i++) many = pushRecent(many, fp(`f${i}`))
    expect(many).toHaveLength(MAX_RECENTS)
    expect(currentFolder(many[0]).id).toBe('f9')
  })
})

describe('reprise des anciens réglages', () => {
  it("l'emplacement unique devient le premier raccourci et le dossier ouvert", () => {
    const s = migrateSettings({ version: 1, lang: 'fr', location: { drive, folder: { id: 'p', name: 'Photos' }, collimoFolderId: 'c' } })
    expect(s.location).toBeUndefined()
    expect(s.shortcuts).toEqual([{ drive, folder: { id: 'p', name: 'Photos' } }])
    expect(s.current).toEqual({ drive, path: [{ id: 'p', name: 'Photos' }] })
    expect(s.lang).toBe('fr')
  })

  it('garde les réglages au nouveau format et écarte les chemins vides', () => {
    const s = migrateSettings({ version: 1, shortcuts: [sc('a')], current: { drive, path: [] }, recents: [fp('a'), { drive, path: [] }] })
    expect(s.shortcuts).toEqual([sc('a')])
    expect(s.current).toBeUndefined()
    expect(s.recents).toEqual([fp('a')])
  })

  it('part de listes vides pour un nouvel utilisateur', () => {
    expect(migrateSettings({ version: 1 })).toEqual({ version: 1, shortcuts: [], current: undefined, recents: [] })
  })
})
