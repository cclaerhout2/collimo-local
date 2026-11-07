import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cellPathFrame } from '../../collage/cells'
import { cellCenter, dragSeparator, insertPoint, movePoint, rectToPoly, translate, type Side } from '../../collage/factory/ops'
import { serializePath, type Pt } from '../../collage/path'
import type { CellDef, Decor } from '../../collage/shapes'

export type Tool = 'select' | 'cut' | 'order'
export interface EdgeRef {
  cell: number
  k: number
}

interface Props {
  cells: CellDef[]
  decor?: Decor[]
  tool: Tool
  selected: number | null
  point: number | null
  edge: EdgeRef | null
  /** Cases déjà numérotées en mode Ordre. */
  orderSeq: number[]
  onChange: (cells: CellDef[]) => void
  onSelect: (i: number | null) => void
  onSelectPoint: (k: number | null) => void
  onSelectEdge: (e: EdgeRef | null) => void
  onOrderClick: (i: number) => void
}

/** Contour d'une case en coordonnées du cadre (0–1). */
export function cellD(c: CellDef): string {
  if (c.kind === 'rect') return `M${c.x} ${c.y}H${c.x + c.w}V${c.y + c.h}H${c.x}Z`
  return serializePath(cellPathFrame(c, 1)!.segs)
}

/** Sommets d'une case qui a des côtés droits (rectangle ou polygone), dans l'ordre de ses côtés. */
export function cellPoints(c: CellDef): Pt[] | null {
  if (c.kind === 'poly') return c.points
  if (c.kind === 'rect') return rectToPoly(c).points
  return null
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]

type Drag =
  | { type: 'move'; i: number; from: Pt; orig: CellDef[] }
  | { type: 'side'; i: number; side: Side; orig: CellDef[] }
  | { type: 'point'; i: number; k: number; orig: CellDef[] }
  | { type: 'resize'; i: number; orig: CellDef[] }
  | { type: 'rotate'; i: number; orig: CellDef[] }

/** Repères d'aimantation : bords et sommets des autres cases, et fractions simples du cadre. */
function snapTargets(cells: CellDef[], skip: number): { xs: number[]; ys: number[] } {
  const xs = [...FRACTIONS]
  const ys = [...FRACTIONS]
  cells.forEach((c, i) => {
    if (i === skip) return
    if (c.kind === 'rect' || c.kind === 'shape') {
      xs.push(c.x, c.x + c.w)
      ys.push(c.y, c.y + c.h)
    } else if (c.kind === 'poly') {
      for (const [x, y] of c.points) {
        xs.push(x)
        ys.push(y)
      }
    }
  })
  return { xs, ys }
}

function snap(v: number, targets: number[], tol = 0.012): number {
  let best = v
  let dist = tol
  for (const t of targets) {
    const d = Math.abs(t - v)
    if (d < dist) {
      dist = d
      best = t
    }
  }
  return best === v ? Math.round(v * 200) / 200 : best
}

/** Éditeur des cases : sélection, déplacement, séparations, sommets, formes, coupes et ordre. */
export function FactoryCanvas(p: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [px, setPx] = useState(600)

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setPx(e.contentRect.width || 600))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const u = 1 / px // une unité écran (pixel CSS) dans le repère 0–1
  const toFrame = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  function start(e: ReactPointerEvent, d: Drag) {
    e.stopPropagation()
    e.preventDefault()
    drag.current = d
    svgRef.current?.setPointerCapture(e.pointerId)
  }

  function onMove(e: ReactPointerEvent) {
    const d = drag.current
    if (!d) return
    const [x, y] = toFrame(e)
    const t = snapTargets(d.orig, d.i)
    if (d.type === 'side') {
      const v = d.side === 'left' || d.side === 'right' ? snap(x, t.xs) : snap(y, t.ys)
      p.onChange(dragSeparator(d.orig, d.i, d.side, v))
    } else if (d.type === 'point') {
      p.onChange(movePoint(d.orig, d.i, d.k, [snap(x, t.xs), snap(y, t.ys)]))
    } else if (d.type === 'move') {
      const c = d.orig[d.i]
      let dx = x - d.from[0]
      let dy = y - d.from[1]
      // Aimante le bord gauche/haut de la case déplacée.
      if (c.kind === 'rect' || c.kind === 'shape') {
        dx = snap(c.x + dx, t.xs) - c.x
        dy = snap(c.y + dy, t.ys) - c.y
      } else {
        dx = Math.round(dx * 200) / 200
        dy = Math.round(dy * 200) / 200
      }
      p.onChange(d.orig.map((q, n) => (n === d.i ? translate(q, dx, dy) : q)))
    } else if (d.type === 'resize' || d.type === 'rotate') {
      const c = d.orig[d.i]
      if (c.kind !== 'shape') return
      const cx = c.x + c.w / 2
      const cy = c.y + c.h / 2
      let next: CellDef
      if (d.type === 'resize') {
        // Poignée au coin, la forme reste centrée.
        const hw = Math.max(0.025, Math.abs(x - cx))
        const hh = Math.max(0.025, Math.abs(y - cy))
        const w = c.stretch ? hw * 2 : Math.max(hw, hh) * 2
        const h = c.stretch ? hh * 2 : w
        next = { ...c, x: round(cx - w / 2), y: round(cy - h / 2), w: round(w), h: round(h) }
      } else {
        let a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90
        const s = Math.round(a / 15) * 15
        if (Math.abs(a - s) < 4) a = s
        a = ((Math.round(a) % 360) + 360) % 360
        next = { ...c, rotate: a > 180 ? a - 360 : a }
        if (!next.rotate) delete next.rotate
      }
      p.onChange(d.orig.map((q, n) => (n === d.i ? next : q)))
    }
  }

  function onUp(e: ReactPointerEvent) {
    drag.current = null
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
  }

  function onCellDown(e: ReactPointerEvent, i: number) {
    if (p.tool === 'order') {
      e.stopPropagation()
      p.onOrderClick(i)
      return
    }
    if (p.tool === 'cut') return
    p.onSelect(i)
    p.onSelectPoint(null)
    start(e, { type: 'move', i, from: toFrame(e), orig: p.cells })
  }

  const sel = p.selected !== null ? p.cells[p.selected] : null
  const handle = 7 * u

  return (
    <svg
      ref={svgRef}
      className={`factory-canvas tool-${p.tool}`}
      viewBox="0 0 1 1"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerDown={() => {
        p.onSelect(null)
        p.onSelectPoint(null)
        p.onSelectEdge(null)
      }}
      role="application"
    >
      <rect width="1" height="1" className="fc-frame" />
      {p.cells.map((c, i) => (
        <path
          key={i}
          d={cellD(c)}
          fillRule={c.kind === 'path' && c.evenodd ? 'evenodd' : 'nonzero'}
          className={`fc-cell${i === p.selected ? ' selected' : ''}${c.over ? ' over' : ''}${p.orderSeq.includes(i) ? ' ordered' : ''}`}
          strokeWidth={1.5 * u}
          data-cell={i + 1}
          onPointerDown={(e) => onCellDown(e, i)}
        />
      ))}
      {p.decor?.map((d, i) => <path key={`d${i}`} d={d.d} className="fc-decor" />)}
      {p.cells.map((c, i) => {
        const [x, y] = cellCenter(c)
        const n = p.tool === 'order' ? p.orderSeq.indexOf(i) : i
        const label = p.tool === 'order' ? (n >= 0 ? String(n + 1) : '·') : String(i + 1)
        return (
          <text key={`n${i}`} x={x} y={y} className="fc-num" fontSize={14 * u} dy={5 * u}>
            {label}
          </text>
        )
      })}

      {/* Séparations des rectangles : poignées sur les 4 côtés. */}
      {p.tool === 'select' && sel?.kind === 'rect' &&
        SIDES.map((side) => {
          const c = sel
          const [x1, y1, x2, y2] =
            side === 'top' ? [c.x, c.y, c.x + c.w, c.y] : side === 'bottom' ? [c.x, c.y + c.h, c.x + c.w, c.y + c.h] : side === 'left' ? [c.x, c.y, c.x, c.y + c.h] : [c.x + c.w, c.y, c.x + c.w, c.y + c.h]
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const vertical = side === 'left' || side === 'right'
          return (
            <g key={side} className={`fc-side ${vertical ? 'v' : 'h'}`} onPointerDown={(e) => start(e, { type: 'side', i: p.selected!, side, orig: p.cells })}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={14 * u} className="fc-hit" />
              <rect x={mx - (vertical ? 3 : 14) * u} y={my - (vertical ? 14 : 3) * u} width={(vertical ? 6 : 28) * u} height={(vertical ? 28 : 6) * u} rx={3 * u} className="fc-grip" aria-label={side} />
            </g>
          )
        })}

      {/* Polygone : sommets à déplacer, milieux des côtés pour ajouter un point. */}
      {p.tool === 'select' && sel?.kind === 'poly' && (
        <g>
          {sel.points.map((a, k) => {
            const b = sel.points[(k + 1) % sel.points.length]
            const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            return (
              <circle
                key={`m${k}`}
                cx={m[0]}
                cy={m[1]}
                r={handle * 0.75}
                className="fc-mid"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  p.onChange(insertPoint(p.cells, p.selected!, k))
                  p.onSelectPoint(k + 1)
                }}
              />
            )
          })}
          {sel.points.map(([x, y], k) => (
            <circle
              key={`p${k}`}
              cx={x}
              cy={y}
              r={handle}
              className={`fc-point${k === p.point ? ' selected' : ''}`}
              onPointerDown={(e) => {
                p.onSelectPoint(k)
                start(e, { type: 'point', i: p.selected!, k, orig: p.cells })
              }}
            />
          ))}
        </g>
      )}

      {/* Forme : taille (coin) et rotation (poignée ronde au-dessus). */}
      {p.tool === 'select' && sel?.kind === 'shape' && (
        <g>
          <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} className="fc-bbox" strokeWidth={1 * u} />
          <line x1={sel.x + sel.w / 2} y1={sel.y} x2={sel.x + sel.w / 2} y2={sel.y - 22 * u} className="fc-bbox" strokeWidth={1 * u} />
          <circle cx={sel.x + sel.w / 2} cy={sel.y - 22 * u} r={handle} className="fc-rotate" onPointerDown={(e) => start(e, { type: 'rotate', i: p.selected!, orig: p.cells })} />
          <rect x={sel.x + sel.w - handle} y={sel.y + sel.h - handle} width={handle * 2} height={handle * 2} className="fc-resize" onPointerDown={(e) => start(e, { type: 'resize', i: p.selected!, orig: p.cells })} />
        </g>
      )}

      {/* Mode Coupes : tous les côtés droits sont sélectionnables. */}
      {p.tool === 'cut' &&
        p.cells.map((c, i) => {
          const pts = cellPoints(c)
          if (!pts) return null
          return pts.map((a, k) => {
            const b = pts[(k + 1) % pts.length]
            const on = p.edge?.cell === i && p.edge.k === k
            return (
              <line
                key={`e${i}-${k}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                strokeWidth={(on ? 5 : 12) * u}
                className={`fc-edge${on ? ' selected' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  p.onSelectEdge({ cell: i, k })
                }}
              />
            )
          })
        })}
    </svg>
  )
}

const round = (v: number) => Math.round(v * 10000) / 10000
