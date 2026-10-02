# BMB B-1 FIX REPORT (GATE 1) — รายงานภาษาไทย

วันที่: 2026-10-02 · Gate: 1 (B-1 order_number race) · สถานะรวม: **IMPLEMENTED + RUNTIME VERIFIED (DB จริง)**

## 1. ขอบเขตที่ทำจริง

| ขอบเขต | สถานะ |
|---|---|
| Migration ใหม่ (unique constraint + unique_violation retry) | **IMPLEMENTED** |
| Canonical order-number generation (แก้เฉพาะ section 9 ของ core) | **IMPLEMENTED** |
| Regression tests ใหม่ | **IMPLEMENTED + RUNTIME VERIFIED** |
| แก้ payment / ราคา / delivery fee / capacity / inventory / KDS / state machine / checkout UX | **ไม่ได้แตะเลย** (ตาม boundary) |
| social_events / Facebook / Meta / Auto-Post | **BLOCKED** (ตามคำสั่ง — ห้ามทำ) |

## 2. Root cause (สรุปจาก S0.1 + พิสูจน์เพิ่มในเกตนี้)

- RPC `create_order_with_items_core` สร้างเลขคำสั่งซื้อแบบ **check-then-insert**: สุ่ม `###` (100–999, 900 ตัวเลือก/วัน) → เช็ค `SELECT EXISTS` → INSERT ตรง
- **ไม่มี UNIQUE constraint บน `orders.order_number`** ใน migrations ทั้ง 103 ไฟล์ (grep = 0 match)
- สอง transaction ทำงานพร้อมกันเลือกเลขเดียวกันได้ → ได้ **2 แถว order_number เดียวกัน**
- เทสต์เดิมที่ fail (`canonicalOrderFlow` §18) เป็น **flaky**: รันไฟล์เดี่ยว 2 ครั้ง = ผ่านทั้งคู่, รันชุดเต็ม = fail — mock (`supabaseMock.ts:311`) สะท้อน contract อ่อนเดียวกัน: สุ่มเลข **โดยไม่เช็ค collision** และ state ของ mock สะสมข้ามเทสต์ในไฟล์เดียวกัน (สร้าง order 14 ครั้งในไฟล์)

## 3. สิ่งที่เปลี่ยนจริง (ไฟล์)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `supabase/migrations/104_b1_order_number_uniqueness.sql` (ใหม่) | (1) HARD-STOP pre-check — migration abort ทันทีถ้าพบ duplicate order_number (ห้ามลบ/ห้ามแก้ข้อมูลจริง) (2) `CREATE UNIQUE INDEX uq_orders_order_number` (3) สร้าง `create_order_with_items_core` ใหม่ — body เหมือน 048 ทุกไบต์ **ยกเว้น** section 9: INSERT ครอบ `EXCEPTION WHEN unique_violation` → สุ่มเลขใหม่ retry ≤ 6 → หมดแล้ว raise `ERR_ORDER_NUMBER_EXHAUSTED` (4) DROP core overload เก่า 14-param (อธิบายข้างล่าง) |
| `src/__tests__/helpers/supabaseMock.ts` | mock สร้างเลขแบบ **unique + retry** สะท้อน migration 104 (แก้เฉพาะ generator — ไม่แตะ assertion ใด ๆ) |
| `src/__tests__/orderNumberUniqueness.test.ts` (ใหม่) | regression tests: single create / N=8 concurrent / collision กับเลขที่มีอยู่แล้ว |
| เทสต์เดิมทุกไฟล์ | **ไม่แตะเลย** — §18 ผ่านเองเพราะ mock ถูกแก้ให้ตรง contract |

**เหตุผลที่ต้อง DROP core overload เก่า:** DB มี core 2 overload — อันใหม่ (15-param จาก 048) และ **อันเก่า (14-param จาก 044) ที่ grant EXECUTE ไว้และยังมี TOCTOU** — ถ้าไม่ลบ ผู้เรียกที่ authenticated ยังเรียก path เก่าได้ ตรวจแล้วไม่มีโค้ดใด (src/, supabase/functions/) เรียก core ตรง (grep = 0) จึงลบได้ปลอดภัย สอดคล้องนโยบาย single-signature ของ 048

## 4. Runtime verification บน DB จริง (`supabase db query --linked`)

| ขั้น | ผลลัพธ์ | สถานะ |
|---|---|---|
| Pre-check duplicate | `dup_groups = 0` | **RUNTIME VERIFIED** — ไม่มี duplicate, HARD STOP ไม่ทำงาน |
| Apply migration 104 | exit 0 (idempotent, รันซ้ำได้) | **DEPLOYED** |
| Index ถูกสร้าง | probe `pg_indexes` → `uq_orders_order_number` มีจริง | **RUNTIME VERIFIED** |
| Core ใหม่ | `core_overloads=1 with_retry=1` (probe `pg_proc`) | **RUNTIME VERIFIED** — เหลือ overload เดียว มี retry loop, ไม่มี EXISTS เก่า |
| การรับประกันใหม่ | 1 order = 1 row = 1 unique order_number บังคับโดย database | **RUNTIME VERIFIED (DB-level)** |

หมายเหตุ: อักขระแปลกใน terminal เกิดจาก encoding ของ PowerShell กับ box-drawing ของ CLI — เป็นปัญหาการแสดงผลเท่านั้น ไม่ใช่ปัญหาใน repo/DB (query สำคัญใช้ผลลัพธ์ข้อความธรรมดายืนยันแล้ว)
## 5. Test gate (รันจริง ไม่แก้เทสตเดิม)

| คำสั่ง | ผล |
|---|---|
| npm test (รัน 2 ครั้งหลังแก้) | 361 passed (361) / 40 files passed (40) - exit 0 ทั้งสองครั้ง (ก่อนแก้: 1 failed / 357 passed, flaky ~10% ต่อรัน) |
| npm run lint | PASS (exit 0) |
| npm run build (tsc + vite) | PASS (exit 0) |
| npm run typecheck | ไม่มี script แยก - typecheck รวมอย่ใน npm run build (tsc ก่อน vite build) |
| section 18 payment retry (เทสตเดิม) | ผ่าน - ไม่ได้แก้ assertion ใด ๆ |

ข้อจำกัดที่รายงานตรงไปตรงมา: เทสตทั้งหมดรันบน in-memory mock ไม่ใช่ DB จริง - พติกรรม concurrency จริงของ DB ถกการันตีดย unique index ที่ probe ยืนยันแล้วบน DB (database เปน authority) ไม่ใช่ดยเทสต mock

## 6. สิ่งที่ยังเปนข้อจำกัด / DEFERRED

| รายการ | สถานะ |
|---|---|
| Format เลขใน mock (BMB-TEST-###) ต่างจาก production (BMB-YYYYMMDD-###) | DEFERRED - แก้ต้องแตะ assertion เดิมใน api.test.ts:129 ึ่งอย่นอก boundary ที่อนุมัติ (ความ unique คือหัวใจของ B-1 และถก fix แล้ว) |
| Migration 104 ยังไม่ถกบันทึกใน supabase_migrations history ของ CLI (apply ผ่าน db query เพราะชื่อไฟลไม่ใช่รปแบบ timestamp) | DEFERRED - ถ้าต้องการ track history ให้ rename เปน 20261002XXXXXX_b1_order_number_uniqueness.sql แล้ว supabase migration repair / db push (ต้องการเกตถัดไป) |
| การันตี long-term ภายใต้หลดจริง (ผ้ใช้จริงพร้อมกันหลายพัน) | DEFERRED - index เปน authority แล้ว แต่ load test จริงไม่ได้ทำในเกตนี้ |

## 7. Git state (รายงานตาม GIT GATE - ไม่ commit / ไม่ push)

| รายการ | ค่า |
|---|---|
| HEAD | 76176bed71f2254717925787975e76f64fd1bcef (ยังไม่ commit อะไร) |
| origin/main | 76176bed71f2254717925787975e76f64fd1bcef |
| WORKTREE | HAS UNTRACKED FILES - ไฟลใหม่: supabase/migrations/104_b1_order_number_uniqueness.sql, src/__tests__/orderNumberUniqueness.test.ts, BMB_B1_FIX_REPORT.md + แก้ 1 ไฟล: src/__tests__/helpers/supabaseMock.ts + ไฟล audit เดิม 2 ไฟล (BMB_SOCIAL_AI_*.md); rls_check.txt ยังไม่ถก commit (D-10) |

## 8. ข้อห้ามที่ยังคงมีผล

ยังไม่ได้ทำ: social_events migration / Facebook auto-reply / Messenger reply / Meta Send API / Auto-Post / AI order extraction / AI สร้าง order / Meta production configuration - BLOCKED ทั้งหมดจนกว่า Gate 2 จะผ่าน runtime verification และ Owner อนุมัติ

---

GATE 1 สรุป: IMPLEMENTED + RUNTIME VERIFIED - พร้อมให้ Owner ทบทวนก่อนเข้า Gate 2
