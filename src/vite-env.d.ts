/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_GOOGLE_APP_ID?: string
  readonly VITE_ALLOWED_DOMAIN?: string
  readonly VITE_MOCK?: string
  /** Version web locale (album dans le navigateur, sans compte) : `1`. */
  readonly VITE_LOCAL_WEB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
