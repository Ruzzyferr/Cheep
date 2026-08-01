import { useContext, type ReactNode } from 'react'
import { SiteLink as Link } from '../ui/SiteLink'
import { LocaleContext } from '../../i18n'
import { CONTENT } from '../../i18n/content'
import { PageDataContext } from '../../data/context'
import { Nav } from '../ui/Nav'
import { Footer } from '../sections/Footer'

/**
 * İçerik rotalarının koruması.
 *
 * İçerik rotaları desene göre eşleşiyor (`/urun/:slug`), yani var olmayan bir
 * slug da rotayı eşleştiriyor — ama gömülü veri gelmiyor. Caddy'nin SPA
 * geri dönüşü bu isteklere index.html sunduğu için sayfa veri olmadan render
 * ediliyordu ve `usePageData` fırlatıyordu: kullanıcı beyaz ekran görüyordu.
 *
 * Google silinmiş URL'leri aylarca tekrar denediği için bu senaryo teorik
 * değil. Artık düzgün bir "bulunamadı" ekranı ve ana sayfaya dönüş var.
 */
export function ContentRoute({ expect, children }: { expect: string; children: ReactNode }) {
  const data = useContext(PageDataContext)

  if (!data || data.payload.kind !== expect) return <NotFound />
  return <>{children}</>
}

function NotFound() {
  const locale = useContext(LocaleContext)
  const c = CONTENT[locale]
  const home = locale === 'tr' ? '/' : '/pl'

  const title = locale === 'tr' ? 'Bu sayfa bulunamadı' : 'Nie znaleziono strony'
  const body =
    locale === 'tr'
      ? 'Aradığın ürün kaldırılmış veya adresi değişmiş olabilir. Ana sayfadan kategorilere göz atabilirsin.'
      : 'Produkt mógł zostać usunięty lub zmienił adres. Wróć na stronę główną i przejrzyj kategorie.'

  return (
    <>
      <Nav />
      <main className="flex min-h-[60vh] items-center bg-cream pt-28">
        <div className="container-cheep text-center">
          <h1 className="text-3xl font-bold text-ink md:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg text-ink-soft">{body}</p>
          <Link
            to={home}
            className="mt-8 inline-flex min-h-11 items-center rounded-full bg-clementine-deep px-6 py-3 font-semibold text-white transition-colors hover:bg-clementine-dark"
          >
            {c.breadcrumbHome}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
