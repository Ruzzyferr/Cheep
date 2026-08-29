/**
 * Kategori adlarının dil karşılıkları.
 *
 * SORUN: kategori adları veritabanında yalnızca Türkçe. TR ağacı devletin
 * marketfiyati verisinden, PL ağacı scraper'dan gelir; ikisi de Türkçe
 * adlandırılmış. Uygulama sekiz dilde çalıştığı için İngilizce arayüzde
 * "Meyve & Sebze", Almanca arayüzde "Şarküteri" görünüyordu. SEO tarafında
 * daha da ölümcül: "czekolada ceny" arayan kimse "Çikolata" başlıklı bir
 * sayfayı bulamaz.
 *
 * NEDEN BURADA, VERİTABANINDA DEĞİL: kategori listesi sabit ve elle yönetiliyor.
 * 197 slug için migration + admin arayüzü orantısız olurdu. Taksonomi
 * değişirse bu dosya da güncellenir; eşleşmeyen kategori sessizce kaybolmaz,
 * yalnızca çevrilmemiş görünür.
 *
 * ANAHTAR ÜLKE DEĞİL SLUG: TR ve PL ağaçları slug'ların çoğunu paylaşır
 * (`sut`, `peynir`, `cikolata`). Ülke başına ayrı sözlük tutmak aynı çeviriyi
 * iki kez yazdırırdı.
 *
 * SLUG'LAR DA ÇEVRİLİYOR: URL'deki kelime sıralamaya giriyor ve
 * `/pl/kategoria/czekolada` bir Polonyalıya `/pl/kategoria/cikolata`dan çok
 * daha güvenilir görünüyor. Slug addan TÜRETİLİR (`slugifyName`) — 197 × 7
 * slug'ı elle yazmak bir yazım hatası sınıfı davetiyesiydi. Üretim
 * deterministik ve yayındaki PL slug'larını birebir veriyor (testte kilitli).
 */

export const SUPPORTED_LANGS = ['tr', 'en', 'de', 'pl', 'sv', 'hr', 'hu', 'ro'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export interface LocalizedCategory {
    name: string;
    slug: string;
}

/** Ülkenin varsayılan dili — istemci dil bildirmezse kullanılır. */
const COUNTRY_LANG: Record<string, Lang> = {
    TR: 'tr',
    PL: 'pl',
    DE: 'de',
    CH: 'de',
    SE: 'sv',
    HR: 'hr',
    HU: 'hu',
    RO: 'ro',
};

export function defaultLangForCountry(countryCode: string): Lang {
    return COUNTRY_LANG[countryCode?.toUpperCase()] ?? 'tr';
}

/**
 * Aksanlı harf → ASCII. Türkçe, Lehçe, Almanca, İsveççe, Hırvatça, Macarca
 * ve Rumence kapsanır.
 *
 * ROMENCE İKİ KEZ YAZILI: doğrusu virgül-altı `ș`/`ț` (U+0219/U+021B), ama
 * gerçek veride eski çengelli `ş`/`ţ` (U+015F/U+0163) de dolaşıyor — Türkçe
 * `ş` zaten aynı kod noktası, `ţ` ise ayrıca eklendi. İkisi de katlanmazsa
 * aynı kategori iki farklı URL üretirdi.
 */
const FOLD: Record<string, string> = {
    ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u',
    ö: 'o', Ö: 'o', ç: 'c', Ç: 'c', â: 'a', î: 'i', û: 'u',
    ą: 'a', Ą: 'a', ć: 'c', Ć: 'c', ę: 'e', Ę: 'e', ł: 'l', Ł: 'l',
    ń: 'n', Ń: 'n', ó: 'o', Ó: 'o', ś: 's', Ś: 's', ź: 'z', Ź: 'z',
    ż: 'z', Ż: 'z', ä: 'a', Ä: 'a', å: 'a', Å: 'a', é: 'e', è: 'e',
    ß: 'ss',
    // Hırvatça
    č: 'c', Č: 'c', š: 's', Š: 's', ž: 'z', Ž: 'z', đ: 'd', Đ: 'd',
    // Macarca
    á: 'a', Á: 'a', É: 'e', í: 'i', Í: 'i', ő: 'o', Ő: 'o',
    ú: 'u', Ú: 'u', ű: 'u', Ű: 'u',
    // Rumence (virgül-altı doğrusu, çengelli eski varyant da katlanır)
    ă: 'a', Ă: 'a', Â: 'a', Î: 'i', ș: 's', Ș: 's', ț: 't', Ț: 't',
    ţ: 't', Ţ: 't',
};

/**
 * Ad → URL slug. Deterministik: aynı ad her zaman aynı slug'ı verir, yoksa
 * yayındaki sayfa sessizce başka bir adrese taşınırdı.
 */
export function slugifyName(name: string): string {
    return (name ?? '')
        .split('')
        .map((ch) => FOLD[ch] ?? ch)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * [en, de, pl, sv, hr, hu, ro] — Türkçesi anahtarın kendisinden değil DB'den
 * gelir. KONUMSAL: yeni dil yalnızca SONA eklenir; araya girmek ya da sırayı
 * değiştirmek 200+ satırın tamamını sessizce yanlış dile kaydırırdı.
 */
type Row = readonly [
    en: string, de: string, pl: string, sv: string, hr: string, hu: string, ro: string,
];

/**
 * AYNI kategorinin farklı slug varyantları.
 *
 * TR ve PL taksonomileri aynı üst kategoriyi farklı adlandırıyor ("Meyve ve
 * Sebze" ↔ "Meyve & Sebze"), dolayısıyla iki ayrı slug üretiliyor. İkisi de
 * aynı şeyi kastettiği için AYNI çeviriyi ve aynı yerelleştirilmiş slug'ı
 * almaları DOĞRU: `/en/category/fruit-vegetables` her ikisine de hizmet eder.
 *
 * Burada açıkça yazılıyorlar çünkü "iki kategori aynı slug'a düşmesin"
 * testinin bunu bir çakışma sanması gerekiyordu — o test gerçek bir tehlikeyi
 * (iki FARKLI kategorinin tek URL'de birbirini yutması) koruyor ve takma ad
 * çiftleri onun istisnası. Pratikte zaten aynı ülkede bir arada bulunmuyorlar.
 */
export const CATEGORY_SLUG_ALIASES: readonly (readonly string[])[] = [
    // "ve"li / "&"li varyant (TR ağacı ↔ PL ağacı)
    ['meyve-sebze', 'meyve-ve-sebze'],
    ['et-tavuk-balik', 'et-tavuk-ve-balik'],
    ['parfum-deodorant', 'parfum-ve-deodorant'],
    // kelime sırası varyantı
    ['deniz-urunleri-taze', 'taze-deniz-urunleri'],
    // tekil / çoğul varyantı
    ['islak-mendil', 'islak-mendiller'],
    ['tuvalet-kagidi', 'tuvalet-kagitlari'],
] as const;

/**
 * Alt kategori slug'larının sonuna eklenen ÜST kategori slug'ları.
 * `lookupRow` bunları ayrıştırıp eksiz adı arar; sıralama uzundan kısaya,
 * yoksa `temizlik` eki `temizlik-urunleri`den önce eşleşirdi.
 */
const PARENT_SLUGS = [
    'temizlik-ve-kisisel-bakim-urunleri',
    'sut-urunleri-ve-kahvaltilik',
    'atistirmalik-ve-tatli',
    'hazir-yemek-donuk',
    'temizlik-urunleri',
    'et-tavuk-ve-balik',
    'diger-urunler',
    'kisisel-bakim',
    'meyve-ve-sebze',
    'et-tavuk-balik',
    'saglikli-yasam',
    'firin-pastane',
    'sut-urunleri',
    'atistirmalik',
    'kahvaltilik',
    'meyve-sebze',
    'temel-gida',
    'pet-shop',
    'ev-yasam',
    'dondurma',
    'temizlik',
    'icecek',
    'bebek',
    'diger',
] as const;

const T: Record<string, Row> = {
    // ——— Üst kategoriler ———
    // NOT: aynı üst kategorinin İKİ slug varyantı var; TR ağacı "ve"li,
    // PL ağacı "&"li adla üretiliyor (`et-tavuk-ve-balik` ↔ `et-tavuk-balik`).
    // İkisi de yazılı olmalı — biri eksik kaldığı için TÜRK kataloğunda
    // "Et, Tavuk ve Balık" ve "Meyve ve Sebze" İngilizce/Almanca/İsveççe
    // arayüzde ÇEVRİLMEDEN, ana kategori ızgarasının tam ortasında duruyordu.
    'et-tavuk-ve-balik': ['Meat, Poultry & Fish', 'Fleisch, Geflügel & Fisch', 'Mięso, drób i ryby', 'Kött, fågel & fisk', 'Meso, perad i riba', 'Hús, baromfi és hal', 'Carne, pasăre și pește'],
    'meyve-ve-sebze': ['Fruit & Vegetables', 'Obst & Gemüse', 'Owoce i warzywa', 'Frukt & grönt', 'Voće i povrće', 'Zöldség és gyümölcs', 'Fructe și legume'],
    // Lehçesi bilerek `temizlik`ten FARKLI ("Środki czystości" ona ait):
    // ikisi aynı Lehçe adı alsaydı aynı slug'a düşer ve bir kategori
    // sayfası diğerini yutardı (test bunu kilitliyor).
    'temizlik-urunleri': ['Cleaning Products', 'Reinigungsmittel', 'Artykuły czystości', 'Rengöringsprodukter', 'Proizvodi za čišćenje', 'Tisztítószerek', 'Produse de curățenie'],
    'diger-siniflandirilamayanlar': ['Unclassified', 'Nicht klassifiziert', 'Niesklasyfikowane', 'Oklassificerat', 'Nerazvrstano', 'Besorolatlan', 'Neclasificate'],
    // Taksonomide "ve"li varyantlar (eksiz karsiliklari asagida ayrica var).
    'parfum-ve-deodorant': ['Perfume & Deodorant', 'Parfüm & Deodorant', 'Perfumy i dezodoranty', 'Parfym & deodorant', 'Parfemi i dezodoransi', 'Parfüm és dezodor', 'Parfumuri și deodorante'],
    'islak-mendiller': ['Wet Wipes', 'Feuchttücher', 'Chusteczki nawilżane', 'Våtservetter', 'Vlažne maramice', 'Nedves törlőkendő', 'Șervețele umede'],
    'tuvalet-kagitlari': ['Toilet Paper', 'Toilettenpapier', 'Papier toaletowy', 'Toalettpapper', 'Toaletni papir', 'Toalettpapír', 'Hârtie igienică'],
    'taze-deniz-urunleri': ['Fresh Seafood', 'Frische Meeresfrüchte', 'Świeże owoce morza', 'Färska skaldjur', 'Svježi morski plodovi', 'Friss tenger gyümölcsei', 'Fructe de mare proaspete'],
    'elektronik-ve-teknoloji': ['Electronics & Tech', 'Elektronik & Technik', 'Elektronika i technologia', 'Elektronik & teknik', 'Elektronika i tehnika', 'Elektronika és műszaki cikkek', 'Electronice și tehnologie'],
    'oyuncak-hobi-ve-kirtasiye': ['Toys, Hobby & Stationery', 'Spielzeug, Hobby & Schreibwaren', 'Zabawki, hobby i artykuły papiernicze', 'Leksaker, hobby & papper', 'Igračke, hobi i uredski materijal', 'Játék, hobbi és írószer', 'Jucării, hobby și papetărie'],
    'sut-urunleri': ['Dairy', 'Milchprodukte', 'Nabiał', 'Mejeri', 'Mliječni proizvodi', 'Tejtermékek', 'Lactate'],
    'sut-urunleri-ve-kahvaltilik': ['Dairy & Breakfast', 'Molkerei & Frühstück', 'Nabiał i śniadanie', 'Mejeri & frukost', 'Mliječni proizvodi i doručak', 'Tejtermék és reggeli', 'Lactate și mic dejun'],
    'meyve-sebze': ['Fruit & Vegetables', 'Obst & Gemüse', 'Owoce i warzywa', 'Frukt & grönt', 'Voće i povrće', 'Zöldség és gyümölcs', 'Fructe și legume'],
    'et-tavuk-balik': ['Meat, Poultry & Fish', 'Fleisch, Geflügel & Fisch', 'Mięso, drób i ryby', 'Kött, fågel & fisk', 'Meso, perad i riba', 'Hús, baromfi és hal', 'Carne, pasăre și pește'],
    'temel-gida': ['Pantry Staples', 'Grundnahrungsmittel', 'Produkty podstawowe', 'Skafferi', 'Osnovne namirnice', 'Alapélelmiszerek', 'Alimente de bază'],
    icecek: ['Beverages', 'Getränke', 'Napoje', 'Dryck', 'Pića', 'Italok', 'Băuturi'],
    'firin-pastane': ['Bakery', 'Bäckerei', 'Piekarnia', 'Bageri', 'Pekara', 'Pékáru', 'Panificație'],
    kahvaltilik: ['Breakfast', 'Frühstück', 'Śniadanie', 'Frukost', 'Doručak', 'Reggeli', 'Mic dejun'],
    atistirmalik: ['Snacks', 'Snacks', 'Przekąski', 'Snacks', 'Grickalice', 'Rágcsálnivalók', 'Gustări'],
    'atistirmalik-ve-tatli': ['Snacks & Sweets', 'Snacks & Süßes', 'Przekąski i słodycze', 'Snacks & sötsaker', 'Grickalice i slatkiši', 'Rágcsálnivalók és édességek', 'Gustări și dulciuri'],
    dondurma: ['Ice Cream', 'Eis', 'Lody', 'Glass', 'Sladoled', 'Jégkrém', 'Înghețată'],
    'hazir-yemek-donuk': ['Ready Meals & Frozen', 'Fertiggerichte & Tiefkühl', 'Dania gotowe i mrożonki', 'Färdigmat & fryst', 'Gotova jela i smrznuto', 'Készételek és fagyasztott', 'Mâncare gata și congelate'],
    temizlik: ['Cleaning', 'Reinigung', 'Środki czystości', 'Städ', 'Čišćenje', 'Tisztítás', 'Curățenie'],
    'kisisel-bakim': ['Personal Care', 'Körperpflege', 'Higiena osobista', 'Personlig vård', 'Osobna higijena', 'Testápolás', 'Îngrijire personală'],
    'temizlik-ve-kisisel-bakim-urunleri': ['Cleaning & Personal Care', 'Reinigung & Körperpflege', 'Czystość i higiena', 'Städ & hygien', 'Čišćenje i osobna higijena', 'Tisztítás és testápolás', 'Curățenie și îngrijire personală'],
    bebek: ['Baby', 'Baby', 'Dziecko', 'Barn', 'Beba', 'Baba', 'Bebeluși'],
    'pet-shop': ['Pet Shop', 'Tierbedarf', 'Zwierzęta', 'Djur', 'Kućni ljubimci', 'Kisállat', 'Animale de companie'],
    'saglikli-yasam': ['Healthy Living', 'Gesunde Ernährung', 'Zdrowa żywność', 'Hälsa', 'Zdrava prehrana', 'Egészséges életmód', 'Alimentație sănătoasă'],
    'ev-yasam': ['Home & Living', 'Haus & Wohnen', 'Dom i wnętrze', 'Hem & fritid', 'Dom i vrt', 'Otthon és lakás', 'Casă și grădină'],
    diger: ['Other', 'Sonstiges', 'Inne', 'Övrigt', 'Ostalo', 'Egyéb', 'Altele'],
    'diger-urunler': ['Other Products', 'Sonstige Produkte', 'Pozostałe produkty', 'Övriga varor', 'Ostali proizvodi', 'Egyéb termékek', 'Alte produse'],
    'diger-urunler-diger-urunler': ['Miscellaneous', 'Verschiedenes', 'Różne', 'Diverse', 'Razno', 'Vegyes', 'Diverse'],

    // ——— Süt ürünleri ———
    sut: ['Milk', 'Milch', 'Mleko', 'Mjölk', 'Mlijeko', 'Tej', 'Lapte'],
    peynir: ['Cheese', 'Käse', 'Sery', 'Ost', 'Sir', 'Sajt', 'Brânzeturi'],
    yogurt: ['Yoghurt', 'Joghurt', 'Jogurty', 'Yoghurt', 'Jogurt', 'Joghurt', 'Iaurt'],
    'krema-kaymak': ['Cream', 'Sahne', 'Śmietana', 'Grädde', 'Vrhnje', 'Tejszín', 'Smântână'],
    tereyagi: ['Butter', 'Butter', 'Masło', 'Smör', 'Maslac', 'Vaj', 'Unt'],
    'tereyagi-ve-margarin': ['Butter & Margarine', 'Butter & Margarine', 'Masło i margaryna', 'Smör & margarin', 'Maslac i margarin', 'Vaj és margarin', 'Unt și margarină'],
    ayran: ['Ayran', 'Ayran', 'Ayran', 'Ayran', 'Ajran', 'Ayran', 'Ayran'],
    'ayran-ve-kefir': ['Ayran & Kefir', 'Ayran & Kefir', 'Ayran i kefir', 'Ayran & kefir', 'Ajran i kefir', 'Ayran és kefir', 'Ayran și chefir'],
    kefir: ['Kefir', 'Kefir', 'Kefir', 'Kefir', 'Kefir', 'Kefir', 'Chefir'],
    'sutlu-tatlilar': ['Milk Desserts', 'Milchdesserts', 'Desery mleczne', 'Mjölkdesserter', 'Mliječni deserti', 'Tejdesszertek', 'Deserturi din lapte'],
    'diger-sut-urunleri': ['Other Dairy', 'Weitere Milchprodukte', 'Inny nabiał', 'Annat mejeri', 'Ostali mliječni proizvodi', 'Egyéb tejtermékek', 'Alte lactate'],
    yumurta: ['Eggs', 'Eier', 'Jajka', 'Ägg', 'Jaja', 'Tojás', 'Ouă'],

    // ——— Meyve & sebze ———
    meyve: ['Fruit', 'Obst', 'Owoce', 'Frukt', 'Voće', 'Gyümölcs', 'Fructe'],
    sebze: ['Vegetables', 'Gemüse', 'Warzywa', 'Grönsaker', 'Povrće', 'Zöldség', 'Legume'],
    'salata-malzemeleri': ['Salad Ingredients', 'Salatzutaten', 'Dodatki do sałatek', 'Salladstillbehör', 'Sastojci za salatu', 'Salátaalapanyagok', 'Ingrediente pentru salată'],
    'kuru-meyve': ['Dried Fruit', 'Trockenfrüchte', 'Suszone owoce', 'Torkad frukt', 'Suho voće', 'Aszalt gyümölcs', 'Fructe uscate'],
    zeytin: ['Olives', 'Oliven', 'Oliwki', 'Oliver', 'Masline', 'Olívabogyó', 'Măsline'],
    otlar: ['Herbs', 'Kräuter', 'Zioła', 'Örter', 'Začinsko bilje', 'Fűszernövények', 'Ierburi aromatice'],

    // ——— Et, tavuk, balık ———
    'kirmizi-et': ['Red Meat', 'Rotes Fleisch', 'Mięso czerwone', 'Rött kött', 'Crveno meso', 'Vörös húsok', 'Carne roșie'],
    'beyaz-et': ['Poultry', 'Geflügel', 'Drób', 'Fågel', 'Perad', 'Baromfi', 'Carne de pasăre'],
    tavuk: ['Chicken', 'Hähnchen', 'Kurczak', 'Kyckling', 'Piletina', 'Csirke', 'Pui'],
    hindi: ['Turkey', 'Pute', 'Indyk', 'Kalkon', 'Puretina', 'Pulyka', 'Curcan'],
    balik: ['Fish', 'Fisch', 'Ryby', 'Fisk', 'Riba', 'Hal', 'Pește'],
    'deniz-urunleri': ['Seafood', 'Meeresfrüchte', 'Owoce morza', 'Skaldjur', 'Morski plodovi', 'Tenger gyümölcsei', 'Fructe de mare'],
    'deniz-urunleri-taze': ['Fresh Seafood', 'Frische Meeresfrüchte', 'Świeże owoce morza', 'Färska skaldjur', 'Svježi morski plodovi', 'Friss tenger gyümölcsei', 'Fructe de mare proaspete'],
    sarkuteri: ['Deli & Charcuterie', 'Wurstwaren', 'Wędliny', 'Charkuterier', 'Suhomesnati proizvodi', 'Felvágottak', 'Mezeluri'],
    sakatat: ['Offal', 'Innereien', 'Podroby', 'Inälvsmat', 'Iznutrice', 'Belsőségek', 'Organe'],
    'dondurulmus-et-urunleri': ['Frozen Meat', 'Tiefkühlfleisch', 'Mrożone mięso', 'Fryst kött', 'Smrznuto meso', 'Fagyasztott hús', 'Carne congelată'],

    // ——— Temel gıda ———
    makarna: ['Pasta', 'Nudeln', 'Makarony', 'Pasta', 'Tjestenina', 'Tészta', 'Paste'],
    'manti-makarna-ve-eriste': ['Pasta & Noodles', 'Pasta & Nudeln', 'Makarony i kluski', 'Pasta & nudlar', 'Tjestenina i rezanci', 'Tészta és metélt', 'Paste și tăiței'],
    pirinc: ['Rice', 'Reis', 'Ryż', 'Ris', 'Riža', 'Rizs', 'Orez'],
    bakliyat: ['Legumes', 'Hülsenfrüchte', 'Rośliny strączkowe', 'Baljväxter', 'Mahunarke', 'Hüvelyesek', 'Leguminoase'],
    un: ['Flour', 'Mehl', 'Mąka', 'Mjöl', 'Brašno', 'Liszt', 'Făină'],
    'un-ve-irmik': ['Flour & Semolina', 'Mehl & Grieß', 'Mąka i kasza manna', 'Mjöl & mannagryn', 'Brašno i griz', 'Liszt és búzadara', 'Făină și griș'],
    seker: ['Sugar', 'Zucker', 'Cukier', 'Socker', 'Šećer', 'Cukor', 'Zahăr'],
    'seker-ve-tatlandiricilar': ['Sugar & Sweeteners', 'Zucker & Süßstoffe', 'Cukier i słodziki', 'Socker & sötning', 'Šećer i sladila', 'Cukor és édesítőszerek', 'Zahăr și îndulcitori'],
    yag: ['Oil', 'Öl', 'Oleje', 'Olja', 'Ulje', 'Olaj', 'Ulei'],
    'sivi-yaglar': ['Cooking Oils', 'Speiseöle', 'Oleje jadalne', 'Matoljor', 'Jestiva ulja', 'Étolajok', 'Uleiuri alimentare'],
    salca: ['Tomato Paste', 'Tomatenmark', 'Koncentrat pomidorowy', 'Tomatpuré', 'Koncentrat rajčice', 'Paradicsompüré', 'Pastă de tomate'],
    sirke: ['Vinegar', 'Essig', 'Ocet', 'Vinäger', 'Ocat', 'Ecet', 'Oțet'],
    baharat: ['Spices', 'Gewürze', 'Przyprawy', 'Kryddor', 'Začini', 'Fűszerek', 'Condimente'],
    'tuz-baharat-ve-harclar': ['Salt, Spices & Seasoning', 'Salz, Gewürze & Würzmischungen', 'Sól, przyprawy i mieszanki', 'Salt, kryddor & mixer', 'Sol, začini i mješavine', 'Só, fűszerek és fűszerkeverékek', 'Sare, condimente și amestecuri'],
    'yemek-harclari': ['Seasoning Mixes', 'Würzmischungen', 'Mieszanki przyprawowe', 'Kryddmixer', 'Mješavine začina', 'Fűszerkeverékek', 'Amestecuri de condimente'],
    'ketcap-mayonez-sos-ve-sirkeler': ['Ketchup, Mayo & Sauces', 'Ketchup, Mayo & Saucen', 'Ketchup, majonez i sosy', 'Ketchup, majonnäs & såser', 'Kečap, majoneza i umaci', 'Ketchup, majonéz és szószok', 'Ketchup, maioneză și sosuri'],
    hardal: ['Mustard', 'Senf', 'Musztarda', 'Senap', 'Senf', 'Mustár', 'Muștar'],
    konserve: ['Canned Goods', 'Konserven', 'Konserwy', 'Konserver', 'Konzerve', 'Konzervek', 'Conserve'],
    tursu: ['Pickles', 'Eingelegtes', 'Kiszonki', 'Inlagt', 'Kiselo povrće', 'Savanyúságok', 'Murături'],
    'hazir-corba': ['Instant Soup', 'Instantsuppe', 'Zupy instant', 'Snabbsoppa', 'Instant juhe', 'Instant levesek', 'Supe instant'],
    'hazir-yemekler': ['Ready Meals', 'Fertiggerichte', 'Dania gotowe', 'Färdigrätter', 'Gotova jela', 'Készételek', 'Mâncăruri gata preparate'],
    'hazir-yemek': ['Ready Meal', 'Fertiggericht', 'Danie gotowe', 'Färdigrätt', 'Gotovo jelo', 'Készétel', 'Mâncare gata preparată'],
    'hazir-gida-karisimlari': ['Meal Mixes', 'Fertigmischungen', 'Mieszanki obiadowe', 'Måltidsmixer', 'Gotove mješavine za jela', 'Ételalap keverékek', 'Amestecuri pentru gătit'],
    'pasta-malzemeleri': ['Baking Supplies', 'Backzutaten', 'Artykuły do wypieków', 'Bakartiklar', 'Sastojci za kolače', 'Sütési alapanyagok', 'Ingrediente pentru copt'],
    kakao: ['Cocoa', 'Kakao', 'Kakao', 'Kakao', 'Kakao', 'Kakaó', 'Cacao'],
    'yoresel-urunler': ['Regional Products', 'Regionale Produkte', 'Produkty regionalne', 'Lokala produkter', 'Regionalni proizvodi', 'Regionális termékek', 'Produse regionale'],

    // ——— Fırın & pastane ———
    ekmek: ['Bread', 'Brot', 'Pieczywo', 'Bröd', 'Kruh', 'Kenyér', 'Pâine'],
    'ekmek-ve-unlu-mamuller': ['Bread & Baked Goods', 'Brot & Backwaren', 'Pieczywo i wypieki', 'Bröd & bakverk', 'Kruh i pekarski proizvodi', 'Kenyér és pékáru', 'Pâine și produse de panificație'],
    kek: ['Cake', 'Kuchen', 'Ciasta', 'Kakor', 'Kolači', 'Sütemények', 'Prăjituri'],
    pasta: ['Gateau', 'Torte', 'Torty', 'Tårtor', 'Torte', 'Torták', 'Torturi'],
    borek: ['Savoury Pastry', 'Blätterteiggebäck', 'Ciasto francuskie', 'Matpaj', 'Lisnato tijesto', 'Leveles tészta', 'Foietaj'],
    kruvasan: ['Croissant', 'Croissant', 'Rogaliki', 'Croissant', 'Kroasani', 'Croissant', 'Croissante'],
    biskuvi: ['Biscuits', 'Kekse', 'Ciastka', 'Kex', 'Keksi', 'Kekszek', 'Biscuiți'],
    'biskuvi-ve-kraker': ['Biscuits & Crackers', 'Kekse & Cracker', 'Ciastka i krakersy', 'Kex & kringlor', 'Keksi i krekeri', 'Kekszek és krékerek', 'Biscuiți și crackers'],
    'biskuvi-atistirmalik': ['Snack Biscuits', 'Snackkekse', 'Ciastka przekąskowe', 'Snackkex', 'Keksi za grickanje', 'Snack kekszek', 'Biscuiți pentru gustare'],
    kraker: ['Crackers', 'Cracker', 'Krakersy', 'Kringlor', 'Krekeri', 'Krékerek', 'Crackers'],

    // ——— Kahvaltılık ———
    recel: ['Jam', 'Marmelade', 'Dżemy', 'Sylt', 'Džem', 'Lekvár', 'Gem'],
    'bal-ve-recel': ['Honey & Jam', 'Honig & Marmelade', 'Miód i dżemy', 'Honung & sylt', 'Med i džem', 'Méz és lekvár', 'Miere și gem'],
    bal: ['Honey', 'Honig', 'Miód', 'Honung', 'Med', 'Méz', 'Miere'],
    helva: ['Halva', 'Halva', 'Chałwa', 'Halva', 'Halva', 'Halva', 'Halva'],
    'helva-tahin-ve-pekmez': ['Halva, Tahini & Molasses', 'Halva, Tahini & Sirup', 'Chałwa, tahini i melasa', 'Halva, tahini & sirap', 'Halva, tahini i melasa', 'Halva, tahini és melasz', 'Halva, tahini și melasă'],
    'kahvaltilik-sos': ['Breakfast Sauces', 'Frühstückssaucen', 'Sosy śniadaniowe', 'Frukostsåser', 'Umaci za doručak', 'Reggeli szószok', 'Sosuri pentru mic dejun'],
    'kahvaltilik-ezme': ['Spreads', 'Brotaufstriche', 'Kremy do smarowania', 'Bredbart', 'Namazi', 'Kenhető krémek', 'Creme tartinabile'],
    'surulebilir-urunler-ve-kahvaltilik-soslar': ['Spreads & Breakfast Sauces', 'Aufstriche & Frühstückssaucen', 'Pasty i sosy śniadaniowe', 'Pålägg & frukostsåser', 'Namazi i umaci za doručak', 'Kenhető krémek és reggeli szószok', 'Creme tartinabile și sosuri pentru mic dejun'],
    'kahvaltilik-gevrek': ['Cereal', 'Cerealien', 'Płatki śniadaniowe', 'Flingor', 'Žitne pahuljice', 'Reggeliző pelyhek', 'Cereale pentru mic dejun'],
    'kahvaltilik-gevrek-bar-ve-granola': ['Cereal, Bars & Granola', 'Cerealien, Riegel & Granola', 'Płatki, batony i granola', 'Flingor, bars & granola', 'Pahuljice, pločice i granola', 'Pelyhek, szeletek és granola', 'Cereale, batoane și granola'],
    'musli-granola': ['Muesli & Granola', 'Müsli & Granola', 'Musli i granola', 'Müsli & granola', 'Musli i granola', 'Müzli és granola', 'Musli și granola'],

    // ——— İçecek ———
    su: ['Water', 'Wasser', 'Woda', 'Vatten', 'Voda', 'Víz', 'Apă'],
    'maden-suyu': ['Sparkling Water', 'Mineralwasser', 'Woda mineralna', 'Mineralvatten', 'Mineralna voda', 'Ásványvíz', 'Apă minerală'],
    'gazli-icecek': ['Soft Drinks', 'Erfrischungsgetränke', 'Napoje gazowane', 'Läsk', 'Gazirana pića', 'Üdítőitalok', 'Băuturi răcoritoare'],
    'gazli-icecekler': ['Carbonated Drinks', 'Kohlensäurehaltige Getränke', 'Napoje gazowane w butelkach', 'Kolsyrad dryck', 'Gazirani napitci', 'Szénsavas üdítők', 'Băuturi carbogazoase'],
    'gazsiz-icecekler': ['Still Drinks', 'Stille Getränke', 'Napoje niegazowane', 'Stilla drycker', 'Negazirana pića', 'Szénsavmentes üdítők', 'Băuturi necarbogazoase'],
    'meyve-suyu': ['Juice', 'Saft', 'Soki', 'Juice', 'Sokovi', 'Gyümölcslé', 'Sucuri'],
    kahve: ['Coffee', 'Kaffee', 'Kawa', 'Kaffe', 'Kava', 'Kávé', 'Cafea'],
    cay: ['Tea', 'Tee', 'Herbata', 'Te', 'Čaj', 'Tea', 'Ceai'],
    'cay-ve-bitki-caylari': ['Tea & Herbal Tea', 'Tee & Kräutertee', 'Herbata i herbaty ziołowe', 'Te & örtte', 'Čaj i biljni čajevi', 'Tea és gyógynövény tea', 'Ceai și ceaiuri din plante'],
    'bitki-cayi': ['Herbal Tea', 'Kräutertee', 'Herbata ziołowa', 'Örtte', 'Biljni čaj', 'Gyógynövény tea', 'Ceai din plante'],
    'enerji-icecegi': ['Energy Drinks', 'Energydrinks', 'Napoje energetyczne', 'Energidryck', 'Energetska pića', 'Energiaitalok', 'Băuturi energizante'],
    'alkolsuz-bira': ['Non-Alcoholic Beer', 'Alkoholfreies Bier', 'Piwo bezalkoholowe', 'Alkoholfri öl', 'Bezalkoholno pivo', 'Alkoholmentes sör', 'Bere fără alcool'],

    // ——— Atıştırmalık & tatlı ———
    cikolata: ['Chocolate', 'Schokolade', 'Czekolada', 'Choklad', 'Čokolada', 'Csokoládé', 'Ciocolată'],
    cips: ['Crisps', 'Chips', 'Chipsy', 'Chips', 'Čips', 'Chips', 'Chipsuri'],
    gofret: ['Wafers', 'Waffeln', 'Wafle', 'Rån', 'Napolitanke', 'Ostyák', 'Napolitane'],
    sekerleme: ['Confectionery', 'Süßwaren', 'Słodycze', 'Godis', 'Slatkiši', 'Édességek', 'Dulciuri'],
    'sakiz-ve-sekerleme': ['Gum & Candy', 'Kaugummi & Bonbons', 'Gumy i cukierki', 'Tuggummi & godis', 'Žvakaće gume i bomboni', 'Rágógumi és cukorka', 'Gumă de mestecat și bomboane'],
    jelibon: ['Gummy Sweets', 'Fruchtgummi', 'Żelki', 'Gelégodis', 'Gumeni bomboni', 'Gumicukor', 'Jeleuri'],
    kuruyemis: ['Nuts', 'Nüsse', 'Bakalie', 'Nötter', 'Orašasti plodovi', 'Olajos magvak', 'Nuci și semințe'],
    'kuruyemis-ve-kuru-meyve': ['Nuts & Dried Fruit', 'Nüsse & Trockenfrüchte', 'Bakalie i suszone owoce', 'Nötter & torkad frukt', 'Orašasti plodovi i suho voće', 'Olajos magvak és aszalt gyümölcs', 'Nuci și fructe uscate'],
    tatlilar: ['Desserts', 'Desserts', 'Desery', 'Desserter', 'Deserti', 'Desszertek', 'Deserturi'],
    dondurmalar: ['Ice Creams', 'Eiscreme', 'Lody wieloporcjowe', 'Glassar', 'Sladoledi', 'Jégkrémek', 'Înghețate'],
    'dondurma-alt': ['Tub Ice Cream', 'Eis im Becher', 'Lody w opakowaniu', 'Glass i förpackning', 'Sladoled u kutiji', 'Jégkrém dobozban', 'Înghețată la cutie'],
    'dondurma-cubuk': ['Ice Lollies', 'Stieleis', 'Lody na patyku', 'Glasspinnar', 'Sladoled na štapiću', 'Jégkrém pálcikán', 'Înghețată pe băț'],

    // ——— Donuk ———
    'dondurulmus-gida': ['Frozen Food', 'Tiefkühlkost', 'Mrożonki', 'Fryst mat', 'Smrznuta hrana', 'Fagyasztott élelmiszer', 'Alimente congelate'],
    'dondurulmus-sebze': ['Frozen Vegetables', 'Tiefkühlgemüse', 'Mrożone warzywa', 'Frysta grönsaker', 'Smrznuto povrće', 'Fagyasztott zöldség', 'Legume congelate'],
    'dondurulmus-meyve': ['Frozen Fruit', 'Tiefkühlobst', 'Mrożone owoce', 'Fryst frukt', 'Smrznuto voće', 'Fagyasztott gyümölcs', 'Fructe congelate'],
    pizza: ['Pizza', 'Pizza', 'Pizza', 'Pizza', 'Pizza', 'Pizza', 'Pizza'],

    // ——— Temizlik ———
    'camasir-deterjani': ['Laundry Detergent', 'Waschmittel', 'Proszki do prania', 'Tvättmedel', 'Deterdžent za rublje', 'Mosószerek', 'Detergent de rufe'],
    'camasir-temizlik-urunleri': ['Laundry Products', 'Waschpflege', 'Środki do prania', 'Tvättprodukter', 'Proizvodi za pranje rublja', 'Mosási termékek', 'Produse pentru rufe'],
    yumusatici: ['Fabric Softener', 'Weichspüler', 'Płyny do płukania', 'Sköljmedel', 'Omekšivač', 'Öblítők', 'Balsam de rufe'],
    'leke-cikaricilar': ['Stain Removers', 'Fleckenentferner', 'Odplamiacze', 'Fläckborttagning', 'Odstranjivači mrlja', 'Folteltávolítók', 'Soluții pentru pete'],
    'bulasik-deterjani': ['Dish Soap', 'Spülmittel', 'Płyny do naczyń', 'Diskmedel', 'Deterdžent za suđe', 'Mosogatószerek', 'Detergent de vase'],
    'bulasik-temizlik-urunleri': ['Dishwashing Products', 'Spülprodukte', 'Środki do zmywania', 'Diskprodukter', 'Proizvodi za pranje suđa', 'Mosogatási termékek', 'Produse pentru spălat vase'],
    'bulasik-makinesi-temizleyici': ['Dishwasher Cleaner', 'Spülmaschinenreiniger', 'Środki do zmywarek', 'Maskindiskmedel', 'Sredstva za perilicu posuđa', 'Gépi mosogatószerek', 'Produse pentru mașina de spălat vase'],
    'yuzey-temizleyici': ['Surface Cleaner', 'Allzweckreiniger', 'Płyny do powierzchni', 'Ytrengöring', 'Sredstvo za površine', 'Felülettisztítók', 'Soluții pentru suprafețe'],
    'genel-temizlik-urunleri': ['General Cleaning', 'Allgemeine Reinigung', 'Środki uniwersalne', 'Allrengöring', 'Univerzalna sredstva za čišćenje', 'Általános tisztítószerek', 'Produse universale de curățare'],
    'tuvalet-temizleyici': ['Toilet Cleaner', 'WC-Reiniger', 'Środki do WC', 'Toalettrengöring', 'Sredstva za WC', 'WC-tisztítók', 'Soluții pentru WC'],
    'wc-blok': ['Toilet Blocks', 'WC-Steine', 'Kostki do WC', 'Toalettblock', 'WC blokovi', 'WC-illatosítók', 'Odorizante WC'],
    'cam-silecegi': ['Glass Cleaner', 'Glasreiniger', 'Płyny do szyb', 'Fönsterputs', 'Sredstva za staklo', 'Ablaktisztítók', 'Soluții pentru geamuri'],
    'cop-torbasi': ['Bin Bags', 'Müllbeutel', 'Worki na śmieci', 'Soppåsar', 'Vreće za smeće', 'Szemeteszsákok', 'Saci de gunoi'],
    'sunger-bez': ['Sponges & Cloths', 'Schwämme & Tücher', 'Gąbki i ścierki', 'Svampar & trasor', 'Spužve i krpe', 'Szivacsok és kendők', 'Bureți și lavete'],
    'otomatik-oda-kokulari': ['Air Fresheners', 'Lufterfrischer', 'Odświeżacze powietrza', 'Luftfräschare', 'Osvježivači prostora', 'Légfrissítők', 'Odorizante de cameră'],
    'temizlik-malzemeleri': ['Cleaning Supplies', 'Reinigungszubehör', 'Akcesoria do sprzątania', 'Städtillbehör', 'Pribor za čišćenje', 'Takarítási eszközök', 'Accesorii de curățenie'],
    'diger-temizlik': ['Other Cleaning', 'Sonstige Reinigung', 'Inne środki czystości', 'Övrig städ', 'Ostala sredstva za čišćenje', 'Egyéb tisztítószerek', 'Alte produse de curățenie'],
    'mutfak-sarf-malzemeleri': ['Kitchen Disposables', 'Küchenverbrauchsartikel', 'Artykuły kuchenne', 'Köksförbrukning', 'Potrošni kuhinjski pribor', 'Konyhai eldobható termékek', 'Consumabile de bucătărie'],
    'mutfak-gerecleri': ['Kitchenware', 'Küchenutensilien', 'Akcesoria kuchenne', 'Köksredskap', 'Kuhinjski pribor', 'Konyhai eszközök', 'Ustensile de bucătărie'],

    // ——— Kişisel bakım ———
    sampuan: ['Shampoo', 'Shampoo', 'Szampony', 'Schampo', 'Šamponi', 'Samponok', 'Șampoane'],
    'sac-bakim': ['Hair Care', 'Haarpflege', 'Pielęgnacja włosów', 'Hårvård', 'Njega kose', 'Hajápolás', 'Îngrijirea părului'],
    'sac-kopugu': ['Hair Mousse', 'Haarschaum', 'Pianki do włosów', 'Hårmousse', 'Pjena za kosu', 'Hajhab', 'Spumă de păr'],
    'sac-boyalari': ['Hair Colour', 'Haarfarbe', 'Farby do włosów', 'Hårfärg', 'Boje za kosu', 'Hajfestékek', 'Vopsele de păr'],
    'dus-jeli': ['Shower Gel', 'Duschgel', 'Żele pod prysznic', 'Duschgel', 'Gel za tuširanje', 'Tusfürdő', 'Gel de duș'],
    'dus-jelleri': ['Shower Gels', 'Duschgele', 'Żele pod prysznic (zestaw)', 'Duschgeler', 'Gelovi za tuširanje', 'Tusfürdők', 'Geluri de duș'],
    'dus-banyo-ve-sabun': ['Shower, Bath & Soap', 'Dusche, Bad & Seife', 'Prysznic, kąpiel i mydło', 'Dusch, bad & tvål', 'Tuširanje, kupanje i sapun', 'Tusfürdő, fürdés és szappan', 'Duș, baie și săpun'],
    sabun: ['Soap', 'Seife', 'Mydła', 'Tvål', 'Sapuni', 'Szappanok', 'Săpunuri'],
    deodorant: ['Deodorant', 'Deodorant', 'Dezodoranty', 'Deodorant', 'Dezodoransi', 'Dezodorok', 'Deodorante'],
    'parfum-deodorant': ['Perfume & Deodorant', 'Parfüm & Deodorant', 'Perfumy i dezodoranty', 'Parfym & deodorant', 'Parfemi i dezodoransi', 'Parfüm és dezodor', 'Parfumuri și deodorante'],
    kolonya: ['Cologne', 'Kölnisch Wasser', 'Woda kolońska', 'Eau de cologne', 'Kolonjska voda', 'Kölnivíz', 'Apă de colonie'],
    'cilt-bakim': ['Skin Care', 'Hautpflege', 'Pielęgnacja skóry', 'Hudvård', 'Njega kože', 'Bőrápolás', 'Îngrijirea pielii'],
    'cilt-bakimi': ['Skincare', 'Hautpflegeprodukte', 'Kosmetyki do skóry', 'Hudvårdsprodukter', 'Proizvodi za njegu kože', 'Bőrápolási termékek', 'Produse de îngrijire a pielii'],
    'yuz-serumu': ['Face Serum', 'Gesichtsserum', 'Serum do twarzy', 'Ansiktsserum', 'Serum za lice', 'Arcszérum', 'Ser pentru față'],
    'gunes-koruyucu': ['Sun Care', 'Sonnenschutz', 'Ochrona przeciwsłoneczna', 'Solskydd', 'Zaštita od sunca', 'Napvédelem', 'Protecție solară'],
    'dis-bakim': ['Oral Care', 'Zahnpflege', 'Higiena jamy ustnej', 'Munvård', 'Oralna higijena', 'Szájápolás', 'Îngrijire orală'],
    'dis-macunu': ['Toothpaste', 'Zahnpasta', 'Pasty do zębów', 'Tandkräm', 'Zubne paste', 'Fogkrémek', 'Pastă de dinți'],
    'agiz-bakim': ['Mouth Care', 'Mundpflege', 'Pielęgnacja jamy ustnej', 'Munhygien', 'Njega usne šupljine', 'Szájhigiénia', 'Igienă orală'],
    tiras: ['Shaving', 'Rasur', 'Golenie', 'Rakning', 'Brijanje', 'Borotválkozás', 'Bărbierit'],
    'tiras-urunleri': ['Shaving Products', 'Rasierprodukte', 'Produkty do golenia', 'Rakprodukter', 'Proizvodi za brijanje', 'Borotválkozási termékek', 'Produse pentru bărbierit'],
    agda: ['Waxing', 'Enthaarung', 'Depilacja woskiem', 'Vaxning', 'Depilacija voskom', 'Gyantázás', 'Epilare cu ceară'],
    'agda-ve-epilasyon': ['Waxing & Hair Removal', 'Waxing & Haarentfernung', 'Depilacja i epilacja', 'Vaxning & hårborttagning', 'Depilacija i epilacija', 'Gyantázás és szőrtelenítés', 'Epilare și îndepărtarea părului'],
    makyaj: ['Make-up', 'Make-up', 'Makijaż', 'Smink', 'Šminka', 'Smink', 'Machiaj'],
    'hijyenik-ped': ['Sanitary Pads', 'Damenbinden', 'Podpaski', 'Bindor', 'Higijenski ulošci', 'Egészségügyi betétek', 'Absorbante'],
    'gunluk-ped': ['Panty Liners', 'Slipeinlagen', 'Wkładki higieniczne', 'Trosskydd', 'Dnevni ulošci', 'Tisztasági betétek', 'Absorbante zilnice'],
    tampon: ['Tampons', 'Tampons', 'Tampony', 'Tamponger', 'Tamponi', 'Tamponok', 'Tampoane'],
    prezervatif: ['Condoms', 'Kondome', 'Prezerwatywy', 'Kondomer', 'Kondomi', 'Óvszerek', 'Prezervative'],
    pamuk: ['Cotton Wool', 'Watte', 'Wata', 'Bomull', 'Vata', 'Vatta', 'Vată'],
    mendil: ['Tissues', 'Taschentücher', 'Chusteczki', 'Näsdukar', 'Papirnate maramice', 'Papír zsebkendők', 'Șervețele'],
    'islak-mendil': ['Wet Wipes', 'Feuchttücher', 'Chusteczki nawilżane', 'Våtservetter', 'Vlažne maramice', 'Nedves törlőkendő', 'Șervețele umede'],
    pecete: ['Napkins', 'Servietten', 'Serwetki', 'Servetter', 'Salvete', 'Szalvéták', 'Șervețele de masă'],
    'kagit-pecete-ve-mendiller': ['Napkins & Tissues', 'Servietten & Tücher', 'Serwetki i chusteczki', 'Servetter & näsdukar', 'Salvete i maramice', 'Szalvéták és zsebkendők', 'Șervețele de masă și batiste'],
    'kagit-havlu': ['Kitchen Towel', 'Küchenrolle', 'Ręczniki papierowe', 'Hushållspapper', 'Papirnati ručnici', 'Papírtörlők', 'Prosoape de hârtie'],
    'tuvalet-kagidi': ['Toilet Paper', 'Toilettenpapier', 'Papier toaletowy', 'Toalettpapper', 'Toaletni papir', 'Toalettpapír', 'Hârtie igienică'],

    // ——— Bebek ———
    'bebek-mamasi': ['Baby Food', 'Babynahrung', 'Żywność dla niemowląt', 'Barnmat', 'Hrana za bebe', 'Bébiételek', 'Hrană pentru bebeluși'],
    'bebek-mamalari': ['Baby Foods', 'Babynahrungsmittel', 'Pokarmy dla niemowląt', 'Barnmatsprodukter', 'Dječja hrana', 'Bébiétel termékek', 'Alimente pentru bebeluși'],
    'bebek-bezi': ['Nappies', 'Windeln', 'Pieluchy', 'Blöjor', 'Pelene', 'Pelenkák', 'Scutece'],
    'bebek-ve-hasta-bezi': ['Nappies & Incontinence', 'Windeln & Inkontinenz', 'Pieluchy i wkłady', 'Blöjor & inkontinens', 'Pelene i inkontinencija', 'Pelenkák és inkontinencia', 'Scutece și incontinență'],
    'bebek-bakim': ['Baby Care', 'Babypflege', 'Pielęgnacja niemowląt', 'Babyvård', 'Njega beba', 'Babaápolás', 'Îngrijirea bebelușului'],
    'bebek-gerecleri': ['Baby Accessories', 'Babyzubehör', 'Akcesoria dla niemowląt', 'Babytillbehör', 'Oprema za bebe', 'Baba kiegészítők', 'Accesorii pentru bebeluși'],

    // ——— Pet ———
    'kedi-mamasi': ['Cat Food', 'Katzenfutter', 'Karma dla kotów', 'Kattmat', 'Hrana za mačke', 'Macskaeledel', 'Hrană pentru pisici'],
    'kopek-mamasi': ['Dog Food', 'Hundefutter', 'Karma dla psów', 'Hundmat', 'Hrana za pse', 'Kutyaeledel', 'Hrană pentru câini'],
    'kus-mamasi': ['Bird Food', 'Vogelfutter', 'Karma dla ptaków', 'Fågelmat', 'Hrana za ptice', 'Madáreleség', 'Hrană pentru păsări'],
    'pet-aksesuar': ['Pet Accessories', 'Tierzubehör', 'Akcesoria dla zwierząt', 'Djurtillbehör', 'Oprema za ljubimce', 'Kisállat kiegészítők', 'Accesorii pentru animale'],

    // ——— Sağlık ———
    'vitamin-takviye': ['Vitamins & Supplements', 'Vitamine & Nahrungsergänzung', 'Witaminy i suplementy', 'Vitaminer & kosttillskott', 'Vitamini i dodaci prehrani', 'Vitaminok és étrend-kiegészítők', 'Vitamine și suplimente'],
    'gida-takviyeleri': ['Food Supplements', 'Nahrungsergänzungsmittel', 'Suplementy diety', 'Kosttillskott', 'Dodaci prehrani', 'Étrend-kiegészítők', 'Suplimente alimentare'],
    'ilk-yardim': ['First Aid', 'Erste Hilfe', 'Pierwsza pomoc', 'Första hjälpen', 'Prva pomoć', 'Elsősegély', 'Prim ajutor'],
    'yara-bandi': ['Plasters', 'Pflaster', 'Plastry', 'Plåster', 'Flasteri', 'Sebtapaszok', 'Plasturi'],
    'saglik-ve-medikal': ['Health & Medical', 'Gesundheit & Medizin', 'Zdrowie i medycyna', 'Hälsa & medicin', 'Zdravlje i medicina', 'Egészség és gyógyászat', 'Sănătate și medicale'],

    // ——— Ev & diğer ———
    'giyim-ve-tekstil': ['Clothing & Textiles', 'Kleidung & Textilien', 'Odzież i tekstylia', 'Kläder & textil', 'Odjeća i tekstil', 'Ruházat és textil', 'Îmbrăcăminte și textile'],
    'oyuncak-ve-hobi': ['Toys & Hobby', 'Spielzeug & Hobby', 'Zabawki i hobby', 'Leksaker & hobby', 'Igračke i hobi', 'Játék és hobbi', 'Jucării și hobby'],
    'oto-ve-yapi-market': ['Auto & DIY', 'Auto & Baumarkt', 'Motoryzacja i budowa', 'Bil & bygg', 'Auto i kućni majstor', 'Autó és barkács', 'Auto și bricolaj'],
    'tutun-ve-tutun-mamulleri': ['Tobacco', 'Tabakwaren', 'Wyroby tytoniowe', 'Tobak', 'Duhanski proizvodi', 'Dohányáru', 'Produse din tutun'],
    pil: ['Batteries', 'Batterien', 'Baterie', 'Batterier', 'Baterije', 'Elemek', 'Baterii'],
};

/** Dışa açık sözlük: slug → dil → ad. Türkçe, veritabanındaki addır. */
export const CATEGORY_NAMES: Record<string, Record<Lang, string>> = Object.fromEntries(
    Object.entries(T).map(([slug, [en, de, pl, sv, hr, hu, ro]]) => [
        slug,
        // Türkçe için sözlükte ayrı bir kayıt tutmuyoruz; anahtar zaten TR
        // slug'ı ve ad DB'den geliyor. Test tamlığı için buraya slug'ın
        // kendisini değil, çağrıda kaynak adı kullanılacağını belirten bir
        // yer tutucu koymak yanıltıcı olurdu — bu yüzden TR alanı da doldurulur.
        { tr: turkishNameFor(slug), en, de, pl, sv, hr, hu, ro } as Record<Lang, string>,
    ]),
);

/**
 * Slug'dan okunabilir Türkçe ad üretir. Yalnızca sözlük tamlık testi ve
 * `tr` isteği DB adı taşımadığında kullanılır; normal akışta Türkçe ad
 * veritabanından gelir ve olduğu gibi döner.
 */
function turkishNameFor(slug: string): string {
    return slug
        .split('-')
        .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
        .join(' ');
}

/**
 * Bir kategoriyi istenen dile çevirir.
 *
 * Eşleme yoksa kaynak ad ve slug olduğu gibi döner — yeni bir kategori
 * eklendiğinde sayfa kaybolmasın, sadece çevrilmemiş görünsün. Sessiz veri
 * kaybından iyidir.
 */
export function localizeCategory(lang: Lang, name: string, slug: string): LocalizedCategory {
    if (lang === 'tr') return { name, slug };
    const translated = lookupRow(slug);
    if (!translated) return { name, slug };
    const idx = { en: 0, de: 1, pl: 2, sv: 3, hr: 4, hu: 5, ro: 6 } as const;
    const localized = translated[idx[lang as Exclude<Lang, 'tr'>]];
    return { name: localized, slug: slugifyName(localized) };
}

/**
 * Slug → çeviri satırı; bulunamazsa EBEVEYN EKİNİ atarak yeniden dener.
 *
 * NEDEN: taksonomi türetici alt kategori slug'ının sonuna ebeveyninkini
 * ekliyor (`sac-bakim` → `sac-bakim-kisisel-bakim`), sözlük ise eksiz adlarla
 * yazılmıştı. Sonuç: 18 gerçek kategori — saç bakımı, cilt bakımı, ağız
 * bakımı, kağıt havlu… — yedi çeviri dilinin hepsinde ÇEVRİLMEMİŞ görünüyordu; hepsi
 * sözlükte zaten vardı, yalnızca anahtarları tutmuyordu. Eksik tek tek
 * eklenseydi taksonomi bir daha değiştiğinde aynı sınıf hata geri gelirdi;
 * ek ayrıştırılırsa sorun kalıcı olarak kapanır.
 *
 * Yalnızca ÜST kategori slug'ları ek olarak kabul edilir — rastgele bir son
 * ek atmak `sut-urunleri`yi `sut`a indirip yanlış çeviri verebilirdi.
 */
function lookupRow(slug: string): Row | undefined {
    const exact = T[slug];
    if (exact) return exact;
    for (const parent of PARENT_SLUGS) {
        const suffix = `-${parent}`;
        if (slug.length > suffix.length && slug.endsWith(suffix)) {
            const base = slug.slice(0, -suffix.length);
            const row = T[base];
            if (row) return row;
        }
    }
    return undefined;
}

const isLang = (v: string): v is Lang => (SUPPORTED_LANGS as readonly string[]).includes(v);

/** "pl-PL" → "pl", "  EN " → "en". Desteklenmiyorsa null. */
function normalizeLang(raw?: string | null): Lang | null {
    if (!raw) return null;
    const base = raw.trim().toLowerCase().split(/[-_]/)[0];
    return isLang(base) ? base : null;
}

/**
 * İstek dilini çözer: `x-lang` → `Accept-Language` → ülkenin varsayılanı.
 *
 * Desteklenmeyen bir `x-lang` sessizce kabul edilmez; ülkenin varsayılanına
 * düşer. Eski uygulama sürümleri başlığı hiç yollamaz — bu yüzden ülke
 * varsayılanı gerçek bir gereklilik, dekoratif bir yedek değil.
 */
export function resolveLang(
    xLang: string | undefined,
    acceptLanguage: string | undefined,
    countryCode: string,
): Lang {
    const explicit = normalizeLang(xLang);
    if (explicit) return explicit;

    for (const part of (acceptLanguage ?? '').split(',')) {
        const candidate = normalizeLang(part.split(';')[0]);
        if (candidate) return candidate;
    }

    return defaultLangForCountry(countryCode);
}
