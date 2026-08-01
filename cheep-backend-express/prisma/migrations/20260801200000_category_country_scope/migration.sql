-- Kategori taksonomisini ÜLKEYE BAĞLA.
--
-- Neden: `categories` ülkesizdi ve `slug` global @unique idi. TR (devletin
-- marketfiyati verisinden türetilen ağaç) ile PL (scraper'ın kendi ağacı) tek
-- ağaca sıkışınca ikiz kategoriler ve ölü kabuklar üredi.
--
-- Bu migration YALNIZCA kolonu ekler ve kabaca doldurur; gerçek ayrıştırma
-- (çok ülkeli kategorilerin bölünmesi, TR yapraklarının devlet ağacına geri
-- konması, ürünsüz kategorilerin silinmesi) `scripts/reconcile-taxonomy.ts`
-- işidir. Buradaki doldurma sadece NOT NULL kısıtını mümkün kılar.

-- 1) Kolonu NULL kabul ederek ekle.
ALTER TABLE "categories" ADD COLUMN "country_id" INTEGER;

-- 2) Her kategoriye, ALT AĞACINDAKİ ürünlerin çoğunluk ülkesini ata.
--    depth guard (< 6): şema parent döngüsünü engellemiyor; bozuk tek bir satır
--    migration'ı sonsuz döngüde asmamalı. Gerçek ağaç 2 seviye.
WITH RECURSIVE tree(root_id, id, depth) AS (
    SELECT id, id, 0 FROM "categories"
  UNION ALL
    SELECT t.root_id, c.id, t.depth + 1
    FROM "categories" c
    JOIN tree t ON c.parent_id = t.id
    WHERE t.depth < 6
),
counts AS (
    SELECT t.root_id, p.country_id, COUNT(*) AS n
    FROM tree t
    JOIN "products" p ON p.category_id = t.id
    GROUP BY t.root_id, p.country_id
),
best AS (
    -- Eşitlikte küçük country_id kazanır: sonuç tekrarlanabilir olsun.
    SELECT DISTINCT ON (root_id) root_id, country_id
    FROM counts
    ORDER BY root_id, n DESC, country_id ASC
)
UPDATE "categories" c
SET "country_id" = b.country_id
FROM best b
WHERE c.id = b.root_id;

-- 3) Hiç ürünü olmayan kategoriler: TR'ye ata. Bunlar zaten reconcile
--    adımında silinecek; buradaki değer yalnızca NOT NULL'ı mümkün kılıyor.
UPDATE "categories"
SET "country_id" = (SELECT id FROM "countries" WHERE code = 'TR')
WHERE "country_id" IS NULL;

-- 4) Ülkesi olmayan bir kategori kalmadıysa kolonu zorunlu yap.
ALTER TABLE "categories" ALTER COLUMN "country_id" SET NOT NULL;

-- 5) Global slug benzersizliğini kaldır, ülke başına benzersizliğe geç.
--    Asıl yapısal düzeltme bu: aynı slug iki ülkede yan yana var olabilir.
DROP INDEX IF EXISTS "categories_slug_key";
DROP INDEX IF EXISTS "categories_slug_idx";

-- Çakışan slug'lar aynı ülkede kalmışsa unique index kurulamaz. Böyle bir
-- durumda migration burada patlar — sessizce veri kaybetmektense durmak doğru.
CREATE UNIQUE INDEX "categories_country_id_slug_key" ON "categories"("country_id", "slug");
CREATE INDEX "categories_country_id_parent_id_idx" ON "categories"("country_id", "parent_id");

-- 6) Yabancı anahtar.
ALTER TABLE "categories"
    ADD CONSTRAINT "categories_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
