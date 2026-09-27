# BMB_WAVE_2_REMEDIATION_REPORT.md
**WAVE 2 — ORDER LIFECYCLE HISTORY + DRIVER IDENTITY + RLS VERIFICATION**
วันที่: 2026-09-27 · Baseline: `7341b40` · สถานะปัจจุบัน: **BLOCKED — รอ OWNER รัน DB migration**

Status vocabulary: READY / PARTIAL / BLOCKED / BROKEN / MISSING / DORMANT / DUPLICATE /
CONTRADICTED / UNKNOWN / NOT VERIFIED (ห้าม COMPLETE/DONE/100%)

## §1 Baseline
- HEAD ก่อนเริ่ม Wave 2: `7341b40` (origin/main = deployed Wave 1, Production Gate PASS)

## §2 F-05 Current Reality
- **MISSING** — production ไม่มี authoritative order status history table
- `audit_logs` (migr 018) เป็น generic feed ไม่ใช่ lifecycle history
- Production writers ของ `orders.status` (ยืนยันจาก migrations):
  `transition_order_status` (019, validated โดย `order_transition_allowed` 030) ·
  driver delivery-sync hops (036, GUC `app.delivery_sync_order`) · server-side contexts
  (payment flows แก้เฉพาะ `payment_status` ไม่แตะ `orders.status`)

## §3 F-05 Design (implemented, รอ apply)
- `supabase/migrations/040_order_status_history.sql`:
  - ตาราง `order_status_history` (TEXT PK ตาม convention): id, order_number,
    from_status (NULL = initial), to_status, changed_at, actor_type
    (CUSTOMER/ADMIN/DRIVER/SYSTEM/WEBHOOK/RPC), actor_id, reason, metadata
  - **Authoritative by construction**: เขียนโดย AFTER INSERT/UPDATE trigger บน
    `orders` (SECURITY DEFINER) ใน **transaction เดียวกับ** status UPDATE —
    history insert fail → transaction rollback ทั้งหมด
  - Client INSERT/UPDATE/DELETE ถูกปฏิเสธ (RLS ไม่มี policy + REVOKE) — ปลอมไม่ได้
  - Illegal transition ถูก reject **ก่อน** UPDATE → ไม่เกิด history row
  - Actor mapping: delivery-sync GUC → DRIVER; ไม่มี JWT → SYSTEM; is_admin → ADMIN;
    owner → CUSTOMER; อื่น ๆ → RPC
  - Status enum ใช้ของเดิม (pending…failed) — ไม่มีการเดาสถานะใหม่
- Backfill existing orders: **PROPOSED** (`PROPOSED_wave2_history_backfill.sql`,
  strategy HISTORICAL_BASELINE) — ห้ามรันจน Owner อนุมัติ (Wave 2 rule §8)

## §4 F-05 Implementation
- Migration 040 committed (`2530eba`) — **ยังไม่ถูก apply บน production DB (BLOCKED)**
- Verification harness: `e2e/wave2VerifyF05.cjs` (matrix ครบ: create/initial event,
  legal chain, illegal, duplicate, concurrent, forgery, actor types)

## §5 F-05 Test Evidence
- **NOT VERIFIED** — รอ migration apply (ดู §17)

## §6 F-06 Current Reality
- **BROKEN** — `driver_login` (020) self-upsert ตัวตนจาก phone ที่ client ส่งมา
- `drivers` ไม่มีความสัมพันธ์กับ `auth.users`; policy `drivers_auth_read` เปิด
  authenticated อ่านได้ทุกคน (F-18 mismatch)

## §7 F-06 Identity Architecture (implemented, รอ apply)
- `auth.users.id → drivers.user_id (UNIQUE) → driver-scoped RLS/RPC`
- Provisioning: Admin สร้าง auth user (Dashboard/Admin API) + link ผ่าน
  `link_driver_user` RPC (admin-only) — ตาม Owner Decision 06
- **SMS OTP GAP (REPORTED, ไม่เลือก provider เอง)**: project ไม่มี SMS infrastructure;
  ทางเลือกเดียวที่ implement ได้ทันทีคือ Admin provisioning — ถ้า Owner ต้องการ
  SMS OTP signup ต้องเลือก provider/config เอง

## §8 F-06 Implementation
- `supabase/migrations/041_driver_identity_jwt_binding.sql` (committed):
  - `drivers.user_id` + index
  - RLS: `drivers_scoped_read` (own row OR admin), `assignments_scoped_read`
    (user_id-based), `drivers_self_update` (own row, WITH CHECK pin user_id —
    กัน re-link hijack)
  - RPC ทั้งหมด bind `auth.uid()`: `driver_login()` (drop รปแบบ phone เดิม),
    `driver_accept_assignment`, `my_deliveries`, `driver_update_delivery_status`
    (036 body คงไว้ทุกอย่าง ยกเว้น identity resolution — sync GUC + allow-list ไม่แตะ)
  - `p_driver_phone` คง param ไว้เพื่อ wire-compat แต่ **ถก ignore** (JWT WINS)
- Client: `src/lib/driverService.ts` + `src/pages/RiderPwaPage.tsx`
  (commit `68f1419`) — login ด้วย Supabase Auth email/password → `driver_login()`;
  session ทน reload ผ่าน Supabase; ไม่มี phone-only path แล้ว
- **ยังไม่ถก apply — BLOCKED**

## §9 F-06 Security Tests
- Harness `e2e/wave2VerifyF06.cjs` (cases A–E + self-update + relink-hijack +
  admin access) — **NOT VERIFIED** รอ migration apply

## §10 F-18 RLS Intent
- drivers = Driver Scoped / Admin Only (ตาม Owner intent ครบทุกข้อ §17)
- recipes = Authenticated Read / Admin Write

## §11 F-18 Production Test Matrix
- Harness `e2e/wave2VerifyF18.cjs` (anon/customer/driver/admin x drivers/recipes,
  SELECT/INSERT/UPDATE/DELETE) — **NOT VERIFIED** รอ migration apply
- **OWNER DECISION REQUIRED (recipes granularity)**: ตาราง `recipes` **ไม่มี
  visibility/secret column** (019 sec 1) ทำให้แยก "Master Recipe = Admin only"
  ระดับ row ไม่ได้  ปัจจุบัน — implement ได้คือ table-level (anon deny +
  authenticated read) ึ่งตรง Decision 13 ที่ระดับตาราง; ถ้าต้องการ split ระดับแถว
  ต้องเพิ่ม column (เช่น recipes.is_public) — รอ Owner ตัดสิน (ห้ามออกแบบเอง)

## §12 Migrations
| ไฟล | สถานะ |
|---|---|
| 040_order_status_history.sql | PROPOSED-TO-APPLY (committed, รอ db push) |
| 041_driver_identity_jwt_binding.sql | PROPOSED-TO-APPLY (committed, รอ db push) |
| 042_recipes_rls_intent.sql | PROPOSED-TO-APPLY (committed, รอ db push) |
| PROPOSED_wave2_history_backfill.sql | PROPOSED (ห้ามรันจน Owner อนุมัติกลยุท) |
- ตรวจแล้ว: ไม่ duplicate, ไม่แก้ migration เก่า, naming/convention ตรง (BEGIN/COMMIT + rollback note)

## §13 Production Mutations
- ยังไม่มี mutation ใด ๆ (รอ migration) — เมื่อ verify จะใช้เพาะ TEST DATA
  (qa-customer/qa-driver/qa-driver2 + TEST-ORDER) ตาม Wave 2 rule 22

## §14 Files Changed
- supabase/migrations/040, 041, 042, PROPOSED_wave2_history_backfill.sql
- src/lib/driverService.ts, src/pages/RiderPwaPage.tsx
- e2e/wave2Lib.cjs, wave2Setup.cjs, wave2VerifyF05.cjs, wave2VerifyF06.cjs, wave2VerifyF18.cjs
- ผ่าน: npx tsc --noEmit = 0 / npx vitest run = 44 files passed / npm run build = exit 0

## §15 Commits
2530eba (F-05) / d289706+c0f2f09 (F-06 migration; แบ่ง 2 commits จากการเขียนไฟล 2 ส่วน) /
68f1419 (F-06 client) / 7d3fd41+90157b6+2267014 (test harnesses) —
หมายเหตุ: 042 ถก commit รวมอย่ในกลุ่ม F-06 (labeling คลาดเคลื่อนเลกน้อย แจ้งให้ Owner ทราบ)

## §16 Remaining Findings
- SMS OTP infrastructure = MISSING (gap reported, ไม่เลือก provider)
- recipes row-level visibility = ไม่มี column (OWNER DECISION REQUIRED)
- Dead nav routes (pre-orders/kitchen/recipes) ยังคงอย่ (Wave 4 ดเมน)

## §17 BLOCKED / NOT VERIFIED
**BLOCKED — OWNER ACTION REQUIRED**

```text
Problem:  Wave 2 ต้อง apply DDL 3 migrations (040/041/042) ลง production DB
          แต่ npx supabase db push ต้องใส่ DB password แบบ interactive —
          รัน non-interactive ไม่ได้ (ค้างที่ password prompt)
Evidence: supabase db push --dry-run เชื่อมต่อ remote OK; push จริงค้างที่ prompt;
          REST GET /rest/v1/order_status_history → 404 (table ยังไม่ถกสร้าง)
Options:  (1) Owner รัน npx supabase db push เองในเครื่องนี้ (แนะนำ — migration
              ไฟลพร้อมอย่ใน repo; PROPOSED_* จะถก skip อัตนมัติ)
          (2) Owner ให้ DB password ผ่าน secret channel เพื่อให้ AI รัน push
              (ไม่แนะนำ)
          (3) Owner รัน 040/041/042 ผ่าน Supabase SQL Editor ตามลำดับ
Impact:   Wave 2 (F-05/F-06/F-18) ยัง NOT VERIFIED จนกว่า migration ถก apply;
          หลัง apply เสรจ AI รัน: node e2e/wave2Setup.cjs แล้ว
          node e2e/wave2VerifyF05.cjs / F06 / F18 ต่อได้ทันที (harnesses พร้อม)
```

## §18 Wave 2 Gate
- F-05 = PARTIAL (design+code+harness READY; DB apply + evidence BLOCKED)
- F-06 = PARTIAL (เช่นเดียวกัน)
- F-18 = PARTIAL (เช่นเดียวกัน)
- **WAVE 2 GATE = NOT PASSED** → ห้ามเริ่ม Wave 3 จนกว่า verification จริงจะผ่าน

**HARD STOP — WAIT FOR OWNER (รัน supabase db push แล้วแจ้งกลับเพื่อรัน verification)**
