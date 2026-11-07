/**
 * Test de bout en bout de l'application Android, sur un émulateur ou un téléphone branché (adb) :
 * version de test (`fr.collimo.app.test`, la seule qui accepte un dossier imposé et le débogage de
 * sa WebView) déjà installée. Parcourt le chemin d'un utilisateur : choix du dossier, galerie et
 * miniatures (HEIC compris), collage, enregistrement dans le dossier, « Mes collages », bouton Retour
 * d'Android, réouverture, et relancement de l'app (dossier et langue retrouvés).
 *
 * Utilisation : `node tools/e2e-android.mjs [--package fr.collimo.app.test]`. Captures dans `test-results/`.
 */
import { _android as android } from 'playwright-core'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gradientPng } from './test-photos.mjs'

const args = process.argv.slice(2)
const PKG = args.includes('--package') ? args[args.indexOf('--package') + 1] : 'fr.collimo.app.test'
const OUT = path.resolve('test-results')
const PHOTOS = `/data/user/0/${PKG}/files/Photos`

/**
 * Commande adb.
 * @param {...string} a - arguments
 * @returns {string} la sortie
 */
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/**
 * Commande dans le dossier de l'app (run-as : version de test seulement).
 * @param {string} cmd - commande shell
 * @returns {string} la sortie
 */
const asApp = (cmd) => adb('shell', `run-as ${PKG} sh -c '${cmd}'`)

/**
 * Affiche une étape du test.
 * @param {string} text - description
 */
const step = (text) => console.log(`• ${text}`)

/**
 * Lance l'app et se connecte à sa WebView (Playwright pour Android, sans son application pilote).
 * @returns l'appareil (à fermer avec `close`) et la page de Collimo
 */
async function launch() {
  adb('shell', 'am', 'force-stop', PKG)
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/fr.collimo.app.MainActivity`)
  const [device] = await android.devices({ omitDriverInstall: true })
  if (!device) throw new Error('aucun appareil Android (adb devices)')
  const webview = await device.webView({ pkg: PKG }, { timeout: 90_000 })
  const page = await webview.page()
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && console.log('  [console]', m.text()))
  page.on('pageerror', (e) => console.log('  [erreur page]', e.message))
  return { browser: device, page }
}

/**
 * Appuie sur le bouton Retour d'Android.
 */
const back = () => adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')

await mkdir(OUT, { recursive: true })
step('préparation : app remise à zéro, 8 photos (dont une HEIC) dans un dossier de l’app')
adb('shell', 'pm', 'clear', PKG)
const local = await mkdtemp(path.join(os.tmpdir(), 'collimo-android-'))
for (let i = 1; i <= 6; i++) await writeFile(path.join(local, `IMG_${i}.png`), gradientPng(i % 2 ? 640 : 480, i % 2 ? 480 : 640, i))
await writeFile(path.join(local, 'IMG_10.png'), gradientPng(500, 500, 7))
await copyFile(path.resolve('tools/fixtures/iphone.heic'), path.join(local, 'IMG_7.HEIC'))
await writeFile(path.join(local, 'notes.txt'), 'pas une image')
adb('shell', 'rm', '-rf', '/data/local/tmp/collimo-photos')
adb('shell', 'mkdir', '-p', '/data/local/tmp/collimo-photos')
asApp(`mkdir -p ${PHOTOS}`)
for (const f of await readdir(local)) {
  adb('push', path.join(local, f), `/data/local/tmp/collimo-photos/${f}`)
  // L'app ne peut pas lire /data/local/tmp : le fichier lui est passé par un tube.
  adb('shell', `cat /data/local/tmp/collimo-photos/${f} | run-as ${PKG} sh -c 'cat > ${PHOTOS}/${f}'`)
}
adb('shell', 'setprop', 'debug.collimo.folder', PHOTOS)

let { browser, page } = await launch()
try {
  step('premier lancement : écran de choix du dossier, sans compte')
  await page.getByRole('button', { name: 'FR', exact: true }).click({ timeout: 60_000 })
  await page.getByRole('heading', { name: 'Où sont vos photos ?' }).waitFor()
  assert.equal(await page.evaluate(() => window.collimoDesktop?.platform), 'android')
  await page.screenshot({ path: path.join(OUT, 'android-1-dossier.png') })

  step('choix du dossier, galerie : 8 images dans l’ordre naturel, miniatures affichées')
  await page.getByRole('button', { name: 'Choisir un dossier' }).click()
  await page.getByText('Dossier choisi : Photos').waitFor()
  await page.getByRole('button', { name: 'Continuer' }).click()
  const tiles = page.locator('ul.grid button.tile')
  await tiles.first().waitFor({ timeout: 30_000 })
  assert.equal(await tiles.count(), 8)
  const names = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  assert.deepEqual(names, ['IMG_1.png', 'IMG_2.png', 'IMG_3.png', 'IMG_4.png', 'IMG_5.png', 'IMG_6.png', 'IMG_7.HEIC', 'IMG_10.png'])
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('ul.grid img.thumb')]
      return imgs.length === 8 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    },
    null,
    { timeout: 60_000 },
  )
  assert.match(asApp(`ls ${PHOTOS}`), /Collimo/)
  await page.screenshot({ path: path.join(OUT, 'android-2-galerie.png') })

  step('collage de 3 photos (dont la HEIC), enregistré dans le dossier')
  await tiles.nth(0).click()
  await tiles.nth(1).click()
  await tiles.nth(6).click()
  await page.getByRole('button', { name: 'Créer un collage' }).click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: path.join(OUT, 'android-3-editeur.png') })
  await page.getByRole('button', { name: 'Exporter' }).click()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Collage enregistré : Collimo_/).waitFor({ timeout: 120_000 })
  await page.screenshot({ path: path.join(OUT, 'android-4-enregistre.png') })
  const saved = asApp(`ls ${PHOTOS}/Collimo`).trim().split(/\s+/).sort()
  assert.equal(saved.length, 2, `fichiers : ${saved.join(', ')}`)
  assert.ok(saved.some((f) => f.endsWith('.jpg')) && saved.some((f) => f.endsWith('.collimo.json')))
  const project = JSON.parse(asApp(`cat ${PHOTOS}/Collimo/${saved.find((f) => f.endsWith('.json'))}`))
  assert.equal(project.doc.photos.length, 3)
  assert.equal(project.doc.photos[2].mimeType, 'image/heic')
  const size = Number(asApp(`wc -c < ${PHOTOS}/Collimo/${saved.find((f) => f.endsWith('.jpg'))}`).trim())
  assert.ok(size > 20_000, `image de ${size} octets`)
  assert.equal(await page.getByRole('link', { name: 'Enregistrer une copie sous…' }).count(), 0, 'pas de téléchargement sur Android')
  await page.getByRole('button', { name: 'Fermer' }).click()

  step('bouton Retour d’Android : de l’éditeur à la galerie, « Mes collages » à jour')
  back()
  const cards = page.locator('.project-card')
  await cards.first().waitFor({ timeout: 20_000 })
  assert.equal(await cards.count(), 1)
  await page.waitForFunction(() => [...document.querySelectorAll('.project-card img')].every((i) => i.complete && i.naturalWidth > 0))
  await page.screenshot({ path: path.join(OUT, 'android-5-mes-collages.png') })

  step('réouverture du collage, puis Retour')
  await cards.first().click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  back()
  await cards.first().waitFor()

  step('usine à dispositions')
  await page.locator('.avatar-button').click()
  await page.getByRole('menuitem', { name: 'Usine à dispositions' }).click()
  await page.getByRole('heading', { name: 'Usine à dispositions' }).waitFor()
  await page.getByRole('button', { name: 'Masquer', exact: true }).first().click()
  await page.getByRole('button', { name: 'Réafficher', exact: true }).first().waitFor()
  assert.match(asApp('cat files/catalogue/collimo-catalogue.json'), /"hiddenBuiltins": \[\s*"p04-01"/)
  back()
  await cards.first().waitFor()

  step('langue anglaise mémorisée')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByText('My collages').waitFor()
  // Le choix est enregistré en arrière-plan : attendre qu'il soit sur le téléphone avant d'arrêter l'app.
  for (let i = 0; !asApp('cat files/settings.json 2>/dev/null || true').includes('"lang":"en"'); i++) {
    if (i > 50) throw new Error('langue non enregistrée')
    await page.waitForTimeout(200)
  }
} catch (e) {
  await page.screenshot({ path: path.join(OUT, 'android-echec.png') }).catch(() => {})
  throw e
} finally {
  await browser.close().catch(() => {})
}

step('relancement : dossier et langue retrouvés, galerie ouverte directement')
;({ browser, page } = await launch())
try {
  await page.locator('ul.grid button.tile').first().waitFor({ timeout: 60_000 })
  await page.getByText('My collages').waitFor()
  assert.equal(await page.locator('ul.grid button.tile').count(), 8)
  await page.screenshot({ path: path.join(OUT, 'android-6-relance.png') })
} finally {
  await browser.close().catch(() => {})
}

adb('shell', 'setprop', 'debug.collimo.folder', "''")
await rm(local, { recursive: true, force: true })
console.log('\nOK - test de bout en bout de l’application Android réussi')
