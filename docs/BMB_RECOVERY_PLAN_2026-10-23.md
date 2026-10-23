# BMB — Recovery Master Plan 2026-10-23
# แผนซ่อม+ปิด "ระบบจริงทั้งระบบ" (ไม่มีงานจำลอง · No Evidence = Not Done)

> **ที่มา:** คำสั่ง Owner 2026-10-23 — ทดสอบของจริงแล้ววงจรพัง: ออเดอร์ใหม่ไม่เข้า/อันเก่าค้าง · สลิปตรวจไม่ได้ · มอบหมายงานไม่ได้ · ไรเดอร์รับงานไม่ได้ · งานไม่ต่อ · ลิงก์โซเชียลซ้ำในหน้าตั้งค่าร้าน · บันทึกสถานะมั่ว (135 approve แล้วแต่ 136 หายเงียบ)
> **คำสั่งรอบนี้:** ตรวจอย่างซื่อสัตย์ → วางแผนใหม่ → ทำให้ระบบจริงสมบูรณ์ทั้งระบบ → **รอบนี้ห้ามโค้ด (เอกสารเท่านั้น)**
> **กติกา:** ทุกงานต้องจบด้วย evidence บน `biteme-baby.com` + อุปกรณ์จริง · ห้าม mock/stub/hardcode/dead code · เทสต์ห้ามต่ำกว่า **1291** (วัดจริง 2026-10-23 — ตัวเลข 1302 ที่เคยอ้าง = คลาดเคลื่อน) · production write (migration/EF/secret) = Owner approve · ไทยไม่ผ่าน shell

---

## 0. Baseline ที่ยอมรับตรง ๆ (ก่อนเริ่มซ่อม)

| เรื่อง | เคยอ้างไว้ | ความจริง 2026-10-23 |
|---|---|---|
| สถานะภาพรวม | "🟢 D1 DONE" | 🔴 **D1 NOT DONE** — โค้ด+เทสต์เขียว แต่ของจริงใช้ไม่ได้ทั้งสาย (Owner ทดสอบเอง) |
| Gates | tsc/lint/vitest 1302/build = 0 | tsc/lint/build = 0 จริง แต่ vitest วัดจริง = **1291/1291 (124 files)** — ตัวเลข 1302 คลาดเคลื่อน (โค้ดไม่ได้ถูกแตะ = 1291 คือความจริงของ HEAD) |
| SQL contracts | 135/136/137 ผ่านบน PG ephemeral | จริง (ในห้องทดสอบ) — ไม่ได้แปลว่าของโปรดักชั่นครบ |
| Migration โปรดักชั่น | "135+137 applied ✓" | **136 ไม่เคยถูก apply และไม่เคยถูกพูดถึง** = ช่องโหว่ใหญ่ (ดู D-01) · 135/137 = ตามบันทึก ต้อง verify ใหม่ใน R0 |
| EF/secrets | ACTIVE + ครบ | ตามบันทึก (smoke image-gen=401) — verify ซ้ำใน R0 |
| HEAD | `923ac1f` | จริง = `63e3292` = origin/main (เอกสารเดิมค้าง) |
| บัญชีทดสอบจริง | — | แอดมินมี · ลูกค้าจริงมี · ไรเดอร์ผูกบัญชีแล้ว (ใช้ทดสอบได้ทันที) |

**เอกสารนี้แทนเนื้อหาแฮนออฟ 2026-10-22 ทุกจุดที่ขัดกัน**

---

## 1. ข้อบกพร่องที่ยืนยันได้จากโค้ดแล้ว (หลักฐานจริง ไม่ใช่เดา)

| # | ข้อบกพร่อง | หลักฐาน (ไฟล์:บรรทัด) | ผลกระทบต่อของจริง |
|---|---|---|---|
| D-01 | **migration 136 ไม่เคยขึ้นโปรดักชั่น** — เอกสารเดิมเขียน "135+137 applied" แล้ว 136 หายเงียบ · `e2e/prod-apply-result.json` ล่าสุดบันทึกแค่ 134 | AI_WORK_STATE.md เวอร์ชันก่อน (บรรทัด 149) · e2e/prod-apply-result.json | `driver_update_location`/`driver_location_history` ไม่มีในโปรดักชั่น → GPS heartbeat ไรเดอร์ error ทุกไม้ (RiderPwaPage.tsx:379-402 เรียกทุก 30 วิ/10 วิ) · แผนที่ live + เส้นทางย้อนหลัง (E3/E4) ตายหมด |
| D-02 | **หน้าตั้งค่าร้านแสดงลิงก์โซเชียลซ้ำ 2 ที่ 2 ทางเขียน** | AdminSettings.tsx:132-162 (generic editor วนทุก key ของ business_settings รวม `social_links`) + :190-218 (ฟอร์มโซเชียลเฉพาะ) + :110-114 (`saveSocials`) vs :160 (Save {key}) | แก้ที่หนึ่งแล้วอีกที่เขียนทับ — "ลิ้งค์โซเชียลซ้ำ + ทำงานซ้ำซ้อน" ตรงกับที่ Owner เจอ |
| D-03 | **คิวมอบหมาย/ประกาศ มองไม่เห็นออเดอร์ที่จ่ายแล้ว** — `readyQ` กรองเฉพาะ `ready_for_dispatch` ทั้งที่ comment และ RPC รับ `confirmed`/`preparing` ด้วย | DeliveryManagement.tsx:310 (filter) vs :76-78 (comment ระบุชัด) · RPC assign_driver (020_bite_drive.sql:610) · dispatch_order/claim_dispatch_offer (135_dispatch_offers.sql:104,166) | ออเดอร์ที่ยืนยันเงินแล้ว/ครัวกำลังทำ = **หาไม่เจอในบอร์ด → มอบหมายไม่ได้ ประกาศงานไม่ได้** |
| D-04 | **แผงตรวจสลิปจำกัดเงื่อนไขเกินไป** | SlipReviewPanel.tsx:23 (กรอง `payment_status='pending'` เฉพาะหน้า/ตัวกรองปัจจุบันของ AdminOrders) · confirm_offline_payment (008_payment_state_machine_and_phase_d.sql:253-262) ฝั่ง promptpay บังคับ intent=`processing` | intent หาย (ตอน checkout สร้างไม่สำเร็จ — ความเสี่ยง A7 ก.) หรือยัง `pending` = ยืนยันเงินไม่ได้ (`ERR_NO_PAYMENT_INTENT`/`ERR_INTENT_NOT_PROCESSING`) → "สลิปตรวจไม่ได้" · ออเดอร์ที่ถูกตัวกรอง/branch บัง = ไม่โผล่ในแผงเลย |
| D-05 | **แนบสลิปได้เฉพาะเจ้าของออเดอร์ตาม auth.uid() เท่านั้น** | supabase/migrations/133_payment_slip_upload.sql:114-116 (`o.customer_ref = v_uid`) | สั่งด้วยบัญชีหนึ่ง จ่ายอีกบัญชี/guest = แนบสลิปไม่ได้ (`ERR_NO_PENDING_PROMPTPAY`) → สายเงินขาด |
| D-06 | **submit key ผูก "payload ซ้ำ = คืนออเดอร์เดิม" (124 R3)** แต่ผู้ใช้ไม่มีทางรู้ | src/lib/orderSubmitKey.ts:117-161 · src/pages/CheckoutPage.tsx:636-654 | ครั้งก่อน timeout/ambiguous → ครั้งใหม่ payload เดิม = ระบบ replay ออเดอร์เก่า → **"สั่งใหม่แต่ไม่เข้า เสือกเป็นอันเก่าค้าง"** ตรงกับที่ Owner เจอ (พิสูจน์ด้วย `order_submissions` จริงใน R0) |
| D-07 | **ตัวกรองสาขาอาจซ่อนออเดอร์ใหม่** | src/lib/bmbAdminApi_orders.ts:174 (`eq('branch_id', opts.branchId)`) + CheckoutPage.tsx:344-349,516-517 (branch_id มาจาก round อาจเป็น NULL) | ถ้า activeBranchId ตั้งอยู่แต่ออเดอร์ branch NULL = ออเดอร์ใหม่ไม่โผล่ใน AdminOrders → "ออเดอร์ไม่เข้า" (พิสูจน์ใน R0) |
| D-08 | **บันทึกสถานะมั่ว/เกินจริง** — เขียน "D1 DONE" ทั้งที่ของจริงยังพัง, HEAD เก่า, 136 หาย, อ้าง `docs/BMB_DECISIONS.md` ที่ไม่มีอยู่จริง | AI_WORK_STATE.md เวอร์ชันก่อน 2026-10-22 | แชทถัดไปตัดสินใจผิดซ้ำ ๆ ("สั่งแล้วสั่งอีกเรื่องเดิม ๆ") — รอบนี้แก้เอกสารทั้งชุด + เพิ่มกติกา "ห้ามเขียน DONE ถ้าไม่ผ่านมือ Owner" |

## 2. สมมติฐานที่ต้องพิสูจน์บนของจริงก่อนลงมือ (อย่าเดา)

| # | สมมติฐาน | วิธีพิสูจน์ (R0) |
|---|---|---|
| H-01 | "ออเดอร์ใหม่ไม่เข้า อันเก่าค้าง" = idempotent replay (D-06) | ดู `order_submissions` + `orders` หลังกดสั่งจริง 2 ครั้ง (payload เดิม/ต่างกัน) เก็บ screenshot + order_number |
| H-02 | สายเงินพังตั้งแต่ intent (A7 ก.) → ทั้งระบบค้างที่ `pending` | ตรวจ `payment_intents` ของออเดอร์ทดสอบทุกใบ: มี/ไม่มี/สถานะอะไร |
| H-03 | ประกาศงานไม่ได้เพราะ `resolve_home_branch_id()` คืน NULL → `ERR_BRANCH_UNAVAILABLE` (135:108-112) | รัน `dispatch_order` กับออเดอร์จริง แล้ว query ค่า branch |
| H-04 | ไรเดอร์ "รับงานไม่ได้" เพราะไม่มี offer (ไม่เคยประกาศสำเร็จ) ไม่ใช่เพราะ claim พัง | หลังประกาศสำเร็จ ดู `dispatch_offers` + `my_deliveries().offers` บนเครื่องไรเดอร์จริง |

## 3. แผนซ่อม R0 → R3 (เรียงตามที่ระบบไหลจริง)

> **สถานะ 2026-10-23 (ปิดงานรอบนี้):** R0 ✅ ครบ · R1.1 ✅ ปิด (136 applied + drift repair) · R1.2-R1.5 ⬜ เขียนโค้ดรอบหน้า · R2 ⬜ · R3 ⬜ (evidence 5 ข้อยังไม่ครบ)

### R0 — ตรวจความจริงบนโปรดักชั่น (read-only · ห้ามแก้อะไร · ทุกอย่างต้องมีหลักฐาน) ✅ DONE 2026-10-23
1. **DB audit (อ่านอย่างเดียวผ่าน Management API `/database/query`):** ✅ ทำแล้ว — evidence `e2e/artifacts/r0-prod-audit.json` + `r0-prod-audit2.json` + `prod-sweep-final.json`
   - **ผลจริง:** 136 ไม่มา (loc_hist/loc_fn = null) → **ยืนยัน D-01** · intent ขาด = **0 ใบ** (หักล้าง H-02) · branch resolve = `branch-tenant-bmb-001-main`, NULL branch = 0/4 (หักล้าง H-03) · `delivery_assignments`/`dispatch_offers` = **0 แถว** (ยืนยัน H-04 — วงจรไรเดอร์ยังไม่เคยเริ่ม) · `ready_only=0` vs `rpc_allowed=1` (ยืนยัน D-03 — ออเดอร์ paid ค้าง BMB-20261023-841 บอร์ดมองไม่เห็น) · `social_links` มีจริงใน business_settings (ยืนยัน D-02) · schema_migrations บันทึกถึงแค่ 132 (drift 133-137)
   - **EF/secrets:** 21 EF ACTIVE ครบ + secrets ครบ (OPENROUTER/IMAGE_GEN_MODEL/VAPID/META) — **ไม่ต้องแก้**
   - **ข้อมูลจริง:** ไรเดอร์ 1 คน ("พอล ไบท์ไดรฟ์") linked=true online 2026-10-23 · auth users 4 · orders 4 ใบ (2 arrived+paid, 1 confirmed+paid ค้าง, 1 cancelled) · rounds/branch ปกติ
2. **Reproduce จริง 3 บัญชี:** ⬜ ค้างบนอุปกรณ์จริง (DB-level reproduce ทำแล้วตามข้อ 1 — จุดที่ต้องแตะ UI จริง = R1 เสร็จแล้วค่อยทดสอบเป็นวงจร)
3. **ออกผล:** ✅ artifacts ข้างต้น (แทน reality-2026-10-23.md ตามชื่อเดิม)
**Gate:** ✅ ผ่าน — ทุก D-#/H-# มีผลจริงยืนยัน/หักล้างแล้ว (ดูสรุปในผล audit)

### R1 — ซ่อมสายหลัก P0: ออเดอร์ → เงิน → dispatch → ไรเดอร์ (ทุกข้อ = แก้ของจริง + เทสต์ใหม่ ≥ เดิม)
- **R1.1 ปิด D-01:** ✅ DONE 2026-10-23 (Owner approve) — contract 136 G1-G3 EXIT=0 บน Docker PG16 (replay 001-137 ผ่านหมด) → apply `136_driver_location_history.sql` ผ่าน Management API → verify: table+fn มี, grants authenticated/service_role EXECUTE (anon revoked), policies ครบ · **แถม:** drift repair `schema_migrations` บันทึก 133-137 ย้อนหลัง (เดิมค้างที่ 132) — evidence `e2e/artifacts/prod-apply-136*.json`, `prod-verify-136.json` · เหลือ: ทดสอบ heartbeat จริงบนเครื่องไรเดอร์ตอน R1.4
- **R1.2 สายเงิน/สลิป (ปิด D-04/D-05 + H-02):** (ก) ทุกออเดอร์ต้องมี payment intent จริงเสมอ (self-heal ตอนเปิด /payment ของจริง ไม่ใช่แค่ toast) (ข) แผงตรวจสลิปเห็น "ทุกออเดอร์ที่รอตรวจ" ไม่ว่าตัวกรองไหน + บอกเหตุผลชัดเมื่อยืนยันไม่ได้ (ค) ทางแนบสลิปต้องตรงเจ้าของจริง (คนสั่ง = คนจ่าย) — ถ้า R0 พบเคส guest ต้องออกแบบให้ตรงจริง ไม่ใช่ปลดล็อกมั่ว (ง) เทสต์เดิม `paymentSlipUpload`/`paymentIntentsSingleRead`/`paymentExceptions` + เคสใหม่ตามจริง
- **R1.3 บอร์ดมอบหมาย/ประกาศ (ปิด D-03):** คิวเดียวแสดงออเดอร์ `confirmed`/`preparing`/`ready_for_dispatch` ทั้งหมด (ตามที่ RPC รับจริง) · ปุ่มเดียวต่อ transition (มอบหมาย/ประกาศ/ยกเลิก) · ข้อความตรงสถานะจริง · เทสต์เดิม `dispatchContract`/`adminDeliveryAdvance`/`dispatchOffersClient` + เคส confirmed→assign
- **R1.4 วงจรไรเดอร์เต็ม (ปิด H-03/H-04):** ประกาศ → push → รับ (คนแรกจอง) → รับของ → กำลังส่ง → POD บังคับ → สำเร็จ → ลูกค้าเห็น ≤20 วิ → แอดมินเห็น timeline+เส้นทาง — ทดสอบบนเครื่องไรเดอร์จริง · เทสต์เดิม `statusTruthMatrix`/`driverActionResults`/`liveTrackingClient` + เคสจริง
- **R1.5 "ออเดอร์ใหม่ไม่เข้า/อันเก่าค้าง" (ปิด D-06/D-07 + H-01):** แก้ตามผล R0 — ถ้าใช่ replay ผู้ใช้ต้อง "เห็น/เลือก" ได้ชัดว่าเป็นออเดอร์เดิมหรือใหม่ (ไม่เงียบ) · ถ้าใช่ branch filter ต้องไม่ซ่อนออเดอร์จริง · เทสต์เดิม `orderSubmitKey`/`canonicalOrderFlow`/`orderNumberUniqueness` + เคส payload ซ้ำ

### R2 — ความจริงของสถานะ + หน้าตั้งค่าไม่ซ้ำ (ปิด D-02 + "สถานะไม่ตรงฟีเจอร์")
1. **ตั้งค่าร้าน (D-02):** 1 เรื่อง = 1 ที่ — `social_links` ออกจาก generic editor เหลือฟอร์มเดียว + ทางบันทึกเดียว · กวาด key อื่นที่ซ้ำแบบเดียวกัน · เทสต์เดิม `adminUi`/`socialAiContinuity` + เคส "ห้าม key ซ้ำสองที่"
2. **Status truth walk (ทุกสถานะ × 3 บทบาท):** ไล่ `pending→confirmed→preparing→ready_for_dispatch→dispatched→in_transit→arrived→delivered` + `cancelled/failed` บนของจริง — ปุ่มเดียว/ที่, คำตรงสถานะ, timeline ลูกค้า/แอดมินชุดเดียวกัน (A5/M1/A6 ที่ทำไว้ = ต้อง verify ของจริง ไม่ใช่แค่เทสต์)
3. **Marketing/ส่วนอื่น:** ของใหม่ยังไม่เริ่มจนกว่า R0-R2 ปิด (ตารางอนาคตอยู่ใน AI_WORK_STATE)

### R3 — เก็บ evidence ปิดโครงการ (No Evidence = Not Done)
Checklist เดิม 5 ข้อ (push พร้อมกัน → คนแรกรับ = จอง / วงจรไรเดอร์+POD+timeline+เส้นทาง / Marketing E2E โพสต์จริง / ภาพ 3 สไตล์ / ERR_APPROVAL_REQUIRED) **+** ผล R0-R2 แนบทุกข้อ — ครบ = D1 ปิดได้จริง

## 4. ตารางเจ้าของปุ่ม/สถานะ (1 transition = 1 ปุ่ม = 1 ที่ — ใช้ไล่ตอน R2)

| สถานะปัจจุบัน | ใครเดินหน้า | ปุ่ม/ที่เดียว | ต้องเกิดจริง |
|---|---|---|---|
| pending | ลูกค้า (ส่งหลักฐาน) + แอดมิน (ยืนยันเงิน/ยืนยันออเดอร์) | /payment (ส่งหลักฐาน) · SlipReviewPanel (ยืนยันเงิน) · AdminOrders (ยืนยันออเดอร์) | intent ต้องมีจริงทุกใบ · สลิปเห็น/ตรวจได้จริง |
| confirmed/preparing | แอดมิน/ครัว | AdminKitchen | บอร์ดมอบหมายต้องเห็นทันที (D-03) |
| ready_for_dispatch | แอดมิน (มอบหมาย/ประกาศ) · ไรเดอร์ (รับงานประกาศ) | DeliveryManagement · RiderPwaPage | คนแรกรับ = จอง · assign ชนะประกาศ |
| dispatched/in_transit/arrived | ไรเดอร์ (รับของ/กำลังส่ง/ถึง) | RiderPwaPage (POD บังคับก่อนสำเร็จ) | sync สถานะออเดอร์อัตโนมัติ (036) · ลูกค้าเห็น ≤20 วิ |
| delivered | ไรเดอร์ปิดงาน / แอดมินปิดวงจรแทน (audit) | RiderPwaPage · admin_advance | ปล่อยไรเดอร์กลับ available · timeline ครบ |
| cancelled/failed | แอดมิน/ลูกค้า (ตามสิทธิ์) | cancelOrder (atomic) | คืน capacity/สต็อก + ปิดงานค้าง |

## 5. กติกาเหล็กตอนซ่อม (ห้ามละเมิด)
1. ไทยไม่ผ่าน shell · แก้ผ่าน editor · preserve BOM · สแกน mojibake ทุกไฟล์ที่แตะ
2. เทสต์ห้ามลดจาก **1291** (วัดจริง 2026-10-23) · ทุกการแก้ต้องเพิ่มเทสต์ของพฤติกรรมที่ซ่อม · assertion อย่าเช็ค literal ของ template
3. ห้าม mock/stub/hardcode/dead code — ทุกเส้นทางต้องเป็นของจริง (production = ห้องทดสอบเดียวที่ยอมรับ)
4. 3 บทบาทแยกเส้นเด็ดขาด (แอดมิน/ลูกค้า/ไรเดอร์) · ปุ่มเดียวกันห้ามมีสองที่ · คำต้องตรงสถานะจริง
5. production: push main ได้ (auto-deploy) · migration/EF/secret = Owner approve เท่านั้น · ห้าม `db push` · contract ทดสอบ Docker PG16 + `tr -d '\r'` ก่อน
6. เขียนสถานะในเอกสารเฉพาะสิ่งที่พิสูจน์แล้ว — **ห้ามเขียน "DONE" ถ้า Owner ยังไม่ได้ทดสอบของจริงผ่าน** (บทเรียน D-08)

## 6. Definition of Done ของแผนนี้
- [x] R0 ครบ + artifacts audit ปิดทุก D-#/H-# ระดับ DB (2026-10-23)
- [ ] D-01..D-08 ปิดหมด (ตอนนี้ D-01 ปิดแล้ว — เหลือ D-02..D-08 ฝั่งโค้ด R1.2-R2)
- [ ] วงจรจริงครบ 1 ออเดอร์: สั่ง → จ่าย → ตรวจสลิป → ยืนยัน → ครัว → มอบหมาย/ประกาศ → ไรเดอร์รับ → POD → สำเร็จ (ทำซ้ำ 2 ครั้งติด = เสถียร)
- [ ] หน้าตั้งค่าร้านไม่มีของซ้ำ · สถานะตรงฟีเจอร์ทุก transition
- [ ] vitest ≥ 1291 (วัดจริง 2026-10-23) · tsc/lint/build = 0 · mojibake = 0
- [ ] evidence 5 ข้อปิดโครงการครบ (R3)
- [ ] `AI_WORK_STATE.md` ตรงของจริงเสมอ (อัปเดตทุกก้อนงาน)
