"""HIRVATİSTAN market şubelerini OpenStreetMap'ten çeker.

NEDEN OSM: `cijene.dev` arşivinin `stores.csv` dosyası adres ve şehir veriyor
ama KOORDİNAT VERMİYOR. Uygulamanın mesafe filtresi (ve "yakınımdaki marketler"
ekranının tamamı) enlem/boylam olmadan çalışmaz; adresleri tek tek geocode
etmek hem yavaş hem de servis kotalarına takılır. OSM'de Hırvatistan'ın
süpermarket kapsamı iyi (2026-08-28 ölçümü: `shop=supermarket|convenience|
grocery` için 4.723 nesne).

Mantığın tamamı ortak `countries/_common/osm_branches.py`'de; burası yalnızca
zincir listesi. `CHAINS` sırası ÖNEMLİ — aynı OSM nesnesi iki regex'e uyarsa
İLK zincir kazanır (bkz. `dedupe_new`).

Kullanım (Cheep-Scraper dizininde, venv ile):
  INGEST_API_KEY=... CHEEP_API_URL=https://api.cheep.live/api/v1 \
    python countries/croatia/osm_branches.py
"""
from countries._common.osm_branches import Chain, main_for

#: store_id'ler `countries/croatia/config.json` ile BİREBİR aynı olmalı —
#: uyuşmazlık şubeleri yanlış zincire bağlar.
CHAINS = [
    Chain(50, "Konzum", r"Konzum"),
    Chain(51, "Lidl", r"Lidl"),
    Chain(52, "Spar", r"Spar|Interspar"),
    Chain(53, "Plodine", r"Plodine"),
    Chain(54, "Kaufland", r"Kaufland"),
    Chain(55, "Tommy", r"Tommy"),
]


if __name__ == "__main__":
    main_for("HR", CHAINS)
