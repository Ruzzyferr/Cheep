// oxlint-disable react/only-export-components
// Bu dosya bir build-time SSR giriş noktası, Fast Refresh kapsamında değil:
// prerender'ın ihtiyaç duyduğu her şeyi tek modülden dışa verir.
import { renderToString } from 'react-dom/server'
// React Router 7'de StaticRouter `react-router`'dan geliyor
// (v6'daki `react-router-dom/server` alt yolu artık yok).
import { StaticRouter } from 'react-router'
import { AppRoutes } from './AppRoutes'
import { buildHead, renderHead, PAGES, pageUrl, alternatesFor } from './seo/pages'
import { LOCALES, localePrefix, DICTS } from './i18n'

/**
 * Prerender giriş noktası. `vite build --ssr src/entry-server.tsx` ile derlenir,
 * `scripts/prerender.mjs` bunu Node'da çalıştırıp her rotayı statik HTML'e döker.
 *
 * Buradan çağrılan ağaçta tarayıcıya özgü hiçbir şey **modül yüklenirken**
 * çalışmamalı: WebGL hero (three.js) lazy + istemci-özel, ScrollTrigger ve Lenis
 * effect içinde dinamik import ediliyor. Effect'ler renderToString'de hiç çalışmaz.
 */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppRoutes />
    </StaticRouter>,
  )
}

export { buildHead, renderHead, PAGES, pageUrl, alternatesFor, LOCALES, localePrefix, DICTS }
