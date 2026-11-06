import { describe, expect, it } from 'vitest'
import { applyPreset, coloredSvg, duplicateOverlay, newIcon, newText, TEXT_PRESETS, wrapLines } from './overlays'

// Mesure simple : 1 unité par caractère.
const measure = (s: string) => s.length

describe('wrapLines', () => {
  it('coupe aux espaces sous la largeur maximale', () => {
    expect(wrapLines(measure, 'un deux trois quatre', 9)).toEqual(['un deux', 'trois', 'quatre'])
  })

  it('respecte les retours à la ligne saisis', () => {
    expect(wrapLines(measure, 'haut\nbas', 100)).toEqual(['haut', 'bas'])
  })

  it('garde un mot trop long sur sa propre ligne', () => {
    expect(wrapLines(measure, 'a anticonstitutionnellement b', 5)).toEqual(['a', 'anticonstitutionnellement', 'b'])
  })
})

describe('styles et copies', () => {
  it('un style change police, couleur et effets, pas le texte ni la position', () => {
    const t = { ...newText('Bravo'), cx: 0.2, size: 0.3 }
    const styled = applyPreset(t, TEXT_PRESETS.find((p) => p.id === 'neon')!)
    expect(styled.text).toBe('Bravo')
    expect([styled.cx, styled.size]).toEqual([0.2, 0.3])
    expect(styled.font.family).toBe('Righteous')
    expect(styled.effects.glow.on).toBe(true)
    expect(styled.effects.shadow.on).toBe(false)
  })

  it('les styles ne se partagent pas leurs effets', () => {
    const a = newText('a')
    const b = newText('b')
    a.effects.stroke.on = !a.effects.stroke.on
    expect(b.effects.stroke.on).not.toBe(a.effects.stroke.on)
  })

  it('dupliquer donne un nouvel identifiant, légèrement décalé', () => {
    const t = newText('x')
    const c = duplicateOverlay(t)
    expect(c.id).not.toBe(t.id)
    expect(c.cx).toBeGreaterThan(t.cx)
  })

  it('recolore les icônes d’une couleur', () => {
    const i = newIcon('ph', 'heart', '<svg><path fill="currentColor"/></svg>', '#ff0000')
    expect(coloredSvg(i)).toBe('<svg><path fill="#ff0000"/></svg>')
  })
})
