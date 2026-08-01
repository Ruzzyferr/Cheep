import { createContext, useContext } from 'react'
import type { Category, City, Product, Store } from './types'

/**
 * Sayfa verisi taşıyıcısı.
 *
 * İçerik sayfaları statik üretiliyor ama React hydrate ediyor — istemcinin
 * sunucuyla BİREBİR aynı DOM'u üretmesi gerekiyor, yoksa hydration düşer
 * (daha önce ICU farkı yüzünden #418 yaşamıştık). Bu yüzden sayfa verisi
 * HTML'e gömülüyor ve iki taraf da aynı nesneyi okuyor: sunucu doğrudan,
 * istemci `window.__CHEEP__` üzerinden.
 *
 * Veriyi istemcide fetch etmek seçenek değildi: fiyatlar HTML'de olmazsa
 * Googlebot onları göremez ve sayfanın var oluş sebebi ortadan kalkar.
 */

export interface CountryMeta {
  code: string
  currency: string
  generatedAt: string
}

export type PagePayload =
  | {
      kind: 'home'
      /** Bugün en çok ucuzlayan ürünler — anasayfadaki canlı vitrin. */
      drops: { product: Product; changePct: number }[]
      /** Market başına "kaç üründe en ucuz" — karşılaştırma şeridi. */
      stores: { store: Store; cheapestCount: number }[]
      /** Anasayfadan kategorilere görünür giriş. */
      categories: Category[]
      totals: { products: number; stores: number; branches: number }
    }
  | {
      /**
       * Ürünler sayfası. Yalnızca İLK EKRAN prerender edilir: Googlebot
       * ürünleri HTML'de görsün ve API erişilemezse sayfa boş kalmasın.
       * Arama/filtre/sıralama istemciden canlı API'ye gider.
       */
      kind: 'products'
      products: Product[]
      categories: Category[]
      stores: Store[]
      totals: { products: number; stores: number; branches: number }
    }
  | {
      kind: 'browse'
      categories: Category[]
      stores: Store[]
      cities: City[]
      totals: { products: number; branches: number }
    }
  | {
      kind: 'product'
      product: Product
      similar: Product[]
    }
  | {
      kind: 'category'
      category: Category
      products: Product[]
      page: number
      totalPages: number
      stores: Store[]
    }
  | {
      kind: 'store'
      store: Store
      categories: Category[]
      topProducts: Product[]
    }
  | {
      kind: 'storeCategory'
      store: Store
      category: Category
      products: Product[]
    }
  | {
      kind: 'city'
      city: City
      stores: Store[]
    }
  | {
      kind: 'report'
      risers: { product: Product; changePct: number }[]
      fallers: { product: Product; changePct: number }[]
    }
  | {
      kind: 'compare'
      stores: Store[]
      cheapestCounts: Record<string, number>
    }

export interface PageData {
  country: CountryMeta
  payload: PagePayload
}

export const PageDataContext = createContext<PageData | null>(null)

export function usePageData(): PageData {
  const data = useContext(PageDataContext)
  if (!data) {
    // Bu bir programlama hatası: içerik sayfası veri sağlayıcısı olmadan
    // render edilmiş demektir. Sessizce boş sayfa göstermektense patlasın.
    throw new Error('usePageData: PageDataContext sağlanmamış')
  }
  return data
}

/** HTML'e gömülen global. Prerender yazar, istemci okur. */
export const DATA_GLOBAL = '__CHEEP__'

declare global {
  interface Window {
    __CHEEP__?: PageData
  }
}

export function readClientData(): PageData | null {
  if (typeof window === 'undefined') return null
  return window.__CHEEP__ ?? null
}

/**
 * `</script>` dizisi gömülü JSON'u erkenden kapatıp XSS'e kapı açar.
 * Ürün adları scrape'ten geliyor, yani tamamen bize ait değil — kaçırmak şart.
 */
export function serializeData(data: PageData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
