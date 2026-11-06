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
import { overlayBox } from '../../collage/overlays'
import type { CollageDoc, Crop, Layout, Overlay } from '../../collage/types'

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
  selectedOverlay: string | null
  onSelectOverlay: (id: string | null) => void
  onOverlay: (o: Overlay) => void
  onEditText: (id: string) => void
  /** Pipette active : le prochain toucher renvoie sa position au lieu d'agir. */
  onEyedropper?: (x: number, y: number) => void
}

type Gesture =
  | { type: 'none' }
  | { type: 'pending'; cell: number | null; x: number; y: number; timer: number }
  | { type: 'pan'; cell: number; x: number; y: number }
  | { type: 'pinch'; cell: number; dist: number; angle: number; crop: Crop }
  | { type: 'rotate'; cell: number; startPointer: number; crop: Crop }
  | { type: 'divider'; divider: Divider; spec: string }
  | { type: 'swap'; from: number; over: number | null }
  | { type: 'opending'; id: string; x: number; y: number }
  | { type: 'omove'; id: string; x: number; y: number; o: Overlay }
  | { type: 'oscale'; id: string; dist: number; o: Overlay }
  | { type: 'orotate'; id: string; start: number; o: Overlay }
  | { type: 'owidth'; id: string; o: Overlay }
  | { type: 'opinch'; id: string; dist: number; angle: number; o: Overlay }

/** Case sous le point : la dernière dessinée d'abord (une incrustation est au-dessus). */
export function hitCell(boxes: CellBox[], x: number, y: number): number | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i
  }
  return null
}

/** Point (x, y) ramené dans le repère d'un élément : centre en 0, axes tournés avec lui. */
export function toOverlayFrame(o: Overlay, width: number, height: number, x: number, y: number): [number, number] {
  const a = (-o.angle * Math.PI) / 180
  const dx = x - o.cx * width
  const dy = y - o.cy * height
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
}

/** Élément sous le point : le plus haut d'abord. Marge de 8 px pour viser les petits éléments au doigt. */
export function hitOverlay(overlays: Overlay[], width: number, height: number, x: number, y: number, slop = 8): string | null {
  for (let i = overlays.length - 1; i >= 0; i--) {
    const o = overlays[i]
    const b = overlayBox(o, width, height)
    const [lx, ly] = toOverlayFrame(o, width, height, x, y)
    if (Math.abs(lx) <= b.w / 2 + slop && Math.abs(ly) <= b.h / 2 + slop) return o.id
  }
  return null
}

/** Agrandit ou réduit un élément d'un facteur ; un texte garde le même découpage en lignes. */
export function scaleOverlay(o: Overlay, factor: number): Overlay {
  const f = Math.max(0.05, factor)
  if (o.type === 'text') return { ...o, size: Math.min(1, Math.max(0.01, o.size * f)), width: Math.min(1.5, Math.max(0.05, o.width * f)) }
  return { ...o, size: Math.min(2, Math.max(0.02, o.size * f)) }
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
  const { selectedOverlay, onSelectOverlay, onOverlay, onEditText, onEyedropper } = props
  const overlays = doc.overlays ?? []
  const overlayById = (id: string) => (latest.current.doc.overlays ?? []).find((o) => o.id === id)
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
    if (onEyedropper) {
      onEyedropper(p.x, p.y)
      return
    }
    ref.current?.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, p)
    const g = gesture.current

    // Deuxième doigt sur un élément : pincer pour agrandir et tourner.
    if (pointers.current.size === 2 && (g.type === 'omove' || g.type === 'opending')) {
      const o = overlayById(g.id)
      const [a, b] = [...pointers.current.values()]
      if (o) gesture.current = { type: 'opinch', id: o.id, dist: Math.hypot(b.x - a.x, b.y - a.y), angle: pointerAngle(a.x, a.y, b.x, b.y), o }
      return
    }

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
    const kindAttr = handle?.getAttribute('data-handle') ?? ''
    if (handle && selectedOverlay && kindAttr.startsWith('o-')) {
      const o = overlayById(selectedOverlay)
      if (!o) return
      const c = { x: o.cx * width, y: o.cy * height }
      if (kindAttr === 'o-scale') gesture.current = { type: 'oscale', id: o.id, dist: Math.max(1, Math.hypot(p.x - c.x, p.y - c.y)), o }
      else if (kindAttr === 'o-rotate') gesture.current = { type: 'orotate', id: o.id, start: pointerAngle(c.x, c.y, p.x, p.y), o }
      else if (kindAttr === 'o-width') gesture.current = { type: 'owidth', id: o.id, o }
      return
    }

    const hitO = hitOverlay(overlays, width, height, p.x, p.y)
    if (hitO) {
      gesture.current = { type: 'opending', id: hitO, x: p.x, y: p.y }
      return
    }

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

    if (g.type === 'opending') {
      if (Math.hypot(p.x - g.x, p.y - g.y) < DRAG_THRESHOLD) return
      const o = overlayById(g.id)
      if (!o) return
      onSelectOverlay(o.id)
      gesture.current = { type: 'omove', id: o.id, x: g.x, y: g.y, o }
    }
    const og = gesture.current
    if (og.type === 'omove') {
      onOverlay({ ...og.o, cx: og.o.cx + (p.x - og.x) / width, cy: og.o.cy + (p.y - og.y) / height })
      return
    }
    if (og.type === 'oscale') {
      const c = { x: og.o.cx * width, y: og.o.cy * height }
      onOverlay(scaleOverlay(og.o, Math.hypot(p.x - c.x, p.y - c.y) / og.dist))
      return
    }
    if (og.type === 'orotate') {
      const now = pointerAngle(og.o.cx * width, og.o.cy * height, p.x, p.y)
      onOverlay({ ...og.o, angle: snapAngle(og.o.angle + now - og.start, e.shiftKey) })
      return
    }
    if (og.type === 'owidth' && og.o.type === 'text') {
      const [lx] = toOverlayFrame(og.o, width, height, p.x, p.y)
      const pad = og.o.effects.label.on ? og.o.effects.label.padding * og.o.size * Math.min(width, height) : 0
      onOverlay({ ...og.o, width: Math.min(1.5, Math.max(0.08, (2 * Math.abs(lx) - 2 * pad) / width)) })
      return
    }
    if (og.type === 'opinch') {
      const pts = [...pointers.current.values()]
      if (pts.length < 2) return
      const [a, b] = pts
      const scaled = scaleOverlay(og.o, Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, og.dist))
      onOverlay({ ...scaled, angle: snapAngle(og.o.angle + pointerAngle(a.x, a.y, b.x, b.y) - og.angle) })
      return
    }

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
    if (g.type === 'pinch' || g.type === 'opinch') {
      // Un doigt levé : on s'arrête là, sans enchaîner sur un glissé involontaire.
      gesture.current = { type: 'none' }
      return
    }
    if (pointers.current.size > 0) return
    clearTimer()
    if (g.type === 'opending') onSelectOverlay(g.id)
    else if (g.type === 'pending') {
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
    const p = local(e)
    const hitO = hitOverlay(overlays, width, height, p.x, p.y)
    if (hitO) {
      if (overlayById(hitO)?.type === 'text') onEditText(hitO)
      return
    }
    if (selected === null) return
    const s = sizes(selected)
    const crop = cropOf(selected)
    if (!s || !crop || hitCell(boxes, p.x, p.y) !== selected) return
    const target = crop.zoom < 1.5 ? 2 : 1
    onCrop(selected, zoomAt(crop, s.img, s.box, target, p.x - (s.b.x + s.b.w / 2), p.y - (s.b.y + s.b.h / 2)))
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (selectedOverlay) {
      const o = overlayById(selectedOverlay)
      if (!o) return
      const step = (e.shiftKey ? 20 : 4) / Math.max(1, width)
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (e.key === 'Escape') onSelectOverlay(null)
      else if (moves[e.key]) onOverlay({ ...o, cx: o.cx + moves[e.key][0], cy: o.cy + moves[e.key][1] * (width / Math.max(1, height)) })
      else if (e.key === '+' || e.key === '=') onOverlay(scaleOverlay(o, 1.08))
      else if (e.key === '-') onOverlay(scaleOverlay(o, 1 / 1.08))
      else return
      e.preventDefault()
      return
    }
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
      className={`interaction${swapPick ? ' picking' : ''}${onEyedropper ? ' eyedropper' : ''}`}
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
        {selectedOverlay && <OverlaySelection o={overlays.find((x) => x.id === selectedOverlay)} width={width} height={height} />}
      </svg>
    </div>
  )
}

function rectProps(b: CellBox) {
  return { x: b.x, y: b.y, width: b.w, height: b.h, rx: b.radius }
}

/** Cadre d'un élément sélectionné, tourné avec lui : poignées agrandir (coin), tourner (rond), largeur (texte). */
function OverlaySelection({ o, width, height }: { o?: Overlay; width: number; height: number }) {
  if (!o) return null
  const b = overlayBox(o, width, height)
  const w = b.w + 12
  const h = b.h + 12
  return (
    <g transform={`translate(${o.cx * width} ${o.cy * height}) rotate(${o.angle})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} className="selection overlay-selection" />
      <line x1={0} y1={-h / 2} x2={0} y2={-h / 2 - ROTATE_HANDLE_GAP + 14} className="rotate-stem" />
      <g data-handle="o-rotate" className="handle rotate-handle" transform={`translate(0 ${-h / 2 - ROTATE_HANDLE_GAP})`}>
        <circle r={14} />
        <path d="M-5 -2a6 6 0 1 1 1 6" fill="none" strokeWidth={2} />
        <path d="M-7 -6l2 4 4 -2" fill="none" strokeWidth={2} />
      </g>
      <g data-handle="o-scale" className="handle scale-handle" transform={`translate(${w / 2} ${h / 2})`}>
        <circle r={12} />
        <path d="M-4 -4l8 8M0 4h4v-4M-4 0v-4h4" fill="none" strokeWidth={1.8} />
      </g>
      {o.type === 'text' && (
        <g data-handle="o-width" className="handle divider-handle ew" transform={`translate(${w / 2} 0)`}>
          <circle r={9} />
        </g>
      )}
    </g>
  )
}
