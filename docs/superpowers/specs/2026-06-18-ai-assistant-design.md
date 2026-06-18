# Cheep AI Asistanı — Tasarım Dokümanı (Faz 5)

**Tarih:** 2026-06-18
**Durum:** Onaylı tasarım — uygulama 5a ile başlar
**Sağlayıcı:** Google Gemini (`gemini-2.0-flash`) via `@google/generative-ai`

## 1. Amaç ve Vizyon

Cheep'e **tek bir agentic (araç-çağıran) sohbet asistanı** eklemek. Kullanıcı doğal dille
konuşur; asistan kullanıcının listelerine, ürün kataloğuna, fiyatlara ve en-ucuz-rota
mantığına araçlarla erişerek alışveriş listeleri ve yemek planları oluşturur, düzenler ve
açıklar. Asistan üç ayrı özellik değil; tarif→liste, bütçe sepeti ve haftalık plan bu tek
asistanın **araçlar üzerinden ortaya çıkan (emergent) yetenekleridir**.

Hedef kitle geniştir (öğrenci, yurtta kalan, yaşlı; farklı ülkeler). Asistan kullanıcının
**ülkesine** (mevcut `Country` modeli) ve ileride demografik kesimine göre uygun yemekler
önerir, proaktif olarak clarifying-question sorar.

## 2. Kapsam ve Fazlama

Mimarinin tamamı bu spec'te belgelenir; uygulama fazlara bölünür. **writing-plans önce
5a için plan çıkarır.**

| Faz | İçerik | Kapsadığı kullanıcı istekleri |
|---|---|---|
| **5a — Agentic sohbet çekirdeği (metin)** | Tool-calling agent + thread persistence (silinebilir) + araçlar (liste oku/oluştur/ekle/çıkar, ürün/fiyat ara, en ucuz rota) + clarifying-question akışı + mobil chat ekranı | tarif→liste, haftalık plan, bütçe sepeti, "zaten listende var, kalsın mı?" diyaloğu |
| **5b — Multimodal** | Görsel girdi: yemek fotoğrafı → yemeği tanı → tarif → liste | Instagram SS → liste |
| **5c — Kişiselleştirme hafızası** | Tercih profili (sevdiği/sevmediği, diyet, demografik kesim, ülke-mutfak) → sistem prompt'unu besler | kesime/ülkeye özel öneri, "her gün ne pişirirsin" |

5a çekirdeği oturunca 5b ve 5c üstüne biner. **Bu doküman ve ilk implementasyon planı yalnızca 5a'yı bağlar; 5b/5c yol haritası olarak burada durur, ayrı spec gerektirmeden plan aşamasında detaylandırılabilir.**

## 3. Sağlayıcı ve Maliyet

- **Model:** `gemini-2.0-flash` — tool-calling (5a) ve vision (5b) destekler, ücretsiz katmanı var.
- **SDK:** `@google/generative-ai` (backend).
- **Anahtar:** Yalnızca `process.env.GEMINI_API_KEY` üzerinden okunur. Gerçek anahtar
  `cheep-backend-express/.env` (gitignore'lu) içinde, repoya **asla** yazılmaz.
  `.env.example`'a `GEMINI_API_KEY=` placeholder eklenir.
- **Limit:** Free katman ~15 istek/dk. Kullanıcı başına rate-limit uygulanır (mevcut
  middleware deseni). Gemini 429 dönerse kullanıcıya zarif hata mesajı gösterilir.
- **Model adı env'den geçersiz kılınabilir:** `GEMINI_MODEL` (varsayılan `gemini-2.0-flash`).

## 4. Backend Tasarımı (5a)

### 4.1 Modül yapısı

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

### 4.2 Veri modeli (Prisma — yeni migration)

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

### 4.3 Araç seti (function-calling)

Tüm araçlar **in-process** olarak mevcut servisleri çağırır (HTTP değil). Her araç
`user_id` ile scope'lanır; bir kullanıcı başkasının listesine erişemez.

| Araç | Parametreler | Ne yapar | Kaynak servis |
|---|---|---|---|
| `search_products` | `query: string, limit?: number` | Katalogda ürün arar | `products.service` |
| `get_user_lists` | — | Kullanıcının listeleri | `lists.service` |
| `get_list_items` | `listId: number` | Listedeki ürünler (miktar/birim) | `lists.service` |
| `create_list` | `name: string, budget?: number` | Yeni liste açar | `lists.service` |
| `add_items_to_list` | `listId: number, items: {query,quantity?,unit?}[]` | Ürün(ler) ekler (matcher ile eşleştirir) | `lists.service` + product matcher |
| `remove_list_item` | `listId: number, itemId: number` | Ürün çıkarır | `lists.service` |
| `get_product_prices` | `productId: number` | Marketlere göre fiyat | `store-prices.service` |
| `get_cheapest_route` | `listId: number` | En ucuz rota karşılaştırması | `lists-compare` |

`add_items_to_list`, serbest metin ürün adını (örn. "kırmızı mercimek") mevcut ürün
eşleştirme mantığıyla katalog ürününe bağlar; eşleşme bulunamazsa araç sonucu bunu
bildirir ve model kullanıcıya sorar.

### 4.4 Agent döngüsü (`assistant.service.ts`)

1. `POST /assistant/threads/:id/messages { content }` (thread yoksa önce `POST /assistant/threads`).
2. Thread geçmişi (mesajlar) Gemini `contents` formatına dönüştürülür.
3. Sistem prompt + araç tanımlarıyla `gemini-2.0-flash` çağrılır.
4. Model `functionCall` döndürürse → ilgili executor çalıştırılır (user_id scope'lu) →
   sonuç `functionResponse` olarak eklenir → döngü tekrar.
5. **Maksimum 6 tur** (sonsuz döngü koruması); aşılırsa son metinle güvenli kapanış.
6. Final metin yanıtı → kullanıcı mesajı + asistan mesajı (varsa tool_calls JSON'u ile)
   DB'ye kaydedilir → controller yanıtı döndürür.
7. Thread `title` boşsa ilk kullanıcı mesajından kısa bir başlık üretilir.

### 4.5 Sistem prompt (5a)

İçerir: Cheep asistan personası; **ülke-farkında** davranış (kullanıcının `Country`'sine
göre mutfak/ürün); proaktif clarifying-question talimatı ("listede zaten varsa sor",
"haftalık plan isteniyorsa sevdiği/sevmediği ve günleri sor"); araçların ne zaman
çağrılacağı; bugünün tarihi. (Demografik kişiselleştirme 5c'de zenginleşir.)

### 4.6 Rotalar

```
GET    /assistant/threads               # geçmiş sohbet listesi (başlık + son güncelleme)
POST   /assistant/threads               # yeni thread
GET    /assistant/threads/:id           # thread + mesajlar
DELETE /assistant/threads/:id           # sohbeti sil (hard, cascade)
POST   /assistant/threads/:id/messages  # mesaj gönder → agent yanıtı
```

Hepsi auth (JWT) gerektirir; thread'ler `user_id` ile scope'lanır (başkasının thread'ine
erişim 404).

### 4.7 Akış tipi, hata, limit

- **Streaming yok** (5a): istek/yanıt + mobilde "yazıyor..." göstergesi. SSE streaming 5b+ notu.
- **Hata:** Gemini hatası/timeout → 502 + kullanıcı dostu mesaj; kısmi tool sonuçları
  kaybolmaz (mesaj kaydı tutarlı bırakılır).
- **Rate-limit:** kullanıcı başına; 429 zarif yönetilir.

## 5. Mobil Tasarım (5a)

### 5.1 Navigasyon

- Alt menüdeki **merkez "+" butonu → Asistan** (parıltı/✨ ikonu, hafif teal glow).
- Liste oluşturma → **`Listelerim` ekranı başlığındaki "+"** butonuna taşınır.
- Yeni `AssistantNavigator` (stack): varsayılan `AssistantChatScreen`; geçmiş, başlıktan
  açılan `ThreadListSheet` (modal/drawer).

### 5.2 `AssistantChatScreen`

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

### 5.3 Bileşenler

- `MessageBubble` — rol'e göre sol/sağ, teal/beyaz (`src/theme`).
- `ToolActivityChip` — araç çalışırken soluk "🔧 listene bakıyorum..." (tool_calls'tan türetilir).
- `ListActionCard` — asistan liste oluşturunca/değiştirince inline kart → `ListDetail`'e gider.
- `ChatInputBar` — metin + gönder; yanıt beklerken "yazıyor..." göstergesi.
- `ThreadListSheet` — geçmiş sohbetler; satırda **çöp ikonu / swipe** ile silme; "Yeni sohbet".
- **Boş durum:** karşılama balonu + örnek öneri çipleri ("Haftalık liste hazırla",
  "Bütçeme göre sepet", "Tarif ver").

### 5.4 Veri katmanı

`src/api/assistant.ts` (mevcut axios deseni): `getThreads`, `createThread`, `getThread`,
`deleteThread`, `sendMessage`. Mesaj durumu ekran-local; gönderince optimistic ekleme,
yanıt gelince asistan mesajı + olası `ListActionCard` render edilir.

### 5.5 Tema

Fintech teal/beyaz, yumuşak gölgeler; mevcut skeleton/empty-state desenleri yeniden kullanılır.

## 6. Test Stratejisi

- **Backend birim testleri (vitest):** agent döngüsü Gemini client mock'lanarak —
  (a) tek-tur metin yanıtı, (b) tool çağrısı → executor → ikinci tur final yanıt,
  (c) maks-tur koruması, (d) thread/mesaj CRUD + user scope (başkasının thread'i 404),
  (e) hard delete cascade.
- **Araç executor testleri:** her araç mevcut servisle doğru sonuç/şekil döndürüyor mu.
- **Mobil:** `tsc --noEmit` temiz; Expo web (:8081) + Playwright ile login → Asistan →
  örnek mesaj → liste oluşturma akışı ekran görüntüsüyle doğrulanır.
- Gerçek Gemini çağrısı testlerde yapılmaz (mock); manuel doğrulama gerçek anahtarla yapılır.

## 7. Açık Bağımlılıklar / Riskler

- `GEMINI_API_KEY` kullanıcı tarafından `.env`'e elle eklenecek (kod hazır olacak).
- Free katman rate-limiti yoğun kullanımda darboğaz olabilir → kullanıcı-başı limit + 429 yönetimi.
- Ürün eşleştirme (`add_items_to_list`) mevcut matcher kalitesine bağlı; eşleşmeyince
  asistan kullanıcıya sorar (graceful deg: liste boş kalmaz, kullanıcı yönlendirilir).

## 8. Yol Haritası (5b / 5c — bilgi amaçlı)

- **5b Multimodal:** `sendMessage` görsel ek (base64/multipart) kabul eder; Gemini vision
  ile yemek tanıma → tarif → `add_items_to_list`. Mobilde input bar'a kamera/galeri.
- **5c Kişiselleştirme:** `UserPreference` modeli (sevdiği/sevmediği, diyet, demografik
  kesim, mutfak); sistem prompt'a enjekte edilir; asistan onboarding'de proaktif sorar.
