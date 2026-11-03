# BMB WAVE 5B HANDOFF — ปิดจุดเสี่ยง Contract 124 (อ่านก่อนทำงานต่อ)

> สร้าง 2026-10-13 · repo `D:\A PROJECT\Bite Me Baby` · branch `main`
> **คำตัดสิน Owner (ล่าสุด): 124 "ยังไม่ให้ผ่าน" — ทดสอบผ่านแล้วแต่ยังมีจุดเสี่ยงค้าง ต้องปิดให้ครบก่อนถึงจะนับว่า contract 124 ปิดได้**
> งานแชทนี้ = ตรวจสถานะ + แฮนออฟเท่านั้น · งานแก้จริง = แชทถัดไป

## สถานะ ณ แฮนออฟ

- HEAD == origin/main == **`8ca1365`** ✓ · tracked 0 · untracked **13 ไฟล์** (png 10 + webp 3) ห้ามแตะ · stash `local-edits-before-sync-2026-09-21` ห้ามแตะ
- CI บน `8ca1365`: **Contract Tests #21 = success · CI #447 = success · automation-scheduler = success**
- ก่อนหน้า: contract-tests **#18 (`cdc79ac`) = success ครั้งแรกของ workflow** · #19 (`a834cc6`) = success (เพิ่ม T8b) · local Docker replica `ALL_GREEN` 3 รอบ
- Local gates: 934/934 · tsc 0 · lint 0 · build OK · brand 349
- **บรรทัดล่าง: matrix T1-T13+T8b+cleanup+concurrency ผ่านจริงบน isolated แต่ Owner ยังไม่รับรอง — ห้าม apply 124 ใน Production และห้ามประกาศปิด 124 จน risk register ด้านล่างปิดครบ**

## สิ่งที่ทำเสร็จแล้ว (อย่าทำซ้ำ)

1. แก้ fixture ฝั่ง contract 3 class (หลักฐานพิสูจน์ว่า 118/124 ถูกต้อง — ห้ามแก้ 118/124 เว้นแต่พบ defect จริง):
   - dropoff coords = `kitchen_location()+0.002` (~0.3 กม.) — fixture เดิม กทม. ห่าง fallback kitchen จันทบุรี 383.63 กม.
   - success assertion = มี `order_number` (118 **ไม่มีคีย์ `ok`**)
   - T8 อ่าน `order_submissions` ผ่าน `pg_temp` SECURITY DEFINER helper + **T8b** (replay ไม่สร้าง payment_intents)
2. **`e2e/contracts_124_idempotency.sql`** = matrix T1-T13+T8b · **`e2e/ci/concurrency_124.sh`** = 2 sessions จริง
3. เอกสารครบ: `docs/BMB_WAVE5B_OWNER_REVIEW_PACK.md` (7 หัวข้อ) · EV-029 · Checkpoint W5B · `supabase/migrations/PROPOSED_wave5_orders_delivery_address.sql` (ยังไม่ apply)
4. Local replica ของ CI stack = **`e2e/ci/local_stack_replica.sh`** (วิธีใช้ใน header ไฟล์)

---

## RISK REGISTER — ต้องปิดครบก่อนนับว่า 124 ผ่าน (เรียงตามความสำคัญ)

### R1 · PROVEN DEFECT — fingerprint ไม่เสถียรกับ numeric scale
- **หลักฐาน (รันจริง postgres:16, 2026-10-13):** `md5(jsonb_build_object('dist', 0::numeric)::text) = md5(… 0.0 …)` → **`f`** · `13.7563` vs `13.75630` → **`f`** — payload ที่ "เท่ากันทางตรรกะ" ให้คนละ fingerprint
- **ที่มา:** `124_order_submit_idempotency.sql:79-85` md5 ของ `::text` ของ jsonb — numeric scale (trailing zero) รั่วเข้า fingerprint
- **ผลกระทบ:** retry ที่ client ส่งเลขต่าง scale (หรือคนละ lib ตีความ JSON ต่างกัน) → **`ERR_IDEMPOTENCY_CONFLICT` ทั้งที่เป็น order เดิม** = พังจุดประสงค์ idempotency · ยังรวมถึง `items` array ที่สลับลำดับ = fingerprint ต่างทั้งที่ออเดอร์เดียวกัน
- **วิธีปิด:** normalize ก่อน hash (เช่น numeric → `trim_scale()` หรือ `round(numeric,6)::text`, items ตัดสินใจ policy ลำดับ) หรือเลิกใช้ md5 text แล้วเทียบ args ด้วย `jsonb =` semantics (เก็บ args ไว้ในตาราง) · **ถ้าแก้ behavior ของ 124 = แก้ได้ใน isolated (ยังไม่ apply prod) แต่ต้องอัปเดต audit doc + contract ให้ตรง**
- **Test ที่ต้องมี:** same key + same logical payload แต่ `p_distance_km` 0 vs 0.0 / coords 13.7563 vs 13.75630 / items สลับลำดับ → ต้อง replay order เดิม (หรือถ้าตัดสินใจเข้ม = reject ด้วย error ที่ระบุชัด + บันทึกเป็นสัญญา)

### R2 · PROVEN (source) — submit key ไม่ normalize
- **หลักฐาน source:** `124:88` btrim เฉพาะตอนเช็ค empty แต่ `124:126` เก็บ `p_client_submit_key` **ดิบ** — `' CK-1'` / `'CK-1'` / `'CK-1 '` / `'ck-1'` = 4 keys คนละตัว → **ออเดอร์ซ้ำได้จากการแปร key เล็กน้อย**
- **เพิ่มเติม:** ไม่มี max length / charset validation — key ยาวมาก = โต PK + hash นาน (abuse ได้)
- **วิธีปิด:** `btrim` ทุกทาง (เก็บ+เทียบ) + ตัดสินใจ case policy + length cap (เช่น 1-128) + charset (printable) — reject ด้วย `ERR_INVALID_SUBMIT_KEY` ถ้านอกกติกา
- **Test:** whitespace/case variants ต้อง map เป็น order เดียว (หรือ reject ตาม policy ที่เลือก) · key ยาว 10KB ต้อง reject

### R3 · SOURCE — replay คืน payload เก่า (stale) ที่มี `payment_status: 'pending'`
- **ที่มา:** `124:109` `RETURN v_row.result` = snapshot ณ ตอนสร้าง (`118:269-276`) — แม้ order นั้นจะจ่ายแล้ว/ยกเลิกแล้ว ผลที่คืนยัง "pending"
- **ผลกระทบ:** client ที่ resubmit (retry หลัง network error) ได้ payload บอกว่า "ยังไม่จ่าย" → **อาจเปิด payment intent ซ้ำ** หรือ UI สับสน — T8b ป้อง server แต่ client ยังถูกยั่วด้วยข้อมูลเก่า
- **วิธีปิด (เลือกอย่างใดอย่างหนึ่ง + บันทึกเป็นสัญญา):** (ก) replay คืนสถานะปัจจุบันจาก `orders` (merge) (ข) เพิ่ม marker `"replay": true, "submitted_at", "created_at"` ให้ client รู้ว่าเป็นของเก่า (ค) คืน `order_number` อย่างเดียว + ให้ client ไป fetch สถานะเอง
- **Test:** สร้าง order → UPDATE status/payment_status → replay ด้วย key เดิม → ต้องได้ผลตาม policy ที่เลือก

### R4 · GAP — concurrency test ไม่ได้ `SET ROLE authenticated`
- **ที่มา:** `concurrency_124.sh` ตั้ง claims อย่างเดียว แต่ psql = superuser — role fidelity ต่ำกว่า traffic จริง (authenticated) · matrix T1-T13 ได้ role จริงแล้วแต่ concurrency ไม่
- **วิธีปิด:** เพิ่ม `SELECT set_config('role','authenticated',false);` ในทั้งสอง session แล้วรันซ้ำ

### R5 · GAP — concurrent same key + **payload ต่างกัน** ไม่เคยทดสอบ
- คาดหวัง: ชนะ 1 (order เดียว) / แพ้ 1 = `ERR_IDEMPOTENCY_CONFLICT` · orders=1 · submissions=1 — เติมใน `concurrency_124.sh`

### R6 · GAP — concurrent ที่ session แรก "ล้ม" แล้ว session สองชนะ ไม่เคยทดสอบ
- T7 ทำแบบ sequential เท่านั้น — อยากได้: A ยิง payload ที่ trigger error พร้อม key K, B ยิง payload ดีพร้อม key K พร้อมกัน → ไม่มี partial, B สร้าง 1 order

### R7 · GAP — channel path (`source_channel` + `external_ref_id` + key) ไม่ทดสอบ
- 048/117 มี duplicate guard ของตัวเอง (early return `duplicate: true`) — interplay กับ 124 ยังไม่มี test: same key+same extref / same key ต่าง extref / extref เดิม key ใหม่

### R8 · GAP — service-role trusted intake (`p_customer_ref`, ไม่มี auth.uid) + key ไม่ทดสอบ
- owner_key = `'|' || cref` (`124:78`) — path นี้ใช้โดย channel webhook จริง แต่ matrix ใช้แค่ auth.uid

### R9 · OPS — `order_submissions` ไม่มี retention + เก็บ PII ซ้ำ
- โตไม่จำกัด (PK text) · `result` jsonb มี name/phone/address ซ้ำอีกชุด (RLS/REVOKE คุมแล้ว แต่ retention ต้องตัดสินใจ) — เสนอ TTL/cleanup job (เช่น 90 วัน) หรือ mask PII ใน result

### R10 · PROD PRECHECK — ต้องยืนยันว่า Production มี `create_order_with_items` **18-param (118)** ก่อน apply 124
- ถ้า prod ยังเป็น 15-param ยุค 089 → named args ของ 124 (`p_source_channel` ฯลฯ) จะ **fail ทันที**
- Read-only precheck (ห้ามเขียน): `SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname='create_order_with_items' AND pronamespace='public'::regnamespace;` — ต้องเห็น `p_customer_ref uuid` เป็นตัวสุดท้าย

### R11 · PROD — PostgREST surface + pgbouncer/transaction pooling
- `_i` ยังไม่เคยถูกเรียกผ่าน API gateway จริง · advisory xact lock บน transaction pooling ต้องทดสอบบน staging (isolated ปิดไม่ได้)

### R12 · MINOR — ใช้ md5 (collision เชิงทฤษฎี) — เสนอ sha256 พร้อม R1

### R13 · MINOR — `order_submissions.order_number` ไม่มี FK — replay อาจคืน "ออเดอร์ผี" หลัง order ถูกลบ

### R14 · GAP — T3 (changed payload) ไม่ได้ assert "ไม่ leak" (T4/T10 มีแล้ว) — เติม assertion ให้ครบ

### R15 · OPS — concurrency leftovers (`0911111111`) ตั้งใจค้างใน ephemeral DB · cleanup check ไม่ครอบคลุมเบอร์นี้ — ถ้าเผลอใช้ DB ที่ไม่ disposable จะสะสม (workflow ระบุ "ephemeral leftovers OK" แล้ว แต่ต้องระวังตอนใช้ DB ร่วม)

---

## FIRST ACTIONS สำหรับแชทหน้า (เรียงลำดับ)

1. **อ่าน 3 ไฟล์:** แฮนออฟนี้ + `docs/BMB_WAVE5B_OWNER_REVIEW_PACK.md` (ข้อ 2/6) + `supabase/migrations/124_order_submit_idempotency.sql` — แล้ว **ตรวจสถานะซ้ำ** (HEAD/origin, CI ล่าสุด) อย่าเชื่อแฮนออฟลอย ๆ
2. **สร้าง local loop ก่อน push ทุกครั้ง:** `e2e/ci/local_stack_replica.sh` (ดู header วิธีใช้ — Docker postgres:16, รันได้ทั้ง stack รวม contract 124 + cleanup + concurrency ในไม่กี่นาที) —  iterate ในเครื่องจน ALL_GREEN แล้วค่อย push → poll CI (annotations API เดิม)
3. **ปิด R1 → R2 → R3 ก่อน (defect candidates):** แก้ `124_order_submit_idempotency.sql` ใน isolated ได้ (ยังไม่ apply prod) — ตัดสินใจ policy ตามตัวเลือกในแต่ละข้อ แล้ว **อัปเดต contract ให้ตรง behavior ใหม่ + อัปเดต audit ข้อ 2 ใน review pack** — ห้ามปรับ assertion ให้ผ่านแบบลดความเข้มงวด
4. **เติม test ที่หาย: R4-R8, R14** (concurrency role fidelity, different-payload race, fail-then-win, channel interplay, service-role path, T3 no-leak)
5. **รัน loop จนเขียวจริงทั้ง local + CI** → แยกผล EXECUTED/PASSED/FAILED/SKIPPED/NOT EXECUTED → อัปเดต EV-03x + Checkpoint (แถว W5C) + รายงาน Owner
6. **R10 precheck (read-only เท่านั้น)** ถ้ามี production access; ถ้าไม่มี = ระบุในรายงานว่ายังเป็น precheck ค้าง

## กติกาเหล็ก (ห้ามละเมิด — เหมือนเดิมทุกข้อ)

- stage **exact paths** เท่านั้น · ไม่ `git add -A` · ไม่ force push/reset · **ห้าม apply 124 / PROPOSED migration ใน Production** · ห้ามแก้ไฟล์ migration 001-123 (history) · ห้าม production write (orders/payments/menu schedules/delivery rounds/config) · ห้ามอ้าง CI ผ่านขณะยังรัน · ห้ามประกาศ "พร้อมเปิดร้าน"/ปิด 124 จน risk register ปิดครบ + Owner อนุมัติ
- **PowerShell hazards:** inline command ยาว ๆ ทำ PSReadLine crash (terminal พังทั้งแถบ) — แยกคำสั่งสั้น ๆ · `$$`/backslash หายเมื่อส่งผ่าน arg → ใช้ไฟล์ `.cjs`/`.sh` ที่เขียนด้วย editor แล้ว **normalize เป็น LF ด้วย node** (`s.replace(/\r\n/g,'\n')`) ก่อนเข้า container — sed ที่ส่ง pattern ผ่าน arg อาจได้ `s/r$//` มากินตัวอักษรท้ายบรรทัด (เจอมาแล้ว: `trigger`→`trigge`)
- มี Git bash ที่ `C:\Program Files\Git\bin\bash.exe` · package = `"type":"module"` → temp script ต้อง `.cjs` · untracked 13 + stash = ห้ามแตะ · **โปรเจค selfprint (containers `*_selfprint-v3-react`) = ห้ามยุ่ง**
- Evidence tiers: SOURCE ✅ · AUTOMATED ✅ · ISOLATED-DB ✅ (แต่ **ยังไม่รับรอง 124**) · PRODUCTION-RUNTIME ❌

## Owner-only ที่ยังค้าง (ห้ามทำเอง)

- **คำตัดสิน policy ของ R1 (fingerprint normalize แบบไหน) / R2 (key case policy) / R3 (replay payload แบบไหน)** — แชทหน้าเสนอ option ให้เลือกถ้าตัดเองไม่ได้
- Approve **migration 124 → Production** (ยังไม่พร้อม — ต้องปิด register ก่อน) · Approve **PROPOSED_wave5_orders_delivery_address.sql** (+ optional backfill)
- Publish schedule 14 แถว · test order/payment จริง · kitchen/delivery runtime · RC-5 deploy metadata · evening round (deferred)
- ตรวจสอบ `order_submissions` retention policy (R9)

## เกณฑ์ที่จะประกาศว่า "124 ผ่าน" ได้

1. R1-R3 ปิดด้วย code/test จริง (ไม่ใช่แค่เอกสาร) + R4-R8/R14 test ครบ
2. Local replica ALL_GREEN + CI contract-tests success บน SHA สุดท้าย
3. R10-R11 ได้รับการปิดหรือมีแผน staging ชัด · R9/R12/R13/R15 มีมติบันทึกไว้
4. Owner ลงลายเซ็นรับรอง diff 124 รอบสุดท้าย