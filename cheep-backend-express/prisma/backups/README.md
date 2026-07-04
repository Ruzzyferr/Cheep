# store_branches yedeği (market şube konumları)

`store_branches.sql.gz` — prod DB'deki `store_branches` tablosunun **veri-only** dökümü
(`pg_dump --table=store_branches --data-only`, COPY formatı, gzip).

## Neden bu yedek önemli?

Bu 10.247 şube kaydı **Geofabrik Türkiye OSM ekstresinden** (`.osm.pbf`, 608MB) tek-seferlik
`countries/turkey/osm_pbf_branches.py` ile çıkarıldı. Fiyat/ürün verisi devletten
(marketfiyati.org.tr) gelir; ama devlet API'si konumdan bağımsız tek temsili depo döndüğü
için **şube konumları oradan alınamaz**. Bu yüzden mesafe feature'ının tek veri kaynağı OSM'dir.
Kaybolursa tekrar 608MB indirip PBF taraması gerekir → bu dosya o zahmeti önler.

İçerik public OSM verisidir (mağaza konumları) — sır içermez, repoda tutmak güvenlidir.

## Zincir dağılımı (yedek anındaki)

A101 3067 · BİM 3030 · ŞOK 2237 · Migros 1321 · CarrefourSA 399 · Tarım Kredi 193 = **10.247**

## Geri yükleme

Lokal dev DB'ye (docker cheep-postgres:5434, user `postgres`):

```bash
gzip -dc prisma/backups/store_branches.sql.gz | \
  docker exec -i cheep-postgres psql -U postgres -d cheep_db
```

Prod'a (droplet, user `cheep`):

```bash
gzip -dc store_branches.sql.gz | docker exec -i deploy-db-1 psql -U cheep -d cheep_db
```

> Not: döküm `TRUNCATE` içermez; boş tabloya yüklemek içindir. Doluysa önce
> `TRUNCATE store_branches;` (id çakışmasını önler) ya da mevcut satırlar üstüne
> yeni PBF çalıştır (`osm_pbf_branches.py`, external_ref ile upsert eder).

## Güncelleme (aylık)

Yeni PBF indir + çalıştır, sonra yedeği tazele:

```bash
# droplet'te
docker exec deploy-db-1 pg_dump -U cheep -d cheep_db --table=store_branches \
  --data-only | gzip > /tmp/store_branches_backup.sql.gz
# indir → bu dizine store_branches.sql.gz olarak koy, commit'le
```
