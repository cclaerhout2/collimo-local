const pending = new Map<string, Promise<void>>()

/** Charge un script externe une seule fois. */
export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.defer = true
    el.onload = () => resolve()
    el.onerror = () => {
      pending.delete(src)
      reject(new Error(`Impossible de charger ${src}`))
    }
    document.head.appendChild(el)
  })
  pending.set(src, promise)
  return promise
}
