# BMB_PRODUCTION_CLOSURE_MASTER — แผนปิดระบบสู่การเปิดร้านจริง

**วันที่สร้าง:** 2026-09-28 · HEAD `bca0853` (== origin/main, WORKTREE CLEAN)
**ที่มาของเอกสารนี้:** ตรวจจาก **โค้ดจริงปัจจุบัน** (7 Edge Functions, 54 migrations, `src/pages`, `src/lib`) + ผลการรันจริงล่าสุด — **ไม่ใช้เอกสารเก่าเป็นหลักฐานว่า feature ใด complete**

## สถานะปัจจุบัน (ล็อกตามคำสั่ง Owner)

```text
SOFTWARE FOUNDATION        = VERIFIED
SOFTWARE E2E               = PASS
PHYSICAL DELIVERY          = NOT VERIFIED
FULLY OPERATIONAL          = NOT DECLARED
```

**เป้าหมายเดียวของงานต่อจากนี้:** ทำให้ Bite Me Baby เปิดร้านได้จริง — รับ Order จริง · ชำระเงินจริง · จัดการ Order จริง · เตรียมอาหารจริง · ส่งอาหารจริง · ติดตามสถานะจริง · รับมือ failure ได้อย่างควบคุม

**ห้ามเริ่ม Wave ใหม่** — งานต่อจากนี้เดินตาม Gate ในเอกสารนี้เท่านั้น

---

## 1. ความหมายของ "เปิดร้านจริงได้" (เกณฑ์ปิดระบบ)

ระบบถือว่าปิดสู่ production จริง เมื่อครบทั้ง 6 เงื่อนไขนี้ (พิสูจน์สด ไม่ใช่แค่โค้ดมีอยู่):

1. **ลูกค้าจริง 1 คน สั่งจริง จ่ายจริง ได้ของจริง** ครบวงจร โดยไม่มี QA/test identity แทรก
2. **การชำระเงิน LIVE** (Stripe live key / PromptPay จริง) และ **refund จริงทดสอบผ่าน 1 ครั้ง**
3. **ครัวจริง** ใช้ admin จริง เห็น order จริง เปลี่ยนสถานะจริง
4. **ส่งของจริง** โดยคนขับจริง ไปถึงปลายทางจริง มีหลักฐานการส่ง
5. **ลูกค้าติดตามสถานะจริง** ผ่าน /track ได้ โดยไม่มี PII รั่ว
6. **failure ที่คาดได้ รับมือได้จริง:** ชำระไม่สำเร็จ / ยกเลิก / คนขับยกเลิก / ส่งไม่ถึง / refund คืนเงิน — แต่ละกรณีทดสอบจริงแล้วอย่างน้อย 1 ครั้ง

## 2. สิ่งที่โค้ดมีจริงและพิสูจน์แล้ว (ฐานที่ยืนอยู่)

| ส่วน | หลักฐานจากโค้ด/การรันจริง | สถานะ |
|---|---|---|
| Edge Functions ครบชุดหลัก | 7 ตัว: `create-checkout`, `stripe-webhook`, `stripe-refund`, `phone-auto-login`, `automation-worker`, `ai-proxy`, `channel-webhook` | DEPLOYED + runtime ตรวจแล้ว (401/400 guard ถูกต้อง) |
| ฐานข้อมูล | 54 migrations · RLS ปิด anon ทุกตาราง PII · `track_order` ปลอดภัย (order_number+phone, rate-limited) | VERIFIED (probes 5/5) |
| State machine order | `pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered` + `cancelled` — transition ผิดถูก block ด้วย RPC เดียว (`transition_order_status`) | RUNTIME VERIFIED (W5-2 สด) |
| ชำระเงิน TEST | Stripe `pk_test` + tok_visa → webhook จริง → `paid`; กันโดนเก็บซ้ำ (single-open-PI + 409 already-paid) | RUNTIME VERIFIED (TEST เท่านั้น) |
| ช่องทางชำระที่โค้ดรองรับ | `credit_card` (Stripe) · `promptpay` (+ offline reference: ส่งสลิป→admin ยืนยัน) | โค้ดมีจริง — PromptPay/offline ยังไม่ได้พิสูจน์กับเงินจริง |
| หน้าคนขับ | `src/pages/RiderPwaPage.tsx` (242 บรรทัด): คนขับล็อกอินด้วยเบอร์ → เห็น assignment จริง → accept → เดินสถานะ picked_up/in_transit/arrived/delivered | โค้ดมีจริง + รันผ่าน RPC แล้ว (W5-2, ยังเป็น QA driver) |
| หน้าติดตามลูกค้า | `/track` guest phone gate — เบอร์ถูกเห็นสถานะ, เบอร์ผิดปฏิเสธ, 0 PII | RUNTIME VERIFIED |
| Admin | RLS admin ดี่ order/driver/assignment ครบ · ประวัติสถานะ + audit_logs ครบทุกขั้น | RUNTIME VERIFIED |
| ความปลอดภัย | ไม่มี secret ใน client (scan 239 ไฟล์ 0 hit) · anon เข้าถึง order ไม่ได้ · anti-enumeration | VERIFIED |

**สรุป:** โครงซอฟต์แวร์ครบและแข็งแรง — ที่เหลือคือ **ของจริง** (เงินจริง คนจริง ครัวจริง การส่งจริง) และ **การรับมือ failure กับเงินจริง**

## 3. สิ่งที่ยังขาด (Gap) — สิ่งที่ต้องทำให้ครบก่อนประกาศ FULLY OPERATIONAL

### Gap 1 — การชำระเงินจริง (ยังเป็น TEST 100%)
- Stripe ยังใช้ `pk_test`/`sk_test` — ยังไม่มี live key ถูกตั้งและทดสอบ
- `stripe-refund` มีโค้ดแต่ **ไม่เคยรีฟันด์จริง**
- ต้องทำ: ตั้ง live key (Owner ตั้งเอง) → smoke 1 order จริงยอดเล็ก → refund จริง 1 ครั้ง → ปิด gate
- ความเสี่ยงถ้าไม่ทำ: เปิดร้านแล้วลูกค้าจ่ายเงินจริงเข้า TEST หรือคืนเงินไม่ได้

### Gap 2 — การส่งอาหารจริง (NOT VERIFIED)
- ทุกอย่างที่ผ่านมาคือ **สถานะซอฟต์แวร์** ไม่ใช่ของถึงมือลูกค้า
- ข้อจำกัดปัจจุบัน: self-delivery ≤5 km (คนขับร้าน) · >5 km = ต้อง rider ภายนอก (Grab) ซึ่ง **ยังห้ามเปิด** (frozen)
- ต้องทำ: Physical Delivery Pilot ตาม `BMB_W5_3_PHYSICAL_DELIVERY_PILOT_SPEC.md` (ห้ามลูกค้าจริง/เงินจริง) → แล้วขยายเป็นลูกค้าจริง 1 รายแบบคุมด้วย Owner

### Gap 3 — ลูกค้าจริง + ข้อมูลจริง (ยังไม่มี)
- ระบบเคยเห็นแต่ข้อมูลทดสอบ — ต้องทำ **Real-First-Order Pilot**: ลูกค้าจริง 1 คน (Owner คุม) สั่ง-จ่าย-ได้ของ ครบวงจร แล้วตรวจ: PII ถูกเก็บถูกตำแหน่ง, /track ไม่รั่ว, admin เห็นถูกต้อง
- ต้องเคลียร์ขยะทดสอบก่อน (ตาม `BMB_W5_TEST_ARTIFACT_CLEANUP_AUDIT.md` — รอ Owner อนุมัติ)

### Gap 4 — รับมือ failure กับเงินจริง (ยังไม่เคยเกิดจริง)
โค้ดรองรับอยู่แล้ว แต่ต้อง **ซ้อมจริง** แต่ละกรณี:
| กรณี | กลไกที่มีอยู่ | ต้องพิสูจน์ |
|---|---|---|
| ชำระไม่สำเร็จ | `mark_payment_failed` + order ค้าง pending | เกิดจริง 1 ครั้ง → order ถูกจัดการถูก |
| ลูกค้ายกเลิก | cancel window 5 นาที + `cancelled` | ยกเลิกหลังจ่ายแล้ว → คืนเงินได้จริง |
| คนขับยกเลิก/ส่งไม่ถึง | reassign + `cancelled` | ส่งไม่ถึง 1 ครั้ง → ลูกค้าได้เงินคืน + ข้อมูลครบ |
| ชำระแล้ว webhook ไม่มา | ตรวจ intent ค้าง manual (admin) | มีวิธีเช็ค/แก้ด้วยมือที่เขียนไว้แล้วใช้ได้จริง |
| โดนเก็บเงินซ้ำ | single-open-PI guard (409) | มี live แล้วยังกันได้ |

---

## 4. แผนปิดระบบ (Closure Gates) — เดินทีละ Gate ห้ามข้าม

| Gate | ชื่อ | สิ่งที่ทำ | เกณฑ์ผ่าน | ห้าม/หยุด |
|---|---|---|---|---|
| **G1** | เคลียร์ขยะทดสอบ | Owner อนุมัติ cleanup ตาม audit (ลบ order ทดสอบ/PI orphan/บัญชี orphan) | DB เหลือแต่ของจำเป็น · evidence `PO-…-131` เก็บไว้ | ห้ามลบ evidence, ห้ามแตะ order ลูกค้าจริง (ยังไม่มี) |
| **G2** | เงินจริง LIVE | Owner ตั้ง Stripe live key → smoke order จริงยอดเล็ก → refund จริง 1 ครั้ง | จ่ายจริงเข้าบัญชีร้าน · คืนเงินจริงสำเร็จ · webhook live ทำงาน | ถ้า webhook live fail → STOP อย่าเปิดรับจ่าย |
| **G3** | Physical Pilot (ไม่มีลูกค้าจริง) | ตาม W5-3 spec: คนขับทดสอบ → ปลายทางทดสอบ ≤5 km | ครบ 9 ขั้น + หลักฐานทุกขั้น | ห้าม Grab/รีดเดอร์ภายนอก · เกิน 5 km หยุด |
| **G4** | Real-First-Order | ลูกค้าจริง 1 ราย (Owner คุม) สั่ง→จ่าย(live)→ครัวเตรียม→ส่งจริง→ลูกค้าติดตาม | ครบวงจร · PII ถูกต้อง · /track ปลอดภัย | มีอะไรผิดปกติ → หยุด+เก็บหลักฐาน |
| **G5** | ซ้อม failure จริง | ซ้อม 5 กรณีใน Gap 4 ด้วยเงินจริงยอดเล็ก | ทุกกรณีจบสถานะถูกต้อง + เงินถูกต้อง | เงินไม่ตรง → STOP ทันที |
| **G6** | Runbook + เปิดร้าน | เขียนคู่มือ 1 หน้า · ทดลองเดินร้านจริง 1 วัน · ประกาศ FULLY OPERATIONAL | วันทดลองไม่มีเหตุขัดขวาง | — |

**ผลลัพธ์ที่คาดหวังต่อ Gate:** จบ G1–G5 ครบ → ยื่น G6 → ประกาศ FULLY OPERATIONAL ได้

## 5. กติกาที่ยังผูกอยู่ (ไม่เปลี่ยน)
- ห้ามแตะ FROZEN: OTP/SMS · Web Push · Email/LINE · Meta · pg_cron · Supabase Pro/PITR · race optimization · rider ภายนอก (Grab)
- ห้ามใช้เอกสารเก่าอ้างว่า feature complete — ทุก gate ต้องพิสูจน์สดแล้วบันทึกหลักฐานใหม่
- ห้าม SQL force / mutation นอก canonical RPC · ห้าม schema เปลี่ยนโดยไม่จำเป็น
- ทุกครั้งที่แตะ production: HEAD == origin/main, WORKTREE CLEAN, secret scan, บันทึก evidence

## 6. ตารางสรุปสถานะเทียบเป้าหมาย

| ความสามารถ (ตามเป้าหมาย Owner) | สถานะ | เหลืออะไร |
|---|---|---|
| รับ Order จริง | ซอฟต์แวร์พร้อม (RUNTIME VERIFIED) | ลูกค้าจริง + เคลียร์ข้อมูลทดสอบ (G1, G4) |
| ชำระเงินจริง | ซอฟต์แวร์พร้อม (TEST) | live key + smoke + refund จริง (G2) |
| จัดการ Order จริง | ซอฟต์แวร์พร้อม + admin มีจริง | บัญชี admin จริงของร้าน (G6) |
| เตรียมอาหารจริง | state machine พร้อม | ครัวใช้จริง 1 วัน (G4/G6) |
| ส่งอาหารจริง | โค้ด+RPC พร้อม · คนขับ UI มีจริง | Physical Pilot + คนขับจริง (G3, G4) |
| ติดตามสถานะจริง | VERIFIED (0 PII) | ใช้กับลูกค้าจริง (G4) |
| รับมือ failure ได้ | กลไกครบในโค้ด | ซ้อมจริง 5 กรณี (G5) |

---
**หมายเหตุ:** เอกสารนี้คือเป้าหมายและแผนเดียวที่ใช้ต่อจากนี้ ทุกงานถัดไปต้องอ้าง Gate ในเอกสารนี้ และต้องมีหลักฐานสดใหม่ทุกครั้ง
### Gap 5 — การเดินร้านประจำวัน (Operations Runbook)
- ยังไม่มีคู่มือสั้น ๆ สำหรับคนครัว/คนขับ/เจ้าของ: เปิดรอบ, รับ order, เปลี่ยนสถานะ, เรียกคนขับ, แก้ปัญหาเฉพาะหน้า, ดูยอดประจำวัน (automation-worker มี daily-report ในโค้ด — ยังไม่ deploy)
- ต้องทำ: เขียน runbook 1 หน้า + ทดลองใช้จริง 1 วัน

### Gap 6 — สิทธิ์คนจริง
- ตอนนี้ไม่มี admin จริง (admin ทดสอบถูก revoke แล้ว) — ต้องสร้างบัญชี admin จริงของร้าน (Owner อนุมัติ) + บัญชีคนขับจริง