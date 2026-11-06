import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cellBoxes, drawingArea, type CellBox } from '../../collage/geometry'
import { panBy, pointerAngle, rotateTo, snapAngle, zoomAt } from '../../collage/gestures'
import { dividers, moveDivider, type Divider } from '../../collage/layoutDsl'
import type { CollageDoc, Crop, Layout } from '../../collage/types'

/** Délai d'appui long pour soulever une photo et l'échanger (ms). */
export const LONG_PRESS_MS = 500
/** Distance (px) à partir de laquelle un appui devient un glissé. */
const DRAG_THRESHOLD = 6
const ROTATE_HANDLE_GAP = 26

type Size = { w: number; h: number }

interface Props {
  width: number
  height: number
  doc: CollageDoc
  layout: Layout
  selected: number | null
  /** Mode « Échanger » du menu : le prochain toucher choisit l'autre photo. */
  swapPick: boolean
  imageSize: (cellIndex: number) => Size | undefined
  onSelect: (cellIndex: number | null) => void
  onCrop: (cellIndex: number, crop: Crop) => void
  onSwap: (a: number, b: number) => void
  onSplit: (split: string) => void
}

type Gesture =
  | { type: 'none' }
  | { type: 'pending'; cell: number | null; x: number; y: number; timer: number }
  | { type: 'pan'; cell: number; x: number; y: number }
  | { type: 'pinch'; cell: number; dist: number; angle: number; crop: Crop }
  | { type: 'rotate'; cell: number; startPointer: number; crop: Crop }
  | { type: 'divider'; divider: Divider; spec: string }
  | { type: 'swap'; from: number; over: number | null }

/** Case sous le point : la dernière dessinée d'abord (une incrustation est au-dessus). */
export function hitCell(boxes: CellBox[], x: number, y: number): number | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i
  }
  return null
}

/** Séparations qui longent la case donnée (relative au cadre), avec le point où placer leur poignée. */
export function cellDividers(all: Divider[], cell: { x: number; y: number; w: number; h: number }) {
  const eps = 1e-6
  const out: { divider: Divider; along: number }[] = []
  for (const d of all) {
    if (d.dir === 'c') {
      const onEdge = Math.abs(d.pos - cell.x) < eps || Math.abs(d.pos - (cell.x + cell.w)) < eps
      const lo = Math.max(d.from, cell.y)
      const hi = Math.min(d.to, cell.y + cell.h)
      if (onEdge && hi - lo > eps) out.push({ divider: d, along: (lo + hi) / 2 })
    } else {
      const onEdge = Math.abs(d.pos - cell.y) < eps || Math.abs(d.pos - (cell.y + cell.h)) < eps
      const lo = Math.max(d.from, cell.x)
      const hi = Math.min(d.to, cell.x + cell.w)
      if (onEdge && hi - lo > eps) out.push({ divider: d, along: (lo + hi) / 2 })
    }
  }
  return out
}

/**
 * Couche posée sur l'aperçu : sélection, glisser, zoom (molette, pincement, double-clic),
 * rotation (poignée ronde ou deux doigts), séparations, appui long pour échanger.
 * Mêmes gestes à la souris et au doigt, grâce aux événements « pointer ».
 */
export function InteractionLayer(props: Props) {
  const { width, height, doc, layout, selected, swapPick, onSelect, onCrop, onSwap, onSplit } = props
  const ref = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture>({ type: 'none' })
  const [lifted, setLifted] = useState<{ from: number; over: number | null } | null>(null)

  const boxes = cellBoxes(layout.cells, width, height, doc.borders)
  const area = drawingArea(width, height, doc.borders)
  const spec = doc.split ?? layout.split
  const allDividers = spec ? dividers(spec) : []

  // Toujours la dernière version des props dans les gestionnaires natifs (molette).
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  const local = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function cropOf(i: number) {
    return latest.current.doc.photos[i]?.crop
  }

  function sizes(i: number) {
    const img = latest.current.imageSize(i)
    const b = cellBoxes(latest.current.layout.cells, latest.current.width, latest.current.height, latest.current.doc.borders)[i]
    return img && b ? { img, box: { w: b.w, h: b.h }, b } : null
  }

  // Molette (et pincement du trackpad, transmis avec ctrlKey) : zoom sous le curseur.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const sel = latest.current.selected
      if (sel === null) return
      const p = local(e)
      const s = sizes(sel)
      const crop = cropOf(sel)
      if (!s || !crop) return
      if (p.x < s.b.x || p.x > s.b.x + s.b.w || p.y < s.b.y || p.y > s.b.y + s.b.h) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      latest.current.onCrop(sel, zoomAt(crop, s.img, s.box, crop.zoom * factor, p.x - (s.b.x + s.b.w / 2), p.y - (s.b.y + s.b.h / 2)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function clearTimer() {
    const g = gesture.current
    if (g.type === 'pending') window.clearTimeout(g.timer)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const p = local(e)
    ref.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current

    // Deuxième doigt sur la photo sélectionnée : pincer pour zoomer et tourner.
    if (pointers.current.size === 2 && selected !== null && (g.type === 'pan' || g.type === 'pending')) {
      clearTimer()
      const [a, b] = [...pointers.current.values()]
      const crop = cropOf(selected)
      if (crop) gesture.current = { type: 'pinch', cell: selected, dist: Math.hypot(b.x - a.x, b.y - a.y), angle: pointerAngle(a.x, a.y, b.x, b.y), crop }
      return
    }
    if (pointers.current.size > 1) return

    const handle = (e.target as Element).closest('[data-handle]')
    if (handle && selected !== null) {
      const kind = handle.getAttribute('data-handle')
      if (kind === 'rotate') {
        const b = boxes[selected]
        const crop = cropOf(selected)
        if (crop) gesture.current = { type: 'rotate', cell: selected, startPointer: pointerAngle(b.x + b.w / 2, b.y + b.h / 2, p.x, p.y), crop }
        return
      }
      if (kind === 'divider' && spec) {
        const d = allDividers[Number(handle.getAttribute('data-index'))]
        if (d) gesture.current = { type: 'divider', divider: d, spec }
        return
      }
    }

    const cell = hitCell(boxes, p.x, p.y)
    const timer = window.setTimeout(() => {
      const cur = gesture.current
      if (cur.type === 'pending' && cur.cell !== null && doc.photos.length > 1) {
        gesture.current = { type: 'swap', from: cur.cell, over: cur.cell }
        setLifted({ from: cur.cell, over: cur.cell })
        navigator.vibrate?.(10)
      }
    }, LONG_PRESS_MS)
    gesture.current = { type: 'pending', cell, x: p.x, y: p.y, timer }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current

    if (g.type === 'pending') {
      if (Math.hypot(p.x - g.x, p.y - g.y) < DRAG_THRESHOLD) return
      clearTimer()
      gesture.current = g.cell !== null && g.cell === selected ? { type: 'pan', cell: g.cell, x: g.x, y: g.y } : { type: 'none' }
    }
    const cur = gesture.current

    if (cur.type === 'pan') {
      const s = sizes(cur.cell)
      const crop = cropOf(cur.cell)
      if (s && crop) onCrop(cur.cell, panBy(crop, s.img, s.box, p.x - cur.x, p.y - cur.y))
      gesture.current = { ...cur, x: p.x, y: p.y }
    } else if (cur.type === 'pinch') {
      const pts = [...pointers.current.values()]
      if (pts.length < 2) return
      const [a, b] = pts
      const s = sizes(cur.cell)
      if (!s) return
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const angle = snapAngle(cur.crop.angle + pointerAngle(a.x, a.y, b.x, b.y) - cur.angle)
      const mid = { x: (a.x + b.x) / 2 - (s.b.x + s.b.w / 2), y: (a.y + b.y) / 2 - (s.b.y + s.b.h / 2) }
      const turned = rotateTo(cur.crop, s.img, s.box, angle)
      onCrop(cur.cell, zoomAt(turned, s.img, s.box, cur.crop.zoom * (dist / Math.max(1, cur.dist)), mid.x, mid.y))
    } else if (cur.type === 'rotate') {
      const b = boxes[cur.cell]
      const s = sizes(cur.cell)
      if (!s) return
      const now = pointerAngle(b.x + b.w / 2, b.y + b.h / 2, p.x, p.y)
      onCrop(cur.cell, rotateTo(cur.crop, s.img, s.box, snapAngle(cur.crop.angle + now - cur.startPointer, e.shiftKey)))
    } else if (cur.type === 'divider') {
      const d = cur.divider
      const pos = d.dir === 'c' ? (p.x - area.outer) / area.areaW : (p.y - area.outer) / area.areaH
      onSplit(moveDivider(cur.spec, d, pos))
    } else if (cur.type === 'swap') {
      const over = hitCell(boxes, p.x, p.y)
      if (over !== cur.over) {
        gesture.current = { ...cur, over }
        setLifted({ from: cur.from, over })
      }
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g.type === 'pinch') {
      // Un doigt levé : on s'arrête là, sans enchaîner sur un glissé involontaire.
      gesture.current = { type: 'none' }
      return
    }
    if (pointers.current.size > 0) return
    clearTimer()
    if (g.type === 'pending') {
      if (swapPick && selected !== null && g.cell !== null && g.cell !== selected) onSwap(selected, g.cell)
      else onSelect(g.cell)
    } else if (g.type === 'swap') {
      if (g.over !== null && g.over !== g.from) onSwap(g.from, g.over)
      setLifted(null)
    }
    gesture.current = { type: 'none' }
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    clearTimer()
    gesture.current = { type: 'none' }
    setLifted(null)
  }

  function onDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (selected === null) return
    const p = local(e)
    const s = sizes(selected)
    const crop = cropOf(selected)
    if (!s || !crop || hitCell(boxes, p.x, p.y) !== selected) return
    const target = crop.zoom < 1.5 ? 2 : 1
    onCrop(selected, zoomAt(crop, s.img, s.box, target, p.x - (s.b.x + s.b.w / 2), p.y - (s.b.y + s.b.h / 2)))
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (selected === null) return
    const s = sizes(selected)
    const crop = cropOf(selected)
    if (!s || !crop) return
    const step = e.shiftKey ? 40 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (e.key === 'Escape') onSelect(null)
    else if (moves[e.key]) onCrop(selected, panBy(crop, s.img, s.box, ...moves[e.key]))
    else if (e.key === '+' || e.key === '=') onCrop(selected, zoomAt(crop, s.img, s.box, crop.zoom * 1.1))
    else if (e.key === '-') onCrop(selected, zoomAt(crop, s.img, s.box, crop.zoom / 1.1))
    else return
    e.preventDefault()
  }

  const sel = selected !== null ? boxes[selected] : null
  const selCell = selected !== null ? layout.cells[selected] : null
  const handles = sel && selCell && layout.split ? cellDividers(allDividers, selCell) : []
  const rotateY = sel ? (sel.y > ROTATE_HANDLE_GAP + 4 ? sel.y - ROTATE_HANDLE_GAP : sel.y + ROTATE_HANDLE_GAP) : 0

  return (
    <div
      ref={ref}
      className={`interaction${swapPick ? ' picking' : ''}`}
      style={{ width, height }}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg width={width} height={height} className="interaction-svg" aria-hidden="true">
        {lifted && (
          <>
            <rect {...rectProps(boxes[lifted.from])} className="lifted" />
            {lifted.over !== null && lifted.over !== lifted.from && <rect {...rectProps(boxes[lifted.over])} className="drop-target" />}
          </>
        )}
        {sel && !lifted && (
          <>
            <rect {...rectProps(sel)} className="selection" />
            <line x1={sel.x + sel.w / 2} y1={rotateY} x2={sel.x + sel.w / 2} y2={sel.y > ROTATE_HANDLE_GAP + 4 ? sel.y : sel.y + ROTATE_HANDLE_GAP} className="rotate-stem" />
            <g data-handle="rotate" className="handle rotate-handle" transform={`translate(${sel.x + sel.w / 2} ${rotateY})`}>
              <circle r={14} />
              <path d="M-5 -2a6 6 0 1 1 1 6" fill="none" strokeWidth={2} />
              <path d="M-7 -6l2 4 4 -2" fill="none" strokeWidth={2} />
            </g>
            {handles.map(({ divider, along }) => {
              const index = allDividers.indexOf(divider)
              const x = divider.dir === 'c' ? area.outer + divider.pos * area.areaW : area.outer + along * area.areaW
              const y = divider.dir === 'r' ? area.outer + divider.pos * area.areaH : area.outer + along * area.areaH
              return (
                <g key={index} data-handle="divider" data-index={index} className={`handle divider-handle ${divider.dir === 'c' ? 'ew' : 'ns'}`} transform={`translate(${x} ${y})`}>
                  <circle r={11} />
                </g>
              )
            })}
          </>
        )}
        {swapPick && sel && <rect {...rectProps(sel)} className="lifted" />}
      </svg>
    </div>
  )
}

function rectProps(b: CellBox) {
  return { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.radius }
}
