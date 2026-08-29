"""Günlük toplu artefakt önbelleği.

Bu modülün koruduğu şey SESSİZ VERİ KAYBI: kaynak tek bir dosyada tüm
zincirleri veriyor, dolayısıyla o dosyadaki en küçük bozulma bile bir
zincirin tamamının o gün hiç tazelenmemesi demek — ve bunu hiçbir hata
söylemiyor.
"""
import pytest

from countries._common.daily_artifact import cache_path, fetch_daily, prune_cache


class _FakeResponse:
    def __init__(self, body: bytes, declared=None, status=200):
        self._body = body
        self.status_code = status
        self.headers = {} if declared is None else {"Content-Length": str(declared)}
        self.raw = None

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def iter_content(self, chunk_size=1):
        yield self._body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class _FakeSession:
    def __init__(self, response):
        self._response = response
        self.calls = 0

    def get(self, url, **kw):
        self.calls += 1
        return self._response


def test_complete_download_is_cached(tmp_path):
    body = b"x" * 5000
    session = _FakeSession(_FakeResponse(body, declared=len(body)))
    path = fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)
    assert path.read_bytes() == body


def test_truncated_download_is_rejected(tmp_path):
    """ÜRETİMDE YAŞANDI: 81 MB'lık arşiv bağlantı koptuğu için 64 MB'da
    sessizce bitti. Akış hata vermedi, dosya boyut eşiğini rahatça geçti ve
    GEÇERLİ önbellek olarak yazıldı — ZIP açılıyordu ama içindeki zincirlerin
    bir kısmı yoktu ve o zincir hiç tazelenmedi."""
    session = _FakeSession(_FakeResponse(b"x" * 6000, declared=9000))
    with pytest.raises(ValueError, match="YARIM"):
        fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)


def test_rejected_download_leaves_no_cache_file(tmp_path):
    """Yarım dosya diskte KALMAMALI: kalırsa bir sonraki koşum onu geçerli
    önbellek sanıp aynı eksik veriyle çalışır."""
    session = _FakeSession(_FakeResponse(b"x" * 6000, declared=9000))
    with pytest.raises(ValueError):
        fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)
    assert not cache_path(tmp_path, "a.zip").exists()
    assert list(tmp_path.glob("*.tmp")) == []


def test_short_body_is_rejected_even_without_content_length(tmp_path):
    """Kaynak 200 ile kısa bir hata gövdesi döndürebiliyor; uzunluk
    bildirilmediğinde tek savunma boyut eşiği."""
    session = _FakeSession(_FakeResponse(b"hata", declared=None))
    with pytest.raises(ValueError, match="küçük"):
        fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=1000)


def test_chunked_response_without_length_is_accepted(tmp_path):
    """Uzunluk bildirmeyen (chunked) kaynak çalışmaya devam etmeli."""
    body = b"y" * 5000
    session = _FakeSession(_FakeResponse(body, declared=None))
    path = fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)
    assert path.read_bytes() == body


def test_second_call_uses_cache_and_does_not_refetch(tmp_path):
    """Gün başına TEK indirme: aynı gün içindeki tüm zincirler aynı dosyayı
    okumalı. Aksi halde beş zincir aynı 81 MB'ı beş kez indirir ve arşiv koşu
    ortasında güncellenirse zincirler FARKLI günlerin fiyatlarını karıştırır."""
    body = b"z" * 5000
    session = _FakeSession(_FakeResponse(body, declared=len(body)))
    fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)
    fetch_daily("http://x/a.zip", tmp_path, "a.zip", session=session, min_bytes=100)
    assert session.calls == 1


def test_prune_keeps_recent_and_removes_old(tmp_path):
    (tmp_path / "cijene-2020-01-01.zip").write_bytes(b"eski")
    body = b"w" * 5000
    session = _FakeSession(_FakeResponse(body, declared=len(body)))
    fetch_daily("http://x/a.zip", tmp_path, "cijene.zip", session=session, min_bytes=100)
    assert not (tmp_path / "cijene-2020-01-01.zip").exists()
    assert cache_path(tmp_path, "cijene.zip").exists()


def test_prune_does_not_touch_unrelated_files(tmp_path):
    (tmp_path / "baska-2020-01-01.json").write_bytes(b"dokunma")
    prune_cache(tmp_path, "cijene.zip")
    assert (tmp_path / "baska-2020-01-01.json").exists()
