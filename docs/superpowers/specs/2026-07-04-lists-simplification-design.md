# Liste Sistemi Sadeleştirme — Tasarım (2026-07-04)

**Amaç:** Aktif/Tamamlanan/Şablon yaşam döngüsünü kaldırıp tek tip, düz bir
alışveriş-listesi modeline geçmek. Kullanıcı hangi listenin "aktif" olduğunu
kendisi seçer. Her listeye ürün eklenebilir; her liste klonlanabilir ve başka
bir listeden ürün aktarılabilir.

## 1. Kavramsal değişim (mevcut → yeni)

| Konu | Mevcut | Yeni |
|---|---|---|
| Sekmeler | Aktif / Tamamlanan / Şablonlar | **Sekme yok — tek düz liste** |
| `is_template` | Şablon listeleri ayrı | **Kaldırıldı** (kolon durur, kullanılmaz) |
| `status` | `active` / `completed` (otomatik) | **`active` / `inactive`** — sadece "aktif işareti", tek aktif liste |
| Yeni liste | Eski aktifi otomatik tamamlar | Eski aktifi **pasife** çeker, yenisi aktif olur (silme/tamamlama yok) |
| Karşılaştırma sonrası | "Bu Rotayı Kullan" listeyi tamamlar | **Tamamlama kavramı yok** — buton kaldırıldı |
| Liste kaybı | completed'a taşınır | **Hiçbir liste kaybolmaz/gizlenmez** |

### Onaylanmış kararlar (kullanıcı)
- **Aktiflik:** Yeni liste oluşturunca **aktif** olur; klon **pasif** olur. Ayrıca
  herhangi bir listeye girip **"Aktif liste yap"** denebilir.
- **"Başka listeden ürün aktar"** iki seçenekli bir modal açar:
  1. **Sadece eksik ürünleri ekle** — bu listede olmayan ürünler eklenir; mevcut
     ürünler ve adetleri değişmez (çakışan ürün atlanır).
  2. **Tüm listeyi bununla değiştir** — bu listenin ürünleri silinip yerine
     kaynak listenin ürünleri konur.
- **"Bu Rotayı Kullan" butonu kaldırılır** (her marketin altındaki affiliate
  "Sepeti …'te tamamla" butonları zaten alışverişe yönlendiriyor).
- **Aktif listeye ekleme:** Anasayfa/arama "+" yalnızca aktif listeye ekler.
- **Her listeye ekleme:** Aktif olmayan bir listeye girip de ürün eklenebilir.

## 2. Backend (cheep-backend-express)

### Şema (`prisma/schema.prisma`)
- `List.status`: değer kümesi `'active' | 'inactive'`. (Serbest string kalır, enum
  eklenmez — mevcut migration deseniyle uyumlu.) `@@index([status])` durur.
- `List.is_template`: **kolon durur, artık okunmaz/yazılmaz** (yıkıcı migration'dan
  kaçınmak için). Varsayılan `false`.
- `ListItem.brand_independent`: **tüm kopyalama yollarında korunur** (mevcut bug:
  düşürülüyordu).

### Veri migration'ı (SQL, container'da `prisma migrate deploy` ile çalışır)
Tek seferlik normalleştirme:
1. Her kullanıcı için tüm listeleri `status='inactive'` yap.
2. Her kullanıcının **en son güncellenen** listesini `status='active'` yap
   (kullanıcı başına tam bir aktif garanti; eski çoklu-aktif + şablon karmaşasını
   temizler).
3. `is_template=true` olan eski listeler olduğu gibi kalır (artık normal liste
   olarak görünür; veri silinmez). Eski `completed` listeler `inactive` olur.

> Prod DB'ye yalnızca sanctioned deploy yolundan (container startup → migrate
> deploy) yazılır. Manuel/doğrudan prod yazımı yapılmaz.

### Endpoint'ler (`src/api/lists/`)
| Method | Path | Davranış |
|---|---|---|
| GET | `/lists` | Kullanıcının **tüm** listeleri; sıralama: aktif önce, sonra `updated_at desc`. `is_template`/`status` ile filtreleme yok. |
| POST | `/lists` | Yeni liste `status='active'`; **tx içinde** diğerleri `inactive`. (is_template/otomatik-tamamlama kaldırıldı.) |
| POST | `/lists/:id/activate` | Bu liste `active`, kullanıcının diğerleri `inactive` (tx). |
| POST | `/lists/:id/clone` | Yeni **pasif** liste; ad `"{name} (Kopya)"`; kalemler kopyalanır (**`brand_independent` dahil**). |
| POST | `/lists/:id/import` | Body `{ sourceId, mode: 'merge' \| 'replace' }`. `merge`: bu listede olmayan kalemleri ekle (`skipDuplicates`). `replace`: bu listenin kalemlerini sil, kaynağınkileri kopyala. İkisinde de `brand_independent` korunur. Guard: `sourceId !== id`, ikisi de kullanıcıya ait. |

**Kaldırılan/atıl:** `use-route` (tamamlama) mobilde çağrılmaz; şablon endpoint'leri
(`/templates/*`, `import-to-existing`, `create-new`) mobilde kullanılmaz. Backend
route'ları dormant bırakılabilir (silmek zorunlu değil) ama mobil servis metotları
temizlenir.

### Validation (`src/schema/list.schema.ts`)
- `importSchema`: `sourceId` required int (positive), `mode` required `'merge'|'replace'`.
- `activate` / `clone`: yalnızca `validateIdParam` (body yok).

### Testler (vitest)
- `create` → yeni aktif + diğerleri inactive.
- `activate` → tek aktif garanti.
- `clone` → kalemler + `brand_independent` kopyalanır, klon `inactive`.
- `import merge` → çakışan ürün atlanır, yeni ürünler eklenir, `brand_independent` korunur.
- `import replace` → hedef kalemler silinir, kaynağınkilerle değişir.
- Migration idempotent + kullanıcı başına tam bir aktif.

## 3. Mobil (Cheep-Mobile)

### `CartContext`
- `refresh()`: `getLists()` (tümü) → `activeList = find(status==='active') ?? null`.
  `is_template` referansı kaldırılır.

### `ListsScreen`
- **Sekmeler kaldırılır.** Tek `FlatList` (tüm listeler, `getLists()`).
- `ListCard` aktif listede **"Aktif" rozeti** gösterir.
- "+" (yeni liste) durur. Kaydırma `flex:1` ile korunur.

### `ListDetailScreen` (aktif + pasif, aynı ekran)
- **Başlık:** ad + sil (durur). Aktif değilse başlıkta/aksiyonda **"Aktif Liste Yap"**.
- **Aksiyon çubuğu** (kaydırmayı bozmayacak şekilde, alt sabit veya liste-footer):
  - **Ürün Ekle** → hedefi *bu liste* olan arama akışı.
  - **Klonla** → `clone` → toast, listeye döner.
  - **Başka Listeden Aktar** → kaynak-liste seçtir → mod modalı (2 seçenek) → `import`.
  - **Rotaları Göster** → karşılaştırma (durur).
- **Kaydırma:** kalemler `FlatList`'i ekranın kalan yüksekliğine sabit (bounded);
  aksiyon çubuğu içeriği örtmesin diye yeterli `paddingBottom`. Uzun listelerde
  (>5 kalem) tüm kalemlere erişim gerçek cihaz/harness'ta doğrulanır.

### Hedef-listeye ekleme akışı
- `Search` ekranı opsiyonel route param alır: `{ targetListId?, targetListName? }`.
  - Param varsa: "+" → `addItem(targetListId)`; üstte "'X' listesine ekleniyor" şeridi.
  - Param yoksa: mevcut davranış (aktif listeye ekler).
- `Search`, Lists stack'ından da erişilebilir olur (aynı bileşen Lists stack'ine de
  kaydedilir) ki "Ürün Ekle" kullanıcıyı Listeler sekmesinde tutsun. (Kesin
  navigasyon detayı plan aşamasında.)

### Yeni modaller
- **SelectSourceListModal:** aktarılacak kaynak listeyi seçtirir (mevcut liste hariç).
  Mevcut `SelectListModal` deseni yeniden kullanılır.
- **ImportModeModal:** "Sadece eksik ürünleri ekle" / "Tüm listeyi bununla değiştir".

### `StrategyDetailScreen`
- **"Bu Rotayı Kullan" butonu + `useRoute` çağrısı kaldırılır.** Affiliate
  "Sepeti …'te tamamla" butonları durur.

### `list.service.ts`
- Ekle: `activate(id)`, `clone(id)`, `importFromList(id, sourceId, mode)`.
- Sil/atıl: `createFromTemplate`, `getTemplates`, `importToExisting`,
  `createNewFromCompleted`, `useRoute` (mobil kullanım kaldırılır).

### Tipler (`types/index.ts`)
- `ShoppingList.status`: `'active' | 'inactive'`. `is_template` bağımlılığı kaldırılır.

### i18n (tr/en/de/pl/sv)
- Yeni anahtarlar: `list.set_active`, `list.active_badge`, `list.add_products`,
  `list.clone`, `list.clone_done`, `list.import_from_list`,
  `list.import_mode.title/merge/replace`, `search.adding_to_list`, vb.
- Eski `completed`/`template` anahtarları kalır (kullanılmaz, zararsız).

## 3.6 UI/UX yerleşimi (önemli — sade & düzgün)

**İlke:** Her ekranda **tek net birincil aksiyon**; ikincil aksiyonlar erişilebilir
ama kalabalık yapmaz. Mevcut tema token'ları kullanılır (`spacing`, `borderRadius`,
`Button` varyantları). Dokunma hedefi **≥44px**. Renk/gölge = mevcut tasarım
sistemi. `frontend-design` ilkeleri uygulanır.

### `ListsScreen` (liste listesi)
- Tek `FlatList`, kart aralığı `spacing.md`. Aktif kart: sol üstte **"✓ Aktif"**
  rozeti (mevcut `badge` stili, `colors.primary`). Diğer kartlarda rozet yok.
- Aktif liste **en üstte** (backend sıralaması). "+" başlıkta durur.

### `ListDetailScreen` — aksiyon hiyerarşisi (kalabalık YOK)
1. **Başlık kartı:** liste adı + (aktifse) küçük **"✓ Aktif"** chip. Sağ üstte tek
   **⋮ (overflow)** ikon-butonu.
2. **⋮ menüsü** (basit alt-sheet modal — mevcut modal deseni): sırayla
   **Aktif liste yap** (yalnız aktif değilse) · **Klonla** · **Başka listeden aktar** ·
   **Sil** (kırmızı). Az kullanılan aksiyonlar burada toplanır → ekran sade kalır.
3. **Aktif değilse** başlık altında ince, tek satır bilgi şeridi:
   "Bu liste aktif değil" + sağda küçük **"Aktif Yap"** (outline, ≤36px yükseklik)
   → keşfedilebilirlik için (menüye ek olarak). Aktifse şerit yok.
4. **Kalemler** `FlatList` (scrollable, bounded).
5. **Alt sabit çubuk** (kalem varsa): iki buton yan yana, eşit —
   **"Ürün Ekle"** (outline/secondary) + **"Rotaları Göster"** (primary, dolu).
   Kaydırma bunların altına girmesin (`paddingBottom`).
6. **Boş liste:** ortada `EmptyState` + tek **"Ürün Ekle"** aksiyonu.

> Böylece detay ekranında görünür yalnızca: başlık + (opsiyonel) aktif şeridi +
> kalemler + 2 alt buton. Klonla/Aktar/Aktif-yap/Sil ⋮ menüsünde. Sade, dengeli.

### Modaller (tutarlı stil)
- **SelectSourceListModal** ve **ImportModeModal**: mevcut `SelectListModal` /
  `CreateListModal` görsel dilini izler (alt-sheet, `borderRadius.xl`, safe-area
  padding, `Button` bileşenleri). ImportModeModal iki büyük, net seçenek kartı:
  başlık + tek satır açıklama, ≥44px, aralarında `spacing.md`.
- **"'X' listesine ekleniyor" şeridi** (Search, hedef-liste modunda): üstte ince,
  `colors.primary[50]` zemin, tek satır, kapat/geri ile çıkılır.

### Buton boyut/yerleşim kuralları
- Alt sabit çubuk: `padding: layout.screenPadding`, üst ince ayraç, `background.paper`.
- Yan yana iki buton: her biri `flex:1`, aralarında `spacing.sm`.
- İkon-butonlar (⋮, +): 40×40, `borderRadius.md`, ortalı.
- Metin butonları tek satır, kısaltma yok; sığmıyorsa etiket kısaltılır, buton büyümez.

## 4. Kapsam dışı
- Şablon özelliğini korumak (kaldırıldı).
- Rota "tamamlama"/geçmiş kavramı (kaldırıldı).

## 5. Riskler
- **Prod veri migration'ı**: kullanıcı başına tam bir aktif garanti şart; yanlışsa
  anasayfa "+" hedefsiz kalır. Migration test edilir; ayrıca mobil, aktif liste
  yoksa güvenli davranır (ekleme sırasında yeni liste oluşturup aktif yapar).
- **Çapraz-stack navigasyon** (Ürün Ekle → Search): aynı bileşeni iki stack'e
  kaydetmek plan aşamasında netleştirilir.
