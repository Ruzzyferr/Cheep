import { describe, it, expect } from 'vitest';
import { planReconciliation, type OwnedCategory, type ProductCount } from '../src/services/reconcile-taxonomy.js';

/**
 * Alt kategorinin KANONİK üst kategorinin altında olmasını kilitler.
 *
 * Gerçek arıza: "Temizlik ve Kişisel Bakım Ürünleri" ikizi "Kişisel Bakım"a
 * katılınca çocukları TOPLUCA oraya bağlandı ve çamaşır/bulaşık/genel temizlik
 * (1.033 ürün) Kişisel Bakım altında kaldı — kullanıcı deterjanı kişisel bakım
 * bölümünde arar oldu. Planlayıcı bunu "tutarlı" sayıyordu çünkü hiçbir adım
 * ebeveynin kanonik ağaçla uyuşup uyuşmadığına bakmıyordu.
 */

const TR = 1;
let nextId = 1;
const cat = (slug: string, parent_id: number | null, id = nextId++): OwnedCategory => ({
    id, slug, name: slug, country_id: TR, parent_id, display_order: 0, icon_url: null,
});

/** Her kategoriye ürün ver — ürünsüzler silinme adımına düşer, testi bulandırır. */
const counts = (nodes: OwnedCategory[]): ProductCount[] =>
    nodes.map((n) => ({ categoryId: n.id, countryId: TR, n: 10 }));

describe('planReconciliation — kanonik ebeveyn kontrolü', () => {
    it('yanlış üstün altındaki alt kategoriyi kanonik üste taşır', () => {
        nextId = 1;
        const kisisel = cat('kisisel-bakim', null);
        const temizlik = cat('temizlik-urunleri', null);
        // Deterjan yanlışlıkla Kişisel Bakım altında.
        const camasir = cat('camasir-temizlik-urunleri', kisisel.id);
        const nodes = [kisisel, temizlik, camasir];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['kisisel-bakim', 'temizlik-urunleri', 'camasir-temizlik-urunleri']) },
            canonicalParents: { [TR]: new Map([['camasir-temizlik-urunleri', 'temizlik-urunleri']]) },
        });

        const move = plan.ops.find((o) => o.kind === 'reparent');
        expect(move).toBeDefined();
        expect(move).toMatchObject({
            categoryId: camasir.id,
            toRef: temizlik.id,
            reason: 'canonical-parent',
        });
    });

    it('zaten doğru yerdeki kategoriye DOKUNMAZ', () => {
        nextId = 1;
        const temizlik = cat('temizlik-urunleri', null);
        const camasir = cat('camasir-temizlik-urunleri', temizlik.id);
        const nodes = [temizlik, camasir];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['temizlik-urunleri', 'camasir-temizlik-urunleri']) },
            canonicalParents: { [TR]: new Map([['camasir-temizlik-urunleri', 'temizlik-urunleri']]) },
        });

        expect(plan.ops.filter((o) => o.kind === 'reparent')).toHaveLength(0);
    });

    it('kanonik ağaçta olmayan kategoriye karışmaz', () => {
        nextId = 1;
        const kisisel = cat('kisisel-bakim', null);
        const ozel = cat('yerel-ozel-kategori', kisisel.id);
        const nodes = [kisisel, ozel];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['kisisel-bakim']) },
            canonicalParents: { [TR]: new Map([['camasir-temizlik-urunleri', 'temizlik-urunleri']]) },
        });

        expect(plan.ops.filter((o) => o.kind === 'reparent')).toHaveLength(0);
    });

    it('hedef üst kategori yoksa taşımaz (taşıyacak yer yok)', () => {
        nextId = 1;
        const kisisel = cat('kisisel-bakim', null);
        const camasir = cat('camasir-temizlik-urunleri', kisisel.id);
        const nodes = [kisisel, camasir];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['kisisel-bakim', 'camasir-temizlik-urunleri']) },
            canonicalParents: { [TR]: new Map([['camasir-temizlik-urunleri', 'temizlik-urunleri']]) },
        });

        expect(plan.ops.filter((o) => o.kind === 'reparent')).toHaveLength(0);
    });

    it('canonicalParents verilmezse kontrol tamamen atlanır', () => {
        nextId = 1;
        const kisisel = cat('kisisel-bakim', null);
        const temizlik = cat('temizlik-urunleri', null);
        const camasir = cat('camasir-temizlik-urunleri', kisisel.id);
        const nodes = [kisisel, temizlik, camasir];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['kisisel-bakim', 'temizlik-urunleri', 'camasir-temizlik-urunleri']) },
        });

        expect(plan.ops.filter((o) => o.kind === 'reparent')).toHaveLength(0);
    });

    it('birleştirme sonrası oluşan yanlış yerleşimi de yakalar', () => {
        nextId = 1;
        // "temizlik-ve-kisisel-bakim-urunleri" ikizi "kisisel-bakim"a katılacak;
        // çocuğu (çamaşır) toplu taşımayla oraya düşecek. Kanonik kontrol onu
        // "temizlik-urunleri" altına geri almalı.
        const kisisel = cat('kisisel-bakim', null);
        const temizlik = cat('temizlik-urunleri', null);
        const ikiz = cat('temizlik-ve-kisisel-bakim-urunleri', null);
        const camasir = cat('camasir-temizlik-urunleri', ikiz.id);
        const nodes = [kisisel, temizlik, ikiz, camasir];

        const plan = planReconciliation(nodes, counts(nodes), {
            canonicalSlugs: { [TR]: new Set(['kisisel-bakim', 'temizlik-urunleri', 'camasir-temizlik-urunleri']) },
            canonicalParents: { [TR]: new Map([['camasir-temizlik-urunleri', 'temizlik-urunleri']]) },
        });

        const move = plan.ops.find((o) => o.kind === 'reparent' && o.categoryId === camasir.id);
        expect(move).toMatchObject({ toRef: temizlik.id, reason: 'canonical-parent' });
    });
});
