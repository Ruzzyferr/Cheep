/**
 * JENERİK GRUPLAMA — "marka önemsemiyorum" özelliğinin veri tarafı.
 *
 * NEDEN AYRI BİR ALAN (`jenerik_grup_id`), `muadil_grup_id` DEĞİL:
 * `muadil_grup_id` aynı zamanda ÜRÜN BİRLEŞTİRME anahtarı —
 * `ProductMatcher.findExactMatch` o alandan bulduğu ürünü "aynı ürün" sayıp
 * döndürüyor. Oraya markalar arası ortak bir değer yazsaydık, bir sonraki veri
 * alımında "Bili Bili Yumurta 15'li" mevcut "Gürses Yumurta 15'li" ürünüyle
 * eşleşir ve İKİ MARKA TEK ÜRÜNE ÇÖKERDİ; farklı markaların fiyatları
 * birbirine karışırdı. Bu yüzden ikame yalnızca bu yeni alandan yürüyor;
 * `muadil_grup_id`'ye DOKUNULMUYOR.
 *
 * KURAL (kullanıcı kararı, 4 Ekim 2026): aynı tür + aynı miktar birbirinin
 * yerine geçer; NİTELİKLER AYRI TUTULUR. Organik yumurta isteyene normal
 * yumurta önerilmez, laktozsuz süt isteyene normal süt önerilmez.
 */
import { baseNormalize } from '../api/products/product-matcher.service.js';

/**
 * İkamede KORUNAN nitelikler. Bunlar fiyatı ve kullanıcının niyetini
 * değiştirir; birbirinin yerine geçemezler.
 */
const NITELIKLER = new Set<string>([
  // üretim biçimi
  'organik', 'bio', 'ekolojik', 'gezen', 'koy', 'dogal', 'serbest',
  // diyet / içerik
  'laktozsuz', 'glutensiz', 'sekersiz', 'tuzsuz', 'light', 'diyet', 'vegan',
  'kepekli', 'tambugday', 'tahilli', 'proteinli', 'omega',
  // yağ oranı sınıfı (yüzde ayrıca token olarak ekleniyor)
  'yagsiz', 'yarimyagli', 'tamyagli', 'kaymakli',
  // işlem
  'pastorize', 'uht', 'cig', 'dondurulmus', 'konserve',
]);

/**
 * İkameyi engellemeyen, isimde geçen ama anlam taşımayan kelimeler.
 * `EXTRA_NOISE_WORDS` zaten boy/paket gibi olanları temizliyor; buradakiler
 * jenerik gruplamaya özel ek gürültü.
 */
const GURULTU = new Set<string>([
  // BOY/AMBALAJ sozcukleri. ProductMatcher'in EXTRA_NOISE_WORDS listesinde
  // bunlar vardi ama o liste burada kullanilmiyor; eksikligi "M Boy Yumurta"yi
  // duz "Yumurta"dan AYIRIYORDU (yanlis ikame degil, kapsama kaybi).
  'boy', 'orta', 'buyuk', 'kucuk', 'mini', 'jumbo', 'paket', 'koli',
  'adet', 'tane', 'gramaj', 'ebat',
  'urun', 'urunu', 'cesit', 'cesitleri', 'karisik', 'ozel', 'klasik',
  'premium', 'secme', 'taze', 'gunluk', 'enfes', 'lezzetli', 'yeni',
  'avantaj', 'firsat', 'ekonomik', 'aile', 'boyu',
]);

/**
 * Hafif Türkçe ek temizleme: "yumurtası" → "yumurta", "sütü" → "sut".
 * AGRESİF DEĞİL — yalnızca iyelik/çoğul ekleri, en az 4 harf kalmak kaydıyla.
 * Jenerik grup bir ikame KATMANI olduğu için fazla kesmek yanlış ikameye yol
 * açar; az kesmek yalnızca kapsamayı daraltır, o yüzden temkinli taraf seçildi.
 */
export function kokeIndir(kelime: string): string {
  const ekler = ['lari', 'leri', 'lar', 'ler', 'si', 'su', 'si', 'yi', 'i', 'u'];
  for (const ek of ekler) {
    if (kelime.length - ek.length >= 4 && kelime.endsWith(ek)) {
      return kelime.slice(0, -ek.length);
    }
  }
  return kelime;
}

/**
 * Jenerik miktar. `extractGramaj`'DAN AYRI, çünkü o ilk eşleşmeyi alıyor:
 * "Yumurta 53-62 Gr 30 Adet" için `62g` döndürüyor, `30adet` değil — yumurtalar
 * bu yüzden hiç gruplanamıyordu. Burada SAYILABİLİR miktar (adet/'li) varsa
 * ağırlığa TERCİH EDİLİYOR.
 */
export function jenerikMiktar(name: string): string | null {
  const t = name.replace(/,/g, '.').toLowerCase();

  // 1) Açık adet: "30 adet", "10'lu", "6 lı"
  const adet =
    t.match(/(\d+)\s*(?:adet|tane)\b/) ||
    t.match(/(\d+)\s*['’]?\s*(?:li|li|lu|lu|lı|lü)\b/);
  if (adet) {
    const n = parseInt(adet[1], 10);
    if (n >= 1 && n <= 1000) return `${n}adet`;
  }

  // 2) Ağırlık/hacim — çoklu paket çarpanı dahil ("2 x 500 ml")
  const m = t.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(ml|lt|l|cl|kg|gr|g)\b/);
  if (!m) return null;
  const kat = m[1] ? parseInt(m[1], 10) : 1;
  const sayi = parseFloat(m[2]) * kat;
  const birim = m[3];
  if (!(sayi > 0)) return null;
  if (birim === 'ml') return `${Math.round(sayi)}ml`;
  if (birim === 'l' || birim === 'lt') return `${Math.round(sayi * 1000)}ml`;
  if (birim === 'cl') return `${Math.round(sayi * 10)}ml`;
  if (birim === 'kg') return `${Math.round(sayi * 1000)}g`;
  return `${Math.round(sayi)}g`;
}

/** Yağ oranı: "%3,5" ve "3.2%" biçimlerini yakalar. */
export function jenerikYuzde(name: string): string | null {
  const t = name.replace(/,/g, '.');
  const m = t.match(/%\s*(\d+(?:\.\d+)?)/) || t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!(v > 0) || v > 100) return null;
  return String(v).replace(/\.0$/, '');
}

/**
 * İKAMEYE KAPALI alanlar. Burada yanlış ikame yalnızca "fiyat şaşar" değil
 * ZARAR verir: bebek maması kademeleri (1/2/3) yaşa göredir ve birbirinin
 * yerine geçmez. Doğrulamada "Aptamil Pronutra 1/2/4/5 Devam Sütü" tek gruba
 * çökmüştü. Bu kelimelerden biri geçiyorsa ürün jenerik gruba HİÇ alınmaz.
 */
const IKAME_YASAK = [
  // TR
  'bebek', 'mama', 'devam sutu', 'baslangic sutu', 'formul',
  'ilac', 'takviye', 'vitamin', 'biberon', 'emzik',
  // PL / HU / RO / HR / EN — asil koruma kademe rakaminin cekirdekte
  // korunmasi, bu liste ikinci katman. Turkce kelimelerle sinirli kalsaydi
  // diger pazarlarda hic calismazdi.
  'poczatkowe', 'modyfikowane', 'nastepne', 'kaszka', 'niemowl',
  'tapszer', 'anyatej', 'csecsemo',
  'lapte praf', 'formula de start', 'sugari',
  'pocetna', 'dojenack',
  'infant', 'follow on', 'baby food',
];

/** Uzunluğu 2'yi geçmeyen ama GERÇEK ürün olan kelimeler. */
const KISA_GECERLI = new Set(['su', 'un', 'et', 'yag']);

/**
 * Jenerik parmak izi: `cekirdek[+nitelik...]@miktar[%yuzde]`
 *
 *   "Bili Bili Yumurta 15 Adet"             -> "yumurta@15adet"
 *   "Akyaka Gezen Yumurta M Boy 15 Adet"    -> "yumurta+gezen@15adet"
 *   "Carrefour Bio Organik Yumurta 10 Adet" -> "yumurta+bio+organik@10adet"
 *
 * Miktar YOKSA null döner: miktarsız ürünü ikame etmek (kullanıcı 1 L süt
 * isterken 200 ml önermek) sepet tutarını yanıltır.
 */
export function jenerikParmakIzi(data: { name: string; brand?: string | null }): string | null {
  const miktar = jenerikMiktar(data.name);
  if (!miktar) return null;

  // MIKTAR IFADESI HAM ISIMDEN SILINIYOR — baseNormalize'DAN ÖNCE.
  // Sonra silinseydi `baseNormalize` noktayı boşluğa çevirip "1.5 Lt"yi
  // "1 5 lt" yapardı; birim temizliği "5 lt"yi alır, geriye çekirdek olarak
  // "1" kalırdı. Doğrulamada tam bu yüzden "Abant Su 1.5 Lt" ile
  // "Coca-Cola 1.5 Lt" aynı gruba ("1@1500ml") düşmüştü.
  // Turkce 'I' TUZAGI: JS'te 'I'.toLowerCase() birlesik noktali "i̇"
  // uretiyor, baseNormalize'daki [^\w\s] o noktayi bosluga cevirince bastaki
  // harf tek basina kalip eleniyor ("Irmik" -> "rmik"). Ayni urunun 'I'siz
  // yazilmis hali AYRI gruba duserdi. baseNormalize'a DOKUNMUYORUZ (mevcut
  // muadil parmak izlerini tasiyor), duzeltme yalnizca burada.
  let ham = data.name.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/,/g, '.');
  // GRAMAJ ARALIGI once temizlenir: "53-62 Gr" icin birim temizligi yalnizca
  // "62 Gr"yi alir, geriye "53" kalir ve kademe numarasi sanilip cekirdekte
  // tutulur. Sonuc yanlis ikame DEGIL ama kapsama kaybi: aralik yazmayan ayni
  // urun ("Yumurta 30 Adet") ayri gruba duser. Aralik bir OLCU, varyant degil.
  ham = ham.replace(/\d+\s*[-–]\s*(\d+(?:\.\d+)?\s*(?:ml|lt|l|cl|kg|gr|g)\b)/gi, ' $1 ');
  ham = ham.replace(/(?:\d+\s*[x×]\s*)?\d+(?:\.\d+)?\s*(ml|lt|l|cl|kg|gr|g|adet|ad|tane)\b/gi, ' ');
  ham = ham.replace(/\b\d+\s*['’]?\s*(li|lu|lı|lü)\b/gi, ' ');

  const duz = baseNormalize(ham);
  const tamAd = baseNormalize(data.name);
  for (const yasak of IKAME_YASAK) {
    if (tamAd.includes(baseNormalize(yasak))) return null;
  }

  let metin = duz;

  // Marka adını çıkar — isim marka ile başlamasa da geçtiği her yerden.
  if (data.brand) {
    // MARKA da ayni 'I' duzeltmesinden gecmeli. Yalnizca urun adina
    // uygulandiginda marka kelimesi eslesmiyor ve CEKIRDEKTE KALIYORDU:
    // "Icim Sut 6x200 Ml" -> "icim-sut@1200ml" gibi. Markasi 'I' ile
    // baslayan her urun bu yuzden tekil grupta kaliyordu.
    const markaDuz = data.brand.replace(/İ/g, 'I').replace(/ı/g, 'i');
    for (const bk of baseNormalize(markaDuz).split(' ').filter(Boolean)) {
      if (bk.length < 2) continue;
      metin = metin.replace(new RegExp(String.raw`\b` + bk + String.raw`\b`, 'g'), ' ');
    }
  }
  metin = metin.replace(/\s+/g, ' ').trim();

  const nitelikler = new Set<string>();
  const cekirdek = new Set<string>();

  for (const kelime of metin.split(' ')) {
    if (!kelime) continue;
    const k = kokeIndir(kelime);
    if (NITELIKLER.has(kelime) || NITELIKLER.has(k)) {
      nitelikler.add(NITELIKLER.has(kelime) ? kelime : k);
      continue;
    }
    if (GURULTU.has(kelime) || GURULTU.has(k)) continue;
    // Yalnız rakam: kademe/varyant numarası, AYIRT EDİCİ — korunur.
    if (/^\d+$/.test(kelime)) { cekirdek.add(kelime); continue; }
    if (kelime.length <= 2 && !KISA_GECERLI.has(kelime)) continue;
    cekirdek.add(k);
  }

  // SADECE RAKAMDAN oluşan çekirdek anlamsızdır ve tehlikelidir: farklı
  // ürünleri aynı gruba toplar. Böyle bir ürün ikameye alınmaz.
  const anlamli = [...cekirdek].some(w => !/^\d+$/.test(w));
  if (!anlamli) return null;

  const govde = [...cekirdek].sort().join('-');
  const nit = nitelikler.size ? '+' + [...nitelikler].sort().join('+') : '';
  const yuzde = jenerikYuzde(data.name);
  return `${govde}${nit}@${miktar}${yuzde ? `%${yuzde}` : ''}`;
}
