# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-18 (รอบ FINAL PRE-TEST)
**phase:** ปิดงานก่อนเปิดทดสอบจริง — พร้อมทดสอบ 100%
**current_focus:** ทุกงานตามคำสั่งรอบดึกปิดแล้ว — เหลือ Owner เดิน E2E checklist บน production
**blocked_by:** ไม่มีฝั่งโค้ด — รอ Owner เริ่มทดสอบจริง + สั่งการหลังทดสอบ

---

## ⚡ TASK: PRETEST-FINAL-2026-10-18 — ปิดงานก่อนเปิดทดสอบจริง 100% (คำสั่ง Owner รอบดึก 18 ต.ค.)
- **STATUS: ✅ CLOSED**
- **วันที่:** 2026-10-18
- **งานที่ต้องทำ (ตามคำสั่ง Owner):**
  1. แก้ภาษาหน้ารอบจัดส่ง `/admin/rounds` (ขึ้นตัวอักษรเพี้ยน)
  2. บันทึกการตัดสินใจ: งบ OpenRouter ฝั่ง dev กับฝั่งเอไอในเว็บ = **คนละคีย์กัน ไม่ต้องเตือนเติมงบ**
  3. "coming soon" 2 ตัว + หัวข้อ "สินค้าสำเร็จรูป" = **ของจริงที่ Owner จะเปลี่ยนเอง — เก็บไว้ ห้ามลบ/ห้ามซ่อน**
  4. ลูกค้าทุกตนถูกลบแล้วเหลือแอดมิน (Owner ลบเอง) — รับทราบ + ยืนยันใน DB (customers=0, auth.users=1)
  5. ไรเดอร์ยังค้าง — **ลบทิ้งให้หมด** เริ่มทดสอบใหม่จริงหลังอนุมัติ (Owner จะลงทะเบียนใหม่เอง)
  6. ทุกระบบ/ฟีเจอร์พร้อมทดสอบจริง 100% + **อนุญาต commit+push** + อัปเดตเอกสาร
- **สิ่งที่ทำ:**
  - **Root cause ตัวอักษรเพี้ยน:** string ในซอร์สถูก double-encode (UTF-8 → CP1252 → UTF-8) ปนกับไทยปกติในไฟล์เดียว + ไบต์ `0xA0` (NBSP = ร่องรอยของ "ภ"/สระบางตัว) ถูก normalize เป็น space ทำให้ run บางชุด decode ไม่ผ่าน — แสดงเป็น "à¸£à¸­à¸š…" บนหน้าเว็บ (เช่น หัวข้อ/ปุ่ม/บรรทัดรอบส่งของ /admin/rounds + หน้า FAQ)
  - เขียนเครื่องมือซ่อม (แผนที่ถอยหลัง CP1252→UTF-8 เฉพาะ run ที่เสีย, กิน space เป็น NBSP artifact) — ซ่อมสำเร็จ **896 runs / 15 ไฟล์** (src 6 ไฟล์: AdminRounds.tsx 37 · FaqPage.tsx 12 · AdminOrders.tsx 1 · bmbAdminApi_orders.ts 1 · canonicalOrderFlow.test.ts 1 + channel-webhook 14 + archive docs 8 ไฟล์ ~868) — เหลือ residual 0 ทั้ง repo
  - **ตรวจฝั่งข้อมูล:** สแกนทุก public table = ข้อมูลไม่มี mojibake (บั๊กอยู่ที่ซอร์สอย่างเดียว)
  - **ข้อมูล:** normalize รอบเช้า 18 ต.ค. ที่เบี่ยงมาตรฐาน → "เช้า (06:00-09:00)" cutoff 08:00 ความจุ 60 (ตรงกับ 19–24 ต.ค.) · **ลบไรเดอร์ 6 ราย** (drivers=0 — รวม QA/STEP2/ไบท์ ไดรฟ์; ไม่มี auth account ผูกอยู่) · เก็บ test leftovers ให้เริ่มทดสอบสะอาด: social_events 9 → 0, order_submissions 2 → 0, automation_queue 3 → 0 · auth.users เหลือ 1 = แอดมิน (bitemebaby2016) · audit_logs เก็บไว้ตามสัญญา
- **GATES/EVIDENCE:** lint=0 (384 ไฟล์, brandNameGuard OK) · tests [ดูผลลัพธ์รอบปิดงาน] · build (tsc+vite+PWA)=0 · mojibake scan 0 runs / 0 residual
- **BLOCKER:** ไม่มีฝั่ง AI — push แล้ว = deploy production (Owner อนุญาตแล้วรอบนี้)
- **หมายเหตุ:** ไฟล์ `tools-mojibake.mjs`/`tools-db.mjs`/`tools-probe.mjs` = เครื่องมือชั่วคราวรอบนี้ (ลบก่อน commit)

---

## 📌 STALE ENTRY ที่ต้องระวัง (ระบบจะเตือนตอนดึงกลับ)
- **AI_WORK_STATE.md เวอร์ชันก่อน 18 ต.ค. 2026** = STALE แล้ว — รอบ PRETEST-CLOSURE + PRETEST-FINAL เปลี่ยนสถานะทั้ง Theater unity, login context restoration, G6-G7 alignment, mojibake sweep, ข้อมูลทดสอบ (ไรเดอร์/test leftovers) — อย่าเชื่อสถานะเก่าก่อนหน้านี้ ให้ยึด task block นี้

---

## 📁 โครงสร้างโปรเจกต์ (Files & Docs)
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` — handoff ปัจจุบัน (สถานะ + **Final E2E Checklist** §3 + Blocker §4)
- `docs/BMB_SESSION_HANDOFF_2026-10-14_PREOPENING.md` — handoff รอบก่อน (PRE-OPENING audit)
- `BMB_G6_CONTRACT.md` / `BMB_G7_CONTRACT.md` — สัญญา G6/G7 (+RULE REVISION G6-09) · `BMB_G6_WORKLOG.md` — worklog (แถว G6-09)
- `src/__tests__/g6g7OrderBoundary.test.ts` (12) · `theaterUnity.test.ts` (10) · `loginContextRestoration.test.ts` (8) — regression ใหม่
- `src/lib/theaterPreferences.ts` — preference เปิด/ปิดโรงละคร (`bmb_theater_open`)
