/**
 * Installation du pont, à importer en premier (avant la configuration) : dans les applications Android
 * et iPhone, et dans la version web locale (construction `VITE_LOCAL_WEB=1`), la page trouve ainsi le
 * même pont que sur ordinateur, sous `globalThis.collimoDesktop`. Sans effet sur ordinateur (le pont y est
 * posé par Electron) et dans la version web Google Drive.
 *
 * Android : le bouton Retour envoie l'événement `collimo:back` à la page ; si elle ne l'intercepte pas
 * (écran d'accueil), l'application passe en arrière-plan, comme les autres applications.
 * Versions de test des applications mobiles : un auto-test de bout en bout peut être lancé (voir `selftest.ts`).
 */
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { BRIDGE_GLOBAL } from '../desktop/bridge'
import { createWebBridge } from '../web/bridge'
import { createNativeBridge, nativePlugin } from './bridge'

/** Nom de l'événement envoyé à la page par le bouton Retour d'Android. */
export const BACK_EVENT = 'collimo:back'

const g = globalThis as unknown as Record<string, unknown>
const platform = Capacitor.getPlatform()

if (platform === 'android' || platform === 'ios') {
  g[BRIDGE_GLOBAL] = createNativeBridge(platform)
  if (platform === 'android') {
    void App.addListener('backButton', () => {
      const e = new Event(BACK_EVENT, { cancelable: true })
      if (window.dispatchEvent(e)) void App.minimizeApp()
    })
  }
  void nativePlugin
    .testMode()
    .then(async ({ folder }) => {
      if (folder) await (await import('./selftest')).runSelfTest(folder)
    })
    .catch(() => {})
} else if (import.meta.env.VITE_LOCAL_WEB === '1' && !(BRIDGE_GLOBAL in g)) {
  g[BRIDGE_GLOBAL] = createWebBridge()
  // Ouverture sans réseau, après la première visite.
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('./sw.js').catch(() => {})
}
