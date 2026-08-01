/**
 * Kategori → ülke sahipliği çözümlemesi.
 *
 * NEDEN VAR: `categories` tablosu uzun süre ülkesizdi ve TR (devletin
 * marketfiyati verisinden türetilen ağaç) ile PL (scraper'ın kendi ağacı) tek
 * bir ağaca sıkıştırıldı. Global `slug @unique` yüzünden iki taksonomi
 * çakışmadan duramadı; yarım kalmış bir migration da TR yapraklarını PL
 * üst kategorilerinin altına taşıdı. Sonuç: aynı anlamı taşıyan ikiz
 * kategoriler ve `meyve-ve-sebze` gibi içi boşaltılmış ölü kabuklar.
 *
 * Burası, o karmaşayı çözerken "hangi kategori kime ait" sorusunu yanıtlayan
 * saf katman. Veritabanına DOKUNMAZ: birleştirme planı canlıda denenmek
 * zorunda kalmadan test edilebilsin diye. Yan etkili kısım
 * `scripts/reconcile-taxonomy.ts` içinde.
 */

export interface CategoryNode {
    id: number;
    slug: string;
    parent_id: number | null;
}

/** Bir kategoride, bir ülkeye ait DOĞRUDAN ürün sayısı (alt kategoriler hariç). */
export interface CategoryProductCount {
    categoryId: number;
    countryId: number;
    n: number;
}

/** parent_id → çocuklar. Tek geçişte kurulur, her sorguda yeniden taranmasın. */
function childIndex(nodes: CategoryNode[]): Map<number, CategoryNode[]> {
    const byParent = new Map<number, CategoryNode[]>();
    for (const node of nodes) {
        if (node.parent_id === null) continue;
        const siblings = byParent.get(node.parent_id);
        if (siblings) siblings.push(node);
        else byParent.set(node.parent_id, [node]);
    }
    return byParent;
}

/**
 * Kategori id → alt ağacındaki tüm kategori id'leri (kendisi dahil).
 *
 * `visited` seti bozuk veriye karşı: parent döngüsü olan bir satır (canlıda
 * görülmedi ama şema bunu engellemiyor) süreci sonsuz döngüde asamamalı.
 */
export function subtreeIds(nodes: CategoryNode[], rootId: number): number[] {
    if (!nodes.some((n) => n.id === rootId)) return [];

    const byParent = childIndex(nodes);
    const out: number[] = [];
    const visited = new Set<number>();
    const stack = [rootId];

    while (stack.length > 0) {
        const id = stack.pop() as number;
        if (visited.has(id)) continue;
        visited.add(id);
        out.push(id);
        for (const child of byParent.get(id) ?? []) stack.push(child.id);
    }

    return out;
}

/** Bir kategorinin alt ağacındaki ürünleri ülke başına toplar. */
export function countryProductTotals(
    nodes: CategoryNode[],
    counts: CategoryProductCount[],
    rootId: number,
): Map<number, number> {
    const ids = new Set(subtreeIds(nodes, rootId));
    const totals = new Map<number, number>();

    for (const c of counts) {
        if (c.n <= 0 || !ids.has(c.categoryId)) continue;
        totals.set(c.countryId, (totals.get(c.countryId) ?? 0) + c.n);
    }

    return totals;
}

/**
 * Her kategori için sahip ülkeleri çözer.
 *
 * - Tek ülke  → kategori o ülkeye taşınır.
 * - Çok ülke  → kategori ülke başına bir kopyaya BÖLÜNÜR (çağıranın işi).
 * - Sıfır ülke → alt ağacında hiç ürün yok, kategori silinir.
 *
 * Ülke listesi artan id sırasında döner; birleştirme planının çıktısı
 * çalıştırmadan çalıştırmaya aynı olsun (dry-run raporu karşılaştırılabilir
 * olmalı).
 */
export function resolveOwners(
    nodes: CategoryNode[],
    counts: CategoryProductCount[],
): Map<number, number[]> {
    const owners = new Map<number, number[]>();

    for (const node of nodes) {
        const totals = countryProductTotals(nodes, counts, node.id);
        owners.set(
            node.id,
            [...totals.keys()].sort((a, b) => a - b),
        );
    }

    return owners;
}
