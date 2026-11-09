/**
 * Pont des applications Android et iPhone : les mêmes fonctions que celles de l'application de bureau
 * (voir `desktop/bridge.ts`), assurées par le module natif `CollimoStorage` (Storage Access Framework
 * sur Android, album de l'app et photothèque sur iPhone). L'éditeur et les services sont ainsi les mêmes
 * sur téléphone et sur ordinateur.
 * Le contenu des fichiers est lu par le serveur local de Capacitor ; seules les écritures passent par
 * le module, en morceaux.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { DesktopBridge, LocalFile, LocalFolder, PickFilter } from '../desktop/bridge'

/** Fonctions du module natif (Android : `CollimoStoragePlugin.java` ; iPhone : `CollimoStoragePlugin.swift`). */
interface CollimoStorage {
  userInfo(): Promise<{ name: string; email: string }>
  pickFolder(o: { title: string }): Promise<{ folder?: LocalFolder }>
  pickFile(o: { title: string; filter: PickFilter }): Promise<{ file?: LocalFile }>
  folderInfo(o: { path: string }): Promise<LocalFolder>
  fileInfo(o: { path: string }): Promise<LocalFile>
  listImages(o: { path: string }): Promise<{ files: LocalFile[] }>
  listFiles(o: { path: string; contains?: string }): Promise<{ files: LocalFile[] }>
  listFolders(o: { path: string }): Promise<{ folders: LocalFolder[] }>
  renameFile(o: { path: string; name: string }): Promise<LocalFile>
  moveFile(o: { path: string; dir: string }): Promise<LocalFile>
  findChild(o: { dir: string; name: string }): Promise<{ path?: string }>
  ensureChildDir(o: { dir: string; name: string }): Promise<{ path: string }>
  thumbnail(o: { path: string; size: number; version: string }): Promise<{ path: string }>
  appendTemp(o: { id: string; data: string }): Promise<void>
  commitTemp(o: { id: string; dir?: string; name?: string; replace?: string }): Promise<LocalFile>
  loadSettings(): Promise<{ data?: string }>
  saveSettings(o: { data: string }): Promise<void>
  catalogueDir(): Promise<LocalFolder>
  chooseCatalogueDir(o: { title: string }): Promise<{ folder?: LocalFolder }>
  share(o: { path: string; title: string }): Promise<void>
  albumFolder(): Promise<LocalFolder>
  testMode(): Promise<{ folder?: string }>
}

/** Taille des morceaux envoyés au module (multiple de 3, pour un base64 sans remplissage intermédiaire). */
export const CHUNK = 3 * 256 * 1024

/**
 * Encode des octets en base64.
 * @param bytes - octets à encoder
 * @returns le texte base64
 */
export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Comparateur « naturel » : IMG_2 avant IMG_10, sans tenir compte des majuscules ni des accents. */
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

/** Module natif de l'app, enregistré une fois. */
export const nativePlugin = registerPlugin<CollimoStorage>('CollimoStorage')

/**
 * Crée le pont d'une application mobile.
 * @param platform - `android` ou `ios`
 * @param plugin - module natif (remplaçable dans les tests)
 * @returns le pont, au format de l'application de bureau
 */
export function createNativeBridge(platform: 'android' | 'ios', plugin: CollimoStorage = nativePlugin): DesktopBridge {
  let uploads = 0

  /**
   * Envoie un contenu au module, par morceaux, dans un fichier temporaire.
   * @param data - contenu
   * @returns l'identifiant de l'envoi, à terminer par `commitTemp`
   */
  async function upload(data: Uint8Array): Promise<string> {
    const id = `${Date.now()}-${++uploads}`
    if (data.length === 0) await plugin.appendTemp({ id, data: '' })
    for (let i = 0; i < data.length; i += CHUNK) await plugin.appendTemp({ id, data: toBase64(data.subarray(i, i + CHUNK)) })
    return id
  }

  return {
    platform,
    userInfo: () => plugin.userInfo(),
    pickFolder: async ({ title }) => (await plugin.pickFolder({ title })).folder ?? null,
    pickFile: async ({ title, filter }) => (await plugin.pickFile({ title, filter })).file ?? null,
    folderInfo: (path) => plugin.folderInfo({ path }),
    fileInfo: (path) => plugin.fileInfo({ path }),
    listImages: async (path) => (await plugin.listImages({ path })).files.sort((a, b) => collator.compare(a.name, b.name)),
    listFiles: async (path, contains) =>
      (await plugin.listFiles({ path, contains })).files.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)),
    listFolders: async (path) => (await plugin.listFolders({ path })).folders.sort((a, b) => collator.compare(a.name, b.name)),
    renameFile: (path, name) => plugin.renameFile({ path, name }),
    moveFile: (path, dir) => plugin.moveFile({ path, dir }),
    async writeNewFile(dir, name, data) {
      return plugin.commitTemp({ id: await upload(data), dir, name })
    },
    async replaceFile(path, data) {
      return plugin.commitTemp({ id: await upload(data), replace: path })
    },
    async ensureDir() {
      throw new Error('ensureDir : utiliser ensureChildDir sur téléphone')
    },
    async loadSettings() {
      const { data } = await plugin.loadSettings()
      if (!data) return null
      try {
        return JSON.parse(data) as unknown
      } catch {
        return null
      }
    },
    saveSettings: (data) => plugin.saveSettings({ data: JSON.stringify(data) }),
    catalogueDir: () => plugin.catalogueDir(),
    chooseCatalogueDir: async (title) => (await plugin.chooseCatalogueDir({ title })).folder ?? null,
    ensureChildDir: async (dir, name) => (await plugin.ensureChildDir({ dir, name })).path,
    findChild: async (dir, name) => (await plugin.findChild({ dir, name })).path ?? null,
    fileUrl: (path) => Capacitor.convertFileSrc(path),
    thumbnail: async (path, size, version) => Capacitor.convertFileSrc((await plugin.thumbnail({ path, size, version })).path),
    share: (path, title) => plugin.share({ path, title }),
    ...(platform === 'ios' ? { albumFolder: () => plugin.albumFolder() } : {}),
  }
}
