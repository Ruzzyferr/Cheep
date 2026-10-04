-- "Marka önemsemiyorum" ikamesi için ayrı grup alanı.
-- muadil_grup_id'ye YAZILMIYOR: o alan ürün birleştirme anahtarı; markalar
-- arası ortak değer yazılsaydı farklı markalar tek ürüne çökerdi.
ALTER TABLE "products" ADD COLUMN "jenerik_grup_id" TEXT;
CREATE INDEX "products_jenerik_grup_id_idx" ON "products"("jenerik_grup_id");
