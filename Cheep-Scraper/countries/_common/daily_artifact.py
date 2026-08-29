"""GÜNLÜK TOPLU ARTEFAKT ÖNBELLEĞİ — bir dosya, çok zincir.

NEDEN VAR: Polonya modelinde her zincirin kendi sitesi var, dolayısıyla her
scraper kendi isteğini atar. Devlet zorunluluğuyla yayınlanan kaynaklarda
(Hırvatistan'ın günlük `cijene.dev` arşivi, Macaristan'ın `arfigyelo` XLSX
dökümü) durum TERS: TEK bir indirme TÜM zincirleri içeriyor.

Mimarideki `store_id` market başına atandığı için zincir başına bir scraper
tutmak doğru — böylece `should_import` çöküş kapısı, kategori süzgeci ve
haftalık rotasyon zincir bazında çalışmaya devam eder. Ama o zincirler naif
yazılırsa aynı 81 MB'lık arşivi ART ARDA BEŞ KEZ indirir: hem kaynağa karşı
kaba, hem koşuyu dakikalarca uzatır, hem de zincirler arasında TUTARSIZ veri
üretir (arşiv koşunun ortasında güncellenirse ilk zincir dünün, sonuncusu
bugünün fiyatını görür — aynı sepette iki farklı güne ait fiyatlar).

Bu modül ikisini de çözer: artefakt gün başına BİR KEZ indirilir, diske
yazılır, aynı gün içindeki tüm zincirler AYNI dosyayı okur.

ATOMİK YAZIM: indirme önce `.tmp`'ye yazılır, sonra `os.replace` ile yerine
konur. Yarıda kesilen bir indirme (ağ koptu, süreç öldü) aksi hâlde geçerli
görünen ama BOZUK bir önbellek dosyası bırakırdı ve o günün tüm zincirleri
sessizce sıfır ürün üretirdi — pipeline'ın en korktuğu senaryo (bkz.
`pipeline.summary_is_healthy` ve prune zinciri).
"""
import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

logger = logging.getLogger(__name__)

#: Kaç günlük önbellek saklanacak. Bugün + dün yeterli: dün, gece yarısını
#: geçen bir koşunun yarıda kalmasına karşı emniyet. Fazlası diski şişirir
#: (HR arşivi günde ~81 MB).
KEEP_DAYS = 2

DEFAULT_USER_AGENT = "cheep-scraper/1.0 (+https://cheep.live)"


def cache_path(cache_dir: Path, name: str, day: Optional[date] = None) -> Path:
    """O güne ait önbellek dosyasının yolu. `name` uzantıyı İÇERİR."""
    day = day or datetime.now(timezone.utc).date()
    stem, dot, ext = name.partition(".")
    return Path(cache_dir) / f"{stem}-{day.isoformat()}{dot}{ext}"


def prune_cache(cache_dir: Path, name: str, keep_days: int = KEEP_DAYS) -> int:
    """Eski önbellek dosyalarını siler, silinen sayısını döner.

    Yalnızca AYNI `name` ailesine ait dosyalara dokunur — önbellek klasörünü
    başka bir şeyle paylaşan bir ülke, alakasız dosyalarını kaybetmesin.
    """
    cache_dir = Path(cache_dir)
    if not cache_dir.exists():
        return 0
    stem = name.partition(".")[0]
    keep = {
        cache_path(cache_dir, name, date.fromordinal(
            datetime.now(timezone.utc).date().toordinal() - i)).name
        for i in range(keep_days)
    }
    removed = 0
    for path in cache_dir.glob(f"{stem}-*"):
        if path.name in keep or path.name.endswith(".tmp"):
            continue
        try:
            path.unlink()
            removed += 1
        except OSError as e:
            logger.warning("önbellek dosyası silinemedi %s: %s", path, e)
    return removed


def fetch_daily(
    url: str,
    cache_dir: Path,
    name: str,
    *,
    day: Optional[date] = None,
    timeout: int = 600,
    headers: Optional[dict] = None,
    session: Optional[requests.Session] = None,
    min_bytes: int = 1024,
) -> Path:
    """Günlük artefaktı indirir (bugün zaten indirildiyse indirmez) ve yolunu döner.

    `min_bytes`: bu boyutun ALTINDAKİ yanıt BAŞARISIZ sayılır ve önbelleğe
    YAZILMAZ. Kaynaklar arıza anında 200 ile birlikte kısa bir hata sayfası
    ya da boş bir gövde döndürebiliyor; bunu geçerli bir artefakt sanmak, o
    günün tüm zincirlerini sıfır ürünle koşturur.

    HATA DURUMUNDA ESKİ ÖNBELLEĞE DÜŞMEZ: çağıran, taze veri alamadığını
    bilmelidir (istisna fırlar). Sessizce dünkü dosyayı döndürmek, fiyatların
    donduğunu gizler — Polonya'da %76'sı 12 gün donmuş fiyatlarla tam olarak
    bu yaşandı.
    """
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_path(cache_dir, name, day)

    if target.exists() and target.stat().st_size >= min_bytes:
        logger.info("günlük artefakt önbellekten: %s (%d bayt)", target.name, target.stat().st_size)
        return target

    tmp = target.with_suffix(target.suffix + ".tmp")
    http = session or requests
    hdrs = {"User-Agent": DEFAULT_USER_AGENT, **(headers or {})}
    logger.info("günlük artefakt indiriliyor: %s", url)
    with http.get(url, stream=True, timeout=timeout, headers=hdrs) as r:
        r.raise_for_status()
        declared = r.headers.get("Content-Length")
        # `r.raw` DEĞİL `iter_content` — ikisi aynı şey değil.
        #
        # `r.raw`, sunucudan gelen HAM baytları verir; sunucu içeriği
        # gzip'lediyse dosyaya SIKIŞTIRILMIŞ hâli yazılır ve zip/xlsx
        # açılamaz. `iter_content` çözmeyi requests'e bırakır. Ayrıca
        # `copyfileobj` bir dosya-benzeri nesne bekliyor; buraya bir üreteç
        # (generator) verilirse "generator object has no attribute 'read'"
        # ile patlar — eski yedek yol tam olarak bu yüzden hiç çalışmıyordu
        # (üretimde `r.raw` hep var olduğu için de fark edilmiyordu).
        content_encoding = (r.headers.get("Content-Encoding") or "").strip()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                if chunk:
                    f.write(chunk)

    size = tmp.stat().st_size
    if size < min_bytes:
        tmp.unlink(missing_ok=True)
        raise ValueError(
            f"günlük artefakt beklenenden küçük ({size} < {min_bytes} bayt): {url} "
            "— kaynak 200 ile hata sayfası döndürmüş olabilir, önbelleğe yazılmadı"
        )

    # YARIM İNDİRME KAPISI — `min_bytes` bunu YAKALAMAZ.
    #
    # Üretimde yaşandı: 81 MB'lık HR arşivinin indirmesi bağlantı koptuğu için
    # 64 MB'da sessizce bitti. Akış hata vermedi, dosya `min_bytes` (10 MB)
    # eşiğini rahatça geçti ve GEÇERLİ bir önbellek olarak yazıldı. Sonuç: ZIP
    # okunabiliyordu ama İÇİNDEKİ zincirlerin bir kısmı (Konzum) yoktu —
    # yani "eksik dosya" hatası, gerçek sebebi (yarım indirme) hiç
    # göstermeden ortaya çıktı ve o zincir sessizce hiç tazelenmedi.
    #
    # Sunucu uzunluğu bildiriyorsa BİREBİR tutmak zorunda. Bildirmiyorsa
    # (chunked encoding) bu kontrol atlanır — o durumda `min_bytes` tek
    # savunma olarak kalır.
    # İçerik kodlanmışsa (gzip/br) `Content-Length` SIKIŞTIRILMIŞ boyuttur;
    # diskteki çözülmüş dosyayla karşılaştırmak yanlış alarm üretir.
    if declared is not None and not content_encoding:
        try:
            expected = int(declared)
        except ValueError:
            expected = None
        if expected is not None and size != expected:
            tmp.unlink(missing_ok=True)
            raise ValueError(
                f"günlük artefakt YARIM indi ({size}/{expected} bayt): {url} "
                "— önbelleğe yazılmadı, bir sonraki koşum yeniden indirir"
            )

    os.replace(tmp, target)
    logger.info("günlük artefakt yazıldı: %s (%d bayt)", target.name, size)
    prune_cache(cache_dir, name)
    return target


def open_daily(
    url: str,
    cache_dir: Path,
    name: str,
    reader: Callable[[Path], object],
    **kwargs,
):
    """`fetch_daily` + okuyucu. Zincir scraper'larının tek satırlık girişi."""
    return reader(fetch_daily(url, cache_dir, name, **kwargs))
