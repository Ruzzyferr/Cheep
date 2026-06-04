-- price_feedbacks tablosunu uygulama kontratına hizala (boolean doğruluk modeli).
-- Önceki şema enum (feedback_type) + reported_price kullanıyordu; uygulama katmanı
-- (Joi şeması, controller, servis, mobil) is_accurate + suggested_price + comment bekliyor.

-- Enum tabanlı sütunları kaldır
ALTER TABLE "price_feedbacks" DROP COLUMN "feedback_type";
ALTER TABLE "price_feedbacks" DROP COLUMN "reported_price";

-- Boolean tabanlı sütunları ekle
ALTER TABLE "price_feedbacks" ADD COLUMN "is_accurate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "price_feedbacks" ADD COLUMN "suggested_price" DECIMAL(10,2);
ALTER TABLE "price_feedbacks" ADD COLUMN "comment" TEXT;

-- Geçici default'u kaldır (sütun NOT NULL kalır)
ALTER TABLE "price_feedbacks" ALTER COLUMN "is_accurate" DROP DEFAULT;

-- Artık kullanılmayan enum tipini kaldır
DROP TYPE "FeedbackType";
