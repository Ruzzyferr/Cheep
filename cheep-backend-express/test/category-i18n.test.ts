import { describe, it, expect } from 'vitest';
import {
    CATEGORY_NAMES,
    CATEGORY_SLUG_ALIASES,
    SUPPORTED_LANGS,
    defaultLangForCountry,
    localizeCategory,
    resolveLang,
    slugifyName,
    type Lang,
} from '../src/config/category-i18n.js';

/**
 * Kategori adları veritabanında yalnızca Türkçe tutulur — TR ağacı devletin
 * verisinden, PL ağacı scraper'dan gelir ve ikisi de Türkçe adlandırılmıştır.
 * İngilizce uygulamada kullanıcı "Meyve & Sebze", "Şarküteri" görüyordu.
 * Çeviri sunucuda yapılır ki mobil, website ve SEO aynı kaynaktan beslensin.
 */

describe('slugifyName', () => {
    it('Türkçe harfleri katlar', () => {
        expect(slugifyName('Süt Ürünleri')).toBe('sut-urunleri');
        expect(slugifyName('Şarküteri')).toBe('sarkuteri');
        expect(slugifyName('Sağlıklı Yaşam')).toBe('saglikli-yasam');
    });

    it('Lehçe harfleri katlar — yayındaki PL slug\'ları birebir üretilmeli', () => {
        expect(slugifyName('Karma dla kotów')).toBe('karma-dla-kotow');
        expect(slugifyName('Środki czystości')).toBe('srodki-czystosci');
        expect(slugifyName('Gąbki i ścierki')).toBe('gabki-i-scierki');
        expect(slugifyName('Żywność dla niemowląt')).toBe('zywnosc-dla-niemowlat');
    });

    it('Almanca ve İsveççe harfleri katlar', () => {
        expect(slugifyName('Müsli & Granola')).toBe('musli-granola');
        expect(slugifyName('Kött & Fågel')).toBe('kott-fagel');
        expect(slugifyName('Süßwaren')).toBe('susswaren');
    });

    it('yalnızca URL-güvenli karakter bırakır', () => {
        expect(slugifyName('Ketçap, Mayonez & Sos (500 ml)')).toMatch(/^[a-z0-9-]+$/);
    });

    it('baştaki/sondaki ve tekrarlayan tireleri temizler', () => {
        expect(slugifyName('  --Süt & --  Ürünleri-- ')).toBe('sut-urunleri');
    });
});

describe('CATEGORY_NAMES sözlüğü', () => {
    const slugs = Object.keys(CATEGORY_NAMES);

    it('boş değil', () => {
        expect(slugs.length).toBeGreaterThan(150);
    });

    it('her slug için tüm diller dolu', () => {
        for (const slug of slugs) {
            for (const lang of SUPPORTED_LANGS) {
                const name = CATEGORY_NAMES[slug][lang];
                expect(name, `${slug}.${lang}`).toBeTruthy();
                expect(name.trim(), `${slug}.${lang}`).toBe(name);
            }
        }
    });

    it('anahtarlar URL-güvenli slug', () => {
        for (const slug of slugs) {
            expect(slug, slug).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('bir dil içinde iki kategori aynı slug\'a düşmez — sayfa yutulur', () => {
        // Takma ad çiftleri istisna: bunlar AYNI kategorinin TR/PL adlandırma
        // varyantları (bkz. CATEGORY_SLUG_ALIASES). Aynı yerelleştirilmiş
        // slug'a düşmeleri hata değil, istenen davranış. Test asıl olarak
        // FARKLI iki kategorinin tek URL'de birbirini yutmasını koruyor.
        const aliasOf = new Map<string, string>();
        for (const group of CATEGORY_SLUG_ALIASES) {
            for (const s of group) aliasOf.set(s, group[0]);
        }
        const canonical = (s: string) => aliasOf.get(s) ?? s;

        for (const lang of SUPPORTED_LANGS) {
            const seen = new Map<string, string>();
            for (const slug of slugs) {
                const produced = slugifyName(CATEGORY_NAMES[slug][lang]);
                const clash = seen.get(produced);
                if (clash && canonical(clash) === canonical(slug)) continue; // takma ad
                expect(clash, `${lang}: "${slug}" ve "${clash}" ikisi de /${produced}`).toBeUndefined();
                seen.set(produced, slug);
            }
        }
    });

    it('takma ad çiftleri AYNI çeviriyi verir — yoksa aynı kategori iki ada bölünür', () => {
        // 'tr' HARİÇ: Türkçede ad veritabanından geldiği gibi döner ve
        // varyantların Türkçe adları zaten farklıdır ("Meyve ve Sebze" ↔
        // "Meyve & Sebze") — çeviri katmanının konusu değil.
        const translated = SUPPORTED_LANGS.filter(l => l !== 'tr');
        for (const group of CATEGORY_SLUG_ALIASES) {
            for (const lang of translated) {
                const names = group.map(s => localizeCategory(lang, `ham-${s}`, s).name);
                const unique = new Set(names);
                expect(unique.size, `${lang}: ${group.join(' / ')} → ${names.join(' | ')}`).toBe(1);
            }
        }
    });

    it('eski PL eşlemesi korunur — yayındaki URL\'ler kırılmasın', () => {
        expect(localizeCategory('pl', 'Çikolata', 'cikolata')).toEqual({
            name: 'Czekolada',
            slug: 'czekolada',
        });
        expect(localizeCategory('pl', 'Kedi Maması', 'kedi-mamasi')).toEqual({
            name: 'Karma dla kotów',
            slug: 'karma-dla-kotow',
        });
        expect(localizeCategory('pl', 'Bulaşık Deterjanı', 'bulasik-deterjani')).toEqual({
            name: 'Płyny do naczyń',
            slug: 'plyny-do-naczyn',
        });
    });
});

describe('localizeCategory', () => {
    it('Türkçede kaynağa dokunmaz — veritabanı zaten Türkçe', () => {
        expect(localizeCategory('tr', 'Çikolata', 'cikolata')).toEqual({
            name: 'Çikolata',
            slug: 'cikolata',
        });
    });

    it('İngilizceye çevirir', () => {
        expect(localizeCategory('en', 'Süt Ürünleri', 'sut-urunleri').name).toBe('Dairy');
    });

    it('Almancaya çevirir', () => {
        expect(localizeCategory('de', 'Meyve & Sebze', 'meyve-sebze').name).toBe('Obst & Gemüse');
    });

    it('İsveççeye çevirir', () => {
        expect(localizeCategory('sv', 'Ekmek', 'ekmek').name).toBe('Bröd');
    });

    it('eşleme yoksa kaynağı olduğu gibi döner — kategori kaybolmasın', () => {
        expect(localizeCategory('en', 'Yepyeni Kategori', 'yepyeni-kategori')).toEqual({
            name: 'Yepyeni Kategori',
            slug: 'yepyeni-kategori',
        });
    });
});

describe('resolveLang', () => {
    it('desteklenen x-lang değerini kabul eder', () => {
        expect(resolveLang('de', undefined, 'TR')).toBe('de');
    });

    it('büyük/küçük harf ve bölge ekini tolere eder', () => {
        expect(resolveLang('PL-pl', undefined, 'TR')).toBe('pl');
        expect(resolveLang('  EN  ', undefined, 'TR')).toBe('en');
    });

    it('x-lang yoksa Accept-Language\'a bakar', () => {
        expect(resolveLang(undefined, 'sv-SE,sv;q=0.9,en;q=0.8', 'TR')).toBe('sv');
    });

    it('Accept-Language\'daki desteklenmeyen dili atlar, sıradakine geçer', () => {
        expect(resolveLang(undefined, 'fr-FR,fr;q=0.9,de;q=0.8', 'TR')).toBe('de');
    });

    it('hiçbiri yoksa ülkenin varsayılan diline düşer', () => {
        expect(resolveLang(undefined, undefined, 'PL')).toBe('pl');
        expect(resolveLang(undefined, undefined, 'TR')).toBe('tr');
    });

    it('desteklenmeyen x-lang, ülkenin varsayılanına düşer — sessizce kabul etmez', () => {
        expect(resolveLang('klingon', undefined, 'PL')).toBe('pl');
    });

    it('bilinmeyen ülke için Türkçeye düşer', () => {
        expect(resolveLang(undefined, undefined, 'XX')).toBe('tr');
    });
});

describe('defaultLangForCountry', () => {
    it('her canlı ülke için bir dil verir', () => {
        const pairs: Array<[string, Lang]> = [
            ['TR', 'tr'],
            ['PL', 'pl'],
            ['DE', 'de'],
            ['SE', 'sv'],
            ['CH', 'de'],
        ];
        for (const [code, lang] of pairs) {
            expect(defaultLangForCountry(code), code).toBe(lang);
        }
    });
});
