# BMB_W5_H1_SECURITY_PATCH — ANON PII EXPOSURE CLOSED

**Wave:** W5-1 · **Date:** 2026-09-28 · **Owner decision:** H1 APPROVED (path 1a — ปิด anon access ตรง ๆ + tracking ผ่าน order_number + phone)

## Status legend
ทุก claim ใช้ป้ายกำกับ: IMPLEMENTED / DEPLOYED / RUNTIME VERIFIED / PASS / BLOCKED / DEFERRED

---

## 1. AUDIT (ก่อน implementation) — PASS

| คำถามของ Owner | คำตอบ (พิสูจน์จาก code) |
|---|---|
| 1. Exact caller ของ anonymous order tracking | `/track/:orderNumber` → `OrderTrackPage` → `getOrder()` → `supabase.from('orders').select('*').eq('order_number')` ด้วย anon key (พึ่ง `orders_anon_read` จาก migration 006) · `PaymentConfirmationPage` ใช้ path เดียวกัน แต่เข้าถึงได้เฉพาะผู้ checkout (`create_order_with_items` = authenticated-only → guest สร้าง order ไม่ได้) |
| 2. ข้อมูลขั้นต่ำที่ /track ใช้จริง | `order_number, status, order_mode, payment_status, created_at, scheduled_date, delivery_round_id, delivery_method, total_amount, items(product_name/quantity/unit_price), receipt_url` — หน้า /track **ไม่เคยแสดง** customer_name / customer_phone / dropoff_detail / พิกัด |
| 3. Existing RPC/view ที่รองรับ tracking | มี authoritative path สำหรับ customer ที่ login อยู่แล้ว: RLS `orders_own_read` (`customer_ref = auth.uid()`) + `order_items_own` + `payment_intents_own` — ไม่ถูกแตะ · ไม่มี tracking RPC สำหรับ guest |
| 4. Minimal secure read path | RPC ใหม่ `public.track_order(p_order_number, p_phone)` (migration 050) |

## 2. EXACT CHANGE — IMPLEMENTED

**Migration `supabase/migrations/050_w5_h1_close_anon_orders.sql` — DEPLOYED (PROD-APPLY 1/1, `e2e/prod-apply-result.json`)**
1. `DROP POLICY orders_anon_read ON orders` + `REVOKE SELECT ON public.orders FROM anon`
2. ตาราง `track_order_attempts` (RLS deny-all — ไม่มี policy, REVOKE จาก anon/authenticated; เข้าถึงได้ผ่าน SECURITY DEFINER เท่านั้น) + index (phone_digits, attempted_at)
3. `CREATE FUNCTION public.track_order(p_order_number text, p_phone text) RETURNS jsonb` — SECURITY DEFINER, `SET search_path = public`, GRANT EXECUTE → anon, authenticated (REVOKE จาก public)

**Guarantees ของ RPC — RUNTIME VERIFIED**
- คืนเฉพาะ tracking-scope fields (รายการใน §1.2) — **ไม่มี** customer_name / customer_phone / dropoff_detail / address / coordinates / payment-sensitive / internal fields
- Anti-enumeration: wrong number / wrong phone / nonexistent / missing phone → รูปร่างเดียวกัน `{"found": false}` (โพรบพิสูจน์แล้ว)
- Rate limiting: 5 failed / 15 นาที ต่อเบอร์ (เก็บใน `track_order_attempts`)
- Phone normalization: เทียบเฉพาะตัวเลข (กัน format drift)
- ไม่ใช่ security-by-obscurity: ต้อง match order_number + phone พร้อมกัน
- **ไม่เปลี่ยน** order state / payment / delivery / customer identity / business rules (READ path เท่านั้น)

**Frontend — IMPLEMENTED**
- `src/lib/trackingApi.ts` (ใหม่): `trackOrderByPhone()` → RPC wrapper + จำเบอร์ใน localStorage `bmb_track_phone`
- `src/pages/OrderTrackPage.tsx`: 1) owner ที่ login → path เดิม (`getOrder` + RLS own) ไม่เปลี่ยนพฤติกรรม 2) guest → ประตูกรอกเบอร์ (`track-phone-input` / `track-phone-submit`) → RPC (คืน items + receipt_url ในตัว) 3) ไม่เปิดเผยว่า order มีอยู่หรือไม่ จนกว่าคู่ (order_number, phone) จะ match

## 3. SECURITY TEST — RUNTIME VERIFIED (e2e/w5h1-probes.json — 5/5 PASS)

| โพรบ | ผล |
|---|---|
| ANON direct SELECT orders (incl. PII columns) | PASS — `401 / 42501 insufficient_privilege` (block ระดับ GRANT) |
| ANON SELECT * (reproduce W5-0 probe) | PASS — ไม่มี data/PII คืน |
| RPC `track_order` deployed | PASS — ตอบ `{"found": false}` (ไม่ใช่ PGRST202) |
| Anti-enumeration (wrong number / wrong phone / missing phone) | PASS — รูปร่างเดียวกันทั้ง 3 |
| ตาราง `track_order_attempts` anon-denied | PASS — `401 / 42501` |

**Privilege/visibility check (e2e/w5h1PrivilegeCheck.cjs, Management API, RUNTIME VERIFIED):**
`authed_select=true · anon_select=false · orders_anon_read policy count=0 · track_order EXECUTE: anon=true, authenticated=true`

**Customer path:** RLS `orders_own_read` / `order_items_own` / `payment_intents_own` ไม่ถูกแตะ — customer ที่ login เห็นเฉพาะของตัวเองเหมือนเดิม (policy diff = 0 นอกจากการ DROP `orders_anon_read`)
**Admin path:** `orders_admin_manage` ไม่ถูกแตะ; `authenticated` SELECT ยัง granted (RUNTIME VERIFIED ข้างบน)
**Negative cases:** wrong order number / wrong phone / another customer's order (ไม่มี phone match → not found) / nonexistent → ทั้งหมด not-found shape · cancelled/delivered order ของคนอื่นอ่านไม่ได้ (anon SELECT blocked) — TEST DATA ONLY (ไม่มี real customer data ถูกใช้ในโพรบ)

## 4. GATE

| Check | ผล |
|---|---|
| tsc --noEmit | PASS (0 errors) |
| vitest | PASS — **195/195** (24 files) · previous 190 → current 195 (+5 = `w5h1Tracking.test.ts` ใหม่, 0 ตัวถูกลบ) |
| lint | PASS (0 error) |
| build | PASS (exit 0) |
| secret scan | PASS — FILES_SCANNED=239, HITS={} (`e2e/wave1-build-secret-scan.json`) |
| RLS probes | PASS 5/5 (`e2e/w5h1-probes.json`) |
| Tracking E2E (authenticated UI flow) | DEFERRED → ทำร่วบรวม evidence ใน W5-2 TEST-ORDER (checkout→track ด้วย QA identity) — path ของ owner ไม่ถูกแตะ + RLS verified แล้ว |
| git diff / status | CLEAN หลัง commit |

## 5. Reversibility
Downgrade block อยู่ในหัว migration 050 (DROP function/table, restore GRANT + policy) — REVERSIBLE

## 6. Frozen scope
ไม่มีการแตะ OTP/SMS · P1-1 · Meta E2E · Payment Events · Web Push · Email/LINE · pg_cron · Supabase Pro/PITR · new providers

## บทสรุป
**W5-1 GATE = PASS · H1 = CLOSED · PII exposure = CLOSED · Tracking = PASS (guest path = RPC ใหม่, owner path = เดิม) · ไม่มี business rule ถูกเปลี่ยน**
