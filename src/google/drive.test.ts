import { describe, expect, it } from 'vitest'
import {
  collimoFolderQuery,
  createDriveClient,
  DriveApiError,
  FOLDER_MIME,
  listScope,
  photosQuery,
  quote,
  sizedThumbnail,
  toPhoto,
} from './drive'
import { SessionExpiredError } from './types'

interface Call {
  url: URL
  init: RequestInit
}

function fakeFetch(responder: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: new URL(String(input)), init }
    calls.push(call)
    const { status = 200, body = {} } = responder(call)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { impl, calls }
}

describe('requêtes Drive', () => {
  it('échappe les apostrophes', () => {
    expect(quote("l'été")).toBe("'l\\'été'")
  })

  it('ne cherche que les images du dossier, hors corbeille', () => {
    expect(photosQuery('abc')).toBe("'abc' in parents and mimeType contains 'image/' and trashed = false")
  })

  it('cherche le dossier Collimo par nom, type et parent', () => {
    expect(collimoFolderQuery('abc')).toBe(`name = 'Collimo' and mimeType = '${FOLDER_MIME}' and 'abc' in parents and trashed = false`)
  })

  it('active les Drive partagés et vise le bon Drive', () => {
    expect(listScope(null)).toMatchObject({ supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'user' })
    expect(listScope('d1')).toMatchObject({ corpora: 'drive', driveId: 'd1', supportsAllDrives: 'true' })
  })
})

describe('miniatures et photos', () => {
  it('agrandit la miniature Drive', () => {
    expect(sizedThumbnail('https://lh3.example/abc=s220')).toBe('https://lh3.example/abc=s480')
    expect(sizedThumbnail('https://lh3.example/abc=s220-c', 800)).toBe('https://lh3.example/abc=s800')
    expect(sizedThumbnail(undefined)).toBeUndefined()
  })

  it('inverse largeur et hauteur quand la photo est pivotée d’un quart de tour', () => {
    const p = toPhoto({ id: '1', name: 'a.jpg', mimeType: 'image/jpeg', imageMediaMetadata: { width: 4000, height: 3000, rotation: 1 } })
    expect([p.width, p.height]).toEqual([3000, 4000])
    expect(p.supported).toBe(true)
  })

  it('accepte les HEIC des iPhone, refuse les formats inconnus', () => {
    expect(toPhoto({ id: '1', name: 'a.heic', mimeType: 'image/heic' }).supported).toBe(true)
    expect(toPhoto({ id: '2', name: 'a.tif', mimeType: 'image/tiff' }).supported).toBe(false)
  })
})

describe('client Drive', () => {
  it('envoie le jeton et suit la pagination', async () => {
    const { impl, calls } = fakeFetch(({ url }) =>
      url.searchParams.get('pageToken')
        ? { body: { files: [{ id: 'p2', name: 'b.jpg', mimeType: 'image/png' }] } }
        : { body: { files: [{ id: 'p1', name: 'a.jpg', mimeType: 'image/jpeg' }], nextPageToken: 'next' } },
    )
    const drive = createDriveClient(() => 'TOKEN', impl)
    const photos = await drive.listPhotos({ id: 'folder' }, 'shared1')
    expect(photos.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(calls).toHaveLength(2)
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer TOKEN')
    expect(calls[0].url.searchParams.get('driveId')).toBe('shared1')
  })

  it('réutilise le dossier Collimo existant', async () => {
    const { impl, calls } = fakeFetch(() => ({ body: { files: [{ id: 'existing' }] } }))
    const drive = createDriveClient(() => 'T', impl)
    expect(await drive.ensureCollimoFolder('parent')).toBe('existing')
    expect(calls.every((c) => (c.init.method ?? 'GET') === 'GET')).toBe(true)
  })

  it('crée le dossier Collimo quand il manque', async () => {
    const { impl, calls } = fakeFetch(({ init }) => (init.method === 'POST' ? { body: { id: 'created' } } : { body: { files: [] } }))
    const drive = createDriveClient(() => 'T', impl)
    expect(await drive.ensureCollimoFolder('parent')).toBe('created')
    const post = calls.find((c) => c.init.method === 'POST')!
    expect(JSON.parse(String(post.init.body))).toEqual({ name: 'Collimo', mimeType: FOLDER_MIME, parents: ['parent'] })
    expect(post.url.searchParams.get('supportsAllDrives')).toBe('true')
  })

  it('traduit un 401 en session expirée', async () => {
    const { impl } = fakeFetch(() => ({ status: 401 }))
    await expect(createDriveClient(() => 'T', impl).listSharedDrives()).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('remonte le message d’erreur de Drive', async () => {
    const { impl } = fakeFetch(() => ({ status: 403, body: { error: { message: 'Insufficient permissions' } } }))
    const error = await createDriveClient(() => 'T', impl)
      .getFolder('x')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DriveApiError)
    expect((error as DriveApiError).message).toBe('Insufficient permissions')
  })

  it('lit le droit d’écriture et le Drive du dossier', async () => {
    const { impl } = fakeFetch(() => ({
      body: { id: 'f', name: 'Séminaire', driveId: 'd1', capabilities: { canAddChildren: false } },
    }))
    expect(await createDriveClient(() => 'T', impl).getFolder('f')).toEqual({
      id: 'f',
      name: 'Séminaire',
      driveId: 'd1',
      canAddChildren: false,
    })
  })
})
