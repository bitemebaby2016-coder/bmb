-- ============================================
-- Phase 2 WP1: RLS — Organization + Branch Isolation (SCHEMA ONLY)
-- Migration 223 (renumbered from draft 224 per Owner scope correction)
-- Dependencies: 146 (role predicates), 065/071 (tenant isolation),
--               088/090 (branch isolation), 219-222
--
-- Owner C (2026-11-26): ห้ามใช้ Role Check เพียงอย่างเดียว — ทุก policy
-- ต้องผ่าน Organization (tenant) + Branch isolation ด้วย
--
-- รูปแบบตาม Permission Model เดิม (Phase 1):
--   m065/m071  tenant isolation: COALESCE(profiles.tenant_id,'tenant-bmb-001')
--              = COALESCE(row.tenant_id,'tenant-bmb-001') + is_platform bypass
--   m088/m090  branch isolation: profiles.branch_id — admin/owner ข้าม branch
--              ได้ภายใน tenant (is_branch_admin ไม่เช็ค branch ของ admin),
--              staff ที่ไม่มี assignment = ระดับ tenant, staff ที่ถูก assign
--              เห็นเฉพาะ branch ตัวเอง
--   m146       role predicates: is_admin()=admin|owner, is_finance(),
--              is_inventory(), is_kitchen(), is_pos()
--
-- has_org_row_scope รวมสามชั้นเป็นตัวเดียว:
--   1. auth ว่าง → FALSE · profile ไม่พบ → FALSE
--   2. is_platform → TRUE (bypass แบบ m071/m088)
--   3. tenant mismatch → FALSE (org isolation)
--   4. admin/owner ภายใน tenant → TRUE (cross-branch ตาม model เดิม)
--   5. staff ไม่มี assignment → TRUE (ระดับ tenant — พฤติกรรมปัจจุบัน)
--      row ไม่มี branch → TRUE (row tenant-wide)
--      staff มี branch ≠ row branch → FALSE (cross-branch denial)
-- Role check แยกต่างหากด้วย predicate จาก m146 (is_admin/is_finance/...)
-- ============================================

BEGIN;

-- ============================================
-- Helper: Organization + Branch row scope (SECURITY DEFINER เพื่ออ่าน
-- profiles ที่มี RLS — pattern เดียวกับ is_admin()/is_branch_admin เดิม)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_org_row_scope(
  p_tenant_id TEXT,
  p_branch_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_user_tenant  TEXT;
  v_user_branch  TEXT;
  v_is_platform  BOOLEAN;
  v_is_tenant_admin BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN FALSE; END IF;

  SELECT COALESCE(tenant_id, 'tenant-bmb-001'),
         branch_id,
         COALESCE(is_platform, FALSE)
    INTO v_user_tenant, v_user_branch, v_is_platform
    FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_user_tenant IS NULL THEN RETURN FALSE; END IF;

  -- 1) Platform bypass (m071/m088 pattern)
  IF v_is_platform THEN RETURN TRUE; END IF;

  -- 2) Organization isolation (m065/m071 pattern)
  IF v_user_tenant <> COALESCE(p_tenant_id, 'tenant-bmb-001') THEN RETURN FALSE; END IF;

  -- 3) Branch isolation (m088/m090 pattern)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_uid AND role IN ('admin', 'owner') AND is_active = true
  ) INTO v_is_tenant_admin;
  IF v_is_tenant_admin THEN RETURN TRUE; END IF;   -- admin/owner ข้าม branch ภายใน tenant

  IF v_user_branch IS NULL THEN RETURN TRUE; END IF; -- staff ไม่ถูก assign = ระดับ tenant
  IF p_branch_id IS NULL THEN RETURN TRUE; END IF;   -- row tenant-wide
  RETURN v_user_branch = p_branch_id;                -- staff ที่ถูก assign เห็นเฉพาะ branch ตัวเอง
END $$;

REVOKE EXECUTE ON FUNCTION public.has_org_row_scope(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_org_row_scope(TEXT, TEXT) TO authenticated;

-- ============================================
-- ENABLE RLS on new tables
-- ============================================
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_price_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- purchase_orders policies (5) — role predicate + org/branch scope
-- ============================================

-- Admin full access (cross-branch within tenant; platform bypass)
DROP POLICY IF EXISTS po_admin ON purchase_orders;
CREATE POLICY po_admin ON purchase_orders
  FOR ALL TO authenticated
  USING (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- Creator read/write own drafts/submitted (staff branch scope applies)
DROP POLICY IF EXISTS po_creator_rw ON purchase_orders;
CREATE POLICY po_creator_rw ON purchase_orders
  FOR ALL TO authenticated
  USING (requested_by = auth.uid()
         AND status IN ('draft', 'submitted')
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (requested_by = auth.uid()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- Finance approver: submitted/approved/ordered + branch scope
DROP POLICY IF EXISTS po_finance_rw ON purchase_orders;
CREATE POLICY po_finance_rw ON purchase_orders
  FOR ALL TO authenticated
  USING (public.is_finance()
         AND status IN ('submitted', 'approved', 'ordered')
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_finance()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- Inventory/Procurement: ordered/receiving states + branch scope
DROP POLICY IF EXISTS po_inventory_rw ON purchase_orders;
CREATE POLICY po_inventory_rw ON purchase_orders
  FOR ALL TO authenticated
  USING (public.is_inventory()
         AND status IN ('approved', 'ordered', 'partially_received', 'completed')
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_inventory()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- Receiver read ordered POs + branch scope
DROP POLICY IF EXISTS po_receiver_r ON purchase_orders;
CREATE POLICY po_receiver_r ON purchase_orders
  FOR SELECT TO authenticated
  USING (public.is_inventory()
         AND status IN ('ordered', 'partially_received')
         AND public.has_org_row_scope(tenant_id, branch_id));

-- ============================================
-- purchase_order_lines policies (4) — scope via parent PO row
-- ============================================

DROP POLICY IF EXISTS pol_admin ON purchase_order_lines;
CREATE POLICY pol_admin ON purchase_order_lines
  FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ))
  WITH CHECK (public.is_admin() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ));

DROP POLICY IF EXISTS pol_creator_rw ON purchase_order_lines;
CREATE POLICY pol_creator_rw ON purchase_order_lines
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND po.requested_by = auth.uid()
      AND po.status IN ('draft', 'submitted')
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND po.requested_by = auth.uid()
      AND po.status IN ('draft', 'submitted')
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ));

DROP POLICY IF EXISTS pol_finance_rw ON purchase_order_lines;
CREATE POLICY pol_finance_rw ON purchase_order_lines
  FOR ALL TO authenticated
  USING (public.is_finance() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND po.status IN ('submitted', 'approved', 'ordered')
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ))
  WITH CHECK (public.is_finance() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ));

DROP POLICY IF EXISTS pol_inventory_rw ON purchase_order_lines;
CREATE POLICY pol_inventory_rw ON purchase_order_lines
  FOR ALL TO authenticated
  USING (public.is_inventory() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND po.status IN ('approved', 'ordered', 'partially_received', 'completed')
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ))
  WITH CHECK (public.is_inventory() AND EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_lines.po_id
      AND public.has_org_row_scope(po.tenant_id, po.branch_id)
  ));

-- ============================================
-- goods_receipts policies (3)
-- ============================================

DROP POLICY IF EXISTS grn_admin ON goods_receipts;
CREATE POLICY grn_admin ON goods_receipts
  FOR ALL TO authenticated
  USING (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id));

DROP POLICY IF EXISTS grn_creator_rw ON goods_receipts;
CREATE POLICY grn_creator_rw ON goods_receipts
  FOR ALL TO authenticated
  USING (received_by = auth.uid()
         AND status IN ('draft', 'submitted')
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (received_by = auth.uid()
         AND public.has_org_row_scope(tenant_id, branch_id));

DROP POLICY IF EXISTS grn_inventory_rw ON goods_receipts;
CREATE POLICY grn_inventory_rw ON goods_receipts
  FOR ALL TO authenticated
  USING (public.is_inventory()
         AND status IN ('submitted', 'approved', 'posted', 'reversed')
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_inventory()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- ============================================
-- goods_receipt_lines policies (3) — scope via parent GRN row
-- ============================================

DROP POLICY IF EXISTS grl_admin ON goods_receipt_lines;
CREATE POLICY grl_admin ON goods_receipt_lines
  FOR ALL TO authenticated
  USING (public.is_admin() AND EXISTS (
    SELECT 1 FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND public.has_org_row_scope(gr.tenant_id, gr.branch_id)
  ))
  WITH CHECK (public.is_admin() AND EXISTS (
    SELECT 1 FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND public.has_org_row_scope(gr.tenant_id, gr.branch_id)
  ));

DROP POLICY IF EXISTS grl_inventory_rw ON goods_receipt_lines;
CREATE POLICY grl_inventory_rw ON goods_receipt_lines
  FOR ALL TO authenticated
  USING (public.is_inventory() AND EXISTS (
    SELECT 1 FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND public.has_org_row_scope(gr.tenant_id, gr.branch_id)
  ))
  WITH CHECK (public.is_inventory() AND EXISTS (
    SELECT 1 FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND public.has_org_row_scope(gr.tenant_id, gr.branch_id)
  ));

DROP POLICY IF EXISTS grl_receiver_r ON goods_receipt_lines;
CREATE POLICY grl_receiver_r ON goods_receipt_lines
  FOR SELECT TO authenticated
  USING (public.is_inventory() AND EXISTS (
    SELECT 1 FROM goods_receipts gr
    WHERE gr.id = goods_receipt_lines.grn_id
      AND public.has_org_row_scope(gr.tenant_id, gr.branch_id)
  ));

-- ============================================
-- purchase_price_history policies (2) — tenant/branch on the row
-- (คอลัมน์ tenant_id/branch_id ถูก copy จาก PO/GRN header ตอน insert โดย WP6)
-- ============================================

DROP POLICY IF EXISTS pph_admin ON purchase_price_history;
CREATE POLICY pph_admin ON purchase_price_history
  FOR ALL TO authenticated
  USING (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id))
  WITH CHECK (public.is_admin()
         AND public.has_org_row_scope(tenant_id, branch_id));

-- Staff read (inventory, finance, kitchen, pos) + branch scope
DROP POLICY IF EXISTS pph_staff_read ON purchase_price_history;
CREATE POLICY pph_staff_read ON purchase_price_history
  FOR SELECT TO authenticated
  USING ((public.is_inventory() OR public.is_finance()
          OR public.is_kitchen() OR public.is_pos())
         AND public.has_org_row_scope(tenant_id, branch_id));

-- ============================================
-- SECURITY DEFINER note (Owner C):
-- Workflow RPCs (WP2/WP4/WP6/WP7/WP8) ที่ใช้ SECURITY DEFINER ต้องตรวจ
-- role + has_org_row_scope ภายในตัวเองทุกครั้ง (RLS ไม่ถูกบังคับใน
-- SECURITY DEFINER) — ข้อกำหนดนี้ถูกระบุไว้ในหัว staged SQL ทุกไฟล์
-- และจะถูกทดสอบใน integration test ของ WP เจ้าของ
-- ============================================
-- inventory_transactions: คอลัมน์ใหม่ (222) ถูกครอบโดย RLS เดิมของตาราง
-- ============================================

COMMIT;
