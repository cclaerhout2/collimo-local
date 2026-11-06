import { describe, expect, it } from 'vitest'
import { parseProject, ProjectFormatError, projectBaseName, serializeProject } from './project'
import { DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc } from './types'

const doc: CollageDoc = {
  version: 1,
  ratio: '4:5',
  layoutId: 'inexistant',
  photos: [{ id: 'a', name: 'a.jpg', mimeType: 'image/jpeg', width: 10, height: 20, crop: { ...DEFAULT_CROP, zoom: 1.5, ox: 0.2 } }],
  borders: DEFAULT_BORDERS,
  background: '#112233',
  createdFrom: 'Collimo_2026-11-06_23-07-12',
}

describe('fichier projet', () => {
  it('relit ce qui a été écrit', () => {
    const back = parseProject(JSON.parse(serializeProject(doc, new Date('2026-11-07T10:00:00Z'))))
    expect(back.photos).toEqual(doc.photos)
    expect(back.ratio).toBe('4:5')
    expect(back.background).toBe('#112233')
    expect(back.createdFrom).toBe(doc.createdFrom)
  })

  it('vide la disposition si elle n’existe plus, pour en choisir une autre', () => {
    expect(parseProject(JSON.parse(serializeProject(doc, new Date()))).layoutId).toBe('')
  })

  it('ramène les valeurs hors limites dans les limites', () => {
    const raw = JSON.parse(serializeProject(doc, new Date()))
    raw.doc.photos[0].crop = { zoom: 99, ox: -7, oy: 'n', angle: 0 }
    raw.doc.borders = { spacing: 3, margin: -1 }
    raw.doc.background = 'red; drop'
    const back = parseProject(raw)
    expect(back.photos[0].crop).toEqual({ zoom: 8, ox: -1, oy: 0, angle: 0, flip: false })
    expect(back.borders).toEqual({ spacing: 1, margin: 0, radius: 0 })
    expect(back.background).toBe('#ffffff')
  })

  it.each([null, {}, { app: 'autre', version: 1, doc }, { app: 'collimo', version: 1, doc: { photos: [] } }])(
    'refuse un fichier qui n’est pas un projet Collimo (%#)',
    (raw) => {
      expect(() => parseProject(raw)).toThrow(ProjectFormatError)
    },
  )

  it('garde une découpe ajustée valide, ignore une découpe invalide', () => {
    const two = { ...doc, layoutId: 'p02-01', photos: [doc.photos[0], { ...doc.photos[0], id: 'b' }] }
    const ok = parseProject(JSON.parse(serializeProject({ ...two, split: 'c(1.4*x,0.6*x)' }, new Date())))
    expect(ok.split).toBe('c(1.4*x,0.6*x)')
    const wrongCount = parseProject(JSON.parse(serializeProject({ ...two, split: 'c(x,x,x)' }, new Date())))
    expect(wrongCount.split).toBeUndefined()
    const garbage = parseProject(JSON.parse(serializeProject({ ...two, split: 'c(x' }, new Date())))
    expect(garbage.split).toBeUndefined()
  })

  it('retrouve le nom de base', () => {
    expect(projectBaseName('Collimo_2026-11-06_23-07-12_2.collimo.json')).toBe('Collimo_2026-11-06_23-07-12_2')
  })
})

describe('textes et stickers dans le projet', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><path d="M0 0h10v10z" fill="currentColor"/></svg>'

  it('relit textes, icônes et images', () => {
    const withOverlays = {
      ...doc,
      overlays: [
        { id: 't', type: 'text', cx: 0.5, cy: 0.2, angle: 5, opacity: 0.9, text: 'Bonjour', font: { family: 'Lato', weight: 400, italic: true }, size: 0.1, width: 0.8, align: 'left', color: '#ff0000', effects: { stroke: { on: true, color: '#000000', width: 0.5 } } },
        { id: 'i', type: 'icon', cx: 0.3, cy: 0.3, angle: 0, opacity: 1, set: 'ph', name: 'heart', svg, color: '#00ff00', size: 0.2 },
        { id: 'm', type: 'image', cx: 0.7, cy: 0.7, angle: 0, opacity: 1, fileId: 'logo', name: 'logo.png', mimeType: 'image/png', size: 0.3, aspect: 0.5 },
      ],
    } as unknown as CollageDoc
    const back = parseProject(JSON.parse(serializeProject(withOverlays, new Date())))
    expect(back.overlays?.map((o) => o.type)).toEqual(['text', 'icon', 'image'])
    const t = back.overlays![0]
    expect(t.type === 'text' && t.effects.stroke).toEqual({ on: true, color: '#000000', width: 0.5 })
    expect(t.type === 'text' && t.effects.shadow.on).toBe(false)
  })

  it('refuse un SVG qui contient du code', () => {
    const raw = JSON.parse(serializeProject(doc, new Date()))
    raw.doc.overlays = [
      { type: 'icon', set: 'ph', name: 'x', svg: '<svg><script>alert(1)</script></svg>' },
      { type: 'icon', set: 'ph', name: 'y', svg: '<svg onload="alert(1)"></svg>' },
      { type: 'icon', set: 'ph', name: 'z', svg: '<svg><image href="https://pirate.example/x.png"/></svg>' },
      { type: 'inconnu' },
    ]
    expect(parseProject(raw).overlays).toEqual([])
  })
})
