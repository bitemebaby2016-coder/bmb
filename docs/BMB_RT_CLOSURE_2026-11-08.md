# BMB — RT CLOSURE REPORT (2026-11-08 บ่าย)

> **รายงาน ณ เวลานี้เท่านั้น** (point-in-time) · canonical state = `docs/BMB_MASTER_STATUS.md` · ผลรายข้อครบ = `docs/BMB_REMAIN_TESTS_LIVE_2026-11-08.md` (ตารางผลการรันรอบบ่าย)
> แหล่งผล:  Owner แจ้งทางแชท + ภาพแนบ (หน้า `/admin/orders` 13:07–13:08 น. · เฟซ 13:25–13:28 น.) · บันทึกโดย AI = RT-INTAKE 2026-11-08 บ่าย
> **กติกาที่ใช้:** NO EVIDENCE = NOT DONE · SKIPPED ≠ PASS · ห้ามแก้เอกสารให้ดูผ่าน

---

## 1. สรุปผลรอบนี้

| สถานะ | จำนวน | รายการ |
|---|---|---|
| ✅ PASS | 16 ข้อ | RT-1.1/1.2/1.3 · RT-2.1 · RT-3.1/3.2/3.3/3.5/3.6/3.7 · RT-5.2 · §T-B(3) · §T-C(4) · §T-D(4) · §T-E(2) · CAP-10 |
| ✅ PASS ใหม่ | 1 รายการ | **OMNI-5 ผ่านบน live = ปลด BLOCKED** (เดิมรอลงทะเบียนผู้พัฒนา) — follow-up: ตรวจสอบ "รายการใหม่" ที่ AI แจ้งให้ตรงจริง |
| ❌ FAIL ค้าง | 3 ข้อ | **RT-5.1 = D2** (บางส่วน: ราคา/เมนูถูก คำตอบรอบส่งผิด) · **RT-5.3 = D3** · **RT-5.4 = D2+D4** |
| 🔧 D1 = FIXED | 1 ข้อ (RT-3.4) | แก้แล้ว R83 · commit `d305dc7` push · gates 4/4 (tsc·lint·vitest 220·build) — **เหลือ retest live หลัง auto-deploy** |
| ⏳ DEFERRED | 1 ข้อ | **RT-1.4** — Owner: "ติดไว้ตอนปิดร้าน" → รันช่วงก่อน 08:00 / หลัง 20:00 |
| ⏳ ยังไม่รัน | 4 กลุ่ม | RT-4.1–4.7 · RT-5.5–5.7 · RT-6.1–6.4 · §T-A(6) · CAP-11/14 + CAP 7·8·13·16·17·19 |

## 2. Defect ใหม่ (สอง tries · รอแชทหน้าทำ)

| ID | ข้อ | ปัญหา | หลักฐานโค้ดที่ verify แล้ว | แนวทางแก้ |
|---|---|---|---|---|
| **D1** ✅ ปิดครบ + APPLIED | RT-3.4 | ~~ออเดอร์ 4 ใบ cancel แล้วยังค้างแผง + ปฏิเสธสลิปขึ้น `ERR_ORDER_CLOSED`~~ → **R83 แผง (`d305dc7`) · R84 โค้ด void (`5573d2b`) · R85 apply ลง PROD (Owner อนุมัติ)** | guard `162_admin_reject_payment.sql:25` คงเดิม ไม่ทำให้อ่อน · `AdminOrders.tsx`+`SlipReviewPanel.tsx` (R83) · mig 194/195 + UI (R84) | **ทำแล้ว + verify จริง:** กรอง `status='cancelled'` ออกจากแผง · enum `payment_status` += `void` · backfill 4 ใบ = `void` (stale = 0) · `cancel_order` มี void-close + `SET status='cancelled'` · gates 4/4 · หลักฐาน `e2e/_r85_apply.log` → **เหลือ: retest UI hard reload (4 ใบต้องโชว์ void ไม่ใช่ pending)** |
| **D2** | RT-5.1 · RT-5.4 | คำตอบแชทเรื่องส่งยังผิด — สั่ง SAME_DAY กลับบอก/อ้างรอบส่ง (จริง = ส่งได้ตลอดเวลาที่ร้านเปิด · ไม่มีรอบ) · PRE_ORDER ที่เลยรอบไปแล้วยังพูดถึงรอบนั้น | `_shared/orderWindow.ts` + `socialOrderIntake.ts:258` ("SAME_DAY คงเดิม m148: ไม่มีปิดรอบ") + tests `r82OrderWindow` 21 ข้อ / `roundsSameDayNoCutoff` = โค้ดมีกติกาแล้ว แต่คำตอบจริงยังผิด | เจาะ prompt/สาย intake ของ **แชต (DM)** ว่าเข้าบล็อก ORDER WINDOW จริงไหม + ตรวจข้อความตอบจริง · อาจต้อง enforce structured field แทนให้โมเดลเขียนเอง |
| **D3** | RT-5.3 | ยืนยันแล้วได้เลข BMB จริง + ลิงก์จริง แต่ **จำนวนผิด** (สั่ง 2 ที่) | structured extraction จำนวน (`socialOrderIntake.ts` schema `qty`) | ตรวจ field จำนวนก่อนสร้างออเดอร์จริง + โน้ตออเดอร์ |
| **D4** | RT-5.4 | ลิงก์ในแชท **ไม่ยอมเปิดบราวเซอร์ภายนอกจริง** (ยังเปิด in-app) | — (งานฝั่ง client link handling · อ้าง R57) | ตรวจ target/deep-link ของลิงก์ในข้อความแชท |
| **D5** | RT-3.6 (คำขอ · enhancement) | โพสต์ที่สร้างต้องลงรายละเอียด: พรีออเดอร์ = วันไหน/รอบไหน · เซมเดย์ = ส่งได้ตลอดเวลาช่วงร้านเปิด | mirror กติกาเว็บ (strip copy R53) | เพิ่มบล็อกรายละเอียดในเทมเพลตโพสต์ |

## 3. งานบ้าน/ของค้าง

- **ออเดอร์ทดสอบ 4 ใบ** `BMB-20261108-484/850/613/767` = cancel แล้วแต่ค้างแผง → **D1 = แก้แล้ว (R83 · `d305dc7` push · แผงจะกรองออเดอร์ `cancelled` ออก) — เหลือ retest live: hard reload → แผงต้องไม่มี 4 ใบ + ไม่มี toast `ERR_ORDER_CLOSED`**
- **ออเดอร์จาก RT-5.3 (ยืนยันแล้วจำนวนผิด)** = **ยังไม่มีใครยืนยันว่า cancel แล้ว** → เช็กที่ `/admin/orders` + DB แล้ว cancel ก่อนรอบถัดไป (กติกาข้อ 4 ของ test pack)
- **RT-1.4** = รอช่วงปิดร้าน
- **ห้ามพูดว่า "ปิดครบทุกลูป"** — RT-8 (เกณฑ์ปิด 6 ข้อ) ยังไม่ครบ เพราะมี FAIL ค้าง + ข้อค้างรัน

## 4. ขั้นถัดไป (ตามลำดับ)

1. ~~Owner รัน SQL 194→195 ใน SQL Editor~~ → **ทำแทนแล้ว (R85 · Owner อนุมัติ): apply ลง production ผ่าน Management API + verify ผ่านครบ** (`e2e/_r85_apply.log`)
2. **Owner/แอดมิน:** retest **RT-3.4** — hard reload Ctrl+Shift+R → `/admin/orders` → 4 ใบต้องโชว์ `🚫 void (ยกเลิก ไม่เก็บเงิน)` ไม่ใช่ `⏳ pending` · แผงตรวจสลิปไม่มี 4 ใบค้าง · ไม่มี toast `ERR_ORDER_CLOSED`
3. **แชทหน้า:** รับ **D2 → D3 → D4** ทำ two-try · D5 = enhancement ทำพร้อมกันได้ (**D1 = ปิดแล้วทั้งแผงและสถานะชำระ + DB applied**)
3b. **Owner retest งาน R86:** `/admin/orders` ว่าง (ทดสอบ 5 ใบถูกลบ) + หน้าต่างตรวจสลิปกลับมา (empty state) · `/admin/settings` สวิตช์ COD (default ซ่อน) · `/shop` theater ไม่โชว์เมนูเลยรอบ · **mig 190–193 = applied + verified แล้ว (history ครบ 190–195) — ไม่ต้องทำอะไรเพิ่ม**
4. **Owner:** รัน RT-1.4 ตอนปิดร้าน · ต่อคิว RT-4 → RT-5.5–5.7 → RT-6 → §T-A → CAP ที่เหลือ
5. **หลังแก้ D2–D4:** retest RT-5.1/5.3/5.4 แล้วอัพเดท test pack ใหม่

---
*จัดทำ: AI (RT-INTAKE) · 2026-11-08 · evidence ชี้กลับไปที่ test pack + `AI_WORK_STATE.md` บล็อก SESSION ACTIVE*
