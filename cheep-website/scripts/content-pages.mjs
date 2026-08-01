/**
 * SEO verisinden üretilecek sayfaların listesini çıkarır.
 *
 * Prerender'dan ayrı bir modül: burası saf hesap (veri → sayfa listesi),
 * prerender ise dosya yazma işi. Ayrılınca ikisi de tek başına anlaşılır
 * ve sayfa envanteri test edilebilir olur.
 */

const PAGE_SIZE = 60
/** Ürün sayfasında gösterilen "benzer ürün" adedi. */
const SIMILAR_COUNT = 6
/** Market sayfasındaki öne çıkan ürün adedi. */
const STORE_TOP_COUNT = 10
/** Zam raporundaki her listenin uzunluğu. */
const REPORT_COUNT = 20
/** Rapora girmek için gereken en az yüzde değişim — gürültüyü eler. */
const REPORT_MIN_PCT = 3

const cheapest = (p) => p.offers.reduce((min, o) => (o.price < min.price ? o : min), p.offers[0])

/**
 * Listelerde gösterilecek ürünün ince hali.
 *
 * 28 günlük fiyat geçmişi yalnızca ürün sayfasındaki grafikte kullanılıyor;
 * kartlarda hiç okunmuyor. Yine de her kategori sayfasına 60 ürünün tam
 * geçmişini gömmek sayfa başına on binlerce karakter demekti — 7.661 sayfada
 * yüzlerce megabayt. Kart neyi çiziyorsa onu gönderiyoruz.
 */
function slim(p) {
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.image,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    offers: p.offers,
    history: [],
  }
}

/**
 * 28 günlük seride ilk ve son nokta arasındaki yüzde değişim.
 *
 * En az ÜÇ nokta istiyoruz. Başta beş yazmıştım ama veri ölçülünce TR'de
 * 5+ noktalı tek ürün olmadığı görüldü (fiyat geçmişi yalnızca fiyat
 * DEĞİŞTİĞİNDE yazılıyor, günlük anlık görüntü tutulmuyor) — eşik bütün
 * bölümü boşaltıyordu. İki nokta tek bir ölçüm hatasına karşı savunmasız,
 * üç nokta gerçek bir seyir gösteriyor. Geçmiş derinleştikçe yükseltilebilir.
 */
const MIN_HISTORY_POINTS = 3

function changePct(product) {
  const h = product.history
  if (!h || h.length < MIN_HISTORY_POINTS) return null
  const first = h[0].min
  const last = h[h.length - 1].min
  if (!first) return null
  return ((last - first) / first) * 100
}

export function buildPageList(country, locale, routes) {
  const pages = []
  const { products, categories, stores, cities } = country

  // Kategori slug'ına göre ürün indeksi — benzer ürünler ve kategori
  // sayfaları için tekrar tekrar filtrelemeyelim.
  const byCategory = new Map()
  for (const p of products) {
    if (!p.categorySlug) continue
    if (!byCategory.has(p.categorySlug)) byCategory.set(p.categorySlug, [])
    byCategory.get(p.categorySlug).push(p)
  }

  const storeBySlug = new Map(stores.map((s) => [s.slug, s]))
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]))

  // -------------------------------------------------------------- ürünler
  for (const product of products) {
    const siblings = product.categorySlug ? byCategory.get(product.categorySlug) || [] : []
    const similar = siblings.filter((p) => p.slug !== product.slug).slice(0, SIMILAR_COUNT).map(slim)
    pages.push({
      path: routes.productPath(locale, product.slug),
      payload: { kind: 'product', product, similar },
      priority: '0.8',
      changefreq: 'daily',
    })
  }

  // ------------------------------------------------------------ kategoriler
  for (const category of categories) {
    const list = byCategory.get(category.slug) || []
    // Ucuzdan pahalıya değil, tasarruf potansiyeline göre: kullanıcıyı asıl
    // ilgilendiren "nerede ne kadar kazanırım".
    const sorted = [...list].sort((a, b) => {
      const sa = Math.max(...a.offers.map((o) => o.price)) - Math.min(...a.offers.map((o) => o.price))
      const sb = Math.max(...b.offers.map((o) => o.price)) - Math.min(...b.offers.map((o) => o.price))
      return sb - sa
    })
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))

    // Bu kategoride ürünü olan marketler — kategori × market bağlantıları için.
    const catStores = stores.filter((s) =>
      list.some((p) => p.offers.some((o) => o.storeSlug === s.slug)),
    )

    for (let page = 1; page <= totalPages; page++) {
      pages.push({
        path: routes.categoryPath(locale, category.slug, page),
        payload: {
          kind: 'category',
          category,
          products: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(slim),
          page,
          totalPages,
          stores: catStores,
        },
        priority: page === 1 ? '0.7' : '0.4',
        changefreq: 'daily',
      })
    }
  }

  // --------------------------------------------------------------- marketler
  for (const store of stores) {
    const storeProducts = products.filter((p) => p.offers.some((o) => o.storeSlug === store.slug))

    // Bu markette bulunan kategoriler.
    const storeCategories = categories.filter((c) =>
      storeProducts.some((p) => p.categorySlug === c.slug),
    )

    // Öne çıkanlar: bu markette en ucuz olduğu ve farkın en büyük olduğu ürünler.
    const top = storeProducts
      .filter((p) => cheapest(p).storeSlug === store.slug)
      .sort((a, b) => {
        const da = Math.max(...a.offers.map((o) => o.price)) - Math.min(...a.offers.map((o) => o.price))
        const db = Math.max(...b.offers.map((o) => o.price)) - Math.min(...b.offers.map((o) => o.price))
        return db - da
      })
      .slice(0, STORE_TOP_COUNT)
      .map(slim)

    pages.push({
      path: routes.storePath(locale, store.slug),
      payload: { kind: 'store', store, categories: storeCategories, topProducts: top },
      priority: '0.7',
      changefreq: 'daily',
    })

    for (const category of storeCategories) {
      const list = storeProducts.filter((p) => p.categorySlug === category.slug).slice(0, PAGE_SIZE).map(slim)
      if (list.length === 0) continue
      pages.push({
        path: routes.storeCategoryPath(locale, store.slug, category.slug),
        payload: { kind: 'storeCategory', store, category, products: list },
        priority: '0.6',
        changefreq: 'daily',
      })
    }
  }

  // ---------------------------------------------------------------- şehirler
  for (const city of cities) {
    pages.push({
      path: routes.cityPath(locale, city.slug),
      payload: {
        kind: 'city',
        city,
        stores: city.stores.map((s) => storeBySlug.get(s.slug)).filter(Boolean),
      },
      priority: '0.6',
      changefreq: 'weekly',
    })
  }

  // ------------------------------------------------------------------ rapor
  const withChange = products
    .map((p) => ({ product: slim(p), changePct: changePct(p) }))
    .filter((x) => x.changePct !== null && Math.abs(x.changePct) >= REPORT_MIN_PCT)

  pages.push({
    path: routes.reportPath(locale),
    payload: {
      kind: 'report',
      risers: withChange
        .filter((x) => x.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct)
        .slice(0, REPORT_COUNT),
      fallers: withChange
        .filter((x) => x.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)
        .slice(0, REPORT_COUNT),
    },
    priority: '0.9',
    changefreq: 'daily',
  })

  // ---------------------------------------------------------------- ürünler
  // Kataloğun tamamında arama/filtre/sıralama sunan sayfa. Yalnızca ilk ekran
  // üretilir; filtre kombinasyonlarının tamamını önceden üretmek mümkün değil
  // (15.000+ ürün × kategori × market × sıralama). Sonrası canlı API'den.
  const PRODUCTS_FIRST_SCREEN = 40
  pages.push({
    path: routes.productsPath(locale),
    payload: {
      kind: 'products',
      // İlk ekran: en çok markette bulunan ürünler — karşılaştırma değeri en
      // yüksek olanlar. API'nin filtresiz varsayılan sıralamasıyla aynı.
      products: [...products]
        .sort((a, b) => b.offers.length - a.offers.length)
        .slice(0, PRODUCTS_FIRST_SCREEN),
      categories,
      stores,
      cities,
      totals: {
        products: products.length,
        stores: stores.length,
        branches: stores.reduce((sum, s) => sum + s.branchCount, 0),
      },
    },
    priority: '0.9',
    changefreq: 'daily',
  })

  // --------------------------------------------------------------- karşılaştır
  const cheapestCounts = {}
  for (const p of products) {
    const c = cheapest(p)
    cheapestCounts[c.storeSlug] = (cheapestCounts[c.storeSlug] || 0) + 1
  }

  pages.push({
    path: routes.comparePath(locale),
    payload: { kind: 'compare', stores, cheapestCounts },
    priority: '0.9',
    changefreq: 'daily',
  })

  // categoryBySlug yalnızca doğrulama için: kategorisi bilinmeyen sayfa üretmeyelim.
  const orphan = pages.filter(
    (p) => p.payload.kind === 'storeCategory' && !categoryBySlug.has(p.payload.category.slug),
  )
  if (orphan.length) throw new Error(`content-pages: ${orphan.length} sayfa bilinmeyen kategoriye bağlı`)

  return pages
}

/** Anasayfadaki en çok kaç ürün gösterilecek. */
const HOME_DROPS = 6
/** Anasayfa şeridinde kaç market. */
const HOME_STORES = 8
/** Anasayfada gösterilen kategori sayısı — gerisi keşif sayfasında. */
const HOME_CATEGORIES = 18

/**
 * Anasayfanın canlı vitrini için veri.
 *
 * İçerik sayfalarıyla aynı hesapları kullanıyor ama anasayfa tek sayfa
 * olduğu için ayrı ve küçük: 6 düşüş + market sıralaması + toplamlar.
 */
export function buildHomePayload(country) {
  const { products, stores, categories } = country

  const drops = products
    .map((p) => ({ product: slim(p), changePct: changePct(p) }))
    .filter((x) => x.changePct !== null && x.changePct <= -REPORT_MIN_PCT)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, HOME_DROPS)

  const counts = {}
  for (const p of products) {
    const c = cheapest(p)
    counts[c.storeSlug] = (counts[c.storeSlug] || 0) + 1
  }

  const ranked = stores
    .map((store) => ({ store, cheapestCount: counts[store.slug] || 0 }))
    .sort((a, b) => b.cheapestCount - a.cheapestCount)
    .slice(0, HOME_STORES)

  return {
    kind: 'home',
    drops,
    stores: ranked,
    categories: categories.slice(0, HOME_CATEGORIES),
    totals: {
      products: products.length,
      stores: stores.length,
      branches: stores.reduce((sum, s) => sum + s.branchCount, 0),
    },
  }
}
