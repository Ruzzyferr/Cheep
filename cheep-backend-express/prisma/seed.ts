import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { STANDARD_CATEGORIES } from '../src/config/standard-categories.js';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Veritabanı seed işlemi başlıyor...');

    // 1. Test kullanıcısı oluştur
    const seedPassword = process.env.SEED_PASSWORD || 'test123456';
    const hashedPassword = await bcrypt.hash(seedPassword, 10);
    const testUser = await prisma.user.upsert({
        where: { email: 'test@cheep.com' },
        update: { email_verified: true },
        create: {
            email: 'test@cheep.com',
            password_hash: hashedPassword,
            name: 'Test Kullanıcı',
            email_verified: true, // demo kullanıcı önceden doğrulanmış
        },
    });
    console.log('✅ Test kullanıcısı oluşturuldu:', testUser.email);

    // 1b. Ülke (çok-ülke modeli) — Türkiye
    const tr = await prisma.country.upsert({
        where: { code: 'TR' },
        update: {},
        create: { code: 'TR', name: 'Türkiye', currency: 'TRY' },
    });
    const ch = await prisma.country.upsert({
        where: { code: 'CH' },
        update: {},
        create: { code: 'CH', name: 'Schweiz', currency: 'CHF' },
    });
    const se = await prisma.country.upsert({
        where: { code: 'SE' },
        update: {},
        create: { code: 'SE', name: 'Sverige', currency: 'SEK' },
    });
    const de = await prisma.country.upsert({
        where: { code: 'DE' },
        update: {},
        create: { code: 'DE', name: 'Deutschland', currency: 'EUR' },
    });
    const pl = await prisma.country.upsert({
        where: { code: 'PL' },
        update: {},
        create: { code: 'PL', name: 'Polska', currency: 'PLN' },
    });
    console.log('✅ Ülkeler oluşturuldu');

    // 2. Marketler oluştur
    const migros = await prisma.store.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            name: 'Migros',
            logo_url: 'https://example.com/migros-logo.png',
            address: 'Konak, İzmir',
            lat: 38.4192,
            lon: 27.1287,
            country_id: tr.id,
        },
    });

    const carrefour = await prisma.store.upsert({
        where: { id: 2 },
        update: {},
        create: {
            id: 2,
            name: 'CarrefourSA',
            logo_url: 'https://example.com/carrefour-logo.png',
            address: 'Bornova, İzmir',
            lat: 38.4636,
            lon: 27.2156,
            country_id: tr.id,
        },
    });

    const a101 = await prisma.store.upsert({
        where: { id: 3 },
        update: {},
        create: {
            id: 3,
            name: 'A101',
            logo_url: 'https://example.com/a101-logo.png',
            address: 'Karşıyaka, İzmir',
            lat: 38.4531,
            lon: 27.1025,
            country_id: tr.id,
        },
    });

    const sok = await prisma.store.upsert({
        where: { id: 4 },
        update: {},
        create: {
            id: 4,
            name: 'ŞOK',
            logo_url: 'https://example.com/sok-logo.png',
            address: 'Buca, İzmir',
            lat: 38.3846,
            lon: 27.1779,
            country_id: tr.id,
        },
    });

    // CH 10–19
    const migrosCh = await prisma.store.upsert({ where: { id: 10 }, update: {}, create: { id: 10, name: 'Migros', logo_url: null, address: 'Zürich', country_id: ch.id } });
    const coopCh = await prisma.store.upsert({ where: { id: 11 }, update: {}, create: { id: 11, name: 'Coop', logo_url: null, address: 'Bern', country_id: ch.id } });
    // SE 20–29
    const ica = await prisma.store.upsert({ where: { id: 20 }, update: {}, create: { id: 20, name: 'ICA', logo_url: null, address: 'Stockholm', country_id: se.id } });
    const willys = await prisma.store.upsert({ where: { id: 21 }, update: {}, create: { id: 21, name: 'Willys', logo_url: null, address: 'Göteborg', country_id: se.id } });
    // DE 30–39
    const rewe = await prisma.store.upsert({ where: { id: 30 }, update: {}, create: { id: 30, name: 'REWE', logo_url: null, address: 'Köln', country_id: de.id } });
    const kaufland = await prisma.store.upsert({ where: { id: 31 }, update: {}, create: { id: 31, name: 'Kaufland', logo_url: null, address: 'Berlin', country_id: de.id } });
    // PL 40–49
    const carrefourPl = await prisma.store.upsert({ where: { id: 40 }, update: {}, create: { id: 40, name: 'Carrefour', logo_url: null, address: 'Warszawa', country_id: pl.id } });
    const auchan = await prisma.store.upsert({ where: { id: 41 }, update: {}, create: { id: 41, name: 'Auchan', logo_url: null, address: 'Kraków', country_id: pl.id } });
    const biedronka = await prisma.store.upsert({ where: { id: 44 }, update: {}, create: { id: 44, name: 'Biedronka', logo_url: null, address: 'Warszawa', country_id: pl.id } });
    const lidlPl = await prisma.store.upsert({ where: { id: 45 }, update: {}, create: { id: 45, name: 'Lidl', logo_url: null, address: 'Warszawa', country_id: pl.id } });
    const zabka = await prisma.store.upsert({ where: { id: 47 }, update: {}, create: { id: 47, name: 'Żabka', logo_url: null, address: 'Warszawa', country_id: pl.id } });

    console.log('✅ Marketler oluşturuldu');

    // 3. STANDART KATEGORİLERİ OLUŞTUR
    console.log('📋 Standart kategoriler oluşturuluyor...');
    const categoryMap = new Map<string, number>(); // slug -> id mapping

    // Önce ana kategorileri oluştur
    for (const standardCategory of STANDARD_CATEGORIES) {
        const parentCategory = await prisma.category.upsert({
            where: { slug: standardCategory.slug },
            update: {
                name: standardCategory.name,
                display_order: standardCategory.displayOrder,
                icon_url: standardCategory.icon || null,
            },
            create: {
                name: standardCategory.name,
                slug: standardCategory.slug,
                parent_id: null,
                display_order: standardCategory.displayOrder,
                icon_url: standardCategory.icon || null,
            },
        });

        categoryMap.set(standardCategory.slug, parentCategory.id);

        // Alt kategorileri oluştur
        for (const subcategory of standardCategory.subcategories) {
            const subCategory = await prisma.category.upsert({
                where: { slug: subcategory.slug },
                update: {
                    name: subcategory.name,
                    parent_id: parentCategory.id,
                    display_order: subcategory.displayOrder,
                },
                create: {
                    name: subcategory.name,
                    slug: subcategory.slug,
                    parent_id: parentCategory.id,
                    display_order: subcategory.displayOrder,
                },
            });

            categoryMap.set(subcategory.slug, subCategory.id);
        }
    }

    console.log('✅ Standart kategoriler oluşturuldu');

    // Kategorileri değişkenlere atayalım (ürünler için)
    const sutId = categoryMap.get('sut')!;
    const peynirId = categoryMap.get('peynir')!;
    const ekmekId = categoryMap.get('ekmek')!;
    const sebzeId = categoryMap.get('sebze')!;
    const icecekId = categoryMap.get('icecek')!;

    // 4. Ürünler oluştur (ALT kategorilere atanmış)
    // upsert kullanarak varsa güncelle, yoksa oluştur
    const pinarSut = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '8690572000001' } },
        update: {
            name: 'Pınar Süt 1L',
            brand: 'Pınar',
            category_id: sutId,
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/pinar-sut.jpg',
        },
        create: {
            name: 'Pınar Süt 1L',
            brand: 'Pınar',
            ean_barcode: '8690572000001',
            country_id: tr.id,
            category_id: sutId, // ALT KATEGORİ!
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/pinar-sut.jpg',
        },
    });

    const sutasSut = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '8690504000001' } },
        update: {
            name: 'Sütaş Süt 1L',
            brand: 'Sütaş',
            category_id: sutId,
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/sutas-sut.jpg',
        },
        create: {
            name: 'Sütaş Süt 1L',
            brand: 'Sütaş',
            ean_barcode: '8690504000001',
            country_id: tr.id,
            category_id: sutId, // ALT KATEGORİ!
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/sutas-sut.jpg',
        },
    });

    const ichimSut = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '8690632000001' } },
        update: {
            name: 'İçim Süt 1L',
            brand: 'İçim',
            category_id: sutId,
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/ichim-sut.jpg',
        },
        create: {
            name: 'İçim Süt 1L',
            brand: 'İçim',
            ean_barcode: '8690632000001',
            country_id: tr.id,
            category_id: sutId, // ALT KATEGORİ!
            muadil_grup_id: 'sut-1l-tam-yag',
            image_url: 'https://example.com/ichim-sut.jpg',
        },
    });

    const beyazPeynir = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '8690572000002' } },
        update: {
            name: 'Pınar Beyaz Peynir 500g',
            brand: 'Pınar',
            category_id: peynirId,
            image_url: 'https://example.com/pinar-peynir.jpg',
        },
        create: {
            name: 'Pınar Beyaz Peynir 500g',
            brand: 'Pınar',
            ean_barcode: '8690572000002',
            country_id: tr.id,
            category_id: peynirId, // ALT KATEGORİ!
            image_url: 'https://example.com/pinar-peynir.jpg',
        },
    });

    const unoBeyazEkmek = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '8690506000001' } },
        update: {
            name: 'Uno Beyaz Ekmek',
            brand: 'Uno',
            category_id: ekmekId,
            image_url: 'https://example.com/ekmek.jpg',
        },
        create: {
            name: 'Uno Beyaz Ekmek',
            brand: 'Uno',
            ean_barcode: '8690506000001',
            country_id: tr.id,
            category_id: ekmekId, // ALT KATEGORİ!
            image_url: 'https://example.com/ekmek.jpg',
        },
    });

    const domates = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '2000000000001' } },
        update: {
            name: 'Domates',
            category_id: sebzeId,
            image_url: 'https://example.com/domates.jpg',
        },
        create: {
            name: 'Domates',
            ean_barcode: '2000000000001',
            country_id: tr.id,
            category_id: sebzeId, // ALT KATEGORİ!
            image_url: 'https://example.com/domates.jpg',
        },
    });

    const cocaCola = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: tr.id, ean_barcode: '5449000000996' } },
        update: {
            name: 'Coca Cola 1L',
            brand: 'Coca Cola',
            category_id: icecekId,
            image_url: 'https://example.com/coca-cola.jpg',
        },
        create: {
            name: 'Coca Cola 1L',
            brand: 'Coca Cola',
            ean_barcode: '5449000000996',
            country_id: tr.id,
            category_id: icecekId, // ANA KATEGORİ (alt kategorisi yok)
            image_url: 'https://example.com/coca-cola.jpg',
        },
    });

    console.log('✅ Ürünler oluşturuldu (alt kategorilere atandı)');

    // 5. Fiyatlar oluştur
    await prisma.storePrice.createMany({
        skipDuplicates: true, // Aynı store_id + product_id varsa atla
        data: [
            // Pınar Süt fiyatları
            { store_id: migros.id, product_id: pinarSut.id, price: 45.50, unit: 'adet', source: 'scrape' },
            { store_id: carrefour.id, product_id: pinarSut.id, price: 44.90, unit: 'adet', source: 'scrape' },
            { store_id: a101.id, product_id: pinarSut.id, price: 42.95, unit: 'adet', source: 'scrape' },
            { store_id: sok.id, product_id: pinarSut.id, price: 43.50, unit: 'adet', source: 'scrape' },

            // Sütaş Süt fiyatları
            { store_id: migros.id, product_id: sutasSut.id, price: 44.90, unit: 'adet', source: 'scrape' },
            { store_id: carrefour.id, product_id: sutasSut.id, price: 43.50, unit: 'adet', source: 'scrape' },
            { store_id: a101.id, product_id: sutasSut.id, price: 41.95, unit: 'adet', source: 'scrape' },

            // İçim Süt fiyatları
            { store_id: migros.id, product_id: ichimSut.id, price: 46.50, unit: 'adet', source: 'scrape' },
            { store_id: sok.id, product_id: ichimSut.id, price: 44.50, unit: 'adet', source: 'scrape' },

            // Beyaz Peynir fiyatları
            { store_id: migros.id, product_id: beyazPeynir.id, price: 125.50, unit: 'adet', source: 'scrape' },
            { store_id: carrefour.id, product_id: beyazPeynir.id, price: 119.90, unit: 'adet', source: 'scrape' },

            // Ekmek fiyatları
            { store_id: migros.id, product_id: unoBeyazEkmek.id, price: 8.50, unit: 'adet', source: 'scrape' },
            { store_id: carrefour.id, product_id: unoBeyazEkmek.id, price: 8.00, unit: 'adet', source: 'scrape' },
            { store_id: a101.id, product_id: unoBeyazEkmek.id, price: 7.50, unit: 'adet', source: 'scrape' },
            { store_id: sok.id, product_id: unoBeyazEkmek.id, price: 7.75, unit: 'adet', source: 'scrape' },

            // Domates fiyatları
            { store_id: migros.id, product_id: domates.id, price: 32.50, unit: 'kg', source: 'scrape' },
            { store_id: carrefour.id, product_id: domates.id, price: 29.90, unit: 'kg', source: 'scrape' },
            { store_id: a101.id, product_id: domates.id, price: 28.50, unit: 'kg', source: 'scrape' },

            // Coca Cola fiyatları
            { store_id: migros.id, product_id: cocaCola.id, price: 35.50, unit: 'adet', source: 'scrape' },
            { store_id: carrefour.id, product_id: cocaCola.id, price: 33.90, unit: 'adet', source: 'scrape' },
            { store_id: sok.id, product_id: cocaCola.id, price: 32.95, unit: 'adet', source: 'scrape' },
        ],
    });

    console.log('✅ Fiyatlar oluşturuldu');

    // 5b. Yeni ülkeler için örnek ürünler + fiyatlar (CH/SE/DE)
    const chMilch = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: ch.id, ean_barcode: '7600000000001' } },
        update: { name: 'M-Budget Milch 1L', country_id: ch.id, category_id: sutId },
        create: { name: 'M-Budget Milch 1L', brand: 'M-Budget', ean_barcode: '7600000000001', country_id: ch.id, category_id: sutId },
    });
    const chCola = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: ch.id, ean_barcode: '7600000000002' } },
        update: { name: 'Coca-Cola 1L', country_id: ch.id, category_id: icecekId },
        create: { name: 'Coca-Cola 1L', brand: 'Coca-Cola', ean_barcode: '7600000000002', country_id: ch.id, category_id: icecekId },
    });
    const deMilch = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: de.id, ean_barcode: '4000000000001' } },
        update: { name: 'Ja! Milch 1L', country_id: de.id, category_id: sutId },
        create: { name: 'Ja! Milch 1L', brand: 'Ja!', ean_barcode: '4000000000001', country_id: de.id, category_id: sutId },
    });
    const deCola = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: de.id, ean_barcode: '5449000000012' } },
        update: { name: 'Coca-Cola 1L', country_id: de.id, category_id: icecekId },
        create: { name: 'Coca-Cola 1L', brand: 'Coca-Cola', ean_barcode: '5449000000012', country_id: de.id, category_id: icecekId },
    });
    const icaMjolk = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: se.id, ean_barcode: '7300000000001' } },
        update: { name: 'ICA Mjölk 1L', country_id: se.id, category_id: sutId },
        create: { name: 'ICA Mjölk 1L', brand: 'ICA', ean_barcode: '7300000000001', country_id: se.id, category_id: sutId },
    });
    const plMleko = await prisma.product.upsert({
        where: { country_id_ean_barcode: { country_id: pl.id, ean_barcode: '5900000000001' } },
        update: { name: 'Łaciate Mleko 1L', country_id: pl.id, category_id: sutId },
        create: { name: 'Łaciate Mleko 1L', brand: 'Łaciate', ean_barcode: '5900000000001', country_id: pl.id, category_id: sutId },
    });

    await prisma.storePrice.createMany({
        skipDuplicates: true,
        data: [
            // CH — Migros / Coop
            { store_id: migrosCh.id, product_id: chMilch.id, price: 1.55, unit: 'adet', source: 'seed' },
            { store_id: coopCh.id, product_id: chMilch.id, price: 1.65, unit: 'adet', source: 'seed' },
            { store_id: migrosCh.id, product_id: chCola.id, price: 2.20, unit: 'adet', source: 'seed' },
            { store_id: coopCh.id, product_id: chCola.id, price: 2.35, unit: 'adet', source: 'seed' },
            // DE — REWE / Kaufland
            { store_id: rewe.id, product_id: deMilch.id, price: 1.09, unit: 'adet', source: 'seed' },
            { store_id: kaufland.id, product_id: deMilch.id, price: 0.99, unit: 'adet', source: 'seed' },
            { store_id: rewe.id, product_id: deCola.id, price: 1.49, unit: 'adet', source: 'seed' },
            { store_id: kaufland.id, product_id: deCola.id, price: 1.39, unit: 'adet', source: 'seed' },
            // SE — ICA / Willys
            { store_id: ica.id, product_id: icaMjolk.id, price: 12.90, unit: 'adet', source: 'seed' },
            { store_id: willys.id, product_id: icaMjolk.id, price: 11.50, unit: 'adet', source: 'seed' },
            // PL — Carrefour / Auchan
            { store_id: carrefourPl.id, product_id: plMleko.id, price: 3.49, unit: 'adet', source: 'seed' },
            { store_id: auchan.id, product_id: plMleko.id, price: 3.29, unit: 'adet', source: 'seed' },
        ],
    });

    console.log('✅ Yeni ülkeler için örnek ürün/fiyatlar oluşturuldu (CH/SE/DE/PL)');

    // 6. Test kullanıcısı için favori marketler ekle
    await prisma.userFavoriteStore.createMany({
        data: [
            { user_id: testUser.id, store_id: migros.id },
            { user_id: testUser.id, store_id: a101.id },
        ],
        skipDuplicates: true,
    });

    console.log('✅ Favori marketler eklendi');

    // 7. Test alışveriş listesi oluştur
    const testList = await prisma.list.create({
        data: {
            user_id: testUser.id,
            name: 'Haftalık Alışveriş',
            budget: 500,
            list_items: {
                create: [
                    { product_id: pinarSut.id, quantity: 2, unit: 'adet' },
                    { product_id: unoBeyazEkmek.id, quantity: 4, unit: 'adet' },
                    { product_id: domates.id, quantity: 2, unit: 'kg' },
                    { product_id: cocaCola.id, quantity: 3, unit: 'adet' },
                ],
            },
        },
    });

    console.log('✅ Test alışveriş listesi oluşturuldu');

    const totalCategories = await prisma.category.count();
    const parentCategories = await prisma.category.count({ where: { parent_id: null } });
    const subCategories = totalCategories - parentCategories;

    console.log('\n🎉 Seed işlemi başarıyla tamamlandı!');
    console.log('\n📊 Oluşturulan veriler:');
    console.log(`- 1 Test kullanıcı (email: ${testUser.email})`);
    console.log(`- 4 Market`);
    console.log(`- ${parentCategories} Ana Kategori (Standart)`);
    console.log(`- ${subCategories} Alt Kategori (Standart)`);
    console.log(`- 7 Ürün (alt kategorilere atanmış)`);
    console.log(`- 19 Fiyat kaydı`);
    console.log(`- 1 Alışveriş listesi (4 ürün)`);
    console.log('\n📋 Kategori Hiyerarşisi (Standart):');
    console.log('- Tüm marketler için aynı standart kategori yapısı kullanılıyor');
}

main()
    .catch((e) => {
        console.error('❌ Seed işlemi sırasında hata:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

