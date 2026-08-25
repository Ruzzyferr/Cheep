"""
mf_state kv deposu — sürecler ARASI yaşaması gereken küçük değerler.

NEDEN VAR: daemon'ın son prune zamanı bellekte tutuluyordu ve bu iki uçtan da
yanlıştı. 0.0 ile başlayınca döngünün ilk turu her zaman prune ediyor;
`Restart=always` altındaki bir çökme döngüsü saniyeler arayla iki büyük
deleteMany taraması tetikliyordu. time.time() ile başlayınca ise her yeniden
başlatma 24 saatlik aralığı sıfırlıyor ve deploy daemon'ı restart ettiği için
sık deploy yapılan bir dönemde prune HİÇ koşmuyordu — bayat fiyatlar
kullanıcıya gösterilmeye devam ederdi.
"""
import os
import tempfile

from countries.turkey import mf_state as st


def _db():
    path = os.path.join(tempfile.mkdtemp(), "t.db")
    return st.connect(path), path


def test_get_float_returns_default_when_absent():
    conn, _ = _db()
    assert st.get_float(conn, "last_prune", 0.0) == 0.0
    assert st.get_float(conn, "yok", 42.5) == 42.5


def test_set_then_get_roundtrip():
    conn, _ = _db()
    st.set_float(conn, "last_prune", 1787000000.5)
    assert st.get_float(conn, "last_prune") == 1787000000.5


def test_value_survives_reconnect():
    """Asıl mesele bu: değer SÜREÇ yeniden başlasa da kalmalı."""
    conn, path = _db()
    st.set_float(conn, "last_prune", 123456.0)
    conn.close()
    conn2 = st.connect(path)
    assert st.get_float(conn2, "last_prune") == 123456.0


def test_overwrite_keeps_single_row():
    conn, _ = _db()
    st.set_float(conn, "last_prune", 1.0)
    st.set_float(conn, "last_prune", 2.0)
    assert st.get_float(conn, "last_prune") == 2.0
    n = conn.execute("SELECT COUNT(*) FROM kv WHERE k='last_prune'").fetchone()[0]
    assert n == 1


def test_corrupt_value_falls_back_to_default():
    """Elle bozulmuş bir satır daemon'ı çökertmemeli."""
    conn, _ = _db()
    conn.execute("INSERT INTO kv(k, v) VALUES('last_prune', 'bozuk')")
    conn.commit()
    assert st.get_float(conn, "last_prune", 7.0) == 7.0
