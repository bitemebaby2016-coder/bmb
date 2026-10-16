# BMB HANDOFF — NEXT SESSION (2026-10-16, ปิดรอบ Closure Execution)
## อ่านไฟล์นี้ก่อนทำงานทุกครั้ง → re-verify สถานะ → พร้อมรับคำสั่ง

> สร้าง 2026-10-16 · repo `D:\A PROJECT\Bite Me Baby` · branch `main`
> แชทก่อนหน้าปิดงานตาม `docs/BMB_CLOSURE_EXECUTION_REPORT_2026-10-16.md` (อ่านสรุปทั้งหมดที่นั่น) · baseline = `docs/BMB_CONSOLIDATED_CLOSURE_GAP_AUDIT_2026-10-15.md`
> **งานหลักของแชทใหม่ = wire `_i` เข้าแอป + หนุน Owner acceptance test (1 ออเดอร์ ≤300 บาท) + เก็บงานต่อตาม §2**

---

## 1. สถานะ ณ แฮนออฟ (ห้ามเชื่อลอย ๆ — ตรวจซ้ำก่อนเริ่ม)

| รายการ | ค่า | วิธีตรวจซ้ำ |
|---|---|---|
| Git HEAD == origin/main | `5430098` (docs) — ก่อนหน้า `c3fbf28` (โค้ด fix) | `git rev-parse HEAD origin/main` · `git status` |
| Worktree | สะอาด · stash `local-edits-before-sync-2026-09-21` ครบ (ห้ามแตะ) | `git stash list` |
| Deployed | `biteme-baby.com` = `index-Cpdq7RVC.js` (โค้ด c3fbf28 — `dropoff_detail` อยู่ใน chunk `bmbAdminApi_orders-D2DTTjUB.js`) | ดึง HTML → asset hash + grep marker |
| Migration ledger | **123/124/125 ตรงกัน Local+Remote — ไม่มี drift** | `supabase migration list` (ตั้ง `$env:SUPABASE_ACCESS_TOKEN` จาก `.env.local` ก่อน) |
| order_submissions (124) | มีแล้ว · PK + CHECK `os_result_has_order` · RLS on 0-policy · grants=postgres | Management API SELECT |
| menu_schedule | **4 แถว published**: 19 ต.ค. (เต้าหู้ย่างผักสามสี, สเต็กปลาดอลลี่) + 20 ต.ค. (กุ้งบ้อคโคลี่, สเต๊กเต้าหู้) · แถว 16 ต.ค. unpublished (เจตนา — pre-order ห้ามวันนี้) | anon REST `is_published=eq.true` |
| delivery_rounds | 54 รอบ · **past_active=0** (อดีต 45 = `closed`) · active 9 = 16/19/20 ต.ค. × morning(cutoff 23:59)/midday(10:30)/evening(16:00) | SELECT |
| ข้อมูลทดสอบ | `Test description` 2 รายการล้างแล้ว (audit `alog-…-2b9b01/89250d`) · เหลือ 3 กลุ่มรอ Owner (§2C) | anon scan |
| Orders | 206 (cancelled 205 + delivered 1 = `PO-20260929-131`) · assignments 10 · ไม่มี active | SELECT |
| หลักฐาน | `backups/*2026-10-16*` (pre-124 snapshot 74.8KB, ops logs, smoke logs) | — |

## 2. งานต่อไป — เรียงลำดับความสำคัญ

### 🔴 A. Wire `_i` + client submit key เข้าแอป (งานแรกสุด — กันออเดอร์ซ้ำ)
- **สถานะ:** 124 อยู่ใน prod แล้ว แต่ `m1Submit.ts`/`createOrder` ยังเรียก `create_order_with_items` (18-arg เดิม) ไม่ส่ง `p_client_submit_key` → **double-submit protection ยังไม่ active**
- **ทำ:** ① ส่ง `p_client_submit_key` จาก checkout (policy R2: btrim + ≤128 + ไม่มี control chars — เช่น `CK-`+uuid ต่อ 1 การ submit, reuse เมื่อ retry payload เดิม) ② เรียก `create_order_with_items_i` (19-arg) — key=NULL ยังเป็น legacy path ③ จัดการ `ERR_IDEMPOTENCY_CONFLICT/KEY_INVALID/BAD_RESULT` ใน UI ④ tests (unit + canonicalOrderFlow) ⑤ tsc/lint/test/build → commit/push → ตรวจ deploy marker ⑥ ทดสอบ double-submit ใน acceptance
- **อ้างอิง:** `supabase/migrations/124_order_submit_idempotency.sql` · `e2e/contracts_124_idempotency.sql` (T1-T18) · R1 trim_scale fingerprint · R3 replay คืนสถานะปัจจุบัน + `replay:true`

### 🟠 B. หนุน Owner acceptance test (1 ออเดอร์ ≤300 บาท)
- Checklist เต็ม = รายงานปิดงาน §12 · **เก็บหลักฐานเพิ่มตอนออเดอร์ถึง `ready_for_dispatch`:** บรรทัด `📍` บนบัตร dispatch ต้องแสดง `dropoff_detail` จริง (ไม่ใช่ `—`) = runtime proof ของ fix ที่อยู่
- เงิน = PromptPay QR/โอน · แอดมินยืนยันด้วยยอดเงินเข้าจริง (ไม่ใช่สลิป) — คู่มือ บ.8
- วันทดสอบ: 19/20 ต.ค. (pre-order) หรือวันนี้ (same-day ก่อน 23:59)

### 🟡 C. คิวคำตัดสิน Owner (รวบรวมถามทีเดียว)
1. เมนู 3 กลุ่ม: `coming soon` ×2 (฿1, "new products") · `prod-1` ผัดไทยกุ้งสด (descr ไม่ตรงเมนู) · `prod-w3c-test-pre` (test แต่ is_available=false — เสนอลบ/เก็บถาวร)
2. Dead queue 13 (`sched-notification_dispatch-gh-dispatch-20261005t*`) — retry (เสี่ยงข้อความซ้ำ) หรือ archive · export แล้วใน backups
3. R9 retention `order_submissions` (เสนอ TTL 90 วัน) · R12 sha256 · R13/R15 มติ
4. `PROPOSED_wave5_orders_delivery_address.sql` — apply (ต้องแก้ comment ข้อ 10 ที่ผิด: prod ไม่มีคอลัมน์นี้) หรือคง UI fallback
5. Platform daily backups ว่าง (WAL-G only) → เสนอเปิด PITR/scheduled backup
6. Stash `local-edits-before-sync-2026-09-21` — กู้/ทิ้ง · RC-5 deploy SHA binding
7. แถว menu_schedule 16 ต.ค. 2 แถว — ปล่อย/ลบ

### 🔵 D. ระยะถัดไป (ก่อนเปิดร้าน)
- Payment live cutover (Stripe: มีชื่อคีย์ live ใน `.env.local` แต่ไม่ยืนยันค่า — ห้ามสมมติว่าพร้อม) · THSMS verify 1 ข้อความ · push device registration · Meta real events
- Staging + R11 (`_i` ผ่าน PostgREST/pgbouncer) · Visual QA ป้าย+มือถือรอบมีป้ายจริง · retire `v1.txt`/`v2.txt` ที่เผลอ track

## 3. กติกาเหล็ก + ข้อควรระวัง (carry-forward)

- **โปรเจคอยู่ที่ `D:\A PROJECT\Bite Me Baby`** — ห้ามใช้ `chat\bmb\` (เก่า) · ห้ามแตะ containers `*_selfprint-v3-react`
- Git: stage exact paths · ห้าม `git add -A`/force-push/reset --hard · ห้ามแตะ `.env*`/secrets/stash/backups · ไม่ push ถ้ามีไฟล์ไม่เกี่ยวปน
- **ช่องทางเขียน production (อนุมัติแล้ว):** PostgREST + Dedicated Test Admin (`supabase/secrets.local.env` = `BMB_TEST_ADMIN_*`) เทียบเท่าฟังก์ชันแอป · RPC ทางการ: `publish_menu_schedule` · `ensure_rounds_for_date` · `append_audit_log` · `set_menu_schedule` · **ห้ามใช้ service_role key** · Management API `database/query` = SELECT/GET เป็นหลัก · ทุกการเขียนต้องมี before/after + audit trail
- **Supabase CLI:** linked แล้ว (ref `ivkdfognyiwjcmrhcnwz`) — ตั้ง `$env:SUPABASE_ACCESS_TOKEN` จาก `.env.local` ก่อนใช้ · `db push` ถาม `[Y/n]` interactive → รันผ่านไฟล์ `.cmd` ที่มี `< NUL` (EOF = default Y) · ใช้ `--skip-vault` เสมอ · `--dry-run` preview ก่อน · `migration repair --status applied --linked <ver>` = กลไก ledger ทางการ (ห้าม insert ledger เอง)
- **PowerShell hazards:** คำสั่งยาวทำ PSReadLine crash — แยกสั้น ๆ · `*>` ได้ไฟล์ UTF-16 (อ่านด้วย `-Encoding Unicode`) · สคริปต์ใช้ `.cjs` (package `"type":"module"`) · ไฟล์ bash ก่อนเข้า container ต้อง `node e2e/ci/normalize_lf.cjs <file>` · `docker exec -d` กับ harness ต้องรอ `pg_isready` ก่อน (ไม่งั้น PRELUDE_FAIL)
- **Local harness:** `e2e/ci/local_stack_replica.sh` (container `bmb-pg`, ephemeral postgres:16 — วิธีใช้ใน header) = pre-push loop
- ห้ามประกาศ "Production Ready / เปิดร้าน" จน PRODUCTION-RUNTIME tier ครบ + Owner สั่ง

## 4. แผนข้อมูล/กติกาสำคัญที่เจอ (map เร่ง)

| ความจริง | ที่มา |
|---|---|
| `orders` **ไม่มี `delivery_address`** — ที่อยู่จริง = `dropoff_detail` · fallback ใช้ `src/lib/orderAddress.ts` (deploy แล้ว) | probe 10-15/16 |
| PRE_ORDER ต้อง `scheduled_date > today` (`ERR_SCHEDULED_DATE_INVALID`, 118:138) + lead ≥ `pre_order_lead_days` | 118:136-141 |
| SAME_DAY ต้องรอบ `scheduled_date == today` + ก่อน cutoff (`ERR_CUTOFF_PASSED`) | 118:132-135 |
| `delivery_rounds` มี `date`+`scheduled_date` — RPC อ่าน `scheduled_date` · status CHECK = active/closed/cancelled/open/full/scheduled · แอปใช้ active↔closed | schema + `bmbAdminApi_rounds.ts` |
| Publish ต้อง **2 รายการ/วัน** + สินค้า PRE_ORDER ใช้ได้ (enforcement 123) · publish ทั้งวันใน RPC เดียว | `123_menu_publish_enforcement.sql` |
| `create_order_with_items_i` (19-arg) อยู่ใน prod · key=NULL = legacy · owner_key = composite `auth.uid()\|p_customer_ref` (T17/T18 pin) | 124 source |
| `products` มี `available_same_day`/`available_preorder` แยกโหมด | 118:150 |
| `PO-20260929-131` (delivered, dropoff "QA TEST ADDRESS (W5-2)…") = ตัวอย่างตรวจ /track | smoke |
| `notification_dispatch` = scheduled batch (ไม่ใช่ข้อความรายคน) · dispatch ซ้ำ = เสี่ยงข้อความซ้ำ | probe 10-16 |

## 5. เริ่มงานแชทใหม่ (ลำดับแนะนำ)

1. อ่านไฟล์นี้ + `docs/BMB_CLOSURE_EXECUTION_REPORT_2026-10-16.md`
2. Re-verify: `git status` / HEAD=origin / deployed asset hash / `supabase migration list` / counts สั้น ๆ
3. รับคำสั่ง Owner → ถ้าไม่ระบุ = เริ่มงาน A (wire `_i`) ตาม §2

---
*พร้อมรับคำสั่ง — ปิดแชท 2026-10-16*