import { cellGeometry, decorGeometry, gapPx } from '../../collage/cells'
import type { Layout } from '../../collage/types'

const ICON_BORDERS = { spacing: 0.6, margin: 0.45, radius: 0.1 }

/** Vignette d'une disposition : cases sombres sur fond gris, comme dans l'app de référence. */
export function LayoutIcon({ layout, size = 64 }: { layout: Layout; size?: number }) {
  const cells = cellGeometry(layout, size, size, ICON_BORDERS)
  const gap = gapPx(size, size, ICON_BORDERS)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="layout-icon">
      <rect width={size} height={size} rx="4" className="layout-icon-bg" />
      {cells.map((c, i) =>
        c.path ? (
          <path key={i} d={c.path} fillRule={c.evenodd ? 'evenodd' : 'nonzero'} className="layout-icon-cell" stroke="#767676" strokeWidth={c.shaped ? 0 : gap} strokeLinejoin="round" />
        ) : (
          <rect key={i} x={c.box.x} y={c.box.y} width={c.box.w} height={c.box.h} rx={Math.min(c.box.radius, 3)} className="layout-icon-cell" stroke="#767676" strokeWidth={1.5} />
        ),
      )}
      {decorGeometry(layout, size, size, ICON_BORDERS).map((d, i) => (
        <path key={`d${i}`} d={d.d} fillRule={d.evenodd ? 'evenodd' : 'nonzero'} fill={d.fill === 'ink' ? '#141414' : d.fill === 'white' ? '#ffffff' : '#767676'} />
      ))}
    </svg>
  )
}
