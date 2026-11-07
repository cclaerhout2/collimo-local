/**
 * Liste des projets de collage déjà enregistrés dans le dossier Collimo, avec leur aperçu.
 */
import { useEffect, useState } from 'react'
import { PROJECT_SUFFIX, projectBaseName } from '../collage/project'
import { sizedThumbnail } from '../google/drive'
import type { DriveFileInfo, Services } from '../google/types'
import { useI18n } from '../i18n'

/** Projet enregistré, avec l'image exportée qui lui correspond s'il y en a une. */
export interface ProjectEntry {
  /** Fichier projet (JSON) sur Drive. */
  project: DriveFileInfo
  /** Nom commun au projet et à son image, sans extension. */
  baseName: string
  /** Image exportée du même nom, qui sert d'aperçu. */
  image?: DriveFileInfo
}

/**
 * Associe chaque fichier projet à l'image exportée du même nom.
 * @param files - fichiers du dossier Collimo
 * @returns un élément par fichier projet, dans l'ordre de `files`
 */
export function groupProjects(files: DriveFileInfo[]): ProjectEntry[] {
  const images = new Map<string, DriveFileInfo>()
  for (const f of files) {
    const m = /^(.*)\.(jpg|png)$/i.exec(f.name)
    if (m) images.set(m[1], f)
  }
  return files
    .filter((f) => f.name.endsWith(PROJECT_SUFFIX))
    .map((project) => {
      const baseName = projectBaseName(project.name)
      return { project, baseName, image: images.get(baseName) }
    })
}

/** Propriétés de la liste des projets. */
interface Props {
  /** Services Google (Drive). */
  services: Services
  /** Identifiant du dossier Collimo où sont rangés projets et images. */
  collimoFolderId: string
  /** Ouvre le projet choisi. */
  onOpen: (entry: ProjectEntry) => void
  /** Signale une erreur à afficher. */
  onError: (e: unknown) => void
}

/**
 * Bandeau des projets enregistrés, chargés à l'affichage.
 * @returns la section des projets
 */
export function ProjectsList({ services, collimoFolderId, onOpen, onError }: Props) {
  const { t, lang } = useI18n()
  const [entries, setEntries] = useState<ProjectEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    services.drive
      .listFolderFiles(collimoFolderId)
      .then((files) => alive && setEntries(groupProjects(files)))
      .catch((e: unknown) => {
        if (!alive) return
        setEntries([])
        onError(e)
      })
    return () => {
      alive = false
    }
  }, [services, collimoFolderId, onError])

  const date = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="projects">
      <h2>{t('projects.title')}</h2>
      {entries === null && <p className="muted">{t('projects.loading')}</p>}
      {entries?.length === 0 && <p className="muted">{t('projects.empty')}</p>}
      {entries && entries.length > 0 && (
        <ul className="project-strip">
          {entries.map((e) => (
            <li key={e.project.id}>
              <button type="button" className="project-card" onClick={() => onOpen(e)} title={t('projects.open')}>
                {e.image?.thumbnailLink ? (
                  <img src={sizedThumbnail(e.image.thumbnailLink, 320)} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="project-noimg" aria-hidden="true" />
                )}
                <span className="project-date">{e.project.modifiedTime ? date.format(new Date(e.project.modifiedTime)) : e.baseName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
