# Asistan Günlük Limiti + Premium Bayrağı — Tasarım Dokümanı

**Tarih:** 2026-06-18
**Durum:** Onaylı tasarım
**Bağlam:** Faz 5a AI asistanı main'de. Gemini free-tier binlerce kullanıcıyı taşımaz; bu spec maliyeti **kullanıcı başı günlük mesaj limiti** ile sınırlar ve bir **premium** ayrımı koyar.

## 1. Amaç ve Kapsam

Free kullanıcıyı **günde 5 asistan mesajı** ile sınırla; premium kullanıcı sınırsız (kötüye-kullanım tavanıyla). Bu, toplam Gemini maliyetine sert bir tavan koyar ve asistanı bir premium kancası yapar.

**Kapsam DIŞI (ayrı sonraki alt-proje):** Gerçek ödeme/abonelik entegrasyonu (Stripe / App Store / Google Play IAP). Premium bu fazda yalnızca bir `is_premium` bayrağıdır; elle/DB'den set edilir. Mobildeki "Premium'a geç" bilgilendirme/placeholder'dır — gerçek satın alma yapmaz.

**Bu fazda token-optimizasyonu YOK** (geçmiş kırpma, caching, deterministik router) — yalnızca cap + bayrak. Optimizasyonlar gelecekte ölçüm sonrası ele alınır.

## 2. Veri Modeli

`User` modeline tek alan:

```prisma
is_premium Boolean @default(false)
```

Yeni metering tablosu **yok** — kullanım mevcut `ChatMessage` verisinden sayılır.

## 3. Metering (Kullanım Sayımı)

Bir kullanıcının "bugünkü mesaj sayısı" = bugün (TR saati) oluşturduğu **kullanıcı turu** sayısı:

```ts
const startOfDayTR = /* TR (Europe/Istanbul) gününün başlangıcı, UTC'ye çevrilmiş */;
const count = await prisma.chatMessage.count({
  where: {
    role: 'user',
    thread: { user_id: userId },
    created_at: { gte: startOfDayTR },
  },
});
```

- **"Mesaj" = bir kullanıcı turu** (`role='user'` kaydı). İçerideki tool-call döngüsü kaç Gemini çağrısı yaparsa yapsın 1 sayılır.
- **Sıfırlama:** takvim günü, **Europe/Istanbul**. Gün başı UTC'ye çevrilir (TR = UTC+3, DST yok). Yardımcı: `startOfTrDay(now): Date`.

## 4. Limit Mantığı (saf, test-edilebilir)

`cheep-backend-express/src/services/assistant-limit.ts`:

```ts
export const FREE_DAILY_LIMIT = 5;
export const PREMIUM_DAILY_LIMIT = 500; // kötüye-kullanım tavanı (pratikte "sınırsız")

export interface LimitVerdict { allowed: boolean; remaining: number; limit: number }

export function checkDailyLimit(todayCount: number, isPremium: boolean): LimitVerdict {
  const limit = isPremium ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const remaining = Math.max(0, limit - todayCount);
  return { allowed: todayCount < limit, remaining, limit };
}
```

Saf fonksiyon → DB'siz birim test (free 5'te biter, sınırın altında/üstünde, premium yüksek tavan).

## 5. Uygulama (Backend)

`assistant.service.sendMessage` (Gemini çağrısından **önce**):
1. `todayCount = ` (Bölüm 3 sorgusu), `user = prisma.user.findUnique({ id: userId, select: { is_premium } })`.
2. `verdict = checkDailyLimit(todayCount, user.is_premium)`.
3. `!verdict.allowed` ise: Gemini'ye **gitme**; özel bir hata fırlat: `Object.assign(new Error('Günlük mesaj limitin doldu.'), { status: 429, code: 'DAILY_LIMIT' })`.
4. İzin varsa normal akış; başarılı yanıta `remaining: verdict.remaining - 1` (bu mesaj sonrası kalan) eklenir.

`assistant.controller` `message` handler:
- `e.code === 'DAILY_LIMIT'` → `res.status(429).json({ success:false, code:'DAILY_LIMIT', message:'Günlük 5 mesaj hakkın doldu. Sınırsız için Premium\'a geç.', remaining: 0 })`.
- Diğer hata yönetimi (404, Gemini 429→503, genel 502) **değişmez** (mevcut davranış korunur).
- Başarılı yanıt artık `{ message, toolCalls, remaining }` döndürür (servisteki `remaining`).

**Not:** Sayım Gemini çağrısından önce yapıldığı için, Gemini hata verirse (ör. kota) kullanıcı mesajı zaten kaydedilmez (mevcut akış: mesajlar yalnızca başarılı döngü sonrası persist edilir) → başarısız denemeler kotadan **düşmez**. Bu istenen davranıştır.

## 6. Mobil

`assistantService.sendMessage` dönüşüne `remaining?: number` eklenir; 429 `DAILY_LIMIT` özel ele alınır.
- **Kalan göstergesi:** `AssistantChatScreen` başlığında free kullanıcı için küçük "3/5" rozeti (her yanıttaki `remaining`'den güncellenir). Premium'da gösterilmez.
- **Limit dolunca:** `sendMessage` 429 `DAILY_LIMIT` dönerse → input kilitlenir + bir banner: "Günlük 5 mesajlık limitin doldu. Sınırsız için Premium'a geç." ("Premium'a geç" şimdilik bilgilendirme — gerçek satın alma yok.)
- Profil/premium durumu: mobil `is_premium`'ı bilmek isterse `GET /profile` veya kullanıcı objesi üzerinden alır (auth `user` objesine `is_premium` eklenebilir — bkz. Bölüm 7).

## 7. Açık Uçlar / Kararlar

- `is_premium` auth `req.user` objesine dahil edilir mi? `authenticate` middleware kullanıcıyı DB'den çekiyorsa alan otomatik gelir; gelmiyorsa `sendMessage` zaten `findUnique` ile çeker (Bölüm 5). Mobilin premium'u bilmesi için login/`/auth/me` yanıtına `is_premium` eklenebilir — küçük, opsiyonel.
- Premium'u set etmenin tek yolu (bu fazda) DB/elle. Admin UI / ödeme yok.

## 8. Test Stratejisi

- **Birim (vitest, DB'siz):** `checkDailyLimit` — free sınırda/altında/üstünde; premium yüksek tavan. `startOfTrDay` — TR gün başını doğru UTC'ye çeviriyor.
- **Enforcement:** `tsc` temiz; mevcut suite yeşil. (Sayım sorgusu DB-bağlı → e2e/manuel.)
- **Mobil:** `tsc` temiz; Playwright ile free kullanıcı 5 mesaj sonrası kilit + "3/5→0/5" göstergesi (Gemini kotası nedeniyle yanıtlar 503 olsa da limit sayımı kullanıcı mesajından bağımsız doğrulanabilir — gerekirse `is_premium=false` test kullanıcısıyla limiti API'den doğrula).

## 9. Geriye Uyumluluk

`is_premium` default `false` → mevcut kullanıcılar free (günde 5). Additif migration. Mevcut asistan davranışı, limit altındayken aynen korunur.
