/**
 * Script de préchargement de la fenêtre de Collimo : expose à la page, sous `window.collimoDesktop`,
 * les seules fonctions du pont (voir `src/desktop/bridge.ts`). La page n'a aucun accès direct à Node.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { BRIDGE_GLOBAL, CHANNELS, type DesktopBridge } from '../src/desktop/bridge'

/**
 * Fonction du pont qui transmet ses arguments au processus principal par un canal.
 * @param channel - canal de l'appel
 * @returns la fonction à exposer
 */
const invoke =
  <A extends unknown[], R>(channel: string) =>
  (...args: A): Promise<R> =>
    ipcRenderer.invoke(channel, ...args) as Promise<R>

/** Pont exposé à la page. */
const bridge: DesktopBridge = {
  platform: process.platform,
  userInfo: invoke(CHANNELS.userInfo),
  pickFolder: invoke(CHANNELS.pickFolder),
  pickFile: invoke(CHANNELS.pickFile),
  folderInfo: invoke(CHANNELS.folderInfo),
  listImages: invoke(CHANNELS.listImages),
  listFiles: invoke(CHANNELS.listFiles),
  fileInfo: invoke(CHANNELS.fileInfo),
  writeNewFile: invoke(CHANNELS.writeNewFile),
  replaceFile: invoke(CHANNELS.replaceFile),
  ensureDir: invoke(CHANNELS.ensureDir),
  loadSettings: invoke(CHANNELS.loadSettings),
  saveSettings: invoke(CHANNELS.saveSettings),
  catalogueDir: invoke(CHANNELS.catalogueDir),
  chooseCatalogueDir: invoke(CHANNELS.chooseCatalogueDir),
}

contextBridge.exposeInMainWorld(BRIDGE_GLOBAL, bridge)
