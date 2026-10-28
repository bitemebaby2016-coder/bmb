# Bite Me Baby — HANDOFF สำหรับเซสชันถัดไป (ปิด R11 · 2026-10-27 ดึก)

> สถานะหลัก canonical = `AI_WORK_STATE.md` บนสุด + `docs/BMB_MASTER_STATUS.md` · ถ้าขัดกันให้ถือไฟล์นั้น + โค้ดจริง
> เซสชันนี้ = **R11** (สิ่งที่ Owner สั่ง 2026-10-27 หลังทดสอบเอง): rider flow ต้องเดินสถานะทีละสเตปตาม action จริง + แจ้งเตือนเด้งไปหน้างาน + ปิดวงจรอัตโนมัติ

---

## 1. สิ่งที่ทำเสร็จแล้วใน R11 (มี evidence ทุกข้อ)

### 1.1 Root cause ที่พิสูจน์ (ก่อนแก้)
- **accept/claim ไม่แตะ `orders.status`** → ค้าง `ready_for_dispatch` ("ยังพร้อมจัดส่งอยู่") + trigger 161 ไม่ยิง = ไม่มีแจ้งเตือน
  (DB PO-20261027-379: assignment=`accepted` แต่ order=`ready_for_dispatch` · probe 2026-10-27)
- **ไม่มีขั้น 'arrived' ที่เชื่อม action จริง** — ปุ่มตรวจพิกัดเป็นแค่ GPS ฝั่งเครื่อง
- **"ปิดวงจร" ต้องกดโดยแอดมิน** (admin_advance 116) เพราะ flow ไรเดอร์ไม่ครบเงื่อนไขปิดเอง
- ป้าย UI ใน screenshot ทดสอบ ("พร้อมจัดส่ง"/"ค้างส่งออก" ฯลฯ) = **ไม่มีใน git history เลย**
  (log -S ทุกตัว = never) → อุปกรณ์ทดสอบรัน build เก่า (SW cache) — **ต้อง hard reload (Ctrl+Shift+R) ก่อนทดสอบเสมอ**

### 1.2 ที่ทำ = migration `163_rider_step_sync_checkin.sql`
| Action จริงของไรเดอร์ | สถานะออเดอร์ | กลไก |
|---|---|---|
| กดรับงาน (accept/claim) | `dispatched` ('เริ่มจัดส่ง') | step-sync ใน `driver_accept_assignment` + `claim_dispatch_offer` (เฉพาะ ready_for_dispatch — ครัวยังไม่เสร็จ = ห้ามปลอมสถานะ) |
| รับอาหารแล้ว | `dispatched` (เดิม) | idempotent |
| กำลังเดินทาง | `in_transit` (เดิม) | `driver_update_delivery_status` |
| **กดเช็คพิกัดในรัศมี 300 ม.** | `arrived` ('ถึงปลายทาง') | **`driver_checkin_arrival` ใหม่** — geofence 300 ม. ตรวจฝั่ง server (haversine_km) + หลักฐาน check-in (`arrived_at`/`checkin_*` บน delivery_assignments) |
| ถ่ายรูป + ยืนยันส่ง | `delivered` ('ส่งสำเร็จ') | เดิม 132 + **geofence ฝั่ง server** ที่ delivered (ตรวจเมื่อมีพิกัดทั้งสองฝั่ง) |

- ทุก hop ผ่าน `order_transition_allowed` (030 allow-list **ไม่เปลี่ยน**) + trusted GUC (036) → trigger 161 ยิงแจ้งเตือนทีละขั้น (ลูกค้า + แอดมิน)
- **ปิดวงจรอัตโนมัติ**: ครบเงื่อนไข "ในพื้นที่ + มีรูป" → delivered ปิด order+assignment+ปล่อย driver เอง — แอดมินไม่ต้องกดปิดวงจรซ้ำ (116 เหลือเป็น override)
- ไฟล์: `supabase/migrations/163_rider_step_sync_checkin.sql` · สัญญา `e2e/contracts_163_rider_step_sync.sql` (G1-G5)

### 1.3 Notification deep-link (กดอ่าน = เด้งไปหน้างานอัตโนมัติ)
- `src/lib/notificationLinks.ts` — `resolveNotificationRoute(n, role)` + `extractOrderNumber` (pure)
- กติกา: rider→`/rider` · admin ตามประเภท (ครัว: preparing/ready → `/admin/kitchen` · จัดส่ง: dispatched..delivered → `/admin/delivery` · อื่น → `/admin/orders`) · ลูกค้า มีเลขออเดอร์→`/track/<order>` · โปรโมชัน→`/promotions` · อื่น→`/orders`
- Wiring: `NotificationDropdown` (กด item = ทำเครื่องหมายอ่าน + เด้ง) · `NotificationCenterPage` (item เป็นปุ่มเด้ง)
- Tests: `src/__tests__/notificationLinks.test.ts` (11 cases)

### 1.4 Gates (ทั้งหมดเขียว 2026-10-27 ดึก) — evidence `e2e/gates_r11_2026-10-27.log`
- `tsc --noEmit` = 0 · `eslint` + `brandNameGuard` = OK (440 ไฟล์) · **vitest 155 files / 1613 tests / 0 fail** · `vite build` ✓

### 1.5 SQL contracts (ephemeral PG17 Docker + apply_all_migrations 001-163) — evidence `e2e/r11-contracts-2026-10-27.log`
- **036** 8 กลุ่ม PASS (G1-G9 ของเดิมไม่พัง — G6 audit ≥4 ยังผ่าน) · **132** 6 กลุ่ม PASS · **135** 7 กลุ่ม PASS
- **163** 5 กลุ่ม PASS: G1 accept→dispatched+แจ้งเตือน · G2 claim→dispatched · G3 geofence ในรัศมี→arrived/ห่างเกิน→ERR_GEOFENCE · G4 auto-close (ไม่ใช้ admin_advance) · G5 security
- ลงทะเบียน contract 163 ใน `.github/workflows/contract-tests.yml` แล้ว
- ข้อสังเกต (ของเดิม ไม่ได้แก้): contracts 036/132/135 **ไม่ได้ตั้ง `business_settings.hours`** → รันนอกเวลา 10:00–22:00 จะติด `ERR_STORE_CLOSED` (gate 160) — ตอน verify ต้อง fixture hours ก่อน (ดู e2e/_fixhours ที่ลบไปแล้ว · ถ้าจะทำ fixture ถาวร = งานแชทหน้า)

---

## 2. งานที่เหลือ — ให้แชทหน้า "ทำและทดสอบ" ทั้งหมด

### (ก) P0 — deploy + ทดสอบจริง
1. ~~**Apply migration 163 สู่ production**~~ ✅ **ทำแล้ว 2026-10-27 รอบดึก (Owner สั่ง)** — `e2e/r11Apply163.cjs` (Management API · 4 stage: precheck → apply → verify `pg_proc` 4 ฟังก์ชัน + `arrived_at`/`checkin_*` col → record ledger **161/162/163** ครบ · backfill 161/162 ที่ R10 ไม่ได้ record · **ledger top = 163**) · evidence `e2e/r11Apply163-result.json`
2. **Owner retest flow ไรเดอร์ทีละสเตป** (hard reload ก่อน!):
   - กดรับงาน → สถานะลูกค้า/แอดมิน = **'เริ่มจัดส่ง'** ทันที + มีแจ้งเตือน
   - กดกำลังเดินทาง → **'กำลังเดินทาง'**
   - กดตรวจพิกัดในรัศมี 300 ม. → **'ถึงปลายทาง'** (ทดสอบนอกพื้นที่ = ต้องถูกปฏิเสธ)
   - ถ่ายรูป + ยืนยัน → **'ส่งสำเร็จ'** + **ปิดวงจรอัตโนมัติ** (driver กลับ available · แอดมินไม่ต้องกดปิดวงจร)
3. **ทดสอบ deep-link**: กดแจ้งเตือนแต่ละบทบาท (แอดมิน/ลูกค้า/ไรเดอร์) → เด้งหน้างานถูกต้องตามกติกา §1.3

### (ข) ต่อเนื่องจาก R9/R10
- Owner retest R9 (8 ข้อ) + R10 (16 จุด) — ค้าง #2 สวิตช์รอบเย็น · #9/13 flow ไรเดอร์จริง
- test pack ทั้งหมด `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-27.md` §2 (ไฟล์เดิม — ยังใช้ได้)
- B2 UNVERIFIED · C7/C8 NOT RUN · §16 role guide ครบก่อนประกาศปิดลูป

### (ค) ข้อควรระวัง
- **UI เก่าค้าง**: ถ้า Owner เห็นป้ายแปลก ("พร้อมจัดส่ง"/"ค้างส่งออก") = build cache — hard reload · ตรวจ URL ต้องเป็น `biteme-baby.com`
- contract fixtures 036/132/135 ยัง time-flaky (ERR_STORE_CLOSED นอกเวลา) — ถ้า CI รันกลางคืน ICT จะแดง: แก้โดย fixture `hours` = 00:00–23:59 ในแต่ละไฟล์ (งานแชทหน้า)
- `driver_checkin_arrival` ใหม่: ถ้าออเดอร์ไม่มีพิกัดปลายทาง = ERR_GEOFENCE_UNVERIFIABLE (ออกแบบตั้งใจ — ยืนยันไม่ได้ห้ามปิด)
- ห้ามแก้ contract เดิมเพื่อให้ผ่านโดยไม่สุจริต · ห้าม push โดย gates ไม่เขียว

## 3. git
- รอบนี้ commit = ดู `git log --oneline -1` จริง · ก่อนหน้า R10 = `168cee4` (CI #604 / Contract #178)
- temp probes ลบทิ้งหมดแล้ว (e2e/_probe* · _run* · _fixhours · _gates_*) · container ทดสอบ `bmb-pg163` ลบแล้ว
---

## 4. R12 (Owner สั่ง 5 ข้อ · 2026-10-28) — แก้แล้ว รอทดสอบ

> R12 ทั้งรอบ = commit รอบแรก `0fecc88` + รอบ 2 (commit ปัจจุบัน) · รายละเอียดใน `AI_WORK_STATE.md` + `BMB_MASTER_STATUS.md` §1.3/§9.0 row 32-33

### (ก) แถบสถานะหน้าแรก — คำในวงเล็บไม่ต้องแสดง
- หน้าแรก → แถบสถานะ (ป้าย 🟢/🔴) ต้องเป็นข้อความสั้น:
  - เซมเดย์: **"🟢 เปิดรับออเดอร์ เซมเดย์"** — ห้ามมี "(— ยังสั่งได้)" หรือ "(ไม่มีคัทออฟ (สั่งได้ถึง 20:00) · เหลือที่นั่ง 100%)"
  - พรีออเดอร์: **"📅 พรีออเดอร์: เปิดรับรอบ เที่ยง (คัทออฟ 09:00)" ยังแสดงเหมือนเดิม**

### (ข) กรอบโปรโมชั่น — ทุกกรอบขนาดเท่ากัน (รวมกรอบใหม่)
- การ์ดโปรโมชั่น (หน้าแรก PromotionStrip + หน้า /promotions) ทุกการ์ดสูงเท่ากันแม้ข้อความยาว/สั้น
  และการ์ดที่แอดมินเพิ่มใหม่ก็ได้ขนาดเดียวกันอัตโนมัติ (กำหนดในโค้ด CSS/component แล้ว)

### (ค) ผู้เยี่ยมชมไม่ล็อกอินเห็นค่าจริงตั้งแต่แรก (migration 164 APPLIED)
- เปิด incognito (ไม่ล็อกอิน) → หน้าแรก/footer/ติดต่อ โชว์ค่าจริงจาก business_settings (ปุ่ม LINE 💚 + โซเชียล = ค่าที่ admin ตั้ง) ตั้งแต่โหลดแรก — policy `business_settings_public_read` = SELECT ให้ anon+authenticated ทั้งตาราง (ledger top=164 · evidence `e2e/r12Apply164-result.json`)
- แอดมินเปลี่ยน LINE/social ใน AdminSettings → incognito เห็นค่าใหม่ภายใน ≤7 นาทีหรือ reload (guard "ห้ามโชว์ค่าเก่าเกิน 7 นาที")

### (ง) ภาษา / ต่างดาว
- ข้อความไทยทั่วเว็บไม่มีอักษรต่างดาว — BOM (UTF-8) 39 ไฟล์ถูกลบ + ตัวอักษรชุดอื่น (จีน/รัสเซีย/อาหรับ…) กวาดแล้ว ·
  guard ใหม่ใน `npm run lint` (= `eslint . && node scripts/brandNameGuard.cjs` + `languageSanity` สแกน 1224 ไฟล์) จะจับให้เองถ้ากลับมา

### (จ) ของ R12 รอบแรก (commit `0fecc88`) — ยังต้อง retest
- ทุกหน้าขึ้นจากด้านบนเสมอ (deep-link `#hash` ที่มี element จริง = ไป section นั้น · ไม่มี = ขึ้นบน)
- LINE กลับมาใน footer + หน้าติดต่อ (ค่าจริงที่ admin ตั้ง · แก้ได้ที่ AdminSettings)
- footer ลิงก์ครบ 11 จุดจริง (ทุก path มี Route)
- deep-link B: กดแจ้งเตือน (กระดิ่ง/ศูนย์แจ้งเตือน) = เด้งหน้างานตาม role (rider→/rider · admin→ครัว/จัดส่ง/ออเดอร์ · ลูกค้า→/track/<เลข>)
- ยังต้อง retest ของเดิม R11: flow ไรเดอร์ 4 สเตป + ปิดวงจรอัตโนมัติ (§2 (ก)) — **hard reload (Ctrl+Shift+R) ก่อนทดสอบทุกครั้ง** · URL ต้องเป็น `biteme-baby.com`

### (ฉ) SEO meta / copy — admin แก้เองได้ (R12c 2026-10-28)
- **ยืนยันใช้ค่า LINE จริง**: `seo.ts`/JSON-LD ใช้ social จริงจาก settings แล้ว (LINE `https://line.me/ti/p/QFD3bSMFN9` / `bitemebaby2016` · FB `61586146030943` · handle เก่าในโค้ดถอดแล้ว)
- **ทดสอบ admin แก้ SEO copy เองได้**: Admin → Business Settings → แผง "🔎 SEO / คำโปรยเว็บ" (คีย์ `seo`)
  - เปลี่ยน tagline และ description → บันทึก → เปิดหน้าแรก/หน้า shop (hard reload หรือ ≤7 นาที) title/meta เปลี่ยนตามทันที
  - สลับไป? ไม่มีปุ่มปิด — แก้กลับเป็นค่าเดิมได้จากช่องเดียวกัน (ค่า fallback/ค่าเริ่มต้น = ค่าเดิมที่ยืนยัน)
- **ทดสอบค่าจริง sync**: เปลี่ยน LINE URL ที่แผง "โซเชียล & LINE" → บันทึก → inspect หน้าแรก: JSON-LD `sameAs` มีลิงก์ LINE URL ใหม่ที่เพิ่งตั้ง (ไม่ใช่ค่าเก่า)
- crawler/view-source (หลัง hard reload): `<title>` + `meta description` + JSON-LD หน้าแรก = ค่าจริงที่ admin ตั้ง (ไม่อยู่ในโค้ด)
