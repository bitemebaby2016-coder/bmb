# Bite Me Baby — HANDOFF ไปแชทถัดไป (ปิดเซสชั่น 2026-10-27 · งาน R9+R10)

> **อ่านก่อน:** เอกสารนี้ = แผนงาน/สถานะล่าสุด ณ ปิดเซสชั่น 2026-10-27 (รอบแก้ defect ที่ Owner
> เทสต์เจอจริง 2 ระลอก: **R9 = 8 ข้อ** + **R10 = 16 จุด**) — **Owner กำลังทดสอบอยู่**
> สถานะจึง = "แก้+deploy แล้ว รอ retest" **ไม่ใช่ปิดงานสมบูรณ์** (กติกา: ห้ามสรุป "ปิดครบทุกลูป"
> จนกว่าเกณฑ์ปิด role guide §16 ครบ — FAIL = จด defect ใหม่ใน `AI_WORK_STATE.md`)
>
> canonical state = `docs/BMB_MASTER_STATUS.md` + โค้ดจริง · CI ทุก SHA = §9.0 ของไฟล์นั้น

---

## 0. สถานะ ณ ปิดเซสชั่น

- **HEAD = `fc79792`** (ตรวจด้วย `git log --oneline -1` เสมอ — อย่าเชื่อบล็อกนี้ลอย ๆ) · tree ว่าง · `main = origin/main`
- **CI ล่าสุดของโค้ดจริง (`168cee4`) = CI #604 success · Contract #178 success · Pages success**
  (Test+Lint+Build เขียวทั้งชุด · legacy contracts 7/7 รวม 019/020) — commit หลังจากนั้น = docs (`fc79792`)
- **production DB:** migration **161 + 162 APPLIED+VERIFIED** แล้ว (trigger แจ้งเตือน/คอลัมน์รูปที่อยู่/
  RPC ปฏิเสธสลิป+ดึงรูป · evidence `e2e/r10Apply161-result.json` · `r10Apply162-result.json`) ·
  **ลบออเดอร์ทดสอบ 405/205/337 แล้ว** (`r10Cleanup-result.json`) · data flip 14 สินค้า (R9)
- **เว็บ = deploy ใหม่แล้ว (Pages อัตโนมัติ)** — Owner hard reload 1 ครั้งก่อนทดสอบ (ปิด SW เก่า)

## 1. สิ่งที่ทำในแชทนี้ (ย่อ — ดู evidence รายข้อ)

### R9 (8 ข้อ) — root cause พิสูจน์ด้วย repro จริง (`e2e/r9OrderRepro.*` · S6 = `ERR_PRE_ORDER_REQUIRES_ADDRESS`)
- error สร้างออเดอร์บอกเหตุจริง (`describeOrderSubmitError` ทุก `ERR_*`) · เติมที่อยู่จากหมุดอัตโนมัติ (pre-order ไม่มีวันที่อยู่ว่าง)
- ไม่บังคับไปเช็คเอาท์หลังเพิ่มพรี (อยู่หน้าเมนูเพิ่มรายการอื่นต่อได้)
- **ปุ่มตาม "ป้ายปฏิทิน" (เมนูตาราง)**: มีป้าย = จองล่วงหน้า · ไม่มี = "⚡ สั่งทันที" ทุกแท็บ (เข้ารอบพรีอัตโนมัติถ้าตะกร้ามีพรี) — ปิด "2 vs 20" (นับจาก `menu_schedule` ชุดเดียว)
- คูปอง retry อัตโนมัติ · สถานะแยกป้าย sameday/preorder · **Backend+AI Part 1 สร้างใหม่** (`docs/BMB_BACKEND_AI_PART_1.md` · ปิด DOC DRIFT เฉพาะการมีอยู่ — เนื้อหาต้องรอ Owner ยืนยัน)
- data flip 14 สินค้านอกตาราง = `available_same_day=true` (rollback SQL ใน `e2e/r9OwnerDefectFixes-2026-10-27.json`)

### R10 (16 จุด)
- **แจ้งเตือนออเดอร์ใหม่+ทุกสถานะ+เสียง+ปุ่ม 🔊/🔇** (migration 161 `orders_notify_hook` · poll 20 วิ · พิสูจน์ trigger จริงทั้ง status/payment/insert ด้วย tx+ROLLBACK = `r10Verify*`)
- **คูปอง: ใช้ที่เช็คเอาท์อย่างเดียว** — จิ้มกล่อง = popup โค้ดที่ใช้ได้ตอนนี้ เติม+ใช้อัตโนมัติ · ยกเลิก apply จาก /menu?code=, PromotionsPage, CartPage
- **ปุ่มถ่าย/แนบรูปที่อยู่** ที่ checkout (bucket `address-photos` · attach 161 · ไรเดอร์เห็นรูปบนหน้างานผ่าน `get_address_photo` 162)
- **ปุ่ม ❌ ปฏิเสธสลิป** (162 `admin_reject_payment` = กลับ `pending` + audit — enum ไม่มี `failed`)
- แบนเนอร์เซมเดย์: ไม่โชว์เวลาส่ง/ไม่ผูกพรีรอบ · พรีออเดอร์: เคารพรอบที่ปิด (`operating_hours` รายรอบ + `pre_order_open`)
- redirect: ยืนยันชำระ → `/admin/kitchen` · ครัวกดพร้อมส่ง → `/admin/delivery`
- rider `completeDelivery` มี catch (เดิม error หายเงียบ = "กดแล้วนิ่ง")
- ลบออเดอร์ทดสอบ 405/205/337 + ลูกครบ 9 ตาราง

## 2. 🔴 งานที่ต้องทำต่อ (ลำดับแนะนำ)

1. **รอ Owner retest ทั้ง R9+R10** (กำลังทดสอบ) — ถ้ามี FAIL: จด defect ใหม่ใน `AI_WORK_STATE.md` → แก้ → commit/push → อัปเดตเอกสารเฉพาะที่เปลี่ยน
   - จุดที่ต้องทดสอบเข้ม = **flow ไรเดอร์จบงาน**: มอบหมาย → รับงาน → **เช็คอินในรัศมี 300 ม.** → **แนบ POD ก่อนกดยืนยัน** → สถานะลูกค้า/แอดมินต้องวิ่งถึง "จัดส่งสำเร็จ" + แจ้งเตือน + driver กลับ `available`
   - **ข้อ 2 (รอบเย็น):** ตอนตรวจ DB รอบเย็นยัง `active`+`evening_open=true` — ป้ายเคารพทั้ง round status + operating_hours แล้ว ถ้ายังโผล่ให้ถามชื่อสวิตช์ที่ท่านใช้ปิด
   - คูปอง popup · ปุ่มรูปที่อยู่ · ปุ่มปฏิเสธสลิป · เสียงแจ้งเตือน · แบนเนอร์ — ตาม list 16 ข้อเดิมของท่าน
2. **Runtime ที่ค้างจากก่อนหน้า** (Owner เท่านั้นที่รันได้): **B2** (~11:00) · **C7/C8** (precondition `marketing_rules` VERIFIED แล้ว · ขั้นรัน NOT RUN) · **RT-HOURS** · **RL-DEFECT 4+1** หลัง deploy · role guide บท 3–12 · §15 spot-check (backlog sync 13 key = audit โค้ดครบแล้ว เหลือมือ)
3. **ยืนยัน "ข้อ 7/8/13/16/17/19"** = แถว CAP-07/08/13/16/17/19 (`BMB_MASTER_STATUS.md` §2) + **L-11 (LED)** ยังไม่พบในโค้ด = ต้องได้นิยามจาก Owner · **Backend+AI Part 1** เนื้อหา = รอเทียบต้นฉบับท่าน
4. **เกณฑ์ปิดจริง = `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` §16 (6 ข้อ)** — ครบก่อนค่อยประกาศปิดทุกลูป

## 3. ⚙️ กติกา/กับดักที่ต้องรู้ต่อ (สำคัญมาก)

- **chain rule:** ยึด `git log --oneline -1` จริงเสมอ (ค่าในเอกสารอาจเก่า)
- **commit/push สั่งทีละคำสั่ง** (เคยชน `index.lock` ตอนรันพร้อมกัน) · ข้อความ commit **ห้ามมี `"` ข้างใน** (cmd แตก — ใช้คำธรรมดา)
- **cmd ดัก `|`** ใน regex = ใช้ `^|` หรือหลบผ่าน PowerShell single-quote · เรียก node/ps ด้วย `powershell.exe -NoProfile -NonInteractive -Command ... 'path'` · tool รันได้ ~30s ต่อคำสั่ง — รัน test ชุดใหญ่เป็นชุดย่อย
- **BMB ห้ามใช้ `search_codebase`** (มันค้น workspace แชท) — ใช้ `Select-String` path ใต้ `D:\A PROJECT\Bite Me Baby` · ทุกงาน BMB = ใน repo นั้น
- **DB:** `e2e/dbq.cjs "<sql>"` = Management API (prod) · probe ที่แตะข้อมูล = **BEGIN..ROLLBACK เสมอ** + เก็บ evidence json · SQL ที่มี `$$`/quote ซ้อน = แยกเป็นไฟล์ `.sql` + runner `.cjs` (แบบ `r10Verify*`)
- **กติกาปิดงาน:** SKIPPED ≠ PASS · ห้ามแก้เอกสารให้ดูผ่าน · ห้ามสรุป "ปิดครบทุกลูป" ก่อน §16 ครบ · ผลทดสอบ = เก็บ verbatim (toast/ERR code)
- stash `local-edits-before-sync-2026-09-21` = ของเซสชั่นอื่น **ห้ามแตะ** · `.env.local` มี token ห้าม commit/รั่ว

## 4. 📁 ไฟล์หลักที่เปลี่ยนในรอบนี้ (R9+R10)

- **DB:** `supabase/migrations/161_order_notifications_address_photo.sql` · `162_admin_reject_payment.sql` (APPLIED แล้ว · รันซ้ำได้ idempotent)
- **lib:** `orderSubmitKey` (describeOrderSubmitError) · `bmbAdminApi_orders` (createOrderDetailed/rejectOfflinePayment) · `catalogStructure` (menuTabItems+scheduleMap) · `orderEntry` (ไม่ auto-navigate) · `orderVocabulary` (ป้ายพรีแยกชุด) · `homeProviders`+`StoreStatusStrip` (แบนเนอร์) · `promotionClient` (listAvailableCoupons) · `addressPhoto` (ใหม่)
- **UI:** `FoodMenuCard` · `CouponBox` · `CheckoutPage` · `MenuPage`/`CartPage`/`PromotionsPage` · `NotificationDropdown` · `RiderPwaPage` · `SlipReviewPanel` · `AdminOrders`/`AdminKitchen` · `OrderTimeline`
- **tests:** อัปเดตตามพฤติกรรมใหม่ (couponBox popup · storeStatusWindow/shopHoursGate/roundsSameDayNoCutoff ไม่โชว์เวลาส่ง · homePreOrderModeGuard/menuCartResultGuard ไม่ auto-navigate · adminOrdersModeFilter mock useNavigate) + เพิ่ม `menuTabItems` schedule-map case
- **evidence:** `e2e/r9*` · `e2e/r10*` (repro/apply/cleanup/verify ทั้งหมด) · `docs/BMB_BACKEND_AI_PART_1.md` (ใหม่)

*ปิดเซสชั่น 2026-10-27 · เขียนโดย AI (R9+R10) — รอ Owner retest แล้วแชทหน้าสานต่อ*