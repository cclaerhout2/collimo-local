/**
 * Installation du pont Android, à importer en premier (avant la configuration) : dans l'application
 * Android, la page trouve ainsi le même pont que sur ordinateur, sous `globalThis.collimoDesktop`.
 * Le bouton Retour d'Android envoie l'événement `collimo:back` à la page ; si elle ne l'intercepte
 * pas (écran d'accueil), l'application passe en arrière-plan, comme les autres applications.
 * Sans effet dans un navigateur et sur ordinateur.
 */
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { BRIDGE_GLOBAL } from '../desktop/bridge'
import { createAndroidBridge } from './bridge'

/** Nom de l'événement envoyé à la page par le bouton Retour d'Android. */
export const BACK_EVENT = 'collimo:back'

if (Capacitor.getPlatform() === 'android') {
  ;(globalThis as unknown as Record<string, unknown>)[BRIDGE_GLOBAL] = createAndroidBridge()
  void App.addListener('backButton', () => {
    const e = new Event(BACK_EVENT, { cancelable: true })
    if (window.dispatchEvent(e)) void App.minimizeApp()
  })
}
