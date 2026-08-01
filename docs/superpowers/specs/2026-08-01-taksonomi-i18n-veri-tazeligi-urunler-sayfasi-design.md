# Taksonomi, kategori i18n'i, veri tazeliği ve website ürünler sayfası

Tarih: 2026-08-01
Durum: Tasarım onaylandı, uygulama planı bekliyor

## Sorun

Kullanıcının bildirdiği dört belirti, iki kök nedene iniyor.

Belirtiler:

1. Mobil uygulamada kategori adları uygulama diline çevrilmiyor — İngilizce
   arayüzde "Meyve & Sebze", "Şarküteri" yazıyor.
2. Listeye ürün eklendikten sonra anasayfaya dönünce değişiklik görünmüyor;
   kullanıcının elle aşağı çekip yenilemesi gerekiyor.
3. Website'deki "Fiyatlar" sayfası karışık ve ürün göstermiyor.
4. Anasayfadan "Meyve ve Sebze"ye girince alt kategori de ürün de gelmiyor
   (Tüm Ürünler'den girince geliyor). Ayrıca birçok ekranda veri yüklenirken
   hiçbir gösterge yok.

Kök nedenler:

**A. `categories` tablosunda `country_id` yok ve `slug` global `@unique`.**
Tek bir ağaç, kaynağı birbirinden bağımsız iki ülkeye hizmet ediyor:

- TR ağacı devletin verisinden türetiliyor (`Cheep-Scraper/countries/turkey/mf_taxonomy.py`,
  ürünlerin `menu_category` + `main_category` çiftlerinden). 2026-07-03'te
  seed edilmiş, ids 1–88.
- PL ağacı elle yazılmış `cheep-backend-express/src/config/standard-categories.ts`
  listesinden geliyor. 2026-07-11'de seed edilmiş, ids 89+.
  `Cheep-Scraper/countries/poland/category_map.json` 783 Lehçe kategori adını
  bu elle yazılmış slug'lara eşliyor (`Owoce i warzywa → meyve-sebze`).

Global slug benzersizliği yüzünden iki ağaç aynı tabloda çakışmadan duramıyor.
Üstüne `cheep-backend-express/scripts/migrate-to-standard-categories.ts` bir kez
çalışıp yarım kalmış: TR'nin bazı yapraklarını (`peynir`, `sut`, `sebze`,
`meyve`) PL ağacının üst kategorilerinin altına taşımış. `meyve-ve-sebze`
(id 20) bu yüzden içi boşaltılmış bir kabuk — çocukları id 100'ün altına
alınmış, kendisi 0 ürünle ayakta kalmış.

Ülke bazında doğrulanmış dağılım (canlı API, 2026-08-01):

| Kategori | id | TR | PL |
|---|---|---|---|
| `temizlik-ve-kisisel-bakim-urunleri` | 58 | 3.121 | 0 |
| `temizlik` | 193 | 0 | 1.889 |
| `atistirmalik-ve-tatli` | 48 | 2.216 | 0 |
| `atistirmalik` | 173 | 1.105 | 4.850 |
| `diger-urunler` | 79 | 461 | 0 |
| `diger` | 334 | 0 | 2.293 |
| `sut-urunleri-ve-kahvaltilik` | 1 | 928 | 0 |
| `sut-urunleri` | 89 | 1.029 | 2.958 |
| `et-tavuk-ve-balik` | 13 | 174 | 0 |
| `et-tavuk-balik` | 108 | 513 | 2.028 |
| `meyve-ve-sebze` | 20 | **0** | 0 |
| `meyve-sebze` | 100 | 135 | 1.694 |

Buna bağlı ikinci bir hata: `categories.service.ts` içindeki `_count.products`
hiçbir yerde `country_id` ile filtrelenmiyor. Bir Türk kullanıcı, Polonya
ürünlerini de içeren sayılar görüyor ve TR'de sıfır ürünü olan kategoriler
(`temizlik`) dolu görünüyor.

**B. Mobil uygulamada cache/invalidation katmanı yok.**
Her ekran `useEffect(..., [])` ile mount'ta bir kez veri çekiyor. Ekranlar
arası bağ yok: bir ekrandaki mutasyon başka ekrandaki veriyi bayat bırakıyor.

### Belirtilerin kök nedene bağlanması

- **(4) Meyve ve Sebze boş:** `Cheep-Mobile/src/utils/categoryIcon.ts:107`
  içindeki elle yazılmış `HOME_PRIORITY` listesinin ilk sırası
  `'meyve ve sebze'`. Bu, ölü olan id 20'ye denk geliyor. Anasayfa
  (`NewHomeScreen.tsx:99-102`) kategorileri bu sıraya göre dizip `.slice(0, 7)`
  ile ilk 7'yi alıyor; canlı olan "Meyve & Sebze" (id 100) listede olmadığı
  için sona düşüp kesiliyor. "Tüm Ürünler" ekranında backend'in kendi sırası
  geldiği için doğru kategoriye basılmış oluyor.
- **(1) Çeviri yok:** Kategori adları DB'de yalnızca Türkçe.
  `config/category-locale.ts` yalnızca PL için ve yalnızca website SEO
  export'unda kullanılıyor; mobil hiçbir dilde çevirmiyor.
- **(2) Bayat veri:** Anasayfa `loadData()`'yı sadece mount'ta ve ülke
  değişiminde çağırıyor; `useFocusEffect` yok. `CartContext` yalnızca rozet
  için var ve elle `refresh()` çağrılmasına dayanıyor.
- **(3) Website:** `/fiyatlar` (`BrowsePage.tsx`) 67 düz kategori hapı, 6
  market kartı ve 49 şehir hapından ibaret; hiç ürün göstermiyor, hiyerarşi
  yok, arama/filtre/sıralama yok.
- **(4) Spinner:** `NewHomeScreen` `loading` state'ini tutuyor ama hiçbir yerde
  render etmiyor. `PriceDifferenceScreen`, `StoreDetailScreen`,
  `StrategyDetailScreen`, `AssistantChatScreen`'de hiç yükleme göstergesi yok.

## Hedefler

- TR ve PL taksonomileri birbirinden bağımsız, her biri kendi kaynağından
  türetilmiş olsun; ikiz ve ölü kategori kalmasın.
- Kategori adları uygulama/site diline göre görünsün.
- Mobilde bir ekrandaki değişiklik diğer ekranlara elle yenileme olmadan
  yansısın; her veri yüklemesinin görünür bir göstergesi olsun.
- Website'de gerçek bir ürünler sayfası olsun; verisi tamamen API'den gelsin.

### Kapsam dışı

- `diger` kategorisindeki ürünlerin doğru kategorilere sınıflandırılması.
  Kataloğun büyük bir kısmı burada; ayrı bir iş olarak ele alınmalı.
- DE/CH/SE ülkelerinin açılması.
- Website'nin tanıtım (landing) bölümlerinin yeniden tasarımı.

## Tasarım

### 1. Ülke bazlı taksonomi (backend + migration)

**Şema değişikliği.** `Category` modeline `country_id Int` eklenir;
`slug String @unique` kaldırılıp `@@unique([country_id, slug])` gelir.
`country` ilişkisi `onDelete: Cascade`. `@@index([country_id, parent_id])`
eklenir.

Bu, yapısal kök nedeni kapatır: aynı slug iki ülkede yan yana var olabilir,
iki ayrı türetme birbirini ezemez.

**Veri taşıma (idempotent migration script).** Sırayla:

1. Mevcut her kategoriye `country_id` atanır. Kategorinin ülkesi, alt ağacındaki
   ürünlerin `country_id` çoğunluğundan belirlenir. Hem TR hem PL ürünü olan
   kategoriler (`sut-urunleri`, `meyve-sebze`, `et-tavuk-balik`, `atistirmalik`,
   `temel-gida`, `icecek`, `firin-pastane`, `kahvaltilik`, `kisisel-bakim`)
   **ülke başına bir kopyaya bölünür**; ürünler kendi ülkelerinin kopyasına
   bağlanır.
2. TR tarafında, yarım kalmış migration'ın taşıdığı yapraklar devlet ağacındaki
   yerlerine geri konur. Kaynak: `mf_taxonomy.py`'nin ürettiği
   `taxonomy.json` (`main_to_slug` eşlemesi + `tops[].children`). Script bu
   dosyayı girdi alır; elle yazılmış bir eşleme tablosu tutulmaz.

   **Önkoşul:** depodaki `Cheep-Scraper/taxonomy.json` bayat bir örnektir
   (133 ürün, 8 üst kategori) ve kullanılamaz. Migration'dan önce prod ham
   verisi (`mf_raw`) üzerinde `mf_taxonomy.py` yeniden çalıştırılıp güncel
   taksonomi üretilmelidir. Üretilen ağaçtaki üst kategori sayısı DB'deki
   devlet setiyle (ids 1–88) tutarlı değilse migration durdurulup önce bu fark
   incelenmelidir.
3. PL tarafında ağaç `standard-categories.ts` + `countries/poland/category_map.json`
   ile hizalanır (PL'nin mevcut kaynağı budur).
4. Alt ağacında hiç ürün kalmayan kategoriler silinir.
5. Silinen/slug'ı değişen kategoriler için `category_redirects` tablosuna
   (`country_id`, `old_slug`, `new_slug`) kaydı yazılır; website 301'leri bunu
   kullanır.

Script tekrar çalıştırılabilir olmalı ve her adımda ne yaptığını saymalı
(taşınan ürün, bölünen kategori, silinen kategori). Önce `--dry-run` ile
rapor üretir.

**Kaynak otoritesinin tekilleştirilmesi.** TR için tek otorite devletin
türettiği ağaçtır. `standard-categories.ts` yalnızca PL seed'i olarak kalır ve
bu şekilde belgelenir; `category-matcher.service.ts`'in TR kategorisi *üretme*
yolları devre dışı bırakılır (ürün eşleştirmedeki diğer kullanımları korunur).
`fix-category-hierarchy.ts` ve `migrate-to-standard-categories.ts` scriptleri
kaldırılır — ikisi de bu karmaşayı üreten yollar.

**API değişiklikleri.**

- `GET /categories`, `/categories/parent`, `/categories/tree`,
  `/categories/:id/subcategories` artık `x-country` ile filtreler.
- Ürün sayısı **alt ağaç toplamı** ve **ülkeye göre** hesaplanır (tek özyinelemeli
  SQL; `_count` ilişki sayacı yerine).
- Alt ağacında ürünü olmayan kategori döndürülmez.
- Varsayılan sıralama: `display_order`, eşitlikte ürün sayısı azalan.

Bunun sonucu olarak `HOME_PRIORITY` ve mobildeki diğer elle sıralama listeleri
gereksizleşir ve silinir.

### 2. Kategori i18n'i (`x-lang`)

**Sözlük.** `cheep-backend-express/src/config/category-i18n.ts`:
`Record<countryCode, Record<slug, Record<lang, { name, slug }>>>`.
Mevcut `category-locale.ts` (yalnızca PL) buraya taşınır ve tek kaynak olur.
Diller: `tr`, `en`, `de`, `pl`, `sv`.

**Middleware.** `x-lang` başlığı okunur, desteklenen dillere karşı doğrulanır;
yoksa `Accept-Language`, o da yoksa ülkenin varsayılan diline düşülür. Sonuç
`req.lang` olarak taşınır.

**Uygulama noktaları.** Kategori uçları, ürün yanıtındaki `category` alanı,
arama sonuçları ve SEO export'u aynı çeviriden geçer. Eşleşme yoksa kaynak ad
olduğu gibi döner (sessiz veri kaybı yerine çevrilmemiş görünüm).

**İstemci.** `Cheep-Mobile/src/services/api.client.ts` request interceptor'ı
`i18next.language` değerini `x-lang` olarak ekler. Dil değişince ilgili
query'ler geçersizleşir (bkz. §4) ve kategori adları anında güncellenir.

### 3. Ürün listeleme ucunun genişletilmesi

`GET /products` yeni parametreler alır:

- `category_slug` (id yerine slug ile; website URL'leri slug tabanlı)
- `store_slug` — çoklu, market filtresi
- `sort` — `relevance` | `price_asc` | `price_desc` | `savings` | `name`
- `min_stores` — en az kaç markette bulunsun
- `min_price` / `max_price`

Yanıta `facets` eklenir: geçerli filtre kümesi altında kategori ve market
başına sonuç sayısı. Website'deki filtre panelinin sayaçları buradan gelir;
hiçbir sayı istemcide sabitlenmez.

Sayfalama mevcut `limit`/`offset` + `pagination.total` sözleşmesini korur.

### 4. Mobil veri katmanı — TanStack Query

`@tanstack/react-query` eklenir. `QueryClientProvider` `App.tsx`'te en dışta.

**Yapı.** `Cheep-Mobile/src/queries/`:

- `keys.ts` — merkezî query key fabrikası (`qk.products.list(params)`,
  `qk.categories.parents(country, lang)`, `qk.lists.detail(id)`, …).
  Ülke ve dil her key'in parçasıdır; değişince cache doğal olarak ayrışır.
- Alan başına hook dosyaları: `useCategories`, `useProductsInfinite`,
  `useLists`, `useListDetail`, `useCompare`, `useDeals`, `useStores`,
  `useNotifications`, `useProfile`.

**Mutasyonlar.** Listeye ekleme/çıkarma, liste oluşturma/silme/tamamlama birer
`useMutation`. Başarıda ilgili key'ler geçersizleştirilir
(`lists`, `activeList`, `compare`). Hızlı ekle akışında iyimser güncelleme
(optimistic update) + hata durumunda geri alma uygulanır — kullanıcı dokunur
dokunmaz rozet artar.

**Odak tazeleme.** React Navigation'ın `useFocusEffect`'i ve `AppState`,
react-query'nin `focusManager`'ına bağlanır. Ekrana dönen kullanıcı bayat
veriyi görmez; tazeleme arka planda olur, ekran boşalmaz.

**Varsayılanlar.** `staleTime` veri tipine göre: kategoriler/marketler uzun
(30 dk), ürün listeleri orta (5 dk), listeler/karşılaştırma kısa (0 —
her odakta tazelenir). `retry` 2, `refetchOnReconnect` açık.

`CartContext` kaldırılmaz ama içi `useActiveList` query'sinden beslenecek
şekilde sadeleşir; elle `refresh()` çağrıları silinir.

### 5. Tek tip yükleme göstergeleri

`Cheep-Mobile/src/components/ui/` altında:

- `ScreenLoader` — tam ekran ilk yükleme
- `GridSkeleton`, `ListSkeleton`, `CardSkeleton`, `DetailSkeleton` — içerik
  şekline uygun iskeletler
- `RefreshBar` — üstte ince ilerleme çizgisi (`isFetching`, ilk yükleme değil)

Kural: `isPending` → iskelet, `isFetching && !isPending` → `RefreshBar`,
`isError` → tekrar dene aksiyonlu hata durumu, boş sonuç → `EmptyState`.

Kapsanacak ekranlar (şu an göstergesi olmayanlar dahil): Anasayfa, Fiyat Farkı,
Market Detay, Strateji Detay, Asistan, Bildirimler, Listeler, Liste Detay,
Karşılaştırma Sonuçları, Ürün Detay, Kategori Ürünleri, Arama, Fırsatlar,
Profil.

### 6. Website — ürünler sayfası

**Rota.** `/urunler` (PL: `/pl/produkty`). `data/routes.ts`'e yeni bir
`ContentKind` olarak eklenir. Nav'da öne çıkarılır.

**Düzen** (Getir / Yemeksepeti Market / Trendyol Market deseni):

- Solda yapışkan kategori ağacı: üst kategori → alt kategori, her birinde
  sonuç sayısı. Mobilde alttan açılan panel.
- Üstte arama kutusu.
- Filtre şeridi: market çipleri, sıralama, fiyat aralığı, "en az N markette".
- Sağda ürün ızgarası (mevcut `ProductCard` yeniden kullanılır) + sayfalama.

**Veri.** İlk ekran prerender edilir — ürünler HTML'de gelir, Googlebot görür.
Sonraki her etkileşim `api.cheep.live`'a gider. Tüm filtre durumu URL
query'sine yazılır (`?kategori=&market=&sirala=&sayfa=`), böylece geri tuşu ve
link paylaşımı çalışır. Kategori ağacı ve market listesi API'den gelir; sayılar
`facets`'ten okunur. Hiçbir liste kodda sabitlenmez.

**Durumlar.** İskelet, boş sonuç ("filtreleri temizle" aksiyonuyla), hata
(tekrar dene). API erişilemezse prerender edilmiş ilk ekran görünür kalır.

**`/fiyatlar`.** Keşif hub'ı olarak kalır (kategori/market/şehir sayfalarına iç
bağlantı ağı — SEO değeri orada) ama sadeleşir ve `/urunler`e yönlendirir.
Sayfadaki çelişkili sayılar tek tanıma çekilir: gösterilen "ürün" sayısı her
yerde aynı kriteri (yayınlanabilir ürün) kullanır.

**Yönlendirmeler.** Migration'ın ürettiği `category_redirects` kayıtlarından
Caddy 301 kuralları üretilir; yayında olan kategori URL'leri kırılmaz.

## Uygulama sırası ve bağımlılıklar

Altı iş paketi tek seferde uygulanmaz. Bağımlılık sırası:

1. **§1 taksonomi** — diğer her şeyin altındadır. Bittiğinde belirti (4)'ün
   kategori kısmı kapanır ve mobildeki `HOME_PRIORITY` silinebilir.
2. **§2 kategori i18n'i** — §1'e bağlı (çeviri sözlüğü ülke bazlı kanonik
   slug'lara anahtarlanır). Belirti (1)'i kapatır.
3. **§4 + §5 mobil veri katmanı ve göstergeler** — §1/§2'den bağımsız
   başlatılabilir, paralel yürütülebilir. Belirti (2) ve (4)'ün spinner
   kısmını kapatır.
4. **§3 ürün ucu genişletmesi** — §6'nın önkoşulu.
5. **§6 website ürünler sayfası** — §1 ve §3'e bağlı. Belirti (3)'ü kapatır.

Her paket kendi başına yayına alınabilir olmalı; §1 ile §6 arasında yarım
kalmış bir durum kullanıcıya bozuk görünmemeli.

## Test stratejisi

- **Backend birim testleri:** ülke bazlı kategori filtresi; alt ağaç ürün
  sayımı; boş kategorinin döndürülmemesi; `x-lang` çözümlemesi ve çeviri
  fallback'i; yeni ürün filtreleri ve `facets` sayıları.
- **Migration testi:** üretim şemasının kopyası üzerinde `--dry-run` raporu;
  taşıma sonrası hiçbir ürünün kategorisiz kalmadığının ve her kategorinin
  tek ülkeye ait olduğunun doğrulanması.
- **Mobil:** query key fabrikası birim testi; mutasyon sonrası doğru key'lerin
  geçersizleştiğinin testi; kategori adının dile göre değiştiğinin testi.
- **Website:** ürünler sayfasının URL query'sinden durum kurması ve
  prerender/hydrate uyumu (hydration hatası olmaması).
- **Uçtan uca elle doğrulama:** anasayfadan her üst kategoriye girip alt
  kategori ve ürün geldiğinin görülmesi; listeye ürün ekleyip anasayfaya
  dönünce sayının elle yenileme olmadan arttığının görülmesi.

## Riskler

- **Migration geri alınamaz.** Çalıştırmadan önce prod veritabanı yedeği
  alınmalı; script önce `--dry-run` ile raporlanmalı.
- **Yayındaki kategori URL'leri.** `category_redirects` + 301 olmadan SEO
  kaybı olur; yönlendirmeler migration ile aynı sürümde yayına alınmalı.
- **`x-lang` eksik istemciler.** Eski uygulama sürümleri başlığı yollamaz;
  ülkenin varsayılan diline düşmek bunu güvenli kılar.
- **Website'nin API'ye bağımlılığı.** API erişilemezse etkileşimli filtreleme
  çalışmaz; prerender edilmiş ilk ekranın kendi başına anlamlı olması bu yüzden
  şart.
