# Handoff → แชทหน้า (2026-10-31 · ปิดเซสชัน R35+R36)

> ยึด `AI_WORK_STATE.md` บล็อก **R43 (ด้านบนสุด = สถานะปัจจุบัน: PLANNED ONLY · ห้ามแก้โค้ด)** + `docs/BMB_MASTER_STATUS.md` (canonical) · ถ้าขัดกัน = โค้ดจริง > เอกสาร

> **🔴 คำสั่ง Owner 2026-10-31 ~20:40 ICT (R43): "ห้ามโค้ดแก้" — ยังไม่ได้ยก → เซสชัน probe ทำตาม runbook ข้อ 0-6 เสร็จแล้ว (ผล + evidence ด้านล่าง) · เหลือข้อ 7 (ลงมือแก้) รอคำสั่งปลด + ข้อ 8 (docs + gates + CI probe ปิดงาน)**

## ⬜ R43 — บั๊กใหม่ 7 ข้อจากรายงาน Owner (ยังไม่แตะโค้ด · probe = อ่านอย่างเดียวเท่านั้นจนกว่าจะยกคำสั่งห้าม)

> อ้างอิงภาพที่ Owner ส่ง (ภาพ 1-9) · ทุกข้อ: **อาการ → ยืนยันจากภาพ → ต้นตอที่ต้องพิสูจน์ → probe อ่านอย่างเดียว → แผนแก้ (เมื่ออนุญาต) → วิธี verify**

### ✅ ผล probe รอบ 2026-10-31 (read-only ทั้งหมด · ยังไม่แตะโค้ดแม้แต่ไฟล์เดียว)

**Runbook ข้อ 1 — CI:** HEAD `79cd6eb` = CI ✅ + Contract ✅ ×2 + automation-scheduler ✅ = **NO_FAILED_RUN** (`node e2e\r36_ci_probe.cjs`)

**B1 — ต้นตอพิสูจน์จากโค้ดแล้ว:**
- `AdminMarketing.handleSchedule` (บรรทัด 147-156) เรียก `scheduleMarketingPost` ตรง ๆ → RPC `marketing_schedule_post` (m137/m147) `RAISE 'ERR_APPROVAL_REQUIRED'` เมื่อ approval ≠ `approved` — **ปุ่ม ⏰ `mk-schedule-*` (บรรทัด 545) แสดงกับทุกแถวรวม `pending_approval` ไม่มี gate** → กดจากแถวรอตรวจ = toast `ส่งงานไม่สำเร็จ: ERR_APPROVAL_REQUIRED` (r.error = error.message ดิบ) = **สมมติฐาน ① ยืนยันแล้ว**
- "ทำได้แค่อันเดียว": แถวที่อนุมัติแล้วตั้งเวลาได้ปกติ (สำเร็จ → `load()` รีเฟรช ✓) · แถวถัดที่ยังรอตรวจ = โดน ERR เหมือนเดิม → **สมมติฐาน ② (state ค้าง) ไม่พบในโค้ด**
- toast/dialog จริงในไฟล์ (เทียบภาพ 1): `'ส่งงานไม่สำเร็จ: ' + r.error` · `'เลือกเวลาเผยแพร่ก่อน'` · `'ตั้งเวลาเผยแพร่แล้ว (ระบบจะโพสต์อัตโนมัติเมื่อถึงเวลา)'` · `'อนุมัติแล้ว — พร้อมตั้งเวลาเผยแพร่'`
- **แผนแก้ (รอปลดล็อก):** gate ปุ่มตั้งเวลาตาม approval (หรือทำ approve+schedule เป็น transaction เดียว) + ข้อความไทยไม่โชว์รหัส error + verify ตั้งเวลา 3 แถวรวด

**B2/B3 — root cause พิสูจน์ครบด้วย production evidence (สำคัญที่สุด):**
- `node e2e\r43_publish_probe.cjs` → **`e2e/r43_publish_probe.json`**: 48 ชม. = 6 แถว (pending 1 · published 5) · **`approved_not_on_fb` = 3 แถว published แต่ `provider_post_id IS NULL`**: `mk-mvwegu4b-o482` (ตั้ง 20:00 ICT) · `mk-mvvtvqwv-3zjr` (10:17) · `mk-mvvspkna-n6uf` (09:50) — att=1/error=null ทุกแถว · **FB feed จริงไม่มีโพสต์ 3 ตัวนี้** (fb_matched=2 เฉพาะแถวมี prov) → **B3 ยืนยันจาก production จริงแล้ว**
- **B2 ตัวเลขจริง:** `mk-mvvz4n44-c60w` sched 05:46Z → FB ขึ้น 06:33Z = **สาย 47.5 นาที** (`delta_vs_scheduled_ms=2851000`)
- **cron chain = ทำงานจริง** (`e2e/r43_tick_probe.json`): `bmb-promote` 461 runs/7.7 ชม. (~100%/นาที) · `bmb-tick` 91 runs (~ทุก 5 นาที) · `auto-exec-tick-mk-*` = marketing_publish **succeeded ทุก 5 นาที** · `g26-poll-2026-10-31T09..T14` ต่อเนื่อง → **งานค้างข้อ 2 (cron verify) ปิดด้วยหลักฐานนี้**
- **แต่ทุก tick = `results.marketing_publish.scanned=0`** (audit metadata — `e2e/r43_ef_versions_probe.json`) ทั้งที่: query due ตัวเดียวกับ worker ยิงตรงคืน **3 แถว** (`e2e/r43_due_query_probe.cjs` = HTTP 200) · approval ทั้ง 4 = **`approved`** (`e2e/r43_approval_probe.json`) → guard ทุก branch ผ่านหมด → เหลือ branch เดียว = **worker ตัวจริง query ไม่ match**
- **ROOT CAUSE = EF production เก่า (โค้ดใน git ไม่เคย deploy):** `automation-worker` deploy ล่าสุด = **2026-10-30 06:36Z (13:36 ICT · รอบ R26)** แต่โค้ด query ใหม่ `or=(status.eq.scheduled,and(status.eq.published,provider_post_id.is.null))` อยู่ในคอมมิต **R39 `0985a62` = 2026-10-31 10:40 ICT** → **ยังไม่เคยขึ้น production** → ตัวจริงยัง query `status=eq.scheduled` อย่างเดียว → m177/m178 promote flip เป็น `published` ใน ≤1 นาที → worker มองไม่เห็น → **ไม่ push FB → prov ค้าง null ถาวร = ต้นตอ B2+B3 ตัวเดียว** (แถว c60w รอดเพราะถูก push ตอนยัง `scheduled` · E2E 06:33Z ก่อน bmb-promote เริ่ม 06:34Z)
- ✅ **แผนแก้ = ทำแล้ว (Owner ปลดห้าม · 2026-10-31 ~22:00 ICT):** deploy `automation-worker` จาก HEAD (`e71_deploy_fn.cjs` → `DEPLOY_automation-worker_OK` v72 @14:51Z) → **tick ถัดไป 14:55Z = scanned=3/published=3 → `approved_not_on_fb.rows=[]`** (3 แถวค้างขึ้น FB แล้ว · tick ต่อมา scanned=0 = ไม่มีค้าง) · `bmb-tick */5` คงเดิม (รอ Owner ถ้าต้องการ */2)

**B4 — ต้นตอพิสูจน์จากโค้ด:**
- prompt assembly = `social-ai-worker/index.ts:535-538`: `baseSystem + BITE_PERSONA_SEGMENT + REPLY_CONTINUITY_RULES + getShopContext(...)` — `getShopContext` (`_shared/shopContext.ts`) ดึง products/categories/promotions/business_settings + **`SHOP_FACTS_TH` static `"เวลาเปิดร้าน: ทุกวัน 07:00-20:00 น."`** → **ไม่มีบรรทัดสถานะสด** (same-day เปิด/ปิด · รอบ pre-order ถัดไป) ทั้ง 3 ช่องทาง (reply comment + inbox + `social-post-worker:341` generator = ชุดเดียวกัน)
- แหล่ง state จริงฝั่งเว็บ = `src/lib/homeProviders.getStoreStatusFromRounds` (flag `sameDayOpen`/`preOrderOpen` จาก rounds จริง) + `storeStatusCopy.ts` (เฉพาะข้อความแถบ) — **EF ไม่ได้ใช้เลย** → AI ตอบ "เปิดถึง 20:00" จาก static facts แม้วันนั้น same-day ปิด = ตรงอาการเป๊ะ
- **แผนแก้ (รอปลดล็อก):** ฉีดสถานะสด (รอบวันนี้ + menu_schedule + รอบถัดไป) เข้า `getShopContext` + rule บังคับ "same-day ปิด = บอกพรีออเดอร์+รอบถัดไป HH:MM · ห้ามบอกสั่งวันนี้ได้" + เคสใหม่ใน `socialAiContinuity.test.ts`

**B5 — เตรียมพร้อมแล้ว รอ D-4 เท่านั้น:** โครง notification ครบ (ตาราง `notifications` + `category` + `notification_prefs` per-channel + RPC `create_notification` + job `notification_dispatch` ทุก 5 นาที + EF `push-send` + `notificationLinks.ts` routing ตาม role) — **ยังไม่มี event "บอต AI โพส/ตอบ"** → hook จุด reply `sent` / post `published` ได้ทันที **หลัง Owner ตอบ D-4 (ช่องทาง + ผู้รับ)**

**B6 — ต้นตอจากโค้ด:**
- `/shop?cart=` = **เว็บรองรับจริง**: `Layout.tsx:68-109` อ่าน `cart` จาก query ทุก path · decode v1 b64url ↔ EF `buildCartLink` round-trip มี test คุม (`cartDeepLink.test.ts`)
- **จุดพัง = decode-fail เงียบ**: ถ้า payload ถูก FB ตัด/เพี้ยน → `decodeCartParam` null → `Layout:78 return` **ไม่มี toast ใด ๆ** → เปิดมาตะกร้าว่างเปล่าไม่ทราบสาเหตุ = ตรงภาพ 7-8 · ถ้า id ไม่ตรง catalog จะเห็น toast `รายการจากลิงก์หาไม่อยู่ในเมนูปัจจุบัน` (Owner ไม่เล่า = น่าจะเป็น branch เงียบ)
- คำตอบผิด catalog: `getShopContext` ส่ง MENU จริงแต่ **draft validation ไม่บังคับว่าคำตอบต้องอ้างจากรายการนั้น** → AI แต่งชื่อสินค้าเองได้ (ภาพ 6)
- **แผนแก้ (รอปลดล็อก):** ลิงก์ = เขียนจากระบบเท่านั้น (มีแล้ว) + บังคับคำตอบอ้าง catalog เท่านั้น + decode-fail/missing ต้องมี toast บอกสาเหตุ (ห้ามเงียบ) + ตัด URL ให้ครบเสมอ

**B7 — อ่านไลบรารีครบแล้ว:**
- `node_modules/niimbot-web-bluetooth/src/` มี 3 ไฟล์: `niimbot.js` (ไดรเวอร์ — **ไม่มีคำว่า gap/continuous/sensor เลย** = ฝั่ง JS ไม่มี logic ช่องม้วน ส่ง size ต่อหน้าเท่านั้น · firmware/เซนเซอร์เครื่องจัดการเอง) · `label-size.js` (`sizeFromMm` mm→px ล้วน) · `label-memory.js` (จำ size ตาม barcode ม้วน — ไม่เกี่ยวกับ gap) · README/protocol-v4 = ไม่มีคำว่า gap/pitch ด้วย
- `src/lib/niimbotBt.ts` = `stickerSize()` → `h_px = stickerPageHeight(offset, faceH)` (R41: หน้า = **faceH เท่านั้น ไม่ grow**) · `printBatch` = pipelined pages วิ่งยาว
- → **โมเดลหน้าปัจจุบันสั้นกว่า pitch จริง (face + ช่องว่างม้วน) = ตรงสมมติฐาน** · **ยังต้องการตัวเลขจาก Owner: วัด pitch ×4 (ระยะใบ 1→4 หาร 3 เป็น มม. × 11.81 = px)** จึงเทสต์ page = pitch vs faceH ได้ — **ห้ามเดา**

### B1 — ตั้งเวลาโพสได้แค่อันเดียว + `ERR_APPROVAL_REQUIRED` (+ dialog ข้อความเพี้ยน)
- **อาการ/ภาพ:** กดตั้งเวลา/เผยแพร่จากแถว `pending_approval` → toast **`ส่งงานไม่สำเร็จ: ERR_APPROVAL_REQUIRED`** (ภาพ 1) · ทำได้รอบเดียวรอบถัดพัง · dialog ภาษาในภาพ 1 อ่านเพี้ยน
- **ต้นตอที่ต้องพิสูจน์ (ยังไม่ฟันธง):** ① path "ตั้งเวลา" เรียก endpoint สถานะตรง ๆ ข้าม approve → API ปฏิเสธ ② state แถวหลังทำรายการแรกไม่รีเฟรช ③ dialog string เพี้ยน = ข้อความจริงใน `AdminMarketing.tsx`
- **probe อ่านอย่างเดียว:** `findstr /s /n /i "ERR_APPROVAL_REQUIRED"` ใน `src` + `supabase` · อ่าน handler ตั้งเวลา/อนุมัติใน `src/pages/admin/AdminMarketing.tsx` + `src/lib/adminMarketing.ts` (ลำดับ approve→schedule ถูกไหม) · จับ string จริงของ dialog มาเทียบภาพ
- **แผนแก้ (รอปลดล็อก):** path ตั้งเวลาจากรายการรอตรวจ = transaction เดียว "approve + scheduled" (หรือ UI บังคับ Approve ก่อน + disable ปุ่มตั้งเวลา) + ข้อความ error/dialog ไทยชัด + รีเฟรชหลังทำ
- **verify:** ตั้งเวลา 3 แถวติดกันในนาทีเดียวครบ 3 · ไม่มี ERR_APPROVAL_REQUIRED · dialog อ่านถูก

### B2 — โพสขึ้น FB ไม่ตรงเวลา / มาไม่ครบ
- **อาการ/ภาพ:** เจน/เผยแพร่แล้วขึ้นจริงแต่ **ไม่ตรงเวลา + ไม่ครบ** (ภาพ 2 = แถว approved+published เยอะ vs ภาพ 3 = FB ขึ้นบางส่วน/เวลาเพี้ยน)
- **ต้นตอที่ต้องพิสูจน์:** m178 (`bmb-promote` ทุกนาที → pg_net → `cron-tick` → automation-worker FB push) ต่อเนื่องไหม · push ตัวไหน fail เงียบ · timezone 20:00 ICT = 13:00Z ตรงคิวไหม · `prov` flag ตรง FB จริงไหม
- **probe อ่านอย่างเดียว:** SQL 24-48 ชม.: `marketing_posts` (status, scheduled_for, published_at, fb id/prov, updated_at) · `automation_queue` marketing rows + attempts/error · `cron.job_run_details` (bmb-promote/tick ยิงครบ?) · อ่าน `automation-worker/index.ts` แถว push (retry/dead-letter ไหม) · **FB read-only** GET page feed เทียบเวลาจริงกับ scheduled_for → evidence `e2e/r43_publish_probe.json`
- **แผนแก้ (รอ evidence ชี้ทาง):** ตามต้นตอจริง (push retry+alert · queue · timezone) — **ห้ามเดาแก้ก่อน probe**
- **verify:** ตั้งเวลา +5 นาที 3 ใบ → ขึ้น FB ครบ ±2 นาที · prov flags ตรง feed จริง

### B3 — approve แล้วแต่ยังไม่ขึ้น (แยกจาก B2 ถ้า evidence แยกได้)
- **อาการ/ภาพ:** กด approve แล้ว (ภาพ 2) แต่ไม่เห็นบน FB
- **probe:** ดึงแถว approved/published ที่ `fb_post_id IS NULL OR prov IS NOT TRUE` เรียงเวลา → ใช้ชุด query เดียวกับ B2 (insert key `approved_not_on_fb` ใน `r43_publish_probe.json`)
- **แผนแก้/verify:** ร่วมกับ B2

### B4 — AI ตอบโพสใช้บริบทผิด: ร้านปิด same-day → ได้แต่ pre-order แต่ AI บอก "เปิดถึง 20:00 สั่งได้เลย"
- **อาการ/ภาพ:** ภาพ 4 + 5 — คอมเม้นตอบ "ร้านเปิดได้เลยครับ วันนี้ร้านเปิดถึง 20:00 น. ... สั่งตอนนี้เลย" ทั้งที่จริง **same-day ปิดแล้ว รับแต่ pre-order**
- **ต้นตอที่ต้องพิสูจน์:** context ที่ `social-ai-worker` ใส่ prompt = เวลาเปิด/ปิด **static** โดยไม่ดู **โหมดบริการสด** (same-day เปิด/ปิด · รอบ pre-order ถัดไป) — แหล่ง state จริงต้องหาใน `src/lib`
- **probe อ่านอย่างเดียว:** อ่าน `social-ai-worker/index.ts` ส่วนประกอบ prompt (ดึงอะไรบ้าง: hours? rounds? service mode?) · `findstr /s /i "same_day same-day pre_order pre-order service_mode"` ใน `src/lib` หาแหล่ง state + อ่านหน้า `HomePage`/`shop` ที่โชว์ "ปิดรับคำสั่งวันนี้"
- **แผนแก้ (รอปลดล็อก):** ฉีด **สถานะสด** (same-day open/closed + รอบถัดไป + บังคับ "ปิด same-day = ตอบว่าสั่งได้เฉพาะพรีออเดอร์ + รอบถัดไป HH:MM") เข้า prompt **reply comment + inbox + generator สร้างโพส** (ชุดเดียวกัน) · เพิ่มเคสใน `socialAiContinuity.test.ts`
- **verify:** คอมเม้น "สั่งได้เลยไหม" ตอนปิด same-day → ต้องบอกพรีออเดอร์+รอบถัดไป ไม่บอก "เปิดถึง 20:00" · test ผ่าน

### B5 — แจ้งเตือนลูกค้าเมื่อบอต AI สร้างโพส/ตอบโพส (**เปิด D-4 — ถาม Owner ก่อนลงมือ**)
- **ข้อกำหนด:** ทุกครั้งที่บอต AI สร้างโพส หรือ ตอบคอมเม้น → ส่งแจ้งเตือนถึงลูกค้าด้วย
- **ติดขัด:** "แจ้งเตือนเฟซลูกค้า" = ช่องทาง/ผู้รับไม่ชัด — **D-4 (ใหม่):** (ก) FB เดิม (คอมเม้นตอบ = FB แจ้งผู้คอมเม้นเอง · โพสใหม่ = ขึ้น feed) (ข) Notification ในแอพลูกค้า (probe `findstr notification แจ้งเตือน src\lib`) (ค) Line/OA
- **แผนแก้ (หลัง D-4):** hook จุดที่ reply `sent` + post `published` → insert notification ตามช่องทางที่เลือก

### B6 — คำตอบ AI ผิดบริบท + ลิงก์ `?cart=` เปิดมาไม่มีสินค้าจริงในตะกร้า
- **อาการ/ภาพ:** ภาพ 6 — AI เคลม "ข้าวเรนเซอร์ล่อน x1 + ข้าวกุ้ง x2" + ลิงก์ `.../shop?cart=eyJ2jo...` (URL ถูกตัด `...`) · ภาพ 7-8 — เปิดมาไม่เห็นของตามเคลม (Owner: "อาจเป็นแคชมือถือที่ลอง")
- **ต้นตอที่ต้องพิสูจน์:** ① สินค้าในคำตอบ = AI เดา ไม่ได้มาจาก catalog จริง ② payload `cart=` ไม่ตรง schema ที่หน้า `shop` รับ (หรือไม่รองรับเลย) ③ ลิงก์ถูก FB/AI ตัด → พัง
- **probe อ่านอย่างเดียว:** `findstr /s /n /i "cart=" src` → อ่านหน้า `shop` ว่ารับ param `cart` ไหม + schema · อ่านส่วน build ลิงก์ใน `social-ai-worker` (ประกอบจากอะไร · ตัดยาวไหม) · ทดสอบในเครื่อง: build payload จาก id จริง → เปิด `/shop?cart=...` ดูตะกร้า (ไม่ต้อง deploy)
- **แผนแก้ (รอปลดล็อก):** คำตอบ/ลิงก์ **จาก catalog ที่ fetch ใน turn เดียวกันเท่านั้น** (ฟังก์ชันเดียวกับ Bite AI waiter) · whitelist รูปแบบลิงก์ (ห้าม AI ต่อ URL เอง) · ถ้า shop ไม่รองรับ `cart=` → ลิงก์หมวด/สินค้าตรง · ตัด length ให้ครบเสมอ
- **verify:** คอมเม้นถามสั่ง x+y → ชื่อ/ราคา ตรง catalog + ลิงก์เปิดเห็นของจริงในตะกร้า (desktop + มือถือ Owner)

### B7 — พิมพ์ต่อเนื่อง ×4 → ได้ 2 เว้น 1 วน (ดวงเดี่ยว + ตำแหน่ง/ขนาด = ผ่านแล้ว ✓)
- **อาการ/ภาพ:** ภาพ 9 — ต่อเนื่องมี **ช่องว่างเว้นดวง** · Owner: ×4 → "พิมพ์ 2 เว้น 1 พิมพ์ 2 เว้น 1" · **ยืนยันแล้ว: ตำแหน่งถูก + ขนาดตรงพรีวิว + ดวงเดี่ยวผ่าน** (ปิด sub-test เดี่ยวของ Q-B)
- **ต้นตอที่ต้องพิสูจน์ (conflict บทเรียน R41 — ห้ามเดา):** โมเดลหน้าปัจจุบัน `page = faceH` → หน้าสั้นกว่า **pitch จริง (face + ช่องว่างมีเดีย)** → ตอนต่อเนื่อง gap-sensor หาช่องพลาดเป็นจังหวะสลับ → pattern 2-เว้น-2 · อาจเป็น firmware/เซนเซอร์ต้อง calibration
- **probe อ่านอย่างเดียว + Owner วัด (ไม่ใช้โค้ด):** ① อ่าน `node_modules\niimbot-web-bluetooth\src\label-memory.js` + `label-size.js` + `src/lib/niimbotBt.ts` หาโหมด continuous/gap (ส่ง height ต่อใบหรือรวมม้วน) ② อ่าน `src/lib/stickerPng.ts` (โมเดล R41) + `AdminPrintSettings` ฟิลด์ชดเชยฟีด ③ **Owner วัด:** pitch จริง 4 ใบต่อเนื่อง (ระยะ 1→4 หาร 3) เป็น มม. → ×11.81 = px (สูตร O-D) + ถ่ายรูปม้วนหลังพิมพ์
- **แผนแก้ (รอปลดล็อก + ตัวเลขวัดจริง):** เทสต์เมตริกซ์: page = faceH vs page = faceH+ช่องว่าง(=pitch−faceH) กับ ×4 · ถ้าผลชี้ต้องคืนหน้ายืด = แก้โมเดลพร้อม test ใหม่ · พิสูจน์ด้วยพิมพ์จริงก่อนแก้ถ้าจำเป็น
- **verify:** ×4 = 4 ดวงเต็มไม่มีช่องว่าง ×3 = 3 ดวง · เดี่ยวยังผ่านเหมือนเดิม

---

## 🔁 งานค้างรวมทั้งหมด (consolidated — แชทหน้าทำให้หมดในบิลเดียว)

| # | งาน | สถานะ/หลักฐาน | ทำเมื่อไหร่ |
|---|---|---|---|
| 1 | ~~**CI HEAD `b8c8c15`**~~ | **ปิดแล้ว ✓:** probe `b8c8c15` = NO_FAILED_RUN · **รอบ probe เพิ่ม: HEAD `79cd6eb` = CI ✅ + Contract ✅ ×2 + automation-scheduler ✅ = NO_FAILED_RUN อีกครั้ง** | เสร็จ (probe ครั้งเดียวตอนจบ wave = รันแล้วรอบ `79cd6eb`) |
| 2 | ~~**m178 cron ยิงซ้ำจริงไหม**~~ | **ปิดแล้ว ✓ (`e2e/r43_tick_probe.json` + `r43_publish_probe.json`):** `bmb-promote` ~100%/นาที · `bmb-tick` ทุก 5 นาที · `auto-exec-tick-mk-*` succeeded ต่อเนื่อง T09→T14 · `g26-poll-*` รายชม. ไม่ขาด · **พบ+พิสูจน์ root cause B2/B3 แล้ว = EF `automation-worker` production เก่า (deploy 30 ต.ค. vs โค้ด R39 31 ต.ค. ไม่เคยขึ้น) → `scanned=0` ทุก tick** | เสร็จ — คู่ B2/B3 (แก้ = deploy เมื่อยกห้าม) |
| 3 | **Web bundle Cloudflare** = R40/R41/R42 UI ขึ้นจริงไหม (`sticker-wizard`, `ai-album`, `mk-gen-status`) | `node e2e\r41_web_bundle_probe.cjs` (รอบก่อน = ยังไม่ live) | หลังข้อ 1 |
| 4 | **Q-A..Q-D (§Q)** — Q-B ย่อย "ดวงเดี่ยว" **ผ่าน ✓** (ตำแหน่ง/ขนาด OK) · เหลือ: Q-A เจนรูป · Q-B ×4 (→B7) · Q-C ตั้งเวลา (→B1/B2) · Q-D คอมเม้น ≤3นาที (→B4) | รอ Owner/ผูก B1-B7 | ระหว่าง wave |
| 5 | **D-1/D-2/D-3 (§N.3) + D-4 ใหม่ (ช่องทางแจ้งเตือน B5)** | ถาม Owner รอบเดียว | ก่อนลงมือ B5 |
| 6 | **image-gen attempts tuning** | การ์ด ❌ (`mk-gen-status`) → fail ซ้ำ = ถอด/สลับ `IMAGE_GEN_MODELS` | หลัง Q-A |
| 7 | **EF logs API = 404 (blocker platform เดิม)** | error จริงอ่านจากการ์ดสถานะเท่านั้น | known — ไม่ blocker |
| 8 | GH scheduler = backup เท่านั้น (ตัด/ไม่ตัด) | ไม่ด่วน | หลัง B2 นิ่ง |
| 9 | full local vitest ~1,670 | **CI Test พิสูจน์แล้ว — ไม่ซ้ำ (policy)** | ข้าม |

## 🎬 Runbook แชทหน้า (ลำดับรันจริง — bootstrap ก่อนเสมอ)

0. ✅ **Bootstrap (ทำแล้ว):** อ่าน `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` (บล็อก R43 บนสุด) · **คำสั่งห้ามแก้โค้ด = ยังไม่ปลด** → รอบนี้ทำเฉพาะ read/probe/docs เท่านั้น
1. ✅ **CI probe (ทำแล้ว):** `node e2e\r36_ci_probe.cjs` → **`79cd6eb` เขียวทั้ง CI + Contract ×2 + automation-scheduler = NO_FAILED_RUN**
2. ✅ **B2/B3 probe (ทำแล้ว — evidence ครบ):** `e2e/r43_publish_probe.cjs` → `r43_publish_probe.json` (keys: `marketing_posts_48h` · `automation_queue_48h` · `cron_runs_48h` · **`approved_not_on_fb`** · `fb_compare`) + ต่อยอด `r43_approval_probe.cjs` · `r43_due_query_probe.cjs` · `r43_tick_probe.cjs` · `r43_ef_versions_probe.cjs` → **root cause = EF `automation-worker` production เก่า (ดูบล็อกผล probe ด้านบน)**
3. ✅ **B1 read (ทำแล้ว):** `ERR_APPROVAL_REQUIRED` = RPC + worker guard (m137/147 · automation-worker 554/565) · path พัง = ปุ่มตั้งเวลาไม่ gate approval (`AdminMarketing:147/545`) · string จริงเทียบภาพ 1 = ดูบล็อกผล probe
4. ✅ **B4/B6 read (ทำแล้ว):** prompt = static `SHOP_FACTS_TH` ไม่มีสถานะสด · แหล่ง state จริง = `homeProviders.getStoreStatusFromRounds` · `/shop?cart=` Layout รับจริงแต่ **decode-fail = เงียบ** → ออกแบบ payload/นโยบาย = ดูบล็อกผล probe (แผนเท่านั้น ยังไม่ลงมือ)
5. ✅ **B5 probe (ทำแล้ว):** โครง notification ครบ → **ยังรอถาม Owner D-4 (ช่องทาง/ผู้รับ) + D-1..D-3 เดิม รอบเดียว** (ถามพร้อมกันเมื่อส่งสรุป)
6. ✅ **B7 read (ทำแล้ว):** lib ไม่มี logic gap/continuous (firmware จัดการ) · `stickerSize` = faceH คงที่ → **ยังขอ Owner วัด pitch ×4 (มม.) ×11.81 + รูปม้วน** (ถามพร้อม D-4)
7. ⬜ **เมื่อ Owner ยกห้ามแก้ → wave R43 เรียง:** **① deploy `automation-worker` จาก HEAD (B2/B3 — โค้ดมีแล้ว ไม่ต้องเขียน)** → ② B1 gate + B4 live context + B6 catalog/toast → ③ B7 (ตามตัวเลขวัด) → ④ B5 (ตาม D-4) · **ทุก commit = lint chain ก่อน · test single-run · evidence json · ห้ามมีอักขระจีน · secrets ไม่ลง git · two-try rule**
8. ⬜ **เอกสารปิด wave (ทำรอบนี้แล้วบางส่วน):** TEST_PACK **§R (R43)** + work-state + master + แฮนออฟอัปเดต = **เขียนแล้วรอบ probe นี้** · push แล้ว **probe CI ครั้งเดียว** = รันตอนจบcommit
## 0. HEAD + CI (สำคัญสุด — เช็คก่อนงานอื่น)

- **R43 — ⚠️ PLANNED ONLY (คำสั่ง Owner "ห้ามโค้ดแก้" · 2026-10-31 20:40):** บั๊กใหม่ 7 ข้อ = B1 ตั้งเวลาเดียว+ERR_APPROVAL_REQUIRED+dialog เพี้ยน · B2/B3 โพส FB ไม่ตรงเวลา/มาไม่ครบ/ approve แล้วไม่ขึ้น · B4 AI ผิดบริบท (ปิด same-day → ได้แต่ pre-order) · B5 แจ้งเตือนลูกค้าเมื่อบอตโพส/ตอบ (**D-4**) · B6 ลิงก์ cart=ไม่มีของจริง · B7 ×4 ต่อเนื่อง=2-เว้น-1 (เดี่ยวผ่าน ✓) → **ผังละเอียด (อาการ/probe อ่านอย่างเดียว/แผนแก้/verify) + งานค้างรวม 9 ข้อ + Runbook ข้อ 0-8 = ในไฟล์นี้หัวข้อ R43 ด้านบน** · **แชทหน้า: bootstrap → CI probe `b8c8c15` → read-only probes B2/B1/B4/B6 → ถาม D-1..D-4 → รอปลดห้ามแล้วลงมือเรียง B1→B4/B6→B2/B3→B7→B5**
- **R42 — ตามคำสั่ง "อนุมัติ apply 177 178 + ตรวจบั๊ก/ภาษาเพี้ยนทั้งหมด":** ① **m177+m178 = APPLIED+VERIFIED ALL_PASS true** (`e2e/r42_verify177178.cjs`+`.json` — เติม ledger 178 · fns/_acl/cron/gate/due ครบ) ② **บั๊ก**: CI `1c3b429` เเขียว CI+Contract · vitest 86/86 · tsc 0 · lint 0 ③ **ภาษาเพี้ยน**: สแกนใหม่ `e2e/r42_lang_scan.cjs` 29→**0** (แก้ README·config×2·contracts_124·035 note=fact "ส่งเองในรัศมี 5 กม."·HANDOFF_002×12·work-state×2 · archive/UTF-16=ข้าม) · **งานแรกแชทหน้า = probe CI HEAD + ดู cron.job_run_details/queue/poll รอบใหม่** · รอ Owner = §Q (Q-A..Q-D)+§N.3
- **R41 — 4 ของใหม่ (2026-10-31 บ่าย):** ① **image-gen = ทะเบียนจริง 12 ตัว (qwen/seedream = ID ผิดจริงตาม attempts) → list ใหม่ 6 ตัว + images API ก่อน + pickImage ทุกรูปทรง** (EF deploy + secret `IMAGE_GEN_MODELS` ใหม่ตั้งแล้ว) ② **สติกเกอร์ = โมเดล R41: หน้าคงที่ faceH (offset ไม่ยืดหน้า — +62/ใบ คือต้นตอข้ามดวง) + QR ผูกขอบล่างในหน้า + วิธีใช้/test อัปเดต** ③ **m178 APPLIED+VERIFIED: pg_cron+pg_net + `bmb-promote * * * * *` + `bmb-tick */5 * * * *` active + EF cron-tick deploy (gate 401) + secrets ตั้งแล้ว — E2E 06:33Z พิสูจน์ FB ขึ้น (`prov=true`) + comment poll รัน · GH = backup เท่านั้น** (รอบแรกพลาด dollar-quote/RAISE/config ซ้ำ = แก้แล้ว · evidence `e2e/r41f_state.cjs`/`r41g_schedule_tick.json`) ④ **AI ตอบโพสต์/inbox = inbound ปกติจริง** (คอมเม้น 05:48 `sent` 10วิ) — ที่หยุด = poll/FB ตาม GH → ปิดด้วย ③ · **ขั้นทดสอบ = `docs/BMB_PRODUCTION_TEST_PACK.md` §Q (Q-A..Q-D) · ตัดสินใจ = §N.3 (ยึด §N/§O/§P/§Q ก่อนหัวข้ออื่นถ้าขัด)**
- **R40 — 3 ของใหม่ (2026-10-31 สาย 2):** ① **เจนภาพ = การ์ดสถานะ ⏳✅❌ (`mk-gen-status`) + พรีวิว (`mk-gen-result`) + อัลบั้ม `bmb-images/ai-generated/` จิ้มเลือกใช้ (`mk-ai-album`) + error อ่าน text/JSON เสมอ + EF `ERR_UNCAUGHT` wrap** ② **สติกเกอร์ = ตั้งหลักใหม่: วิซาร์ด `sticker-wizard` (บันทึกอัตโนมัติ→พิมด้วยค่าที่โชว์จอ→×4 ตรวจน้ำข้ามดวง) + `btPrintWith` จุดเดียว + วิธีใช้ 2 ค่า + ปุ่ม HTML 4 จุด ⚠ไม่ใช้ชดเชย** (ต้นตอ: ปุ่ม QZ/ไดอะล็อก = HTML ไม่ใช้ค่า → Owner วัดผิดทาง) ③ logs EF = API 404 → เหตุจริงมาจากการ์ด ❌ · **ขั้นทดสอบ = `docs/BMB_PRODUCTION_TEST_PACK.md` §P (P-A..P-C) · ตัดสินใจ = §N.3 (ยึด §N/§O/§P ก่อนหัวข้ออื่นถ้าขัด)**
- **R39 — 4 ของใหม่ (2026-10-31 สาย):** ① **scheduled ค้าง = GH cron ข้ามรอบ (evidence `e2e/r39_sched_probe.cjs`: att=0 · run ล่าสุด 01:55Z)** → **m177 PREPARED** (`marketing_publish_due` + `marketing_feed_posts` + pg_cron guarded) + feed rpc + admin promote + worker published-unpushed + scheduler ทุก fire → **หลัง CI เขียว = `__apply 177__`/apply เองแล้ว verify** ② **image-gen**: attempts ทุกโมเดล + `reference_image_url` + auto brief → **deploy EF แล้ว/รอรอบ** ③ **flashTo = เด้ง+กระพริบจุดที่ทำงาน** ④ **สติกเกอร์: DB 709 live ยืนยัน → O-D วัด pitch (×11.81) + รูปพร้อมไม้บรรทัด** · **ขั้นทดสอบ = `docs/BMB_PRODUCTION_TEST_PACK.md` §O · ตัดสินใจ = §N.3 (ยึด §N/§O ก่อนหัวข้ออื่นถ้าขัด)**
- **R38 ปิดแล้ว (2026-10-31 · 7 คำสั่ง Owner):** สติกเกอร์ faceH 670→709 (production read-back) · image-gen `IMAGE_GEN_MODELS` secret ตั้งแล้ว · ลิงก์แผนที่ intent:// เปิดแอป · delivered 3 ล่าสุด+อัลบั้ม · ปุ่ม browse รูปเมนู · feed หน้าแรก + **m176 APPLIED+VERIFIED** (ALL_PASS 8/8 · ledger top=176 · anon probe 200 · `e2e/r38Apply176-result.json` · PostgREST reload ผ่าน `r38PgrstReload.cjs`) · **รายการบล็อก/งานค้าง/ขั้นทดสอบ = `docs/BMB_PRODUCTION_TEST_PACK.md` §N** · **รายการรอ Owner ตัดสินใจ = §N.3 (D-1 โต้ตอบในเว็บ · D-2 โมเดล image-gen · D-3 กติกาช่องว่าง)** (ยึด §N ก่อนหัวข้ออื่นถ้าขัดกัน)

- **HEAD = `3dc3342` (push แล้ว = `ff9132f` fix CI รอบ 2 + `c22e869`/`3dc3342` docs)** — R37: languageSanity จับอักขระจีน **2 จุดในเอกสาร** ของ `7048283` (`BMB_HANDOFF...md:7` + `BMB_MASTER_STATUS.md:7` — อ้าง fallback เดิมตรง ๆ เป็นหลักฐาน) → แก้เป็นคำไทย · verify = `npm run lint` เต็ม OK + `npx tsc --noEmit` 0
- **CI = เขียวหมด (พิสูจน์แล้ว):** `e4c3ad7` ✅ · **`ff9132f` CI+Contract ✅** · **`c22e869` CI+Contract ✅** · **NO_FAILED_RUN** ทุก workflow (probe `node e2e/r36_ci_probe.cjs` ไม่ต้อง token)
- **CI `7048283` (แดงรอบเดียว) = failure ที่ Lint (#5)** → สาเหตุซ้ำแบบ = อักขระจีนในเอกสาร → **แก้ใน `ff9132f`** → **งานแรกของแชทหน้า = เช็ค CI HEAD `3dc3342` ครั้งเดียวให้เขียว** (ทุก push = run ใหม่ · probe ตัวเดิม)
- ก่อนหน้า: `e4c3ad7` (fix CI รอบ 1) · `aa1b295` (R35) · `a6b3b34`/`4b2ffda` (R34)

## 1. งานค้างที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

### 1.1 Owner ทดสอบพิมพ์สติกเกอร์จริง (R35 — บล็อกหลัก)
- **แก้แล้ว:** ค่า Menu/Notice เริ่มหลัง `:` **บนบรรทัดเดียวกับป้าย** (Menu ≤2 บรรทัด · Notice ≤2 บรรทัด) · ช่วงเส้น Tel→QR **ลดเหลือ 40px** (เดิม ~160px)
- **ยังไม่ verify:** การพิมพ์จริง — Owner กดยืนยันออเดอร์ → ดูว่า (1) Menu/Notice อ่านตรงบรรทัดเดียวกับป้าย (2) QR ชิดขึ้นจริง (3) **ยังข้ามดวงไหม**
- **ถ้ายังข้ามดวง:** พิมพ์ใบวัดฟีด → วัดเส้นขอบล่าง → ใส่ `stickerFaceHPx` ในหน้าตั้งค่าพิมพ์ (min 640 max 760 · ค่าเริ่ม 709) → ทดสอบซ้ำ

### 1.2 image-gen EF deploy + คีย์ + โมเดล (R35) — **AI ปิดแล้ว (R37) เหลือ Owner กดเจน**
- ✅ **secret `BMB_OPENROUTER_API_KEY` = ตั้งบน production แล้ว** (พิสูจน์: `supabase secrets list` มีชื่อนี้ · digest ตรง `OPENROUTER_API_KEY`) → โค้ดที่อ่าน BMB ก่อน = ใช้คีย์จริง ไม่ fallback dev
- ✅ **EF `image-gen` deploy แล้ว** (`supabase functions deploy image-gen` = `DEPLOY_OK` บน project `ivkdfognyiwjcmrhcnwz` · evidence `e2e/r37_deploy_imagegen.log`)
- ✅ **liveness probe:** OPTIONS = **HTTP 200 `ok`** (CORS preflight ไม่ถูกบล็อก) · POST ไม่มี JWT = **HTTP 401 `UNAUTHORIZED_NO_AUTH_HEADER`** (verify_jwt กัน anon) — evidence `e2e/r37_imggen_options.txt` / `r37_imggen_noauth.txt`
- ⏳ **เหลือ Owner:** เปิด AdminMarketing → เจนรูปโปรโมต **1 ใบจริง** (admin JWT) — ถ้า fallback ข้าม 2 ตัวแรก (`qwen/qwen-image-3`, `bytedance-seed/seedream-5-0-flash`) ไป gemini = บันทึกว่าโมเดลคู่แรกใช้ไม่ได้จริง (แล้วถอด/สลับลำดับ · env `IMAGE_GEN_MODELS` override ได้)

### 1.3 gates + CI รอบ R35/R36
- **ผ่านแล้ว (ท้องถิ่น):** vitest **91/91** (8 ไฟล์) · **`npm run lint` เต็ม = OK** (eslint + brandNameGuard 491 + languageSanity 1391 — หลัง fix R36) · tsc 0 · build `e2e/r35_build.log` ✓ · r34+r35 re-run = 12/12
- **CI:** `aa1b295`/`7048283` = Lint พัง (แก้ใน `e4c3ad7`/`ff9132f`) · **`e4c3ad7` · `ff9132f` · `c22e869` = success ✅ ทุก workflow (CI+Contract) · NO_FAILED_RUN** · full vitest ท้องถิ่น ~1,670 = ยังไม่รัน — **CI Test step พิสูจน์ผ่านแล้ว ไม่ซ้ำโดยไม่จำเป็น**

### 1.4 งานค้างสะสม (ยังเปิดอยู่)
1. e2e auto-print ออเดอร์จริง (R31 โค้ดพร้อม · Owner ยืนยัน "รับออเดอร์แล้วสติกเกอร์ปริ้นอัตโนมัติจากใบสั่งซื้อจริง ตรงรายละเอียดกับ notice" แล้ว)
2. QZ Tray = ทุกครั้ง incognito + Remember this decision (Owner ยืนยัน 2026-10-30)
3. ~~CI รอบ R34/R35~~ = แทนที่ด้วยสถานะ `e4c3ad7` (หัวข้อ 0)

## 2. ไฟล์ที่แก้รอบ R35+R36 (push แล้วทั้งหมด — HEAD `e4c3ad7`)

| ไฟล์ | แก้ |
|---|---|
| `src/lib/stickerPng.ts` | Menu/Notice valX บรรทัดเดียวกับป้าย ≤2/≤2 · qrY=min(face, tel+40) |
| `src/pages/MenuPage.tsx` | ถอดชิปรอบ + ลบ state/import rounds · เรียงวันใกล้ก่อน |
| `src/pages/HomePage.tsx` | preOrderShowcase sort วันใกล้ก่อนก่อน slice(8) |
| `supabase/functions/image-gen/index.ts` | คีย์ BMB ก่อน dev · candidates +qwen-image-3 +seedream-5-0-flash |
| `src/__tests__/r35Contracts.test.ts` | ใหม่ 5 ข้อ (sticker/banner/sort) |
| `src/__tests__/stickerPng.test.ts` | +R35 2 ข้อ · แก้ faceH=660/`…` expectation |
| `src/__tests__/socialAiContinuity.test.ts` | +image-gen surfaces +เช็ค BMB<dev +โมเดล 2 ตัว |
| `e2e/r35_or_*.cjs` | probe scripts (diag/web) — evidence |
| `AI_WORK_STATE.md` | บล็อก R35 |

## 3. ทดสอบทั้งหมดที่ต้องทำ (แชทหน้า)

- [x] **เช็ค CI `e4c3ad7` / `ff9132f` / `c22e869`** → **success ทุก workflow ✅ · NO_FAILED_RUN** (R37 · `node e2e/r36_ci_probe.cjs`)
- [x] ~~CI `7048283` แดงที่ Lint~~ → แก้ 2 จุดในเอกสาร = `ff9132f` (verify `npm run lint` + `tsc` ผ่าน)
- [ ] **เช็ค CI HEAD `3dc3342` ครั้งเดียว** → ให้เขียว (probe ตัวเดิม · ทุก push = run ใหม่)
- [ ] Owner: พิมพ์สติกเกอร์จริง 1 ออเดอร์ → ถ่ายรูปส่งมา (Menu/Notice บรรทัดเดียวกัน · QR ชิด · ขอบดวง)
- [x] ~~secret `BMB_OPENROUTER_API_KEY` + EF image-gen deploy~~ = **ทำแล้ว ✓** (ดู 1.2 — เหลือ liveness ก็ผ่านแล้ว)
- [ ] Owner: เจนรูปจริง 1 ใบจาก AdminMarketing (admin JWT · คู่แรก qwen-image-3 / seedream-5-0-flash)
- [ ] e2e auto-print จริง (ถ้ายังไม่ทำ)
- [ ] (ถ้าต้องการ) full vitest ทั้งชุด local — CI Test ผ่านแล้ว ไม่บังคับ
