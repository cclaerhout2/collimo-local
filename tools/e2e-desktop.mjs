/**
 * Test de bout en bout de l'application de bureau (Windows, macOS, Linux) : lance la vraie app Electron (ou l'exécutable
 * installé, avec `--exe chemin\Collimo.exe`) sur un dossier de photos généré, puis parcourt le
 * chemin complet d'un utilisateur : choix du dossier, galerie et miniatures, collage, enregistrement
 * sur le disque, « Mes collages », réouverture, usine, mémorisation au relancement, et cloisonnement
 * (accès refusé hors des dossiers choisis).
 *
 * Utilisation : `npm run desktop:build && npm run test:e2e` (sous Linux : `xvfb-run -a npm run test:e2e`).
 * Captures d'écran dans `test-results/`.
 */
import { _electron as electron } from 'playwright-core'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gradientPng } from './test-photos.mjs'

const args = process.argv.slice(2)
const exeIndex = args.indexOf('--exe')
const exe = exeIndex >= 0 ? path.resolve(args[exeIndex + 1]) : null
const OUT = path.resolve('test-results')
/**
 * Lance l'application.
 * @param {Record<string, string>} env - variables d'environnement de test
 * @returns l'application et sa fenêtre
 */
async function launch(env) {
  const noSandbox = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--lang=fr-FR']
  const app = await electron.launch({
    ...(exe ? { executablePath: exe, args: noSandbox } : { args: [...noSandbox, '.'] }),
    env: { ...process.env, ...env },
    timeout: 60_000,
  })
  const page = await app.firstWindow()
  // Les 404 attendus (miniature HEIC calculée par la page, photo d'un dossier déplacé) ne sont pas affichés.
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && console.log('  [console]', m.text()))
  page.on('pageerror', (e) => console.log('  [erreur page]', e.message))
  return { app, page }
}

/**
 * Affiche une étape du test.
 * @param {string} text - description
 */
const step = (text) => console.log(`• ${text}`)

const root = await mkdtemp(path.join(os.tmpdir(), 'collimo-e2e-'))
const photos = path.join(root, 'Mes photos')
const userData = path.join(root, 'userdata')
const outside = path.join(root, 'secret')
await mkdir(photos, { recursive: true })
await mkdir(outside, { recursive: true })
await writeFile(path.join(outside, 'secret.txt'), 'confidentiel')
for (let i = 1; i <= 6; i++) await writeFile(path.join(photos, `IMG_${i}.png`), gradientPng(i % 2 ? 640 : 480, i % 2 ? 480 : 640, i))
await writeFile(path.join(photos, 'IMG_10.png'), gradientPng(500, 500, 7))
// Photo d'iPhone (HEIC) : Chromium ne la décode pas, le décodeur de Collimo doit marcher malgré la politique de sécurité.
await copyFile(path.resolve('tools/fixtures/iphone.heic'), path.join(photos, 'IMG_7.HEIC'))
await writeFile(path.join(photos, 'notes.txt'), 'pas une image')
await mkdir(OUT, { recursive: true })

const env = {
  COLLIMO_USER_DATA: userData,
  COLLIMO_TEST_PICK_FOLDER: photos,
  COLLIMO_TEST_PICK_FILE: path.join(photos, 'IMG_10.png'),
}
let { app, page } = await launch(env)
try {
  step('premier lancement : écran de choix du dossier, sans connexion Google')
  // La langue suit celle du système (sur macOS, `--lang` est ignoré) : le test se fait en français.
  await page.getByRole('button', { name: 'FR', exact: true }).click({ timeout: 30_000 })
  await page.getByRole('heading', { name: 'Où sont vos photos ?' }).waitFor({ timeout: 30_000 })
  assert.equal(await page.getByText('Choisissez un Drive').count(), 0, 'pas de choix de Drive dans l’app de bureau')
  assert.equal(await page.evaluate(() => typeof window.collimoDesktop?.listImages), 'function')
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined', 'pas de Node dans la page')
  await page.screenshot({ path: path.join(OUT, '1-dossier.png') })

  step('choix du dossier de photos')
  await page.getByRole('button', { name: 'Choisir un dossier' }).click()
  await page.getByText('Dossier choisi : Mes photos').waitFor()
  await page.getByRole('button', { name: 'Continuer' }).click()

  step('galerie : 8 images dans l’ordre naturel (HEIC compris), miniatures affichées')
  const tiles = page.locator('ul.grid button.tile')
  await tiles.first().waitFor()
  assert.equal(await tiles.count(), 8)
  const names = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  assert.deepEqual(names, ['IMG_1.png', 'IMG_2.png', 'IMG_3.png', 'IMG_4.png', 'IMG_5.png', 'IMG_6.png', 'IMG_7.HEIC', 'IMG_10.png'])
  await page.waitForFunction(
    () => {
      const imgs = [...document.querySelectorAll('ul.grid img.thumb')]
      return imgs.length === 8 && imgs.every((i) => i.complete && i.naturalWidth > 0)
    },
    null,
    {
      timeout: 20_000,
    },
  )
  await stat(path.join(photos, 'Collimo'))
  await page.getByText(photos).waitFor()
  await page.screenshot({ path: path.join(OUT, '2-galerie.png') })

  step('cloisonnement : rien hors des dossiers choisis')
  const denied = await page.evaluate(
    async (p) => {
      const r = await fetch(`collimo://file/?path=${encodeURIComponent(p)}`)
      let ipc = 'accepté'
      try {
        await window.collimoDesktop.listFiles(p.replace(/[\\/][^\\/]+$/, ''))
      } catch (e) {
        ipc = String(e.message)
      }
      let write = 'accepté'
      try {
        await window.collimoDesktop.writeNewFile(p.replace(/[\\/][^\\/]+$/, ''), 'pirate.txt', new Uint8Array([1]))
      } catch (e) {
        write = String(e.message)
      }
      return { status: r.status, ipc, write }
    },
    path.join(outside, 'secret.txt'),
  )
  assert.equal(denied.status, 403)
  assert.match(denied.ipc, /n'a pas accès/)
  assert.match(denied.write, /n'a pas accès/)
  assert.deepEqual(await readdir(outside), ['secret.txt'])
  const guarded = await page.evaluate(
    async ({ photos, userData }) => {
      const tryIt = async (run) => {
        try {
          await run()
          return 'accepté'
        } catch (e) {
          return String(e.message)
        }
      }
      return {
        program: await tryIt(() => window.collimoDesktop.writeNewFile(photos, 'piege.bat', new Uint8Array([1]))),
        settings: (await fetch(`collimo://file/?path=${encodeURIComponent(userData + '/settings.json')}`)).status,
        state: await tryIt(() => window.collimoDesktop.replaceFile(userData + '/desktop.json', new Uint8Array([1]))),
        openPath: typeof window.collimoDesktop.openPath,
      }
    },
    { photos, userData },
  )
  assert.match(guarded.program, /Type de fichier refusé/)
  assert.equal(guarded.settings, 403, 'réglages illisibles par la page')
  assert.match(guarded.state, /n'a pas accès/)
  assert.equal(guarded.openPath, 'undefined')

  step('sélection de 3 photos (dont la HEIC) et création du collage')
  await tiles.nth(0).click()
  await tiles.nth(1).click()
  await tiles.nth(6).click()
  await page.getByText('3 / 20 sélectionnée(s)').waitFor()
  await page.getByRole('button', { name: 'Créer un collage' }).click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, '3-editeur.png') })

  step('enregistrement : image et projet écrits dans le dossier Collimo')
  await page.getByRole('button', { name: 'Exporter' }).click()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Collage enregistré : Collimo_/).waitFor({ timeout: 60_000 })
  await page.screenshot({ path: path.join(OUT, '4-enregistre.png') })
  const saved = (await readdir(path.join(photos, 'Collimo'))).sort()
  assert.equal(saved.length, 2, `fichiers : ${saved.join(', ')}`)
  const jpg = saved.find((f) => f.endsWith('.jpg'))
  const json = saved.find((f) => f.endsWith('.collimo.json'))
  assert.ok(jpg && json, 'une image JPG et un fichier projet')
  const jpgBytes = await readFile(path.join(photos, 'Collimo', jpg))
  assert.equal(jpgBytes.readUInt16BE(0), 0xffd8, 'vrai fichier JPEG')
  assert.ok(jpgBytes.length > 20_000, `image de ${jpgBytes.length} octets`)
  const project = JSON.parse(await readFile(path.join(photos, 'Collimo', json), 'utf8'))
  assert.equal(project.app, 'collimo')
  assert.equal(project.doc.photos.length, 3)
  assert.equal(project.doc.photos[0].id, path.join(photos, 'IMG_1.png'))
  assert.equal(project.doc.photos[2].mimeType, 'image/heic')
  assert.deepEqual([project.doc.photos[2].width, project.doc.photos[2].height], [400, 300], 'dimensions lues à la création')

  step('un second enregistrement crée un nouveau collage, sans rien écraser')
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: 'Exporter' }).click()
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByText(/Collage enregistré : Collimo_/).waitFor({ timeout: 60_000 })
  assert.equal((await readdir(path.join(photos, 'Collimo'))).length, 4)
  await page.getByRole('button', { name: 'Fermer' }).click()

  step('« Mes collages » puis réouverture d’un collage')
  await page.getByRole('button', { name: 'Photos' }).first().click()
  const cards = page.locator('.project-card')
  await cards.first().waitFor()
  assert.equal(await cards.count(), 2)
  await page.waitForFunction(() => [...document.querySelectorAll('.project-card img')].every((i) => i.complete && i.naturalWidth > 0))
  await page.screenshot({ path: path.join(OUT, '5-mes-collages.png') })
  await cards.first().click()
  await page.getByRole('button', { name: 'Exporter' }).waitFor()
  await page.getByRole('button', { name: 'Photos' }).first().click()

  step('usine à dispositions disponible, catalogue local')
  await page.locator('.avatar-button').click()
  await page.getByRole('menuitem', { name: 'Usine à dispositions' }).click()
  await page.getByRole('heading', { name: 'Usine à dispositions' }).waitFor()
  await page.screenshot({ path: path.join(OUT, '6-usine.png') })
  await page.getByRole('button', { name: 'Masquer', exact: true }).first().click()
  await page.getByRole('button', { name: 'Réafficher', exact: true }).first().waitFor()
  const catalogue = JSON.parse(await readFile(path.join(userData, 'catalogue', 'collimo-catalogue.json'), 'utf8'))
  assert.equal(catalogue.format, 'collimo-catalogue')
  assert.deepEqual(catalogue.hiddenBuiltins, ['p04-01'])
  await page
    .getByRole('button', { name: /Photos/ })
    .first()
    .click()

  step('langue anglaise mémorisée')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByText('My collages').waitFor()
  // Le choix est enregistré sur le disque en arrière-plan : attendre qu'il y soit avant de fermer l'app.
  for (let i = 0; !(await readFile(path.join(userData, 'settings.json'), 'utf8').catch(() => '')).includes('"lang": "en"'); i++) {
    if (i > 50) throw new Error('langue non enregistrée dans settings.json')
    await page.waitForTimeout(100)
  }
} catch (e) {
  await page.screenshot({ path: path.join(OUT, 'echec.png') }).catch(() => {})
  await app.close().catch(() => {})
  throw e
}
await app.close()

step('relancement : dossier et langue retrouvés, galerie ouverte directement')
;({ app, page } = await launch({ COLLIMO_USER_DATA: userData }))
try {
  await page.locator('ul.grid button.tile').first().waitFor({ timeout: 30_000 })
  await page.getByText('My collages').waitFor()
  assert.equal(await page.locator('ul.grid button.tile').count(), 8)
  await page.screenshot({ path: path.join(OUT, '7-relance.png') })
} finally {
  await app.close()
}

step('dossier déplacé : nouveau choix, puis collage rouvert avec ses photos retrouvées par leur nom')
const movedDir = path.join(root, 'Photos déplacées')
await rename(photos, movedDir)
;({ app, page } = await launch({ COLLIMO_USER_DATA: userData, COLLIMO_TEST_PICK_FOLDER: movedDir }))
try {
  await page.getByRole('button', { name: 'Choose a folder' }).click({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('.project-card').first().click()
  await page.getByRole('button', { name: 'Export' }).waitFor()
  await page.waitForTimeout(1500)
  assert.equal(await page.locator('.banner-error, [role="alert"]').count(), 0, 'aucune erreur')
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByText(/Collage saved: Collimo_/).waitFor({ timeout: 60_000 })
  assert.equal((await readdir(path.join(movedDir, 'Collimo'))).length, 6)
  await page.screenshot({ path: path.join(OUT, '8-dossier-deplace.png') })
} finally {
  await app.close()
}

await rm(root, { recursive: true, force: true })
console.log('\nOK - test de bout en bout de l’application réussi')
