import { useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LocaleContext, LOCALES, localePrefix, type Locale } from './i18n'
import { useSeo } from './seo/useSeo'
import type { PageKey } from './seo/pages'
import { Home } from './pages/Home'
import { Privacy } from './pages/Privacy'
import { DeleteAccount } from './pages/DeleteAccount'
import { Terms } from './pages/Terms'

/** Rota değişiminde başa sar; ana sayfadaki #çapaları onurlandır. */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

/** useSeo'yu LocaleContext'in *içinde* çalıştırmak için ince sarmalayıcı. */
function Seo({ pageKey, path }: { pageKey: PageKey; path: string }) {
  useSeo(pageKey, path)
  return null
}

function Page({
  locale,
  pageKey,
  path,
  children,
}: {
  locale: Locale
  pageKey: PageKey
  path: string
  children: ReactNode
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <Seo pageKey={pageKey} path={path} />
      {children}
    </LocaleContext.Provider>
  )
}

const SCREENS: { key: PageKey; path: string; element: ReactNode }[] = [
  { key: 'home', path: '/', element: <Home /> },
  { key: 'privacy', path: '/privacy', element: <Privacy /> },
  { key: 'terms', path: '/terms', element: <Terms /> },
  { key: 'del', path: '/delete', element: <DeleteAccount /> },
]

/**
 * Router'dan bağımsız rota ağacı — istemcide BrowserRouter, prerender'da
 * StaticRouter sarar. Her dil kendi yol önekinde (`/` TR, `/pl` PL).
 */
export function AppRoutes() {
  return (
    <>
      <ScrollManager />
      <Routes>
        {LOCALES.flatMap((locale) =>
          SCREENS.map((screen) => {
            const prefix = localePrefix(locale)
            const routePath = `${prefix}${screen.path === '/' ? '' : screen.path}` || '/'
            return (
              <Route
                key={routePath}
                path={routePath}
                element={
                  <Page locale={locale} pageKey={screen.key} path={screen.path}>
                    {screen.element}
                  </Page>
                }
              />
            )
          }),
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
