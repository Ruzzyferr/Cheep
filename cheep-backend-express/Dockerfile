# Cheep Backend — production image
# Tek aşamalı, sağlam kurulum (test sunucusu için). Prisma + tsx (seed) çalışsın
# diye dev bağımlılıkları da imajda tutulur.
FROM node:20-slim

WORKDIR /app

# Prisma engine'leri için OpenSSL gerekli
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# pnpm (corepack ile)
RUN corepack enable

# Bağımlılıklar (lockfile ile deterministik)
#
# `pnpm-workspace.yaml` DA kopyalanmalı: pnpm 10 `overrides` bloğunu orada
# tutuyor (package.json'da değil) ve `pnpm-lock.yaml` bu override'ları kendi
# içine yazıyor. Dosya imaja girmezse `--frozen-lockfile` iki tarafı
# karşılaştırıp ERR_PNPM_LOCKFILE_CONFIG_MISMATCH ile düşüyor.
#
# Bu tam olarak yaşandı: override dosyası CI'ı düzeltmek için depoya eklendi
# ama buraya eklenmedi; o günden itibaren `deploy.sh` her çalıştırmada
# derleme aşamasında kırıldı. Kimse deploy etmediği için fark edilmedi —
# yani üretim, deploy yolu bozukken sessizce eski imajla çalışıyordu.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Kaynak + Prisma client üretimi + TypeScript derleme
# Not: `pnpm build` script'i rimraf'a bağlı; imajda olmayabilir → doğrudan tsc kullan.
COPY . .
RUN pnpm db:generate && rm -rf dist && pnpm exec tsc

ENV NODE_ENV=production
EXPOSE 3000

# Açılışta migration'ları uygula, sonra sunucuyu başlat
CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]
