> ## 🟢 สถานะล่าสุด — ปิดเซสชั่น 2026-10-27 รอบดึก (R11 · ยึดบล็อกนี้ + `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md` ถ้าข้อความด้านล่างขัดกัน · ก่อนหน้า = R9+R10 `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md` · เซสชั่นก่อน = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`)
> - **ปิดแล้ว (มี evidence ทุกข้อ):** **W-1** (`REPLAY_ALL_GREEN 157/157` · parity MATCH = rls 67=67 · acl_tables 768=768 · ledger 158=158 · `e2e/w1-parity-report-2026-10-26.md`) · **W-2** (legacy contract **7/7** → Contract Tests **#151/#153/#155 success**) · **W-3** (`marketing_rules` อ่านซ้ำ 2026-10-26 ผ่าน Management API = ค่าครบ → precondition C7/C8 ✓ ขั้นรันยัง NOT RUN) · **W-5** (เอกสารชุดเดียว) · **UI 9 ข้อครบ** = L-1/2/6/9 + **L-3/4/5/7/8 (test รายข้อ · gates ALL ZERO · CI `67f10b8` #585/#159)** · **B-6 (P0)** apply 157+158 (evidence `w6Apply*`) · **legacy 6 = DROP แล้วบน production (159 APPLIED · w7Apply159 4 stage · ledger 159)** · **รอบ defect Owner 2026-10-26 (4+1 ข้อ) แก้แล้ว:** **SW `skipWaiting`+`clients.claim` = ต้นตอ "UI เก่าค้าง"** (injectManifest ไม่ได้ฉีด autoUpdate) · **hours+operating_hours sync client ครบ** (status bar/round picker/submit gate · test `shopHoursGate` 17 เคส) · markup `toFixed(2)` · coupon rehydrate deps `[couponCode, subtotal]` · summary โชว์ "โค้ด ..." · **`migration 160` (server `ERR_STORE_CLOSED` เวลาเปิดร้าน) = APPLIED+VERIFIED (Owner สั่ง `__apply 160__` · w8Apply160 4 stage ALL_PASS · ledger top **160** · behavior proof 23:3x น.: SAMEDAY → `ERR_STORE_CLOSED ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (8:00–20:00)` · PRE_ORDER ผ่าน gate 160 → ติด `ERR_PRE_ORDER_REQUIRES_ADDRESS` ของ gate เดิม · ROLLBACK = ไม่มีมลพิษ)** · evidence gates = **`e2e/gates_sync2026-10-26.log` ALL 5 EXIT=0**
> - **R9 (2026-10-27 · แก้ defect ที่ Owner เทสต์เจอ 8 รายการ):** root cause พิสูจน์ด้วย repro จริง (`e2e/r9OrderRepro.*` · S6 = `ERR_PRE_ORDER_REQUIRES_ADDRESS` คือตัวล้มพรีออเดอร์) → แก้แล้ว: error บอกเหตุจริง (`describeOrderSubmitError`) · เติมที่อยู่จากหมุดอัตโนมัติ · ไม่บังคับไปเช็คเอาท์ · ปุ่ม "สั่งทันที"/"จองล่วงหน้า" ตามป้ายปฏิทิน (พรีออเดอร์ = เมนูตาราง = ปิด "2 vs 20") · คูปอง retry อัตโนมัติ · สถานะแยกป้าย sameday/preorder · **data flip 14 สินค้านอกตาราง = available_same_day=true** (rollback ใน `e2e/r9OwnerDefectFixes-2026-10-27.json`) · สร้าง `docs/BMB_BACKEND_AI_PART_1.md` ใหม่ตามคำสั่ง · **รอ Owner retest ทั้ง list** — ยังห้ามสรุปปิด
> - **R10 (2026-10-27 · แก้ defect ที่ Owner เทสต์จริง 16 จุด):** **แจ้งเตือนออเดอร์ใหม่+เสียง+ปุ่มเปิด/ปิด** (migration 161 `orders_notify_hook` — trigger พิสูจน์แล้ว tx+ROLLBACK) · **คูปอง popup ที่เช็คเอาท์อย่างเดียว** (จิ้มเลือกโค้ด เติมอัตโนมัติ · ยกเลิก apply จากนอกหน้าชำระเงิน) · **ปุ่มถ่าย/แนบรูปที่อยู่** (161 attach + 162 get + ไรเดอร์เห็นรูป) · **ปุ่มปฏิเสธสลิป** (162 `admin_reject_payment`) · แบนเนอร์เซมเดย์ไม่โชว์เวลาส่ง + พรีออเดอร์เคารพรอบที่ปิด · redirect ครัว→จัดส่ง/ยืนยันชำระ→ครัว · rider `completeDelivery` มี catch แล้ว (เดิม error หายเงียบ) · **ลบออเดอร์ทดสอบ 405/205/337** (`e2e/r10Cleanup-result.json`) · evidence `e2e/r10OwnerDefectFixes-2026-10-27.json` — **รอ Owner retest** (ค้าง: #2 ต้องรู้ชื่อสวิตช์ที่ท่านปิดรอบเย็น · #9/13 ให้ไรเดอร์จบ flow จริงในรัศมี 300 ม.+POD)
> - **R11 (2026-10-27 รอบดึก · สิ่งที่ Owner สั่งหลังทดสอบเอง):** **rider step-sync ทีละสเตปตาม action จริง** — `migration 163` (`driver_accept_assignment`/`claim_dispatch_offer` → `dispatched` ทันที · **`driver_checkin_arrival` ใหม่** เช็คพิกัดในรัศมี 300 ม. ฝั่ง server → `arrived` · geofence ที่ delivered) + **แจ้งเตือนเด้งไปหน้างานตาม role** (`notificationLinks.ts` + wiring กระดิ่ง/ศูนย์แจ้งเตือน) + **ปิดวงจรอัตโนมัติ** (POD+geo = แอดมินไม่ต้องกดปิดวงจร) — gates เขียวหมด (tsc 0 · lint+brandGuard OK · vitest 1613 0 fail · build ✓ · `e2e/gates_r11_2026-10-27.log`) · contracts บน PG17 = 036/132/135 ไม่พัง + 163 G1-G5 PASS (`e2e/r11-contracts-2026-10-27.log`) · ลงทะเบียน 163 ใน CI แล้ว — **apply 163 สู่ production แล้ว (2026-10-27 รอบดึก · Owner สั่ง · `e2e/r11Apply163.cjs` 4 stage ผ่าน: precheck → apply → verify `pg_proc` 4 fn + `arrived_at`/`checkin_*` col → record ledger 161/162/163 (backfill ของ R10 ที่ไม่ได้ record) · **ledger top = 163** · evidence `e2e/r11Apply163-result.json`) + รอ Owner retest ทีละสเตป** (`docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md` §2)
> - **R12 (2026-10-28 · Owner สั่ง 2026-10-27 หลัง retest R11):** **ทุกหน้าขึ้นจากด้านบนเสมอ (ยกเว้นติดเงื่อนไข deep-link)** — Layout scroll rule ใหม่ (`[location.pathname, location.search, location.hash]`) · `#hash` ที่มี element จริง = scroll ไป section (deep-link ใช้ได้จริง) · ไม่มี = ขึ้นบน (<main> + window fallback) · **LINE กลับมา** — restore ค่าจริงที่แ админตั้งใน `business_settings.social_links` (`https://line.me/ti/p/QFD3bSMFN9` · `bitemebaby2016` · evidence `e2e/r12RestoreLine-result.json`) + DEFAULT ใน `socialLinks.ts` ตรงกัน (แ админแก้ได้ที่ AdminSettings เสมอ) · **ฟุตเตอร์ลิงก์ครบจริง** — guard test `footerLinksReal.test.ts` (ทุก path มี Route จริงใน App.tsx) · **deep-link B (กดแจ้งเตือน = เด้งหน้างาน) ใช้ได้จริง** — wiring guard (dropdown + notification center) · gates เขียว (tsc 0 · eslint 0 · brandGuard 441 · vitest 1616 0 fail · evidence `e2e/gates_r12_2026-10-28.log`) — **รอ Owner retest** (list = §9.0 row 32 + report)
> - **R12b (2026-10-28 รอบ 2 · สิ่งที่ Owner สั่งเพิ่ม 5 ข้อ):** **anon เห็น business_settings ทั้งหมด** (Owner อนุมัติ "anon ให้เห็นทั้งหมดตั้งแต่แรก · ทุกคนเห็นหลักส่งผลจริง") → migration 164: policy `business_settings_public_read` = SELECT to anon+authenticated USING true · APPLIED+VERIFIED production (policiesAfter qual=true · เขียนยัง admin-only) · ledger top **164** · evidence `e2e/r12Apply164-result.json` — ผู้เยี่ยมชมเห็นค่าจริงที่ admin ตั้ง (LINE/social/hours) ตั้งแต่แรกจริง · **แถบสถานะหน้าแรก: คำในวงเล็บไม่ต้องแสดง** — เหลือ "🟢 เปิดรับออเดอร์ เซมเดย์" (ตัด "(— ยังสั่งได้)" กับบรรทัด "(ไม่มีคัทออฟ (สั่งได้ถึง 20:00) · เหลือที่นั่ง 100%)" · "📅 พรีออเดอร์: เปิดรับรอบ เที่ยง (คัทออฟ 09:00)" คงเดิม) · **กรอบโปรโมชั่นขนาดเท่ากันทุกกรอบ** (promo-card height 148px + min-h 120px + line-clamp · การ์ดใหม่ได้ขนาดเดียวกันอัตโนมัติ) · **ภาษา: ห้ามต่างดาวจาก UTF-8 BOM** — ลบ BOM 39 ไฟล์ + ตัวอักษรชุดอื่น 15 จุด + guard ใหม่ใน `npm run lint` (`languageSanity` 1224 ไฟล์ OK) — **รอ Owner retest** (list = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md` §4)
> - **R12c (2026-10-28 รอบ 3 · Owner ยืนยันใช้ค่า LINE จริง + ให้ admin แก้ SEO copy เองได้):** **`seo.ts` sync จากค่าจริงแล้ว** — JSON-LD `sameAs` ใช้ social จริงจาก business_settings (`social_links` = LINE `https://line.me/ti/p/QFD3bSMFN9` / `line_id bitemebaby2016` · FB `61586146030943` — handle เก่าที่เคยค้างถูกถอด) · **SEO copy = admin แก้เองได้** — คีย์ business_settings `seo` = {description, tagline} (migration 165 seed = ค่าเดียวกับ DEFAULT ในโค้ด · APPLIED+VERIFIED production · ledger top **165** · evidence `e2e/r12Apply165-result.json`) · หน้าแรก/meta/JSON-LD อ่านค่าจริงผ่าน `seoSettings.ts` (live store + App `useSyncExternalStore` → re-render meta ทันทีที่ admin แก้ · bootstrap fire-and-forget ที่ main.tsx) · AdminSettings ฟอร์ม "🔎 SEO / คำโปรยเว็บ" (คีย์ `seo` กัน generic editor — "1 เรื่อง = 1 ที่") · tests ใหม่: `seo.test` (sameAs ใช้ค่าจริง · ไม่มี handle เก่า · copy override) + `r12SeoAdminCopy.test` (6 ข้อ) — **รอ Owner retest** (list = 27B §4 (ฉ))
> - **R13 (2026-10-28 รอบ 4 · retest ไรเดอร์/แถบสถานะ/แจ้งเตือน — คำสั่ง 3 ข้อ):** **ต้นตอ "ไม่ปิดวงจรอัตโนมัติ" พิสูจน์ด้วย probe จริง** = `drivers.id` ใน production มี space+`#` (`drv- ###########-60bc` พิสูจน์ hex) → path รูป POD ถูกตัดที่ `#` → **bucket `pod-photos` มี 0 รูป = upload ไม่เคยสำเร็จ → delivered ไม่เคยถึง (ERR_POD_REQUIRED)** · **ที่มา "เครื่องยังค้างเดินทาง"** = `delivery_assignments_status_check` ไม่มี `'arrived'` (163 จึงเขียนได้แค่ `arrived_at`) · **migration 166** (APPLIED+VERIFIED production · ledger top **166** · evidence `e2e/r13Apply166-result.json` · รอบแรก rollback ตรง CHECK → เพิ่ม `'arrived'` แล้ว apply ซ้ำผ่าน): CHECK + `'arrived'` · path-layer sanitize `driver_path_folder` (client folder/attach/storage policy เทียบค่าเดียวกัน — ไม่แตะ PK/FK) · checkin ตั้ง `assignment.status='arrived'` + self-heal (**PO-942 ตอนนี้ = arrived แล้ว**) · **Client**: ปุ่มเดินถึง `🏁 ถึงปลายทาง` · delivered สำเร็จ = ข้อความจบงาน + `setActiveOrder(null)` + **scroll กลับหน้าจอหลักอัตโนมัติ** · **แถบสถานะรูปแบบใหม่**: `🟢 เปิดรับออเดอร์ เซมเดย์ : ส่งทันที` + `🟢พรีออเดอร์: เปิดรับออเดอร์ รอบส่งถัดไป <ชื่อรอบ> <DD/MM/YYYY> (คัทออฟ HH:MM)` (บอก "รอบไหนของวันไหน" · strip ไม่ truncate) · **แจ้งเตือนแอดมิน "ถึงปลายทาง" → `/admin/delivery?focus=<เลข>`** + ตาราง "กำลังเดินทาง/ส่งแล้ว" มีปุ่ม `🏁 แอดมินปิดวงจร` (ปิดได้จากแถวโดยตรง) · tests ใหม่ `r13RiderLoopClose.test` (10 ข้อ) + อัปเดต r12LandingUi/storeStatusWindow/notificationLinks/statusTruthMatrix — **รอ Owner retest ทั้ง 3 ข้อ** (list = 27B §4 (จ))
> - **รายการทดสอบที่ยังเหลือทั้งหมด (2026-10-28) = `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** (รวม R9/R10/R11/R12/R13/R14/RT-HOURS/B2/C7C8/settings-sync 14 คีย์/role guide/§F-I — ใช้ไฟล์นี้เป็น list หลักในการรัน · แฮนด์ออฟเดิม = รายละเอียดประกอบ)
> - **R14 (Owner 2026-10-28 "ครัว สร้างแบทชผลิตไม่ได้ + การผลิตไม่ต่อเนื่องครบลูป"):** root cause พิสูจน์ด้วย probe production 4 ตัว (`e2e/r14ProbeA2/C/D-result.json` + apply evidence `e2e/r14Apply167-result.json`): (1) **Batch ID = `batch- ###########-md5`** เพราะ `to_char(epoch_ms,'99999999999')` ล้น 11 หลัก (เลขจริง 13 หลัก) → Postgres คืน `#` ทั้งแถว → UI slice โผล่ `- ##########` (แถวเดิม 3 ใบ = Owner กดจริง 14:08-14:09 สำเร็จที่ DB แต่ UI โชว์ขยะ) (2) **`Invalid Date`** = `get_kitchen_summary` ไม่ส่ง `created_at` (3) **คิวครัวว่างจริง**: `confirm_offline_payment` ตั้งแค่ `paid` **ไม่ hop `pending→confirmed`** → ครัวกรอง confirmed/preparing มองไม่เห็น (พิสูจน์: PO-20261028-135 paid 14:08:12 แต่ status ยัง pending — Owner กดยืนยันชำระแล้ว toast สำเร็จ+เด้งหน้าครัวแต่ออเดอร์ยังค้าง) → **migration 167 APPLIED+VERIFIED (ledger top 167)**: create_production_batch id = `::bigint::text` (probe จริง `batch-1793173199630-47a00b` digits ✓) · summary+kitchen_queue ส่ง `created_at` (+guard admin|kitchen) · confirm_offline_payment hop `pending→confirmed` ผ่าน transition canonical (allow-list+audit+INV-01+notify 161 · guard is_admin) + **self-heal = 135 → confirmed แล้ว** (pipeline มีงาน) · Client: ตาราง Batch โชว์ id เต็ม + `formatBatchCreatedAt` กัน Invalid Date (— เมื่อขาดค่า) · createBatch คืนเหตุจริง (toast บอก ERR) · typos กรุา/สำเรจ/หลด → กรุณา/สำเร็จ/โหลด · tests `r14KitchenBatchLoop` (7) — ทราบเพิ่ม: id รูป `###` ทั้งระบบ (ord-/pi-/alog-/osh-/das- ฯลฯ ~40 จุดจาก to_char เดียวกัน) = cosmetic (md5 ยังกันชน) — รอบถัดถ้าต้องการให้แจ๋วทั้งระบบ
> - **เหลือ:** **(ก)** production runtime = Pages ✓ · 159 ✓ · 160 ✓ · mrRead ✓ · parityFn ✓ — ยังเหลือ **B2 = UNVERIFIED** (~11:00) · **C7/C8 ขั้นรัน NOT RUN** · **(ข)** **แผนทดสอบทั้งหมด = `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** (เดิม `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md` §2 · ส่งให้แชทหน้ารันครบ · เริ่มจาก hard reload 1 ครั้ง) · **Owner retest R9 (8 ข้อ) + R10 (16 จุด) + RT-HOURS** (จุดเข้ม = flow ไรเดอร์จบงาน: เช็คอินในรัศมี 300 ม. + แนบ POD ก่อนยืนยัน → สถานะ/แจ้งเตือน/driver ต้องวิ่งครบ) · **(ค)** **Backlog "ทุกฟีเจอร์แอดมินต้องซิงค์จริง"** = audit โค้ดปิดครบ (13 key · `e2e/backlogAudit-settings-sync-2026-10-27.json`) — เหลือ runtime spot-check มือ (role guide §15) · **(ง)** **คู่มือสอนทดสอบทุก role = `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md`** · **Backend+AI Part 1 = สร้างใหม่แล้ว (`docs/BMB_BACKEND_AI_PART_1.md`)** เหลือรอ Owner ยืนยันเนื้อหา/เทียบต้นฉบับ + **L-11 (LED)** ยังไม่พบในโค้ด = รอนิยาม · ยืนยัน "ข้อ 7/8/13/16/17/19" = แถว CAP-07/08/13/16/17/19 → **ยังห้ามสรุปว่าปิดครบทุกลูปจนกว่า §16 role guide ครบ**
> - **git:** HEAD ณ เขียนบรรทัดนี้ (รอบ R10 · 2026-10-27) = `168cee4` (แก้ defect ทดสอบจริง 16 จุด + รอบแก้ CI จนเขียว — **CI #604 · Contract #178** success ทั้งคู่) · ก่อนหน้า `d246359`/`ecc3988`/`1a9307a` (R10 หลัก + แก้ CI #601–603 / Contract #175–177) · `70ad11c` (R9 แก้ defect 8 จุด + Backend+AI Part 1 · #599/#173) · `2107ac6`/`b66b880` (audit + role guide · #597/#171) · `d5b29d4` (#596/#170) · `02b834c` (#595/#169) · **ค่า HEAD ให้ตรวจจริงด้วย `git log --oneline -1` เสมอ** · ก่อนหน้า: `f001a6d` (#594/#168) · `5215cf4` (#593/#167) · `6d83cba` (#590/#164) · `67f10b8` (#585/#159) · ผล CI ทุก SHA = `BMB_MASTER_STATUS.md` §9.0 (failure #152 = §9.8) · stash `local-edits-before-sync-2026-09-21` = เดิมของเซสชั่นอื่น **ห้ามแตะ**
> - **gates รอบปิด (2026-10-26):** tsc 0 · eslint 0 · brandGuard 0 (434 ไฟล์) · **vitest ทั้งชุด 0 fail** · build 0 → evidence **`e2e/gates_ui2026-10-26.log` = ALL 5 EXIT=0** (เดิม: `session20261026-r3-gates-evidence.log` · `gates_final.log`)
> - ⚠️ **กติกาปิดงาน:** UI 9 ข้อ · 159+160 APPLIED ✓ · Pages ✓ · mrRead ✓ · parityFn ✓ · **รอบ defect SW+hours sync = แก้แล้ว (gates_sync ALL ZERO)** — **ยังห้ามพูด "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"** จนกว่าจะครบ: **B2 มีหลักฐานจริง** + **C7/C8 ขั้นรันผ่าน** · **test pack ทั้งหมดรันผ่าน (แผน §2 HANDOFF)** · **Owner retest 4+1 ข้อหลัง deploy (hard reload/ปิด SW เก่า 1 ครั้ง)**
>
## 1. งานที่ทำอยู่ (สำคัญสุด — นี่คือ "Current Work State")
# Bite Me Baby — AI Work State (บันทึกสถานะสำหรับแชทถัดไป)

> **ไฟล์นี้ = บันทึกสั้นของเซสชันล่าสุดเท่านั้น**
> เอกสารสถานะหลัก (canonical current state / capability matrix / backlog / evidence) =
> **`docs/BMB_MASTER_STATUS.md`** — ถ้าขัดกันให้ถือไฟล์นั้น + โค้ดจริงเสมอ (DOC DRIFT)
> กติกาคงเดิม: No evidence = not done · SKIPPED ≠ PASS · ห้ามมี task `NOT_STARTED`/`IN_PROGRESS`
> ค้างโดยไม่มีหลักฐาน · ห้ามใช้รายงานเก่าใน `docs/` (ที่มีวันที่) มาสั่งงานซ้ำแทนไฟล์สถานะหลัก

**last_updated:** 2026-10-27 (รอบ R9+R10 แก้ defect ที่ Owner เทสต์เจอ · ปิดเซสชั่น 2026-10-27) · **session:** R9 (8 ข้อ) + R10 (16 จุด) + session-close handoff

---

## 1. HEAD / gates (ตรวจริงบนเครื่อง 2026-10-26)

- repo `D:\A PROJECT\Bite Me Baby` · `main` = `origin/main` · **HEAD ก่อนเริ่มงาน = `47b33e1`**
- working tree clean · staged/unstaged ว่าง · **untracked = 0** · stash `local-edits-before-sync-2026-09-21` **คงเดิมไม่ถูกแตะ**
- **รอบที่ 3 (2026-10-26 · ปิด W-1/W-2 + UI 4 ข้อ) — สิ่งที่รัน/มีหลักฐาน:**
  - **fresh replay 001→157 = `REPLAY_ALL_GREEN 157/157`** (`e2e/w1-replay-apply-2026-10-26-full.log` ·
    `e2e/w1-replay-apply-2026-10-26-full.jsonl`)
  - **legacy contracts 7/7 EXIT=0** บน replay ชุดเดียวกัน (`e2e/w2-contracts_*.log`)
  - **schema parity รันแล้ว** → `e2e/w1-parity-2026-10-26.json` + รายงาน `e2e/w1-parity-report-2026-10-26.md`
  - unit ที่เพิ่ม/รันตรง: `storeStatusWindow` 4/4 · `uiTechnicalLabels` 4/4 ·
    `mascotClosed`+`roundsSameDayNoCutoff` 34/34
  - gates ชุดใหญ่ (tsc/eslint/brandGuard/vitest/build) = **ทุกตัว exit 0 · vitest 1549 tests 0 fail**
    → evidence = **`e2e/session20261026-r3-gates-evidence.log`**
- **รอบที่ 2 (ปิด backlog ทั้งหมด):** tsc 0 · eslint 0 · brandNameGuard OK · vitest 146 files /
  1541 tests 0 fail · build 0 → `e2e/session20261026-r2-gates-evidence.txt`
- **production: ไม่ได้แตะ migration/apply/deploy/write ใด ๆ ในรอบนี้** (การเขียน production รอ Owner อนุมัติ —
  ดู B-6 ใน §3) · ledger ของรอบก่อน top = **156**
- **CI canonical (ตารางเดียวทุก SHA):** `docs/BMB_MASTER_STATUS.md` **§9.0** · ห้ามอ้างเลขรันกระจัดกระจาย

## 2. งานที่ปิดรอบนี้ (CLOSED — มีหลักฐาน)

### รอบที่ 1 (เส้นทางสั่งซื้อ + docs + dead code)
1. **เส้นทางสั่งซื้อเดียว** สำหรับพรีออเดอร์+เซมเดย์: สร้าง `src/lib/orderEntry.ts` (`runOrderBuilder`) แล้วให้
   `HomePage`/`MenuPage` delegate — เดิมมีสำเนา logic คู่กัน 2 ชุด (Owner: "มีหลายเส้นทางจนมั่วกันเอง")
2. **บั๊กจริงที่แก้:** `HomePage.handleReviewCta` ไม่เคยเช็ค `AddToCartResult` ก่อน toast "เพิ่มลงตะกร้าแล้ว" + navigate
3. **ลบ dead code 11 ไฟล์** (พิสูจน์ 0 reference ทั้ง `src` รวม tests และ `supabase/scripts/e2e/.github/public`)
4. **ปิด D14** (settings default ซ้ำ): `platformConfig` hardcode `dailyQuota 120` vs canonical `100` →
   อ้าง `ORDER_POLICY_DEFAULTS` + test ใหม่ใน `configAuthorityMap.test.ts`
5. **เอกสาร:** สร้าง `docs/BMB_MASTER_STATUS.md` (สถานะหลักเดียว) · ปรับไฟล์นี้ให้สั้น ·
   เพิ่มจุดชี้ใน `AI_ENTRYPOINT.md` · `docs/archive/INDEX_2026-10-26.md`

### รอบที่ 2 (ปิดงานค้างตามคำสั่ง Owner — ปิด 4/5 · B-2 = BLOCKED)
6. **B-1 ปิด:** `orderTimeline` + `categorySections` + `homeSectionModeCta` deterministic ด้วย
   render+flush ใน `act()` (assertion คงเดิมทุกข้อ ไม่มี skip)
7. **B-2 ไม่ปิด (BLOCKED):** เพิ่ม legacy contract 7 ตัวเข้า CI = Contract Tests #147 **ล้มเหลวทั้ง 7** →
   ซ่อมตามหลักฐาน + ตรวจด้วย replay ท้องถิ่น 2 รอบ = เขียวแค่ 1/7 → **หยุดตามกติกา 0.9** · rollback หมด ·
   step ถูกถอดออกจาก workflow (มี comment อธิบายในไฟล์) · รอ Owner เลือก (ก) ซ่อม หรือ (ข) ปลดระเบียบ
8. **CAP-21 ปิด:** `src/lib/customerIntelligence.ts` + `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม) =
   **อัตโนมัติทุกครั้งที่โหลด ไม่มีช่องให้แอดมินตั้ง** · test `customerIntelligence.test.ts`
9. **CAP-22 ปิด:** `src/lib/marketingAutoSchedule.ts` + ปุ่ม "ให้ AI เลือกเวลาทั้งหมด" ในแท็บปฏิทิน =
   เลือกเวลาจาก `marketing_rules` จริง → RPC เดิม → worker เดิม · **คงกติกา CNT-01 (ห้าม auto-approve)**
   · test `marketingAutoSchedule.test.ts`
10. **B-5 ปิด (ส่งมอบ):** ชุดทดสอบ production รวม = **`docs/BMB_PRODUCTION_TEST_PACK.md`** (ขั้น A–K)

## 3. งานค้าง (สถานะจริง ณ 2026-10-26 รอบที่ 3 — **ยังไม่ใช่ "เหลือ Owner อย่างเดียว"**)

- **ปิดแล้วรอบนี้ (มีหลักฐาน):**
  - **W-1 fresh replay + schema parity** — `REPLAY_ALL_GREEN 157/157` + parity รันแล้ว ·
    drift 5 กลุ่มมีคำอธิบาย/แผนครบ = `e2e/w1-parity-report-2026-10-26.md` → §4/§5 = VERIFIED
  - **W-2 legacy contracts 7 ตัว (B-2)** — ทั้ง 7 ไฟล์ EXIT=0 · step กลับเข้า `contract-tests.yml`
  - **UI 4 ข้อ:** L-1 (ป้าย theater) · L-2 (Marketing Testimonials) · L-6 (แถบสถานะ ~11:00) ·
    L-9 (เฟรม 1:1) — มี test กำกับครบ (`uiTechnicalLabels` · `storeStatusWindow`)
  - **W-3 CAP-22** — `marketing_rules` = **VALUES VERIFIED ใหม่ 2026-10-26** (Management API อ่านอย่างเดียว · `e2e/mrRead-2026-10-26.json`:
    window 10:00–19:00 · cooldown 6 · 3/สัปดาห์ · content_mix ครบ · menu_rules/stop_conditions = {}) → **precondition C7/C8 ผ่าน** ·
    **ขั้นทดสอบจริง = NOT RUN (รอ Owner กด 🤖/worker)** · (probe anon รอบก่อน = 42501 · ไม่มี write ทุกกรณี)
- **blocker/งานค้าง:**
  - **B-6 (P0) = ปิดแล้ว ✅** — guest อ่านเมนู production ไม่ได้ (401 is_staff) → **apply 157 + 158 แล้ว
    (Owner อนุมัติ 2026-10-26)** → ตรวจซ้ำ: PostgREST ทุก endpoint = 200 · Playwright เปิด `/menu` จริง =
    เห็นเมนูครบ + **console ไม่มี error** → `e2e/w2_guest_menu_probe.cjs` (รอบหลัง apply)
  - **W-1 แผน: ปิดครบทุกข้อ ✅** (RLS 2 ตาราง + align grants = 158 apply · DROP legacy 6 ตัว =
    **159 APPLIED บน production 2026-10-26** · w7Apply159 4 stage ผ่าน · ledger top 159 · evidence `e2e/w7Apply159-*.json`)
  - **UI ฝั่งลูกค้า ปิดครบ 9/9 (ฝั่งโค้ด)** — L-3/L-4/L-5/L-7/L-8 ปิด 2026-10-26 (มี test รายข้อ ·
    gates ALL ZERO · CI `67f10b8` #585/#159) → เหลือแค่ **runtime verify = `BMB_PRODUCTION_TEST_PACK.md` §L-RT**
    (ไม่ใช่งานค้าง) · รายละเอียด = `BMB_MASTER_STATUS.md` §3.1 (N-4)
- **แฮนด์ออฟทั้งหมด:** `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`

## 4. งานรอ Owner (ไม่ใช่งาน AI) — **รันได้เฉพาะที่ไม่ติด blocker**

- = **`docs/BMB_PRODUCTION_TEST_PACK.md` (ฉบับ reconcile)** · รันได้: A1/A2/A3 ·
  B (รวม **B2 = verify ครั้งแรก** — UNVERIFIED · ต้องรอช่วง ~11:00) · **C7/C8 = precondition VERIFIED (mrRead) · ขั้นรัน NOT RUN** ·
  D–K · **L-RT** (runtime 5 ข้อ · ไม่ใช่งานค้าง) · ~~L-10~~ **ปิด = 159 APPLIED+VERIFIED 2026-10-26**
- **ห้าม**พูดว่า "เหลือ Owner อย่างเดียว / ปิดครบทุกลูป" จนกว่า: (1) **B2 มีหลักฐานจริง** + **C7/C8 ขั้นรันผ่าน**
  (2) **test pack ฉบับ reconcile รันผ่าน** — *(ทำแล้ว ✓ Pages marker · ✓ 159 apply+verify · ✓ mrRead values · ✓ parityFn onlyProd=0)*

## 5. คำสั่ง/rules ที่ห้ามลืม

- **Owner directive 2026-10-26** (whole-repo reconciliation · code closure · lean production acceptance)
- **PRE_ORDER vs SAME_DAY:** SAME_DAY **ไม่มี cutoff** · PRE_ORDER มี cutoff ตาม policy (server 143/148) —
  ห้ามเอา requirement ที่ถูกยกเลิกจากเอกสารเก่ากลับมา
- เอกสารย้อนหลังทั้งหมด = `docs/archive/` (มี index) — **ห้ามใช้รายงานเก่าสั่งงานซ้ำ**