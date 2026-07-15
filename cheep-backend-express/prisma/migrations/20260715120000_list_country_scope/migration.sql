-- Listeleri ülkeye bağla: her liste OLUŞTURULDUĞU ülkeye aittir ve yalnızca o
-- ülkedeyken görünür (Türkiye listeleri Polonya'da görünmemeli, ve tersi).

-- 1) Kolonu önce NULL kabul ederek ekle (mevcut satırlar için değer yok).
ALTER TABLE "lists" ADD COLUMN "country_id" INTEGER;

-- 2) Mevcut tüm listeleri geriye dönük Türkiye'ye ata. Prod PL lansmanından önce
--    TR-only'ydi, dolayısıyla tüm eski listeler TR. TR yoksa (teorik) en küçük
--    country id'ye düş — SET NOT NULL'ın patlamasını önler. Liste olan her ortamda
--    countries dolu olduğundan bu daima bir değer bulur; liste yoksa 0 satır etkilenir.
UPDATE "lists"
SET "country_id" = COALESCE(
  (SELECT "id" FROM "countries" WHERE "code" = 'TR' LIMIT 1),
  (SELECT MIN("id") FROM "countries")
)
WHERE "country_id" IS NULL;

-- 3) Artık zorunlu.
ALTER TABLE "lists" ALTER COLUMN "country_id" SET NOT NULL;

-- 4) Index + FK.
CREATE INDEX "lists_country_id_idx" ON "lists"("country_id");
ALTER TABLE "lists" ADD CONSTRAINT "lists_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
