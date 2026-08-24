import { describe, it, expect } from 'vitest';
import { buildRelevanceOrder } from '../src/api/products/products.service.js';

/**
 * Alaka merdiveninin YAPISINI kilitler.
 *
 * Sıralamanın kendisi ham SQL olduğu için sonucu ancak veritabanıyla ölçülebilir;
 * bu testler onun yerine merdivenin BASAMAKLARININ ve SIRASININ kazara
 * düşmesini engeller. Her basamağın neden orada olduğu `buildRelevanceOrder`
 * başlığında yazılı — canlı veriyle ölçülmüş gerçek hatalara dayanıyor.
 */
describe('buildRelevanceOrder', () => {
    const sqlText = (q: string) => buildRelevanceOrder(q).sql.replace(/\s+/g, ' ').trim();

    it('dört basamağı da bu sırayla üretir: kelime-içi → word_similarity → benzerlik kovası → kelime-başı', () => {
        const s = sqlText('peynir');
        const kelimeIdx = s.indexOf("LIKE ('% ' ||");
        const wsimIdx = s.indexOf('word_similarity');
        const kovaIdx = s.indexOf('least(floor(similarity');
        const basIdx = s.indexOf("LIKE (' ' ||");

        expect(kelimeIdx).toBeGreaterThanOrEqual(0);
        expect(wsimIdx).toBeGreaterThan(kelimeIdx);
        expect(kovaIdx).toBeGreaterThan(wsimIdx);
        expect(basIdx).toBeGreaterThan(kovaIdx);
    });

    it('kelime-BAŞI bonusu benzerlik kovasından SONRA gelir', () => {
        // Kovadan önce gelirse adı sorguyla başlayan ama ürünü BAŞKA olan
        // kayıtlar öne çıkıyor: "Peynir Dolgulu Biber Çeşitleri" (Hazır
        // Yemekler) gerçek peynirlerin önüne geçiyordu.
        const s = sqlText('peynir');
        expect(s.indexOf("LIKE (' ' ||")).toBeGreaterThan(s.indexOf('least(floor(similarity'));
    });

    it('kelime sınırı REGEX ile değil boşluk dolgulu LIKE ile kurulur (ReDoS / 500 riski)', () => {
        const s = sqlText('a([');
        // `~` regex operatörü kullanılırsa metakarakterli sorgu Postgres'te
        // "invalid regular expression" hatası verir ve uç 500 döner.
        expect(s).not.toMatch(/~\s*\(/);
        expect(s).toContain("(' ' || cheep_normalize(p.name) || ' ')");
    });

    it('sorgu SQL metnine gömülmez, bağlı parametre olarak taşınır', () => {
        const built = buildRelevanceOrder("peynir'; DROP TABLE products; --");
        expect(built.sql).not.toContain('DROP TABLE');
        expect(built.values).toContain("peynir'; DROP TABLE products; --");
    });

    it('benzerlik kovası TAVANLI — aksi halde tek markette bulunan ürün iki markettekini geçer', () => {
        // Tavan olmadan `similarity` sürekli bir değer olarak her zaman ilk
        // ayrımı yapar ve karşılaştırılabilirlik (store_count) hiç konuşamaz.
        expect(sqlText('süt')).toContain('least(floor(similarity');
        expect(sqlText('süt')).toContain(', 3)');
    });

    it('yazım hatası toleransı (word_similarity) korunur', () => {
        // Bu basamak düşerse "zeytınyagi" gibi yazım hataları sıfır sonuç verir.
        expect(sqlText('zeytınyagi')).toContain('word_similarity');
    });

    it('her basamak azalan sırada (DESC) uygulanır', () => {
        const s = sqlText('makarna');
        expect(s.match(/DESC/g)?.length).toBe(4);
    });
});
