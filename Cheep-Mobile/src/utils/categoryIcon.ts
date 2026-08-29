/**
 * 🗂️ Category icon resolver
 *
 * Maps a category name to a DISTINCT MaterialCommunityIcons glyph. The live
 * taxonomy has ~25 parent categories; previously most of them fell through to a
 * single default ('shape'), so the home grid showed the same icon repeatedly.
 *
 * Strategy: exact (normalized) match against the known taxonomy first, then a
 * keyword fallback for resilience to small name changes, then a sensible default.
 * Every glyph below is verified to exist in the bundled MCI glyphmap.
 */

// tr-lower + trim; keep Turkish letters (keys are written with them too).
function norm(s: string): string {
  return (s || '').toLocaleLowerCase('tr-TR').trim();
}

// Exact taxonomy → icon. Keys are the DEVLET (marketfiyati) üst-kategori adları
// (menu_category), normalize edilmiş (tr-lower). Eski isimler de geriye-dönük tutulur.
const EXACT: Record<string, string> = {
  // Devletin gerçek üst kategorileri:
  'süt ürünleri ve kahvaltılık': 'cheese',
  'et, tavuk ve balık': 'food-steak',
  'meyve ve sebze': 'fruit-watermelon',
  'temel gıda': 'rice',
  'fırın ve pastane': 'bread-slice',
  'içecek': 'bottle-soda-classic',
  'i̇çecek': 'bottle-soda-classic',
  'atıştırmalık ve tatlı': 'cookie',
  'dondurma': 'ice-cream',
  'hazır yemek ve donuk': 'fridge-outline',
  'temizlik ve kişisel bakım ürünleri': 'spray-bottle',
  'bebek': 'baby-carriage',
  'ev, pet ve yaşam': 'sofa-single',
  'sağlık ve kozmetik': 'pill',
  'diğer ürünler': 'dots-horizontal',
  // Eski taksonomi (geriye-dönük uyum):
  'süt ürünleri': 'cheese',
  'meyve & sebze': 'fruit-watermelon',
  'et, tavuk, balık': 'food-steak',
  'fırın & pastane': 'bread-slice',
  'kahvaltılık': 'egg-fried',
  'atıştırmalık': 'cookie',
  'hazır yemek & donuk': 'fridge-outline',
  'donuk & hazır yemek': 'fridge-outline',
  'temizlik': 'spray-bottle',
  'kişisel bakım': 'lotion',
  'kişisel bakım & kozmetik': 'lipstick',
  'pet shop': 'paw',
  'sağlıklı yaşam': 'heart-pulse',
  'sağlık & takviye': 'pill',
  'ev & yaşam': 'sofa-single',
  'kitap & kırtasiye': 'book-open-page-variant',
  'elektronik': 'cellphone',
  'giyim & tekstil': 'tshirt-crew',
  'oyuncak & hobi': 'teddy-bear',
  'kağıt & hijyen': 'paper-roll',
  'diğer': 'dots-horizontal-circle-outline',
};

// Keyword fallback — checked IN ORDER, first hit wins. Ordered so that more
// specific tokens (pet, bebek) come before broader ones (et) to avoid clashes.
const KEYWORD_RULES: [string[], string][] = [
  [['pet', 'köpek', 'kedi', 'evcil'], 'paw'],
  [['bebek', 'mama', 'çocuk bezi'], 'baby-carriage'],
  [['kozmetik', 'makyaj', 'parfüm'], 'lipstick'],
  [['kişisel bakım', 'şampuan', 'bakım'], 'lotion'],
  [['kağıt', 'hijyen', 'peçete', 'tuvalet'], 'paper-roll'],
  [['temizlik', 'deterjan', 'çamaşır'], 'spray-bottle'],
  [['dondurma'], 'ice-cream'],
  [['donuk', 'hazır yemek', 'frozen'], 'fridge-outline'],
  [['kahvaltı'], 'egg-fried'],
  [['atıştır', 'cips', 'çikolata', 'snack'], 'cookie'],
  [['fırın', 'pastane', 'ekmek', 'unlu'], 'bread-slice'],
  [['içecek', 'içecekler', 'meşrubat', 'su', 'kahve', 'çay'], 'bottle-soda-classic'],
  [['süt', 'peynir', 'yoğurt', 'yogurt', 'kahvaltılık'], 'cheese'],
  [['meyve', 'sebze', 'manav'], 'fruit-watermelon'],
  [['tavuk', 'balık', 'kırmızı et', 'şarküteri', 'et,'], 'food-steak'],
  [['temel gıda', 'bakliyat', 'makarna', 'pirinç', 'un', 'yağ'], 'rice'],
  [['sağlık', 'takviye', 'vitamin', 'ilaç'], 'pill'],
  [['sağlıklı'], 'heart-pulse'],
  [['giyim', 'tekstil', 'çorap'], 'tshirt-crew'],
  [['oyuncak', 'hobi', 'oyun'], 'teddy-bear'],
  [['kitap', 'kırtasiye', 'defter', 'kalem'], 'book-open-page-variant'],
  [['elektronik', 'telefon', 'pil'], 'cellphone'],
  [['ev', 'yaşam', 'mutfak'], 'sofa-single'],
];

const DEFAULT_ICON = 'tag-outline';

/**
 * Kanonik slug → simge. DİLDEN BAĞIMSIZ ve bu yüzden BİRİNCİL yol.
 *
 * Aşağıdaki `EXACT`/`KEYWORD_RULES` tabloları TÜRKÇE ADLARA bakıyor, oysa
 * kategori adı istemcinin diline çevriliyor. Sonuç: Türkçe dışındaki YEDİ
 * dilin hepsinde bütün kategoriler tek bir genel etikete düşüyordu — ana
 * sayfada üst üste aynı simgeden bir duvar. Hırvatça ekran görüntüsüyle
 * doğrulandı; Lehçe/Almanca/İngilizce dahil hepsi aynı durumdaydı.
 *
 * `icon_key` sunucudan geliyor ve çeviriden ÖNCEKİ kanonik slug (bkz.
 * backend `localizeRows`). Ad tabanlı tablolar SİLİNMEDİ: sunucu eski bir
 * sürümdeyse (`icon_key` yok) ve dil Türkçeyse eskisi gibi çalışmaya devam
 * ediyor.
 */
const BY_SLUG: Record<string, string> = {
  'sut-urunleri-ve-kahvaltilik': 'cheese',
  'et-tavuk-ve-balik': 'food-steak',
  'meyve-ve-sebze': 'fruit-watermelon',
  'temel-gida': 'rice',
  'firin-ve-pastane': 'bread-slice',
  icecek: 'bottle-soda-classic',
  'icecekler': 'bottle-soda-classic',
  'atistirmalik-ve-tatli': 'cookie',
  dondurma: 'ice-cream',
  'hazir-yemek-ve-donuk': 'fridge-outline',
  'temizlik-ve-kisisel-bakim-urunleri': 'spray-bottle',
  bebek: 'baby-carriage',
  'ev-pet-ve-yasam': 'sofa-single',
  'saglik-ve-kozmetik': 'pill',
  'diger-urunler': 'dots-horizontal',
  // Aşağıdaki ikisi canlı HR/HU/RO ağacında GERÇEKTEN dönüyor ama ilk yazımda
  // atlanmıştı; ikisi de genel etikete düşüyordu. Üretim yanıtı
  // (`/categories/parent`) ile bu tablo karşılaştırılınca çıktı. Ana sayfadaki
  // beşlik şeritte görünmüyorlar ama "Tümü" ekranında görünüyorlar.
  'kisisel-bakim': 'lotion',
  'temizlik-urunleri': 'spray-bottle',
};

/**
 * Kanonik slug PARÇALARI → simge. Sırayla denenir, ilk eşleşen kazanır.
 *
 * NEDEN GEREKLİ: `BY_SLUG` yalnızca ÜST kategorileri tanıyor, ama ürün
 * kartları kategoriyi YAPRAK düzeyinde taşıyor (`gofret`, `dus-jeli`,
 * `kirmizi-et`…). Yaprak eşleşmeyince her kart aynı genel etikete düşüyordu.
 *
 * Bu üç yeni pazarda özellikle kötü: HR/HU/RO kaynaklarında ÜRÜN GÖRSELİ YOK,
 * yani kartların TAMAMI simge gösteriyor. Hepsi aynı simge olunca katalog
 * ölü ve ayırt edilemez görünüyordu.
 *
 * Slug DİLDEN BAĞIMSIZ (çeviriden önceki kanonik hâli), dolayısıyla bu tablo
 * sekiz dilin hepsinde çalışıyor — ad tabanlı `KEYWORD_RULES`ın aksine.
 *
 * PARÇA EŞLEŞMESİ, ALT-DİZE DEĞİL. Düz `includes` denendi ve YANLIŞ SONUÇ
 * VERDİ: `sut` içinde `su` geçtiği için süt, içeceğe düşüyordu; aynı şekilde
 * `sucuk` da. Slug tirelerden bölünüp PARÇA olarak karşılaştırılıyor, yani
 * `su` yalnızca gerçekten `su` olan parçayla eşleşiyor. Tireli anahtarlar
 * (`meyve-suyu`) bütün slug'a karşı sınanıyor.
 *
 * SIRA ÖNEMLİ: dar olan geniş olandan önce (örn. `meyve-suyu` içecek kuralı,
 * `meyve` meyve kuralından önce gelmeli).
 */
const SLUG_RULES: [string[], string][] = [
  [['dondurulmus', 'donuk', 'hazir-yemek'], 'fridge-outline'],
  [['dondurma'], 'ice-cream'],
  [['bebek', 'bebek-mamasi', 'mama'], 'baby-carriage'],
  [['pet', 'kedi', 'kopek', 'evcil'], 'paw'],
  [['makyaj', 'parfum', 'kozmetik', 'oje', 'ruj'], 'lipstick'],
  [['deodorant', 'sampuan', 'dus-jeli', 'cilt-bakim', 'sac-bakim', 'agiz-bakim',
    'kisisel-bakim', 'tras', 'sabun', 'bakim'], 'lotion'],
  [['kagit', 'pecete', 'tuvalet', 'havlu', 'hijyen', 'ped'], 'paper-roll'],
  [['deterjan', 'deterjani', 'temizleyici', 'temizlik', 'camasir', 'bulasik',
    'yumusatici', 'camasir-deterjani', 'yuzey-temizleyici'], 'spray-bottle'],
  [['ilac', 'vitamin', 'takviye', 'saglik'], 'pill'],
  [['ekmek', 'firin', 'pastane', 'firin-pastane', 'unlu', 'kek', 'pasta', 'borek'], 'bread-slice'],
  [['cikolata', 'gofret', 'biskuvi', 'kraker', 'cips', 'sekerleme', 'atistirmalik',
    'kuruyemis', 'sakiz'], 'cookie'],
  [['kahve', 'cay', 'meyve-suyu', 'icecek', 'gazoz', 'maden-suyu', 'soda', 'su'],
    'bottle-soda-classic'],
  [['peynir', 'yogurt', 'sut', 'sutlu-tatlilar', 'tereyag', 'krema', 'kaymak',
    'krema-kaymak', 'yumurta', 'kahvaltilik', 'kahvaltilik-gevrek'], 'cheese'],
  [['sebze', 'meyve', 'manav', 'zeytin'], 'fruit-watermelon'],
  [['tavuk', 'balik', 'et', 'kirmizi-et', 'sarkuteri', 'sucuk', 'salam', 'kiyma'], 'food-steak'],
  [['makarna', 'pirinc', 'bakliyat', 'un', 'yag', 'salca', 'baharat', 'konserve',
    'temel-gida', 'seker'], 'rice'],
  [['ev', 'yasam', 'ev-yasam', 'mutfak', 'mobilya'], 'sofa-single'],
];

/**
 * Slug bir kurala uyuyor mu?
 *
 * Tireli anahtar bütün slug'a karşı sınanır; tiresiz anahtar yalnızca bir
 * PARÇAYA eşitse sayılır (bkz. `SLUG_RULES` başındaki `sut`/`su` tuzağı).
 */
function slugMatches(slug: string, keys: string[]): boolean {
  const parts = slug.split('-');
  return keys.some((k) => (k.includes('-') ? slug === k || slug.includes(k) : parts.includes(k)));
}

/**
 * @param categoryName görünen ad (çevrilmiş olabilir) — yalnızca yedek yol
 * @param iconKey      sunucudan gelen dilden bağımsız kanonik slug
 */
export function getCategoryIcon(
  categoryName: string | null | undefined,
  iconKey?: string | null,
): string {
  // 1) Dilden bağımsız TAM eşleşme (üst kategoriler).
  if (iconKey && BY_SLUG[iconKey]) return BY_SLUG[iconKey];

  // 2) Dilden bağımsız ANAHTAR KELİME (yaprak kategoriler). Ürün kartları
  //    kategoriyi yaprak düzeyinde taşıyor ve yapraklar `BY_SLUG`ta yok.
  if (iconKey) {
    for (const [keys, icon] of SLUG_RULES) {
      if (slugMatches(iconKey, keys)) return icon;
    }
  }

  // 3) Ad tabanlı yedek. Yalnızca Türkçede işe yarıyor ama zarar da vermiyor:
  //    tutmazsa varsayılana düşüyor, yani bu adımın olmaması hiçbir dili
  //    düzeltmez, olması Türkçeyi eski sunucuda ayakta tutar.
  const name = norm(categoryName ?? '');
  if (!name) return DEFAULT_ICON;
  if (EXACT[name]) return EXACT[name];
  for (const [keys, icon] of KEYWORD_RULES) {
    if (keys.some((k) => name.includes(k))) return icon;
  }
  return DEFAULT_ICON;
}
