/**
 * Point d'entrée de l'app : monte `App` dans la page, entourée de la traduction, en mode strict de React.
 * Dans l'application Windows, les libellés qui parlent de Google Drive sont remplacés.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { config } from './config'
import { enableDesktopTexts, I18nProvider } from './i18n'
import './styles.css'

enableDesktopTexts(config.desktop)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
