import { beforeEach, describe, expect, it } from 'vitest'
import type { CollageDoc } from '../collage/types'
import { clearDraft, draftHasUnsaved, loadDraft, saveDraft, type Draft } from './draft'

const doc = {
  version: 1,
  ratio: 'square',
  layoutId: 'x',
  photos: [],
  borders: { spacing: 0, margin: 0, radius: 0 },
  background: '#fff',
} as unknown as CollageDoc
const draft: Draft = {
  version: 1,
  email: 'A@B.com',
  updatedAt: '2026-11-09T10:00:00.000Z',
  folder: { drive: { id: null, name: 'Mon Drive' }, path: [{ id: 'f', name: 'Photos' }] },
  docs: [doc, doc],
  index: 1,
  saved: [true, false],
}

describe('brouillon', () => {
  beforeEach(() => localStorage.clear())

  it('enregistre, relit (sans tenir compte de la casse de l’adresse) et efface', () => {
    saveDraft(draft)
    expect(loadDraft('a@b.com')).toEqual(draft)
    expect(loadDraft('autre@b.com')).toBeNull()
    clearDraft('a@b.com')
    expect(loadDraft('a@b.com')).toBeNull()
  })

  it('ignore un brouillon illisible ou d’une autre version', () => {
    localStorage.setItem('collimo.draft.a@b.com', '{pas du json')
    expect(loadDraft('a@b.com')).toBeNull()
    localStorage.setItem('collimo.draft.a@b.com', JSON.stringify({ ...draft, version: 2 }))
    expect(loadDraft('a@b.com')).toBeNull()
    localStorage.setItem('collimo.draft.a@b.com', JSON.stringify({ ...draft, docs: [] }))
    expect(loadDraft('a@b.com')).toBeNull()
  })

  it('borne la position et répare la liste des enregistrés', () => {
    localStorage.setItem('collimo.draft.a@b.com', JSON.stringify({ ...draft, index: 9, saved: [true] }))
    const d = loadDraft('a@b.com')!
    expect(d.index).toBe(1)
    expect(d.saved).toEqual([false, false])
  })

  it('sait s’il reste du travail non enregistré', () => {
    expect(draftHasUnsaved(draft)).toBe(true)
    expect(draftHasUnsaved({ ...draft, saved: [true, true] })).toBe(false)
  })
})
