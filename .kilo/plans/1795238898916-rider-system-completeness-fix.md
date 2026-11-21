# แผนแก้ระบบไรเด้อร์ให้สมบูรณ์จริง (Rider System Completeness Fix)

วันที่ตรวจ: 2026-11-21 · ตรวจจาก AI_WORK_STATE.md + โค้ดจริงทั้ง client/server/SQL/CI · ทุกข้อยึด "Actual Code = Source of Truth"

---

## 1) สรุปผลการตรวจสอบ (หลักฐานทั้งหมด)

### P0-1 · บั๊กหลัก: `my_deliveries` v3 (m207) JOIN คอลัมน์ที่ไม่มีจริง → ไรเดอร์ไม่เห็นงานทุกช่องทาง
- `supabase/migrations/207_rider_history_dates.sql:67 และ 90` — `LEFT JOIN public.delivery_rounds dr ON dr.id = o.round_id`
- แต่ตาราง `orders` ไม่มีคอลัมน์ `round_id` — คอลัมน์จริงคือ `delivery_round_id` (m001:115, FK `orders_delivery_round_id_fkey` ใน prod snapshot `e2e/w1-prod-snapshot-2026-10-26.json:20967`)
- ผล: หลัง apply 207 ขึ้น prod (Owner ยืนยัน 2026-11-17/19 · โพรบ `e2e/_r80_probe_207.json` เจอ 5-param จริงแต่**ไม่เคยรันเทียบข้อมูลจริง**) ทุกการเรียก `my_deliveries` 5-arg จาก `/rider` (เว็บ+PWA คือหน้าเดียวกัน) พัง 42703 "column o.round_id does not exist" ทันที
- อาการตรงกับที่รายงานเป๊ะ: ไรเดอร์ที่ใช้งานจริง **ไม่เห็นงานมอบหมายโดยตรง และไม่เห็นงานประกาศ (offers)** — เพราะทั้ง 2 ชุดมาจาก RPC เดียวกัน (`src/lib/driverService.ts:110` → `src/pages/RiderPwaPage.tsx:145`)
- ฝั่งแอดมิน `assign_driver` ยังทำงานปกติ (ไม่ผ่าน my_deliveries) → แอดมิน "มอบหมายได้" แต่งานค้างสถานะ `assigned` ไม่มีใครรับ หน้าบอร์ดโชว์ค้างตลอด = "เด้งมาให้มอบหมายใหม่"

### ทำไมทุก gate หลุด (สำคัญ — ต้องปิดช่องนี้ด้วย)
- `src/__tests__/r48RiderHistoryTabs.test.ts:15` เป็นเทสต์อ่าน**ข้อความไฟล์ migration** (`?raw`) และ assertion บรรทัด 15 ยึด JOIN ที่ผิด (`dr.id = o.round_id`) เป็น "contract" — เทสต์ปกป้องบั๊กแทนที่จับบั๊ก
- unit tests ทั้งหมดรันบน `src/__tests__/helpers/supabaseMock.ts:835` (mock JS ไม่ใช่ SQL จริง)
- `.github/workflows/contract-tests.yml` apply migration ครบทุกไฟล์ (รวม 207) **แต่ไม่มี contract SQL ที่เรียก my_deliveries 5-arg เลย** (มีแค่ 020: 1-arg, 135: 0-arg) → SQL พังก็ผ่าน CI
- ฝั่ง prod: probe ตรวจแค่ signature (`pg_get_functiondef`) ไม่ได้ execute — PL/pgSQL ไม่ validate คอลัมน์ตอน `CREATE FUNCTION` (parse ตอนรันครั้งแรก) → apply "ผ่าน" ทั้งที่พัง

### P0-2 · ตัวกรองวันฝั่งไรเดอร์ซ่อนงาน (บั๊กที่สอง — จะโผล่ต่อหลังแก้ P0-1)
- `src/lib/riderHistory.ts:39-46` — `isToday()` คืน `false` เมื่อ `scheduled_date` เป็น NULL → งานที่ไม่มีวันส่ง (round ไม่มี scheduled_date / แถวเก่า) **มองไม่เห็นในแท็บ "วันนี้"** (anchor เริ่มต้น = 'scheduled')
- งาน active ของวันนี้ต้องเห็นเสมอ — ประวัติเท่านั้นที่ควรถูกกรองตามวัน

### P1-3 · "ไรเดอร์ไม่ว่างแต่แอดมินมอบหมายได้ + ไม่มีเหตุผลภาษาไทย"
- `assign_driver` (m132:328 / m135:372) **ไม่เช็ค `drivers.status`** → แอดมินมอบหมายไรเดอร์ offline/busy ได้เสมอ (ปัจจุบันพา status ไป 'busy' เงียบ ๆ)
- `driver_accept_assignment` (m163:52) และ `claim_dispatch_offer` (m135/163/189 fallback) **ไม่เช็ค `drivers.status`** → ไรเดอร์ออฟไลน์ "รับงานได้จริง" — ยังไม่มีกติกาที่ Owner ยืนยัน ("รับงานไม่ได้ถูกแล้ว")
- ไม่มีรหัส error/ข้อความไทยสำหรับกรณีไรเดอร์ไม่พร้อม (`DRIVER_ERROR_TH` ใน `driverService.ts:516` ไม่มี ERR_DRIVER_OFFLINE)
- `assignDriver()` (`driverService.ts:407`) คืน `boolean` และ**ทิ้ง `error.message`** → แอดมินเห็นแค่ "มอบหมายไม่สำเร็จ — ตรวจสอบ…" โดยไม่รู้เหตุผลจริง (ERR_ORDER_NOT_DISPATCHABLE / ERR_BRANCH_UNAVAILABLE ฯลฯ) — ขัดคำสั่ง "แจ้งเหตุผลภาษาไทยด้วย"
- สถานะ 'offline' ตอนนี้เกิดได้จาก: provisioning (`upsert_driver` m020:574 default 'offline') หรือแก้ DB ตรง ๆ — และ `driver_login` (m041:98) จะพาทุกสถานะที่ไม่ใช่ busy ไปเป็น 'available' เมื่อเปิดหน้า /rider (auto-online)

### P1-4 · งาน 'arrived' ค้างเป็นงานผี (เกี่ยวกับ "วงจรค้าง")
- `close_assignments_on_order_terminal` (m132:460/m135:461) ปิดเฉพาะ `('assigned','accepted','picked_up','in_transit')` — **ลืม 'arrived'** (เพิ่มเมื่อ m163/m197)
- NOT EXISTS "งานค้าง" ใน `driver_decline_assignment` / `admin_cancel_assignment` / `assign_driver` reassign (m132/135) ก็ลืม 'arrived' เช่นกัน (m197:152 ใช้ครบแล้ว)
- ผล: ออเดอร์ถูกยกเลิกตอนไรเดอร์เช็คอินแล้ว (arrived) → assignment ค้าง 'arrived' ตลอดชาติ → แสดงใน my_deliveries เป็นงานผี + ไรเดอร์ติด 'busy' ตาม guard ของ m197 (ตรงกับอาการ "วงจรเก่าค้าง" ที่เจอ)

### สิ่งที่ตรวจแล้ว "ไม่ใช่บั๊ก" (ไม่ต้องแก้)
- Push แจ้งไรเดอร์: มีเส้นทางจริง — `automation-worker` (rider_push + offer_broadcast, `supabase/functions/automation-worker/index.ts:471-584`) → `push-send` EF → `claim_push_driver_targets` (m132)
- `admin_advance_delivery_status` (m116 ปิดวงจรแทนไรเดอร์) เดิน hop forward-only ถูกต้อง + ปล่อยไรเดอร์กลับ available
- กระดิ่ง/notifications ส่วนกลาง (m179) เป็น customer-scoped เท่านั้น — จดไว้เป็นงานแยก ไม่ใช่สาเหตุของอาการนี้

---

## 2) การตัดสินใจ/ข้อจำกัด (Resolved)
- คงโมเดลเดิม: **แอดมินมอบหมายตรงได้เสมอ (override ไรเดอร์ไม่ว่างได้)** — ตามที่ Owner ยืนยัน "แอดมินมอบหมายงานได้"
- **ไรเดอร์ status='offline' ห้ามรับ/claim งาน และต้องแจ้งเหตุผลภาษาไทย** — ตามคำสั่ง Owner "รับงานไม่ได้ถูกแล้ว ให้แจ้งเหตุผลภาษาไทยด้วย"
- ห้ามแตะ signature `my_deliveries(text)` (Contract 020) — fix เป็น CREATE OR REPLACE **เฉพาะ 5-arg** เท่านั้น
- Migration ใหม่ = **210** (ล่าสุด 209) · additive · re-run safe · ห้าม DROP ไฟล์/ฟังก์ชันเดิม
- การ apply ขึ้น prod = ต้อง Owner อนุมัติตามแพทเทิร์น m209 (prodCheck READ-ONLY → apply → verify รันจริง → record ledger)

## 3) ขอบเขตที่ปัดออก (Out of scope)
- ปุ่มสลับสถานะ "พร้อมรับงาน/พักงาน" ด้วยตัวไรเดอร์เอง (`driver_set_status` + แก้ semantics ของ driver_login auto-online) — แนะนำทำรอบถัดไป เพราะตอนนี้ 'offline' เกิดจาก provisioning/แก้ DB เท่านั้น และ driver_login auto-flip offline→available จะลบล้างการพักงาน
- กระดิ่ง/ระบบ notification hub ฝั่งไรเดอร์ (m179 customer-scoped)
- External riders (Grab/Lineman/Foodpanda — frozen ตามหัวข้อ DeliveryManagement)

---

## 4) งานตามลำดับ (Ordered Task List)

### Task 1 — Migration `210_rider_my_deliveries_round_fix.sql` (P0 ฝั่ง server)
1. `CREATE OR REPLACE FUNCTION public.my_deliveries(p_driver_phone text, p_assigned_from timestamptz, p_assigned_to timestamptz, p_scheduled_from date, p_scheduled_to date)` — เนื้อเดิม m207 ทุกบรรทัด **ยกเว้น**: เปลี่ยน `dr.id = o.round_id` → `dr.id = o.delivery_round_id` **ทั้งชุด assignments (บรรทัด 67) และ offers (บรรทัด 90)**
2. คง REVOKE/GRANT เดิม (authenticated เท่านั้น) และห้ามแตะ `my_deliveries(text)`
3. เพิ่ม gate สถานะไรเดอร์: `driver_accept_assignment` + `claim_dispatch_offer` (รวม fallback path ของ m189) — หลัง resolve driver: `IF v_drv.status = 'offline' THEN RAISE EXCEPTION 'ERR_DRIVER_OFFLINE'; END IF`
4. เพิ่ม 'arrived' ให้ครบทุกชุด: `close_assignments_on_order_terminal` + NOT EXISTS busy-list ใน `driver_decline_assignment`, `admin_cancel_assignment`, `assign_driver` (reassign)
5. **VERIFICATION แบบรันจริง (ไม่ใช่แค่ pg_get_functiondef)** — ใน migration: seed fixture ชั่วคราว (driver + delivery_round มี scheduled_date + order + delivery_assignment) → `PERFORM public.my_deliveries('', NULL,NULL,NULL,NULL)` แล้ว assert ได้ assignment พร้อม `scheduled_date` → ลบ fixture ทิ้ง (ตรวจ 42703 ไม่เกิด + เก็บ check ambiguity 0-arg/1-arg เดิมของ m207)

### Task 2 — SQL Contract ใหม่ + ผูก CI (P0 กันซ้ำ)
1. ไฟล์ใหม่ `e2e/contracts_210_rider_my_deliveries.sql` ตามแพทเทิร์น `e2e/contracts_163_rider_step_sync.sql` (BEGIN/ROLLBACK + RAISE NOTICE 'PASS ...')
2. ครอบ: (a) seed จริง → เรียก 5-arg ได้ assignments+offers พร้อม scheduled_date (b) filter scheduled_from/to ทำงานจริง (c) ไรเดอร์ offline รับงาน/claim → ERR_DRIVER_OFFLINE (d) ออเดอร์ถูกยกเลิกตอน arrived → assignment ถูกปิด (e) ambiguity check 0-arg/1-arg คงเดิม
3. เพิ่ม step รันไฟล์นี้ใน `.github/workflows/contract-tests.yml` (ตำแหน่งหลัง contracts_190 — ทำตามบล็อกเดิม)
4. **ยืนยันว่าก่อน Task 1 contract นี้ต้องล้มด้วย 42703 (พิสูจน์บั๊ก) และผ่านหลังแก้ (พิสูจน์ fix)**

### Task 3 — แก้ฝั่ง client: เหตุผลภาษาไทยครบทาง
1. `src/lib/driverService.ts`:
   - `assignDriver()` คืน `DriverActionResult` (ใช้ `classifyDriverError`) แทน boolean — ไม่ทิ้ง error.message
   - `DRIVER_ERROR_TH` เพิ่ม: `ERR_DRIVER_OFFLINE: 'คุณอยู่ในสถานะออฟไลน์ (พักงาน) — ต้องเปิดสถานะพร้อมรับงานก่อนจึงจะรับงานได้'`
2. `src/pages/admin/DeliveryManagement.tsx`:
   - `handleAssign` แสดงเหตุผลจริงจาก RPC ผ่าน `driverErrorText` (แทนข้อความกลาง)
   - ก่อนมอบหมายไรเดอร์ที่ status ≠ 'available': โชว์ยืนยันภาษาไทย "ไรเดอร์ไม่ว่าง/ออฟไลน์ — มอบหมายต่อได้ (แอดมิน override) แต่ไรเดอร์จะกดรับงานไม่ได้จนกว่าสถานะจะพร้อม" + บันทึก audit note เดิมใช้ได้อยู่ (assigned by admin)

### Task 4 — แก้ตัวกรองวันฝั่งไรเดอร์ (P0-2)
1. `src/lib/riderHistory.ts` — งาน active (`assigned/accepted/picked_up/in_transit/arrived`) **แสดงในแท็บวันนี้เสมอ** ไม่ว่า scheduled_date; งานประวัติ (delivered/declined/cancelled) กรองตาม anchor เดิม โดย `scheduled_date` NULL → fallback วัน `assigned_at`
2. อัปเดต `src/__tests__/r48RiderHistoryTabs.test.ts`: แก้ assertion JOIN บรรทัด 15 ให้เป็น `o.delivery_round_id` + เพิ่มเคส filter fallback/active-always-visible
3. Unit tests `riderHistory.test.ts` เพิ่มเคส NULL scheduled_date + งาน active ข้ามวัน

### Task 5 — ซิงก์ mock + เทสต์วงจร
1. `src/__tests__/helpers/supabaseMock.ts` — `my_deliveries` คืน `scheduled_date` ตาม server ใหม่ + simulate ERR_DRIVER_OFFLINE เมื่อ driver.status='offline'
2. `riderFullCycle.test.ts` เพิ่มเคส: accept โดนปฏิเสธเมื่อ offline (แสดงเหตุผลไทยครบ kind/state)

### Task 6 — Gates ตามกฎโปรเจกต์
1. `npm run lint` · `npm run typecheck:functions` (หรือ tsc) · `npm run test` (vitest ครบ) · `npm run build` — ผ่านจริงทั้งหมด ห้าม skip
2. Contract Tests (CI ephemeral PG) ผ่าน — รวม contract ใหม่
3. อัปเดต `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md` ตามกฎ 16.3 (พร้อมหลักฐานรันจริง)

### Task 7 — Deploy ขึ้น prod (แยกรอบ · ต้อง Owner อนุมัติ)
1. prodCheck READ-ONLY: ยืนยัน 210 ยังไม่มี + signature ปัจจุบันของ my_deliveries 2 overload คงเดิม
2. Apply 210 ตามแพทเทิร์น `_r80Apply209.cjs` (Management API) — พร้อม execute-verify จริงในไฟล์ apply (เรียก my_deliveries 5-arg กับ fixture → ต้องไม่พัง 42703)
3. Record migration ledger (210)
4. โพรบหลัง apply: รัน my_deliveries 5-arg จริงผ่าน HTTP (บัญชีไรเดอร์จริง) → 200 + assignments/offers
5. Owner ทดสอบ live: แอดมินมอบหมาย → ไรเดอร์เห็นงาน ≤25 วินาที ทั้งเว็บ/PWA · ประกาศงาน → ไรเดอร์ทุกคนเห็น · ไรเดอร์ offline กดรับ → เห็นเหตุผลไทย

---

## 5) ความเสี่ยง + การเลี่ยง
| ความเสี่ยง | การเลี่ยง |
|---|---|
| DROP signature ผิดตัวทำ prod พังเพิ่ม | ห้าม DROP ทุกชนิด — CREATE OR REPLACE เฉพาะ 5-arg; 1-arg (text) ห้ามแตะ |
| PL/pgSQL ไม่ validate คอลัมน์ตอน CREATE (สาเหตุที่ 207 หลุด) | verification block ต้อง EXECUTE กับ fixture จริงเสมอ + contract SQL ใน CI |
| CI preprocessor (contract-tests.yml) อาจตีความไฟล์ใหม่ผิด | เขียน migration ตรงแบบไฟล์เดิม (dollar-quote $$ ปกติ, CREATE POLICY คู่ DROP) |
| ไรเดอร์ offline ที่ provision แล้วยังไม่เคยล็อกอิน โดน gate ไม่ได้เพราะยังไม่เปิดแอป | เป็นพฤติกรรมที่ถูกต้อง — gate มีผลเฉพาะตอนไรเดอร์กดรับจริง; แอดมิน override ยังทำงาน |
| overload ambiguity (42725) จากการแก้ params | คงกฎ m207 เดิม: 5 params ไม่มี DEFAULT เด็ดขาด |

## 6) แผนยืนยัน (Validation)
1. Contract SQL ใหม่: ล้มก่อน fix (42703) / ผ่านหลัง fix — ใน CI จริง
2. vitest ครบทุกไฟล์ผ่าน (รวมเคสใหม่ offline gate, NULL scheduled_date, assign error surfacing)
3. lint + tsc + build ผ่าน
4. prod: probe execute จริงผ่าน → Owner ทดสอบ live ตามลิสต์ Task 7.5
5. ห้ามประกาศ PASS จากการอ่านโค้ดอย่างเดียว — ทุกข้อต้องมีหลักฐานรันจริง

## 7) คำถามค้าง (มีคำแนะนำแล้ว — ไม่บล็อกการเริ่มงาน)
- ปุ่ม "พักงาน/พร้อมรับงาน" ฝั่งไรเดอร์เอง + ควบคุมสถานะฝั่งแอดมิน (ต้องแก้ driver_login auto-flip ด้วย) → **แนะนำทำรอบถัดไปแยกต่างหาก** เพื่อไม่ขยาย scope งานเร่งด่วนนี้
