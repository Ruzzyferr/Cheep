import { useEffect } from 'react'
import { buildHead, type PageKey } from './pages'
import { useLocale } from '../i18n'

/**
 * Head'i istemci tarafı gezinmede senkron tutar.
 *
 * İlk yüklemede iş yapmasına gerek yok — prerender edilmiş HTML zaten doğru
 * etiketleri içerir — ama SPA içinde rota değişince (ör. /pl → /pl/terms)
 * başlık ve canonical'ın bayat kalmaması için gerekli. Prerender'ın bastığı
 * etiketler `data-seo` ile işaretli; burada toptan silinip yeniden yazılırlar.
 */
export function useSeo(key: PageKey, path: string) {
  const locale = useLocale()

  useEffect(() => {
    const head = buildHead(locale, key, path)

    document.documentElement.lang = head.lang
    document.title = head.title

    for (const el of Array.from(document.head.querySelectorAll('[data-seo]'))) {
      el.remove()
    }

    const frag = document.createDocumentFragment()

    for (const m of head.meta) {
      const el = document.createElement('meta')
      el.setAttribute('data-seo', '')
      if (m.name) el.setAttribute('name', m.name)
      else el.setAttribute('property', m.property!)
      el.setAttribute('content', m.content)
      frag.appendChild(el)
    }

    for (const l of head.links) {
      const el = document.createElement('link')
      el.setAttribute('data-seo', '')
      el.setAttribute('rel', l.rel)
      if (l.hreflang) el.setAttribute('hreflang', l.hreflang)
      el.setAttribute('href', l.href)
      frag.appendChild(el)
    }

    for (const block of head.jsonLd) {
      const el = document.createElement('script')
      el.setAttribute('data-seo', '')
      el.type = 'application/ld+json'
      el.textContent = JSON.stringify(block)
      frag.appendChild(el)
    }

    document.head.appendChild(frag)
  }, [locale, key, path])
}
