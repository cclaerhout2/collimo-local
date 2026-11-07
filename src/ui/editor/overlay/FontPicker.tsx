/** Choix de la police d'un texte parmi les polices Google. */
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../i18n'
import { normalize } from '../../../stickers/keywords'
import { ensureFont, loadFontCatalog, POPULAR_FONTS, type FontEntry } from '../../../stickers/fonts'

/** Propriétés de {@link FontPicker}. */
interface Props {
  /** Famille de la police actuelle. */
  value: string
  /** Appelé avec la police choisie. */
  onChange: (font: FontEntry) => void
}

/**
 * Polices Google : les populaires d'abord (affichées dans leur police), puis recherche dans tout le catalogue.
 *
 * Les résultats de recherche s'affichent dans la police de l'interface, et sont limités à 80 :
 * charger chaque police trouvée serait trop lourd.
 * @returns le champ de recherche, l'état de la liste et la liste des polices
 */
export function FontPicker({ value, onChange }: Props) {
  const { t } = useI18n()
  const [catalog, setCatalog] = useState<FontEntry[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    loadFontCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setCatalog([]))
    for (const f of POPULAR_FONTS) void ensureFont(f, 400, false)
    return () => {
      alive = false
    }
  }, [])

  const list = useMemo(() => {
    if (!catalog) return []
    const q = normalize(query)
    if (!q) {
      const byName = new Map(catalog.map((f) => [f.family, f]))
      return POPULAR_FONTS.map((f) => byName.get(f)).filter((f): f is FontEntry => !!f)
    }
    return catalog.filter((f) => normalize(f.family).includes(q)).slice(0, 80)
  }, [catalog, query])

  return (
    <div className="font-picker">
      <input
        type="search"
        className="search-input"
        placeholder={t('font.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('font.search')}
      />
      <p className="panel-note">
        {catalog === null ? t('font.loading') : query ? t('font.results', { count: list.length }) : t('font.popular')}
      </p>
      <div className="font-list" role="listbox" aria-label={t('text.tab.font')}>
        {list.map((f) => (
          <button
            key={f.family}
            type="button"
            role="option"
            aria-selected={f.family === value}
            className={`font-option${f.family === value ? ' selected' : ''}`}
            style={query ? undefined : { fontFamily: `"${f.family}", system-ui` }}
            onClick={() => onChange(f)}
          >
            {f.family}
          </button>
        ))}
      </div>
    </div>
  )
}
