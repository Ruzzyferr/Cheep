"""HIRVATİSTAN — ürün ADINDAN ince kategori etiketi türetir.

NEDEN GEREKLİ: `cijene.dev` arşivinin `category` alanı ÇOK KABA. Ölçüldü
(2026-08-28): Konzum'un 21.907 ürünü yalnızca 6 kategoriye dağılıyor —
HRANA (gıda), PIĆE (içecek), KOZMETIKA, SREDSTVA ZA ČIŠĆENJE (temizlik),
PROIZVODI ZA KUĆANSTVO (ev), TOALETNE POTREPŠTINE. Bu alan olduğu gibi
kullanılırsa uygulamadaki 227 alt kategorinin tamamı boş kalır ve tüm gıda
tek bir dev kovaya düşer: kullanıcı "Süt Ürünleri"ne dokunduğunda deterjan
görür, kategori sayfaları (SEO'nun yarısı) anlamsızlaşır.

ÇÖZÜM: ürün adı. Hırvatça market adları kısaltmalı ve TÜR ADIYLA BAŞLIYOR
("SIR DUKAT 250g", "KRUH RAŽENI", "ZP SENSOD FLUORID 75ML"), dolayısıyla ilk
kelime güçlü bir sinyal. Bu modül adı tarayıp Hırvatça bir ETİKET döndürür;
etiketi kanonik slug'a çeviren tablo `category_map.json`'da durur — Polonya'da
Lehçe kategori adının slug'a çevrilmesiyle birebir aynı desen, aynı yerde,
elle düzeltilebilir.

KISALTMALAR TAHMİN EDİLMEDİ, GERÇEK ÜRÜN ADLARIYLA DOĞRULANDI (2026-08-28,
Konzum kataloğu). Üç tanesi sezgiye aykırı çıktı ve tahminle yazılsaydı ürünler
YANLIŞ kategoriye giderdi:
  • `SV`  = SVINJETINA (domuz eti) — "mum/svijeća" DEĞİL. "SV VRAT", "SV SLABINA"
  • `PEL` = PELINKOVAC (acı likör) — "pelene/bebek bezi" DEĞİL
  • `NEG` = NEGAZIRANO PIĆE (gazsız içecek) — "njega/bakım" DEĞİL
Doğrulananlar: DET=deterdžent, ZP=zubna pasta, OM=omekšivač, TP=toaletni papir,
OSVJ=osvježivač, SLAD=sladoled, GAZ=gazirano piće, JUN=junetina, CAPP=cappuccino,
HIG UL=higijenski uložak, SALVETE=peçete.

SIRA ÖNEMLİ: kurallar İLK EŞLEŞEN kazanır ve özgülden genele sıralanır. Örnek:
"NEG PIĆE" kuralı "PIĆE" kuralından ÖNCE gelmeli, yoksa gazsız meyve suyu genel
"içecek" olur; "SLAD" (sladoled/dondurma) "SLADK"tan önce gelmeli.
"""
from __future__ import annotations

import re
import unicodedata
from typing import List, Optional, Tuple

__all__ = ["classify", "LABELS", "RULES"]


def _fold(text: str) -> str:
    """Aksanları düşürüp büyük harfe çevirir: 'Čokolada' → 'COKOLADA'.

    Kaynak aynı ürünü hem 'PIĆE' hem 'PICE' yazıyor (Konzum vs Plodine) —
    aksana duyarlı eşleştirme zincirlerin yarısını sessizce ıskalardı.
    """
    normalized = unicodedata.normalize("NFKD", text or "")
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    # NFKD 'đ' harfini ayrıştırmıyor (tek kod noktası, birleşen aksan değil).
    return stripped.upper().replace("Đ", "D")


#: (etiket, anahtar kelimeler) — anahtar kelimeler AKSANSIZ BÜYÜK HARF yazılır.
#: Kelime sınırıyla eşleşir, dolayısıyla "SIR" kelimesi "SIRUP" ile eşleşmez.
RULES: List[Tuple[str, Tuple[str, ...]]] = [
    # --- alkol (config'te deny edilecek; önce gelmeli, yoksa "PIVO"→içecek olur)
    ("Alkohol", (
        "VINO", "PIVO", "LIKER", "RAKIJA", "VISKI", "WHISKY", "GIN", "VOTKA", "VODKA",
        "KONJAK", "COGNAC", "PELINKOVAC", "VERMUT", "TEQUILA", "RUM", "PROSEK",
        "LOZOVACA", "TRAVARICA", "SAMPANJAC", "BRANDY", "APERITIV", "BITTER",
    )),

    # --- süt ürünleri
    ("Mlijeko", ("MLIJEKO", "MLIJEKA")),
    ("Sir", ("SIR", "SIREVI", "MOZZARELLA", "GAUDA", "EDAMER", "PARMEZAN", "FETA")),
    ("Jogurt", ("JOGURT", "JOGURTI")),
    ("Vrhnje", ("VRHNJE", "SLAG")),
    ("Maslac", ("MASLAC",)),
    ("Margarin", ("MARGARIN",)),
    ("Sladoled", ("SLAD", "SLADOLED")),
    ("Puding", ("PUDING", "DESERT")),

    # --- et, riba
    ("Meso", ("JUN", "JUNE", "JUNETINA", "SV", "SVINJ", "SVINJETINA", "TELEC",
              "GOVEDINA", "JANJE", "JANJETINA", "ODRESC", "PECENIC", "BUDOL",
              "VRAT", "BUT", "MLJEVENO", "PANCETA", "POLOVICA",
              "TELETINA", "MLJEVENO", "ODREZAK", "BIFTEK")),
    ("Piletina", ("PILETINA", "PILEC", "PURETINA", "PUREC", "PRSA", "BATAK")),
    ("Riba", ("RIBA", "BAKALAR", "KOZIC", "SKAMP", "LIGNJ", "DAGNJ", "SRDEL",
              "PLODOVI MORA", "FILET", "BRANCIN", "ORADA", "LOSOS", "TUNJ", "TUNA", "SKUSA",
              "SRDELA", "OSLIC", "SKAMPI", "LIGNJE", "DAGNJE")),
    ("Suhomesnato", ("SUNKA", "PRSUT", "SALAMA", "PASTETA", "SLANINA", "KULEN",
                     "PANCETA", "MORTADELA")),
    ("Kobasica", ("KOBASICA", "HRENOVKE", "CEVAPI")),

    # --- voće i povrće
    ("Voce", ("JABUKA", "BANANA", "NARANCA", "LIMUN", "GROZDE", "KRUSKA",
              "BRESKVA", "JAGODA", "LUBENICA", "DINJA", "SLJIVA", "MANDARINA",
              "AVOKADO", "ANANAS", "KIVI")),
    ("Povrce", ("SAMPINJON", "KRASTAVC", "TIKVIC", "BROKUL", "SPINAT", "KUPUS",
                "SALATA", "POVRCE", "RAJCICA", "KRUMPIR", "LUK", "MRKVA", "PAPRIKA", "KRASTAVAC",
                "KUPUS", "SALATA", "TIKVICA", "PATLIDZAN", "CESNJAK", "BROKULA",
                "CVJETACA", "SPINAT", "GRASAK")),
    ("Masline", ("MASLINE",)),

    # --- osnovne namirnice
    ("Kruh", ("KRUH", "PECIVO", "BAGUETTE", "TOST")),
    # "PISKOT" BİLEREK BURADA DEĞİL: piškote (kedidili bisküvi) bir KEKS,
    # pasta değil — aşağıdaki Keks kuralına bırakılıyor. Kolac önce geldiği
    # için buraya konsaydı sessizce pastaya giderdi.
    ("Kolac", ("KOLAC", "TORTA", "KREMSNITA", "STRUDLA", "PANETTONE", "PITA",
               "STRU")),
    ("Keks", ("KEKS", "BISKVIT", "PISKOT")),
    ("Vafl", ("VAFL", "VAFEL", "NAPOLITANKE")),
    ("Kreker", ("KREKER", "SLANI STAPICI")),
    ("Cips", ("CIPS", "FLIPS", "SMOKI", "GRICKALICE")),
    ("Cokolada", ("COKOLADA", "COKOL", "PLOCICA", "BAJADERA")),
    ("Bomboni", ("BOMBON", "BOMBONI", "BOMBONJER", "PRALIN", "ZVAKE", "ZELE",
                 "GUMENI", "LIZALICA", "KARAMELA")),
    ("Orasasti plodovi", ("KIKIRIKI", "BADEM", "ORAH", "LJESNJAK", "INDIJSKI",
                          "PISTACIJA", "SJEMENKE")),
    ("Tjestenina", ("TJESTENINA", "TJEST", "TJ.", "FIDELINI", "GARGANELLI",
                    "SPAGETI", "MAKARONI", "LAZANJE",
                    "NJOKI", "REZANCI")),
    ("Riza", ("RIZA",)),
    ("Brasno", ("BRASNO",)),
    ("Secer", ("SECER",)),
    ("Ulje", ("ULJE",)),
    ("Ocat", ("OCAT",)),
    ("Zacin", ("ZACIN", "PAPAR", "SOL", "CIMET", "VEGETA")),
    ("Umak", ("UMAK", "KECAP", "KETCHUP", "PESTO", "MAJONEZA", "SENF", "AJVAR")),
    ("Juha", ("JUHA",)),
    ("Mahunarke", ("GRAH", "LECA", "SLANUTAK", "BOB")),
    ("Konzerva", ("KONZERVA", "PASIRANA", "PELATI")),
    ("Med", ("MED",)),
    ("Dzem", ("DZEM", "MARMELADA", "PEKMEZ")),
    ("Namaz", ("NAMAZ", "KREM CO", "EUROKREM", "LINOLADA")),
    ("Pahuljice", ("PAHULJICE", "MUESLI", "MUSLI", "GRANOLA", "CORNFLAKES")),
    ("Jaja", ("JAJA", "JAJE")),
    ("Gotovo jelo", ("PIZZA", "LAZANJA", "GOTOVO", "SMRZNUT", "POMFRIT")),

    # --- pića (NEG/GAZ kuralları genel PIĆE'den ÖNCE)
    ("Negazirano pice", ("NEG PICE", "NEGAZIRANO")),
    ("Gazirano pice", ("GAZ PICE", "GAZIRANO", "COLA", "PEPSI", "FANTA", "SPRITE",
                       "SCHWEPPES", "TONIC")),
    ("Sok", ("SOK", "NEKTAR", "CEDEVITA")),
    ("Voda", ("VODA", "MINERALNA")),
    ("Kava", ("KAVA", "CAPP", "CAPPUCCINO", "ESPRESSO", "NESCAFE")),
    ("Caj", ("CAJ",)),
    ("Energetsko pice", ("ENERGETSK", "RED BULL", "MONSTER", "HELL")),
    ("Pice", ("PICE", "NAPITAK", "SIRUP")),

    # --- higijena i kozmetika
    ("Zubna pasta", ("ZP", "ZUBNA PASTA", "PASTA ZA ZUBE")),
    ("Zubna cetkica", ("CETKICA", "ZUBNI KONAC", "VODICA ZA USTA")),
    ("Sampon", ("SAMPON",)),
    ("Sapun", ("SAPUN",)),
    # "GEL" TEK BASINA BELIRSIZ: oda kokusu jeli ("OSVJ GLADE 150g GEL"),
    # bulasik jeli, sac jeli hepsi "GEL" iceriyor. Kozmetige KOSULLU olarak
    # ikinci katmana tasindi; burada yalnizca tek anlamli kelimeler kaliyor.
    ("Gel za tusiranje", ("KUPKA", "TUS")),
    ("Dezodorans", ("DEO", "DEZODORANS", "ANTIPERSPIRANT")),
    ("Krema", ("KREMA", "LOSION", "SERUM", "MASKA", "BALZAM")),
    ("Brijanje", ("BRIJAC", "BRIJANJE", "ZILET", "PJENA ZA BRIJANJE")),
    ("Boja za kosu", ("BOJA",)),
    ("Higijenski ulosci", ("HIG UL", "ULOSCI", "TAMPON", "DNEVNI ULOSCI")),
    ("Pelene", ("PELENE", "PAMPERS")),
    ("Hrana za bebe", ("KASICA", "KASA", "ADAPTIRANO MLIJEKO")),

    # --- kućanstvo
    ("Toaletni papir", ("TP", "TOALETNI PAPIR")),
    ("Papirnati rucnik", ("PAPIRNATI RUCNIK", "RUCNIK")),
    ("Salvete", ("SALVETE", "SALV", "MARAMICE")),
    ("Deterdzent za posude", ("DET PUR", "ZA POSUDE", "PERILICU POSUDA", "TABLETE ZA")),
    ("Deterdzent za rublje", ("DET", "PRAH ZA", "ZA RUBLJE", "KAPSULE ZA")),
    ("Omeksivac", ("OM", "OMEKSIVAC")),
    ("Sredstvo za ciscenje", ("CISTAC", "WC", "SREDSTVO", "DEZINFEK", "IZBJELJIVAC")),
    ("Osvjezivac", ("OSVJ", "OSVJEZIVAC", "MIRIS ZA")),
    ("Vrecice za smece", ("VRECICE ZA SMECE", "VRECE ZA SMECE")),
    ("Svijeca", ("SVIJECA", "SVIJECE")),
    ("Folija", ("FOLIJA", "PAPIR ZA PECENJE", "ALU FOLIJA")),

    # --- ostalo
    ("Hrana za kucne ljubimce", ("ZA PSE", "ZA MACKE", "PEDIGREE", "WHISKAS",
                                 "FELIX", "CHAPPI", "FRISKIES", "SHEBA", "GOURMET",
                                 "LECHAT", "KITTY", "WANPY", "DARLING", "BUDDY",
                                 "POSLASTICA", "POSLAST")),
    ("Dodaci prehrani", ("PROTEIN", "VITAMIN", "DODATAK PREHRANI", "MAGNEZIJ")),
]

#: İKİNCİ KATMAN — yalnızca ürünün KABA kategorisi eşleştiğinde uygulanan
#: kurallar. NEDEN AYRI: bu anahtar kelimeler tek başına ÇOK ANLAMLI değil ve
#: birinci katmana konsaydı yanlış eşleşirlerdi. "SPREJ" kozmetikte deodorant
#: ama temizlikte yüzey spreyi; "ROLL"/"STICK" kozmetikte roll-on/stick
#: deodorant ama gıdada rulo börek; "PEL" gıdada PELINKOVAC (likör) iken
#: kozmetikte PELENE (bebek bezi) — birinci katmanda "PEL" yazmak likörü bebek
#: bezi yapardı. Kaba kategoriyle sınırlandırınca hepsi güvenli hale geliyor.
COARSE_RULES: List[Tuple[str, Tuple[str, ...], Tuple[str, ...]]] = [
    # (etiket, anahtar kelimeler, bu kaba kategorilerde geçerli)
    ("Dezodorans", ("ROLL", "STICK", "SPREJ", "DEZ"),
     ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Pelene", ("PEL", "DN"), ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Njega kose", ("REGEN", "REGENER", "REGENERATOR", "REG", "SAMP", "LAK",
                    "PJENA", "VODICA", "TRETMAN"),
     ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Vata i stapici", ("BLAZINICE", "STAPICI", "VATA", "RUPCICI", "PAP"),
     ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Gel za tusiranje", ("GEL",), ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Sminka", ("LIP", "PUDER", "RUZ", "MASKARA", "LAK ZA NOKTE", "RETOUCHER",
                "FLUID", "PILING")),
    ("Flaster", ("FLASTER", "TRAKE"), ("KOZMETIKA", "TOALETNE POTREPSTINE")),
    ("Brijanje", ("PATRONE", "GLAVA"), ("KOZMETIKA", "TOALETNE POTREPSTINE")),

    ("Vrecice za smece", ("VRECA", "VRECICA", "VRECICE"),
     ("PROIZVODI ZA KUCANSTVO", "SREDSTVA ZA CISCENJE")),
    ("Krpe i spuzve", ("KRPA", "SPUZVA", "BRISAC", "ZICA", "METLA", "LOPATICA"),
     ("PROIZVODI ZA KUCANSTVO", "SREDSTVA ZA CISCENJE")),
    ("Rukavice", ("RUKAVICE",), ("PROIZVODI ZA KUCANSTVO", "SREDSTVA ZA CISCENJE")),
    ("Folija", ("ALU",), ("PROIZVODI ZA KUCANSTVO",)),
    ("Hrana za kucne ljubimce", ("HRANA",), ("PROIZVODI ZA KUCANSTVO",)),

    # Gıda tarafındaki kalanlar — kaba kova zaten HRANA olduğu için güvenli.
    ("Tijesto", ("TIJESTO", "CROISSANT", "TOAST", "DVOPEK", "TORTILLA", "PLATA"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Riba", ("LIGNJA", "HOBOTNICA", "GRDOBINA", "SKAMP", "SARDINA", "TRLJA",
              "PAGAR", "SKARPINA", "ZUBATAC"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Piletina", ("PIL",), ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Bomboni", ("ZV", "PRALINE", "BOMB"),
     ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Cokolada", ("COK", "KAKAO"), ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Cips", ("KOKICE", "SNACK", "GRICKAL"), ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Keks", ("KEKSI",), ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Pahuljice", ("PAHULJ",), ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Povrce", ("KUKURUZ", "PIRE"), ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Gotovo jelo", ("SUSHI",), ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Hrana za bebe", ("KAS",), ("HRANA", "PAKIRANA HRANA I PICE")),

    ("Alkohol", ("PJENUSAC", "PROSECCO", "CHAMPAGNE", "CHAMP", "CIDER", "COCKTAIL",
                 "COCKT", "WHISKEY", "BACARDI", "VILJAMOVKA", "BADEL", "STOCK", "HUGO"),
     ("PICE", "PICA", "PAKIRANA HRANA I PICE")),
    ("Sok", ("SMOOTHIE",), ("PICE", "PICA", "PAKIRANA HRANA I PICE")),
    ("Negazirano pice", ("NEGAZ",), ("PICE", "PICA", "PAKIRANA HRANA I PICE")),

    # --- GIDA KOVASINA SINIRLI kısaltmalar (2026-08-29 ölçümü) ------------
    #
    # Bu anahtarlar gıda dışında BAŞKA bir anlama geliyor ve genel kural
    # listesine konsalardı sessizce yanlış kategoriye taşarlardı. Örnekler:
    #   • "PLOC" — çikolata "pločica"sı AMA banyo "pločice"si (fayans) da var
    #   • "PASTA" — makarna AMA "zubna pasta" (diş macunu) da var
    #   • "MRVICE" — galeta unu AMA deterjan "mrvice"si de olabilir
    # Kaba kategori filtresi bu belirsizliği kaynağın kendi beyanıyla çözüyor.
    ("Cokolada", ("COKO", "CHOCO", "COKOLADNI", "PLOC", "PLOCICE"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Mlijeko", ("MLIJ",), ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Suhomesnato", ("NAREZAK", "MESNI", "SUHOMESNAT"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Piletina", ("PILE",), ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Voce", ("MARELICA", "MANGO", "VOCE", "ANANAS", "BRESKVA", "SLJIVA"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Povrce", ("CIKLA", "MRKVICE", "GRASAK", "KELJ", "BLITVA"),
     ("HRANA", "PAKIRANA HRANA I PICE", "SVJEZI ODJELI")),
    ("Tjestenina", ("TJES", "PASTA"),
     ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Kava", ("KAPSULE", "KAPSULA", "INSTANT"),
     ("HRANA", "PAKIRANA HRANA I PICE", "PICE", "PICA")),
    ("Cips", ("STAPICI", "GRICKALIC"),
     ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Brasno", ("MRVICE", "PREZLE"), ("HRANA", "PAKIRANA HRANA I PICE")),
    ("Gotovo jelo", ("BURGER", "PLJESKAVIC", "NUGGETS", "STAPICI OD RIBE"),
     ("HRANA", "PAKIRANA HRANA I PICE", "HLADENO I SMRZNUTO")),
]

LABELS: Tuple[str, ...] = tuple(label for label, _ in RULES)

#: KÖK (prefix) olarak eşleşecek anahtarlar — sonuna ek gelebilir.
#:
#: NEDEN GEREKLİ: Hırvatça yoğun çekimli ve market adları çekimli hâli
#: kullanıyor. Tam-kelime eşleşmesi bu yüzden ıskalıyordu; üretimde ölçüldü
#: (2026-08-29): Hırvat kataloğundaki ürünlerin %21,3'ü hiçbir kurala uymayıp
#: genel "Temel Gıda" kovasına düşüyordu — Macaristan'da bu oran %0,6,
#: Polonya'da %2,3. Yani sorun kaynakta değil, buradaki eşleşmedeydi.
#: Isıklamayan örnekler: JUNEĆA/JUNEĆI (JUN kuralı vardı), KREKERI (KREKER),
#: ŠAMPINJONI, SVINJSKA/SVINJSKI (SV kısaltması vardı ama tam kelime).
#:
#: KÖKLER YALNIZCA BURADA, çünkü prefix eşleşmesi TEHLİKELİ: "SIR" kökü
#: "SIRUP"u (şurup) peynir yapardı, "MED" kökü "MEDENI"yi bal yapardı — bu
#: yüzden varsayılan hâlâ tam kelime. Her kök en az 5 harf ve tek anlamlı
#: olacak şekilde seçildi.
_PREFIX_KEYS: frozenset = frozenset({
    "JUNE", "SVINJ", "TELEC", "JANJE", "PILEC", "PUREC",   # etler
    "KOZIC", "SKAMP", "LIGNJ", "DAGNJ", "SRDEL", "BAKALAR",  # deniz ürünleri
    "SAMPINJON", "KRASTAVC", "TIKVIC", "BROKUL", "SPINAT", "KUPUS",  # sebzeler
    "KREKER", "PANETTONE", "PISKOT", "BOMBONJER", "PRALIN",  # tatlı/atıştırmalık
    "SMRZNUT", "PANIRAN",                                     # donuk/panelenmiş
})


#: Anahtar kelimeler kelime sınırıyla eşleşir — "SIR" 'SIRUP'u, "MED" 'MEDENI'yi
#: yakalamasın. `_PREFIX_KEYS` içindekiler için SAĞ sınır kaldırılır (ek gelebilir).
#: Kurallar bir kez derlenir (katalog başına ~20 bin ürün taranıyor).
def _compile(keys: Tuple[str, ...]) -> "re.Pattern[str]":
    parts = [
        re.escape(k) + ("[A-Z]*" if k in _PREFIX_KEYS else "")
        for k in keys
    ]
    return re.compile(r"(?<![A-Z0-9])(?:" + "|".join(parts) + r")(?![A-Z0-9])")


_COMPILED: List[Tuple[str, "re.Pattern[str]"]] = [
    (label, _compile(keys)) for label, keys in RULES
]

#: Kaba kategoriye koşullu kurallar. `coarse_filter` boşsa her kova için geçerli.
_COMPILED_COARSE: List[Tuple[str, "re.Pattern[str]", Tuple[str, ...]]] = [
    (label, _compile(keys), tuple(_fold(c) for c in (rule[2] if len(rule) > 2 else ())))
    for rule in COARSE_RULES
    for label, keys in ((rule[0], rule[1]),)
]

#: Kaba kategori → yedek etiket. Ad hiçbir kurala uymazsa en azından doğru üst
#: kova bulunur; UYDURULMAZ, kaynak ne diyorsa o.
_COARSE_FALLBACK = {
    "HRANA": "Hrana",
    "PICE": "Pice",
    "PICA": "Pice",
    "KOZMETIKA": "Kozmetika",
    "SREDSTVA ZA CISCENJE": "Sredstvo za ciscenje",
    "PROIZVODI ZA KUCANSTVO": "Kucanstvo",
    "TOALETNE POTREPSTINE": "Kozmetika",
    "PAKIRANA HRANA I PICE": "Hrana",
    "SVJEZI ODJELI": "Hrana",
    "HLADENO I SMRZNUTO": "Gotovo jelo",
    "NEPREHRANA": "Kucanstvo",
}


def classify(name: str, coarse: Optional[str] = None) -> Optional[str]:
    """Ürün adından ince kategori etiketi döner; bulunamazsa kaba kategoriye düşer.

    Dönen etiket `category_map.json` üzerinden kanonik slug'a çevrilir. Hiçbir
    şey bulunamazsa None döner — ürün KATEGORİSİZ kaydedilir ve pipeline'ın
    `report_unmapped_categories` raporunda görünür (sessiz kayıp yok).
    """
    folded = _fold(name)
    for label, pattern in _COMPILED:
        if pattern.search(folded):
            return label

    folded_coarse = _fold(coarse or "").strip()
    for label, pattern, allowed in _COMPILED_COARSE:
        if allowed and folded_coarse not in allowed:
            continue
        if pattern.search(folded):
            return label

    if folded_coarse:
        return _COARSE_FALLBACK.get(folded_coarse)
    return None
