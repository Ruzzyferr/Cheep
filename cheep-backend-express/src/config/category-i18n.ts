/**
 * Kategori adlarının dil karşılıkları.
 *
 * SORUN: kategori adları veritabanında yalnızca Türkçe. TR ağacı devletin
 * marketfiyati verisinden, PL ağacı scraper'dan gelir; ikisi de Türkçe
 * adlandırılmış. Uygulama beş dilde çalıştığı için İngilizce arayüzde
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
 * daha güvenilir görünüyor. Slug addan TÜRETİLİR (`slugifyName`) — 197 × 5
 * slug'ı elle yazmak bir yazım hatası sınıfı davetiyesiydi. Üretim
 * deterministik ve yayındaki PL slug'larını birebir veriyor (testte kilitli).
 */

export const SUPPORTED_LANGS = ['tr', 'en', 'de', 'pl', 'sv'] as const;
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
};

export function defaultLangForCountry(countryCode: string): Lang {
    return COUNTRY_LANG[countryCode?.toUpperCase()] ?? 'tr';
}

/** Aksanlı harf → ASCII. Türkçe, Lehçe, Almanca ve İsveççe kapsanır. */
const FOLD: Record<string, string> = {
    ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u',
    ö: 'o', Ö: 'o', ç: 'c', Ç: 'c', â: 'a', î: 'i', û: 'u',
    ą: 'a', Ą: 'a', ć: 'c', Ć: 'c', ę: 'e', Ę: 'e', ł: 'l', Ł: 'l',
    ń: 'n', Ń: 'n', ó: 'o', Ó: 'o', ś: 's', Ś: 's', ź: 'z', Ź: 'z',
    ż: 'z', Ż: 'z', ä: 'a', Ä: 'a', å: 'a', Å: 'a', é: 'e', è: 'e',
    ß: 'ss',
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

/** [en, de, pl, sv] — Türkçesi anahtarın kendisinden değil DB'den gelir. */
type Row = readonly [en: string, de: string, pl: string, sv: string];

const T: Record<string, Row> = {
    // ——— Üst kategoriler ———
    'sut-urunleri': ['Dairy', 'Milchprodukte', 'Nabiał', 'Mejeri'],
    'sut-urunleri-ve-kahvaltilik': ['Dairy & Breakfast', 'Molkerei & Frühstück', 'Nabiał i śniadanie', 'Mejeri & frukost'],
    'meyve-sebze': ['Fruit & Vegetables', 'Obst & Gemüse', 'Owoce i warzywa', 'Frukt & grönt'],
    'et-tavuk-balik': ['Meat, Poultry & Fish', 'Fleisch, Geflügel & Fisch', 'Mięso, drób i ryby', 'Kött, fågel & fisk'],
    'temel-gida': ['Pantry Staples', 'Grundnahrungsmittel', 'Produkty podstawowe', 'Skafferi'],
    icecek: ['Beverages', 'Getränke', 'Napoje', 'Dryck'],
    'firin-pastane': ['Bakery', 'Bäckerei', 'Piekarnia', 'Bageri'],
    kahvaltilik: ['Breakfast', 'Frühstück', 'Śniadanie', 'Frukost'],
    atistirmalik: ['Snacks', 'Snacks', 'Przekąski', 'Snacks'],
    'atistirmalik-ve-tatli': ['Snacks & Sweets', 'Snacks & Süßes', 'Przekąski i słodycze', 'Snacks & sötsaker'],
    dondurma: ['Ice Cream', 'Eis', 'Lody', 'Glass'],
    'hazir-yemek-donuk': ['Ready Meals & Frozen', 'Fertiggerichte & Tiefkühl', 'Dania gotowe i mrożonki', 'Färdigmat & fryst'],
    temizlik: ['Cleaning', 'Reinigung', 'Środki czystości', 'Städ'],
    'kisisel-bakim': ['Personal Care', 'Körperpflege', 'Higiena osobista', 'Personlig vård'],
    'temizlik-ve-kisisel-bakim-urunleri': ['Cleaning & Personal Care', 'Reinigung & Körperpflege', 'Czystość i higiena', 'Städ & hygien'],
    bebek: ['Baby', 'Baby', 'Dziecko', 'Barn'],
    'pet-shop': ['Pet Shop', 'Tierbedarf', 'Zwierzęta', 'Djur'],
    'saglikli-yasam': ['Healthy Living', 'Gesunde Ernährung', 'Zdrowa żywność', 'Hälsa'],
    'ev-yasam': ['Home & Living', 'Haus & Wohnen', 'Dom i wnętrze', 'Hem & fritid'],
    diger: ['Other', 'Sonstiges', 'Inne', 'Övrigt'],
    'diger-urunler': ['Other Products', 'Sonstige Produkte', 'Pozostałe produkty', 'Övriga varor'],
    'diger-urunler-diger-urunler': ['Miscellaneous', 'Verschiedenes', 'Różne', 'Diverse'],

    // ——— Süt ürünleri ———
    sut: ['Milk', 'Milch', 'Mleko', 'Mjölk'],
    peynir: ['Cheese', 'Käse', 'Sery', 'Ost'],
    yogurt: ['Yoghurt', 'Joghurt', 'Jogurty', 'Yoghurt'],
    'krema-kaymak': ['Cream', 'Sahne', 'Śmietana', 'Grädde'],
    tereyagi: ['Butter', 'Butter', 'Masło', 'Smör'],
    'tereyagi-ve-margarin': ['Butter & Margarine', 'Butter & Margarine', 'Masło i margaryna', 'Smör & margarin'],
    ayran: ['Ayran', 'Ayran', 'Ayran', 'Ayran'],
    'ayran-ve-kefir': ['Ayran & Kefir', 'Ayran & Kefir', 'Ayran i kefir', 'Ayran & kefir'],
    kefir: ['Kefir', 'Kefir', 'Kefir', 'Kefir'],
    'sutlu-tatlilar': ['Milk Desserts', 'Milchdesserts', 'Desery mleczne', 'Mjölkdesserter'],
    'diger-sut-urunleri': ['Other Dairy', 'Weitere Milchprodukte', 'Inny nabiał', 'Annat mejeri'],
    yumurta: ['Eggs', 'Eier', 'Jajka', 'Ägg'],

    // ——— Meyve & sebze ———
    meyve: ['Fruit', 'Obst', 'Owoce', 'Frukt'],
    sebze: ['Vegetables', 'Gemüse', 'Warzywa', 'Grönsaker'],
    'salata-malzemeleri': ['Salad Ingredients', 'Salatzutaten', 'Dodatki do sałatek', 'Salladstillbehör'],
    'kuru-meyve': ['Dried Fruit', 'Trockenfrüchte', 'Suszone owoce', 'Torkad frukt'],
    zeytin: ['Olives', 'Oliven', 'Oliwki', 'Oliver'],
    otlar: ['Herbs', 'Kräuter', 'Zioła', 'Örter'],

    // ——— Et, tavuk, balık ———
    'kirmizi-et': ['Red Meat', 'Rotes Fleisch', 'Mięso czerwone', 'Rött kött'],
    'beyaz-et': ['Poultry', 'Geflügel', 'Drób', 'Fågel'],
    tavuk: ['Chicken', 'Hähnchen', 'Kurczak', 'Kyckling'],
    hindi: ['Turkey', 'Pute', 'Indyk', 'Kalkon'],
    balik: ['Fish', 'Fisch', 'Ryby', 'Fisk'],
    'deniz-urunleri': ['Seafood', 'Meeresfrüchte', 'Owoce morza', 'Skaldjur'],
    'deniz-urunleri-taze': ['Fresh Seafood', 'Frische Meeresfrüchte', 'Świeże owoce morza', 'Färska skaldjur'],
    sarkuteri: ['Deli & Charcuterie', 'Wurstwaren', 'Wędliny', 'Charkuterier'],
    sakatat: ['Offal', 'Innereien', 'Podroby', 'Inälvsmat'],
    'dondurulmus-et-urunleri': ['Frozen Meat', 'Tiefkühlfleisch', 'Mrożone mięso', 'Fryst kött'],

    // ——— Temel gıda ———
    makarna: ['Pasta', 'Nudeln', 'Makarony', 'Pasta'],
    'manti-makarna-ve-eriste': ['Pasta & Noodles', 'Pasta & Nudeln', 'Makarony i kluski', 'Pasta & nudlar'],
    pirinc: ['Rice', 'Reis', 'Ryż', 'Ris'],
    bakliyat: ['Legumes', 'Hülsenfrüchte', 'Rośliny strączkowe', 'Baljväxter'],
    un: ['Flour', 'Mehl', 'Mąka', 'Mjöl'],
    'un-ve-irmik': ['Flour & Semolina', 'Mehl & Grieß', 'Mąka i kasza manna', 'Mjöl & mannagryn'],
    seker: ['Sugar', 'Zucker', 'Cukier', 'Socker'],
    'seker-ve-tatlandiricilar': ['Sugar & Sweeteners', 'Zucker & Süßstoffe', 'Cukier i słodziki', 'Socker & sötning'],
    yag: ['Oil', 'Öl', 'Oleje', 'Olja'],
    'sivi-yaglar': ['Cooking Oils', 'Speiseöle', 'Oleje jadalne', 'Matoljor'],
    salca: ['Tomato Paste', 'Tomatenmark', 'Koncentrat pomidorowy', 'Tomatpuré'],
    sirke: ['Vinegar', 'Essig', 'Ocet', 'Vinäger'],
    baharat: ['Spices', 'Gewürze', 'Przyprawy', 'Kryddor'],
    'tuz-baharat-ve-harclar': ['Salt, Spices & Seasoning', 'Salz, Gewürze & Würzmischungen', 'Sól, przyprawy i mieszanki', 'Salt, kryddor & mixer'],
    'yemek-harclari': ['Seasoning Mixes', 'Würzmischungen', 'Mieszanki przyprawowe', 'Kryddmixer'],
    'ketcap-mayonez-sos-ve-sirkeler': ['Ketchup, Mayo & Sauces', 'Ketchup, Mayo & Saucen', 'Ketchup, majonez i sosy', 'Ketchup, majonnäs & såser'],
    hardal: ['Mustard', 'Senf', 'Musztarda', 'Senap'],
    konserve: ['Canned Goods', 'Konserven', 'Konserwy', 'Konserver'],
    tursu: ['Pickles', 'Eingelegtes', 'Kiszonki', 'Inlagt'],
    'hazir-corba': ['Instant Soup', 'Instantsuppe', 'Zupy instant', 'Snabbsoppa'],
    'hazir-yemekler': ['Ready Meals', 'Fertiggerichte', 'Dania gotowe', 'Färdigrätter'],
    'hazir-yemek': ['Ready Meal', 'Fertiggericht', 'Danie gotowe', 'Färdigrätt'],
    'hazir-gida-karisimlari': ['Meal Mixes', 'Fertigmischungen', 'Mieszanki obiadowe', 'Måltidsmixer'],
    'pasta-malzemeleri': ['Baking Supplies', 'Backzutaten', 'Artykuły do wypieków', 'Bakartiklar'],
    kakao: ['Cocoa', 'Kakao', 'Kakao', 'Kakao'],
    'yoresel-urunler': ['Regional Products', 'Regionale Produkte', 'Produkty regionalne', 'Lokala produkter'],

    // ——— Fırın & pastane ———
    ekmek: ['Bread', 'Brot', 'Pieczywo', 'Bröd'],
    'ekmek-ve-unlu-mamuller': ['Bread & Baked Goods', 'Brot & Backwaren', 'Pieczywo i wypieki', 'Bröd & bakverk'],
    kek: ['Cake', 'Kuchen', 'Ciasta', 'Kakor'],
    pasta: ['Gateau', 'Torte', 'Torty', 'Tårtor'],
    borek: ['Savoury Pastry', 'Blätterteiggebäck', 'Ciasto francuskie', 'Matpaj'],
    kruvasan: ['Croissant', 'Croissant', 'Rogaliki', 'Croissant'],
    biskuvi: ['Biscuits', 'Kekse', 'Ciastka', 'Kex'],
    'biskuvi-ve-kraker': ['Biscuits & Crackers', 'Kekse & Cracker', 'Ciastka i krakersy', 'Kex & kringlor'],
    'biskuvi-atistirmalik': ['Snack Biscuits', 'Snackkekse', 'Ciastka przekąskowe', 'Snackkex'],
    kraker: ['Crackers', 'Cracker', 'Krakersy', 'Kringlor'],

    // ——— Kahvaltılık ———
    recel: ['Jam', 'Marmelade', 'Dżemy', 'Sylt'],
    'bal-ve-recel': ['Honey & Jam', 'Honig & Marmelade', 'Miód i dżemy', 'Honung & sylt'],
    bal: ['Honey', 'Honig', 'Miód', 'Honung'],
    helva: ['Halva', 'Halva', 'Chałwa', 'Halva'],
    'helva-tahin-ve-pekmez': ['Halva, Tahini & Molasses', 'Halva, Tahini & Sirup', 'Chałwa, tahini i melasa', 'Halva, tahini & sirap'],
    'kahvaltilik-sos': ['Breakfast Sauces', 'Frühstückssaucen', 'Sosy śniadaniowe', 'Frukostsåser'],
    'kahvaltilik-ezme': ['Spreads', 'Brotaufstriche', 'Kremy do smarowania', 'Bredbart'],
    'surulebilir-urunler-ve-kahvaltilik-soslar': ['Spreads & Breakfast Sauces', 'Aufstriche & Frühstückssaucen', 'Pasty i sosy śniadaniowe', 'Pålägg & frukostsåser'],
    'kahvaltilik-gevrek': ['Cereal', 'Cerealien', 'Płatki śniadaniowe', 'Flingor'],
    'kahvaltilik-gevrek-bar-ve-granola': ['Cereal, Bars & Granola', 'Cerealien, Riegel & Granola', 'Płatki, batony i granola', 'Flingor, bars & granola'],
    'musli-granola': ['Muesli & Granola', 'Müsli & Granola', 'Musli i granola', 'Müsli & granola'],

    // ——— İçecek ———
    su: ['Water', 'Wasser', 'Woda', 'Vatten'],
    'maden-suyu': ['Sparkling Water', 'Mineralwasser', 'Woda mineralna', 'Mineralvatten'],
    'gazli-icecek': ['Soft Drinks', 'Erfrischungsgetränke', 'Napoje gazowane', 'Läsk'],
    'gazli-icecekler': ['Carbonated Drinks', 'Kohlensäurehaltige Getränke', 'Napoje gazowane w butelkach', 'Kolsyrad dryck'],
    'gazsiz-icecekler': ['Still Drinks', 'Stille Getränke', 'Napoje niegazowane', 'Stilla drycker'],
    'meyve-suyu': ['Juice', 'Saft', 'Soki', 'Juice'],
    kahve: ['Coffee', 'Kaffee', 'Kawa', 'Kaffe'],
    cay: ['Tea', 'Tee', 'Herbata', 'Te'],
    'cay-ve-bitki-caylari': ['Tea & Herbal Tea', 'Tee & Kräutertee', 'Herbata i herbaty ziołowe', 'Te & örtte'],
    'bitki-cayi': ['Herbal Tea', 'Kräutertee', 'Herbata ziołowa', 'Örtte'],
    'enerji-icecegi': ['Energy Drinks', 'Energydrinks', 'Napoje energetyczne', 'Energidryck'],
    'alkolsuz-bira': ['Non-Alcoholic Beer', 'Alkoholfreies Bier', 'Piwo bezalkoholowe', 'Alkoholfri öl'],

    // ——— Atıştırmalık & tatlı ———
    cikolata: ['Chocolate', 'Schokolade', 'Czekolada', 'Choklad'],
    cips: ['Crisps', 'Chips', 'Chipsy', 'Chips'],
    gofret: ['Wafers', 'Waffeln', 'Wafle', 'Rån'],
    sekerleme: ['Confectionery', 'Süßwaren', 'Słodycze', 'Godis'],
    'sakiz-ve-sekerleme': ['Gum & Candy', 'Kaugummi & Bonbons', 'Gumy i cukierki', 'Tuggummi & godis'],
    jelibon: ['Gummy Sweets', 'Fruchtgummi', 'Żelki', 'Gelégodis'],
    kuruyemis: ['Nuts', 'Nüsse', 'Bakalie', 'Nötter'],
    'kuruyemis-ve-kuru-meyve': ['Nuts & Dried Fruit', 'Nüsse & Trockenfrüchte', 'Bakalie i suszone owoce', 'Nötter & torkad frukt'],
    tatlilar: ['Desserts', 'Desserts', 'Desery', 'Desserter'],
    dondurmalar: ['Ice Creams', 'Eiscreme', 'Lody wieloporcjowe', 'Glassar'],
    'dondurma-alt': ['Tub Ice Cream', 'Eis im Becher', 'Lody w opakowaniu', 'Glass i förpackning'],
    'dondurma-cubuk': ['Ice Lollies', 'Stieleis', 'Lody na patyku', 'Glasspinnar'],

    // ——— Donuk ———
    'dondurulmus-gida': ['Frozen Food', 'Tiefkühlkost', 'Mrożonki', 'Fryst mat'],
    'dondurulmus-sebze': ['Frozen Vegetables', 'Tiefkühlgemüse', 'Mrożone warzywa', 'Frysta grönsaker'],
    'dondurulmus-meyve': ['Frozen Fruit', 'Tiefkühlobst', 'Mrożone owoce', 'Fryst frukt'],
    pizza: ['Pizza', 'Pizza', 'Pizza', 'Pizza'],

    // ——— Temizlik ———
    'camasir-deterjani': ['Laundry Detergent', 'Waschmittel', 'Proszki do prania', 'Tvättmedel'],
    'camasir-temizlik-urunleri': ['Laundry Products', 'Waschpflege', 'Środki do prania', 'Tvättprodukter'],
    yumusatici: ['Fabric Softener', 'Weichspüler', 'Płyny do płukania', 'Sköljmedel'],
    'leke-cikaricilar': ['Stain Removers', 'Fleckenentferner', 'Odplamiacze', 'Fläckborttagning'],
    'bulasik-deterjani': ['Dish Soap', 'Spülmittel', 'Płyny do naczyń', 'Diskmedel'],
    'bulasik-temizlik-urunleri': ['Dishwashing Products', 'Spülprodukte', 'Środki do zmywania', 'Diskprodukter'],
    'bulasik-makinesi-temizleyici': ['Dishwasher Cleaner', 'Spülmaschinenreiniger', 'Środki do zmywarek', 'Maskindiskmedel'],
    'yuzey-temizleyici': ['Surface Cleaner', 'Allzweckreiniger', 'Płyny do powierzchni', 'Ytrengöring'],
    'genel-temizlik-urunleri': ['General Cleaning', 'Allgemeine Reinigung', 'Środki uniwersalne', 'Allrengöring'],
    'tuvalet-temizleyici': ['Toilet Cleaner', 'WC-Reiniger', 'Środki do WC', 'Toalettrengöring'],
    'wc-blok': ['Toilet Blocks', 'WC-Steine', 'Kostki do WC', 'Toalettblock'],
    'cam-silecegi': ['Glass Cleaner', 'Glasreiniger', 'Płyny do szyb', 'Fönsterputs'],
    'cop-torbasi': ['Bin Bags', 'Müllbeutel', 'Worki na śmieci', 'Soppåsar'],
    'sunger-bez': ['Sponges & Cloths', 'Schwämme & Tücher', 'Gąbki i ścierki', 'Svampar & trasor'],
    'otomatik-oda-kokulari': ['Air Fresheners', 'Lufterfrischer', 'Odświeżacze powietrza', 'Luftfräschare'],
    'temizlik-malzemeleri': ['Cleaning Supplies', 'Reinigungszubehör', 'Akcesoria do sprzątania', 'Städtillbehör'],
    'diger-temizlik': ['Other Cleaning', 'Sonstige Reinigung', 'Inne środki czystości', 'Övrig städ'],
    'mutfak-sarf-malzemeleri': ['Kitchen Disposables', 'Küchenverbrauchsartikel', 'Artykuły kuchenne', 'Köksförbrukning'],
    'mutfak-gerecleri': ['Kitchenware', 'Küchenutensilien', 'Akcesoria kuchenne', 'Köksredskap'],

    // ——— Kişisel bakım ———
    sampuan: ['Shampoo', 'Shampoo', 'Szampony', 'Schampo'],
    'sac-bakim': ['Hair Care', 'Haarpflege', 'Pielęgnacja włosów', 'Hårvård'],
    'sac-kopugu': ['Hair Mousse', 'Haarschaum', 'Pianki do włosów', 'Hårmousse'],
    'sac-boyalari': ['Hair Colour', 'Haarfarbe', 'Farby do włosów', 'Hårfärg'],
    'dus-jeli': ['Shower Gel', 'Duschgel', 'Żele pod prysznic', 'Duschgel'],
    'dus-jelleri': ['Shower Gels', 'Duschgele', 'Żele pod prysznic (zestaw)', 'Duschgeler'],
    'dus-banyo-ve-sabun': ['Shower, Bath & Soap', 'Dusche, Bad & Seife', 'Prysznic, kąpiel i mydło', 'Dusch, bad & tvål'],
    sabun: ['Soap', 'Seife', 'Mydła', 'Tvål'],
    deodorant: ['Deodorant', 'Deodorant', 'Dezodoranty', 'Deodorant'],
    'parfum-deodorant': ['Perfume & Deodorant', 'Parfüm & Deodorant', 'Perfumy i dezodoranty', 'Parfym & deodorant'],
    kolonya: ['Cologne', 'Kölnisch Wasser', 'Woda kolońska', 'Eau de cologne'],
    'cilt-bakim': ['Skin Care', 'Hautpflege', 'Pielęgnacja skóry', 'Hudvård'],
    'cilt-bakimi': ['Skincare', 'Hautpflegeprodukte', 'Kosmetyki do skóry', 'Hudvårdsprodukter'],
    'yuz-serumu': ['Face Serum', 'Gesichtsserum', 'Serum do twarzy', 'Ansiktsserum'],
    'gunes-koruyucu': ['Sun Care', 'Sonnenschutz', 'Ochrona przeciwsłoneczna', 'Solskydd'],
    'dis-bakim': ['Oral Care', 'Zahnpflege', 'Higiena jamy ustnej', 'Munvård'],
    'dis-macunu': ['Toothpaste', 'Zahnpasta', 'Pasty do zębów', 'Tandkräm'],
    'agiz-bakim': ['Mouth Care', 'Mundpflege', 'Pielęgnacja jamy ustnej', 'Munhygien'],
    tiras: ['Shaving', 'Rasur', 'Golenie', 'Rakning'],
    'tiras-urunleri': ['Shaving Products', 'Rasierprodukte', 'Produkty do golenia', 'Rakprodukter'],
    agda: ['Waxing', 'Enthaarung', 'Depilacja woskiem', 'Vaxning'],
    'agda-ve-epilasyon': ['Waxing & Hair Removal', 'Waxing & Haarentfernung', 'Depilacja i epilacja', 'Vaxning & hårborttagning'],
    makyaj: ['Make-up', 'Make-up', 'Makijaż', 'Smink'],
    'hijyenik-ped': ['Sanitary Pads', 'Damenbinden', 'Podpaski', 'Bindor'],
    'gunluk-ped': ['Panty Liners', 'Slipeinlagen', 'Wkładki higieniczne', 'Trosskydd'],
    tampon: ['Tampons', 'Tampons', 'Tampony', 'Tamponger'],
    prezervatif: ['Condoms', 'Kondome', 'Prezerwatywy', 'Kondomer'],
    pamuk: ['Cotton Wool', 'Watte', 'Wata', 'Bomull'],
    mendil: ['Tissues', 'Taschentücher', 'Chusteczki', 'Näsdukar'],
    'islak-mendil': ['Wet Wipes', 'Feuchttücher', 'Chusteczki nawilżane', 'Våtservetter'],
    pecete: ['Napkins', 'Servietten', 'Serwetki', 'Servetter'],
    'kagit-pecete-ve-mendiller': ['Napkins & Tissues', 'Servietten & Tücher', 'Serwetki i chusteczki', 'Servetter & näsdukar'],
    'kagit-havlu': ['Kitchen Towel', 'Küchenrolle', 'Ręczniki papierowe', 'Hushållspapper'],
    'tuvalet-kagidi': ['Toilet Paper', 'Toilettenpapier', 'Papier toaletowy', 'Toalettpapper'],

    // ——— Bebek ———
    'bebek-mamasi': ['Baby Food', 'Babynahrung', 'Żywność dla niemowląt', 'Barnmat'],
    'bebek-mamalari': ['Baby Foods', 'Babynahrungsmittel', 'Pokarmy dla niemowląt', 'Barnmatsprodukter'],
    'bebek-bezi': ['Nappies', 'Windeln', 'Pieluchy', 'Blöjor'],
    'bebek-ve-hasta-bezi': ['Nappies & Incontinence', 'Windeln & Inkontinenz', 'Pieluchy i wkłady', 'Blöjor & inkontinens'],
    'bebek-bakim': ['Baby Care', 'Babypflege', 'Pielęgnacja niemowląt', 'Babyvård'],
    'bebek-gerecleri': ['Baby Accessories', 'Babyzubehör', 'Akcesoria dla niemowląt', 'Babytillbehör'],

    // ——— Pet ———
    'kedi-mamasi': ['Cat Food', 'Katzenfutter', 'Karma dla kotów', 'Kattmat'],
    'kopek-mamasi': ['Dog Food', 'Hundefutter', 'Karma dla psów', 'Hundmat'],
    'kus-mamasi': ['Bird Food', 'Vogelfutter', 'Karma dla ptaków', 'Fågelmat'],
    'pet-aksesuar': ['Pet Accessories', 'Tierzubehör', 'Akcesoria dla zwierząt', 'Djurtillbehör'],

    // ——— Sağlık ———
    'vitamin-takviye': ['Vitamins & Supplements', 'Vitamine & Nahrungsergänzung', 'Witaminy i suplementy', 'Vitaminer & kosttillskott'],
    'gida-takviyeleri': ['Food Supplements', 'Nahrungsergänzungsmittel', 'Suplementy diety', 'Kosttillskott'],
    'ilk-yardim': ['First Aid', 'Erste Hilfe', 'Pierwsza pomoc', 'Första hjälpen'],
    'yara-bandi': ['Plasters', 'Pflaster', 'Plastry', 'Plåster'],
    'saglik-ve-medikal': ['Health & Medical', 'Gesundheit & Medizin', 'Zdrowie i medycyna', 'Hälsa & medicin'],

    // ——— Ev & diğer ———
    'giyim-ve-tekstil': ['Clothing & Textiles', 'Kleidung & Textilien', 'Odzież i tekstylia', 'Kläder & textil'],
    'oyuncak-ve-hobi': ['Toys & Hobby', 'Spielzeug & Hobby', 'Zabawki i hobby', 'Leksaker & hobby'],
    'oto-ve-yapi-market': ['Auto & DIY', 'Auto & Baumarkt', 'Motoryzacja i budowa', 'Bil & bygg'],
    'tutun-ve-tutun-mamulleri': ['Tobacco', 'Tabakwaren', 'Wyroby tytoniowe', 'Tobak'],
    pil: ['Batteries', 'Batterien', 'Baterie', 'Batterier'],
};

/** Dışa açık sözlük: slug → dil → ad. Türkçe, veritabanındaki addır. */
export const CATEGORY_NAMES: Record<string, Record<Lang, string>> = Object.fromEntries(
    Object.entries(T).map(([slug, [en, de, pl, sv]]) => [
        slug,
        // Türkçe için sözlükte ayrı bir kayıt tutmuyoruz; anahtar zaten TR
        // slug'ı ve ad DB'den geliyor. Test tamlığı için buraya slug'ın
        // kendisini değil, çağrıda kaynak adı kullanılacağını belirten bir
        // yer tutucu koymak yanıltıcı olurdu — bu yüzden TR alanı da doldurulur.
        { tr: turkishNameFor(slug), en, de, pl, sv } as Record<Lang, string>,
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
    const translated = T[slug];
    if (!translated) return { name, slug };
    const idx = { en: 0, de: 1, pl: 2, sv: 3 } as const;
    const localized = translated[idx[lang as Exclude<Lang, 'tr'>]];
    return { name: localized, slug: slugifyName(localized) };
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
