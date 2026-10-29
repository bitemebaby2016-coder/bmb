# BMB Upgrade Log — Master Prompt 4 Tasks · 2026-10-29/30 (R22)
> รายงานสั้น ๆ ว่าแก้/เพิ่มอะไรบ้าง (คำอธิบายเท่านั้น — สถานะจริงยึด `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md` เสมอ)

## Task 1 — Cart & Pricing Margin Guardrail
- **Anti-stacking** (ห้ามคูปองหลัก ✗ แลกแต้มสดในบิลเดียว · Wallet = payment-side ไม่นับ): `src/lib/discountGuardrail.ts` → `evaluateDiscountStacking` + gate 3 จุด (`CouponBox.applyCouponCode` · `revalidateCouponForSubmit` · `CheckoutPage` banner `discount-stack-guard` + ปุ่มสั่ง) · reject reason `stack_conflict` ใน `promotionClient` · `cartStore.pointsRedemption` = จุดต่อของกฎ (วันนี้ = 0 เพราะฟีเจอร์แลกแต้มยังไม่มีจริงในระบบ — inspect แล้ว: RewardsPage request-only, m155 = earn ledger)
- **กำไร Gross/Net real-time หลังบ้าน**: `marginCalc.summarizeOrderProfit` (เรียก `computeOrderProfit` เดิม — ไม่มีสูตรใหม่) + chip `data-testid=admin-order-profit` ใน `AdminOrders` (ต้นทุนไม่ครบ = บอกตรง ๆ ไม่โชว์ตัวเลขปลอม)
- Server anti-stack = **ไม่จำเป็นวันนี้**: `create_order_with_items` ไม่มี parameter แต้ม (หลักฐาน findstr `p_points` เฉพาะ m155/156) · เพดาน server = **m172 APPLIED อยู่แล้ว**
- ไม่ทำซ้ำของเดิม: m170 cogs · m172 cap 15% · margin panel AdminProducts (R21)

## Task 2 — Multi-Tenant & White-Label
- tenant_id ครบตารางหลัก + RLS = **มีอยู่แล้ว** (m059-080/103/106-108) — ไม่แก้ · Theme/Brand config = `BrandProvider`/`resolvedBrandStore`/AdminBrands เดิม — ไม่สร้างซ้ำ
- **migration 175 PREPARED — ยังไม่ apply (รอ Owner สั่ง `__apply 175__`)**: `tenants.custom_domain` (+ unique idx + seed biteme-baby.com) · `brands.ai_prompt` · ตาราง `billing_subscriptions` + RLS
- **Onboarding Wizard**: `/admin/onboarding` (`AdminOnboarding.tsx` — 3 ขั้นตอน · สร้างร้านผ่าย RPC `tenant_create_admin` เดิม + brand row + อัปโหลดโลโก้เข้า `bmb-images`) + nav `adminUi`
- **Billing**: `/admin/billing` + `src/lib/billingApi.ts` (`daysUntilDue` pure) · เตือนตัดงวดผ่าน LINE Notify = **ยังไม่มี secret** (ค้างรอบถัดไป)
- **Custom Domain**: `src/lib/hostnameTenant.ts` (pure host↔tenant + lookup) + `workers/tenant-proxy/` (Cloudflare reverse-proxy → header `X-BMB-Tenant-*`) — **ยังไม่ deploy** · wire เข้า `BrandProvider` = ค้าง

## Task 3 — Order Lifecycle / KOT / EV Rider
- **Audio alert**: `src/lib/kitchenAlert.ts` (`detectNewPendingOrders` pure + `playKitchenChime` WebAudio 3 โน้ต ไม่มีไฟล์เสียง) — wire ใน `AdminOrders` (เทียบโหลดซ้ำ = ออเดอร์ pending ใหม่ · ตอนกดยืนยันออเดอร์ = gesture ตรง ๆ) · ระบบพิมพ์ KOT = มีอยู่แล้ว (R21) ไม่แตะ
- **EV fallback**: `src/lib/dispatchFallback.ts` (`evaluateRiderFallback` = ไม่มีไรเดอร์/นอกรัศมี 5 กม. → external · `requestExternalDispatchFallback` ใช้ `providerRegistry` เดิม ลำดับ grab→lalamove→lineman→foodpanda) + adapter ใหม่ `providers/lalamove.ts` (mockup_pending — ตรงไปตรงมา ไม่แกล้งเป็น live) · **wire เข้า `DeliveryManagement` = ยังไม่ต่อ (ค้าง)** · provider ทุกรายยังไม่มี key จริง (ผล = kind=mock)

## Task 4 — Merchant Accounting → Google Sheets
- EF ใหม่ `supabase/functions/sheets-sync` (สรุปออเดอร์รายวัน/เดือน · timezone ICT · idempotent key) + `.github/workflows/sheets-sync.yml` (cron 00:15/00:25 ICT · ใช้ `AUTOMATION_TOKEN` ตัวเดิม — ไม่มี secret ใหม่) + `[functions.sheets-sync]` ใน `config.toml` — **ยังไม่ deploy**
- ยังไม่ตั้ง `GOOGLE_SHEETS_WEBHOOK_URL` → EF ตอบ `skipped/not_configured` (ไม่ทำ CI แดง) · ตัวอย่าง Apps Script `doPost` = หัวไฟล์ EF

## Gates (รันจริงบนเครื่องนี้)
- vitest targeted = **ALL PASS ทุก batch** (`e2e/g_batch1..4_vitest.log` · `e2e/t1a/t1c/t3a_vitest.log`)
- eslint ไฟล์ที่แตะทั้งหมด = **0 ข้อ** (`e2e/g_lint_changed.log`)
- `npx vite build` = **EXIT 0** (`e2e/g_build.log`)
- `npx tsc --noEmit` = **NOT RUN ท้องถิ่น** — ติด tool timeout 30s ทุกครั้ง (`e2e/g_tsc.log` ว่าง) → **typecheck + vitest เต็ม 169 files = ให้ CI เป็นผู้ตัดสินหลัง push** (ตามกติกา 0.1: ไม่แอบอ้างว่าผ่าน)

## รอ Owner (runtime/production = เจ้าของเทสต์จริงคนเดียว)
1. `__apply 175__` · 2. `supabase functions deploy sheets-sync` + `supabase secrets set GOOGLE_SHEETS_WEBHOOK_URL=...` · 3. `wrangler deploy` (workers/tenant-proxy) + ผูก custom domain · 4. LINE Notify secret + reminder job (รอบถัดไป) · 5. เทสต์ runtime: เสียงครัว · chip กำไร · wizard · guardrail · 6. เช็ค CI ของ SHA นี้ที่ `BMB_MASTER_STATUS.md` §9.0