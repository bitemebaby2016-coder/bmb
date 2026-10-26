# BMB_HANDOFF_NEXT_SESSION_2026-10-26 — ปิดเซสชั่นรอบที่ 3 (เขียน 2026-10-26)

> **บังคับอ่านตามลำดับก่อนเริ่มงาน:** `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` → ไฟล์นี้ (จบในไฟล์เดียว = มีฉบับนี้ฉบับเดียว · ฉบับ 10-25 ถูกย้ายเข้า `docs/archive/legacy_reports/` แล้ว)

## 0. บรรทัดเดียว
**ปิดแล้ว:** W-1 · W-2 · W-3 · W-5 · UI 4/9 ข้อ · **B-6 (P0)** · migration **157+158 ใช้งานบน production แล้ว**
**เหลือ:** UI อีก 5 ข้อ (L-3/4/5/7/8) · legacy 6 functions รอคำสั่ง Owner · test pack รันจริง (ขั้นปลดล็อกแล้ว)

## 1. ปิดแล้ว — ห้ามทำซ้ำ (มี evidence)

| งาน | ผลจริง | Evidence |
|---|---|---|
| **W-1** fresh replay 001→157 | **`REPLAY_ALL_GREEN 157/157`** · snapshot ตรงกัน · parity รอบสุดท้าย **MATCH** (tables/columns/indexes/constraints/sequences/triggers/views · **rls 67=67 · acl_tables 768=768 · ledger 158=158**) · drift เหลือ 3 กลุ่ม = functions / acl_functions / policies (อธิบาย + แผนแก้แล้ว) | `e2e/w1-replay-apply-2026-10-26-full.log` · `.jsonl` · `e2e/w1-schema-2026-10-26.json` · **`e2e/w1-parity-report-2026-10-26.md`** · `e2e/w1-parity-2026-10-26.json` |
| **W-2** legacy contract 7 ไฟล์ (B-2 ปิด) | **7/7 EXIT=0** บน replay 2 รอบ (reproduce + fresh) · step กลับ `.github/workflows/contract-tests.yml` · CI รันแล้ว | `e2e/w2-contracts_*.log` · Contract Tests **#151 / #153 / #155 = success** |
| **W-3** CAP-22 `marketing_rules` | **มีค่าจริงอยู่แล้ว** (window 10:00–19:00 · cooldown 6 ชม. · 3 โพสต์/สัปดาห์ · content_mix ครบ) → **C7/C8 ปลดล็อก** · `menu_rules`/`stop_conditions` ยังว่าง = L-12 optional | master §N-3 |
| **W-4 UI 4 ข้อ** | L-1 (kicker "เมนูพร้อมขายวันนี้" + `BANNED_KICKERS`) · L-2 (Marketing Testimonials → "เสียงชมจากผู้ชม") · L-6 (แถบสถานะบอกตามเวลา/รอบจริง) · L-9 (เฟรม 1:1 ทุกหน้า) | `src/__tests__/uiTechnicalLabels.test.ts` 4/4 · `src/__tests__/storeStatusWindow.test.ts` 4/4 |
| **W-5** เอกสารชุดเดียว | master / work state / test pack / แฮนด์ออฟ = สถานะเดียวกัน · ไม่มี claim "เหลือ Owner อย่างเดียว" · ไม่มีอักขระจีน | `C:\Users\Public\bmb_doccheck`/cjkcheck ผ่าน |
| **B-6 (P0) ปิด** | ก่อนแก้: guest `/menu` production = **401 `permission denied for function is_staff` ทุก endpoint** (ต้นตอ = migration 129) → แก้ = **157 + 158** (apply แล้ว · ท่านอนุมัติ) · หลัง apply: PostgREST ทุก endpoint = **200** · Playwright เปิด `/menu` จริง = **เห็นเมนูครบ 14 รายการ + ไม่มี console error** | `e2e/w6Apply157158-staged.json` / `-verify.json` / `-apply158.log` · `e2e/w2_b6_final_*.json` |
| **Gates รอบนี้** | tsc 0 · eslint 0 · brandGuard 0 · **vitest 1549 tests 0 fail** · build 0 | **`e2e/session20261026-r3-gates-evidence.log`** (+ `e2e/gates_final.log` รอบปิดเซสชั่น) |

## 2. งานที่ต้องทำต่อ (ลำดับนี้เลย)

1. **ตรวจ CI รอบปิด** — `C:\Users\Public\bmb_ci.bat 5ab2906` (และ SHA ใหม่) → ต้อง **CI success + Contract Tests success + มี `Legacy contracts OK — 7/7`** · ถ้ามี failure จริง → `node e2e\w5_ci.cjs <sha>` แล้ว `node e2e\w7_jobs.cjs <run_id>` สืบ · เติมผลลง `BMB_MASTER_STATUS.md` §9.0 (แถว HEAD = `5ab2906` ยังเขียนว่า "ตรวจรอบถัดไป")
2. **UI อีก 5 ข้อ (W-4 เหลือ)** — เกณฑ์รายข้อใน `docs/BMB_PRODUCTION_TEST_PACK.md` §L · **ทุกข้อต้องมี test ของตัวเอง** · gates เขียว + push + CI ก่อนย้ายออกจาก §L:
   - **L-3** จิ้มแท็บ/หัวข้อแล้วเลื่อนไปเป้าหมาย — ต้องเลื่อนเหมือนกันทุกหน้า
   - **L-4** เมนูแท็บบนสุด: หัวข้อครบ + โหมดวันนี้/จองล่วงหน้า ถูกต้อง
   - **L-5** หน้าโหวตเมนู: ภาษาไทยถูก + ครบทุกเมนู
   - **L-7** ลำดับหัวข้อแนวนอน/ปุ่มล่าง = **ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ทานเล่น → สำเร็จรูป** + ลิงก์ใช้ได้จริง + ฟุตเตอร์ลำดับเดียวกัน
   - **L-8** พรีออเดอร์ยังไม่ถึง/เลยรอบ = **สีเทา + กดไม่ได้ทุกจุด** (หน้า list/detail/cart)
3. **Legacy 6 functions (L-10)** — production มี · repo ไม่มี · ไม่มี src caller: `auto_approve_order` · `calculate_loyalty_points` · `check_product_availability` · `mark_payment_failed` · `update_order_status` · `validate_order_before_submit` → **ถาม Owner: ปลดออก หรือ คงไว้ + บันทึก** (ห้ามปลด/ลบเอง)
4. **รัน test pack จริง** — ขั้นปลดล็อกแล้ว: **A1/A2/A3 · B (รวม B2) · C7/C8 · D–K** · ยังงด = ขั้นผูกกับ L-3/4/5/7/8 · **L-12 = `menu_rules`/`stop_conditions` (optional)** · **production acceptance = ท่านรันเอง** (AI รันแทนไม่ได้ตามกติกา 10)

## 3. กติกาที่ห้ามละเมิด (สรุปจากแถวนี้เอง)
- **ห้ามพูด/บันทึกว่า "เหลือ Owner อย่างเดียว"** จนกว่าจะปิดครบ: UI 5 ข้อ + legacy 6 functions มีคำสั่ง + ทุกรอบ CI เขียว + test pack acceptance ตาม §L
- **การแก้ migration ครั้งถัดไป**: ล้ม 1 ครั้ง = ไล่ตามหลักฐาน/ตรรกะ แล้วหยุด สรุป — **ครบ 2 ครั้งพอดี** (รอบนี้ #152 fail → #153 ผ่าน = 2/2)
- **production write** ต้องมีคำสั่ง Owner: ที่อนุมัติแล้ว = `marketing_rules` (ไม่ต้องแก้ — มีค่าอยู่แล้ว) · 157 · 158 (**apply แล้ว ห้าม apply ซ้ำ**)
- **ห้าม** สร้าง staging copy ของ BMB ในแชท workspace (ของเดิมถูกล้าง 2026-10-17)
- `stash@{0} local-edits-before-sync-2026-09-21` = เดิมของเซสชั่นอื่น — **ห้ามแตะ**

## 4. หลักฐาน/ผลจริงที่อ้างได้ (CI อย่าตอบจากความจำ)
- ตาราง SHA ทั้งหมด = **`docs/BMB_MASTER_STATUS.md` §9.0** (บันทึกเท่า `5ab2906`) · §9.8 = บทเรียนรอบ #152
- ตรวจ CI ปัจจุบัน: `C:\Users\Public\bmb_ci.bat <sha>` (= `node e2e\w5_ci.cjs <sha>`)
- **domain จริง**: `biteme-baby.com` (auto-deploy ปัจจุบัน) · **`bitemebaby-5f7.pages.dev` = build เก่า — ห้ามใช้ตรวจ UI**
- logs gates: `e2e/session20261026-r3-gates-evidence.log` (1549 tests) · `e2e/gates_final.log` (รอบปิดเซสชั่น)

## 5. เครื่องมือบนเครื่อง (ทุกตัวอยู่ `C:\Users\Public\`)
| bat | หน้าที่ |
|---|---|
| `bmb_ci.bat <sha>` | ตรวจอันดับ/ผล CI + Contract Tests จาก GitHub Actions API |
| `bmb_status.bat` / `bmb_hlist.bat` | git status+log+origin+stash / ไล่ไฟล์ handoff+md |
| `bmb_gatesfinal.bat` + `bmb_schedfinal.bat` | **รัน gates 5 ตัวแบบ detached ผ่าน Task Scheduler** → log `e2e\gates_final.log` (ห้ามรันตรง ๆ — process โดน kill) |
| `bmb_tail.bat` | อ่าน 8 บรรทัดท้าย gates_final.log |
| `bmb_push*.bat` + `bmb_msg*.txt` | commit/push (msg4..6 = ของรอบนี้) |
| `bmb_clean*.bat` | ล้างไฟล์ชั่วคราวในแชท workspace (ทำแล้วรอบปิดเซสชั่น) |
- Replay DB รอบนี้รันบน container **`bmb_replay_w1`** — ถ้าถูก stop แล้ว: สร้างใหม่ด้วย `e2e/ci/w1_run_setup.bat` + `e2e/ci/w1_fresh_replay.sh` (นับแบบ dynamic รองรับ 158 แล้ว)
- helper ในแชท workspace (bmb_*.bat/cjs) = **ถูกล้างหมดแล้ว** — ห้ามสร้างใหม่ค้างไว้ข้ามเซสชั่น

## 6. Gotchas รอบนี้ (ห้ามลืม · มี repro จริง)
1. **`to_regprocedure('fn(p_arg type)')` = syntax error** — regprocedure ไม่รับ "ชื่อ parameter" (รายการมาจาก `pg_get_function_identity_arguments`) → ตรวจด้วย `pg_proc` + `pg_get_function_identity_arguments(p.oid) = <args>` (ส่วน `GRANT ... (ชื่อ param)` ใช้ได้จริง)
2. **CI inventory ข้าม `124_*` ไป apply ทีหลัง** → migration ใน loop ต้อง **skip-if-missing ทั้งตาราง (`to_regclass`) และฟังก์ชัน (`pg_proc`)** + ให้ `ALTER DEFAULT PRIVILEGES` รองรับของที่สร้างทีหลัง
3. **shell wrapper กินเครื่องหมายคำพูด** (`git -C "path"` = error) → เรียกผ่าน `.bat` เสมอ
4. **gates/งานยาว** ต้อง detached (Task Scheduler) ไม่งั้นโดน kill
5. จำนวนครั้งแก้ = **2 attempt ต่อปัญหา** (ครบแล้วให้สรุป ไล่คนละทาง = เลิกแล้วรายงาน)

## 7. DoD ก่อนบอก "จบ" รอบหน้า
- [ ] CI ทุก SHA ใน §9.0 มีผลจริง (ไม่ใช่ "กำลังรัน")
- [ ] UI 5 ข้อ (L-3/4/5/7/8) ปิด + มี test + ย้ายออกจาก §L
- [ ] legacy 6 functions มีคำสั่ง Owner (ปลด/คง) + บันทึกใน §L-10
- [ ] test pack ขั้นปลดล็อกแล้วรันจริง/ผ่าน §0
- [ ] เอกสาร 4 ฉบับตรงกัน + ไม่มี claim เกินหลักฐาน

## 8. Gates ปิดเซสชั่น (รันจริงบนเครื่อง 2026-10-26 · evidence อยู่ใน repo)
| ตัว | ผล | หลักฐาน |
|---|---|---|
| `npx tsc --noEmit` | **exit 0** | `e2e/gates_final_tsc.log` |
| `npx eslint .` | **exit 0** | `e2e/gates_final_tsc.log` |
| `node scripts/brandNameGuard.cjs` | **exit 0** (ตรวจ 428 ไฟล์ ไม่มีชื่อแบรนด์ผิด) | `e2e/gates_final.log` |
| `npm run build` (= `tsc && vite build`) | **exit 0** | `e2e/gates_final.log` |
| `npm run test -- --run` (vitest ทั้งชุด) | **1548/1549 ผ่าน** · 1 รายการ = `homePreOrderModeGuard.test.ts` ล้มด้วย **`Test timed out in 5000ms`** (ไม่ใช่ assertion ล้ม) | `e2e/gates_final.log` |
| **รันซ้ำไฟล์ที่ล้ม (ลำพัง)** | **1 passed (1) · exit 0** → ยืนยัน = timeout จาก CPU ชนกันตอนรัน tsc/vitest พร้อมกัน **ไม่ใช่โค้ดพัง** | `e2e/gates_recheck.log` |
- ⚠️ **บทเรียนชื่อ script:** ใน `package.json` **ไม่มี `npm run typecheck`** (มีแค่ `dev · build (=tsc && vite build) · preview · test · test:watch · lint`) → typecheck ต้องใช้ **`npx tsc --noEmit`** (บัต `bmb_gatesfinal.bat` แก้ให้แล้ว)
- ⚠️ **อย่ารัน tsc/eslint พร้อม vitest** — จะชน CPU จน test timeout (เกิดแล้วรอบนี้)