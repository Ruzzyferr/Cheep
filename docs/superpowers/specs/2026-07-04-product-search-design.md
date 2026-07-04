# Akıllı Ürün Arama — Tasarım Spec'i

**Tarih:** 2026-07-04
**Durum:** Onaylandı, implementation plan bekliyor

## 1. Problem

Kullanıcılar akıllarındaki ürünü bulmak için kategorileri elle geziyor ("saatlerce
gezip aradığımı bulamıyorum"). Uygulamada gerçek bir arama deneyimi yok.

**Mevcut durumun keşfi:**
- Backend'de arama **var ama basit**: `getAllProducts({ search })` → ham SQL
  `ILIKE '%kelime%'` (name/brand/ean_barcode), market sayısına göre sıralı. Substring
  eşleşmesi; yazım hatası toleransı yok, çok-kelime düzgün çalışmaz, Türkçe karakter
  (İ/ı/ş/ğ) sorunlu.
- Mobilde `SearchBar` bileşeni yazılmış ama **hiçbir yerde kullanılmıyor**. Özel arama
  ekranı yok, navigasyonda arama rotası yok.
- Home'daki büyüteç ikonu (`goSearch`) → içinde arama kutusu bile olmayan "tüm ürünler"
  listesine (`CategoryProducts`, categoryId 0) götürüyor.

## 2. Hedef

Büyütece basınca açılan, **yazdıkça anında sonuç** veren, her sonuçtan **tek dokunuşla
aktif listeye ekleyebilen** bir arama ekranı. Arka planda **yazım hatası + Türkçe karakter
toleranslı**, alaka sıralamalı bir arama motoru.

**Başarı ölçütü:** "süt", "sut", "yogrut", "yağsız süt", "kıyma" gibi sorgular birkaç
harf sonra doğru ürünü ilk sıralarda getirir; kullanıcı arama ekranından çıkmadan
listesini saniyeler içinde kurar.

## 3. Motor kararı: Postgres pg_trgm + unaccent (Elasticsearch DEĞİL)

**Neden ES değil:** Droplet toplam 1.9 GB RAM (çoğu Postgres+backend+website+Caddy'de
dolu). Elasticsearch tek başına ~1GB+ JVM heap ister → sığmaz / daha büyük (pahalı)
sunucu + indeksleme hattı + ops yükü gerektirir. 16k ürün için fazlasıyla iddia.

**Seçilen:** Postgres'in yerleşik `pg_trgm` (trigram benzerliği → yazım hatası toleransı,
alaka skoru) + `unaccent` (aksan/Türkçe karakter normalizasyonu) eklentileri. Yeni servis
yok, mevcut Postgres'e tek migration, 16k satırda GIN indeksiyle <50ms.

## 4. Mimari

### 4.1 Backend — akıllı arama

**Migration (yeni Prisma migration, `prisma/migrations/`, raw SQL):**
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- `CREATE EXTENSION IF NOT EXISTS unaccent;`
- IMMUTABLE normalizasyon fonksiyonu (unaccent varsayılan olarak IMMUTABLE değil; indeks
  için sarmalamak gerekir):
  ```sql
  CREATE OR REPLACE FUNCTION cheep_normalize(txt text)
  RETURNS text AS $$
    SELECT lower(translate(
      unaccent('unaccent', coalesce(txt, '')),
      'İIı', 'iii'   -- Türkçe noktalı/noktasız i → i
    ));
  $$ LANGUAGE sql IMMUTABLE;
  ```
- GIN trigram indeksleri:
  ```sql
  CREATE INDEX products_name_trgm ON products USING gin (cheep_normalize(name) gin_trgm_ops);
  CREATE INDEX products_brand_trgm ON products USING gin (cheep_normalize(brand) gin_trgm_ops);
  ```

**Sorgu (products.service.ts `search` dalını yükselt):**
- Sorguyu da `cheep_normalize` ile normalize et.
- **Çok kelime:** sorguyu token'lara böl; her token normalize edilmiş `name`/`brand`
  içinde eşleşmeli (AND). Böylece "yağsız süt" → "Süt Yağsız 1L".
- **Alaka sıralaması** (ORDER BY):
  1. Tam/prefix substring eşleşmesi (boost)
  2. `similarity(cheep_normalize(name), q)` (yazım hatası toleransı)
  3. `store_count DESC` (popülerlik, tiebreak)
  4. `min_price ASC`
- **Eşik:** `similarity() > 0.2` (veya `pg_trgm.word_similarity`), böylece "yogrut" →
  "yoğurt" bulunur ama alakasız çöp gelmez. Kısa sorgularda (1 harf) substring'e düş.
- **Barkod:** tamamen rakamsa `ean_barcode` tam/prefix eşleşme yolu korunur.
- Dönüş şekli değişmez (products + store_count + min_price); yalnızca sıralama arama
  varken alaka-öncelikli olur, arama yokken mevcut popülerlik sıralaması kalır.

**Endpoint:** mevcut `GET /products?search=&countryId=` yeniden kullanılır (zaten
`getAllProducts`'a bağlı). Yeni endpoint gerekmez.

### 4.2 Mobil — arama ekranı

**Yeni `SearchScreen` (`src/screens/search/SearchScreen.tsx`):**
- Home büyüteci (`goSearch`) → `CategoryProducts` yerine yeni `Search` rotasına gider.
- Üstte mevcut `SearchBar` bileşeni, autofocus.
- **Yazdıkça arama:** ~250ms debounce; her değişimde `productService.getProducts({ search, limit })`.
  Eski istekleri iptal/yoksay (compare ekranındaki `alive` bayrağı deseni).
- **Sonuç satırı:** ürün adı, marka, en ucuz fiyat + market sayısı rozeti, sağda **"+"**
  → aktif listeye ekle:
  - `useCart().activeList` yoksa: sessizce varsayılan bir aktif liste oluştur
    (ör. "Alışveriş Listem"), sonra ekle — sürtünmesiz (aktif liste yokken sormaya gerek
    yok; "aktif liste mevcut" uyarısı yalnızca zaten varken yeni oluşturmada geçerli).
  - `listService.addItem(activeList.id, { product_id })` → `CartContext.refresh()` →
    haptik + "Listene eklendi" toast. Satır kısa süre "eklendi ✓" gösterir.
- **Durumlar:** boş sorgu → son aramalar (chip'ler); sonuç yok → "'{q}' için ürün
  bulunamadı"; yükleniyor → inline spinner.
- **Son aramalar:** AsyncStorage'da son 5 sorgu; boş durumda chip olarak; dokununca
  sorguyu doldurur. (Basit, düşük maliyetli — dahil.)

**Navigasyon:** ilgili stack'e (Home stack) `Search` rotası eklenir. Ürüne uzun dokunma
/ isim dokunma → mevcut `ProductDetail`'e gidebilir (ikincil).

**i18n:** placeholder, "bulunamadı", "listene eklendi", "son aramalar", "liste oluştur"
→ tr/en/de/pl/sv.

## 5. Veri akışı

```
kullanıcı yazar
  → 250ms debounce
  → GET /products?search=q&countryId=X  (stale istek iptal)
  → cheep_normalize(q) + token AND + trigram similarity + GIN indeks
  → alaka-sıralı sonuçlar (name, brand, min_price, store_count)
  → liste render
  → "+" dokunuş
  → listService.addItem(activeList.id, { product_id })
  → CartContext.refresh() + haptik + toast
```

## 6. Kenar durumlar

- **Türkçe karakter:** "sut"→"süt", "kiyma"→"kıyma", "yumurta", "ıhlamur". `cheep_normalize`
  ile çift yönlü.
- **Yazım hatası:** "yogrut"→"yoğurt", "peynr"→"peynir". Trigram similarity.
- **Boş / çok kısa sorgu:** boşsa istek atma (son aramalar göster); 1 harfte substring'e düş.
- **Aktif liste yok:** ilk "+"da liste oluştur-veya-sor.
- **Perf:** 16k satır + GIN trgm indeks → `EXPLAIN ANALYZE` ile <50ms doğrula.
- **Ülke scope:** `countryId` filtresi korunur (mevcut çok-ülke davranışı).

## 7. Test

- **Backend (vitest):** normalize fonksiyonu (Türkçe/aksan), yazım hatası eşleşmesi,
  çok-kelime AND, alaka sıralaması (popüler ürün üstte), barkod yolu, eşik altı çöp
  gelmemesi. Gerçek prod-ayna DB'ye (lokal, 16k ürün) karşı doğrula + `EXPLAIN`.
- **Mobil:** `tsc` temiz; gerçek veriyle yazdıkça-arama + listeye-ekle akışı manuel deneme.

## 8. Sınırlar (YAGNI)

- Eş-anlamlı/synonym sözlüğü yok.
- Arama analitiği / trend yok.
- Ayrı autocomplete öneri dropdown'u yok (sonuç listesi zaten canlı geri bildirim).
- Sesli arama / barkod-kamera tarama yok (ileride ayrı iş).

## 9. Yayınlama

- Backend: migration + sorgu → `deploy.sh` (git reset + docker compose build). Migration
  prod'da `prisma migrate deploy` ile uygulanır (eklentiler + indeks).
- Mobil: yeni ekran → v1.0.4 APK/AAB rebuild.
