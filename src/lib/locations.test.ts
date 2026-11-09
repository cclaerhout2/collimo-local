import { describe, expect, it } from 'vitest'
import type { FolderPath, Shortcut } from '../google/types'
import {
  addShortcut,
  currentFolder,
  folderLabel,
  isPinned,
  MAX_RECENTS,
  migrateSettings,
  moveShortcut,
  pushRecent,
  removeShortcut,
  renameShortcut,
  shortcutLabel,
} from './locations'

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

describe('renommage et ordre', () => {
  it('renomme un raccourci et revient au nom du dossier si le nom est vide ou identique', () => {
    const named = renameShortcut([sc('a'), sc('b')], 'a', '  Mes   photos ', 'Mon Drive')
    expect(shortcutLabel(named[0], 'Mon Drive')).toBe('Mes photos')
    expect(named[1]).toEqual(sc('b'))
    expect(renameShortcut(named, 'a', '   ', 'Mon Drive')[0]).toEqual(sc('a'))
    expect(renameShortcut(named, 'a', 'A', 'Mon Drive')[0]).toEqual(sc('a'))
    const root: Shortcut = { drive: { id: null, name: 'Mon Drive' }, folder: { id: 'root', name: 'My Drive' } }
    expect(renameShortcut([root], 'root', 'Mon Drive', 'Mon Drive')[0].label).toBeUndefined()
    expect(renameShortcut([sc('a')], 'a', 'x'.repeat(100), 'Mon Drive')[0].label).toHaveLength(60)
  })

  it('déplace un raccourci, avec une position bornée', () => {
    const ids = (l: Shortcut[]) => l.map((s) => s.folder.id)
    const list = [sc('a'), sc('b'), sc('c')]
    expect(ids(moveShortcut(list, 0, 2))).toEqual(['b', 'c', 'a'])
    expect(ids(moveShortcut(list, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(ids(moveShortcut(list, 1, 9))).toEqual(['a', 'c', 'b'])
    expect(moveShortcut(list, 1, 1)).toBe(list)
    expect(moveShortcut(list, 0, -3)).toBe(list)
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
