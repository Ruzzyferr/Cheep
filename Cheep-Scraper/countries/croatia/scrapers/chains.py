"""HIRVATİSTAN zincirleri — hepsi aynı günlük arşivi okur.

Her zincir `CijeneChainScraper`'ın iki satırlık bir alt sınıfı; tek fark
arşivdeki klasör adı. Ayrı dosyalara bölünmedi çünkü bölünseydi altı dosyanın
tamamı aynı iki satırı tekrarlardı ve gerçek davranışın nerede olduğu
gizlenirdi — davranışın tamamı `cijene_base.py`'de.

`config.json` her zinciri `scraper_path: "scrapers/chains.py"` + kendi
`scraper_class` adıyla çağırır.

ZİNCİR SEÇİMİ (2026-08-28 arşivinden ölçülen gerçek sayılar):
    Konzum    188 mağaza / 21.907 ürün / %94,8 EAN   — en büyük süpermarket
    Plodine   154 / 29.471 / %92,8                   — en geniş katalog
    Spar      145 / 23.264 / %97,4
    Lidl      116 /  7.065 / %97,4                   — indirimci (fiyat çıpası)
    Tommy      87 / 19.879 / %100
    Kaufland   53 / 18.917 / %100
Arşivde ayrıca Studenac, Eurospin, KTC, NTL, Metro, dm ve 14 küçük zincir daha
var; ilk sürüme dahil edilmediler (kapsam/bakım dengesi), config'te kapalı
durabilirler.
"""
from countries.croatia.classify import classify
from countries.croatia.scrapers.cijene_base import CijeneChainScraper


class _HrChain(CijeneChainScraper):
    """Ortak sınıflandırıcıyı bağlar. `staticmethod` ŞART: düz bir fonksiyon
    atanırsa Python onu örnek metodu sayar ve `self`'i ilk argüman olarak
    geçirir (`classify(self, name, coarse)` → TypeError)."""
    classifier = staticmethod(classify)


class KonzumScraper(_HrChain):
    chain = "konzum"


class PlodineScraper(_HrChain):
    chain = "plodine"


class SparHrScraper(_HrChain):
    chain = "spar"


class LidlHrScraper(_HrChain):
    chain = "lidl"


class TommyScraper(_HrChain):
    chain = "tommy"


class KauflandHrScraper(_HrChain):
    chain = "kaufland"


class StudenacScraper(_HrChain):
    chain = "studenac"


class EurospinHrScraper(_HrChain):
    chain = "eurospin"
