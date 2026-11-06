import { cellBoxes } from '../../collage/geometry'
import type { Layout } from '../../collage/types'

/** Vignette d'une disposition : cases sombres sur fond gris, comme dans l'app de référence. */
export function LayoutIcon({ layout, size = 64 }: { layout: Layout; size?: number }) {
  const boxes = cellBoxes(layout.cells, size, size, { spacing: 0.6, margin: 0.45, radius: 0.1 })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="layout-icon">
      <rect width={size} height={size} rx="4" className="layout-icon-bg" />
      {boxes.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(b.radius, 3)} className="layout-icon-cell" stroke="#767676" strokeWidth={1.5} />
      ))}
    </svg>
  )
}
