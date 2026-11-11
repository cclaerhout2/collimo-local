import { describe, expect, it, vi } from 'vitest'
import { fillRelayTemplate, isRelayUrl, parseCsv, parseStatsCsv, pingRelay, RelayError, RELAY_VERSION, summarize, weekStart } from './stats'

const HEAD =
  'date,utilisateur,evenement,appareil,photos,disposition,source_disposition,format,taille,ratio,zones_masquees,textes,stickers,filtre,serie,duree_ms,erreur'

describe('relais', () => {
  it('reconnaît les adresses d’application web Apps Script', () => {
    expect(isRelayUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/exec')).toBe(true)
    expect(isRelayUrl('https://script.google.com/a/macros/carrefour.com/s/AKfycbx1234567890abcdefghij/exec')).toBe(true)
    expect(isRelayUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/dev')).toBe(false)
    expect(isRelayUrl('https://exemple.com/macros/s/AKfycbx1234567890abcdefghij/exec')).toBe(false)
  })

  it('remplit le modèle du script', () => {
    const code = fillRelayTemplate(
      "var A = '__CLIENT_ID__';\nvar D = __DOMAINS__;\nvar V = __VERSION__;",
      '12-ab.apps.googleusercontent.com',
      ['carrefour.com'],
    )
    expect(code).toBe(`var A = '12-ab.apps.googleusercontent.com';\nvar D = ["carrefour.com"];\nvar V = ${RELAY_VERSION};`)
  })

  it('teste le relais et distingue les causes d’échec', async () => {
    const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch
    await expect(
      pingRelay('u', 't', reply({ ok: true, app: 'collimo-stats', version: RELAY_VERSION, sheetId: 's', sheetUrl: 'https://x' })),
    ).resolves.toEqual({ version: RELAY_VERSION, sheetId: 's', sheetUrl: 'https://x' })
    await expect(pingRelay('u', 't', reply({ ok: false, error: 'domain-refused' }))).rejects.toMatchObject({ code: 'refused' })
    await expect(pingRelay('u', 't', reply({ ok: true, app: 'collimo-stats', version: 0 }))).rejects.toMatchObject({ code: 'version' })
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(pingRelay('u', 't', down)).rejects.toBeInstanceOf(RelayError)
  })
})

describe('lecture de la Sheet', () => {
  it('découpe un CSV avec guillemets et retours à la ligne', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,"2\n3",4')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['1', '2\n3', '4'],
    ])
  })

  it('relit les lignes et ignore celles sans date ou sans utilisateur', () => {
    const rows = parseStatsCsv(
      `${HEAD}\n2026-11-10T10:00:00.000Z,u1,collage,desktop,6,p06-01,builtin,jpeg,hd,1:1,2,1,0,,0,1500,\nxx,u2,collage\n2026-11-10T10:00:00.000Z,,signin`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user: 'u1', event: 'collage', photos: 6, layout: 'p06-01', masks: 2, durationMs: 1500 })
  })
})

describe('indicateurs', () => {
  const now = new Date('2026-11-11T12:00:00Z')
  const csv = [
    HEAD,
    // u1 : ancien utilisateur, 2 collages dans la période dont un masqué
    '2026-06-01T10:00:00Z,u1,signin,desktop,,,,,,,,,,,,,',
    '2026-11-02T10:00:00Z,u1,collage,desktop,3,p03-01,builtin,jpeg,hd,1:1,1,0,0,,0,1000,',
    '2026-11-09T10:00:00Z,u1,collage,desktop,12,u-abc,custom,jpeg,hd,1:1,0,0,0,,3,2000,',
    // u2 : nouveau, un collage et un échec
    '2026-11-10T10:00:00Z,u2,collage,mobile,3,p03-01,builtin,png,standard,9:16,0,0,0,,0,800,',
    '2026-11-10T11:00:00Z,u2,export_error,mobile,,,,,,,,,,,,,error.quota',
    // hors période
    '2026-08-01T10:00:00Z,u3,collage,desktop,5,p05-01,builtin,jpeg,hd,1:1,0,0,0,,0,900,',
  ].join('\n')
  const s = summarize(parseStatsCsv(csv), 30, now)

  it('compte actifs, nouveaux et collages de la période', () => {
    expect(s.activeUsers).toBe(2)
    expect(s.newUsers).toBe(1)
    expect(s.collages).toBe(3)
    expect(s.collagesPerActive).toBe(1.5)
    expect(s.photosPerCollage).toBe(6)
    expect(s.maskedShare).toBeCloseTo(1 / 3)
    expect(s.errors).toBe(1)
  })

  it('répartit les photos par collage et classe les dispositions', () => {
    expect(s.photoBuckets.find((b) => b.label === '2–4')?.count).toBe(2)
    expect(s.photoBuckets.find((b) => b.label === '10–14')?.count).toBe(1)
    expect(s.layouts[0]).toEqual({ id: 'p03-01', source: 'builtin', count: 2 })
  })

  it('compte par semaine, semaines vides comprises, et commence la semaine un lundi', () => {
    expect(weekStart(new Date(2026, 10, 11)).getDay()).toBe(1)
    expect(s.weeks.length).toBeGreaterThanOrEqual(5)
    expect(s.weeks.reduce((n, w) => n + w.collages, 0)).toBe(3)
    expect(s.weeks.some((w) => w.collages === 0)).toBe(true)
  })
})
