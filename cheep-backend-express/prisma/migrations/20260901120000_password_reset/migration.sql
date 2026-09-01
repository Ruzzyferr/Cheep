-- Parola sıfırlama ("şifremi unuttum") alanları.
--
-- Üçü de NULL/0 varsayılanlı: mevcut satırlar dokunulmadan geçerli kalır,
-- kilit süresi tabloyu tararken değil yalnızca katalog güncellenirken tutulur.
ALTER TABLE "users" ADD COLUMN "password_reset_code" TEXT;
ALTER TABLE "users" ADD COLUMN "password_reset_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "password_reset_attempts" INTEGER NOT NULL DEFAULT 0;
