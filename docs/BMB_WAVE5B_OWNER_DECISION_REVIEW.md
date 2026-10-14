# BMB WAVE 5B — OWNER DECISION REVIEW (READ-ONLY): Migration 124 + Delivery Address + Git State

> สร้าง 2026-10-14 · repo `D:\A PROJECT\Bite Me Baby` · branch `main` · **MODE: READ-ONLY — ไม่แก้ src/ · ไม่แตะ migration history 001-123 · ไม่แตะ Production · ไม่ apply PROPOSED migration · ไม่ทำ backfill**
> งานรอบนี้ = ปิดคำถาม Migration 124 + แก้แผน delivery_address + รายงานสุดท้ายเท่านั้น
> **ห้ามประกาศ Production Ready / เปิดร้าน — จนกว่า risk register + PRODUCTION-RUNTIME tier จะปิดครบ + Owner อนุมัติ**

---

## 1. ผลตรวจ Git state + แหล่งจริง

| รายการ | ผลตรวจ (รันจริง 2026-10-14) |
|---|---|
| Repository | `git rev-parse --show-toplevel` = `D:/A PROJECT/Bite Me Baby` · branch `main` ✓ |
| HEAD | `8d2dc0898cf29f4c63538846702764756c60f759` (`8d2dc08`) |
| origin/main | `8d2dc08…` — **HEAD == origin/main ✓** (เท่ากับ CI SHA ของ Contract Tests #22 / CI #448 ตามแฮนออฟ — binding ตรงกัน) |
| Staged | **0 ไฟล์** |
| Unstaged (modified) | **0 ไฟล์** |
| Untracked | **13 ไฟล์** (คงเดิม ห้ามแตะ) |
| Stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` — ครบ ไม่ถูกแตะ ✓ |
| หมายเหตุ CI | รอบนี้ไม่มี `gh` CLI ในเครื่อง → re-verify ได้เฉพาะ SHA binding (HEAD=origin=8d2dc08 ตรงกับแฮนออฟ) · สถานะ conclusion ของ run #22/#448 = success อ้างจากแฮนออฟ (ไม่ได้ re-query API) |

### จำแนก untracked 13 ไฟล์ (ไม่แตะ — ดูอย่างเดียว)

| กลุ่ม | ไฟล์ | จำแนก + ข้อเสนอแนะ |
|---|---|---|
| QA evidence screenshots (10 png) | `e2e/screenshots/cr4-02-home-dark.png`, `cr4-04-checkout-guest-gate.png`, `cr4-05-login-gps-denied.png`, `cr4-06-login-gps-granted.png`, `launch-01-track-canonical.png`, `launch-01b-track-guest-gate.png`, `launch-02-reviews-meta.png`, `launch-03-gps-granted.png`, `launch-04-gps-denied.png`, `launch-05-chat-deadline.png` | หลักฐาน visual QA (รอบ CR-4 + launch) — ให้ Owner ตัดสินภายหลัง: commit เป็น evidence pack หรือ gitignore · **รอบนี้ห้ามแตะ** |
| Media placeholder (2 webp) | `public/assets/coming soon.webp`, `public/images/snacks/coming soon.webp` | placeholder asset ของ UI — รอตัดสินใจเข้า source หรือ local-only |
| Media สินค้า (1 webp) | `public/images/drinks/ชาไทยนมสด.webp` | รูปสินค้า (drinks) — เช่นเดียวกัน รอตัดสินใจ |

**กติการอบนี้:** ไม่ stage/commit/push/reset/clean สิ่งใดที่ไม่ใช่เอกสาร — commit ที่เกิดขึ้นจะมีเฉพาะเอกสารเท่านั้น (ดู §4.6)

---

## 2. คำถาม Migration 124 ที่ปิดแล้ว (4 หัวข้อ)

### 2.1 Migration 118 failure paths: **ทุกจุด RAISE — ไม่มี JSON error return** (SOURCE ชี้ขาด + ISOLATED ยืนยัน)

อ่าน body จริงทั้งก้อน (`supabase/migrations/118_restore_fc_gates_after_117.sql:45-277`) ได้ผลชี้ขาด:

- **`RAISE EXCEPTION 'ERR_*'` = 37 จุด** ครอบคลุมทุก failure path: `ERR_NOT_AUTHENTICATED` (51) · `ERR_FORBIDDEN_CUSTOMER_REF` (54) · `ERR_INVALID_SOURCE_CHANNEL` (62) · `ERR_INVALID_EXTERNAL_REF` (67) · `ERR_INVALID_ORDER_MODE` (90) · `ERR_EMPTY_ORDER` (91) · `ERR_MISSING_ROUND` (92) · `ERR_INVALID_PAYMENT_METHOD` (93) · `ERR_INVALID_DELIVERY_METHOD` (94) · `ERR_BRANCH_NOT_FOUND` (100) · `ERR_ROUND_BRANCH_MISMATCH` (102) · `ERR_CONFIG_MISSING` ×4 (115-118) · `ERR_ROUND_NOT_FOUND` (129) · `ERR_ROUND_CLOSED` (130) · `ERR_ROUND_DATE` (133/135) · `ERR_CUTOFF_PASSED` (134) · `ERR_MISSING_SCHEDULED_DATE` (137) · `ERR_SCHEDULED_DATE_INVALID` (138) · `ERR_ROUND_DATE_MISMATCH` (139) · `ERR_LEAD_TIME` (140) · `ERR_CAPACITY_FULL` (143) · `ERR_MISSING_PRODUCT_ID` (148) · `ERR_INVALID_QUANTITY` (149) · `ERR_PRODUCT_NOT_FOUND` (151) · `ERR_PRODUCT_UNAVAILABLE` (152) · `ERR_PRODUCT_MODE_NOT_ALLOWED` (153/154) · `ERR_QTY_LIMIT` (160) · `ERR_INSUFFICIENT_INGREDIENT` (164) · `ERR_MISSING_DELIVERY_COORDS` (186) · `ERR_BITE_DRIVE_DISABLED` (194) · `ERR_DELIVERY_METHOD_ZONE` (196/198) · `ERR_EXTERNAL_METHOD_DISABLED` (200) · `ERR_ORDER_NUMBER_EXHAUSTED` (216)
- **`RETURN jsonb …` มีเพียง 3 จุด และไม่มีจุดใดเป็น "error result":**
  - `118:78-85` — duplicate guard (business dedup, `duplicate: true`, รูปแบบย่อ)
  - `118:253-259` — channel-tag unique_violation recovery (`duplicate: true`, รูปแบบย่อ)
  - `118:269-276` — success เต็มรูป (`order_number`, totals, `payment_status: 'pending'`, …)
- **บทสรุป: ไม่มี JSON error result ใน 118 — failure ทุกตัว = RAISE**

**หลักฐาน ISOLATED (probe A1, postgres:16 รันจริง 2026-10-14, ใช้ไฟล์ 118/124 ของจริง):** เรียก `create_order_with_items_i` ด้วย payload ที่ fail → ได้ `RAISED: ERR_EMPTY_ORDER` และ `order_submissions` สำหรับ key นั้น = **0 rows (`A1-OK-NO-PERSIST`)**

### 2.2 Migration 124 จะ persist ผลลัพธ์ JSON ที่ "ล้มเหลว" ได้ไหม → **ไม่ได้** (มีข้อยกเว้นหนึ่งที่ต้องรู้)

- **กลไก (source):** `124:113-122` เรียก `create_order_with_items` แบบไม่ครอบ subtransaction — เมื่อ 118 RAISE exception จะ propagate ผ่าน `_i` ทั้งตัว → **ข้าม `INSERT INTO order_submissions` (124:125-126) ไปเลย** → failed result ไม่มีทางเข้าตาราง · probe A1 = EXECUTED & PASSED ยืนยันพฤติกรรมนี้บนโค้ดจริง
- **ข้อยกเว้นเดียวที่ persist ได้ (PROVEN — probe A2):** ผลลัพธ์ `duplicate: true` รูปแบบย่อ (`{"id","order_number","duplicate":true,"source_channel","external_ref_id"}` — **ไม่มี** `payment_status`/totals) จาก `118:78`/`118:253` ถูก persist และ replay ซ้ำได้ (`A2-OK-REDUCED-SHAPE-PERSISTED` + replay คืนของเดิมเป๊ะ) — ไม่ใช่ "ผลล้มเหลว" แต่เป็นผลสำเร็จแบบย่อที่ client อาจตีความผิด (shape ต่างจาก success เต็ม)
- **Minimal safe correction proposal (ยังไม่ implement ตามคำสั่ง):**
  1. **Guard ใน `_i` (แนะนำ):** ก่อน INSERT — ถ้า `v_res->>'order_number' IS NULL` → `RAISE 'ERR_IDEMPOTENCY_BAD_RESULT'` (กัน result ไม่มี order_number ซึ่งปัจจุบัน coalesce เป็น `''` ที่ 124:126 — ผูกกับ R13 ghost replay) + เพิ่ม marker `"replay": true, "submitted_at": …` สำหรับผล duplicate/replay ให้ client แยกแยะได้ (ทับซ้อนทางเลือก R3(ข))
  2. **Constraint กันท้ายตาราง:** `ALTER TABLE order_submissions ADD CONSTRAINT os_result_has_order CHECK (result ? 'order_number')`
  3. **Contract tests ที่เสนอ (ยังไม่เขียน):** **T14** = key + duplicate-guard path → row ต้องมี `duplicate=true` + `order_number` ชี้ออเดอร์เดิม + replay เท่ากันเป๊ะ · **T15** = key + payload ที่ fail → ไม่มี row + retry ด้วย payload ดี = 1 order · **T16** (ถ้าทำข้อ 2) = insert result ไม่มี order_number → โดน CHECK

### 2.3 Function grants / ownership / SECURITY DEFINER / search_path (แยกตาม evidence tier)

**SOURCE:**
- `118:22-26` — `LANGUAGE plpgsql · SECURITY DEFINER · SET search_path TO 'public'` · `118:280-281` — `REVOKE EXECUTE … FROM PUBLIC; GRANT EXECUTE … TO authenticated`
- `124:66-70` — `RETURNS jsonb · SECURITY DEFINER · SET search_path = public` · `124:143-144` — REVOKE/GRANT เหมือนกันเป๊ะ
- `124:43-44` — `order_submissions` ENABLE RLS (ไม่มี policy = ทุก role โดนบล็อก) + `REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role`
- ต้นฉบับ grants ของตัวเดิม = `025:382-383` · 124 comment (124:9/21) ระบุ owner=postgres

**ISOLATED (probe A5 — postgres:16, apply 118+124 ของจริง, 2026-10-14):**

| Object | identity args | SECURITY DEFINER | search_path | owner | proacl |
|---|---|---|---|---|---|
| `create_order_with_items` | **18 params** (`p_customer_ref uuid` ตัวสุดท้าย ✓ ตรง R10 expectation) | `t` | `{search_path=public}` | `postgres` | `{postgres=X/postgres, authenticated=X/postgres}` |
| `create_order_with_items_i` | **19 params** (+ `p_client_submit_key text` ตัวสุดท้าย) | `t` | `{search_path=public}` | `postgres` | `{postgres=X/postgres, authenticated=X/postgres}` |

- `has_function_privilege`: authenticated = **t/t** · anon = **f/f** · service_role = **f/f** (ทั้งสองฟังก์ชัน)
- `order_submissions`: `relrowsecurity=t` · `relforcerowsecurity=f` · `relacl={postgres=arwdDxt/postgres}` · SELECT ของ authenticated/service_role/anon = **f/f/f**
- หมายเหตุ: owner=postgres = role ที่ apply migration ใน probe/CI — ค่าบน Production ขึ้นกับ role ที่ apply (มัก `supabase_admin`/`postgres`)

**PRODUCTION:** ❌ ยังไม่มีหลักฐาน — R10 (precheck 18-param ด้วย query ในแฮนออฟ) และ R11 (PostgREST surface + pgbouncer) ยังค้าง (ไม่มี production access ในรอบนี้)

### 2.4 Checkout-to-PostgREST RPC path จริง

| เส้นทาง | หลักฐาน (SOURCE) |
|---|---|
| Checkout/app → order | `CheckoutPage.tsx` → `createOrder()` (`src/lib/bmbAdminApi_orders.ts:232-262`) → `supabase.rpc('create_order_with_items', payload)` (16 keys `p_*` — ไม่ส่ง `p_source_channel`/`p_external_ref_id`/`p_customer_ref`/`p_client_submit_key`) → PostgREST `POST /rest/v1/rpc/create_order_with_items` → ฟังก์ชัน 118 (GRANT authenticated) |
| Guest checkout | `supabase/functions/guest-checkout-session/index.ts` ออก session ให้เรียก `create_order_with_items` แบบ authenticated เหมือนเดิม |
| Channel/service intake | `supabase/functions/channel-webhook/index.ts:232` → `POST /rest/v1/rpc/create_order_with_items` (service key + `p_customer_ref` + `p_source_channel` + `p_external_ref_id`) |
| **`create_order_with_items_i` (124)** | **ไม่มีใน `src/` หรือ Edge Function เลย** (grep ทั้ง repo = เฉพาะ `e2e/ci/concurrency_124.sh:27`) → 124 เป็น DB-side capability เท่านั้น ยังไม่มี traffic จริงเรียก |

**จำแนกหลักฐาน:** SOURCE ✅ (อ่านโค้ดครบ) · ISOLATED ✅ (probe เรียก `_i` ตรงใน DB — แต่**ไม่ผ่าน PostgREST**) · PRODUCTION-RUNTIME ❌ (`_i` ไม่เคยถูกเรียกผ่าน API gateway จริง — ตรง R11)

### 2.5 owner_key semantics: ผูกทั้ง `auth.uid()` **และ** `p_customer_ref` จริง — แต่ comment ของ design **ผิด**

- **โค้ดจริง `124:78`:** `v_owner := coalesce(auth.uid()::text,'') || '|' || coalesce(p_customer_ref::text,'')` = **concatenate สองมิติ** (เจ้าของ = ทั้ง uid และ cref)
- **comment ที่อ้าง (`124:31`, `124:40-41`) + review pack ข้อ 2 ระบุว่า "ตรง 118:49 (COALESCE)" — ผิดจริง:** `118:49` = `COALESCE(auth.uid(), p_customer_ref)` (ตัวใดตัวหนึ่ง) ไม่ใช่คู่
- **หลักฐาน ISOLATED (probe A3 — PROVEN):** call แรก auth.uid()=U1 + cref=U1 → สำเร็จ เก็บ owner_key = `U1|U1` · call สอง service-role (auth.uid()=NULL) + cref=U1 — **เจ้าของทางตรรกะเดียวกันตาม 118:49** และ args 18 ตัวเท่ากันเป๊ะ → ได้ **`ERR_IDEMPOTENCY_CONFLICT` = false conflict** (retry ข้ามรูปแบบ call ถูกปฏิเสธทั้งที่เป็นเจ้าของเดียวกัน)
- อีกช่องทาง (SOURCE): authenticated ที่ไม่ส่ง cref (owner `U1|`) vs ส่ง cref=U1 (`U1|U1`) → ทั้ง owner_key และ fingerprint ต่างกัน → conflict เช่นกัน
- **คำตัดสิน:** binding สองมิติ "เข้มกว่า" ในแง่ privacy (ไม่เคยคืนข้อมูลคนอื่น — T4/T10 ยังผ่าน) แต่ **คำอธิบาย design ผิดจริง** และพฤติกรรมสร้าง false conflict ข้าม shape
- **ข้อเสนอแก้ comment (ใน proposal เท่านั้น — ห้ามแก้ source ตามคำสั่ง):** เปลี่ยนคำอธิบายเป็น "owner_key = composite `auth.uid()|p_customer_ref` (เข้มกว่า 118:49)" + **เสนอทางเลือกแก้ behavior ให้ Owner ตัดสิน:** **(ก)** normalize เป็น `COALESCE(auth.uid()::text, p_customer_ref::text, '')` ให้ตรง 118:49 = เลิก false conflict ข้าม shape · **(ข)** คง composite แต่บันทึกเป็นสัญญาชัด + เติม test ยืนยัน
- **Contract tests ที่เสนอ:** **T17** = cross-shape retry (auth+cref vs svc+cref, args เดียวกัน) → ต้อง replay ถ้าเลือก (ก) / conflict ตามสัญญาถ้าเลือก (ข) · **T18** = auth+cref=NULL vs auth+cref=self ต้อง map เป็นเจ้าของเดียวกัน (ถ้าเลือก (ก))

### 2.6 คำตัดสิน Migration 124: **DEFER**

| เหตุผล | |
|---|---|
| ทดสอบผ่านจริงบน isolated (T1-T13+T8b+cleanup+concurrency, CI #18/#19/#22) | ✅ แต่ยังไม่พอ |
| **R1 = PROVEN DEFECT** (fingerprint numeric-scale — ยืนยันซ้ำ probe A4a/A4b/A4c บนโค้ด 124 จริง: dist 0 vs 0.0 → `ERR_IDEMPOTENCY_CONFLICT`) | ❌ ต้องปิดก่อน |
| **R2 = PROVEN** (key ไม่ normalize, ไม่มี cap) · **R3** (stale replay payload) | ❌ ต้องปิดก่อน |
| `_i` ยังไม่ถูก wire เข้า app/EF → apply ตอนนี้ไม่เกิดประโยชน์ใช้งาน | |
| R10/R11 production precheck ยังไม่ทำ | |
| comment/design mismatch (ข้อ 2.5) ต้องได้รับการตัดสิน | |
| **ไม่ REJECT** — โครงสร้างหลัก (advisory lock + PK + result replay + grants/RLS) ถูกต้อง ผ่านการพิสูจน์ — แก้ normalize 2-3 จุดแล้วกลับมาทวนได้ | |

**เกณฑ์ยกระดับเป็น APPROVE:** R1-R3 ปิดด้วย code/test จริง + R4-R8/R14 test ครบ + local replica ALL_GREEN + CI contract-tests success บน SHA สุดท้าย + Owner sign-off diff — ตามเกณฑ์ในแฮนออฟทุกข้อ

---

## 3. Delivery Address — Recovery Plan ที่แก้ไขแล้ว

### 3.1 รายการอ้างอิง `delivery_address` / `dropoff_detail` ทั้งหมด (verified จาก source)

| จุด | เนื้อหา |
|---|---|
| `001:251` / `003:75` / `004:458` | `delivery_address` มีเฉพาะใน **`pre_orders`** — **ไม่มี migration 001-123 ไฟล์ใด CREATE/ALTER `orders.delivery_address` เลย** |
| `035:148` | fn `validate_pre_order_delivery()` เช็ค `NEW.delivery_address` (คู่กับ `dropoff_detail`) |
| `035:158` | `CREATE TRIGGER trg_pre_order_address_check BEFORE INSERT OR UPDATE OF order_mode, dropoff_detail, delivery_address ON public.orders` — **จุดล้มของ fresh replay** (อ้างชื่อคอลัมน์ตอน DDL) |
| `035:230/239` | `get_all_orders_for_admin` SELECT/GROUP BY `o.delivery_address` |
| `037:14-15/23/117/128/202` | repair 035 ให้ใช้เฉพาะ `dropoff_detail` แล้ว (fn เช็ค `dropoff_detail` + trigger `UPDATE OF order_mode, dropoff_detail`) — **ไม่ต้องแก้ 037 เพิ่ม** |
| `089`/`114`/`117`/`118:219-220` | เส้นทางเขียนจริง: `p_delivery_address → dropoff_detail` เสมอ — ไม่มีโค้ดเขียน `orders.delivery_address` ตรง ๆ |
| `src/lib/bmbAdminApi_orders.ts:71` | `OrderForm.delivery_address` (read model) |
| `src/pages/admin/DeliveryManagement.tsx:220` | แสดง `o.delivery_address || '—'` — **ปัญหา UI ปัจจุบัน** |
| `src/pages/CheckoutPage.tsx` · `channel-webhook` | ส่ง `p_delivery_address` เป็น RPC input (→ ลง `dropoff_detail`) |
| tests/mocks (`supabaseMock`, `api.test`, `canonicalOrderFlow`, `dispatchContract`, `kitchenControl`, `paymentExceptions`, `preOrderQueue`, `w5h1Tracking`) | อ้าง field ตาม contract เดิม |
| `PROPOSED_wave5_orders_delivery_address.sql` | ข้อเสนอ `ADD COLUMN IF NOT EXISTS orders.delivery_address` (ยังไม่ apply ที่ใด) |
| CI shim `contract-tests.yml:94-100` | `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT '';` ก่อน 035 (fresh-DB gap workaround) |
| `supabase/replay/manifest.txt` | **ข้าม 035 ทั้งไฟล์** (034→036) + ระบบ `PATCH:` แทรก (replay_base, 070, 090a, 096, prod_align) = รูปแบบ recovery ที่ repo ใช้อยู่จริง |

### 3.2 ทำไม migration เลข >123 ช่วยให้ 035 ไม่ล้มตอน pristine replay 001-123 ไม่ได้

1. **ลำดับรัน = ลำดับเลข:** ระหว่าง replay 001→123 พอถึง 035 migration เลข 124+ **ยังไม่ถูกรัน** → คอลัมน์ `orders.delivery_address` ไม่มีอยู่จริง ณ ขณะนั้น
2. **`035:157-158` resolve ชื่อคอลัมน์ทันทีที่รัน DDL** (`CREATE TRIGGER … UPDATE OF … delivery_address`) → error "column … does not exist" → 035 fail → chain หยุดก่อนจะไปถึงเลข 124+ เสมอ — ต่อให้เลข 125 สร้างคอลัมน์ มันจะได้รันก็ต่อเมื่อ 001-124 ผ่านครบ ซึ่งเป็นไปไม่ได้
3. **การย้ายเลข/สลับลำดับให้ 125 รันก่อน 035 = rewrite history** (renumber/silent reorder) — ต้องห้ามตามกติกา เพราะ migration history คือสัญญาของ DB ที่ apply ไปแล้ว (production ผ่าน 035 มาแล้วในอดีต)
4. **Production รอดมาได้เพราะ manual-era drift** — มีคอลัมน์นี้อยู่ก่อนโดยไม่มี migration สร้าง = **schema drift จริง** (ไม่ใช่ CI emulation gap) — พิสูจน์แล้วใน review pack ข้อ 3
5. เพิ่มเติม: 035 ยังมี artifact `}` แทน dollar-quote (manual-apply era) — ต้อง preprocessor ช่วยอยู่ดี (contract-tests.yml preprocess) = 035 เป็นไฟล์ history ที่ "ใช้การไม่ได้บน fresh chain โดยไม่มีตัวช่วย" อยู่แล้ว

**บทสรุป:** migration หลัง 123 แก้ได้เฉพาะ **parity ของ DB ที่ chain ผ่านแล้ว/Production** — ไม่ใช่และไม่มีทางแก้ replay ของ 001-123 ได้ · ทางแก้ replay ต้องเป็น **compat layer ที่จุดก่อน 035** (แบบ shim/patch ที่ CI + replay manifest ใช้อยู่) หรือ **baseline ใหม่สำหรับ DB ใหม่**

### 3.3 กลยุทธ์ migration-recovery ที่ปลอดภัย (ไม่ rewrite history เงียบ ๆ) — เรียงตามความแนะนำ

1. **Formalize compat-patch layer (แนะนำ — ต่อยอดสิ่งที่มีอยู่):** คงหลักการ "history ห้ามแก้ + แทรก patch อย่างเปิดเผย" แบบที่ repo ใช้จริงแล้ว (`supabase/replay/manifest.txt` มี `PATCH:` + ข้าม 035 และ CI มี shim ที่ `contract-tests.yml:94-100`) — ย้าย shim ใน CI ให้เป็นไฟล์ patch มีชื่อ/มี comment เช่น `supabase/replay/patches/035_pre_add_delivery_address.sql` (idempotent `ADD COLUMN IF NOT EXISTS`) แล้วอ้างจากทั้ง CI และ replay manifest จุดเดียวกัน → audit ได้ + ไม่เงียบ + ไม่แตะไฟล์เดิม
2. **Baseline สำหรับ fresh install (ปิดปัญหาถาวร):** สร้าง `000_baseline` = schema dump สถานะหลัง 123 สำหรับ DB ใหม่ (CI/disaster recovery/env ใหม่) · ใช้ history 001-123 เฉพาะการ upgrade DB เดิม (industry-standard baseline migration) — fresh replay จะไม่ผ่าน 035 อีกเลยโดยไม่ต้องแก้ไฟล์ใดใน history
3. **Forward migration `125` (คือ `PROPOSED_wave5_orders_delivery_address.sql`):** apply บน Production เพื่อลบ drift (`ADD COLUMN IF NOT EXISTS` = no-op บน prod ที่มีคอลัมน์) — ทำให้ prod == fresh (ผ่าน shim) และเมื่อตัด baseline แล้วถอด shim ได้ — **ยังไม่ apply ตามคำสั่ง · ต้อง Owner อนุมัติ + preconditions ในไฟล์ (probe type/default/nullable, backup, maintenance window)**

**ห้ามเด็ดขาด:** แก้ไฟล์ 035 (silent rewrite) · renumber/ย้ายไฟล์ · แอบ pre-create คอลัมน์ใน prelude โดยไม่ document · apply address migration/backfill ในรอบนี้

### 3.4 Least-risk fix สำหรับ Admin DeliveryManagement (แนะนำ — ยังไม่ทำ)

- **ปัญหา:** 118 เขียนที่อยู่ลง `dropoff_detail` แต่ `DeliveryManagement.tsx:220` แสดง `o.delivery_address || '—'` → ออเดอร์ยุค RPC โชว์ '—' ทั้ง Production และ fresh
- **ข้อเสนอ = แก้ชั้น app จุดเดียว:** เปลี่ยนเป็น `o.delivery_address || o.dropoff_detail || '—'` (fallback) — เพราะ `getOrdersByStatuses` ใช้ `orders.select('*')` (`bmbAdminApi_orders.ts`) → **`dropoff_detail` อยู่ในมือ UI แล้ว** · ไม่แตะ DB · ไม่ต้อง migration · ไม่ต้อง backfill · ย้อนกลับง่าย · เสี่ยงน้อยที่สุดในทุกตัวเลือก
- **ทางเลือกรอง (ถ้าต้องการ fix ฝั่ง SQL):** forward migration ใหม่ `CREATE OR REPLACE get_all_orders_for_admin` ให้ SELECT `COALESCE(NULLIF(o.delivery_address,''), o.dropoff_detail, '')` — แต่ปัจจุบันหน้า admin ไม่ได้ใช้ RPC นี้ (ใช้ table read ตรง) → ได้ประโยชน์น้อยกว่า + ต้องรอ Owner
- **Optional backfill `delivery_address ← dropoff_detail`:** **ยังไม่ทำ** (คำสั่งห้าม + ต้อง Owner ตัดสิน — เป็นการ write ข้อมูล) — ถ้าจะทำ ให้ทำตาม SQL ใน PROPOSED เท่านั้น (เขียนทับเฉพาะแถวค่าว่าง) พร้อม backup

---

## 4. รายงานสุดท้าย

### 4.1 คำตัดสิน (Decisions)

| หัวข้อ | คำตัดสิน |
|---|---|
| **Migration 124 (`order_submit_idempotency`)** | **DEFER** — ผ่านทดสอบ isolated จริง แต่ R1/R2 (PROVEN) + R3 ยังไม่ปิด + ยังไม่ wire เข้า app + R10/R11 ค้าง · ไม่ REJECT (โครงสร้างหลักดี) · **ห้าม apply Production จนกว่าจะปิด R1-R3 + test ครบ + Owner sign-off** |
| **Delivery address** | คง **PROPOSED migration = รอ Owner อนุมัติ** (ยังไม่ apply/backfill ตามคำสั่ง) + **แนะนำ recovery = compat-patch layer (§3.3 ข้อ 1) คู่กับ baseline (ข้อ 2)** + **fix หน้าจอด้วย UI fallback (§3.4) = เสี่ยงน้อยสุด** |
| **owner_key design comment** | **ผิดจริง** (composite ≠ COALESCE ของ 118:49) — แก้ comment ใน proposal เท่านั้น + Owner เลือก policy (ก)/(ข) |
| **Production Ready / เปิดร้าน** | **ห้ามประกาศ** — PRODUCTION-RUNTIME tier ยัง ❌ |

### 4.2 Remaining tests (ที่ต้องทำ — ไม่รันซ้ำที่ผ่านแล้ว)

**ไม่ต้องรันซ้ำ:** T1-T13 + T8b + cleanup + concurrency (ผ่านแล้ว CI #18/#19/#22 + local replica ALL_GREEN×3) — จนกว่าจะแก้ 124 จึงค่อยรันชุดเดิมซ้ำทั้งหมด

**ต้องเพิ่ม/รัน (หลังแก้ R1-R3 หรือเป็น test gaps เดิม):**

| Test | ครอบคลุม | ที่มา |
|---|---|---|
| T14/T15/T16 | duplicate-result shape · fail→no-persist→retry · CHECK guard | §2.2 (ใหม่) |
| T17/T18 | owner_key cross-shape (ตาม policy ที่ Owner เลือก) | §2.5 (ใหม่) |
| R1 normalize test | same key + logical payload เท่ากัน (0 vs 0.0 / 13.7563 vs 13.75630 / items สลับลำดับ) → replay ตาม policy | แฮนออฟ R1 |
| R2 normalize test | `' CK-1'`/`'CK-1'`/`'ck-1'` → map เดียวกัน · key ยาว/charset ผิด → reject | แฮนออฟ R2 |
| R3 policy test | UPDATE order status/payment_status แล้ว replay → ผลตาม policy ที่เลือก | แฮนออฟ R3 |
| R4 | concurrency_124.sh เพิ่ม `SET ROLE authenticated` ทั้งสอง session | แฮนออฟ R4 |
| R5 | concurrent same key + payload ต่างกัน → ชนะ 1 / conflict 1 · orders=1 | แฮนออฟ R5 |
| R6 | concurrent fail-then-win (A payload พัง / B payload ดี) → ไม่มี partial | แฮนออฟ R6 |
| R7 | channel interplay: same key+same extref / same key ต่าง extref / extref เดิม key ใหม่ | แฮนออฟ R7 |
| R8 | service-role path (cref, ไม่มี auth.uid) + key | แฮนออฟ R8 |
| R14 | T3 เติม no-leak assertion (เท่า T4/T10) | แฮนออฟ R14 |

**Ops/Prod (แยก tier):** R10 = read-only prod precheck 18-param (query ในแฮนออฟ — ยังค้างเพราะไม่มี production access รอบนี้) · R11 = staging: `_i` ผ่าน PostgREST + pgbouncer transaction pooling · R9/R12/R13/R15 = มติบันทึก (retention+PII / sha256 / FK ghost replay / concurrency leftovers)

### 4.3 Git/untracked inventory + ข้อเสนอแนะ — ดู §1 (ครบแล้ว: staged 0 · unstaged 0 · untracked 13 จำแนกแล้ว · stash ครบ)

### 4.4 Next action ที่แนะนำ (1 ข้อ)

**Owner ตัดสิน 3 policy ก่อนเริ่ม W5C:** (R1) fingerprint normalize แบบไหน — `trim_scale()`/`round(numeric,6)` หรือเทียบ `jsonb =` · (R2) submit key case policy + cap · (R3) replay payload แบบไหน (ก)/(ข)/(ค) — จากนั้นแชท W5C เริ่มปิด **R1→R2→R3** ใน `124_order_submit_idempotency.sql` (isolated, local_stack_replica.sh loop จน ALL_GREEN) + เติม test T14-T18/R4-R8/R14 → push → CI → รายงาน

### 4.5 สิ่งที่ไม่ได้ทำในรอบนี้ (ยืนยัน)

ไม่แก้ src/ · ไม่แตะ migration history · ไม่ apply PROPOSED/124 ใน Production · ไม่ backfill · ไม่แตะ untracked 13 + stash · ไม่แตะ selfprint · ไม่มี production write ใด ๆ · ไม่ implement correction/tests ที่เสนอ (ตามคำสั่ง "do not implement yet")

---

## ภาคผนวก — หลักฐาน probe A1-A5 (isolated postgres:16, 2026-10-14, ใช้ไฟล์ 118/124 ของจริง)

| Step | ผล (decision table) | สรุป |
|---|---|---|
| A1 | `RAISED: ERR_EMPTY_ORDER` + `order_submissions` 0 rows (`A1-OK-NO-PERSIST`) | failed result **เข้าตารางไม่ได้** ✓ |
| A2 | `A2-OK-REDUCED-SHAPE-PERSISTED` · `RETURNED: {"id":"ord-e1","duplicate":true,"order_number":"BMB-20990101-111",…}` (first + replay เท่ากัน) | reduced duplicate result **persist/replay ได้** (ไม่มี `payment_status`) ✓ |
| A3 | `A3-first(auth+cref)` RETURNED สำเร็จ (owner_key `U1|U1`) · `A3-second(svc+cref)` **`RAISED: ERR_IDEMPOTENCY_CONFLICT`** | false conflict ข้าม shape = **PROVEN** ✓ |
| A4a/A4b | `A4a-OK-DIFFERENT-HASH (fp_same = f)` (0 vs 0.0) · `A4b-OK-DIFFERENT-HASH` (13.7563 vs 13.75630) | md5 fingerprint ไม่เสถียรกับ numeric scale ✓ |
| A4c | `A4c-first(dist=0)` RETURNED · `A4c-second(dist=0.0)` **`RAISED: ERR_IDEMPOTENCY_CONFLICT`** | R1 behavioral บนโค้ด 124 จริง ✓ |
| A5 | ตาราง §2.3 (prosecdef/proconfig/owner/proacl/privileges/RLS) | grants + SECURITY DEFINER + search_path ตรง source ✓ |

Probe ถูกลบทิ้งหลังใช้งาน (temp files + container) — ไม่มีของค้างใน repo (untracked กลับเป็น 13 เดิม)

