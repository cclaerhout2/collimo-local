// @vitest-environment node
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assertPlainName,
  canWrite,
  fileInfo,
  folderInfo,
  friendlyError,
  isImageName,
  listFiles,
  listImages,
  mimeFromName,
  naturalCompare,
  PathGuard,
  readJsonFile,
  replaceFile,
  writeJsonFile,
  writeNewFile,
} from './files'

/** PNG minimal de 3 × 2 pixels (en-tête suffisant pour lire les dimensions). */
const PNG_3x2 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000030000000208020000001216f14d0000001049444154789c63f8cfc0f01f0418000038f60bf5b5a0e5b80000000049454e44ae426082',
  'hex',
)

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'collimo-files-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('types de fichiers', () => {
  it('reconnaît les images, majuscules comprises', () => {
    expect(mimeFromName('IMG_0001.JPG')).toBe('image/jpeg')
    expect(mimeFromName('photo.heic')).toBe('image/heic')
    expect(mimeFromName('notes.txt')).toBe('application/octet-stream')
    expect(isImageName('a.PNG')).toBe(true)
    expect(isImageName('.cache.jpg')).toBe(false)
    expect(isImageName('logo.svg')).toBe(false)
    expect(isImageName('collage.collimo.json')).toBe(false)
  })

  it('trie dans l’ordre naturel, comme l’Explorateur', () => {
    expect(['IMG_10.jpg', 'img_2.jpg', 'IMG_1.jpg'].sort(naturalCompare)).toEqual(['IMG_1.jpg', 'img_2.jpg', 'IMG_10.jpg'])
  })
})

describe('lecture des dossiers', () => {
  it('liste les images seules, triées, avec leurs dimensions', async () => {
    await writeFile(path.join(dir, 'IMG_10.png'), PNG_3x2)
    await writeFile(path.join(dir, 'IMG_2.png'), PNG_3x2)
    await writeFile(path.join(dir, 'abime.jpg'), 'pas une image')
    await writeFile(path.join(dir, 'notes.txt'), 'texte')
    await mkdir(path.join(dir, 'Collimo.png'))
    const list = await listImages(dir)
    expect(list.map((f) => f.name)).toEqual(['abime.jpg', 'IMG_2.png', 'IMG_10.png'])
    expect(list[1]).toMatchObject({ path: path.join(dir, 'IMG_2.png'), mimeType: 'image/png', width: 3, height: 2 })
    expect(list[0].width).toBeUndefined()
  })

  it('liste les fichiers du plus récent au plus ancien, filtrés par nom', async () => {
    await writeFile(path.join(dir, 'Collimo_2026-01-01_10-00-00.jpg'), 'a')
    await new Promise((r) => setTimeout(r, 20))
    await writeFile(path.join(dir, 'Collimo_2026-01-01_10-00-00.collimo.json'), '{}')
    await writeFile(path.join(dir, 'autre.txt'), 'b')
    const all = await listFiles(dir)
    expect(all).toHaveLength(3)
    const some = await listFiles(dir, '2026-01-01_10-00-00')
    expect(some.map((f) => f.name)).toEqual(['Collimo_2026-01-01_10-00-00.collimo.json', 'Collimo_2026-01-01_10-00-00.jpg'])
    expect(await listFiles(path.join(dir, 'absent'))).toEqual([])
  })

  it('décrit un dossier et le droit d’y écrire', async () => {
    const info = await folderInfo(dir)
    expect(info).toEqual({ path: dir, name: path.basename(dir), writable: true })
    expect(await readdir(dir)).toEqual([]) // l'essai d'écriture ne laisse rien
    await expect(folderInfo(path.join(dir, 'absent'))).rejects.toThrow(/Introuvable/)
    await writeFile(path.join(dir, 'f.txt'), 'x')
    await expect(folderInfo(path.join(dir, 'f.txt'))).rejects.toThrow(/pas un dossier/)
    expect(await canWrite(path.join(dir, 'absent'))).toBe(false)
  })

  it('décrit un fichier', async () => {
    await writeFile(path.join(dir, 'a.png'), PNG_3x2)
    expect(await fileInfo(path.join(dir, 'a.png'))).toMatchObject({ name: 'a.png', width: 3, height: 2, size: PNG_3x2.length })
    await expect(fileInfo(dir)).rejects.toThrow(/pas un fichier/)
  })
})

describe('écriture', () => {
  it('crée un fichier sans jamais en écraser un', async () => {
    const f = await writeNewFile(dir, 'collage.jpg', new Uint8Array([1, 2, 3]))
    expect(f.size).toBe(3)
    await expect(writeNewFile(dir, 'collage.jpg', new Uint8Array([9]))).rejects.toThrow(/existe déjà/)
    expect([...(await readFile(path.join(dir, 'collage.jpg')))]).toEqual([1, 2, 3])
  })

  it('refuse les noms qui sortent du dossier ou que Windows interdit', () => {
    for (const bad of ['', '..', '../x.jpg', 'a/b.jpg', 'a\\b.jpg', 'c:x', 'a?.jpg', 'a\u0001']) {
      expect(() => assertPlainName(bad), bad).toThrow(/refusé/)
    }
    expect(() => assertPlainName('Collimo_2026-11-07_10-00-00.collimo.json')).not.toThrow()
  })

  it('remplace un fichier sans laisser de fichier temporaire', async () => {
    await writeFile(path.join(dir, 'catalogue.json'), '{"v":1}')
    await replaceFile(path.join(dir, 'catalogue.json'), new TextEncoder().encode('{"v":2}'))
    expect(await readFile(path.join(dir, 'catalogue.json'), 'utf8')).toBe('{"v":2}')
    expect(await readdir(dir)).toEqual(['catalogue.json'])
  })

  it('lit et écrit les réglages JSON, dossier créé au besoin', async () => {
    const file = path.join(dir, 'sous', 'settings.json')
    expect(await readJsonFile(file)).toBeNull()
    await writeJsonFile(file, { version: 1, lang: 'en' })
    expect(await readJsonFile(file)).toEqual({ version: 1, lang: 'en' })
    await writeFile(file, '{abîmé')
    expect(await readJsonFile(file)).toBeNull()
  })
})

describe('messages d’erreur', () => {
  it('traduit les codes courants', () => {
    const err = (code: string) => Object.assign(new Error(code), { code })
    expect(friendlyError(err('ENOENT'), 'X').message).toBe('Introuvable : X')
    expect(friendlyError(err('EPERM'), 'X').message).toBe('Accès refusé : X')
    expect(friendlyError(err('ENOSPC'), 'X').message).toBe('Disque plein : X')
    expect(friendlyError(new Error('autre'), 'X').message).toBe('autre')
  })
})

describe('PathGuard', () => {
  it('autorise un dossier et tout son contenu, rien d’autre', () => {
    const g = new PathGuard('linux', ['/home/a/Photos'])
    expect(g.allows('/home/a/Photos')).toBe(true)
    expect(g.allows('/home/a/Photos/Collimo/x.jpg')).toBe(true)
    expect(g.allows('/home/a/Photos/../secret.txt')).toBe(false)
    expect(g.allows('/home/a/Photos2/x.jpg')).toBe(false)
    expect(g.allows('/home/a')).toBe(false)
    expect(g.allows('')).toBe(false)
    expect(g.allows('/home/a/Photos/x\0.jpg')).toBe(false)
    expect(() => g.check('/etc/passwd')).toThrow(/n'a pas accès/)
  })

  it('compare les chemins Windows sans tenir compte des majuscules', () => {
    const g = new PathGuard('win32', ['C:\\Users\\Cedric\\Pictures'])
    expect(g.allows('c:\\users\\cedric\\pictures\\Vacances\\IMG_1.JPG')).toBe(true)
    expect(g.allows('C:\\Users\\Cedric\\Pictures\\..\\Documents\\a.txt')).toBe(false)
    expect(g.allows('D:\\Users\\Cedric\\Pictures\\a.jpg')).toBe(false)
    expect(g.allows('\\\\serveur\\partage\\a.jpg')).toBe(false)
    g.add('\\\\serveur\\partage')
    expect(g.allows('\\\\SERVEUR\\partage\\Collimo\\a.jpg')).toBe(true)
  })

  it('autorise un fichier seul, sans son dossier', () => {
    const g = new PathGuard('linux')
    expect(g.add('/home/a/logo.png')).toBe(true)
    expect(g.add('/home/a/logo.png')).toBe(false)
    expect(g.allows('/home/a/logo.png')).toBe(true)
    expect(g.allows('/home/a/autre.png')).toBe(false)
    expect(g.list()).toEqual(['/home/a/logo.png'])
  })
})
