/**
 * Statistiques d'usage (admins de l'usine) : assistant d'activation du relais Apps Script tant qu'il
 * n'est pas configuré, puis indicateurs de la période choisie, graphiques par semaine, dispositions
 * les plus utilisées, et réglages du relais.
 */
import { useEffect, useMemo, useState } from 'react'
import relayTemplate from '../../tools/stats/Code.gs?raw'
import type { CatalogueData, StatsRelayConfig } from '../collage/catalog/custom'
import { CatalogueGrantError, saveCatalogue, type CatalogueState } from '../catalogue/store'
import { layoutById } from '../collage/catalog'
import { config } from '../config'
import { DriveApiError } from '../google/drive'
import type { Services } from '../google/types'
import { useI18n } from '../i18n'
import { allowedDomains } from '../lib/errors'
import { LayoutIcon } from './editor/LayoutIcon'
import { fillRelayTemplate, isRelayUrl, parseStatsCsv, RelayError, summarize, type StatsRow } from '../lib/stats'

/** Propriétés de l'écran des statistiques. */
interface Props {
  services: Services
  /** Catalogue de l'usine (contient la configuration du relais). */
  catalogue: CatalogueState
  /** Adresse de l'admin connecté (auteur de la modification du catalogue). */
  userEmail: string
  /** Catalogue enregistré : l'app le retient et le diffuse. */
  onCatalogueChange: (c: CatalogueState) => void
  /** Retour à la galerie. */
  onBack: () => void
  /** Signale une erreur inattendue. */
  onError: (e: unknown) => void
}

/** Périodes proposées, en jours. */
const PERIODS = [30, 90, 365] as const

/**
 * Écran des statistiques.
 * @returns l'assistant d'activation, ou le tableau de bord
 */
export function StatsScreen({ services, catalogue, userEmail, onCatalogueChange, onBack, onError }: Props) {
  const { t, lang } = useI18n()
  const relay = catalogue.data.statsRelay
  const [setup, setSetup] = useState(!relay)

  /**
   * Enregistre une modification du catalogue ; si Collimo n'a pas encore le droit de modifier le
   * fichier (créé par un autre admin), le sélecteur de Google le lui fait choisir, puis on recommence.
   * @param change - modification
   * @returns `true` si l'enregistrement a réussi
   */
  async function commit(change: (c: CatalogueData) => CatalogueData): Promise<boolean> {
    try {
      onCatalogueChange(await saveCatalogue(services.drive, catalogue, change, userEmail))
      return true
    } catch (e) {
      if (!(e instanceof CatalogueGrantError)) throw e
      const picked = await services.picker.pickFile(
        { id: catalogue.drive.id, name: catalogue.drive.name },
        lang,
        t('factory.grant.title'),
        'application/json',
      )
      if (!picked) return false
      onCatalogueChange(await saveCatalogue(services.drive, catalogue, change, userEmail))
      return true
    }
  }

  return (
    <main className="screen stats-screen">
      <div className="stats-head">
        <button type="button" className="btn btn-ghost btn-small" onClick={onBack}>
          ‹ {t('editor.back')}
        </button>
        <h1>{t('stats.title')}</h1>
      </div>
      {setup || !relay ? (
        <RelaySetup
          services={services}
          current={relay}
          onDone={async (cfg) => {
            if (await commit((c) => ({ ...c, statsRelay: cfg }))) setSetup(false)
          }}
          onCancel={relay ? () => setSetup(false) : undefined}
          onError={onError}
        />
      ) : (
        <Dashboard
          services={services}
          relay={relay}
          catalogue={catalogue.data}
          onReconfigure={() => setSetup(true)}
          onDisable={async () => {
            await commit((c) => ({ ...c, statsRelay: undefined })).catch(onError)
          }}
          onError={onError}
        />
      )}
    </main>
  )
}

/**
 * Assistant d'activation du relais, en quatre étapes.
 * @param props - services, configuration actuelle éventuelle, et rappels
 * @returns l'assistant
 */
function RelaySetup({
  services,
  current,
  onDone,
  onCancel,
  onError,
}: {
  services: Services
  current?: StatsRelayConfig
  onDone: (cfg: StatsRelayConfig) => Promise<void>
  onCancel?: () => void
  onError: (e: unknown) => void
}) {
  const { t } = useI18n()
  const code = useMemo(() => fillRelayTemplate(relayTemplate, config.clientId, allowedDomains(config.allowedDomain)), [])
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(current?.url ?? '')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const valid = isRelayUrl(url)

  /** Copie le code du relais. */
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  /** Teste l'adresse collée, puis enregistre la configuration dans le catalogue. */
  async function activate() {
    setProblem(null)
    setBusy(true)
    try {
      const info = await services.relay.ping(url.trim())
      await onDone({
        url: url.trim(),
        sheetId: info.sheetId,
        sheetUrl: info.sheetUrl,
        version: info.version,
        enabledAt: new Date().toISOString(),
      })
    } catch (e) {
      if (e instanceof RelayError) setProblem(t(`stats.setup.error.${e.code}`))
      else onError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stats-setup">
      <p className="stats-lead">{current ? t('stats.setup.leadUpdate') : t('stats.setup.lead')}</p>

      <section className="stats-step">
        <h2>
          <span className="step-num">1</span> {t('stats.setup.step1')}
        </h2>
        <p className="muted">{t('stats.setup.step1Text')}</p>
        <div className="stats-code-actions">
          <button type="button" className="btn btn-primary btn-small" onClick={() => void copy()}>
            {copied ? t('stats.setup.copied') : t('stats.setup.copy')}
          </button>
          <a className="btn btn-small" href="https://script.google.com/create" target="_blank" rel="noreferrer">
            {t('stats.setup.openScript')} ↗
          </a>
        </div>
        <details className="stats-code">
          <summary>{t('stats.setup.showCode')}</summary>
          <pre>{code}</pre>
        </details>
      </section>

      <section className="stats-step">
        <h2>
          <span className="step-num">2</span> {t('stats.setup.step2')}
        </h2>
        <ol className="stats-list">
          <li>{t('stats.setup.step2a')}</li>
          <li>{t('stats.setup.step2b')}</li>
          <li>
            <strong>{t('stats.setup.step2c')}</strong>
            <ul>
              <li>{t('stats.setup.step2cType')}</li>
              <li>{t('stats.setup.step2cExec')}</li>
              <li>{t('stats.setup.step2cAccess')}</li>
            </ul>
          </li>
          <li>{t('stats.setup.step2d')}</li>
        </ol>
        <p className="muted small">{t('stats.setup.step2Why')}</p>
      </section>

      <section className="stats-step">
        <h2>
          <span className="step-num">3</span> {t('stats.setup.step3')}
        </h2>
        <label className="stats-url">
          <span className="muted">{t('stats.setup.urlLabel')}</span>
          <input
            type="url"
            value={url}
            placeholder="https://script.google.com/macros/s/…/exec"
            onChange={(e) => {
              setUrl(e.target.value)
              setProblem(null)
            }}
          />
        </label>
        {url && !valid && <p className="stats-problem">{t('stats.setup.urlInvalid')}</p>}
        {problem && <p className="stats-problem">{problem}</p>}
        <div className="actions actions-wrap">
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
              {t('export.cancel')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void activate()} disabled={!valid || busy}>
            {busy ? t('stats.setup.testing') : t('stats.setup.activate')}
          </button>
        </div>
      </section>

      <section className="stats-step">
        <h2>
          <span className="step-num">4</span> {t('stats.setup.step4')}
        </h2>
        <p className="muted">{t('stats.setup.step4Text')}</p>
      </section>
    </div>
  )
}

/**
 * Tableau de bord : période, chiffres clés, graphiques, dispositions, relais.
 * @param props - services, relais, catalogue et rappels
 * @returns le tableau de bord
 */
function Dashboard({
  services,
  relay,
  catalogue,
  onReconfigure,
  onDisable,
  onError,
}: {
  services: Services
  relay: StatsRelayConfig
  catalogue: CatalogueData
  onReconfigure: () => void
  onDisable: () => Promise<void>
  onError: (e: unknown) => void
}) {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<StatsRow[] | null>(null)
  const [noAccess, setNoAccess] = useState(false)
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [reload, setReload] = useState(0)
  const [testState, setTestState] = useState<'idle' | 'busy' | 'ok' | string>('idle')
  const [confirmOff, setConfirmOff] = useState(false)

  useEffect(() => {
    let alive = true
    services.drive
      .exportCsv(relay.sheetId)
      .then((csv) => alive && setRows(parseStatsCsv(csv)))
      .catch((e: unknown) => {
        if (!alive) return
        setRows([])
        if (e instanceof DriveApiError && (e.status === 403 || e.status === 404)) setNoAccess(true)
        else onError(e)
      })
    return () => {
      alive = false
    }
  }, [services, relay.sheetId, reload, onError])

  const s = useMemo(() => (rows ? summarize(rows, days) : null), [rows, days])
  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
  const pf = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { style: 'percent', maximumFractionDigits: 0 })
  const df = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' })
  const dtf = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const last = rows?.length ? rows.reduce((a, b) => (b.date > a.date ? b : a)).date : null
  const used = new Set(s?.layouts.map((l) => l.id) ?? [])
  const unusedCustom = catalogue.layouts.filter((l) => l.status === 'published' && !used.has(l.id))

  /** Teste le relais avec le jeton de l'admin. */
  async function test() {
    setTestState('busy')
    try {
      await services.relay.ping(relay.url)
      setTestState('ok')
    } catch (e) {
      setTestState(e instanceof RelayError ? t(`stats.setup.error.${e.code}`) : String(e))
    }
  }

  return (
    <div className="stats-dash">
      <div className="stats-toolbar">
        <div className="segmented" role="group" aria-label={t('stats.period')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" className={days === p ? 'active' : ''} aria-pressed={days === p} onClick={() => setDays(p)}>
              {t(`stats.period.${p}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => {
            setRows(null)
            setReload((n) => n + 1)
          }}
        >
          {t('gallery.refresh')}
        </button>
      </div>

      {noAccess && (
        <div className="banner banner-info">
          <span>{t('stats.noAccess')}</span>
          {relay.sheetUrl && (
            <a className="btn btn-small" href={relay.sheetUrl} target="_blank" rel="noreferrer">
              {t('stats.openSheet')} ↗
            </a>
          )}
        </div>
      )}

      {!s && !noAccess && <div className="spinner" aria-label={t('signin.loading')} />}

      {s && !noAccess && (
        <>
          {rows?.length === 0 && <p className="muted">{t('stats.empty')}</p>}
          <div className="stat-tiles">
            <Tile label={t('stats.kpi.active')} value={nf.format(s.activeUsers)} />
            <Tile label={t('stats.kpi.new')} value={nf.format(s.newUsers)} />
            <Tile label={t('stats.kpi.collages')} value={nf.format(s.collages)} />
            <Tile label={t('stats.kpi.perActive')} value={nf.format(s.collagesPerActive)} />
            <Tile label={t('stats.kpi.photos')} value={nf.format(s.photosPerCollage)} />
            <Tile label={t('stats.kpi.masked')} value={pf.format(s.maskedShare)} hint={t('stats.kpi.maskedHint')} />
          </div>

          <div className="stats-charts">
            <Bars
              title={t('stats.chart.collages')}
              data={s.weeks.map((w) => ({
                label: df.format(w.start),
                value: w.collages,
                tip: t('stats.tip.week', { date: df.format(w.start), n: w.collages }),
              }))}
            />
            <Bars
              title={t('stats.chart.active')}
              data={s.weeks.map((w) => ({
                label: df.format(w.start),
                value: w.activeUsers,
                tip: t('stats.tip.weekUsers', { date: df.format(w.start), n: w.activeUsers }),
              }))}
            />
            <Bars
              title={t('stats.chart.photos')}
              data={s.photoBuckets.map((b) => ({
                label: b.label,
                value: b.count,
                tip: t('stats.tip.bucket', { label: b.label, n: b.count }),
              }))}
              allLabels
            />
          </div>

          <section className="stats-card">
            <h2>{t('stats.layouts')}</h2>
            {s.layouts.length === 0 ? (
              <p className="muted">{t('stats.layoutsEmpty')}</p>
            ) : (
              <ol className="stats-rank">
                {s.layouts.slice(0, 10).map((l) => (
                  <li key={l.id}>
                    <span className="rank-name">
                      {layoutById(l.id) && <LayoutIcon layout={layoutById(l.id)!} size={28} />}
                      <span className="rank-id">{l.id}</span>
                      <span className={`rank-tag${l.source === 'custom' ? ' custom' : ''}`}>
                        {l.source === 'custom' ? t('stats.source.custom') : t('stats.source.builtin')}
                      </span>
                    </span>
                    <span className="rank-bar" aria-hidden="true">
                      <span style={{ width: `${(l.count / s.layouts[0].count) * 100}%` }} />
                    </span>
                    <span className="rank-value">{nf.format(l.count)}</span>
                  </li>
                ))}
              </ol>
            )}
            {unusedCustom.length > 0 && (
              <p className="muted small">{t('stats.unusedCustom', { names: unusedCustom.map((l) => l.id).join(', ') })}</p>
            )}
            {s.errors > 0 && <p className="muted small">{t('stats.errors', { n: s.errors })}</p>}
          </section>
        </>
      )}

      <section className="stats-card stats-relay">
        <h2>{t('stats.relay')}</h2>
        <dl>
          <dt>{t('stats.relay.state')}</dt>
          <dd>{last ? t('stats.relay.last', { date: dtf.format(last) }) : t('stats.relay.none')}</dd>
          <dt>{t('stats.relay.enabled')}</dt>
          <dd>{relay.enabledAt ? dtf.format(new Date(relay.enabledAt)) : '—'}</dd>
          <dt>{t('stats.relay.url')}</dt>
          <dd className="stats-url-value" title={relay.url}>
            {relay.url}
          </dd>
        </dl>
        {testState !== 'idle' && testState !== 'busy' && (
          <p className={testState === 'ok' ? 'stats-ok' : 'stats-problem'}>{testState === 'ok' ? t('stats.relay.testOk') : testState}</p>
        )}
        <div className="actions actions-wrap">
          {relay.sheetUrl && (
            <a className="btn btn-small" href={relay.sheetUrl} target="_blank" rel="noreferrer">
              {t('stats.openSheet')} ↗
            </a>
          )}
          <button type="button" className="btn btn-small" onClick={() => void test()} disabled={testState === 'busy'}>
            {t('stats.relay.test')}
          </button>
          <button type="button" className="btn btn-small" onClick={onReconfigure}>
            {t('stats.relay.change')}
          </button>
          {confirmOff ? (
            <>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmOff(false)}>
                {t('export.cancel')}
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => void onDisable()}>
                {t('stats.relay.disableConfirm')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmOff(true)}>
              {t('stats.relay.disable')}
            </button>
          )}
        </div>
        <p className="muted small">{t('stats.relay.share')}</p>
      </section>
    </div>
  )
}

/**
 * Chiffre clé.
 * @param props - libellé, valeur affichée, précision éventuelle
 * @returns la tuile
 */
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-tile" title={hint}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

/**
 * Histogramme d'une seule série (couleur d'accent), avec infobulle au survol et tableau pour les lecteurs d'écran.
 * @param props - titre, barres, et `allLabels` pour afficher toutes les étiquettes de l'axe
 * @returns le graphique
 */
function Bars({
  title,
  data,
  allLabels = false,
}: {
  title: string
  data: { label: string; value: number; tip: string }[]
  allLabels?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 560
  const H = 240
  const pad = { l: 44, r: 8, t: 14, b: 34 }
  const max = Math.max(1, ...data.map((d) => d.value))
  const nice = niceMax(max)
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const every = allLabels ? 1 : Math.max(1, Math.ceil(data.length / 6))
  return (
    <figure className="stats-card stats-chart">
      <figcaption>{title}</figcaption>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onPointerLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line className="chart-grid" x1={pad.l} x2={W - pad.r} y1={y(nice * f)} y2={y(nice * f)} />
              <text className="chart-axis" x={pad.l - 8} y={y(nice * f) + 6} textAnchor="end">
                {Math.round(nice * f)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + i * bw + bw * 0.18
            const w = Math.max(2, bw * 0.64)
            const top = y(d.value)
            const h = H - pad.b - top
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect className="chart-hit" x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} />
                {d.value > 0 && <path className={`chart-bar${hover === i ? ' hover' : ''}`} d={barPath(x, top, w, h)} />}
                {i % every === 0 && (
                  <text className="chart-axis" x={pad.l + i * bw + bw / 2} y={H - 10} textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div className="chart-tip" style={{ left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%` }}>
            {data[hover].tip}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/**
 * Haut d'axe « rond » au-dessus d'un maximum (1, 2, 5, 10, 20, 50…).
 * @param max - plus grande valeur
 * @returns la valeur du haut de l'axe
 */
export function niceMax(max: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, max)))
  for (const k of [1, 2, 5, 10]) if (k * p >= max) return k * p
  return 10 * p
}

/**
 * Barre aux coins du haut arrondis (4 px), posée sur l'axe.
 * @param x - gauche
 * @param top - haut
 * @param w - largeur
 * @param h - hauteur
 * @returns le chemin SVG
 */
function barPath(x: number, top: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`
}
