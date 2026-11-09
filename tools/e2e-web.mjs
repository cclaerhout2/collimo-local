/**
 * Test de bout en bout de la version web locale (celle des iPhone) : sert `dist-web/`, l'ouvre dans un
 * navigateur au format téléphone et parcourt le chemin d'un utilisateur : ajout de photos depuis la
 * photothèque (HEIC compris), galerie et miniatures, collage, enregistrement dans l'album, « Mes
 * collages », réouverture, données retrouvées après rechargement, nouvel ajout de photos, et ouverture
 * sans réseau (service worker).
 *
 * Utilisation (après `npm run web:build`) :
 * - `node tools/e2e-web.mjs --browser webkit` (ou `chromium`), navigateurs de Playwright installés
 *   (`npx playwright-core install webkit chromium`) : iPhone 13 simulé ;
 * - `node tools/e2e-web.mjs --browser electron` : Chromium d'Electron, sans téléchargement (sous Linux : `xvfb-run -a`).
 * Captures dans `test-results/`.
 */
import { _electron, chromium, devices, webkit } from 'playwright-core'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { gradientPng } from './test-photos.mjs'

const args = process.argv.slice(2)
const BROWSER = args.includes('--browser') ? args[args.indexOf('--browser') + 1] : 'electron'
const OUT = path.resolve('test-results')
const ROOT = path.resolve('dist-web')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
}

/**
 * Affiche une étape du test.
 * @param {string} text - description
 */
const step = (text) => console.log(`• ${text}`)

// Serveur statique de dist-web, sous un sous-dossier comme sur GitHub Pages.
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/collimo/')) return res.writeHead(404).end()
  const rel = decodeURIComponent(url.pathname.slice('/collimo/'.length)) || 'index.html'
  const file = path.join(ROOT, rel)
  if (!file.startsWith(ROOT)) return res.writeHead(403).end()
  try {
    const data = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(data)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/collimo/`

const local = await mkdtemp(path.join(os.tmpdir(), 'collimo-web-'))
const photos = []
for (let i = 1; i <= 6; i++) {
  const f = path.join(local, `IMG_${i}.png`)
  await writeFile(f, gradientPng(i % 2 ? 640 : 480, i % 2 ? 480 : 640, i))
  photos.push(f)
}
await writeFile(path.join(local, 'IMG_10.png'), gradientPng(500, 500, 7))
photos.push(path.join(local, 'IMG_10.png'))
await copyFile(path.resolve('tools/fixtures/iphone.heic'), path.join(local, 'IMG_7.HEIC'))
photos.push(path.join(local, 'IMG_7.HEIC'))
await mkdir(OUT, { recursive: true })

/**
 * Ouvre le navigateur choisi au format téléphone.
 * @returns le contexte (pour passer hors ligne), la page et la fermeture
 */
async function open() {
  if (BROWSER === 'electron') {
    const main = path.join(local, 'main.cjs')
    await writeFile(
      main,
      `const { app, BrowserWindow } = require('electron')
       app.whenReady().then(() => new BrowserWindow({ width: 390, height: 844, useContentSize: true }).loadURL(${JSON.stringify(BASE)}))`,
    )
    const app = await _electron.launch({
      args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--lang=fr-FR', main],
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
    })
    const page = await app.firstWindow()
    return { context: page.context(), page, close: () => app.close() }
  }
  const engine = BROWSER === 'webkit' ? webkit : chromium
  const browser = await engine.launch()
  const device = BROWSER === 'webkit' ? devices['iPhone 13'] : devices['Pixel 7']
  const context = await browser.newContext({ ...device, locale: 'fr-FR' })
  const page = await context.newPage()
  await page.goto(BASE)
  return { context, page, close: () => browser.close() }
}

const { context, page, close } = await open()
page.on('pageerror', (e) => console.log('  [erreur page]', e.message))
try {
  step(`ouverture (${BROWSER}) : album vide, sans compte`)
  await page.getByText('Aucune photo dans l’album.').waitFor({ timeout: 30_000 })
  assert.equal(await page.evaluate(() => window.collimoDesktop?.platform), 'web')
  assert.equal(await page.locator('nav.locations').count(), 0, 'pas de panneau d’emplacements pour l’album')
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-1-accueil.png`) })

  step('ajout de 8 photos depuis la photothèque (HEIC compris)')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '+ Ajouter des photos' }).click()
  await (await chooser).setFiles(photos)

  step('galerie : 8 images, miniatures affichées')
  const tiles = page.locator('ul.grid button.tile')
  await tiles.first().waitFor()
  assert.equal(await tiles.count(), 8)
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('ul.grid img.thumb')]
      return imgs.length === 8 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    },
    null,
    { timeout: 60_000 },
  )
  await page.getByText('Mes photos', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-2-galerie.png`) })

  step('collage de 3 photos (dont la HEIC), enregistré dans l’album')
  const names = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  await tiles.nth(0).click()
  await tiles.nth(1).click()
  await tiles.nth(names.indexOf('IMG_7.HEIC')).click()
  await page.getByRole('button', { name: 'Créer un collage' }).click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-3-editeur.png`) })
  await page.getByRole('button', { name: 'Exporter' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Collage enregistré : Collimo_/).waitFor({ timeout: 120_000 })
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-4-enregistre.png`) })
  await page.getByRole('button', { name: 'Fermer' }).click()

  step('« Mes collages » puis réouverture')
  await page.getByRole('button', { name: 'Photos' }).first().click()
  const cards = page.locator('.project-card')
  await cards.first().waitFor()
  assert.equal(await cards.count(), 1)
  await page.waitForFunction(() => [...document.querySelectorAll('.project-card img')].every((i) => i.complete && i.naturalWidth > 0))
  await cards.first().click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  await page.getByRole('button', { name: 'Photos' }).first().click()

  step('rechargement : album et collages retrouvés (stockage du navigateur)')
  await page.reload()
  await tiles.first().waitFor({ timeout: 30_000 })
  assert.equal(await tiles.count(), 8)
  assert.equal(await page.locator('.project-card').count(), 1)

  step('nouvel ajout de photos : une photo du même nom ne remplace rien')
  const chooser2 = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '+ Ajouter des photos' }).click()
  await (await chooser2).setFiles([photos[0]])
  await page.waitForFunction(() => document.querySelectorAll('ul.grid button.tile').length === 9)
  assert.ok((await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('title')))).includes('IMG_1 (2).png'))

  step('sans réseau : l’app s’ouvre quand même, avec ses photos')
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== undefined, null, { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1000)
  await context.setOffline(true)
  await page.reload()
  await tiles.first().waitFor({ timeout: 30_000 })
  assert.equal(await tiles.count(), 9)
  await context.setOffline(false)
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-5-hors-ligne.png`) })
} catch (e) {
  await page.screenshot({ path: path.join(OUT, `web-${BROWSER}-echec.png`) }).catch(() => {})
  throw e
} finally {
  await close()
  server.close()
  await rm(local, { recursive: true, force: true })
}
console.log(`\nOK - test de bout en bout de la version web (${BROWSER}) réussi`)
