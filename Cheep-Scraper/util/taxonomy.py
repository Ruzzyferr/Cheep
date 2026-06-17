"""
Canonical, name-first product taxonomy + classifier.

The permanent solution to the cross-market category problem: every market names
and groups its categories differently (10 vs 20 categories, different labels),
so we IGNORE the market's own category and classify each product into ONE shared
canonical taxonomy — primarily from the product NAME (consistent across markets),
with the market's raw category as a weak hint.

Matching is token-based (whole tokens + phrases) to avoid substring false
positives like "balığı" (fish) matching "bal" (honey).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Dict, List, Optional, Tuple

# --- canonical taxonomy: top -> subcategories -------------------------------
CANONICAL_TAXONOMY: Dict[str, List[str]] = {
    "Meyve & Sebze": ["Meyve", "Sebze", "Yeşillik", "Kuru Meyve"],
    "Et, Tavuk & Balık": ["Kırmızı Et", "Tavuk", "Balık", "Şarküteri", "Sucuk & Salam"],
    "Süt Ürünleri": ["Süt", "Peynir", "Yoğurt", "Tereyağı", "Ayran", "Kaymak & Krema"],
    "Kahvaltılık": ["Yumurta", "Bal", "Reçel", "Zeytin", "Tahin & Pekmez",
                    "Kahvaltılık Gevrek", "Helva"],
    "Temel Gıda": ["Makarna", "Pirinç", "Un", "Şeker", "Bakliyat", "Yağ", "Salça",
                   "Baharat", "Sirke", "Çorba", "Konserve"],
    "Atıştırmalık": ["Çikolata", "Bisküvi", "Gofret", "Cips", "Kuruyemiş", "Kraker",
                     "Şekerleme", "Sakız"],
    "İçecek": ["Su", "Maden Suyu", "Gazlı İçecek", "Meyve Suyu", "Çay", "Kahve",
               "Enerji İçeceği"],
    "Donuk & Hazır Yemek": ["Dondurulmuş Gıda", "Hazır Yemek", "Pizza"],
    "Fırın & Pastane": ["Ekmek", "Pasta & Kek", "Poğaça & Börek"],
    "Dondurma": ["Dondurma"],
    "Temizlik": ["Çamaşır Deterjanı", "Bulaşık Deterjanı", "Çamaşır Suyu",
                 "Yumuşatıcı", "Yüzey Temizleyici", "Çöp Poşeti"],
    "Kağıt & Hijyen": ["Tuvalet Kağıdı", "Kağıt Havlu", "Peçete", "Islak Mendil"],
    "Kişisel Bakım & Kozmetik": ["Şampuan", "Sabun", "Diş Macunu", "Deodorant",
                                  "Duş Jeli", "Tıraş", "Cilt Bakım", "Ped & Hijyen"],
    "Bebek": ["Bebek Bezi", "Bebek Maması", "Bebek Bakım"],
    "Ev & Yaşam": ["Mutfak Gereçleri", "Pil & Aydınlatma", "Kırtasiye"],
    "Pet Shop": ["Kedi Maması", "Köpek Maması"],
    "Diğer": ["Diğer"],
}

SUB_TO_TOP: Dict[str, str] = {
    sub: top for top, subs in CANONICAL_TAXONOMY.items() for sub in subs
}

# --- classification rules: (subcategory, [keywords]) ------------------------
# Order matters only for ties. Keywords are normalized (see _norm). Multi-word
# entries are matched as phrases; single words as whole tokens (+ curated
# inflected forms) so "baligi" never matches "bal".
_RULES: List[Tuple[str, List[str]]] = [
    # Süt Ürünleri
    ("Süt", ["sut", "sutu", "laktozsuz sut", "uht sut", "yagli sut"]),
    ("Peynir", ["peynir", "peyniri", "kasar", "kashar", "lor", "cokelek", "labne"]),
    ("Yoğurt", ["yogurt", "yogurdu"]),
    ("Tereyağı", ["tereyagi", "tereyag"]),
    ("Ayran", ["ayran"]),
    ("Kaymak & Krema", ["kaymak", "krema"]),
    # Kahvaltılık
    ("Yumurta", ["yumurta", "yumurtasi"]),
    ("Bal", ["bal", "bali", "petek bal"]),
    ("Reçel", ["recel", "marmelat"]),
    ("Zeytin", ["zeytin", "zeytini"]),
    ("Tahin & Pekmez", ["tahin", "pekmez"]),
    ("Kahvaltılık Gevrek", ["gevrek", "musli", "granola", "mosli"]),
    ("Helva", ["helva"]),
    # Et, Tavuk & Balık  (balık before bal-like; token-based anyway)
    ("Balık", ["balik", "baligi", "ton baligi", "somon", "levrek", "cipura",
               "hamsi", "palamut", "uskumru", "midye", "karides", "deniz urunleri"]),
    ("Tavuk", ["tavuk", "tavugu", "pilic", "but", "gogus", "kanat", "bonfile tavuk"]),
    ("Kırmızı Et", ["dana", "kuzu", "kiyma", "biftek", "bonfile", "kusbasi", "kirmizi et"]),
    ("Sucuk & Salam", ["sucuk", "salam", "sosis", "jambon", "pastirma", "fume"]),
    ("Şarküteri", ["sarkuteri"]),
    # Meyve & Sebze
    ("Sebze", ["domates", "salatalik", "biber", "patlican", "sogan", "patates",
               "havuc", "kabak", "sebze", "marul", "ispanak", "brokoli", "sarimsak"]),
    ("Meyve", ["elma", "muz", "portakal", "armut", "uzum", "cilek", "karpuz",
               "kavun", "mandalina", "limon", "seftali", "kiraz", "meyve", "nar", "kivi"]),
    ("Yeşillik", ["maydanoz", "roka", "dereotu", "nane", "yesillik"]),
    ("Kuru Meyve", ["kuru kayisi", "kuru uzum", "kuru incir", "hurma", "kuru meyve"]),
    # Temel Gıda
    ("Makarna", ["makarna", "spagetti", "eriste"]),
    ("Pirinç", ["pirinc", "baldo", "osmancik", "basmati"]),
    ("Un", ["un", "unu"]),
    ("Şeker", ["seker", "toz seker", "kup seker"]),
    ("Bakliyat", ["mercimek", "nohut", "fasulye", "barbunya", "bakliyat", "bulgur",
                  "kuru fasulye"]),
    ("Yağ", ["aycicek yagi", "zeytinyagi", "misir yagi", "sivi yag", "ayciçek"]),
    ("Salça", ["salca", "salcasi"]),
    ("Baharat", ["baharat", "pul biber", "karabiber", "kimyon", "kekik", "nane kuru"]),
    ("Sirke", ["sirke"]),
    ("Çorba", ["corba", "corbasi"]),
    ("Konserve", ["konserve", "turşu", "tursu"]),
    # Atıştırmalık
    ("Gofret", ["gofret"]),
    ("Çikolata", ["cikolata", "cikolatali", "bar cikolata"]),
    ("Bisküvi", ["biskuvi", "biskuvisi", "petibor"]),
    ("Cips", ["cips", "patates cipsi"]),
    ("Kuruyemiş", ["kuruyemis", "findik", "fistik", "ceviz", "badem", "leblebi",
                   "antep fistigi", "kaju"]),
    ("Kraker", ["kraker"]),
    ("Şekerleme", ["sekerleme", "jelibon", "lokum", "marshmallow", "akide"]),
    ("Sakız", ["sakiz", "sakizi"]),
    # İçecek
    ("Gazlı İçecek", ["kola", "cola", "coca", "pepsi", "fanta", "sprite", "gazoz",
                      "soda icecek", "gazli icecek"]),
    ("Maden Suyu", ["maden suyu", "soda"]),
    ("Su", ["su", "dogal kaynak suyu", "kaynak suyu"]),
    ("Meyve Suyu", ["meyve suyu", "meyve nektari", "ice tea", "ledra", "nektar"]),
    ("Çay", ["cay", "poset cay", "demlik cay", "yesil cay", "bitki cayi"]),
    ("Kahve", ["kahve", "kahvesi", "nescafe", "filtre kahve", "turk kahvesi", "espresso"]),
    ("Enerji İçeceği", ["enerji icecegi", "redbull", "red bull", "energy"]),
    # Donuk & Hazır
    ("Pizza", ["pizza"]),
    ("Dondurulmuş Gıda", ["dondurulmus", "donuk", "parmak patates"]),
    ("Hazır Yemek", ["hazir yemek", "mantı", "manti"]),
    # Fırın
    ("Ekmek", ["ekmek", "ekmegi", "bazlama", "lavas", "tost ekmegi"]),
    ("Pasta & Kek", ["pasta", "kek", "kekı", "browni", "muffin"]),
    ("Poğaça & Börek", ["pogaca", "borek", "acma", "simit"]),
    # Dondurma
    ("Dondurma", ["dondurma", "magnum", "cornetto", "maras dondurma"]),
    # Temizlik
    ("Çamaşır Suyu", ["camasir suyu", "domestos", "comert"]),
    ("Çamaşır Deterjanı", ["camasir deterjani", "deterjan", "omo", "ariel", "persil"]),
    ("Bulaşık Deterjanı", ["bulasik deterjani", "bulasik", "fairy", "pril"]),
    ("Yumuşatıcı", ["yumusatici", "yumuşatıcı"]),
    ("Yüzey Temizleyici", ["yuzey temizleyici", "cif", "yuzey temizlik", "cam temizleyici"]),
    ("Çöp Poşeti", ["cop posedi", "cop poseti", "cop torbasi"]),
    # Kağıt & Hijyen
    ("Tuvalet Kağıdı", ["tuvalet kagidi"]),
    ("Kağıt Havlu", ["kagit havlu", "kagit havlusu"]),
    ("Peçete", ["pecete"]),
    ("Islak Mendil", ["islak mendil", "islak havlu", "islak kagit"]),
    # Kişisel Bakım
    ("Şampuan", ["sampuan", "saç bakim", "sac bakim"]),
    ("Sabun", ["sabun", "sabunu"]),
    ("Diş Macunu", ["dis macunu", "dis firca", "dis fircasi"]),
    ("Deodorant", ["deodorant", "deo sprey", "roll on"]),
    ("Duş Jeli", ["dus jeli", "dus jelı"]),
    ("Tıraş", ["tiras", "tiras kopugu", "tiras bicagi"]),
    ("Cilt Bakım", ["cilt bakim", "nemlendirici", "yuz kremi", "el kremi", "vucut losyonu"]),
    ("Ped & Hijyen", ["ped", "hijyenik ped", "gunluk ped", "tampon"]),
    # Bebek
    ("Bebek Bezi", ["bebek bezi", "prima", "molfix"]),
    ("Bebek Maması", ["bebek mamasi", "devam sutu", "kasik mama"]),
    ("Bebek Bakım", ["bebek sampuani", "bebek kremi", "pisik kremi", "bebek islak"]),
    # Pet
    ("Kedi Maması", ["kedi mamasi", "whiskas", "felix", "kedi kumu"]),
    ("Köpek Maması", ["kopek mamasi", "pedigree", "dog"]),
    # Ev & Yaşam
    ("Pil & Aydınlatma", ["pil", "ampul", "duracell"]),
    ("Mutfak Gereçleri", ["streç film", "strec film", "aleminyum folyo", "alüminyum folyo",
                          "pisirme kagidi"]),
    ("Kırtasiye", ["defter", "kalem", "silgi"]),
]

_TR = str.maketrans({"ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g",
                     "ç": "c", "Ç": "c", "ö": "o", "Ö": "o", "ü": "u", "Ü": "u",
                     "â": "a", "Â": "a"})


def _norm(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = t.translate(_TR).lower()
    t = re.sub(r"[^a-z0-9\s]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _score(text: str, tokens: set, keywords: List[str]) -> int:
    s = 0
    for kw in keywords:
        k = _norm(kw)
        if " " in k:
            if k and k in text:
                s += 3
        else:
            if k in tokens:
                s += 1
    return s


def classify(name: str, raw_category: Optional[str] = None,
             ascendants: Optional[List[str]] = None) -> Tuple[str, str]:
    """Classify a product into (top, subcategory). Name is primary signal."""
    name_text = _norm(name)
    name_tokens = set(name_text.split())

    hint_text = _norm(" ".join(filter(None, [raw_category or ""] + (ascendants or []))))
    hint_tokens = set(hint_text.split())

    best_sub, best_score = None, 0
    for sub, kws in _RULES:
        score = _score(name_text, name_tokens, kws) * 2  # name weighted x2
        score += _score(hint_text, hint_tokens, kws)     # raw category as hint
        if score > best_score:
            best_score, best_sub = score, sub

    if best_sub and best_score > 0:
        return (SUB_TO_TOP[best_sub], best_sub)
    return ("Diğer", "Diğer")
