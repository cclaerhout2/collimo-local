/**
 * Dispositions « en forme » du catalogue pour 5 photos : polygones, chemins SVG et formes de la bibliothèque
 * (champ `geo`), en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import { cutFrame, path, pieDisc, poly, rect, shape, shapeAt, SHAPES } from '../shapes'
import type { LayoutDef } from '../types'

/**
 * Forme de la bibliothèque (carré unité) recopiée en chemin dans le rectangle (x, y, w, h) du cadre.
 * @param d - chemin SVG de la forme, dans le carré unité
 * @param x - bord gauche du rectangle
 * @param y - bord haut du rectangle
 * @param w - largeur du rectangle
 * @param h - hauteur du rectangle
 * @returns le chemin transformé, coordonnées arrondies à 4 décimales
 */
const place = (d: string, x: number, y: number, w: number, h: number) =>
  d.replace(
    /(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g,
    (_, a: string, b: string) => `${(x + Number(a) * w).toFixed(4)} ${(y + Number(b) * h).toFixed(4)}`,
  )

/** Étoile à quatre branches (carré unité). */
const SPARKLE = 'M0.5 0C0.55 0.38 0.62 0.45 1 0.5C0.62 0.55 0.55 0.62 0.5 1C0.45 0.62 0.38 0.55 0 0.5C0.38 0.45 0.45 0.38 0.5 0Z'

/**
 * Quatre quarts du cadre et un médaillon au centre (dessiné par-dessus, avec un anneau d'écart).
 * @param d - chemin SVG du médaillon, dans le carré unité
 * @param size - côté du médaillon, en fraction du cadre
 * @returns les cinq cases : les quatre quarts puis le médaillon
 */
const medallion = (d: string, size: number) => [
  rect(0, 0, 0.5, 0.5),
  rect(0.5, 0, 0.5, 0.5),
  rect(0, 0.5, 0.5, 0.5),
  rect(0.5, 0.5, 0.5, 0.5),
  path(place(d, 0.5 - size / 2, 0.5 - size / 2, size, size)),
]

/**
 * Formes en couronne, tournées pour pointer vers le centre (angle 0 = en haut).
 * @param s - forme utilisée
 * @param n - nombre de formes
 * @param r - rayon de la couronne, en fraction du cadre
 * @param size - largeur de chaque forme
 * @param h - hauteur de chaque forme (par défaut `size` ; différente, la forme est étirée)
 * @returns les cases, dans le sens des aiguilles d'une montre depuis le haut
 */
const around = (s: 'heart' | 'diamond', n: number, r: number, size: number, h = size) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n
    const rad = (a * Math.PI) / 180
    return shapeAt(s, 0.5 + r * Math.sin(rad), 0.5 - r * Math.cos(rad), size, { rotate: a, stretch: h !== size, h })
  })

/** Dispositions en forme pour 5 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P05_FORMES: LayoutDef[] = [
  { id: 'p05-09', photos: 5, family: 'incrustation', geo: medallion(SHAPES.heart, 0.5) },
  { id: 'p05-10', photos: 5, family: 'incrustation', geo: medallion(SPARKLE, 0.58) },
  { id: 'p05-11', photos: 5, family: 'incrustation', geo: medallion('M0 0L1 0L1 1L0 1Z', 0.48) },
  { id: 'p05-12', photos: 5, family: 'incrustation', geo: medallion(SHAPES.circle, 0.5) },
  {
    id: 'p05-13',
    photos: 5,
    family: 'incrustation',
    // Spirale : chaque trait part du cadre et devient tangent au médaillon central.
    geo: [
      path('M0 0L0.71 0L0.71 0.5C0.71 0.384 0.616 0.29 0.5 0.29L0 0.29Z'),
      path('M0.71 0L1 0L1 0.71L0.5 0.71C0.616 0.71 0.71 0.616 0.71 0.5Z'),
      path('M0 0.29L0.5 0.29C0.384 0.29 0.29 0.384 0.29 0.5L0.29 1L0 1Z'),
      path('M1 0.71L1 1L0.29 1L0.29 0.5C0.29 0.616 0.384 0.71 0.5 0.71Z'),
      path(place(SHAPES.circle, 0.29, 0.29, 0.42, 0.42)),
    ],
  },
  {
    id: 'p05-14',
    photos: 5,
    family: 'coupe',
    geo: [
      poly([0, 0], [0.05, 0], [0.38, 1], [0, 1]),
      poly([0.05, 0], [0.55, 0], [0.682, 0.33], [0.159, 0.33]),
      poly([0.159, 0.33], [0.682, 0.33], [0.79, 0.6], [0.248, 0.6]),
      poly([0.248, 0.6], [0.79, 0.6], [0.95, 1], [0.38, 1]),
      poly([0.55, 0], [1, 0], [1, 1], [0.95, 1]),
    ],
  },
  {
    id: 'p05-15',
    photos: 5,
    family: 'coupe',
    geo: [
      rect(0, 0, 0.3, 1),
      poly([0.3, 0], [0.7, 0], [0.3, 0.62]),
      poly([0.7, 0], [0.7, 0.4], [0.3, 1], [0.3, 0.62]),
      poly([0.7, 0.4], [0.7, 1], [0.3, 1]),
      rect(0.7, 0, 0.3, 1),
    ],
  },
  { id: 'p05-25', photos: 5, family: 'coeurs', geo: around('heart', 5, 0.245, 0.42) },
  {
    id: 'p05-26',
    photos: 5,
    family: 'ronds',
    // Fleur à quatre pétales en cœur (diagonales) et cœur rond : le médaillon central est la 5e photo.
    geo: [
      ...[315, 45, 225, 135].map((a) => {
        const rad = (a * Math.PI) / 180
        return shapeAt('heart', 0.5 + 0.24 * Math.sin(rad), 0.5 - 0.24 * Math.cos(rad), 0.46, { rotate: a })
      }),
      shapeAt('circle', 0.5, 0.5, 0.32),
    ],
  },
  { id: 'p05-27', photos: 5, family: 'geometrie', geo: around('diamond', 5, 0.25, 0.33, 0.5) },
  {
    id: 'p05-28',
    photos: 5,
    family: 'ronds',
    geo: [
      shapeAt('flower', 0.25, 0.24, 0.37),
      shapeAt('flower', 0.75, 0.24, 0.37),
      shapeAt('flower', 0.5, 0.5, 0.33),
      shapeAt('flower', 0.25, 0.76, 0.37),
      shapeAt('flower', 0.75, 0.76, 0.37),
    ],
  },
  {
    id: 'p05-32',
    photos: 5,
    family: 'geometrie',
    geo: [
      poly([0, 0], [0.5, 0], [0.5, 0.25], [0.25, 0.5], [0, 0.5]),
      poly([0.5, 0], [1, 0], [1, 0.5], [0.75, 0.5], [0.5, 0.25]),
      poly([0.5, 0.25], [0.75, 0.5], [0.5, 0.75], [0.25, 0.5]),
      poly([0, 0.5], [0.25, 0.5], [0.5, 0.75], [0.5, 1], [0, 1]),
      poly([0.75, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.75]),
    ],
  },
  {
    id: 'p05-36',
    photos: 5,
    family: 'coupe',
    geo: [
      poly([0.52, 0.5], [0, 0.18], [0, 0], [0.72, 0]),
      poly([0.52, 0.5], [0.72, 0], [1, 0], [1, 0.6]),
      poly([0.52, 0.5], [0, 0.97], [0, 0.18]),
      poly([0.52, 0.5], [1, 0.6], [1, 1], [0.63, 1]),
      poly([0.52, 0.5], [0.63, 1], [0, 1], [0, 0.97]),
    ],
  },
  {
    id: 'p05-37',
    photos: 5,
    family: 'geometrie',
    geo: [
      shapeAt('hexagon', 0.21, 0.42, 0.34),
      shapeAt('hexagon', 0.5, 0.38, 0.34),
      shapeAt('hexagon', 0.8, 0.3, 0.34),
      shapeAt('hexagon', 0.35, 0.71, 0.34),
      shapeAt('hexagon', 0.64, 0.68, 0.34),
    ],
  },
  {
    id: 'p05-38',
    photos: 5,
    family: 'ronds',
    geo: pieDisc(5, 0.5, 0.5, 0.46, 0),
    decor: [{ d: place(SHAPES.circle, 0.4, 0.4, 0.2, 0.2), fill: 'bg' }],
  },
]

void cutFrame
void shape
