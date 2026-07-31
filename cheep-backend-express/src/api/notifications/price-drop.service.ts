import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.client.js';
import logger from '../../utils/logger.js';

/**
 * Fiyat düşüşü tespiti.
 *
 * Kullanıcının AKTİF listelerindeki her ürün için, o ülkedeki mağazalar
 * arasındaki EN DÜŞÜK fiyatın düşüp düşmediğine bakılır.
 *
 * Neden ürün başına, mağaza başına değil: kullanıcıyı ilgilendiren sinyal
 * "listemdeki şu ürün ucuzladı". Mağaza başına bildirim, aynı ürün için beş
 * ayrı bildirim üretip gürültüye boğardı.
 *
 * Veri kaynağı `price_history`: oraya yalnızca fiyat GERÇEKTEN değiştiğinde
 * satır yazılıyor (store-prices.service `recordPriceHistory`), yani her satır
 * zaten bir değişim olayı — ayrıca durum tutmaya gerek yok.
 */

/** En az bu kadar düşüş bildirim üretir. Yüzde: TRY ve PLN için ayrı eşik gerekmesin. */
export const MIN_DROP_PCT = 5;

/** Kullanıcı başına tek koşuda en fazla bu kadar bildirim (en büyük düşüşler). */
export const MAX_PER_USER = 5;

export interface DetectResult {
    scannedUsers: number;
    created: number;
    skippedExisting: number;
}

interface Candidate {
    user_id: number;
    product_id: number;
    country_id: number;
    store_id: number;
    old_price: Prisma.Decimal;
    new_price: Prisma.Decimal;
    drop_pct: number;
}

/**
 * Adayları tek sorguda çıkarır.
 *
 * - `current`: her (ürün) için bugünkü en düşük fiyat ve hangi markette.
 * - `previous`: aynı ürün için, bu en düşük fiyattan ÖNCEKİ en düşük fiyat.
 *
 * `since` penceresi: yalnızca son N saatte fiyatı değişmiş ürünlere bakılır;
 * aksi halde her koşuda tüm katalog taranırdı.
 */
async function findCandidates(sinceHours: number): Promise<Candidate[]> {
    const since = new Date(Date.now() - sinceHours * 3600_000);

    return prisma.$queryRaw<Candidate[]>`
        WITH changed AS (
            -- Son pencerede fiyatı değişen ürünler (price_history yalnızca
            -- değişimde yazıldığı için bu liste zaten dar).
            SELECT DISTINCT ph.product_id
            FROM price_history ph
            WHERE ph.recorded_at >= ${since}
        ),
        watched AS (
            -- Aktif listelerde bu ürünleri tutan kullanıcılar.
            SELECT DISTINCT l.user_id, li.product_id, l.country_id
            FROM lists l
            JOIN list_items li ON li.list_id = l.id
            JOIN changed c ON c.product_id = li.product_id
            WHERE l.status = 'active'
        ),
        current_best AS (
            -- Ürünün ŞU ANKİ en düşük fiyatı ve markette.
            SELECT DISTINCT ON (sp.product_id)
                   sp.product_id, sp.store_id, sp.price
            FROM store_prices sp
            JOIN changed c ON c.product_id = sp.product_id
            ORDER BY sp.product_id, sp.price ASC, sp.store_id ASC
        ),
        prev_best AS (
            -- Aynı ürün için, mevcut en düşükten ÖNCEKİ en düşük fiyat.
            SELECT DISTINCT ON (ph.product_id)
                   ph.product_id, ph.price
            FROM price_history ph
            JOIN current_best cb ON cb.product_id = ph.product_id
            WHERE ph.recorded_at < ${since}
            ORDER BY ph.product_id, ph.recorded_at DESC
        )
        SELECT w.user_id,
               w.product_id,
               w.country_id,
               cb.store_id,
               pb.price AS old_price,
               cb.price AS new_price,
               ROUND(((pb.price - cb.price) / pb.price * 100)::numeric, 2)::float8 AS drop_pct
        FROM watched w
        JOIN current_best cb ON cb.product_id = w.product_id
        JOIN prev_best   pb ON pb.product_id = w.product_id
        WHERE pb.price > 0
          AND cb.price < pb.price
          AND ((pb.price - cb.price) / pb.price * 100) >= ${MIN_DROP_PCT}
        ORDER BY w.user_id, drop_pct DESC
    `;
}

/**
 * Adayları kullanıcı başına en büyük N düşüşe indirger.
 * Sorgu zaten kullanıcı içinde drop_pct'ye göre azalan sıralı geliyor.
 */
export function capPerUser(rows: Candidate[], max = MAX_PER_USER): Candidate[] {
    const seen = new Map<number, number>();
    const out: Candidate[] = [];
    for (const r of rows) {
        const n = seen.get(r.user_id) ?? 0;
        if (n >= max) continue;
        seen.set(r.user_id, n + 1);
        out.push(r);
    }
    return out;
}

/**
 * Tespiti çalıştırır ve `price_drops` satırlarını yazar.
 *
 * Bu adım push'tan BAĞIMSIZ: satırlar izin olsun olmasın oluşur, uygulama içi
 * zil/liste her hâlükârda çalışır. Push gönderimi ayrı bir katman.
 */
export const detectPriceDrops = async (sinceHours = 26): Promise<DetectResult> => {
    const raw = await findCandidates(sinceHours);
    const rows = capPerUser(raw);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let created = 0;
    for (const r of rows) {
        try {
            await prisma.priceDrop.create({
                data: {
                    user_id: r.user_id,
                    product_id: r.product_id,
                    country_id: r.country_id,
                    store_id: r.store_id,
                    old_price: r.old_price,
                    new_price: r.new_price,
                    drop_pct: r.drop_pct,
                    dropped_on: today,
                },
            });
            created++;
        } catch (err) {
            // Gün-bazlı unique kısıtı: aynı gün ikinci koşuda çoğaltmaz.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
            logger.warn(`[price-drop] Kayıt eklenemedi (user ${r.user_id}, ürün ${r.product_id}): ${(err as Error).message}`);
        }
    }

    const result: DetectResult = {
        scannedUsers: new Set(raw.map((r) => r.user_id)).size,
        created,
        skippedExisting: rows.length - created,
    };
    logger.info(
        `[price-drop] ${result.scannedUsers} kullanıcı, ${raw.length} aday → ${created} yeni bildirim (${result.skippedExisting} zaten vardı)`
    );
    return result;
};
