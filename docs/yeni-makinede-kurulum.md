# Yeni bir makinede Cheep

Bu belge tek bir soruya cevap veriyor: **sıfırdan bir bilgisayarda repoyu alıp
main'e push ettiğimde iki mağazaya da test sürümü çıkması için ne gerekiyor?**

Kısa cevap: **sadece git kimliği.** Sertifika, keystore, `.p8`, servis hesabı
anahtarı — hiçbiri yerel makinede gerekmiyor. Hepsi GitHub Secrets'ta duruyor
ve derlemeler GitHub'ın runner'larında yapılıyor.

---

## 1. Push edebilmek için (zorunlu)

Repo **private**. Anonim klon çalışmaz, 401 döner.

```bash
gh auth login          # tarayıcıdan giriş, en kolayı
gh repo clone Ruzzyferr/Cheep
cd Cheep
```

`gh` yoksa SSH anahtarınızı GitHub hesabınıza ekleyip
`git clone git@github.com:Ruzzyferr/Cheep.git` de olur.

Bu kadar. Kod yazıp `git push origin main` dediğinizde hat kendiliğinden
çalışır.

### Bir uyarı: iş akışı dosyalarını değiştiriyorsanız

`.github/workflows/**` altını değiştiren bir push için `gh auth login`
sırasında **`workflow` kapsamını** vermeniz gerekir, yoksa GitHub push'u
reddeder. `gh auth refresh -h github.com -s workflow` ile sonradan da
eklenebilir. Bu GitHub'ın kasıtlı bir korumasıdır: CI'ı değiştirmek ayrı bir
yetki.

---

## 2. Push edince ne oluyor

`Cheep-Mobile/**` veya `scripts/ci/**` altında bir değişiklik main'e gidince
`.github/workflows/mobile-release.yml` çalışır:

1. Sürüm numarasını **mağazalardan** okur — Play'deki en yüksek versionCode ve
   App Store Connect'teki en yüksek build numarası, ikisine de +1. Yani iki
   makineden dönüşümlü çalışsanız bile numaralar çakışmaz; kaynak yerel bir
   sayaç değil, mağazanın kendisi.
2. Sürüm notlarını commit başlıklarından üretir (yalnızca `Cheep-Mobile/`
   yolundakiler; `feat`/`fix` ayrımıyla).
3. Android'i imzalayıp Play **`alpha`** (kapalı test) kanalına yükler.
4. iOS'u imzalayıp **TestFlight**'a yükler.
5. `info@swiip.app`'e sonuç e-postası atar — başarıda da başarısızlıkta da.

**Üretime asla otomatik çıkmaz.** `scripts/ci/play-upload.mjs` `production`
kanalını açıkça reddediyor. Testten mağazaya geçiş bilinçli bir insan kararı
ve Play/App Store Connect panelinden elle yapılır.

Backend, website veya scraper değişiklikleri mobil derleme tetiklemez — yol
filtresi bunun için var.

---

## 3. Uygulamayı yerelde ÇALIŞTIRMAK isterseniz (isteğe bağlı)

Push için gerekmiyor, sadece emülatörde/telefonda geliştirme yapacaksanız:

```bash
cd Cheep-Mobile
cp .env.example .env      # EXPO_PUBLIC_API_URL'i doldurun
npm ci
npx expo start
```

`EXPO_PUBLIC_API_URL` olmadan **release derlemesi başarılı olur ama uygulama
açılışta çöker**. CI'da bu değer repo değişkeninden gelir ve iki derleme
işinde de "ortam kapısı" adımı eksikse derlemeyi baştan durdurur.

Backend/website/scraper için ilgili klasörlerdeki `.env.example` dosyalarına
bakın.

---

## 4. Sunucuya deploy (ayrı iş)

Droplet repoyu **salt okunur bir deploy anahtarıyla** çekiyor
(`~/.ssh/cheep_repo_deploy`, remote `git@github.com:...`). Yeni bir sunucu
kurarken `deploy/bootstrap.sh` anahtar yoksa ne yapılacağını yazıp duruyor.

Mobil sürüm hattının deploy ile ilgisi yok; ikisi bağımsız.

---

## 5. Hattın dayandığı sırlar (envanter)

Bunlar GitHub'da duruyor, yerel makinede **hiçbirine ihtiyaç yok**. Liste
yalnızca bir rotasyon veya yeniden kurulum gerekirse lazım:

| Sır | Ne için |
|---|---|
| `ANDROID_KEYSTORE_B64` + `_PASSWORD` + `KEY_ALIAS` + `KEY_PASSWORD` | AAB imzalama |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play'e yükleme ve sürüm numarası okuma |
| `IOS_DIST_CERT_B64` + `_PASSWORD` | iOS dağıtım sertifikası (.p12) |
| `IOS_PROVISIONING_PROFILE_B64` | iOS provisioning profili |
| `ASC_KEY_P8` + `ASC_KEY_ID` + `ASC_ISSUER_ID` | TestFlight yükleme, build numarası, sertifika süresi kontrolü |
| `RESEND_API_KEY` | Sonuç e-postaları |

Değişken (sır değil, panelde görünür): `EXPO_PUBLIC_API_URL`.

**Apple sertifikası ve profili 2027-08-21'de doluyor.** Hat her sürümde
kontrol ediyor ve 45 gün kala e-postayla uyarıyor. Uyarı geldiğinde: yeni
sertifika üretip `.p12` olarak dışa aktarın, profili yenileyin, iki secret'ı
güncelleyin. Dolduğu gün iOS derlemesi imza hatasıyla durur.

---

## 6. Sık karşılaşılanlar

**"Koşu kırmızı ama mağazalara build gitmiş."**
Muhtemelen etiket adımı. `GITHUB_TOKEN`, iş akışı dosyası değiştiren bir
commit'e etiket atamıyor. Bu adım artık koşuyu düşürmüyor, uyarı basıp
geçiyor — etiket yalnızca insan kolaylığı, not aralığı koşu geçmişinden
okunuyor.

**"Aynı anda iki push attım."**
Hat `mobil-surum` eşzamanlılık grubunda ve `cancel-in-progress: false`.
İkinci koşu sıraya girer, iptal edilmez. Yükleme ortasında iptal edilen bir
koşu Play'de açık bir `edit` bırakıp sonrakini düşürebilirdi.

**"Derleme dakikası bitti mi?"**
Repo private olduğu için Actions dakikaları ölçülüyor: bir mobil sürüm
≈ 167 dakika (iOS'un macOS runner'ı 10 kat çarpanlı). Free planda 2.000
dk/ay, yani ayda kabaca 10-12 sürüm. Aşarsanız GitHub Pro (4 $/ay) 3.000
dakika veriyor.
