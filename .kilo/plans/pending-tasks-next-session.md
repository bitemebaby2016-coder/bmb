# Pending Tasks — 2026-11-15 (R101 ปิดแล้ว · ยกไปรอบหน้า)

## สถานะจริงตอนนี้ (จากโค้ด + production evidence)

- **R96 P1 (grounding)** — ✅ ปิดครบมาแล้ว (R101 ตรวจยืนยัน: `fetchGroundingData` ยิงต้น processEvent ทุกครั้ง + grounding อยู่ใน draftSystem ทั้ง 2 รอบ + fallback + เก็บ `grounding_data`)
- **R96 P2 (cross-channel)** — ✅ ปิดครบ (worker thread ข้ามช่องทาง + **เว็บดึง server timeline ผ่าน RPC `social_timeline_for_web`** (m205) — ทุกเครื่องเห็นบริบทเดียวกัน)
- **R96 P3 (product cache)** — ✅ ปิดครบ (`aiDbContext` ใช้ `getCachedProducts` + AdminProducts invalidate)
- **R97 (order memory + cancel/modify ผ่าน AI)** — ✅ ปิดครบ + **m205 APPLIED PROD + social-ai-worker DEPLOYED** (แก้บั๊กตาย 3 ชั้น + cancel ผ่าน identity-guarded canonical RPC + modify แนวเดียวกับเว็บ)
- **OMNI-5** — ✅ **ยกเลิก/ปลด BLOCKED แล้ว** (Owner ยืนยัน 2026-11-15 — ผ่าน live มาแล้ว)
- **Gates** — ✅ tsc · lint · **vitest 215 ไฟล์/2257 tests PASS** · build

## ค้างรอ Owner (ทดสอบพร้อมกันตามคำสั่ง)

| # | รายการ | วิธีทดสอบ |
|---|--------|-----------|
| 1 | **§T-A** cart retry 2.5s | Hard reload `https://biteme-baby.com` → กดลิงก์ `?cart=` จาก FB → Chrome ต้องมีของภายใน 2.5 วิ |
| 2 | **R98/§R100** IAB + PWA | ตาม checklist 5 ข้อใน AI_WORK_STATE บล็อก R100e |
| 3 | **R97** history | Messenger ทัก "ทบทวน order" → ต้องสรุปจากประวัติจริง หรือบอกไม่พบ (ห้ามมโน) |
| 4 | **R97** cancel | "ยกเลิกออเดอร์ BMB-xxx" → เฉพาะ pending ในหน้าต่างยกเลิก — ใบอื่นบอกตามจริง |
| 5 | **R97** modify | "แก้เป็น..." → ถามยืนยันก่อน → ยืนยัน = ยกเลิกเดิม + สร้างใหม่ (เลขที่ใหม่จากระบบ) |
| 6 | **R96 P2 เว็บ** | ล็อกอินบนเครื่องใหม่ → Bite ต้องต่อบริบทจาก Facebook/Messenger (server timeline) |

## Known Risks (จดไว้)

1. ลูกค้าที่ยังไม่มี `customer_channel_identities` = ยังไม่เห็นประวัติ/แก้ไม่ได้ จน intake provision แถว (เกิดอัตโนมัติเมื่อสั่งของผ่าน social)
2. cancel ผ่าน AI อยู่ภายใต้กติกาเดียวกับเว็บ (pending + หน้าต่าง 5 นาที) — ยกเลิกใบเก่า = ระบบปฏิเสธตามกติกา
3. `social_events.customer_id` คุมเฉพาะ event หลัง deploy (event เก่าไม่มีค่า = ไม่โผล่ timeline)

## ข้อผิดพลาดเดิมในไฟล์นี้ (แก้แล้ว)

- ก่อนหน้า: "pre-existing test failures 3 ไฟล์" — จริง ๆ รอบล่าสุด vitest **2257/2257 PASS** ไม่มี fail ค้าง
- ก่อนหน้า: "OMNI-5 BLOCKED" — ยกเลิกตามคำสั่ง Owner แล้ว ห้ามอ้างอีก
