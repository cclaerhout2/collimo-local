/**
 * Photos de test des tests de bout en bout : dégradés colorés au format PNG, générés sans dépendance.
 */
import { deflateSync } from 'node:zlib'

/** Table CRC32 du format PNG. */
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/**
 * Bloc d'un fichier PNG.
 * @param {string} type - type du bloc (IHDR, IDAT, IEND)
 * @param {Buffer} data - contenu
 * @returns {Buffer} le bloc, avec longueur et CRC
 */
function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  let c = 0xffffffff
  for (const b of Buffer.concat([head.subarray(4), data])) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0)
  return Buffer.concat([head, data, crc])
}

/**
 * Photo de test : un dégradé coloré au format PNG, sans dépendance.
 * @param {number} w - largeur
 * @param {number} h - hauteur
 * @param {number} seed - variante de couleur
 * @returns {Buffer} le fichier PNG
 */
export function gradientPng(w, h, seed) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3
      raw[o] = (x * 255) / w + seed * 40
      raw[o + 1] = (y * 255) / h
      raw[o + 2] = 160 + seed * 15
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// En ligne de commande : `node tools/test-photos.mjs dossier` y écrit les photos de test (dont une HEIC).
if (process.argv[1]?.endsWith('test-photos.mjs') && process.argv[2]) {
  const { copyFile, mkdir, writeFile } = await import('node:fs/promises')
  const path = await import('node:path')
  const dir = path.resolve(process.argv[2])
  await mkdir(dir, { recursive: true })
  for (let i = 1; i <= 6; i++) await writeFile(path.join(dir, `IMG_${i}.png`), gradientPng(i % 2 ? 640 : 480, i % 2 ? 480 : 640, i))
  await copyFile(new URL('./fixtures/iphone.heic', import.meta.url), path.join(dir, 'IMG_7.HEIC'))
  console.log(`photos de test dans ${dir}`)
}
