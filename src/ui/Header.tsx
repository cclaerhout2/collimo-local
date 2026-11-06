import { useEffect, useRef, useState } from 'react'
import type { SignedInUser } from '../google/types'
import { LANGS, useI18n, type Lang } from '../i18n'

interface Props {
  user: SignedInUser | null
  onLangChange: (lang: Lang) => void
  onChangeLocation?: () => void
  onSignOut?: () => void
}

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

export function Header({ user, onLangChange, onChangeLocation, onSignOut }: Props) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
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
