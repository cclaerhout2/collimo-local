export interface RatioDef {
  id: string
  /** Largeur / hauteur. */
  value: number
  label: string
  /** Usage indicatif, affiché sous le libellé (clé de traduction). */
  hint?: 'ratio.square' | 'ratio.post' | 'ratio.story' | 'ratio.screen' | 'ratio.print' | 'ratio.phone'
}

/** Formats proposés, carré par défaut. */
export const RATIOS: RatioDef[] = [
  { id: '1:1', value: 1, label: '1:1', hint: 'ratio.square' },
  { id: '4:5', value: 4 / 5, label: '4:5', hint: 'ratio.post' },
  { id: '9:16', value: 9 / 16, label: '9:16', hint: 'ratio.story' },
  { id: '16:9', value: 16 / 9, label: '16:9', hint: 'ratio.screen' },
  { id: '3:4', value: 3 / 4, label: '3:4' },
  { id: '4:3', value: 4 / 3, label: '4:3' },
  { id: '2:3', value: 2 / 3, label: '2:3', hint: 'ratio.print' },
  { id: '3:2', value: 3 / 2, label: '3:2', hint: 'ratio.print' },
  { id: 'A4', value: 1 / Math.SQRT2, label: 'A4', hint: 'ratio.print' },
  { id: '9:19.5', value: 9 / 19.5, label: '9:19,5', hint: 'ratio.phone' },
]

export const DEFAULT_RATIO = '1:1'

export function ratioValue(id: string): number {
  return RATIOS.find((r) => r.id === id)?.value ?? 1
}
