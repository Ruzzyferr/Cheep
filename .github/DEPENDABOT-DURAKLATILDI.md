# Dependabot sürüm güncellemeleri DURAKLATILDI — 6 Eki 2026

`dependabot.yml` → `dependabot.yml.duraklatildi` olarak yeniden adlandırıldı.
Dependabot yalnızca `.github/dependabot.yml` adını okuduğu için bu, rutin
**sürüm** güncelleme PR'larını durdurur.

## Neden

Proje duraklatıldı: sunucu silindi, uygulama iki mağazadan da çekildi
(bkz. `docs/basvuru-bakanlik-veri-kullanimi.md`). Çalışmayan bir uygulamanın
bağımlılıklarını aylık güncellemek anlamsız; üstelik 7 PR okunmadan birikmişti
ve her ay artacaktı.

## Geri açmak için

```bash
git mv .github/dependabot.yml.duraklatildi .github/dependabot.yml
rm .github/DEPENDABOT-DURAKLATILDI.md
```

Geri açarken dikkat: aradan geçen sürede birikmiş güncellemeler tek seferde
gelir. `open-pull-requests-limit` zaten 3'e sabitli, yani boğulma olmaz ama
ilk ay biraz kalabalık olur.

## GÜVENLİK uyarıları KAPATILMADI

Bunlar ayrı bir mekanizma ve repo ayarlarından yönetiliyor. Bilerek açık
bırakıldı: duraklatma sırasında ciddi bir açık duyurulursa, uygulamayı geri
açmadan ÖNCE bilmek gerekir. Bu dosya yalnızca rutin sürüm PR'larını durdurur.
