import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.client.js';
import logger from '../../utils/logger.js';
import { sendPushBatch, type PushMessage } from '../../services/push.service.js';
import { buildPushCopy, resolveLocale } from './push-copy.js';

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
    pushSent: number;
    pushFailed: number;
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
        prev_per_store AS (
            -- Her (ürün, market) için pencereden ÖNCEKİ son bilinen fiyat.
            --
            -- Bu ara adım ŞART. Eskiden prev_best doğrudan "ürünün
            -- pencereden önceki EN SON price_history satırı"ydı - market
            -- ayrımı yapmadan. Oysa current_best marketler ARASI minimum.
            -- Yani iki farklı büyüklük karşılaştırılıyordu ve drop_pct
            -- uydurma çıkıyordu: ürün A marketinde 10 TL (asıl minimum),
            -- B marketinde 100 TL olsun; pencereden önceki son yazma B'nin
            -- 100 TL'si ise, A'nın 10 → 9,50 inişi (%5) kullanıcıya
            -- "%90,5 düştü" diye bildiriliyordu. Ters yönü de aynı derecede
            -- kötü: önceki son satır ucuz bir markete aitse gerçek bir
            -- düşüş eşiğin altında kalıp HİÇ bildirilmiyordu.
            SELECT DISTINCT ON (ph.product_id, ph.store_id)
                   ph.product_id, ph.store_id, ph.price
            FROM price_history ph
            JOIN changed c ON c.product_id = ph.product_id
            WHERE ph.recorded_at < ${since}
            ORDER BY ph.product_id, ph.store_id, ph.recorded_at DESC
        ),
        prev_best AS (
            -- Pencereden önceki MARKETLER ARASI en düşük fiyat - yani
            -- current_best ile aynı türden bir büyüklük.
            SELECT product_id, MIN(price) AS price
            FROM prev_per_store
            GROUP BY product_id
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
    // Push için yalnızca GERÇEKTEN yeni oluşturulanlar toplanır: zaten var olan
    // bir düşüş için ikinci kez bildirim göndermek kullanıcıyı rahatsız eder.
    const fresh = new Map<number, { productName: string; dropPct: number }[]>();

    for (const r of rows) {
        try {
            const row = await prisma.priceDrop.create({
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
                select: { product: { select: { name: true } } },
            });
            created++;
            const list = fresh.get(r.user_id) ?? [];
            list.push({ productName: row.product.name, dropPct: r.drop_pct });
            fresh.set(r.user_id, list);
        } catch (err) {
            // Gün-bazlı unique kısıtı: aynı gün ikinci koşuda çoğaltmaz.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
            logger.warn(`[price-drop] Kayıt eklenemedi (user ${r.user_id}, ürün ${r.product_id}): ${(err as Error).message}`);
        }
    }

    const push = await notifyUsers(fresh);

    const result: DetectResult = {
        scannedUsers: new Set(raw.map((r) => r.user_id)).size,
        created,
        skippedExisting: rows.length - created,
        pushSent: push.sent,
        pushFailed: push.failed,
    };
    logger.info(
        `[price-drop] ${result.scannedUsers} kullanıcı, ${raw.length} aday → ${created} yeni bildirim ` +
        `(${result.skippedExisting} zaten vardı) · push ${push.sent} gönderildi, ${push.failed} başarısız`
    );
    return result;
};

/**
 * Yeni düşüşü olan kullanıcılara TEK bildirim gönderir.
 *
 * Kullanıcı başına tek mesaj: beş ürün ucuzladıysa beş bildirim değil, "5 üründe
 * fiyat düştü" diyen bir tane. Cihazda bildirim yığını oluşturmak en hızlı
 * sessize alınma yolu.
 *
 * Push izni olmayan / token'ı olmayan kullanıcı sessizce atlanır — uygulama içi
 * bildirimi zaten oluşturuldu.
 */
async function notifyUsers(
    fresh: Map<number, { productName: string; dropPct: number }[]>
): Promise<{ sent: number; failed: number }> {
    if (fresh.size === 0) return { sent: 0, failed: 0 };

    const userIds = [...fresh.keys()];
    const tokens = await prisma.userPushToken.findMany({
        where: { user_id: { in: userIds } },
        select: { token: true, user_id: true, locale: true, platform: true, user: { select: { language: true } } },
    });

    const messages: PushMessage[] = tokens.map((t) => {
        const drops = fresh.get(t.user_id)!;
        const locale = resolveLocale(t.locale ?? t.user.language);
        const { title, body } = buildPushCopy(locale, drops);
        return {
            to: t.token,
            title,
            body,
            // Uygulama açıldığında bildirim ekranına götürmek için.
            data: { type: 'price_drop', count: drops.length },
            // iOS token'lari APNs'e yonlendirilir; FCM bunlari kabul etmez.
            platform: t.platform,
        };
    });

    const r = await sendPushBatch(messages);
    return { sent: r.sent, failed: r.failed };
}
