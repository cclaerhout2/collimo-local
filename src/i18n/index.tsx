/**
 * Traduction de l'interface (français, anglais) : choix de la langue (mémorisée dans le navigateur,
 * sinon celle du navigateur), contexte React et fonction `t` pour lire les libellés.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { androidTexts, desktopTexts } from './desktop'
import { en } from './en'
import { fr, type MessageKey } from './fr'

/** Langue de l'interface. */
export type Lang = 'fr' | 'en'
/** Langues proposées, dans l'ordre du menu. */
export const LANGS: readonly Lang[] = ['fr', 'en']

/** Libellés de chaque langue. */
const dictionaries: Record<Lang, Record<MessageKey, string>> = { fr, en }
/** Libellés de remplacement en vigueur (application Windows), par langue ; vide pour la version web. */
let overrides: Partial<Record<Lang, Partial<Record<MessageKey, string>>>> = {}

/**
 * Active (ou désactive) les libellés des applications, qui ne parlent plus de Google Drive.
 * À appeler avant le premier affichage.
 * @param on - `true` dans une application (ordinateur ou Android)
 * @param platform - système ; `android` ajoute les libellés propres au téléphone
 */
export function enableDesktopTexts(on: boolean, platform?: string): void {
  if (!on) overrides = {}
  else if (platform === 'android')
    overrides = { fr: { ...desktopTexts.fr, ...androidTexts.fr }, en: { ...desktopTexts.en, ...androidTexts.en } }
  else overrides = desktopTexts
}

/** Clé de stockage local de la langue choisie. */
const STORAGE_KEY = 'collimo.lang'

/**
 * Langue du navigateur ; français si elle n'est ni française ni anglaise.
 * @param languages - langues préférées, dans l'ordre (par défaut celles du navigateur)
 * @returns la première langue prise en charge, sinon `fr`
 */
export function detectLang(languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const l of languages) {
    const code = l.toLowerCase().slice(0, 2)
    if (code === 'fr' || code === 'en') return code
  }
  return 'fr'
}

/**
 * Libellé d'un message dans une langue, variables `{nom}` remplacées.
 * @param lang - langue voulue
 * @param key - clé du message
 * @param vars - valeurs des variables ; une variable sans valeur reste telle quelle
 * @returns le texte à afficher (le français si la traduction manque)
 */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = overrides[lang]?.[key] ?? dictionaries[lang][key] ?? fr[key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

/**
 * Langue mémorisée dans le navigateur.
 * @returns la langue, ou `null` si aucune n'est mémorisée ou si le stockage est indisponible
 */
function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'fr' || v === 'en' ? v : null
  } catch {
    return null
  }
}

/** Contenu du contexte de traduction. */
interface I18n {
  /** Langue actuelle. */
  lang: Lang
  /** Change la langue et la mémorise. */
  setLang: (lang: Lang) => void
  /** Traduit un message dans la langue actuelle (voir {@link translate}). */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

/** Contexte React de la traduction ; null hors de {@link I18nProvider}. */
const I18nContext = createContext<I18n | null>(null)

/**
 * Fournit la langue et la traduction à toute l'app, et tient à jour l'attribut `lang` de la page.
 * @param props - contenu de l'app (`children`)
 * @returns le fournisseur de contexte
 */
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

  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang])
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Accès à la traduction depuis un composant.
 * @returns la langue actuelle, son changement et la fonction `t`
 * @throws Error si le composant n'est pas dans un {@link I18nProvider}
 */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n doit être utilisé dans <I18nProvider>')
  return ctx
}
