-- Fiyat geçmişi (zaman serisi) tablosu: her fiyat değişiminde bir kayıt eklenir.

CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_history_product_id_recorded_at_idx" ON "price_history"("product_id", "recorded_at");
CREATE INDEX "price_history_store_id_product_id_idx" ON "price_history"("store_id", "product_id");

ALTER TABLE "price_history" ADD CONSTRAINT "price_history_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
