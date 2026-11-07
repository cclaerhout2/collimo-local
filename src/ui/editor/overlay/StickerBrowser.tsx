/** Catalogue des stickers : emoji Fluent, icônes Phosphor, et images de l'utilisateur prises dans Drive. */
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../i18n'
import {
  CATEGORY_LABELS,
  FLUENT_CATEGORIES,
  iconBody,
  iconSvg,
  loadIndex,
  PH_CATEGORIES,
  searchIcons,
  type IconEntry,
  type IconSet,
  type PhWeight,
} from '../../../stickers/catalog'

/** Source affichée : un jeu d'icônes, ou « mes images » (Drive). */
type Source = IconSet | 'mine'

/** Propriétés de {@link StickerBrowser}. */
interface Props {
  /** Appelé avec le jeu, le nom et le SVG complet de l'icône choisie. */
  onPickIcon: (set: IconSet, name: string, svg: string) => void
  /** Ouvre le sélecteur Drive pour ajouter une image en sticker. */
  onPickImage: () => void
}

/**
 * Miniature d'icône, chargée à l'affichage (les corps SVG arrivent par catégorie).
 *
 * `weight` est le style Phosphor (trait ou plein). Les icônes Phosphor sont teintées en clair
 * pour rester visibles sur le fond sombre du panneau.
 * @returns l'image de l'icône, ou un emplacement vide pendant le chargement
 */
function IconThumb({ entry, weight }: { entry: IconEntry; weight: PhWeight }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    iconBody(entry, weight)
      .then((body) => {
        if (!alive) return
        const svg = iconSvg(entry.set, entry.set === 'ph' ? body.replace(/currentColor/g, '#f2f2f5') : body)
        setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [entry, weight])
  return src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <span className="sticker-skeleton" />
}

/**
 * Catalogue des stickers, avec recherche et filtre par catégorie.
 *
 * L'index de chaque jeu n'est chargé qu'à sa première ouverture ; l'affichage est limité à 180 icônes
 * pour garder une grille fluide.
 * @returns les sources, la recherche, les catégories et la grille des icônes, ou le bouton d'ajout d'image
 */
export function StickerBrowser({ onPickIcon, onPickImage }: Props) {
  const { t, lang } = useI18n()
  const [source, setSource] = useState<Source>('fluent')
  const [weight, setWeight] = useState<PhWeight>('fill')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [index, setIndex] = useState<Record<IconSet, IconEntry[] | undefined>>({ ph: undefined, fluent: undefined })

  useEffect(() => {
    if (source === 'mine' || index[source]) return
    let alive = true
    loadIndex(source)
      .then((entries) => alive && setIndex((cur) => ({ ...cur, [source]: entries })))
      .catch(() => alive && setIndex((cur) => ({ ...cur, [source]: [] })))
    return () => {
      alive = false
    }
  }, [source, index])

  const entries = source === 'mine' ? undefined : index[source]
  const shown = useMemo(() => {
    if (!entries) return []
    const scoped = category ? entries.filter((e) => e.categories.includes(category)) : entries
    return searchIcons(scoped, query, 180)
  }, [entries, category, query])

  const categories = source === 'ph' ? PH_CATEGORIES : FLUENT_CATEGORIES
  /**
   * Nom d'une catégorie dans la langue de l'interface.
   * @param c - identifiant de la catégorie
   * @returns son nom traduit, ou l'identifiant à défaut
   */
  const label = (c: string) => CATEGORY_LABELS[c]?.[lang === 'fr' ? 0 : 1] ?? c

  /**
   * Ajoute l'icône choisie, dans le style (trait ou plein) sélectionné.
   * @param e - icône du catalogue
   * @returns une promesse résolue une fois l'icône transmise
   */
  async function pick(e: IconEntry) {
    const body = await iconBody(e, weight)
    onPickIcon(e.set, e.name, iconSvg(e.set, body))
  }

  return (
    <div className="sticker-browser">
      <div className="sticker-top">
        <div className="segmented segmented-small">
          {(['fluent', 'ph', 'mine'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={source === s ? 'active' : ''}
              aria-pressed={source === s}
              onClick={() => {
                setSource(s)
                setCategory(null)
              }}
            >
              {t(s === 'ph' ? 'sticker.icons' : s === 'fluent' ? 'sticker.emoji' : 'sticker.mine')}
            </button>
          ))}
        </div>
        {source !== 'mine' && (
          <input
            type="search"
            className="search-input"
            placeholder={t('sticker.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('sticker.search')}
          />
        )}
        {source === 'ph' && (
          <div className="segmented segmented-small">
            {(['regular', 'fill'] as const).map((w) => (
              <button
                key={w}
                type="button"
                className={weight === w ? 'active' : ''}
                aria-pressed={weight === w}
                onClick={() => setWeight(w)}
              >
                {t(w === 'regular' ? 'sticker.outline' : 'sticker.filled')}
              </button>
            ))}
          </div>
        )}
      </div>

      {source === 'mine' ? (
        <div className="sticker-mine">
          <p className="muted">{t('sticker.mineText')}</p>
          <button type="button" className="btn" onClick={onPickImage}>
            {t('sticker.mineButton')}
          </button>
        </div>
      ) : (
        <>
          <div className="chips">
            <button type="button" className={`chip${category === null ? ' active' : ''}`} onClick={() => setCategory(null)}>
              {t('sticker.all')}
            </button>
            {categories.map((c) => (
              <button key={c} type="button" className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
                {label(c)}
              </button>
            ))}
          </div>
          {!entries && <p className="muted">{t('sticker.loading')}</p>}
          {entries && shown.length === 0 && <p className="muted">{t('sticker.none', { query })}</p>}
          <div className="sticker-grid">
            {shown.map((e) => (
              <button key={`${e.set}:${e.name}`} type="button" className="sticker-option" title={e.name} onClick={() => void pick(e)}>
                <IconThumb entry={e} weight={weight} />
              </button>
            ))}
          </div>
          <p className="fine">{t('sticker.credits')}</p>
        </>
      )}
    </div>
  )
}
