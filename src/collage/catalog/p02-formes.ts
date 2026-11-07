import { cutFrame, edgePoints, hCut, path, poly, shapeAt, SHAPES, vCut } from '../shapes'
import type { Pt } from '../path'
import type { LayoutDef } from '../types'

const P = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(4)} ${p[1].toFixed(4)}`).join('') + 'Z'

/**
 * Forme de la bibliothèque placée en chemin (carré de côté `s` en haut à gauche (x, y)) : contrairement
 * à une forme, son contour est tracé, ce qui donne l'anneau d'écart visible sur une photo en fond.
 */
const inset = (name: keyof typeof SHAPES, x: number, y: number, s: number) =>
  path(SHAPES[name].replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, a: string, b: string) => `${(x + Number(a) * s).toFixed(4)} ${(y + Number(b) * s).toFixed(4)}`))

/** Colonne posée sur le fond, bords haut et bas déchirés. */
function tornColumn(x0: number, x1: number, y0: number, y1: number, seed: number) {
  const top = edgePoints([x0, y0], [x1, y0], 'torn', 0.06, 3, seed)
  const bottom = edgePoints([x1, y1], [x0, y1], 'torn', 0.06, 3, seed + 1)
  return poly(...top, ...bottom)
}

/** Bande déchirée en travers : photo 1 = au-dessus et en dessous, photo 2 = la bande. */
function tornBand() {
  const a = edgePoints([0, 0.45], [1, 0.17], 'torn', 0.025, 3, 21)
  const b = edgePoints([0, 0.75], [1, 0.47], 'torn', 0.025, 3, 22)
  const rev = (p: Pt[]) => [...p].reverse()
  const top: Pt[] = [[0, 0], [1, 0], ...rev(a)]
  const bottom: Pt[] = [...b, [1, 1], [0, 1]]
  const band: Pt[] = [...a, ...rev(b)]
  return [path(P(top) + P(bottom)), poly(...band)]
}

/** Dispositions en forme pour 2 photos (étape 6), numérotées comme dans l'inventaire. */
export const P02_FORMES: LayoutDef[] = [
  { id: 'p02-05', photos: 2, family: 'coupe', geo: vCut(0.56, 0.44, 'curve', -0.07) },
  { id: 'p02-06', photos: 2, family: 'coupe', geo: [poly([0, 0], [0.56, 0], [0.45, 0.48], [0.58, 0.48], [0.46, 1], [0, 1]), poly([0.56, 0], [1, 0], [1, 1], [0.46, 1], [0.58, 0.48], [0.45, 0.48])] },
  { id: 'p02-07', photos: 2, family: 'coupe', geo: vCut(0.52, 0.52, 'zigzag', 0.035, 4) },
  { id: 'p02-08', photos: 2, family: 'coupe', geo: hCut(0.5, 0.5, 'wave', 0.015, 8) },
  { id: 'p02-11', photos: 2, family: 'coupe', geo: cutFrame([[[0, 0], [1, 1]]]) },
  { id: 'p02-12', photos: 2, family: 'coupe', geo: cutFrame([[[0, 1], [1, 0]]]) },
  { id: 'p02-13', photos: 2, family: 'coeurs', geo: [shapeAt('heart', 0.27, 0.27, 0.46), shapeAt('heart', 0.64, 0.63, 0.6)] },
  {
    id: 'p02-14',
    photos: 2,
    family: 'ronds',
    geo: [shapeAt('circle', 0.36, 0.4, 0.5, { stretch: true, h: 0.64, rotate: -18 }), shapeAt('circle', 0.69, 0.7, 0.38, { stretch: true, h: 0.48, rotate: -18 })],
  },
  { id: 'p02-15', photos: 2, family: 'geometrie', geo: [shapeAt('star', 0.42, 0.4, 0.66, { rotate: -8 }), shapeAt('star', 0.74, 0.75, 0.42, { rotate: 12 })] },
  { id: 'p02-16', photos: 2, family: 'coeurs', geo: [shapeAt('heart', 0.64, 0.44, 0.64, { rotate: 12 }), shapeAt('heart', 0.27, 0.68, 0.4, { rotate: -8 })] },
  { id: 'p02-17', photos: 2, family: 'ronds', geo: [shapeAt('circle', 0.59, 0.42, 0.78), shapeAt('circle', 0.25, 0.73, 0.46)] },
  { id: 'p02-18', photos: 2, family: 'geometrie', geo: [poly([0, 0.1], [0.48, 0.33], [0, 1]), poly([1, 0], [1, 0.9], [0.4, 0.62])] },
  { id: 'p02-19', photos: 2, family: 'dechire', geo: [tornColumn(0, 0.47, 0.1, 0.9, 3), tornColumn(0.53, 1, 0.1, 0.9, 7)] },
  { id: 'p02-25', photos: 2, family: 'coupe', geo: cutFrame([[[0.4, 0], [0.58, 1]]], 'cols') },
  { id: 'p02-26', photos: 2, family: 'coupe', geo: cutFrame([[[0, 0.42], [1, 0.55]]]) },
  { id: 'p02-27', photos: 2, family: 'coupe', geo: cutFrame([[[0.66, 0], [0.4, 1]]], 'cols') },
  { id: 'p02-28', photos: 2, family: 'coupe', geo: cutFrame([[[0, 0.66], [1, 0.34]]]) },
  { id: 'p02-30', photos: 2, family: 'incrustation', geo: [path('M0 0H1V1H0Z'), inset('circle', 0.34, 0.33, 0.54)] },
  { id: 'p02-31', photos: 2, family: 'incrustation', geo: [path('M0 0H1V1H0Z'), inset('heart', 0.22, 0.17, 0.56)] },
  { id: 'p02-33', photos: 2, family: 'incrustation', geo: [path('M0 0H1V1H0Z'), inset('heart', 0.32, 0.38, 0.54)] },
  { id: 'p02-34', photos: 2, family: 'dechire', geo: vCut(0.62, 0.4, 'torn', 0.035, 4, 31) },
  { id: 'p02-35', photos: 2, family: 'dechire', geo: hCut(0.53, 0.32, 'torn', 0.03, 4, 33) },
  { id: 'p02-36', photos: 2, family: 'dechire', geo: tornBand() },
  {
    id: 'p02-37',
    photos: 2,
    family: 'coeurs',
    geo: [
      poly([0.05, 0.32], [0.24, 0.13], [0.44, 0.17], [0.5, 0.24], [0.45, 0.46], [0.53, 0.6], [0.49, 0.92]),
      poly([0.5, 0.24], [0.56, 0.17], [0.76, 0.13], [0.95, 0.32], [0.49, 0.92], [0.53, 0.6], [0.45, 0.46]),
    ],
  },
  { id: 'p02-38', photos: 2, family: 'illustre', geo: [shapeAt('circle', 0.5, 0.27, 0.46), poly([0.29, 0.47], [0.71, 0.47], [0.5, 0.94])] },
  { id: 'p02-39', photos: 2, family: 'illustre', geo: [shapeAt('leaf', 0.29, 0.68, 0.54, { rotate: -40 }), shapeAt('leaf', 0.64, 0.42, 0.8, { rotate: 38 })] },
]
