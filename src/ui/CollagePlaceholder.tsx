import type { Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { Thumbnail } from './Thumbnail'

/** Écran provisoire : l'éditeur de collage arrive à l'étape 2. */
export function CollagePlaceholder({ photos, services, onBack }: { photos: Photo[]; services: Services; onBack: () => void }) {
  const { t } = useI18n()
  return (
    <main className="screen screen-center">
      <div className="card">
        <h1>{t('collage.title')}</h1>
        <p>{t('collage.placeholder', { count: photos.length })}</p>
        <ol className="strip">
          {photos.map((p) => (
            <li key={p.id}>
              <Thumbnail key={p.id} photo={p} services={services} />
            </li>
          ))}
        </ol>
        <div className="actions">
          <button type="button" className="btn" onClick={onBack}>
            {t('collage.back')}
          </button>
        </div>
      </div>
    </main>
  )
}
