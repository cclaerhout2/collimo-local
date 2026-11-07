import type { AppConfig } from '../config'
import type { Lang } from '../i18n'
import { FOLDER_MIME } from './drive'
import { loadScript } from './loadScript'
import type { DriveRef, FolderPicker } from './types'

const GAPI_SRC = 'https://apis.google.com/js/api.js'

let pickerReady: Promise<void> | null = null
function loadPicker(): Promise<void> {
  pickerReady ??= loadScript(GAPI_SRC).then(
    () => new Promise<void>((resolve, reject) => gapi.load('picker', { callback: resolve, onerror: reject })),
  )
  return pickerReady
}

/** Sélecteur Google Picker (dossiers ou photos), ouvert sur Mon Drive ou sur un Drive partagé. */
export function createGooglePicker(config: AppConfig, getToken: () => string): FolderPicker {
  async function open(drive: DriveRef, lang: Lang, title: string, view: google.picker.DocsView) {
    await loadPicker()
    const token = getToken()
    if (drive.id) view.setEnableDrives(true).setParent(drive.id)
    else view.setParent('root')
    return new Promise<{ id: string; name: string } | null>((resolve) => {
      new google.picker.PickerBuilder()
        .addView(view)
        .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
        .setOAuthToken(token)
        .setDeveloperKey(config.apiKey)
        .setAppId(config.appId)
        .setLocale(lang)
        .setTitle(title)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
            resolve({ id: data.docs[0].id, name: data.docs[0].name })
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null)
          }
        })
        .build()
        .setVisible(true)
    })
  }

  return {
    pickFolder: (drive, lang, title) =>
      open(
        drive,
        lang,
        title,
        new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_MIME),
      ),
    pickFile: (drive, lang, title, mimeType) =>
      open(drive, lang, title, new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(false).setMimeTypes(mimeType)),
    pickImage: (drive, lang, title) =>
      open(drive, lang, title, new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES).setIncludeFolders(true)),
  }
}
