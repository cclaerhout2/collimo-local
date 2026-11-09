/**
 * Liste des projets de collage déjà enregistrés dans le dossier Collimo, avec leur aperçu.
 */
import { useEffect, useRef, useState } from 'react'
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

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copiedTimer = useRef<number | undefined>(undefined)

  /**
   * Lien Drive d'un collage : son image exportée, sinon son fichier projet.
   * @param e - collage
   * @returns le lien d'ouverture dans Drive, ou `undefined` si Drive n'en a pas fourni
   */
  const driveLink = (e: ProjectEntry) => e.image?.webViewLink ?? e.project.webViewLink

  /**
   * Copie le lien Drive d'un collage ; si la copie est refusée, ouvre Drive à la place.
   * @param e - collage
   */
  async function copyLink(e: ProjectEntry) {
    const link = driveLink(e)
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(e.project.id)
      window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  const date = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <section className="projects">
      <h2>{t('projects.title')}</h2>
      {entries === null && <p className="muted">{t('projects.loading')}</p>}
      {entries?.length === 0 && <p className="muted">{t('projects.empty')}</p>}
      {entries && entries.length > 0 && (
        <ul className="project-strip">
          {entries.map((e) => (
            <li key={e.project.id} className="project-cell">
              <button type="button" className="project-card" onClick={() => onOpen(e)} title={t('projects.open')}>
                {e.image?.thumbnailLink ? (
                  <img src={sizedThumbnail(e.image.thumbnailLink, 320)} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="project-noimg" aria-hidden="true" />
                )}
                <span className="project-date">{e.project.modifiedTime ? date.format(new Date(e.project.modifiedTime)) : e.baseName}</span>
              </button>
              {driveLink(e) && (
                <a
                  className={`project-link${copiedId === e.project.id ? ' copied' : ''}`}
                  href={driveLink(e)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t('projects.copyLink')}
                  title={copiedId === e.project.id ? t('projects.linkCopied') : t('projects.copyLinkHint')}
                  onClick={(ev) => {
                    // Clic simple : copie. Clic avec Ctrl/Cmd, molette ou clic droit : le lien s'ouvre normalement.
                    if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return
                    ev.preventDefault()
                    void copyLink(e)
                  }}
                >
                  {copiedId === e.project.id ? <CheckIcon /> : <LinkIcon />}
                  {copiedId === e.project.id && <span className="project-copied">{t('projects.linkCopied')}</span>}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Icône de lien du bouton « Copier le lien Drive ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Coche affichée une fois le lien copié.
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
