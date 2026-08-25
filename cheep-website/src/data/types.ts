/**
 * Gecelik build'in backend'den çektiği veri şekli.
 *
 * Backend tarafındaki karşılığı: `cheep-backend-express/src/api/seo/seo.service.ts`.
 * İki taraf elle senkron tutuluyor — tek bir uç ve tek bir tüketici olduğu için
 * paylaşılan paket kurmanın maliyeti kazancından büyük. Şekil değişirse
 * `scripts/fetch-seo-data.mjs` doğrulaması build'i düşürür.
 */

export type Locale = 'tr' | 'pl'

export interface Offer {
  storeSlug: string
  storeName: string
  price: number
  updatedAt: string
}

export interface HistoryPoint {
  date: string
  min: number
}

export interface Product {
  slug: string
  name: string
  brand: string | null
  image: string | null
  categorySlug: string | null
  categoryName: string | null
  offers: Offer[]
  history: HistoryPoint[]
}

export interface Category {
  slug: string
  name: string
  productCount: number
}

export interface Store {
  slug: string
  name: string
  logo: string | null
  branchCount: number
  cityCount: number
  productCount: number
}

export interface City {
  slug: string
  name: string
  branchCount: number
  stores: { slug: string; name: string; branchCount: number }[]
}

export interface CountryData {
  code: string
  name: string
  currency: string
  products: Product[]
  categories: Category[]
  stores: Store[]
  cities: City[]
}

export interface SeoData {
  generatedAt: string
  countries: CountryData[]
}

// ------------------------------------------------------------------ türetilmiş

/** Bir ürünün fiyat özeti — kartlarda ve tablolarda tekrar tekrar hesaplanmasın. */
export interface PriceSummary {
  cheapest: Offer
  priciest: Offer
  min: number
  max: number
  /** En pahalıya göre yüzde tasarruf (0-100). Tek teklif varsa 0. */
  savingPct: number
  /** Mutlak fark. */
  savingAbs: number
  storeCount: number
  /** En taze fiyatın tarihi (ISO). */
  updatedAt: string
}

export function summarize(offers: Offer[]): PriceSummary | null {
  if (!offers.length) return null

  // Backend fiyata göre sıralı gönderiyor ama ona güvenmek kırılgan:
  // sıralama bir gün değişirse sayfalar sessizce yanlış "en ucuz" gösterir.
  const sorted = [...offers].sort((a, b) => a.price - b.price)
  const cheapest = sorted[0]
  const priciest = sorted[sorted.length - 1]
  const savingAbs = priciest.price - cheapest.price
  const savingPct = priciest.price > 0 ? (savingAbs / priciest.price) * 100 : 0

  // `updatedAt` EN TAZE teklifin değil, SAYFANIN ANLATTIĞI teklifin tarihidir.
  //
  // Eskiden bütün tekliflerin MAKSİMUMU alınıyordu. Bayat-fiyat noindex kapısı
  // (`seo/content.ts`) buna baktığı için, HERHANGİ bir teklif taze olduğu
  // sürece sayfa indekslenebilir kalıyordu — başlığı, açıklamayı ve
  // `lowPrice`ı süren EN UCUZ teklif aylar öncesine ait olsa bile.
  // Canlıda doğrulandı: bir ürün sayfası `index, follow` ile duruyor,
  // açıklaması 16 GÜNLÜK bir fiyatı "en ucuz" diye ilan ediyor ve sayfanın
  // kendi tablosu onun yanına "15 gün önce" yazıyordu. Google bu fiyatı zengin
  // sonuçta gösteriyor, kullanıcı kasada başka bir rakamla karşılaşıyor —
  // kuralın önlemek için yazıldığı zararın ta kendisi.
  //
  // Sayfanın manşeti en ucuz teklif olduğuna göre, tazeliği de onunkidir.
  const updatedAt = cheapest.updatedAt

  return {
    cheapest,
    priciest,
    min: cheapest.price,
    max: priciest.price,
    savingPct,
    savingAbs,
    storeCount: new Set(offers.map((o) => o.storeSlug)).size,
    updatedAt,
  }
}

/** Fiyatı bu kadar günden eskiyse sayfa noindex olur (spec §9). */
export const STALE_DAYS = 7

export function isStale(updatedAt: string, now: Date): boolean {
  const age = (now.getTime() - new Date(updatedAt).getTime()) / 86_400_000
  return age > STALE_DAYS
}
