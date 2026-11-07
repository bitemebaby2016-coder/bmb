# BMB — WHOLE FINAL PRODUCTION CLOSURE REPORT (R62 · 2026-11-03)

> **เอกสารนี้ = รายงานปิดงานรอบ WHOLE PROJECT FINAL CLOSURE (R62 PHASE 0–8)**
> · สร้างตามคำสั่ง Owner 2026-11-03 · **ไม่ใช่ใบประกาศ PRODUCTION READY**
> · Evidence hierarchy: Production DB/runtime > source > migrations/RPC/EF > runtime/integration > tests/CI > docs > reports

---

## §1 ขอบเขตที่ทำเสร็จในรอบนี้ (PHASE 0–8)

| PHASE | งาน | ผล | evidence |
|---|---|---|---|
| 0 | Git & worktree safety gate | **ผ่านทุกข้อ** · AUDIT BASELINE = `9799370` | `AI_WORK_STATE.md` บล็อก R62 |
| 1 | Audit 12 กลุ่ม A–L (evidence hierarchy) | **เสร็จ** · key files 129/129 · parity LIVE 183=183 ALL_PASS | `e2e/r62Inventory-result.json` · `r62GroupProbe-result.json` · `r56MigParity-result.json` |
| 2 | `BMB_REQUIREMENT_RECONCILIATION.md` | **สร้างแล้ว** · CONFLICT C-1..C-6 รอ Owner · DOC DRIFT D-1..D-6 | `docs/BMB_REQUIREMENT_RECONCILIATION.md` |
| 3 | ปิด D-1 (SEO 4 เส้นทาง) | **แก้+verify** · seo test 30/30 · audit ซ้ำ = เหลือ 2 redirect (exempt) | `src/lib/seo.ts` · `src/App.tsx` · `src/__tests__/seo.test.ts` · `e2e/r62SeoAudit-result.json` |
| 4 | Reconcile canonical docs | B-2/starter-blocker note = สถานะปิดจริง · §9.0 CI จริง · §T = 19 แถว (D-4) | `docs/BMB_MASTER_STATUS.md` · `docs/BMB_PRODUCTION_TEST_PACK.md` |
| 5 | Inventory map + archive MOVE | **100 ไฟล์ MOVE · 0 DELETE** (99+1) · dependency check 1,552 ไฟล์ | `docs/BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md` · commit `b1a3b92` |
| 6 | Test cycle จริง | **tsc=0 · lint OK · vitest FULL 202 files/2005 tests/0 fail · build OK** | `e2e/r62_tsc.log` · `r62_lint*.log` · `r62_vitest_full.log` · `r62_build.log` |
| 7 | Git closure | commit **`b1a3b92`** push แล้ว (131 files · stage เฉพาะ path · SECRET_HITS=0) | `e2e/r62PreCommit.cjs` · `e2e/r62_commit_msg.txt` |
| 8 | Owner test pack ฉบับเดียว | role guide รวมเข้า **§RG + §MAP** (old→new ID) แล้ว MOVE | `docs/BMB_PRODUCTION_TEST_PACK.md` §MAP/§RG |

## §2 สิ่งที่ยังไม่เสร็จ — **ห้ามตีความว่าปิดแล้ว**

| รายการ | สถานะ | ใครปิด |
|---|---|---|
| CONFLICT **C-1..C-6** (`BMB_REQUIREMENT_RECONCILIATION.md` §3) | **รอ Owner ตัดสินใจ** | Owner |
| Runtime tests ที่ต้องใช้เครื่อง/บัญชีจริง (§T T-A1..A6 · T-D/T-E · CAP-10/11/13/14/18) | NOT RUN / NOT VERIFIED | Owner รัน §0→§RG §16 ใน `BMB_PRODUCTION_TEST_PACK.md` |
| CI ของ `b1a3b92` | ตอนเขียนรายงาน = **in_progress** (CI #734 · probe ครั้งเดียว ห้าม poll) — ต้องยืนยัน success รอบถัดไป | แชทหน้า / Owner เปิด Actions |
| Backlog เดิม (Social AI menu rule · cart re-add 700ms · review submit UI · ประกาศ list · theater copy seed · PSID/LINE) | **ยังไม่ได้แตะ** (C-6 = รอ Owner สั่ง defer/close) | Owner เลือก |

## §3 สรุปสถานะอย่างตรงไปตรงมา

- **สิ่งที่มีหลักฐานจริง:** source audit ครบ 12 กลุ่ม · schema parity LIVE = 183/183 · gates ท้องถิ่น 4 ตัวเขียว (รันจริงทั้งก่อน/หลัง MOVE) · CI ของ HEAD ก่อนหน้า (`22e2b1b`) = success ทั้ง 2 checks · archive = 100 MOVE/0 DELETE · test pack รวมเป็นไฟล์เดียวแล้ว
- **สิ่งที่ยังไม่มีหลักฐาน:** runtime จริงของอุปกรณ์/บัญชีจริงทุกรายการ · คำตัดสิน conflict ทั้ง 6 ข้อ · CI ของ commit ปิดงาน
- **ดังนั้น: ยังไม่ประกาศ COMPLETE / PRODUCTION READY** — เกณฑ์ปิดจริง = `BMB_PRODUCTION_TEST_PACK.md` §RG·§16 (6 ข้อ · ต้องมี evidence ทุกข้อ)

## §4 กติกาที่ฝังไว้ในรายงานนี้

1. MOVE = `docs/archive/` เท่านั้น · **ไม่มีการลบไฟล์ใด ๆ** (พิสูจน์: commit `b1a3b92` = renames 100% · deletes 0)
2. `docs/` ที่มีวันที่ในชื่อ = รายงาน ณ วันนั้น · ห้ามย้อนแก้ (เปลี่ยนได้เฉพาะ pointer ที่เส้นทางย้าย)
3. Conflict ทุกข้อ = เอกสาร `BMB_REQUIREMENT_RECONCILIATION.md` §3 → **รอ Owner เท่านั้น**
4. ถ้าโค้ดเปลี่ยนจาก `b1a3b92` → บันทึก SHA ใหม่ + recheck finding ที่กระทบ

---

## §5 — อัปเดตสถานะจริงหลัง R63–R67 (2026-11-04 · ปิดเซส + โอนงานค้างไปแชทหน้า)

> อัปเดตตามคำสั่ง Owner 2026-11-04 · **ยังคงไม่ประกาศ COMPLETE / PRODUCTION READY** (§3 ยังใช้อยู่ทุกข้อ)
> · หลักฐานทุกบรรทัด = รันจริงบนเครื่องนี้ ไม่ได้อ้างจากเอกสารเก่า

| เรื่อง | สถานะจริง ณ 2026-11-04 | evidence |
|---|---|---|
| HEAD / push | `c26c143` (R67 code) + `2a7e29d` + `4bdc2f8` (docs) push แล้ว · SECRET_HITS=0 | `git log --oneline -4` · `e2e/r62PreCommit.cjs` |
| CI ของ `c26c143` | **success ทั้ง 2 workflow** (`CI` + `Contract Tests (isolated PostgreSQL)`) | `e2e/_r67_ci_probe.json` |
| Gates ปิดเซส | **tsc=0 · lint=0 · vitest FULL 206 files / 2,053 tests / 0 fail · build=0** | `e2e/_close_gates.log` |
| E2E Matrix (order journey จริง) | **PASS 12/12** · ออเดอร์จริง 2 ใบ `BMB-20261104-365` + `PO-20261105-931` · test user ลบใน finally | `e2e/e2e-result.json` |
| Chat-Hang ของ AI Waiter | **ปิดแล้ว + พิสูจน์สด**: ส่งข้อความ → คำตอบจริงใน 3.3 วิ · input ปลดล็อก (ไม่ค้าง) | `e2e/_r67_chat_live.json` |
| SEO routes | ครบ (รวม `/orders` `/notifications` `/track/:orderNumber` = dynamic param จริง ไม่มี literal `:orderNumber`) | `src/__tests__/r67Contracts.test.ts` · `seo.test.ts` 30/30 |
| FAQ + ตัวเลขโปรโมชั่น | ไม่มีตัวเลข hardcode (รอบ/แต้ม/รางวัล/เบอร์) · Footer ส่งฟรี = แสดงเฉพาะเมื่อ server enforce จริง (ค่าจริง 199) | `src/lib/faqContent.ts` · `src/components/layout/Footer.tsx` |
| **Production จริง (`biteme-baby.com`)** | **เสิร์ฟโค้ด R67 แล้ว (verified 2026-11-04 16:25 ICT)** — ข้อความ FAQ ใหม่อยู่ใน entry · ข้อความเก่า `ส่งฟรีเมื่อครบ ฿200` หายไปแล้ว · `react-vendor-Cg2Z0Rye.js` = ชิ้นเดียวกับ build ท้องถิ่น · **react-router สำเน้เดียว (`nav=1 loc=1`)** = บั๊กหน้าแรกค้างไม่กลับมา | `e2e/_close_prodcode.json` · `e2e/_close_prodvendor.json` · `e2e/_close_prodver.json` |

### §5.1 รายการที่ยังไม่เสร็จ — **ห้ามตีความว่าปิดแล้ว**

| รายการ | สถานะ | ใครปิด |
|---|---|---|
| ทุกข้อใน §2 (CONFLICT C-1..C-6 · runtime ด้วยอุปกรณ์/บัญชีจริง · backlog 6 ตัว) | **ยังคงเดิม ไม่เปลี่ยน** | Owner / แชทหน้า |
| **R66-D** = ปิดกะ POS ตามเวลาจริง + dynamic links ทุกปุ่ม POS | **ทำแล้ว (R68 · Owner ยืนยัน "ทั้งสองแบบ")** — นาฬิกากะ/ยอดสด/ป้ายเตือนเลยเวลา+ถามยืนยัน · ทางลัด role-filter + `/admin/orders?status=` preset · **ขั้นตรวจ = TEST_PACK §R68.1–§R68.2** | Owner รัน §R68 |
| test coverage `pos_closeout_order` / `handleHandover` | **มีแล้ว 22 test** (`src/__tests__/r68PosCloseoutHandover.test.ts` — client wrapper · SQL contract 129 · handleHandover · R66-D · console noise 3) | เสร็จแล้ว (r68 gates) |
| deploy edge function `shopContext` (เบอร์ร้าน `082 6096995` แก้ใน repo แล้ว) | **deploy แล้ว (R68)** — `social-ai-worker` v72 · `social-post-worker` v66 · ทั้งคู่ upload `_shared/shopContext.ts` แล้ว · `social-ai-worker.verify_jwt` ตั้งกลับเป็น `true` ตาม config (ผู้เรียกทั้ง 2 ส่ง Bearer SERVICE อยู่แล้ว) — evidence `e2e/r68_eflist.json` | Owner ตรวจ §R68.4 |
| console noise 3 ตัวใน E2E (`driver_login ERR_NOT_A_DRIVER` · `cart_sessions` RLS 42501 · query `date ""` 22007) | **แก้ที่ต้นทางแล้ว (R68)** — ไม่ได้ปิด assertion · **ยังต้องพิสูจน์บน E2E/production รอบถัดไป** · ขั้นตรวจ Owner = §R68.3 | Owner รัน §R68.3 + E2E รอบถัดไป |
| Owner live production test เริ่มจากหน้าแชท | **รอ Owner รัน** — ขั้นตรวจ = `BMB_PRODUCTION_TEST_PACK.md` **§R67 (7 ข้อ · เริ่มที่แชท) + §R68 (12 ข้อ · POS/console/เบอร์ EF)** | Owner |

### §5.2 ลำดับงานที่โอนไปแชทหน้า (handoff)

1. **Owner ทดสอบ live production เริ่มที่หน้าแชท** (`/` → Talk to Bite) ตาม `docs/BMB_PRODUCTION_TEST_PACK.md` §R67
2. เจอ symptom ใด = จดหลักฐาน (ภาพ / console / network) → ทีมแก้แบบ two-try (Attempt 1+2 เท่านั้น)
3. ~~งานค้างเรียงลำดับ: R66-D → test coverage POS handover → deploy `shopContext` → console noise 3 ตัว~~ = **ปิดครบทั้ง 4 ข้อใน R68 แล้ว** (เหลือ Owner รัน §R67 + §R68 บน production จริง + E2E รอบถัดไปพิสูจน์ console noise)
4. ห้ามยกเลิก/ตัดข้อทดสอบใน §2/§RG ของ test pack เพื่อให้ดูผ่าน (anti-gaming)

---

## §6 — อัปเดตสถานะจริงหลัง R68–R73 (2026-11-05 · ปิดเซส + โอนงานค้างไปแชทหน้า รอบ 2)

> อัปเดตตามคำสั่ง Owner 2026-11-05 (รอบเช้า–ดึก 2) · **ยังคงไม่ประกาศ COMPLETE / PRODUCTION READY** (§3 ใช้อยู่ทุกข้อ)
> · หลักฐานทุกบรรทัด = รันจริงบนเครื่องนี้ · รอบใหญ่ R69–R72 = แจ้งเตือน/แชต/PWA/คูปอง/จัดส่ง/รับงาน (ดู `AI_WORK_STATE.md` + `BMB_MASTER_STATUS.md` รายรอบ)

| เรื่อง | สถานะจริง ณ 2026-11-05 ดึก 2 | evidence |
|---|---|---|
| แชต 3 ฝั่ง (ลูกค้า/ร้าน/ไรเดอร์) | **ใช้งานได้จริง** — m182/183/187 (`send_order_message` v3 · แจ้งครบทุกผู้รับ) · smoke บน production 6/6 (รวมเคส rider-send ที่เคย rollback) | `e2e/_r71_smoke.json` · `_r71Apply187-result.json` |
| แจ้งเตือน/กระดิ่ง | **m188 dedup** (trigger ใช้ id เดียวกับ worker = 1 แถว/เหตุการณ์ · smoke 5/5) · กระดิ่งมุมจอเดียวทุก role · เด้งเดสก์ท็อปทุกครั้งรวมตอนเปิดแอป | `e2e/_r72Apply-result.json` · `_r72_smoke.json` |
| PWA push | `PushPermissionPrompt` auto-heal + role gating · ถอด `Notification.requestPermission()` ที่ bell (ต้นเหตุ prompt ตาย) | test pack §R70 · vitest r70 10 ข้อ |
| คูปอง/จัดส่ง/รับงาน | `HALLOW10` ต่ออายุถึง 30 พ.ย. 69 · คิวครัวข้ามวัน · DRIVER_* → `/admin/delivery` · **m189** claim→accept fallback (smoke: accepted จริง) | `_r72_smoke.json` · migrations 188/189 |
| **สติกเกอร์ (R73 · คำสั่งรอบนี้)** | **① ช่องไฟ 15 บรรทัดก่อน QR เท่ากัน** (grid Δ30 ทุกบรรทัด) **② เส้นคั่นไม่ทับอักษร** (ย้ายกลางช่องว่าง — เดิมเส้น 2 ทับ delivery · เส้น 3 ทับ total) **③ NOTICE พิมพ์ข้อมูลจากลิงก์จริงของลูกค้า** (`collectOrderNotices` = special_instructions + แชตลูกค้า + โน้ตรายเมนู · เติมทุกเส้นทางพิมพ์) | `src/__tests__/r73StickerLayoutNotice.test.ts` 8 ข้อ · sticker suite 59/59 |
| ออเดอร์ค้าง + เครียล์สเตจ (คำสั่ง Owner) | **ล้างแล้ว verified 0 เหลือ** (`cancel_order` canonical · `_r72_clear_all_result.json`) · เวิร์กสเปซ/temp/task เก็บกวาดแล้ว | `e2e/_r72_clear_all.cjs` |
| Gates รอบ R73 | **tsc=0 · lint=0 · vitest FULL 0 fail · build=0** (`e2e/_r73_gates.log`) | `_r73_gates.log` |

### §6.1 ลำดับงานที่โอนไปแชทหน้า (handoff · คำสั่ง "ไปทดสอบ live ที่แชทหน้า")

1. **Owner ทดสอบ live เริ่มที่หน้าแชท** — ชุดแชต §R70/R71 (พิมพ์โต้ตอบ 3 ฝั่ง + กระดิ่งมุมจอ) → ต่อด้วย **§R73 (6 ข้อ · สติกเกอร์: ช่องไฟ/เส้นคั่น/NOTICE)** → §R72 ที่เหลือ
2. เจอ symptom = จดหลักฐาน (ภาพ/ข้อความ) → ทีมแก้ two-try (Attempt 1+2 เท่านั้น)
3. follow-up ค้าง: push ตอนปิดแอปของไรเดอร์ (dispatcher คีย์ด้วย user/audience) · CONFLICT C-1..C-6 (§2) · backlog เดิม
4. ห้ามยกเลิก/ตัดข้อทดสอบใน §2/§RG ของ test pack เพื่อให้ดูผ่าน (anti-gaming)

---

## §7 — อัปเดตสถานะจริง R73e–R73h (2026-11-06 · ปิดเซส รอบ 3 + โอนงานไปแชทหน้า)

> อัปเดตตามคำสั่ง Owner 2026-11-06 ("เครียล์งาน+สเตจปิดเซสชั่นนี้ อัปเดตสถานะจากโค้ดจริง · เขียน README ใหม่ · ยกงานทั้งหมดไปทำแชทหน้า รอบนี้ห้ามโค้ด") · **ยังคงไม่ประกาศ COMPLETE / PRODUCTION READY** (§3 ใช้อยู่ทุกข้อ) · หลักฐาน = รันจริงบนเครื่องนี้

| เรื่อง | สถานะจริง ณ 2026-11-06 | evidence |
|---|---|---|
| HEAD / push | `518f7f4` (R73h code: birthday UI + m193) + `2362f34` (docs) push แล้ว · working tree clean | `git log --oneline -3` |
| CI ของ `518f7f4` | **3/3 success** (Migrations + SQL contracts · Test + Lint + Build · Cloudflare Pages) — probe ครั้งเดียว | `e2e/_r73h_ci_ann.json` |
| UTC-vs-BKK time-bomb class | **ปิดทั้งคลาส** — m190/191 (fn + table defaults → BKK) · guard `contracts_190` (pg_get_functiondef 9 fn) ใน CI · replay audit residue=0 | `e2e/_r73e_verify_progress.log` |
| CRM automation (m192/193) | winback/birthday/segment/menu_sales_stats ใน pg_cron · **ส่งเฉพาะลูกค้ายินยอม** (`customers.crm_consent` default false · UI หน้าบัญชี) · kill-switch `crm_automation` | `_r73e_verify_progress.log` (`CRM_CONSENT_FILTER_OK` · dedupe/kill-switch ✓) |
| Talk to Bite gap fills (R73e–g) | ออปชัน (extra_egg/spicy/no_ice) · สั่งซ้ำพก customization+notes · ขายดีจากยอดขายจริง · help 6 หัวข้อ deterministic | `src/__tests__/talkToBite.test.ts` (44 ข้อ) · `e2e/ttbFlow_results.json` (E2E live 5/5) |
| วันเกิด + consent UI (R73h) | การ์ดในหน้าบัญชี · validate วันในอดีต · บันทึกผ่าน RLS ตัวเอง | `src/lib/customerProfile.ts` · `src/__tests__/customerProfile.test.ts` (4 ข้อ) |
| Gates รอบปิดเซส | tests 78/78 (3 ชุดหลัก) · tsc=0 · lint=0 · CI 3/3 · README เขียนใหม่จากโค้ดจริง (migrations 197 · EF 24 · tests 212 ไฟล์ — นับจาก repo) | work state R73h-closure |

### §7.1 ลำดับงานที่โอนไปแชทหน้า (handoff · คำสั่ง "ยกงานทั้งหมดไปทำแชทหน้า รอบนี้ห้ามโค้ด")

1. **[มีแล้ว] env/secret + Meta Test User** — Owner ยืนยันว่ามีใน **local env** แล้ว (แชทหน้าตรวจ `.env`/secrets local ได้เลย · ห้าม commit ค่าลับ)
2. **[เคยทำแล้ว] ยิง webhook จริง → raw message เข้า `order_submissions`** — เคยผ่าน SMS สำเร็จแล้ว + **มี token อยู่ใน evv local** — แชทหน้าซ้อมยิงซ้ำได้ทันที (idempotent ยิงซ้ำ = ไม่สร้างแถวซ้ำ)
3. **ขั้น 3 (แชทหน้า):** ทดสอบ NL parse → draft cart → ลูกค้ายืนยัน (**ห้าม auto-order** ทุกกรณี)
4. **ขั้น 4 (แชทหน้า):** ปรับ parse dictionary จากข้อความจริงที่เจอ (สำเนียง/ศัพท์ร้าน)
5. **ขั้น 5 (แชทหน้า):** ทดสอบ+ปรับปรุงซ้ำจนครบ (Meta + LINE เมื่อได้ Test User) → จดหลักฐานที่ test pack **§R74-OMNI**
6. **คู่มือทดสอบ =** `docs/BMB_PRODUCTION_TEST_PACK.md` **§R73h (วันเกิด/consent + TTB) + §R74-OMNI** · ห้ามยกเลิก/ตัดข้อทดสอบ (anti-gaming)

### §7.2 — R74-OMNI (2026-11-06 ค่ำ · ทำขั้น 3–5 ที่โอนมา = ผลจริง)

| เรื่อง | สถานะจริง | evidence |
|---|---|---|
| ยิง webhook จริงซ้ำ (OMNI-2) | **ผ่านทั้งชุด** — intake แถวใหม่+ยิงซ้ำไม่ซ้ำ · order idempotent · `order_submissions` (m124) submit+replay = 1 ออเดอร์ | `e2e/_r74_omni_flow.json` (16/19) |
| NL parse→draft→ยืนยัน (OMNI-3) | **ผ่าน 2 ชั้น** — live EF: no-auto-order ครบทุกเคส (B1/B2/B4) + NL harness (LLM จริง+prompt ใหม่) **7/7** · "ยืนยัน→ออเดอร์จริง" บน EF เก่า = ยังไม่ผ่าน (โค้ดแก้แล้ว/unit+harness ผ่าน · รอ deploy) | `_r74_nl_parse.json` |
| parse dictionary (OMNI-4) | **ปรับจากข้อความจริงแล้ว** — item.note (ออปชันไม่เป็นเมนู) + qty ภาษาพูด + "เมนูนี้" + ยืนยันตามหลังสนทนา + note→`customizations.notice` | tests 79/79 |
| Production bug ที่เจอ (ใหม่) | **ออเดอร์ social ไม่มี GPS โดน 5KM gate ทุกใบ (fallback พิกัดเก่า)** → แก้ `resolveKitchenPoint()` (ค่าจาก `business_settings.kitchen_location`) — verify แล้ว A6/unit/harness | flow json + tests |
| Token (แก้ตามคำทัก Owner 2026-11-06) | คีย์ที่ใช้ทุกวัน **ผ่านครบ** (page token never-expire · `sb_secret_`/`sb_publishable_` · ขนส่ง LINE MAN/Grab/Google Routes ใน `.env`) · ที่ fail จริง 2 ตัว = `SUPABASE_ACCESS_TOKEN` (`sbp_` mgmt PAT · 401 · กระทบเฉพาะ deploy EF) + `META_USER_ACCESS_TOKEN` (Test User · `debug_token` ยืนยันหมดอายุ 2026-10-06) | `e2e/_r74Env2.cjs` · `scripts/metaTokenDebug.mjs` |
| กติกา no-auto-order | **Owner ตัดสินใจแบบ ก ณ แชทนี้** — สั่งชัดเจนในข้อความเดียว = ยืนยันในตัว · ไม่ชัดเจน = draft เท่านั้น (ยืนยันพฤติกรรมแล้ว) | test pack §R74-OMNI |
| Gates รอบ R74 | tsc=0 · lint=0 · **vitest 212/212 ไฟล์** · build=0 | `e2e/_r74_gates.log` |

### §7.3 — งานที่โอนไปแชทหน้า (R74-OMNI · คำสั่งปิดเซส "ยกงานทดสอบ live ทั้งหมดไปแชทหน้า")

> **คีย์ที่ถูก "ยกเลิก" (Owner สั่ง · จำไว้):** `META_USER_ACCESS_TOKEN` + `SUPABASE_ACCESS_TOKEN` (`sbp_`) — **ใช้คีย์ที่ใช้ได้เสมอ: `META_PAGE_ACCESS_TOKEN` + `sb_secret_`/`sb_publishable_`**

1. **deploy EF (`channel-webhook` + `social-ai-worker` ตัวแก้) — ค้างอย่างเปิดเผย:** คำสั่ง "deploy ให้ด้วย" ทำไม่สำเร็จ — ลองครบแล้วทุกเส้นทาง (mgmt API/CLI 401 · คีย์โปรเจกต์ management ไม่รับ · ไม่มี login cache · workflows ไม่มี deploy path) — เมื่อมี Management auth ใหม่ → `node e2e\_r74DeployFns.cjs` คำสั่งเดียวจบ → `node e2e\_r74OmniFlow.cjs` ซ้ำ = คาด B2b/B3/B3b เขียว
2. **Meta Test User live chat (OMNI-5) ด้วย `META_PAGE_ACCESS_TOKEN`** (คีย์ที่ใช้ได้ · Owner ยืนยันทดสอบได้)
3. **Owner ทดสอบ live ทั้งหมด** ตาม test pack §R73h/§R74-OMNI/§RG → จดหลักฐาน (anti-gaming)

## §8 — R74-OMNI session 3 (2026-11-07 · OMNI flow 19/19 ALL PASS + แก้บั๊ก shopContext rounds window + คู่มือสอน Owner + Key Registry)

> อัปเดตตามคำสั่ง Owner 2026-11-07 ("1 ร้านเปิดแล้ว รันสคริปด้วย 2 ok 3 รอคนใหม่ลงทะเบียนผู้พัฒนาก่อนถึงทดสอบให้ · อัปเดตเอกสารรวมเอกสารนี้ · บันทึกเรื่อง key · สอน owner ทำรายการทดสอบที่ค้างทั้งหมดตามเอกสาร") · **ยังคงไม่ประกาศ COMPLETE / PRODUCTION READY** (§3 ใช้อยู่ทุกข้อ) · หลักฐาน = รันจริงบนเครื่องนี้

| เรื่อง | สถานะจริง ณ 2026-11-07 | evidence |
|---|---|---|
| OMNI flow (OMNI-2+3+4) | **`R74 OMNI FLOW: 19/19 ALL PASS` บน production จริง** (รอบ 4 · 09:04) — "ยืนยัน → ออเดอร์จริง" (B3) = `BMB-20261107-471` (2 ที่ ไม่เผ็ด + ไข่ดาว x2) + B3b idempotent + **no-auto-order** B1/B2/B4 + A-suite ครบ (intake/idempotent/structured/ledger/kitchen-fallback) + A5b `ledger_rows=1` + cleanup 4/4 | `e2e/_r74_omni_flow.json` (รอบ 19/19) |
| production bug ใหม่ที่เจอรอบนี้ | **`shopContext.getShopContext()` query `delivery_rounds` ไม่กรองวันที่** (`scheduled_date.asc&limit=40` → หน้าต่าง 40 แถวแรก = รอบ 23 ต.ค.–5 พ.ย. ปิดหมด · ตารางมี 92 แถว) → ไม่เห็นรอบวันนี้ → STORE STATUS = "ปิดรับรอบวันนี้" ทั้งที่ร้านเปิด (`same_day_open=true`) → LLM/extractor เข้าใจผิด → **ลูกค้ายืนยันสั่งแล้วไม่สร้างออเดอร์** — **แก้แล้ว** (กรอง `scheduled_date>=วันนี้` แบบบรรทัด menu_schedule + เก็บ null-date) + deploy **3 ฟังก์ชัน** (เพิ่ม `social-post-worker` ที่ใช้ shopContext เดียวกัน) + verify 19/19 | `supabase/functions/_shared/shopContext.ts` · `_r74_gates2.log` · `_r74_deploy.log` |
| deploy EF | **3/3 ฟังก์ชัน** (channel-webhook + social-ai-worker + social-post-worker · exit=0) ด้วยคีย์ `bmb_PAT_SUPABASE_ACCESS_TOKEN` (PAT ใหม่ที่ Owner วางใน `.env.local` 2026-11-06 22:05) | `e2e/_r74_deploy.log` |
| Gates รอบปิด | **tsc=0 · lint=0 · vitest 212 ไฟล์ / 2,162 tests / 0 fail · build=0** | `e2e/_r74_gates2.log` |
| คู่มือสอน Owner | **test pack §R75** — เดินรายการทดสอบที่ค้างทั้งหมด = ชุด ก (§R73h 7 ข้อ) + ชุด ข (§R74-OMNI 8 ข้อ) + ชุด ค (§RG role walk + RG·13) + วิธีจดหลักฐาน (anti-gaming) | `docs/BMB_PRODUCTION_TEST_PACK.md` §R75 |
| งานที่ค้าง (โอนต่อ) | ① **OMNI-5 live chat = รอคนใหม่ลงทะเบียนผู้พัฒนาก่อน (คำสั่ง Owner)** → เมื่อพร้อม: provision Meta Test User + ทักเพจ ≥1 ข้อความ → `node e2e\_r74Omni5Live.cjs --psid <PSID> --confirm-name <ชื่อ> --fire` ② **Owner เทสต์ live ตาม §R75** แล้วจดหลักฐานใน test pack | test pack §R75 |

### §8.1 — Key Registry (บันทึกเรื่อง key ตามคำสั่ง Owner · **ชื่อ+สถานะเท่านั้น — ห้ามลงค่าลับในไฟล์/แชท**)

| คีย์ (ชื่อ) | สถานะ | ใช้ทำอะไร / หมายเหตุ |
|---|---|---|
| `META_PAGE_ACCESS_TOKEN` | **ใช้ได้** | page token ยาว (never-expire · `debug_token` verified) — ใช้ทุกวัน (ตอบแชท/ส่งข้อความ/Graph send) |
| `sb_publishable_` / `sb_secret_` (Supabase API) | **ใช้ได้** | anon/service ของโปรเจกต์ — ใช้ทุกวัน (verified 200) |
| `bmb_PAT_SUPABASE_ACCESS_TOKEN` (Supabase Management PAT · ค่าอยู่แถว `SUPABASE_ACCESS_TOKEN` ใน `.env.local`) | **ใช้ได้** | deploy EF + mgmt query (ledger `order_submissions`) — Owner ให้มา 2026-11-06 22:05 |
| `CHANNEL_WEBHOOK_APP_SECRET` + `CHANNEL_WEBHOOK_VERIFY_TOKEN` | **ใช้ได้** | HMAC-SHA256 sign webhook ทดสอบเข้า pipeline จริง |
| `BMB_openrouter_api_key` | **ใช้ได้** | LLM (extract/reply) |
| `BMB_LIVE_STRIPE_SECRET_KEY` / `BMB_TEST_STRIPE_SECRET_KEY` | **ใช้ได้** | จ่ายเงิน (live/test) |
| `BMB_GOOGLE_MAPS_*` (browser/server) | **ใช้ได้** | แผนที่/geocode |
| `GITHUB_TOKEN_BMB` | **ใช้ได้** | CI/Actions |
| ขนส่ง `LINE MAN` / `Grab` / `Google Routes` (ใน `.env`) | **ใช้ได้** | คีย์ขนส่งที่ใช้ทุกวัน (`src/lib/providers/*`) |
| `META_USER_ACCESS_TOKEN` | **ยกเลิก — ห้ามใช้ซ้ำ** | Test User token หมดอายุ 2026-10-06 (`debug_token`: user logged out 190/467) |
| `SUPABASE_ACCESS_TOKEN` ค่า `sbp_` เดิม (ก่อน 2026-11-06 22:05) | **ยกเลิก — ห้ามใช้ซ้ำ** | Management PAT ตาย (401 "Invalid access token") — ค่าถูกแทนที่ด้วย PAT ใหม่แล้ว |

> **กติกา key (บันทึกไว้เป็น policy):** ① ค่าลับ **ไม่เข้า git / ไม่พิมพ์ในแชท** (ชื่อหรือ masked เท่านั้น) ② คีย์ที่ยกเลิก/ตาย = **ห้าม reuse** · คีย์ใหม่ตั้งชื่อคนละชื่อกับคีย์เก่า (บทเรียน `bmb_PAT_SUPABASE_ACCESS_TOKEN` vs `SUPABASE_ACCESS_TOKEN` ค่า sbp_ เดิม) ③ คีย์ที่ระบบใช้ทุกวัน = ไม่เคยหมดอายุ (verified 2026-11-06: page token + sb keys ผ่าน 200 ทุกตัว · คีย์ที่ตาย = คนละตัวที่ไม่ได้ใช้ประจำวัน)

### §8.2 — test-data cleanup (2026-11-07 · คำสั่ง Owner "ออเดอร์ทดสอบที่เอไอทุกตัวทำค้างไว้ แดชบอร์ดรกมาก เครียล์ให้ด้วย")

| เรื่อง | ผลจริง | evidence |
|---|---|---|
| สำรวจ (read-only) | orders ทั้งหมด 42 ใบ = **เทสต์ 26** (probe R74 15 + E2E matrix 4 พ.ย. 11) / **ลูกค้าจริง 16** — จำแนกด้วยหลายสัญญาณ (ext_ref `msg-r74*` · ชื่อเทสต์ · บัญชีเทสต์ · probe-round) | `e2e/_r74_cleanup_inventory.json` (LOCAL · PII · ไม่เข้า git) |
| ลบออเดอร์เทสต์ | **26 ใบ + child 134 แถว** (order_items 26 · order_status_history 55 · order_submissions 14 · payment_intents 10 · points_ledger 2 · print_jobs 27) + test round `round-r74-20261106` → **orders เหลือ 16 = ของลูกค้าจริงทั้งหมด (delivered 13 + cancelled 3) · leftover 0 ทุกตาราง** | `e2e/_r74_clean.log` (CLEANUP_DONE) · `_r74CleanSweep.cjs` |
| ลบซากเทสต์อื่น | social_events 58 (`msg-r74*`/`r74cmt`/`r74-sim`) + customer_channel_identities 29 + customers เทสต์ 42 + notifications/notification_outbox 77×2 + auth users เทสต์ 13 (`e2e*`/`qa-r74`) — **เก็บบัญชี harness admin/qa หลักไว้** · recheck 0 ทุกรายการ | `e2e/_r74_residue.log` (RESIDUE_DONE) |
| ไม่แตะ (ตั้งใจ) | ออเดอร์/ข้อมูลลูกค้าจริง 16 ใบ + 3 รายจริง · `cart_sessions` เก่า 16 แถว (ปนลูกค้าจริงได้ · รอ Owner ตัดสิน) · ออเดอร์ประวัติ/replay = ข้อมูลจริง | inventory diff |
| เครื่องมือรอบถัดไป | `_r74CleanInv.cjs` → `_r74CleanRun.cjs --fire` → `_r74CleanSweep.cjs` → `_r74CleanResidue.cjs --fire` (DRY-RUN default + backup + ผูกหลักฐานก่อนลบ) | `e2e/_r74Clean*.cjs` |
| re-run (2026-11-07 คำสั่ง "เครียล์ข้อมูลเทสต์") | ทุกอย่าง 0 = สะอาด · **เจอ+ลบตกหล่นเพิ่ม 1 ชุด** (customer `e2ec…` + auth user คู่ · 4 พ.ย. ช่วง E2E — ที่ query คอลัมน์ผิดพลาดไปก่อนหน้า) เช็คอ้างอิงทุกตาราง = 0 ก่อนลบ · แก้เครื่องมือ generic (0-target / `full_name`) | `_r74CleanSweep` รอบสุดท้าย = 0 ทุกรายการ · orders 16 |