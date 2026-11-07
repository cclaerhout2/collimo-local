import { describe, expect, it } from 'vitest'
import { layoutById, layoutsFor, setCustomCatalogue } from '../collage/catalog'
import { emptyCatalogue, parseCatalogue, setBuiltinHidden, upsertLayout, type CustomLayout } from '../collage/catalog/custom'
import { gridTemplate } from '../collage/factory/ops'
import { createMockServices } from '../google/mock'
import { CatalogueGrantError, loadCatalogue, saveCatalogue } from './store'

const cfg = { catalogueDriveId: '', catalogueDriveName: 'Collimo – Catalogue' }

const sample = (over: Partial<CustomLayout> = {}): CustomLayout => ({
  id: 'u-test01',
  photos: 4,
  family: 'grille',
  geo: gridTemplate(2, 2),
  status: 'published',
  position: 'end',
  createdAt: '',
  createdBy: '',
  updatedAt: '',
  updatedBy: '',
  ...over,
})

describe('catalogue de l\'usine', () => {
  it('lit un fichier valide et écarte ce qui est invalide', () => {
    const raw = {
      format: 'collimo-catalogue',
      version: 1,
      layouts: [
        sample(),
        { ...sample({ id: 'u-bad001' }), photos: 3 }, // 4 cases pour 3 photos
        { ...sample({ id: 'u-bad002' }), geo: [{ kind: 'path', d: 'M0 0L1 0<script>' }] },
        { ...sample({ id: 'p04-01' }) }, // identifiant réservé aux dispositions intégrées
      ],
      hiddenBuiltins: ['p04-02', 'nimporte', 42],
    }
    const { data, rejected } = parseCatalogue(raw)
    expect(data.layouts.map((l) => l.id)).toEqual(['u-test01'])
    expect(rejected).toBe(3)
    expect(data.hiddenBuiltins).toEqual(['p04-02'])
    expect(() => parseCatalogue({ format: 'autre' })).toThrow()
  })

  it('publié : proposé à la fin ; masqué : absent de la liste mais encore lisible ; brouillon : invisible', () => {
    const base = layoutsFor(4).length
    let c = upsertLayout(emptyCatalogue(), sample())
    c = upsertLayout(c, sample({ id: 'u-first1', position: 'start' }))
    c = upsertLayout(c, sample({ id: 'u-hidden', status: 'hidden' }))
    c = upsertLayout(c, sample({ id: 'u-draft1', status: 'draft' }))
    c = setBuiltinHidden(c, 'p04-02', true)
    setCustomCatalogue(c)
    const ids = layoutsFor(4).map((l) => l.id)
    expect(ids.length).toBe(base + 2 - 1)
    expect(ids[0]).toBe('u-first1')
    expect(ids.at(-1)).toBe('u-test01')
    expect(ids).not.toContain('p04-02')
    expect(ids).not.toContain('u-hidden')
    expect(layoutById('u-hidden')?.id).toBe('u-hidden')
    expect(layoutById('p04-02')?.id).toBe('p04-02')
    expect(layoutById('u-draft1')).toBeUndefined()
    setCustomCatalogue(null)
    expect(layoutsFor(4).length).toBe(base)
  })

  it('enregistre sur le Drive partagé (Drive simulé), puis relit', async () => {
    const { drive } = createMockServices()
    const state = await loadCatalogue(drive, cfg)
    expect(state?.isAdmin).toBe(true)
    expect(state?.file).toBeNull()
    const saved = await saveCatalogue(drive, state!, (c) => upsertLayout(c, sample()), 'demo@entreprise.com')
    expect(saved.file).not.toBeNull()
    const again = await loadCatalogue(drive, cfg)
    expect(again?.data.layouts.map((l) => l.id)).toEqual(['u-test01'])
    expect(again?.data.updatedBy).toBe('demo@entreprise.com')
  })

  it('catalogue créé par un autre admin : demande d\'autorisation puis enregistrement', async () => {
    history.replaceState(null, '', '/?catalogue=autoriser')
    const { drive, picker } = createMockServices()
    const state = (await loadCatalogue(drive, cfg))!
    await expect(saveCatalogue(drive, state, (c) => upsertLayout(c, sample()), 'x')).rejects.toBeInstanceOf(CatalogueGrantError)
    await picker.pickFile({ id: state.drive.id, name: state.drive.name }, 'fr', '', 'application/json')
    const saved = await saveCatalogue(drive, state, (c) => upsertLayout(c, sample()), 'x')
    expect(saved.data.layouts).toHaveLength(1)
    history.replaceState(null, '', '/')
  }, 20_000)
})
