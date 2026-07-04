-- Liste sadeleştirme: status'u 'active'/'inactive' aktif-işaretine indirge.
-- Kullanıcı başına EN SON güncellenen liste aktif, kalan hepsi pasif.
-- Eski 'completed' ve is_template listeler normal (inactive) listeye döner; veri silinmez.

-- 1) Hepsini pasife çek
UPDATE "lists" SET "status" = 'inactive';

-- 2) Her kullanıcının en son güncellenen listesini aktif yap
UPDATE "lists" l
SET "status" = 'active'
FROM (
  SELECT DISTINCT ON ("user_id") "id"
  FROM "lists"
  ORDER BY "user_id", "updated_at" DESC, "id" DESC
) pick
WHERE l."id" = pick."id";
