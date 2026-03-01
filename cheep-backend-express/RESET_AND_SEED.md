# 🔄 Database Reset ve Seed

## Hızlı Yol (Önerilen)

`prisma migrate reset` komutu database'i sıfırlar, migration'ları uygular ve otomatik olarak seed'i çalıştırır:

```bash
cd cheep-backend-express
npm run db:reset
```

Bu komut:
1. ✅ Database'i sıfırlar (tüm tabloları siler)
2. ✅ Migration'ları uygular
3. ✅ Seed script'ini otomatik çalıştırır (standart kategoriler, test kullanıcısı, marketler)

## Alternatif: Sadece Seed

Eğer database'i sıfırlamak istemiyorsan, sadece seed çalıştırabilirsin:

```bash
cd cheep-backend-express
npm run db:seed
```

⚠️ **Not:** Bu komut mevcut verileri silmez, sadece yeni veriler ekler (upsert).

## Seed İçeriği

Seed script'i şunları oluşturur:
- ✅ Test kullanıcısı (`test@cheep.com` / `test123456`)
- ✅ Marketler (Migros, CarrefourSA, A101)
- ✅ Standart kategoriler (STANDARD_CATEGORIES'den)
- ✅ Kategori hiyerarşisi (parent-child ilişkileri)

## Sonraki Adım

Database reset ve seed'den sonra:

```bash
# Backend'i başlat (eğer çalışmıyorsa)
npm run dev

# Başka bir terminal'de import script'i çalıştır
cd Cheep-Scraper/countries/turkey
python import_to_backend.py
```

