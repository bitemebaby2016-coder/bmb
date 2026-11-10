# BMB — REMAINING TESTS ON LIVE (รายการที่ "ยังปิดไม่ได้" ณ 2026-11-10)

> **อัปเดต 2026-11-10 15:55 (Owner verified):** IMG-GEN ✅, D4 ✅, R91 ✅, R92-G ✅ — **เหลือ D2, D5, §T-A, R92-S** ต้อง retest ต่อ
> · **HEAD = `24fde21`** (docs update) · **Latest Bundle = `assets/index-Bh_24aFF.js`** (มี Floating Ad Multiple · Sources Filter · Badge · AiStudioTab→ContentTab merge)
> · **Migration 201 APPLIED PROD** · **Edge Functions `social-ai-worker` DEPLOYED exit=0** · gates 4/4 (tsc/lint/vitest/build = 0)
> · **ของปิดแล้ว/มีหลักฐานผ่าน = ไม่อยู่ในนี้** (รายชื่อปิดรอบนี้ = `AI_WORK_STATE.md` บล็อก "✅ ปิดแล้วในเซสชั่นนี้")

## ❌ BLOCKED — ปิดไม่ได้จนกว่า Owner ทำเอง (1 ข้อ)

| ข้อ | สถานะ | ต้องทำอะไรถึงปิดได้ |
|---|---|---|
| **OMNI-5** Meta Test User ทักเพจจริง | **BLOCKED** = รอคนใหม่ลงทะเบียนผู้พัฒนา (คำสั่ง Owner 7 พ.ย.) | ลงทะเบียนเสร็จ → รัน pack §R74-OMNI ขั้น 8 |

---

## ✅ ปิดแล้วรอบนี้ (Owner verified 2026-11-10 15:55)

| ข้อ | สิ่งที่ทดสอบ/ผล | Evidence |
|---|---|---|
| **IMG-GEN** | เครดิต OpenRouter เติมแล้ว → เจนรูปได้ปกติ (qwen/qwen-image-2.1-pro + seedream-5-0-flash) | Owner confirm |
| **D4** | ปุ่ม `intent://` ใหม่ — จาก DM/คอมเมนต์เปิดแอปแชทตรง + guide ใหม่ | Owner confirm |
| **R91** | hard reload `/shop` — การ์ดรีวิวสเกลเท่ากันทุกใบ + mobile-first | Owner confirm |
| **R92-G** | guide ในแอป FB/IG เห็น "เปิดผ่าน Chrome หรือ Safari เพื่อการใช้งานที่สมบูรณ์ที่สุด" | Owner confirm |

---

## ⏳ รอ retest บน live — โค้ด deploy แล้วหมด + Migration 201 APPLIED + EF DEPLOYED (hard reload ก่อนรันทุกข้อ)

| ข้อ | รีเทสต์อะไร | หลักฐาน deploy | วิธีทดสอบละเอียด |
|---|---|---|---|
| **D2** | prompt SAME_DAY — สั่ง "ขอคิดก่อนนะ" = draft ไม่มีรอบผิด · ยืนยัน = เลขจริง (RT-5.1/5.4) | EF `c9f77aa` deployed | ดูขั้นตอนด้านล่าง §D2 |
| **D5** | รอบ hardcode หายจริงในการสนทนา — ⚠️ marker ใน bundle **ฟันธงไม่ได้** (`D5_NEW_COPY=false` · copy อาจอยู่ฝั่ง EF) → **ดูจากคำตอบแชทจริงเท่านั้น** | `c9f77aa`/`d9e975d` | ดูขั้นตอนด้านล่าง §D5 |
| **§T-A** | ลิงก์ `?cart=` จาก FB → retry ชั้น 2 (2.5s) — Android กระโดด Chrome มีของครบ | `c9f77aa` | ดูขั้นตอนด้านล่าง §T-A |
| **R92-S** | อัปโหลดรูปใหญ่ (>300px/>100KB) ที่หน้า marketing/สินค้า → **ถูกลดเหลือ 300×300/≤100KB อัตโนมัติ** (โค้ด+test ผ่านแล้ว · **พฤติกรรมบน live ยังไม่ได้ลอง**) | `e65f6bf` · `compressToWebLimits` 4 จุด | **ดูขั้นตอนละเอียดด้านล่าง §R92-S** |

---

## 🕓 ยังไม่รันตามเดิม (ของเดิมค้างจาก 2026-11-08 — ห้ามตัด)

- **RT-4** ชุด ก · **RT-HOURS** (หลัง 20:30) · **RT-6.2** (บทแอดมิน 12 คีย์) · **RT-6.1** (ยกเว้น E1 = Owner waived "ไม่ต้องทำ") · **RT-6.4B2** (~11:00 แถบสถานะ)
- **CAP-14** SMS จริง + **CAP แถว 7·8·13·16·17·19** (รอ Owner ยืนยันเลขข้อ §2 MASTER_STATUS แล้วรัน)
- **RT-8 = ยังห้ามปิด** (pack §RG·16 · นับเมื่อ RT-1..7 จบ)

---

## ✅ ปิดแล้วรอบก่อน (2026-11-09/10) — ไม่ต้องรัน

R89b/c ยุบ+เรียงรีวิว `/shop` (Owner เห็น Verified Purchase) · R90 งาน 1 ลิงก์รีวิว + งาน 2 promo หมดอายุ ("หายแล้ว"/"ลิงก์ถูกต้อง") · two-try Attempt 1 = D2/D5/§T-A code+deploy (เหลือ retest ด้านบน) · D4 วิธีใหม่ code+deploy · R92 งาน 2 วลี guide (bundle proof) · งาน 3 บังคับ 300×300/100KB (gates+test+deploy) · งาน 1 image-gen = สืบจบ → เปลี่ยนเป็น BLOCKED เติมเครดิต (ด้านบน) · Floating Ad + Promotion Banner Settings (Kill Switch + max 3 + real links + image upload/browse + CNT-01 approve/reject) · Migration 201 APPLIED PROD · Edge Functions `social-ai-worker` DEPLOYED exit=0 · Test expectations fixed (3 pre-existing failures) · Food Theater Carousel (Admin-Curated Auto-Play) code complete · Theater Carousel Simplification (2026-11-10): 2 modes (Admin Curated / Daily Random), removed editorial/daily_copy/autoplay settings, filters pre-order expired

---

## 📋 สรุปสถานะรวม ณ 2026-11-10 15:55 (หลัง Owner verified)

| หมวด | สถานะ | รายละเอียด |
|---|---|---|
| **BLOCKED (รอ Owner)** | ⏸️ 1 ข้อ | OMNI-5 (ลงทะเบียน Meta Test User) |
| **รอ Live Retest (โค้ด Deploy แล้ว)** | 🔄 4 ข้อ | D2, D5, §T-A, R92-S |
| **✅ ปิดแล้วรอบนี้ (Owner verified)** | ✅ 4 ข้อ | IMG-GEN, D4, R91, R92-G |
| **✅ ปิดแล้วรอบนี้ (Deploy + Gates ผ่าน)** | ✅ 5 กลุ่ม | Floating Ad Multiple, Sources Filter, Badge, AiStudioTab Merge, Viewport Fix |
| **ยังไม่รัน/ค้างจากเดิม** | ⏳ หลายข้อ | RT-4, RT-HOURS, RT-6.x, CAP-x, RT-8 |

---

## 🎯 ขั้นตอนถัดไป (Owner Action)

1. **Hard reload (Ctrl+Shift+R) ที่ `https://biteme-baby.com`** (ถ้ายังไม่ได้ทำครั้งนี้)
2. **Run Live Retest ต่อตามลำดับ:** D2 → D5 → §T-A → R92-S
3. **จดผลทุกข้อ:** `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Evidence`
4. **FAIL = ทักแชท AI ทันที** → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try

---

## 📖 วิธีทดสอบละเอียด (Step-by-Step)

### §D2 — SAME_DAY Prompt (RT-5.1/5.4)
**เป้าหมาย:** ยืนยันว่า prompt "รอบเดียว 11:00-15:00" ไม่ขึ้นอีก · สั่ง "ขอคิดก่อนนะ" = draft · ยืนยัน = เลขรอบจริง

| ขั้นตอน | รายละเอียด |
|---|---|
| 1 | เข้า `https://biteme-baby.com` → พิมพ์ในช่องแชท: `อยากสั่งอาหารวันนี้` |
| 2 | ดู response: ต้อง **ไม่มี** ข้อความ "รอบเดียว 11:00-15:00" หรือ prompt เลือกรอบผิด |
| 3 | พิมพ์: `ขอคิดก่อนนะ` → ควรได้ **draft** (ไม่สร้าง order จริง) |
| 4 | พิมพ์: `ยืนยันเลย` → ควรได้ **เลขรอบจริง** (เช่น `รอบที่ 2 14:00-15:00`) |
| 5 | จดผล: `D2 · [เวลา] · [อุปกรณ์] · PASS/FAIL · copy response verbatim` |

---

### §D5 — Round Hardcode Gone
**เป้าหมาย:** ยืนยันว่าในแชทไม่มี hardcode "รอบที่ 1" / "รอบที่ 2" แบบตายตัว

| ขั้นตอน | รายละเอียด |
|---|---|
| 1 | เริ่มสนทนาใหม่: `สั่งกินโมงนี้ได้มั้ย` |
| 2 | สังเกต response: ต้อง **ไม่มี** คำว่า "รอบที่ 1" / "รอบที่ 2" แบบ hardcode |
| 3 | ถ้ามีให้เลือก → ต้องเป็น **เลขรอบจริงจากระบบ** (dynamic) |
| 4 | จดผล: `D5 · [เวลา] · [อุปกรณ์] · PASS/FAIL · copy response verbatim` |

---

### §T-A — Cart Retry 2.5s (Layout.tsx)
**เป้าหมาย:** ลิงก์ `?cart=` จาก FB In-App → กระโดด Chrome → retry ชั้น 2 (2.5s) → มีของในตะกร้าครบ

| ขั้นตอน | รายละเอียด |
|---|---|
| 1 | เตรียม URL: `https://biteme-baby.com/?cart=<cart_id>` (cart_id จาก order จริง หรือสร้าง test cart) |
| 2 | เปิดใน **FB In-App Browser** (ส่ง DM ให้ตัวเองใน FB Messenger แล้วกดลิงก์) |
| 3 | ควรเห็นหน้า "กำลังเปิดใน Chrome..." + ปุ่ม `intent://` → กด → กระโดด Chrome |
| 4 | ใน Chrome: รอ ~2.5 วินาที (retry ชั้น 2) → ต้องโหลดหน้าเช็คเอาท์ **มีของในตะกร้าครบ** |
| 5 | จดผล: `§T-A · [เวลา] · [อุปกรณ์] · PASS/FAIL · สนับสนุนภาพหน้าจอ Chrome` |

---

### §R92-S — Image Compression 300×300/≤100KB (compressToWebLimits)
**เป้าหมาย:** ยืนยันว่ารูปที่อัปโหลดใหญ่ (>300px หรือ >100KB) ถูกลดขนาดอัตโนมัติ

**เตรียมไฟล์ทดสอบ:** ใช้รูปภาพขนาดใหญ่ (เช่น 2000×1500px, 500KB+)

| สถานที่ทดสอบ | ขั้นตอน | ผลที่คาดหวัง |
|---|---|---|
| **1. Admin → Marketing → สร้างโพสต์/โปรโมชั่น** | 1. เข้า `/admin/marketing-promotions` → แท็บ `📝 สร้างเนื้อหา`<br>2. เลือกประเภท `โปรโมชั่น` หรือ `แบนเนอร์`<br>3. กด "อัปโหลดรูป" → เลือกไฟล์ใหญ่ (>300px, >100KB)<br>4. กด "สร้าง/บันทึก" | - รูปที่เซฟใน Supabase `bmb-images` มีขนาด **≤300px ด้านยาวสุด** และ **≤100KB**<br>- Toast แจ้งสำเร็จ (ไม่ error) |
| **2. Admin → Products → เพิ่ม/แก้ไขสินค้า** | 1. เข้า `/admin/products` (หรือหน้าจัดการเมนู)<br>2. กดเพิ่มสินค้าใหม่ หรือแก้ไขสินค้ามีอยู่<br>3. อัปโหลดรูปสินค้าไฟล์ใหญ่ (>300px, >100KB)<br>4. บันทึก | - รูปสินค้าใน storage ถูกลดเป็น **≤300px / ≤100KB** |
| **3. Admin → Portfolio (AI Album)** | 1. เข้า `/admin/marketing-promotions` → แท็บ `📝 สร้างเนื้อหา`<br>2. ส่วน "AI Album" → กด "สร้างภาพ" (genKind=promo/festival)<br>3. รอภาพเจนเสร็จ → ตรวจสอบไฟล์ใน `bmb-images/ai-generated/promo` | - ภาพที่ AI เจน → ผ่าน `compressToWebLimits` อัตโนมัติ (≤300px / ≤100KB) |

**วิธีตรวจสอบขนาดไฟล์จริง:**
1. ใน Supabase Dashboard → Storage → `bmb-images` → ไฟล์ที่เพิ่งอัปโหลด
2. กดดู metadata: `width`, `height`, `size` (bytes)
3. ต้องเป็น: `max(width, height) ≤ 300` และ `size ≤ 102400` (100KB)

**จดผล:** `R92-S · [เวลา] · [อุปกรณ์] · PASS/FAIL · width×height · size(KB) · สถานที่ทดสอบ`

---

## 📋 บันทึกผล (เทมเพลตต่อข้อ)
`ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Evidence (width×height/size KB / copy response / screenshot) · toast ถ้าพลาด`

> FAIL ข้อใด = ทักแชท AI ทันที → จด `AI_WORK_STATE.md` + แจ้งแก้แบบ two-try · **ห้ามแก้เอกสารให้ดูผ่าน** · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง

---

## กติกา (คงเดิม)

1. ใช้ **`https://biteme-baby.com`** เท่านั้น · **hard reload (Ctrl+Shift+R) 1 ครั้ง** ก่อนเริ่ม · เปิด F12 Console ทิ้งไว้
2. บันทึกทุกข้อ: `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · evidence (ภาพ/copy ข้อความ toast สีแดง verbatim)`
3. **FAIL = จด defect ใหม่ลง `AI_WORK_STATE.md`** (แจ้งแชทถัดไป · two-try) · **SKIPPED ≠ PASS** · **ห้ามตัดข้อทิ้ง**
4. ห้ามใช้ข้อมูลลูกค้าจริงทดสอบ · ออเดอร์ทดสอบ = **cancel เมื่อจบ**
5. เสร็จแต่ละกลุ่ม → ทักแชทบอก AI ให้สรุปเข้า work state + test pack