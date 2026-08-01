/**
 * Kategori adlarının Lehçe karşılıkları.
 *
 * SORUN: `categories` tablosu ülkeler arasında PAYLAŞILIYOR ve adlar yalnızca
 * Türkçe. Polonya kataloğundaki ürünler de bu kategorilere bağlı olduğu için
 * Polonyalı bir kullanıcı "Çikolata", "Kedi Maması", "Bulaşık Deterjanı"
 * görüyordu. SEO tarafında bu ölümcül: "czekolada ceny" arayan kimse
 * "Çikolata" başlıklı bir sayfayı bulamaz.
 *
 * NEDEN BURADA, VERİTABANINDA DEĞİL: kategori listesi sabit ve elle
 * yönetiliyor (`standard-categories.ts` ile aynı desen). Migration + admin
 * arayüzü eklemek, 94 satırlık bir eşleme için orantısız olurdu. Kategori
 * yapısı değişirse iki dosya birlikte güncellenir.
 *
 * SLUG'LAR DA ÇEVRİLİYOR: URL'deki kelime sıralamaya giriyor ve
 * `/pl/kategoria/czekolada` bir Polonyalıya `/pl/kategoria/cikolata`dan çok
 * daha güvenilir görünüyor. Şu an hiçbir sayfa indekslenmediği için slug'ı
 * değiştirmenin maliyeti sıfır; sonra değiştirmek birikmiş sıralamayı yakardı.
 */

export interface LocalizedCategory {
    name: string;
    slug: string;
}

/** TR slug → Lehçe ad ve slug. */
export const CATEGORY_PL: Record<string, LocalizedCategory> = {
    cikolata: { name: 'Czekolada', slug: 'czekolada' },
    baharat: { name: 'Przyprawy', slug: 'przyprawy' },
    'kahvaltilik-sos': { name: 'Sosy śniadaniowe', slug: 'sosy-sniadaniowe' },
    peynir: { name: 'Sery', slug: 'sery' },
    'sutlu-tatlilar': { name: 'Desery mleczne', slug: 'desery-mleczne' },
    'bebek-mamasi': { name: 'Żywność dla niemowląt', slug: 'zywnosc-dla-niemowlat' },
    cips: { name: 'Chipsy', slug: 'chipsy' },
    sarkuteri: { name: 'Wędliny', slug: 'wedliny' },
    'bisküvi-atistirmalik': { name: 'Ciastka', slug: 'ciastka' },
    'kedi-mamasi': { name: 'Karma dla kotów', slug: 'karma-dla-kotow' },
    'temel-gida': { name: 'Produkty podstawowe', slug: 'produkty-podstawowe' },
    sut: { name: 'Mleko', slug: 'mleko' },
    icecek: { name: 'Napoje', slug: 'napoje' },
    kahve: { name: 'Kawa', slug: 'kawa' },
    sebze: { name: 'Warzywa', slug: 'warzywa' },
    'hazir-corba': { name: 'Zupy instant', slug: 'zupy-instant' },
    'meyve-suyu': { name: 'Soki', slug: 'soki' },
    balik: { name: 'Ryby', slug: 'ryby' },
    cay: { name: 'Herbata', slug: 'herbata' },
    sekerleme: { name: 'Słodycze', slug: 'slodycze' },
    yogurt: { name: 'Jogurty', slug: 'jogurty' },
    makarna: { name: 'Makarony', slug: 'makarony' },
    'hazir-yemek': { name: 'Dania gotowe', slug: 'dania-gotowe' },
    'dus-jeli': { name: 'Żele pod prysznic', slug: 'zele-pod-prysznic' },
    salca: { name: 'Koncentrat pomidorowy', slug: 'koncentrat-pomidorowy' },
    'salata-malzemeleri': { name: 'Dodatki do sałatek', slug: 'dodatki-do-salatek' },
    'kopek-mamasi': { name: 'Karma dla psów', slug: 'karma-dla-psow' },
    temizlik: { name: 'Środki czystości', slug: 'srodki-czystosci' },
    kraker: { name: 'Krakersy', slug: 'krakersy' },
    kek: { name: 'Ciasta', slug: 'ciasta' },
    tereyagi: { name: 'Masło', slug: 'maslo' },
    jelibon: { name: 'Żelki', slug: 'zelki' },
    kuruyemiş: { name: 'Bakalie', slug: 'bakalie' },
    'kisisel-bakim': { name: 'Higiena osobista', slug: 'higiena-osobista' },
    hardal: { name: 'Musztarda', slug: 'musztarda' },
    'kahvaltilik-gevrek': { name: 'Płatki śniadaniowe', slug: 'platki-sniadaniowe' },
    yag: { name: 'Oleje', slug: 'oleje' },
    recel: { name: 'Dżemy', slug: 'dzemy' },
    'saglikli-yasam': { name: 'Zdrowa żywność', slug: 'zdrowa-zywnosc' },
    'kahvaltilik-ezme': { name: 'Kremy do smarowania', slug: 'kremy-do-smarowania' },
    deodorant: { name: 'Dezodoranty', slug: 'dezodoranty' },
    pirinç: { name: 'Ryż', slug: 'ryz' },
    gofret: { name: 'Wafle', slug: 'wafle' },
    'dis-bakim': { name: 'Higiena jamy ustnej', slug: 'higiena-jamy-ustnej' },
    'cilt-bakim': { name: 'Pielęgnacja skóry', slug: 'pielegnacja-skory' },
    tiras: { name: 'Golenie', slug: 'golenie' },
    'gazli-icecek': { name: 'Napoje gazowane', slug: 'napoje-gazowane' },
    'enerji-icecegi': { name: 'Napoje energetyczne', slug: 'napoje-energetyczne' },
    sampuan: { name: 'Szampony', slug: 'szampony' },
    su: { name: 'Woda', slug: 'woda' },
    'bulasik-deterjani': { name: 'Płyny do naczyń', slug: 'plyny-do-naczyn' },
    'musli-granola': { name: 'Musli i granola', slug: 'musli-i-granola' },
    'krema-kaymak': { name: 'Śmietana', slug: 'smietana' },
    'camasir-deterjani': { name: 'Proszki do prania', slug: 'proszki-do-prania' },
    ekmek: { name: 'Pieczywo', slug: 'pieczywo' },
    mendil: { name: 'Chusteczki', slug: 'chusteczki' },
    'vitamin-takviye': { name: 'Witaminy i suplementy', slug: 'witaminy-i-suplementy' },
    seker: { name: 'Cukier', slug: 'cukier' },
    kefir: { name: 'Kefir', slug: 'kefir' },
    'kuru-meyve': { name: 'Suszone owoce', slug: 'suszone-owoce' },
    'sac-kopugu': { name: 'Pianki do włosów', slug: 'pianki-do-wlosow' },
    'firin-pastane': { name: 'Piekarnia', slug: 'piekarnia' },
    'dondurma-alt': { name: 'Lody', slug: 'lody' },
    'pet-aksesuar': { name: 'Akcesoria dla zwierząt', slug: 'akcesoria-dla-zwierzat' },
    kruvasan: { name: 'Rogaliki', slug: 'rogaliki' },
    un: { name: 'Mąka', slug: 'maka' },
    'sünger-bez': { name: 'Gąbki i ścierki', slug: 'gabki-i-scierki' },
    'bebek-bezi': { name: 'Pieluchy', slug: 'pieluchy' },
    'kirmizi-et': { name: 'Mięso', slug: 'mieso' },
    atistirmalik: { name: 'Przekąski', slug: 'przekaski' },
    bakliyat: { name: 'Rośliny strączkowe', slug: 'rosliny-straczkowe' },
    pasta: { name: 'Torty', slug: 'torty' },
    'cop-torbasi': { name: 'Worki na śmieci', slug: 'worki-na-smieci' },
    kakao: { name: 'Kakao', slug: 'kakao' },
    'bebek-bakim': { name: 'Pielęgnacja niemowląt', slug: 'pielegnacja-niemowlat' },
    'dondurulmus-gida': { name: 'Mrożonki', slug: 'mrozonki' },
    'alkolsuz-bira': { name: 'Piwo bezalkoholowe', slug: 'piwo-bezalkoholowe' },
    'dondurulmus-sebze': { name: 'Mrożone warzywa', slug: 'mrozone-warzywa' },
    bal: { name: 'Miód', slug: 'miod' },
    zeytin: { name: 'Oliwki', slug: 'oliwki' },
    pamuk: { name: 'Wata', slug: 'wata' },
    kolonya: { name: 'Woda kolońska', slug: 'woda-kolonska' },
    'tuvalet-temizleyici': { name: 'Środki do WC', slug: 'srodki-do-wc' },
    sirke: { name: 'Ocet', slug: 'ocet' },
    'sut-urunleri': { name: 'Nabiał', slug: 'nabial' },
    'deniz-urunleri': { name: 'Owoce morza', slug: 'owoce-morza' },
    helva: { name: 'Chałwa', slug: 'chalwa' },
    'dis-macunu': { name: 'Pasty do zębów', slug: 'pasty-do-zebow' },
    'otomatik-oda-kokulari': { name: 'Odświeżacze powietrza', slug: 'odswiezacze-powietrza' },
    meyve: { name: 'Owoce', slug: 'owoce' },
    'tuvalet-kagidi': { name: 'Papier toaletowy', slug: 'papier-toaletowy' },
    'dondurma-cubuk': { name: 'Lody na patyku', slug: 'lody-na-patyku' },
    tavuk: { name: 'Drób', slug: 'drob' },
    yumurta: { name: 'Jajka', slug: 'jajka' },
};

/**
 * Bir kategoriyi ülkenin diline çevirir. Eşleme yoksa Türkçe adı olduğu gibi
 * döner — yeni bir kategori eklendiğinde sayfa kaybolmasın, sadece çevrilmemiş
 * görünsün (sessiz veri kaybından iyidir).
 */
export function localizeCategory(countryCode: string, name: string, slug: string): LocalizedCategory {
    if (countryCode !== 'PL') return { name, slug };
    return CATEGORY_PL[slug] ?? { name, slug };
}
