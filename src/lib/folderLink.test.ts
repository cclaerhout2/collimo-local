import { describe, expect, it } from 'vitest'
import { collimoFolderLink, driveItemLink, parseFolderParam } from './folderLink'

const ID = '1AbCdEfGhIjKlMnOp_-q'

describe('parseFolderParam', () => {
  it('accepte un identifiant seul', () => {
    expect(parseFolderParam(ID)).toEqual({ id: ID, kind: 'folder' })
    expect(parseFolderParam(`  ${ID} `)).toEqual({ id: ID, kind: 'folder' })
  })

  it('accepte les liens de dossier Drive', () => {
    expect(parseFolderParam(`https://drive.google.com/drive/folders/${ID}`)).toEqual({ id: ID, kind: 'folder' })
    expect(parseFolderParam(`https://drive.google.com/drive/u/1/folders/${ID}?usp=sharing`)).toEqual({ id: ID, kind: 'folder' })
    expect(parseFolderParam(`https://drive.google.com/open?id=${ID}`)).toEqual({ id: ID, kind: 'folder' })
  })

  it('reconnaît un lien de fichier', () => {
    expect(parseFolderParam(`https://drive.google.com/file/d/${ID}/view?usp=drive_link`)).toEqual({ id: ID, kind: 'file' })
  })

  it('refuse le reste', () => {
    expect(parseFolderParam(null)).toBeNull()
    expect(parseFolderParam('')).toBeNull()
    expect(parseFolderParam('abc')).toBeNull()
    expect(parseFolderParam(`https://exemple.com/drive/folders/${ID}`)).toBeNull()
    expect(parseFolderParam('https://drive.google.com/drive/my-drive')).toBeNull()
    expect(parseFolderParam('pas une adresse')).toBeNull()
  })
})

describe('liens', () => {
  it('fabrique le lien Collimo et le lien Drive', () => {
    expect(collimoFolderLink('https://collimo.web.app/', ID)).toBe(`https://collimo.web.app/?folder=${ID}`)
    expect(driveItemLink({ id: ID, kind: 'folder' })).toBe(`https://drive.google.com/drive/folders/${ID}`)
    expect(driveItemLink({ id: ID, kind: 'file' })).toBe(`https://drive.google.com/file/d/${ID}/view`)
  })
})
