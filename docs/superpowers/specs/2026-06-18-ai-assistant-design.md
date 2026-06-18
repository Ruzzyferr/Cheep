# Cheep AI Asistanı — Tasarım Dokümanı (Faz 5)

**Tarih:** 2026-06-18
**Durum:** Onaylı tasarım — uygulama 5-0 (marka-bağımsız) + 5-P (profil/onboarding) + 5a ile başlar
**Sağlayıcı:** Google Gemini (`gemini-2.0-flash`) via `@google/generative-ai`

## 1. Amaç ve Vizyon

Cheep'e **tek bir agentic (araç-çağıran) sohbet asistanı** eklemek. Kullanıcı doğal dille
konuşur; asistan kullanıcının listelerine, ürün kataloğuna, fiyatlara ve en-ucuz-rota
mantığına araçlarla erişerek alışveriş listeleri ve yemek planları oluşturur, düzenler ve
açıklar. Asistan üç ayrı özellik değil; tarif→liste, bütçe sepeti ve haftalık plan bu tek
asistanın **araçlar üzerinden ortaya çıkan (emergent) yetenekleridir**.

Hedef kitle geniştir (öğrenci, yurtta kalan, yaşlı; farklı ülkeler). Bu yüzden asistan tek
başına bir özellik değil; **uygulamanın bir "Profil & Kısıtlar" yeteneğine** dayanır. İlk
kayıttan sonra animasyonlu, maskot-eşlikli bir onboarding ile kullanıcının alışverişle
ilgili kısıtları (beslenme tarzı, kaçındıkları, alerjiler, hane, bütçe) toplanır; bu profil
hem asistana hem uygulamanın geri kalanına (fırsatlar, liste, compare) hizmet eder. Asistan
profili **her yeni sohbette okur** ve listeleri/önerileri ona göre uyarlar — profil sorusu
sormaz. Kullanıcı profilini istediği zaman görür, günceller, siler.

## 2. Kapsam ve Fazlama

Mimarinin tamamı bu spec'te belgelenir; uygulama fazlara bölünür. **writing-plans önce
5-0 + 5-P + 5a için plan çıkarır** (5-0 ve 5-P temel parçalar, 5a bunların üstüne biner).

| Faz | İçerik | Kapsadığı kullanıcı istekleri |
|---|---|---|
| **5-0 — Marka-bağımsız liste öğeleri (temel)** | `ListItem.brand_independent` + compare motorunun muadil-grup genişletmesi + elle/asistan ekleme toggle'ı + sonuç ekranında seçilen marka gösterimi | "yarım yağlı süt 1L, marka farketmez → en ucuzu hangi markette" |
| **5-P — Profil & Kısıtlar + Onboarding (temel, app-geneli)** | `UserProfile` modeli + animasyonlu/maskotlu onboarding sihirbazı (5 soru) + profil ekranında düzenleme/silme + kısıtların app-geneli yüzeylenmesi | beslenme/inanç/alerji/hane/bütçe kısıtlarına uygun alışveriş; herkese hitap |
| **5a — Agentic sohbet çekirdeği (metin)** | Tool-calling agent + thread persistence (silinebilir) + araçlar (liste oku/oluştur/ekle/çıkar, ürün/fiyat ara, en ucuz rota) + **profili okuyan** sistem prompt + mobil chat ekranı | tarif→liste, haftalık plan, bütçe sepeti, "zaten listende var, kalsın mı?" diyaloğu |
| **5b — Multimodal** | Görsel girdi: yemek fotoğrafı → yemeği tanı → tarif → liste | Instagram SS → liste |
| **5d — Çok-dil + erişilebilirlik (yol haritası)** | App-geneli dil + a11y (büyük dokunma alanı, font ölçeği, ekran okuyucu) | göçmen/yaşlı/engelli erişimi |

**Sıra:** 5-0 ve 5-P temel; 5a ikisinin üstüne biner (asistan hem marka-bağımsız ekleme yapar hem profili okur). **Bu doküman ve ilk implementasyon planı 5-0 + 5-P + 5a'yı bağlar; 5b/5d yol haritası olarak burada durur, ayrı spec gerektirmeden plan aşamasında detaylandırılabilir.** (Önceki "5c — kişiselleştirme" fazı 5-P içinde erkene çekilerek soğuruldu.)

## 3. Sağlayıcı ve Maliyet

- **Model:** `gemini-2.0-flash` — tool-calling (5a) ve vision (5b) destekler, ücretsiz katmanı var.
- **SDK:** `@google/generative-ai` (backend).
- **Anahtar:** Yalnızca `process.env.GEMINI_API_KEY` üzerinden okunur. Gerçek anahtar
  `cheep-backend-express/.env` (gitignore'lu) içinde, repoya **asla** yazılmaz.
  `.env.example`'a `GEMINI_API_KEY=` placeholder eklenir.
- **Limit:** Free katman ~15 istek/dk. Kullanıcı başına rate-limit uygulanır (mevcut
  middleware deseni). Gemini 429 dönerse kullanıcıya zarif hata mesajı gösterilir.
- **Model adı env'den geçersiz kılınabilir:** `GEMINI_MODEL` (varsayılan `gemini-2.0-flash`).

## 4. Profil & Kısıtlar + Onboarding (Faz 5-P)

Uygulamanın temel bir yeteneği: kullanıcının **alışverişle ilgili** kısıtlarını bir kez
toplayıp hem asistana hem app'in geri kalanına (fırsatlar, liste, compare) hizmet etmek.
Asistandan önce/birlikte kurulur.

### 4.1 Veri modeli (Prisma — yeni migration)

`User` ile 1:1 yeni `UserProfile`. Çok-seçimli ve serbest-metin alanlar JSON tutulur.

```prisma
model UserProfile {
  id              Int      @id @default(autoincrement())
  user_id         Int      @unique
  household_size  String?  // '1' | '2' | '3-4' | '5+'
  diet            String?  // 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian'
  avoid           Json?    // ['pork_gelatin','alcohol', ...] — inanç/kültür kaynaklı
  allergies       Json?    // ['lactose','gluten','peanut','tree_nut', ...serbest metin]
  weekly_budget   Decimal? @db.Decimal(10, 2)
  onboarding_done Boolean  @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  user            User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

`User` modeline `profile UserProfile?` ilişkisi eklenir. `ülke/dil` zaten `User.country_id`'de.

### 4.2 Onboarding sihirbazı (mobil)

İlk kayıttan sonra, `onboarding_done = false` ise açılır. **Yazio tarzı**: her ekranda tek
soru, ilerleme çubuğu, **maskot kuş** animasyonlu eşlik eder ("Harika! Birkaç soru daha 🐦").
Her adımda **"Şimdilik geç"** vardır (kullanıcı hapsedilmez); atlananlar profil ekranından
sonra doldurulabilir. Bitince `onboarding_done = true`.

**Sorular (yalnızca alışverişle ilgili, nazik dil):**

| # | Soru | Şıklar | Alan |
|---|---|---|---|
| 1 | Kaç kişiye alışveriş yapıyorsun? | 1 / 2 / 3-4 / 5+ | `household_size` |
| 2 | Beslenme tarzın? | Hepçil / Vejetaryen / Vegan / Pesketaryen | `diet` |
| 3 | Şunlardan kaçınıyor musun? (çoklu) | Domuz eti & jelatin · Alkollü ürünler | `avoid` |
| 4 | Alerjin/intoleransın? (çoklu) | Laktoz · Gluten · Fıstık · Kabuklu yemiş · Yok · **➕ Sen yaz…** | `allergies` |
| 5 | Haftalık bütçen? (opsiyonel) | kaydırıcı / atla | `weekly_budget` |

- **3. soru inancı etiketlemeden** ürün üzerinden sorar (helal/koşer dolaylı çıkar) —
  nazik ve uluslararası.
- **4. soruda serbest-metin** ("Sen yaz…") şıkta olmayan alerjiyi eklemeyi sağlar.

### 4.3 Profil ekranı

`profile` sekmesinde kullanıcı tüm cevapları **görür, günceller, siler** (alan boşaltma =
o kısıtı kaldırma). Bu, kullanıcının "isteğe bağlı silinebilir" kontrol ilkesiyle aynı çizgi.

### 4.4 App-geneli yüzeylenme

Profil kurulunca kısıtlar app boyunca etkir:

- **Fırsatlar / ürün listeleri:** diyet/avoid'e uymayan ürünler süzülür veya rozetlenir
  ("🌱 vegan", "⚠️ alerjen: fıstık").
- **Liste & compare:** öğe eklerken alerjen/diyet uyarısı.
- **Asistan:** profili okur (4.5).

**Bağımlılık:** Ürünleri diyet/alerjen'e göre süzmek için **ürün-düzeyi diyet/alerjen
etiketi** gerekir. Mevcut katalogda bu yok. Yaklaşım: (v1) **kategori-bazlı sezgi**
(örn. "Et & Tavuk" → vegan/vejetaryen değil; "Şarküteri" → domuz içerebilir → `avoid`
uyarısı), (v2) mevcut `llm-product-matcher` ile ürünleri diyet/alerjen etiketleme.
Asistan tarafında bu engel yok — model ürün adından zaten çıkarım yapabilir. **Bu yüzden
5-P'nin app-geneli filtreleme kısmı kategori-sezgiyle başlar; ince etiketleme yol haritası.**

### 4.5 Asistan entegrasyonu

Asistan **profil sorusu sormaz**. **Her yeni sohbet (thread) başında** `UserProfile`
okunur ve sistem prompt'una enjekte edilir (diyet, avoid, alerji, hane, bütçe). Böylece
listeler/tarifler/öneriler otomatik profile uyar. (Göreve özel anlık sorular — "kaç günlük
liste?" — hâlâ sorulabilir; bunlar profil sorusu değildir.)

### 4.6 Güvenlik ilkesi

**Alerji ve diyet/avoid = sert kısıt:** asla ihlal edilmez, sessizce varsayılmaz; ürün
önerilirken açık uyarı/eleme uygulanır. Sevme/sevmeme gibi yumuşak tercih bu fazda yok
(onboarding'den çıkarıldı — alışveriş için gerekli değil). Bir kullanıcıyı tehlikeye
atabilecek alerji ile bir zevk tercihi aynı kefeye konmaz.

### 4.7 Rotalar

```
GET /profile     # kullanıcının profilini getir (yoksa boş/null)
PUT /profile     # profili oluştur/güncelle (onboarding ve profil ekranı ortak kullanır)
```
Auth gerektirir; `user_id` token'dan gelir.

## 5. Backend Tasarımı (5a)

### 5.1 Modül yapısı

Mevcut feature-modül desenine (`api/<feature>/`) birebir uyar:

```
src/api/assistant/
  assistant.routes.ts       # rotalar (hepsi auth'lu)
  assistant.controller.ts   # HTTP katmanı
  assistant.service.ts      # agent döngüsü orkestrasyonu
  assistant.tools.ts        # tool tanımları + executor'lar (mevcut servisleri çağırır)
  assistant.schema.ts       # zod şemaları
src/services/gemini.client.ts  # @google/generative-ai sarmalayıcı
```

`api/index.ts`'e `/assistant` router'ı eklenir.

### 5.2 Veri modeli (Prisma — yeni migration)

ID'ler mevcut şemayla tutarlı: `Int @id @default(autoincrement())`, snake_case `@@map`.

```prisma
model ChatThread {
  id         Int           @id @default(autoincrement())
  user_id    Int
  title      String?       // ilk kullanıcı mesajından otomatik üretilir
  created_at DateTime      @default(now())
  updated_at DateTime      @updatedAt

  user       User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  messages   ChatMessage[]

  @@index([user_id])
  @@map("chat_threads")
}

model ChatMessage {
  id         Int        @id @default(autoincrement())
  thread_id  Int
  role       String     // 'user' | 'model' | 'tool'
  content    String     @db.Text
  tool_calls Json?      // fonksiyon çağrısı istek/sonuçları (denetim/replay için)
  created_at DateTime   @default(now())

  thread     ChatThread @relation(fields: [thread_id], references: [id], onDelete: Cascade)

  @@index([thread_id])
  @@map("chat_messages")
}
```

`User` modeline `chat_threads ChatThread[]` ilişkisi eklenir.

**Silme:** Kullanıcı bir sohbeti silince **hard delete** (`onDelete: Cascade` mesajları da siler).
Gizlilik için en temizi; "isteğe bağlı silinebilir" gereksinimini karşılar.

**Marka-bağımsız öğeler (Faz 5-0):** `ListItem`'a tek alan eklenir:

```prisma
brand_independent Boolean @default(false) // true → muadil grubundaki en ucuz markayı seç
```

`product_id` **temsilci ürün** olarak kalır (ad/gramaj/görsel/`muadil_grup_id` buradan
gelir). Bayrak açıkken compare, sabit ürün yerine grubun tamamını değerlendirir (bkz. 5.8).

### 5.3 Araç seti (function-calling)

Tüm araçlar **in-process** olarak mevcut servisleri çağırır (HTTP değil). Her araç
`user_id` ile scope'lanır; bir kullanıcı başkasının listesine erişemez.

| Araç | Parametreler | Ne yapar | Kaynak servis |
|---|---|---|---|
| `search_products` | `query: string, limit?: number` | Katalogda ürün arar | `products.service` |
| `get_user_lists` | — | Kullanıcının listeleri | `lists.service` |
| `get_list_items` | `listId: number` | Listedeki ürünler (miktar/birim) | `lists.service` |
| `create_list` | `name: string, budget?: number` | Yeni liste açar | `lists.service` |
| `add_items_to_list` | `listId: number, items: {query,quantity?,unit?,brandIndependent?}[]` | Ürün(ler) ekler (matcher ile eşleştirir) | `lists.service` + product matcher |
| `remove_list_item` | `listId: number, itemId: number` | Ürün çıkarır | `lists.service` |
| `get_product_prices` | `productId: number` | Marketlere göre fiyat | `store-prices.service` |
| `get_cheapest_route` | `listId: number` | En ucuz rota karşılaştırması | `lists-compare` |

`add_items_to_list`, serbest metin ürün adını (örn. "kırmızı mercimek") mevcut ürün
eşleştirme mantığıyla katalog ürününe bağlar; eşleşme bulunamazsa araç sonucu bunu
bildirir ve model kullanıcıya sorar.

**Asistan "akıllı marka" davranışı:** Kullanıcı jenerik/markasız istediğinde ("süt ekle",
"yarım yağlı süt 1L") asistan `brandIndependent: true` geçer → en ucuz marka seçilir.
Kullanıcı marka belirtirse ("Pınar süt") `brandIndependent` `false` kalır (marka sabit).
Sistem prompt'una bu kural yazılır.

### 5.4 Agent döngüsü (`assistant.service.ts`)

1. `POST /assistant/threads/:id/messages { content }` (thread yoksa önce `POST /assistant/threads`).
2. Thread geçmişi (mesajlar) Gemini `contents` formatına dönüştürülür.
3. Sistem prompt + araç tanımlarıyla `gemini-2.0-flash` çağrılır.
4. Model `functionCall` döndürürse → ilgili executor çalıştırılır (user_id scope'lu) →
   sonuç `functionResponse` olarak eklenir → döngü tekrar.
5. **Maksimum 6 tur** (sonsuz döngü koruması); aşılırsa son metinle güvenli kapanış.
6. Final metin yanıtı → kullanıcı mesajı + asistan mesajı (varsa tool_calls JSON'u ile)
   DB'ye kaydedilir → controller yanıtı döndürür.
7. Thread `title` boşsa ilk kullanıcı mesajından kısa bir başlık üretilir.

### 5.5 Sistem prompt (5a)

İçerir: Cheep asistan personası; **ülke-farkında** davranış (kullanıcının `Country`'sine
göre mutfak/ürün); **`UserProfile` enjeksiyonu** — her yeni sohbette diyet/avoid/alerji/
hane/bütçe okunur ve önerilere uygulanır (sert kısıtlar asla ihlal edilmez, bkz. 4.6);
asistan profil sorusu sormaz; akıllı-marka kuralı (5.3); göreve-özel clarifying-question
("listede zaten varsa sor", "kaç günlük liste?"); araçların ne zaman çağrılacağı; bugünün
tarihi.

### 5.6 Rotalar

```
GET    /assistant/threads               # geçmiş sohbet listesi (başlık + son güncelleme)
POST   /assistant/threads               # yeni thread
GET    /assistant/threads/:id           # thread + mesajlar
DELETE /assistant/threads/:id           # sohbeti sil (hard, cascade)
POST   /assistant/threads/:id/messages  # mesaj gönder → agent yanıtı
```

Hepsi auth (JWT) gerektirir; thread'ler `user_id` ile scope'lanır (başkasının thread'ine
erişim 404).

### 5.7 Akış tipi, hata, limit

- **Streaming yok** (5a): istek/yanıt + mobilde "yazıyor..." göstergesi. SSE streaming 5b+ notu.
- **Hata:** Gemini hatası/timeout → 502 + kullanıcı dostu mesaj; kısmi tool sonuçları
  kaybolmaz (mesaj kaydı tutarlı bırakılır).
- **Rate-limit:** kullanıcı başına; 429 zarif yönetilir.

### 5.8 Marka-bağımsız compare (Faz 5-0)

`compare-engine.service.ts` şu an her `ListItem`'ı sabit `product_id` ile fiyatlandırır.
Değişiklik: `item.brand_independent === true` olan öğeler için, fiyat seçiminde tek ürün
yerine **muadil grubun tamamı** değerlendirilir.

- Öğenin `product.muadil_grup_id`'si yoksa (tekil ürün) davranış değişmez = marka sabit.
- Varsa: her market için o gruptaki **o markette mevcut en ucuz ürün** seçilir. Böylece
  en-ucuz-market seçimi, doğal olarak en ucuz markayı barındıran marketi öne çıkarır
  (örn. A101'deki B markası, Migros'taki A markasından ucuzsa A101 kazanır).
- Mevcut `findAlternativeProducts` mantığı (grup içi ürünleri çekme) yeniden kullanılır;
  fark, alternatifi "öneri" yerine **seçilen fiyat** yapmaktır.
- Sonuç şemasına seçilen ürünün **gerçek markası ve adı** eklenir ki sonuç ekranı
  "A101 — B Markası ₺X" gösterebilsin (temsilci ürünün değil, kazanan ürünün markası).

Bu değişiklik geriye dönük uyumludur: `brand_independent` varsayılan `false`, mevcut
listeler aynen çalışır.

## 6. Mobil Tasarım (5a)

### 6.1 Navigasyon

- Alt menüdeki **merkez "+" butonu → Asistan** (parıltı/✨ ikonu, hafif teal glow).
- Liste oluşturma → **`Listelerim` ekranı başlığındaki "+"** butonuna taşınır.
- Yeni `AssistantNavigator` (stack): varsayılan `AssistantChatScreen`; geçmiş, başlıktan
  açılan `ThreadListSheet` (modal/drawer).

### 6.2 `AssistantChatScreen`

```
┌─────────────────────────────────────┐
│ ✨ Asistan          🕘 geçmiş  ✎ yeni│  başlık
├─────────────────────────────────────┤
│  ┌─ Merhaba! Bugün ne pişirelim?    │  asistan balonu (sol, beyaz)
│                  mercimek çorbası ─┐ │  kullanıcı balonu (sağ, teal)
│  ┌─ 🔧 listene bakıyorum...         │  araç-aktivite ipucu (soluk)
│  ┌─ Süt zaten listende var. 1 tane  │
│  │  daha ekleyeyim mi?              │
│  │  ┌──────────────────────────┐    │
│  │  │ 📋 Haftalık Market        │    │  inline aksiyon kartı
│  │  │ +4 ürün · Görüntüle →     │    │
│  │  └──────────────────────────┘    │
├─────────────────────────────────────┤
│ [ Mesaj yaz...            ]    ➤    │  input bar
└─────────────────────────────────────┘
```

### 6.3 Bileşenler

- `MessageBubble` — rol'e göre sol/sağ, teal/beyaz (`src/theme`).
- `ToolActivityChip` — araç çalışırken soluk "🔧 listene bakıyorum..." (tool_calls'tan türetilir).
- `ListActionCard` — asistan liste oluşturunca/değiştirince inline kart → `ListDetail`'e gider.
- `ChatInputBar` — metin + gönder; yanıt beklerken "yazıyor..." göstergesi.
- `ThreadListSheet` — geçmiş sohbetler; satırda **çöp ikonu / swipe** ile silme; "Yeni sohbet".
- **Boş durum:** karşılama balonu + örnek öneri çipleri ("Haftalık liste hazırla",
  "Bütçeme göre sepet", "Tarif ver").

### 6.4 Veri katmanı

`src/api/assistant.ts` (mevcut axios deseni): `getThreads`, `createThread`, `getThread`,
`deleteThread`, `sendMessage`. Mesaj durumu ekran-local; gönderince optimistic ekleme,
yanıt gelince asistan mesajı + olası `ListActionCard` render edilir.

### 6.5 Tema

Fintech teal/beyaz, yumuşak gölgeler; mevcut skeleton/empty-state desenleri yeniden kullanılır.

### 6.6 Marka-bağımsız UI (Faz 5-0)

- **Elle ekleme:** Ürün ekleme satırında küçük bir **"Marka farketmez" toggle**'ı
  (varsayılan **kapalı**). Açıkken öğe muadil-grup moduna geçer; satırda küçük bir
  "en ucuz marka" rozeti gösterilir.
- **Mevcut öğe:** `ListDetail`'de öğeye dokununca aynı toggle ile sonradan açılıp kapatılabilir.
- **Asistanda:** Ayrı toggle yok; asistan kararı verir (5.3). Asistan marka-bağımsız öğe
  eklediğinde `ListActionCard`/mesajda bunu belirtir ("marka farketmez olarak eklendi").
- **Karşılaştırma sonucu:** Marka-bağımsız öğeler için sonuç satırı, temsilci ürünün değil
  **kazanan ürünün markası + adı**nı ve marketini gösterir (örn. "A101 · B Markası Süt 1L ₺X").
  Bir "marka farketmez" etiketi öğenin neden o markette seçildiğini açıklar.

## 7. Test Stratejisi

- **Backend birim testleri (vitest):** agent döngüsü Gemini client mock'lanarak —
  (a) tek-tur metin yanıtı, (b) tool çağrısı → executor → ikinci tur final yanıt,
  (c) maks-tur koruması, (d) thread/mesaj CRUD + user scope (başkasının thread'i 404),
  (e) hard delete cascade.
- **Araç executor testleri:** her araç mevcut servisle doğru sonuç/şekil döndürüyor mu.
- **Profil & onboarding (5-P):** (a) `PUT /profile` oluştur/güncelle + `GET /profile`
  user-scope, (b) alan boşaltma kısıtı kaldırıyor, (c) `onboarding_done` geçişi,
  (d) sistem prompt'a profil enjeksiyonu (sert kısıt asla ihlal edilmiyor — diyet=vegan'da
  et önerilmiyor), (e) kategori-sezgi filtresi (vegan profilde "Et & Tavuk" eleniyor/uyarı).
- **Marka-bağımsız compare (5-0):** (a) `brand_independent` öğede compare grubun en ucuz
  markasını seçiyor (A101/B < Migros/A → A101 kazanır), (b) muadil grubu olmayan tekil
  ürün marka-sabit gibi davranıyor, (c) sonuç şeması kazanan ürünün gerçek marka/adını
  döndürüyor, (d) `brand_independent=false` mevcut davranışı bozmuyor (regresyon).
- **Mobil:** `tsc --noEmit` temiz; Expo web (:8081) + Playwright ile login → Asistan →
  örnek mesaj → liste oluşturma akışı ekran görüntüsüyle doğrulanır.
- Gerçek Gemini çağrısı testlerde yapılmaz (mock); manuel doğrulama gerçek anahtarla yapılır.

## 8. Açık Bağımlılıklar / Riskler

- `GEMINI_API_KEY` kullanıcı tarafından `.env`'e elle eklenecek (kod hazır olacak).
- Free katman rate-limiti yoğun kullanımda darboğaz olabilir → kullanıcı-başı limit + 429 yönetimi.
- Ürün eşleştirme (`add_items_to_list`) mevcut matcher kalitesine bağlı; eşleşmeyince
  asistan kullanıcıya sorar (graceful deg: liste boş kalmaz, kullanıcı yönlendirilir).
- **Marka-bağımsız (5-0)** doğruluğu `muadil_grup_id` kalitesine bağlı: gruplar yanlış/eksikse
  yanlış marka "en ucuz" seçilebilir. Tekil ürünlerde otomatik marka-sabite düşer (güvenli).
  Mevcut matcher zaten markasız fingerprint ile grupluyor; ek gruplama işi gerektirmez.
- **Profil app-geneli filtreleme (5-P)** ürün-düzeyi diyet/alerjen etiketi gerektirir;
  katalogda yok. v1 kategori-sezgisiyle kaba çalışır (yanlış-pozitif/negatif olabilir),
  v2 LLM etiketleme ile incelir. Asistan tarafı etiketlemeye bağlı değil (model çıkarım yapar).
  **Güvenlik:** alerjen filtresi kaba kalırsa kullanıcıya "emin değiliz, etiketi kontrol et"
  uyarısı gösterilir — sessiz "güvenli" iması verilmez.

## 9. Yol Haritası (5b / 5d — bilgi amaçlı)

- **5b Multimodal:** `sendMessage` görsel ek (base64/multipart) kabul eder; Gemini vision
  ile yemek tanıma → tarif → `add_items_to_list`. Mobilde input bar'a kamera/galeri.
- **5d Çok-dil + erişilebilirlik:** app-geneli dil (Türkçe/Kürtçe/Arapça/göçmen dilleri)
  ve a11y (büyük dokunma alanı, font ölçeği, ekran okuyucu, yüksek kontrast).
- **Ürün diyet/alerjen etiketleme (5-P v2):** `llm-product-matcher` ile ürünlere diyet
  (vegan/vejetaryen/helal) ve alerjen etiketleri; profil filtrelemesini kategori-sezgiden
  ince etiketlemeye taşır.

(Not: önceki "5c — kişiselleştirme" fazı 5-P olarak öne çekilip soğuruldu.)
