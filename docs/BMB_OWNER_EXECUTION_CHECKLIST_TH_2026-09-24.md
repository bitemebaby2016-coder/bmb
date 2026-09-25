# BMB — OWNER EXECUTION CHECKLIST (ภาษาไทย)

> **วันที่:** 2026-09-25 · **HEAD:** `81c513b` (main) · **อ้างอิง:** `docs/BMB_MASTER_OBJECTIVE_RECONCILIATION_2026-09-24.md` (Rev.2) + `docs/BMB_MASTER_EXECUTION_PLAN_2026-09-24.md`
> **สถานะ:** EXECUTION STARTED — Migration 038/039 implemented, contracts 8/8 PASS, vitest 358/358

---

## ตอนนี้ BMB อยู่ตรงไหน?

BMB คือ **Cloud Kitchen Operating Platform** (ไม่ใช่ POS ร้านอาหารทั่วไป)

- **M1 (เปิดครัวแรกให้ทำงานจริง): BLOCKED** — โครงระบบ (spine) สร้างเสร็จแล้ว (migrations 001–039, contracts 8/8 PASS, vitest 358/358) แต่ยังไม่มีหลักฐานการทำงานจริงบน production
- **Full Product: PARTIAL** — นอกจาก M1 ยังมีงาน P2/P3 อีกจำนวนมาก
- ของที่ "แก้แล้ว" อย่าง MOCK_DRIVERS, localStorage inventory, cutoff enforcement, PRE_ORDER policies (Migr 038/039) — ทำเสร็จแล้ว ห้ามทำซ้ำ

## M1 เหลืออะไร?

3 owner actions — โดย action #1 ต้องมี **2 Operational E2E แยกโหมด** (ห้ามใช้โหมดหนึ่งแทนอีกโหมดหนึ่ง และห้ามใช้ happy path อย่างเดียว):

1. **E2E #1 — SAME_DAY จริง** บน production ครบ chain (สั่ง → cutoff/capacity → จ่าย → ยืนยัน → ตัด stock → ครัววันนี้ → dispatch รอบปัจจุบัน → ส่งถึง)
2. **E2E #2 — PRE_ORDER จริง** ครบ lifecycle (เลือกวัน+รอบ → capacity วันนั้น → ที่อยู่ → จ่าย → ยืนยัน → batch วันผลิต → เตรียม → ไรเดอร์ → dispatch ตามรอบ → ส่งถึง → ยกเลิก/คืนสต๊อก/refund)
3. **Bill บัตรจริง 1 รายการ** + **Lighthouse production ≥ 90** + **Owner review ฐานข้อมูลจริง**

## SAME_DAY ทำอะไรได้แล้ว?

- สร้าง order วันเดียวกันได้จริง (server คำนวณราคา/ค่าส่งเอง) ✅
- บังคับ cutoff ก่อนสร้าง order ✅ (code)
- ระบบชำระเงิน (Stripe/PromptPay/COD) ✅ (ยังไม่มีบิลจริง)
- **ยังไม่ได้พิสูจน์:** การเดินครบหลังสร้าง order — ตัด stock → ครัว → รอบส่งวันนี้ → dispatch → ส่งถึง บน production

## PRE_ORDER ทำอะไรได้แล้ว?

- จองล่วงหน้าเลือกวันอนาคต + รอบ ได้ (ห้ามวันนี้/อดีต) ✅
- บังคับที่อยู่ ✅ · kitchen batch รองรับการจอง ✅ (โครงสร้าง)
- ข้อมูลจองเก่าถูกย้ายเข้าระบบเดียวกันแล้ว ตารางเก่า freeze ✅
- **ยังไม่ได้พิสูจน์:** lifecycle 20 ขั้นเต็ม ตั้งแต่จองจนถึงส่งตามรอบ — **ไม่ใช่แค่ "มี scheduled_date"**

## อะไรยังเชื่อมไม่ครบ?

- การเดิน order จริงบน production ทั้งสองโหมด (ไม่มี trace)
- ตัด/คืนสต๊อกจริง · กัน oversell จริง (มีกลไก ยังไม่มีหลักฐาน runtime)
- ครัว → ไรเดอร์ → ส่งถึง ยังไม่เคยเดินครบวงจรจริง
- แจ้งเตือนจริง (push/email/LINE) — ตอนนี้มีแต่ในแอป
- ช่องทาง Facebook/Messenger/LINE — ยังไม่ได้ทำ (มีแต่ PWA)
- Make.com — ยังเป็นแผน ไม่ใช่ worker จริง
- ไรเดอร์ภายนอก >5 กม. — รอ API keys

---

## A. M1 — FIRST OPERATING KITCHEN

| ID | งาน | ความหมาย | สถานะ | ใครทำ | หลักฐานที่ต้องเห็น |
|----|-----|----------|-------|-------|---------------------|
| A1 | E2E #1 SAME_DAY จริง | สั่ง → จ่าย → ครัว → รอบวันนี้ → ส่งถึง วันเดียวกัน | ยังไม่ทำ | Owner + Engineering เฝ้าตรวจ | order_id + ข้อมูลในฐานข้อมูลทุกขั้น (จ่าย/ตัดสต๊อก/ครัว/ส่ง) |
| A2 | E2E #2 PRE_ORDER จริง | จองวันอนาคต → ผลิตวันนั้น → dispatch ตามรอบ → ส่งถึง | ยังไม่ทำ | Owner + Engineering | batch ตามวัน+รอบ, assignment, สถานะครบทุกขั้น |
| A3 | Negative rules ทั้งสองโหมด | ปฏิเสธหลัง cutoff, รอบเต็ม, ของหมด, ที่อยู่ผิด/เกิน 5 กม., วันที่ผิด, ยกเลิก/คืนสต๊อก/refund | ยังไม่ทำ | Engineering (ทดสอบ) + Owner (ยืนยันบน prod) | log การ reject + การ restore |
| A4 | บิลบัตรจริง + refund จริง | ธุรกรรมเงินจริง 1 รายการ | รอ Owner | **Owner** | payment record + ใบเสร็จจริง |
| A5 | Lighthouse production | คะแนนบนเว็บจริง ≥ 90 | รอ Owner รัน | **Owner** (Engineering แก้ถ้าต่ำ) | ผล Lighthouse จาก prod URL |
| A6 | Review ฐานข้อมูลจริง | ตรวจ RLS/ความปลอดภัยบน Supabase จริง | รอ Owner | **Owner** | ผล review anon residue = 0 |
| A7 | ใช้ Admin จริงกับ order จริง | เดินทุกปุ่มตามระบบ | ยังไม่ทำ | Owner + Engineering | audit_logs + หน้าจอ |
| A8 | ปรับ policy PRE_ORDER ที่ยังไม่ได้กำหนด | (1) ช่วงเวลาเปิดรับจอง (2) ยกเลิกหลัง cutoff ได้ไหม (3) จุดตัดสต๊อกของ order จอง | **ต้องการคำตัดสินใจ Owner** | **Owner** | คำตอบเป็นลายลักษณ์อักษร แล้ว Engineering implement |

## B. P2 — OPERATING PLATFORM (หลัง M1 ปิด)

| ID | งาน | ความหมาย | สถานะ | ใครทำ | หลักฐาน |
|----|-----|----------|-------|-------|---------|
| B1 | แจ้งเตือนจริง | push/email/LINE ถึงลูกค้า/ครัว/ไรเดอร์ | PARTIAL | Engineering (รอ Owner เลือก provider) | ข้อความถึงผู้รับจริง |
| B2 | ไรเดอร์ภายนอก >5 กม. | Grab/LineMan/Foodpanda | BLOCKED | Owner ให้ keys → Engineering | dispatch สำเร็จจริง |
| B3 | ช่องทาง FB/Messenger/LINE | รับ order เข้าระบบเดียวกัน | PLANNED | Owner (decision+token) → Engineering | order จาก channel ในระบบ |
| B4 | Make.com | automation worker จริง | DEFERRED/OWNER | Owner | live scenario |
| B5 | Content Engine | สร้าง/จัดการ/โพสต์คอนเทนต์ | PARTIAL | Engineering + Owner token | โพสต์จริง |
| B6 | Content → Order loop | วัดคอนเทนต์นำมาซึ่ง order | MISSING | Engineering | ข้อมูล attribution |
| B7 | Review → Data → AI → คอนเทนต์ดีขึ้น | วงจรกลับ | MISSING (ปลายทาง) | Engineering | ระบบอัตโนมัติ |
| B8 | AI ใช้จริงบน production | สนทนา AI ผ่าน key ของ Owner | PARTIAL | Owner key → Engineering | conversation trace จริง |

## C. P3 — SCALE / INTELLIGENCE

| ID | งาน | สถานะ | ใครทำ |
|----|-----|-------|-------|
| C1 | Inventory PRO | MISSING | Engineering (หลัง P2) |
| C2 | Analytics PRO | MISSING | Engineering |
| C3 | AI-BIZ / AI-FC (copilot/forecast) | MISSING | Engineering |
| C4 | SaaS / multi-tenant | MISSING | Engineering |
| C5 | White-label | MISSING | Engineering |

## D. OWNER-ONLY

| ID | งาน | สถานะ | หลักฐาน |
|----|-----|-------|---------|
| D1 | บัตรจริง + bill + refund จริง | ค้าง | ใบเสร็จ |
| D2 | สั่ง order จริงบนเว็บจริง ทั้งสองโหมด | ค้าง | ร่วมกับ Engineering trace |
| D3 | Lighthouse บน production | ค้าง | ผล ≥ 90 |
| D4 | Production secrets / API keys | ค้าง | keys ติดตั้ง |
| D5 | Supabase Dashboard review | ค้าง | ผล review |
| D6 | Make.com account | DEFERRED | live scenario |

## E. DEFERRED

| ID | งาน | สถานะ |
|----|-----|-------|
| E1 | Voice (input/output) | CANCELLED โดย Owner (AI-06) — ห้าม resurrect โดยไม่มี decision ใหม่ |
| E2 | Analytics/Inventory PRO/AI copilot/SaaS/white-label | DEFERRED (P3) |

---

## NEXT ACTIONS

```text
NOW
→ งานที่ AI DEV ทำได้ทันที (หลัง Owner approve plan):
   1. เตรียม trace tooling สำหรับ E2E ทั้งสองโหมด (query DB rows ทุกขั้น)
   2. ทำ Acceptance test scripts ตาม Business Rule Test Matrix (SAME_DAY 11 case + PRE_ORDER 16 case)
   3. เตรียม checklist ให้ Owner กด order จริงทีละขั้นบน production
   4. ตรวจ/ยืนยัน driver status → orders.status sync (ถ้าไม่ sync ต้องรายงานก่อน)
   ⚠️ ต้องรอ owner decisions 3 ข้อก่อน (pre-order window / cancel-after-cutoff / จุดตัดสต๊อกของ pre-order)

OWNER
→ ตอบ decisions 3 ข้อ · เตรียมบัตรจริง bill/refund · เตรียมรัน Lighthouse · เปิด Supabase Dashboard review · เตรียม keys สำหรับ P2

BLOCKED
→ External riders (keys) · Make.com (account) · Channels (tokens) — ทั้งหมด P2

AFTER M1
→ P2 ตามลำดับ: Notifications → External Riders → Channels → Make.com → Content/Loop

DEFERRED
→ Voice, SaaS, white-label, P3 ทั้งหมด
```

**เอกสารนี้ + Execution Plan รอ Owner approve — ยังไม่เริ่มแก้ code**