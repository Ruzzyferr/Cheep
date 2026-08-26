-- Arama alaka eşiği değerlendirmesi
--
-- NEDEN VAR: `products.service.ts` arama sorgusunu bir transaction içinde
-- `SET LOCAL pg_trgm.word_similarity_threshold = <e>` ile çalıştırıyor.
-- Bu tek sayı, aramanın YAZIM HATASI TOLERANSI ile ÇÖP SONUÇ oranı
-- arasındaki takası belirliyor:
--
--   düşük  -> "peynr" peyniri bulur, ama "chicken" chili/chips/chia getirir
--   yüksek -> çöp gider, ama "ekemk" hiçbir şey bulmaz
--
-- Bu dosya o takası ÖLÇMEK için. Eşiği değiştirmeden önce çalıştırın;
-- "daha iyi hissettirdi" bir gerekçe değil.
--
-- Sorgular UYDURMA DEĞİL: üretimdeki Caddy erişim loglarından çıkarıldı
-- (593 arama, 307 benzersiz). Sınıflar farklı şeyleri ölçüyor:
--
--   IYI      gerçek ürün kelimesi        -> sonuç dönmeli, ilk sonuç doğru olmalı
--   ONEK     yazarken arama (y, yu, yum) -> DÖNMELİ; kullanıcı her tuşta sorgu atıyor
--   YAZIM    gerçek yazım hataları        -> dönmeli (eşiğin asıl varlık sebebi)
--   ESLESMEZ katalogda karşılığı yok      -> HİÇ dönmemeli ya da yalnızca gerçek eşleşme
--   COP      anlamsız girdi               -> dönmemeli, ama patlamamalı da
--
-- ÖNEMLİ TUZAK: önekleri `word_similarity` DEĞİL, alt dize dalı yakalıyor.
-- Yani eşiği yükseltmek yazarken aramayı bozmaz — bu ölçümle doğrulandı.
--
-- Çalıştırma:
--   docker cp scripts/search-threshold-eval.sql deploy-db-1:/tmp/e.sql
--   docker exec deploy-db-1 psql -U cheep -d cheep_db -f /tmp/e.sql
--
-- 26 Ağu 2026 ölçümü (TR country_id=1, PL country_id=2):
--   0.35 -> 0.45 : bütün IYI sorgularında İLK SONUÇ AYNI kaldı, beş YAZIM
--                  hatası da çalışmaya devam etti, "chicken" 53 çöp sonuçtan
--                  0'a düştü. Lehçe'de de on sorgunun hepsi doğru kaldı.
--   0.55         : ÇOK AGRESİF — "ekemk" 41 -> 0, "jajka" 195 -> 20.
--   Sonuç: 0.45 seçildi.

\pset pager off
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS _q;
CREATE TEMP TABLE _q(ulke int, sinif text, q text);
INSERT INTO _q VALUES
 (1,'IYI','peynir'),(1,'IYI','süt'),(1,'IYI','yumurta'),(1,'IYI','ekmek'),
 (1,'IYI','çay'),(1,'IYI','makarna'),(1,'IYI','domates'),(1,'IYI','yoğurt'),
 (1,'IYI','muz'),(1,'IYI','zeytinyağı'),(1,'IYI','pirinç'),(1,'IYI','deterjan'),
 (1,'ONEK','y'),(1,'ONEK','yu'),(1,'ONEK','yum'),(1,'ONEK','yumu'),(1,'ONEK','yumurt'),
 (1,'ONEK','av'),(1,'ONEK','avoka'),
 (1,'YAZIM','peynr'),(1,'YAZIM','sut'),(1,'YAZIM','yogurt'),(1,'YAZIM','makarrna'),(1,'YAZIM','ekemk'),
 (1,'ESLESMEZ','chicken'),(1,'ESLESMEZ','cheese'),(1,'ESLESMEZ','coffee'),
 (1,'ESLESMEZ','water'),(1,'ESLESMEZ','chocolate'),(1,'ESLESMEZ','protein'),
 (1,'COP','ççç'),(1,'COP','a(['),(1,'COP','zzzqwx'),
 (2,'IYI','mleko'),(2,'IYI','chleb'),(2,'IYI','pomidory'),(2,'IYI','ryż'),
 (2,'IYI','makaron'),(2,'IYI','kawa'),(2,'IYI','masło'),(2,'IYI','ser'),
 (2,'IYI','jajka'),(2,'IYI','woda'),
 (2,'ONEK','mle'),(2,'ONEK','chl'),(2,'ONEK','pomid'),
 (2,'YAZIM','chlb'),(2,'YAZIM','makarron');

DROP TABLE IF EXISTS _r;
CREATE TEMP TABLE _r(esik numeric, ulke int, sinif text, q text, n int, ilk text);

DO $$
DECLARE e numeric; r record; c int; ad text;
BEGIN
  FOREACH e IN ARRAY ARRAY[0.35,0.45,0.55] LOOP
    PERFORM set_config('pg_trgm.word_similarity_threshold', e::text, false);
    FOR r IN SELECT ulke,sinif,q FROM _q LOOP
      -- WHERE ve ORDER BY, products.service.ts ile AYNI olmalı; oradaki
      -- sorgu değişirse burası da güncellenmeli, yoksa ölçüm yalan söyler.
      SELECT count(*) INTO c FROM products p WHERE p.country_id=r.ulke AND (
        (cheep_normalize(p.name) LIKE '%'||cheep_normalize(r.q)||'%'
         OR cheep_normalize(coalesce(p.brand,'')) LIKE '%'||cheep_normalize(r.q)||'%')
        OR cheep_normalize(r.q) <% cheep_normalize(p.name));
      SELECT p.name INTO ad FROM products p WHERE p.country_id=r.ulke AND (
        (cheep_normalize(p.name) LIKE '%'||cheep_normalize(r.q)||'%'
         OR cheep_normalize(coalesce(p.brand,'')) LIKE '%'||cheep_normalize(r.q)||'%')
        OR cheep_normalize(r.q) <% cheep_normalize(p.name))
      ORDER BY
        ((' '||cheep_normalize(p.name)||' ') LIKE ('% '||cheep_normalize(r.q)||' %'))::int DESC,
        word_similarity(cheep_normalize(r.q), cheep_normalize(p.name)) DESC,
        least(floor(similarity(cheep_normalize(r.q), cheep_normalize(p.name))/0.10),3) DESC
      LIMIT 1;
      INSERT INTO _r VALUES (e,r.ulke,r.sinif,r.q,c,ad);
    END LOOP;
  END LOOP;
END $$;

\echo '=== SINIF OZETI: kac sorgu sonuc donuyor ==='
SELECT esik, ulke, sinif, count(*) FILTER (WHERE n>0) AS donen, count(*) AS toplam
FROM _r GROUP BY esik,ulke,sinif ORDER BY ulke,sinif,esik;

\echo ''
\echo '=== SORGU BAZINDA: ilk sonuc esikle degisiyor mu? ==='
SELECT ulke, sinif, q,
  max(n)    FILTER (WHERE esik=0.35) AS "n@35",
  max(n)    FILTER (WHERE esik=0.45) AS "n@45",
  max(n)    FILTER (WHERE esik=0.55) AS "n@55",
  (max(ilk) FILTER (WHERE esik=0.35) IS DISTINCT FROM max(ilk) FILTER (WHERE esik=0.45)) AS "ilk_degisti_35_45",
  left(max(ilk) FILTER (WHERE esik=0.45),38) AS "ilk@45"
FROM _r GROUP BY ulke,sinif,q ORDER BY ulke,sinif,q;
