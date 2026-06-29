-- Mağaza online market / sepet bağlantısı
ALTER TABLE "stores" ADD COLUMN "website_url" TEXT;

-- Affiliate tıklama takibi
CREATE TABLE "affiliate_clicks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "list_id" INTEGER,
    "product_id" INTEGER,
    "context" TEXT NOT NULL DEFAULT 'store',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_clicks_user_id_idx" ON "affiliate_clicks"("user_id");
CREATE INDEX "affiliate_clicks_store_id_idx" ON "affiliate_clicks"("store_id");
CREATE INDEX "affiliate_clicks_created_at_idx" ON "affiliate_clicks"("created_at");

ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
