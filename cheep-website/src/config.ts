/**
 * Siteye özgü sabitler. Dilden bağımsız olan her şey burada — çeviri sözlükleri
 * (src/i18n) yalnızca metin tutar, sayı ve URL tutmaz.
 */

export const SITE_URL = 'https://cheep.live'

/**
 * Canlı API. Ürünler sayfasının filtre/arama/sayfalama etkileşimleri buraya
 * gider; ilk ekran prerender edildiği için Googlebot ürünleri yine de HTML'de
 * görür ve API erişilemezse sayfa boş kalmaz.
 */
// `VITE_API_URL` ile geçersiz kılınabilir. Yerelde ürünler sayfasının
// filtre/arama akışını denemek için şart: prod adresi sabit olsaydı yerel
// backend'e karşı test edilemezdi.
export const API_URL = import.meta.env.VITE_API_URL || 'https://api.cheep.live/api/v1'

export const PLAY_PACKAGE = 'com.cheep.mobile'

/** Play Console'da web trafiğini ayırt edebilmek için UTM etiketli. */
export const PLAY_URL =
  `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}` +
  '&utm_source=cheep_website&utm_medium=web&utm_campaign=site_download'

export const SUPPORT_EMAIL = 'destek@cheep.live'
export const PRIVACY_EMAIL = 'gizlilik@cheep.live'

/**
 * Canlı kapsam sayıları — prod'dan doğrulandı (2026-07-31).
 * Ürün: /api/v1/products?limit=1 pagination.total (x-country: TR|PL)
 * Şube: prod Postgres store_branches, ülkeye göre.
 * DE/CH/SE henüz açılmadı; sayılar planlanan kapsamı gösterir.
 */
/**
 * Ülke kapsamı. `live` YALNIZCA veri gerçekten yayındaysa true olur —
 * bu bir pazarlama vaadi değil, doğrulanabilir bir olgu.
 *
 * `branches` sayıları OSM/kaynak şube ithalatından gelen gerçek sayılardır;
 * ülke canlıya alınırken ilk şube hasadının çıktısıyla güncellenir.
 * HR/HU/RO için sayı henüz YAZILMADI (0) çünkü prod'da ilk hasat koşulmadı;
 * uydurma bir sayı yazmak sitede yanlış bir iddia olurdu.
 */
export const COVERAGE = {
  TR: { branches: 10247, live: true },
  PL: { branches: 13422, live: true },
  HR: { branches: 0, live: false },
  HU: { branches: 0, live: false },
  RO: { branches: 0, live: false },
  DE: { branches: 4925, live: false },
  CH: { branches: 2008, live: false },
  SE: { branches: 1554, live: false },
} as const

/** Ana sayfadaki sayaçlar. Yuvarlanmış — "+" ekiyle gösterilir. */
export const HEADLINE_STATS = {
  products: 55000, // TR 15.619 + PL 39.743
  branches: 23500, // TR 10.247 + PL 13.422
  countries: 5,
  avgSavingPct: 23,
}
