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
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Kaynak + Prisma client üretimi + TypeScript derleme
# Not: `pnpm build` script'i rimraf'a bağlı; imajda olmayabilir → doğrudan tsc kullan.
COPY . .
RUN pnpm db:generate && rm -rf dist && pnpm exec tsc

ENV NODE_ENV=production
EXPOSE 3000

# Açılışta migration'ları uygula, sonra sunucuyu başlat
CMD ["sh", "-c", "pnpm db:migrate:deploy && node dist/index.js"]
