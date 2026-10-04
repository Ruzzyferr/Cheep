# Güvenlik uyarıları — kapatılamayanların gerekçesi

Son tarama: **2 Ekim 2026**

Dependabot'ta 29 açık uyarı vardı (12 yüksek, 17 orta). 23'ü kapatıldı.
Kalan 6'sının **güvenli bir yaması yok**; bu dosya nedenini kayda geçiriyor ki
bir dahaki sefere aynı araştırma baştan yapılmasın.

## Kapatılanlar

| Proje | Önce | Sonra |
|---|---|---|
| `cheep-backend-express` | 11 yüksek + 15 orta | **0** |
| `cheep-website` | 1 orta | **0** |
| `Cheep-Mobile` | 11 yüksek + 6 orta | 6 yüksek |

## Kalan 6 — hepsi iki köke iniyor

### 1. `node-forge` — yayınlanmış yama YOK

- Kurulu **1.4.0**, ve bu **en son sürüm**. Açık için çıkmış bir sürüm yok.
- Zincir: `expo → @expo/cli → node-forge` ve `@expo/code-signing-certificates`.
- Açık: RSA PKCS#1 v1.5 imza doğrulamasında fazladan iç içe DigestAlg kabulü.
- **Neden tolere ediliyor:** yalnızca **derleme zamanı** çalışıyor (Expo CLI'ın
  kod imzalama aracı). Expo Updates kod imzalama özelliğini kullanmıyoruz ve
  bu kod kullanıcıya giden pakette yer almıyor. Kendi imza doğrulamamızı
  node-forge ile yapmıyoruz.

### 2. `image-size` — yamaya geçmek Metro'yu KIRAR

- Kurulu **1.2.1**. 1.x dalında yama yok (1.2.1 son 1.x sürümü); yama **2.0.3+**.
- Zincir: `expo → @expo/metro → metro → image-size` ve
  `react-native → @react-native/community-cli-plugin → metro → image-size`.
- **Neden 2.x'e geçilmiyor — ölçüldü:**
  - Metro şöyle çağırıyor: `(0, _imageSize.default)(content)`
    (`node_modules/metro/src/Assets.js:68` ve `:173`)
  - image-size **1.2.1** → `"main": "dist/index.js"` (default export var)
  - image-size **2.0.4** → `exports` alanı yalnızca adlandırılmış dışa aktarım
  - Yani `_imageSize.default` `undefined` olur ve paketleyici **her görsel
    varlıkta** `TypeError` ile düşer. Build'i sessizce değil, tamamen kırar.
- Açık: JXL/HEIF/ICNS ayrıştırıcılarında sonsuz döngüyle hizmet reddi.
- **Neden tolere ediliyor:** tetiklenmesi için paketleyicinin **kötü niyetli
  bir görsel dosyayı okuması** gerekir. Paketlenen görseller depodaki kendi
  varlıklarımız. Market görselleri paketlenmiyor, çalışma anında URL olarak
  yükleniyor (bkz. `docs/VERI-IZINLERI.md`).

### 3. `braces` — yayınlanmış yama YOK (4 Eki 2026'da eklendi)

- Kurulu **3.0.3**, ve bu **en son sürüm** (3.x dalı 3.0.3'te bitiyor).
- Zincir: `expo → @expo/metro → metro-file-map → micromatch → braces`.
- Açık: derin iç içe glob kalıplarıyla yığın tüketimi (DoS).
- **Neden tolere ediliyor:** yalnızca **derleme zamanı** (Metro paketleyici),
  kullanıcıya giden pakette yok; eşleştirilen glob kalıpları kendi depomuzdan
  geliyor, dışarıdan gelmiyor.

⚠️ Bu uyarı `react-native-keyboard-controller` eklendikten SONRA cikti ama
onunla ILGISI YOK — zincir yukarida, Expo'nun kendi paketleyicisi.

### 4. Türev uyarılar (kendi açıkları değil)

`@expo/cli`, `@expo/code-signing-certificates`, `expo`,
`react-native-google-mobile-ads` — dördü de yukarıdaki ikisinin zinciri.

⚠️ **npm audit'in önerisine UYULMADI:** `expo`yu **54 → 44**, reklam SDK'sını
**16.0.0 → 13.6.1** yapmayı "düzeltme" diye öneriyor. İkisi de **DÜŞÜRME**.
`npm audit fix --force` bu repoda çalıştırılmamalı.

## Ne zaman yeniden bakılmalı

- **Expo SDK yükseltmesinde** (54 → 55): Metro da yükselir, image-size 2.x'e
  kendisi geçmiş olabilir. O zaman bu dosya güncellenmeli.
- `node-forge` 1.4.1+ yayınlanırsa.
- `npm view image-size@latest exports` çıktısında tekrar default export
  görünürse.

## İlke

Hiçbiri "zamanımız yok" diye bırakılmadı. İkisi de **gerçekten yamasız**, ve
ikisi de kullanıcıya giden pakette değil. Metro'yu kırma pahasına bir
derleme-zamanı DoS uyarısını susturmak, gerçek bir riski teorik bir risk için
takas etmek olurdu.

İlgili: [[dependency-policy]]
