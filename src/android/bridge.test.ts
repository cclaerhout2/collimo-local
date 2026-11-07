import { describe, expect, it, vi } from 'vitest'
import { CHUNK, createAndroidBridge, toBase64 } from './bridge'

vi.mock('@capacitor/core', () => ({
  Capacitor: { convertFileSrc: (p: string) => `https://localhost/_capacitor_file_${p}` },
  registerPlugin: () => ({}),
}))

/**
 * Module natif simulé : enregistre les appels et reconstitue les envois.
 * @returns le module et les fichiers écrits
 */
function fakePlugin() {
  const temps = new Map<string, string[]>()
  const written: Record<string, Uint8Array> = {}
  const plugin = {
    appendTemp: vi.fn(async ({ id, data }: { id: string; data: string }) => void temps.set(id, [...(temps.get(id) ?? []), data])),
    commitTemp: vi.fn(async ({ id, dir, name, replace }: { id: string; dir?: string; name?: string; replace?: string }) => {
      const bytes = (temps.get(id) ?? []).flatMap((b64) => [...Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))])
      const path = replace ?? `${dir}/${name}`
      written[path] = new Uint8Array(bytes)
      return { path, name: name ?? 'x', size: bytes.length, modifiedTime: 't', mimeType: 'image/jpeg' }
    }),
    listImages: async () => ({
      files: ['IMG_10.jpg', 'img_2.jpg', 'IMG_1.jpg'].map((name) => ({
        path: `content://x/${name}`,
        name,
        size: 1,
        modifiedTime: 't',
        mimeType: 'image/jpeg',
      })),
    }),
    listFiles: async () => ({
      files: [
        { path: 'a', name: 'a', size: 1, modifiedTime: '2026-01-01', mimeType: 'image/jpeg' },
        { path: 'b', name: 'b', size: 1, modifiedTime: '2026-02-01', mimeType: 'image/jpeg' },
      ],
    }),
    loadSettings: vi.fn(async () => ({ data: '{"version":1,"lang":"en"}' })),
    saveSettings: vi.fn(async () => {}),
    pickFolder: async () => ({}),
    findChild: async () => ({}),
    thumbnail: async () => ({ path: '/data/cache/miniatures/abc.jpg' }),
  }
  return { plugin, written }
}

describe('pont Android', () => {
  it('encode en base64 comme le navigateur, même au-delà de 32 Kio', () => {
    const big = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256)
    const back = Uint8Array.from(atob(toBase64(big)), (c) => c.charCodeAt(0))
    expect(back).toEqual(big)
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID')
  })

  it('envoie un collage par morceaux, sans rien perdre', async () => {
    const { plugin, written } = fakePlugin()
    const bridge = createAndroidBridge(plugin as never)
    const data = Uint8Array.from({ length: CHUNK * 2 + 123 }, (_, i) => i % 251)
    await bridge.writeNewFile('content://dossier', 'Collimo_1.jpg', data)
    expect(plugin.appendTemp).toHaveBeenCalledTimes(3)
    expect(written['content://dossier/Collimo_1.jpg']).toEqual(data)
    await bridge.replaceFile('content://cat.json', new Uint8Array(0))
    expect(written['content://cat.json']).toEqual(new Uint8Array(0))
  })

  it('trie les photos dans l’ordre naturel et les fichiers du plus récent au plus ancien', async () => {
    const bridge = createAndroidBridge(fakePlugin().plugin as never)
    expect((await bridge.listImages('content://x')).map((f) => f.name)).toEqual(['IMG_1.jpg', 'img_2.jpg', 'IMG_10.jpg'])
    expect((await bridge.listFiles('content://x')).map((f) => f.name)).toEqual(['b', 'a'])
  })

  it('lit et écrit les réglages en JSON, et rend null pour un choix annulé', async () => {
    const { plugin } = fakePlugin()
    const bridge = createAndroidBridge(plugin as never)
    expect(await bridge.loadSettings()).toEqual({ version: 1, lang: 'en' })
    await bridge.saveSettings({ version: 1 })
    expect(plugin.saveSettings).toHaveBeenCalledWith({ data: '{"version":1}' })
    plugin.loadSettings.mockResolvedValueOnce({ data: '{abîmé' })
    expect(await bridge.loadSettings()).toBeNull()
    expect(await bridge.pickFolder({ title: 'x' })).toBeNull()
    expect(await bridge.findChild!('content://x', 'a.jpg')).toBeNull()
  })

  it('sert fichiers et miniatures par le serveur local de Capacitor', async () => {
    const bridge = createAndroidBridge(fakePlugin().plugin as never)
    expect(bridge.platform).toBe('android')
    expect(bridge.fileUrl!('/data/files/a.jpg')).toBe('https://localhost/_capacitor_file_/data/files/a.jpg')
    expect(await bridge.thumbnail!('content://x/a.jpg', 400, 'v')).toBe('https://localhost/_capacitor_file_/data/cache/miniatures/abc.jpg')
  })
})
