-- SEO sayfaları için kalıcı URL slug'ları.
--
-- Kolonlar NULL kabul ederek ekleniyor: mevcut satırlar backfill script'iyle
-- (scripts/backfill-slugs.ts) dolduruluyor. NOT NULL yapmıyoruz çünkü yeni
-- ürünler ingest sırasında slug'sız geliyor ve gecelik build onları atlıyor —
-- eksik slug bir hata değil, "henüz sayfası yok" demek.
--
-- Benzersizlik ÜLKE BAZINDA: aynı ürün adı TR ve PL'de ayrı sayfalar.
-- Postgres'te UNIQUE indeks birden çok NULL'a izin verir, o yüzden backfill
-- öncesinde de güvenli.

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "stores"   ADD COLUMN IF NOT EXISTS "slug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "products_country_id_slug_key"
    ON "products" ("country_id", "slug");

CREATE UNIQUE INDEX IF NOT EXISTS "stores_country_id_slug_key"
    ON "stores" ("country_id", "slug");

-- Build sırasında "slug'ı olan ürünler" sorgusu bu indeksi kullanır.
CREATE INDEX IF NOT EXISTS "products_slug_idx" ON "products" ("slug");
