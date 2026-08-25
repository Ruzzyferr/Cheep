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

## 5. Sık karşılaşılanlar

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
