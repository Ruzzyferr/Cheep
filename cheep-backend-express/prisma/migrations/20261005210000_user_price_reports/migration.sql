-- Kullanıcı fiyat bildirimi: hukuken bize ait tek fiyat kaynağı.
-- Gerekçe: docs/VERI-IZINLERI.md — TÜBİTAK reddi (5 Eki 2026) ve zincir
-- koşullarındaki kopyalama yasağı.
CREATE TABLE "user_price_reports" (
    "id"          SERIAL       NOT NULL,
    "user_id"     INTEGER      NOT NULL,
    "product_id"  INTEGER      NOT NULL,
    "store_id"    INTEGER      NOT NULL,
    "price"       DECIMAL(10,2) NOT NULL,
    "unit"        TEXT         NOT NULL DEFAULT 'adet',
    "observed_on" DATE         NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"      TEXT         NOT NULL DEFAULT 'active',
    CONSTRAINT "user_price_reports_pkey" PRIMARY KEY ("id")
);

-- Günde bir bildirim: tekrar ederek ağırlık kazanılamaz.
CREATE UNIQUE INDEX "user_price_reports_user_product_store_day_key"
  ON "user_price_reports"("user_id","product_id","store_id","observed_on");
CREATE INDEX "user_price_reports_product_store_idx"
  ON "user_price_reports"("product_id","store_id");
CREATE INDEX "user_price_reports_created_at_idx"
  ON "user_price_reports"("created_at");

ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_price_reports" ADD CONSTRAINT "user_price_reports_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
