import { describe, it, expect } from 'vitest';
import {
    planReconciliation,
    type OwnedCategory,
    type ProductCount,
} from '../src/services/reconcile-taxonomy.js';

/**
 * Taksonomi birleştirmesinin planlayıcısı.
 *
 * Migration `country_id`'yi ÇOĞUNLUĞA göre doldurdu; bu tek başına yetmez.
 * `icecek` kategorisinde hem 2.028 TR hem 3.938 PL ürünü vardı: çoğunluk PL
 * dedi ve 2.028 TR ürünü bir PL kategorisinde öksüz kaldı. Doğru davranış
 * kategoriyi ülke başına KOPYAYA BÖLMEK.
 *
 * Planlayıcı saf: veritabanına dokunmaz, uygulanabilir bir işlem listesi üretir.
 * Böylece bölme mantığı canlıda denenmek zorunda kalmaz.
 */

const TR = 1;
const PL = 2;

const cat = (o: Partial<OwnedCategory> & { id: number; slug: string; country_id: number }): OwnedCategory => ({
    name: o.slug,
    parent_id: null,
    display_order: 0,
    icon_url: null,
    ...o,
});

describe('planReconciliation — çok ülkeli kategoriyi böler', () => {
    // 39 icecek (PL'ye atanmış) ve çocuğu 41 kahve; ikisinde de TR ürünü var.
    const nodes: OwnedCategory[] = [
        cat({ id: 39, slug: 'icecek', country_id: PL, display_order: 5, icon_url: '🥤' }),
        cat({ id: 41, slug: 'kahve', country_id: PL, parent_id: 39, display_order: 1 }),
    ];
    const counts: ProductCount[] = [
        { categoryId: 39, countryId: PL, n: 100 },
        { categoryId: 39, countryId: TR, n: 5 },
        { categoryId: 41, countryId: PL, n: 50 },
        { categoryId: 41, countryId: TR, n: 3 },
    ];

    const plan = planReconciliation(nodes, counts);

    it('eksik ülke için kategori kopyası oluşturur', () => {
        const created = plan.ops.filter((o) => o.kind === 'createCategory');
        expect(created.map((o: any) => `${o.countryId}:${o.slug}`).sort()).toEqual([
            `${TR}:icecek`,
            `${TR}:kahve`,
        ]);
    });

    it('kopya, kaynağın adını ve sunum alanlarını devralır', () => {
        const parent = plan.ops.find((o: any) => o.kind === 'createCategory' && o.slug === 'icecek') as any;
        expect(parent.display_order).toBe(5);
        expect(parent.icon_url).toBe('🥤');
        expect(parent.clonedFrom).toBe(39);
    });

    it('çocuk kopyası, parent kopyasına bağlanır (henüz id yok → tempId)', () => {
        const parent = plan.ops.find((o: any) => o.kind === 'createCategory' && o.slug === 'icecek') as any;
        const child = plan.ops.find((o: any) => o.kind === 'createCategory' && o.slug === 'kahve') as any;
        expect(child.parentRef).toBe(parent.tempId);
    });

    it('parent kopyası çocuk kopyasından ÖNCE gelir — uygulayıcı sırayla işler', () => {
        const idx = (slug: string) => plan.ops.findIndex((o: any) => o.kind === 'createCategory' && o.slug === slug);
        expect(idx('icecek')).toBeLessThan(idx('kahve'));
    });

    it('yabancı ülkenin ürünlerini kendi kopyasına taşır', () => {
        const moves = plan.ops.filter((o) => o.kind === 'moveProducts') as any[];
        expect(moves).toHaveLength(2);
        expect(moves.every((m) => m.countryId === TR)).toBe(true);
        expect(moves.map((m) => m.fromCategoryId).sort()).toEqual([39, 41]);
    });

    it('kategorinin KENDİ ülkesinin ürünlerini taşımaz', () => {
        const moves = plan.ops.filter((o) => o.kind === 'moveProducts') as any[];
        expect(moves.some((m) => m.countryId === PL)).toBe(false);
    });
});

describe('planReconciliation — hedef kopya zaten varsa', () => {
    // TR'de `icecek` zaten var (id 900). Yeni kopya YARATILMAMALI, ürünler
    // doğrudan mevcut kategoriye taşınmalı — ikizin ikizini üretmeyelim.
    const nodes: OwnedCategory[] = [
        cat({ id: 39, slug: 'icecek', country_id: PL }),
        cat({ id: 900, slug: 'icecek', country_id: TR }),
    ];
    const counts: ProductCount[] = [
        { categoryId: 39, countryId: PL, n: 10 },
        { categoryId: 39, countryId: TR, n: 4 },
        { categoryId: 900, countryId: TR, n: 20 },
    ];

    const plan = planReconciliation(nodes, counts);

    it('yeni kategori oluşturmaz', () => {
        expect(plan.ops.filter((o) => o.kind === 'createCategory')).toHaveLength(0);
    });

    it('ürünleri mevcut TR kategorisine taşır', () => {
        const move = plan.ops.find((o) => o.kind === 'moveProducts') as any;
        expect(move.fromCategoryId).toBe(39);
        expect(move.toRef).toBe(900);
    });
});

describe('planReconciliation — ölü kategoriler', () => {
    // 20 `meyve-ve-sebze`: yarım kalmış migration çocuklarını başka bir üst
    // kategoriye taşımış, geriye 0 ürünlü bir kabuk kalmıştı. Anasayfa tam
    // bunu gösteriyordu.
    const nodes: OwnedCategory[] = [
        cat({ id: 20, slug: 'meyve-ve-sebze', country_id: TR }),
        cat({ id: 312, slug: 'kitap-kirtasiye', country_id: TR }),
        cat({ id: 100, slug: 'meyve-sebze', country_id: TR }),
        cat({ id: 21, slug: 'sebze', country_id: TR, parent_id: 100 }),
    ];
    const counts: ProductCount[] = [{ categoryId: 21, countryId: TR, n: 120 }];

    const plan = planReconciliation(nodes, counts);

    it('karşılığı olmayan ürünsüz kategoriyi siler', () => {
        const deleted = (plan.ops.filter((o) => o.kind === 'deleteCategory') as any[]).map((o) => o.categoryId);
        expect(deleted).toEqual([312]);
    });

    it('ürünsüz olsa da İKİZİ varsa siler değil BİRLEŞTİRİR', () => {
        // `meyve-ve-sebze` (20) ile `meyve-sebze` (100) aynı ülkede ikiz.
        // Birleştirme, silmeden üstündür: hedef kesindir ve yönlendirme
        // tahmine değil gerçek eşleşmeye dayanır.
        const merges = plan.ops.filter((o) => o.kind === 'mergeCategory') as any[];
        expect(merges.map((m) => m.fromCategoryId)).toEqual([20]);
        expect(merges[0].toRef).toBe(100);
    });

    it('kendi ürünü olmayan ama çocuğu dolu olan üst kategoriyi SİLMEZ', () => {
        const deleted = (plan.ops.filter((o) => o.kind === 'deleteCategory') as any[]).map((o) => o.categoryId);
        expect(deleted).not.toContain(100);
    });

    it('silinen kategori için yönlendirme kaydı üretir — yayındaki URL kırılmasın', () => {
        expect(plan.redirects).toContainEqual({ countryId: TR, oldSlug: 'meyve-ve-sebze', newSlug: 'meyve-sebze' });
    });

    it('hedef bu planda YARATILACAK bir kopya olsa bile yönlendirir', () => {
        // Gerçek durum: `meyve-sebze` (100) çoğunluk PL olduğu için PL'ye
        // atandı; TR kopyası bu planda yaratılıyor. Ölü TR `meyve-ve-sebze`
        // için hedef, o yaratılacak kopyadır. Yalnızca mevcut kategorilere
        // bakan bir arama bunu kaçırır ve yayındaki URL 404'e düşer.
        const plan2 = planReconciliation(
            [
                cat({ id: 20, slug: 'meyve-ve-sebze', country_id: TR }),
                cat({ id: 100, slug: 'meyve-sebze', country_id: PL }),
            ],
            [
                { categoryId: 100, countryId: PL, n: 1694 },
                { categoryId: 100, countryId: TR, n: 135 },
            ],
        );
        expect(plan2.redirects).toContainEqual({
            countryId: TR,
            oldSlug: 'meyve-ve-sebze',
            newSlug: 'meyve-sebze',
        });
    });

    it('yönlendirme hedefi bulunamazsa kayıt üretmez — 301 hedefi boş olamaz', () => {
        const orphanOnly = planReconciliation(
            [cat({ id: 312, slug: 'kitap-kirtasiye', country_id: TR })],
            [],
        );
        expect(orphanOnly.redirects).toEqual([]);
    });

    it('çocukları silinen parent da silinir (aşağıdan yukarı)', () => {
        const withEmptyChild = planReconciliation(
            [
                cat({ id: 5, slug: 'bos-ust', country_id: TR }),
                cat({ id: 6, slug: 'bos-alt', country_id: TR, parent_id: 5 }),
            ],
            [],
        );
        const deleted = (withEmptyChild.ops.filter((o) => o.kind === 'deleteCategory') as any[]).map((o) => o.categoryId);
        expect(deleted).toEqual([6, 5]);
    });
});

describe('planReconciliation — ülke içi ikizleri birleştirir', () => {
    // Çapraz-ülke ayrıştırmadan SONRA bile TR içinde iki nesil taksonomi
    // yan yana duruyordu: devletin `atistirmalik-ve-tatli`si ile
    // STANDARD_CATEGORIES'ten gelen `atistirmalik`. Kullanıcı ikisini birden
    // görüyordu.
    const nodes: OwnedCategory[] = [
        cat({ id: 48, slug: 'atistirmalik-ve-tatli', country_id: TR }),
        cat({ id: 49, slug: 'cikolata', country_id: TR, parent_id: 48 }),
        cat({ id: 173, slug: 'atistirmalik', country_id: TR }),
        cat({ id: 174, slug: 'cips', country_id: TR, parent_id: 173 }),
    ];
    const counts: ProductCount[] = [
        { categoryId: 49, countryId: TR, n: 2000 },
        { categoryId: 174, countryId: TR, n: 900 },
    ];

    const plan = planReconciliation(nodes, counts);

    it('küçük ikizi büyüğüne birleştirir', () => {
        const merges = plan.ops.filter((o) => o.kind === 'mergeCategory') as any[];
        expect(merges).toHaveLength(1);
        expect(merges[0].fromCategoryId).toBe(173); // 900 ürün
        expect(merges[0].toRef).toBe(48); // 2000 ürün
    });

    it('birleşen kategorinin çocuklarını hedefe bağlar', () => {
        const merge = plan.ops.find((o) => o.kind === 'mergeCategory') as any;
        expect(merge.reparentChildIds).toEqual([174]);
    });

    it('kanonik taksonomi verilirse kazananı O belirler — veri değil', () => {
        // Devletin ağacında `atistirmalik` yoksa, ürün sayısı ne olursa olsun
        // kanonik olan `atistirmalik-ve-tatli`dır.
        const withCanonical = planReconciliation(nodes, counts, {
            canonicalSlugs: { [TR]: new Set(['atistirmalik']) },
        });
        const merge = withCanonical.ops.find((o) => o.kind === 'mergeCategory') as any;
        expect(merge.fromCategoryId).toBe(48);
        expect(merge.toRef).toBe(173);
    });

    it('ikiz olmayan kategorileri birleştirmez', () => {
        const distinct = planReconciliation(
            [
                cat({ id: 1, slug: 'sut-urunleri', country_id: TR }),
                cat({ id: 2, slug: 'temizlik', country_id: TR }),
            ],
            [
                { categoryId: 1, countryId: TR, n: 10 },
                { categoryId: 2, countryId: TR, n: 10 },
            ],
        );
        expect(distinct.ops.filter((o) => o.kind === 'mergeCategory')).toHaveLength(0);
    });

    it('farklı ülkelerdeki aynı slug\'ı birleştirmez — ayrı taksonomilerdir', () => {
        const twoCountries = planReconciliation(
            [
                cat({ id: 1, slug: 'sut-urunleri', country_id: TR }),
                cat({ id: 2, slug: 'sut-urunleri', country_id: PL }),
            ],
            [
                { categoryId: 1, countryId: TR, n: 10 },
                { categoryId: 2, countryId: PL, n: 10 },
            ],
        );
        expect(twoCountries.ops.filter((o) => o.kind === 'mergeCategory')).toHaveLength(0);
    });

    it('birleşen kategori için yönlendirme üretir', () => {
        expect(plan.redirects).toContainEqual({
            countryId: TR,
            oldSlug: 'atistirmalik',
            newSlug: 'atistirmalik-ve-tatli',
        });
    });

    it('yaprakta ALT KÜME benzerliğini birleştirme sayMAZ — anlam farkı yutulur', () => {
        // `meyve` ⊂ `kuru-meyve` ve `sebze` ⊂ `kuru-sebze`: kelime örtüşmesi
        // %50 ama taze meyve ile kuru meyve AYRI kategorilerdir. Yaprakta
        // yalnızca TAM kelime kümesi eşleşmesi birleştirme sayılır.
        const leaves = planReconciliation(
            [
                cat({ id: 1, slug: 'meyve-sebze', country_id: TR }),
                cat({ id: 2, slug: 'meyve', country_id: TR, parent_id: 1 }),
                cat({ id: 3, slug: 'kuru-meyve', country_id: TR, parent_id: 1 }),
            ],
            [
                { categoryId: 2, countryId: TR, n: 300 },
                { categoryId: 3, countryId: TR, n: 150 },
            ],
        );
        expect(leaves.ops.filter((o) => o.kind === 'mergeCategory')).toHaveLength(0);
    });

    it('yaprakta TAM kelime kümesi eşleşmesini birleştirir', () => {
        const leaves = planReconciliation(
            [
                cat({ id: 1, slug: 'icecek', country_id: TR }),
                cat({ id: 2, slug: 'gazli-icecek', country_id: TR, parent_id: 1 }),
                cat({ id: 3, slug: 'gazli-icecekler', country_id: TR, parent_id: 1 }),
            ],
            [
                { categoryId: 2, countryId: TR, n: 330 },
                { categoryId: 3, countryId: TR, n: 300 },
            ],
        );
        // `icecekler` ≠ `icecek` (çoğul eki) — token eşitliği kurmak için
        // basit çoğul normalizasyonu gerekir.
        const merges = leaves.ops.filter((o) => o.kind === 'mergeCategory') as any[];
        expect(merges).toHaveLength(1);
        expect(merges[0].fromCategoryId).toBe(3);
        expect(merges[0].toRef).toBe(2);
    });

    it('kök ile yaprağı birleştirmez — seviye farkı anlam farkıdır', () => {
        const mixed = planReconciliation(
            [
                cat({ id: 1, slug: 'sut-urunleri', country_id: TR }),
                cat({ id: 2, slug: 'sut', country_id: TR, parent_id: 1 }),
                cat({ id: 3, slug: 'sut-urunleri', country_id: PL }),
            ],
            [
                { categoryId: 2, countryId: TR, n: 10 },
                { categoryId: 3, countryId: PL, n: 5 },
            ],
        );
        expect(mixed.ops.filter((o) => o.kind === 'mergeCategory')).toHaveLength(0);
    });
});

describe('planReconciliation — özet', () => {
    it('yapılacak işi sayar', () => {
        const plan = planReconciliation(
            [
                cat({ id: 39, slug: 'icecek', country_id: PL }),
                cat({ id: 20, slug: 'olu', country_id: TR }),
            ],
            [
                { categoryId: 39, countryId: PL, n: 10 },
                { categoryId: 39, countryId: TR, n: 4 },
            ],
        );
        expect(plan.summary).toEqual({ created: 1, moved: 1, movedProducts: 4, deleted: 1 });
    });

    it('yapacak iş yoksa boş plan döner — idempotent', () => {
        const clean = planReconciliation(
            [cat({ id: 1, slug: 'sut', country_id: TR })],
            [{ categoryId: 1, countryId: TR, n: 9 }],
        );
        expect(clean.ops).toEqual([]);
        expect(clean.summary).toEqual({ created: 0, moved: 0, movedProducts: 0, deleted: 0 });
    });
});
