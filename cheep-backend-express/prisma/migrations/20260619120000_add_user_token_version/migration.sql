-- Refresh token iptali (revocation): kullanıcı başına sürüm sayacı.
-- Logout / parola değişiminde +1 artırılır; eski tv taşıyan refresh token'lar geçersiz olur.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
