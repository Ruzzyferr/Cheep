-- Çok-ülke / konum bazlı çok-kiracılık: Country tablosu + stores/products/users.country_id.
-- Mevcut tüm veri "TR" ülkesine backfill edilir.

CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- Başlangıç ülkeleri
INSERT INTO "countries" ("code", "name", "currency") VALUES
    ('TR', 'Türkiye', 'TRY'),
    ('PL', 'Polska', 'PLN');

-- stores.country_id (önce nullable ekle, backfill, sonra NOT NULL + FK)
ALTER TABLE "stores" ADD COLUMN "city" TEXT;
ALTER TABLE "stores" ADD COLUMN "country_id" INTEGER;
UPDATE "stores" SET "country_id" = (SELECT "id" FROM "countries" WHERE "code" = 'TR');
ALTER TABLE "stores" ALTER COLUMN "country_id" SET NOT NULL;
ALTER TABLE "stores" ADD CONSTRAINT "stores_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "stores_country_id_idx" ON "stores"("country_id");

-- products.country_id
ALTER TABLE "products" ADD COLUMN "country_id" INTEGER;
UPDATE "products" SET "country_id" = (SELECT "id" FROM "countries" WHERE "code" = 'TR');
ALTER TABLE "products" ALTER COLUMN "country_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "products_country_id_idx" ON "products"("country_id");

-- users.country_id (opsiyonel)
ALTER TABLE "users" ADD COLUMN "country_id" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_country_id_fkey"
    FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
