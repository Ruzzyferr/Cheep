-- E-posta doğrulama alanları
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verification_code" TEXT;
ALTER TABLE "users" ADD COLUMN "email_verification_expires" TIMESTAMP(3);

-- Mevcut kullanıcılar doğrulanmış sayılır (yeni zorunlulukla kilitlenmesinler)
UPDATE "users" SET "email_verified" = true;
