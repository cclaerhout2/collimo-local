import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * Version web locale (`VITE_LOCAL_WEB=1`) : application installable sur l'écran d'accueil (iPhone,
 * Android), avec son manifeste, son icône et son service worker (ouverture sans réseau).
 * @returns l'extension Vite qui complète `index.html`
 */
function localWebApp(): Plugin {
  return {
    name: 'collimo-local-web',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './icons/icon-180.png' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }, injectTo: 'head' },
      { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Collimo' }, injectTo: 'head' },
    ],
  }
}

// planche.html (recette des dispositions) n'est servie qu'en développement, jamais publiée.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const localWeb = (process.env.VITE_LOCAL_WEB ?? env.VITE_LOCAL_WEB) === '1'
  return {
    // Version web locale : adresses relatives, pour être servie depuis n'importe quel dossier (GitHub Pages…).
    base: localWeb ? './' : '/',
    plugins: [react(), ...(localWeb ? [localWebApp()] : [])],
  }
})
