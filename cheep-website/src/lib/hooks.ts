import { useEffect, useState } from 'react'

/**
 * Medya sorgusu — sunucuda ve ilk istemci render'ında daima `false` döner,
 * böylece prerender edilmiş HTML ile hydration uyuşur. Gerçek değer mount
 * sonrası gelir.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** `md` kırılımı (Tailwind 48rem) ve üstü. WebGL hero yalnızca burada çalışır. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
