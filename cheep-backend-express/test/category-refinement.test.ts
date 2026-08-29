import { describe, it, expect } from 'vitest';
import { shouldRefineCategory } from '../src/api/products/product-matcher.service.js';

/**
 * KATEGORİ RAFİNESİ — gerileme koruması.
 *
 * Eşleştirmede slug tabanlı kategori yalnızca ürünün kategorisi HİÇ YOKKEN
 * uygulanıyordu. Kategori taşımayan kaynakların mevcut veriyi ezmesini
 * önlemek için doğruydu, ama bir yan etkisi vardı ve o yan etki SESSİZDİ:
 * sınıflandırıcı sonradan iyileştiğinde mevcut ürünler asla kurtarılamıyordu.
 *
 * Üretimde ölçüldü (2026-08-29): Hırvat kataloğunun %21,3'ü kaynağın kaba
 * "gıda" beyanından gelen genel kovadaydı. Sınıflandırıcı 2.224 ürünü doğru
 * kategoriye taşıyacak hâle getirildi, zincirler yeniden içe aktarıldı — ve
 * HİÇBİR ÜRÜN YER DEĞİŞTİRMEDİ. Hata hiçbir yerde görünmedi; yalnızca
 * "neden oran düşmedi?" diye bakılınca çıktı.
 */
const GENEL = new Set([100]); // genel kova (ör. temel-gida)
const OZEL_A = 200;
const OZEL_B = 201;

describe('shouldRefineCategory', () => {
    it('kategorisi olmayan ürüne öneriyi uygular', () => {
        expect(shouldRefineCategory({ current: null, proposed: OZEL_A, fallbackIds: GENEL })).toBe(true);
    });

    it('GENEL KOVADAN daha özel bir kategoriye taşır — düzeltmenin asıl amacı', () => {
        expect(shouldRefineCategory({ current: 100, proposed: OZEL_A, fallbackIds: GENEL })).toBe(true);
    });

    it('zaten ÖZEL bir kategorideki ürüne DOKUNMAZ', () => {
        // Kaynak yanılabilir; elle ya da daha iyi bir kaynakla atanmış özel
        // kategoriyi ezmek, düzeltmekten çok bozar.
        expect(shouldRefineCategory({ current: OZEL_A, proposed: OZEL_B, fallbackIds: GENEL })).toBe(false);
    });

    it('genel kovadan genel kovaya taşımaz — kazanç yok', () => {
        const ikiGenel = new Set([100, 101]);
        expect(shouldRefineCategory({ current: 100, proposed: 101, fallbackIds: ikiGenel })).toBe(false);
    });

    it('özel kategoriden GENEL KOVAYA geri düşürmez', () => {
        expect(shouldRefineCategory({ current: OZEL_A, proposed: 100, fallbackIds: GENEL })).toBe(false);
    });

    it('öneri yoksa ya da aynıysa değişiklik yok', () => {
        expect(shouldRefineCategory({ current: OZEL_A, proposed: null, fallbackIds: GENEL })).toBe(false);
        expect(shouldRefineCategory({ current: OZEL_A, proposed: OZEL_A, fallbackIds: GENEL })).toBe(false);
        expect(shouldRefineCategory({ current: null, proposed: null, fallbackIds: GENEL })).toBe(false);
    });
});
