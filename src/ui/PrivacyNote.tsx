/**
 * Rappel de confidentialité affiché pendant le choix des photos : rien de confidentiel, arrière-plan
 * vérifié, photos recadrées sur les personnes.
 */
import { useI18n } from '../i18n'

/**
 * Encart de rappel avant de partager un collage.
 * @param props - `className` : classe en plus, pour le placer (colonne ou mobile)
 * @returns l'encart
 */
export function PrivacyNote({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <aside className={`privacy-note ${className}`.trim()} aria-label={t('privacy.title')}>
      <p className="privacy-title">
        <ShieldIcon />
        {t('privacy.title')}
      </p>
      <ul>
        <li>{t('privacy.confidential')}</li>
        <li>{t('privacy.background')}</li>
        <li>{t('privacy.people')}</li>
      </ul>
    </aside>
  )
}

/**
 * Icône de bouclier de l'encart.
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function ShieldIcon() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
