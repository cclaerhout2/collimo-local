/**
 * Point d'entrée de l'app : monte `App` dans la page, entourée de la traduction, en mode strict de React.
 * Dans les applications (ordinateur, Android), les libellés qui parlent de Google Drive sont remplacés.
 */
// En premier : le pont Android doit exister avant la lecture de la configuration.
import './android/install'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { config } from './config'
import { getDesktopBridge } from './desktop/services'
import { enableDesktopTexts, I18nProvider } from './i18n'
import './styles.css'

enableDesktopTexts(config.desktop, getDesktopBridge()?.platform)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
