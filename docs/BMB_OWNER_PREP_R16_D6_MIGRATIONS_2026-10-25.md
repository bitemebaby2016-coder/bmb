# BMB — R-16 / D6 / B งานเตรียม Owner (เอกสารประกอบการตัดสินใจ · 2026-10-25)

> เอกสารนี้ = งานเตรียมที่ AI ทำได้โดยไม่แตะ production · การดำเนินการจริง = Owner

## 1. R-16 · การทดสอบพิมพ์จริง (เครื่องพิมพ์จริง = Owner acceptance)

### สิ่งที่ automated test ยืนยันแล้ว (แยกจากคุณภาพกระดาษจริง)
- `src/lib/printService.ts` — state machine ตรง: `requested → sent → acknowledged → printed | failed`
  (สารภาพตรง: `window.print()` = เบราว์เซอร์รับคำสั่งเท่านั้น → mark 'sent' — **ไม่เคยเคลมว่าพิมพ์จริง** จน Operator ยืนยัน 'printed')
- Rendering: ใบเสร็จ 80mm thermal + kitchen ticket · Thai-safe (system fonts ไม่โหลด resource ภายนอก)
- `src/__tests__/printTemplates.test.ts` มี coverage เทมเพลต · migration `128_print_jobs.sql` เก็บ job state
- `src/pages/admin/AdminPrintSettings.tsx` = ตั้งชื่อเครื่องพิมพ์/autoPrint receipt+kitchen/paper width

### ขั้นตอนทดสอบบนเครื่องจริง (Owner — เตรียมไว้ให้รันได้ทันที)
1. เปิด Settings → ตั้ง `ชื่อเครื่องพิมพ์ใบเสร็จ` + `ชื่อเครื่องพิมพ์คิวครัว` (หรือเว้นว่าง = ไดอะล็อกเบราว์เซอร์)
2. เปิด autoPrint ทั้งสองสวิตช์ (หรือกดพิมพ์ manual จากออเดอร์)
3. สั่งออเดอร์ทดสอบ 1 ออเดอร์ → จ่ายเงิน → ยืนยันในครัว
4. **PASS =** ใบเสร็จ 80mm ออกครบ (เลข order, รายการ, ยอด, วันเวลารอบ) + คิวครัวออก (รายการ+โน้ต) · ภาษาไทยไม่เพี้ยน
5. ทดสอบ failure: ปิดเครื่องพิมพ์แล้วสั่งพิมพ์ → job = `failed` ไม่ค้าง `sent`
6. ยืนยันใน UI ปุ่มยืนยัน 'printed' กดแล้ว job = `printed` (state ตรง DB)
- **เกณฑ์ไม่ผ่าน:** ข้อความไทยแตก/เลื่อน/ขาดบรรทัด · ยอดไม่ตรง · job ค้างสถานะ · autoPrint ไม่ทำงานหน้า checkout
- ผลจริง (actual) = **PENDING** จนกว่า Owner จะรัน — ห้ามถือว่าผ่าน

## 2. D6 · ปลด build เก่า `bitemebaby-5f7.pages.dev` (ต้อง Cloudflare account = Owner)

### หลักฐาน/ความสัมพันธ์ (จากรายงาน/โดเมนที่บันทึกไว้)
- Production ปัจจุบัน = **`biteme-baby.com`** (custom domain · auto-deploy จาก repo — โดเมนที่ acceptance plan ใช้)
- **`bitemebaby-5f7.pages.dev`** = build เก่า (STALE) — ห้ามใช้ตรวจภาพ (บันทึกไว้ใน acceptance plan ข้อ 3)
- ความเสี่ยงถ้าปลดไม่ถูก: ตัด custom domain/production ปัจจุบัน · เสีย preview เดิมที่ bookmark ไว้

### ขั้นตอนที่ต้องให้ Owner ทำบน Cloudflare Dashboard (AI ห้ามแตะ)
1. เปิด Workers & Pages → โปรเจกต์ทั้งหมด → ระบุว่าโปรเจกต์ไหนผูก `biteme-baby.com` (production จริง)
2. ตรวจ Integrations/Settings ว่า `bitemebaby-5f7.pages.dev` ไม่มี integration/DNS record ชี้มาที่ production
3. เลือก: (ก) ลบทั้งโปรเจกต์เก่า หรือ (ข) เก็บไว้แต่ปิด auto-deploy + เพิ่ม redirect 301 → `biteme-baby.com`
4. หลังทำ: เปิด `https://biteme-baby.com` = โหลดปกติ · เปิด `bitemebaby-5f7.pages.dev` = ตามที่เลือก (410/redirect) · CI/deploy รอบถัดไป ปกติ
- **สถานะ: PENDING Owner (ต้องใช้ Cloudflare account)**

## 3. Task B · Production migrations 150/151 (วิเคราะห์ครบแล้ว — รอ authorize แยก)

### 150 `orders_delivery_address_parity` (idempotent schema parity)
- **ผลกระทบ:** `ADD COLUMN IF NOT EXISTS orders.delivery_address TEXT DEFAULT ''` + COMMENT ·
  Production ที่มีคอลัมน์แล้ว = **no-op ทันที** (ไม่แตะแถว/ข้อมูล) · fresh-DB = เติมช่องว่างที่ 035-era trigger/app อ่านอยู่
- **ความเสี่ยง:** ต่ำสุด (metadata-only PG11+ · ไม่มี data write) · ไม่แตะ RLS/payment/order logic
- **ตรวจสอบหลังรัน:** `SELECT column_default FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_address'` → มีค่า · รันซ้ำ = ไม่ error (idempotent)
- **Rollback:** `DROP COLUMN` คืนได้แต่ข้อมูล manual-era หาย → แนะนำคงไว้ · dump คอลัมน์ก่อนถ้าจะ rollback

### 151 `order_status_history_baseline` (HISTORICAL_BASELINE — ต้องเลือกก่อน)
- **ผลกระทบ:** INSERT 1 แถว baseline (`from_status=NULL → to_status=สถานะปัจจุบัน`, actor SYSTEM,
  metadata backfill=true) เฉพาะออเดอร์ที่ยังไม่มี history · `WHERE NOT EXISTS` = idempotent · ไม่แก้/ลบที่มีอยู่
- **ทางเลือก Owner:** (ก) **APPLY HISTORICAL_BASELINE** = "ทุกออเดอร์มี ≥1 event" ไม่แต่งเรื่อง ·
  (ข) **BACKFILL_UNKNOWN = ทิ้ง 151** (ไม่ backfill — ห้าม apply)
- **ความเสี่ยง:** ต่ำ (insert-only) · ข้อจำกัด = ประวัติ step-by-step ย้อนหลังยังหายากตามที่ออกแบบ
- **ตรวจสอบหลังรัน:** นับออเดอร์ไร้ history = 0 · `SELECT count(*) FROM order_status_history WHERE metadata->>'backfill'='true'` = ที่คาด · รันซ้ำ = count ไม่เพิ่ม
- **Rollback:** `DELETE FROM order_status_history WHERE metadata->>'backfill' = 'true'` (มี entry ครบใน header ไฟล์)
- **ขั้นตอน:** staged `precheck → apply → verify` แบบ r8Apply148 (handoff) · backup ก่อนเสมอ

### คำขออนุมัติ (แยกต่างหาก — ต้องตอบก่อน AI จะแตะ production)
1. **Migration 150** — authorize apply? (expected: no-op/parity · risk ต่ำ)
2. **Migration 151** — เลือก (ก) APPLY HISTORICAL_BASELINE หรือ (ข) ทิ้ง 151?
3. (เพิ่มจาก Task A) **Migration 152 (เสนอ)** — `REVOKE EXECUTE ON FUNCTION set_menu_schedule/publish_menu_schedule FROM PUBLIC, anon;`
   = defect จริงที่ contract 039 G7 ตรวจพบ (ไม่มี REVOKE ที่ไหนใน history) · security-tightening = ต้อง Owner sign-off ก่อนสร้าง/commit/apply