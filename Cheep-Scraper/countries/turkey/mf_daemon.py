"""
Sürdürülebilir tek-sunucu fetch DAEMON'ı (7/24 nazik).

- (1) Kalıcı durum: mf_state.db (asla wipe)
- (3) Rate-shaping: AIMD adaptif gecikme — burst→ban yerine sabit damla; ban
      eşiğinin ALTINA kendini ayarlar (blokta yavaşla, başarıda hızlan).
- (4) Sürekli: systemd servisi olarak sonsuz döngü; işi bitince uyur.
- (5) Artımlı: sitemap-diff (yeni id öncelik) + rotasyon (fiyatlı PRICED_TTL,
      boş EMPTY_TTL). Boşlar kalıcı atlanmaz, sadece seyrek kontrol edilir.

Ham JSON mf_raw/'a kaydedilir; çözülen ürünler küçük gruplar hâlinde ingest edilir.
"""
import argparse
import json
import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from countries.turkey import mf_state as st
from countries.turkey.marketfiyati import (
    _session, fetch_all_ids, fetch_product, health_ok, EMPTY,
    build_price_payloads, ingest, build_branch_payloads, ingest_branches,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("mf_daemon")


class Pacer:
    """AIMD: blokta çarpımsal yavaşla, başarıda toplamsal hızlan. Ban eşiğini bulur."""
    def __init__(self, init=0.8, lo=0.3, hi=20.0):
        self.delay, self.lo, self.hi = init, lo, hi
        self.streak = 0

    def ok(self):
        self.streak += 1
        if self.streak >= 5:                     # istikrarlı başarı → nazikçe hızlan
            self.delay = max(self.lo, self.delay - 0.05)
            self.streak = 0

    def blocked(self):
        self.streak = 0
        self.delay = min(self.hi, self.delay * 1.6)

    def wait(self):
        time.sleep(self.delay)


def _prune(api_url, api_key, ttl_days=21):
    """Bayat (kaldırılmış) fiyat/ürün süpürmesi — backend'e günlük çağrı."""
    try:
        headers = {"x-country": "TR"}
        if api_key:
            headers["x-api-key"] = api_key
        r = requests.post(f"{api_url.rstrip('/')}/store-prices/prune-stale",
                          json={"ttl_days": ttl_days}, headers=headers, timeout=120)
        if r.ok:
            logger.info("prune: %s", r.json())
        else:
            logger.warning("prune HTTP %s: %s", r.status_code, r.text[:150])
    except requests.RequestException as e:
        logger.warning("prune hata: %s", e)


class CatMap:
    """Kategori haritası — DİSKTEKİ DEĞİŞİKLİĞİ İZLER.

    Haftalık taksonomi tazelemesi `category_map.json`'u yeniliyor ama bu daemon
    sonsuza kadar çalışıyor (`Restart=always`, `Type=simple`). Harita döngüden
    önce bir kez okunsaydı, devletin yeni açtığı kategori daemon elle yeniden
    başlatılana kadar hiçbir ürüne uygulanmaz, hepsi "Diğer"e düşerdi.

    mtime değişince yeniden okur; değişmediyse diske gitmez.
    """

    def __init__(self, path):
        self.path = path
        self.main_to_id = {}
        self.other_id = None
        self._mtime = None
        self.loads = 0            # test edilebilirlik: kaç kez diskten okundu
        self._refresh()

    def _refresh(self):
        if not self.path or not os.path.exists(self.path):
            if self._mtime is None:
                logger.warning("category_map yok (%s) — ingest kategorisiz", self.path)
            return
        try:
            mtime = os.path.getmtime(self.path)
        except OSError:
            return
        if mtime == self._mtime:
            return
        try:
            with open(self.path, encoding="utf-8") as f:
                cm = json.load(f)
        except Exception as e:
            # Yarım yazılmış dosyaya denk gelmiş olabiliriz. ESKİ HARİTAYI
            # KORU: boşaltmak tüm kataloğu "Diğer"e düşürürdü.
            logger.warning("category_map okunamadı (%s) — eski harita korunuyor", e)
            return
        self.main_to_id = cm.get("main_to_id", {}) or {}
        self.other_id = cm.get("other_id")
        self._mtime = mtime
        self.loads += 1
        logger.info("category_map yüklendi: %d alt kategori", len(self.main_to_id))

    def resolve(self, main_category):
        """Ham `main_category` → kategori id. Eşleşmezse "Diğer"."""
        self._refresh()
        return self.main_to_id.get((main_category or "").strip(), self.other_id)


def run(raw_dir, api_url, api_key, category_map="category_map.json",
        priced_ttl=7 * 86400, empty_ttl=30 * 86400, sitemap_refresh=86400,
        batch=200, ingest_every=150, idle_sleep=300, once=False,
        prune_ttl_days=21, prune_interval=86400, min_delay=30.0):
    os.makedirs(raw_dir, exist_ok=True)
    conn = st.connect()
    added = st.bootstrap_from_files(conn, raw_dir, ["mf_empty.txt", "mf_empty_local.txt"])
    if any(added.values()):
        logger.info("bootstrap: mevcut dosyalardan +%s", added)
    logger.info("başlangıç durumu: %s", st.counts(conn))

    session = _session()
    cat_map = CatMap(category_map)
    # Hız tavanı: fetch'ler arası min gecikme = min_delay sn. Böylece daemon devlet
    # API'sine yüklenmeyip nazik, sabit bir hızda çeker (varsayılan 30s → ~120 ürün/saat
    # → tüm katalog ~5-6 günde bir tam tur). Bu, senkron "dalga"yı önler (tüm ürünler
    # aynı anda bayatlayıp API'yi dövmek yerine haftaya yayılır) ve rate-limit bloklarını
    # neredeyse sıfırlar. Blokta yine de min_delay'in üstüne çıkar (AIMD), başarıda tabana döner.
    pacer = Pacer(init=min_delay, lo=min_delay, hi=max(min_delay * 4, 120.0))
    sitemap_ids, sitemap_ts = fetch_all_ids(session), time.time()
    consec_block = 0
    # BİR TAM ARALIK BEKLE. Eskiden 0.0 idi ve döngünün İLK turu her zaman
    # prune ediyordu. Servis `Restart=always` olduğu için bir çökme döngüsü
    # (ör. disk dolduğunda raw JSON yazılamıyor) saniyeler arayla prune
    # tetikliyordu; her prune iki büyük deleteMany taraması demek.
    last_prune = time.time()
    # Son BAŞARILI ingest'ten bu yana geçen süre — prune'un ön koşulu.
    last_ingest_ok = 0.0
    pending = {}
    seen_branches: set = set()   # daemon ömrü boyunca gönderilen şube ref'leri (tekrar POST yok)

    def do_ingest():
        nonlocal pending, last_ingest_ok
        if not pending:
            return
        for pid, d in pending.items():
            d["_cheep_cat"] = cat_map.resolve(d.get("main_category"))
        payloads = build_price_payloads(pending)
        stats = {"total": 0, "successful": 0, "failed": 0}
        if payloads:
            # DÖNÜŞ DEĞERİ ARTIK OKUNUYOR. Eskiden atılıyordu ve `ingest()`
            # her HTTP hatasını kendi içinde yutuyor; sonuç: INGEST_API_KEY
            # döndükten sonra her upsert 401 alırken kayda hâlâ başarı
            # görünümlü "ingest: ürün=N payload=M" satırı düşüyordu.
            stats = ingest(payloads, api_url, api_key) or stats
        # Aynı üründen ŞUBELERİ de çıkar → store_branches sürekli tazelenir (mesafe için).
        branch_payloads = build_branch_payloads(pending, seen_branches)
        if branch_payloads:
            ingest_branches(branch_payloads, api_url, api_key)
        if stats["successful"] > 0:
            last_ingest_ok = time.time()
        if stats["failed"]:
            logger.error("ingest: %d/%d payload BAŞARISIZ — prune ertelenecek",
                         stats["failed"], stats["total"])
        logger.info("ingest: ürün=%d payload=%d başarılı=%d başarısız=%d yeni_şube=%d | durum=%s",
                    len(pending), len(payloads), stats["successful"], stats["failed"],
                    len(branch_payloads), st.counts(conn))
        pending = {}

    while True:
        # (kaldırma) günlük bayat süpürmesi — tazelenmeyen fiyat/ürünleri sil
        #
        # ⚠️ SAĞLIK KAPISI — bu koşul olmadan prune KATALOĞU SİLEBİLİR.
        # `prune-stale` 21 günden eski her fiyatı siler ve fiyatsız kalan
        # `mf-` ürünlerini de siler; ürün silme `ListItem`'a CASCADE eder,
        # yani KULLANICILARIN KAYITLI LİSTELERİ de gider.
        #
        # Eski hâlinde prune, hiçbir şey çekilmemiş/yüklenmemiş olsa bile
        # her gün koşuyordu. Somut senaryo: marketfiyati'nin WAF'ı droplet
        # IP'sini banlar, `fetch_product` sürekli None döner, hiçbir fiyat
        # tazelenmez — ama prune yine de her gün çalışır ve 21. günde tüm
        # TR kataloğu ile birlikte kullanıcı listeleri silinir.
        #
        # Kural: SON PRUNE'DAN BU YANA EN AZ BİR BAŞARILI INGEST OLMALI.
        # "Veri tazeliyorsam eskiyeni silebilirim; tazelemiyorsam silemem."
        # Kardeş PL hattı aynı korumayı `summary_is_healthy` ile yapıyor.
        if time.time() - last_prune > prune_interval:
            if last_ingest_ok > last_prune:
                _prune(api_url, api_key, prune_ttl_days)
                last_prune = time.time()
            else:
                logger.error(
                    "PRUNE ATLANDI — son prune'dan bu yana başarılı ingest yok. "
                    "Veri tazelenmiyorken silme yapılmaz (katalog + kullanıcı listeleri risk altında). "
                    "durum=%s", st.counts(conn))
                # Tekrar tekrar kayda basmasın diye sayacı ilerlet; koşul
                # sağlanınca bir sonraki aralıkta normal akışına döner.
                last_prune = time.time() - prune_interval + 3600

        if time.time() - sitemap_ts > sitemap_refresh:
            try:
                sitemap_ids, sitemap_ts = fetch_all_ids(session), time.time()
                logger.info("sitemap tazelendi: %d id", len(sitemap_ids))
            except Exception as e:
                logger.warning("sitemap tazelenemedi: %s", e)

        known = st.known_ids(conn)
        todo = [i for i in sitemap_ids if i not in known][:batch]           # (5) yeni öncelik
        if len(todo) < batch:
            todo += st.select_stale(conn, priced_ttl, empty_ttl, batch - len(todo))  # (5) rotasyon
        if not todo:
            logger.info("her şey taze — %ds uyunuyor (durum=%s)", idle_sleep, st.counts(conn))
            do_ingest()
            if once:
                break
            time.sleep(idle_sleep)
            continue

        logger.info("parti: %d id (yeni+bayat) | gecikme=%.2fs", len(todo), pacer.delay)
        for pid in todo:
            pacer.wait()
            res = fetch_product(session, pid)
            if res is None:                                                 # (3) blok → yavaşla
                pacer.blocked()
                consec_block += 1
                if consec_block >= 8:                                       # sert ban → sağlık-kapısı
                    logger.info("sert blok — API iyileşene kadar bekleniyor (gecikme=%.1fs)", pacer.delay)
                    while not health_ok(session):
                        time.sleep(min(pacer.hi, 60))
                    consec_block = 0
                continue
            consec_block = 0
            pacer.ok()
            ts = int(time.time())
            if res is EMPTY:
                st.mark(conn, pid, "empty", ts)
            else:
                with open(os.path.join(raw_dir, f"{pid}.json"), "w", encoding="utf-8") as f:
                    json.dump(res, f, ensure_ascii=False)
                st.mark(conn, pid, "resolved", ts)
                pending[str(res.get("id") or pid)] = res
                if len(pending) >= ingest_every:
                    do_ingest()
        conn.commit()
        do_ingest()
        if once:
            break


def main():
    ap = argparse.ArgumentParser(description="marketfiyati sürdürülebilir fetch daemon")
    ap.add_argument("--raw-dir", default="mf_raw")
    ap.add_argument("--api-url", default=os.getenv("CHEEP_API_URL", "http://localhost:3000/api/v1"))
    ap.add_argument("--api-key", default=os.getenv("INGEST_API_KEY"))
    ap.add_argument("--category-map", default="category_map.json")
    ap.add_argument("--priced-ttl", type=int, default=7 * 86400, help="fiyatlı yeniden-çekim eşiği (sn)")
    ap.add_argument("--empty-ttl", type=int, default=30 * 86400, help="boş yeniden-kontrol eşiği (sn)")
    ap.add_argument("--batch", type=int, default=200)
    ap.add_argument("--ingest-every", type=int, default=150)
    ap.add_argument("--prune-ttl-days", type=int, default=21, help="bu kadar gün tazelenmeyen fiyat/ürün silinir")
    ap.add_argument("--min-delay", type=float, default=30.0,
                    help="fetch'ler arası min gecikme (sn). Hız tavanı: 30s≈120 ürün/saat≈tüm katalog ~5-6 günde. API bloklarını önlemek için nazik tutulur.")
    ap.add_argument("--once", action="store_true", help="tek parti çalış, çık (test)")
    a = ap.parse_args()
    run(a.raw_dir, a.api_url, a.api_key, a.category_map, a.priced_ttl, a.empty_ttl,
        batch=a.batch, ingest_every=a.ingest_every, once=a.once, prune_ttl_days=a.prune_ttl_days,
        min_delay=a.min_delay)


if __name__ == "__main__":
    main()
