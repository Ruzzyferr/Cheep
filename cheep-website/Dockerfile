# Cheep website — Vite SPA'yı derle, Caddy ile (SPA fallback) servis et.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm install (npm ci değil): platforma özgü optional dep'ler (Tailwind v4 oxide'ın
# @emnapi wasm bağımlılıkları) Windows'ta üretilen lockfile'da olmadığından, linux
# build'inde ci "out of sync" verir. install doğru platform paketlerini çözer.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
