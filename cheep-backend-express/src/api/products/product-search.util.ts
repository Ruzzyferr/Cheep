
/** Arama girdisini temizler: baş/son boşluk, iç boşlukları tekle, 80 karakterle sınırla. */
export function normalizeSearchInput(q: string): string {
    return (q ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

/** Sorguyu kelime token'larına böler (boşları atar, en fazla 6 token). */
export function tokenizeSearch(q: string): string[] {
    return normalizeSearchInput(q)
        .split(' ')
        .filter(t => t.length > 0)
        .slice(0, 6);
}

/** Sorgu yalnızca rakam ve ≥6 hane ise barkod kabul edilir. */
export function isBarcodeQuery(q: string): boolean {
    return /^\d{6,}$/.test((q ?? '').trim());
}
