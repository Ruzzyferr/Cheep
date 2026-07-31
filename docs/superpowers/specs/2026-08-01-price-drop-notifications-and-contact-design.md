# Fiyat düşüşü bildirimleri + uygulama içi iletişim

**Tarih:** 2026-08-01
**Kapsam:** `cheep-backend-express/`, `Cheep-Mobile/`, `deploy/`, cheep.live DNS
**Hedef sürüm:** mobil 1.3.0 (versionCode 15)

## Sorun

**1. Bildirim butonu sahte.** `NewHomeScreen.tsx`'teki zil ikonunun `onPress`'i hiç yok — dokunulunca hiçbir şey olmuyor — ama üzerinde okunmamış bildirim varmış gibi kırmızı bir nokta duruyor. `ProfileScreen.tsx`'teki "Bildirimler" maddesi `console.log('Notifications')` çağırıyor. Uygulamada bildirim altyapısı hiç yok: `expo-notifications` kurulu değil, backend'de cihaz token'ı saklanmıyor, `google-services.json` yok.

**2. Kullanıcı bize ulaşamıyor.** Backend'de destek/iletişim ucu yok; mevcut feedback API'si yalnızca *fiyat* geri bildirimi için ve bir `storePriceId`'ye bağlı. Profil menüsünde iletişim maddesi yok. Kayıt/giriş ekranında da yok — yani sorun yaşayan bir kullanıcının hiçbir yolu yok.

**3. İlan edilen destek adresi kara delik.** `destek@cheep.live` sitenin altbilgisinde, gizlilik politikasında, kullanım şartlarında ve SSS'de yazılı ama cheep.live'ın MX kaydı olmadığı için oraya yazılan her mail geri dönüyor.

## Kararlar

Kullanıcı tarafından onaylananlar:

- Bildirim butonu → **gerçek fiyat düşüşü bildirimi** yapılacak (kaldırılmayacak).
- İletişim → **uygulama içi form** (mailto değil).
- Firebase **şimdi** kurulacak, her şey **tek sürümde** çıkacak.
- Önce `destek@cheep.live` çalışır hale getirilecek.

## Tasarım

### 1. destek@cheep.live — ücretsiz yönlendirme

ImprovMX ile `destek@cheep.live` ve `gizlilik@cheep.live` → `info@swiip.app`. Squarespace DNS'ine iki MX kaydı ve bir doğrulama TXT'si girilir. Gerçek posta kutusu satın alınmaz; cevap yazarken gönderen `info@swiip.app` görünür (markalı cevap istenirse ileride Google Workspace).

**Dikkat:** cheep.live kökünde `v=spf1 -all` var. ImprovMX yalnızca *alır*, göndermez — bu kayda dokunmaya gerek yok.

### 2. İletişim formu

**Backend — `POST /api/v1/support/contact`**

- **Kimlik doğrulama isteğe bağlı.** Kayıt/giriş ekranından da erişilebilmeli. Yeni `optionalAuthenticate` middleware'i: geçerli token varsa `req.user` doldurur, yoksa sessizce devam eder (401 atmaz).
- Gövde: `email` (zorunlu, geçerli), `message` (zorunlu, 10–2000 karakter), `topic` (`bug|suggestion|price|account|other`).
- **Önce veritabanına yazılır, sonra e-posta gönderilir.** `SupportMessage` tablosu; e-posta gönderimi başarısız olsa bile mesaj kaybolmaz. (Kullanıcının hata raporunu Resend'in geçici arızası yüzünden kaybetmek kabul edilemez.)
- Bağlam otomatik eklenir: uygulama sürümü, platform, OS sürümü, dil, ülke, varsa kullanıcı id/e-posta. "Hangi sürümde oldu" diye sormaya gerek kalmaz.
- E-posta `noreply@cheep.live` adresinden `destek@cheep.live` adresine gider, **Reply-To** kullanıcının adresidir — doğrudan cevap yazılabilir.
- Rate limit: yeni `contactLimiter`, `userOrIpKey` ile (girişliyse kullanıcı, değilse IP), saatte 5.

**Mobil**

- `SupportScreen` — konu seçimi, mesaj alanı, e-posta alanı (girişliyse ön-doldurulur ve kilitli değil).
- Giriş noktaları: Profil → "Bize ulaşın"; giriş ve kayıt ekranlarının altında "Sorun mu yaşıyorsun?" bağlantısı.
- `support.service.ts`, mevcut servis desenine uygun. Beş dilde metin (tr, en, de, pl, sv).

### 3. Fiyat düşüşü — tespit ve uygulama içi akış

`PriceHistory` yalnızca fiyat **değiştiğinde** yazılıyor (`store-prices.service.ts` `recordPriceHistory`), yani her satır zaten bir değişim olayı. Tespit için ek altyapı gerekmiyor.

**Model — `PriceDrop`**

```
user_id, product_id, country_id, old_price, new_price, drop_pct,
store_id (yeni en ucuz market), created_at, read_at
@@unique([user_id, product_id, created_at_date])   // günde bir, ürün başına
```

**Tespit işi — `POST /api/v1/store-prices/detect-price-drops`**

Mevcut `harvest-ean` ucuyla aynı desen: `requireIngestKey` ile korunur, `run-daily.sh` içinden ingest sonrası çağrılır.

Mantık: kullanıcının **aktif** listelerindeki her ürün için, o ülkedeki mağazalar arasındaki **en düşük** fiyat bugün ile önceki bilinen değer karşılaştırılır. Ürün başına tek mağazayı değil en ucuzu izliyoruz — kullanıcıyı ilgilendiren sinyal bu, ve mağaza başına bildirim gürültü yaratırdı.

- Eşik: **≥ %5 düşüş**. Yüzde kullanılıyor, mutlak tutar değil — TRY ve PLN için ayrı eşik gerekmesin.
- Kullanıcı başına **en fazla 5** bildirim (en büyük düşüşler), gerisi elenir. Spam koruması.
- Aynı ürün için günde bir kayıt (unique kısıt).

**Uçlar** (hepsi `authenticate`):
`GET /notifications` (sayfalı), `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`.

**Mobil:** Zil ikonu `NotificationsScreen`'e açılır; kırmızı nokta artık gerçek okunmamış sayısını gösterir (yoksa görünmez). Bildirime dokununca ürün ekranına gider. Profildeki "Bildirimler" maddesi bildirim tercihleri ekranına bağlanır (açık/kapalı).

### 4. Push teslimi

**Firebase/EAS kurulumu** (kod dışı, tek seferlik): Firebase projesi → Android uygulaması `com.cheep.mobile` → `google-services.json` → `android/app/`. `expo-notifications` eklenir, `app.json`'a `extra.eas.projectId` girilir, FCM v1 servis hesabı anahtarı Expo kimlik bilgilerine yüklenir.

**Model — `UserPushToken`:** `user_id`, `token` (unique), `platform`, `locale`, `created_at`, `updated_at`.

**İzin akışı — açılışta, konum kapısından SONRA.** `runLocationGate()` çözümlendikten sonra sırayla `runNotificationGate()` çalışır (eşzamanlı değil, ardışık — üst üste iki sistem modalı çıkmaz).

Yeni `src/utils/notificationGate.ts`, `locationGate.ts` desenini birebir izler; o dosya bu sorunları zaten çözmüş durumda ve tekerleği yeniden icat etmeye gerek yok:

- İzin zaten verilmişse veya kullanıcı yakın zamanda "şimdi değil" dediyse **hiçbir şey gösterilmez** (snooze).
- Sistem modalından **önce gerekçe diyaloğu**: ne için bildirim göndereceğimizi anlatır. Kullanıcı "şimdi değil" derse sistem modalı hiç çağrılmaz — Android'de iki reddin izni kalıcı olarak kapattığı düşünülürse, bu kritik: reddedilecek bir istem hiç harcanmaz.
- `canAskAgain === false` ise sistem modalı bir daha çıkmaz → kullanıcı uygulama ayarlarına yönlendirilir.
- Reddedilirse farklı sürelerle ertelenir (konum kapısındaki `SNOOZE_*` sabitleriyle aynı mantık).

Profil → "Bildirimler" ekranındaki anahtar da aynı kapıyı çağırır, böylece sonradan açmak mümkün.

**İzin verilmese de zil çalışır.** Bu tasarımın ayrılmaz parçası: tespit tamamen backend'de yapılır ve `PriceDrop` satırları izinden bağımsız oluşur. İzin yalnızca telefona *bildirim düşmesini* etkiler; zil ikonu, bildirim listesi ve okunmamış rozeti her hâlükârda çalışır.

**Gönderim:** Tespit işi `PriceDrop` satırlarını yazdıktan sonra Expo Push API'ye 100'lük gruplar hâlinde gönderir. Metin kullanıcının `language` alanına göre seçilir. `DeviceNotRegistered` dönen token'lar silinir.

**Zamanlama:** Tek günlük iş, **08:00 UTC** (Türkiye 11:00, Polonya 10:00) — her iki ülke için de makul bir saat. Sessiz saat kuyruğu kurmaya gerek kalmıyor; karmaşıklık bilinçli olarak alınmadı.

## Doğrulama

- Backend birim testleri: eşik/dedupe/üst sınır mantığı, `optionalAuthenticate`, contact doğrulama.
- Tespit işi kuru çalıştırma: prod verisinin kopyası üzerinde kaç bildirim üreteceği ölçülür (spam kontrolü).
- İletişim formu uçtan uca: gerçek gönderim → `destek@cheep.live` → `info@swiip.app` kutusuna düşmesi.
- Push: gerçek cihazda (emülatörde Play Services'lı imaj gerekir).

## Kapsam dışı

- iOS push (iOS sürümü henüz yok).
- Bildirim türlerinin çeşitlendirilmesi (liste hatırlatma, haftalık özet).
- Markalı cevap için Google Workspace.
- Sessiz saat kuyruğu / kullanıcı başına saat tercihi.
