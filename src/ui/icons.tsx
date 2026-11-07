/**
 * Petites icônes SVG de l'interface (dossiers, Drive), masquées aux lecteurs d'écran.
 */

/** Sorte d'icône de dossier. */
export type FolderIconKind = 'folder' | 'my' | 'shared' | 'recent'

/**
 * Icône de dossier, de Drive personnel, de Drive partagé ou de dossier récent.
 * @param props - `kind` : sorte d'icône ; `size` : taille en pixels (18 par défaut)
 * @returns l'icône SVG
 */
export function FolderIcon({ kind = 'folder', size = 18 }: { kind?: FolderIconKind; size?: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'recent' ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5V12l3 2" {...common} />
        </>
      ) : kind === 'my' ? (
        <>
          <circle cx="12" cy="8.5" r="3.5" {...common} />
          <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" {...common} />
        </>
      ) : (
        <>
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />
          {kind === 'shared' && <path d="M9 14.5c.5-1.4 1.6-2.2 3-2.2s2.5.8 3 2.2M12 10.3h.01" {...common} />}
        </>
      )}
    </svg>
  )
}
