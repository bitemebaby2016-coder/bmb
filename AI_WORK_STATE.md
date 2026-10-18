# AI_WORK_STATE — Bite Me Baby (evidence ledger)

> Updated per `.clinerules` WORK STATE rule after each meaningful task.
> Rule source of truth: `UNIVERSAL_MASTER_AI_RULES.md` (repo root, v2.0) ·
> bootstrap: `AI_ENTRYPOINT.md` (repo root, v1.0) — ทั้งคู่อยู่ใน repo แล้ว
> (เพิ่ม 17 ต.ค. 2026 รอบดึก จากไฟล์โลคอลของ Owner)
> **กติกาเอกสาร (Owner 17 ต.ค. รอบดึก): อัปเดต = เขียนทับทั้งฉบับ ห้ามเขียนต่อ (append)**
> ประวัติฉบับก่อน ๆ ดูจาก git history เท่านั้น

---

## Task ID: MAPS-ENV-2026-10-18 (ปิดปัญหา Google Maps โหลดไม่ขึ้น + เก็บ env ให้สะอาด)
- **Status:** CLOSED — ฝั่ง config ครบ (Owner) + โค้ดแก้ deploy แล้ว — เหลือดูบนเครื่องจริงรอบเดียว
- **Objective (Owner):** Maps บน prod แผนที่ว่าง; Owner ตั้งค่า API key/Map ID ("BmB web Map")/billing ครบแล้ว — สั่งเก็บงาน+ปิดเซสชัน
- **Completed:**
  - โค้ด (`c9ef4bc`): โหลด SDK **ไม่บังคับ Map ID อีกต่อไป** (เดิมถ้า env ไม่มี `VITE_GOOGLE_MAPS_MAP_ID` แผนที่จะไม่โหลดเงียบ ๆ) + ส่ง `mapId` เข้า Map constructor เมื่อมี
  - `getGoogleMapId()` guard: รับเฉพาะค่าที่เป็น Map ID จริง (`^[A-Za-z0-9_-]{6,}$`) — เจอค่า `BmB web Map=fe097bcf...` (ชื่อแผนที่ปน ID) ใน `.env.local` ของเครื่อง จัดการลบให้เหลือ `fe097bcf317b5ede7dab9ff8` (ค่าเดียวกับ `.env`)
  - badge/chip z-index 40 (เหนือรูปที่ยกเสมอ รวมตอน hover ที่รูปได้ z-30)
  - Probe ฝั่ง prod: entry `index-FopldVLt.js` + 91 chunks → หลัง rebuild (`a6077d9`) entry `index-BmtVnCUU.js` + 97 chunks — **key ยังไม่ฝังใน bundle ทั้งสองรอบ** ขณะที่ build ในเครื่องมี key ใน `dist/assets/googleMaps-PCdQaP5G.js` ปกติ → root cause สุดท้าย: **`VITE_GOOGLE_MAPS_API_KEY` ไม่มีอยู่ใน Cloudflare Pages production vars** (มีแต่ MAP_ID) — Owner เพิ่มคีย์เอง 12:41 น. 18 ต.ค. (ยืนยันผ่าน API: ครบ 16 ตัวแปรแล้ว)
  - เก็บกวาดที่ค้าง: `.env.local` ซ่อมกลับ (BOM ออก + คอมเมนต์ไทย 6 บรรทัดกู้จาก double/triple cp1252-mojibake; **ค่า KEY=VALUE 32 บรรทัด checksum เดิมทุกตัว**) · ตัวแปรขยะ `"BmB web Map"` ใน Cloudflare (ชื่อแผนที่พิมพ์ปนค่า) = ไม่ได้ถูกใช้ ให้ Owner กดถังขยะลบเอง (ไม่แตะ production env ผ่าน API กันความเสี่ยงทับค่า secret ที่อ่านกลับไม่ได้)
  - ความปลอดภัยเช็กแล้ว: `VITE_SUPABASE_SERVICE_ROLE_KEY` (ที่เห็นใน Cloudflare) **ไม่มีโค้ดฝั่งเว็บเรียกใช้** (เหลือแค่คอมเมนต์เก่าใน `supabase.ts` + test กัน) → Vite ไม่ฝังเข้า bundle; leak-scan บน bundle จริง (133 chunks) ยืนยัน — ไม่มีค่า sb_secret_/sbp_/service-role หลุด (match ที่เจอ = literal ใน supabase-js เช็ก prefix คีย์เอง)
  - **Verified บน prod (build `1cada70`, entry `index-B0wjuzIC.js`): MAPS KEY อยู่ใน `googleMaps-zRFLJrop.js` แล้ว** — แผนที่ Google พร้อมใช้บน biteme-baby.com (เหลือดูบนเครื่องจริงตาเดียว)
- **Verified:** gates ผ่านครบ (lint=0 · tests 105/1,112 · build=0) · `.env/.env.local` ไม่ถูก commit (gitignore)
- **Next Exact Action:** ให้ Owner ตรวจ Cloudflare Pages env (① โปรเจกต์ที่ผูก biteme-baby.com ② แท็บ Production ③ ชื่อ `VITE_GOOGLE_MAPS_API_KEY` ④ Retry deployment) แล้วเปิด /check บนมือถือ — ถ้ายังว่างดู console หา `RefererNotAllowedError`/`ApiNotActivatedMapError`

---

## Task ID: CLEAN-SLATE-ROUNDS-2026-10-18 (ล้างข้อมูลทดสอบทั้งระบบ + จัด rounds 3 รอบ/วัน)
- **Status:** CLOSED — ล้างข้อมูลจริงบน prod แล้ว (งาน data ops — ไม่มีการแก้โค้ด, gates ของ commit 28476f0 ยังเขียวอยู่)
- **Objective (Owner):** "round ผูกกับ menu schedule ใช่ไหม ทำไม round เยอะมาก วันนึงควรมี 3 รอบส่งหรือเปล่า" + "เทสเก่า ฮิสทอรีลูกค้า เงิน ออเดอร์ ยกเลิกทั้งหมด เครียร์ให้หมด ปิดทุกสถานะ ให้พร้อมทดสอบจริง (พรีออเดอร์+เซมเดย์, คอนเทนต์, ออโต้, เว็บ)"
- **Root cause (round เยอะ):** ① แถวสะสม 19 วันย้อนหลัง (57 แถว) ② แถวเทสต์ค้าง — "W3C-EXT test round" (cutoff 23:59, ส่ง 08:00–20:00) โดน clone เป็น template รอบเช้าของ `ensure_rounds_for_date` (function คัดลอกจากแถว active ล่าสุด) → ลามทุกวันใหม่ + round-w2-test/w3b-test
- **Completed (data ops บน prod, service key):**
  - **ล้างข้อมูลทดสอบทั้งหมด → เหลือ 0:** orders 208 · order_items 205 · order_status_history 458 · payment_intents 57 · delivery_assignments 10 · pre_orders 1 · notifications 342 · automation_queue 1,622 · social_events 34 · track_order_attempts 31 · otp_challenges 4 · content_approvals 4 · system_errors 1
  - menu_schedule: ลบเฉพาะของวันที่ผ่านมา — เก็บวันนี้+ล่วงหน้า
  - **delivery_rounds: เหลือ 21 แถว = 2026-10-18..24 × 3 รอบ/วัน** ค่ามาตรฐานเดียว: เช้า (06:00–09:00, ปิดรับ 08:00, 60) · เที่ยง (11:00–14:00, ปิดรับ 10:30, 80) · เย็น (17:00–20:00, ปิดรับ 16:00, 100) — ลบแถวเก่า/เทสต์ทั้งหมด + ตัด `products.delivery_round_id` ค้าง (prod-5/prod-6) ที่บังการลบ
  - วันใหม่ ๆ ระบบสร้าง 3 รอบอัตโนมัติ (`ensure_rounds_for_date` — เรียกตอนตั้งเมนูสัปดาห์/จองล่วงหน้า) และ template ปัจจุบันเป็นค่ามาตรฐานแล้ว
- **Verified:** ตรวจซ้ำหลังล้าง — ทุกตารางธุรกรรม = 0 · rounds 21 แถว active ไม่มี W3C/แถวค้าง · dates 18–24 ต.ค. ครบ 3 รอบ
- **เก็บไว้ (ไม่แตะ):** สินค้า/หัวข้อเมนูทั้งหมด · บัญชีลูกค้า 37 บัญชี (เข้าใช้ทดสอบได้เลย) · business_settings/เวลาเปิดร้าน · menu_schedule วันนี้+ล่วงหน้า · drivers · audit_logs (บันทึกภายใน)
- **Known Risks / หมายเหตุ:**
  - แถว `products.delivery_round_id` ของ prod-5/prod-6 ถูกตัดเป็น NULL (ค้างจากยุค seed/W3C ผูกสินค้าตายตัวกับรอบ — ไม่ควรผูกแบบนั้น)
  - "coming soon" 2 ตัว (฿1) + หัวข้อ "สินค้าสำเร็จรูป" ยังไม่แตะ (ไม่ทราบที่มา — ถ้าเป็นของเทสต์สั่งเก็บได้ทันที)
  - rounds ล่วงหน้าสร้างถึง 24 ต.ค. — หลังจากนั้นระบบเพิ่มให้เองตอนตั้งเมนู/มีการจอง
- **Next Exact Action:** เริ่มทดสอบจริงได้ทันที — same-day สั่ง→จ่าย→ส่ง ครบวงจร และ pre-order เลือกวัน (18–24 ต.ค.) + รอบเช้า/เที่ยง/เย็น

---

## Task ID: PREORDER-MERGE-2026-10-18 (รวมของพรีออเดอร์ใต้หัวข้อเดิม + ตัดตัวกรองซ้อนหน้าเมนู)
- **Status:** CLOSED — gates ผ่านครบ (lint=0 · tests ผ่านทั้งชุด · build=0)
- **Objective (Owner, 2026-10-18):** "ทำไมไม่เอาของพรีออเดอร์ที่มีมารวมกัน หัวข้อมันมีอยู่ สร้างใหม่ทำเหี้ยอะไร" + "menu กับ menu schedule สร้างงานซ้ำใหม่ตลอดทั้งที่บอกว่าเช้คแล้ว"
- **Root cause:** ① ของพรีออเดอร์ 7 ชิ้น (`available_preorder=true`) กระจายอยู่ cat-1/cat-3 ขณะที่หัวข้อ "จองล่วงหน้า / พรีออเดอร์" (cat-2) ว่าง 0 จาน → ปุ่มจองล่วงหน้าพาไปหัวข้อว่าง + แท็บโหมดกรองซ้อนอีกชั้นทำให้กดหัวข้อแล้วเจอของไม่ครบ ② "งานซ้ำ" = ระบบกรองสองชั้น (แท็บโหมด × หัวข้อ) แย่งกันกรอง + อดีต session เคยสร้างของทดสอบค้างในเมนูจริง (audit: `prod-w3c-test-pre` archived 16 ต.ค. ฯลฯ) ไม่ใช่แถว DB ซ้ำ (ตรวจแล้ว menu_schedule 6 แถว 0 ซ้ำ, สินค้า 19 ตัว 0 ซ้ำ)
- **Completed (รอบนี้ไม่สร้างโครงสร้างใหม่ — แก้ข้อมูล + ตัดตัวกรองซ้อน):**
  - **Data merge (prod):** ย้าย 7 ชิ้นเข้า cat-2 "จองล่วงหน้า / พรีออเดอร์" — เต้าหู้ย่างผักสามสี, ลุยสวนหมู+กุ้ง, เมนูใหม่: ข้าวกุ้งกระเทียม, กุ้งมันฝรั่งผัดเนย, สเต๊กเต้าหู้, กุ้งบ้อคโคลี่ผักสามสี, สเต็กปลาดอลลี่ (2 ตัว dual คงสถานะขายวันนี้ไว้) → admin โชว์ (7 dishes) แล้ว
  - `MenuPage.tsx` — เลือกหัวข้อไหน = โชว์ครบทุกจานในหัวข้อนั้น (แท็บโหมดกรองเฉพาะมุม "ทั้งหมด") + `switchTab()` กดแท็บแล้วออกจากหัวข้อ — หัวข้อ = แหล่งความจริงเดียว
- **Verified:** (ผลลัพธ์หลังย้าย) cat-1 ส่งวันนี้ 5 · cat-2 จองล่วงหน้า 7 (พรีออเดอร์ทุกตัว) · cat-3 เมนูสุขภาพ 2 · เครื่องดื่ม 3 · ของทานเล่น 1 · สินค้าสำเร็จรูป 1 — gates ผ่านครบ
- **Files Changed:** `src/pages/MenuPage.tsx` · ข้อมูล prod (products.category_id × 7)
- **Known Risks / หมายเหตุ:**
  - 2 เมนู dual (ข้าวกุ้งกระเทียม, ลุยสวนหมู+กุ้ง) ย้ายออกจากหัวข้อเดิม — ถ้า Owner อยากให้อยู่หัวข้อ "ส่งวันนี้/เมนูสุขภาพ" เดิม ย้ายกลับในแอดมินได้ทันที (สถานะขายสองโหมดยังครบ)
  - "coming soon" 2 ตัว (฿1) + หัวข้อ "สินค้าสำเร็จรูป" ยังอยู่ — ไม่แตะ (ไม่ทราบที่มาแน่ชัด) ถ้าเป็นของค้างทดสอบ บอกลบ/ซ่อนได้
  - menu_schedule ไม่ต้องทำซ้ำ: ถ้าไม่ลง schedule → ขายได้ตามโหมดปกติ; schedule ใช้จำกัดวัน/รอบเท่านั้น
- **Next Exact Action:** Owner เช็กบน biteme-baby.com — /admin/products "จองล่วงหน้า / พรีออเดอร์ (7 dishes)" + /shop หัวข้อโผล่มี 7 เมนู + ปุ่ม "เลือกเมนูจองล่วงหน้า" พาเข้าหัวข้อนั้นเจอครบ

---

## Task ID: PREORDER-ENTRY-2026-10-18 (ปุ่มจองล่วงหน้าก่อนฟุตเตอร์กดไม่ได้)
- **Status:** CLOSED — gates ผ่านครบ (lint=0 · tests ผ่านทั้งชุด · build=0)
- **Objective (Owner):** "ปุ่มจองล่วงหน้าตรงก่อนฟุตเตอร์มายังไง กดก็ไม่ได้" (หน้า `/menu?category=cat-2`)
- **Root cause:** ① ปุ่มนี้คือ `Footer.tsx` "Pre-order entry (Directive §8)" — เป็น `<Link>` ไป `preOrderEntryPath()` = `/menu?category=<หมวดพรีออเดอร์>` ซึ่ง**เป็น URL ของหน้าที่ยืนอยู่แล้ว** → กดแล้วไม่มีอะไรเกิดขึ้น + MenuPage ไม่เคยอ่าน `?tab=` → แม้กดจากหน้าอื่นก็เปิดที่แท็บ "วันนี้" ไม่ใช่ "จองล่วงหน้า" ② ภาพ QA มาจาก **preview build เก่า** (`a0ffceac.bitemebaby.pages.dev` — ข้อความปุ่มยังเป็น "...รอบส่งจริง" ซึ่งถูกเปลี่ยนเป็น "...รอบจัดส่ง" ตั้งแต่ commit `ab50dc2`) ไม่ใช่ `biteme-baby.com`
- **Completed:**
  - `catalogStructure.ts` — เพิ่ม `withPreOrderTab()` ต่อ `?tab=pre-order` ให้ deep-link (path เดิมของ `preOrderEntryPath` ไม่แตะ — contract 5 ข้อเดิมคงเดิม)
  - `MenuPage.tsx` — อ่าน `?tab=pre-order|same-day` → สลับแท็บเมนูให้ทันที
  - `Footer.tsx` + `HomePage.tsx` — จุดเข้าทั้งสองใช้ `withPreOrderTab(preOrderEntryPath(...))`; Footer เพิ่ม feedback ตอนกดซ้ำขณะอยู่หน้าเป้าหมาย (toast แจ้ง + เลื่อนขึ้นบน) — กดแล้วเห็นผลเสมอ
  - `preOrderEntry.test.ts` — เพิ่ม 4 ข้อ (withPreOrderTab + source invariants Footer/Home/MenuPage)
- **Verified:** `npm run lint` = 0 · `npm test` ผ่านทั้งชุด · `npm run build` = 0 — flow ปุ่มการ์ด "📅 จองล่วงหน้า" = openBuilder (แผ่น topping) → เพิ่มตะกร้า PRE_ORDER → `/checkout?mode=pre-order` (กลไกเดียวกับปุ่มเพิ่มลงตะกร้าที่ Owner ยืนยันว่าใช้ได้แล้ว)
- **Files Changed:** `src/lib/catalogStructure.ts` · `src/pages/MenuPage.tsx` · `src/components/layout/Footer.tsx` · `src/pages/HomePage.tsx` · `src/__tests__/preOrderEntry.test.ts`
- **Known Risks / หมายเหตุ:**
  - **ให้ทดสอบบน `biteme-baby.com` เท่านั้น** — `*.bitemebaby.pages.dev` เป็น stale/preview build (ตาม AGENTS.md) ปุ่มข้อความ "รอบส่งจริง" ในภาพ = เวอร์ชันก่อน `ab50dc2`
  - `[Log#pre-order] {productId, quantity:1, deliveryRoundId:'', scheduledDate:''}` ใน console = **log ปกติ** ของปุ่มการ์ด (payload เริ่มต้น ไม่ใช่ error) — หลัง log ต้องเห็นแผ่น topping เด้ง; ถ้าไม่เด้งให้ดู console ต่อว่ามี error ไหม
- **Next Exact Action:** ทดสอบบน biteme-baby.com — กดปุ่มจองล่วงหน้าก่อนฟุตเตอร์จากหน้าแรก/หน้าเมนู → ต้องได้แท็บ "จองล่วงหน้า (N)" + การ์ดพร้อมป้ายวันจัดส่ง

---

## Task ID: UI-FIX-QA-2026-10-17 (แก้ UI จาก QA จริง + รูปเมนูลอยเหนือกรอบ)
- **Status:** CLOSED — gates ผ่านครบ (lint=0 · tests 105 ไฟล์/1,108 · build=0)
- **Objective (Owner):** แก้ UI จากการทดสอบจริงบน `biteme-baby.com/check` (เบอร์ทดสอบ, ห่างครัว ~500 ม., มือถือ dark mode) + งานใหม่ "รูปเมนูลอยเหนือกรอบขึ้นด้านบนนิดหน่อย (มือถือเหมือนมี hover ตลอด / เดสก์ท็อป hover ขยับซ้ำจากเดิม)" — **ข้ามปัญหา "เพิ่มลงตะกร้า" ตามคำสั่ง Owner ("ใช้ได้แล้วข้ามข้อนี้ไป")**
- **Completed:**
  - **ระยะทาง 0.00 กม. ทั้งที่ห่างครัว ~500 ม.** → `DistanceChecker.tsx` เดิมไม่ส่ง `origin` เข้า `useDeliveryRouter` → `routeOrder({from: undefined})` ใช้ `distanceKm = 0` เสมอ — แก้: default origin = `KITCHEN_LAT/LNG` (display only; server คำนวณค่าส่งจริงตอนสร้างออเดอร์)
  - **รอบส่งมั่ว** (21:32 น. ยังเลือกรอบพ้น cutoff/กรอบส่งผ่านไปได้) → `src/lib/deliveryRoundStatus.ts` (ใหม่, pure) `roundBookability()` = open / cutoff_passed (มิเรอร์ ERR_CUTOFF_PASSED, strict `>` เวลาไทย) / window_passed (รอบทั้งวัน "ส่ง 08:00-20:00 · สั่งได้ถึง 23:59" ที่กรอบส่งผ่านไป) / full + `CheckoutPage.tsx`: แถวพ้นเวลา = disabled + ป้ายสถานะ, auto-select รอบแรกที่ยังสั่งได้, ปุ่มสั่งซื้อบอกเหตุเมื่อไม่มีรอบเปิด — server ยังเป็น authority เดียว
  - **ตัวอักษรขาวบนพื้นขาว (ไม่สมบูรณ์)** → `CheckoutPage.tsx`: กล่องพื้นสีอ่อน (`bg-orange-50`/`bg-blue-50`/`bg-gray-50`) บังคับตัวอักษรเข้มเสมอ (banner โหมด/ชื่อรอบที่เลือก/กล่องค่าส่ง/schedule banner)
  - **แผนที่พัง/ซ้ำ** → `DeliveryMapPicker.tsx`: ซ่อน canvas เปล่า `h-64` เมื่อ Google Maps โหลดไม่สำเร็จ (เดิมค้างทับกล่อง fallback = ดูเหมือนแผนที่ 2 อัน)
  - **UI ทับกัน** → `BiteMascot.tsx`: bubble ไม่แสดงบนหน้า checkout + แตะเพื่อปิดได้ทุกหน้า · `AmbientMusicToggle.tsx`: ตอนปิดเพลงเหลือปุ่มกลม (เดิม pill กว้างทับราคา/ปุ่มบนการ์ด)
  - **งานใหม่ รูปเมนูลอยเหนือกรอบ** → `index.css`: สถานะปกติ `translateY(-10px) scale(1.04)` + มุมมน/เงา (ทุกการ์ด drink/snack/home/fmc/menu), hover เดสก์ท็อปยกซ้ำ `translateY(-16px) scale(1.08)`, รูป `pointer-events: none` (กันกินพื้นที่แตะ), badge/chip z-index เหนือรูป, เว้นที่เหนือการ์ดแนวตั้ง + padding บน `.hc-track` (กัน scroll-clip ใน carousel), `prefers-reduced-motion` ปิดการลอยทั้งปกติ/hover
- **Verified:** `npm run lint` → 0 · `npm test` → 105 ไฟล์ / 1,108 ข้อ ผ่านทั้งหมด (เพิ่ม `deliveryRoundStatus` 9 ข้อ) · `npm run build` → 0 (tsc + vite + PWA) · screenshot มือถือ 390px ยืนยันรูปลอยเหนือกรอบ/หัวข้อไม่ถูกทับบน /menu
- **Failed:** —
- **Blocked:** —
- **Files Changed:** `src/lib/deliveryRoundStatus.ts` (ใหม่) · `src/__tests__/deliveryRoundStatus.test.ts` (ใหม่ 9 ข้อ) · `src/pages/CheckoutPage.tsx` · `src/components/delivery/DistanceChecker.tsx` · `src/components/delivery/DeliveryMapPicker.tsx` · `src/components/ai/BiteMascot.tsx` · `src/components/audio/AmbientMusicToggle.tsx` · `src/index.css`
- **Known Risks / ข้อควรระวัง:**
  - **"เพิ่มลงตะกร้า" ถูกข้ามตามคำสั่ง Owner** — ยังไม่เก็บ root cause; ถ้าเกิดซ้ำให้ trace `OrderBuilderModal → cartStore.addItem` (contract `menuCartResultGuard`/`cartContextIsolation` คงเดิม)
  - การ์ดขาว label แปลกในภาพ QA ไม่พบข้อความนี้ในซอร์สทั้งรีโป — ประเมินว่าเป็นกล่อง fee error (`feeUiState` "ยังคำนวณไม่สำเร็จ") ที่ข้อความขาวบนพื้นครีมอ่านไม่ออก — แก้ contrast แล้ว **ควรเช็กหน้าจอจริงบนเครื่อง Owner หลัง deploy**
  - Google Maps บน prod โหลดไม่สำเร็จ (แผนที่ว่าง) — fallback กรอกพิกัด/GPS ใช้ได้; ควรตรวจ `VITE_GOOGLE_MAPS_API_KEY` (HTTP referrer) ต่อ
  - ค่าระยะทาง/ค่าส่งบนหน้า = display mirror — `compute_delivery_fee_rpc`/`create_order_with_items` ยังเป็น authority
  - ⚠️ งบ OpenRouter เหลือ ~$5 จาก $160 — เติมงบก่อนเทสต์ AI จริง

---

## Task ID: SESSION-CLOSE-2026-10-17 (ปิดเซสซั่น — เตรียมแชทหน้า)
- **Status:** CLOSED — pushed (commit "chore(session-close) 2026-10-17" — ดู git log)
- **Objective (Owner):** อนุมัติ deploy EF `social-ai-worker` · เอา `AI_ENTRYPOINT.md`/`UNIVERSAL_MASTER_AI_RULES.md` จากโลคอลขึ้นรีโป · เขียนทับเอกสารที่เกี่ยวข้อง (ห้ามเขียนต่อ) · เคลียร์ staging worktree · เตรียมเป้าหมายแชทหน้า = แก้ UI ที่เหลือ + ทดสอบเปิดร้านจริง
- **Completed:**
  - **Deploy EF `social-ai-worker` สำเร็จ** — bundle 41 kB (รวม order-intake create-only ของ PRETEST-CLOSURE) ที่ project `ivkdfognyiwjcmrhcnwz` (Seoul) ผ่าน `SUPABASE_ACCESS_TOKEN` จาก `.env.local` · หลักฐาน deploy output: "Deployed Functions on project ivkdfognyiwjcmrhcnwz: social-ai-worker"
  - **เพิ่ม `AI_ENTRYPOINT.md` (v1.0 universal bootstrap) + `UNIVERSAL_MASTER_AI_RULES.md` (v2.0) ที่ repo root** — คัด verbatim จากโฟลเดอร์ Downloads ของ Owner (MD5 เท่าต้นทางทุกไบต์; เนื้อหาเดียวกับ `docs/archive/legacy_reports/`) — ปลด blocked item ค้างจาก 2 task ก่อนหน้า
  - **เขียนทับเอกสารสถานะ (ไม่ append):** `AI_WORK_STATE.md` (ฉบับนี้) + `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md`
  - **เคลียร์ staging worktree แล้ว:** ลบ `chat\bmb\` (staging clone เก่า 313.5 MB / 20,863 ไฟล์ — ตรวจก่อนลบ: ไฟล์ unique ทุกตัวมีเทียบเท่าในรีปอดจริง (`sms.ts`, `sms-send/`, `117_channel_intake_repair.sql`, e2e probes) และ HEAD `d6c9046` เป็น ancestor ของ main) + ลบ `chat\supabase\` (supabase CLI `.temp` cache) + git staging ว่าง / worktree สะอาด
- **Verified:** deploy output ยืนยันบน project จริง · MD5 ไฟล์ที่คัดมา = ต้นทาง · `git status` สะอาด · gates ปิดท้ายรอบนี้: lint=0 · tests 104 ไฟล์ / 1,099 ผ่าน · build=0
- **Failed:** —
- **Blocked:** Meta App Review = ชะลอตามคำสั่ง · เพจ/สิทธิ์ FB จริง = Owner เทสต์เอง
- **Files Changed:** `AI_ENTRYPOINT.md` (ใหม่, root) · `UNIVERSAL_MASTER_AI_RULES.md` (ใหม่, root) · `AI_WORK_STATE.md` (เขียนทับ) · `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` (เขียนทับ)
- **Tests / Commands Run:** `supabase functions deploy social-ai-worker --project-ref ivkdfognyiwjcmrhcnwz` → deployed · `npm run lint` → 0 · `npm test` → 104 ไฟล์/1,099 ผ่าน · `npm run build` → 0
- **Known Risks:**
  - **งบ OpenRouter เหลือ ~$5 จาก $160 (ใช้แล้ว 97% ณ 17 ต.ค. 10:22 — ที่มา: หน้า OpenRouter ของ Owner)** — AI ทุกตัวจะหยุดตอบเมื่อถึงเพดาน → **ต้องเติมงบ/ขึ้น limit ก่อนเทสต์จริง**
  - G6-09 (revised): AI สร้างออเดอร์**ใหม่**ได้ผ่าน `socialOrderIntake` (create-only, idempotent) เท่านั้น — ห้ามแก้/จ่าย/ยกเลิก/คืนเงิน/assign driver/แตะ inventory (regression คุม 20 ข้อ + G6/G7 เดิม)
  - `source_channel` จาก FB ต้องตรง channel naming ที่ webhook ใช้ (`MESSENGER`) · HARD STOP: ห้ามขายจริงจน Owner สั่ง go
  - `UNIVERSAL_MASTER_AI_RULES.md` มี label v3.0 (2026 Updated) ในเครื่อง (D:\selfprint-v3-react) — เนื้อหาเหมือน v2.0 ทุกบรรทัดยกเว้นบรรทัด version — ถ้า Owner ต้องการ label ใหม่ แก้บรรทัดเดียว
- **Next Exact Action (เป้าหมายแชทหน้า — คำสั่ง Owner):**
  1. **แก้ UI ที่เหลือ** — ~~รายการ UI จากภาพ QA~~ (ปิดแล้ว: task UI-FIX-QA-2026-10-17) · ยังเหลือ Theater/Waiting Stage unity + login context restoration (ค้างจาก PRE-OPENING audit)
  2. **ทดสอบเปิดร้านจริง** — พา Owner ผ่าน E2E checklist ใน `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` §2.2 (รวม Messenger สั่งออเดอร์จริง → เลขที่จริง → retry ได้เลขที่เดิม)

---

## Task ID: PRETEST-CLOSURE-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `1b381e6` · EF `social-ai-worker` deploy แล้ว (ดู task SESSION-CLOSE)
- **Objective:** §3 AI สร้างออเดอร์ใหม่ผ่าน workflow อนุญาต (ห้ามแก้ออเดอร์เดิม) + §4 FB comments/Messenger เข้า workflow กลาง + §5 Bite จำบริบทจริง
- **Completed:** `_shared/socialOrderIntake.ts` (extraction ask-first → catalog match → identity 046 → round → `rpc/create_order_with_items` + `p_external_ref_id`=event id) · worker intake (Messenger-only; comment สาธารณะไม่เปิดเผยรายละเอียด) · `TalkToBite.composeRealContext()` · G6-09 revised
- **Verified:** lint=0 · tests 104 ไฟล์/1,099 ผ่าน · build=0 · tsc=0
- **Files Changed:** `supabase/functions/_shared/socialOrderIntake.ts` (ใหม่) · `supabase/functions/social-ai-worker/index.ts` · `src/__tests__/g6Security.test.ts` · `src/__tests__/socialOrderIntake.test.ts` (ใหม่ 20 ข้อ) · `src/components/ai/TalkToBite.tsx`
- **สัญญาที่ต้องรักษา (contract):** `socialOrderIntake` 20 ข้อ — create-only source contract · idempotency (`p_external_ref_id`) · semantic ask-first (ไม่เดา) · truthful line จากผล RPC · G6-09 แบน mutation ทุกตัวของออเดอร์เดิม

---

## Task ID: ROUND-LINK-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `ab50dc2`
- **Objective:** menu schedule ↔ pre-order ผูกด้วย round key + สวิตช์เปิดปิดทุกรอบ + แอดมินสวิตช์/ดรอปดาวน์
- **Verified:** lint=0 · tests 103 ไฟล์/1,078 ผ่าน · build=0 · tsc=0
- **Files Changed:** `bmbAdminApi_rounds.ts` · `bmbMenuSchedule.ts` · `AdminMenuSchedule.tsx` · `AdminRounds.tsx` · `menuScheduleRoundLink.test.ts` (9) · `preOrderEntry.test.ts` (5)
- **หมายเหตุ:** สวิตช์รอบ = display mirror — create RPC ยังเป็น authority เดียวตอนสั่งซื้อ (`ERR_ROUND_CLOSED`)

---

## Task ID: SOCIAL-AI-2026-10-17 (ปิดแล้ว)
- **Status:** CLOSED — pushed `9d55926` · EF 4 ตัว deploy แล้ว · `BMB_OPENROUTER_API_KEY` ตั้งแล้ว (HTTP 201)
- **Objective:** แก้ AI ตอบเบิ้ล/สะกดผิด/ข้อมูลมั่ว/แชตหาย + footer social/LINE แอดมินแก้เองได้
- **Verified:** tsc 0 · lint 0 · tests 101 ไฟล์/1,064 ผ่าน · build 0 · deploy EF EXIT=0 ×4
- **Files Changed:** `channel-webhook` (self-echo) · `social-ai-worker` (thread/persona/continuity) · `_shared/shopContext.ts` (ใหม่) · `social-post-worker` · `ai-proxy` · `TalkToBite.tsx` · `src/lib/socialLinks.ts` (ใหม่) · `faqContent.ts`
- **สัญญาที่ต้องรักษา (contract):** `socialAiContinuity` — self-echo guard · thread continuity · persona "ครับ" · shopContext ข้อมูลจริง · ห้ามเงียบ
