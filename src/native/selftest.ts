/**
 * Auto-test de bout en bout des applications mobiles, lancé seulement par une version de test avec un
 * dossier imposé (voir `install.ts`) : sur le simulateur d'iPhone, où la page ne peut pas être pilotée
 * de l'extérieur, il fait le parcours d'un utilisateur avec les vrais services et le vrai module natif
 * (photos, miniatures, dimensions, collage exporté et enregistré, relecture du projet, réglages), et
 * écrit son résultat dans le journal (`COLLIMO-SELFTEST OK` ou `COLLIMO-SELFTEST ECHEC`) et dans le
 * fichier `selftest-result.json` du dossier de test, lu par le workflow.
 */
import { newCollage } from '../App'
import { layoutById } from '../collage/catalog'
import { loadImage } from '../collage/images'
import { parseProject } from '../collage/project'
import { saveCollage } from '../collage/save'
import { config } from '../config'
import { createServices } from '../google/services'

/**
 * Vérifie une condition de l'auto-test.
 * @param ok - condition
 * @param what - ce qui est vérifié, pour le message d'échec
 * @throws Error si la condition est fausse
 */
function check(ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error(what)
}

/**
 * Lance l'auto-test.
 * @param folder - dossier de photos de test (au moins trois images)
 * @returns une promesse résolue à la fin du test, réussi ou non (le résultat est dans le journal)
 */
export async function runSelfTest(folder: string): Promise<void> {
  const steps: string[] = []
  const log = (m: string) => {
    steps.push(m)
    console.log(`COLLIMO-SELFTEST ${m}`)
  }
  const { drive } = createServices(config)
  /**
   * Écrit le résultat dans le dossier de test (le journal de la WebView n'est pas toujours visible).
   * @param ok - test réussi
   */
  const report = async (ok: boolean) => {
    const name = 'selftest-result.json'
    const data = new TextEncoder().encode(JSON.stringify({ ok, steps }, null, 2))
    const bridge = (globalThis as unknown as Record<string, import('../desktop/bridge').DesktopBridge>).collimoDesktop
    await bridge.writeNewFile(folder, name, data).catch(() => {})
  }
  try {
    log('début')
    const photos = await drive.listPhotos({ id: folder }, null)
    check(photos.length >= 3, `au moins 3 photos (${photos.length})`)
    log(`${photos.length} photos : ${photos.map((p) => p.name).join(', ')}`)

    for (const p of photos.slice(0, 3)) {
      const url = p.thumbnailUrl ?? (await drive.loadThumbnail?.(p))
      check(url, `miniature de ${p.name}`)
      const res = await fetch(url)
      check(res.ok && (await res.blob()).size > 0, `miniature lisible de ${p.name}`)
    }
    log('miniatures OK')

    const chosen = await Promise.all(photos.slice(0, 3).map((p) => drive.getPhoto(p.id)))
    check(
      chosen.every((p) => p.width && p.height),
      'dimensions des photos',
    )
    const collimo = await drive.ensureCollimoFolder(folder)
    const doc = newCollage(chosen)
    const layout = layoutById(doc.layoutId)
    check(layout, 'disposition')
    const saved = await saveCollage({
      drive,
      collimoFolderId: collimo,
      doc,
      layout,
      width: 1200,
      height: 1200,
      format: 'jpeg',
      quality: 90,
      loadForCell: async (i, maxSide) => loadImage(await drive.fetchFileBlob(doc.photos[i].id), doc.photos[i].mimeType, maxSide),
    })
    check(saved.blob.size > 20_000, `image exportée (${saved.blob.size} octets)`)
    const files = await drive.listFolderFiles(collimo)
    check(files.length >= 2, `image et projet enregistrés (${files.map((f) => f.name).join(', ')})`)
    const project = parseProject(await drive.readJson(saved.project.id))
    check(project.photos.length === 3, 'projet relu')
    log(`collage enregistré : ${saved.baseName}`)

    await drive.saveSettings({ version: 1, lang: 'fr' })
    check((await drive.loadSettings())?.lang === 'fr', 'réglages')
    log('OK')
    await report(true)
  } catch (e) {
    log(`ECHEC ${e instanceof Error ? e.message : String(e)}`)
    await report(false)
  }
}
