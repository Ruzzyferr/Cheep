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
    "Süt Ürünleri": ["Süt", "Peynir", "Yoğurt", "Tereyağı", "Ayran", "Kefir",
                     "Kaymak & Krema"],
    "Kahvaltılık": ["Yumurta", "Bal", "Reçel", "Zeytin", "Tahin & Pekmez",
                    "Kahvaltılık Gevrek", "Helva"],
    "Temel Gıda": ["Makarna", "Pirinç", "Un", "Şeker", "Tuz", "Bakliyat", "Yağ",
                   "Salça", "Baharat", "Sirke", "Çorba", "Konserve",
                   "Pasta Malzemeleri"],
    "Atıştırmalık": ["Çikolata", "Bisküvi", "Gofret", "Cips", "Kuruyemiş", "Kraker",
                     "Şekerleme", "Sakız", "Tahıllı Bar"],
    "İçecek": ["Su", "Maden Suyu", "Gazlı İçecek", "Meyve Suyu", "Çay", "Kahve",
               "Enerji İçeceği"],
    "Donuk & Hazır Yemek": ["Dondurulmuş Gıda", "Hazır Yemek", "Pizza"],
    "Fırın & Pastane": ["Ekmek", "Pasta & Kek", "Poğaça & Börek"],
    "Dondurma": ["Dondurma"],
    "Temizlik": ["Çamaşır Deterjanı", "Bulaşık Deterjanı", "Çamaşır Suyu",
                 "Yumuşatıcı", "Yüzey Temizleyici", "Çöp Poşeti"],
    "Kağıt & Hijyen": ["Tuvalet Kağıdı", "Kağıt Havlu", "Peçete", "Islak Mendil"],
    "Kişisel Bakım & Kozmetik": ["Şampuan", "Sabun", "Diş Macunu", "Deodorant",
                                  "Duş Jeli", "Tıraş", "Cilt Bakım", "Ped & Hijyen",
                                  "Parfüm & Kolonya", "Makyaj"],
    "Bebek": ["Bebek Bezi", "Bebek Maması", "Bebek Bakım"],
    "Ev & Yaşam": ["Mutfak Gereçleri", "Pil & Aydınlatma", "Kırtasiye",
                   "Cam & Sofra", "Mum & Dekor"],
    "Pet Shop": ["Kedi Maması", "Köpek Maması", "Pet Bakım"],
    "Elektronik": ["Elektronik"],
    "Oyuncak & Hobi": ["Oyuncak"],
    "Giyim & Tekstil": ["Giyim", "Ev Tekstili"],
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
    ("Süt", ["sut", "sutu", "laktozsuz sut", "uht sut", "yagli sut", "milkshake",
             "badem sutu", "badem icecegi", "bademli icecek", "yulaf sutu",
             "soya sutu", "hindistan cevizi icecegi", "cikolatali sut", "muzlu sut",
             "cilekli sut", "kakaolu sut", "sut bazli icecek"]),
    ("Peynir", ["peynir", "peyniri", "kasar", "kashar", "lor", "cokelek", "labne"]),
    ("Yoğurt", ["yogurt", "yogurdu", "probiyotik", "probiyo", "quark", "activia",
                "danino", "yoshake", "babymix", "icilebilir yogurt"]),
    ("Tereyağı", ["tereyagi", "tereyag"]),
    ("Ayran", ["ayran"]),
    ("Kefir", ["kefir", "kefirim", "kefirix", "kefirzadem"]),
    ("Kaymak & Krema", ["kaymak", "sivi krema", "krema santi", "cisil krema",
                        "mutfak kremasi"]),
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
               "kavun", "mandalina", "limon", "seftali", "kiraz", "meyve", "nar",
               "kivi", "kiwi", "avokado", "ananas", "mango", "erik", "kayisi",
               "incir", "nektarin", "greyfurt"]),
    ("Yeşillik", ["maydanoz", "roka", "dereotu", "nane", "yesillik"]),
    ("Kuru Meyve", ["kuru kayisi", "kuru uzum", "kuru incir", "hurma", "kuru meyve"]),
    # Temel Gıda
    ("Makarna", ["makarna", "spagetti", "eriste"]),
    ("Pirinç", ["pirinc", "baldo", "osmancik", "basmati"]),
    ("Un", ["un", "unu"]),
    ("Şeker", ["seker", "toz seker", "kup seker"]),
    ("Tuz", ["tuz", "billur", "efsina"]),
    ("Pasta Malzemeleri", ["maya", "pakmaya", "puding", "kabartma", "krem santi",
                           "jelatin", "vanilin", "kakao", "oetker", "kek malzeme",
                           "pasta sosu", "hindistan cevizi rendesi"]),
    ("Bakliyat", ["mercimek", "nohut", "fasulye", "barbunya", "bakliyat", "bulgur",
                  "kuru fasulye"]),
    ("Yağ", ["aycicek yagi", "zeytinyagi", "misir yagi", "sivi yag", "ayciçek"]),
    ("Salça", ["salca", "salcasi"]),
    ("Baharat", ["baharat", "pul biber", "karabiber", "kimyon", "kekik", "nane kuru"]),
    ("Sirke", ["sirke"]),
    ("Çorba", ["corba", "corbasi"]),
    ("Konserve", ["konserve", "turşu", "tursu"]),
    ("Salça", ["mayonez", "ketcap", "ketchup", "hardal", "calve", "sos", "mayo"]),
    # Atıştırmalık
    ("Gofret", ["gofret"]),
    ("Çikolata", ["cikolata", "cikolatali", "bar cikolata"]),
    ("Bisküvi", ["biskuvi", "biskuvisi", "petibor"]),
    ("Cips", ["cips", "patates cipsi", "doritos", "ruffles", "cheetos", "lays",
              "patos", "cipso", "tortilla"]),
    ("Kuruyemiş", ["kuruyemis", "findik", "fistik", "ceviz", "badem", "leblebi",
                   "antep fistigi", "kaju"]),
    ("Kraker", ["kraker", "grissini", "galeta", "cubuk kraker"]),
    ("Tahıllı Bar", ["tahilli bar", "protein bar", "granola bar", "musli bar", "yulaf bar"]),
    ("Şekerleme", ["sekerleme", "jelibon", "lokum", "marshmallow", "akide"]),
    ("Sakız", ["sakiz", "sakizi"]),
    # İçecek
    ("Gazlı İçecek", ["kola", "cola", "coca", "pepsi", "fanta", "sprite", "gazoz",
                      "soda icecek", "gazli icecek"]),
    ("Maden Suyu", ["maden suyu", "soda"]),
    ("Su", ["su", "dogal kaynak suyu", "kaynak suyu"]),
    ("Meyve Suyu", ["meyve suyu", "meyve nektari", "ice tea", "ledra", "nektar",
                    "suyu", "ayran icecek"]),
    ("Çay", ["cay", "poset cay", "demlik cay", "yesil cay", "bitki cayi"]),
    ("Kahve", ["kahve", "kahvesi", "nescafe", "filtre kahve", "turk kahvesi", "espresso"]),
    ("Enerji İçeceği", ["enerji icecegi", "redbull", "red bull", "energy"]),
    # Donuk & Hazır
    ("Pizza", ["pizza"]),
    ("Dondurulmuş Gıda", ["dondurulmus", "donuk", "parmak patates"]),
    ("Hazır Yemek", ["hazir yemek", "mantı", "manti"]),
    # Fırın
    ("Ekmek", ["ekmek", "ekmegi", "bazlama", "lavas", "tost ekmegi"]),
    ("Pasta & Kek", ["pasta", "kek", "kekı", "browni", "muffin", "cheesecake",
                     "revani", "sufle", "tiramisu", "profiterol", "ekler",
                     "magnolia", "supangle", "kadayif", "baklava"]),
    ("Poğaça & Börek", ["pogaca", "borek", "acma", "simit"]),
    # Dondurma
    ("Dondurma", ["dondurma", "magnum", "cornetto", "maras dondurma", "algida",
                  "carte dor", "golf", "max dondurma", "twister", "calippo"]),
    # Temizlik
    ("Çamaşır Suyu", ["camasir suyu", "domestos", "comert"]),
    ("Çamaşır Deterjanı", ["camasir deterjani", "deterjan", "omo", "ariel", "persil"]),
    ("Bulaşık Deterjanı", ["bulasik deterjani", "bulasik", "fairy", "pril", "mintax"]),
    ("Yumuşatıcı", ["yumusatici", "yumuşatıcı", "vernel", "yumos", "comfort"]),
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
    ("Parfüm & Kolonya", ["kolonya", "parfum", "edt", "edp", "cologne", "after shave"]),
    ("Makyaj", ["ruj", "rimel", "maskara", "oje", "fondoten", "allik", "far",
                "eyeliner", "kapatici"]),
    # Bebek
    ("Bebek Bezi", ["bebek bezi", "prima", "molfix", "sleepy", "onlu bez", "külot bez"]),
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
    ("Cam & Sofra", ["bardak", "tabak", "kase", "tencere", "tava", "paşabahçe",
                     "pasabahce", "saklama kabi", "termos", "matara", "surahi"]),
    ("Mum & Dekor", ["mum", "cerceve", "çerçeve", "biblo", "vazo", "süs", "sus"]),
    # Pet bakım (mama dışı)
    ("Pet Bakım", ["kedi kumu", "kopek tasma", "pet sampuan", "kemik", "kus yemi",
                   "akvaryum", "tasma"]),
    # Non-food top categories
    ("Elektronik", ["telefon", "kulaklik", "kulaklık", "powerbank", "sarj aleti",
                    "şarj aleti", "televizyon", "hoparlor", "mouse", "klavye",
                    "philips", "sinbo", "onvo", "kettle", "blender", "supurge",
                    "süpürge", "tost makinesi", "sac kurutma", "fön", "ütü",
                    "mikrodalga", "airfryer", "kamera", "tablet", "kablo"]),
    ("Oyuncak", ["oyuncak", "puzzle", "yapboz", "lego", "oyun hamuru", "figur",
                 "figür", "peluş", "pelus", "araba oyuncak", "bebek oyuncak"]),
    ("Giyim", ["corap", "çorap", "tisort", "tişört", "terlik", "bornoz", "tayt",
               "atlet", "kulot", "külot", "bot ", "esofman", "eşofman", "pijama"]),
    ("Ev Tekstili", ["nevresim", "carsaf", "çarşaf", "havlu set", "yastik",
                     "yastık", "battaniye", "yorgan", "pike", "havlu seti"]),
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


def _token_matches(kw: str, tokens: set) -> bool:
    """Single-word keyword matches a token exactly, or as a prefix with a short
    Turkish suffix (pekmez->pekmezi, recel->receli, sut->only exact since <4)."""
    if kw in tokens:
        return True
    if len(kw) >= 4:
        for t in tokens:
            if t.startswith(kw) and len(t) - len(kw) <= 2:
                return True
    return False


def _name_match(text: str, tokens: set, keywords: List[str]):
    """Return (matched, last_end_position, hit_count) for keywords against the
    NAME. last_end_position = how far into the name the matched keyword ends;
    the product's *head noun* (category) is conventionally last, so the latest
    match wins ("Çikolatalı Süt"->Süt, "Sütlü Çikolata"->Çikolata)."""
    last, hits = -1, 0
    for kw in keywords:
        k = _norm(kw)
        if not k:
            continue
        if " " in k:
            pos = text.rfind(k)
            if pos >= 0:
                hits += 1
                last = max(last, pos + len(k))
        else:
            if k in tokens:
                hits += 1
                last = max(last, text.rfind(k) + len(k))
            elif len(k) >= 4:
                for t in tokens:
                    if t.startswith(k) and len(t) - len(k) <= 2:
                        hits += 1
                        last = max(last, text.rfind(t) + len(t))
                        break
    return (last >= 0, last, hits)


# Fallback: map a market's own category name -> canonical TOP, used only when the
# product NAME yields no match. Ordered: more specific phrases first.
_RAW_TOP_ALIASES = [
    ("dondurma", "Dondurma"),
    ("kahvalt", "Kahvaltılık"),
    ("sut ", "Süt Ürünleri"), ("sut urun", "Süt Ürünleri"), ("sut ve", "Süt Ürünleri"),
    ("et ", "Et, Tavuk & Balık"), ("tavuk", "Et, Tavuk & Balık"),
    ("balik", "Et, Tavuk & Balık"), ("sarkuteri", "Et, Tavuk & Balık"),
    ("meyve", "Meyve & Sebze"), ("sebze", "Meyve & Sebze"),
    ("dondurulmus", "Donuk & Hazır Yemek"), ("donuk", "Donuk & Hazır Yemek"),
    ("pratik yemek", "Donuk & Hazır Yemek"), ("hazir yemek", "Donuk & Hazır Yemek"),
    ("firin", "Fırın & Pastane"), ("pastane", "Fırın & Pastane"), ("ekmek", "Fırın & Pastane"),
    ("atistirma", "Atıştırmalık"), ("cikolata", "Atıştırmalık"), ("biskuvi", "Atıştırmalık"),
    ("misir gevre", "Kahvaltılık"),
    ("icecek", "İçecek"), ("mesrubat", "İçecek"), ("su ", "İçecek"),
    ("kagit", "Kağıt & Hijyen"),
    ("kisisel bakim", "Kişisel Bakım & Kozmetik"), ("kozmetik", "Kişisel Bakım & Kozmetik"),
    ("makyaj", "Kişisel Bakım & Kozmetik"),
    ("temizlik", "Temizlik"), ("deterjan", "Temizlik"), ("banyo temizley", "Temizlik"),
    ("anne", "Bebek"), ("bebek", "Bebek"), ("cocuk", "Bebek"),
    ("evcil", "Pet Shop"), ("pet", "Pet Shop"),
    ("kolonya", "Kişisel Bakım & Kozmetik"), ("parfum", "Kişisel Bakım & Kozmetik"),
    ("makyaj", "Kişisel Bakım & Kozmetik"), ("kavanoz", "Bebek"), ("mama", "Bebek"),
    ("cekirdek", "Atıştırmalık"), ("kuruyemis", "Atıştırmalık"), ("cerez", "Atıştırmalık"),
    ("meze", "Atıştırmalık"),
    ("elektronik", "Elektronik"),
    ("oyuncak", "Oyuncak & Hobi"),
    ("giyim", "Giyim & Tekstil"), ("aksesuar", "Giyim & Tekstil"), ("tekstil", "Giyim & Tekstil"),
    ("yemeklik", "Temel Gıda"), ("bakliyat", "Temel Gıda"), ("makarna", "Temel Gıda"),
    ("temel gida", "Temel Gıda"), ("baharat", "Temel Gıda"),
    ("ev ", "Ev & Yaşam"), ("yasam", "Ev & Yaşam"), ("mutfak", "Ev & Yaşam"),
    ("saglikli", "Temel Gıda"), ("organik", "Temel Gıda"),
]


def _raw_top(text: str) -> Optional[str]:
    for needle, top in _RAW_TOP_ALIASES:
        if needle in text:
            return top
    return None


# Raw-produce / flavour subcategories — weak: they lose to any product-TYPE match.
_WEAK_SUBS = {"Meyve", "Sebze", "Yeşillik", "Kuru Meyve"}


def classify(name: str, raw_category: Optional[str] = None,
             ascendants: Optional[List[str]] = None) -> Tuple[str, str]:
    """Classify a product into (top, subcategory).

    Primary signal is the NAME, decided by the *head noun* heuristic: the
    keyword that appears LAST in the name wins (Turkish puts the product type
    last — "Çikolatalı Süt"->Süt, "Sütlü Çikolata"->Çikolata, "Elma Sirkesi"->
    Sirke). Ties break on hit count, then rule order. If the name matches no
    rule, fall back to the market's own category (top-level), then "Diğer"."""
    name_text = _norm(name)
    name_tokens = set(name_text.split())

    # Two tiers: product-TYPE subcategories (strong) always beat raw-produce/
    # flavour subcategories (weak), regardless of position — so "Kefir Orman
    # Meyveli" -> Kefir, "Elma Sirkesi" -> Sirke, "Limon Kokulu Sabun" -> Sabun.
    # Within a tier the latest-positioned (head-noun) match wins.
    strong_best = weak_best = None
    for idx, (sub, kws) in enumerate(_RULES):
        matched, last_pos, hits = _name_match(name_text, name_tokens, kws)
        if not matched:
            continue
        cand = (last_pos, hits, -idx, sub)
        if sub in _WEAK_SUBS:
            if weak_best is None or cand[:3] > weak_best[:3]:
                weak_best = cand
        else:
            if strong_best is None or cand[:3] > strong_best[:3]:
                strong_best = cand
    # 1) a product-TYPE keyword in the name is the strongest signal
    if strong_best is not None:
        return (SUB_TO_TOP[strong_best[3]], strong_best[3])

    # market's own category — tier it too (a product-TYPE hint like "Dondurulmuş
    # Patates" must beat a raw-produce hint like "patates"->Sebze)
    hint_text = _norm(" ".join(filter(None, [raw_category or ""] + (ascendants or []))))
    hint_tokens = set(hint_text.split())
    s_sub = s_sc = w_sub = w_sc = None
    s_sc = w_sc = 0
    for sub, kws in _RULES:
        sc = _score(hint_text, hint_tokens, kws)
        if sc <= 0:
            continue
        if sub in _WEAK_SUBS:
            if sc > w_sc:
                w_sc, w_sub = sc, sub
        elif sc > s_sc:
            s_sc, s_sub = sc, sub

    # 2) strong (product-type) hint from the market category
    if s_sub:
        return (SUB_TO_TOP[s_sub], s_sub)
    # 3) market top-level category authority (raw "Atıştırmalık"/"Kolonya"/"Mama")
    top = _raw_top(hint_text + " ")
    if top:
        return (top, "Genel")
    # 4) a raw-produce/flavour word in the name
    if weak_best is not None:
        return (SUB_TO_TOP[weak_best[3]], weak_best[3])
    # 5) raw-produce hint
    if w_sub:
        return (SUB_TO_TOP[w_sub], w_sub)

    return ("Diğer", "Diğer")
