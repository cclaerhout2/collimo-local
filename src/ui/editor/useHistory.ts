/**
 * Historique d'annulation de l'éditeur : fonctions pures sur un état passé / présent / futur,
 * et le hook {@link useHistory} qui les branche sur un état React.
 */
import { useCallback, useState, type SetStateAction } from 'react'

/** Modifications rapprochées (un glissé, un curseur) regroupées en une seule étape d'annulation. */
export const COALESCE_MS = 500
/** Nombre maximal d'étapes conservées dans le passé ; les plus anciennes sont oubliées. */
export const MAX_HISTORY = 100

/** État avec son historique d'annulation. */
export interface History<T> {
  /** États précédents, du plus ancien au plus récent. */
  past: T[]
  /** État courant. */
  present: T
  /** États annulés, que « rétablir » peut restaurer (le plus proche en premier). */
  future: T[]
  /** Heure de la dernière modification (ms, `Date.now()`), pour regrouper les suivantes ; 0 après annuler / rétablir. */
  at: number
}

/**
 * Crée un historique vide autour d'une valeur initiale.
 * @param value - état de départ
 * @returns l'historique, sans passé ni futur
 */
export function historyInit<T>(value: T): History<T> {
  return { past: [], present: value, future: [], at: 0 }
}

/**
 * Enregistre un nouvel état et vide le futur.
 *
 * Une modification arrivée moins de {@link COALESCE_MS} après la précédente remplace le présent
 * sans créer d'étape, pour qu'un glissé ou un curseur s'annule d'un coup.
 * @param h - historique courant
 * @param next - nouvel état
 * @param now - heure de la modification, en millisecondes
 * @returns le nouvel historique, ou `h` tel quel si l'état n'a pas changé
 */
export function historySet<T>(h: History<T>, next: T, now: number): History<T> {
  if (Object.is(next, h.present)) return h
  if (now - h.at < COALESCE_MS && h.past.length > 0) return { ...h, present: next, future: [], at: now }
  return { past: [...h.past, h.present].slice(-MAX_HISTORY), present: next, future: [], at: now }
}

/**
 * Revient à l'état précédent.
 * @param h - historique courant
 * @returns l'historique après annulation, ou `h` s'il n'y a rien à annuler
 */
export function historyUndo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1)
  if (prev === undefined) return h
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], at: 0 }
}

/**
 * Restaure le dernier état annulé.
 * @param h - historique courant
 * @returns l'historique après rétablissement, ou `h` s'il n'y a rien à rétablir
 */
export function historyRedo<T>(h: History<T>): History<T> {
  const next = h.future[0]
  if (next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), at: 0 }
}

/**
 * État React avec annuler / rétablir.
 * @param initial - fabrique de l'état initial, appelée une seule fois
 * @returns la valeur courante, `set` (même forme que le setter de `useState`), `undo`, `redo`, `canUndo` et `canRedo`
 */
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
