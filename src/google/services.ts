/** Point d'entrée des services Google : réels, ou simulés quand la configuration le demande. */
import type { AppConfig } from '../config'
import { createGoogleAuth } from './auth'
import { createDriveClient } from './drive'
import { createMockServices } from './mock'
import { createGooglePicker } from './picker'
import type { Services } from './types'

/**
 * Crée les services Google de l'app (connexion, Drive, sélecteur).
 * @param config - configuration de l'app ; `mock` active le Drive simulé
 * @returns les services, réels ou simulés
 */
export function createServices(config: AppConfig): Services {
  if (config.mock) return createMockServices()
  const auth = createGoogleAuth(config)
  const getToken = () => auth.getToken()
  return { auth, drive: createDriveClient(getToken), picker: createGooglePicker(config, getToken) }
}
