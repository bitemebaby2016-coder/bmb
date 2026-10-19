# Bite Me Baby — AI Work State (ระบบบันทึกสถานะสำหรับแชทถัดไป)

> **สถานะงานปัจจุบันของโปรเจกต์ Bite Me Baby** ใช้แนบเข้าสู่ Context ตอนเริ่มแชทเสมอ

**last_updated:** 2026-10-19 (รอบ REAL-TEST FIX)
**phase:** แก้ตามผลทดสอบจริงรอบแรก — ปิดพร้อม commit+push (Owner อนุญาต)
**current_focus:** แก้ 9 จุดจากหน้าทดสอบจริงครบแล้ว — เหลือ Owner ทดสอบซ้ำบน production
**blocked_by:** ไม่มีฝั่งโค้ด — รอ Owner ยืนยันผลรอบ 2 + เริ่มขายจริงเมื่อพร้อม

---

## ⚡ TASK: REAL-TEST-FIX-2026-10-19 — แก้ตามผลทดสอบจริง + audit ตามจริง (คำสั่ง Owner 19 ต.ค.)
- **STATUS: ✅ CLOSED (รอ push)**
- **คำถาม audit ("งานที่สั่งไปแล้ว ค้างอยู่ในสเตจ/คอมมิทไหนรึเปล่า?") — ตอบตามจริง:**
  - **ไม่มีงานค้างใน staging/stash** (worktree สะอาด ทุกอย่างอยู่ใน commit แล้ว)
  - สิ่งที่เคยสั่งและ**ปิดแล้ว**: Master Plan same-day/pre-order phases 0-6 (commit `4cb22eb`,`3dd44ce`,`f20a6be`,`8bd6276`,`f7bfab1` + EV logs) · promo engine (`4c0bc9f`) · mode consistency (`f20a6be`) · distance 0.00 fix (`33724ce`)
  - สิ่งที่เจอวันนี้ = **ช่องว่าง/บั๊กที่ phase เหล่านั้นไม่ครอบคลุม** (ไม่ใช่ของค้าง): ค่า fallback พิกัดครัวผิดคนละจุด · คูปองไม่ trigger recalc · หน้าจ่ายเงินไม่แสดงการคำนวณ · หน้า checkout ให้เลือกรอบเองทั้งที่ same-day ควรทันทีอัตโนมัติ · พรีออเดอร์เกินวันไม่มีแสตมป์ · ฟอร์มไรเดอร์ต้องพิมพ์เอง
- **สิ่งที่แก้รอบนี้ (ทั้งหมดอยู่ใน commit เดียว):**
  1. **พิกัดครัว single source** — `src/config/kitchenLocation.ts` (ค่า fallback = ครัวจริง 12.615659, 102.098063) — root cause "ปักที่ครัวแต่ห่าง 200+ กม." = fallback เก่า (10.7016, 102.1429) ถูกใช้ใน 7 จุด (locationStore/deliveryFeeApi/externalProviders/routeOptimization/seo/ContactPage/RouteOptimizationPage) → ระยะทาง/ค่าส่ง/ช่องทางมั่วทั้งหมดเพราะต้นทางเดียว
  2. **คูปองเห็นผลทันที** — `cartStore` setCouponCode/setAppliedPromotion เรียก recalculate (เดิม discount ค้าง 0 จนมี event อื่น = "โปรโมชั่นใช้ไม่ได้/ไม่คำนวณให้เห็น")
  3. **หน้าชำระเงินแสดงการคำนวณ** — สินค้า/ส่วนลด/ค่าจัดส่ง/รวม (เดิมมีแค่ Total 149.20 ดูเหมือนมีส่วนลดลอย ๆ — จริง = 138 − 10% + 25)
  4. **same-day = จัดส่งทันที อัตโนมัติ** — ไม่ให้เลือกรอบเอง (ระบบเลือกรอบที่เวลาปัจจุบันอยู่ในหน้าต่างส่งก่อน ไม่มีค่อยใช้รอบถัดไป) · พรีออเดอร์ยังเลือกวัน/รอบเหมือนเดิม = แยกทางกันชัด (server RPC ยังตรวจ cutoff/ความจุเหมือนเดิม — ไม่แตะ business rule)
  5. **แสตมป์ Out of stock พรีออเดอร์เกินวัน** — FoodMenuCard + MenuPage (วันจาก menu_schedule < วันนี้ → แสตมป์ "หมดเวลาจอง (Out of stock)" + ปิดปุ่มจอง)
  6. **ฟอร์มลงทะเบียนไรเดอร์ = dropdown** — เลือกจากผู้ใช้ที่ลงทะเบียนบนเว็บแล้ว (profiles — เติมชื่อ/เบอร์อัตโนมัติ) + dropdown พาหนะ (มอเตอร์ไซค์/รถยนต์/จักรยาน/อื่น ๆ) — ตรงคำสั่ง "จิ้มเลือกไม่ต้องกรอกใหม่ + ดรอบดาวเลือกพาหนะ" · ลบโค้ดซ้ำ (useEffect โหลดรูป 2 รอบ)
  7. **แผนที่หน้า checkout ไม่ขึ้น** — fallback ป้อนพิกัดเองทำงานได้ (ใช้ GPS/ป้อนมือได้จริงระหว่างทดสอบ) · สาเหตุโหลด SDK ไม่สำเร็จบนเครื่อง = ต้องเช็ก Google Cloud key/referrer restriction (ฝั่ง Owner) — โค้ดพร้อมตั้งแต่ build `1cada70`
- **หมายเหตุ encoding (Owner เตือน):** ทุกไฟล์ที่แก้เขียนผ่าน editor (UTF-8 ตรง) · สแกนซ้ำทั้ง repo = **0 mojibake / 358 ไฟล์** · BOM 21 ไฟล์คงเดิมครบ (ไม่ได้แตะ) · ค้นใน shell ใช้ `\uXXXX` เท่านั้น (PowerShell `Get-Content` ไฟล์ไม่มี BOM จะแสดงไทยเพี้ยนเอง — ไม่ใช่ไฟล์เสีย)
- **ข้อมูลทดสอบจริง (Owner เพิ่ม):** ลูกค้า 2 คน (`jin.pao66` "Pual bite drive" = คนที่จะลงทะเบียนเป็นไดรเวอร์ + `siamportal` "Customer") — ใช้ dropdown ใหม่ลงทะเบียนได้ทันที
- **GATES/EVIDENCE:** lint=0 (385) · tests [ดูผลรอบปิดงาน] · build=0 · mojibake scan 0 · BOM คงเดิม

---

## 📌 STALE ENTRY ที่ต้องระวัง (ระบบจะเตือนตอนดึงกลับ)
- **AI_WORK_STATE.md เวอร์ชันก่อน 19 ต.ค. 2026** = STALE — รอบนี้แก้ตามผลทดสอบจริง (ค่าครัว/คูปอง/จ่ายเงิน/ทันที/แสตมป์/ไรเดอร์) เปลี่ยนพฤติกรรมหน้าเว็บหลายจุด

---

## 📁 โครงสร้างโปรเจกต์ (Files & Docs)
- `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-17-EVE.md` — handoff ปัจจุบัน (สถานะ + E2E Checklist §3 + Blocker §4)
- `src/config/kitchenLocation.ts` — พิกัดครัว single source (ห้าม hardcode ที่อื่น)
- `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` + `PHASE_CONTRACTS` + `EVIDENCE_LOG` + `REGRESSION_MATRIX` — กติกาเดิม (phases 0-6 ปิดแล้ว)
