-- Bite Me Baby — Migration 170: ฟิลด์ต้นทุนสินค้าสำหรับ Gross Margin / Net Profit
-- (Owner 2026-10-29 · R21 Phase 2 — "Core Business Logic")
--
-- ทำไมอยู่ที่ client helper: แอดมินกรอกต้นทุนเองในหน้า Products แล้วหน้าเว็บ
-- คำนวณกำไรแบบ real-time ให้เห็นทันที (src/lib/marginCalc.ts) — ตัวเลข DISPLAY ONLY
-- ไม่แตะราคาที่ลูกค้าจ่าย (server RPC ยังเป็น authority ของราคา/ส่วนลดเดิม)
--
-- กติกา:
--   * ค่าทุกตัว >= 0 เท่านั้น — "กำไรติดลบ" ดูจาก margin ที่คำนวณ ไม่ใช่กรอกติดลบ
--   * unit_cost = ผลรวม = GENERATED (storage) กันหน้าบ้านบวกเองแล้วเพี้ยนคนละฉบับ
--   * ไม่แตะ RLS/GRANT ของ products (005/071/147 คงเดิม) — แอดมินแก้ได้ตามสิทธิ์เดิม
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cogs            NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost  NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_cost_fields_nonneg;
ALTER TABLE public.products ADD CONSTRAINT products_cost_fields_nonneg
  CHECK (cogs >= 0 AND packaging_cost >= 0 AND other_unit_cost >= 0);

-- ต้นทุนรวมต่อหน่วย (generated → ตรงกันทุก query ทุกหน้า)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unit_cost_generated_ck;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(10,2)
  GENERATED ALWAYS AS (
    COALESCE(cogs,0) + COALESCE(packaging_cost,0) + COALESCE(other_unit_cost,0)
  ) STORED;

COMMENT ON COLUMN public.products.cogs           IS 'ต้นทุนวัตถุดิบต่อหน่วย (แอดมินกรอก — ใช้คำนวณ Gross Margin)';
COMMENT ON COLUMN public.products.packaging_cost IS 'ค่าแพ็กเกจจิ้งต่อหน่วย (ถุง/กล่อง/ฝา/สติกเกอร์)';
COMMENT ON COLUMN public.products.other_unit_cost IS 'ต้นทุนอื่นต่อหน่วย (ค่าแรง/ค่าไฟ/ค่าส่งภายในสินค้า) — ปรับเองได้';
COMMENT ON COLUMN public.products.unit_cost      IS 'ต้นทุนรวมต่อหน่วย = cogs + packaging_cost + other_unit_cost (generated)';
