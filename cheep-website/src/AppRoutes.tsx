import { useEffect, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { LocaleContext, LOCALES, localePrefix, type Locale } from './i18n'
import { useSeo } from './seo/useSeo'
import type { PageKey } from './seo/pages'
import { Home } from './pages/Home'
import { Privacy } from './pages/Privacy'
import { DeleteAccount } from './pages/DeleteAccount'
import { Terms } from './pages/Terms'
import { ProductPage } from './pages/content/ProductPage'
import { CategoryPage } from './pages/content/CategoryPage'
import { StorePage } from './pages/content/StorePage'
import { StoreCategoryPage } from './pages/content/StoreCategoryPage'
import { CityPage } from './pages/content/CityPage'
import { ReportPage } from './pages/content/ReportPage'
import { ComparePage } from './pages/content/ComparePage'
import { BrowsePage } from './pages/content/BrowsePage'
import { PageDataContext, readClientData, type PageData } from './data/context'
import { ContentRoute } from './components/content/ContentRoute'
import { segment, type ContentKind } from './data/routes'

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
 * İçerik (SEO) sayfaları. Tanıtım sayfalarından ayrı ele alınıyorlar çünkü
 * dile göre ÇİFT DEĞİLLER: ürün kataloğu ülkeye özel, `/urun/...` yalnızca
 * TR'de, `/pl/produkt/...` yalnızca PL'de var. Ayrıca verilerini
 * PageDataContext'ten alıyorlar.
 */
const CONTENT_SCREENS: { kind: ContentKind; suffix: string; expect: string; element: ReactNode }[] = [
  { kind: 'product', suffix: '/:slug', expect: 'product', element: <ProductPage /> },
  { kind: 'category', suffix: '/:slug', expect: 'category', element: <CategoryPage /> },
  { kind: 'category', suffix: '/:slug/:page', expect: 'category', element: <CategoryPage /> },
  { kind: 'store', suffix: '/:slug', expect: 'store', element: <StorePage /> },
  { kind: 'store', suffix: '/:slug/:category', expect: 'storeCategory', element: <StoreCategoryPage /> },
  { kind: 'city', suffix: '/:slug', expect: 'city', element: <CityPage /> },
  { kind: 'report', suffix: '', expect: 'report', element: <ReportPage /> },
  { kind: 'compare', suffix: '', expect: 'compare', element: <ComparePage /> },
  { kind: 'browse', suffix: '', expect: 'browse', element: <BrowsePage /> },
]

/**
 * Router'dan bağımsız rota ağacı — istemcide BrowserRouter, prerender'da
 * StaticRouter sarar. Her dil kendi yol önekinde (`/` TR, `/pl` PL).
 */
export function AppRoutes({ pageData }: { pageData?: PageData | null } = {}) {
  // Sunucuda prerender veriyi doğrudan geçirir; istemcide HTML'e gömülü
  // globalden okunur. İkisi aynı nesne → hydration tutar.
  const data = pageData ?? readClientData()

  return (
    <PageDataContext.Provider value={data}>
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
        {LOCALES.flatMap((locale) =>
          CONTENT_SCREENS.map((screen) => {
            const path = `${localePrefix(locale)}/${segment(locale, screen.kind)}${screen.suffix}`
            return (
              <Route
                key={path}
                path={path}
                element={
                  <LocaleContext.Provider value={locale}>
                    <ContentRoute expect={screen.expect}>{screen.element}</ContentRoute>
                  </LocaleContext.Provider>
                }
              />
            )
          }),
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageDataContext.Provider>
  )
}
