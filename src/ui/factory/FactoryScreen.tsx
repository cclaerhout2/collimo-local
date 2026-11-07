import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defBBox } from '../../collage/cells'
import { builtinLayouts, buildLayout } from '../../collage/catalog'
import {
  CATALOGUE_FILE_NAME,
  EDGE_KINDS,
  FAMILIES,
  newCustomId,
  removeDraft,
  setBuiltinHidden,
  upsertLayout,
  type CatalogueData,
  type CustomLayout,
  type CustomStatus,
} from '../../collage/catalog/custom'
import {
  allRects,
  applyCut,
  duplicateCell,
  gridTemplate,
  readingOrderOf,
  rectToPoly,
  removeCell,
  removePoint,
  reorder,
  shapeCell,
  splitCell,
  toEditable,
} from '../../collage/factory/ops'
import type { Pt } from '../../collage/path'
import { SHAPE_NAMES, SHAPES, type CellDef, type Decor, type EdgeCut, type EdgeKind, type ShapeName } from '../../collage/shapes'
import type { Layout, LayoutFamily } from '../../collage/types'
import { validateCells, type LayoutIssue } from '../../collage/validate'
import { CatalogueGrantError, saveCatalogue, type CatalogueState } from '../../catalogue/store'
import type { Location, Photo, Services } from '../../google/types'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n/fr'
import { LayoutIcon } from '../editor/LayoutIcon'
import { useHistory } from '../editor/useHistory'
import { cellPoints, FactoryCanvas, type EdgeRef, type Tool } from './FactoryCanvas'
import { FactoryPreview, usePreviewImages } from './FactoryPreview'

interface Props {
  services: Services
  location: Location
  catalogue: CatalogueState
  userEmail: string
  onCatalogueChange: (c: CatalogueState) => void
  onBack: () => void
  onError: (e: unknown) => void
}

interface Draft {
  id: string
  /** Statut enregistré (null = jamais enregistrée). */
  stored: CustomStatus | null
  photos: number
  family: LayoutFamily
  position: 'start' | 'end'
  decor?: Decor[]
  createdAt: string
  createdBy: string
}

const COUNTS = Array.from({ length: 20 }, (_, i) => i + 1)

function metaOf(l: CustomLayout): Draft {
  return { id: l.id, stored: l.status, photos: l.photos, family: l.family, position: l.position, decor: l.decor, createdAt: l.createdAt, createdBy: l.createdBy }
}

function asLayout(l: CustomLayout): Layout | null {
  try {
    return buildLayout(l)
  } catch {
    return null
  }
}

export function FactoryScreen({ services, location, catalogue, userEmail, onCatalogueChange, onBack, onError }: Props) {
  const { t, lang } = useI18n()
  const [count, setCount] = useState(4)
  const [draft, setDraft] = useState<{ meta: Draft; cells: CellDef[] } | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  /** Enregistrement en attente de l'autorisation sur le fichier du catalogue. */
  const [grant, setGrant] = useState<{ change: (c: CatalogueData) => CatalogueData; resolve: (ok: boolean) => void } | null>(null)
  const [photos, setPhotos] = useState<Photo[] | null>(null)

  useEffect(() => {
    let alive = true
    services.drive
      .listPhotos(location.folder, location.drive.id)
      .then((p) => alive && setPhotos(p))
      .catch(() => alive && setPhotos([]))
    return () => {
      alive = false
    }
  }, [services, location])
  const images = usePreviewImages(photos)

  const data = catalogue.data
  const mine = data.layouts.filter((l) => l.photos === count)
  const builtins = useMemo(() => builtinLayouts().filter((l) => l.photos === count), [count])
  const hidden = new Set(data.hiddenBuiltins)

  /** Enregistre une modification du catalogue ; demande l'autorisation sur le fichier si besoin. */
  const commit = useCallback(
    async (change: (c: CatalogueData) => CatalogueData): Promise<boolean> => {
      setSaving(true)
      setNotice(null)
      try {
        const next = await saveCatalogue(services.drive, catalogue, change, userEmail)
        onCatalogueChange(next)
        setNotice('factory.saved')
        return true
      } catch (e) {
        if (e instanceof CatalogueGrantError) return new Promise<boolean>((resolve) => setGrant({ change, resolve }))
        onError(e)
        return false
      } finally {
        setSaving(false)
      }
    },
    [services, catalogue, userEmail, onCatalogueChange, onError],
  )

  async function authorize() {
    const pending = grant
    if (!pending) return
    const picked = await services.picker.pickFile({ id: catalogue.drive.id, name: catalogue.drive.name }, lang, t('factory.grant.title'), 'application/json')
    if (!picked) return
    setGrant(null)
    pending.resolve(await commit(pending.change))
  }

  function cancelGrant() {
    grant?.resolve(false)
    setGrant(null)
  }

  function openEditor(meta: Draft, cells: CellDef[]) {
    setNotice(null)
    setDraft({ meta, cells })
  }

  function newDraft(cells: CellDef[], from?: { family: LayoutFamily; decor?: Decor[] }) {
    const now = new Date().toISOString()
    openEditor(
      { id: newCustomId(), stored: null, photos: count, family: from?.family ?? (allRects(cells) ? 'grille' : 'mixte'), position: 'end', decor: from?.decor, createdAt: now, createdBy: userEmail },
      cells,
    )
  }

  if (draft) {
    return (
      <LayoutEditor
        key={draft.meta.id}
        initial={draft}
        images={images}
        saving={saving}
        notice={notice}
        onClose={() => setDraft(null)}
        onSave={async (meta, cells, status) => {
          const now = new Date().toISOString()
          const layout: CustomLayout = {
            id: meta.id,
            photos: meta.photos,
            family: meta.family,
            geo: cells,
            ...(meta.decor?.length ? { decor: meta.decor } : {}),
            status,
            position: meta.position,
            createdAt: meta.createdAt,
            createdBy: meta.createdBy,
            updatedAt: now,
            updatedBy: userEmail,
          }
          const ok = await commit((c) => upsertLayout(c, layout))
          if (ok) setDraft((d) => (d ? { meta: { ...d.meta, stored: status }, cells } : d))
          return ok
        }}
        grant={grant ? <GrantSheet onPick={() => void authorize()} onCancel={cancelGrant} /> : null}
      />
    )
  }

  const statusBadge = (s: CustomStatus) => <span className={`badge status-${s}`}>{t(`factory.status.${s}`)}</span>

  return (
    <main className="screen factory">
      <div className="factory-head">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ‹ {t('factory.back')}
        </button>
        <h1>{t('factory.title')}</h1>
      </div>
      <p className="muted">{t('factory.intro', { drive: catalogue.drive.name })}</p>
      {data.updatedAt && (
        <p className="muted small">
          {t('factory.updated', { date: new Date(data.updatedAt).toLocaleString(lang), user: data.updatedBy ?? '' })}
          {catalogue.file?.webViewLink && (
            <>
              {' · '}
              <a href={catalogue.file.webViewLink} target="_blank" rel="noreferrer">
                {t('factory.history')}
              </a>
            </>
          )}
        </p>
      )}
      {catalogue.rejected > 0 && <div className="banner banner-error">{t('factory.rejected', { count: catalogue.rejected })}</div>}
      {notice && <div className="banner banner-info" role="status">{t(notice)}</div>}

      <div className="factory-counts" role="radiogroup" aria-label={t('factory.photos')}>
        {COUNTS.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={n === count} className={`chip${n === count ? ' active' : ''}`} onClick={() => setCount(n)}>
            {n}
          </button>
        ))}
      </div>

      <section>
        <div className="factory-section-head">
          <h2>{t('factory.mine')}</h2>
          <button type="button" className="btn btn-primary" onClick={() => setTemplateOpen(true)}>
            + {t('factory.new')}
          </button>
        </div>
        {mine.length === 0 && <p className="muted">{t('factory.none', { count })}</p>}
        <div className="factory-grid">
          {mine.map((l) => {
            const built = asLayout(l)
            return (
              <article key={l.id} className={`factory-card${l.status === 'hidden' ? ' dim' : ''}`} data-id={l.id}>
                {built ? <LayoutIcon layout={built} size={96} /> : <div className="factory-icon-empty">{l.geo.length}</div>}
                {statusBadge(l.status)}
                <div className="factory-card-actions">
                  <button type="button" className="btn btn-small" onClick={() => openEditor(metaOf(l), structuredClone(l.geo))}>
                    {t('factory.edit')}
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => newDraft(structuredClone(l.geo), l)}>
                    {t('factory.duplicate')}
                  </button>
                  {l.status === 'published' && (
                    <button type="button" className="btn btn-small btn-ghost" disabled={saving} onClick={() => void commit((c) => upsertLayout(c, { ...l, status: 'hidden' }))}>
                      {t('factory.hide')}
                    </button>
                  )}
                  {l.status === 'hidden' && (
                    <button type="button" className="btn btn-small btn-ghost" disabled={saving} onClick={() => void commit((c) => upsertLayout(c, { ...l, status: 'published' }))}>
                      {t('factory.show')}
                    </button>
                  )}
                  {l.status === 'draft' && (
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={saving}
                      onClick={() => {
                        if (confirm(t('factory.deleteConfirm'))) void commit((c) => removeDraft(c, l.id))
                      }}
                    >
                      {t('factory.delete')}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <h2>{t('factory.builtin')}</h2>
        <p className="muted small">{t('factory.hiddenNote')}</p>
        <div className="factory-grid">
          {builtins.map((l) => {
            const off = hidden.has(l.id)
            return (
              <article key={l.id} className={`factory-card${off ? ' dim' : ''}`} data-id={l.id}>
                <LayoutIcon layout={l} size={96} />
                <span className={`badge ${off ? 'status-hidden' : 'status-builtin'}`}>{off ? t('factory.status.hidden') : l.id}</span>
                <div className="factory-card-actions">
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => newDraft(toEditable(l), l)}>
                    {t('factory.duplicate')}
                  </button>
                  <button type="button" className="btn btn-small btn-ghost" disabled={saving} onClick={() => void commit((c) => setBuiltinHidden(c, l.id, !off))}>
                    {off ? t('factory.show') : t('factory.hide')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {templateOpen && (
        <TemplateSheet
          count={count}
          onCancel={() => setTemplateOpen(false)}
          onCreate={(cells) => {
            setTemplateOpen(false)
            newDraft(cells)
          }}
        />
      )}
      {grant && <GrantSheet onPick={() => void authorize()} onCancel={cancelGrant} />}
    </main>
  )
}

/** Grille la plus proche d'un carré pour n photos (colonnes × lignes ≥ n). */
function defaultGrid(n: number): [number, number] {
  const cols = Math.ceil(Math.sqrt(n))
  return [cols, Math.ceil(n / cols)]
}

function TemplateSheet({ count, onCancel, onCreate }: { count: number; onCancel: () => void; onCreate: (cells: CellDef[]) => void }) {
  const { t } = useI18n()
  const [[cols, rows], setGrid] = useState(() => defaultGrid(count))
  const preview = gridTemplate(cols, rows)
  const icon: Layout = { id: 'modele', photos: preview.length, family: 'grille', geo: preview, cells: preview.map(defBBox) }
  return (
    <div className="sheet-backdrop" onPointerDown={onCancel}>
      <div className="sheet" role="dialog" aria-label={t('factory.template.title')} onPointerDown={(e) => e.stopPropagation()}>
        <h2>{t('factory.template.title')}</h2>
        <div className="template-grid">
          <LayoutIcon layout={icon} size={120} />
          <div className="sliders">
            {(['cols', 'rows'] as const).map((k) => (
              <label key={k} className="slider">
                <span className="slider-label">{t(`factory.template.${k}`)}</span>
                <input type="range" min={1} max={6} value={k === 'cols' ? cols : rows} onChange={(e) => setGrid(k === 'cols' ? [Number(e.target.value), rows] : [cols, Number(e.target.value)])} />
                <span className="slider-value">{k === 'cols' ? cols : rows}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="muted small">{t('factory.template.hint')}</p>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => onCreate([])}>
            {t('factory.template.empty')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onCreate(preview)}>
            {t('factory.template.grid')} {cols} × {rows}
          </button>
        </div>
      </div>
    </div>
  )
}

function GrantSheet({ onPick, onCancel }: { onPick: () => void; onCancel: () => void }) {
  const { t } = useI18n()
  return (
    <div className="sheet-backdrop" onPointerDown={onCancel}>
      <div className="sheet" role="dialog" aria-label={t('factory.grant.title')} onPointerDown={(e) => e.stopPropagation()}>
        <h2>{t('factory.grant.title')}</h2>
        <p>{t('factory.grant.text', { file: CATALOGUE_FILE_NAME })}</p>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('factory.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onPick}>
            {t('factory.grant.button')}
          </button>
        </div>
      </div>
    </div>
  )
}

function issueText(t: ReturnType<typeof useI18n>['t'], i: LayoutIssue): string {
  switch (i.code) {
    case 'count':
      return t('factory.issue.count', { got: i.got, expected: i.expected })
    case 'outside':
      return t('factory.issue.outside', { cell: i.cell + 1 })
    case 'overlap':
      return t('factory.issue.overlap', { a: i.a + 1, b: i.b + 1 })
    case 'tiny':
      return t('factory.issue.tiny', { cell: i.cell + 1 })
    default:
      return t('factory.issue.empty')
  }
}

/** Petite icône d'une forme de la bibliothèque. */
function ShapeIcon({ name }: { name: ShapeName }) {
  return (
    <svg viewBox="0 0 1 1" width="28" height="28" aria-hidden="true">
      <path d={SHAPES[name]} className="shape-icon" />
    </svg>
  )
}

interface EditorProps {
  initial: { meta: Draft; cells: CellDef[] }
  images: ReturnType<typeof usePreviewImages>
  saving: boolean
  notice: MessageKey | null
  grant: ReactNode
  onClose: () => void
  onSave: (meta: Draft, cells: CellDef[], status: CustomStatus) => Promise<boolean>
}

function LayoutEditor({ initial, images, saving, notice, grant, onClose, onSave }: EditorProps) {
  const { t } = useI18n()
  const hist = useHistory(() => initial.cells)
  const cells = hist.value
  const [meta, setMeta] = useState(initial.meta)
  const [savedCells, setSavedCells] = useState(initial.cells)
  const [savedMeta, setSavedMeta] = useState(initial.meta)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<number | null>(null)
  const [point, setPoint] = useState<number | null>(null)
  const [edge, setEdge] = useState<EdgeRef | null>(null)
  const [orderSeq, setOrderSeq] = useState<number[]>([])
  const [shapesOpen, setShapesOpen] = useState(false)
  const [cutDraft, setCutDraft] = useState<{ amp: number; n: number }>({ amp: 0.05, n: 3 })

  // Vérifications et aperçu suivent les gestes avec un temps de retard : le glissé reste fluide.
  const settled = useDeferredValue(cells)
  const issues = useMemo(() => validateCells(settled, meta.photos), [settled, meta.photos])
  const dirty = cells !== savedCells || JSON.stringify(meta) !== JSON.stringify(savedMeta)
  const published = meta.stored === 'published' || meta.stored === 'hidden'
  const sel = selected !== null ? cells[selected] : null

  const { set, undo, redo } = hist
  const change = (next: CellDef[]) => set(next)

  // L'éditeur s'ouvre en haut de la page (la bibliothèque a pu être défilée).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Raccourcis : annuler / rétablir, supprimer la case ou le point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
        e.preventDefault()
        if (point !== null) {
          set((c) => removePoint(c, selected, point))
          setPoint(null)
        } else {
          set((c) => removeCell(c, selected))
          setSelected(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, selected, point, set])

  function add(cell: CellDef) {
    set((c) => [...c, cell])
    setSelected(cells.length)
    setTool('select')
  }

  function selectedCut(): EdgeCut | null {
    if (!edge) return null
    const c = cells[edge.cell]
    return c?.kind === 'poly' ? (c.cuts?.[edge.k] ?? null) : null
  }

  function setCut(kind: EdgeKind, opts = cutDraft) {
    if (!edge) return
    const c = cells[edge.cell]
    const pts = c && cellPoints(c)
    if (!pts) return
    const a = pts[edge.k]
    const b = pts[(edge.k + 1) % pts.length]
    const cut: EdgeCut | null = kind === 'line' ? null : { kind, amp: opts.amp, n: opts.n, seed: 7 }
    const next = applyCut(cells, edge.cell, edge.k, cut)
    change(next)
    // Le côté a pu être découpé : on resélectionne le morceau qui commence au même point.
    const np = cellPoints(next[edge.cell])
    if (np) {
      const k = np.findIndex((q: Pt) => Math.abs(q[0] - a[0]) < 1e-6 && Math.abs(q[1] - a[1]) < 1e-6)
      const k2 = np.findIndex((q: Pt) => Math.abs(q[0] - b[0]) < 1e-6 && Math.abs(q[1] - b[1]) < 1e-6)
      setEdge({ cell: edge.cell, k: k >= 0 ? k : k2 >= 0 ? (k2 - 1 + np.length) % np.length : edge.k })
    }
  }

  function orderClick(i: number) {
    if (orderSeq.includes(i)) return
    const seq = [...orderSeq, i]
    if (seq.length === cells.length) {
      change(reorder(cells, seq))
      setOrderSeq([])
      setTool('select')
    } else setOrderSeq(seq)
  }

  async function save(status: CustomStatus) {
    const ok = await onSave(meta, cells, status)
    if (ok) {
      setSavedCells(cells)
      const m = { ...meta, stored: status }
      setMeta(m)
      setSavedMeta(m)
    }
  }

  const current = selectedCut()

  return (
    <main className="screen factory-editor">
      <div className="editor-bar">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (!dirty || confirm(t('factory.unsaved'))) onClose()
          }}
        >
          ‹ {t('factory.cancel')}
        </button>
        <div className="factory-tools segmented" role="radiogroup" aria-label={t('factory.title')}>
          {(['select', 'cut', 'order'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={tool === k}
              className={tool === k ? 'active' : ''}
              onClick={() => {
                setTool(k)
                setOrderSeq([])
                setEdge(null)
              }}
            >
              {t(`factory.tool.${k}`)}
            </button>
          ))}
        </div>
        <div className="history-buttons">
          <button type="button" className="round-button small" aria-label={t('factory.undo')} title={t('factory.undo')} disabled={!hist.canUndo} onClick={hist.undo}>
            ↶
          </button>
          <button type="button" className="round-button small" aria-label={t('factory.redo')} title={t('factory.redo')} disabled={!hist.canRedo} onClick={hist.redo}>
            ↷
          </button>
        </div>
      </div>

      <div className="factory-body">
        <div className="factory-stage">
          <FactoryCanvas
            cells={cells}
            decor={meta.decor}
            tool={tool}
            selected={selected}
            point={point}
            edge={edge}
            orderSeq={orderSeq}
            onChange={change}
            onSelect={setSelected}
            onSelectPoint={setPoint}
            onSelectEdge={setEdge}
            onOrderClick={orderClick}
          />
        </div>

        <aside className="factory-side">
          {tool === 'select' && (
            <section className="factory-panel">
              <div className="factory-add">
                <button type="button" className="btn btn-small" onClick={() => add({ kind: 'rect', x: 0.35, y: 0.35, w: 0.3, h: 0.3 })}>
                  + {t('factory.add.rect')}
                </button>
                <button type="button" className="btn btn-small" onClick={() => add({ kind: 'poly', points: [[0.5, 0.3], [0.7, 0.66], [0.3, 0.66]] })}>
                  + {t('factory.add.triangle')}
                </button>
                <button type="button" className="btn btn-small" aria-expanded={shapesOpen} onClick={() => setShapesOpen((v) => !v)}>
                  + {t('factory.add.shape')}
                </button>
              </div>
              {shapesOpen && (
                <div className="shape-library" role="listbox" aria-label={t('factory.add.shape')}>
                  {SHAPE_NAMES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="shape-option"
                      title={s}
                      onClick={() => {
                        if (sel?.kind === 'shape') set((c) => c.map((q, k) => (k === selected ? { ...sel, shape: s } : q)))
                        else add(shapeCell(s))
                        setShapesOpen(false)
                      }}
                    >
                      <ShapeIcon name={s} />
                    </button>
                  ))}
                </div>
              )}
              {sel ? (
                <div className="factory-cell-tools">
                  <div className="factory-add">
                    {(sel.kind === 'rect' || sel.kind === 'poly') && (
                      <>
                        <button type="button" className="btn btn-small" onClick={() => set((c) => splitCell(c, selected!, 'v'))}>
                          {t('factory.cell.splitV')}
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => set((c) => splitCell(c, selected!, 'h'))}>
                          {t('factory.cell.splitH')}
                        </button>
                      </>
                    )}
                    {sel.kind === 'rect' && (
                      <button type="button" className="btn btn-small" onClick={() => set((c) => c.map((q, k) => (k === selected && q.kind === 'rect' ? rectToPoly(q) : q)))}>
                        {t('factory.cell.toPoly')}
                      </button>
                    )}
                    <button type="button" className="btn btn-small" onClick={() => set((c) => duplicateCell(c, selected!))}>
                      {t('factory.cell.duplicate')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        set((c) => removeCell(c, selected!))
                        setSelected(null)
                      }}
                    >
                      {t('factory.cell.delete')}
                    </button>
                    {sel.kind === 'poly' && point !== null && sel.points.length > 3 && (
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => {
                          set((c) => removePoint(c, selected!, point))
                          setPoint(null)
                        }}
                      >
                        {t('factory.cell.deletePoint')}
                      </button>
                    )}
                  </div>
                  {sel.kind === 'shape' && (
                    <div className="sliders">
                      <label className="slider">
                        <span className="slider-label">{t('factory.cell.rotate')}</span>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={sel.rotate ?? 0}
                          onChange={(e) => set((c) => c.map((q, k) => (k === selected ? { ...sel, rotate: Number(e.target.value) } : q)))}
                        />
                        <span className="slider-value">{sel.rotate ?? 0}°</span>
                      </label>
                      <label className="check">
                        <input type="checkbox" checked={!!sel.stretch} onChange={(e) => set((c) => c.map((q, k) => (k === selected ? { ...sel, stretch: e.target.checked || undefined } : q)))} />
                        {t('factory.cell.stretch')}
                      </label>
                    </div>
                  )}
                  <label className="check">
                    <input type="checkbox" checked={!!sel.over} onChange={(e) => set((c) => c.map((q, k) => (k === selected ? { ...q, over: e.target.checked || undefined } : q)))} />
                    {t('factory.cell.over')}
                  </label>
                </div>
              ) : (
                <p className="muted small">{t('factory.cell.none')}</p>
              )}
            </section>
          )}

          {tool === 'cut' && (
            <section className="factory-panel">
              <p className="muted small">{t('factory.cut.hint')}</p>
              <div className="factory-add" role="radiogroup" aria-label={t('factory.tool.cut')}>
                {EDGE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={(current?.kind ?? 'line') === k}
                    disabled={!edge}
                    className={`btn btn-small${edge && (current?.kind ?? 'line') === k ? ' btn-primary' : ''}`}
                    onClick={() => setCut(k)}
                  >
                    {t(`factory.cut.${k}`)}
                  </button>
                ))}
              </div>
              {current && (
                <div className="sliders">
                  <label className="slider">
                    <span className="slider-label">{t('factory.cut.amp')}</span>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={Math.round((current.amp ?? 0.05) * 100)}
                      onChange={(e) => {
                        const o = { ...cutDraft, amp: Number(e.target.value) / 100 }
                        setCutDraft(o)
                        setCut(current.kind, o)
                      }}
                    />
                    <span className="slider-value">{Math.round((current.amp ?? 0.05) * 100)}</span>
                  </label>
                  {current.kind !== 'curve' && current.kind !== 'lightning' && (
                    <label className="slider">
                      <span className="slider-label">{t('factory.cut.n')}</span>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={current.n ?? 3}
                        onChange={(e) => {
                          const o = { ...cutDraft, n: Number(e.target.value) }
                          setCutDraft(o)
                          setCut(current.kind, o)
                        }}
                      />
                      <span className="slider-value">{current.n ?? 3}</span>
                    </label>
                  )}
                </div>
              )}
            </section>
          )}

          {tool === 'order' && (
            <section className="factory-panel">
              <p className="muted small">{t('factory.order.hint')}</p>
              <p>{t('factory.order.progress', { done: orderSeq.length, total: cells.length })}</p>
              <div className="factory-add">
                <button type="button" className="btn btn-small" onClick={() => change(reorder(cells, readingOrderOf(cells)))}>
                  {t('factory.order.auto')}
                </button>
                <button type="button" className="btn btn-small btn-ghost" disabled={!orderSeq.length} onClick={() => setOrderSeq([])}>
                  {t('factory.order.restart')}
                </button>
              </div>
            </section>
          )}

          <section className="factory-panel">
            <label className="field">
              <span>{t('factory.photos')}</span>
              <select value={meta.photos} disabled={published} onChange={(e) => setMeta({ ...meta, photos: Number(e.target.value) })}>
                {COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('factory.family')}</span>
              <select value={meta.family} onChange={(e) => setMeta({ ...meta, family: e.target.value as LayoutFamily })}>
                {FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`family.${f}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('factory.position')}</span>
              <select value={meta.position} onChange={(e) => setMeta({ ...meta, position: e.target.value as 'start' | 'end' })}>
                <option value="start">{t('factory.position.start')}</option>
                <option value="end">{t('factory.position.end')}</option>
              </select>
            </label>
          </section>

          <section className="factory-panel">
            <h3>{t('factory.checks')}</h3>
            {issues.length === 0 ? (
              <p className="check-ok">✓ {t('factory.checks.ok')}</p>
            ) : (
              <ul className="issues">
                {issues.map((i, k) => (
                  <li key={k}>{issueText(t, i)}</li>
                ))}
              </ul>
            )}
          </section>

          <FactoryPreview cells={settled} decor={meta.decor} images={images} />

          <section className="factory-panel factory-save">
            {notice && !dirty && <p className="check-ok" role="status">{t(notice)}</p>}
            {published && <p className="muted small">{t('factory.publishedNote')}</p>}
            {!published && (
              <button type="button" className="btn" disabled={saving || !dirty} onClick={() => void save('draft')}>
                {saving ? t('factory.saving') : t('factory.saveDraft')}
              </button>
            )}
            <button type="button" className="btn btn-primary" disabled={saving || issues.length > 0 || (published && !dirty)} onClick={() => void save(meta.stored === 'hidden' ? 'hidden' : 'published')}>
              {published ? t('factory.publishChanges') : t('factory.publish')}
            </button>
          </section>
        </aside>
      </div>
      {grant}
    </main>
  )
}
