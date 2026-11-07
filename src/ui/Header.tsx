/**
 * En-tête de l'application : logo, choix de la langue et menu de l'utilisateur connecté.
 */
import { useEffect, useRef, useState } from 'react'
import type { SignedInUser } from '../google/types'
import { LANGS, useI18n, type Lang } from '../i18n'

/** Propriétés de l'en-tête ; une action absente fait disparaître l'entrée de menu correspondante. */
interface Props {
  /** Utilisateur connecté, ou `null` (pas de menu). */
  user: SignedInUser | null
  /** Change la langue de l'interface. */
  onLangChange: (lang: Lang) => void
  /** Ouvre le choix de l'emplacement de travail. */
  onChangeLocation?: () => void
  /** Ouvre l'usine à dispositions (admins seulement). */
  onOpenFactory?: () => void
  /** Déconnecte l'utilisateur. */
  onSignOut?: () => void
}

/**
 * Logo de Collimo, dessiné en SVG avec les couleurs du thème.
 * @returns le logo, masqué aux lecteurs d'écran
 */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <rect x="6" y="6" width="11" height="20" rx="3" fill="var(--accent)" />
      <rect x="19" y="6" width="7" height="9" rx="3" fill="var(--surface)" />
      <rect x="19" y="17" width="7" height="9" rx="3" fill="var(--surface)" />
    </svg>
  )
}

/**
 * Barre du haut, présente sur tous les écrans.
 * @returns l'en-tête
 */
export function Header({ user, onLangChange, onChangeLocation, onOpenFactory, onSignOut }: Props) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    /**
     * Ferme le menu quand on clique en dehors.
     * @param e - appui du pointeur sur la page
     */
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // Ferme le menu avec la touche Échap.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className="header">
      <div className="brand">
        <Logo />
        <span className="brand-name">Collimo</span>
      </div>
      <div className="header-actions">
        <div className="lang-switch" role="group" aria-label={t('lang.label')}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              className={l === lang ? 'active' : ''}
              aria-pressed={l === lang}
              title={t(l === 'fr' ? 'lang.fr' : 'lang.en')}
              onClick={() => onLangChange(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {user && (
          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="avatar-button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              title={user.email}
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="avatar-initial">{user.name.slice(0, 1).toUpperCase()}</span>
              )}
            </button>
            {open && (
              <div className="menu" role="menu">
                <div className="menu-user">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                {onChangeLocation && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      onChangeLocation()
                    }}
                  >
                    {t('menu.changeLocation')}
                  </button>
                )}
                {onOpenFactory && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      onOpenFactory()
                    }}
                  >
                    {t('menu.factory')}
                  </button>
                )}
                {onSignOut && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false)
                      onSignOut()
                    }}
                  >
                    {t('menu.signOut')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
