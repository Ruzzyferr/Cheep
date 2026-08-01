"""dist/'i prod Caddy'siyle aynı kurallarla sunar — yerel doğrulama içindir.

Caddyfile: try_files {path} {path}/index.html + handle_errors → 404.html
`vite preview` bu sıralamayı uygulamıyor (/pl için doğrudan SPA fallback'e
düşüp kök index.html'i veriyor), o yüzden prerender çıktısını onunla test etmek
yanıltıcı oluyor.

Kullanım:  python scripts/serve-dist.py [port]
"""
import gzip
import io
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "dist"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4180


class TryFiles(SimpleHTTPRequestHandler):
    """Caddy'nin try_files + encode gzip + cache header davranışını taklit eder,
    böylece yerel Lighthouse ölçümü prod'a yakın çıkar."""

    def translate_path(self, path):
        rel = path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        candidates = [DIST / rel, DIST / rel / "index.html"]
        for c in candidates:
            if c.is_file():
                return str(c)
        # Caddy'de SPA fallback yok: eşleşmeyen yol gerçek 404 + dist/404.html.
        # Yerel sunucu da aynısını yapmalı, yoksa 404 davranışını test edemeyiz.
        return str(DIST / "404.html")

    def end_headers(self):
        p = self.path.split("?", 1)[0]
        if p.startswith("/assets/") or p.startswith("/fonts/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        super().end_headers()

    def send_head(self):
        """gzip'lenebilir tipleri sıkıştırarak gönder (Caddy `encode gzip`)."""
        path = self.translate_path(self.path)
        ctype = self.guess_type(path)
        compressible = any(
            ctype.startswith(t) for t in ("text/", "application/javascript", "application/json")
        ) or ctype in ("image/svg+xml", "application/xml")

        gzip_ok = compressible and "gzip" in self.headers.get("Accept-Encoding", "")
        is404 = path.endswith("404.html")

        if not gzip_ok:
            if not is404:
                return super().send_head()
            # super().send_head() her zaman 200 gönderiyor; 404'te durum kodunu
            # kendimiz yazmalıyız, yoksa soft 404 üretiriz.
            with open(path, "rb") as f:
                body = f.read()
            self.send_response(404)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)

        with open(path, "rb") as f:
            body = gzip.compress(f.read(), 6)
        # 404.html'e düşmüşsek durum kodu da 404 olmalı — Google soft 404'ü
        # gerçek 404'ten ayırt edemezse silinmiş sayfaları indekste tutuyor.
        self.send_response(404 if is404 else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    handler = partial(TryFiles, directory=str(DIST))
    print(f"dist -> http://localhost:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
