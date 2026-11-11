/**
 * Page « Confidentialité et données » : ce que Collimo fait et ne fait pas, les autorisations
 * Google demandées, où sont les données, et les statistiques d'usage. Accessible avant la connexion
 * (lien de l'écran de connexion) et après (menu du compte).
 */
import { useI18n } from '../i18n'

/** Propriétés de la page. */
interface Props {
  /** État des statistiques d'usage : activées, désactivées, ou inconnu (avant la connexion). */
  stats: 'on' | 'off' | 'unknown'
  /** Retour à l'écran précédent. */
  onBack: () => void
}

/**
 * Page d'information sur la confidentialité.
 * @returns la page
 */
export function PrivacyScreen({ stats, onBack }: Props) {
  const { t } = useI18n()
  const list = (prefix: string, n: number) => (
    <ul>
      {Array.from({ length: n }, (_, i) => (
        <li key={i}>{t(`${prefix}${i + 1}` as Parameters<typeof t>[0])}</li>
      ))}
    </ul>
  )
  return (
    <main className="screen privacy-screen">
      <div className="card privacy-card">
        <button type="button" className="btn btn-ghost btn-small" onClick={onBack}>
          ‹ {t('privacyPage.back')}
        </button>
        <h1>{t('privacyPage.title')}</h1>
        <p className="privacy-lead">{t('privacyPage.lead')}</p>

        <h2>{t('privacyPage.does')}</h2>
        {list('privacyPage.does.', 5)}

        <h2>{t('privacyPage.never')}</h2>
        {list('privacyPage.never.', 5)}

        <h2>{t('privacyPage.scopes')}</h2>
        <table className="privacy-table">
          <thead>
            <tr>
              <th scope="col">{t('privacyPage.scopes.col1')}</th>
              <th scope="col">{t('privacyPage.scopes.col2')}</th>
            </tr>
          </thead>
          <tbody>
            {(['readonly', 'file', 'appdata'] as const).map((k) => (
              <tr key={k}>
                <th scope="row">{t(`privacyPage.scope.${k}`)}</th>
                <td>{t(`privacyPage.scope.${k}.why`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">{t('privacyPage.scopes.revoke')}</p>

        <h2>{t('privacyPage.where')}</h2>
        {list('privacyPage.where.', 4)}

        <h2>{t('privacyPage.stats')}</h2>
        <p className={`privacy-status ${stats}`}>{t(`privacyPage.stats.${stats}`)}</p>
        <p>{t('privacyPage.stats.what')}</p>
        {list('privacyPage.stats.item.', 4)}
        <p>{t('privacyPage.stats.not')}</p>
        <p>{t('privacyPage.stats.who')}</p>

        <h2>{t('privacyPage.photos')}</h2>
        <p>{t('privacyPage.photos.text')}</p>

        <h2>{t('privacyPage.contact')}</h2>
        <p>{t('privacyPage.contact.text')}</p>
      </div>
    </main>
  )
}
