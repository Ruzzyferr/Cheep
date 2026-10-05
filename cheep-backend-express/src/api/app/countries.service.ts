import { prisma } from '../../utils/prisma.client.js';

/**
 * VERİSİ OLAN ülkeler — istemcinin ülke kapısı bunu kullanır.
 *
 * NEDEN SUNUCU SÖYLÜYOR: mobil uygulamada desteklenen ülkeler eskiden yalnızca
 * istemcide sabit bir listeydi (`SUPPORTED_COUNTRY_CODES`). Bu, her ülke
 * açılışında KIRILGAN BİR SIRA dayatıyordu: önce veriyi canlıya al, SONRA
 * sürüm çıkar. Sıra bozulursa — sürüm önce çıkarsa — o ülkedeki kullanıcı
 * kataloğu boş bir uygulamaya düşüyor ve bunun hiçbir hata mesajı olmuyor,
 * sadece hiçbir ürün görünmüyor.
 *
 * Artık istemcinin listesi ÜST SINIR ("bu sürüm hangi ülkeleri
 * çevirebiliyor/biçimlendirebiliyor"), sunucununki ise KAPI ("hangisinde
 * gerçekten fiyat var"). Etkin liste ikisinin KESİŞİMİ. Bunun iki sonucu var:
 *   • Sürüm veriden önce çıkarsa ülke görünmez — zararsız.
 *   • Veri sonradan gelirse ülke, YÜKLÜ uygulamalarda kendiliğinden belirir;
 *     yeni bir sürüm çıkmaya gerek kalmaz.
 *
 * EŞİK: yalnızca "sıfırdan fazla ürün" yetmez — bir ülkede birkaç yüz test
 * ürünü varken ülkeyi açmak da boş bir uygulama hissi verir. `MIN_PRODUCTS`
 * anlamlı bir katalog eşiği koyuyor.
 */

/** Bir ülkenin kullanıcıya gösterilebilmesi için gereken en az ürün sayısı. */
export const MIN_PRODUCTS = Number(process.env.COUNTRY_MIN_PRODUCTS ?? 500);

export interface AvailableCountry {
    code: string;
    name: string;
    currency: string;
    productCount: number;
}

/** Önbellek: bu sorgu ülke başına bir COUNT, ama her açılışta çağrılıyor. */
let cache: { at: number; value: AvailableCountry[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** Test yardımcısı. */
export function __clearAvailableCountriesCache() { cache = null; }

export async function getAvailableCountries(): Promise<AvailableCountry[]> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

    const countries = await prisma.country.findMany({
        select: { id: true, code: true, name: true, currency: true },
        orderBy: { id: 'asc' },
    });

    const rows: AvailableCountry[] = [];
    for (const c of countries) {
        // KURAL DEĞİŞTİ — 5 Eki 2026. Eskiden ülke ancak FİYATLI ürünü varsa
        // listeleniyordu. O kural, fiyatın yalnızca resmi akıştan geldiği
        // dönemde doğruydu: fiyat yoksa kullanıcının yapabileceği bir şey de
        // yoktu.
        //
        // Artık kullanıcı FİYAT BİLDİREBİLİYOR (bkz. api/user-prices). Eski
        // kural bir KISIR DÖNGÜ üretiyor: fiyat yok → ülke seçilemez →
        // kullanıcı bildiremez → hiç fiyat oluşmaz. Türkiye, Polonya,
        // Macaristan ve Romanya veri kaldırıldıktan sonra tam bu tuzağa
        // düştü.
        //
        // Yeni ölçüt: KATALOG var mı. Fiyat yoksa ekranlar "ilk fiyatı sen
        // ekle" diyor ve doğrudan bildirim düğmesi sunuyor.
        const productCount = await prisma.product.count({
            where: { country_id: c.id },
        });
        if (productCount >= MIN_PRODUCTS) {
            rows.push({ code: c.code, name: c.name, currency: c.currency, productCount });
        }
    }

    cache = { at: Date.now(), value: rows };
    return rows;
}
