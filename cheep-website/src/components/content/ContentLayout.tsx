import type { ReactNode } from 'react'
import { SiteLink as Link } from '../ui/SiteLink'
import { Nav } from '../ui/Nav'
import { Footer } from '../sections/Footer'

export interface Crumb {
  label: string
  href?: string
}

/**
 * İçerik sayfalarının ortak kabuğu: anasayfanın nav'ı ve footer'ı + kırıntı yolu.
 *
 * Kırıntı yolu hem kullanıcı için hem Google için: `BreadcrumbList` JSON-LD'si
 * sayfa başlıklarında (`seo/content.ts`) üretiliyor, buradaki görsel karşılığı.
 * İkisi aynı sırayı göstermeli, yoksa yapılandırılmış veri uyarısı alınır.
 */
export function ContentLayout({
  crumbs,
  children,
  wide = false,
}: {
  crumbs: Crumb[]
  children: ReactNode
  /**
   * Geniş kabuk — ürün ızgaraları için.
   *
   * Varsayılan 1240px okunabilir satır uzunluğu içindir ve METİN sayfalarında
   * doğrudur. Ürün ızgarasında ise 1920px'lik ekranda iki yanda ~340px boşluk
   * bırakıyor ve satır başına yalnızca 4 ürün sığıyordu.
   */
  wide?: boolean
}) {
  return (
    <>
      <Nav />
      <main className="bg-cream pb-20 pt-28 md:pt-32">
        <div className={wide ? 'container-cheep-wide' : 'container-cheep'}>
          <Breadcrumbs crumbs={crumbs} />
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="text-ink-hint">
                /
              </span>
            )}
            {crumb.href ? (
              <Link to={crumb.href} className="inline-flex min-h-6 items-center py-1 transition-colors hover:text-clementine-deep">
                {crumb.label}
              </Link>
            ) : (
              // Son kırıntı mevcut sayfa: bağlantı değil, aria-current ile işaretli.
              <span aria-current="page" className="text-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
