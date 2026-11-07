/**
 * Dispositions « en forme » du catalogue pour 3 photos : polygones, chemins SVG et formes de la bibliothèque
 * (champ `geo`), en coordonnées relatives au cadre (0–1, origine en haut à gauche).
 */
import type { Pt } from '../path'
import { cutFrame, edgePoints, path, pieDisc, poly, rect, shape, shapeAt, SHAPES } from '../shapes'
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

/**
 * Copie d'une suite de points en ordre inverse (pour parcourir une déchirure dans l'autre sens).
 * @param p - points à inverser
 * @returns une nouvelle liste, l'original reste intact
 */
const rev = (p: Pt[]) => [...p].reverse()
// Déchirures de p03-27 : verticale en deux moitiés, horizontale à gauche.
const V1 = edgePoints([0.55, 0], [0.55, 0.5], 'torn', 0.04, 3, 21)
const V2 = edgePoints([0.55, 0.5], [0.55, 1], 'torn', 0.04, 3, 22)
const H = edgePoints([0, 0.5], [0.55, 0.5], 'torn', 0.04, 3, 23)

/** Dispositions en forme pour 3 photo(s) (étape 6), numérotées comme dans l'inventaire. */
export const P03_FORMES: LayoutDef[] = [
  {
    id: 'p03-09',
    photos: 3,
    family: 'coupe',
    geo: cutFrame([
      [
        [0, 0.27],
        [1, 0.37],
      ],
      [
        [0, 0.75],
        [1, 0.62],
      ],
    ]),
  },
  {
    id: 'p03-10',
    photos: 3,
    family: 'coupe',
    geo: [poly([0, 0], [0.5, 0], [0.5, 0.48], [0, 1]), poly([0.5, 0], [1, 0], [1, 1], [0.5, 0.48]), poly([0, 1], [0.5, 0.48], [1, 1])],
  },
  {
    id: 'p03-11',
    photos: 3,
    family: 'coupe',
    geo: [poly([0, 0], [0.5, 0], [0, 1]), poly([0.5, 0], [1, 1], [0, 1]), poly([0.5, 0], [1, 0], [1, 1])],
  },
  {
    id: 'p03-12',
    photos: 3,
    family: 'coupe',
    geo: [poly([0, 0], [0.5, 1], [0, 1]), poly([0, 0], [1, 0], [0.5, 1]), poly([1, 0], [1, 1], [0.5, 1])],
  },
  {
    id: 'p03-14',
    photos: 3,
    family: 'incrustation',
    geo: [rect(0, 0, 1, 0.5), rect(0, 0.5, 1, 0.5), path(place(SHAPES.circle, 0.27, 0.27, 0.46, 0.46))],
  },
  {
    id: 'p03-15',
    photos: 3,
    family: 'incrustation',
    geo: [rect(0, 0, 1, 0.5), rect(0, 0.5, 1, 0.5), path(place(SHAPES.heart, 0.25, 0.27, 0.5, 0.46))],
  },
  {
    id: 'p03-16',
    photos: 3,
    family: 'incrustation',
    geo: [
      poly([0, 0], [1, 0], [1, 0.28], [0.52, 0.28], [0.52, 0.72], [0, 0.72]),
      poly([0, 0.72], [0.52, 0.72], [0.52, 0.28], [1, 0.28], [1, 1], [0, 1]),
      path(place(SHAPES.circle, 0.3, 0.28, 0.44, 0.44)),
    ],
  },
  {
    id: 'p03-20',
    photos: 3,
    family: 'coupe',
    geo: cutFrame([
      [
        [0, 0.4],
        [1, 0.22],
      ],
      [
        [0, 0.78],
        [1, 0.6],
      ],
    ]),
  },
  {
    id: 'p03-21',
    photos: 3,
    family: 'geometrie',
    geo: [shapeAt('hexagon', 0.49, 0.29, 0.529), shapeAt('hexagon', 0.28, 0.68, 0.529), shapeAt('hexagon', 0.7, 0.68, 0.529)],
  },
  {
    id: 'p03-22',
    photos: 3,
    family: 'illustre',
    geo: [
      shape('circle', 0.08, 0.24, 0.4, 0.7, { stretch: true }),
      shape('circle', 0.52, 0.24, 0.4, 0.7, { stretch: true }),
      path(
        'M0.5 0.2C0.605 0.2 0.69 0.37 0.69 0.58C0.69 0.79 0.605 0.96 0.5 0.96C0.395 0.96 0.31 0.79 0.31 0.58C0.31 0.37 0.395 0.2 0.5 0.2Z' +
          'M0.475 0.215L0.49 0.06L0.56 0.08L0.53 0.215Z',
      ),
    ],
  },
  {
    id: 'p03-23',
    photos: 3,
    family: 'ronds',
    geo: [shapeAt('circle', 0.32, 0.28, 0.483), shapeAt('circle', 0.69, 0.47, 0.506), shapeAt('circle', 0.33, 0.71, 0.506)],
  },
  {
    id: 'p03-24',
    photos: 3,
    family: 'coeurs',
    geo: [shapeAt('heart', 0.7, 0.27, 0.48), shapeAt('heart', 0.3, 0.47, 0.48), shapeAt('heart', 0.63, 0.73, 0.48)],
  },
  {
    id: 'p03-25',
    photos: 3,
    family: 'coupe',
    geo: cutFrame(
      [
        [
          [0.42, 0],
          [0.05, 1],
        ],
        [
          [0.95, 0],
          [0.52, 1],
        ],
      ],
      'cols',
    ),
  },
  {
    id: 'p03-26',
    photos: 3,
    family: 'coupe',
    geo: [poly([0, 0], [1, 0], [0, 1]), poly([1, 0], [1, 1], [0.5, 0.5]), poly([0, 1], [0.5, 0.5], [1, 1])],
  },
  {
    id: 'p03-27',
    photos: 3,
    family: 'dechire',
    geo: [poly([0, 0], ...V1, ...rev(H)), poly([1, 0], [1, 1], ...rev(V2), ...rev(V1)), poly(...H, ...V2, [0, 1])],
  },
  {
    id: 'p03-28',
    photos: 3,
    family: 'incrustation',
    geo: [rect(0, 0, 1, 1), path(place(SHAPES.heart, 0.5, 0.1, 0.34, 0.3)), path(place(SHAPES.heart, 0.44, 0.42, 0.46, 0.42))],
  },
  {
    id: 'p03-29',
    photos: 3,
    family: 'coupe',
    geo: [
      path('M0 0C0.3 0.05 0.5 0.25 0.62 0.49C0.35 0.52 0.15 0.65 0 1Z'),
      path('M0 0H1V0.49L0.62 0.49C0.5 0.25 0.3 0.05 0 0Z'),
      path('M0 1C0.15 0.65 0.35 0.52 0.62 0.49L1 0.49V1Z'),
    ],
  },
  {
    id: 'p03-33',
    photos: 3,
    family: 'coupe',
    geo: [rect(0, 0, 0.5, 0.5), poly([0.5, 0], [1, 0], [1, 1], [0.5, 0.5]), poly([0, 0.5], [0.5, 0.5], [1, 1], [0, 1])],
  },
  {
    id: 'p03-35',
    photos: 3,
    family: 'geometrie',
    geo: [
      shape('rounded', 0.08, 0.1, 0.38, 0.33, { stretch: true }),
      shape('rounded', 0.5, 0.1, 0.42, 0.33, { stretch: true }),
      shape('rounded', 0.08, 0.48, 0.84, 0.42, { stretch: true }),
    ],
  },
  { id: 'p03-36', photos: 3, family: 'ronds', geo: pieDisc(3, 0.5, 0.5, 0.43, 0) },
  {
    id: 'p03-37',
    photos: 3,
    family: 'illustre',
    geo: [
      poly([0.08, 0.5], [0.29, 0.13], [0.71, 0.13], [0.62, 0.5]),
      poly([0.71, 0.13], [0.92, 0.5], [0.71, 0.87], [0.62, 0.5]),
      poly([0.08, 0.5], [0.62, 0.5], [0.71, 0.87], [0.29, 0.87]),
    ],
  },
  {
    id: 'p03-38',
    photos: 3,
    family: 'ronds',
    geo: [shapeAt('flower', 0.5, 0.27, 0.44), shapeAt('flower', 0.27, 0.72, 0.44), shapeAt('flower', 0.73, 0.72, 0.44)],
  },
  {
    id: 'p03-39',
    photos: 3,
    family: 'illustre',
    geo: [shapeAt('circle', 0.21, 0.23, 0.36), shapeAt('circle', 0.79, 0.23, 0.36), shapeAt('circle', 0.5, 0.6, 0.68)],
  },
  {
    id: 'p03-40',
    photos: 3,
    family: 'ronds',
    geo: [
      shapeAt('circle', 0.22, 0.28, 0.358, { stretch: true, h: 0.48, rotate: -20 }),
      shapeAt('circle', 0.5, 0.55, 0.358, { stretch: true, h: 0.48, rotate: -20 }),
      shapeAt('circle', 0.78, 0.8, 0.358, { stretch: true, h: 0.44, rotate: -20 }),
    ],
  },
]
