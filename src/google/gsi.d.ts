/* Types minimaux des bibliothèques Google chargées à la volée (GIS et Picker). */

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string
    expires_in: number
    scope: string
    error?: string
    error_description?: string
  }
  interface ClientConfigError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown'
    message?: string
  }
  interface TokenClientConfig {
    client_id: string
    scope: string
    prompt?: '' | 'none' | 'consent' | 'select_account'
    hd?: string
    login_hint?: string
    include_granted_scopes?: boolean
    callback: (response: TokenResponse) => void
    error_callback?: (error: ClientConfigError) => void
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: TokenClientConfig['prompt']; hint?: string }): void
  }
  function initTokenClient(config: TokenClientConfig): TokenClient
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean
  function revoke(token: string, done?: () => void): void
}

declare namespace google.picker {
  const ViewId: { FOLDERS: string; DOCS_IMAGES: string }
  const Action: { PICKED: string; CANCEL: string }
  const Feature: { SUPPORT_DRIVES: string }
  interface PickedDoc {
    id: string
    name: string
    mimeType: string
  }
  interface ResponseObject {
    action: string
    docs?: PickedDoc[]
  }
  class DocsView {
    constructor(viewId?: string)
    setIncludeFolders(v: boolean): DocsView
    setSelectFolderEnabled(v: boolean): DocsView
    setMimeTypes(types: string): DocsView
    setEnableDrives(v: boolean): DocsView
    setParent(id: string): DocsView
  }
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder
    setOAuthToken(token: string): PickerBuilder
    setDeveloperKey(key: string): PickerBuilder
    setAppId(id: string): PickerBuilder
    setLocale(locale: string): PickerBuilder
    setTitle(title: string): PickerBuilder
    enableFeature(feature: string): PickerBuilder
    setCallback(cb: (data: ResponseObject) => void): PickerBuilder
    build(): { setVisible(v: boolean): void }
  }
}

declare const gapi: {
  load(name: string, options: { callback: () => void; onerror?: () => void }): void
}
