-- Cheep TR katalog KÖKTEN yeniden kurulum — katalog verisini boşaltır.
-- Kullanıcı hesapları + ülkeler KORUNUR; ürün/fiyat/kategori/liste-öğesi SİLİNİR.
-- Sonra: kategoriler API ile (mf_seed_categories.py), ürünler API ile (mf_ingest.py) yüklenir.

BEGIN;

-- Katalog + bağımlı veriyi sıfırla (id sayaçları da sıfırlanır → kategoriler 1'den başlar)
TRUNCATE TABLE
  store_prices, price_history, price_feedbacks, list_items,
  affiliate_clicks, store_branches, products, categories
  RESTART IDENTITY CASCADE;

-- Devlette olmayan zinciri kaldır (Hakmar = 7); 6 ulusal zincir kalır
DELETE FROM stores WHERE id = 7;

-- 6 devlet zinciri garanti (STORE_MAP ile aynı id'ler). Ada göre günceller.
INSERT INTO stores (id, name, country_id, created_at, updated_at) VALUES
  (1, 'Migros',              (SELECT id FROM countries WHERE code='TR'), now(), now()),
  (2, 'CarrefourSA',         (SELECT id FROM countries WHERE code='TR'), now(), now()),
  (3, 'A101',                (SELECT id FROM countries WHERE code='TR'), now(), now()),
  (4, 'ŞOK',                 (SELECT id FROM countries WHERE code='TR'), now(), now()),
  (5, 'BİM',                 (SELECT id FROM countries WHERE code='TR'), now(), now()),
  (6, 'Tarım Kredi Market',  (SELECT id FROM countries WHERE code='TR'), now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

-- HUKUKİ: telifli market logolarını KULLANMIYORUZ (uygulama renkli rozet gösterir).
-- Eski kayıtlardan kalma logo_url'leri temizle ki hiçbir istemci (mobil/web) amblem basmasın.
UPDATE stores SET logo_url = NULL
 WHERE country_id = (SELECT id FROM countries WHERE code='TR') AND logo_url IS NOT NULL;

-- stores id sayacını en büyük id'ye çek (yeni market gerekmez ama tutarlı olsun)
SELECT setval(pg_get_serial_sequence('stores','id'),
              GREATEST((SELECT COALESCE(max(id),1) FROM stores), 6));

COMMIT;

-- Doğrulama
SELECT 'stores' t, count(*) n FROM stores
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'store_prices', count(*) FROM store_prices
UNION ALL SELECT 'categories', count(*) FROM categories;
