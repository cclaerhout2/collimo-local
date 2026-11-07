/**
 * Génère les catalogues servis par l'app, chargés à la demande depuis public/data :
 *   fonts.json                 polices Google (nom, catégorie, graisses, italique)
 *   ph/index.json              icônes Phosphor (nom, catégories, mots-clés)
 *   ph/regular.json, fill.json corps SVG par graisse (couleur = currentColor, viewBox 256)
 *   fluent/index.json          émojis Fluent (nom, catégorie), sans les variantes de teint
 *   fluent/<categorie>.json    corps SVG par catégorie (viewBox 32)
 * Usage : npm run gen:assets (à relancer seulement pour mettre à jour les bibliothèques).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'data')
const write = (rel, data) => {
  const p = join(out, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(data))
  return p
}

// Polices Google
const gf = require('google-fonts-complete/google-fonts.json')
const fonts = Object.entries(gf)
  .map(([family, f]) => {
    const normal = Object.keys(f.variants?.normal ?? {}).map(Number)
    const italic = Object.keys(f.variants?.italic ?? {}).length > 0
    return { f: family, c: f.category, w: normal.sort((a, b) => a - b), i: italic }
  })
  .filter((x) => x.w.length > 0)
  .sort((a, b) => a.f.localeCompare(b.f))
write('fonts.json', fonts)

// Phosphor
const core = require('@phosphor-icons/core')
const ph = require('@iconify-json/ph/icons.json')
const phIndex = []
const regular = {}
const fill = {}
for (const icon of core.icons) {
  const r = ph.icons[icon.name]
  const fl = ph.icons[`${icon.name}-fill`]
  if (!r) continue
  phIndex.push({ n: icon.name, c: icon.categories, t: icon.tags.filter((t) => !t.startsWith('*')) })
  regular[icon.name] = r.body
  if (fl) fill[icon.name] = fl.body
}
write('ph/index.json', phIndex)
write('ph/regular.json', regular)
write('ph/fill.json', fill)

// Fluent Emoji (plat)
const fe = require('@iconify-json/fluent-emoji-flat/icons.json')
const meta = require('@iconify-json/fluent-emoji-flat/metadata.json')
const skinTone = /-(light|medium-light|medium|medium-dark|dark)$/
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const feIndex = []
for (const [category, names] of Object.entries(meta.categories)) {
  const bodies = {}
  for (const n of names) {
    if (skinTone.test(n) || !fe.icons[n]) continue
    bodies[n] = fe.icons[n].body
    feIndex.push({ n, c: slug(category) })
  }
  write(`fluent/${slug(category)}.json`, bodies)
}
write('fluent/index.json', feIndex)

console.log(`polices ${fonts.length}, Phosphor ${phIndex.length}, Fluent ${feIndex.length}`)
