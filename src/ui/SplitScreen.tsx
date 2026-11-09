/**
 * Répartition de la sélection en plusieurs collages : les photos à placer en haut, une carte par
 * collage en dessous. On glisse une photo vers une carte (souris), ou on la touche puis on touche
 * la carte (écran tactile). Répartition automatique, ajout et retrait de collages, puis création.
 */
import { useState, type DragEvent } from 'react'
import { MAX_PHOTOS, MIN_PHOTOS } from '../config'
import type { Photo, Services } from '../google/types'
import { useI18n } from '../i18n'
import { autoSplit, groupsNeeded, movePhoto, splitBySize, splitIssues, unplaced, type Groups } from '../lib/split'
import { Thumbnail } from './Thumbnail'

/** Propriétés de l'écran de répartition. */
interface Props {
  /** Services Google (miniatures). */
  services: Services
  /** Photos sélectionnées, dans l'ordre de sélection. */
  photos: Photo[]
  /** Revient à la galerie. */
  onCancel: () => void
  /** Crée les collages, un par groupe non vide, dans l'ordre. */
  onCreate: (groups: Photo[][]) => void
}

/**
 * Écran de répartition.
 * @returns l'écran
 */
export function SplitScreen({ services, photos, onCancel, onCreate }: Props) {
  const { t } = useI18n()
  const ids = photos.map((p) => p.id)
  const byId = new Map(photos.map((p) => [p.id, p]))
  // Au départ : le nombre de collages imposé par le maximum, et au moins deux puisqu'on vient répartir.
  const [groups, setGroups] = useState<Groups>(() =>
    autoSplit(ids, Math.max(ids.length >= MIN_PHOTOS * 2 ? 2 : 1, groupsNeeded(ids.length, MAX_PHOTOS))),
  )
  const [perGroup, setPerGroup] = useState(() => Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, Math.ceil(ids.length / groups.length))))
  /** Photo touchée, en attente d'une carte de destination (écran tactile ou clavier). */
  const [picked, setPicked] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const left = unplaced(ids, groups)
  const issues = splitIssues(ids, groups, MIN_PHOTOS, MAX_PHOTOS)
  const nonEmpty = groups.filter((g) => g.length > 0)
  const canCreate = issues.length === 0 && nonEmpty.length > 0

  /**
   * Place une photo dans un groupe (ou la remet à placer).
   * @param id - photo
   * @param to - groupe de destination, ou -1
   */
  function place(id: string, to: number) {
    setGroups((g) => movePhoto(g, id, to))
    setPicked(null)
  }

  /**
   * Touche sur une photo : la choisit, ou la relâche si c'était elle.
   * @param id - photo
   */
  function tap(id: string) {
    setPicked((cur) => (cur === id ? null : id))
  }

  /**
   * Touche sur une carte : y place la photo choisie, s'il y en a une.
   * @param to - groupe
   */
  function tapGroup(to: number) {
    if (picked) place(picked, to)
  }

  /**
   * Dépose une photo glissée sur un groupe.
   * @param e - événement de dépôt
   * @param to - groupe de destination, ou -1
   */
  function drop(e: DragEvent, to: number) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setDragOver(null)
    if (id && byId.has(id)) place(id, to)
  }

  /**
   * Vignette déplaçable d'une photo.
   * @param id - photo
   * @param from - groupe d'origine, ou -1
   * @returns la vignette
   */
  function tile(id: string, from: number) {
    const p = byId.get(id)
    if (!p) return null
    const isPicked = picked === id
    return (
      <li key={id}>
        <button
          type="button"
          className={`split-photo${isPicked ? ' picked' : ''}`}
          draggable
          aria-pressed={isPicked}
          aria-label={p.name}
          title={isPicked ? t('split.pickedHint') : p.name}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', id)
            e.dataTransfer.effectAllowed = 'move'
            setPicked(null)
          }}
          onClick={() => tap(id)}
          onDoubleClick={() => place(id, from === -1 ? 0 : -1)}
        >
          <Thumbnail key={id} photo={p} services={services} />
        </button>
      </li>
    )
  }

  /**
   * Zone de dépôt (carte de collage ou bande « à placer »).
   * @param to - groupe, ou -1
   * @returns les attributs de dépôt
   */
  const dropProps = (to: number) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOver !== to) setDragOver(to)
    },
    onDragLeave: () => setDragOver((d) => (d === to ? null : d)),
    onDrop: (e: DragEvent) => drop(e, to),
  })

  return (
    <main className="screen split-screen">
      <div className="split-head">
        <div>
          <h1>{t('split.title', { count: ids.length })}</h1>
          <p className="muted">{t('split.hint')}</p>
        </div>
        <div className="split-tools">
          <label className="split-auto">
            <span>{t('split.perGroup')}</span>
            <input
              type="number"
              min={MIN_PHOTOS}
              max={MAX_PHOTOS}
              value={perGroup}
              onChange={(e) => setPerGroup(Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, Number(e.target.value) || MIN_PHOTOS)))}
            />
            <button type="button" className="btn btn-small" onClick={() => setGroups(splitBySize(ids, perGroup))}>
              {t('split.auto')}
            </button>
          </label>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setGroups((g) => [...g, []])}>
            + {t('split.newGroup')}
          </button>
        </div>
      </div>

      <section
        className={`split-pool${dragOver === -1 ? ' drag-over' : ''}${picked && groups.some((g) => g.includes(picked)) ? ' target' : ''}`}
        {...dropProps(-1)}
      >
        <h2>
          {t('split.pool')} <span className="muted">{t('split.count', { count: left.length })}</span>
          {picked && groups.some((g) => g.includes(picked)) && (
            <button type="button" className="btn btn-small btn-ghost" onClick={() => place(picked, -1)}>
              {t('split.placeHere')}
            </button>
          )}
        </h2>
        {left.length === 0 ? (
          <p className="muted">{t('split.poolEmpty')}</p>
        ) : (
          <ul className="split-grid">{left.map((id) => tile(id, -1))}</ul>
        )}
      </section>

      <div className="split-groups">
        {groups.map((g, i) => {
          const tooFew = g.length > 0 && g.length < MIN_PHOTOS
          const tooMany = g.length > MAX_PHOTOS
          return (
            <section
              key={i}
              className={`split-group${dragOver === i ? ' drag-over' : ''}${picked && !g.includes(picked) ? ' target' : ''}`}
              {...dropProps(i)}
              onClick={(e) => {
                if (picked && !(e.target as Element).closest('.split-photo, .split-remove')) tapGroup(i)
              }}
            >
              <h2>
                {t('split.group', { n: i + 1 })}
                <span className={`split-size${tooFew || tooMany ? ' bad' : ''}`}>
                  {t('split.count', { count: g.length })}
                  {tooFew && ` · ${t('split.min', { min: MIN_PHOTOS })}`}
                  {tooMany && ` · ${t('split.max', { max: MAX_PHOTOS })}`}
                </span>
                {picked && !g.includes(picked) && (
                  <button type="button" className="btn btn-small btn-primary split-place" onClick={() => tapGroup(i)}>
                    {t('split.placeHere')}
                  </button>
                )}
                {groups.length > 1 && (
                  <button
                    type="button"
                    className="split-remove"
                    aria-label={t('split.removeGroup', { n: i + 1 })}
                    title={t('split.removeGroup', { n: i + 1 })}
                    onClick={() => setGroups((gs) => gs.filter((_, k) => k !== i))}
                  >
                    ×
                  </button>
                )}
              </h2>
              {g.length === 0 ? (
                <p className="muted split-empty">{t('split.groupEmpty')}</p>
              ) : (
                <ul className="split-grid">{g.map((id) => tile(id, i))}</ul>
              )}
            </section>
          )
        })}
      </div>

      <div className="split-bar">
        <span className="split-status">
          {issues.length === 0
            ? t('split.ready', { count: nonEmpty.length })
            : issues
                .map((it) =>
                  it.kind === 'unplaced'
                    ? t('split.issueUnplaced', { count: it.count })
                    : it.kind === 'tooFew'
                      ? t('split.issueTooFew', { n: it.group + 1, min: it.min })
                      : t('split.issueTooMany', { n: it.group + 1, max: it.max }),
                )
                .join(' · ')}
        </span>
        <div className="split-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('split.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canCreate}
            onClick={() => onCreate(nonEmpty.map((g) => g.map((id) => byId.get(id)!).filter(Boolean)))}
          >
            {nonEmpty.length === 1 ? t('split.createOne') : t('split.create', { count: nonEmpty.length })}
          </button>
        </div>
      </div>
    </main>
  )
}
