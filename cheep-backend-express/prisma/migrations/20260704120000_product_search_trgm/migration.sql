-- cheep-backend-express/prisma/migrations/20260704120000_product_search_trgm/migration.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) STABLE'dır; indeks için IMMUTABLE sarmalayıcı gerekir.
-- Türkçe İ/I/ı → i eşlemesi (noktalı/noktasız i) + aksan sadeleştirme + küçük harf.
CREATE OR REPLACE FUNCTION cheep_normalize(txt text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(
    public.unaccent('public.unaccent',
      translate(coalesce(txt, ''), 'İIı', 'iii')
    )
  )
$$;

CREATE INDEX IF NOT EXISTS products_name_trgm
  ON products USING gin (cheep_normalize(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_brand_trgm
  ON products USING gin (cheep_normalize(coalesce(brand, '')) gin_trgm_ops);
