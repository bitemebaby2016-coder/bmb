# BMB — MASTER STATUS (เอกสารสถานะหลักเดียวของโปรเจกต์)

> **เอกสารนี้คือ canonical current state ไฟล์เดียว** ตาม Owner directive 2026-10-26
> (WHOLE-REPO RECONCILIATION · CODE CLOSURE · LEAN PRODUCTION ACCEPTANCE)
> ไฟล์อื่นที่มีวันที่ในชื่อ = **รายงาน ณ วันนั้น** ห้ามใช้แทนไฟล์นี้ ถ้าขัดกันให้ถือโค้ด/หลักฐาน (DOC DRIFT)

**last_updated (R43):** 2026-10-31 20:40 ICT · **คำสั่ง Owner "ห้ามโค้ดแก้" → PLANNED ONLY** — บั๊กใหม่ 7 ข้อ (B1 ตั้งเวลาได้เดียว+ERR_APPROVAL_REQUIRED · B2/B3 โพส FB ไม่ตรงเวลา/มาไม่ครบ/ approve แล้วไม่ขึ้น · B4 AI ตอบผิดบริบทปิด same-day · B5 แจ้งเตือนลูกค้าเมื่อบอตโพส/ตอบ = **D-4 ใหม่** · B6 ลิงก์ cart=ไม่มีของจริง · B7 ×4 ต่อเนื่อง = 2-เว้น-1 · **เดี่ยว/ตำแหน่ง/ขนาด ผ่าน ✓**) — **ผังละเอียด+probe+runbook = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` หัวข้อ R43** · งานค้างรวม 9 ข้อ (CI `b8c8c15` probe · cron verify · web bundle · Q-A..Q-D · D-1..D-4) อยู่ในตารางเดียวกัน — **(R42 เดิม)** 2026-10-31 · **Owner อนุมัติ apply 177+178 → re-verify เต็ม = `e2e/r42_verify177178.cjs` ALL_PASS true** (ledger 176/177/178 ครบ · fns+anon acl · pg_cron/pg_net · bmb-promote+tick active · gate 401 · due=[]) · **ตรวจบั๊ก+ภาษาเพี้ยนทั้งโปรเจกต์**: CI `1c3b429` เขียว CI+Contract · vitest 86/86 · tsc 0 · lint 0 · **lang scan (`e2e/r42_lang_scan.cjs`) 29→0** (แก้ README/config×2/contracts_124/035 note fact-based "ส่งเองในรัศมี 5 กม."/HANDOFF_002×12/work-state×2 · archive+UTF-16 = ข้ามตาม policy) · **ขั้น Owner ยังเหลือ = TEST_PACK §Q (Q-A..Q-D) + §N.3** · *HEAD = ดู `git log -1`* — **(R41 เดิม)** 2026-10-31 · **R41 · 4 ของใหม่ Owner บ่าย:** (1) **image-gen = ทะเบียนจริง 12 ตัว output=image** (attempts พิสูจน์ `qwen-image-3` invalid · `seedream` 404 — `e2e/r41_models_probe.cjs`) → list ใหม่ 6 ตัว + **images API ก่อน** + chat fallback + `pickImage` ทุกรูปทรง · **EF deploy + secret ใหม่ตั้งแล้ว** (2) **สติกเกอร์ = โมเดล R41**: `stickerPageHeight = faceH เท่านั้น` (**offset ไม่ยืดหน้า — +62/ใบ คือต้นตอข้ามดวงตอน offset ทำงาน**) · เนื้อบนเลื่อนในหน้า · QR=min(ขอบล่าง, tel+40+off) · test 8 ไฟล์ 68 ผ่าน (3) **m178 APPLIED+VERIFIED**: pg_cron+pg_net ติดจริง + **`bmb-promote * * * * *`** + **`bmb-tick */5 * * * *`** active + EF **`cron-tick` deploy (gate 401)** + secrets `BMB_TICK_TOKEN`/`IMAGE_GEN_MODELS` ตั้งแล้ว · **E2E 06:33Z = tick→worker→โพสต์ `published+prov=true` (FB ขึ้น) + `g26-poll` รัน** — ไม่พึ่ง GH อีก (หลักฐาน GH ง่อย 05:29Z · `e2e/r41f_state.cjs`/`r41g_schedule_tick.json`) (4) **AI ตอบโพสต์/ข้อความ = inbound ปกติจริง** (คอมเม้น 05:48 `sent` 10 วิ · canAutoSend full-auto) — ที่หยุด = poll/FB ผูก GH → ปิดด้วย m178 · **ขั้น Owner = TEST_PACK §Q (Q-A..Q-D)** · *HEAD = ดู `git log -1`* — **(R40 เดิม)** 2026-10-31 · **R40 · 3 ของใหม่ Owner สาย 2:** (1) **เจนภาพ = สถานะ ⏳✅❌ + พรีวิว + อัลบั้ม `bmb-images/ai-generated/` จิ้มใช้ได้** · error อ่าน text/JSON (ไม่เห็นแค่ non-2xx) + EF `ERR_UNCAUGHT` wrap · logs EF = platform API 404 (หลักฐาน `e2e/r40_imggen_logs2.cjs`) (2) **สติกเกอร์ = ตั้งหลักใหม่**: วิซาร์ด `sticker-wizard` บันทึกอัตโนมัติ→พิมด้วยค่าที่จอโชว์ (`472×Npx` ทุกครั้ง) + พิม×4 ตรวจน้ำข้ามดวง + `btPrintWith` จุดเดียวทุกปุ่ม BT + **วิธีใช้ "ชดเชยฟีด/ความสูงหน้าดวง"** + ปุ่ม HTML 4 จุดติด **⚠ ไม่ใช้ชดเชย** (ต้นตอ "ตั้งหลายที่ไม่เปลี่ยน" = QZ/ไดอะล็อก/ใบเสร็จ-ครัว ไม่ใช้ค่าเลย) (3) Owner ตัด cache เองแล้ว (incognito+hard refresh) · gates: **vitest 8 ไฟล์ 72/72** (`e2e/r40_vitest_target.log` · r40Contracts ใหม่ 7) · **ขั้น Owner = TEST_PACK §P (P-A..P-C)** · *HEAD = ดู `git log -1`* — **(R39 เดิม)** 2026-10-31 · **R39 · 4 ของใหม่ Owner สาย:** (1) **ตั้งเวลาค้าง = GH cron ข้ามรอบ (evidence `e2e/r39_sched_probe.cjs`: run ล่าสุด 01:55Z · แถว 09:50 ICT `att=0`)** → **m177 `177_marketing_publish_due.sql` PREPARED** (`marketing_publish_due` + `marketing_feed_posts` RPC + pg_cron guarded) + feed หน้าแรก = rpc + `listMarketingPosts` promote ก่อน list + worker รับ published-unpushed (ไม่ demote) + scheduler marketing ยิงทุก fire (รวม */5) (2) **image-gen = attempts ทุกโมเดลใน detail (เดิมเห็นแค่ตัวสุดท้าย) + `reference_image_url` ทำร่วมเจน + auto subject/note จากฟอร์ม** (รอ deploy EF) (3) **`flashTo` = จิ้มปุ่มเด้ง+กระพริบจุดที่ทำงาน** ครบทุก action AdminMarketing (+`bmb-flash` keyframes) (4) **สติกเกอร์: DB `stickerFaceHPx=709/offset=0` live ยืนยัน → O-D วัด pitch 2 ดวง (มม.)×11.81 แล้วใส่ — ห้ามเดา** · gates: **vitest 9 ไฟล์ 100/100** (`e2e/r39_vitest_target2.log` · r39Contracts ใหม่ 10) · **ขั้น Owner = TEST_PACK §O (O-A..O-E) · ตัดสินใจ = §N.3** · *HEAD = ดู `git log -1`* — **(R38 เดิม)** 2026-10-31 · **HEAD = ดู `git log -1` (รอบ R38 ทั้งหมด push)** — **R38 · 7 คำสั่ง Owner + อนุมัติแก้ทุกอย่าง:** (1) **สติกเกอร์ตัดขอบบน = production `stickerFaceHPx` 670→709 read-back ผ่าน** (`e2e/r38_print_fix.cjs` — ต้นตอหน้า 670 < ดวงจริง 709) (2) **image-gen 404 gemini-flash = secret `IMAGE_GEN_MODELS` ตั้งแล้ว** (คู่แรก qwen-image-3/seedream · เดิม `IMAGE_GEN_MODEL` เก่า override) (3) **ลิงก์แผนที่ไรเดอร์ = intent URL เปิดแอป Google Maps + fallback** (`openMapsUrl` 3 ปุ่ม) (4) **delivered 3 ล่าสุด + อัลบั้มประวัติ** (5) **AI Studio ปุ่ม browse รูปเมนู → bmb-images → ชุด images ร่วม** (6) **MarketingFeedSection + m176 PREPARED** (รอ `__apply 176__` · anon 42501 พิสูจน์แล้ว) (7) **gates: vitest 8 ไฟล์ OK + tsc 0** · **รายละเอียด/บล็อก/ขั้นตรวจ Owner = TEST_PACK §N** (m176 **APPLIED+VERIFIED** — ALL_PASS 8/8 · ledger top=176 · anon probe 200 · `e2e/r38Apply176-result.json` · **รายการรอตัดสินใจ = §N.3 D-1/D-2/D-3**) · *CI เขียวหมด R37: `e4c3ad7`/`ff9132f`/`c22e869` success · NO_FAILED_RUN* · แต่ `7048283` (docs) พัง Lint (#5) ใหม่ = languageSanity จับอักขระจีน 2 จุดในเอกสาร (`BMB_HANDOFF_NEXT_SESSION_2026-10-31.md:7` + บรรทัดนี้บรรทัดเดิม — อ้าง fallback เดิมตรง ๆ เป็นหลักฐาน) → แก้เป็นคำไทย → local `npm run lint` OK + `npx tsc --noEmit` 0 → push `ff9132f` (fix) + `c22e869` (docs) · **เฟส B (R37): secret `BMB_OPENROUTER_API_KEY` มีบน production แล้ว ✓ · EF `image-gen` deploy แล้ว ✓ (`e2e/r37_deploy_imagegen.log`) · liveness OPTIONS 200 / POST 401 `UNAUTHORIZED_NO_AUTH_HEADER` ✓ → เหลือ Owner กดเจนรูป 1 ใบ + พิมพ์สติกเกอร์จริง + e2e auto-print** → *CI `aa1b295` เดิมพัง Lint (Test ผ่านแล้ว) → แก้ fallback ข้อความจีน→`🚗` + assertion + comment ใน `e4c3ad7`* · 4 คำสั่ง R35: (1) **สติกเกอร์ Menu/Notice ค่าหลัง ':' บนบรรทัดเดียวกับป้าย** (≤2/≤2 บรรทัด) + **ช่วง Tel→QR ลดเหลือ 40px** (`qrY=min(face−16−197, telLine+40)`) — ยังไม่ verify การพิมพ์จริง (Owner ถ่ายรูปมาถ้ายังข้ามดวง → วัด `stickerFaceHPx`) (2) **/menu?tab=pre-order**: ถอดชิปรอบ "ในวงเล็บไม่ต้องแสดง" + ลบ state rounds เปล่า + `ordered`/`preOrderShowcase` **เรียงวันจัดส่งใกล้วันปัจจุบันก่อน** (3) **image-gen คีย์สลับลำดับ = แก้** — `BMB_OPENROUTER_API_KEY` ก่อน dev (คีย์แยกงานคอนเทนต์/เจนรูป/marketing/talk-to-bite ตาม Owner) + `IMAGE_MODEL_CANDIDATES` = **`qwen/qwen-image-3`, `bytedance-seed/seedream-5-0-flash`** (ยืนยันจากหน้าโมเดลจริง · probe API สาธารณะไม่เจอ = index คนละชุด) + gemini/gpt เดิม 5 (4) gates local: **vitest 91/91 (8 ไฟล์ · r35Contracts ใหม่ 5) · npm run lint เต็ม OK · tsc 0 · build OK** · แฮนออฟ = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` · *Contract Tests `aa1b295` success ✓ · Cloudflare deployed ✓* · *ย่อหน้า `last_updated` R33 อยู่ด้านล่างเป็นประวัติ*

- **R33 · พิมพ์ไม่ตรงขอบ/ข้ามดวง = registration ไม่ใช่ geometry (Owner ยืนยัน "พรีวิวขึ้นจริง ขนาดตรงจริง แต่พิมไม่ตรง · ยังพิมข้ามดวง")**: ของเดิม PNG 472×709 ถูกทุกอย่าง แต่ภาพจริงเริ่มพิมพ์ "ก่อน" ขอบบนดวง (หัว BITE ME BABY หลุดข้ามใบก่อน = แถว 0–46 ถูกพิมพ์ใส่ร่อง/ใบก่อนหน้า · ท้ายใบขาวก่อนร่อง) — **registry `T40x60` ของไลบรารีเองยอมรับว่ายังไม่เคยถูกวัดบนกระดาษจริง** ("nobody has yet measured … with a rule" — ต่างจาก size อื่นที่มี `offset_y_px` จาก hardware sweep) → **แก้ = วัดเอง ไม่เดา**: (1) **`stickerOffsetYPx`** ใน `PrinterSettings` (default **0** = พิมพ์แบบเดิมเป๊ะ) → `clampFeedOffset` (−40..300 · −40 กันหัวเรื่องโดนตัด) → **apply ตอน render** = preview ตรงรูปจริงที่จะยิง · (2) **`stickerPageHeight`**: offset บวก = หน้าเติบโต 709+N (แถบขาวส่วนเกิน = ไม่ให้ความร้อน → ลงร่อง harmlessly · เนื้อหาเลื่อนลงจบพอดีขอบล่าง) — `stickerSize()` ใน `niimbotBt` ผูก h_px กับค่านี้เสมอ (png ↔ SetPageSize ห้ามเพี้ยน → ไม่งั้น `imageToPacked` ยืดรูปบี้) · offset ติดลบ = หน้าเท่าเดิม · (3) **ปุ่ม 📏 พิมพ์ใบวัดฟีด** (`calibrationDrawList`/`renderCalibrationPng` = pure) — เส้นขีดทุก 20px + ป้าย px/mm ทุก 100px + ขอบบน/ล่างหนา, พิมด้วย offset=0 (ค่า raw) → **เส้นไหนตรงขอบบนดวง = ใส่เลขนั้นเป็น offset** · ทุกทางใช้ค่าเดียว (test/batch/auto-print) · evidence: `e2e/r33_vitest_target.log` **32/32** · `r33_eslint.log`/`r33_eslint2.log` **0** · `r33_esbuild.log` **0** · `r33_guard.log`/`r33_guard2.log` **0** (brandNameGuard+languageSanity) · `r33_build.log` **0** (vite 409 modules) · ⚠️ full vitest local = **NOT COMPLETED** (2 ครั้ง · process ตายไม่มี `EXIT=` · `r33_vitest_full.log` = partial) → **ให้ CI หลัง push ตัดสิน**
- **R33 · งานค้าง Owner (hardware — ปิด loop นี้)**: ① กด **📏 พิมพ์ใบวัดฟีด** → อ่านเส้นเทียบขอบบนดวง: **เส้น 0px หายเหนือขอบ** (หัว BITE ME BABY หลุดข้ามใบก่อน = บั๊กปัจจุบัน) → เส้นที่ตรงขอบพอดีมีเลข N → ใส่ offset **= +N** (บวก = เนื้อหาเลื่อนลง) · มีแถบขาว N px เหนือเส้น 0px → ใส่ **−N** → บันทึก → กดทดสอบซ้ำ ② ยังเพี้ยน/ข้ามดวงเรื่อย ๆ ทั้งที่ใส่ค่าแล้ว = **calibrate ม้วนที่ตัวเครื่อง** (ปุ่ม feed ค้างตอนใส่ม้วนใหม่/ปิดฝา — คู่มือ B1 Pro) แล้วแจ้งทีม ③ e2e auto-print จริง 1 ออเดอร์หลายชิ้น (R31 code พร้อม · รอ Owner กดรับออเดอร์จริง)
- **ปิดแล้วรอบนี้ (มีหลักฐาน)**: ~~ยืนยันใบว่างจาก preview~~ = **Owner ตอบแล้ว: ไม่ใช่ใบว่าง — preview มีรูป ขนาดตรง → ปัญหา = registration** (R33 ด้านบน) · ~~mojibake คำอธิบาย R33~~ = อักขระจีน 2 จุดที่หลุดตอนเขียน (ใน AdminPrintSettings 1 + AI_WORK_STATE 1) → เปลี่ยนเป็นคำไทยแล้ว (เจอโดย languageSanity → แก้ → guard = 0)


- **R30 · พิมพ์ Nimbot ตรงผ่าน Web Bluetooth = SHIPPED (`7682efc`)**: `src/lib/niimbotBt.ts` = npm `niimbot-web-bluetooth` (protocol จีน NIIMBOT reverse · MIT · **validated บน B1 Pro** · task=v4 300dpi) — เบราว์เซอร์คุยกับเครื่องผ่าน BLE ตรง ข้าม QZ/คิว/spooler/COM ทั้งหมด · `src/lib/stickerPng.ts` = PNG 472×709 (= registry `T40x60` validated ของ lib เอง — geometry ตรง · **แต่ offset = ยังไม่เคยวัดบนกระดาษจริง → R33 จัดการ**) · แผง 📡 Bluetooth ใน AdminPrintSettings · **PREVIEW รูปก่อนพิมพ์ (R32) = diagnostic "ใบว่าง"** (R33: Owner ยืนยัน **ไม่ใช่ใบว่าง** → registration) · evidence: `r40_lang.ps1` (direct COM3 win32=0 ทุกภาษา · spooler restart แล้วยัง error → queue = ตายจริง — เสียงตอบรับ+คิวหายแต่ไม่ออก = driver text-only บด raster)
- **R31 · คิวสติกเกอร์อัตโนมัติ 1 ดวง/ชิ้น**: `src/lib/stickerQueue.ts` (`stickerRollForOrder` = แยกทุก quantity เป็นคนละใบ · Menu ในใบ = ชิ้นนั้น x1 · Order id/ลูกค้าเดิมทุกใบ) + `niimbotPrintStickers` (`printBatch` = job เดียวหลายหน้า pipelined · resolve = เครื่องยืนยันครบ) · **trigger = `acceptOrderCore` กด "รับออเดอร์"** → `void autoPrintStickerRoll` · ทุกช่องทาง (เว็บ/โซเชียล/ข้อความ) = orders กลางอยู่แล้ว → `getOrder` ตัวเดิม cover · setting `autoPrintStickers` default **true** + checkbox หน้าตั้งค่า · ไม่ใช่ Chrome/Edge = ข้ามเงียบ (frame/QZ ยังเป็นทางเดิม)
- **R32 · Marketing**: (ก) **Planner picker เมนูทั้งหมด** card `mk-product-picker` = products เปิดขายจริง ⏳พรีออเดอร์/⚡เซมเดย์ จิ้ม → title/body/genSubject + กระโดดแท็บ Studio (ข) **แคปชัน AI ข้อมูลจริงบังคับ** — `AdminAiStudio` โหลด `is_available` ทั้งหมด featured ขึ้นก่อน (limit 12) + **guard `pricesAreReal`** = polished มี ฿/บาท ที่ไม่มีในสินค้าจริง → ฟันทิ้งใช้ต้นฉบับ (pure test) (ค) **image-gen แก้ 2 ชั้น** — EF วน `IMAGE_MODEL_CANDIDATES` (โมเดลเดี่ยวโดน retiring = เดิมดับทั้งฟีเจอร์ · env `IMAGE_GEN_MODELS` ขยายได้) + UI ดึง `error.context.json()` โชว์ detail จริง (เดิมเห็นแค่ "non-2xx")
- **QZ Allow ทุกครั้ง = Incognito** (Owner ยืนยัน 2026-10-30) → คำแนะนำในหน้าตั้งค่า: หน้าต่างปกติ + ติ๊ก Remember this decision (BT permission ก็ persist เฉพาะหน้าปกติ)
- **ถาม Owner (บล็อกใบว่าง)**: ~~(1) preview = มีตัวอักษรหรือขาว? (2) ม้วน = 40×60?~~ = **ตอบแล้ว 2026-10-30**: preview มีรูป · ขนาดตรงจริง (= 40×60 ใช่ · ไม่ต้องสลับ T50x30) · **ปัญหาเหลือ = พิมพ์ไม่ตรง/ข้ามดวง → R33 (ชดเชยฟีด + ใบวัดฟีด)**
- **งานค้างทำต่อ (เรียงตาม Owner · ทบทวน/ปิดรอบ R33 2026-10-30 ดึก)**:
  - ~~① ยืนยันใบว่างจาก preview~~ = **ปิด** — Owner ตอบ: preview มีรูป + ขนาดตรง (ไม่ใช่ render) → ปัญหาจริง = registration → **แก้แล้ว = R33 (ชดเชยฟีด + ใบวัดฟีด)** · เหลือ Owner วัดค่าจากใบวัดใส่ offset (= ข้างบน งานค้าง Owner)
  - ~~② deploy EF `image-gen`~~ = **ปิด** — Owner ยืนยัน `DEPLOY_image-gen_OK` + CI `d8b1cbf` SUCCESS
  - ③ e2e auto-print จริง 1 ออเดอร์หลายชิ้น = **ยังค้าง** (โค้ด R31 ครบ + wiring test ผ่าน · runtime = Owner กด "รับออเดอร์" กับออเดอร์จริง · Chrome/Edge เท่านั้น)
  - ④ QZ ทดสอบสติกเกอร์ในฐานะ fallback = **ยังค้าง** (Owner · queue Windows = ตายรู้แล้ว · ทางหลัก = BT R30)
  - ⑤ marketing publish/comment poll = **ปกติ** (R26 poll fallback + social-ai-worker = deploy แล้ว e70 · ไม่ใช่งานค้าง แค่ดู logs ตามรอบ)


**last_updated:** 2026-10-30 (R27 · **CI `f97775d` = Lint + Unit tests + Typecheck/Build ทุกขั้น SUCCESS** · 4 เรื่องตามคำสั่ง Owner: (1) **QZ Tray พิมพ์สติกเกอร์ = LIVE** — `src/lib/qzTray.ts` (npm `qz-tray` → `qz.websocket.connect` พอร์ต secure 8181+ · unsigned stubs cert/signature · `qz.print {type:'pixel',format:'html',flavor:'plain'}` config `units:mm size 40×60`) + `printViaTransport` ใน printService = QZ ก่อน → fallback dialog เดิมเมื่อพัง · `PrinterSettings.qzEnabled/qzPrinterName` · แผง QZ ใน AdminPrintSettings (เชื่อมต่อ&ดึงรายชื่อ / เลือกเครื่อง / ทดสอบสติกเกอร์) · **เทมเพลตสติกเกอร์ BMB 40×60 `buildBmbStickerHtml` = ใบเดียวกันทั้งใบเสร็จ+ใบสั่งครัว** (แบบ Templates-BmB ของ Owner: ป้ายซ้ายฝังตาย Order id/Date/Menu/Notice/CUSTOMER/Tel · ค่าอ่านจากแบบฟอร์มออเดอร์เท่านั้น · QR=biteme-baby.com ผ่าน `qrcode` (fallback URL) · SCAN FOR MORE + ข้อความไทย + Thank You for love ! · ไม่มีบรรทัดราคา = รายละเอียดอยู่หลัง QR) — ปุ่มทดสอบ 3 ตัวยิงเทมเพลตนี้จริง · (2) **เอไอบริกร = บริบทเดียวทุกฝั่ง** — `shopContext` BITE_PERSONA_SEGMENT sync เต็มชุดเท่า `src/lib/bitePersona.ts` (web = canonical · `socialAiContinuity` บังคับ แก้ web ไม่ตาม = CI แดง) + rule ใหม่ **ปิดท้ายทุกคำตอบด้วยคำชวนสั่งต่อ biteme-baby.com/shop** · (3) **สรุปออเดอร์แนบลิงก์ตะกร้า ทั้งคอมเมนต์และข้อความ** — `buildCartLink`/`buildCartSummaryFooter` ใน shared intake (b64url `{v:1,items:[{id,q}]}` · ประโยค system-written) แนบหลัง match catalog จริง: comment = extract+match เฉย ๆ **ไม่สร้างออเดอร์เอง** (§5.1) · message ยังไม่ยืนยัน/submit fail = footer ลิงก์ · สำเร็จ = ลิงก์ชำระเงินเดิม · เว็บฝั่ง `src/lib/cartDeepLink.ts` + Layout `?cart=` (รอ `isHydrated` → `addItem` → เปิดแผงตะกร้า → strip param) = เปิดดู/เช็คเอาท์/เพิ่มเมนูต่อได้เอง · **deploy EF `social-ai-worker` = e70 `DEPLOY_SOCIAL_AI_OK`** · (4) **r22 deploy worker = ทำเสร็จไม่ค้าง** — `WRANGLER_EXIT=0` · `Uploaded bmb-tenant-proxy (6.42 sec)` · version `20bf99d5-f95b-4c84-a2ce-49df3d4303e6` · โครงใหม่: `.cmd` บาง ๆ → `r22_deploy_worker.cjs` (อ่าน token เองตัด quote · `CI=true` ห้าม prompt · timeout 120-180 วิ กันค้าง) + `r22_runner.cjs` (detached log = `e2e/r22_out.log`) · **Google = Owner เปิดใช้แล้ว ✓ · LINE = ค้างตามสั่ง (ไม่แตะ)** · ลบพิมพ์พลาด `ทดสอบ ` นำหน้า `AdminOrders.tsx` (ทำ `eslint .` แดง) · deps ใหม่: `qrcode` + `@types/qrcode` + `qz-tray` · gates: targeted vitest 14 ชุดเขียว (bmbSticker 4 · cartDeepLink 6 · qzTray 7 · continuity 21 · intake 20 · poll 6 · printTemplates 7 · cartPersistence 11 · cartEntry 6 · referral 34 · loginCtx 8 · checkout 7 · coupon 16 · mascot 18 · socialLogin 12) + **`eslint .` = 0** + esbuild OK + `brandNameGuard/languageSanity` 1370 ไฟล์ OK · **วิธีเทสต์ฝั่ง Owner**: เปิด QZ Tray → หน้าตั้งค่าเครื่องพิมพ์ → เชื่อมต่อ (ครั้งแรกกด Allow) → เลือกเครื่อง → บันทึก → ทดสอบสติกเกอร์ · คอมเม้น/ข้อความสั่งเมนู = AI ตอบสรุป+ลิงก์ตะกร้าเปิดบนเว็บต่อได้เลย (R26 · **AI ตอบคอมเม้น FB = LIVE (production-verified)**: `action:'poll_comments'` ใน `social-publish-worker` (อ่านคอมเม้นบนโพส 14 วัน → RPC `ingest_social_event` dedupe → kick `social-ai-worker` safety-gated เดิม — ไม่มีเส้นทางตอบคู่ขนาน) + เรียกหลัง `runMarketingPublish` + audit trace `g26-poll-<ชั่วโมง>` — **ผลจริงจาก production**: `ok:true · posts:1 · seen:1 · duplicate:1 · unbound:0` (คอมเม้นบนโพสถูก dedupe กับ row เดิมที่ SUCCEEDED ✓) · **วิธีเทสต์: คอมเม้นใหม่บนโพส → ภายใน ≤1 ชม. AI ตอบ** · deploy 2 EF ✓ · gates: socialCommentPoll 6/6 + boundary (g6/g7/continuity/intake/aiRouting) 178/178 (เดิม R25 · **รอบนี้ 3 เรื่อง**: (1) พิมพ์ 4 จุด — `testPrint`/`testPrintRole` ยุบ popup → frame กลาง (guard เดียว) + **guard ปล่อยตอน `afterprint` จริง** (เดิมปล่อยทันทีหลัง print() คืน → คำสั่งเข้าคิว → "แคนเซิ่ลแล้วยังปริ้น") · dropdown-test toast บอก Nimbot ต้องมีไดรเวอร์ (2) copy สถานะหน้าแรกใหม่ตาม Owner: `เปิดรับออเดอร์ Same-Day / ส่งวันนี้ : รอบส่ง ทันทีหลังครัวปรุงเสร็จ` + `เปิดรับออเดอร์ Pre-Order / จองล่วงหน้า : รอบส่ง … (ปิดรับ HH:MM AM/PM)` — **`DEFAULT_STORE_STATUS_COPY.sameDayOpen` sync ด้วย** (ไม่งั้น override แอดมินพังเงียบ) + tests 4 ไฟล์ตาม (3) Login: ปุ่ม **Google + LINE** (`signInWithSocial` · LINE = Custom OIDC ต้องตั้งค่า Dashboard ก่อน) · **Passkey/นิ้ว มีอยู่แล้ว (P4)** · redirect `/shop` ทั้ง session-effect + finishLogin · **AI ตอบคอมเม้น FB = Owner ยืนยันทำ** (ใช้ AI ที่มีอยู่ · กำลังต่อ chain) · gates: **vitest 10 files 104/104 · eslint 0 · esbuild OK · guard 1348 ไฟล์** (เดิม R24 · **โพสตั้เวลา 09:00 ICT ขึ้น FB สำเร็จแล้ว** = `provider_post_id 862940416913026_122145661545204867` · published_at 04:27:44Z (11:27 ICT) · **สาเหตุจริง 3 ชั้น**: (1) `social-publish-worker` เก่าเช็ค `content_type!=='post'` แต่ฟอร์ม AdminMarketing มี `'announcement'` (ถูกต้องตาม CNT-01) → `ERR_NOT_A_POST` → **แก้รับ 4 types + deploy แล้ว** (e31 EXIT=0) (2) GH cron ไม่มีรอบ 02:07Z + dispatch แรก Owner ส่ง input ไม่ครอบ marketing (description ไม่ระบุ 'marketing' → skipped) → **เพิ่ม marketing เข้า description** (3) ref ต่อชั่วโมง `gh-mk-%Y%m%dt%H` → dispatch ซ้ำชั่วโมงเดิม = DUPLICATE ไม่เกิดงาน → e35 สร้างแถวใหม่ผ่าน `enqueue_automation_job` → chain จริง → published · **แก้คำพูดผิดตัวเอง**: "automation_queue ว่างหลัง 25 ต.ค." = oracle bug (`LIMIT 12` ไม่มี `ORDER BY` → คืนแถวเก่าสุด — แถวจริงมีครบทุกชั่วโมง) · **R23 พิมพ์** = 98afb9c (vitest print 19/19 · eslint 4 files 0 · esbuild 3/3 · vite build timeout30s→CI) · **R24 CI fix** = `workers/tenant-proxy/src/index.ts:82 catch (e)` ไม่ได้ใช้ (CI `eslint .` ครอบ workers — ผมพลาดตอนสร้าง R22) → `catch` · gates เพิ่ม: marketingClient+g7 **72/72 PASS** · tenant-proxy eslint 0 · **CI 9d51600 = GREEN ทุกขั้น (run 41003832902 · Lint+Unit+Typecheck/Build ✓ · ตรวจเองด้วย GITHUB_TOKEN_BMB)** · (เดิม R22b: m175 APPLIED ledger 175 · sheets-sync DEPLOYED · worker BLOCKED CF token) · **branch:** `main` · อ่าน §0 ก่อนเริ่มงานทุกครั้ง

---

## 0. วิธีใช้ + ลำดับความจริง

1. อ่าน `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → ไฟล์นี้
2. ลำดับความจริง: **โค้ด > migration/DB > runtime evidence > test > เอกสาร**
3. งานที่ยังไม่มีผลรันจริง = `UNVERIFIED` / `BLOCKED` ห้ามเขียนว่าเสร็จ
4. index ของเอกสารที่ถูกย้าย = `docs/archive/INDEX_2026-10-26.md`
5. ถ้าเอกสารเก่า (report/handoff) ขัดกับไฟล์นี้ → ให้ถือไฟล์นี้ + ตรวจสอบโค้ดเสมอ

---

## 1. Canonical current state (ตรวใหม่ทั้งหมด 2026-10-26)

### 1.1 Git / workspace

| รายการ | ค่า (ตรวจจริง 2026-10-26) |
|---|---|
| Repository | `D:\A PROJECT\Bite Me Baby` · remote `git@github.com-bmb:bitemebaby2016-coder/bmb.git` |
| Branch | `main` tracking `origin/main` |
| HEAD ปัจจุบัน ณ เวลาเขียน (2026-10-26 · ปิดเซสหลัง apply 160) | `02b834c` = `origin/main` · CI **#595** · Contract **#169** (ตรวจเมื่อผ่าน) · *(ถ้ามี commit ใหม่กว่านี้ ให้ถือ `git log --oneline -1`)* |
| (ประวัติ) HEAD ก่อนเริ่มงานรอบ reconciliation เช้า 2026-10-26 | `29ed251` = `origin/main` ตอนนั้น — **ค่าเก่า ห้ามถือเป็น HEAD ปัจจุบัน** |
| staged / unstaged | **ว่างทั้งคู่** ตอนเริ่มรอบ · working tree clean · untracked = **0 ไฟล์** |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` — **คงเดิม ไม่ถูกแตะ** |
| งานที่ทำรอบนี้ | ดู §9 (เปลี่ยนเฉพาะไฟล์ที่ระบุ ไม่มี `git add -A`) |

### 1.2 Gates (รันจริงบนเครื่องนี้ · ไม่ได้อ้างจากเอกสารเก่า)

| Gate | คำสั่ง | ผล | Evidence |
|---|---|---|---|
| typecheck | `npx tsc --noEmit` | **exit 0** | รันตรง ๆ 2026-10-26 |
| lint | `npx eslint .` | **exit 0** | `e2e/session20261026-gates-evidence.txt` §6 |
| brand guard | `node scripts/brandNameGuard.cjs` | **OK — ตรวจ 422 ไฟล์** | `e2e/session20261026-gates-evidence.txt` §6b |
| unit/contract | `npx vitest run` | ดูก้อน §5 | `e2e/session20261026-gates-evidence.txt` §2–§5 |
| build | `npm run build` (tsc + vite) | **exit 0** | `e2e/session20261026-gates-evidence.txt` §7 |
| E2E route smoke | `npx playwright test routeNav` | **39/39 passed · exit 0** | `e2e/session20261026-gates-evidence.txt` §8 |
| SQL replay / production | **รันแล้ว (W-1 · 2026-10-26)** — fresh replay 001→157 + เทียบ production แบบ read-only | **VERIFIED** · `REPLAY_ALL_GREEN 157/157` + parity รายงาน drift ครบ (ไม่ใช่ zero-drift) | `e2e/w1-replay-apply-2026-10-26-full.log` · `e2e/w1-parity-2026-10-26.json` · `e2e/w1-parity-report-2026-10-26.md` |
| CI ของ SHA ที่ push จริง | GitHub Actions API (ไม่มี `gh`) | ดูก้อน **§9.0 (ตาราง CI canonical ทุก SHA)** | §9.0 |

### 1.3 Production (reconcile 2026-10-26 รอบปิดงาน)

- **migration 160 (enforce `hours` บน SAME_DAY → `ERR_STORE_CLOSED`) = APPLIED + VERIFIED บน production 2026-10-26 ~23:30 (Owner สั่ง `__apply 160__`)**
  - 4 stage = **ALL_PASS**: precheck (ledger top 159 · ไม่มีของซ้ำ · walg on) → apply 201 → **verify behavior จริง**: `SAMEDAY → ERR_STORE_CLOSED: ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (8:00–20:00)` · `PRE_ORDER → ผ่าน 160` (ไปติด `ERR_PRE_ORDER_REQUIRES_ADDRESS` ของ gate เดิม) · ROLLBACK = ไม่มีมลพิษ → record (ledger top **160**)
  - evidence = `e2e/w8Apply160-{precheck,apply,verify,record}.json` · CI = apply ephemeral ผ่าน (Contract #167/#168)
  - **ROLLBACK (เผื่อเปลี่ยนใจ):** `DROP TRIGGER IF EXISTS trg_shop_hours ON public.orders; DROP FUNCTION IF EXISTS public.enforce_shop_hours();`

- migration ledger ล่าสุดที่มีหลักฐาน apply = **159** — 157 + 158 (Owner อนุมัติ 2026-10-26 ·
  `e2e/w6Apply157158-{precheck,apply157,apply158,verify,record}.json` · parity **ledger 158=158**) +
  **159 (Owner อนุมัติรอบสุดท้าย 2026-10-26 · "อนุมัติ apply production 159")**
- **migration 159 (DROP legacy 6 fn) = APPLIED + VERIFIED บน production (2026-10-26)**
  — staged `e2e/w7Apply159.cjs`: **precheck OK** (6 fn · identity args ตรงจริง · trigger 0 · src caller 0 · backup 9)
  → **apply OK** (pg_proc เหลือ 0) → **verify OK** (products anon 200 · rpc `update_order_status` = 404 PGRST202)
  → **record OK** (**ledger top = 159**) · evidence **`e2e/w7Apply159-{precheck,apply159,verify,record}.json`**
  · ฟังก์ชันทั้ง 6 ไม่ถูก expose บน production อีกแล้ว (ไม่มี src caller อยู่ก่อน = ไม่มีผลข้างเคียง)
- **parity ย่อยหลัง 159 (อ่าน fresh ~22:30 · read-only)** — เทียบ functions/acl_functions กับ local snapshot:
  **onlyProd = 0** (ไม่มีฝั่ง prod ที่ local ไม่มี = **legacy จบจริง**) · onlyLocal = **11** = D3 ชุดเดิม
  (uuid_* ×10 = extension ลง `public`[replay] vs `extensions`[prod] · `get_all_orders_for_admin`[035] src caller
  **NONE** ยืนยันวันนี้) · scope = ชุด fn+3 flags ไม่เทียบ body (ไม่แทนที่รายงาน D เต็ม) →
  `e2e/w1-parityfn-after159-2026-10-26.json`
- **marketing_rules อ่านสำเร็จ (~22:29 · Management API read-only)** `e2e/mrRead-2026-10-26.json` =
  window **10:00–19:00** · cooldown **6** · **3**/สัปดาห์ · content_mix ครบ · menu_rules/stop_conditions = `{}`
  → **ค่า = VERIFIED ใหม่** (anon ยัง 42501 = เรื่องสิทธิ์คนละเรื่อง) · **C7/C8 ขั้นรัน = NOT RUN**
- **probe re-read 2026-10-26 (read-only, anon): ไม่สำเร็จ** — REST root = 401 · `marketing_rules` =
  **42501 (anon ไม่มี SELECT)** → **update: ต่อมา ~22:29 อ่านสำเร็จผ่าน Management API แล้ว — ดู bullet
  "marketing_rules อ่านสำเร็จ" ข้างล่าง** (42501 ยังเป็นเรื่องสิทธิ์ anon = คนละเรื่องกับตัวค่า)
- **Cloudflare Pages / deploy (ทำตาม task 5):** CI Pages job = **success** (67f10b8 + 5f891de) ·
  **serving marker ตรวจ 2026-10-26: `btn-locked` (โค้ดใหม่เฉพาะ 67f10b8) พบใน CSS จริง
  (`index-DZpLzxJE.css` · 146KB · 200) + ใน index JS จริง (`index-KR2tYugD.js` · 200) = SERVING ≥ 67f10b8 ✓ VERIFIED**
  · `bitemebaby-5f7.pages.dev` = fetch ไม่ได้ (ตรงเอกสาร "ลบแล้ว") · *ชื่อ asset ≠ local dist
  เพราะ env inlining/คนละ build machine — ไม่ใช่หลักฐาน stale* · *build id/timestamp อ่านไม่ได้จาก SPA shell*
- **production write ที่ทำ = apply 159 เท่านั้น** (Owner อนุมัติ 2026-10-26 · staged `w7Apply159.cjs`) — ไม่มี write อื่น *(ณ รอบ reconcile 2026-10-26 · หลังจากนั้น = apply 160/161/162/163 — ดู bullet ท้าย §1.3)*
- **Backlog settings-sync audit (2026-10-27):** ปิดฝั่งโค้ดครบ **13 key** (write/read path จริงทุกตัว — hours · operating_hours · delivery_policy · kitchen_location · order_pattern · order_policy · promotion · loyalty · referral · spin · push_config · social_links · theater_daily_copy · **missing = 0**) · evidence **`e2e/backlogAudit-settings-sync-2026-10-27.json`** · runtime spot-check ด้วยมือ = `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` §15 · คู่มือสอนทดสอบทุก role = ไฟล์เดียวกัน (§3–§13)
- **migration 161 (R10) · 162 (R10) · 163 (R11) = APPLIED บน production 2026-10-27 รอบดึก (Owner สั่ง apply 163)** — 163 = `e2e/r11Apply163.cjs` 4 stage ผ่าน (precheck → apply → verify `pg_proc` 4 ฟังก์ชัน + `arrived_at`/`checkin_*` col → record ledger **161/162/163** ครบ · backfill 161/162 ที่ R10 apply แต่ไม่ได้ record) · evidence `e2e/r11Apply163-result.json` (+ `r10Apply161/162-result.json`) · **ledger top = 163** (อัปเดตแทนค่า "159/160" ด้านบน) · ยืนยันซ้ำด้วย `e2e/migHistory.cjs` (read-only) · **รอ Owner retest flow ไรเดอร์ทีละสเตป** = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27B.md` §2 (ก)
- **R12 (2026-10-28 · Owner สั่งหลัง retest R11):** **ทุกหน้าขึ้นจากด้านบนเสมอ เว้นแต่ติดเงื่อนไข deep-link** — Layout scroll rule ใหม่ใน `Layout.tsx` (fire ทุกครั้งที่ pathname/search/hash เปลี่ยน · `#hash` ที่มี element จริง = scroll ไป section · ไม่มี = ขึ้นบน <main>+window) · **LINE กลับมา** — restore ค่าจริงที่ admin ตั้งใน `business_settings.social_links` (`line=https://line.me/ti/p/QFD3bSMFN9` · `line_id=bitemebaby2016`) + DEFAULT `socialLinks.ts` ตรงกัน (แก้ได้ที่ AdminSettings · evidence `e2e/r12RestoreLine-result.json`) · **ฟุตเตอร์ลิงก์ครบจริง** — guard `src/__tests__/footerLinksReal.test.ts` (ทุก path มี Route) · **deep-link B (กระดิ่ง + notification center) wiring guard** — รอ Owner retest
- **R12b (2026-10-28 รอบ 2 · Owner สั่ง 5 ข้อ) = แก้/APPLIED แล้ว:** migration 164 — anon+authenticated เห็น business_settings ทั้งหมด (policy `business_settings_public_read` SELECT USING true · เขียนยัง admin-only · ledger 164 · evidence `e2e/r12Apply164-result.json`) → ผู้เยี่ยมชมเห็นค่าจริงที่ admin ตั้งตั้งแต่แรก (LINE/social/hours ใช้ได้จริง) · **แถบสถานะหน้าแรก**: เหลือ "🟢 เปิดรับออเดอร์ เซมเดย์" (ตัดข้อความวงเล็บทั้งหมด — "📅 พรีออเดอร์: เปิดรับรอบ เที่ยง (คัทออฟ 09:00)" คงเดิม) · **กรอบโปรโมชั่น**: เท่ากันทุกกรอบ (148px + min-h 120px + line-clamp · รวมกรอบใหม่) · **ภาษา**: ลบ BOM 39 ไฟล์ + ตัวอักษรต่างดาวแล้ว → guard ใหม่ใน `npm run lint` (`languageSanity` 1224 ไฟล์) — รอ Owner retest (list = handoff 27B §4)
- **R12c (2026-10-28 รอบ 3 · Owner ยืนยันใช้ค่า LINE จริง + admin แก้ SEO copy เองได้):** `seo.ts` sync จากค่าจริง — schema `sameAs` ใช้ social จริงจาก `social_links` (LINE `https://line.me/ti/p/QFD3bSMFN9` / `line_id bitemebaby2016` · FB `61586146030943` · handle เก่าในโค้ดถูกถอด) · **SEO copy = admin แก้เองได้** — คีย์ business_settings `seo` = {description, tagline} (migration **165** seed = ค่าเดียวกับ DEFAULT ในโค้ด · APPLIED+VERIFIED production · ledger top **165** · evidence `e2e/r12Apply165-result.json`) · หน้าแรก/meta/JSON-LD อ่านค่าจริงผ่าน `seoSettings.ts` (live store + App `useSyncExternalStore` → meta อัปเดตทันทีที่ admin แก้ · bootstrap fire-and-forget ที่ main.tsx) · AdminSettings ฟอร์ม "🔎 SEO / คำโปรยเว็บ" (คีย์ `seo` กัน generic editor — "1 เรื่อง = 1 ที่") · tests: `seo.test` (sameAs ใช้ค่าจริง · copy override) + `r12SeoAdminCopy.test` (6 ข้อ) — รอ Owner retest (list = 27B §4 (ฉ))
- **R13 (2026-10-28 รอบ 4 · retest: แถบสถานะ/จบลูปไรเดอร์/แจ้งเตือนแอดมิน = คำสั่ง 3 ข้อ):** **ต้นตอจริงพิสูจน์ด้วย probe production** — `drivers.id` มี space+`#` (`drv- ###########-60bc` · hex ยืนยัน) → path รูป POD ถูกตัดที่ `#` → **`pod-photos` bucket = 0 รูป = upload ไม่เคยสำเร็จ → delivered ไม่เคยถึง** (ERR_POD_REQUIRED · driver ค้าง busy) · **"เครื่องยังค้างเดินทาง"** = CHECK `delivery_assignments_status_check` ไม่มี `'arrived'` (163 จึงเขียนแค่ `arrived_at`) · **migration 166 APPLIED+VERIFIED** (ledger top **166** · evidence `e2e/r13Apply166-result.json`): CHECK + `'arrived'` · sanitize path-layer `driver_path_folder` (client/attach/policy เทียบค่าเดียวกัน ไม่แตะ PK/FK) · checkin ตั้ง `assignment.status='arrived'` + self-heal (PO-942 = arrived แล้ว) · **Client**: ป้าย `🏁 ถึงปลายทาง` · delivered สำเร็จ = จบงาน + กลับหน้าจอหลักอัตโนมัติ (scroll) · **แถบสถานะใหม่**: `🟢 เปิดรับออเดอร์ เซมเดย์ : ส่งทันที` + `🟢พรีออเดอร์: เปิดรับออเดอร์ รอบส่งถัดไป <ชื่อรอบ> <DD/MM/YYYY> (คัทออฟ HH:MM)` (บอก "รอบไหนของวันไหน" · ไม่ truncate) · **แจ้งเตือนแอดมิน "ถึงปลายทาง" → `/admin/delivery?focus=<เลข>`** + ตาราง "กำลังเดินทาง/ส่งแล้ว" มีปุ่ม `🏁 แอดมินปิดวงจร` — tests `r13RiderLoopClose` (10 ข้อ) + อัปเดต 4 ไฟล์ — รอ Owner retest ทั้ง 3 ข้อ (list = 27B §4 (จ))
- **Master Test Checklist ใหม่ (2026-10-28) = `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** — รวมรายการที่ยังเหลือทั้งหมด (R9 8 ข้อ · R10 16 จุด · R11-R14 · RT-HOURS · B2 · C7/C8 · settings-sync 14 คีย์ · role guide บท 1-12 · §F-I/L-10/L-11 · เกณฑ์ปิด §16) เป็นไฟล์เดียว — ใช้เป็น list หลักตอน Owner retest (แฮนด์ออฟเดิม = รายละเอียดประกอบ)
- **R14 (Owner retest 2026-10-28 — ครัว/Production Batch):** ต้นตอพิสูจน์ด้วย probe: (1) Batch ID `batch- ###...` = `to_char(epoch_ms,'99999999999')` ล้น 11 หลัก → Postgres คืน `#` (แถวเดิม 3 ใบ = Owner กดสำเร็จจริง 14:08-14:09 แต่ UI โชว์ขยะ) (2) `Invalid Date` = summary RPC ไม่ส่ง created_at (3) **คิวว่าง/ไม่ต่อเนื่อง = `confirm_offline_payment` ตั้งแค่ paid ไม่ hop `pending→confirmed`** (135 paid 14:08:12 แต่ status pending → ครัวมองไม่เห็น) — **167 APPLIED+VERIFIED (ledger 167 · evidence e2e/r14Apply167-result.json)**: id = `::bigint::text` (probe =batch-1793173199630-47a00b digits ✓) · summary/queue +created_at (guard admin|kitchen) · confirm hop ผ่าน transition canonical (allow-list+audit+INV+notify) + **self-heal 135 → confirmed (pipeline มีงานแล้ว)** · Client: ตาราง id เต็ม + formatBatchCreatedAt กัน Invalid Date · createBatch คืนเหตุจริง (toast บอก ERR) · typos กรุา/สำเรจ/หลด · tests r14KitchenBatchLoop (7) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
- **R15 (Owner retest 2026-10-28 — ปิดวงจรให้เห็นจริง + แจ้งเตือนลงจุด + เริ่มผลิตเด้งมอบหมาย):** **server auto-close = PROVEN ทำงานแล้ว** (probe `e2e/r15ProbeB-result.json`: 135 = order+assignment `delivered` เวลาเดียวกันเป๊ะ `.443277` · driver กลับ `available` · POD `drv--60bc/...jpg`) — "ค้าง" ที่เห็น = **หน้า delivery โหลด orders ครั้งเดียว** (interval เดิม refresh แค่ positions ไรเดอร์) → Client: (1) **poll เงียบ 20 วิ + visibilitychange refetch** (2) `?focus=` จากแจ้งเตือน = **refetch เสมอ + scrollIntoView แถวกลางจอ** (`data-focus-row` 2 ตาราง + retry ถ้าแถวยังไม่มา) (3) AdminKitchen **"🔥 สร้าง Batch" (เริ่มผลิต — Owner ยืนยันปุ่มนี้) → `navigate('/admin/delivery')`** ทันที · tests `r15DeliveryLiveRefresh` (6) · **ไม่มี migration** (server ครบแล้ว)
- **R16 (Owner retest 2026-10-28 — strip เท่า+สีจริง · ปิดรอบ · แผนที่+route · ไรเดอร์หลายงาน):** ① `StoreStatusStrip` สองบรรทัด font เท่ากัน (ไม่ truncate) + สีรายสายผ่าน `sameDayOpen`/`preOrderOpen` (homeProviders 4 return sites) ② **"คัทออฟ"→"ปิดรอบ" 102 จุด/17 ไฟล์ src = 0 เหลือ** (label+tests swap ตาม) ③ **migration 168 APPLIED+PROD** (`e2e/r16Apply168-result.json`: ledger 168 · delivered→available **conditional** `NOT EXISTS งานค้าง IN (...arrived)` · POD/geofence/sync คงเดิม · ACL เท่า 163) — งานซ้ำ accept/assign/claim ไม่ถูกบล็อกอยู่แล้ว ④ route: `src/lib/deliveryPlan.ts` (NN + legKm + `googleMapsDirUrl`) + การ์ด "🗺️ เส้นทางส่งของวันนี้" (RiderPwaPage) + RiderMiniMap `stops` 1..N + polyline + ปุ่มเปิดนำทาง · tests `r16MultiJobRiderStrip` (15)
- **R21 (2026-10-29 · เฟส 2 Core Business Logic + ระบบพิมพ์เข้าครัว — ตามคำสั่ง Owner):**
  - **ต้นทุน/กำไร (✅ migration 170 APPLIED + VERIFIED บน production · ledger top = **170** · evidence `e2e/r21Apply170-result.json` = ALL_PASS 8 ข้อ · re-run ปลอดภัย):** migration **170_product_cost_margin_fields.sql** =`products.cogs`/`packaging_cost`/`other_unit_cost` (NUMERIC >= 0 + CHECK) + `unit_cost` **GENERATED** (ผลรวม 3 ตัว) · client `src/lib/marginCalc.ts` (`computeMargin`/`computeOrderProfit`/`formatPct`/tier: ขาดทุน <=0 · กำไรบาง <15 · กำไรดี <50 · กำไรสูง >=50) · ฟอร์ม `AdminProducts` มี 3 ช่องกรอกต้นทุน + **แผงกำไรคำนวณสด** (`data-testid=product-margin-panel`) · test `src/__tests__/marginCalc.test.ts` (13 ข้อ)
  - **guardrail ส่วนลด 15%:** `src/lib/discountGuardrail.ts` = คูปอง + แต้ม + referral รวมกันต้องไม่เกิน 15% ของยอดรวมสินค้า · `CheckoutPage` โชว์ `data-testid=discount-guardrail` (ข้อความไทย + ตัวเลขเกิน/เพดาน) และ **บล็อกปุ่มยืนยันสั่งซื้อ** ตอนเกิน · **server-side cap = งานต่อ (P2)** เพราะ RPC ยัง re-price ตาม promo เดิม · test `src/__tests__/discountGuardrail.test.ts` (10 ข้อ)
  - **ระบบพิมพ์ใบสั่งอาหารเข้าครัว (พัฒนาจากของเดิม — ไม่สร้างเทมเพลตใหม่):** ทะเบียนเครื่องพิมพ์เก็บใน business_settings `print_settings` (แอดมินเพิ่ม/ลบ/ผูก "ใบเสร็จ"/"ใบสั่งครัว" เอง · preset **Nimbot B1Pro** 50 มม.) — pure helpers `createPrinterDef`/`upsertPrinter`/`removePrinter`/`assignPrinter`/`resolvePrinter`/`describePrinterTarget` + `buildPrintOrderData` (แปลงแถวออเดอร์จริง -> payload เทมเพลต) + `printOrderTicket` (enqueue idempotent -> render ด้วย `buildReceiptHtml`/`buildKitchenTicketHtml` เดิม -> mark `sent`/`failed`) · `AdminPrintSettings` มีตาราง registry + ทดสอบรายเครื่อง + บรรทัดสรุปเครื่องที่ผูกไว้ · **`AdminOrders`: กดยืนยันออเดอร์ -> auto-print ใบสั่งครัว** (respect `autoPrintKitchen` · พังไม่กระทบออเดอร์) + ปุ่ม `🧾 พิมพ์ใบเสร็จ` / `🍜 พิมพ์ใบสั่งครัว` ต่อแถวออเดอร์ · หมายเหตุซื่อสัตย์: เบราว์เซอร์เป็นคนเลือกเครื่องจริง (ตั้ง Nimbot เป็น default printer ของ Windows หรือเลือกในไดอะล็อก) · test `src/__tests__/printerRegistry.test.ts` (11 ข้อ)
  - **gates รอบนี้:** tsc 0 · lint 0 (`e2e/gates_r21_lint.log` · 459 ไฟล์) · **vitest 167 files / 1,724 tests / 0 fail** (`e2e/gates_r21_vitest.log`) · build 0 (`e2e/gates_r21_build.log`)
  - **เฟส 3 (UI/UX edge cases · แก้แล้ว):** "หน้าเงียบตอนโหลดล้มเหลว" ถูกแทนด้วย banner กลาง **`src/components/ui/LoadErrorBanner.tsx`** (role=alert + ปุ่ม ลองใหม่ = refetch จริง) ที่ **6 หน้า**: `HomePage` · `MenuPage` · `OrdersPage` (ซ่อนข้อความ "ยังไม่มีออเดอร์" ระหว่าง error) · `NotificationCenterPage` (**เดิมไม่มี try/catch → ค้าง "กำลังโหลด…" ตลอดกาล**) · `AdminKitchen` · `AdminProducts` · test `loadErrorBanner.test.ts` (5 ข้อ) · **gates เฟส 3 = tsc 0 · lint 0 (`gates_r21b_lint.log`) · vitest 168 files / 1,729 tests / 0 fail (`gates_r21b_vitest.log`) · build 0** · **backlog 12 หน้า = QA review §เฟส 3**
  - **เฟส 1 แก้ครบ A1-A8 (2026-10-29):** `probeProfileRole()` 3 สถานะ — เน็ตหลุดไม่เตะ admin ออก (A1 · banner `admin-route-role-error`) · AdminRoute `state.from` (A2) + fast-path storeRole (A6) · returnTo ก่อนเสมอ (A3) · logout try/finally (A4) · login*/refreshRole try/catch + คง role เดิม (A5) · **migration 171 `my_role()` APPLIED production — ledger top=171 · `e2e/r21cApply171-result.json` ALL_PASS** (A7) · ลบ `isAdmin()` dead code (A8) · test `authProbeRoles.test.ts` (10)
  - **เฟส 4 (PWA/EF/responsive):** PWA ทำงานครบแล้ว (vite-plugin-pwa injectManifest + `src/sw.ts` เขียนเอง · dist มี sw.js/registerSW.js/manifest.webmanifest) — **ลบ `public/manifest.json` ซ้ำ** (dist เคย ship 2 manifests) · **EF CORS: image-gen/queue-enqueue/push-send OPTIONS ตอบ 200 เปล่าไม่มีหัว CORS (live probe production ก่อนแก้) → แก้ + `supabase functions deploy` production แล้ว · probe หลังแก้ ACAO ✓** (`e2e/efOptions-image-gen*.txt`) · responsive = static audit ผ่าน (viewport + safe-area BottomNav)
  - **4 คำสั่ง Owner (ทำแล้ว):** ①ทีมครัวกดแจ้งเตือนออเดอร์ใหม่/ยืนยันแล้ว → `/admin/kitchen` (`notificationLinks.ts` role=kitchen) ②สต็อกรวมทุก round: เริ่ม `preparing` = **`deduct_inventory_for_order` RPC เดียว** (SAME_DAY+PRE_ORDER) + `cancel_order` คืนสต็อก (atomic เดิม) ③**ประตูตรวจสลิปก่อนรับออเดอร์**: modal โชว์รูปจริง (SlipThumb) + `paymentConfirmability` → "ยืนยันสลิป & รับออเดอร์" = `confirm_offline_payment` ตัวเดิม → accept ④ครัว "พร้อมส่ง" → **`/admin/delivery?focus=<เลข>`** ไฮไลต์แถว
  - **R21f (5 คำสั่ง Owner · 2026-10-29):** **parity = ไม่มี migration ค้าง** (local numbered 173 = ledger 173 ขาด/เกิน 0 · `r21fMigParity.cjs`) · **m174 `order_rider_position`** = แผนที่ตำแหน่งไรเดอร์หน้าลูกค้า `/track/:orderNumber` (SECURITY DEFINER เฉพาะเจ้าของ · poll 12 วิ · `riderPositionApi.ts`) · ไรเดอร์: ปุ่ม 🧭 นำทางรายจุด (route card) + 🧭 จุดส่งของงานนี้ (active job) · `/admin/recipes`: dropdown จาก `getInventory()` ทั้งคลัง + การ์ด "เมนูที่ยังไม่มีสูตร" (สินค้าใหม่โผล่เอง) · **fix เวลาเปิด/ปิดหน้าแรก** = root cause dead UI `branches.operating_hours` → mirror เข้า `business_settings.hours` ตอน saveBranch · TEST_PACK = §M M13-M16
  - **R21e (P2 server cap + cosmetic ปิดหมด · Owner "ทำงานค้างให้หมด") — ✅ APPLIED production:** **m172** = cap ส่วนลดรวม 15% ฝั่ง server (`promotion_apply_rules` (4c) · contract 153+154 อัปเดตตามกติกา) · **m173** = id ord-/osh-/notif- = bigint::text (หลักฐาน production `r21eProdIdProbe.json`: id จริง `ord- ###########-xxxxxx`) — **`e2e/r21eApply172-result.json` + `r21eApply173-result.json` = ALL_PASS · ledger top=173 · probe หลังแก้ `has_cap=true`** · Contract #214 + CI #640 เขียว (m172/173 พิสูจน์บน PG จริง) · haversine 3→1 (canonical `deliveryRouter`) · confirmOfflinePayment 2→1 (canonical `paymentGateway`) · generator = `e2e/r21eGen173.cjs` · TEST_PACK = §M M1-M12
  - **gates รวมเฟส 1-4:** tsc 0 · lint 0 (462 ไฟล์ · languageSanity 1,284) · **vitest 169 files / 1,740 tests / 0 fail** · build 0 (`e2e/gates_r21b_*.log`)
  - **R21d (backlog 12 หน้า · ปิดรายการเฟส 3):** `LoadErrorBanner` + ปิดข้อความ empty ปลอม (`!loadError`) ครบ 12 หน้า — DeliveryManagement(โหลดแรกเท่านั้น · silent refresh ไม่ปล่อย banner) · AdminRounds · InventoryPage · AuditLogPage(query error แยกดัก) · AdminPaymentExceptions · AdminRecipes · AdminBrands(bRes.error แยกดัก) · AdminAssetAudit · AdminPortfolio · AdminTenants · VotePage · ReviewPage — source-contract 4 หน้าหลักผ่าน · probe = `e2e/r21dProbe.cjs` · รายละเอียด = QA review §รอบ R21d
- **R20 (Owner สั่ง `__apply 169__` 2026-10-29) = migration 169 APPLIED + VERIFIED บน production**
  - คำสั่ง = Owner พิมพ์ `__apply 169__` (สิทธิ์ apply production ของ Owner เท่านั้น) · script = `e2e/r19Apply169.cjs` (แบบ `r*Apply*.cjs` เดิม · Management API `/database/query`)
  - 4 stage = precheck (ledger top **168** · def เดิมของ 166 ยังไม่ decode `%XX` · probe `space_eq=false`) → apply `supabase/migrations/169_pod_path_percent_encoding.sql` → **verify พฤติกรรมจริง**: `driver_path_folder('drv-%20c139-60bc') = driver_path_folder('drv- c139-60bc')` = **true** (ก่อน apply = false) · `%23`↔`#` = true · mixed = true · def ใหม่มี `(%[0-9A-Fa-f]{2})+` + `[^A-Za-z0-9_-]` · `pod_path_is_driver` = SECURITY DEFINER + STABLE + เรียก `driver_path_folder` ✓ → record (**ledger top = 169**)
  - evidence = **`e2e/r19Apply169-result.json`** + **`e2e/r19Verify169-result.json`** (ยืนยัน def/behavior/ledger หลัง apply)
  - **ผล = production ไม่บล็อก path แบบ `%20`/`%23` อีกต่อไป** (RLS storage.objects ผ่าน) · re-run ปลอดภัย (CREATE OR REPLACE ทั้งคู่)
- **R21 (Owner สั่ง "อัปเดตตาราง products ให้มีฟิลด์ cogs" 2026-10-29) = migration 170 APPLIED + VERIFIED บน production**
  - script = `e2e/r21Apply170.cjs` (แบบ 4 stage เดิม) · evidence = **`e2e/r21Apply170-result.json`** = **ALL_PASS**
  - ตรวจ = คอลัมน์ครบ 4 (`cogs`/`packaging_cost`/`other_unit_cost`/`unit_cost`) · `unit_cost` = **GENERATED ALWAYS** · CHECK `products_cost_fields_nonneg` อยู่ · **UPDATE grant ไม่เปลี่ยน** · แถวข้อมูลเดิมไม่มีค่าติดลบ · `unit_cost` = ผลรวมจริงทุกแถว · ledger top = **170**
- คำสั่งตรวจ ledger รอบถัดไป (read-only): `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3` → top = **160** ณ 2026-10-26 (160 APPLIED ดู §1.3 บน) *(อัปเดต 2026-10-27: top = **163** · อัปเดต 2026-10-28: **168** · **อัปเดต 2026-10-29 (R20): top = 169** · **อัปเดต 2026-10-29 (R21): top = 170** — ดู bullet R20/R21 ข้างบน)*

---

## 2. Canonical Capability Matrix

> 1 capability = 1 `capability_id` = 1 canonical entry = 1 data authority
> สถานะ: `IMPLEMENTED` (โค้ดมี) · `TESTED` (มีผลรัน test จริง) · `DEPLOYED` (apply แล้วมีหลักฐาน)
> · `RUNTIME VERIFIED` (ตรวจบน production แล้ว) · `DOCUMENTED` · `MISSING` · `BLOCKED` · `DEFERRED`

| capability_id | ความต้องการ | Canonical UI entry | Canonical authority | Tests / evidence | สถานะ |
|---|---|---|---|---|---|
| CAP-01 | สั่งซื้อทั้ง 2 โหมดมีเส้นทางเดียว (same-day/pre-order) | ปุ่ม "สั่งเลย/จองล่วงหน้า" ทุกใบ (หน้าแรก + `/menu`) | **`src/lib/orderEntry.ts` → `runOrderBuilder`** (ใหม่ 2026-10-26) | `menuCartResultGuard`, `homeMenuAdminOrdering`, `homePreOrderModeGuard`, `checkoutModeLock` | IMPLEMENTED + TESTED |
| CAP-02 | ตะกร้าเดียว + mode ต่อ line (ไม่สลับ/ไม่ล้าง) | `/cart` → `/checkout` | `src/store/cartStore.ts` (`deriveCartMode`) | `cartIsolationStore`, `cartLineIdentity`, `cartPersistence` | IMPLEMENTED + TESTED |
| CAP-03 | สร้างออเดอร์ = server เท่านั้น (กัน double-submit) | `/checkout` | RPC `create_order_with_items` / `_i` (007/020/025/124) | `canonicalOrderFlow`, `orderSubmitKey`, contract CI SQL | IMPLEMENTED + TESTED · DEPLOYED (ledger 156) |
| CAP-04 | SAME_DAY ไม่มี cutoff · PRE_ORDER มี cutoff ตาม policy | แถบสถานะ + เลือกรอบใน checkout | server 143/148 + `src/lib/orderPolicy.ts` + `deliveryRoundStatus.ts` | `roundsSameDayNoCutoff` (16), `orderPolicy`, contract 143/148 | IMPLEMENTED + TESTED · DEPLOYED |
| CAP-05 | เมนูแอดมินชุดเดียว (ไม่ซ้ำ) | Sidebar/Drawer เดียว · 5 กลุ่ม / 19 รายการ | `src/lib/adminUi.ts` `ADMIN_NAV_GROUPS` (flat derive จาก groups) | `adminUi`, `adminNavFeedback`, `adminShell` | IMPLEMENTED + TESTED |
| CAP-06 | รวมหน้าแอดมินที่ซ้ำ/ใกล้เคียงเป็น Hub | `/admin/orders` `/admin/products` `/admin/delivery` `/admin/settings` `/admin/tenants` (+ redirect เส้นเก่า) | `src/components/admin/AdminHubs.tsx` | `adminPreOrdersConsolidation`, routeNav | IMPLEMENTED + TESTED |
| CAP-07 | ศูนย์ขนส่งเดียว 5 แท็บ | `/admin/delivery` (rounds/availability/dispatch/routes/fees) | `AdminHubs.DeliveryHub` + `bmbAdminApi_rounds`/`driverService` | `deliveryRoundStatus`, `dispatchContract`, `roundArchiveAdmin` | IMPLEMENTED + TESTED |
| CAP-08 | settings มี authority เดียวต่อค่า | `/admin/settings` | `business_settings` ผ่าน `bmbAdminApi_settings` · typed forms (`TYPED_FORM_KEYS`) · `platformConfig` = fallback เท่านั้น | `adminSettingsTypedKeys`, `configAuthorityMap` (+ เคส D14 ใหม่) | IMPLEMENTED + TESTED |
| CAP-09 | แพทเทิร์นรอบ 3 รอบ/วัน + รอบรายวัน | `/admin/delivery?tab=rounds` | migration 144 + `bmbAdminApi_rounds` | `menuScheduleRoundLink`, `roundsAuditGuards`, contract 144 | IMPLEMENTED + TESTED · DEPLOYED |
| CAP-10 | แอดมินตรวจสลิปได้จริง (อ่าน payment_intents ได้) | OrdersHub → แท็บ "การชำระเงิน/ตรวจสลิป" | migration **138** (RPC `get_payment_intents_for_orders` + GRANT) | `paymentReadAuthority`, `paymentIntentsSingleRead`, `slipReviewPanel` | IMPLEMENTED + TESTED · runtime = รอ Owner |
| CAP-11 | Rider POD อัปโหลดรูปได้จริง | `/rider` | migration **139** (policy `pod_photos_driver_upload` ใหม่) | `riderPodCrossBrowser`, `riderFullCycle`, `driverActionResults` | IMPLEMENTED + TESTED · runtime = รอ Owner/rider |
| CAP-12 | notification badge อ่านค่าตรง | หน้าลูกค้า + แผงแอดมิน | `notificationReconciliation` (client) | `notificationReconciliation.test` | IMPLEMENTED + TESTED |
| CAP-13 | Web push จริง | PWA | `pushTransport` + `sw.ts` | `pushTransport.test` | IMPLEMENTED + TESTED · RUNTIME = รออุปกรณ์ Owner |
| CAP-14 | SMS จริง | edge/worker | `smsTransport` | `smsTransport.test` + `docs/BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` | IMPLEMENTED + TESTED · RUNTIME = UNVERIFIED |
| CAP-15 | สิทธิ์/เมนูตาม role | ทุก `/admin` | `ADMIN_CAPABLE_ROLES` + `navGroupsForRole` + RLS | `roleMatrixCoverage`, `roleSystem` | IMPLEMENTED + TESTED |
| CAP-16 | พิมพ์ใบเสร็จ/thermal | `/admin/settings?tab=print` | migration 128 + `printService` | `printTemplates` | IMPLEMENTED + TESTED · **R-16 = Owner ทำเอง** |
| CAP-17 | backup + restore drill | — | `dbBackupHelpers` / `dbRestoreDrill` | `dbRestoreDrill: PASS` (หลักฐานรอบก่อน) | IMPLEMENTED + TESTED |
| CAP-18 | Maps ในหน้าแอดมิน/ไรเดอร์ | `/admin/delivery?tab=routes` | `src/lib/googleMaps.ts` — key อ่านตอน **build** (`VITE_GOOGLE_MAPS_API_KEY`) | ไม่มี unit test runtime · Owner ตั้ง key ใน Cloudflare แล้ว | IMPLEMENTED · RUNTIME UNVERIFIED (ต้อง deploy ใหม่หลังตั้งค่า) |
| CAP-19 | Growth & Rewards (promotions/referral/points/spin/affiliate/catalog) | — | migrations 153–156 | contract 153–156 (รอบก่อน) | **DOCUMENTED + DEPLOYED · acceptance §4 รอ Owner** |
| CAP-20 | ไม่มี dead code ค้าง | — | เอาออก 11 ไฟล์ (2026-10-26) | เกตทั้งหมดเขียวหลังลบ (§5) | CLOSED (รอบนี้) |
| CAP-21 | ระบบจำลูกค้า/เจาะกลุ่มอัตโนมัติ (audit D11) | `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม/คำสรุป) | **`src/lib/customerIntelligence.ts`** — คำนวณจากสถิติออเดอร์จริงทุกครั้งที่โหลด · **ไม่มีช่องให้แอดมินตั้ง** · ไม่มี localStorage | `customerIntelligence.test.ts` (11 เคส รวม AUTOMATIC contract) | **IMPLEMENTED + TESTED (2026-10-26 · รอบปิด backlog)** |
| CAP-22 | AI Studio เลือกเวลา + โพสต์อัตโนมัติเต็มรูปแบบ | `/admin/marketing?tab=calendar` → ปุ่ม "🤖 ให้ AI เลือกเวลาทั้งหมด" | **`src/lib/marketingAutoSchedule.ts`** (เลือกเวลาจาก marketing_rules จริง) → RPC `marketing_schedule_post` เดิม → worker `marketing_publish` รายชั่วโมงตัวเดิม · **ไม่มี publish path ใหม่ · ห้าม auto-approve** | `marketingAutoSchedule.test.ts` (12 เคส + contract CNT-01/G7) | IMPLEMENTED + TESTED · **ยังไม่พร้อมทดสอบจริงจนกว่า Owner จะตั้ง `marketing_rules` ให้ครบก่อน** (คำสั่ง 2026-10-26: "กำหนดให้พร้อมก่อนทดสอบระบบจริง") |

---

## 3. Engineering backlog — ปิด 5/5 + **B-6 ปิดแล้ว** · งานค้าง = UI 5 ข้อ + legacy 6 functions

> คำสั่ง Owner 2026-10-26 "ปิดให้หมดโดยสมบูรณ์" → B-1/B-3/B-4/B-5 ปิดรอบที่ 2 ·
> **B-2 ปิดรอบที่ 3** (ซ่อมครบ 7 ไฟล์บน replay ท้องถิ่น **ก่อน** เพิ่ม step กลับ CI · CI #577/#151 = success) ·
> **B-6 (P0) ปิดรอบที่ 3** (apply 157+158 แล้ว + guest เห็นเมนูจริง) ·
> **งานค้างตอนนี้ = UI 5 ข้อ + legacy functions 6 ตัว (รอ Owner เลือก)**

| # | งาน (สถานะก่อนรอบนี้) | ผล | หลักฐาน |
|---|---|---|---|
| **B-1** | `orderTimeline.test.ts` flaky ตอนรันชุดใหญ่ (4 เคส) | render + flush ข้างใน `act()` ให้รอ React commit จริง — **assertion ทุกตัวคงเดิม ไม่มี skip/ลดข้อกำหนด** | `src/__tests__/orderTimeline.test.ts` (มี comment ระบุ B-1 FIX) · vitest ทั้งชุดเขียว |
| **B-2** | legacy contract 7 ตัว อยู่นอก CI | **BLOCKED — ลองแล้ว 2 ครั้ง (กติกา 0.9: หยุด)** · ครั้งที่ 1 เพิ่ม step ใน CI = **ล้มเหลวทั้ง 7 ไฟล์** (Contract Tests #147 failure) · ครั้งที่ 2 ซ่อมตามหลักฐาน + ตรวจด้วย replay ท้องถิ่น = **ยังเขียวแค่ 1/7 (029)** → rollback ทั้งหมดเพื่อคืน main เป็นเขียว | **หลักฐาน:** annotations ของ run `40266375919` (7 error บรรทัด) + `D:\tmp\legacy_local.log` / `legacy_local2.log` (ผลรัน 7 ไฟล์ 2 รอบ) · ** blocker:** fixture ต้องมี auth user/role จริง · signature/geometry/ACL drift ตาม migration ยุคใหม่ → ต้องซ่อมบน DB session ที่ verify ได้ หรือ **ปลดระเบียบอย่างเป็นทางการ**โดยชี้ว่า 123/124/146/147/148/149 คือ contract ยุคใหม่ของ domain เดียวกัน (**รอ Owner เลือก (ก) หรือ (ข)**) |
| **B-3** | CAP-21 ระบบจำลูกค้า/เจาะกลุ่มอัตโนมัติ (MISSING) | สร้าง `src/lib/customerIntelligence.ts` + ต่อ `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม) · **คำนวณอัตโนมัติ ไม่มีช่องให้แอดมินตั้ง** | `src/__tests__/customerIntelligence.test.ts` (11 เคส) |
| **B-4** | CAP-22 AI เลือกเวลา/โพสอัตโนมัติ (DEFERRED) | สร้าง `src/lib/marketingAutoSchedule.ts` (เลือกเวลาจาก marketing_rules จริง) + ปุ่มในแท็บปฏิทิน · **คงกติกา: ห้าม auto-approve · ไม่มี publish path ใหม่** | `src/__tests__/marketingAutoSchedule.test.ts` (12 เคส + CNT-01/G7 contract) |
| **B-5** | runtime จริงของ CAP-10/11/13/14/18 | **ส่งมอบเป็นชุดทดสอบเดียวให้ Owner รันบน production** | **`docs/BMB_PRODUCTION_TEST_PACK.md`** (ขั้น A–K ครบทุก checklist ที่เคยกระจาย) |

> **ยังเหลือ engineering blocker 2 ตัว — "เหลือ Owner อย่างเดียว" ยังไม่เป็นจริง (Owner 2026-10-26):**
> **(1) B-2 = BLOCKED** (legacy contract 7 ตัว · สั่งใหม่ให้ปิดในแชทถัดไป) ·
> **(2) schema parity fresh-replay vs production = UNVERIFIED** (อนุมัติแล้วแต่ยังไม่รัน) —
> ปิด/พิสูจน์ทั้งสองข้อนี้ก่อน จึงค่อยพูดได้ว่าเหลือแต่งาน Owner ·
> Owner acceptance ที่รันได้แล้ว = §7 → `docs/BMB_PRODUCTION_TEST_PACK.md`

---

## 3.1 งานที่สั่งใหม่รอบ 2026-10-26 (รอบที่ 2) — **แฮนด์ออฟทั้งหมดไปแชทถัดไป**

> คำสั่งปิดท้าย: "ไม่ต้องรื้อระบบ · อัปเดตเอกสารให้มีสถานะปัจจุบันชุดเดียวก่อน (รวมงานที่ตอบและสั่งใหม่)
> แล้วค่อยแฮนด์ออฟงานทั้งหมดไปทำแชทหน้า" → รายการนี้ = scope ของแชทถัดไป (มี handoff ฉบับเต็มที่
> `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md`)

| # | งาน | สถานะตอนนี้ | เงื่อนไข/เกณฑ์ |
|---|---|---|---|
| N-1 | **fresh replay เทียบ production** | **ปิดแล้ว (W-1 · 2026-10-26)** — `REPLAY_ALL_GREEN 157/157` + parity รันแล้ว | drift 5 กลุ่มมีคำอธิบาย/แผนครบ → `e2e/w1-parity-report-2026-10-26.md` · §4/§5 = VERIFIED · ~~เหลือแผน 3 ข้อรอ Owner อนุมัติ (§L L-10)~~ **ปิดครบ — 159 APPLIED 2026-10-26** (parity ย่อยหลัง 159 รันแล้ว: functions/acl **onlyProd = 0** · เหลือ local-only 11 = D3 เดิม · evidence `e2e/w1-parityfn-after159-2026-10-26.json`) |
| N-2 | **Legacy SQL contracts 7 ไฟล์ (B-2) "ปิดด้วย"** | **ปิดแล้ว (W-2 · 2026-10-26)** — 7/7 EXIT=0 บน replay ท้องถิ่น (ทั้งรอบ reproduce และรอบ fresh 157) · step กลับเข้า CI แล้ว | ยืนยันด้วย Contract Tests success + บรรทัด `Legacy contracts OK — 7/7` (test pack A2) |
| N-3 | **CAP-22 ให้พร้อมก่อนทดสอบจริง** | **พบว่ามีค่าจริงอยู่แล้ว** (query read-only 2026-10-26): window 10:00–19:00 · cooldown 6 ชม. · 3 โพสต์/สัปดาห์ · content_mix 40/30/20/10 | → **C7/C8 ปลดล็อกได้** · `menu_rules`/`stop_conditions` ยังว่าง = ทางเลือก (§L L-12) |
| N-4 | **UI ฝั่งลูกค้า (ชุดใหญ่ 9 ข้อ)** | **ปิดครบ 9/9 ฝั่งโค้ด** = ข้อ 1 · 2 · 6 · 9 (รอบก่อน) + 3 · 4 · 5 · 7 · 8 (2026-10-26 · test รายข้อ · gates ALL ZERO · CI `67f10b8` #585/#159) | เหลือแค่ **runtime verify = test pack §L-RT** (ไม่ใช่งานค้าง) · ห้ามรื้อระบบ แก้เป็นจุด ๆ |
| N-5 | **Test pack = เกณฑ์ต้องตรงความจริง** | **แก้แล้ว** + ตรวจซ้ำรอบนี้ (§0/§L ตรงกับสิ่งที่ปิดจริง) | ห้ามสั่งตรวจสิ่งที่ยังไม่สำเร็จว่าต้องผ่าน |

### N-4 · รายการ UI ฝั่งลูกค้า (ถอดคำสั่ง Owner ตรง ๆ — ห้ามตกข้อ)

1. **หัวข้อ "BITE · AI WAITER STAGE" ห้ามแสดง** — เริ่มจาก "เมนูพร้อมขายวันนี้" เลย · ห้ามข้อความเชิงสั่งงาน/
   เชิงเทคนิค/ที่ผู้ใช้ไม่จำเป็นต้องเห็น · **ไทยธรรมชาติ 100%** ยกเว้นคำอังกฤษที่คนเข้าใจง่ายจริง
2. **ป้าย "(Marketing Testimonials)" ห้ามแสดง** (หัวข้อเสียงชมจากผู้ชม = ใช้ข้อความธรรมชาติ)
3. **จิ้มแล้วต้องเลื่อน/กระโดดไปที่ทำงานจริง** (ส่วนใหญ่ = ด้านบนของหน้า) — ห้ามจิ้มแล้วนิ่ง · **ทำให้เหมือนกันทุกหน้า**
4. **เมนูจากแท็บ/ปุ่มด้านบน:** หัวข้อแสดงไม่ครบ และเมนู "วันนี้/จองล่วงหน้า" แสดงไม่ถูก
5. **หน้าโหวตเมนู:** ภาษาไทยผิด + ต้องแสดงเมนู **ครบทุกเมนูจริง**
6. **แถบสถานะ (ตอน ~11:00)** — ห้ามโชว์ "🟢 เปิดรับออเดอร์ เช้า" ทั้งที่รอบเช้าเลยคัทออฟไปแล้ว ·
   เกณฑ์ใหม่: **เซมเดย์ยังสั่งได้** (ร้านยังเปิด) + **พรีออเดอร์ = รอบถัดไป (วันที่ 27)** (รอบเย็นแอดมินกดปิดเอง)
   → **แต่งคำสถานะให้ตรงตามเวลา/รอบจริง**
7. **หัวข้อแท็บแนวนอนต้องลิงก์ไปหมวดจริง** (รวมจากเมนูบนสุดและ nav bar ล่าง) · **ชื่อหัวข้อต้องตรงที่แอดมินตั้ง**
   (ห้ามเปลี่ยนชื่อหมวดเก่าทับใหม่จนมั่ว) · **ลำดับทั้งแนวนอน/แนวตั้ง:**
   `ส่งวันนี้/Same day` → `จองล่วงหน้า/Pre order` → `เมนูสุขภาพ` → `เครื่องดื่ม` → `ของทานเล่น/ผลไม้` → `สินค้าสำเร็จรูป`
   · **แนวตั้ง: section 1–2 คงเดิม = theater + เมนูแนะนำ** แล้วค่อยตามลำดับข้างต้น · **ฟุตเตอร์เรียงลำดับเดียวกัน
   และทุกลิงก์ต้องลิงก์จริง**
8. **พรีออเดอร์ที่ยังไม่ถึงรอบสั่ง / เลยรอบสั่งไปแล้ว (ยังไม่ลงปฏิทินรอบถัดไป) = แสดงสีเทา กดไม่ได้**
9. **เฟรมเมนู/การ์ด = อัตราส่วน 1:1 ทั้งเว็บ** (ของที่มี + ของที่จะเพิ่มใหม่) · **เฟรมโปรโมชั่นขนาดเท่ากัน**

---

## 4. Migration / schema status

- **Production ledger:** top = **158** — **157 + 158 ถูก apply บน production แล้ว (Owner อนุมัติ 2026-10-26)**
  · evidence = `e2e/w6Apply157158-{precheck,apply157,apply158,verify,record}.json` ·
  ผล verify: anon-visible helper policies **19 → 0** · `reviews_anon_read` อยู่ · RLS 2 ตาราง = true ·
  anon write leak = 0 · หลัง apply = **guest เปิด `/menu` จริงเห็นเมนูครบ + console ไม่มี error**
  (`e2e/w2_guest_menu_probe.cjs` รันซ้ำ = ทุก endpoint 200)
- **migration 157** = anon policy role scoping (B-6 P0) · **migration 158** = enable RLS 2 ตาราง + align grants
  (31 ตาราง + 108 functions + default privileges) — **สร้างจากผล parity จริง ไม่ได้เดา**
- **schema parity (W-1) รอบสุดท้ายหลัง apply:** fresh replay 001→157 = `REPLAY_ALL_GREEN 157/157` ·
  **MATCH** = tables/columns/indexes/constraints/sequences/triggers/views/**rls 67=67** ·
  **acl_tables 768=768** · **ledger 158=158** ·
  **คงเหลือ DRIFT 3 กลุ่ม (อธิบายครบในรายงาน):** functions 25 (ชุด 11/6 + body คู่ comment) ·
  acl_functions 17 (ตามชุด function เดิัน) · policies 6 (5 replay-only + 1 production-only)
- แผนที่สำคัญ (คงเดิม): 138 = payment_intents read authority · 139 = POD storage policy ·
  141/142 = pre-order unify + menu gate · 143 = cutoff_hours · 144 = round pattern · 152 = REVOKE anon set_menu ·
  153–156 = Growth & Rewards stages 1–4
- **schema drift:** ยัง **UNVERIFIED** — Owner **อนุมัติให้รัน fresh replay เทียบ production แล้ว (2026-10-26)**
  แต่ยังไม่ได้รัน → งานของแชทถัดไป (handoff) · ของรอบก่อน = Docker replay 001–156 ALL_GREEN (ยังเป็นของรอบก่อน ไม่ใช่ของรอบนี้)
- proposed migrations ที่เคยค้าง (`PROPOSED_wave5_orders_delivery_address` / `wave1_profiles_grant` /
  `wave2_history_backfill`) → ถูกแทนด้วย **150 / 151 / 152** ที่ apply แล้ว (2026-10-25) → **CLOSED**

---

## 5. Test / CI evidence

### 5.1 ผลรันจริงรอบนี้ (2026-10-26 · ทุกบรรทัดมี exit code)

| รัน | ผล | evidence |
|---|---|---|
| baseline `npx vitest run` (ก่อนแก้) | **144 files / 1517 tests / 0 fail / exit 0** | `e2e/session20261026-gates-evidence.txt` §2 |
| `npx tsc --noEmit` | **exit 0** | §1 ของไฟล์ evidence |
| `npx vitest run` (หลังแก้ · run 1) | 144 files · 1518 tests · **4 fail = ทั้งหมดใน `orderTimeline.test.ts`** · exit 1 | §3 |
| `npx vitest run src/__tests__/orderTimeline.test.ts` | **6/6 pass** | §4 |
| `npx vitest run` (หลังแก้ · run 2) | **144 files / 1518 tests / 0 fail / exit 0** | §5 |
| `npx eslint .` | **exit 0** | §6 |
| `node scripts/brandNameGuard.cjs` | **OK — 422 ไฟล์** | §6b |
| `npm run build` | **exit 0** | §7 |
| `npx playwright test routeNav` | **39/39 passed · exit 0** | §8 |

> สรุปอย่างตรงไปตรงมา: รอบ run 1 เจอ flaky จริง 4 เคสใน `orderTimeline.test.ts` (บันทึกเป็น B-1)
> และรันซ้ำได้เขียวทั้งหมด — **ไม่ได้แก้ test เพื่อให้ผ่าน** และไม่ได้ skip/ลด assertion ใด ๆ

### 5.2 สิ่งที่แก้ในโค้ดรอบนี้ (รายละเอียด §9)

1. `src/lib/orderEntry.ts` (ใหม่) — เส้นทางสั่งซื้อเดียวของ storefront
2. `HomePage` / `MenuPage` — เดิมมีสำเนา logic คู่กัน → delegate ให้เส้นทางเดียว
3. `HomePage.handleReviewCta` — **บั๊กจริงที่แก้:** ไม่เคยเช็ค `AddToCartResult` ก่อน toast "เพิ่มลงตะกร้าแล้ว" + navigate
4. ลบไฟล์ที่ไม่มีใครอ้าง 11 ไฟล์ (พิสูจน์ 0 reference ทั้ง `src` รวม tests และทั้ง `supabase/scripts/e2e/.github/public`)
5. `platformConfig` D14 — default quota/cutoff อ้าง `ORDER_POLICY_DEFAULTS` (เดิม hardcode 120 vs canonical 100)

### 5.3 CI

- เครื่องนี้ **ไม่มี `gh`** (`where gh` = ไม่พบ) → ตรวจ Actions ผ่าน **GitHub Actions REST API สาธารณะ**
  (`GET /repos/bitemebaby2016-coder/bmb/actions/runs?head_sha=<full SHA>`) + หน้า `/actions`
- **ผลของ SHA ที่ push จริง (`066e961`): CI #569 = success · Contract Tests #143 = success** — รายละเอียด/URL = §9.4
- ขั้นตอนตรวจซ้ำด้วยตัวเอง: เปิด
  `https://github.com/bitemebaby2016-coder/bmb/actions` แล้วหาแถว commit `066e961`

### 5.4 Evidence รอบที่ 3 (2026-10-26 · W-1/W-2/UI 4 ข้อ)

| รายการ | ผล | evidence |
|---|---|---|
| fresh replay 001→157 (prelude + preprocessor/shims แบบ CI) | **`REPLAY_ALL_GREEN 157/157` · FAIL=0** | `e2e/w1-replay-apply-2026-10-26-full.log` + `.jsonl` |
| schema parity (production read-only · Management API) | **รันแล้ว** — MATCH 8 ป้าย · DRIFT 5 กลุ่มมีคำอธิบาย/แผน | `e2e/w1-prod-snapshot-2026-10-26.json` · `e2e/w1-local-snapshot-2026-10-26.json` · `e2e/w1-parity-2026-10-26.json` · `e2e/w1-parity-report-2026-10-26.md` |
| legacy contracts 7 ไฟล์ (B-2) บน replay ชุดเดียวกัน | **7/7 EXIT=0** | `e2e/w2-contracts_*.log` |
| B-6 ตรวจ guest บน production จริง (read-only) | **401 `permission denied for function is_staff` ทุก endpoint + Playwright เปิด /menu = "ไม่พบเมนู"** | `e2e/w2_guest_menu_probe.cjs` · `e2e/w2prod_anon.cjs` |
| fix B-6 บน replay (apply 157) | anon อ่าน 16 ตารางได้ · **zero write leak** | `e2e/w2_b6_verify.sql` ผลรัน |
| **apply 157 + 158 บน production (Owner อนุมัติ)** | **STAGE_OK ทุก stage** · anon-visible helper policies **19→0** · RLS 2 ตาราง true · anon write leak 0 · ledger top = **158** | `e2e/w6Apply157158-{precheck,apply157,apply158,verify,record}.json` |
| **ตรวจหลัง apply (guest จริง)** | PostgREST ทุก endpoint = **200** · Playwright เปิด `/menu` = เห็นเมนูครบ (วันนี้ 12 · จองล่วงหน้า 2) · **console ไม่มี error** | `e2e/w2_guest_menu_probe.cjs` (รอบหลัง apply) |
| **parity รอบสุดท้าย (หลัง 157+158)** | **MATCH** = tables/columns/indexes/constraints/sequences/triggers/views/**rls 67=67**/**acl_tables 768=768**/**ledger 158=158** · DRIFT เหลือ 3 กลุ่ม (functions/acl_functions/policies — อธิบายครบ) | `e2e/w1-parity-2026-10-26.json` |
| unit เพิ่มใหม่ | `storeStatusWindow` 4/4 · `uiTechnicalLabels` 4/4 | ไฟล์ test ใน `src/__tests__/` |
| unit ที่ต้องยังเขียว | `mascotClosed` + `roundsSameDayNoCutoff` = **34/34** | ในไฟล์ evidence gates ด้านล่าง |
| **gates ชุดใหญ่รอบนี้ (รันจริงบนเครื่อง)** | **tsc exit 0 · eslint exit 0 · brandNameGuard exit 0 · vitest 146 files / 1549 tests / 0 fail exit 0 · build exit 0** | `e2e/session20261026-r3-gates-evidence.log` |

---

## 6. Production runtime gaps (ยังไม่มีหลักฐานจริง)

| ช่องว่าง | ต้องทำที่ไหน |
|---|---|
| PWA cache ทำให้ Owner เห็น build เก่า | Ctrl+Shift+R ก่อนตรวจทุกครั้ง |
| Maps ต้อง build ใหม่หลังตั้งค่า key | key อ่านตอน build (`googleMaps.ts:10`) → ถ้าตั้งค่าหลัง build ล่าสุด ต้อง deploy ใหม่ |
| SMS/push/POD/slip ตรวจบน production จริง | ต้องรันบน browser/อุปกรณ์จริง (Owner + rider) |
| contract039 รันบน production ตรง ๆ ติด fixture สินค้าจริง | ของรอบก่อน — ไม่ใช่ regression (verify152 เขียว) |
| CI ของ SHA ล่าสุด | ต้องเปิด Actions จริง (§5.3 / §9.4) |

---

## 7. Owner Production Acceptance — **ใช้ชุดเดียว: `docs/BMB_PRODUCTION_TEST_PACK.md`**

> ⚠️ **ก่อนรัน:** ดู **§0 (blocker + เงื่อนไข)** และ **§L (ยังแก้ไม่เสร็จ — ห้ามใช้เป็นเกณฑ์ ACCEPT)** ของไฟล์นั้นก่อน ·
> **อัปเดต 2026-10-26 (รอบที่ 3):** **ปลดล็อกแล้ว** = **B2** (แถบสถานะแก้ + มี test) · **C7/C8** (`marketing_rules`
> มีค่าจริงแล้ว) · **A2** (B-2 กลับเข้า CI) — **ยังล็อกอยู่** = ขั้นที่ผูกกับ UI 5 ข้อที่ค้าง (L-3/4/5/7/8) ·
> **ห้ามตัดสินว่า "ผ่านทั้งหมด" ถ้ายังมี §L ค้าง**

> คำสั่ง Owner 2026-10-26: "รวบรวมเทสไว้ทดสอบจริงทั้งหมดบนโปรดักชั่นจริง"
> → ทุก checklist ที่เคยกระจายอยู่ในหลายเอกสาร ถูกรวมเป็น **ขั้น A–K** ในไฟล์นั้นไฟล์เดียว
> (CI · storefront 2 โหมด · แอดมิน · แจ้งเตือน/push/SMS · จ่ายเงิน/สลิป · rider POD · แผนที่ ·
>  role 14a–14j · R-16 Print-to-PDF · G&R 4 stages · docs ไม่ drift)

เหลือเฉพาะสิ่งที่ AI ทำไม่ได้อย่างปลอดภัย (production write / ตาตรวจจริง) — **เปิดรันตามลำดับในไฟล์นั้น**:

1. ขั้น **A** (CI ของ SHA ล่าสุด) → 2. **B** (สั่งจริง 2 โหมด + guard ใหม่) → 3. **C** (แอดมิน + CAP-21/22)
4. **D–H** (push/SMS/slip/POD/maps/roles) → 5. **I** (R-16 Print-to-PDF) → 6. **J** (G&R) → 7. **K** (docs)

---

## 8. Doc reconciliation & archive

- เอกสารสถานะหลัก = **ไฟล์นี้** · `AI_WORK_STATE.md` = บันทึกการทำงานสั้น ชี้มาที่นี่
- index ของเอกสารที่ย้าย = `docs/archive/INDEX_2026-10-26.md`
- ไม่มีการแก้วันที่/สถานะในรายงานย้อนหลัง — ทุกฉบับคงสภาพเป็น "รายงาน ณ วันนั้น"
- หลักฐาน apply migration / audit / incident / security / acceptance **ไม่ถูกลบ** ทุกฉบับยังอยู่ครบ

---

## 9. Change log (รอบ 2026-10-26)

### 9.0 CI history — **ตาราง canonical เดียว (รวมทุกรอบ · ที่อื่นอ้างที่นี่เท่านั้น)**

| # | SHA | ทำอะไร | CI (`.github/workflows/ci.yml`) | Contract Tests (isolated PG) |
|---|---|---|---|---|
| 1 | `066e961` | เส้นทางสั่งซื้อเดียว + dead-code + master status | #569 **success** | #143 **success** |
| 2 | `26e258e` | docs: บันทึก CI จริง + route-smoke evidence | #570 **success** | #144 **success** |
| 3 | `fa9f54f` | docs: work-state | #571 **success** | #145 **success** |
| 4 | `11b7112` | docs: gate evidence | #572 **success** | #146 **success** |
| 5 | `3a2c9f7` | CAP-21/22 + B-1 + test pack + **B-2 CI step** | #573 **success** | #147 **failure** (legacy 7 ไฟล์) |
| 6 | `6a28bcf` | rollback B-2 → B-2 = BLOCKED | #574 **success** | #148 **success** |
| 7 | `1aa678b` | บันทึกผล CI รอบ 2 | #575 **success** | #149 **success** |
| 8 | `47b33e1` | docs: จัดเอกสารเป็นสถานะชุดเดียว + แฮนด์ออฟ | #576 **success** | #150 **success** |
| 9 | **`927689a`** (HEAD) | W-1/W-2 ปิด + UI 4 ข้อ + **migration 157** + step legacy contract กลับ CI | #577 **success** | #151 **success** (มี `Legacy contracts OK — 7/7`) |
| 10 | `3b5c2d8` | apply 157+158 บน production + parity รอบสุดท้าย + **B-6 ปิด** | #578 **success** | #152 **failure** (158 v1: `to_regprocedure` ไม่รับชื่อ parameter → ล้มใน step inventory migrations) |
| 11 | `ba2fec2` | 158 v3: ทนลำดับ CI — ข้าม object ที่ยังไม่ถูกสร้าง + ตรวจด้วย pg_proc | #579 **success** | #153 **success** ✓ |
| 12 | `33785ae` | docs: บันทึก §9.0 + บทเรียนรอบ #152 | #580 **success** | #154 **success** |
| 13 | `a294c52` | docs: เติมผล CI #579 จริง | #581 **success** | #155 **success** |
| 14 | `fff2112` | docs(evidence): เก็บ logs gates รอบ 3 เข้า repo | #582 **success** | #156 **success** |
| 15 | `5ab2906` | docs: เติมผล CI จริง 33785ae/a294c52 + แถว HEAD | #583 **success** | #157 **success** |
| 17 | `67f10b8` | ปิด UI L-3/4/5/7/8 (test ใหม่ 5 ไฟล์ + อัปเดต 4) + migration 159 DROP legacy 6 fn | #585 **success** | #159 **success** |
| 18 | `3ffafac` | (รอบก่อนหน้า — legacy contracts 017-033 กลับเข้า CI) | #584 **success** | #158 **success** |
| 19 | `5f891de` | docs: reconcile 4 เอกสาร (HEAD/ledger · เวลานั้น 159=prepared — **ปัจจุบัน APPLIED แล้ว ดู §1.3** · Test Pack §L→**L-RT** · B2/C7C8=**UNVERIFIED** · probe 42501 · Pages serving=**VERIFIED marker btn-locked**) + ล้าง probe | #586 **success** | #160 **success** |
| 20 | `7df33fd` | docs: commit ตัว reconcile เอง + บันทึก HEAD/CI จริงรอบสุดท้าย (HEAD line = 7df33fd + git-log authority · §9.0 แถวนี้) | #587/#588 **success** | #161/#162 **success** |
| 21 | `680bf78` | docs: ปิด drift รอบสุดท้าย (HEAD/§9.0 แถว 20) + แก้ stale N-4/AI_WORK_STATE §3-4 ที่ verify_docs หาเจอ (ALL_OK) | #589 **success** | #163 **success** |
| 22 | `6d83cba` | production: **apply 159** (w7Apply159 4 stage · ledger 159) + อัปเดตสถานะทุกเอกสาร + evidence 4 ไฟล์ + ลบ schtasks 3 ตัว | #590 **success** | #164 **success** |
| 23 | `4a62873` | docs: เติมผล CI จริง 6d83cba (#590/#164) + §9.0 แถว 22 + HEAD lines = 6d83cba ทุกเอกสาร | #591 **success** | #165 **success** |
| 24 | `5215cf4` | รอบ defect: **SW skipWaiting/claim** (ต้นตอ UI เก่าค้าง) + **hours/operating sync client** + markup/coupon/label + **migration 160 PREPARED** + contract yml widen-hours + test shopHoursGate 17 | #593 **success** | #167 **success** |
| 25 | `02b834c` | **apply 160 production (Owner สั่ง)** = 4 stage ALL_PASS + evidence `w8Apply160-*` + เอกสาร 4 ฉบับ + **★แผนทดสอบทั้งหมด (HANDOFF §2)** ปิดเซส | #595 **success** | #169 **success** |
| 16 | (docs commit ปิดเซสชั่น — SHA ดูใน git log) | เขียนแฮนด์ออฟปิดเซสชั่น + work state + gates evidence | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 26 | `b66b880` | **Backlog settings-sync audit 13 key** (evidence `e2e/backlogAudit-settings-sync-2026-10-27.json`) + **คู่มือสอนทดสอบทุก role** (`docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md`) + อัปเดต 4 เอกสาร (commit เติมผล CI นี้ = SHA/ผลดู `git log` + `bmb_ci.bat`) | **#597 success** | **#171 success** |
| 27 | `70ad11c` | **R9 แก้ defect ที่ Owner เทสต์เจอ 8 จุด** (repro `e2e/r9OrderRepro.*` · evidence `e2e/r9OwnerDefectFixes-2026-10-27.json` · data flip 14 สินค้า) + **สร้าง `docs/BMB_BACKEND_AI_PART_1.md` ใหม่** (commit เติมผล CI นี้ = ดู `git log` + `bmb_ci.bat`) | **#599 success** | **#173 success** |
| 28 | `d246359` (+ fix `ecc3988`/`1a9307a`/`168cee4`) | **R10 แก้ defect ที่ Owner เทสต์จริง 16 จุด** — แจ้งเตือนออเดอร์ใหม่+เสียง+ปุ่มเปิด/ปิด (migration 161 notify trigger) · คูปอง popup ที่เช็คเอาท์อย่างเดียว · ปุ่มถ่าย/แนบรูปที่อยู่ (161/162) · ปุ่มปฏิเสธสลิป (162 `admin_reject_payment`) · แบนเนอร์ไม่โชว์เวลาส่ง/เคารพรอบปิด · redirect ครัว/จัดส่ง · rider catch + ลบออเดอร์ทดสอบ 405/205/337 (evidence `e2e/r10OwnerDefectFixes-2026-10-27.json` + `r10Verify*`) · รอบแก้ CI 3 รอบ (enum payment_status / storage.foldername / FK best-effort) จนเขียว | **#604 success** | **#178 success** |
| 29 | session-close docs (R9+R10) | **ปิดเซสชั่น 2026-10-27 + handoff แชทถัดไป** (`docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md`) + อัปเดต `AI_WORK_STATE.md` — docs-only (commit นี้ = SHA/ผลดู `git log` + `bmb_ci.bat`) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 30 | `9bc7a30` | **R11: rider step-sync ทีละสเตปตาม action จริง** (migration 163: accept/claim→`dispatched` ทันที · `driver_checkin_arrival` geofence 300 ม.→`arrived` · geofence ที่ delivered) + แจ้งเตือนเด้งไปหน้างานตาม role (`notificationLinks`) + ปิดวงจรอัตโนมัติ + contracts 163 G1-G5 ลงทะเบียน CI | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 31 | (commit นี้ — SHA/ผลดู `git log`) | **apply 163 สู่ production** (`e2e/r11Apply163.cjs` 4 stage · ledger 161/162/163 record ครบ · evidence `e2e/r11Apply163-result.json`) + อัปเดต 3 เอกสาร (`AI_WORK_STATE.md` · `BMB_MASTER_STATUS.md` · handoff 27B) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 32 | (commit นี้ — SHA/ผลดู `git log`) | **R12: ทุกหน้าขึ้นจากด้านบน + deep-link ใช้ได้จริง** (Layout scroll rule: pathname+search+hash · `#hash` = scroll ไป section) · **LINE กลับมา** (restore ค่าจริงที่ admin ตั้งใน `business_settings.social_links` = `https://line.me/ti/p/QFD3bSMFN9`/`bitemebaby2016` + DEFAULT ตรงกัน · evidence `e2e/r12RestoreLine-result.json`) · footer links ครบจริง guard (`footerLinksReal.test.ts`) · deep-link B (dropdown + center) wiring guard | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 33 | (commit นี้ — SHA/ผลดู `git log`) | **R12b (Owner สั่งเพิ่ม 5 ข้อ 2026-10-28):** anon+authenticated เห็น business_settings ทั้งหมด (164 APPLIED · policy public_read SELECT USING true · เขียนยัง admin-only · ledger 164 · evidence `e2e/r12Apply164-result.json`) · แถบสถานะหน้าแรกไม่มีข้อความวงเล็บ (เหลือ "เปิดรับออเดอร์ เซมเดย์") · กรอบโปรโมชั่นเท่ากันทุกกรอบ (148px + line-clamp) · ภาษา: ลบ BOM 39 ไฟล์/ต่างดาว + guard ใน lint (languageSanity 1224) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 34 | (commit นี้ — SHA/ผลดู `git log`) | **R12c (Owner ยืนยัน 2026-10-28):** `seo.ts` ใช้ค่าจริง (JSON-LD sameAs = social จริงจาก settings · handle เก่าถอด) + **SEO copy admin แก้เองได้** (migration 165 seed คีย์ `seo` · ledger 165 · evidence `e2e/r12Apply165-result.json`) + ฟอร์ม AdminSettings "SEO / คำโปรยเว็บ" + live-store re-render (App useSyncExternalStore) + tests (seo sameAs/copy · r12SeoAdminCopy 6 ข้อ) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 35 | (commit นี้ — SHA/ผลดู `git log`) | **R13 (Owner retest 2026-10-28):** แถบสถานะรูปแบบใหม่ (เซมเดย์ ": ส่งทันที" + พรีออเดอร์บอก ชื่อรอบ/วันที่/คัทออฟ) · **จบลูปไรเดอร์อัตโนมัติ** (ต้นตอจริง = drivers.id สกปรก → POD upload ไม่เคยเข้า bucket → 166 fix path sanitize + CHECK arrived + checkin status + self-heal · ledger 166 · evidence e2e/r13Apply166-result.json) · แจ้งเตือนแอดมิน delivery → ?focus= + ปุ่ม "แอดมินปิดวงจร" ในตารางกำลังเดินทาง · tests r13RiderLoopClose (10) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 36 | (commit นี้ — SHA/ผลดู `git log`) | **Master Test Checklist ใหม่** — `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md` รวมรายการที่ยังเหลือทั้งหมดเป็นไฟล์เดียว (R9 8 · R10 16 · R11-R13 · RT-HOURS/B2/C7C8 · settings-sync 14 คีย์ · role guide บท 1-12 · §F-I/L-10/L-11 · เกณฑ์ปิด §16) + pointer จาก AI_WORK_STATE/27B/MASTER | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 37 | (commit นี้ — SHA/ผลดู `git log`) | **R14 (Owner "ครัวสร้างแบทชไม่ได้+ไม่ต่อเนื่องครบลูป" 2026-10-28):** ต้นตอ probe (`e2e/r14ProbeA2/C/D-result.json`) = (1) `to_char(epoch_ms,'99999999999')` ล้น → Batch ID `###########` (2) summary ไม่ส่ง created_at → Invalid Date (3) `confirm_offline_payment` ตั้งแค่ paid **ไม่ hop pending→confirmed** → ครัวมองไม่เห็น (135 paid 14:08:12 ค้าง pending) — **167 APPLIED+VERIFIED (ledger 167 · `e2e/r14Apply167-result.json`)**: id=`::bigint::text` (probe digits ✓) · summary/queue+created_at (admin|kitchen) · confirm hop ผ่าน transition canonical + **self-heal 135→confirmed (pipeline มีงาน)** · client: id เต็ม+formatBatchCreatedAt+createBatch error surface+typos (กรุา/สำเรจ/หลด) · tests r14KitchenBatchLoop (7) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 39 | (commit นี้ — SHA/ผลดู `git log`) | **R16 (Owner: strip เท่า+สีจริง · คัทออฟ→ปิดรอบ · แผนที่จุดหมาย · ไรเดอร์หลายงาน+route):** strip สองบรรทัด font เท่ากัน + flag `sameDayOpen`/`preOrderOpen` (สีรายสาย) · "คัทออฟ"→"ปิดรอบ" **102 จุด/17 ไฟล์ เหลือ 0 ใน src** · **migration 168 applied+prod-verify** (delivered คืน available เฉพาะไม่งานค้าง — ledger 168 · NOT EXISTS+arrived ✓) · `deliveryPlan.ts` NN-route+legKm+gmaps-dir-url · RiderPwaPage การ์ดเส้นทาง 1..n+ปุ่มนำทาง · RiderMiniMap stops+polyline · tests r16 (15) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 38 | (commit นี้ — SHA/ผลดู `git log`) | **R15 (Owner: ไรเดอร์ปิดงานแล้วหน้าไม่ปิดอัตโนมัติ + แจ้งเตือนต้องลงจุดปิดวงจร + กดเริ่มผลิตเด้งหน้ามอบหมาย):** **server auto-close = พิสูจน์ทำงานแล้ว** (`e2e/r15ProbeB-result.json`: 135 order+assignment delivered เวลาเดียวกันเป๊ะ · driver available · POD มีรูป) — ต้นตอที่เห็นค้าง = **หน้า delivery โหลด orders ครั้งเดียว** (interval เดิม refresh แค่ drivers) → client: poll เงียบ 20 วิ + visibilitychange refetch + `?focus=` refetch เสมอ + **scrollIntoView แถวกลางจอ** (`data-focus-row` 2 ตาราง) · AdminKitchen สร้าง Batch สำเร็จ → **navigate /admin/delivery** (ปุ่มที่ Owner ยืนยัน) · tests r15DeliveryLiveRefresh (6) · ไม่มี migration | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 40 | (commit นี้ — SHA/ผลดู `git log`) | **R17 (ปิดเซสชัน 2026-10-28):** กรอก **ผล Owner retest 47 แถว** ลง master checklist (P0 1A-1H = 44 ผ่านทั้งหมด + 2-3/2-8+/3-1,2,6,7,8/4-1/4-2+/7-4/7-7 + CAP-10/11/19) · **bug scan 416 ไฟล์** → แก้: รูป placeholder ขาดจริง (สร้าง `public/placeholder.svg` + CartPage/VotePage refs) + console.log debug ×2 ใน MenuPage ลบ · ส่วนที่เหลือกรอง = ไม่ใช่บั๊ก (แฮนด์ออฟ §3) · **เอกสารปิดเซสชัน+แฮนด์ออฟ = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-28.md`** (งานต่อ N1/N2 + รายการทดสอบทั้งหมด) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 41 | (commit นี้ — SHA/ผลดู `git log`) | **R18 (2026-10-29):** แก้ copy แถบสถานะ stripe 2 (พรีออเดอร์) ตามคำสั่ง Owner — `พรีออเดอร์: เปิดรับออเดอร์ รอบส่งถัดไป …` → **`เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ <ชื่อรอบ> <วันที่> (ปิดรอบ HH:MM)`** (ตัวอย่างจริง `🟢 เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ เช้า 30/10/2026 (ปิดรอบ 05:00)`) · builder เดียว `homeProviders.ts preOrderLine` (รอบ = nextPre เดิม) · tests 2 ตัวอัปเดต · targeted 69/69 ✓ · full gates ✓ (e2e/gates_r18_2026-10-29.log · commit 11d8717+8752a2c) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |
| 42 | `19b5f91` | **R19 (2026-10-29):** 🔧 **CI ซ่อม (2 จุด) — จุด 1: Contract แดง #188-#197 เพราะ 166 ไม่ decode `%XX` → RLS บล็อก INSERT contract 138-139 G7 → `migrations/169_pod_path_percent_encoding.sql`** (ตัด %XX ก่อน strip + re-issue pod_path_is_driver signature เดิม) · จุด 2 = contract 163 G4 fixture (ดูแถว 43) · 📝 **copy หน้าเช็คเอาท์ 7 จุด** ตามคำสั่ง Owner (`CheckoutPage.tsx` — same-day banner การ์ด rounds ป้ายเมนูรอบพิเศษ ค่าส่ง PromptPay บัตร เงินสด · ไม่มี test ผูกข้อความเก่า) · 🔎 **Senior QA review ทั้งโปรเจกต์ = `docs/BMB_QA_REVIEW_2026-10-29.md`** (3 เฟส+5 หมวด+PWA/EF · probe จริง: alert 0/console.log 0/innerHTML XSS 0/interval คู่ครบ/EF CORS 19/19 · พบ `onAuthStateChange` = 0 จุด → งาน N3) · เอกสารปิดเซสชัน+แฮนด์ออฟ = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-29.md` · gates = `e2e/gates_r19_*.log` (vitest 162/1,671/0 · build 0) | #624 **success** | #198 **failure** (169 ได้ผล = ผ่าน 138-139/146/147/149/153-156 · แดงที่ 163 G4 fixture → แก้แถว 43) |
| 43 | `0417806` | **R19b — contract 163 G4 fixture (v1):** `#198` แดงที่ `FAIL G4 driver ไม่ถูกปล่อย: busy` = G1-G3 ทิ้งงานค้างบนไรเดอร์คนเดียวกัน → ใต้ rule **168** (เขียนหลัง contract) driver=busy **ถูกต้อง** → แก้ fixture: ปิดงานค้างก่อนขั้น delivered · ผล `#199` ยังแดงเพราะ UPDATE orders ตรง ๆ ชน trigger state-spine (`FORBIDDEN: invalid order status transition dispatched -> delivered`) → **v2 = อัปเดตเฉพาะ delivery_assignments** (guard ของ 168 เช็คแค่ตารางนี้ · orders ค้างได้ไม่กระทบ + ROLLBACK ทิ้ง) — ดูแถว 44 | #625 **success** | #199 **failure** (v1 → แก้ v2 แถว 44) |
| 44 | `e8831c2` | **R19c — contract 163 fixture v2:** ตัด `UPDATE public.orders` ออก (ชน trigger state-spine พิสูจน์ใน #199) เหลือ `UPDATE delivery_assignments` อย่างเดียว + คอมเมนต์อธิบายว่า 168 guard เช็คเฉพาะ assignments · ไม่แตะ assertion/โค้ด/mandate อื่น → **ผล: Contract กลับเขียวทั้ง step (138-139 → 163 → legacy 7)** | #626 **success** | #200 **success** ✓ |
| 45 | `c017360` | **R20 (2026-10-29 · ตามแฮนออฟ 2026-10-29 ทั้งหมด):** ✅ **Owner สั่ง `__apply 169__` → production ledger = 169 APPLIED** (evidence `e2e/r19Apply169-result.json` + `r19Verify169-result.json` · probe `%20`↔space จริง = true) · **N3 (P1 · QA 1.6)** listener auth กลาง `onAuthStateChange` (พบ 0 จุด → มีแล้ว): `SIGNED_OUT` → clear + `/login` เก็บ `from` (กัน boot loop) · `TOKEN_REFRESHED` → `refreshRole()` · `USER_UPDATED`/`SIGNED_IN` → re-map customer — `src/lib/authSessionSync.ts` (pure decision) + `src/components/AuthSessionSync.tsx` (mount ใน App · defer supabase นอก callback) + `authStore.clearSession/syncFromAuthUser` · **N1** แอดมินแก้ copy แถบสถานะเองได้ (คีย์ `business_settings.store_status_copy` · 4 บรรทัด · **ไฟ 🟢/🔴 คงอัตโนมัติ** · บรรทัดเปิดรับ = ข้อมูลสด R18 ไม่รับ override) — `src/lib/storeStatusCopy.ts` + strip subscribe + ฟอร์มใน AdminSettings (TYPED_FORM_KEYS += key นี้) · **N2** `docs/BMB_BACKEND_AI_PART_1.md` ปรับปรุงทุก § เทียบโค้ดจริง (checklist 2-8) · cosmetic: `PromotionsPage` ปุ่มลองใหม่ = refetch แทน `location.reload` (QA 3.9) · tests ใหม่ 2 ไฟล์ 19 ข้อ + อัปเดต 3 ไฟล์ตาม spec ใหม่ | #628 **failure** (step Lint — `languageSanity` จุดเดียวในแฮนออฟใหม่ → แก้ที่ 46) | #202 **success** ✓ |
| 46 | `05d5e64` | **R20b — แก้ languageSanity 1 จุด:** `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-30.md:28` มีอักขระชุดอื่น (จีน) → `npm run lint` (brandNameGuard + languageSanity) บล็อก = ต้นตอ CI #628 แดง — แก้เป็นคำไทยแล้ว lint เขียว (สแกน 1,269 ไฟล์) + เพิ่ม `e2e/r19bCi.cjs` (ดึงผล Actions · log endpoint ต้องสิทธิ์ admin) + `e2e/r19bProdProbe.cjs` · **ผล: ทุก workflow เขียวบน HEAD นี้** | #629 **success** ✓ | #203 **success** ✓ |
| 47 | `f3fc425` | docs R20c: กรอกผล CI จริงของ R20 (§9.0 แถว 45-46) + แฮนออฟ `BMB_HANDOFF_NEXT_SESSION_2026-10-30.md` + อัปเดต `AI_WORK_STATE`/§1.3 (ledger 169) + เพิ่ม `e2e/r19bProdProbe.cjs` | #630 **success** ✓ | #204 **success** ✓ |
| 48 | `d52ab30` | chore: ลบไฟล์หลงเหลือชื่อ `console.log('ERR` (มาจาก `node -e` ที่ cmd ตีความ `>` เป็น redirect — **บทเรียน: ห้ามใช้ `>` ในคำสั่ง inline บน cmd · ใช้ script ไฟล์แทน**) | #631 **success** ✓ | #205 **success** ✓ |
| 49 | `653d9fc` | docs R20d (2026-10-29): กรอกผล CI จริงของ R20 (§9.0 แถว 45-46) + แฮนออฟ `BMB_HANDOFF_NEXT_SESSION_2026-10-30.md` + อัปเดต `AI_WORK_STATE`/§1.3 (ledger 169) + เพิ่ม `e2e/r19bProdProbe.cjs` | #632 **success** ✓ | #206 **success** ✓ |
| 50 | `39cfcdc` | **R21 (2026-10-29 · เฟส 2 Core Business Logic + ระบบพิมพ์เข้าครัว):** ✅ **migration 170 APPLIED production** (ledger **170** · evidence `e2e/r21Apply170-result.json` ALL_PASS · `products.cogs`/`packaging_cost`/`other_unit_cost`/`unit_cost` GENERATED) · margin helper `src/lib/marginCalc.ts` + แผงกำไรสดใน `AdminProducts` · guardrail ส่วนลด 15% `src/lib/discountGuardrail.ts` + `CheckoutPage` บล็อกปุ่มสั่งซื้อ · ระบบพิมพ์: registry ใน `print_settings` (preset Nimbot B1Pro · เพิ่ม/ลบ/ผูกเอง) + **รับออเดอร์ → auto-print ใบสั่งครัว** + ปุ่มพิมพ์ 2 ปุ่มต่อออเดอร์ + `printOrderTicket` · tests ใหม่ 3 ไฟล์ 34 ข้อ · gates tsc/lint/**vitest 167 files · 1,724 tests · 0 fail**/build | #633 **success** ✓ | #207 **success** ✓ |
| 51 | `d5a83eb` | **R21-f3 (2026-10-29 · เฟส 3 UI/UX edge cases):** แก้ "หน้าเงียบตอนโหลดล้มเหลว" 6 หน้า (`HomePage`/`MenuPage`/`OrdersPage`/`NotificationCenterPage` — เดิมไม่มี try/catch → ค้างโหลดตลอดกาล/`AdminKitchen`/`AdminProducts`) ผ่าน banner กลาง `src/components/ui/LoadErrorBanner.tsx` (role=alert + ปุ่มลองใหม่ refetch จริง) · `OrdersPage` ซ่อนข้อความ empty ระหว่าง error · test `loadErrorBanner.test.ts` 5 ข้อ · backlog 12 หน้า = QA review §เฟส 3 · gates tsc/lint(461)/ **vitest 168 files · 1,729 tests · 0 fail**/build | #634 **success** ✓ | #208 **success** ✓ |
| 52 | `4eab695` | docs R21-f3b: กรอก §9.0 แถว 49-51 (ผล CI ของ 653d9fc/39cfcdc/d5a83eb) | #635 **success** ✓ | #209 **success** ✓ |
| 53 | `2124138` | **R21-c (2026-10-29 · เฟส 1 แก้ครบ A1-A8 + เฟส 4 + 4 คำสั่ง Owner):** `probeProfileRole` 3 สถานะ + AdminRoute banner/state.from/fast-path · returnTo ก่อน · logout try/finally · login*/refreshRole สงบ · **migration 171 `my_role()` APPLIED production (ledger 171 · ALL_PASS)** · ลบ `isAdmin()` dead code · **EF: image-gen/queue-enqueue/push-send OPTIONS ไม่มี CORS (probe ก่อน) → แก้+deploy production (probe หลัง ACAO ✓)** · ลบ `public/manifest.json` ซ้ำ · **Owner asks:** ครัวกดแจ้งเตือนใหม่ → /admin/kitchen · preparing = `deduct_inventory_for_order` (สต็อกรวมทุก round) · **ประตูตรวจสลิปก่อนรับออเดอร์** (SlipThumb+confirm_offline_payment→accept) · พร้อมส่ง → /admin/delivery?focus= · tests +authProbeRoles(10)/notificationLinks(13) · gates tsc/lint(462)/**vitest 169·1,740·0**/build | #636 **success** ✓ | #210 **success** ✓ |
| 54 | (docs commit รอบนี้ — SHA ดู `git log`) | docs: กรอก §9.0 แถว 52-53 (ผล CI ของ 4eab695/2124138) | ตรวจรอบถัดไป | ตรวจรอบถัดไป |

> อ่านจาก GitHub Actions REST API จริง (`?head_sha=<full SHA>` — เครื่องนี้ไม่มี `gh`) ·
> **ห้ามอ้างเลข run จาก §9.4/§9.6 โดยไม่เทียบกับตารางนี้** (§9.4 = รายละเอียดรอบ 1 · §9.6 = รายละเอียดรอบ 2)

### 9.8 บทเรียนรอบ Contract Tests #152 (ห้ามลืม)

- **`to_regprocedure('public.fn(p_arg type, ...)')` = syntax error** — regprocedure input ไม่รับ "ชื่อ parameter"
  (รายการ grant มาจาก `pg_get_function_identity_arguments` ซึ่งมีชื่อ) → ตรวจการมีอยู่จริงด้วย
  `pg_proc` + `pg_get_function_identity_arguments(p.oid) = <args>` เท่านั้น (ส่วน `GRANT ... (ชื่อ param)` ใช้ได้จริง ✓)
- **CI inventory ข้าม `124_*` ไป apply ทีหลัง** → migration ที่รันใน loop ต้องทนต่อ object ที่ยังไม่ถูกสร้าง
  (skip + ให้ `ALTER DEFAULT PRIVILEGES` คอยรองรับของที่สร้างทีหลัง) — ไม่งั้นจะล้มแบบไม่คาดคิด
- จำนวนครั้งที่ลอง: #152 = attempt 1 (ล้ม) → แก้ตามหลักฐาน → #153 = attempt 2 (ผ่าน) = **ครบ 2 ครั้งพอดี (กติกา 0.9)**

### 9.1 โค้ด

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/lib/orderEntry.ts` | **ใหม่** — canonical order-entry (`runOrderBuilder`): builder → addItem → gate → route |
| `src/pages/HomePage.tsx` | `handleSameDay`/`handlePreOrder` → delegate · **แก้บั๊ก** `handleReviewCta` ไม่เช็คผลก่อน toast/navigate |
| `src/pages/MenuPage.tsx` | `handleSameDay`/`handlePreOrder` → delegate (ข้อความ/ปลายทางเดิมคงเดิมทุกตัวอักษร) |
| `src/config/platformConfig.ts` | default `cutoffHours`/`dailyQuota` อ้าง `ORDER_POLICY_DEFAULTS` (ปิด D14) |
| ลบ 11 ไฟล์ | `AiAvatar`, `AddressAutocomplete`, `BranchAwareProductCard`, `FoodPlaceholder`, `auditLogConstants`, `bmbAdminApi_branch_overrides`, `bmbAdminApi_reviews`, `demandForecasting`, `lib/ai/aiContextBuilder`, `store/inventoryStore`, `lib/utils` |
| `src/__tests__/menuCartResultGuard.test.ts` | ย้ายเป้าตรวจจากสำเนาในหน้า → `orderEntry.ts` (assertion คงความเข้ม + เพิ่มกันสำเนากลับมา) |
| `src/__tests__/homeMenuAdminOrdering.test.ts` | assertion เดิมแทนด้วย delegation check |
| `src/__tests__/configAuthorityMap.test.ts` | เพิ่มเคส D14 (ห้ามมี default ตัวที่สอง) |

### 9.2 สิ่งที่ไม่ได้แตะ (จงใจ)

- ไม่มี migration/SQL/deploy/production write ใด ๆ
- ไม่เปลี่ยน business rule (cutoff/quota/mode/permission/order-state) — คงข้อความ UI และปลายทาง navigate เดิมทุกประการ
- stash `local-edits-before-sync-2026-09-21` + untracked เดิม ถูกรักษาไว้ (ตอนเริ่ม round = ไม่มี untracked)

### 9.3 เอกสาร

- สร้างไฟล์นี้ · ปรับ `AI_WORK_STATE.md` ให้เป็นสถานะสั้น · เพิ่มจุดชี้ใน `AI_ENTRYPOINT.md`
- สร้าง `docs/archive/INDEX_2026-10-26.md` + ย้าย handoff ที่ถูกแทนที่แล้วเข้า archive

### 9.4 Git / CI ของรอบนี้

| รายการ | ผล (ตรวจจริง) |
|---|---|
| commit | **`066e961`** `refactor(order-entry+admin): one canonical order path, dead-code closure, master status doc` (30 files · +561 / −1624) |
| push | `git push origin main` → `29ed251..066e961 main -> main` |
| HEAD vs origin | `git status -sb` = `## main...origin/main` (ไม่มี ahead/behind) · working tree **clean** · untracked **0** |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` **ยังอยู่ครบ** |
| secret scan | `git diff --cached` 2,487 บรรทัด · **SECRET_HITS = 0** (สแกน key/JWT/PEM/password patterns) |
| **CI #569** (`.github/workflows/ci.yml`) | **completed = success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40260114649 |
| **Contract Tests #143** (isolated PostgreSQL) | **completed = success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40260114655 |
| Cloudflare Pages deploy | กำลัง build ตอนตรวจ (check-run `in_progress`) — deploy ทำอัตโนมัติจาก main |
| วิธีตรวจ (เครื่องนี้ไม่มี `gh`) | GitHub Actions REST API สาธารณะ `.../actions/runs?head_sha=<full SHA>` + หน้า `/actions` |

> ผล CI ทั้งสองเส้นข้างบน = **อ่านจาก GitHub API จริงของ SHA `066e961`** ไม่ใช่การคาดเดา

### 9.5 Change log — รอบที่ 2 (ปิดงานค้างทั้งหมด · Owner directive 2026-10-26)

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/lib/customerIntelligence.ts` | **ใหม่ (CAP-21)** — เจาะกลุ่มลูกค้าอัตโนมัติจากสถิติจริง (`deriveCustomerInsight`/`segmentTally`/`INTELLIGENCE_THRESHOLDS`) · deterministic · ไม่มี localStorage/ไม่มีช่องให้แอดมินตั้ง |
| `src/pages/admin/AdminCustomers.tsx` | แสดงแถบสรุปกลุ่ม + คอลัมน์ "กลุ่ม/คำสรุป (อัตโนมัติ)" — คำนวณทุกครั้งที่โหลดหน้า |
| `src/lib/marketingAutoSchedule.ts` | **ใหม่ (CAP-22)** — `scoreSlot`/`pickPostSlot`/`planSchedule`/`autoScheduleApprovedPosts` · เคารพ publishing window/cooldown/frequency cap ของ `marketing_rules` · เรียก `scheduleMarketingPost` (RPC เดิม) เฉพาะโพสต์ `approved` |
| `src/pages/admin/AdminMarketing.tsx` | ปุ่ม "🤖 ให้ AI เลือกเวลาทั้งหมด" ในแท็บ 📅 ปฏิทิน (`data-testid="mk-auto-schedule"`) |
| `.github/workflows/contract-tests.yml` | เพิ่ม step legacy contract 7 ตัว (B-2) → **CI ล้มเหลวทั้ง 7** → ถอดออกแล้ว เหลือ comment อธิบาย blocker ไว้ในไฟล์ (B-2 = BLOCKED) |
| `src/__tests__/orderTimeline.test.ts` | **B-1** render+flush ใน `act()` (assertion คงเดิม) |
| `src/__tests__/categorySections.test.ts` | **B-1** `renderHtml` → `act()` (เคสเดิม fail เป็นกลางของ `indexOf = -1`) |
| `src/__tests__/homeSectionModeCta.test.ts` | **B-1** `mount` → async + `act()` (ป้องกันแบบเดียวกัน) |
| `src/__tests__/customerIntelligence.test.ts` | **ใหม่** 11 เคส (boundary/segment/deterministic/AUTOMATIC contract) |
| `src/__tests__/marketingAutoSchedule.test.ts` | **ใหม่** 12 เคส (slot/cooldown/cap/plan/injection + CNT-01/G7 contract) |
| `docs/BMB_PRODUCTION_TEST_PACK.md` | **ใหม่** — ชุดทดสอบ production รวม A–K (คำสั่ง Owner: รวบรวมทุกเทส) |
| `docs/BMB_MASTER_STATUS.md` · `AI_WORK_STATE.md` | CAP-21/22 → IMPLEMENTED+TESTED · §3 backlog = ปิดหมด · §7 ชี้ไป test pack |

### 9.6 CI ของรอบที่ 2 (ตรวจจริงผ่าน GitHub Actions API)

| SHA | CI | Contract Tests | หมายเหตุ |
|---|---|---|---|
| `3a2c9f7` (CAP-21/22 + B-1 + test pack + B-2 step) | #573 **success** | #147 **failure** | step legacy contract 7 ตัวล้มเหลวทั้ง 7 ไฟล์ (annotations ระบุรายไฟล์) |
| `6a28bcf` (rollback B-2 + รายงาน BLOCKED) | **#574 success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40267721376 | **#148 success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40267721481 | main กลับเขียว · ไม่มี step ที่ยังไม่ผ่านการ verify |

> สรุปตรง ๆ: **B-2 ไม่ถูกปิด** — ถูกถอดออกเพื่อคืนสภาพเขียวตามกติกา 0.9 (ซ้ำ 2 ครั้งแล้ว) ·
> หลักฐานทั้งสองรอบเก็บไว้ใน §3 + comment ใน `.github/workflows/contract-tests.yml`

---

### 9.7 E2E / route smoke (รันตอนรอบที่ 1 — ยังมีผล รอบที่ 2 ไม่ได้รันซ้ำ)

| รายการ | ผล |
|---|---|
| คำสั่ง | `npx playwright test routeNav` บน build จริง (`vite preview --port 5199` จาก `dist/` ที่ build ในรอบนี้) |
| ผล | **39 passed / 0 failed (46.3s) · `PW_EXIT=0`** · evidence = `e2e/session20261026-gates-evidence.txt` §8 |
| ครอบคลุม | public routes ทั้งหมด · protected (guest → `/login`) · redirect (`/ai-chat` → `/talk-to-bite`, `/profile/orders` → `/orders`, `/admin/pre-orders`, `/admin/dashboard`) · catch-all `/no-such-page-xyz` · ตรวจ console error "No routes matched location" |
| **ไม่ได้รัน** | `e2e/runE2E.cjs` (full order journey) — **จงใจไม่รัน**: สคริปต์นี้สร้าง user/order จริงบน Supabase production (ต้อง `BMB_E2E_SVC_KEY`) = **production write** ซึ่ง Owner directive ไม่อนุมัติให้ AI ทำเอง → อยู่ใน Owner acceptance §7 |
| ไม่ได้รัน | `e2e/g2rv.spec.ts` — ต้องการฐานข้อมูล/เซสชันทดสอบที่ไม่ได้เตรียมในรอบนี้ (= NOT RUN, ไม่ใช่ PASS) |