-- Aynı kullanıcı bir fiyat için yalnızca tek feedback verebilsin (yarış/duplicate önleme).
-- Not: Mevcut duplicate satırlar varsa bu index başarısız olur; gerekirse önce temizleyin.
CREATE UNIQUE INDEX "price_feedbacks_user_id_store_price_id_key" ON "price_feedbacks"("user_id", "store_price_id");
