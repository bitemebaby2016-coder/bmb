# W-1 — Fresh replay เทียบ production (2026-10-26) · รายงานหลักฐาน

> **สั่ง/อนุมัติ:** Owner 2026-10-26 (handoff `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md` §W-1)
> **สถานะ:** รันแล้ว · **มี evidence ทุกขั้น** · ผล = **schema parity VERIFIED + drift 5 กลุ่ม มีคำอธิบาย/แผนครบ**
> (ไม่ใช่ "zero drift" — ทุกจุดด้านล่างมีสาเหตุและแผน ห้ามสรุปเกินหลักฐาน)

## 1. Fresh replay 001→156 (container สะอาด)

| รายการ | ค่า |
|---|---|
| container | `bmb_replay_w1` · `postgres:17` · DB `bmb_replay` (สร้างใหม่ทั้งหมด ไม่ reuse ของเก่า) |
| ขั้นตอน | prelude `e2e/ci/00_prelude_supabase_stubs.sql` → ledger แบบ Supabase → apply **001..156 ตามลำดับตัวเลข** |
| preprocessor + shims | port **verbatim** จาก `.github/workflows/contract-tests.yml` (แก้เฉพาะ temp copy — ไฟล์ history ไม่ถูกแตะ) |
| ผล | **`REPLAY_ALL_GREEN 156/156`** · `OK=156 FAIL=0` |
| evidence | `e2e/w1-replay-apply-2026-10-26.log` (ผลรันจริงทุกไฟล์) · `e2e/w1-replay-apply-2026-10-26.jsonl` (ผลรายไฟล์) |
| ตัวเรียก | `e2e/ci/w1_fresh_replay.sh` + `e2e/ci/w1_run_setup.bat` |

## 2. Snapshot schema ทั้งสองฝั่ง (READ-ONLY)

- production = Supabase Management API `POST /v1/projects/ivkdfognyiwjcmrhcnwz/database/query` (**SELECT เท่านั้น** — ไม่มี INSERT/UPDATE/DDL)
- evidence: `e2e/w1-prod-snapshot-2026-10-26.json` · `e2e/w1-local-snapshot-2026-10-26.json` · `e2e/w1-probe-2026-10-26.json`
- ขอบเขต = schema `public` (auth/storage/realtime = Supabase-managed + prelude stubs → เทียบไม่ได้)
- คำนวณ: `e2e/w1SchemaQueries.cjs` (ชุด query เดียวกันทั้งสองฝั่ง) · `e2e/w1Snapshot.cjs` · `e2e/w1Parity.cjs`

**Normalisation (ความต่างเชิงรูปแบบเท่านั้น — ระบุไว้ใน parity JSON):**
1. `policies.roles` — API คืน `{'a','b'}` แต่ psql/json_agg คืน array
2. `ledger.name` — production = `initial_schema` · replay = `001_initial_schema` → เทียบ `version`
3. function body — production เก็บ CRLF + ช่องว่างขอบไฟล์ → เทียบ `body_md5_norm` (ตัด `\r` / ช่องว่างท้ายบรรทัด / ขอบบน-ล่าง)
4. `meta` = ข้อมูล environment ไม่นับเป็น drift

## 3. ผลเทียบ (`e2e/w1-parity-2026-10-26.json`)

**MATCH (9/14):** `tables` 67 · `columns` 765 · `indexes` 202 · `constraints` 242 · `sequences` 0 · `triggers` 35 · `views` 2 · **`ledger` 156 = 156 ทุก version** · นโยบายที่มีร่วมกัน = `qual/cmd` ต่างกัน **0 จุด**

**DRIFT (5) — ทุกจุดมีคำอธิบาย + แผน:**

| # | จุด | ข้อเท็จจริง (หลักฐาน) | ทิศทาง/ความเสี่ยง | แผน |
|---|---|---|---|---|
| D1 | `rls` — 2 ตาราง | `admin_portfolio_items`, `products_branch_overrides`: production `relrowsecurity=true` · replay `false` — **ไม่มี migration 092/094 คำสั่ง `ENABLE ROW LEVEL SECURITY`** (ตรวจไฟล์แล้ว มีแค่ CREATE POLICY) | production เคร่งกว่า · **fresh install = policy ตาย (ไม่บังคับ)** | เสนอ migration 157 เปิด RLS ทั้ง 2 ตาราง → **รอ Owner อนุมัติ (production write)** |
| D2 | `policies` — 6 แถว | replay มีมากกว่า 5: `_mg_adm`@addon_groups/addons/product_addon_groups (สร้างใน 067 แบบ `DO $$_ … EXCEPTION WHEN undefined_function`) + `audit_logs_anon_deny`, `audit_logs_service_write` · production มีมากกว่า 1: `profiles\|Users can view own profile` (เทมเพลต Supabase ยุค manual) | นโยบายชุดcommon ตรงกันหมด · ฝั่งที่ต่าง = policy แอดมิน/audit (ทั้งคู่ gate ด้วย `is_admin()`/deny) | บันทึกเป็น known drift · เสนอ migration ปรับให้ตรง (Owner อนุมัติก่อน apply) |
| D3 | `functions` — 25 แถว | · **มีใน replay 11**: `uuid_*` 10 ตัว (extension ลง `public` ที่ replay vs `extensions` ที่ production — probe ยืนยัน) + `get_all_orders_for_admin` (035 สร้าง · production ไม่มี · **ไม่มี src caller** — 037 บันทึก `grep src/ = 0`)<br>· **มีใน production 6**: `auto_approve_order`, `calculate_loyalty_points`, `check_product_availability`, `mark_payment_failed`, `update_order_status`, `validate_order_before_submit` (manual-era · **ไม่มี src caller ทั้ง 6** — grep ตรง ๆ = 0)<br>· **body ต่าง 4 ตัว** = `assign_driver`, `claim_dispatch_offer`, `dispatch_order`, `haversine_km` → **ตรวจแล้วเป็น comment ล้วน** (production เก็บไทยเป็น `?` 3 ตัว · `haversine_km` ขาด comment `FIX (42883)` ที่ repo มี) — **โค้ดที่รัน identical ทั้ง 4** | ไม่กระทบ runtime (ไม่มี caller + code เดียวกัน) | (ก) fresh install จะมี `get_all_orders_for_admin`/`uuid_*` ต่างจาก production → เสนอให้ align หรือบันทึกเป็น known (ข) legacy 6 ตัว = เสนอ cleanup migration **รอ Owner เลือก** |
| D4 | `acl_tables` — 157 แถว (production มากกว่าทั้งหมด) | production มี `GRANT ALL` (7 privileges) ให้ `authenticated` บน **31 ตาราง** ที่ replay ไม่มี · กลไก = **`pg_default_acl` ของ Supabase ใน production** (`GRANT ALL ON TABLES/SEQUENCES/FUNCTIONS TO anon, authenticated, service_role` — probe ยืนยัน) ส่วน fresh DB ไม่มี default ACL → ได้เฉพาะที่ migration สั่ง | production **กว้างกว่า** · การเข้าถึงข้อมูลจริงยังถูก RLS (policy ตรงกัน) · **fresh install เสี่ยง `permission denied` ตอนแอดมิน/ลูกค้าเขียนตารางเหล่านี้** | เสนอ migration align grants (Owner อนุมัติก่อน apply) |
| D5 | `acl_functions` — 219 แถว | `svc_exec` ต่าง 100 ฟังก์ชัน · `auth_exec` ต่าง 8 — กลไกเดียวกับ D4 (`pg_default_acl` ให้ EXECUTE ตอนสร้าง) | production กว้างกว่า · ไม่ใช่ช่องโหว่ใหม่ (RLS/REVOKE ฝั่ง migration ยังทำงาน) | รวมกับ D4 ใน migration align เดียว |

> สรุปตามกติกา: **ไม่มี drift ที่ไร้คำอธิบาย** · ทุกจุดมีหลักฐานชี้ (ไฟล์ migration / probe / ผลรัน) และมีแผน
> → เกณฑ์ปิด W-1 (§4/§5 = VERIFIED + evidence path + วันที่) **ผ่าน** — แต่ **ยังเหลืองาน Owner 3 ข้อ** คือการอนุมัติ
> migration ตามแผน D1/D2/D4 (production write) และทางเลือกใน D3