import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCatalogue, saveCatalogue } from '../catalogue/store'
import { saveCollage } from '../collage/save'
import type { DesktopBridge, LocalFile } from './bridge'
import { cleanError, createDesktopServices, joinPath, toFileInfo, toPhoto } from './services'

// Le rendu de l'image n'est pas l'objet de ces tests : l'export renvoie un faux JPEG.
vi.mock('../collage/export', () => ({
  exportCollage: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 1])], { type: 'image/jpeg' })),
}))

/**
 * Pont simulé : un petit système de fichiers en mémoire, à la Windows.
 * @returns le pont, ses fichiers et ses dossiers
 */
function fakeBridge() {
  const files = new Map<string, { data: Uint8Array; mtime: string }>()
  const dirs = new Set<string>(['C:\\Photos', 'C:\\AppData\\catalogue'])
  let settings: unknown = null
  let clock = 0
  const describe = (p: string): LocalFile => {
    const f = files.get(p)!
    const name = p.split('\\').pop()!
    const mimeType = name.endsWith('.json') ? 'application/json' : name.endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { path: p, name, size: f.data.length, modifiedTime: f.mtime, mimeType }
  }
  const put = (p: string, data: Uint8Array) => files.set(p, { data, mtime: new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString() })
  const list = (dir: string) => [...files.keys()].filter((p) => p.slice(0, p.lastIndexOf('\\')) === dir)
  const bridge: DesktopBridge = {
    platform: 'win32',
    userInfo: async () => ({ name: 'cedric', email: 'cedric@PC-01' }),
    pickFolder: async () => ({ path: 'C:\\Photos', name: 'Photos', writable: true }),
    pickFile: async ({ filter }) => (filter === 'image' ? describe('C:\\Photos\\IMG_1.jpg') : null),
    folderInfo: async (p) => {
      if (!dirs.has(p)) throw new Error(`Error invoking remote method 'collimo:folder-info': FileAccessError: Introuvable : ${p}`)
      return { path: p, name: p.split('\\').pop()!, writable: true }
    },
    listImages: async (p) =>
      list(p)
        .filter((x) => /\.(jpg|png)$/.test(x))
        .map(describe),
    listFiles: async (p, contains) =>
      list(p)
        .filter((x) => !contains || x.includes(contains))
        .map(describe)
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)),
    fileInfo: async (p) => describe(p),
    writeNewFile: async (dir, name, data) => {
      const p = `${dir}\\${name}`
      if (files.has(p)) throw new Error(`Ce fichier existe déjà : ${p}`)
      put(p, data)
      return describe(p)
    },
    replaceFile: async (p, data) => {
      put(p, data)
      return describe(p)
    },
    ensureDir: async (p) => void dirs.add(p),
    listFolders: async (p) =>
      [...dirs]
        .filter((d) => d.startsWith(`${p}\\`) && !d.slice(p.length + 1).includes('\\'))
        .map((d) => ({ path: d, name: d.split('\\').pop()!, writable: true })),
    renameFile: async (p, name) => {
      const f = files.get(p)!
      const target = `${p.slice(0, p.lastIndexOf('\\'))}\\${name}`
      if (files.has(target)) throw new Error(`Ce fichier existe déjà : ${name}`)
      files.delete(p)
      files.set(target, f)
      return describe(target)
    },
    moveFile: async (p, dir) => {
      const f = files.get(p)!
      const target = `${dir}\\${p.split('\\').pop()}`
      files.delete(p)
      files.set(target, f)
      return describe(target)
    },
    loadSettings: async () => settings,
    saveSettings: async (s) => void (settings = s),
    catalogueDir: async () => ({ path: 'C:\\AppData\\catalogue', name: 'catalogue', writable: true }),
    chooseCatalogueDir: async () => null,
  }
  put('C:\\Photos\\IMG_1.jpg', new Uint8Array([0xff, 0xd8]))
  put('C:\\Photos\\IMG_2.png', new Uint8Array([0x89]))
  return { bridge, files, dirs }
}

afterEach(() => vi.unstubAllGlobals())

/**
 * Fait lire les fichiers du pont simulé par `fetch` (comme le protocole collimo://file).
 * @param files - fichiers simulés
 */
function stubFetch(files: Map<string, { data: Uint8Array }>) {
  vi.stubGlobal('fetch', async (url: string) => {
    const p = new URL(url).searchParams.get('path')!
    const f = files.get(p)
    return f ? new Response(f.data.slice()) : new Response('', { status: 404 })
  })
}

describe('chemins et conversions', () => {
  it('assemble les chemins avec le séparateur du système', () => {
    expect(joinPath('C:\\Photos\\', 'Collimo', 'win32')).toBe('C:\\Photos\\Collimo')
    expect(joinPath('/home/a/Photos', 'Collimo', 'linux')).toBe('/home/a/Photos/Collimo')
  })

  it('transforme un fichier en photo et en fichier du dossier Collimo', () => {
    const f: LocalFile = {
      path: 'C:\\P\\a b.jpg',
      name: 'a b.jpg',
      size: 1,
      modifiedTime: 't',
      mimeType: 'image/jpeg',
      width: 4,
      height: 3,
    }
    expect(toPhoto(f)).toEqual({
      id: 'C:\\P\\a b.jpg',
      name: 'a b.jpg',
      mimeType: 'image/jpeg',
      thumbnailUrl: 'collimo://thumb/?path=C%3A%5CP%5Ca%20b.jpg&size=400&v=t',
      width: 4,
      height: 3,
      supported: true,
    })
    expect(toPhoto({ ...f, mimeType: 'image/tiff' }).supported).toBe(false)
    expect(toFileInfo(f).webViewLink).toBe('collimo://shell/?action=open&path=C%3A%5CP%5Ca%20b.jpg')
    expect(toFileInfo({ ...f, mimeType: 'application/json' }).thumbnailLink).toBeUndefined()
  })

  it('nettoie les messages d’erreur d’Electron', () => {
    expect(cleanError(new Error("Error invoking remote method 'collimo:x': FileAccessError: Introuvable : C:\\A")).message).toBe(
      'Introuvable : C:\\A',
    )
    expect(cleanError('brut').message).toBe('brut')
  })
})

describe('services de l’application Windows', () => {
  it('se « connecte » sans compte et parcourt les dossiers du PC', async () => {
    const { bridge } = fakeBridge()
    const s = createDesktopServices(bridge)
    expect(s.kind).toBe('desktop')
    await s.auth.signIn()
    expect(await s.drive.currentUser()).toEqual({ name: 'cedric', email: 'cedric@PC-01' })
    expect(await s.drive.listSharedDrives()).toEqual([])
    const picked = await s.picker.pickFolder({ id: null, name: '' }, 'fr', 'Choisir')
    expect(picked).toEqual({ id: 'C:\\Photos', name: 'Photos' })
    expect(await s.drive.getFolder('C:\\Photos')).toEqual({ id: 'C:\\Photos', name: 'Photos', driveId: null, canAddChildren: true })
    await expect(s.drive.getFolder('C:\\Absent')).rejects.toThrow(/^Introuvable : C:\\Absent$/)
    expect((await s.drive.listPhotos({ id: 'C:\\Photos' }, null)).map((p) => p.name)).toEqual(['IMG_1.jpg', 'IMG_2.png'])
    expect(await s.drive.ensureCollimoFolder('C:\\Photos')).toBe('C:\\Photos\\Collimo')
    expect(await s.picker.pickImage({ id: null, name: '' }, 'fr', 'x')).toEqual({ id: 'C:\\Photos\\IMG_1.jpg' })
  })

  it('retrouve par son nom une photo dont le dossier a bougé', async () => {
    const { bridge, files } = fakeBridge()
    stubFetch(files)
    const s = createDesktopServices(bridge)
    await s.drive.listPhotos({ id: 'C:\\Photos' }, null)
    // Collage créé sur un autre PC, ou avant le déplacement du dossier.
    const blob = await s.drive.fetchFileBlob('D:\\Ancien\\Vacances\\IMG_1.jpg')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8]))
    expect((await s.drive.getPhoto('\\\\serveur\\photos\\IMG_2.png')).id).toBe('C:\\Photos\\IMG_2.png')
    await expect(s.drive.fetchFileBlob('D:\\Ancien\\absente.jpg')).rejects.toThrow(/introuvable/)
  })

  it('mémorise les réglages, et ignore un format inconnu', async () => {
    const { bridge } = fakeBridge()
    const s = createDesktopServices(bridge)
    expect(await s.drive.loadSettings()).toBeNull()
    await s.drive.saveSettings({ version: 1, lang: 'en' })
    expect(await s.drive.loadSettings()).toEqual({ version: 1, lang: 'en' })
    await bridge.saveSettings({ version: 2 })
    expect(await s.drive.loadSettings()).toBeNull()
  })

  it('enregistre un collage (image + projet) sous un nom daté, sans écraser', async () => {
    const { bridge, files } = fakeBridge()
    stubFetch(files)
    const s = createDesktopServices(bridge)
    const folder = await s.drive.ensureCollimoFolder('C:\\Photos')
    const now = new Date(2026, 10, 7, 10, 0, 0)
    const args = {
      drive: s.drive,
      collimoFolderId: folder,
      doc: { version: 1, ratio: 1, layoutId: 'x', photos: [], borders: {}, background: '#fff' } as never,
      layout: {} as never,
      width: 10,
      height: 10,
      format: 'jpeg' as const,
      quality: 90,
      loadForCell: async () => ({}) as never,
      now,
    }
    const first = await saveCollage(args)
    const second = await saveCollage(args)
    expect(first.baseName).toBe('Collimo_2026-11-07_10-00-00')
    expect(second.baseName).not.toBe(first.baseName)
    // L'image à la racine du dossier Collimo, le projet dans son sous-dossier Projets, reliés par leur nom.
    const images = await s.drive.listFolderFiles(folder)
    expect(images.map((f) => f.name).sort()).toEqual(['Collimo_2026-11-07_10-00-00_2.jpg', 'Collimo_2026-11-07_10-00-00.jpg'].sort())
    const projects = await s.drive.listFolderFiles(`${folder}\\Projets`)
    expect(projects).toHaveLength(2)
    expect(images.find((f) => f.id === first.image.id)?.appProperties).toEqual({ collimo: 'image', pair: first.project.id })
    expect(projects.find((f) => f.id === first.project.id)?.appProperties).toEqual({ collimo: 'project', pair: first.image.id })
    const project = (await s.drive.readJson(first.project.id)) as { app: string }
    expect(project.app).toBe('collimo')
    expect(await (await s.drive.fetchFileBlob(first.image.id)).arrayBuffer()).toEqual(new Uint8Array([0xff, 0xd8, 1]).buffer)
    // Renommage : l'image puis le projet, qui restent appariés.
    await s.drive.updateFileMeta(first.image.id, { name: 'Vacances.jpg' })
    await s.drive.updateFileMeta(first.project.id, { name: 'Vacances.collimo.json' })
    const renamed = await s.drive.listFolderFiles(folder)
    expect(renamed.find((f) => f.name === 'Vacances.jpg')?.appProperties?.pair).toBe(`${folder}\\Projets\\Vacances.collimo.json`)
  })

  it('tient le catalogue de l’usine dans un dossier local, admin d’office', async () => {
    const { bridge, files } = fakeBridge()
    stubFetch(files)
    const s = createDesktopServices(bridge)
    const cfg = { catalogueDriveId: '', catalogueDriveName: 'Collimo – Catalogue' }
    const state = (await loadCatalogue(s.drive, cfg))!
    expect(state.isAdmin).toBe(true)
    expect(state.file).toBeNull()
    const saved = await saveCatalogue(s.drive, state, (c) => ({ ...c, hiddenBuiltins: ['p04-01'] }), 'cedric@PC-01')
    expect(saved.file?.id).toBe('C:\\AppData\\catalogue\\collimo-catalogue.json')
    const again = await saveCatalogue(s.drive, saved, (c) => ({ ...c, hiddenBuiltins: [...c.hiddenBuiltins, 'p04-02'] }), 'cedric@PC-01')
    expect(again.data.hiddenBuiltins).toEqual(['p04-01', 'p04-02'])
    const reread = (await loadCatalogue(s.drive, cfg))!
    expect(reread.data.hiddenBuiltins).toEqual(['p04-01', 'p04-02'])
    expect(reread.data.updatedBy).toBe('cedric@PC-01')
  })
})
