# BMB WAVE 5B — OWNER REVIEW PACK (สัญญา 124 + Fresh-DB Gap Assessment)

> ⚠️ **คำตัดสิน Owner 2026-10-13: 124 "ยังไม่ให้ผ่าน"** — ผลทดสอบด้านล่างเป็น EXECUTED & PASSED จริงบน isolated แต่**ยังไม่ถือว่าปิดสัญญา 124** จนกว่า risk register (R1-R15) ใน `docs/BMB_WAVE5B_HANDOFF.md` จะปิดครบ — จุดเสี่ยงที่พิสูจน์แล้ว: fingerprint ไม่เสถียรกับ numeric scale (R1) · submit key ไม่ normalize (R2) · replay คืน payload เก่า (R3)

> สร้าง 2026-10-13 · repo `D:\A PROJECT\Bite Me Baby` · ทุกอย่างทดสอบบน isolated DB (Docker postgres:16 โลคอล + CI ephemeral PG) — **ไม่มีการแตะ Production ใด ๆ ทั้งสิ้น**
> Evidence tiers: **SOURCE ✅ · AUTOMATED ✅ · ISOLATED-DB ✅ (ทุก step รวม contract 124 + concurrency) · PRODUCTION-RUNTIME ❌ (ยังห้ามประกาศพร้อมเปิดร้าน)**

---

## 1. ผล Contract 124 รอบสุดท้าย + หลักฐานการรันจริง

**CI หลักฐานชี้ขาด:** contract-tests **run #18 (SHA `cdc79ac`) = success ครั้งแรกของ workflow นี้** · job `115402976499` ทุก step = success และ **run #19 (SHA `a834cc6` — เพิ่ม T8b)** = ดูสถานะท้ายเอกสาร

| Step (run #18) | ผล |
|---|---|
| Prelude — Supabase stubs | ✅ EXECUTED & PASSED |
| Apply migrations 001-123 (inventory) | ✅ EXECUTED & PASSED (0 failure) |
| Contract 123 — menu publish | ✅ EXECUTED & PASSED (regression ซ้ำผ่าน) |
| Apply migration 124 (isolated) | ✅ EXECUTED & PASSED |
| Contract 124 — matrix T1-T13 | ✅ EXECUTED & PASSED (transaction ROLLBACK) |
| Cleanup verification | ✅ EXECUTED & PASSED (`order_submissions=0`, `orders_09=0`) |
| Concurrency — 2 sessions, same key | ✅ EXECUTED & PASSED |

**Local replica (Docker postgres:16, ทำซ้ำทั้ง stack ในเครื่อง):** `ALL_GREEN EXIT:0` 3 รอบ — หลักฐาน: A/B sessions คืน `BMB-20261013-787` เลขเดียวกัน, orders=1, submissions=1

**Matrix ที่รันจริงทุกกรณี (e2e/contracts_124_idempotency.sql + concurrency_124.sh):**

| กรณี | Assertion ที่รันจริง | ผล |
|---|---|---|
| Same key + same payload → order เดิม | T2: order_number เดิม + orders ไม่เพิ่ม + submissions คง 1 | ✅ PASSED |
| Same key + changed payload → reject ไม่ leak | T3: `ERR_IDEMPOTENCY_CONFLICT` + orders ไม่เพิ่ม | ✅ PASSED |
| Same key + owner ต่างกัน → reject | T4: conflict + `SQLERRM NOT LIKE %order_number%` (ไม่เปิดเผยข้อมูลฝั่งตรงข้าม) | ✅ PASSED |
| คนละ key → order อิสระ | T5: order_number ใหม่ + count +1 | ✅ PASSED |
| Concurrent same key (2 sessions จริง) | `concurrency_124.sh`: psql 2 processes แยก session, key `CK-CONC-1` → orders=1, submissions=1, A/B output เลขเดียวกัน | ✅ PASSED |
| Legacy caller ไม่มี key | T6: เรียก `create_order_with_items` ตัวเดิม 14 positional → สร้างตามปกติ, ไม่เขียน submissions | ✅ PASSED |
| Transaction fail → retry ปลอดภัย | T7: `ERR_PRODUCT_UNAVAILABLE` → 0 partial (orders ไม่เพิ่ม, submissions 0) → retry สร้าง 1 → replay คืนเลขเดิม | ✅ PASSED |
| Replay → ไม่ซ้ำ payment intent/charge | T8: stored result->order_number == created + T8b: `payment_intents` ที่ผูกกับเบอร์ทดสอบ = 0 (submit/replay ไม่แตะตารางนี้เลย; intent สร้างโดย RPC แยกต่อ order_number — ไม่มี order ที่สอง = ไม่มีฐานสร้างซ้ำ) | ✅ PASSED |
| Ownership/authorization | T10: replay ต่าง user → conflict ไม่ leak เลข · T13: authenticated อ่าน `order_submissions` ตรง ๆ ไม่ได้ (RLS no-policy + REVOKE) | ✅ PASSED |
| Cleanup | workflow step: นับหลัง contract rollback = 0 ทั้งคู่ + DB ทั้งใบ disposable | ✅ PASSED |

**การจำแนกผลทั้งหมด:** EXECUTED & PASSED = บนตารางทั้งหมด · **FAILED = 0 · SKIPPED = 0 · NOT EXECUTED = 0** (เว้น tier PRODUCTION-RUNTIME ที่ตั้งใจไม่แตะ)

**บทเรียน class ของ defect ที่เจอระหว่าง loop (แก้ฝั่ง contract ไม่แก้ 118/124 — ตามกติกา):**
1. coords ทดสอบ (กทม.) ห่าง kitchen จริง (fallback จันทบุรี `10.7016,102.1429` จาก `008:424`/`020:87`) 383.63 กม. → `SELF_DELIVERY_EXCEEDS_5KM_LIMIT` — แก้โดย derive coords จาก `public.kitchen_location()+0.002` (~0.3 กม. อยู่ใน radius 5 กม. และ zone 0-3 กม.)
2. 118 ไม่มีคีย์ `'ok'` ใน result (สำเร็จ = มี `order_number`, shape จาก `118:269-276`) — assertion เดิมเช็ค `ok` จึง fail เสมอ → แก้ assertion
3. T8 อ่าน `order_submissions` ตรง ๆ ฐานะ authenticated โดน RLS block (ตั้งใจให้ block — T13 ตรวจอยู่) → อ่านผ่าน `pg_temp` SECURITY DEFINER helper

---

## 2. Migration 124 — diff ละเอียด + ทบทวนความเสี่ยง

**สิ่งที่ไฟล์ `supabase/migrations/124_order_submit_idempotency.sql` ทำ (ทั้งหมดอยู่ใน BEGIN…COMMIT เดียว):**

1. **`CREATE TABLE order_submissions`** — PK `client_submit_key`, `owner_key`, `payload_fingerprint`, `result jsonb`, `order_number`, `created_at` · RLS ENABLE ไม่มี policy (ทุก role โดนบล็อก) + `REVOKE ALL` จาก PUBLIC/anon/authenticated/service_role
2. **`create_order_with_items_i` (19 params = 18 ของ 118 + `p_client_submit_key DEFAULT NULL`)** — SECURITY DEFINER, owner=postgres:
   - `owner_key = coalesce(auth.uid()::text,'') || '|' || coalesce(p_customer_ref::text,'')` — ผูกเจ้าของสองมิติ (uid + customer_ref) — **เข้มกว่า 118:49 (`COALESCE(uid, cref)`) เล็กน้อย** แต่ behavior เข้ากันได้: caller เดิม → owner_key เดิม → ไม่มี false conflict
   - `payload_fingerprint = md5(jsonb_build_object(18 args))` — ทุก arg รวม coords
   - **key NULL/'' → เรียกตัวเดิมด้วย named args ครบ 18 ตัว** (pin overload 118 ไม่ให้กำกวม) = backward-compatible เดิมเป๊ะ
   - key ใหม่ → `pg_advisory_xact_lock(hashtextextended('bmb_order_submit:'||key, 42))` serialize ทุก session → ตรวจซ้ำ → สร้างออเดอร์ตามกติกาเดิม → INSERT result ฉบับเต็ม
   - key เดิม → owner+fingerprint ตรง → `RETURN result` เดิม (ไม่มี order/intent ใหม่) · ไม่ตรง → `RAISE 'ERR_IDEMPOTENCY_CONFLICT'` (ข้อความไม่มีข้อมูลคู่กรณี)
   - `unique_violation` ที่ INSERT → แข่งจริงระหว่าง transaction → ตรวจซ้ำแล้วคืนของเดิม / RAISE ต้นฉบับ
3. **Grants:** `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated` — ตรงกับ 025

**ผลทบทวนตามหัวข้อ (audit จาก source + execution):**

| หัวข้อ | ผล |
|---|---|
| Overload resolution | ✅ 117 drop ทุก signature ของ `create_order_with_items` เหลือ 18-param ตัวเดียว · wrapper ใช้ named args ครบ = pin ชัด · T6 (positional 14) ไม่กำกวม (พิสูจน์ด้วย execution) |
| Named arg forwarding | ✅ ครบ 18 ทั้ง legacy path (124:89-98) และ create path (124:113-122) |
| Key uniqueness / advisory lock | ✅ PK ต่อ key + xact lock ต่อ key (hashtextextended namespace `bmb_order_submit:`) — ปล่อยอัตโนมัติจบ transaction |
| Ownership checks | ✅ เทียบ owner_key ก่อนคืน replay — ต่างกัน = conflict (T4/T10) |
| Payload consistency | ✅ md5(18 args) — เปลี่ยนแม้ quantity = conflict (T3) |
| Transaction boundaries / rollback | ✅ ฟังก์ชันเดียวไม่ commit เอง — ลูกค้า rollback ทั้งก้อน = ไม่มี partial (T7) |
| RLS / grants | ✅ table ปิดทุก role (T13) · function เฉพาะ authenticated · SECURITY DEFINER owner postgres |
| Backward compat | ✅ T6 — ไม่มี key = ไม่แตะ behavior เดิม |
| Replay / payment linkage | ✅ คืน result เดิมเป๊ะ — ไม่มี order ที่สอง = ไม่มีฐานสร้าง intent ซ้ำ (T8/T8b) |
| Concurrent failure | ✅ serialize ด้วย lock + unique_violation recovery (concurrency test 2 sessions จริง) |
| Replay คืนข้อมูล order อื่น? | ❌ ไม่ — result ผูก key+owner; ต่าง owner = conflict ไม่คืนอะไร (T10) |
| Same-key payload ต่างกันยึด order เดิมได้ไหม? | ❌ ไม่ — fingerprint ต่างกัน = conflict ทันที (T3) |

**ความเสี่ยงที่เหลือ (isolated ปิดไม่ได้):** behavior บน Production จริง (load/lock contention), PostgREST surface ของ `_i`, pgbouncer/transaction pooling interaction — ดูข้อ 6

---

## 3. Fresh-DB Gap — Root-cause Matrix

**สิ่งที่พิสูจน์แล้ว:** `orders.delivery_address` **ไม่มี migration 001-123 ไฟล์ใดสร้าง** (001:251/003:75/004:458 = `pre_orders` เท่านั้น) แต่ **Production มีคอลัมน์นี้จริง** (drift จาก manual era) → fresh chain ล้มที่ 035 จนต้องใช้ CI shim

| รายการ | อาการบน fresh chain | จำแนก | หลักฐาน |
|---|---|---|---|
| `orders.delivery_address` | 035 สร้าง trigger `UPDATE OF … delivery_address` + function/view อ้าง `o.delivery_address` → column ไม่มี | **Production schema drift (manual-era) + Actual migration defect (035 สมมติคอลัมน์)** | 001:136-150 · 035:148/158/230/239 · 037:14-15/117 (repair เป็น dropoff_detail) |
| 035 dollar-quote `}` (4 จุด) + `cnt, 0 rdy` | syntax error | **Actual historical migration defect** (manual-apply era artifact) | 035:134/144 |
| 035→037 `compute_delivery_fee` RETURN (jsonb→numeric) | CREATE OR REPLACE เปลี่ยน return type ไม่ได้ | **Actual historical migration defect** (repair ซ้อน signature) | shim drop ก่อน 037 · 035:23 / 037:56 |
| 065 อ้าง `profiles.tenant_id/is_platform` ก่อน 066 เพิ่ม | 065 ล้ม | **Actual historical migration defect (dependency ordering)** | shim pre-add |
| 067 `$$_` แทน `$$` (3 จุด) | dollar-quote เพี้ยน | **Actual historical migration defect (typo)** | 067:20-22 |
| 070 RAISE มี `%` แต่ขาด args (2 จุด) | runtime error ตอน verify | **Actual historical migration defect** | 070:4/7 |
| 077 `====BEGIN;` | syntax error | **Actual historical migration defect (artifact)** | 077:4 |
| 081 policy อ้าง `profiles.branch_id` ก่อน 090 เพิ่ม | 081 ล้ม | **Actual historical migration defect (dependency ordering)** | shim pre-add |
| 066 ต้องมี platform-owner profile `dddf4b57` | verify 066 ล้ม | **Data/seed prerequisite** (production identity era) | shim 066 |
| 107 `media_assets` ต้องมี 9 แถว | backfill/CHECK verify ล้ม | **Data/seed prerequisite** (manual-era data) | shim 107 |

**บทสรุปคำถาม "omission จริงไหม vs CI emulation gap":** เป็น **schema migration omission จริง** — Production มีคอลัมน์ที่ไม่มี migration สร้าง → fresh DB (CI, disaster recovery, env ใหม่) ไม่เท่า Production ถาวร · ข้อเสนอ = ข้อ 4

---

## 4. ข้อเสนอ Migration ใหม่: `orders.delivery_address`

**ไฟล์:** `supabase/migrations/PROPOSED_wave5_orders_delivery_address.sql` (prefix `PROPOSED_` = CI loop ข้ามอัตโนมัติ · **ไม่ได้ apply ที่ใด**)

- **Exact SQL:** `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';` + `COMMENT ON COLUMN` (idempotent — no-op บน Production ที่มีอยู่แล้ว)
- **Preconditions:** (1) read-only probe เทียบ type/default/nullable บน Production ให้ตรงก่อน (2) backup/snapshot (3) maintenance window ต่ำ traffic (ACCESS EXCLUSIVE สั้น)
- **Rollback limitations:** `DROP COLUMN` คืน schema ได้แต่**ข้อมูล manual-era ใน Production จะหายถาวร** → แนะนำคงคอลัมน์ไว้; fresh DB rollback ปลอดภัย 100%
- **Dependencies:** หลัง apply = ถอด shim `orders.delivery_address` ใน contract-tests.yml ได้ · ไม่แตะ migration history · 037 repair ไม่ต้องแก้
- **Data impact:** ไม่แตะแถวเดิม (ADD COLUMN DEFAULT = metadata-only) · **มี optional backfill `delivery_address ← dropoff_detail เฉพาะแถวค่าว่าง`** — ยัง**ไม่เปิด** รอ Owner ตัดสิน (ปัจจุบัน RPC เขียนที่อยู่ลง `dropoff_detail` แต่หน้า DeliveryManagement อ่าน `delivery_address` = แสดง '—' สำหรับออเดอร์ยุค RPC ทั้ง Production และ fresh)
- **Test plan:** fresh chain 001-123 โดยไม่มี shim ต้องเขียว → contract 123/124 + cleanup + concurrency เท่าเดิม → re-apply = no-op → Production verify metadata-only

---

## 5. CI Shim Inventory + เหตุผล (มี comment อธิบายใน `contract-tests.yml` ทุกตัว)

| Shim | จุด | เหตุผล | จำแนก |
|---|---|---|---|
| prelude stubs (`e2e/ci/00_prelude_supabase_stubs.sql`) | ก่อน 001 | Supabase emulation: roles/auth schema/auth.users/storage | CI bootstrap (จำเป็น) |
| preprocessor: `}`→`$$`, `$$_`→`$$`, `====BEGIN;`, RAISE args, `cnt, 0 rdy` | temp copy 035/067/070/077 | แก้ syntax artifact โดย**ไม่แตะไฟล์ history** | Repair technique |
| awk แทรก `DROP POLICY IF EXISTS` ก่อนทุก CREATE POLICY (207 จุด) | temp copy | chain มี CREATE POLICY ซ้ำไม่มี DROP (production = definition ล่าสุดชนะ) | Repair technique |
| `DROP compute_delivery_fee(5-arg)` ก่อน 035/037 | 035/037 | return-type clash jsonb↔numeric | Migration defect workaround |
| `orders.delivery_address` ADD COLUMN | 035 | **fresh-DB gap จริง** (ข้อ 3/4) | Schema drift — ปิดด้วย migration ใหม่ |
| `profiles.tenant_id/is_platform` pre-add | 065 | dependency ordering defect | Migration defect workaround |
| `profiles.branch_id` pre-add | 081 | dependency defect (090 เพิ่มทีหลัง) | Migration defect workaround |
| platform-owner fixture `dddf4b57` | 066 | data precondition (production identity) | Data/seed |
| media_assets 9 แถว fixture | 107 | data precondition (manual-era data) | Data/seed |

**การแยกจาก production path:** `ci.yml` (build/deploy) ไม่อ้าง postgres/contract/order_submissions เลย (grep = 0) — contract-tests.yml แยกเด็ดขาด ไม่มี production creds ✓

---

## 6. ความเสี่ยงที่เหลือเฉพาะ Production (isolated ปิดไม่ได้)

1. **ไม่มี production runtime test ของ `_i`** — PostgREST exposure/grants บน API gateway, pgbouncer transaction pooling กับ advisory locks
2. **RC-5 SHA binding ยัง MISSING** (EV-019) — deploy ปัจจุบันไม่ระบุ build identity
3. **`orders.delivery_address` ยังเป็น drift** จนกว่า migration ข้อ 4 จะได้รับอนุมัติ + apply
4. **Admin DeliveryManagement แสดง `delivery_address` แต่ RPC เขียน `dropoff_detail`** — ออเดอร์ใหม่โชว์ '—' (เกิดทั้ง Production และ fresh) — ต้องเลือก backfill หรือสลับฟิลด์แสดงผล
5. **Payment intent/charge จริง** — T8b พิสูจน์เฉพาะว่า submit/replay ไม่สร้าง intent; การจ่ายจริง/Stripe ต้องทดสอบใน production tier โดย Owner
6. Cleanup/concurrency ทดสอบบน disposable DB เท่านั้น — production load/lock contention ยังไม่เคย

---

## 7. การกระทำที่ต้องขออนุมัติ Owner (ห้ามทำเอง)

| # | การกระทำ | เงื่อนไข |
|---|---|---|
| 1 | **Apply migration 124 (`order_submit_idempotency`) ไป Production** | contract124+cleanup+concurrency เขียวแล้ว (✅) — ต้อง Owner ตรวจ diff ข้อ 2 + ความเสี่ยงข้อ 6 ก่อน |
| 2 | **Approve + apply `PROPOSED_wave5_orders_delivery_address.sql`** (พร้อมตัดสินใจ optional backfill) | ตามข้อ 4 · ห้าม apply โดยไม่ขอ |
| 3 | ตัดสินใจ backfill `delivery_address ← dropoff_detail` หรือสลับ UI ไปอ่าน `dropoff_detail` | ข้อ 6.4 |
| 4 | Publish schedule 14 แถว · test order/payment จริง · kitchen/delivery runtime | ชุด Owner-only เดิม |
| 5 | ประกาศ "พร้อมเปิดร้าน" | **ยังห้าม** จน PRODUCTION-RUNTIME tier ผ่าน |

---

## สถานะ git / ความสะอาด

- HEAD == origin/main = `a834cc6` (ก่อน commit เอกสารชุดนี้) · untracked เดิม 13 ไฟล์คงเดิม · stash `local-edits-before-sync-2026-09-21` ไม่ถูกแตะ
- แก้เฉพาะ: `e2e/contracts_124_idempotency.sql`, `e2e/ci/concurrency_124.sh` + เอกสาร + PROPOSED — **ไม่แตะ src/, ไม่แตะ migration history 001-123**
- CI: contract-tests run #18 (`cdc79ac`) = success · run #19 (`a834cc6`) = ดูผลใน EV-029 · ci.yml หลักแยกเด็ดขาด