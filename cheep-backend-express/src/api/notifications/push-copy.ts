/**
 * Push bildirim metinleri. Kullanıcının `language` alanına göre seçilir;
 * bilinmeyen dilde İngilizce'ye düşülür (Türkçe'ye değil: TR bilmeyen bir
 * kullanıcıya Türkçe bildirim göndermek, İngilizce'den daha kötü).
 */

export type Locale = 'tr' | 'en' | 'de' | 'pl' | 'sv';

const COPY: Record<Locale, { title: (n: number) => string; single: (p: string, pct: number) => string; many: (n: number) => string }> = {
    tr: {
        title: (n) => (n === 1 ? 'Listendeki ürün ucuzladı' : 'Listende fiyatlar düştü'),
        single: (p, pct) => `${p} %${pct} ucuzladı. Yeni fiyatı görmek için dokun.`,
        many: (n) => `${n} üründe fiyat düştü. Listene göz at.`,
    },
    en: {
        title: (n) => (n === 1 ? 'An item on your list got cheaper' : 'Prices dropped on your list'),
        single: (p, pct) => `${p} is ${pct}% cheaper. Tap to see the new price.`,
        many: (n) => `${n} items dropped in price. Check your list.`,
    },
    de: {
        title: (n) => (n === 1 ? 'Ein Artikel auf deiner Liste ist günstiger' : 'Preise auf deiner Liste gesunken'),
        single: (p, pct) => `${p} ist ${pct}% günstiger. Tippe für den neuen Preis.`,
        many: (n) => `Bei ${n} Artikeln sind die Preise gefallen.`,
    },
    pl: {
        title: (n) => (n === 1 ? 'Produkt z Twojej listy staniał' : 'Ceny na Twojej liście spadły'),
        single: (p, pct) => `${p} jest tańszy o ${pct}%. Dotknij, aby zobaczyć nową cenę.`,
        many: (n) => `Ceny spadły w ${n} produktach. Sprawdź swoją listę.`,
    },
    sv: {
        title: (n) => (n === 1 ? 'En vara på din lista blev billigare' : 'Priser sjönk på din lista'),
        single: (p, pct) => `${p} är ${pct}% billigare. Tryck för att se nya priset.`,
        many: (n) => `${n} varor har sjunkit i pris. Kolla din lista.`,
    },
};

const FALLBACK: Locale = 'en';

export const resolveLocale = (raw?: string | null): Locale => {
    const code = (raw ?? '').slice(0, 2).toLowerCase();
    return (code in COPY ? code : FALLBACK) as Locale;
};

/** Bir kullanıcının o koşudaki düşüşleri için tek bildirim metni üretir. */
export const buildPushCopy = (
    locale: Locale,
    drops: { productName: string; dropPct: number }[]
): { title: string; body: string } => {
    const c = COPY[locale];
    if (drops.length === 1) {
        const d = drops[0]!;
        return { title: c.title(1), body: c.single(d.productName, Math.round(d.dropPct)) };
    }
    return { title: c.title(drops.length), body: c.many(drops.length) };
};
