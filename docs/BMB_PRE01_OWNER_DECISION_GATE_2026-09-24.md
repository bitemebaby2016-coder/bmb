# BMB — PRE-01 OWNER DECISION GATE (2026-09-24)

> สถานะ: รอ Owner ตอบ 3 ข้อ — ห้าม AI DEV เดา policy (กฎ Section 6 ของ Master Execution Command)
> ผลผูกพัน: คำตอบแต่ละข้อจะถูก implement เป็น server-side enforcement (backend authoritative) และเขียน acceptance test ตามคำตอบโดยตรง
> ทางเลือกแนะนำ (RECOMMENDED) อ้างจากข้อมูลจริงในระบบ: rounds ปัจจุบัน 3 รอบ/วัน (cutoff 08:00/10:30/16:00), capacity ต่อรอบ, inventory deduct ปัจจุบันเกิดตอน `confirmed` (Migr 019/028)

---

## คำถามที่ 1 — PRE_ORDER WINDOW

**ตัวเลือก:**

| ตัวเลือก | ความหมาย | ผลต่อระบบ |
|---|---|---|
| A. 3 วันข้างหน้า (แนะนำ) | สั่งล่วงหน้าได้ D+1 ถึง D+3, ต่อ round ตาม cutoff ของ scheduled_date | เพิ่ม validation ใน `create_order_with_items` (PRE_ORDER): `scheduled_date BETWEEN today+1 AND today+3` + ERR code ใหม่ | :  ตอบ A. 3 วันข้างหน้า
| B. 7 วันข้างหน้า | D+1 ถึง D+7 | เดียวกันแต่ขยาย range — ต้องรับ risk: ตาราง rounds/capacity ไกลขึ้น, ensure_rounds_for_date สร้างรอบล่วงหน้ามากขึ้น |
| C. ไม่จำกัดวัน | สั่งได้ทุกวันในอนาคต | ไม่แนะนำ — capacity/การผลิตวางแผนยาก, ผิดความตั้งใจเดิม (028: max +30 วัน) |

**Cutoff semantics (ตอบด้วย):**
- [ ] 1A. cutoff ตาม `delivery_rounds.cutoff_time` ของ scheduled_date (มีอยู่แล้ว — ใช้เดิม, แนะนำ)
- [**] 1B. เพิ่ม cutoff แยกสำหรับ PRE_ORDER (เช่น ปิดก่อน same-day cutoff) — ต้องเพิ่ม column/setting ใหม่(ตัดก่อนรอบส่งประจำวันของ pre order เอง Preorder จะมีเมนูเป็นของตัวเองออกเมนูเป็นรายอาทิตย์ ให้ลูกค้าเลือกตามเมนูที่จะถูกกำหนดวันไว้อยู่แล้วมีวันละ2เมนูสลับกันไป ปล่อยเมนูสัปดาห์ละครั้ง ปิดรับออเดอร์ของวันนั้นก่อนเวลาจัดส่ง ของรอบนั้น 2 ชม.  Bite delivery  ส่งเอง เป็นรอบ7โมง-9โมงเช้า, 11โมง-บ่ายโมง, 6โมง-2ทุ่ม ) เปิด/ปิดได้ทั้งโหมดทั้งวันและเฉพาะมื้อเหมือนแกรบ ui ตรงเมนูลูกค้าต้องเห็นระยะทางระหว่างร้านกับลูกค้าเล็กๆมุมจอเมนูเหมือนแกรบด้วย

**max_preorder_days ค่าที่ตกลง:** ___40___

---

## คำถามที่ 2 — CANCEL-AFTER-CUTOFF POLICY

**ตัวเลือก:**

| ตัวเลือก | กติกา | ผลต่อระบบ |
|---|---|---|
| ** A. ยกเลิกได้ก่อน cutoff เท่านั้น (แนะนำ) | หลัง cutoff ของ scheduled_date+round → ปฏิเสธ `ERR_CANCEL_AFTER_CUTOFF` | แก้ `cancel_order`: เทียบ NOW() กับ cutoff ของ round ที่ผูก order; capacity+inventory ถูกคืนเฉพาะเมื่อยกเลิกสำเร็จ | เลือก A
| B. ยกเลิกหลัง cutoff ได้แต่ไม่คืนเงิน | อนุญาต + mark no-refund | ต้องเพิ่ม flag ใน order + ห้าม refund path |
| C. ยกเลิกหลัง cutoff ได้ + คืนเงินเต็ม | lenient | risk: ครัวผลิตไปแล้วเสียหาย — ต้องมีเงื่อนไขพิเศษ |

**Refund กรณียกเลิกก่อน cutoff ที่ชำระแล้ว:**
- [ ] 2A. คืนเต็ม (refund status='refund' ตาม enum ปัจจุบัน)
- [ ] 2B. คืนบางส่วน (ระบุ %) : ________
- [**] 2C. ไม่คืน — ไม่ต้องโอนไปใช้รอบถัดไป

---

## คำถามที่ 3 — PRE_ORDER INVENTORY DEDUCT TIMING

**ตัวเลือก:**

| ตัวเลือก | จุด deduct | ผลต่อระบบ |
|---|---|---|
| ** A. ตอน order confirmed (แนะนำ) | เหมือน SAME_DAY — ใช้กลไกเดิม (019/028) ที่ deduct ตอน confirm + restore ตอน cancel | ไม่ต้องเขียน logic ใหม่; แต่ stock ถูกล็อกนานถึงวันผลิต |
| B. ตอน payment confirmed | ต้องผูก deduct เข้า payment webhook path | ซับซ้อนกว่า — กรณี COD ไม่มี payment ก่อน confirm จะไม่ถูก deduct |
| C. ตอน production batch locked | deduct ตอนสร้าง batch (ก่อนวันผลิต) | stock ว่างระหว่างรอ — risk oversell ถ้ามี 2 ออเดอร์แข่ง stock เดียวกัน |
| D. ตอน production started | สายเกิน — ตรวจ stock ไม่ทัน | ไม่แนะนำ |

**หมายเหตุเทคนิค:** ทุกตัวเลือกต้องรักษา atomicity เดิม (026 aggregated check + ERR_INSUFFICIENT_INGREDIENT) และ restore path เมื่อ cancel

**คำตอบของ Owner (ข้อ 3):** ____ A.____

---

## สิ่งที่จะเกิดตามคำตอบ (ทั้ง 3 ข้อ)

1. Implement server-side enforcement ใน migration ถัดไป (038+) + ERR codes ใหม่
2. เพิ่ม acceptance cases ใน `e2e/acceptance_pre_order_m1.sql` ตาม policy ที่เลือก (P5/P11/P11b จะถูกปลด BLOCKED)
3. รัน contract suite บน production ก่อน PRE_ORDER real E2E (PHASE 2B)

ลงชื่อตอบ: 1._B__ 2._A__ 3._A__ (อ้างตัวเลือก A/B/C)ผมเองowner
