-- Uygulama içi iletişim + fiyat düşüşü bildirimleri.

-- ============================================
-- 1) Destek mesajları
-- ============================================
-- Mesaj ÖNCE buraya yazılır, SONRA e-postalanır: e-posta sağlayıcısının geçici
-- bir arızası kullanıcının hata raporunu kaybetmesin. emailed_at NULL kalan
-- satırlar "yazıldı ama gönderilemedi" demektir.
CREATE TABLE "support_messages" (
    "id"           SERIAL       NOT NULL,
    "user_id"      INTEGER,
    "email"        TEXT         NOT NULL,
    "topic"        TEXT         NOT NULL DEFAULT 'other',
    "message"      TEXT         NOT NULL,
    "app_version"  TEXT,
    "platform"     TEXT,
    "os_version"   TEXT,
    "locale"       TEXT,
    "country_code" TEXT,
    "emailed_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_messages_created_at_idx" ON "support_messages"("created_at");
CREATE INDEX "support_messages_user_id_idx" ON "support_messages"("user_id");

-- Kullanıcı silinirse mesaj kalsın (destek geçmişi), sahibi boşalsın.
ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 2) Fiyat düşüşleri
-- ============================================
-- Ürün başına (mağaza başına DEĞİL): kullanıcıyı ilgilendiren sinyal "bu ürün
-- ucuzladı". store_id yalnızca yeni en ucuz fiyatın hangi markette olduğunu söyler.
CREATE TABLE "price_drops" (
    "id"         SERIAL         NOT NULL,
    "user_id"    INTEGER        NOT NULL,
    "product_id" INTEGER        NOT NULL,
    "country_id" INTEGER        NOT NULL,
    "store_id"   INTEGER        NOT NULL,
    "old_price"  DECIMAL(10,2)  NOT NULL,
    "new_price"  DECIMAL(10,2)  NOT NULL,
    "drop_pct"   DOUBLE PRECISION NOT NULL,
    "read_at"    TIMESTAMP(3),
    -- Tekillik için ayrı GÜN alanı: created_at tam zaman damgası olduğundan
    -- (user, product, created_at) kısıtı aynı gün içinde tekrarı engellemezdi.
    "dropped_on" DATE           NOT NULL,
    "created_at" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_drops_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_drops_user_id_product_id_dropped_on_key"
  ON "price_drops"("user_id", "product_id", "dropped_on");
CREATE INDEX "price_drops_user_id_read_at_idx" ON "price_drops"("user_id", "read_at");
CREATE INDEX "price_drops_created_at_idx" ON "price_drops"("created_at");

ALTER TABLE "price_drops" ADD CONSTRAINT "price_drops_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_drops" ADD CONSTRAINT "price_drops_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_drops" ADD CONSTRAINT "price_drops_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_drops" ADD CONSTRAINT "price_drops_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 3) Cihaz push token'ları
-- ============================================
CREATE TABLE "user_push_tokens" (
    "id"         SERIAL       NOT NULL,
    "user_id"    INTEGER      NOT NULL,
    "token"      TEXT         NOT NULL,
    "platform"   TEXT         NOT NULL DEFAULT 'android',
    "locale"     TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_push_tokens_token_key" ON "user_push_tokens"("token");
CREATE INDEX "user_push_tokens_user_id_idx" ON "user_push_tokens"("user_id");

ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
