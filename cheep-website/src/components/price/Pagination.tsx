import { Link } from 'react-router-dom'

/**
 * Sayfalama — bilinçli olarak aptal basit.
 *
 * Veri ölçüldü: 120 kategori tek sayfaya sığıyor, 41'inde sayfalama gerekiyor
 * ve en derini 4 sayfa. "1 … 7 8 9 … 42" tipi kısaltmalı bileşen yazmak bu
 * veride çözülecek bir sorun olmadan karmaşıklık eklemek olurdu.
 *
 * Bağlantılar gerçek `<a href>`: JS yüklenmese de gezilebilir ve Googlebot
 * sayfaları takip edebilir. Sonsuz kaydırma bilerek yok — içerik HTML'de
 * olmazsa taranamaz.
 */
export function Pagination({
  current,
  total,
  hrefFor,
  labels,
}: {
  current: number
  total: number
  hrefFor: (page: number) => string
  labels: { nav: string; prev: string; next: string; page: string }
}) {
  if (total <= 1) return null

  const pages = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <nav aria-label={labels.nav} className="mt-12 flex items-center justify-center gap-2">
      {current > 1 && (
        <Link
          to={hrefFor(current - 1)}
          rel="prev"
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep"
        >
          {labels.prev}
        </Link>
      )}

      {pages.map((p) =>
        p === current ? (
          <span
            key={p}
            aria-current="page"
            className="min-h-11 min-w-11 rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-cream"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            to={hrefFor(p)}
            aria-label={`${labels.page} ${p}`}
            className="min-h-11 min-w-11 rounded-full border border-line px-4 py-2 text-center text-sm font-medium text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep"
          >
            {p}
          </Link>
        ),
      )}

      {current < total && (
        <Link
          to={hrefFor(current + 1)}
          rel="next"
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep"
        >
          {labels.next}
        </Link>
      )}
    </nav>
  )
}
