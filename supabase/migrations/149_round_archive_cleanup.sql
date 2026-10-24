-- ============================================================
-- Migration 149 — ROUND ARCHIVE + CLEANUP (P0-2: "รอบค้าง ลบไม่ได้")
-- Owner directive 2026-10-24: "บางอันลบไม่ได้ ที่ค้างทั้งหมดเป็นพวกลบไม่ได้"
--
-- ROOT CAUSE (พิสูจน์ด้วย read-only probe `e2e/p14ProbeRounds.cjs` →
--   evidence `e2e/p14ProbeRounds.json` 2026-10-24):
--   · orders.delivery_round_id  -> delivery_rounds(id) = NO ACTION (products ก็เช่นกัน)
--     → DELETE รอบที่มีออเดอร์อ้างอิง = FK violation เสมอ (production: 4 รอบเก่า/4 ออเดอร์)
--   · RLS ไม่ใช่ตัวการ (admin profile = is_platform=true → is_branch_admin = TRUE)
--   · ทุกแถวใน production = status 'closed' · 4 แถวเก่ามีออเดอร์ · แถวว่างนี้ 0
--
-- ทางแก้ (รูปแบบเดียวกับ products — archive ไม่ใช่ hard delete):
--   149a คอลัมน์ `archived boolean NOT NULL DEFAULT false`
--   149b cleanup: รอบวันที่ผ่านไปแล้ว "ที่ไม่มีใครอ้างอิง" = ลบได้จริง → ลบ (idempotent)
--   149c archive: รอบวันที่ผ่านไปแล้ว "ที่มีออเดอร์อ้างอิง" = ลบไม่ได้ → เก็บ + audit
--        (status ตั้ง closed ด้วย — RLS public read กรอง status='active' อยู่แล้ว)
--
-- UI (AdminRounds): ปุ่ม "📦 เก็บ" / "↩ กู้คืน" + เหตุผลที่ UI แสดงต้องตรงความจริง
--   (FK error 23503 → "มีออเดอร์อ้างอิง — ลบถาวรไม่ได้ · เก็บแทนได้")
-- คอลัมน์นี้ไม่มีผลกับการสั่งซื้อ: create_order_with_items ไม่ได้ใช้ `archived`
--   (ด่านของรอบยังเป็น status/schedule_date/ความจุ เหมือนเดิม)
--
-- สร้างโดย hand (สั้น — ไม่ต้อง anchor ต่อจากไฟล์อื่น)
-- สัญญาทดสอบ: e2e/contracts_149_round_archive.sql
-- Rollback: ALTER TABLE ... DROP COLUMN IF EXISTS archived (ไม่มี data loss;
--           แถวที่ถูก cleanup ออก = สร้างคืนด้วย ensure_rounds_for_date ได้)
-- ============================================================

BEGIN;

-- ---- 149a: คอลัมน์ archive (mirror ของ products.archived) ----
ALTER TABLE public.delivery_rounds
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- ---- 149b: cleanup — รอบเก่าที่ไม่มีแถวอ้างอิงใด ๆ (ลบได้จริง ไม่โดน FK) ----
DELETE FROM public.delivery_rounds r
 WHERE r.scheduled_date < (now() AT TIME ZONE 'Asia/Bangkok')::date
   AND NOT EXISTS (SELECT 1 FROM public.orders o      WHERE o.delivery_round_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM public.products p    WHERE p.delivery_round_id = r.id);

-- ---- 149c: archive — รอบเก่าที่มีออเดอร์อ้างอิง (ลบไม่ได้) → เก็บ + audit ----
DO $$
DECLARE
  r record;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT id, display_name, scheduled_date
      FROM public.delivery_rounds dr
     WHERE dr.scheduled_date < (now() AT TIME ZONE 'Asia/Bangkok')::date
       AND dr.archived = false
       AND (
         EXISTS (SELECT 1 FROM public.orders o   WHERE o.delivery_round_id = dr.id)
         OR EXISTS (SELECT 1 FROM public.products p WHERE p.delivery_round_id = dr.id)
       )
  LOOP
    UPDATE public.delivery_rounds
       SET archived = true, status = 'closed', updated_at = now()
     WHERE id = r.id;
    BEGIN
      PERFORM public.append_audit_log(
        p_action := 'settings_change',
        p_entity_type := 'delivery_round',
        p_entity_id := r.id,
        p_description := format('archive เก็บรอบ "%s" (%s) : ที่ผ่านมาแล้วและมีออเดอร์อ้างอิง — ลบถาวรไม่ได้ (FK)', r.display_name, r.scheduled_date),
        p_metadata := jsonb_build_object('archived', true, 'reason', 'past-date-has-refs', 'scheduled_date', r.scheduled_date),
        p_user_email := null
      );
    EXCEPTION WHEN OTHERS THEN
      raise notice '149 archive: audit write failed for % (%)', r.id, sqlerrm;
    END;
    v_n := v_n + 1;
  END LOOP;
  raise notice '149: archived % past round(s) with references', v_n;
END $$;

COMMIT;