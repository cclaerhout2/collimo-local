/**
 * Liste des projets de collage déjà enregistrés dans le dossier Collimo, avec leur aperçu, leur nom
 * (celui de l'image dans Drive), un bouton qui copie le lien Drive et un renommage sur place.
 */
import { useEffect, useRef, useState } from 'react'
import { PROJECT_SUFFIX, projectBaseName } from '../collage/project'
import { PROJECTS_FOLDER_NAME } from '../config'
import { sizedThumbnail } from '../google/drive'
import type { DriveFileInfo, DriveService, Services } from '../google/types'
import { useI18n } from '../i18n'

/** Projet enregistré, avec l'image exportée qui lui correspond s'il y en a une. */
export interface ProjectEntry {
  /** Fichier projet (JSON) sur Drive. */
  project: DriveFileInfo
  /** Nom du collage : celui de l'image dans Drive (sans extension), sinon celui du projet. */
  baseName: string
  /** Image exportée, qui sert d'aperçu. */
  image?: DriveFileInfo
}

/**
 * Nom d'un fichier sans son extension (`.jpg`, `.png`, `.collimo.json`…).
 * @param name - nom du fichier
 * @returns le nom sans extension
 */
export function stripExtension(name: string): string {
  if (name.endsWith(PROJECT_SUFFIX)) return projectBaseName(name)
  return name.replace(/\.[a-z0-9]{2,5}$/i, '')
}

/**
 * Associe chaque fichier projet à son image exportée : d'abord par les propriétés Collimo (lien par
 * identifiant, qui survit aux renommages), sinon par le nom commun (collages plus anciens). Un
 * projet est reconnu à sa propriété Collimo ou à son suffixe `.collimo.json`.
 * @param files - fichiers du dossier Collimo
 * @returns un élément par fichier projet, dans l'ordre de `files`
 */
export function groupProjects(files: DriveFileInfo[]): ProjectEntry[] {
  const byId = new Map(files.map((f) => [f.id, f]))
  const imagesByName = new Map<string, DriveFileInfo>()
  for (const f of files) {
    const m = /^(.*)\.(jpg|jpeg|png)$/i.exec(f.name)
    if (m && f.appProperties?.collimo !== 'project') imagesByName.set(m[1], f)
  }
  const isProject = (f: DriveFileInfo) => f.appProperties?.collimo === 'project' || f.name.endsWith(PROJECT_SUFFIX)
  // Images qui désignent leur projet (lien retour), au cas où seul ce sens a été écrit.
  const imageByProjectId = new Map<string, DriveFileInfo>()
  for (const f of files) if (f.appProperties?.collimo === 'image' && f.appProperties.pair) imageByProjectId.set(f.appProperties.pair, f)
  return files.filter(isProject).map((project) => {
    const linked = project.appProperties?.pair ? byId.get(project.appProperties.pair) : undefined
    const image = linked ?? imageByProjectId.get(project.id) ?? imagesByName.get(stripExtension(project.name))
    return { project, baseName: stripExtension((image ?? project).name), image }
  })
}

/**
 * Noms à donner à l'image et au projet d'un collage renommé.
 * @param entry - collage
 * @param newName - nom choisi (sans extension)
 * @returns les nouveaux noms de fichiers
 */
export function renamedFileNames(entry: ProjectEntry, newName: string): { image?: string; project: string } {
  const base = newName
    .trim()
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
  const ext = entry.image ? (/\.(jpe?g|png)$/i.exec(entry.image.name)?.[0] ?? '.jpg') : undefined
  return { image: ext ? `${base}${ext}` : undefined, project: `${base}${PROJECT_SUFFIX}` }
}

/**
 * Fichiers du dossier Collimo et de son sous-dossier « Projets » (s'il existe), pour l'appariement.
 * @param drive - client Drive
 * @param collimoFolderId - dossier Collimo
 * @returns les fichiers de la racine, ceux du sous-dossier Projets, et les deux réunis
 */
export async function listCollageFiles(
  drive: DriveService,
  collimoFolderId: string,
): Promise<{ root: DriveFileInfo[]; files: DriveFileInfo[] }> {
  const [root, projectsFolderId] = await Promise.all([
    drive.listFolderFiles(collimoFolderId),
    drive.findFolder(collimoFolderId, PROJECTS_FOLDER_NAME),
  ])
  const inProjects = projectsFolderId ? await drive.listFolderFiles(projectsFolderId) : []
  return { root, files: [...root, ...inProjects] }
}

/**
 * Conversion des collages anciens : les fichiers projet restés à la racine du dossier Collimo sont
 * déplacés dans « Projets », et les couples image + projet sans propriétés Collimo en reçoivent.
 * Une seule fois par fichier ; sans effet sur les collages déjà au nouveau format.
 * @param drive - client Drive
 * @param collimoFolderId - dossier Collimo
 * @param rootFiles - fichiers à la racine du dossier Collimo
 * @param entries - collages appariés
 * @returns `true` si quelque chose a été modifié (la liste est alors à recharger)
 */
export async function migrateCollages(
  drive: DriveService,
  collimoFolderId: string,
  rootFiles: DriveFileInfo[],
  entries: ProjectEntry[],
): Promise<boolean> {
  const rootIds = new Set(rootFiles.map((f) => f.id))
  const toMove = entries.filter((e) => rootIds.has(e.project.id))
  const toLink = entries.filter(
    (e) => e.image && (e.project.appProperties?.pair !== e.image.id || e.image.appProperties?.pair !== e.project.id),
  )
  if (!toMove.length && !toLink.length) return false
  const projectsFolderId = toMove.length ? await drive.ensureFolder(collimoFolderId, PROJECTS_FOLDER_NAME) : null
  for (const e of entries) {
    const move = toMove.includes(e) && projectsFolderId ? { addParents: projectsFolderId, removeParents: collimoFolderId } : undefined
    const link = toLink.includes(e)
    if (!move && !link) continue
    await drive.updateFileMeta(e.project.id, link && e.image ? { appProperties: { collimo: 'project', pair: e.image.id } } : {}, move)
    if (link && e.image) await drive.updateFileMeta(e.image.id, { appProperties: { collimo: 'image', pair: e.project.id } })
  }
  return true
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
    /** Charge la liste ; convertit les anciens collages une fois, puis recharge si quelque chose a bougé. */
    async function load() {
      const { root, files } = await listCollageFiles(services.drive, collimoFolderId)
      const grouped = groupProjects(files)
      if (!alive) return
      setEntries(grouped)
      try {
        if (await migrateCollages(services.drive, collimoFolderId, root, grouped)) {
          const again = await listCollageFiles(services.drive, collimoFolderId)
          if (alive) setEntries(groupProjects(again.files))
        }
      } catch {
        // Conversion impossible (droits, réseau) : la liste reste utilisable telle quelle.
      }
    }
    load().catch((e: unknown) => {
      if (!alive) return
      setEntries([])
      onError(e)
    })
    return () => {
      alive = false
    }
  }, [services, collimoFolderId, onError])

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /**
   * Renomme l'image et le projet d'un collage dans Drive, puis met la liste à jour.
   * @param e - collage
   * @param newName - nouveau nom, sans extension
   */
  async function rename(e: ProjectEntry, newName: string) {
    const clean = newName.trim()
    setRenaming(null)
    if (!clean || clean === e.baseName) return
    const names = renamedFileNames(e, clean)
    setBusyId(e.project.id)
    try {
      const project = await services.drive.updateFileMeta(e.project.id, { name: names.project })
      const image = e.image && names.image ? await services.drive.updateFileMeta(e.image.id, { name: names.image }) : e.image
      setEntries((list) =>
        (list ?? []).map((x) =>
          x.project.id === e.project.id
            ? { project: { ...x.project, ...project }, image: image ? { ...x.image, ...image } : x.image, baseName: clean }
            : x,
        ),
      )
    } catch (err) {
      onError(err)
    } finally {
      setBusyId(null)
    }
  }
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
              <button
                type="button"
                className="project-card"
                onClick={() => onOpen(e)}
                title={t('projects.open')}
                disabled={busyId === e.project.id}
              >
                {e.image?.thumbnailLink ? (
                  <img src={sizedThumbnail(e.image.thumbnailLink, 320)} alt="" referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="project-noimg" aria-hidden="true" />
                )}
                <span className="project-name" title={e.baseName}>
                  {e.baseName}
                </span>
                <span className="project-date">{e.project.modifiedTime ? date.format(new Date(e.project.modifiedTime)) : ''}</span>
              </button>
              {renaming?.id === e.project.id ? (
                <form
                  className="project-rename"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    void rename(e, renaming.value)
                  }}
                >
                  <input
                    autoFocus
                    value={renaming.value}
                    maxLength={120}
                    aria-label={t('projects.renameLabel')}
                    onChange={(ev) => setRenaming({ id: e.project.id, value: ev.target.value })}
                    onFocus={(ev) => ev.target.select()}
                    onBlur={() => void rename(e, renaming.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Escape') {
                        ev.preventDefault()
                        setRenaming(null)
                      }
                    }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="project-tool project-rename-btn"
                  aria-label={t('projects.rename')}
                  title={t('projects.renameHint')}
                  disabled={busyId === e.project.id}
                  onClick={() => setRenaming({ id: e.project.id, value: e.baseName })}
                >
                  <PencilIcon />
                </button>
              )}
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
                    // Applications locales : le lien ouvre l'image dans le système, rien à copier.
                    if (services.kind === 'desktop' || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return
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

/**
 * Icône de crayon du bouton « Renommer ».
 * @returns l'icône SVG, masquée aux lecteurs d'écran
 */
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
