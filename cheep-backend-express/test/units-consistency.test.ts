import { describe, it, expect } from 'vitest';

import { ALLOWED_UNITS, defaultUnitForCountry } from '../src/config/units.js';
import { upsertStorePriceSchema } from '../src/api/store-prices/store-price.schema.js';
import { addListItemSchema, updateListItemSchema } from '../src/schema/list.schema.js';

/**
 * BİRİM SÜRÜKLENMESİ (drift) — bu testin engellediği gerçek arıza:
 *
 * Birim beyaz listesi üç ayrı Joi şemasında elle tekrarlanıyordu ve üçü
 * birbirinden ayrılmıştı. Fiyat ingest'i Lehçe `szt`/`opak` kabul ederken
 * liste şemaları etmiyordu; yani Polonya kataloğundan gelen bir ürün
 * veritabanına giriyor ama kullanıcı onu LİSTESİNE EKLEYEMİYORDU (HTTP 400).
 *
 * Ayrıca mobil taraf, birimi bilinmeyen üründe `t('common.unit_default')`
 * ÇEVİRİSİNİ gönderiyordu — 'piece' (en), 'szt.' (pl, noktalı), 'Stück' (de),
 * 'st' (sv). Hiçbiri geçerli değildi; yalnızca Türkçe 'adet' tesadüfen
 * tutuyordu. Sonuç: Türkçe olmayan her kullanıcı için "listeye ekle" bozuktu.
 */
describe('birim beyaz listeleri tek kaynaktan gelir', () => {
    it('fiyat ingest şeması her kanonik birimi kabul eder', () => {
        for (const unit of ALLOWED_UNITS) {
            const { error } = upsertStorePriceSchema.validate({
                store_id: 1, store_sku: 'x', price: '1.00', name: 'Test ürün', unit,
            });
            expect(error, `ingest şeması '${unit}' birimini reddetti`).toBeUndefined();
        }
    });

    it('liste şemaları da AYNI birimleri kabul eder (sürüklenme yok)', () => {
        for (const unit of ALLOWED_UNITS) {
            expect(
                addListItemSchema.validate({ product_id: 1, unit }).error,
                `addListItem '${unit}' birimini reddetti`,
            ).toBeUndefined();
            expect(
                updateListItemSchema.validate({ unit }).error,
                `updateListItem '${unit}' birimini reddetti`,
            ).toBeUndefined();
        }
    });

    it('yeni ülkelerin paket birimleri listede', () => {
        for (const unit of ['szt', 'opak', 'kom', 'db', 'buc']) {
            expect(ALLOWED_UNITS as readonly string[]).toContain(unit);
        }
    });

    it('ÇEVİRİ ETİKETLERİ birim olarak KABUL EDİLMEZ', () => {
        // Bunlar `common.unit_default`'ın dil dosyalarındaki gerçek değerleri.
        // Şema bunları reddetmeye devam etmeli — düzeltme istemci tarafında,
        // etiketi hiç göndermemekte. Buradaki beklenti, birinin bu değerleri
        // "hatayı susturmak için" beyaz listeye eklemesini engelliyor.
        for (const label of ['piece', 'szt.', 'Stück', 'st', 'sztuka']) {
            expect(
                addListItemSchema.validate({ product_id: 1, unit: label }).error,
                `çeviri etiketi '${label}' birim olarak kabul edildi`,
            ).toBeDefined();
        }
    });

    it('birim verilmezse şema ülkeden bağımsız güvenli varsayılana düşer', () => {
        const { error, value } = addListItemSchema.validate({ product_id: 1 });
        expect(error).toBeUndefined();
        expect(value.unit).toBe('adet');
    });
});

describe('ülke başına varsayılan paket birimi', () => {
    it('bilinen ülkeleri doğru eşler', () => {
        expect(defaultUnitForCountry('TR')).toBe('adet');
        expect(defaultUnitForCountry('PL')).toBe('szt');
        expect(defaultUnitForCountry('HR')).toBe('kom');
        expect(defaultUnitForCountry('HU')).toBe('db');
        expect(defaultUnitForCountry('RO')).toBe('buc');
    });

    it('küçük harfli kodu da çözer', () => {
        expect(defaultUnitForCountry('hr')).toBe('kom');
    });

    it('bilinmeyen/boş ülke için güvenli varsayılan verir', () => {
        expect(defaultUnitForCountry('XX')).toBe('adet');
        expect(defaultUnitForCountry(null)).toBe('adet');
        expect(defaultUnitForCountry(undefined)).toBe('adet');
    });
});

describe('dil listeleri tek kaynaktan gelir', () => {
    it('kullanıcı profili, kategori çevirisiyle AYNI dilleri kabul eder', async () => {
        const { SUPPORTED_LANGUAGES } = await import('../src/api/users/users.service.js');
        const { SUPPORTED_LANGS } = await import('../src/config/category-i18n.js');
        // Kopya liste tutulduğu dönemde profil 5 dil, kategori çevirisi 8 dil
        // biliyordu: Hırvat kullanıcı kategorileri kendi dilinde görüyor ama
        // dil tercihini KAYDEDEMİYORDU ("Desteklenmeyen dil: hr", HTTP 400).
        expect([...SUPPORTED_LANGUAGES]).toEqual([...SUPPORTED_LANGS]);
    });

    it('bildirim metinleri de aynı dilleri kapsar', async () => {
        const { resolveLocale } = await import('../src/api/notifications/push-copy.js');
        const { SUPPORTED_LANGS } = await import('../src/config/category-i18n.js');
        for (const lang of SUPPORTED_LANGS) {
            // Kapsanmayan dil sessizce İngilizce'ye düşer — kullanıcı yanlış
            // dilde bildirim alır ve bu hiçbir yerde hata üretmez.
            expect(resolveLocale(lang), `'${lang}' için bildirim metni yok`).toBe(lang);
        }
    });
});
