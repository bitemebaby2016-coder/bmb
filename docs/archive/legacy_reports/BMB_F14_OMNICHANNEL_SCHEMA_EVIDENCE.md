# BMB_F14_OMNICHANNEL_SCHEMA_EVIDENCE.md
**F-14 RESOLUTION — source_channel / external_ref_id / duplicate guard · วันที่: 2026-09-27**
ภาษาไทยเป็นหลัก · TEST DATA ONLY

## 1. Owner Authorization
- Owner command "BMB — OWNER AUTHORIZATION / RESOLVE F-14 + OMNICHANNEL FOUNDATION" (2026-09-27):
  อนุมัติ F-14 implementation (source_channel / external_ref_id / durable duplicate guard /
  additive RPC / ไม่ backfill อัตโนมัติ / identity mapping = DESIGN FIRST — ห้ามสร้าง table) ·
  flow: AUDIT→DESIGN→IMPACT→IMPLEMENT→TEST→PRODUCTION TEST→EVIDENCE→GATE→COMMIT→PUSH→HARD STOP

## 2. Production Baseline
- HEAD = `56d4e0f` (W3-C) · W3-C CORE = PASS · production migrations ล่าสุด = 042 →
  migration ถัดไป = **043** (ไม่เดา — จาก supabase/migrations + supabase db push log จริง)

## 3. Existing Schema (จาก production จริง)
- `orders`: id/order_number UNIQUE/customer_id/customer_ref(auth.users)/status(order_status)/
  order_mode/scheduled_date/delivery_round_id/... · **ไม่มี source_channel/external_ref_id** (ก่อนงานนี้)
- `create_order_with_items` = 14-param SECURITY DEFINER (body verbatim จาก 025; business authority:
  price/promo/capacity/mode gate/cutoff/fee/state อยู่ใน RPC นี้ทั้งหมด)
- identity: auth.users + customers + orders.customer_ref · ไม่มี external identity mapping

## 4. F-14 Requirement (จาก W3-C audit — อนุมัติแล้ว)
- source_channel (canonical intake channel) · external_ref_id (nullable external event identity) ·
  durable duplicate guard · additive RPC contract · historical = NULL (ไม่เดา)

## 5. source_channel Design
- **TEXT NULLABLE — ไม่มี enum/constraint** ที่ block future channels
- รูปแบบ validate ที่ RPC: `^[A-Z][A-Z0-9_]{2,31}$` (ERR_INVALID_SOURCE_CHANNEL) —
  PWA / FACEBOOK / FACEBOOK_GROUP / MESSENGER / MANUAL / LINE / TIKTOK / GOOGLE / QR / DIRECT
  ใช้ได้ทันทีโดยไม่แก้ schema
- Trigger `orders_stamp_source_channel` (BEFORE INSERT): legacy-path insert ที่ไม่ระบุ channel →
  stamp `MANUAL` ถ้า actor เป็น admin, `PWA` ถ้าไม่ใช่ — new orders ไม่มีวันเหมือน historical NULL

## 6. external_ref_id Design
- TEXT NULLABLE (≤128 chars, trim) — external event identity เท่านั้น · **ไม่แทน canonical order_id**
  (order_id/order_number ยังเป็น canonical PK ตามเดิม)

## 7. Unique Constraint
- `uq_orders_channel_extref` = UNIQUE (source_channel, external_ref_id)
  WHERE external_ref_id IS NOT NULL
- same channel + same ref = same logical intake · cross-channel = no collision (ref เดียวกัน
  ต่าง channel เป็น order ต่างกัน) · NULL ref ไม่เข้ากติกา guard

## 8. RPC Contract (additive + backward compatible)
- **บทเรียนจริงจาก implementation:** 043 ทำ overload (14+16 param) → PostgREST **42725 ambiguous**
  กับ caller 14-arg เดิม (พังจริงบน production) → **044 แก้เป็น single signature**:
  - body canonical ย้าย verbatim ไป `create_order_with_items_core` (business authority เดิม 100%)
  - DROP ทั้งสอง overload เก่า → เหลือ signature เดียว 16-param (`create_order_with_items`)
  - legacy 14-arg callers ทำงานเหมือนเดิม (default params) · channel params = optional

## 9. Backward Compatibility
- PWA/MANUAL existing callers: PASS (probe จริงหลัง 044/045) · dist production (84fbd75)
  เรียก 14-arg → ผ่าน (default fill) · ไม่มี signature ที่ต้องแก้ client

## 10. Backfill Decision (Owner)
- **ไม่ backfill** — historical orders: source_channel = NULL, external_ref_id = NULL
- column ไม่มี DEFAULT → historical semantics ไม่เปลี่ยน · แยก historical จาก new ด้วย NULL vs
  stamped · ไม่มีการเดา channel ย้อนหลัง

## 11. Duplicate Protection
- Pre-check + unique partial index + recover-existing path (duplicate:true + order_number เดิม)
- runtime พิสูจน์: retry same ref → SAME order (BMB-…-507), rows=1 · concurrent (parallel
  Promise.all) → 1 order (dup1=true/dup2=false, rows=1, BMB-…-511)
- **bug จริงที่จับได้ + แก้ (045):** wrapper UPDATE ทำ source_channel=NULL ทับ stamp ของ trigger
  บน legacy call → fix: tag เฉพาะเมื่อ channel/ref ถูกระบุ

## 12. Concurrency
- unique index = DB-level guard (ไม่ใช่ in-memory) · race → unique_violation → recover existing ·
  พิสูจน์จริงด้วย parallel calls (ข้อ 11)

## 13. Identity Mapping Audit (production + repo จริง)
- existing: auth.users (Supabase Auth email/password) · customers table · orders.customer_ref →
  auth.users (FK) · customer_name/phone เป็น contact fields (ไม่ใช่ identity authority) ·
  driver identity = JWT-bound (041) · **ไม่มี** FB/Messenger/LINE identity mapping ใด ๆ

## 14. Identity Mapping Design (DESIGN ONLY — ห้ามสร้าง table)
```
CHANNEL (FACEBOOK/MESSENGER/…)
   ↓ external_user_id (fb_id / messenger_psid)
CUSTOMER_CHANNEL_IDENTITIES (proposed — ยังไม่สร้าง)
   ↓ canonical customer (customers / auth.users link)
CANONICAL ORDER (orders.customer_ref / customer_ref)
```
**IDENTITY SCHEMA = REQUIRED** (เมื่อ Owner จะเปิด external channel จริง) — แบบร่าง:
- TABLE: customer_channel_identities
- COLUMN: id (uuid pk), channel (text, validated pattern), external_user_id (text),
  customer_ref (uuid FK auth.users), display_name (text), created_at/updated_at
- PK: id · FK: customer_ref → auth.users(id) · UNIQUE: (channel, external_user_id) —
  durable collision guard ต่อ identity · INDEX: (customer_ref)
- RLS: deny-by-default, admin read, ไม่มี client write (สร้างเฉพาะผ่าน ingestion RPC +
  webhook verification) · GRANTS: ไม่ grant write ให้ client; service_role/definer only
- SECURITY: external_user_id เป็น PII — ไม่ log; ต้องมี webhook signature boundary ก่อนใช้;
  privacy: เก็บเฉพาะ platform id ที่จำเป็น
- MIGRATION: additive 1 ไฟล์ · BACKFILL: ไม่มี (empty ตอนเริ่ม) · DELETION/UNLINK: admin RPC
  unlink (soft: delete row) + ห้าม cascade ลบ customer · COLLISION: unique index + merge flow
  (รอ Owner) · TEST PLAN: duplicate identity / timeout retry / unauth insert / RLS matrix
→ **STOP — รอ Owner authorization เพิ่ม ก่อนสร้าง migration นี้**

## 15. RLS
- orders RLS ไม่ถูกแตะ · direct insert ยังถูก deny (runtime 403/401 หลัง migration) ·
- new trigger function = SECURITY DEFINER (แก้เฉพาะ NEW.source_channel) · ไม่มี policy ใหม่

## 16. Grants
- core + wrapper + trigger function = EXECUTE to authenticated (ตรง pattern RPC เดิม) ·
  anon เรียกไม่ได้ — runtime: ERR_NOT_AUTHENTICATED (400) ✓

## 17. Security
- ไม่มี expose: service_role/JWT/keys/secrets (scan CLEAN) · external payload ไม่ใช่ source of
  truth (validate ใน RPC) · replay protection = duplicate guard ต่อ event · identity ยังไม่มี
  external inbound (ไม่มี webhook secret ใหม่ในงานนี้)

## 18. Migration
- **043** f14_channel_intake: columns + unique index + stamp trigger + overload (→ พบ ambiguity)
- **044** f14_single_signature: core แยก + single 16-param signature (แก้ 42725)
- **045** f14_stamp_fix: ไม่ overwrite trigger stamp บน legacy call
- ทุก migration: additive, reversible (DROP FUNCTION/TRIGGER/INDEX/COLUMN), ไม่แตะ historical data

## 19. Production Apply
- `npx supabase db push` — 043, 044, 045 applied (log: "Applying migration 043... 044... 045...
  Finished supabase db push") · ไม่มี SQL error

## 20. Production E2E — `e2e/f14-channel-intake-e2e.json` · TEST DATA ONLY · **PASS 16/16**
| ตรวจ | ผล |
|---|---|
| legacy PWA intake (14-arg) → order + stamp PWA / ext_ref NULL | PASS |
| legacy MANUAL intake (admin 14-arg) → stamp MANUAL | PASS |
| FACEBOOK schema intake (16-param, canonical contract) | PASS |
| FACEBOOK_GROUP + MESSENGER schema intake | PASS |
| same ref retry → SAME order, rows=1 | PASS |
| same ref cross-channel → 2 orders (no collision) | PASS |
| NULL external_ref_id → no guard (legacy semantics) | PASS |
| invalid source_channel → ERR_INVALID_SOURCE_CHANNEL | PASS |
| anon RPC → ERR_NOT_AUTHENTICATED | PASS |
| direct DB insert → 403 RLS | PASS |
| concurrent duplicate (parallel) → ONE order | PASS |
| order_status_history regression (trigger ยังทำงาน) | PASS |

## 21. Regression (ทั้งหมดหลัง migration บน production)
- W3-C intake probe **12/12** ✓ · W3-B automation **13/13** ✓ · W3-A AI gateway **11/11** ✓ ·
  Order History / Driver Identity / RLS / AI Gateway / Native Automation = ยัง PASS ·
- vitest: พบ flaky test จาก `src/.kilo/worktrees/*` (stale duplicate copies — ไม่ใช่ canonical
  suite) → fix: vitest exclude `src/.kilo/**` → **22 files / 179 tests ผ่านทั้งหมด** (44→22 เพราะ
  ก่อนหน้านี้นับ duplicate 2 ชุด — ไม่มี test canonical หาย) · tsc 0 · build ✓ · lint 0 ·
  git/dist secret scan CLEAN

## 22. GAP
1. Identity mapping table = REQUIRED, ยังไม่สร้าง (รอ Owner authorization — ข้อ 14)
2. Facebook/Messenger/LINE production webhook integration = ยังห้าม (รอ identity + webhook verify)
3. PRE-ORDER RPC (`create_pre_order_with_items`) ยังไม่มี channel params — ทำเฉพาะ
   create_order_with_items ตาม scope; ต่อยอดได้ด้วย pattern เดียวกันเมื่อต้องใช้
4. Backfill เพิ่มเติมเฉพาะแถวที่มี evidence — ไม่ทำ (ตาม Owner)

## 23. READY
- source_channel / external_ref_id / unique guard / RPC single signature = READY (runtime-verified)
- Future channels ขยายได้ทันที (ส่ง p_source_channel='LINE' ฯลฯ โดยไม่แก้ schema)

## 24. BLOCKED
- customer_channel_identities migration — รอ Owner authorization (แบบร่างครบในข้อ 14)
- External channel production integration — รอ identity architecture + webhook verification

## 25. Final Gate (แยก verdict)
```
F-14 schema         = PASS
source_channel      = PASS
external_ref_id     = PASS
duplicate guard     = PASS
RPC compatibility   = PASS (044 + 045 runtime-verified)
identity audit      = PASS (audit เสร็จ — model ปัจจุบันชัดเจน)
identity schema     = BLOCKED (REQUIRED — รอ Owner authorization, design ครบใน §14)
security            = PASS
production E2E      = PASS (16/16)
regression          = PASS (W3-A 11/11 · W3-B 13/13 · W3-C 12/12 · vitest 179 · history/RLS ✓)
quality gate        = PASS
```
→ **F-14 CORE = PASS · IDENTITY SCHEMA = BLOCKED (awaiting Owner)** — ห้ามสรุป aggregate PASS