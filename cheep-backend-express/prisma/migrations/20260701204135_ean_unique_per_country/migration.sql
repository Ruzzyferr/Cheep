-- DropIndex
DROP INDEX "public"."products_ean_barcode_idx";

-- DropIndex
DROP INDEX "public"."products_ean_barcode_key";

-- CreateIndex
CREATE UNIQUE INDEX "products_country_id_ean_barcode_key" ON "products"("country_id", "ean_barcode");
