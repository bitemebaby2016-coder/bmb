# BMB_PRODUCTION_CLOSURE_MASTER — OWNER EXECUTION CONTRACT

**สถานะเอกสาร:** OWNER EXECUTION CONTRACT — ผูกการทำงานทั้งหมดต่อจากนี้ · แก้ไขตามคำสั่ง Owner (2026-09-28)
**ขั้นปัจจุบัน:** STEP 1 = **NOT STARTED** — ทุก STEP ต้องรอ OWNER REVIEW / OWNER APPROVAL ก่อนเริ่ม

---

## 1. เอกสารนี้คืออะไร — และ "ไม่ใช่" อะไร (หลักการที่ 1)

**Master นี้ไม่ใช่ Audit Report** — ห้ามใช้เอกสารนี้ (หรือเอกสารใด) อ้างว่า feature ใด READY / COMPLETE โดยไม่มี evidence สดที่ตรวจจริงใน STEP นั้น

บทบาทแยกเป็น 3 ชั้น:

| ชั้น | หน้าที่ | ห้าม |
|---|---|---|
| **Master** (ไฟล์นี้) | เป้าหมาย · Gate · Definition of Done · Owner authority · ลำดับงาน | ห้ามใช้เป็นหลักฐานว่า feature complete |
| **Audit** (รายงานที่เกิดใหม่ในแต่ละ STEP) | หลักฐานจาก code / DB / runtime (สดเสมอ) | ห้าม copy claim เก่ามาเป็น PASS |
| **Implementation** (งานหลัง Owner เปิด Gate) | แก้ code/config ตาม scope ที่ Gate อนุญาต | ห้ามทำนอก scope / ล่วงหน้า |

- ห้าม copy claim จากเอกสารเก่า (W1–W5 และอื่น ๆ) มาเป็น PASS โดยไม่มี evidence สดใหม่
- สิ่งที่เคย "ผ่าน" มาก่อน = ประวัติ — ต้องพิสูจน์ใหม่ใน STEP ที่เกี่ยวข้องเสมอ

## 2. เป้าหมาย (ล็อกตามคำสั่ง Owner)

> เปิด BMB ให้รับ Order จริง + ชำระเงินจริง + ครัวใช้งานจริง + ส่งอาหารจริง + ลูกค้าติดตามได้ + รองรับ failure จริงอย่างควบคุมได้

## 3. Definition of Done (เกณฑ์นำเสนอ Owner — ไม่ใช่การประกาศผ่าน)

ทุกข้อต้องมี evidence สดจาก STEP ที่เกี่ยวข้อง:

1. ลูกค้าจริงสั่ง → จ่าย (เงินจริง) → ครัวเตรียม → ส่งถึงมือ → ติดตามสถานะ ครบวงจร
2. ชำระเงิน LIVE แบบ Owner-controlled (§8) + refund จริงพิสูจน์แล้ว
3. ครัว/admin ใช้งานจริงด้วยบัญชีจริง (§10)
4. ส่งจริงโดยคนขับจริง พร้อมหลักฐานการส่ง
5. ลูกค้าติดตามสถานะจริงโดยไม่รั่ว PII
6. failure ทุกประเภทถูก verify ตามระดับที่เหมาะสม (§9)
7. ผ่าน STEP 7 — และ **Owner เป็นผู้ประกาศ OPEN SHOP เท่านั้น**

## 4. ลำดับงานหลัก (ล็อก — ห้ามสลับ / ห้ามข้าม)

```text
STEP 1 — REAL CODE CLOSURE AUDIT
        ↓
OWNER REVIEW
        ↓
STEP 2 — COMMERCE INTEGRITY
        ↓
OWNER GATE
        ↓
STEP 3 — ADMIN COMMAND CENTER
        ↓
OWNER GATE
        ↓
STEP 4 — PHYSICAL DELIVERY PILOT PREPARATION
        ↓
OWNER GATE
        ↓
STEP 5 — PHYSICAL DELIVERY PILOT
        ↓
STEP 6 — REAL OPERATIONAL / FAILURE VERIFICATION
        ↓
STEP 7 — PRODUCTION OPERATIONAL GATE
        ↓
OWNER DECISION: OPEN SHOP
        ↓
กลับมาเปิด FROZEN ทีละเรื่อง
```

## 5. Gate Model (ล็อกทุก STEP)

```text
AUDIT → OWNER REVIEW → OWNER APPROVAL → IMPLEMENT / EXECUTE
     → TEST → RUNTIME VERIFY → EVIDENCE → GATE CLOSE
```

- **ห้าม AI เปิด Gate เอง** — ทุก Gate เปิดด้วยคำสั่ง Owner เท่านั้น
- **ห้าม AI ประกาศ `FULLY OPERATIONAL`** — Owner เป็นผู้ประกาศเท่านั้น
- หากงานใดคิดว่าจำเป็นต้องข้าม/แก้ลำดับ → STOP + รายงาน Owner ก่อนทำอย่างอื่น

---
## 6. ขอบเขตแต่ละ STEP (สิ่งที่ต้องตรวจ/ทำ — ไม่ใช่ผลการตรวจ)

**หลักการที่ 5 — ห้ามสรุปว่าโค้ดรองรับครบก่อน STEP 1:** ข้อความประเภท `reassign มีแล้ว` / `refund มีแล้ว` / `mark_payment_failed มีแล้ว` / `failure รองรับครบ` ให้ถือเป็น **สิ่งที่ต้องตรวจใน STEP 1** จนกว่าจะมี source-code + contract + runtime evidence รองรับทั้งสามด้าน

### STEP 1 — REAL CODE CLOSURE AUDIT (read-only)
- ตรวจสดจาก source code + DB schema/RLS + runtime probes: payment paths (create-checkout / webhook / refund) · duplicate & open-PI behaviour · customer cancellation · driver flow (available/unavailable) · delivery failure · reassignment · admin visibility · tracking/PII · notifications/audit trail — **ทีละรายการ ระบุไฟล์/บรรทัด + ผลรันจริง**
- ผลลัพธ์: รายงาน audit ใหม่ (ชื่อใหม่) แบ่งชัด `verified / not-verified / blocked` + รายการสิ่งที่ต้องแก้
- ขอบเขต: **ห้ามแก้อะไรทั้งสิ้น** (code/DB/config/user/artifact)

### STEP 2 — COMMERCE INTEGRITY (หลัง OWNER REVIEW)
- จัดการช่องว่าง/ช่องโหว่ด้านเงินที่ STEP 1 พบ (payment state, PI lifecycle, refund path, webhook) — แก้เฉพาะรายการที่ Owner อนุมัติ
- ผ่าน = TEST + RUNTIME VERIFY สด + EVIDENCE ครบ → OWNER GATE CLOSE

### STEP 3 — ADMIN COMMAND CENTER (หลัง OWNER GATE)
- ความพร้อมฝั่งครัว/admin ตามรายการที่ Owner อนุมัติ: บัญชีจริง · สิทธิ์ · หน้าจอครัว/assignment · การมองเห็น order ทั้งวัน

### STEP 4 — PHYSICAL DELIVERY PILOT PREPARATION (หลัง OWNER GATE)
- เตรียม test driver / test destination / run sheet — **ยังไม่มีการส่งจริง**

### STEP 5 — PHYSICAL DELIVERY PILOT
- ส่งจริง 1 เที่ยวแบบทดสอบควบคุม (ไม่มีลูกค้าจริง / ไม่มีเงินจริง) ตามแผนที่ Owner อนุมัติ + evidence ทุกขั้น

### STEP 6 — REAL OPERATIONAL / FAILURE VERIFICATION
- ทดสอบ failure ทั้งหมดตามระดับใน §9 — เลือกวิธีที่ปลอดภัยที่สุดที่เพียงพอ

### STEP 7 — PRODUCTION OPERATIONAL GATE
- รวบรวม evidence จากทุก STEP → ยื่น Owner → **OWNER DECISION: OPEN SHOP** → เปิด FROZEN ทีละเรื่องด้วยคำสั่ง Owner เท่านั้น

## 7. TEST ARTIFACT CLEANUP REVIEW (เดิมชื่อ G1 — หลักการที่ 2)

**นี่คือ REVIEW ไม่ใช่ "ต้องลบทุกอย่างก่อนจึงไปต่อ":**
- inventory test artifacts ให้ครบ (order / PaymentIntent / auth user / driver / Stripe charge)
- classify ทุกชิ้น: `SAFE DELETE` / `SAFE REFUND` / `KEEP FOR EVIDENCE` / `OWNER ACTION` / `DEPENDENCY-RISK`
- ระบุ evidence ที่จำเป็นต้องเก็บ — รายการนี้**ห้ามลบ**
- **ห้าม DELETE / REFUND / MUTATE ใด ๆ โดยไม่มี Owner approval**
- หลัง Owner approval → cleanup เฉพาะรายการที่อนุมัติ + บันทึกหลักฐานการลบทุกชิ้น

## 8. REAL PAYMENT / LIVE (หลักการที่ 3 — Owner-controlled เท่านั้น)

- **Live Stripe activation = Owner-controlled action** — AI ห้ามเปิดเองเด็ดขาด
- AI **ห้าม** นำ live secret มา echo / commit / expose (รวมถึงใน log/evidence ใด ๆ)
- AI **ห้าม** switch production payment mode เอง โดยไม่มี Owner authorization
- ก่อน live ต้อง audit code / config / webhook / refund path ครบก่อน (STEP 1 → STEP 2)
- live smoke + refund จริง = ทำ**เฉพาะเมื่อ Owner เปิด Gate** เท่านั้น
- หาก live webhook / payment / refund มี anomaly แม้แต่อย่างเดียว → **HARD STOP** + รายงาน Owner ทันที

---
## 9. การทดสอบ Failure — 3 ระดับ (หลักการที่ 4)

**แต่ละ failure เลือกวิธีทดสอบที่ปลอดภัยและเหมาะสม — ห้ามสร้างความเสียหายจริงเพียงเพื่อให้ได้ PASS** (ไม่ล็อกว่าต้องใช้เงินจริงทุกกรณี)

| ระดับ | ความหมาย | วิธีการโดยทั่วไป |
|---|---|---|
| `CODE/CONTRACT VERIFIED` | โค้ด + สัญญา (RPC/EF/state machine) รองรับ | code review + contract/unit test |
| `CONTROLLED TEST VERIFIED` | ซ้อมในสภาพควบคุม | TEST mode / QA identity / ยอดเล็ก (Owner อนุมัติ) |
| `REAL-WORLD VERIFIED` | เกิดจริงกับเงินจริง/การส่งจริง | เฉพาะกรณีจำเป็น + Owner อนุมัติเป็นรายกรณี |

รายการ failure ที่ STEP 1 ต้องระบุระดับที่เหมาะสมของแต่ละข้อ:
`payment failure` · `duplicate/open PI` · `customer cancellation` · `driver unavailable` · `delivery failure` · `reassignment` · `refund`

## 10. Operational Readiness Items (หลักการที่ 6)

รายการต่อไปนี้ถือเป็น **operational readiness items** — จัดการใน STEP 3 / STEP 7 เท่านั้น:
- Real Owner/Admin account
- Real Driver account
- Kitchen operating flow
- Delivery operating flow
- Daily Runbook

**ห้ามสร้างบัญชีจริง / ห้าม mutate production ในขั้นการทำ Master** — รวมถึงห้ามสร้าง admin/driver จริงล่วงหน้า

## 11. Frozen Scope (หลักการที่ 8 — คงเดิมทั้งหมด + กฎ blocker)

```text
OTP / SMS
P1-1 race
Meta real E2E
Facebook Group
Payment Events
Web Push / VAPID
Email
LINE
pg_cron
Supabase Pro / PITR
new providers
```

**กฎเพิ่มเติม:** ถ้าพบว่า Frozen item เป็น blocker ต่อ production closure → **STOP และรายงาน Owner** แทนการแก้เอง

## 12. สถานะปัจจุบัน + ข้อห้ามที่ยังผูกอยู่

- Master document = UPDATED (commit นี้) · STEP 1 = **NOT STARTED** · Production mutation = **NONE**
- ข้อห้ามจนกว่า Owner จะเปิด Gate ที่เกี่ยวข้อง: ห้ามแก้ source code · ห้ามแก้ DB · ห้ามสร้าง/ลบ user · ห้ามแตะ production configuration · ห้าม cleanup test artifacts · ห้าม refund · ห้ามเปิด LIVE payment
- ทุก STEP รายงานกลับแบบ `STATUS / OBJECTIVE / FINDING / ACTION / VERIFICATION` พร้อม evidence สด และจบด้วยการรอ OWNER REVIEW

---
**สิ้นสุด OWNER EXECUTION CONTRACT — รอคำสั่ง Owner**