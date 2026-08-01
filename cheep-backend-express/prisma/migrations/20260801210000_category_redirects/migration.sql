-- Ölü kategorilerin eski slug'ları → hayatta kalan karşılıkları.
--
-- Neden: taksonomi birleştirmesi ikiz kategorileri siliyor
-- (`meyve-ve-sebze` → `meyve-sebze`). Bu slug'lar website'de yayında;
-- yönlendirme olmadan silmek yayındaki URL'leri kırar ve birikmiş sıralamayı
-- yakar. Site üretimi bu tablodan 301 kuralları türetir.
CREATE TABLE "category_redirects" (
    "id"         SERIAL PRIMARY KEY,
    "country_id" INTEGER NOT NULL,
    "old_slug"   TEXT NOT NULL,
    "new_slug"   TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "category_redirects_country_id_old_slug_key"
    ON "category_redirects"("country_id", "old_slug");

ALTER TABLE "category_redirects"
    ADD CONSTRAINT "category_redirects_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
