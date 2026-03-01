import { prisma } from '../../utils/prisma.client.js';
import {
    STANDARD_CATEGORIES,
    findStandardCategoryByName,
    findStandardCategoryBySlug,
    type StandardCategory,
    type StandardSubcategory,
} from '../../config/standard-categories.js';

/**
 * Category Matcher Service
 * Artık sadece STANDART kategorileri kullanır.
 * Yeni kategori oluşturulmaz - sadece mevcut standart kategorilere eşleştirme yapılır.
 */

interface CategoryKeywordMap {
    [parentName: string]: string[];
}

export class CategoryMatcher {
    private parentCache = new Map<string, number>();
    // Kategori eşleştirmeleri için cache (ürün adı + kategori adı -> kategori ID)
    private categoryMatchCache = new Map<string, number>();

    // Parent kategoriler için keyword mapping - KAPSAMLI LİSTE (Tüm yaygın kelimeler ve markalar)
    private categoryKeywords: CategoryKeywordMap = {
        'Süt Ürünleri': [
            // Süt - Genel
            'süt', 'milk', 'sut', 'sut urunleri', 'pastörize süt', 'uzun ömürlü süt', 'günlük süt',
            'tam yağlı süt', 'yarım yağlı süt', 'yağsız süt', 'laktozsuz süt', 'organik süt',
            'uzun ömürlü süt', 'günlük süt', 'taze süt', 'çiğ süt', 'homojenize süt',
            // Süt - Markalar
            'pınar', 'pinar', 'sütaş', 'sutas', 'sutas', 'içim', 'ichim', 'ekici', 'akgun',
            'önem', 'onem', 'günlük', 'gunluk', 'migros süt', 'carrefour süt',
            // Peynir - Genel
            'peynir', 'cheese', 'beyaz peynir', 'beyaz-peynir', 'taze peynir',
            'kaşar', 'kasar', 'taze kaşar', 'eski kaşar', 'dilim kaşar', 'rendelenmiş kaşar',
            'tulum peynir', 'tulum-peynir', 'tulum peyniri', 'ezine peyniri', 'yöresel peynir',
            'yoresel peynir', 'lokum peynir', 'lif peynir', 'lor peyniri', 'çökelek peyniri',
            'çerkez peyniri', 'cerkez peyniri', 'labne', 'labneh', 'krem peynir', 'cream cheese',
            'philadelphia', 'tost peyniri', 'burger peyniri', 'mozzarella', 'cheddar',
            'kaşar peyniri', 'kasar peyniri', 'gravyer', 'rokfor', 'küflü peynir', 'kuflu peynir',
            // Peynir - Markalar
            'ekici peynir', 'önem peynir', 'onem peynir', 'sütaş peynir', 'sutas peynir',
            'pınar peynir', 'pinar peynir', 'köy peyniri', 'koy peyniri',
            // Yoğurt - Genel
            'yoğurt', 'yogurt', 'yourt', 'yogurdu', 'yogurd', 'yoğurdu',
            'sade yogurt', 'sade yoğurt', 'meyveli yoğurt', 'meyveli yoğurt', 'kaymaklı yoğurt',
            'kaymakli yoğurt', 'organik yoğurt', 'probiyotik yoğurt', 'tava yoğurdu',
            'tam yağlı yoğurt', 'yarım yağlı yoğurt', 'yağsız yoğurt', 'süzme yoğurt',
            'suzme yoğurt', 'yunan yoğurdu', 'yunan yogurt', 'greek yogurt',
            // Yoğurt - Markalar
            'sütaş yoğurt', 'sutas yogurt', 'pınar yoğurt', 'pinar yogurt', 'ekici yoğurt',
            'migros yogurt', 'carrefour yogurt',
            // Krema & Kaymak
            'kaymak', 'cream', 'krema ve kaymak', 'süt kaymağı', 'sut kaymagi',
            'krema', 'cooking cream', 'whipping cream', 'beyaz krema', 'tatlı kreması',
            'tatli kremasi', 'şanti', 'santi', 'whip cream',
            // Tereyağı
            'tereyağ', 'tereyagi', 'butter', 'sade tereyağı', 'tuzlu tereyağı', 'tuzsuz tereyağı',
            'taze tereyağı', 'köy tereyağı', 'koy tereyagi', 'paket tereyağı',
            // Margarin
            'margarin', 'margarine', 'paket margarin', 'kase margarin', 'vitam', 'sana',
            'vitam margarin', 'sana margarin', 'ora', 'kalb', 'bölge margarin', 'bolge margarin',
            // Ayran
            'ayran', 'ayran', 'doğal ayran', 'dogal ayran', 'koyun ayranı', 'köy ayranı',
            'sade ayran', 'tuzlu ayran', 'light ayran', 'sütaş ayran', 'sutas ayran',
            // Puding
            'puding', 'pudding', 'vanilyalı puding', 'çikolatalı puding', 'meyveli puding',
            'sütlü tatlı', 'sutlu tatli', 'keşkül', 'keskul', 'muhallebi',
            // Kefir
            'kefir', 'keffir', 'organik kefir', 'meyveli kefir',
        ],
        'Meyve & Sebze': [
            // Meyve - Genel
            'meyve', 'fruit', 'elma', 'armut', 'portakal', 'mandalina', 'muz', 'çilek', 'cilek',
            'kiraz', 'şeftali', 'seftali', 'kayısı', 'kayisi', 'üzüm', 'uzum', 'nar', 'limon',
            'greyfurt', 'avokado', 'ananas', 'mango', 'kiwi', 'karpuz', 'kavun', 'şeftali',
            'erik', 'vişne', 'visne', 'ayva', 'incir', 'hurma', 'armut', 'armud', 'çilek',
            'dut', 'böğürtlen', 'bogurtlen', 'ahududu', 'frenk üzümü', 'frenk uzumu',
            // Meyve - Organik
            'organik meyve', 'organik-meyve', 'köy meyvesi', 'koy meyvesi',
            // Sebze - Genel
            'sebze', 'vegetable', 'domates', 'salatalık', 'salatalik', 'biber', 'patlıcan',
            'patlican', 'kabak', 'havuç', 'havuc', 'soğan', 'sogan', 'sarımsak', 'sarimsak',
            'patates', 'lahana', 'brokoli', 'karnabahar', 'fasulye', 'bezelye', 'mısır',
            'misir', 'ıspanak', 'ispanak', 'marul', 'pırasa', 'pırasa', 'kereviz',
            'bamya', 'barbunya', 'taze fasulye', 'yeşil fasulye', 'yesil fasulye',
            // Sebze - Organik
            'organik sebze', 'organik-sebze', 'köy sebzesi', 'koy sebzesi',
            // Salata Malzemeleri
            'salata', 'lettuce', 'roka', 'marul', 'maydanoz', 'dereotu', 'tere', 'semizotu',
            'salata malzemeleri', 'yesillik', 'yeşillik', 'roka salatası', 'marul salatası',
            'iceberg', 'akdeniz salatası', 'karışık salata', 'karisik salata',
            // Kuru Meyve
            'kuru meyve', 'kuru-sebze', 'kuru incir', 'kuru üzüm', 'kuru kayısı', 'kuru erik',
            'kuru kayisi', 'kuru erik', 'kuru üzüm', 'kuru incir', 'hurma', 'kuru hurma',
            // Kuru Sebze
            'kuru sebze', 'kuru fasulye', 'kuru patlıcan', 'kuru biber',
        ],
        'Et, Tavuk, Balık': [
            // Et - Genel
            'et', 'meat', 'dana', 'kuzu', 'koyun', 'kırmızı et', 'kirmizi et', 'kıyma', 'kiyma',
            'bonfile', 'antrikot', 'pirzola', 'kontrfile', 'kuşbaşı', 'kusbasi', 'rosto',
            'but', 'but et', 'göğüs', 'gogus', 'biftek', 'steak', 'dana eti', 'kuzu eti',
            'döner', 'doner', 'kebap', 'köfte', 'kofte', 'köfte harcı', 'kofte harcı',
            // Et - Markalar & Türler
            'migros et', 'carrefour et', 'fresh meat', 'kasap eti',
            // Tavuk - Genel
            'tavuk', 'chicken', 'piliç', 'pilice', 'tavuk but', 'tavuk göğüs', 'tavuk kanat',
            'tavuk baget', 'tavuk fileto', 'tavuk göğüs', 'tavuk but', 'whole chicken',
            'butcher', 'tavuk göğsü', 'tavuk eti', 'organik tavuk', 'köy tavuğu', 'koy tavugu',
            // Tavuk - Hazır
            'tavuk nugget', 'tavuk kanat', 'tavuk parmak', 'tavuk şinitzel', 'tavuk sinitzel',
            // Hindi
            'hindi', 'turkey', 'hindi but', 'hindi göğüs', 'hindi gogus', 'hindi eti',
            // Balık - Genel
            'balık', 'fish', 'hamsi', 'levrek', 'çupra', 'cupra', 'somon', 'ton balığı',
            'ton baligi', 'lüfer', 'lufer', 'palamut', 'sardalya', 'alabalık', 'alabalik',
            'dil balığı', 'dil baligi', 'istavrit', 'mezgit', 'taze balık', 'taze balik',
            // Deniz ürünleri
            'deniz ürünleri', 'deniz urunleri', 'seafood', 'karides', 'midye', 'kalamar',
            'ahtapot', 'istiridye', 'pavurya', 'yengeç', 'yengec', 'deniz tarağı',
            'deniz taragi', 'deniz ürünü', 'deniz urunu',
            // Şarküteri - Genel
            'şarküteri', 'sarkuteri', 'charcuterie', 'salam', 'sausage', 'sucuk', 'pastırma',
            'pastirma', 'sosis', 'sucuklu yumurta', 'jambon', 'turkey', 'roast beef',
            'sucuk', 'pastırma', 'salam', 'sosisli', 'hot dog', 'frankfurter', 'wiener',
            // Şarküteri - Türk
            'kavurma', 'sucuk', 'pastırma', 'türk sucuğu', 'turk sucugu', 'beyaz peynirli sucuk',
            // Şarküteri - Markalar
            'pınar sucuk', 'pinar sucuk', 'banvit', 'köfteci yusuf', 'kofteci yusuf',
        ],
        'Temel Gıda': [
            // Un - Genel
            'un', 'flour', 'beyaz un', 'tam buğday unu', 'tam bugday unu', 'galeta unu',
            'galeta un', 'breadcrumbs', 'bağdat galeta', 'bagdat galeta', 'mısır unu',
            'misir unu', 'çavdar unu', 'cavdar unu', 'kepekli un', 'organik un',
            // Un - Markalar
            'nilüfer un', 'nilufer un', 'sinangil un', 'torku un',
            // Şeker - Genel
            'şeker', 'seker', 'sugar', 'toz şeker', 'toz seker', 'kesme şeker', 'kesme seker',
            'küp şeker', 'kup seker', 'kahverengi şeker', 'kahverengi seker', 'esmer şeker',
            'esmer seker', 'beyaz şeker', 'beyaz seker', 'vanilyalı şeker', 'vanilyali seker',
            // Pirinç - Genel
            'pirinç', 'pirinç', 'rice', 'beyaz pirinç', 'beyaz pirinc', 'osmancık', 'osmanciik',
            'baldo', 'pirinç pilavı', 'pirinç pilavi', 'basmati pirinç', 'basmati pirinc',
            // Bulgur - Genel
            'bulgur', 'bulgur pilav', 'köftelik bulgur', 'kofte lik bulgur', 'pilavlık bulgur',
            'pilavlik bulgur', 'ince bulgur', 'kalın bulgur', 'kalin bulgur',
            // Makarna - Genel
            'makarna', 'pasta', 'spaghetti', 'penne', 'fusilli', 'fettuccine', 'lasagna',
            'ravioli', 'gnocchi', 'linguine', 'rigatoni', 'bucatini', 'tagliatelle',
            'orzo', 'risoni', 'ditalini', 'farfalla', 'tagliatelle',
            // Makarna - Markalar
            'barilla', 'barilla makarna', 'oli', 'oli makarna', 'knorr makarna',
            'torku makarna', 'dr.oetker makarna',
            // Bakliyat - Genel
            'bakliyat', 'legume', 'nohut', 'mercimek', 'kırmızı mercimek', 'kirmizi mercimek',
            'yeşil mercimek', 'yesil mercimek', 'sarı mercimek', 'sari mercimek',
            'fasulye', 'barbunya', 'kuru fasulye', 'beyaz fasulye', 'borülce', 'borulce',
            'taze fasulye', 'yeşil fasulye', 'yesil fasulye', 'bakla', 'bezelye',
            // Yağ - Genel
            'yağ', 'yag', 'oil', 'ayçiçek yağı', 'aycicek yagi', 'zeytinyağı', 'zeytinyagi',
            'mısır yağı', 'misir yagi', 'kanola yağı', 'kanola yagi', 'palm yağı',
            'sıvı yağ', 'sivi yag', 'riviera', 'riviera zeytinyağı', 'natürel sızma',
            'naturel sızma', 'soğuk sıkım', 'soguk sıkım', 'extra virgin',
            // Yağ - Markalar
            'komili', 'taris', 'yudum', 'kırlangıç', 'kirlangic', 'marmarabirlik',
            // Salça - Genel (ÖNEMLİ: Meyve & Sebze değil, Temel Gıda)
            'salça', 'salca', 'tomato paste', 'domates salçası', 'domates salcasi',
            'biber salçası', 'biber salcasi', 'tat salça', 'tat salca', 'domates püresi',
            'domates pureesi', 'domates rendesi', 'domates dogranmis', 'domates doğranmış',
            // Ketçap/Sos - Genel
            'ketçap', 'ketchup', 'ketcap', 'tat ketçap', 'tat ketchup', 'mayonez',
            'mayonnaise', 'sos', 'sauce', 'cheddar sos', 'ranch sos', 'barbekü sos',
            'barbeku sos', 'calve', 'calve ranch', 'calve cheddar', 'kısır sosu',
            'kisir sosu', 'nar ekşisi', 'nar eksisi', 'balsamic', 'soya sosu',
            // Sos - Markalar
            'tat ketçap', 'heinz', 'knorr sos', 'unilever',
            // Turşu
            'turşu', 'tursu', 'pickle', 'kornişon', 'kornison', 'salatalık turşusu',
            'salatalik tursusu', 'lahana turşusu', 'lahana tursusu', 'biber turşusu',
            // Çorba - Genel
            'hazır çorba', 'hazir corba', 'instant soup', 'çorba', 'corba',
            'mercimek çorbası', 'mercimek corbasi', 'yayla çorbası', 'yayla corbasi',
            'tavuk çorbası', 'tavuk corbasi', 'domates çorbası', 'domates corbasi',
            'tavuk suyu', 'et suyu', 'bulyon', 'bouillon',
            // Çorba - Markalar
            'knorr', 'knorr çorba', 'maggi', 'maggi çorba', 'dr.oetker çorba',
            // Baharat - Genel
            'baharat', 'spice', 'karabiber', 'kırmızı biber', 'kirmizi biber',
            'pul biber', 'kimyon', 'zencefil', 'tarçın', 'tarcin', 'kekik', 'biberiye',
            'nane', 'defne', 'sumak', 'zerdeçal', 'zerdecаl', 'körü', 'kori', 'curry',
            'biberiye', 'fesleğen', 'feslegen', 'biberiye', 'paprika', 'beyaz biber',
            'beyaz-biber', 'kırmızı toz biber', 'kirmizi toz biber', 'toz biber',
            // Baharat - Karışım
            'baharat karışımı', 'baharat karisimi', 'köfte baharatı', 'kofte baharati',
            'tavuk baharatı', 'tavuk baharati', 'balık baharatı', 'balik baharati',
            // Sirke - Genel
            'sirke', 'vinegar', 'elma sirkesi', 'elma sirkesi', 'üzüm sirkesi',
            'uzum sirkesi', 'beyaz sirke', 'balzamik sirke', 'balsamic',
            // Tuz - Genel
            'tuz', 'salt', 'sofra tuzu', 'iyotlu tuz', 'kaya tuzu', 'deniz tuzu',
            'tuzsuz', 'deniz tuzu', 'himalaya tuzu',
        ],
        'İçecek': [
            // Su - Genel
            'su', 'water', 'şişe su', 'sisе su', 'damacana', 'pet şişe', 'pet sise',
            'damacana su', 'sade su', 'maden suyu', 'doğal kaynak suyu', 'dogal kaynak suyu',
            'soda', 'gazoz', 'maden suyu',
            // Su - Markalar
            'beypazarı', 'beypazari', 'erikli', 'hayat', 'pınar su', 'pinar su',
            'danone', 'nestle pure life', 'uludag', 'saka', 'damla', 'nestle',
            // Meyve suyu - Genel
            'meyve suyu', 'juice', 'portakal suyu', 'elma suyu', 'nar suyu', 'vişne suyu',
            'visne suyu', 'kayısı suyu', 'kayisi suyu', 'şeftali suyu', 'seftali suyu',
            'çilek suyu', 'cilek suyu', 'üzüm suyu', 'uzum suyu', 'karışık meyve suyu',
            'karisik meyve suyu', 'nektar', 'smoothie',
            // Meyve suyu - Markalar
            'cappy', 'fruko', 'j7', 'dimes', 'torku', 'pınar', 'pinar',
            // Gazlı İçecek - Genel
            'kola', 'cola', 'coca cola', 'pepsi', 'pepsi cola', 'fanta', 'sprite',
            '7up', 'schweppes', 'gazlı', 'carbonated', 'soda', 'tonik', 'tonic',
            'limonata', 'portakal gazoz', 'visne gazoz', 'vişne gazoz',
            // Gazlı - Markalar
            'coca-cola', 'pepsi-cola', 'uludag', 'kayisi gazoz', 'kayısı gazoz',
            // Çay - Genel
            'çay', 'cay', 'tea', 'siyah çay', 'siyah cay', 'yeşil çay', 'yesil cay',
            'bitki çayı', 'bitki cayi', 'bardak poşet çay', 'bardak poset cay',
            'poşet çay', 'poset cay', 'yaprak çay', 'yaprak cay', 'rize çayı',
            'rize cayi', 'çaykur çayı', 'caykur cayi',
            // Çay - Markalar
            'doğuş', 'dogus', 'doğuş çay', 'dogus cay', 'ahmad tea', 'black label',
            'lipton', 'çaykur', 'caykur', 'tiryaki', 'tiryaki çay', 'rize çayı',
            'lady grey', 'earl grey', 'twinings',
            // Kahve - Genel
            'kahve', 'coffee', 'türk kahvesi', 'turk kahvesi', 'filtre kahve',
            'instant kahve', 'granül kahve', 'granul kahve', 'espresso', 'cappuccino',
            'latte', 'americano', 'mocha', 'nescafe', 'nespresso', 'nesquik',
            // Kahve - Markalar
            'tchibo', 'starbucks', 'jacobs', 'maxwell', 'lavazza', 'segafredo',
            'dallmayr', 'illy', 'starbucks kahve',
            // Enerji İçeceği
            'enerji içeceği', 'enerji icecegi', 'energy drink', 'red bull',
            'monster', 'burn', 'powerade', 'gatorade',
            // Alkolsüz Bira
            'alkolsüz bira', 'alkolsuz bira', 'non-alcoholic beer', 'bira 0%',
            // Diğer İçecekler
            'kombucha', 'kefir içeceği', 'kefir icecegi', 'probiyotik içecek',
        ],
        'Fırın & Pastane': [
            // Ekmek - Genel
            'ekmek', 'bread', 'beyaz ekmek', 'tam buğday', 'tam bugday', 'çavdar ekmeği',
            'cavdar ekmeği', 'kepekli ekmek', 'hamburger ekmeği', 'hot dog ekmeği',
            'sandviç ekmeği', 'sandvic ekmeği', 'tost ekmeği', 'francala', 'somun ekmek',
            'köy ekmeği', 'koy ekmeği', 'organik ekmek', 'tam tahıl ekmek', 'tam tahil ekmek',
            // Ekmek - Markalar
            'uno', 'eki', 'ekmek', 'migros ekmek', 'carrefour ekmek',
            // Simit
            'simit', 'gevrek simit', 'susamli simit', 'susamlı simit', 'açık simit',
            'acik simit', 'taze simit',
            // Poğaça/Börek
            'poğaça', 'pogaca', 'börek', 'borek', 'su böreği', 'su boregi', 'çiğ börek',
            'cig borek', 'sigara böreği', 'sigara boregi', 'kol böreği', 'kol boregi',
            'milföy', 'milfoy', 'mılfoey', 'açma', 'acma', 'puf böreği', 'puf boregi',
            'peynirli börek', 'peynirli borek', 'patatesli börek', 'patatesli borek',
            // Pasta - Genel
            'pasta', 'cake', 'doğum günü pastası', 'dogum gunu pastasi', 'pasta',
            'cheesecake', 'tiramisu', 'sufle', 'eclair', 'ekler', 'napoleon', 'tart',
            'tartaleta', 'brownie', 'cookie', 'kurabiye', 'kek', 'muffin', 'cupcake',
            'magnolia', 'red velvet',
            // Kek - Genel
            'kek', 'cake', 'pandispanya', 'sponge cake', 'kremalı kek', 'kremali kek',
            'çikolatalı kek', 'cikolatali kek', 'meyveli kek', 'meyveli kek',
            // Çörek
            'çörek', 'corek', 'tahinli çörek', 'tahinli corek', 'susamli çörek',
            'susamli corek', 'tahinli çörek',
            // Bisküvi (Fırın & Pastane - sade bisküviler)
            'bisküvi', 'biscuit', 'çay bisküvisi', 'cay bisküvisi', 'petit beurre',
            'sade bisküvi', 'kraker bisküvi', 'tuzlu bisküvi', 'kraker',
        ],
        'Kahvaltılık': [
            // Reçel - Genel
            'kahvaltı', 'breakfast', 'kahvaltilik', 'reçel', 'recel', 'jam',
            'çilek reçeli', 'cilek receli', 'kayısı reçeli', 'kayisi receli',
            'vişne reçeli', 'visne receli', 'şeftali reçeli', 'seftali receli',
            'portakal reçeli', 'portakal receli', 'karışık meyve reçeli',
            'karisik meyve receli', 'organik reçel', 'organik recel',
            // Reçel - Markalar
            'tadım reçel', 'tadim recel', 'dr.oetker reçel', 'dr.oetker recel',
            // Bal - Genel
            'bal', 'honey', 'çiçek balı', 'cicek bali', 'kestane balı', 'kestane bali',
            'çam balı', 'cam bali', 'organik bal', 'petek bal', 'süzme bal', 'suzme bal',
            'karakovan balı', 'karakovan bali', 'köy balı', 'koy bali',
            // Zeytin - Genel
            'zeytin', 'olive', 'siyah zeytin', 'siyah zeytin', 'yeşil zeytin',
            'yesil zeytin', 'biberli zeytin', 'biberli zeytin', 'kokteyl zeytin',
            'kokteyl zeytin', 'çizik zeytin', 'cizik zeytin', 'zeytin ezmesi',
            'zeytin ezmesi', 'yeşil zeytin ezmesi', 'yesil zeytin ezmesi',
            // Zeytin - Markalar
            'komili zeytin', 'taris zeytin', 'yudum zeytin',
            // Tahin/Pekmez - Genel
            'tahin', 'pekmez', 'tahin pekmez', 'üzüm pekmezi', 'uzum pekmezi',
            'dut pekmezi', 'keçiboynuzu pekmezi', 'keciboynuzu pekmezi',
            // Helva - Genel
            'helva', 'tahin helvası', 'tahin helvasi', 'çikolatalı helva',
            'cikolatali helva', 'vanilyalı helva', 'vanilyali helva', 'fıstıklı helva',
            'fistikli helva', 'kakao helvası', 'kakao helvasi',
            // Helva - Markalar
            'köy helvası', 'koy helvasi', 'maraş helvası', 'maras helvasi',
            // Yumurta - Genel
            'yumurta', 'egg', 'organik yumurta', 'köy yumurtası', 'koy yumurtasi',
            'tavuk yumurtası', 'tavuk yumurtasi', 'beyaz yumurta', 'kahverengi yumurta',
            'kahverengi yumurta', 'omega 3 yumurta', 'omega-3 yumurta',
            // Ezme - Genel
            'ezme', 'spread', 'fındık ezmesi', 'findik ezmesi', 'fıstık ezmesi',
            'fistik ezmesi', 'nuga', 'sarelle', 'nutella', 'krem çikolata',
            'krem cikolata', 'kakaolu fındık kreması', 'kakaolu findik kremasi',
            'kakaolu fıstık kreması', 'kakaolu fistik kremasi',
            // Ezme - Markalar
            'nutella', 'nuga', 'sarelle', 'eti kremalı çikolata', 'eti kremali cikolata',
            // Gevrek/Müsli - Genel
            'granola', 'müsli', 'musli', 'gevrek', 'cereal', 'cornflakes',
            'yulaf gevreği', 'yulaf gevreği', 'ballı gevrek', 'balli gevrek',
            'çikolatalı gevrek', 'cikolatali gevrek', 'meyveli gevrek', 'meyveli gevrek',
            // Gevrek - Markalar
            'nestle cornflakes', 'kelloggs', 'cheerios',
            // Sos - Genel
            'kahvaltılık sos', 'kahvaltilik sos', 'krema ve sos', 'çikolatalı sos',
            'cikolatali sos', 'fındık kreması', 'findik kremasi',
        ],
        'Atıştırmalık': [
            // Çikolata - Genel
            'çikolata', 'cikolata', 'chocolate', 'sütlü çikolata', 'sutlu cikolata',
            'bitter çikolata', 'bitter cikolata', 'beyaz çikolata', 'beyaz cikolata',
            'dilim', 'dilimi', 'süt dilimi', 'sut dilimi', 'çikolata bar',
            'cikolata bar', 'chocolate bar', 'tablet çikolata', 'tablet cikolata',
            // Çikolata - Markalar
            'kinder', 'milka', 'nestle', 'eti', 'ülker çikolata', 'ulker cikolata',
            'damak', 'tadelle', 'carte d\'or', 'ferrero rocher', 'toblerone',
            'snickers', 'mars', 'twix', 'bounty', 'kit kat',
            // Bisküvi (Atıştırmalık) - Genel
            'bisküvi', 'biscuit', 'bisküvi çeşitleri', 'bisküvi cesitleri',
            'çikolatalı bisküvi', 'cikolatali bisküvi', 'vanilyalı bisküvi',
            'vanilyali bisküvi', 'sütlü bisküvi', 'sutlu bisküvi', 'ballı bisküvi',
            'balli bisküvi', 'fındıklı bisküvi', 'findikli bisküvi',
            // Bisküvi - Markalar
            'petibör', 'yupo', 'eti', 'ülker bisküvi', 'ulker bisküvi',
            'uncle toby\'s', 'oreo', 'lu',
            // Gofret - Genel
            'gofret', 'wafer', 'çikolatalı gofret', 'cikolatali gofret',
            'fındıklı gofret', 'findikli gofret', 'vanilyalı gofret',
            'vanilyali gofret',
            // Gofret - Markalar
            'ülker gofret', 'ulker gofret', 'eti gofret',
            // Kuruyemiş - Genel
            'kuruyemiş', 'kuruyemis', 'nuts', 'fındık', 'findik', 'fıstık', 'fistik',
            'badem', 'ceviz', 'leblebi', 'kabak çekirdeği', 'kabak cekirdegi',
            'ay çekirdeği', 'ay cekirdegi', 'kaju', 'antep fıstığı', 'antep fistigi',
            'çiğ badem', 'cig badem', 'kavrulmuş fındık', 'kavrulmus findik',
            'tuzlu fıstık', 'tuzlu fistik', 'kavrulmuş badem', 'kavrulmus badem',
            // Kuruyemiş - Karışık
            'karışık kuruyemiş', 'karisik kuruyemis', 'çerez', 'cerеz',
            // Cips - Genel
            'cips', 'chips', 'patates cipsi', 'patates cipsi', 'tuzlu cips',
            'peynirli cips', 'soğanlı cips', 'soganli cips', 'baharatlı cips',
            'baharatli cips',
            // Cips - Markalar
            'doritos', 'lays', 'pringles', 'çitos', 'ritos', 'patos',
            // Kraker - Genel
            'kraker', 'kraket', 'cracker', 'tuzlu kraker', 'peynirli kraker',
            'tahinli kraker', 'tahinli kraker',
            // Şekerleme - Genel
            'şekerleme', 'sekerleme', 'candy', 'akide şekeri', 'akide sekeri',
            'lokum', 'türk lokumu', 'turk lokumu', 'jöle şeker', 'jole seker',
            'nane şekeri', 'nane sekeri', 'bonibon', 'meyve şekeri', 'meyve sekeri',
            // Şekerleme - Markalar
            'ülker şekerleme', 'ulker sekerleme', 'eti şekerleme', 'eti sekerleme',
            // Jelibon - Genel
            'jelibon', 'jelly', 'haribo', 'jöle', 'jole', 'sakızlı şeker',
            'sakizli seker', 'jöleli şeker', 'joleli seker',
            // Jelibon - Markalar
            'haribo', 'ülker jelibon', 'ulker jelibon',
            // Sakız - Genel
            'sakız', 'sakiz', 'chewing gum', 'bubble gum', 'şekerli sakız',
            'sekerli sakiz', 'sakızsız şeker', 'sakizsiz seker',
            // Sakız - Markalar
            'orbit', 'first', 'falim', 'big red', 'trident', 'extra',
            // Diğer Atıştırmalıklar
            'atıştırmalık', 'atistirmalik', 'snack', 'pestil', 'meyve pestili',
            'meyve pestili', 'fruit leather', 'bonheur', 'kat kat tat', 'katkat',
            'mısır patlağı', 'misir patlagi', 'popcorn', 'patlamış mısır',
            'patlamis misir',
        ],
        'Dondurma': [
            // Dondurma - Genel
            'dondurma', 'ice cream', 'sade dondurma', 'cikolatali dondurma', 'çikolatalı dondurma',
            'vanilyalı dondurma', 'vanilyali dondurma', 'meyveli dondurma', 'meyveli dondurma',
            'dondurma çubuk', 'dondurma cubuk', 'dondurma külah', 'dondurma kulah',
            'kremalı dondurma', 'kremali dondurma', 'sorbet', 'dondurma',
            // Dondurma - Markalar
            'cornetto', 'magnum', 'carte d\'or', 'algida', 'unilever', 'migros dondurma',
            'carrefour dondurma', 'ben & jerry\'s', 'haagen-dazs',
            // Donuk Tatlı
            'donuk tatlı', 'donuk tatli', 'frozen dessert', 'dondurulmuş tatlı',
            'dondurulmus tatli', 'baklava', 'künefe', 'kunefe',
        ],
        'Hazır Yemek & Donuk': [
            // Hazır Yemek - Genel
            'hazır yemek', 'hazir yemek', 'ready meal', 'donuk', 'dondurulmuş', 'dondurulmus',
            'frozen food', 'dondurulmuş gıda', 'dondurulmus gida',
            // Pizza
            'pizza', 'margarita pizza', 'pepperoni pizza', 'karışık pizza', 'karisik pizza',
            'pizza hamuru', 'pizza hamuru', 'pizza karışımı', 'pizza karisimi',
            // Hamburger & Köfte
            'hamburger', 'burger', 'hamburger ekmeği', 'burger ekmeği', 'köfte', 'kofte',
            'köfte harcı', 'kofte harcı', 'hamburger köfte', 'hamburger kofte',
            // Nugget & Tavuk
            'nugget', 'tavuk nugget', 'chicken nugget', 'tavuk şinitzel', 'tavuk sinitzel',
            'tavuk parmak', 'chicken fingers',
            // Patates
            'patates kızartması', 'patates kizartmasi', 'french fries', 'patates kroket',
            'rösti', 'rosti', 'hash brown',
            // Dondurulmuş Sebze
            'dondurulmuş sebze', 'dondurulmus sebze', 'frozen vegetables',
            'dondurulmuş bezelye', 'dondurulmus bezelye', 'dondurulmuş mısır',
            'dondurulmus misir', 'dondurulmuş karışık sebze', 'dondurulmus karisik sebze',
            // Dondurulmuş Meyve
            'dondurulmuş meyve', 'dondurulmus meyve', 'frozen fruit',
            'dondurulmuş çilek', 'dondurulmus cilek', 'dondurulmuş ahududu',
            'dondurulmus ahududu',
            // Diğer Donuk
            'dondurulmuş ekmek', 'dondurulmus ekmek', 'donuk ekmek',
        ],
        'Temizlik': [
            // Deterjanlar - Bulaşık
            'deterjan', 'detergent', 'bulaşık deterjanı', 'bulasik deterjani', 'dish soap',
            'dish detergent', 'bulaşık sıvısı', 'bulasik sivisi', 'bulaşık tableti',
            'bulasik tableti', 'bulaşık makinesi deterjanı', 'bulasik makinesi deterjani',
            // Bulaşık Deterjanı - Markalar
            'fairy', 'pril', 'sunlight', 'yumoş', 'yumos', 'kip', 'calgonit',
            'finish', 'somat', 'feri',
            // Deterjanlar - Çamaşır
            'çamaşır deterjanı', 'camasir deterjani', 'laundry detergent',
            'çamaşır sıvısı', 'camasir sivisi', 'çamaşır tozu', 'camasir tozu',
            'yumuşatıcı', 'yumusatici', 'fabric softener',
            // Çamaşır Deterjanı - Markalar
            'ariel', 'persil', 'omo', 'alex', 'tide', 'skip', 'yumoş', 'yumos',
            'kip', 'alo', 'perwoll',
            // Temizleyiciler - Yüzey
            'yüzey temizleyici', 'yuzey temizleyici', 'surface cleaner',
            'cam temizleyici', 'cam temizleyici', 'mutfak temizleyici', 'mutfak temizleyici',
            'banyo temizleyici', 'banyo temizleyici', 'genel temizleyici',
            // Yüzey Temizleyici - Markalar
            'cif', 'domestos', 'mr muscle', 'glorix', 'ace', 'detol',
            // Tuvalet Temizleyici
            'tuvalet temizleyici', 'toilet cleaner', 'klozet temizleyici',
            'klozet tableti', 'klozet jeli',
            // Tuvalet Temizleyici - Markalar
            'domestos', 'harpic', 'sıvı güç', 'sivi guc',
            // Çamaşır Suyu & Dezenfektan
            'çamaşır suyu', 'camasir suyu', 'bleach', 'dezenfektan',
            'yüzey dezenfektanı', 'yuzey dezenfektani',
            // Çöp Torbası (ÖNEMLİ: Et, Tavuk, Balık değil, Temizlik)
            'çöp torbası', 'cop torbasi', 'trash bag', 'çöp poşeti', 'cop poseti',
            'çöp torbası', 'garbage bag', 'çöp poşeti',
            // Çöp Torbası - Markalar
            'koroplast', 'cook', 'glad', 'hefty',
            // Eldiven
            'eldiven', 'gloves', 'temizlik eldiveni', 'iş eldiveni', 'is eldiveni',
            'mutfak eldiveni', 'lateks eldiven',
            // Sünger & Bez
            'sünger', 'sponge', 'beze', 'bez', 'temizlik bezi', 'mikrofiber',
            'mutfak bezi', 'banyo bezi', 'cam bezi', 'toz bezi', 'silgi bez',
        ],
        'Kişisel Bakım': [
            // Şampuan - Genel
            'şampuan', 'sampuan', 'shampoo', 'saç şampuanı', 'sac sampuani',
            '2\'si 1 arada', '2 si 1 arada', 'şampuan ve saç kremi', 'sampuan ve sac kremi',
            // Şampuan - Markalar
            'head & shoulders', 'clear', 'pantene', 'elidor', 'himalaya', 'sunsilk',
            'allure', 'gliss', 'johnson\'s baby', 'tre semme', 'schwarzkopf',
            // Saç Kremi
            'saç kremi', 'sac kremi', 'conditioner', 'balsam',
            // Sabun - Genel
            'sabun', 'soap', 'banyo sabunu', 'banyo sabunu', 'sıvı sabun', 'sivi sabun',
            'el sabunu', 'el sabunu', 'kozmetik sabun', 'organik sabun',
            // Sabun - Markalar
            'dove', 'lux', 'fa', 'zeytinyağlı sabun', 'zeytinyagli sabun',
            'organik sabun', 'johnson\'s baby sabun',
            // Diş Bakımı - Macun
            'diş macunu', 'dis macunu', 'toothpaste', 'diş fırçası', 'dis fircasi',
            'toothbrush', 'diş ipi', 'dis ipi', 'floss', 'ağız gargarası',
            'agiz gargarasi', 'mouthwash',
            // Diş Bakımı - Markalar
            'colgate', 'signal', 'sensodyne', 'oral-b', 'philips sonicare',
            // Deodorant - Genel
            'deodorant', 'roll-on', 'sprey', 'deodorant sprey', 'ter önleyici',
            'ter onleyici', 'antiperspirant',
            // Deodorant - Markalar
            'axe', 'rexona', 'nivea', 'fa', 'old spice', 'dove deodorant',
            // Kağıt Ürünleri - Tuvalet Kağıdı
            'tuvalet kağıdı', 'tuvalet kagidi', 'toilet paper', 'tuvalet kağıdı',
            'banyo kağıdı', 'banyo kagidi',
            // Tuvalet Kağıdı - Markalar
            'selpak', 'papia', 'familia', 'molfix', 'happy',
            // Kağıt Havlu
            'kağıt havlu', 'kagit havlu', 'paper towel', 'havlu', 'mutfak kağıdı',
            'mutfak kagidi', 'kağıt havlu', 'banyo havlusu',
            // Kağıt Havlu - Markalar
            'selpak havlu', 'papia havlu', 'familia havlu',
            // Mendil
            'mendil', 'tissue', 'kağıt mendil', 'kagit mendil', 'peçete',
            'pecete', 'servis peçetesi', 'servis pecetesi', 'napkin',
            // Mendil - Markalar
            'selpak mendil', 'papia mendil', 'torku mendil',
        ],
        'Bebek': [
            // Bebek Bezi - Genel
            'bebek', 'baby', 'bebek bezi', 'bebek-bezi', 'diaper', 'bebek bezlenme',
            'bebek bezlenme', 'toddler diaper', 'yeni doğan bezi', 'yeni dogan bezi',
            // Bebek Bezi - Markalar
            'pampers', 'huggies', 'primera', 'sleepy', 'molfix', 'canbebe',
            // Bebek Maması - Genel
            'bebek maması', 'bebek-mamasi', 'baby food', 'bebek sütü', 'bebek sutu',
            'devam sütü', 'devam sutu', 'bebek ek gıda', 'bebek ek gida',
            // Bebek Maması - Markalar
            'aptamil', 'bebelac', 'similac', 'nan', 'nestle', 'hipp',
            // Bebek Bakım - Genel
            'bebek bakım', 'bebek-bakim', 'baby care', 'bebek şampuanı', 'bebek sampuani',
            'bebek losyonu', 'bebek yağı', 'bebek yagi', 'bebek kremi', 'pişik kremi',
            'pisik kremi', 'bebek mendili', 'ıslak mendil', 'islak mendil',
            // Bebek Bakım - Markalar
            'johnson\'s baby', 'sebamed bebek', 'mustela', 'bebamed',
        ],
        'Pet Shop': [
            // Pet Shop - Genel
            'pet shop', 'pet-shop', 'pet', 'hayvan', 'pet ürünleri', 'pet urunleri',
            // Kedi Maması - Genel
            'kedi maması', 'kedi-mamasi', 'cat food', 'kedi konservesi',
            'kedi konservesi', 'kedi kuru maması', 'kedi kuru mamasi',
            // Kedi Maması - Markalar
            'whiskas', 'felix', 'friskies', 'royal canin', 'purina', 'pro plan',
            // Köpek Maması - Genel
            'köpek maması', 'kopek-mamasi', 'dog food', 'köpek konservesi',
            'kopek konservesi', 'köpek kuru maması', 'kopek kuru mamasi',
            // Köpek Maması - Markalar
            'pedigree', 'royal canin', 'purina', 'pro plan', 'chappi',
            // Kuş Maması
            'kuş maması', 'kus-mamasi', 'bird food', 'muhabbet kuşu maması',
            'muhabbet kusu mamasi', 'kanarya maması', 'kanarya mamasi',
            // Pet Aksesuar
            'pet aksesuar', 'pet-aksesuar', 'pet accessories', 'kedi kumu',
            'kedi kumu', 'köpek tasması', 'kopek tasmasi', 'köpek tasma',
            'kopek tasma', 'kedi oyuncağı', 'kedi oyuncagi', 'köpek oyuncağı',
            'kopek oyuncagi', 'taşıma çantası', 'tasima cantasi',
        ],
        'Sağlıklı Yaşam': [
            // Sağlıklı Yaşam - Genel
            'sağlıklı yaşam', 'saglikli-yasam', 'healthy', 'vitamin', 'takviye',
            'supplement', 'besin takviyesi', 'besin takviyesi', 'multivitamin',
            // Organik
            'organik ürünler', 'organik-urunler', 'organic', 'doğal ürünler',
            'dogal urunler', 'organik gıda', 'organik gida',
            // Diyet & Özel Gıda
            'glutensiz', 'gluten-free', 'şekersiz', 'sekersiz', 'sugar-free',
            'light', 'diyet', 'diet', 'laktozsuz', 'lactose-free', 'vegan',
            'vejetaryen', 'vegetarian', 'protein', 'fiber', 'lifli',
            // Vitamin & Takviye
            'c vitamini', 'd vitamini', 'b vitamini', 'omega 3', 'omega-3',
            'balık yağı', 'balik yagi', 'probiotic', 'probiyotik',
        ],
        'Ev & Yaşam': [
            // Ev & Yaşam - Genel
            'ev & yaşam', 'ev-yasam', 'home', 'ev eşyası', 'ev esyasi',
            // Pil - Genel
            'pil', 'battery', 'alkalin pil', 'kalem pil', 'aa battery',
            'aaa battery', '9v pil', '9v battery', 'c pil', 'd pil',
            // Pil - Markalar
            'duracell', 'energizer', 'varta',
            // Ampul - Genel
            'ampul', 'light bulb', 'led ampul', 'enerji tasarruflu', 'tasarruflu ampul',
            'led ampul', 'filament ampul', 'akkor ampul', 'spot ampul',
            // Ampul - Markalar
            'philips ampul', 'osram', 'general electric',
            // Diğer
            'batteri', 'flaşör', 'flasor', 'timer', 'elektrikli alet',
        ],
    };

    private canonicalNameMap: Record<string, string> = {
        // Kahvaltılık Ezme & Sos
        'fistik ezmesi': 'Kahvaltılık Ezme',
        'fistik ezmesı': 'Kahvaltılık Ezme',
        'findik ezmesi': 'Kahvaltılık Ezme',
        'findik ezmesı': 'Kahvaltılık Ezme',
        'kahvaltilik ezme': 'Kahvaltılık Ezme',
        'ezmeler': 'Kahvaltılık Ezme',
        'krem cikolata': 'Kahvaltılık Ezme',
        'kahvaltilik sos': 'Kahvaltılık Sos',
        'krema ve sos': 'Kahvaltılık Sos',

        // Bal & tatlandırıcılar
        'bal': 'Bal',
        'ballar': 'Bal',
        'cam bali': 'Bal',
        'cicek bali': 'Bal',
        'apiterapi & propolis': 'Bal',
        'apiterapi propolis': 'Bal',
        'ozel bal': 'Bal',

        // Tahin & Pekmez
        'tahin': 'Tahin & Pekmez',
        'pekmez': 'Tahin & Pekmez',
        'tahin pekmez': 'Tahin & Pekmez',

        // Zeytin
        'zeytin': 'Zeytin',
        'siyah zeytin': 'Zeytin',
        'yesil zeytin': 'Zeytin',
        'biberli yesil zeytin': 'Zeytin',
        'kokteyl yesil zeytin': 'Zeytin',
        'ozel yesil zeytin': 'Zeytin',
        'zeytin ezmeleri': 'Zeytin',
        'siyah zeytin ezmesi': 'Zeytin',
        'yesil zeytin ezmesi': 'Zeytin',

        // Gevrekler
        'kahvaltilik gevrek': 'Kahvaltılık Gevrek',
        'misir gevregi': 'Kahvaltılık Gevrek',
        'musli': 'Kahvaltılık Gevrek',
        'granola': 'Kahvaltılık Gevrek',

        // Peynir
        'peynir': 'Peynir',
        'tulum peynir': 'Peynir',
        'tulum peyniri': 'Peynir',
        'ezine peyniri': 'Peynir',
        'yoresel peynir': 'Peynir',
        'yerli yoresel peynir': 'Peynir',
        'yabanci yoresel peynir': 'Peynir',
        'ithal peynir': 'Peynir',
        'koyun peyniri': 'Peynir',
        'inek peyniri': 'Peynir',
        'kasar peyniri': 'Peynir',
        'kasar peynir': 'Peynir',
        'kasar': 'Peynir',
        'taze kasar': 'Peynir',
        'eski kasar': 'Peynir',
        'ucgen peynir': 'Peynir',
        'krem peynir': 'Peynir',

        // Yoğurt
        'yogurt': 'Yoğurt',
        'sade yogurt': 'Yoğurt',
        'kaymakli yogurt': 'Yoğurt',
        'saglikli yasam yogurtlari': 'Yoğurt',
        'ozel beslenme yogurtlari': 'Yoğurt',
        'tava yogurdu': 'Yoğurt',
        'yogurt mayasi': 'Yoğurt',
        'yogurt & kefir mayasi': 'Yoğurt',

        // Süt
        'sut': 'Süt',
        'uzun omurlu sut': 'Süt',
        'gunluk sut': 'Süt',
        'tam yagli sut': 'Süt',
        'yagsiz sut': 'Süt',
        'laktozsuz sut': 'Süt',
        'pastorize ve cig sut': 'Süt',

        // Krema & Kaymak
        'krema': 'Krema',
        'krema ve kaymak': 'Krema ve Kaymak',

        // Diğer süt ürünleri
        'puding': 'Puding',
        'sutlu tatli puding': 'Puding',
        'geleneksel sutlu tatlilar': 'Puding',
        'kaymak': 'Kaymak',
        'tereyagi': 'Tereyağı',
        'tereyag': 'Tereyağı',
        'ayran': 'Ayran',
        'margarin': 'Margarin',
        'kase margarin': 'Margarin',
        'paket margarin': 'Margarin',

        // Kahvaltı
        'kahvaltilik urunler': 'Kahvaltılık',
        'kahvaltilik ürünler': 'Kahvaltılık',
        'kahvaltilik': 'Kahvaltılık',

        // Yumurta
        'yumurta': 'Yumurta',
        'organik yumurta': 'Yumurta',

        // Helva
        'helva': 'Helva',

        // Sağlıklı ürünler
        'saglikli urunler': 'Sağlıklı Ürünler',
        'saglikli yasam': 'Sağlıklı Yaşam',
    };

    private parentOverrideMap: Record<string, string | null> = {
        'Süt Ürünleri': null,
        'Meyve & Sebze': null,
        'Et, Tavuk, Balık': null,
        'Temel Gıda': null,
        'İçecek': null,
        'Fırın & Pastane': null,
        'Kahvaltılık': null,
        'Atıştırmalık': null,
        'Sağlıklı Yaşam': null,
        'Temizlik': null,
        'Kişisel Bakım': null,
        'Pet Shop': null,
        'Bebek': null,
        'Ev & Yaşam': null,
        'Dondurma': null,
        'Hazır Yemek & Donuk': null,

        'Peynir': 'Süt Ürünleri',
        'Yoğurt': 'Süt Ürünleri',
        'Süt': 'Süt Ürünleri',
        'Krema': 'Süt Ürünleri',
        'Krema ve Kaymak': 'Süt Ürünleri',
        'Kaymak': 'Süt Ürünleri',
        'Tereyağı': 'Süt Ürünleri',
        'Ayran': 'Süt Ürünleri',
        'Margarin': 'Süt Ürünleri',
        'Puding': 'Süt Ürünleri',

        'Kahvaltılık Ezme': 'Kahvaltılık',
        'Kahvaltılık Sos': 'Kahvaltılık',
        'Kahvaltılık Gevrek': 'Kahvaltılık',
        'Bal': 'Kahvaltılık',
        'Reçel': 'Kahvaltılık',
        'Zeytin': 'Kahvaltılık',
        'Tahin & Pekmez': 'Kahvaltılık',
        'Helva': 'Kahvaltılık',
        'Yumurta': 'Kahvaltılık',

        'Sağlıklı Ürünler': 'Sağlıklı Yaşam',
    };

    private topLevelCategories = new Set<string>([
        'Süt Ürünleri',
        'Meyve & Sebze',
        'Et, Tavuk, Balık',
        'Temel Gıda',
        'İçecek',
        'Fırın & Pastane',
        'Kahvaltılık',
        'Atıştırmalık',
        'Sağlıklı Yaşam',
        'Temizlik',
        'Kişisel Bakım',
        'Pet Shop',
        'Bebek',
        'Ev & Yaşam',
        'Dondurma',
        'Hazır Yemek & Donuk',
    ]);

    /**
     * Kategoriyi bul veya oluştur
     * 🔒 Artık sadece STANDART kategorileri kullanır - yeni kategori oluşturulmaz!
     * 
     * @param categoryName Kategori adı (scraper'dan gelen)
     * @param productName Ürün adı (opsiyonel - daha iyi eşleştirme için)
     */
    async findOrCreateCategory(categoryName: string, productName?: string): Promise<number> {
        if (!categoryName || categoryName.trim() === '') {
            throw new Error('Category name is required');
        }

        const trimmedName = categoryName.trim();
        
        // Cache kontrolü: Aynı kategori + ürün adı kombinasyonu daha önce eşleştirildi mi?
        const cacheKey = `${trimmedName.toLowerCase()}|${(productName || '').toLowerCase().trim()}`;
        if (this.categoryMatchCache.has(cacheKey)) {
            const cachedId = this.categoryMatchCache.get(cacheKey)!;
            console.log(`   💾 Cache hit: "${trimmedName}" → ID: ${cachedId}`);
            return cachedId;
        }

        // 1. Önce standart kategorilerde ara
        const standardCategory = findStandardCategoryByName(trimmedName);
        
        let standardName: string;
        let standardSlug: string;
        let parentStandardName: string | null = null;

        if (standardCategory) {
            if ('subcategories' in standardCategory) {
                // Ana kategori
                standardName = standardCategory.name;
                standardSlug = standardCategory.slug;
                parentStandardName = null;
            } else {
                // Alt kategori - parent'ını bul
                for (const cat of STANDARD_CATEGORIES) {
                    const found = cat.subcategories.find(sub => sub.name === standardCategory.name);
                    if (found) {
                        standardName = found.name;
                        standardSlug = found.slug;
                        parentStandardName = cat.name;
                        break;
                    }
                }
            }
        } else {
            // Standart kategoride yoksa, akıllı eşleştirme yap
            const matched = this.findClosestStandardCategory(trimmedName, productName);
            if (!matched) {
                throw new Error(
                    `"${trimmedName}" kategorisi standart kategorilerde bulunamadı. ` +
                    `Lütfen standart kategori kullanın.`
                );
            }
            standardName = matched.name;
            standardSlug = matched.slug;
            parentStandardName = matched.parentName;
        }

        // 2. Veritabanında bu standart kategoriyi bul veya oluştur
        let category = await prisma.category.findFirst({
            where: {
                OR: [
                    { slug: standardSlug },
                    {
                        name: {
                            equals: standardName,
                            mode: 'insensitive',
                        },
                    },
                ],
            },
        });

        if (!category) {
            // Standart kategoriyi veritabanına ekle
            const parentId = parentStandardName 
                ? await this.findOrCreateParentCategory(parentStandardName)
                : null;

            category = await prisma.category.create({
                data: {
                    name: standardName,
                    slug: standardSlug,
                    parent_id: parentId,
                    display_order: 0,
                },
            });
            console.log(`   🆕 Standard category created: "${standardName}" → ID: ${category.id}`);
        } else {
            // Mevcut kategoriyi standart yapıya uygun hale getir
            const parentId = parentStandardName 
                ? await this.findOrCreateParentCategory(parentStandardName)
                : null;

            const updates: Record<string, any> = {};
            if (category.name !== standardName) {
                updates.name = standardName;
            }
            if (category.slug !== standardSlug) {
                updates.slug = standardSlug;
            }
            if (category.parent_id !== parentId) {
                updates.parent_id = parentId;
            }

            if (Object.keys(updates).length > 0) {
                category = await prisma.category.update({
                    where: { id: category.id },
                    data: updates,
                });
                console.log(`   ✅ Category updated to standard: "${standardName}" → ID: ${category.id}`);
            } else {
                console.log(`   ✅ Category matched: "${standardName}" → ID: ${category.id} (existing)`);
            }
        }

        // Cache'e kaydet
        this.categoryMatchCache.set(cacheKey, category.id);
        
        return category.id;
    }

    /**
     * Öncelikli eşleştirme kuralları
     * Bu kelimeler varsa ÖNCE bu kategorilere bak
     */
    private priorityRules: Array<{
        keywords: string[];
        category: { parent: string; subcategory: string };
    }> = [
        // Domates püresi/rendesi/doğranmış → Temel Gıda > Salça (Meyve & Sebze değil)
        {
            keywords: ['domates püresi', 'domates pureesi', 'domates rendesi', 'domates dogranmis', 'domates doğranmış', 'tomato puree', 'tomato paste'],
            category: { parent: 'Temel Gıda', subcategory: 'Salça' },
        },
        // Pestil → Atıştırmalık > Şekerleme (Meyve & Sebze değil)
        {
            keywords: ['pestil', 'meyve pestili', 'fruit leather', 'bonheur'],
            category: { parent: 'Atıştırmalık', subcategory: 'Şekerleme' },
        },
        // Fındık ezmesi/kreması → Kahvaltılık > Kahvaltılık Ezme (Süt Ürünleri değil)
        {
            keywords: ['fındık ezmesi', 'findik ezmesi', 'fındık kreması', 'findik kremasi', 'fındık krem', 'findik krem', 'nuga', 'sarelle', 'nutella'],
            category: { parent: 'Kahvaltılık', subcategory: 'Kahvaltılık Ezme' },
        },
        // Bisküvi/Milföy → Atıştırmalık > Bisküvi (Süt Ürünleri değil)
        {
            keywords: ['milföy', 'mılfoey', 'kat kat tat', 'katkat', 'bisküvi', 'biscuit', 'kurabiye'],
            category: { parent: 'Atıştırmalık', subcategory: 'Bisküvi' },
        },
        // Salça önce - "Domates Salçası" → Temel Gıda > Salça (Meyve & Sebze değil)
        {
            keywords: ['salça', 'salca'],
            category: { parent: 'Temel Gıda', subcategory: 'Salça' },
        },
        // Çikolata önce - "Kinder Süt Dilimi" → Atıştırmalık > Çikolata (Süt Ürünleri değil)
        {
            keywords: ['çikolata', 'cikolata', 'chocolate', 'kinder', 'milka', 'nestle', 'dilim', 'dilimi'],
            category: { parent: 'Atıştırmalık', subcategory: 'Çikolata' },
        },
        // Sakız → Atıştırmalık > Şekerleme
        {
            keywords: ['sakız', 'sakiz', 'chewing gum'],
            category: { parent: 'Atıştırmalık', subcategory: 'Şekerleme' },
        },
        // Hazır çorba → Temel Gıda > Hazır Çorba
        {
            keywords: ['hazır çorba', 'hazir corba', 'çorba', 'corba', 'instant soup'],
            category: { parent: 'Temel Gıda', subcategory: 'Hazır Çorba' },
        },
        // Makarna → Temel Gıda > Makarna
        {
            keywords: ['makarna', 'pasta', 'spaghetti', 'penne'],
            category: { parent: 'Temel Gıda', subcategory: 'Makarna' },
        },
        // Ekmek → Fırın & Pastane > Ekmek
        {
            keywords: ['ekmek', 'bread'],
            category: { parent: 'Fırın & Pastane', subcategory: 'Ekmek' },
        },
        // Çöp torbası → Temizlik > Çöp Torbası
        {
            keywords: ['çöp torbası', 'cop torbasi', 'trash bag', 'çöp poşeti', 'cop poseti', 'koroplast', 'cook'],
            category: { parent: 'Temizlik', subcategory: 'Çöp Torbası' },
        },
        // Galeta unu → Temel Gıda > Un
        {
            keywords: ['galeta unu', 'galeta un', 'breadcrumbs', 'bağdat galeta', 'bagdat galeta'],
            category: { parent: 'Temel Gıda', subcategory: 'Un' },
        },
        // Çay → İçecek > Çay
        {
            keywords: ['çay', 'cay', 'tea', 'bardak poşet çay', 'bardak poset cay', 'doğuş', 'ahmad tea', 'black label'],
            category: { parent: 'İçecek', subcategory: 'Çay' },
        },
        // Ketçap/Soslar → Temel Gıda > Salça
        {
            keywords: ['ketçap', 'ketchup', 'ketcap', 'tat ketçap', 'tat ketchup', 'mayonez', 'mayonnaise', 'sos', 'sauce', 'cheddar sos', 'ranch sos', 'barbekü sos', 'calve', 'calve ranch', 'calve cheddar'],
            category: { parent: 'Temel Gıda', subcategory: 'Salça' },
        },
        // Bulaşık deterjanı → Temizlik > Bulaşık Deterjanı
        {
            keywords: ['bulaşık deterjanı', 'bulasik deterjani', 'dish soap', 'dish detergent', 'fairy', 'pril', 'sunlight', 'yumoş', 'yumos'],
            category: { parent: 'Temizlik', subcategory: 'Bulaşık Deterjanı' },
        },
        // Çamaşır deterjanı → Temizlik > Çamaşır Deterjanı
        {
            keywords: ['çamaşır deterjanı', 'camasir deterjani', 'laundry detergent', 'ariel', 'persil', 'omo', 'alex'],
            category: { parent: 'Temizlik', subcategory: 'Çamaşır Deterjanı' },
        },
        // Yüzey temizleyici → Temizlik > Yüzey Temizleyici
        {
            keywords: ['yüzey temizleyici', 'yuzey temizleyici', 'surface cleaner', 'cif', 'domestos', 'mr muscle'],
            category: { parent: 'Temizlik', subcategory: 'Yüzey Temizleyici' },
        },
        // Deodorant → Kişisel Bakım > Deodorant (Süt Ürünleri değil!)
        {
            keywords: ['deodorant', 'roll-on', 'roll on', 'rollon', 'sprey deodorant', 'spray deodorant', 'ter önleyici', 'ter onleyici', 'antiperspirant'],
            category: { parent: 'Kişisel Bakım', subcategory: 'Deodorant' },
        },
        // Deodorant markaları → Kişisel Bakım > Deodorant
        {
            keywords: ['emotion deodorant', 'nivea deodorant', 'rexona', 'axe', 'siveno', 'fa deodorant', 'old spice'],
            category: { parent: 'Kişisel Bakım', subcategory: 'Deodorant' },
        },
        // Ped/Kadın Pedi → Kişisel Bakım > Mendil (Süt Ürünleri değil!)
        {
            keywords: ['ped', 'günlük ped', 'gunluk ped', 'kadın pedi', 'kadin pedi', 'günlük ped', 'daily pad', 'kadın ped', 'kadin ped'],
            category: { parent: 'Kişisel Bakım', subcategory: 'Mendil' },
        },
        // Ped markaları → Kişisel Bakım > Mendil
        {
            keywords: ['kotex', 'molped', 'always', 'orkid', 'lady speed stick', 'stayfree'],
            category: { parent: 'Kişisel Bakım', subcategory: 'Mendil' },
        },
        // Kahve Beyazlatıcısı → İçecek > Kahve (Süt Ürünleri değil!)
        {
            keywords: ['kahve beyazlatıcısı', 'kahve beyazlatıcisi', 'coffee whitener', 'coffee creamer', 'kahve kreması', 'kahve kremasi', 'kahve katkısı', 'kahve katkisi'],
            category: { parent: 'İçecek', subcategory: 'Kahve' },
        },
        // Hazır Latte/Mocha/Cappuccino İçecekleri → İçecek > Kahve (Süt Ürünleri değil!)
        {
            keywords: ['latte', 'mocha', 'cappuccino', 'ice break latte', 'hazır latte', 'hazir latte', 'hazır mocha', 'hazir mocha', 'hazır cappuccino', 'hazir cappuccino', 'ready to drink latte', 'rtd latte'],
            category: { parent: 'İçecek', subcategory: 'Kahve' },
        },
        // Milkshake → İçecek > Meyve Suyu (Süt Ürünleri değil!)
        {
            keywords: ['milkshake', 'milk shake', 'sütlü içecek', 'sutlu icecek', 'dimes milkshake', 'dimes milk shake', 'muzlu milkshake', 'muzlu milk shake', 'antep fıstıklı milkshake', 'antep fistikli milkshake'],
            category: { parent: 'İçecek', subcategory: 'Meyve Suyu' },
        },
        // Kremşanti (Toz Krema) → Fırın & Pastane > Kek (Süt Ürünleri değil!)
        {
            keywords: ['kremşanti', 'kremsanti', 'krem şanti', 'krem santi', 'whipped cream powder', 'toz krema', 'pakmaya kremşanti', 'pakmaya kremsanti'],
            category: { parent: 'Fırın & Pastane', subcategory: 'Kek' },
        },
    ];

    /**
     * Negatif kurallar - Bu kelimeler varsa bu kategorilere GİRMEZ
     */
    private exclusionRules: Array<{
        keywords: string[];
        excludeFrom: string[];
    }> = [
        // "domates püresi/rendesi" varsa "Meyve & Sebze" kategorisine girme
        {
            keywords: ['domates püresi', 'domates pureesi', 'domates rendesi', 'domates dogranmis', 'domates doğranmış', 'tomato puree', 'tomato paste'],
            excludeFrom: ['Meyve & Sebze'],
        },
        // "pestil" varsa "Meyve & Sebze" kategorisine girme
        {
            keywords: ['pestil', 'meyve pestili', 'fruit leather'],
            excludeFrom: ['Meyve & Sebze'],
        },
        // "fındık ezmesi/kreması" varsa "Süt Ürünleri" kategorisine girme
        {
            keywords: ['fındık ezmesi', 'findik ezmesi', 'fındık kreması', 'findik kremasi', 'fındık krem', 'findik krem', 'nuga', 'sarelle', 'nutella', 'fındık kreması', 'findik kremasi'],
            excludeFrom: ['Süt Ürünleri'],
        },
        // "bisküvi/milföy" varsa "Süt Ürünleri" kategorisine girme
        {
            keywords: ['milföy', 'mılfoey', 'kat kat tat', 'katkat', 'bisküvi', 'biscuit', 'kurabiye'],
            excludeFrom: ['Süt Ürünleri'],
        },
        // "salça" varsa "Meyve & Sebze" kategorisine girme
        {
            keywords: ['salça', 'salca'],
            excludeFrom: ['Meyve & Sebze'],
        },
        // "çikolata", "dilim", "kinder" varsa "Süt Ürünleri" kategorisine girme
        {
            keywords: ['çikolata', 'cikolata', 'dilim', 'dilimi', 'kinder', 'milka'],
            excludeFrom: ['Süt Ürünleri'],
        },
        // "makarna" varsa "Fırın & Pastane" kategorisine girme (Temel Gıda olmalı)
        {
            keywords: ['makarna', 'spaghetti', 'penne'],
            excludeFrom: ['Fırın & Pastane'],
        },
        // "çöp torbası" varsa "Et, Tavuk, Balık" kategorisine girme
        {
            keywords: ['çöp torbası', 'cop torbasi', 'trash bag', 'çöp poşeti', 'cop poseti', 'koroplast', 'cook'],
            excludeFrom: ['Et, Tavuk, Balık'],
        },
        // "galeta unu" varsa "Et, Tavuk, Balık" kategorisine girme
        {
            keywords: ['galeta unu', 'galeta un', 'breadcrumbs', 'bağdat galeta', 'bagdat galeta'],
            excludeFrom: ['Et, Tavuk, Balık'],
        },
        // "çay" varsa "Et, Tavuk, Balık" kategorisine girme
        {
            keywords: ['çay', 'cay', 'tea', 'bardak poşet çay', 'bardak poset cay'],
            excludeFrom: ['Et, Tavuk, Balık'],
        },
        // "ketçap/sos" varsa "Et, Tavuk, Balık" kategorisine girme
        {
            keywords: ['ketçap', 'ketchup', 'ketcap', 'mayonez', 'mayonnaise', 'sos', 'sauce', 'cheddar sos', 'ranch sos', 'calve'],
            excludeFrom: ['Et, Tavuk, Balık'],
        },
        // "deterjan" varsa "Et, Tavuk, Balık" ve diğer yemek kategorilerine girme
        {
            keywords: ['deterjan', 'detergent', 'bulaşık deterjanı', 'bulasik deterjani', 'çamaşır deterjanı', 'camasir deterjani', 'fairy', 'pril', 'ariel', 'persil'],
            excludeFrom: ['Et, Tavuk, Balık', 'Süt Ürünleri', 'Meyve & Sebze', 'Temel Gıda'],
        },
        // "temizleyici" varsa yemek kategorilerine girme
        {
            keywords: ['temizleyici', 'cleaner', 'yüzey temizleyici', 'yuzey temizleyici', 'cif', 'domestos'],
            excludeFrom: ['Et, Tavuk, Balık', 'Süt Ürünleri', 'Meyve & Sebze', 'Temel Gıda'],
        },
        // "deodorant", "roll-on", "sprey deodorant" varsa "Süt Ürünleri" kategorisine GİRMEZ
        {
            keywords: ['deodorant', 'roll-on', 'roll on', 'rollon', 'sprey deodorant', 'spray deodorant', 'ter önleyici', 'ter onleyici', 'antiperspirant', 'emotion deodorant', 'nivea deodorant', 'rexona', 'axe', 'siveno'],
            excludeFrom: ['Süt Ürünleri', 'Meyve & Sebze', 'Temel Gıda', 'Et, Tavuk, Balık'],
        },
        // "ped", "günlük ped", "kadın pedi" varsa "Süt Ürünleri" kategorisine GİRMEZ
        {
            keywords: ['ped', 'günlük ped', 'gunluk ped', 'kadın pedi', 'kadin pedi', 'günlük ped', 'daily pad', 'kadın ped', 'kadin ped', 'kotex', 'molped', 'always', 'orkid'],
            excludeFrom: ['Süt Ürünleri', 'Meyve & Sebze', 'Temel Gıda', 'Et, Tavuk, Balık'],
        },
        // "kahve beyazlatıcısı", "coffee whitener", "latte" varsa "Süt Ürünleri" kategorisine GİRMEZ
        {
            keywords: ['kahve beyazlatıcısı', 'kahve beyazlatıcisi', 'coffee whitener', 'coffee creamer', 'kahve kreması', 'kahve kremasi', 'kahve katkısı', 'kahve katkisi', 'latte', 'mocha', 'cappuccino', 'ice break', 'hazır latte', 'hazir latte', 'hazır mocha', 'hazir mocha', 'hazır cappuccino', 'hazir cappuccino'],
            excludeFrom: ['Süt Ürünleri'],
        },
        // "milkshake" varsa "Süt Ürünleri" kategorisine GİRMEZ
        {
            keywords: ['milkshake', 'milk shake', 'sütlü içecek', 'sutlu icecek', 'dimes milkshake', 'dimes milk shake'],
            excludeFrom: ['Süt Ürünleri'],
        },
        // "kremşanti", "toz krema" varsa "Süt Ürünleri" kategorisine GİRMEZ
        {
            keywords: ['kremşanti', 'kremsanti', 'krem şanti', 'krem santi', 'whipped cream powder', 'toz krema', 'pakmaya kremşanti', 'pakmaya kremsanti'],
            excludeFrom: ['Süt Ürünleri'],
        },
    ];

    /**
     * En yakın standart kategoriyi bulur (akıllı fuzzy matching + öncelik kuralları)
     */
    private findClosestStandardCategory(
        categoryName: string,
        productName?: string
    ): { name: string; slug: string; parentName: string | null } | null {
        const normalized = this.normalizeCategory(categoryName);
        const normalizedProduct = productName ? this.normalizeCategory(productName) : '';
        const combinedText = `${normalized} ${normalizedProduct}`.trim();

        // 1. ÖNCE öncelikli kuralları kontrol et
        for (const rule of this.priorityRules) {
            const hasPriorityKeyword = rule.keywords.some(keyword => 
                combinedText.includes(this.normalizeCategory(keyword))
            );
            
            if (hasPriorityKeyword) {
                const parentCat = STANDARD_CATEGORIES.find(cat => cat.name === rule.category.parent);
                if (parentCat) {
                    const subCat = parentCat.subcategories.find(
                        sub => sub.name === rule.category.subcategory
                    );
                    if (subCat) {
                        console.log(`   🎯 Priority rule matched: "${categoryName}" → "${rule.category.parent} > ${rule.category.subcategory}"`);
                        return {
                            name: subCat.name,
                            slug: subCat.slug,
                            parentName: parentCat.name,
                        };
                    }
                }
            }
        }

        // 2. Exact match dene
        const exact = findStandardCategoryByName(categoryName);
        if (exact) {
            if ('subcategories' in exact) {
                return { name: exact.name, slug: exact.slug, parentName: null };
            } else {
                // Alt kategori için parent bul
                for (const cat of STANDARD_CATEGORIES) {
                    if (cat.subcategories.some(sub => sub.name === exact.name)) {
                        return { name: exact.name, slug: exact.slug, parentName: cat.name };
                    }
                }
            }
        }

        // 3. Keyword matching ile parent bul (negatif kuralları kontrol ederek)
        let candidateParents = this.findParentCandidatesByKeywords(combinedText);
        
        // Negatif kuralları uygula
        candidateParents = candidateParents.filter(parentName => {
            for (const rule of this.exclusionRules) {
                const hasExclusionKeyword = rule.keywords.some(keyword =>
                    combinedText.includes(this.normalizeCategory(keyword))
                );
                if (hasExclusionKeyword && rule.excludeFrom.includes(parentName)) {
                    console.log(`   🚫 Excluded "${categoryName}" from "${parentName}" (exclusion rule)`);
                    return false;
                }
            }
            return true;
        });

        if (candidateParents.length > 0) {
            // İlk uygun parent'ı al
            const parentName = candidateParents[0];
            const parentCat = STANDARD_CATEGORIES.find(cat => cat.name === parentName);
            
            if (parentCat && parentCat.subcategories.length > 0) {
                // En uygun alt kategoriyi bul
                const bestMatch = parentCat.subcategories.find(sub => {
                    const subNormalized = this.normalizeCategory(sub.name);
                    return (
                        combinedText.includes(subNormalized) ||
                        subNormalized.includes(normalized) ||
                        normalized.includes(subNormalized)
                    );
                });
                
                if (bestMatch) {
                    return { name: bestMatch.name, slug: bestMatch.slug, parentName };
                }
                
                // Eşleşme yoksa ilk alt kategoriyi döndür (genel kategori)
                return {
                    name: parentCat.subcategories[0].name,
                    slug: parentCat.subcategories[0].slug,
                    parentName,
                };
            }
        }

        return null;
    }

    /**
     * Keyword matching ile parent adaylarını bulur (sıralı liste döner)
     */
    private findParentCandidatesByKeywords(text: string): string[] {
        const candidates: Array<{ parent: string; score: number }> = [];
        const normalized = this.normalizeCategory(text);

        for (const [parentName, keywords] of Object.entries(this.categoryKeywords)) {
            let score = 0;
            for (const keyword of keywords) {
                if (normalized.includes(keyword)) {
                    score++;
                }
            }
            if (score > 0) {
                candidates.push({ parent: parentName, score });
            }
        }

        // Score'a göre sırala (yüksek score önce)
        candidates.sort((a, b) => b.score - a.score);
        return candidates.map(c => c.parent);
    }

    /**
     * Ana kategoriyi bul veya oluştur (standart kategorilerden)
     */
    private async findOrCreateParentCategory(parentName: string): Promise<number> {
        if (this.parentCache.has(parentName)) {
            return this.parentCache.get(parentName)!;
        }

        const standardParent = STANDARD_CATEGORIES.find(cat => cat.name === parentName);
        if (!standardParent) {
            throw new Error(`Standart ana kategori bulunamadı: "${parentName}"`);
        }

        let parent = await prisma.category.findFirst({
            where: {
                OR: [
                    { slug: standardParent.slug },
                    {
                        name: {
                            equals: parentName,
                            mode: 'insensitive',
                        },
                    },
                ],
                parent_id: null,
            },
        });

        if (!parent) {
            parent = await prisma.category.create({
                data: {
                    name: standardParent.name,
                    slug: standardParent.slug,
                    parent_id: null,
                    display_order: standardParent.displayOrder,
                    icon_url: standardParent.icon || null,
                },
            });
        } else {
            // Mevcut kategoriyi standart yapıya uygun hale getir
            const updates: Record<string, any> = {};
            if (parent.name !== standardParent.name) {
                updates.name = standardParent.name;
            }
            if (parent.slug !== standardParent.slug) {
                updates.slug = standardParent.slug;
            }
            if (parent.display_order !== standardParent.displayOrder) {
                updates.display_order = standardParent.displayOrder;
            }
            if (parent.icon_url !== (standardParent.icon || null)) {
                updates.icon_url = standardParent.icon || null;
            }
            
            if (Object.keys(updates).length > 0) {
                parent = await prisma.category.update({
                    where: { id: parent.id },
                    data: updates,
                });
            }
        }

        this.parentCache.set(parentName, parent.id);
        return parent.id;
    }

    /**
     * Kategori adından keyword'lere bakarak parent bulur
     */
    private async findParentByKeywords(categoryName: string): Promise<number | null> {
        const parentName = this.findParentNameByKeywords(categoryName);
        if (!parentName) {
            console.log(`   ⚠️ No parent found for: "${categoryName}"`);
            return null;
        }
        const parentId = await this.getParentIdByName(parentName);
        console.log(`   🔗 Parent match: "${categoryName}" → "${parentName}" (keywords)`);
        return parentId;
    }

    /**
     * Slug oluştur (URL-friendly)
     */
    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/İ/g, 'i')
            .replace(/Ğ/g, 'g')
            .replace(/Ü/g, 'u')
            .replace(/Ş/g, 's')
            .replace(/Ö/g, 'o')
            .replace(/Ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .trim();
    }

    /**
     * Birden fazla kategoriyi batch olarak işle
     */
    async findOrCreateCategories(categoryNames: string[]): Promise<Map<string, number>> {
        const categoryMap = new Map<string, number>();

        for (const name of categoryNames) {
            try {
                const categoryId = await this.findOrCreateCategory(name);
                categoryMap.set(name, categoryId);
            } catch (error) {
                console.error(`   ❌ Category error for "${name}":`, error);
            }
        }

        return categoryMap;
    }

    public getCanonicalInfo(name: string): { canonicalName: string; parentName: string | null } {
        const canonicalName = this.resolveCanonicalName(name);
        const parentName = this.resolveParentName(canonicalName);
        return { canonicalName, parentName };
    }

    public slugifyName(name: string): string {
        return this.slugify(name);
    }

    public async ensureParentCategory(parentName: string): Promise<number> {
        return await this.getParentIdByName(parentName);
    }

    private findParentNameByKeywords(categoryName: string): string | null {
        const lowerName = this.normalizeCategory(categoryName);

        for (const [parentName, keywords] of Object.entries(this.categoryKeywords)) {
            for (const keyword of keywords) {
                if (lowerName.includes(keyword)) {
                    return parentName;
                }
            }
        }
        return null;
    }


    private normalizeKeyForMap(name: string): string {
        return this.normalizeCategory(name)
            .replace(/&/g, '')
            .replace(/[^a-z0-9\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private normalizeCategory(name: string): string {
        return name
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/İ/g, 'i')
            .replace(/Ğ/g, 'g')
            .replace(/Ü/g, 'u')
            .replace(/Ş/g, 's')
            .replace(/Ö/g, 'o')
            .replace(/Ç/g, 'c')
            .trim();
    }

    private resolveCanonicalName(name: string): string {
        const key = this.normalizeKeyForMap(name);
        const canonical = this.canonicalNameMap[key];
        if (canonical) {
            return canonical;
        }

        return this.toTitleCase(name.trim());
    }

    private resolveParentName(canonicalName: string): string | null {
        if (this.topLevelCategories.has(canonicalName)) {
            return null;
        }

        if (Object.prototype.hasOwnProperty.call(this.parentOverrideMap, canonicalName)) {
            return this.parentOverrideMap[canonicalName];
        }

        return this.findParentNameByKeywords(canonicalName);
    }

    private toTitleCase(name: string): string {
        return name
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1).toLocaleLowerCase('tr-TR'))
            .join(' ')
            .replace(/\s*&\s*/g, ' & ')
            .trim();
    }

    private async determineParentId(categoryName: string): Promise<number | null> {
        const parentName = this.resolveParentName(categoryName);
        if (!parentName) {
            return null;
        }
        return await this.getParentIdByName(parentName);
    }

    private async getParentIdByName(parentName: string): Promise<number> {
        // Artık sadece standart kategorileri kullan
        return await this.findOrCreateParentCategory(parentName);
    }
}

// Singleton instance
export const categoryMatcher = new CategoryMatcher();

