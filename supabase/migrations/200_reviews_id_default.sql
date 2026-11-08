-- ============================================================
-- Bite Me Baby — Migration 200: ซ่อม D9 (R88 ตามรอย retest ⑨ หลังแก้ D7)
--   Owner 2026-11-08 ~22:34 น.: "พอเขียนรีวิวแล้วฟ้องแบบภาพ"
--   toast: null value in column "id" of relation "reviews" violates not-null constraint
-- ต้นตอ (probe7 READ-ONLY): reviews.id = text NOT NULL · column_default = ไม่มีเลย
--   + submit_verified_review (m199) INSERT ไม่ใส่คอลัมน์ id (พึ่ง default + RETURNING id)
--   → default ไม่มี = insert ล้มเหลวเสมอ (m099/m198 ก็มีอาการเดียวกันแต่ไม่เคยถูกยิงจริง — ตารางว่าง)
-- FIX: ตั้ง default สร้าง id สไตล์โปรเจกต์ `rev-<ms epoch>-<suffix6>` (กันชนิด + กันชน 24bit)
--   — function ไม่ต้องแก้: INSERT ไม่ใส่ id → ใช้ default → RETURNING id ได้ค่าจริง
--   + ทางแทรกตรง customers_insert_own_review ก็ได้ id ด้วย (กันชนีเดียวกัน)
-- ห้ามทำซ้ำ: กติกา m198/m199 คงเดิมทั้งหมด (delivered + dedupe + status='pending' + ERR เดิม)
-- ============================================================

BEGIN;

ALTER TABLE public.reviews
  ALTER COLUMN id SET DEFAULT (
    'rev-' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint
    || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6)
  );

-- verify: default ต้องมีจริง + id ยัง NOT NULL (ถ้าหาย = ERR_R88_REVIEW_ID_DEFAULT_MISSING)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews'
      AND column_name = 'id' AND column_default IS NOT NULL AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'ERR_R88_REVIEW_ID_DEFAULT_MISSING';
  END IF;
  RAISE NOTICE 'R88 D9 fixed: reviews.id default = rev-<ms>-<suffix6> (submit insert will succeed)';
END $$;

COMMIT;