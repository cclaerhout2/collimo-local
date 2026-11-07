import { describe, expect, it } from 'vitest'
import { buildLayout, layoutsFor } from '../../collage/catalog'
import { cellBoxes } from '../../collage/geometry'
import { dividers } from '../../collage/layoutDsl'
import { nearestLayout, shuffled } from './EditorScreen'
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
