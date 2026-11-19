import { describe, expect, it } from 'vitest'
import { buildLayout, layoutsFor } from '../../collage/catalog'
import { cellBoxes } from '../../collage/geometry'
import { dividers } from '../../collage/layoutDsl'
import { DEFAULT_BORDERS, DEFAULT_CROP, type CollageDoc } from '../../collage/types'
import type { Photo } from '../../google/types'
import { togglePick } from './AddPhotosSheet'
import { nearestLayout, shuffled, withAddedPhotos } from './EditorScreen'
import { cellDividers, hitCell } from './InteractionLayer'

describe('hitCell', () => {
  const boxes = cellBoxes(
    [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
    ],
    100,
    100,
    { spacing: 0, margin: 0, radius: 0 },
  )

  it('choisit la case du dessus quand deux cases se superposent', () => {
    expect(hitCell(boxes, 50, 50)).toBe(1)
    expect(hitCell(boxes, 10, 10)).toBe(0)
  })

  it('ne trouve rien hors des cases', () => {
    expect(hitCell(boxes, 150, 10)).toBeNull()
  })
})

describe('cellDividers', () => {
  it('trouve les séparations qui longent une case', () => {
    const layout = buildLayout({ id: 'p03-test', photos: 3, family: 'mixte', split: 'c(x,r(x,x))' })
    const all = dividers(layout.split!)
    // Case en haut à droite : séparation verticale à gauche, horizontale en dessous.
    const handles = cellDividers(all, layout.cells[1])
    expect(handles.map((h) => h.divider.dir).sort()).toEqual(['c', 'r'])
    // Case de gauche : seulement la séparation verticale.
    expect(cellDividers(all, layout.cells[0]).map((h) => h.divider.dir)).toEqual(['c'])
  })
})

describe('nearestLayout', () => {
  it('garde la même famille quand elle existe pour une photo de moins', () => {
    const l = nearestLayout(3, 'fond')
    expect(l.photos).toBe(3)
    expect(l.family).toBe('fond')
  })

  it('revient à la première disposition sinon', () => {
    expect(nearestLayout(1, 'mixte').id).toBe(layoutsFor(1)[0].id)
  })
})

describe('shuffled', () => {
  it('garde toutes les photos', () => {
    const items = ['a', 'b', 'c', 'd']
    expect(shuffled(items).sort()).toEqual(items)
  })
})

/**
 * Photo Drive de test.
 * @param id - identifiant
 * @param supported - format lisible par le navigateur
 * @returns la photo
 */
const photo = (id: string, supported = true): Photo => ({ id, name: `${id}.jpg`, mimeType: 'image/jpeg', supported })

/**
 * Collage de test avec des photos déjà cadrées.
 * @param ids - identifiants des photos
 * @returns le collage
 */
function docWith(ids: string[]): CollageDoc {
  const layout = nearestLayout(ids.length, 'mixte')
  return {
    version: 1,
    ratio: '1:1',
    layoutId: layout.id,
    photos: ids.map((id) => ({ id, name: `${id}.jpg`, mimeType: 'image/jpeg', crop: { ...DEFAULT_CROP, zoom: 2 } })),
    borders: DEFAULT_BORDERS,
    background: '#ffffff',
    split: 'x',
  }
}

describe('withAddedPhotos', () => {
  it('ajoute à la fin, garde le cadrage existant et passe à une disposition plus grande', () => {
    const doc = docWith(['a', 'b', 'c'])
    const family = nearestLayout(3, 'mixte').family
    const next = withAddedPhotos(doc, family, [photo('d'), photo('e')])
    expect(next.photos.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(next.photos[0].crop.zoom).toBe(2)
    expect(next.photos[4].crop).toEqual(DEFAULT_CROP)
    expect(next.layoutId).toBe(nearestLayout(5, family).id)
    expect(next.split).toBeUndefined()
  })

  it('ignore les doublons, les formats illisibles et ce qui dépasse le maximum', () => {
    const doc = docWith(['a', 'b'])
    const next = withAddedPhotos(doc, 'mixte', [photo('a'), photo('x', false), photo('c'), photo('c'), photo('d'), photo('e')], 4)
    expect(next.photos.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rend le collage tel quel quand il n’y a rien à ajouter', () => {
    const doc = docWith(['a', 'b'])
    expect(withAddedPhotos(doc, 'mixte', [photo('a')])).toBe(doc)
  })
})

describe('togglePick', () => {
  it('coche, décoche et respecte la place restante', () => {
    expect(togglePick([], 'a', 2)).toEqual(['a'])
    expect(togglePick(['a', 'b'], 'a', 2)).toEqual(['b'])
    expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
  })
})
