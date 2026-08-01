/**
 * Ürünler sayfasının sayfalaması.
 *
 * `price/Pagination` bilinçli olarak TÜM sayfa numaralarını basıyor: kategori
 * sayfaları en fazla 4 sayfa ve bağlantıların taranabilir olması gerekiyor.
 * Burada katalog 15.000+ ürün, yani ~390 sayfa — aynı bileşen ekranı numara
 * çorbasına çevirirdi. Ayrıca bu sayfalar taranmak İÇİN değil: kanonik
 * taranabilir yollar kategori ve ürün sayfaları.
 *
 * Bu yüzden kompakt: önceki / sayfa göstergesi / sonraki. Durum URL'de
 * yaşadığı için geri tuşu ve link paylaşımı yine çalışır.
 */
export function ProductsPagination({
  current,
  total,
  onNavigate,
  labels,
}: {
  current: number
  total: number
  onNavigate: (page: number) => void
  labels: { nav: string; prev: string; next: string; page: string }
}) {
  if (total <= 1) return null

  const go = (page: number) => {
    onNavigate(page)
    // Sayfa değişince listenin başına dön: kullanıcı aynı kaydırma
    // konumunda kalırsa yeni sayfanın ortasına düşmüş gibi görünür.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const btn =
    'inline-flex min-h-11 items-center rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-clementine hover:text-clementine-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft'

  return (
    <nav aria-label={labels.nav} className="mt-12 flex items-center justify-center gap-3">
      <button type="button" onClick={() => go(current - 1)} disabled={current <= 1} className={btn}>
        {labels.prev}
      </button>

      <span aria-current="page" className="text-sm tabular-nums text-ink-soft">
        {labels.page} {current} / {total}
      </span>

      <button
        type="button"
        onClick={() => go(current + 1)}
        disabled={current >= total}
        className={btn}
      >
        {labels.next}
      </button>
    </nav>
  )
}
