import type { AppConfig } from '../config'
import { createGoogleAuth } from './auth'
import { createDriveClient } from './drive'
import { createMockServices } from './mock'
import { createGooglePicker } from './picker'
import type { Services } from './types'

export function createServices(config: AppConfig): Services {
  if (config.mock) return createMockServices()
  const auth = createGoogleAuth(config)
  const getToken = () => auth.getToken()
  return { auth, drive: createDriveClient(getToken), picker: createGooglePicker(config, getToken) }
}
