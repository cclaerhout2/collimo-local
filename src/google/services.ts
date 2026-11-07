/** Point d'entrée des services : fichiers du PC (application Windows), Google réels, ou simulés quand la configuration le demande. */
import type { AppConfig } from '../config'
import { createDesktopServices, getDesktopBridge } from '../desktop/services'
import { createGoogleAuth } from './auth'
import { createDriveClient } from './drive'
import { createMockServices } from './mock'
import { createGooglePicker } from './picker'
import type { Services } from './types'

/**
 * Crée les services de l'app (connexion, fichiers, sélecteur).
 * @param config - configuration de l'app ; `desktop` = application Windows, `mock` = Drive simulé
 * @returns les services : fichiers locaux, Google réels ou simulés
 */
export function createServices(config: AppConfig): Services {
  const bridge = config.desktop ? getDesktopBridge() : null
  if (bridge) return createDesktopServices(bridge)
  if (config.mock) return createMockServices()
  const auth = createGoogleAuth(config)
  const getToken = () => auth.getToken()
  return { kind: 'google', auth, drive: createDriveClient(getToken), picker: createGooglePicker(config, getToken) }
}
