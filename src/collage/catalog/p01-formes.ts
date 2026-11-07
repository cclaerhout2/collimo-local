import { path, poly, shape, shapeAt } from '../shapes'
import type { LayoutDef } from '../types'

const r = (x: number, y: number, w: number, h: number) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`

/** Une photo vue à travers une grille 3 × 3 de fenêtres. */
const GRID9 = Array.from({ length: 9 }, (_, i) => r((i % 3) / 3, Math.floor(i / 3) / 3, 1 / 3, 1 / 3)).join('')

/** Pellicule : bande noire, trois vues, perforations des deux côtés (trous = fond ou photo). */
const FILM_WINDOWS = [0.07, 0.37, 0.67].map((y) => r(0.27, y, 0.46, 0.26)).join('')
const FILM_HOLES = Array.from({ length: 15 }, (_, i) => 0.075 + i * 0.058)
  .map((y) => r(0.215, y, 0.035, 0.03) + r(0.75, y, 0.035, 0.03))
  .join('')

/** Cadre d'appareil photo (icône « recadrer ») : deux équerres et un objectif. */
const ring = (cx: number, cy: number, ro: number, ri: number) => {
  const k = 0.5523
  const o = (rr: number) =>
    `M${cx} ${cy - rr}C${cx + rr * k} ${cy - rr} ${cx + rr} ${cy - rr * k} ${cx + rr} ${cy}C${cx + rr} ${cy + rr * k} ${cx + rr * k} ${cy + rr} ${cx} ${cy + rr}C${cx - rr * k} ${cy + rr} ${cx - rr} ${cy + rr * k} ${cx - rr} ${cy}C${cx - rr} ${cy - rr * k} ${cx - rr * k} ${cy - rr} ${cx} ${cy - rr}Z`
  // Cercle intérieur parcouru dans l'autre sens : trou en règle « nonzero ».
  const i = (rr: number) =>
    `M${cx} ${cy - rr}C${cx - rr * k} ${cy - rr} ${cx - rr} ${cy - rr * k} ${cx - rr} ${cy}C${cx - rr} ${cy + rr * k} ${cx - rr * k} ${cy + rr} ${cx} ${cy + rr}C${cx + rr * k} ${cy + rr} ${cx + rr} ${cy + rr * k} ${cx + rr} ${cy}C${cx + rr} ${cy - rr * k} ${cx + rr * k} ${cy - rr} ${cx} ${cy - rr}Z`
  return o(ro) + i(ri)
}
// Union des deux équerres (contour extérieur + carré intérieur évidé), puis l'objectif ; règle « evenodd ».
const CAMERA =
  'M0.15 0.05H0.23V0.15H0.85V0.72H0.95V0.8H0.85V0.95H0.77V0.8H0.15V0.23H0.05V0.15H0.15Z' +
  'M0.23 0.23H0.77V0.72H0.23Z' +
  ring(0.5, 0.48, 0.19, 0.12)

/** Dispositions en forme pour 1 photo (étape 6), numérotées comme dans l'inventaire. */
export const P01_FORMES: LayoutDef[] = [
  { id: 'p01-04', photos: 1, family: 'coeurs', geo: [shapeAt('heart', 0.5, 0.49, 0.84)] },
  { id: 'p01-05', photos: 1, family: 'ronds', geo: [shapeAt('circle', 0.5, 0.5, 0.76)] },
  { id: 'p01-06', photos: 1, family: 'geometrie', geo: [shape('arch', 0.21, 0.06, 0.58, 0.88, { stretch: true })] },
  { id: 'p01-07', photos: 1, family: 'geometrie', geo: [shapeAt('star', 0.5, 0.5, 0.78)] },
  { id: 'p01-08', photos: 1, family: 'coupe', geo: [poly([0, 0], [1, 1], [0, 1])] },
  { id: 'p01-09', photos: 1, family: 'coupe', geo: [poly([0, 0], [1, 0], [0, 1])] },
  { id: 'p01-13', photos: 1, family: 'ronds', geo: [shapeAt('flower', 0.5, 0.5, 0.82)] },
  { id: 'p01-14', photos: 1, family: 'grille', geo: [path(GRID9)] },
  {
    id: 'p01-16',
    photos: 1,
    family: 'illustre',
    geo: [path(FILM_WINDOWS)],
    decor: [{ d: r(0.2, 0.04, 0.6, 0.92) + FILM_WINDOWS + FILM_HOLES, fill: 'ink', evenodd: true }],
  },
  { id: 'p01-17', photos: 1, family: 'coeurs', geo: [shapeAt('heart', 0.5, 0.5, 0.86)] },
  { id: 'p01-18', photos: 1, family: 'geometrie', geo: [shapeAt('spade', 0.5, 0.5, 0.8)] },
  { id: 'p01-19', photos: 1, family: 'geometrie', geo: [shape('diamond', 0.2, 0.1, 0.6, 0.8, { stretch: true })] },
  { id: 'p01-20', photos: 1, family: 'geometrie', geo: [shapeAt('club', 0.5, 0.5, 0.8)] },
  { id: 'p01-21', photos: 1, family: 'illustre', geo: [shape('popsicle', 0.125, 0.05, 0.75, 0.9, { stretch: true })] },
  { id: 'p01-22', photos: 1, family: 'geometrie', geo: [shape('triangle-down', 0.05, 0.04, 0.9, 0.92, { stretch: true })] },
  { id: 'p01-23', photos: 1, family: 'geometrie', geo: [shape('triangle', 0.05, 0.04, 0.9, 0.92, { stretch: true })] },
  { id: 'p01-24', photos: 1, family: 'illustre', geo: [path(CAMERA, true)] },
]
