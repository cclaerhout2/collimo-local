import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { fr, type MessageKey } from './fr'

export type Lang = 'fr' | 'en'
export const LANGS: readonly Lang[] = ['fr', 'en']

const dictionaries: Record<Lang, Record<MessageKey, string>> = { fr, en }
const STORAGE_KEY = 'collimo.lang'

/** Langue du navigateur ; français si elle n'est ni française ni anglaise. */
export function detectLang(languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const l of languages) {
    const code = l.toLowerCase().slice(0, 2)
    if (code === 'fr' || code === 'en') return code
  }
  return 'fr'
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key] ?? fr[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'fr' || v === 'en' ? v : null
  } catch {
    return null
  }
}

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => storedLang() ?? detectLang())

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  }, [])

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  )
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>')
  return ctx
}
