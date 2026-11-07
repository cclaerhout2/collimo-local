/**
 * Construction du processus principal et du script de préchargement de l'application Windows :
 * `electron/main.ts` et `electron/preload.ts` sont regroupés (avec leurs dépendances) en deux fichiers
 * CommonJS dans `dist-electron/`, à côté de l'icône de la fenêtre.
 */
import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'warning',
}

await mkdir('dist-electron', { recursive: true })
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' })
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' })
await copyFile('build-resources/icon.png', 'dist-electron/icon.png')
console.log('dist-electron/ : main.cjs, preload.cjs, icon.png')
