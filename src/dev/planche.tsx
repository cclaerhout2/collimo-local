/**
 * Planche de recette : toutes les dispositions d'un nombre de photos, dans l'ordre du catalogue,
 * dessinées comme les icônes de l'app de référence pour les comparer aux captures.
 * Ouvrir /planche.html?n=5 (ou sans paramètre pour tout afficher). Page de développement uniquement.
 */
import { createRoot } from 'react-dom/client'
import { layoutsFor } from '../collage/catalog'
import { cellGeometry, decorGeometry } from '../collage/cells'
import type { Layout } from '../collage/types'

function Icon({ layout }: { layout: Layout }) {
  const S = 120
  const B = { spacing: 0.55, margin: 0.4, radius: 0 }
  const cells = cellGeometry(layout, S, S, B)
  const gap = 0.55 * 0.06 * S
  return (
    <figure style={{ margin: 0, textAlign: 'center' }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: 'block' }}>
        <rect width={S} height={S} fill="#767676" />
        {cells.map(({ box: b, path, evenodd, shaped, noGap }, i) => (
          <g key={i}>
            {path ? (
              <path d={path} fillRule={evenodd ? 'evenodd' : 'nonzero'} fill="#262626" stroke="#767676" strokeWidth={shaped || noGap ? 0 : gap} strokeLinejoin="round" />
            ) : (
              <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#262626" stroke="#767676" strokeWidth={1.5} />
            )}
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} fontSize="11" textAnchor="middle" fill="#9a9a9a">
              {i + 1}
            </text>
          </g>
        ))}
        {decorGeometry(layout, S, S, B).map((d, i) => (
          <path key={`d${i}`} d={d.d} fillRule={d.evenodd ? 'evenodd' : 'nonzero'} fill={d.fill === 'ink' ? '#141414' : d.fill === 'white' ? '#fff' : '#767676'} />
        ))}
      </svg>
      <figcaption style={{ font: '12px system-ui', color: '#ddd', marginTop: 4 }}>{layout.id}</figcaption>
    </figure>
  )
}

function Planche() {
  const n = Number(new URLSearchParams(location.search).get('n'))
  const counts = n >= 1 && n <= 20 ? [n] : Array.from({ length: 20 }, (_, i) => i + 1)
  return (
    <div style={{ background: '#262626', minHeight: '100vh', padding: 24, font: '14px system-ui', color: '#eee' }}>
      {counts.map((c) => (
        <section key={c} style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 12px' }}>
            {c} photo(s) — {layoutsFor(c).length} disposition(s)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 120px)', gap: 24 }}>
            {layoutsFor(c).map((l) => (
              <Icon key={l.id} layout={l} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Planche />)
