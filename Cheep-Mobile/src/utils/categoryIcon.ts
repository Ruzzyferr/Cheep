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
const KEYWORD_RULES: Array<[string[], string]> = [
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

export function getCategoryIcon(categoryName: string | null | undefined): string {
  const name = norm(categoryName ?? '');
  if (!name) return DEFAULT_ICON;
  if (EXACT[name]) return EXACT[name];
  for (const [keys, icon] of KEYWORD_RULES) {
    if (keys.some((k) => name.includes(k))) return icon;
  }
  return DEFAULT_ICON;
}
