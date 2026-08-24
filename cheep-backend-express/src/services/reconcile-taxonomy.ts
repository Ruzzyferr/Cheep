/**
 * Taksonomi birleştirme PLANLAYICISI.
 *
 * `20260801200000_category_country_scope` migration'ı `country_id`'yi kabaca —
 * alt ağaçtaki ürünlerin ÇOĞUNLUĞUNA göre — doldurur. Bu tek başına yetmez:
 * `icecek` kategorisinde hem 2.028 TR hem 3.938 PL ürünü vardı; çoğunluk PL
 * dedi ve 2.028 TR ürünü bir PL kategorisinde öksüz kaldı. Doğrusu kategoriyi
 * ülke başına kopyaya BÖLMEK.
 *
 * Burası saf: veritabanına dokunmaz, uygulanabilir bir işlem listesi üretir.
 * Yan etkili uygulayıcı `scripts/reconcile-taxonomy.ts` içinde. Bölme mantığı
 * canlıda denenmek zorunda kalmasın diye ayrıldı.
 */

import { slugifyName } from '../config/category-i18n.js';

export interface OwnedCategory {
    id: number;
    slug: string;
    name: string;
    country_id: number;
    parent_id: number | null;
    display_order: number;
    icon_url: string | null;
}

/** Bir kategoride, bir ülkeye ait DOĞRUDAN ürün sayısı. */
export interface ProductCount {
    categoryId: number;
    countryId: number;
    n: number;
}

/**
 * Plan içinde yaratılan kategorilerin henüz id'si yoktur; birbirlerine
 * `tempId` ile referans verirler. Uygulayıcı işlemleri SIRAYLA işler ve
 * tempId → gerçek id eşlemesini yolda kurar.
 */
export type CategoryRef = number | string;

export type ReconcileOp =
    | {
          kind: 'createCategory';
          tempId: string;
          countryId: number;
          slug: string;
          name: string;
          parentRef: CategoryRef | null;
          display_order: number;
          icon_url: string | null;
          /** Hangi kategoriden kopyalandı (rapor ve hata ayıklama için). */
          clonedFrom: number;
      }
    | { kind: 'moveProducts'; fromCategoryId: number; countryId: number; toRef: CategoryRef; n: number }
    | {
          /**
           * Aynı ülkedeki ikiz kategoriyi kanoniğe katar: ürünleri ve
           * çocukları hedefe taşır, sonra kaynağı siler.
           */
          kind: 'mergeCategory';
          fromCategoryId: number;
          fromSlug: string;
          countryId: number;
          toRef: CategoryRef;
          toSlug: string;
          reparentChildIds: number[];
      }
    | {
          /**
           * Kategoriyi KENDİ ülkesindeki parent'a bağlar. Migration ülkeyi her
           * kategoriye bağımsız atadığı için ağaç ülkeler arasında kırılabildi.
           */
          kind: 'reparent';
          categoryId: number;
          countryId: number;
          slug: string;
          toRef: CategoryRef;
          /**
           * Neden taşınıyor. Rapor iki durumu ayırt etmeli, yoksa kanonik
           * yerleşim düzeltmesi "parent başka ülkedeydi" diye yanlış anlatılır.
           */
          reason: 'cross-country-parent' | 'canonical-parent';
      }
    | {
          /** ASCII olmayan slug'ı URL-güvenli karşılığına çevirir. */
          kind: 'renameSlug';
          categoryId: number;
          countryId: number;
          oldSlug: string;
          newSlug: string;
      }
    | { kind: 'deleteCategory'; categoryId: number; countryId: number; slug: string };

export interface CategoryRedirect {
    countryId: number;
    oldSlug: string;
    newSlug: string;
}

/** Güvenli modda uygulanmayıp rapora düşen ikiz çiftleri. */
export interface PendingMerge {
    countryId: number;
    from: string;
    to: string;
}

export interface ReconcilePlan {
    ops: ReconcileOp[];
    redirects: CategoryRedirect[];
    /** Yalnızca güvenli modda dolar; insan incelemesi bekleyen birleştirmeler. */
    pendingMerges: PendingMerge[];
    summary: { created: number; moved: number; movedProducts: number; deleted: number };
}

export interface ReconcileOptions {
    /**
     * Ülke başına KANONİK slug kümesi. Verilirse ikiz grubunun kazananını bu
     * belirler — ürün sayısı değil.
     *
     * TR için kaynak devletin taksonomisidir
     * (`Cheep-Scraper/countries/turkey/mf_taxonomy.py` çıktısı `taxonomy.json`).
     * Verilmezse veri konuşur: alt ağacında en çok ürün olan kazanır. Bu,
     * elde güncel bir taksonomi dosyası olmadan da ilerlemeyi mümkün kılar ama
     * ikinci sınıf bir ölçüttür; prod çalıştırmasında dosyayı verin.
     */
    canonicalSlugs?: Record<number, Set<string>>;

    /**
     * Ülke başına ALT KATEGORİ → ÜST KATEGORİ slug eşlemesi (kanonik ağaçtan).
     *
     * NEDEN VAR: planlayıcı ikizleri birleştirirken çocukları TOPLUCA hedefe
     * bağlıyor. Bu, içinde iki farklı konu barındıran bir üst kategoride yanlış
     * sonuç verdi: "Temizlik ve Kişisel Bakım Ürünleri" → "Kişisel Bakım"
     * birleşince çamaşır/bulaşık/genel temizlik (1.033 ürün) KİŞİSEL BAKIM
     * altında kaldı; kullanıcı deterjanı "Kişisel Bakım"da arar oldu.
     *
     * Plan bunu "tutarlı" sayıyordu çünkü hiçbir adım alt kategorinin
     * ebeveyninin kanonik ağaçla uyuşup uyuşmadığına BAKMIYORDU. Artık bakıyor.
     *
     * Verilmezse kontrol atlanır — dosyasız çalıştırmada tahmin yürütmek,
     * doğru yerleşimi bozma riski taşır.
     */
    canonicalParents?: Record<number, Map<string, string>>;

    /**
     * Yalnızca DETERMİNİSTİK ONARIMLARI planla: ülke ayrıştırma, kırık parent
     * bağı, ASCII slug, ürünsüz kategori silme.
     *
     * İkiz BİRLEŞTİRME dışarıda kalır. Haftalık zamanlayıcı bu modda çalışıyor
     * ve iki meşru kategoriyi birleştirmek geri alınamaz; karar da sezgisel bir
     * benzerlik eşiğine dayanıyor. Bulunan ikizler `pendingMerges` içinde
     * raporlanır, insan bakar.
     */
    safeOnly?: boolean;
}

const key = (countryId: number, slug: string) => `${countryId}|${slug}`;

/**
 * Slug'ı URL-güvenli ASCII'ye indirger. Çeviri sözlüğüyle aynı katlamayı
 * kullanır ki iki taraf aynı sonucu üretsin.
 */
const asciiSlug = (slug: string): string => slugifyName(slug);

/**
 * Slug'ı anlamlı kelimelere ayırır. Bağlaçlar atılır: ikiz kategoriler tam da
 * bağlaçta ayrışıyor (`meyve-ve-sebze` ↔ `meyve-sebze`, `et-tavuk-ve-balik` ↔
 * `et-tavuk-balik`). "i" ve "w" Lehçe bağlaçları.
 */
const SLUG_STOPWORDS = new Set(['ve', 'ile', 'and', 'i', 'w', 'urunleri', 'urun']);

/**
 * Türkçe çoğul ekini atar: `gazli-icecekler` ile `gazli-icecek` aynı kategoriyi
 * anlatıyor ama iki ayrı satır olarak yaşıyordu. Kaba ama slug'lar üzerinde
 * güvenli — kelime 4 harften kısaysa dokunulmaz ("kerler" gibi kısaltmalarda
 * yanlış kırpma olmasın.)
 */
function stripPlural(token: string): string {
    if (token.length <= 4) return token;
    for (const suffix of ['lari', 'leri', 'lar', 'ler']) {
        if (token.endsWith(suffix)) return token.slice(0, -suffix.length);
    }
    return token;
}

function tokensOf(slug: string): Set<string> {
    return new Set(
        slug
            .split('-')
            .filter((t) => t.length > 0 && !SLUG_STOPWORDS.has(t))
            .map(stripPlural),
    );
}

const sameTokens = (a: Set<string>, b: Set<string>): boolean =>
    a.size === b.size && [...a].every((t) => b.has(t));

/**
 * İki kategori "ikiz" mi?
 *
 * Kural SEVİYEYE göre değişir, çünkü hata maliyeti farklı:
 *
 * - **Kök**: alt küme benzerliği (≥ 0.5) yeter. Gerçek ikizler burada
 *   (`atistirmalik` ↔ `atistirmalik-ve-tatli`, `sut-urunleri` ↔
 *   `sut-urunleri-ve-kahvaltilik`). Kök sayısı azdır ve kuru çalışma raporunda
 *   tek tek gözden geçirilir.
 * - **Yaprak**: YALNIZCA tam kelime kümesi eşleşmesi. Alt küme kuralı burada
 *   `meyve` ⊂ `kuru-meyve` ve `sebze` ⊂ `kuru-sebze` çiftlerini birleştirirdi;
 *   taze meyve ile kuru meyve ayrı kategorilerdir ve bu sessiz bir veri
 *   kaybı olurdu.
 */
function areTwins(a: OwnedCategory, b: OwnedCategory): boolean {
    if (a.country_id !== b.country_id) return false;
    const aRoot = a.parent_id === null;
    const bRoot = b.parent_id === null;
    if (aRoot !== bRoot) return false;

    const ta = tokensOf(a.slug);
    const tb = tokensOf(b.slug);
    if (ta.size === 0 || tb.size === 0) return false;

    return aRoot ? jaccard(ta, tb) >= 0.5 : sameTokens(ta, tb);
}

/** Kesişim / birleşim. 1.0 = aynı kelime kümesi. */
function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter += 1;
    return inter / (a.size + b.size - inter);
}

/** Kök→yaprak sırası: parent kopyası çocuğundan önce yaratılmalı. */
function topDown(nodes: OwnedCategory[]): OwnedCategory[] {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const depthOf = (n: OwnedCategory): number => {
        let d = 0;
        let cur: OwnedCategory | undefined = n;
        const seen = new Set<number>();
        while (cur?.parent_id != null && !seen.has(cur.id)) {
            seen.add(cur.id);
            cur = byId.get(cur.parent_id);
            d += 1;
            if (d > 8) break; // bozuk parent döngüsüne karşı
        }
        return d;
    };
    return [...nodes].sort((a, b) => depthOf(a) - depthOf(b) || a.id - b.id);
}

/** Yaprak→kök sırası: çocuk silinmeden parent silinemez (FK cascade'e güvenme). */
function bottomUp(nodes: OwnedCategory[]): OwnedCategory[] {
    return topDown(nodes).reverse();
}

/**
 * Bir kategorinin alt ağacında, KENDİ ülkesine ait kaç ürün var?
 * Üst kategorinin kendi ürünü olmayabilir ama çocukları doludur — bu yüzden
 * silme kararı doğrudan sayıya değil alt ağaç toplamına bakar.
 */
function ownCountrySubtreeCount(
    node: OwnedCategory,
    nodes: OwnedCategory[],
    counts: ProductCount[],
): number {
    const childrenOf = new Map<number, OwnedCategory[]>();
    for (const n of nodes) {
        if (n.parent_id === null) continue;
        const list = childrenOf.get(n.parent_id);
        if (list) list.push(n);
        else childrenOf.set(n.parent_id, [n]);
    }

    const direct = new Map<string, number>();
    for (const c of counts) direct.set(key(c.categoryId, String(c.countryId)), c.n);

    let total = 0;
    const seen = new Set<number>();
    const stack = [node];
    while (stack.length > 0) {
        const cur = stack.pop() as OwnedCategory;
        if (seen.has(cur.id)) continue;
        seen.add(cur.id);
        total += direct.get(key(cur.id, String(node.country_id))) ?? 0;
        for (const child of childrenOf.get(cur.id) ?? []) stack.push(child);
    }
    return total;
}

/**
 * Birleştirme planını üretir.
 *
 * 1. Bir kategoride BAŞKA ülkenin ürünü varsa, o ülkenin kopyasını hazırla
 *    (yoksa yarat, parent zincirini de kopyalayarak) ve ürünleri oraya taşı.
 * 2. Taşıma sonrası kendi ülkesinde hiç ürünü kalmayan kategorileri sil.
 * 3. Silinen kategoriler için yönlendirme öner: aynı ülkede EN ÇOK ürünü olan
 *    kategori hedef alınır. Hedef yoksa yönlendirme üretilmez — 301'in hedefi
 *    boş olamaz.
 */
export function planReconciliation(
    nodes: OwnedCategory[],
    counts: ProductCount[],
    options: ReconcileOptions = {},
): ReconcilePlan {
    const ops: ReconcileOp[] = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // (ülke, slug) → mevcut ya da planlanan kategori referansı
    const index = new Map<string, CategoryRef>();
    for (const n of nodes) index.set(key(n.country_id, n.slug), n.id);

    let tempSeq = 0;
    const created: OwnedCategory[] = []; // planlanan kopyalar (sayım için)

    /**
     * Verilen kategorinin `countryId` ülkesindeki karşılığını döndürür;
     * yoksa parent zinciriyle birlikte yaratılmasını planlar.
     */
    const ensureCopy = (source: OwnedCategory, countryId: number): CategoryRef => {
        const existing = index.get(key(countryId, source.slug));
        if (existing !== undefined) return existing;

        const parent = source.parent_id !== null ? byId.get(source.parent_id) : undefined;
        const parentRef = parent ? ensureCopy(parent, countryId) : null;

        const tempId = `tmp:${++tempSeq}`;
        ops.push({
            kind: 'createCategory',
            tempId,
            countryId,
            slug: source.slug,
            name: source.name,
            parentRef,
            display_order: source.display_order,
            icon_url: source.icon_url,
            clonedFrom: source.id,
        });
        index.set(key(countryId, source.slug), tempId);
        created.push({ ...source, id: -tempSeq, country_id: countryId });
        return tempId;
    };

    // 1) Yabancı ülkenin ürünlerini kendi ülkesinin kopyasına taşı.
    let movedProducts = 0;
    for (const c of counts) {
        if (c.n <= 0) continue;
        const node = byId.get(c.categoryId);
        if (!node || node.country_id === c.countryId) continue;

        const toRef = ensureCopy(node, c.countryId);
        ops.push({
            kind: 'moveProducts',
            fromCategoryId: node.id,
            countryId: c.countryId,
            toRef,
            n: c.n,
        });
        movedProducts += c.n;
    }

    // 1b) Ülkeler arası kırık parent bağlarını onar.
    //
    // Migration `country_id`'yi her kategoriye BAĞIMSIZ atadı (alt ağaç
    // çoğunluğu), bu yüzden bir yaprak TR'ye düşerken parent'ı PL'ye
    // düşebildi. O yaprak TR listesinde parent'sız kalıyor ve arayüzde ÜST
    // kategori gibi görünüyor — kullanıcı `gazsiz-icecekler`i anasayfada
    // "Süt Ürünleri" ile aynı seviyede görüyordu.
    for (const node of nodes) {
        if (node.parent_id === null) continue;
        const parent = byId.get(node.parent_id);
        if (!parent || parent.country_id === node.country_id) continue;

        ops.push({
            kind: 'reparent',
            categoryId: node.id,
            countryId: node.country_id,
            slug: node.slug,
            toRef: ensureCopy(parent, node.country_id),
            reason: 'cross-country-parent',
        });
    }

    // Taşımadan SONRA kendi ülkesinde kalan ürünler.
    const remaining = counts.filter((c) => {
        const node = byId.get(c.categoryId);
        return node !== undefined && node.country_id === c.countryId;
    });

    // 2) Ülke İÇİ ikizleri birleştir.
    //
    // Çapraz-ülke ayrıştırma bittiğinde bile TR'de iki nesil taksonomi yan yana
    // duruyordu: devletin `atistirmalik-ve-tatli`si ile STANDARD_CATEGORIES'ten
    // gelen `atistirmalik`. Kullanıcı ikisini birden görüyordu.
    const merged = new Set<number>();
    const pendingMerges: PendingMerge[] = [];
    const childrenOfId = new Map<number, number[]>();
    for (const n of nodes) {
        if (n.parent_id === null) continue;
        const list = childrenOfId.get(n.parent_id);
        if (list) list.push(n.id);
        else childrenOfId.set(n.parent_id, [n.id]);
    }

    // Güvenli modda birleştirme uygulanmadığı için `merged` boş kalır; aynı
    // çift her iki yönden de gruplanıp iki kez raporlanırdı. Ele alınan
    // düğümleri ayrıca izliyoruz.
    const handled = new Set<number>();

    for (const node of nodes) {
        if (merged.has(node.id) || handled.has(node.id)) continue;

        // Bağlı bileşen: node ile ikiz olan ve onlarla ikiz olanlar.
        const group = [node];
        for (const other of nodes) {
            if (other.id === node.id || merged.has(other.id) || handled.has(other.id)) continue;
            if (group.some((g) => areTwins(g, other))) group.push(other);
        }
        if (group.length < 2) continue;

        const canonical = group
            .map((g) => ({
                node: g,
                // Kanonik liste verildiyse o belirler; yoksa veri konuşur.
                blessed: options.canonicalSlugs?.[g.country_id]?.has(g.slug) ? 1 : 0,
                score: ownCountrySubtreeCount(g, nodes, remaining),
            }))
            .sort((a, b) => b.blessed - a.blessed || b.score - a.score || a.node.id - b.node.id)[0].node;

        for (const g of group) {
            handled.add(g.id);
            if (g.id === canonical.id) continue;

            // Güvenli modda birleştirme UYGULANMAZ, yalnızca raporlanır.
            if (options.safeOnly) {
                pendingMerges.push({ countryId: g.country_id, from: g.slug, to: canonical.slug });
                continue;
            }

            merged.add(g.id);
            ops.push({
                kind: 'mergeCategory',
                fromCategoryId: g.id,
                fromSlug: g.slug,
                countryId: g.country_id,
                toRef: canonical.id,
                toSlug: canonical.slug,
                reparentChildIds: childrenOfId.get(g.id) ?? [],
            });
        }
    }

    // 3) Birleştirmeden sonra kendi ülkesinde ürünü kalmayanları sil.
    //    Birleşenler zaten silinecek; iki kez silmeyelim.
    // KANONİK KATEGORİLER SİLİNMEZ, boş olsalar bile.
    //
    // Devlet yeni bir kategori açtığında sıra şu: taksonomi türetilir →
    // kategori seed edilir → daemon 5-6 GÜN sonra ürünleri oraya taşır. Yeni
    // kategori o aralıkta boş. "Ürünsüz kategoriyi sil" kuralı onu doğar
    // doğmaz siliyordu: seed yaratır → reconcile siler → ertesi hafta yine
    // yaratır. Sonsuz salınım, ve devletin yeni kategorisi hiç ürün alamaz.
    const isCanonical = (n: OwnedCategory) =>
        options.canonicalSlugs?.[n.country_id]?.has(n.slug) ?? false;

    const doomed = nodes.filter(
        (n) =>
            !merged.has(n.id) &&
            !isCanonical(n) &&
            ownCountrySubtreeCount(n, nodes, remaining) === 0,
    );
    const doomedIds = new Set([...doomed.map((n) => n.id), ...merged]);

    // 4) Yönlendirme hedefi.
    //
    // Ölü kategoriyi "hayatta kalan en büyük kategori"ye yollamak SEO açısından
    // yanlış: `kitap-kirtasiye`yi `meyve-sebze`ye yönlendirmek kullanıcıyı
    // alakasız bir sayfaya atar ve Google bunu soft-404 sayar. Yalnızca ELEME
    // İKİZİ olan çiftler yönlendirilir — `meyve-ve-sebze` → `meyve-sebze`,
    // `atistirmalik-ve-tatli` → `atistirmalik` gibi. Eşleşme yoksa yönlendirme
    // üretilmez; o URL'yi Caddy'nin genel 404'ü karşılar.
    // Aday havuzu, bu planda YARATILACAK kopyaları da içerir. Gerçek durum:
    // `meyve-sebze` çoğunluk PL olduğu için PL'ye atandı, TR kopyası burada
    // yaratılıyor. Yalnızca mevcut kategorilere bakan bir arama, ölü TR
    // `meyve-ve-sebze` için hedefi bulamaz ve yayındaki URL 404'e düşerdi.
    const planned = ops
        .filter((o): o is Extract<ReconcileOp, { kind: 'createCategory' }> => o.kind === 'createCategory')
        .map((o) => ({
            node: {
                id: -1,
                slug: o.slug,
                name: o.name,
                country_id: o.countryId,
                parent_id: null,
                display_order: o.display_order,
                icon_url: o.icon_url,
            } satisfies OwnedCategory,
            // Kopyaya taşınacak ürün adedi: hedefi seçerken büyüklük ölçüsü.
            score: ops
                .filter((m) => m.kind === 'moveProducts' && m.toRef === o.tempId)
                .reduce((sum, m) => sum + (m as Extract<ReconcileOp, { kind: 'moveProducts' }>).n, 0),
        }));

    const survivors = nodes
        .filter((n) => !doomedIds.has(n.id))
        .map((n) => ({ node: n, score: ownCountrySubtreeCount(n, nodes, remaining) }))
        .concat(planned);

    // 4b) KANONİK EBEVEYN KONTROLÜ — alt kategori doğru üstün altında mı?
    //
    // Birleştirme adımı bir ikizin çocuklarını TOPLUCA hedefe bağlar. Hedef,
    // kaynağın yalnızca bir yarısını karşılıyorsa diğer yarı yanlış yere düşer:
    // "Temizlik ve Kişisel Bakım Ürünleri" → "Kişisel Bakım" birleşmesi
    // çamaşır/bulaşık/genel temizliği Kişisel Bakım'ın altında bıraktı.
    // Kanonik ağaç her alt kategorinin hangi üste ait olduğunu zaten biliyor;
    // burada o bilgi kullanılıyor.
    if (options.canonicalParents) {
        // Birleştirmelerden SONRAKİ ebeveyn: bir kategori birleşen bir ikizin
        // çocuğuysa artık kanonik hedefin altındadır.
        const effectiveParent = new Map<number, number | null>(
            nodes.map((n) => [n.id, n.parent_id] as const),
        );
        for (const op of ops) {
            if (op.kind !== 'mergeCategory' || typeof op.toRef !== 'number') continue;
            for (const childId of op.reparentChildIds) effectiveParent.set(childId, op.toRef);
        }

        // Hayatta kalan kategoriler, ülke+slug ile aranabilsin.
        const survivorBySlug = new Map<string, OwnedCategory>();
        for (const n of nodes) {
            if (doomedIds.has(n.id)) continue;
            survivorBySlug.set(key(n.country_id, n.slug), n);
        }

        for (const n of nodes) {
            if (doomedIds.has(n.id)) continue;
            const wantedParentSlug = options.canonicalParents[n.country_id]?.get(n.slug);
            if (!wantedParentSlug) continue; // kanonik ağaçta yoksa karışma

            const wantedParent = survivorBySlug.get(key(n.country_id, wantedParentSlug));
            // Hedef üst kategori hayatta değilse taşıyacak yer yok.
            if (!wantedParent || wantedParent.id === n.id) continue;

            if (effectiveParent.get(n.id) === wantedParent.id) continue; // zaten doğru

            ops.push({
                kind: 'reparent',
                categoryId: n.id,
                countryId: n.country_id,
                slug: n.slug,
                toRef: wantedParent.id,
                reason: 'canonical-parent',
            });
            effectiveParent.set(n.id, wantedParent.id);
        }
    }

    // 5) ASCII olmayan slug'ları URL-güvenli hale getir.
    //
    // Canlıda `pirinç`, `bisküvi`, `kuruyemiş`, `sünger-bez` gibi slug'lar
    // vardı; URL'de yüzde-kodlanıp `/kategoria/bisk%C3%BCvi` oluyorlar.
    // Silinecek ya da birleşecek kategorilere dokunmaya gerek yok.
    const slugsInUse = new Set(nodes.map((n) => key(n.country_id, n.slug)));
    for (const n of nodes) {
        if (doomedIds.has(n.id)) continue;
        const ascii = asciiSlug(n.slug);
        if (ascii === n.slug || ascii.length === 0) continue;
        // Hedef slug başka bir kategoride kullanılıyorsa dokunma: unique index
        // patlar ve hangisinin kalacağı bir insan kararıdır.
        if (slugsInUse.has(key(n.country_id, ascii))) continue;
        slugsInUse.add(key(n.country_id, ascii));
        ops.push({
            kind: 'renameSlug',
            categoryId: n.id,
            countryId: n.country_id,
            oldSlug: n.slug,
            newSlug: ascii,
        });
    }

    const redirects: CategoryRedirect[] = [];

    // Yeniden adlandırılan slug'ın eskisi yeniye yönlenir.
    for (const op of ops) {
        if (op.kind !== 'renameSlug') continue;
        redirects.push({ countryId: op.countryId, oldSlug: op.oldSlug, newSlug: op.newSlug });
    }

    // Birleşen ikizin eski slug'ı doğrudan kanoniğe yönlenir — hedef kesin.
    for (const op of ops) {
        if (op.kind !== 'mergeCategory') continue;
        redirects.push({ countryId: op.countryId, oldSlug: op.fromSlug, newSlug: op.toSlug });
    }

    for (const n of doomed) {
        const mine = tokensOf(n.slug);
        const best = survivors
            .filter((s) => s.node.country_id === n.country_id && s.node.slug !== n.slug)
            .map((s) => ({ ...s, sim: jaccard(mine, tokensOf(s.node.slug)) }))
            .filter((s) => s.sim >= 0.5)
            .sort((a, b) => b.sim - a.sim || b.score - a.score || a.node.id - b.node.id)[0];
        if (!best) continue;
        redirects.push({ countryId: n.country_id, oldSlug: n.slug, newSlug: best.node.slug });
    }

    for (const n of bottomUp(doomed)) {
        ops.push({ kind: 'deleteCategory', categoryId: n.id, countryId: n.country_id, slug: n.slug });
    }

    return {
        ops,
        redirects,
        pendingMerges,
        summary: {
            created: ops.filter((o) => o.kind === 'createCategory').length,
            moved: ops.filter((o) => o.kind === 'moveProducts').length,
            movedProducts,
            deleted:
                ops.filter((o) => o.kind === 'deleteCategory').length +
                ops.filter((o) => o.kind === 'mergeCategory').length,
        },
    };
}
