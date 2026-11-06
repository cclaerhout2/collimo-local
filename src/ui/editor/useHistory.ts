import { useCallback, useState, type SetStateAction } from 'react'

/** Modifications rapprochées (un glissé, un curseur) regroupées en une seule étape d'annulation. */
export const COALESCE_MS = 500
export const MAX_HISTORY = 100

export interface History<T> {
  past: T[]
  present: T
  future: T[]
  /** Heure de la dernière modification, pour regrouper les suivantes. */
  at: number
}

export function historyInit<T>(value: T): History<T> {
  return { past: [], present: value, future: [], at: 0 }
}

export function historySet<T>(h: History<T>, next: T, now: number): History<T> {
  if (Object.is(next, h.present)) return h
  if (now - h.at < COALESCE_MS && h.past.length > 0) return { ...h, present: next, future: [], at: now }
  return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: next, future: [], at: now }
}

export function historyUndo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1)
  if (prev === undefined) return h
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], at: 0 }
}

export function historyRedo<T>(h: History<T>): History<T> {
  const next = h.future[0]
  if (next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), at: 0 }
}

/** État avec annuler / rétablir. */
export function useHistory<T>(initial: () => T) {
  const [h, setH] = useState(() => historyInit(initial()))
  const set = useCallback((action: SetStateAction<T>) => {
    setH((cur) => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(cur.present) : action
      return historySet(cur, next, Date.now())
    })
  }, [])
  const undo = useCallback(() => setH(historyUndo), [])
  const redo = useCallback(() => setH(historyRedo), [])
  return { value: h.present, set, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }
}
