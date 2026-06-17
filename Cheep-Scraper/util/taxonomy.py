"""
Canonical, name-first product taxonomy + classifier.

The permanent solution to the cross-market category problem: every market names
and groups its categories differently (10 vs 20 categories, different labels),
so we IGNORE the market's own category and classify each product into ONE shared
canonical taxonomy — primarily from the product NAME (consistent across markets),
with the market's raw category as a weak hint.

Matching is token-based (whole tokens + phrases) to avoid substring false
positives like "balığı" (fish) matching "bal" (honey).

Tier model (highest priority first), so the head noun never loses to a flavour
or a packaging word:
  0. BABY     — "bebek/bebe" products win over their adult look-alikes
                ("Bebek Şampuanı" -> Bebek, not Şampuan).
  1. NONFOOD  — soap/shampoo/cologne/detergent/pet/toy/textile form words win
                over a trailing food scent ("Sıvı Sabun Hindistan Cevizi" -> Sabun).
  2. FROZEN   — ice-cream brand/type words win over a flavour
                ("Magnum Badem" -> Dondurma, not Kuruyemiş).
  3. STRONG   — ordinary food product-TYPE words; head-noun (latest) decides
                within the tier ("Çikolatalı Süt" -> Süt). Electronics & home-
                ware live here too, so "Çay Makinesi" -> Elektronik but
                "Bardak Ayran" -> Ayran (the food head noun wins).
  4. WEAK     — raw produce / flavour words; lose to any product-type word.
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
                     "Kaymak & Krema", "Sütlü Tatlı"],
    "Kahvaltılık": ["Yumurta", "Bal", "Reçel", "Zeytin", "Tahin & Pekmez",
                    "Kahvaltılık Gevrek", "Helva"],
    "Temel Gıda": ["Makarna", "Pirinç", "Un", "Şeker", "Tuz", "Bakliyat", "Yağ",
                   "Salça", "Baharat", "Sirke", "Çorba", "Konserve",
                   "Pasta Malzemeleri"],
    "Atıştırmalık": ["Çikolata", "Bisküvi", "Gofret", "Cips", "Kuruyemiş", "Kraker",
                     "Şekerleme", "Sakız", "Tahıllı Bar"],
    "Sağlık & Takviye": ["Vitamin & Takviye", "Spor Gıdası"],
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
    # --- BABY (tier 0) -- handled first so baby look-alikes never leak to adult
    ("Bebek Bezi", ["bebek bezi", "prima", "molfix", "sleepy bebek", "onlu bez",
                    "külot bez", "kulot bez", "bebek bez", "canbebe", "joonies",
                    "evony", "pampers", "huggies"]),
    ("Bebek Maması", ["bebek mamasi", "devam sutu", "kasik mama", "bebek sutu",
                      "bebe biskuvi", "bebe biskuvisi", "cicibebe", "cici bebe",
                      "kavanoz mama", "bebek atistirma", "ek gida", "ek besin",
                      "gerber", "hipp", "aptamil", "bebelac", "milupa", "hero baby",
                      "humm organik", "milumil", "mamadem", "bebek bisküvisi",
                      "bebe biskuvi", "bebek pure", "bebek püre", "cocuk biskuvisi"]),
    ("Bebek Bakım", ["bebek sampuani", "bebe sampuani", "bebek kremi", "pisik kremi",
                     "bebek islak", "biberon", "emzik", "bebek bardagi", "mama kasigi",
                     "bebek sabunu", "bebek kolonyasi", "bebek kolonya", "bebek losyonu",
                     "bebek yagi", "bebek vucut", "bebek gunes", "cocuk gunes",
                     "cocuklar icin gunes", "kolay tarama", "babysanft", "uni baby",
                     "unibaby", "dalin", "sebamed bebe", "sebamed sun bebe",
                     "johnsons baby", "johnson s baby", "hipp babysanft", "baby turco",
                     "pure baby", "bebek bakim", "mama onlugu", "bebek bakim ortusu",
                     "bebek diş", "bebek dis", "bici bici", "bicibici", "bebek pisik"]),
    # --- Süt Ürünleri (strong) -------------------------------------------------
    ("Süt", ["sut", "sutu", "laktozsuz sut", "uht sut", "yagli sut", "milkshake",
             "badem sutu", "badem icecegi", "bademli icecek", "yulaf sutu",
             "yulafli icecek", "soya sutu", "soya icecegi", "hindistan cevizi icecegi",
             "hindistan cevizli icecek", "cikolatali sut", "muzlu sut",
             "cilekli sut", "kakaolu sut", "sut bazli icecek", "sutlu icecek",
             "bitkisel icecek", "bitkisel bazli icecek", "findik icecegi",
             "findikli icecek", "yulaf icecegi", "badem barista", "yulaf barista",
             "kahveli sutlu icecek", "protein sut", "protein icecek"]),
    ("Peynir", ["peynir", "peyniri", "kasar", "kashar", "lor", "cokelek", "labne",
                "tulum peyniri", "beyaz peynir", "krem peynir", "kasar peyniri",
                "quark", "surulebilir peynir"]),
    ("Yoğurt", ["yogurt", "yogurdu", "probiyotik", "probiyo", "activia",
                "danino", "yoshake", "babymix", "icilebilir yogurt", "suzme yogurt",
                "kefir yogurt"]),
    ("Tereyağı", ["tereyagi", "tereyag", "kase margarin", "paket margarin",
                  "margarin"]),
    ("Ayran", ["ayran", "bardak ayran"]),
    ("Kefir", ["kefir", "kefirim", "kefirix", "kefirzadem"]),
    ("Kaymak & Krema", ["kaymak", "sivi krema", "krema santi", "cisil krema",
                        "mutfak kremasi", "sef krema", "sef kremasi", "yagli krema",
                        "kahvaltilik kaymak"]),
    ("Sütlü Tatlı", ["sutlu tatli", "muhallebi", "sutlac", "kazandibi", "keskul",
                     "supangle", "krem karamel", "trilece", "profiterol", "puding",
                     "danette", "sutlu puding", "kakaolu puding", "gullac"]),
    # --- Kahvaltılık -----------------------------------------------------------
    ("Yumurta", ["yumurta", "yumurtasi"]),
    ("Bal", ["bal", "bali", "petek bal", "suzme bal"]),
    ("Reçel", ["recel", "marmelat", "receli"]),
    ("Zeytin", ["zeytin", "zeytini", "yesil zeytin", "siyah zeytin"]),
    ("Tahin & Pekmez", ["tahin", "pekmez", "findik ezmesi", "fistik ezmesi",
                        "yer fistigi ezmesi", "fistik kremasi", "findik kremasi",
                        "kakaolu findik kremasi", "krem cikolata", "kakao kremasi",
                        "cokokrem", "cokollata", "surulebilir", "kakaolu krem",
                        "nutella", "sarelle", "fındık püresi", "findik puresi",
                        "kakao findik", "tahin pekmez", "tahin helva",
                        "findikli krema", "fistikli krema", "kakaolu krema",
                        "fistik kremasi", "fistigi kremasi", "findigi kremasi",
                        "frema", "fiskokrem", "kakaolu findik kremasi"]),
    ("Kahvaltılık Gevrek", ["gevrek", "gevregi", "musli", "granola", "mosli",
                            "misir gevregi", "corn flakes", "cornflakes",
                            "mısır gevreği", "kahvaltilik gevrek", "tahil halkalari"]),
    ("Helva", ["helva"]),
    # --- Et, Tavuk & Balık ----------------------------------------------------
    ("Balık", ["balik", "baligi", "ton baligi", "somon", "levrek", "cipura",
               "hamsi", "palamut", "uskumru", "midye", "karides", "deniz urunleri",
               "kalamar", "surimi", "sardalya"]),
    ("Tavuk", ["tavuk", "tavugu", "pilic", "but", "gogus", "kanat", "bonfile tavuk",
               "tavuk bonfile", "pilic bonfile", "tavuk but", "tavuk kanat",
               "tavuk gogus", "pilic gogus"]),
    ("Kırmızı Et", ["dana", "kuzu", "kiyma", "biftek", "bonfile", "kusbasi",
                    "kirmizi et", "antrikot", "kontrfile", "pirzola", "dana eti"]),
    ("Sucuk & Salam", ["sucuk", "salam", "sosis", "hot dog", "hotdog"]),
    ("Şarküteri", ["sarkuteri", "pastirma", "jambon", "fume et", "fume dil",
                   "kavurma", "rozbif", "roast beef", "dana fume", "fume",
                   "dilimli fume"]),
    # --- Meyve & Sebze (WEAK tier) --------------------------------------------
    ("Sebze", ["domates", "salatalik", "biber", "patlican", "sogan", "patates",
               "havuc", "kabak", "sebze", "marul", "ispanak", "brokoli", "sarimsak",
               "hiyar", "kereviz", "mantar", "pirasa", "enginar", "misir", "mısır",
               "bezelye", "bakla", "turp", "pancar", "karnabahar", "barbunya taze"]),
    ("Meyve", ["elma", "muz", "portakal", "armut", "uzum", "cilek", "karpuz",
               "kavun", "mandalina", "limon", "seftali", "kiraz", "meyve", "nar",
               "kivi", "kiwi", "avokado", "ananas", "mango", "erik", "kayisi",
               "incir", "nektarin", "greyfurt", "yaban mersini", "blueberry",
               "bogurtlen", "böğürtlen", "ahududu", "visne", "ayva", "trabzon hurmasi"]),
    ("Yeşillik", ["maydanoz", "roka", "dereotu", "nane", "yesillik", "semizotu",
                  "salata", "kivircik", "tere", "feslegen", "pazi",
                  "kuzu kulagi", "asma yapragi taze"]),
    ("Kuru Meyve", ["kuru kayisi", "kuru uzum", "kuru incir", "hurma", "kuru meyve",
                    "elma kurusu", "portakal kurusu", "dalindan kuru"]),
    # --- Temel Gıda -----------------------------------------------------------
    ("Makarna", ["makarna", "spagetti", "eriste", "noodle", "tortellini",
                 "tortelloni", "sehriye", "kalem makarna", "fiyonk makarna"]),
    ("Pirinç", ["pirinc", "baldo", "osmancik", "basmati", "pilavlik"]),
    ("Un", ["un", "unu", "nisasta", "nisastasi", "misir nisastasi", "bugday nisastasi",
            "irmik", "galeta unu", "koy ekmegi karisimi", "un karisimi"]),
    ("Şeker", ["toz seker", "kup seker", "kesme seker", "esmer seker", "pudra sekeri",
               "kristal seker", "kup sekeri", "cay sekeri", "kahve sekeri",
               "kitlama", "kitlama seker", "sivi seker"]),
    ("Tuz", ["tuz", "billur", "efsina", "kaya tuzu", "deniz tuzu"]),
    ("Pasta Malzemeleri", ["maya", "pakmaya", "kabartma", "krem santi",
                           "jelatin", "vanilin", "kakao tozu", "toz kakao", "oetker",
                           "kek malzeme",
                           "pasta sosu", "hindistan cevizi rendesi",
                           "damla cikolata", "pul cikolata", "kuvertur", "parca cikolata",
                           "kek karisimi", "pasta kremasi", "pastaci kremasi",
                           "pasta susu", "pasta yardimci", "browni karisimi",
                           "pankek karisimi", "waffle karisimi", "toz tatli",
                           "toz fistik", "toz findik", "toz badem", "dilimlenmis badem",
                           "dilimlenmis findik", "kiyilmis findik", "dolmalik fistik",
                           "cam fistik", "pirinc patlagi susu"]),
    ("Bakliyat", ["mercimek", "nohut", "fasulye", "barbunya", "bakliyat", "bulgur",
                  "kuru fasulye", "chia", "keten tohumu", "kinoa", "asurelik bugday",
                  "cin misir", "patlatmalik misir"]),
    ("Yağ", ["aycicek yagi", "zeytinyagi", "misir yagi", "sivi yag", "ayciçek",
             "zeytin yagi", "kanola yagi", "findik yagi"]),
    ("Salça", ["salca", "salcasi"]),
    ("Baharat", ["baharat", "pul biber", "karabiber", "kimyon", "kekik", "nane kuru",
                 "cesni", "cesnisi", "harci", "tavuk harci", "tane biber"]),
    ("Sirke", ["sirke"]),
    ("Çorba", ["corba", "corbasi", "bulyon", "et bulyon", "tavuk bulyon",
               "sivi bulyon", "tavuk suyu", "et suyu", "kemik suyu",
               "ilikli kemik suyu", "hazir corba", "cabuk corba"]),
    ("Konserve", ["konserve", "turşu", "tursu", "domates puresi", "domates rendesi",
                  "domates rendes", "dogranmis domates", "kurutulmus domates",
                  "soyulmus domates", "kuru domates", "kozlenmis", "kozlenmis biber",
                  "kozlenmis patlican", "patates puresi", "biber iplikleri",
                  "asma yaprak", "salamura", "rendelenmis", "rendelenmis domates",
                  "garnitur", "bezelye konserve", "misir konserve",
                  "kurutulmus patlican", "kuru sebze"]),
    ("Salça", ["mayonez", "ketcap", "ketchup", "hardal", "calve", "sos", "mayo",
               "limon suyu", "barbeku sos", "nar eksisi"]),
    # --- Atıştırmalık ---------------------------------------------------------
    ("Gofret", ["gofret", "wafer", "wafers", "petito", "kat kat tat"]),
    ("Çikolata", ["cikolata", "cikolatali", "bar cikolata", "tablet cikolata",
                  "sutlu cikolata", "bitter cikolata", "beyaz cikolata", "draje cikolata"]),
    ("Bisküvi", ["biskuvi", "biskuvisi", "petibor", "kurabiye", "kurabiyesi",
                 "potibor", "petit beurre", "krakerli biskuvi", "cookies", "cookie",
                 "biskrem", "rondo", "hanimeller", "hosbes", "cizibis", "halley"]),
    ("Cips", ["cips", "patates cipsi", "doritos", "ruffles", "cheetos", "lays", "lay",
              "patos", "cipso", "tortilla", "patlamis misir", "popcorn",
              "misir cerezi", "cizi", "crax", "cerezos", "cerezza", "critos",
              "kritos", "gong", "ringo", "misir cipsi", "nohut cipsi",
              "mikrodalga misir", "patlayan misir", "kettle popcorn", "misir cerez",
              "soslu misir", "misir cips"]),
    ("Kuruyemiş", ["kuruyemis", "findik", "fistik", "ceviz", "badem", "leblebi",
                   "antep fistigi", "kaju", "cekirdek", "cekirdegi",
                   "kabak cekirdegi", "ay cekirdegi", "cekirdek kabak",
                   "aycekirdek", "aycekirdegi", "ay cekirdek", "yer fistigi",
                   "kuru yemis", "cerez", "freeze fresh", "freeze dried",
                   "kurutulmus meyve cips"]),
    ("Kraker", ["kraker", "grissini", "galeta", "cubuk kraker", "pirinc patlagi",
                "misir patlagi", "pirinc patlak", "etimek", "kitir", "ekmek kitiri",
                "wasa", "gevrek kraker"]),
    ("Tahıllı Bar", ["tahilli bar", "protein bar", "granola bar", "musli bar", "yulaf bar",
                     "meyve bar", "yulafli bar", "kup bar", "meyveli bar", "tahil bar",
                     "proteinli bar", "meyve topu", "meyve toplari", "fit bar"]),
    ("Şekerleme", ["sekerleme", "jelibon", "lokum", "marshmallow", "akide",
                   "pastil", "pestil", "meyve pestili", "bonbon", "yumusak seker",
                   "sert seker", "akide sekeri", "draje", "lolipop", "lipop",
                   "metre seker", "mevlana sekeri", "leblebi sekeri", "horoz sekeri",
                   "badem sekeri", "misket sekeri", "eksi seker", "tofita",
                   "yenilebilir seker", "cubuk seker", "surpriz yumurta",
                   "cikolatali yumurta", "sekerli yumurta", "haribo", "bebeto",
                   "yupo", "chamallows", "jelly", "olips", "mentos", "chupa chups",
                   "tofita", "pez"]),
    ("Sakız", ["sakiz", "sakizi"]),
    # --- Sağlık & Takviye (strong; beat produce flavour words) ----------------
    ("Vitamin & Takviye", ["multivitamin", "vitamini", "kolajen", "collagen",
                           "takviye", "omega 3", "probiyotik takviye", "biotin",
                           "magnezyum", "c vitamini", "d3 vitamini", "mineral takviye",
                           "ari sutu", "apitera", "apiterapi",
                           "efervesan", "pharmaton", "saşe vitamin", "cinko tablet",
                           "besin mayasi"]),
    ("Spor Gıdası", ["protein tozu", "whey", "spor gidasi", "spor gıdası",
                     "creatine", "kreatin", "aminoasit", "bcaa", "gainer",
                     "sporcu icecegi", "protein shake"]),
    # --- İçecek ---------------------------------------------------------------
    ("Gazlı İçecek", ["kola", "cola", "coca", "pepsi", "fanta", "sprite", "gazoz",
                      "soda icecek", "gazli icecek", "tonik"]),
    ("Maden Suyu", ["maden suyu", "soda", "mineralli su"]),
    ("Su", ["su", "dogal kaynak suyu", "kaynak suyu"]),
    ("Meyve Suyu", ["meyve suyu", "meyve nektari", "ice tea", "ledra", "nektar",
                    "suyu", "ayran icecek", "meyveli icecek", "multivitamin icecek",
                    "vitaminli icecek", "karisik icecek", "kids icecek",
                    "sicak cikolata", "icecek tozu", "kakaolu toz icecek", "shot icecek"]),
    ("Çay", ["cay", "poset cay", "demlik cay", "yesil cay", "bitki cayi",
             "meyve cayi", "karisik meyve cayi", "teekanne", "bardak poset",
             "kusburnu cayi", "ihlamur cayi", "form cay", "fit tea", "siyah cay",
             "bitki cay"]),
    ("Kahve", ["kahve", "kahvesi", "nescafe", "filtre kahve", "turk kahvesi",
               "espresso", "cappuccino", "latte icecek", "kahveli icecek"]),
    ("Enerji İçeceği", ["enerji icecegi", "redbull", "red bull", "energy"]),
    # --- Donuk & Hazır --------------------------------------------------------
    ("Pizza", ["pizza"]),
    ("Dondurulmuş Gıda", ["dondurulmus", "donuk", "parmak patates", "pane",
                          "dondurulmus sebze", "rulo borek", "dondurulmus hamur"]),
    ("Hazır Yemek", ["hazir yemek", "mantı", "manti", "pratik yemek", "humus",
                     "cig kofte", "lahmacun", "meze", "patlican ezme",
                     "patlican salatasi", "rus salatasi", "kelle paca"]),
    # --- Fırın ----------------------------------------------------------------
    ("Ekmek", ["ekmek", "ekmegi", "bazlama", "lavas", "tost ekmegi", "tava ekmegi",
               "sandvic ekmegi", "burger ekmegi"]),
    ("Pasta & Kek", ["pasta", "kek", "kekı", "browni", "muffin", "cheesecake",
                     "revani", "sufle", "tiramisu", "ekler",
                     "magnolia", "kadayif", "baklava", "tart", "beze", "pankek",
                     "waffle", "sobiyet", "burma tatli", "paykek", "popkek", "dankek",
                     "topkek", "luppo", "sandvic kek", "kek bar"]),
    ("Poğaça & Börek", ["pogaca", "borek", "acma", "simit", "kruvasan", "kroasan",
                        "boregi", "pide", "su boregi", "yufka"]),
    # --- Dondurma (FROZEN tier) -----------------------------------------------
    ("Dondurma", ["dondurma", "magnum", "cornetto", "maras dondurma", "algida",
                  "carte dor", "carte d or", "golf", "max dondurma", "twister",
                  "calippo", "freedo", "kornet", "vienetta", "viennetta", "nogger",
                  "frigo", "alaska frigo", "alaska", "boncremo", "bon cremo",
                  "fantastico", "vini", "conboo", "minimilk", "mini milk",
                  "maras dondurmasi", "kap dondurma", "stick dondurma",
                  "kechy", "mis gold dondurma", "dondurmasi"]),
    # --- Temizlik (NONFOOD) ---------------------------------------------------
    ("Çamaşır Suyu", ["camasir suyu", "domestos", "comert"]),
    ("Çamaşır Deterjanı", ["camasir deterjani", "deterjan", "omo", "ariel", "persil",
                           "leke cikarici", "vanish", "camasir kapsulu", "camasir sodasi",
                           "calgon", "kirec onleyici", "matik", "giysi sampuani",
                           "camasir parfumu"]),
    ("Bulaşık Deterjanı", ["bulasik deterjani", "bulasik", "fairy", "pril", "mintax",
                           "bulasik makinesi", "bulasik makinesi tableti",
                           "bulasik tableti", "makine tableti", "makine deterjani",
                           "bulasik tuzu", "makine tuzu", "parlatici", "finish",
                           "somat", "calgonit"]),
    ("Yumuşatıcı", ["yumusatici", "yumuşatıcı", "vernel", "yumos", "bingo soft",
                    "peros soft", "yumosatici"]),
    ("Yüzey Temizleyici", ["yuzey temizleyici", "cif", "yuzey temizlik", "cam temizleyici",
                           "temizleyici", "temizleyicisi", "kirec cozucu", "kir cozucu",
                           "yuzey temizleme havlusu", "yuzey temizlik havlusu",
                           "temizlik havlusu", "temizleme havlusu", "yag cozucu",
                           "arap sabunu", "genel temizlik", "zemin temizleyici",
                           "lavabo acici", "wc blok", "tuz ruhu", "ovma kremi",
                           "kirec sokucu"]),
    ("Çöp Poşeti", ["cop posedi", "cop poseti", "cop torbasi"]),
    # --- Kağıt & Hijyen (NONFOOD) ---------------------------------------------
    ("Tuvalet Kağıdı", ["tuvalet kagidi", "islak tuvalet kagidi"]),
    ("Kağıt Havlu", ["kagit havlu", "kagit havlusu", "rulo havlu", "dev havlu",
                     "jumbo havlu", "el ve yuz havlusu", "el yuz havlusu"]),
    ("Peçete", ["pecete"]),
    ("Islak Mendil", ["islak mendil", "islak havlu", "islak kagit"]),
    # --- Kişisel Bakım (NONFOOD) ----------------------------------------------
    ("Şampuan", ["sampuan", "saç bakim", "sac bakim", "sac kremi", "sac maskesi",
                 "sac serumu", "sac tonigi", "keratin", "durulanmayan krem",
                 "sac bakim yagi", "sac boyasi", "sac boya", "sac boyama", "krem boya",
                 "palette", "koleston", "natural colors", "color shampoo", "fon suyu",
                 "fon sutu", "kuru sampuan", "sac spreyi", "sac sprey",
                 "deniz tuzu sprey"]),
    ("Sabun", ["sabun", "sabunu"]),
    ("Diş Macunu", ["dis macunu", "dis firca", "dis fircasi", "agiz bakim",
                    "agiz suyu", "gargara", "colgate", "sensodyne", "ipana",
                    "oral b", "parodontax", "signal", "dis ipi"]),
    ("Deodorant", ["deodorant", "deo sprey", "roll on", "deo stick"]),
    ("Duş Jeli", ["dus jeli", "dus jelı"]),
    ("Tıraş", ["tiras", "tiras kopugu", "tiras bicagi", "tuy dokucu", "agda",
               "epilasyon", "tuy dokucu krem"]),
    ("Cilt Bakım", ["cilt bakim", "nemlendirici", "yuz kremi", "el kremi", "vucut losyonu",
                    "makyaj temizleme", "makyaj temizleyici", "micellar", "misel",
                    "bronzlastirici", "bronzing", "gunes yagi", "gunes kremi",
                    "after sun", "peeling", "serum", "leke kremi", "aydinlatici krem",
                    "gunes koruyucu", "gunes koruma", "spf", "yuz maskesi",
                    "cilt serumu", "tonik krem", "vucut sutu", "gunes sutu",
                    "yuz temizleme", "gul suyu", "temizleme suyu", "mucizevi su",
                    "cay agaci", "tonik", "kil maskesi", "vucut kremi", "el yuz kremi",
                    "tirnak torpusu", "gunes spreyi", "gunes sonrasi"]),
    ("Ped & Hijyen", ["ped", "hijyenik ped", "gunluk ped", "tampon", "orkid",
                      "kotex", "molped", "ultra ped", "gece pedi", "regl"]),
    ("Parfüm & Kolonya", ["kolonya", "parfum", "edt", "edp", "cologne", "after shave",
                          "vucut spreyi", "body mist", "vucut misti", "deo parfum"]),
    ("Makyaj", ["ruj", "rimel", "maskara", "oje", "fondoten", "allik", "far",
                "eyeliner", "kapatici", "makyaj", "aseton", "oje cikarici",
                "goz kalemi", "kas kalemi", "dudak kalemi", "goz kalem", "kas kalem",
                "lipgloss", "dudak parlatici", "highlighter"]),
    # --- Pet Shop (NONFOOD) ---------------------------------------------------
    ("Kedi Maması", ["kedi mamasi", "whiskas", "felix", "kedi kumu", "kedi", "sheba",
                     "friskies", "gourmet gold", "gourmet perle", "perfect fit",
                     "kitekat", "proplan", "pro plan", "royal canin", "reflex",
                     "bonnie", "spelly", "bestpet", "dreamies", "me-o", "matsi",
                     "yas kedi", "kedi pouch", "kedi odul", "kedi mama"]),
    ("Köpek Maması", ["kopek mamasi", "pedigree", "kopek", "yas kopek", "kopek odul",
                      "kopek mama", "dost pati"]),
    ("Pet Bakım", ["kedi kumu", "kopek tasma", "pet sampuan", "kus yemi",
                   "akvaryum balik", "tasma", "evcil hayvan", "evcil", "egitim pedi",
                   "kedi oyuncak", "pet oyuncak", "cigneme kemigi", "pets",
                   "oyuncagi", "evcil hayvan oyuncagi", "kedi macunu", "mama kabi",
                   "gezdirme", "frizbi", "oltasi", "kaka torbasi", "gaga tasi",
                   "alistirma pedi", "pet bardak"]),
    # --- Oyuncak & Hobi (NONFOOD) ---------------------------------------------
    ("Oyuncak", ["oyuncak", "puzzle", "yapboz", "lego", "oyun hamuru", "figur",
                 "figür", "peluş", "pelus", "araba oyuncak", "bebek oyuncak",
                 "sisme yatak", "deniz yatak", "deniz simidi", "deniz simit",
                 "sisme havuz", "kolluk", "can yelegi", "oyuncagi", "oyun seti",
                 "su tabancasi", "su silahi", "su topu", "su diski", "su bombasi",
                 "su balonu", "can simidi", "bestway", "intex", "hot wheels",
                 "barbie", "matchbox", "fisher price", "gokidy", "toysup", "tombala",
                 "tuz boyama", "kum boyama", "boyama seti", "crossbow"]),
    # --- Giyim & Tekstil (NONFOOD) --------------------------------------------
    ("Giyim", ["corap", "çorap", "tisort", "tişört", "terlik", "bornoz", "tayt",
               "atlet", "kulot", "külot", "bot ", "esofman", "eşofman", "pijama",
               "body", "yelek", "sapka", "tshirt"]),
    ("Ev Tekstili", ["nevresim", "carsaf", "çarşaf", "havlu set", "yastik",
                     "yastık", "battaniye", "yorgan", "pike", "havlu seti",
                     "banyo havlusu", "yuz havlusu", "el havlusu", "ayak havlusu",
                     "pestemal", "masa ortusu", "minder", "runner"]),
    # --- Elektronik (STRONG; position decides vs food) ------------------------
    ("Elektronik", ["telefon", "kulaklik", "kulaklık", "powerbank", "sarj aleti",
                    "şarj aleti", "televizyon", "hoparlor", "mouse", "klavye",
                    "philips", "sinbo", "onvo", "kettle", "blender", "supurge",
                    "süpürge", "tost makinesi", "sac kurutma", "fön", "ütü",
                    "kamera", "tablet bilgisayar", "kablo",
                    "vantilator", "vantilatör", "fan", "fani", "el fani",
                    "ventilator", "el feneri", "makinesi", "makine", "su isiticisi",
                    "su isitici", "su sebili", "sebil", "cay makinesi",
                    "kahve makinesi", "notebook", "laptop", "yazici", "printer",
                    "usb bellek", "hard disk", "uydu alici", "speaker", "mikrofon",
                    "projeksiyon", "tv box", "coklu priz", "uzatma kablo",
                    "buharli temizleyici", "nemlendirici cihaz", "hava temizleyici",
                    "tarti", "baskul", "mini firin", "midi firin", "turbo firin",
                    "ekmek kizartma", "fritoz", "epilator", "dustopen"]),
    # --- Ev & Yaşam (STRONG; position decides vs food) ------------------------
    ("Mutfak Gereçleri", ["streç film", "strec film", "aleminyum folyo",
                          "alüminyum folyo", "pisirme kagidi", "kek kalibi",
                          "muffin kalibi", "muffin kabi", "kek fanusu", "narenciye sikacagi",
                          "limonluk", "sos sisesi", "pet sisesi", "su torbasi",
                          "sicak su torbasi", "cay filtresi", "kahve filtresi",
                          "kahve kagidi", "filtre kahve kagidi", "cay demleme", "cezve",
                          "filtre kagidi", "kagit havlu rafi", "havluluk", "pompa",
                          "el pompasi", "damacana pompasi", "sisirme pompasi",
                          "top pompasi", "suzgec", "kevgir", "ekmeklik",
                          "mutfak bicagi", "ekmek bicagi", "tirtikli bicak",
                          "saklama kabi", "mutfak gereci", "dograyici",
                          "pirinc suzgeci", "mantı kalıbı", "manti kalibi",
                          "kurabiye sekillendirici", "degirmen", "ogutucu",
                          "kiyma makinesi", "pipet", "sos tavasi",
                          "sekerlik", "sunum tahtasi", "el rendesi", "sebze rendesi"]),
    ("Pil & Aydınlatma", ["pil", "ampul", "duracell", "led ampul", "fener",
                          "el feneri", "isildak", "led fener", "kafa lambasi",
                          "spot isik", "ampulu"]),
    ("Kırtasiye", ["defter", "kalem", "silgi", "not kagidi", "yapiskanli not",
                   "memo", "kup blok", "planlayici", "hesap makinesi",
                   "fotokopi kagidi", "pastel boya", "kuru boya", "fosforlu kalem",
                   "tukenmez", "kalemtras", "cetvel"]),
    ("Cam & Sofra", ["su bardagi", "su bardak", "cay bardagi", "kahve bardagi",
                     "kahve yani", "bardak seti",
                     "bardak takimi", "cam bardak", "ayakli bardak", "kadeh",
                     "su kadehi", "sarap kadehi", "kupa seti", "porselen kupa",
                     "fincan takimi", "fincan seti", "kahve fincani", "cay tabagi",
                     "yemek tabagi", "servis tabagi", "pasta tabagi", "kahvalti tabagi",
                     "tabak seti", "tabagi", "kase seti", "cam kase", "tencere",
                     "granit tava", "dokum tava", "tava seti", "krep tava", "wok",
                     "pasabahce", "pasabahce", "surahi", "termos", "matara", "caydanlik",
                     "cezve", "kupa bardak", "cay seti", "cay takimi", "kahve takimi",
                     "mesrubat bardagi", "porselen", "kupa fincan", "sunum tahtasi",
                     "pasta tabak"]),
    ("Mum & Dekor", ["mum", "cerceve", "çerçeve", "biblo", "vazo",
                     "yetistirme seti", "fide", "saksi", "saksı",
                     "cicek tohumu", "cicek tohum", "sulama tabancasi", "bahce sulama",
                     "cicek sogani", "testere", "torpu", "el aleti", "balon",
                     "parti balonu", "pecete yuzugu", "pecete halkasi", "oda kokusu",
                     "oda spreyi", "oda parfumu", "kumas spreyi", "hava tazeleyici",
                     "airwick", "glade", "pasta susu cubuk", "mobilya spreyi"]),
    # --- Diğer non-food markers stay as last-resort raw fallbacks -------------
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

# Baby is the TOP-priority tier: a "bebek/bebe" product is never its adult
# look-alike ("Bebek Şampuanı" -> Bebek/Bebek Bakım, not Şampuan).
_BABY_TOP = "Bebek"

# Non-food tops are DOMINANT: a soap / shampoo / cologne / detergent / pet / toy
# / textile form word wins over a food-ingredient word that merely appears later
# as a scent ("Sıvı Sabun Hindistan Cevizi" -> Sabun). NOTE: "Ev & Yaşam" and
# "Elektronik" are intentionally NOT here — their form words (bardak / makinesi)
# trail or lead inconsistently, so the position-based STRONG tier (head noun)
# gets them right ("Çay Makinesi" -> Elektronik, "Bardak Ayran" -> Ayran).
_NONFOOD_TOPS = {"Temizlik", "Kağıt & Hijyen", "Kişisel Bakım & Kozmetik",
                 "Pet Shop", "Oyuncak & Hobi", "Giyim & Tekstil"}

# Ice cream: brand/type words win over a flavour, regardless of position
# ("Carte d'Or Bitter Çikolata" -> Dondurma, not Çikolata).
_FROZEN_SUBS = {"Dondurma"}

# Unambiguous savoury-snack brands. When one is present the product is a snack,
# so a dairy/meat FLAVOUR word ("...Peynirli", "...Yoğurtlu", "...Biftek") must
# not pull it into Süt Ürünleri / Et ("Doritos Nacho Peynirli" -> Cips).
_SNACK_BRANDS = {"cizi", "crax", "patos", "cipso", "cheetos", "ruffles", "doritos",
                 "cerezos", "cerezza", "critos", "kritos", "gong", "lays", "lay",
                 "ringo", "wasa"}
_SNACK_SUPPRESSED_SUBS = {"Peynir", "Yoğurt", "Süt", "Kırmızı Et", "Tavuk", "Balık"}


# Powered appliances: a device is Elektronik no matter what care/cleaning word it
# carries ("Saç Kurutma Makinesi", "Buharlı Temizleyici", "IPL Cihazı"). Phrases —
# matched as substrings on the normalized name. Listed before everything else.
_DEVICE_OVERRIDE = [
    "tiras makinesi", "tiras makinasi", "sac kurutma makinesi", "sac kurutma",
    "fon makinesi", "epilasyon cihazi", "epilasyon aleti", "epilator",
    "sac duzlestirici", "duzlestirici", "sac masasi", "bukle masasi",
    "masa ahs", "masaj aleti", "cilt bakim cihazi", "cilt bakim makinesi",
    "yuz temizleme cihazi", "buharli temizleyici", "elektrikli dis fircasi",
    "ipl cihazi", "ipl epilasyon", "ipl tuy", "akilli tarti", "dijital baskul",
    "ultrasonik nemlendirici", "hava temizleyici", "hava nemlendirici",
    "sac sekillendirici", "sac sakal sekil", "erkek bakim kiti", "erkek bakim seti",
    "kahve makinesi", "cay makinesi", "cay makinasi", "kahve makinasi",
    "turk kahvesi makinesi", "turk kahvesi makinasi", "su isiticisi",
    "su isitici", "su sebili", "tost makinesi", "waffle makinesi",
    "dikis makinesi", "kiyma makinesi", "mikser",
    "supurge", "mini firin", "midi firin", "fritoz", "air fryer makinesi",
    "projeksiyon", "tv box", "powerbank", "bluetooth hoparlor", "yazici",
    "dizustu", "notebook", "laptop", "usb bellek", "hard disk",
]

# Definitive keyword/brand -> (top, sub). Checked before the tier logic so a
# brand or category-defining word wins over a trailing flavour/nut ("Activia …
# Yulaf Fındık" -> Yoğurt, "Nescafe 3'ü1 Fındıklı" -> Kahve, "Fellas Granola
# Hindistan Cevizi" -> Kahvaltılık). Order: most specific first. Single-word keys
# match a whole token; multi-word keys match as a phrase.
_OVERRIDE_RULES: List[Tuple[str, str, str]] = [
    ("granola bar", "Atıştırmalık", "Tahıllı Bar"),
    ("granola", "Kahvaltılık", "Kahvaltılık Gevrek"),
    ("fomilk", "Süt Ürünleri", "Süt"),
    ("nilky", "Süt Ürünleri", "Süt"),
    ("activia", "Süt Ürünleri", "Yoğurt"),
    ("yocrush", "Süt Ürünleri", "Yoğurt"),
    ("danino", "Süt Ürünleri", "Yoğurt"),
    ("nescafe", "İçecek", "Kahve"),
    ("lezzcafe", "İçecek", "Kahve"),
    ("cafe crown", "İçecek", "Kahve"),
    ("coffee mate", "Temel Gıda", "Pasta Malzemeleri"),
    ("kahve beyazlatici", "Temel Gıda", "Pasta Malzemeleri"),
    ("kahve beyazlaticisi", "Temel Gıda", "Pasta Malzemeleri"),
    ("sut dilimi", "Atıştırmalık", "Çikolata"),
    ("sut burger", "Atıştırmalık", "Bisküvi"),
    ("krispi pops", "Atıştırmalık", "Cips"),
    ("kedi dili", "Atıştırmalık", "Bisküvi"),
    ("sus seker", "Atıştırmalık", "Şekerleme"),
    ("ari sutu", "Sağlık & Takviye", "Vitamin & Takviye"),
    ("chia tohumu", "Temel Gıda", "Bakliyat"),
    ("keten tohumu", "Temel Gıda", "Bakliyat"),
    ("kinoa", "Temel Gıda", "Bakliyat"),
    ("hosmerim", "Fırın & Pastane", "Pasta & Kek"),
    ("panna cotta", "Fırın & Pastane", "Pasta & Kek"),
    ("sam tatlisi", "Fırın & Pastane", "Pasta & Kek"),
    ("sekerpare", "Fırın & Pastane", "Pasta & Kek"),
    ("kalburabasti", "Fırın & Pastane", "Pasta & Kek"),
    ("tulumba", "Fırın & Pastane", "Pasta & Kek"),
    ("kemalpasa tatli", "Fırın & Pastane", "Pasta & Kek"),
    ("kadife tatli", "Fırın & Pastane", "Pasta & Kek"),
]


def classify(name: str, raw_category: Optional[str] = None,
             ascendants: Optional[List[str]] = None) -> Tuple[str, str]:
    """Classify a product into (top, subcategory).

    Primary signal is the NAME. Five tiers (baby > non-food > frozen > strong >
    weak) keep the head noun from losing to a flavour or a packaging word; within
    a tier the keyword that appears LAST in the name wins (Turkish puts the
    product type last). If the name matches no rule, fall back to the market's
    own category, then "Diğer"."""
    name_text = _norm(name)
    name_tokens = set(name_text.split())

    # 0) position-independent overrides (highest priority)
    for kw in _DEVICE_OVERRIDE:
        if kw in name_text:
            return ("Elektronik", "Elektronik")
    for kw, top, sub in _OVERRIDE_RULES:
        if (kw in name_tokens) or (" " in kw and kw in name_text):
            return (top, sub)

    has_snack = bool(name_tokens & _SNACK_BRANDS)

    baby_best = nonfood_best = frozen_best = strong_best = weak_best = None
    for idx, (sub, kws) in enumerate(_RULES):
        matched, last_pos, hits = _name_match(name_text, name_tokens, kws)
        if not matched:
            continue
        if has_snack and sub in _SNACK_SUPPRESSED_SUBS:
            continue  # a snack brand outranks a dairy/meat flavour word
        cand = (last_pos, hits, -idx, sub)
        top = SUB_TO_TOP[sub]
        if sub in _WEAK_SUBS:
            if weak_best is None or cand[:3] > weak_best[:3]:
                weak_best = cand
        elif top == _BABY_TOP:
            if baby_best is None or cand[:3] > baby_best[:3]:
                baby_best = cand
        elif top in _NONFOOD_TOPS:
            if nonfood_best is None or cand[:3] > nonfood_best[:3]:
                nonfood_best = cand
        elif sub in _FROZEN_SUBS:
            if frozen_best is None or cand[:3] > frozen_best[:3]:
                frozen_best = cand
        else:
            if strong_best is None or cand[:3] > strong_best[:3]:
                strong_best = cand

    # tier priority
    if baby_best is not None:
        return (SUB_TO_TOP[baby_best[3]], baby_best[3])
    if nonfood_best is not None:
        return (SUB_TO_TOP[nonfood_best[3]], nonfood_best[3])
    if frozen_best is not None:
        return (SUB_TO_TOP[frozen_best[3]], frozen_best[3])
    if strong_best is not None:
        return (SUB_TO_TOP[strong_best[3]], strong_best[3])

    # market's own category — tier it too (a product-TYPE hint like "Dondurulmuş
    # Patates" must beat a raw-produce hint like "patates"->Sebze)
    hint_text = _norm(" ".join(filter(None, [raw_category or ""] + (ascendants or []))))
    hint_tokens = set(hint_text.split())
    s_sub = w_sub = None
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
    # 3) market top-level category authority (raw "Atıştırmalık"/"Kolonya"/"Mama").
    #    If a weak NAME match agrees with that top, prefer its specific sub over
    #    the generic "Genel" — so "Domates Kg" (raw Manav) -> Sebze, not Genel.
    top = _raw_top(hint_text + " ")
    if top:
        if weak_best is not None and SUB_TO_TOP[weak_best[3]] == top:
            return (top, weak_best[3])
        return (top, "Genel")
    # 4) a raw-produce/flavour word in the name
    if weak_best is not None:
        return (SUB_TO_TOP[weak_best[3]], weak_best[3])
    # 5) raw-produce hint
    if w_sub:
        return (SUB_TO_TOP[w_sub], w_sub)

    return ("Diğer", "Diğer")
