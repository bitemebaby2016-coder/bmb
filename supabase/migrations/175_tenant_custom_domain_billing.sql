-- ============================================
-- Migration 175 (PREPARED — ยังไม่ apply · รอ Owner สั่ง `__apply 175__`)
-- Task 2: Multi-Tenant & White-Label Preparedness
--   (a) tenants.custom_domain — ผูกโดเมนเฉพาะลูกค้า (order.bakerybrand.com)
--       ให้ Cloudflare Worker reverse-proxy อ่านแล้วดึงธีม/ข้อมูลร้านนั้น ๆ
--   (b) billing_subscriptions — ติดตามงวดบริการรายเดือน/รายปีของร้านพาร์ทเนอร์
--       (แจ้งเตือนตัดงวด = automation job ถัดไปเมื่อ Owner เปิดใช้ LINE Notify secret)
-- ADDITIVE ONLY · re-run ปลอดภัย (IF NOT EXISTS ทุกจุด) · ไม่แตะข้อมูลเดิมของ BMB
-- 证据基线: 059 tenants = single tenant 'tenant-bmb-001' · is_tenant_admin_of (106) = authority
-- ============================================

BEGIN;

-- ---- (a) custom domain routing ----
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_domain text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_custom_domain
  ON public.tenants (custom_domain) WHERE custom_domain IS NOT NULL;
COMMENT ON COLUMN public.tenants.custom_domain IS
  'White-label: hostname เฉพาะของร้าน (เช่น order.bakerybrand.com) — worker lookup + theme resolve';

-- BMB = default tenant: domain หลักของตัวเองชี้กลับมาที่ tenant เดิม (idempotent)
UPDATE public.tenants
   SET custom_domain = 'biteme-baby.com', updated_at = now()
 WHERE id = 'tenant-bmb-001'
   AND (custom_domain IS NULL OR custom_domain <> 'biteme-baby.com');

-- ---- (a2) brand AI prompt ต่อร้าน (Onboarding Wizard เก็บ — ai-proxy อ่านต่อรอบถัดไป) ----
-- brands มีอยู่แล้วจาก 059 (name/logo_url/color_scheme) — เติมเฉพาะช่อง prompt ที่ขาด
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS ai_prompt text;
COMMENT ON COLUMN public.brands.ai_prompt IS
  'White-label: prompt/persona ของ AI ประจำร้าน (Onboarding Wizard) — read side = ai-proxy/aiDbContext (ยังไม่ต่อ · เก็บก่อน)';

-- ---- (b) billing & tier subscription ----
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.tenants(id),
  plan text NOT NULL DEFAULT 'standard',
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_baht numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_baht >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  remind_days_before integer NOT NULL DEFAULT 3 CHECK (remind_days_before >= 0),
  channel text NOT NULL DEFAULT 'line_notify',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_tenant
  ON public.billing_subscriptions (tenant_id, current_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_due
  ON public.billing_subscriptions (status, current_period_end);

COMMENT ON TABLE public.billing_subscriptions IS
  'Partner billing ledger (Task 2) — แถว = งวดบริการ 1 ช่วง · reminder = future automation job (LINE Notify secret ยังไม่ได้ตั้ง)';

-- RLS: admin/tenant manage — ห้าม public อ่านข้อมูลการเงิน
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_admin_manage ON public.billing_subscriptions;
CREATE POLICY billing_admin_manage ON public.billing_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS billing_tenant_scope ON public.billing_subscriptions;
CREATE POLICY billing_tenant_scope ON public.billing_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'tenant_admin')
        AND p.tenant_id = public.billing_subscriptions.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'tenant_admin')
        AND p.tenant_id = public.billing_subscriptions.tenant_id
    )
  );

-- อ่านอย่างเดียวให้แอดมินระบบร้านอื่น ๆ (RLS ข้างบนคัดกรองอยู่แล้ว)
GRANT SELECT ON public.billing_subscriptions TO authenticated;

COMMIT;

-- ROLLBACK (manual): DROP POLICY IF EXISTS billing_tenant_scope/billing_admin_manage;
--   DROP TABLE IF EXISTS public.billing_subscriptions;
--   DROP INDEX IF EXISTS idx_tenants_custom_domain; ALTER TABLE public.tenants DROP COLUMN IF EXISTS custom_domain;