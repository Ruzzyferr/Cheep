"""
Kalıcı durum deposu (SQLite) — sürdürülebilir tek-sunucu fetch için.

Her sitemap ID'si için: status (resolved/empty) + son başarılı çekim zamanı + kaç
kez kontrol edildiği. ASLA full-wipe edilmez; haftalık/aylık rotasyonun temeli.

Seçici (selector) önceliği:
  1) YENİ id (sitemap'te var, state'te yok)                       → hemen çek
  2) BAYAT fiyatlı (resolved, last_ts > PRICED_TTL eski)          → fiyat tazele
  3) BAYAT boş (empty, last_ts > EMPTY_TTL eski)                  → restock yakala
Boşlar ASLA kalıcı atlanmaz; sadece daha seyrek (aylık) kontrol edilir.
"""
import os
import sqlite3
import time
from typing import List, Set

DEFAULT_DB = "mf_state.db"


def connect(path: str = DEFAULT_DB) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ids (
            id       TEXT PRIMARY KEY,
            status   TEXT NOT NULL,          -- 'resolved' | 'empty'
            last_ts  INTEGER NOT NULL,       -- son başarılı çekim (epoch)
            checks   INTEGER NOT NULL DEFAULT 1
        )""")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_status_ts ON ids(status, last_ts)")
    # Daemon omru boyunca degil, SURECLER ARASI yasamasi gereken kucuk degerler
    # (ornegin son prune zamani). Bellekte tutulan bir zamanlayici her yeniden
    # baslatmada sifirlaniyor; deploy daemon'i restart ettigi icin sik deploy
    # yapilan bir donemde 24 saatlik prune araligi HIC dolmuyordu.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS kv (
            k TEXT PRIMARY KEY,
            v TEXT NOT NULL
        )""")
    conn.commit()
    return conn


def get_float(conn: sqlite3.Connection, key: str, default: float = 0.0) -> float:
    """kv tablosundan sayi okur. Yoksa/bozuksa `default`."""
    row = conn.execute("SELECT v FROM kv WHERE k=?", (key,)).fetchone()
    if not row:
        return default
    try:
        return float(row[0])
    except (TypeError, ValueError):
        return default


def set_float(conn: sqlite3.Connection, key: str, value: float) -> None:
    conn.execute("INSERT INTO kv(k, v) VALUES(?, ?) "
                 "ON CONFLICT(k) DO UPDATE SET v=excluded.v", (key, str(value)))
    conn.commit()


def mark(conn: sqlite3.Connection, pid: str, status: str, ts: int = None):
    ts = ts or int(time.time())
    conn.execute("""
        INSERT INTO ids(id, status, last_ts, checks) VALUES(?,?,?,1)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status,
            last_ts=excluded.last_ts, checks=ids.checks+1""",
                 (pid, status, ts))


def known_ids(conn: sqlite3.Connection) -> Set[str]:
    return {r[0] for r in conn.execute("SELECT id FROM ids")}


def select_stale(conn, priced_ttl: int, empty_ttl: int, limit: int, now: int = None) -> List[str]:
    """Önce bayat fiyatlılar (fiyat tazeliği), sonra bayat boşlar (restock)."""
    now = now or int(time.time())
    out = []
    for r in conn.execute(
            "SELECT id FROM ids WHERE status='resolved' AND last_ts < ? ORDER BY last_ts ASC LIMIT ?",
            (now - priced_ttl, limit)):
        out.append(r[0])
    if len(out) < limit:
        for r in conn.execute(
                "SELECT id FROM ids WHERE status='empty' AND last_ts < ? ORDER BY last_ts ASC LIMIT ?",
                (now - empty_ttl, limit - len(out))):
            out.append(r[0])
    return out


def counts(conn) -> dict:
    d = {"resolved": 0, "empty": 0}
    for status, n in conn.execute("SELECT status, count(*) FROM ids GROUP BY status"):
        d[status] = n
    d["total"] = d["resolved"] + d["empty"]
    return d


def bootstrap_from_files(conn, raw_dir: str, empty_files: List[str], ts: int = None) -> dict:
    """Mevcut mf_raw/ + empty listelerini state DB'ye bir kez aktarır (soğuk-başlangıç
    sonrası daemon'a geçiş). Zaten varsa dokunmaz."""
    ts = ts or int(time.time())
    added = {"resolved": 0, "empty": 0}
    if os.path.isdir(raw_dir):
        cur = known_ids(conn)
        rows = []
        for fn in os.listdir(raw_dir):
            if fn.endswith(".json") and fn[:-5] not in cur:
                rows.append((fn[:-5], "resolved", ts, 1)); added["resolved"] += 1
        conn.executemany("INSERT OR IGNORE INTO ids(id,status,last_ts,checks) VALUES(?,?,?,?)", rows)
    for ef in empty_files:
        if ef and os.path.exists(ef):
            cur = known_ids(conn)
            rows = [(i, "empty", ts, 1) for i in open(ef, encoding="utf-8").read().split() if i and i not in cur]
            conn.executemany("INSERT OR IGNORE INTO ids(id,status,last_ts,checks) VALUES(?,?,?,?)", rows)
            added["empty"] += len(rows)
    conn.commit()
    return added
