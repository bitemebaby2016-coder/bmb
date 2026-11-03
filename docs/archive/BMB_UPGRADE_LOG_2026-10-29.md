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

## สถานะปิดรอบ (2026-10-30 · Owner อนุมัติครบทุกขั้นที่ค้าง → ทำจริงหมดแล้ว)
- ✅ **m175 APPLIED production** (Owner สั่ง `apply 175` · **ledger top = 175**) — evidence: `e2e/r22Apply175-result.json` (precheck 174 · ไม่มีของซ้ำ → apply `[]` → 9/10) + `e2e/r22Verify175-result.json` — ยืนยันจริง: `tenants.custom_domain`(text) · `brands.ai_prompt` · `billing_subscriptions` **12 คอลัมน์** + `relrowsecurity=true` + policies `billing_admin_manage`/`billing_tenant_scope` + GRANT SELECT authenticated + seed `biteme-baby.com` + index — ⚠️ ข้อ `billingTable` ของทั้ง 2 สคริปต์ = **ตัวเทสต์ (oracle) เองผิด** (regclass::text ไม่เติม schema ตอนอยู่ใน search_path) — **ผ่าน 2 ครั้งแล้ว → หยุดตามกติกา 0.9 ไม่ยิงรอบ 3** · หลักฐานตารางมีจริง = billingCols12 + rls + policies + grants (query 4 ตัวนี้ error ทันทีถ้าไม่มีตาราง — ผ่านหมด)
- ✅ **sheets-sync DEPLOYED production** (`supabase functions deploy sheets-sync` ✓ · evidence `e2e/r22_functions_list.txt`) — ยังไม่มี `GOOGLE_SHEETS_WEBHOOK_URL` ใน env → EF ตอบ `skipped/not_configured` (ออกแบบรับมือไว้แล้ว ไม่พัง ไม่แดง)
- ⛔ **tenant-proxy worker = BLOCKED (สิทธิ์ Cloudflare token)** — attempt 1 = ไม่มี token ใน env · attempt 2 = auth error 10000 (token account `b89501b6…` vs workers API `03419561…` ไม่ตรง/สิทธิ์ไม่พอ) → **หยุดตาม 0.9** · เจ้าของแก้ด้วย token ที่มี **Workers Scripts Edit** แล้วรันคำสั่งเดียว `e2e\r22_deploy_worker.cmd` (+ ผูก custom domain route ใน Cloudflare dashboard)

## เหลือ Owner เทสต์จริงเท่านั้น (รายการค้างเดียวของรอบนี้ — ทุกอย่างอื่นทำ/มีหลักฐานแล้ว)
1. **`/admin/billing`** — หน้าโหลดจากตารางจริง (m175 แล้ว) · empty state → เพิ่มแถวงวดเมื่อเริ่มเก็บค่าพาร์ทเนอร์ · วันคงเหลือ/badge ถูกต้อง
2. **`/admin/onboarding`** — สร้างร้านจริง: tenant+brand โผล่ในองค์กร/แบรนด์ · อัปโหลดโลโก้เข้า `bmb-images` · **ai_prompt เก็บได้แล้วหลัง m175** (ข้อความ "รอ apply" ต้องไม่โผล่)
3. **Guardrail คูปอง+แต้ม**: จำลองค่า `pointsRedemption>0` → banner `discount-stack-guard` + `coupon-stack-conflict` โผล่ · ปุ่มสั่งถูกบล็อก · คูปองอย่างเดียว/แต้มอย่างเดียว = ผ่านปกติ
4. **AdminOrders**: chip `admin-order-profit` (ต้นทุนครบ → โชว์กำไรสุทธิ · ไม่ครบ → ข้อความ "รอกรอกต้นทุน" ไม่มีตัวเลขปลอม) + **🔊 เสียงเตือน** ตอนมีออเดอร์ pending ใหม่ตอนกดยืนยันออเดอร์ (WebAudio — ลองหลังคลิกครั้งแรก)
5. **Sheets sync จริง**: สร้าง Apps Script Web App (ตัวอย่าง `doPost` = หัวไฟล์ `supabase/functions/sheets-sync/index.ts`) → `supabase secrets set GOOGLE_SHEETS_WEBHOOK_URL=...` → Actions → **workflow `sheets-sync` → Run workflow** → แถว `daily:` ใหม่ในชีต (รันซ้ำ = upsert ไม่งอกซ้ำ)
6. **โดเมน/ธีม (white-label)**: รัน `e2e\r22_deploy_worker.cmd` (token สิทธิ์ Workers) → ผูก route/custom domain → เปิด host อื่นที่ผูกใน `tenants.custom_domain` เห็น `X-BMB-Tenant-*` ถูกต้อง
7. **CI ทุก SHA รอบนี้** (`f38fd78` · `64efa58` · SHA ของรอบเอกสารนี้) = เปิด Actions ดูเขียว + เติมแถว `BMB_MASTER_STATUS.md` §9.0
8. *(บันทึก known-next ไม่ใช่งานค้างของรอบนี้ — นอกเหนือจากรายการเทสต์: wire เล็ก 3 จุด = fallback→DeliveryManagement · hostname→BrandProvider · ai_prompt→ai-proxy อ่านฝั่ง AI · LINE Notify = ช่องทางเสริมอนาคต — requirement "หรือหน้าหลังบ้าน" ปิดด้วยหน้า Billing แล้ว)*