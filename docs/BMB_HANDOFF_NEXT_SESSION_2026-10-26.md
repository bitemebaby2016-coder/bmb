# BMB_HANDOFF_NEXT_SESSION_2026-10-26 — ปิดเซสชั่นรอบที่ 3 (เขียน 2026-10-26)

> **บังคับอ่านตามลำดับก่อนเริ่มงาน:** `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` → ไฟล์นี้ (จบในไฟล์เดียว = มีฉบับนี้ฉบับเดียว · ฉบับ 10-25 ถูกย้ายเข้า `docs/archive/legacy_reports/` แล้ว)

## 0. บรรทัดเดียว
**ปิดแล้ว:** W-1 · W-2 · W-3 · W-5 · **UI 9/9 ข้อ (รวม L-3/4/5/7/8 · Owner 2026-10-26 · มี test+gates+CI)** · **B-6 (P0)** · migration **157+158 ใช้งานบน production แล้ว (ledger top 158 มี evidence)** · **legacy 6 = DROP แล้วบน production (159 APPLIED · w7Apply159 4 stage · ledger 159 · evidence `e2e/w7Apply159-*.json`)** · **migration 160 = APPLIED+VERIFIED (Owner สั่ง `__apply 160__` · w8Apply160 4 stage ALL_PASS · ledger top 160 · behavior proof 23:3x: SAMEDAY → `ERR_STORE_CLOSED ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (8:00–20:00)` · PRE_ORDER ผ่าน gate · evidence `e2e/w8Apply160-*.json`)** · **รอบ defect Owner 2026-10-26 แก้แล้ว:** SW `skipWaiting`+`claim` (ต้นตอ UI เก่าค้าง) · **hours+operating_hours sync client ครบ** (test `shopHoursGate` 17 เคส) · markup/coupon/label · evidence **`e2e/gates_sync2026-10-26.log` ALL ZERO**
**เหลือ:** **แผนทดสอบทั้งหมด = §2 ข้อ 2 ข้างล่าง (รันครบตามลำดับที่แชทหน้า)** · **B2 = UNVERIFIED** (~11:00) · **C7/C8 ขั้นรัน = NOT RUN (precondition VERIFIED แล้ว)** · **Owner retest 4+1 ข้อ (hard reload 1 ครั้ง — SW เก่าค้างเพราะไม่มี skipWaiting)** · ring-system §F · audit "ทุกฟีเจอร์แอดมินต้องซิงค์" (Backlog) · CI: HEAD `02b834c` = **#595/#169** (ตรวจจริง = `git log`)

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
| **UI 5 ข้อปิด (L-3/4/5/7/8 · Owner 2026-10-26)** | L-3 scrollTo helpers (fallback-top) ทุกหน้า · L-4 chips ครบ + menuTabItems + prop tab · L-5 ไทย 3 จุด + กรอง archived (INV-18 VotePage อัปเดตตามคำสั่งใหม่) · L-7 N-4 #7 order + Footer displayRank · L-8 btn-locked + gate ทุกจุดเข้า + Cart stale | ใหม่: `uiTapScroll · menuTopTabs · votePageUi · headingOrderFooter · preOrderLockUi` · อัปเดต: `categorySections · homeMenuAdminOrdering · adminNavFeedback · canonicalFallbackContract` |
| **legacy 6 = DROP แล้วบน production (159 APPLIED 2026-10-26)** | `159_drop_legacy_manual_functions.sql` — **APPLIED ผ่าน Owner approval + staged precheck→apply→verify→record** (`w7Apply159.cjs` · Management API) | evidence **`e2e/w7Apply159-{precheck,apply159,verify,record}.json`** · ledger top **159** · pg_proc 0 · rpc 404 PGRST202 · products 200 |
| **CI รอบปิด `67f10b8`** | CI **#585 success** · Contract **#159 success** · Test+Lint+Build success · Pages success | `bmb_ci.bat 67f10b8` · master §9.0 |
| **Gates รอบปิด UI** | tsc 0 · eslint 0 · brand 0 (434 ไฟล์) · **vitest ทั้งชุด 0 fail** · build 0 | **`e2e/gates_ui2026-10-26.log` = ALL 5 EXIT=0** |
| **docs reconcile (D-1/2/3 · task 1–5)** | 4 เอกสารใช้ **SHA `5f891de` + สถานะเดียวกัน** · 159 (เวลานั้น) = prepared — **ปัจจุบัน APPLIED แล้ว (ดูแถวถัดไป)** · Test Pack §L-3/4/5/7/8 → **L-RT** · B2/C7C8 = **UNVERIFIED** (probe 42501) · Pages serving = **VERIFIED** (marker `btn-locked` ใน CSS/JS จริง) · ledger แก้ 156→**158** | CI **#586 success** · Contract **#160 success** · probe ผลอยู่ master §1.3 + §9.0 แถว 19 |
| **apply 159 production (Owner อนุมัติ · 2026-10-26)** | precheck OK (6 fn · args ตรง · trigger 0 · caller 0 · backup 9) → apply OK (pg_proc 0) → verify OK (products 200 · rpc 404) → record OK (**ledger 159**) | **`e2e/w7Apply159-{precheck,apply159,verify,record}.json`** · master §1.3 |
| **mrRead — marketing_rules อ่านใหม่** | Management API read-only: window **10:00–19:00** · cooldown **6** · **3**/สัปดาห์ · content_mix ครบ · menu/stop = `{}` → **precondition C7/C8 VERIFIED** (ขั้นรัน = NOT RUN) | `e2e/mrRead-2026-10-26.json` |
| **parity ย่อยหลัง 159** | functions/acl เทียบ local snapshot: **onlyProd = 0** (legacy จบจริง) · onlyLocal **11** = D3 เดิม (uuid×10 + get_all_orders · src caller NONE) · scope = ชุด fn+flags ไม่เทียบ body | `e2e/w1-parityfn-after159-2026-10-26.json` |
| **รอบ defect Owner 2026-10-26 (4+1 ข้อ) — แก้แล้ว** | (1) **SW ไม่มี skipWaiting/claim (injectManifest) = UI เก่าค้างถาวร** → เพิ่ม 2 listener (2) คูปองต้องกดใหม่ = deps `[couponCode]` miss hydrate → `[couponCode, subtotal]` (test เดิม R3/D-04 เขียว) (3) "ส่วนลดประมาณการมาจากไหน" → summary โชว์ `โค้ด ...` (4) markup ฿201.359… → `toFixed(2)` (5) **22:55 ยังสั่งเซมเดย์ (ปิด 20:00) = ไม่มีใครอ่าน `hours`** → sync client ครบ (status/picker/auto-select/submit gate + `operating_hours` toggles) + ฟอร์แมต `07:00:00-09:00:00` → ตัด `:ss` | test **`shopHoursGate` 17 เคส** + `couponHydrationRace` เดิมผ่าน · gates **`e2e/gates_sync2026-10-26.log` ALL 5 EXIT=0** |
| **migration 160 — server gate เวลาเปิดร้าน** | `160_enforce_shop_hours.sql` — BEFORE INSERT on orders: SAME_DAY + นอก open..close (BKK) → `ERR_STORE_CLOSED` (mirror 039 · ZERO-FAKE ไม่มีค่า=ข้าม) · CI = ephemeral apply + widen hours step | **APPLIED+VERIFIED 2026-10-26 ~23:30 (Owner สั่ง `__apply 160__`)** — **w8Apply160 4 stage ALL_PASS** · behavior proof: SAMEDAY 23:3x → `ERR_STORE_CLOSED (8:00–20:00)` · PRE_ORDER ผ่าน · ledger top 160 · evidence `e2e/w8Apply160-{precheck,apply,verify,record}.json` · **ROLLBACK:** `DROP TRIGGER IF EXISTS trg_shop_hours ON public.orders; DROP FUNCTION IF EXISTS public.enforce_shop_hours();` |

## 2. งานที่ต้องทำต่อ (ลำดับนี้เลย)

1. ~~ตรวจ CI รอบปิด~~ **เสร็จแล้ว** — `67f10b8` → **CI #585 success · Contract #159 success · Pages success** (ตรวจด้วย `C:\Users\Public\bmb_ci.bat <sha>`) · ผลลง `BMB_MASTER_STATUS.md` §9.0 แล้ว (รวมยืนยัน `5ab2906` = #583/#157 success)
2. **★ แผนทดสอบทั้งหมด (Owner สั่งปิดเซส 2026-10-26 → แชทหน้ารันครบตามลำดับนี้):**
   1. **ก่อนเริ่ม:** อ่านตามลำดับ `AI_ENTRYPOINT` → `UNIVERSAL_MASTER_AI_RULES` → `AI_WORK_STATE` → ไฟล์นี้ · **hard reload/ปิด-เปิดเบราว์เซอร์ 1 ครั้ง ทุกอุปกรณ์ที่ใช้ทดสอบ** (SW ใหม่มี `skipWaiting` แล้ว — ครั้งแรกเท่านั้น ส่วนการเทสต์ว่า "ไม่ค้าง" ใช้ **incognito**)
   2. **Retest defect 4+1 (RL-DEFECT):** ① โลเคชั่นหน้าร้านห่าง ≤ 300 ม. ② คูปองใช้ซ้ำได้หลังรีโหลดหน้า (ไม่ต้องกดใหม่) ③ `ส่วนลด (ประมาณการ · โค้ด ...)` บอกที่มา ④ ฿ ทศนิยม 2 ตำแหน่ง ⑤ **สร้างออเดอร์ได้จริง** — ถ้าพลาด **จด toast สีแดงที่ขึ้นตอนกด** มาให้แม่นยำ
   3. **RT-HOURS (เวลานอก 08:00–20:00):** แถบหน้าแรกไม่บอกเซมเดย์ "ยังสั่งได้" · `/checkout` รอบเซมเดย์ = `ปิดในการตั้งค่าร้าน` · กดสั่ง = toast ร้านปิด · **server 160** บังจริงแล้ว (RPC คืน `ERR_STORE_CLOSED` ถ้าฝ่า client) · เวลาแสดง `HH:MM` · เทสต์ toggle `operating_hours` ในแอดมิน = มีผลจริง
   4. **L-RT 9 ข้อ** ใน `docs/BMB_PRODUCTION_TEST_PACK.md` §L (L-3/4/5/7/8 + RT-L8 + RT-HOURS) ด้วยตา/มือถือจริง
   5. **B2 ~11:00** (มีหน้าต่างเวลา) + **C7/C8** (precondition = mrRead VERIFIED → เหลือขั้นรันจริง)
   6. **§F ring-system** (Backend+AI Part 1 §8 ยังไม่ได้รัน) · **§G N-1** (Bing API key ถ้ามี) · **§H AI** (CL1–CL4 / A1–A4) · **§I copy** · **L-10 record** (159 — ถ้า Owner ยังไม่เคย approve หน้า record) · **L-11 LED**
   7. **Backlog "ทุกฟีเจอร์แอดมินต้องซิงค์จริง"** = audit ทีละ key: `delivery_policy · kitchen_location · order_pattern · promotion/loyalty/referral/spin/push_config/social_links/theater_daily_copy · branch.operating_hours (JSON)` — ยืนยันว่า client/server อ่านจริงทุกตัว (รอบนี้ปิดแล้ว: **hours · operating_hours · round toggles**)
   8. **เกณฑ์ปิดงาน:** ตาม `UNIVERSAL_MASTER_AI_RULES` §4 (ปลดข้อ 7/8/13/16/17/19 เท่านั้น) + **มี evidence ทุกข้อในตาราง §1** + `git status --short` ว่าง + HEAD = `git log --oneline -1`
3. ~~Legacy 6 functions (L-10)~~ **ปิดจริง = 159 APPLIED บน production 2026-10-26** — precheck→apply→verify→record ผ่าน (identity args ตรง · trigger 0 · caller 0 · backup 9 · pg_proc 0 · products 200 · rpc 404 · ledger 159) · evidence `e2e/w7Apply159-{precheck,apply159,verify,record}.json`
4. **รัน test pack จริง** — ขั้นปลดล็อกแล้ว: **A1/A2/A3 · B (รวม B2) · C7/C8 · D–K** · ยังงด = ขั้นผูกกับ L-3/4/5/7/8 · **L-12 = `menu_rules`/`stop_conditions` (optional)** · **production acceptance = ท่านรันเอง** (AI รันแทนไม่ได้ตามกติกา 10)

## 3. กติกาที่ห้ามละเมิด (สรุปจากแถวนี้เอง)
- **ห้ามพูด/บันทึกว่า "เหลือ Owner อย่างเดียว"** จนกว่าจะปิดครบ: UI 5 ข้อ + legacy 6 functions มีคำสั่ง + ทุกรอบ CI เขียว + test pack acceptance ตาม §L
- **การแก้ migration ครั้งถัดไป**: ล้ม 1 ครั้ง = ไล่ตามหลักฐาน/ตรรกะ แล้วหยุด สรุป — **ครบ 2 ครั้งพอดี** (รอบนี้ #152 fail → #153 ผ่าน = 2/2)
- **production write** ต้องมีคำสั่ง Owner: ที่อนุมัติแล้ว = `marketing_rules` (ไม่ต้องแก้ — มีค่าอยู่แล้ว) · 157 · 158 (**apply แล้ว ห้าม apply ซ้ำ**)
- **ห้าม** สร้าง staging copy ของ BMB ในแชท workspace (ของเดิมถูกล้าง 2026-10-17)
- `stash@{0} local-edits-before-sync-2026-09-21` = เดิมของเซสชั่นอื่น — **ห้ามแตะ**

## 4. หลักฐาน/ผลจริงที่อ้างได้ (CI อย่าตอบจากความจำ)
- ตาราง SHA ทั้งหมด = **`docs/BMB_MASTER_STATUS.md` §9.0** (บันทึกเท่า `5f891de` แถว 19) · §9.8 = บทเรียนรอบ #152
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
| `bmb_push*.bat` + `bmb_msg*.txt` | commit/push (msg8 = โค้ดรอบนี้ · msg9 = docs+ล้าง probe) · `bmb_gatesui`/`bmb_schedui` = gates 5 ตัวผ่าน Task Scheduler (ห้ามรันตรง — process โดน kill) |
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
- [x] CI ทุก SHA ใน §9.0 มีผลจริง (`67f10b8` = #585/#159 · `5ab2906` = #583/#157 · `3ffafac` = #584/#158 · `5f891de` = #586/#160 · `7df33fd` = #587/#588+#161/#162 · `680bf78` = #589/#163 · `6d83cba` = #590/#164 · `4a62873` = #591/#165 · `5215cf4` = #593/#167 · `f001a6d` = #594/#168 · HEAD `02b834c` = #595/#169 — ยืนยัน 2026-10-26 ทุกแถว)
- [x] UI 5 ข้อ (L-3/4/5/7/8) ปิด + มี test + ย้ายออกจาก §L (ย้ายไป **§L → L-RT** = runtime verify แล้ว)
- [x] legacy 6 functions = **DROP แล้วบน production** — 159 APPLIED 2026-10-26 (Owner อนุมัติ · precheck→apply→verify→record ผ่าน · ledger 159 · evidence `e2e/w7Apply159-*.json`)
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
| **Gates รอบปิด UI (L-3/4/5/7/8 · 2026-10-26)** | **ทั้ง 5 EXIT=0** · vitest ทั้งชุด 0 fail (หลังแก้ 2 test ตามคำสั่ง Owner ล่าสุด: adminNav deps+search · INV-18 VotePage=archived) | **`e2e/gates_ui2026-10-26.log`** |
- ⚠️ **บทเรียนชื่อ script:** ใน `package.json` **ไม่มี `npm run typecheck`** (มีแค่ `dev · build (=tsc && vite build) · preview · test · test:watch · lint`) → typecheck ต้องใช้ **`npx tsc --noEmit`** (บัต `bmb_gatesfinal.bat` แก้ให้แล้ว)
- ⚠️ **อย่ารัน tsc/eslint พร้อม vitest** — จะชน CPU จน test timeout (เกิดแล้วรอบนี้)