# BMB — CONTROLLED ACCEPTANCE TEST RUNBOOK (อนุมัติแล้ว 2026-10-16)
## คำสั่ง Owner: pre-order 1 ใบ (ส่ง 17 ต.ค.) + same-day 1 ใบ (17 ต.ค.) · ลูกค้าเบอร์ 085 810 1984 · งบรวม ≤300 บาท

> เตรียมระบบเสร็จแล้วทั้งหมด — เหลือขั้นของมนุษย์ (สั่ง/สแกนโอน/ยืนยันยอด) · เวลาไทย · หลักฐานเก็บทุก step

## 0. สถานะพร้อม (verified 2026-10-16 ~20:00)

| รายการ | สถานะ |
|---|---|
| QR PromptPay ใช้ได้ | ✅ ผ่านแล้ว (render จริง · TXN · admin confirm — ดู `backups/qr-*`) |
| เมนู 17 ต.ค. (pre-order) | ✅ publish แล้ว 2 รายการ: **กุ้งมันฝรั่งผัดเนย ฿79 · สเต็กปลาดอลลี่ ฿79** (PRE_ORDER ทั้งคู่) |
| รอบส่ง 17 ต.ค. | ✅ 3 รอบ (morning cutoff 23:59 · midday 10:30 · evening 16:00) |
| SMS/OTP จริง | ✅ ส่งถึง 081 784 7992 แล้ว 2 ข้อความ (quick_login + guest_checkout) — แก้ contract `sms-send` แล้ว deploy |
| กันออเดอร์ซ้ำ (124) | ✅ active บน production (replay proof แล้ว) |
| `pre_order_lead_days` | 1 — **pre-order ส่ง 17 ต.ค. ต้องสั่งคืนนี้ (16) ก่อนเที่ยงคืน** |
| สินค้า same-day (17 ต.ค.) | ชาไทยพีช/แบล็คมินท์ ฿39 · ชาไทยนมสด ฿65 · ผัดไทยกุ้งสด/ลุยสวน/ลาบอกไก่ ฿69 (เมนู 17 ทั้ง 2 รายการเป็น pre-order เท่านั้น) |

## 1. ออเดอร์ A — PRE-ORDER (สั่งคืนนี้ 16 ต.ค. · ส่ง 17 ต.ค.)
1. ลูกค้า (085 810 1984) เปิด `https://biteme-baby.com/menu` → เลือกแท็บ **"สั่งล่วงหน้า"** → วันที่ **17 ต.ค.** (badge ขึ้นแล้ว)
2. เลือกเมนู 1 จาก 2 รายการข้างบน (อาหาร ≤200 บาท) → ตะกร้า → checkout
3. Login: ใช้ OTP (SMS จริง) หรือ password → ที่อยู่ในโซน 5 กม. + ปักหมุดแผนที่
4. ชำระเงิน: **PromptPay QR** → สแกนโอนจริงตามยอด → คัดลอก Transaction ID จากแอปธนาคาร → ใส่ในหน้าชำระเงิน → กด "ส่งข้อมูลการชำระเงิน"
5. ⚠️ **ทดสอบกันสั่งซ้ำ:** กดปุ่มสั่งซ้ำอีกครั้ง/refresh แล้ว submit ใหม่ → ต้องได้**เลขที่เดิม** + toast "ตรวจพบการส่งซ้ำ — ใช้ออเดอร์เดิม" (ห้ามมีออเดอร์ที่ 2)

## 2. ออเดอร์ B — SAME-DAY (สั่งวันพรุ่งนี้ 17 ต.ค.)
1. เปิด `/shop` หรือ `/menu` → แท็บ **"สั่งวันนี้"** → เลือกสินค้า same-day (รายการในตารางบน) 1 ใบ ≤200 บาท
2. เลือกรอบที่ยังไม่หมด cutoff (ก่อน 10:30 = midday / ก่อน 16:00 = evening)
3. ที่อยู่/จ่ายเงิน/กรอก TXN เหมือนข้อ 1 + ทดสอบกันสั่งซ้ำเช่นกัน

## 3. แอดมิน (ผมประกบให้ทุก step)
1. **ตรวจเงินเข้าบัญชีจริงตรงยอด** (ไม่ใช่สลิป — คู่มือ บ.8) → `/admin` ยืนยันชำระเงิน → `payment_status=completed`
2. `/admin/kitchen` → preparing → ready (สังเกต dead queue ใหม่)
3. `/admin/delivery` → assign Bite Drive rider → ไรเดอร์รับที่ `/rider` → picked_up → in_transit → delivered
4. **บรรทัด `📍` บนบัตร dispatch ต้องแสดง `dropoff_detail` จริง** (หลักฐาน fix WAVE 5B)
5. `/track/<เลขที่>` ดูคู่กัน — timeline ตรง · ยอด = subtotal+fee−discount
6. screenshot ทุก step + `order_status_history` — เก็บเป็นหลักฐาน (ห้ามลบ)

**Failure/rollback:** QR หมดอายุ → แอดมิน cancel intent · ไรเดอร์ไม่รับ → assign ใหม่ · ผิดพลาดหนัก → ยกเลิกออเดอร์ + คืนเงินโอนมือ · backup ก่อน/หลัง

## 4. Billing / PITR (คำสั่งข้อ 2 — "หาไม่เจอ")
**สาเหตุ:** โปรเจกต์อยู่ใต้บัญชีส่วนตัว **`bitemebaby2016-coder`** ("bitemebaby2016-coder's Project") — ถ้า login ด้วยบัญชีอื่นจะไม่เห็น Billing เลย และ token ที่เครื่องมือใช้เป็นแบบ project-scoped (จัดการ billing ไม่ได้)
**วิธีทำ (ต้องบัญชีเจ้าขององค์กร):**
1. ล็อกอิน `supabase.com` ด้วยบัญชี **bitemebaby2016-coder** (บัญชีที่สร้างโปรเจกต์)
2. มุมขวาบน (ไอคอนโปรไฟล์/ตัวเลือกองค์กร) → **Organization Settings → Billing** (ไม่ใช่ในหน้า Project!)
3. **Upgrade เป็น Pro** (~$25/เดือน — แผน Free ไม่มี backup/PITR เลย ตรงกับที่เจอ `backups:[]`)
4. กลับมาที่ Project `ivkdfognyiwjcmrhcnwz` → **Settings → Add-ons** → เปิด **PITR**
5. บอกผม → ผม verify ผ่าน API + รัน restore test ทันที
*ถ้าบัญชีคุณไม่ใช่ bitemebaby2016-coder: ให้บัญชีนั้นเชิญคุณเป็น **Owner** ที่ Organization → Members ก่อน*

---
*จัดทำ 2026-10-16 · evidence: backups/qr-* · otp_challenges 4 แถว · menu_schedule 17 ต.ค. published ×2 · rounds 17 ต.ค. ×3 · sms-send fix commit นี้*