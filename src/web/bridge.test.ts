import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALBUM, createWebBridge, freeName, mimeOf, type AlbumStore } from './bridge'

/**
 * Stockage en mémoire, à la place d'IndexedDB.
 * @returns le stockage
 */
function memoryStore(): AlbumStore {
  const files = new Map<string, Parameters<AlbumStore['put']>[0]>()
  const thumbs = new Map<string, Blob>()
  const settings = new Map<string, unknown>()
  return {
    get: async (p) => files.get(p),
    put: async (f) => void files.set(f.path, f),
    remove: async (p) => void files.delete(p),
    list: async (dir) => [...files.values()].filter((f) => f.dir === dir),
    dirs: async () => [...new Set([...files.values()].map((f) => f.dir))],
    getThumb: async (k) => thumbs.get(k),
    putThumb: async (k, b) => void thumbs.set(k, b),
    getSetting: async (k) => settings.get(k),
    putSetting: async (k, v) => void settings.set(k, v),
  }
}

/**
 * Photo choisie dans la photothèque (simulée).
 * @param name - nom du fichier
 * @param type - type MIME donné par le navigateur
 * @returns le fichier
 */
const photo = (name: string, type = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], name, { type, lastModified: 1_700_000_000_000 })

beforeEach(() => {
  let n = 0
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:test/${++n}` }))
})

describe('version web locale', () => {
  it('donne un nom libre sans rien remplacer', () => {
    expect(freeName('IMG_1.jpg', new Set())).toBe('IMG_1.jpg')
    expect(freeName('IMG_1.jpg', new Set(['IMG_1.jpg', 'IMG_1 (2).jpg']))).toBe('IMG_1 (3).jpg')
    expect(freeName('scan', new Set(['scan']))).toBe('scan (2)')
  })

  it('reconnaît les photos HEIC sans type donné par le navigateur', () => {
    expect(mimeOf('IMG_7.HEIC', '')).toBe('image/heic')
    expect(mimeOf('a.jpg', 'image/jpeg')).toBe('image/jpeg')
  })

  it('copie les photos choisies dans l’album, en gardant les doublons sous un autre nom', async () => {
    const picks = [[photo('IMG_2.jpg'), photo('IMG_10.jpg'), photo('notes.txt', 'text/plain')], [photo('IMG_2.jpg')], []]
    const bridge = createWebBridge(memoryStore(), async () => picks.shift() ?? [])
    expect(await bridge.pickFolder({ title: 'x' })).toEqual({ path: ALBUM, name: 'Mes photos', writable: true })
    expect((await bridge.listImages(ALBUM)).map((f) => f.name)).toEqual(['IMG_2.jpg', 'IMG_10.jpg'])
    await bridge.pickFolder({ title: 'x' })
    expect((await bridge.listImages(ALBUM)).map((f) => f.name)).toEqual(['IMG_2 (2).jpg', 'IMG_2.jpg', 'IMG_10.jpg'])
    // Annulation : l'album existant reste choisi.
    expect((await bridge.pickFolder({ title: 'x' }))?.path).toBe(ALBUM)
  })

  it('n’ouvre rien quand l’utilisateur annule sans album', async () => {
    const bridge = createWebBridge(memoryStore(), async () => [])
    expect(await bridge.pickFolder({ title: 'x' })).toBeNull()
  })

  it('enregistre les collages sans écraser, et les relit', async () => {
    const bridge = createWebBridge(memoryStore(), async () => [])
    const dir = await bridge.ensureChildDir!(ALBUM, 'Collimo')
    const f = await bridge.writeNewFile(dir, 'Collimo_1.jpg', new Uint8Array([9, 8]))
    expect(f).toMatchObject({ path: '/Photos/Collimo/Collimo_1.jpg', mimeType: 'image/jpeg', size: 2 })
    await expect(bridge.writeNewFile(dir, 'Collimo_1.jpg', new Uint8Array([1]))).rejects.toThrow(/existe déjà/)
    await expect(bridge.writeNewFile(dir, 'piege.html', new Uint8Array([1]))).rejects.toThrow(/refusé/)
    expect(new Uint8Array(await (await bridge.readFile!(f.path)).arrayBuffer())).toEqual(new Uint8Array([9, 8]))
    const [listed] = await bridge.listFiles(dir)
    expect(listed.url).toMatch(/^blob:/)
    expect(await bridge.findChild!(dir, 'Collimo_1.jpg')).toBe(f.path)
    expect(await bridge.findChild!(dir, 'absent.jpg')).toBeNull()
  })

  it('garde les réglages et le catalogue', async () => {
    const bridge = createWebBridge(memoryStore(), async () => [])
    expect(await bridge.loadSettings()).toBeNull()
    await bridge.saveSettings({ version: 1, lang: 'en' })
    expect(await bridge.loadSettings()).toEqual({ version: 1, lang: 'en' })
    const cat = await bridge.catalogueDir()
    const file = await bridge.writeNewFile(cat.path, 'collimo-catalogue.json', new TextEncoder().encode('{}'))
    await bridge.replaceFile(file.path, new TextEncoder().encode('{"v":2}'))
    expect(await (await bridge.readFile!(file.path)).text()).toBe('{"v":2}')
    await expect(bridge.replaceFile('/Photos/IMG_1.jpg', new Uint8Array([1]))).rejects.toThrow(/JSON/)
  })
})
