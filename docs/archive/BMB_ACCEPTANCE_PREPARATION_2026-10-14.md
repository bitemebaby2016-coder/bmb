# BMB — รายงานเตรียมพร้อมการทดสอบรับจริงรอบสมบูรณ์ (ACCEPTANCE PREPARATION REPORT)

> **วันที่:** 2026-10-14 · **สถานะงาน:** PREPARATION & EVIDENCE ONLY (ยังไม่มีการรันจริงใด ๆ)
> **ขอบเขตอนุมัติจาก Owner:** เตรียมทดสอบรับจริงครอบคลุม FB/AI post, FB/Messenger, สั่งจริงผ่านเว็บ, รับเงินจริง (PromptPay QR + โอนธนาคาร), ครัว+ไรเดอร์+ส่งจริง, rider workflow, และแผนเก็บกวาดข้อมูลทดสอบ — **งบสูงสุด ฿300 / 1 ออเดอร์จริง**
> **ยังไม่อนุญาต (จนกว่าจะได้อนุมัติรอบสุดท้าย):** สร้างออเดอร์จริง · รับ/โอนเงินจริง · เผยแพร่สาธารณะ · ผลิต/ส่งอาหาร · ลบข้อมูลทดสอบ · เปลี่ยน Live config · push/deploy
> **หลักฐาน:** Production DB (SELECT-only) · source จริง (`64faf6b` = deployed) · EF/secrets (ชื่อเท่านั้น) · Cloudflare API · อ่าน prosrc RPC จริง — ไม่มี secret/PII ในเอกสารนี้

---

## 1. Baseline ปัจจุบัน + หลักฐาน (ย่อ — ละเอียดที่ `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md` PART 1)

- **HEAD = origin/main = deployed = `64faf6b`** (CF deployment `09b4f220`, assets `index-0s4lXvhI.js`) · migrations 001–123 · **124 ยังไม่ apply** · RLS 51/51 · tests 972/972
- Category Option A แล้วเสร็จ+ยืนยันแล้ว · orders 206 (cancelled 205 + delivered 1 — ทั้งหมดเป็น test-era 2026-09/10) · payment_intents 56 = stripe 47 / promptpay 9 / **omise 0**
- **ชุดคำสั่งที่ใช้รอบนี้ = อ่านอย่างเดียวทั้งหมด** (SELECT/GET/git grep) — ไม่มีการเขียนข้อมูลธุรกิจแม้แต่แถวเดียว

## 2. สถานะแต่ละขั้นการทดสอบ (IMPLEMENTED / CONNECTED / DEPLOYED / RUNTIME VERIFIED / DOCUMENTED / MISSING / BLOCKED / DEFERRED)

| ขั้น | สถานะ | หมายเหตุ |
|---|---|---|
| ลูกค้าเข้าเว็บ → cart → checkout | IMPLEMENTED · DEPLOYED · RUNTIME VERIFIED (client) | smoke 9/9 แล้ว (session ก่อน) |
| Guest OTP / บัญชีทดสอบเข้าระบบ | IMPLEMENTED · DEPLOYED · **RUNTIME = MISSING** | EF `otp-send`/`guest-checkout-session` ใหม่ 11 ต.ค. ยังไม่จบเส้นจริง |
| สร้างออเดอร์ (canonical RPC 18-param) | IMPLEMENTED · DEPLOYED · RUNTIME (test-era) | ราคา/fee/stock re-derive ฝั่ง server เท่านั้น |
| **จ่าย PromptPay QR (เงินจริง)** | IMPLEMENTED · DEPLOYED · **RUNTIME = MISSING (รอบใหม่)** | เคย completed 2 แถว (ยุคเก่า) — รอบนี้ต้องพิสูจน์ใหม่ทั้งเส้น |
| **จ่ายโอนธนาคาร (manual transfer)** | **MISSING** — ระบบไม่รองรับ (ดู §3) | มีแค่ชื่อ type ในโค้ด แต่ enum DB/UI ไม่มี |
| จ่ายบัตร Omise (test mode) | IMPLEMENTED · CONNECTED · **browser RUNTIME = MISSING** | omise rows = 0 |
| Omise LIVE / บัตรเงินจริง | **BLOCKED** (ยังไม่พร้อม — ดู §4) | ไม่มี live key ในระบบ |
| ครัวรับงาน → preparing | IMPLEMENTED · DEPLOYED · RUNTIME (test-era) | `kitchen_queue`/`order_ready_to_make` |
| Bite Drive: assign → รับงาน → ส่ง → POD | IMPLEMENTED · DEPLOYED · **RUNTIME = MISSING (ไม่เคยส่งจริง)** | POD = geolocation + รูป (บังคับ) |
| Tracking ลูกค้า | IMPLEMENTED · DEPLOYED · RUNTIME (test-era) | `track_order` |
| Facebook post (AI draft → Owner อนุมัติ → publish) | IMPLEMENTED · DEPLOYED · RUNTIME (test-era, simulated) | **ต้องทดสอบใหม่แบบมี Owner อนุมัติทุกโพสต์** |
| Messenger/Comment intake (G4) | IMPLEMENTED · DEPLOYED · **event จริง = BLOCKED (Meta roles)** | HMAC+dedupe พร้อม |
| Failure/recovery | PARTIAL | queue dead 13 ค้าง · pending ไม่ auto-cancel (แค่แจ้ง) |

## 3. ขั้นตอนลูกค้าจ่ายเงินจริง — PromptPay QR และโอนธนาคาร (อ่านจากโค้ด/RPC จริง)

### 3.1 PromptPay QR (รองรับแล้ว — เส้นทางหลักของรอบทดสอบนี้)

**QR = ไฟล์สถิต** `/assets/Qr Code/BMB_Promptpay_Qr.webp` (โค้ดระบุ "static shop QR (Owner-verified asset). No dynamic amount") — ไม่มีการสร้าง QR ตามยอดเงิน
- **บัญชีที่รับเงิน = บัญชีที่ฝังอยู่ในรูป QR ของร้าน (PromptPay ของ Owner เอง)** — ระบบไม่ได้ผูกบัญชีธนาคารใด ๆ ทั้งสิ้น เงินเข้าบัญชี Owner โดยตรง
- **การจับคู่กับออเดอร์:** ระบบแสดงยอด `฿{order.total}` กำกับใต้ QR + ช่องให้ลูกค้ากรอก **TXN id/reference** หลังโอน → เรียก `submit_offline_payment_reference` (บันทึก `metadata.reference` บน intent, pending → **processing**)
- **ใครยืนยันเงินเข้า (trusted evidence):** **Admin/Owner เท่านั้น** ผ่าน `confirm_offline_payment` (เช็ค `is_admin()` ใน RPC) — เงื่อนไขฝั่ง server:
  - ต้องมี intent สถานะ `processing` (ลูกค้ากรอก TXN แล้ว) — ถ้าไม่มี → `ERR_NO_PENDING_PROMPTPAY` / `ERR_INTENT_NOT_PROCESSING`
  - ยอด intent ต้อง = ยอดออเดอร์เป๊ะ (`ERR_AMOUNT_MISMATCH` ตอนสร้าง intent)
  - ซ้ำ = idempotent (ออเดอร์ paid แล้ว → ไม่จ่ายซ้ำ) · เขียน audit_log ทุกครั้ง
- **หลักฐานที่ระบบยอมรับ = การที่ Admin เห็นเงินเข้าจริงในแอปธนาคาร/PromptPay ของร้าน + TXN ตรงกับที่ลูกค้ากรอก** — **สลิป/ภาพ/คำประกาศลูกค้าอย่างเดียว "ไม่ทำให้ออเดอร์เป็น paid"** (ระบบบังคับ: declaration = แค่ processing; paid เกิดจากมือ Admin ที่ตรวจเงินแล้วเท่านั้น) ✓ ตรงเงื่อนไข Owner
- **ซ้ำซ้อน/จ่ายเกิน:** ระบบไม่กัน intent หลายใบต่อ 1 ออเดอร์ (confirm ใช้ใบล่าสุด) — ถ้าลูกค้าโอนซ้ำ = **คืนเงินด้วยมือนอกระบบ** (PromptPay refund ไม่มีในระบบ; `omise-refund`/`stripe-refund` ใช้ได้เฉพาะบัตร) → ต้องมีขั้นตอนคืนเงินในคู่มือ (ดู §7)
- **หมดอายุ/ยกเลิก:** `orders_stale_pending` = **แค่แจ้งเตือน ไม่ยกเลิกอัตโนมัติ** · การยกเลิก = `cancel_order` โดย Admin (มี `cancel_window_minutes=5` สำหรับ pre-order) · intent ค้าง processing/pending = เก็บเป็น payment-exception ให้ Admin จัดการ (`/admin/payment-exceptions`)

### 3.2 โอนธนาคาร (manual bank transfer) — ❌ ยังไม่รองรับ (MISSING WORKFLOW)

**ความจริงจากโค้ด:** `bank_transfer` มีเฉพาะใน TS type `PaymentMethod` — แต่ **enum `payment_method` ใน DB = `promptpay_qr, credit_card, cash_on_delivery` เท่านั้น** และ radio ใน `CheckoutPage` มี 3 ตัวเลือก (QR/บัตร/COD) — ไม่มี bank transfer
- **สิ่งที่ขาด (exact missing workflow):** ① เพิ่มค่าใน DB enum ② radio + UI แสดงเลขบัญชี/ยอด ③ ช่องกรอก reference (ใช้ `submit_offline_payment_reference` ได้แต่ต้องแก้ให้รับ method ใหม่ — ตอนนี้ hard-code `promptpay_qr`) ④ คู่มือ Admin confirm (ใช้ `confirm_offline_payment` เดิมได้) ⑤ migration ที่ต้องผ่าน gate เดิม
- **ทางเลือกชั่วคราว (ไม่ต้องแก้โค้ด):** ใช้ PromptPay QR = โอนผ่านธนาคารเข้า PromptPay เดียวกัน (แอปธนาคารสแกน QR ได้) — **ครอบคลุม "โอนธนาคาร" เชิงพฤติกรรมแล้ว** โดยไม่ต้องแตะระบบ — แนะนำให้รอบทดสอบใช้วิธีนี้ + บันทึก TXN จากแอปธนาคาร

### 3.3 สรุป authority การจ่ายเงิน (ทุกเส้น)

| เส้น | สร้างยอด | หลักฐานที่ลูกค้าส่ง | ใครกด "เงินเข้าแล้ว" | กันจ่ายซ้ำ | คืนเงิน |
|---|---|---|---|---|---|
| PromptPay QR | `create_payment_intent_record` (server เช็คยอด = order total) | TXN reference (self-declare) | **Admin `confirm_offline_payment`** (ตรวจเงินจริงก่อน) | idempotent + intent ล่าสุด | นอกระบบ (manual) |
| โอนธนาคาร | — ไม่มี — | — | — | — | — |
| บัตร Omise | EF `omise-checkout` (server charge) | Omise.js token + 3DS | **omise-webhook → `record_payment_result`** (HMAC, service_role) | unique payment_intent_id | `omise-refund` EF (admin) |
| COD | intent โค้ดเดิม | — | Admin confirm **หลัง delivered เท่านั้น** | idempotent | — |

## 4. Omise Live readiness — ยังไม่พร้อม (คงเดิม) + สิ่งที่เหลือ

**ปัจจุบัน:** EF secrets มี `OMISE_SECRET_API_KEY_TEST_MODE` + `OMISE_WEBHOOK_SECRET_API_KEY_TEST_MODE` — **ไม่มี live key ในระบบ** · บัตร test path = code+EF+28 tests+sig probes 3/3 แต่ **browser checkout ไม่เคยรันจริง (omise rows = 0)**
**Live prerequisites ที่เหลือ (เรียง):** ① browser test test-mode 1 ครั้งให้ผ่านก่อน (กติกาเดิม) ② สมัคร/activate Omise live (KYC/business verification) ③ ได้ live keys → ตั้งใน EF + client (secrets change = ต้องอนุมัติ) ④ register webhook `omise-webhook` ใน Omise dashboard (live) ⑤ test 1 ครั้งด้วยยอดต่ำ + refund
**รอบนี้:** **ห้ามเปิด Live charging** จนกว่า Owner review แผนรอบสุดท้าย — ใช้ PromptPay เป็นตัวรับเงินจริงของรอบทดสอบแทน (ตรงลำดับความสำคัญที่ Owner กำหนด)

## 5. Facebook/Messenger — สถานะ + ขั้นตอนทดสอบแบบมี Owner อนุมัติทุกครั้ง

**การ implement จริง (G4–G9):** · **G7/G9:** `contentApproval.ts` → RPC `submit_content_for_approval` / `review_content` → worker `social-post-worker` (G7) / `social-publish-worker` (G9 publish 6/6 test-era) · **G6:** `social-ai-worker` = classify/draft **draft-only** (ไม่โพสต์เอง) · **G4:** EF `channel-webhook` รับ event (GET verify + POST `X-Hub-Signature-256` + dedupe → RPC 18-param) — **event จริงยังไม่เคยเข้า (Meta roles/Test User = external blocker เดิม)** · **G8:** queue ทำงานต่อเนื่อง
**Authorization status จริง:** EF secrets มี `META_APP_ID/APP_SECRET/PAGE_ACCESS_TOKEN/PAGE_ID` + `CHANNEL_WEBHOOK_*` = **เชื่อมต่อแล้ว** — แต่จากฝั่ง Meta ยังไม่มี Test User/roles ที่ใช้ได้ (รายงานเดิม G4 HOLD) — ยืนยันไม่ได้จนกว่าจะมี event จริง 1 ใบ

**ขั้นตอนทดสอบที่เตรียมไว้ (ต้องมี Owner อนุมัติทุกการเผยแพร่):**
1. **โพสต์:** AI สร้าง draft (social-ai-worker) → แสดงใน `/admin/content-approvals` → **Owner กด approve เองทีละโพสต์** → `review_content` → publish (สิทธิ์ PAGE_ACCESS_TOKEN) → ตรวจโพสต์บนเพจจริง + audit_log — *ถ้าเพจเป็นเพจจริงของร้าน = เห็นสาธารณะทันที แนะนำให้โพสต์เนื้อหาทดสอบที่ระบุว่าเป็นการทดสอบ*
2. **คอมเมนต์/Messenger (บัญชีทดสอบ):** บัญชีทดสอบที่ Owner กำหนด comment/ส่งข้อความ → ดู `channel-webhook` รับ event (แถวใน intake/queue) → G6 classify → draft reply → **Owner อนุมัติ** → worker ตอบ → ยืนยันคำตอบขึ้นจริง + ไม่ส่งซ้ำ (dedupe/replay)
3. **ลิงก์เข้าเว็บ:** แนบลิงก์ biteme-baby.com ในโพสต์/ข้อความ → คลิกจากบัญชีทดสอบ → เข้าเมนู/cart ได้จริง
4. **ขอบเขตที่ห้าม:** ไม่ขยายสิทธิ์ Meta · ไม่ส่งข้อความหาลูกค้าจริงที่ไม่ได้นัดหมาย · ไม่แก้ webhook config · ทุก action สาธารณะ = Owner คลิกอนุมัติเอง (AI ไม่กดแทน)

## 6. Rider workflow + การลงทะเบียน (จาก implementation จริง — DEL-02/F-06)

- **หน้าจอไรเดอร์ = เว็บ PWA ที่ `/rider`** (ไม่ใช่แอปมือถือแยก — เปิดในเบราว์เซอร์มือถือได้) · อินเทอร์เฟซ: login → เห็นงานของตัวเอง (`my_deliveries`) → รับงาน (`driver_accept_assignment`) → `picked_up` → `in_transit` → `delivered` ซึ่ง **บังคับ geolocation + รูป POD** (`proof_of_delivery_url` ต้องมีก่อนเปลี่ยนเป็น delivered) · ทุกการเปลี่ยนสถานะ = RPC `driver_update_delivery_status` (JWT เป็นตัวระบุตัวตน)
- **การลงทะเบียน = ไม่มี self-service** (Owner Decision 06 — ตัด phone signup ออกแล้ว): ① **Admin สร้าง driver** (`upsert_driver`: ชื่อ/เบอร์/ยานพาหนะ) ② **สร้างบัญชีผู้ใช้** (Supabase Auth — ลงทะเบียน/สร้างจาก dashboard) ③ **Admin link** บัญชีกับ driver (`link_driver_user`) ④ ไรเดอร์ login ที่ `/rider` ด้วย email/password → `driver_login` คืน profile เฉพาะคนที่ถูก link
- **✅ อัปเดต 2026-10-14 — มี UI Provision แล้ว:** แผง "🧑‍✈️ จัดการไรเดอร์ (Provision)" ที่ `/admin/delivery` — สร้าง/อัปเดต driver + ผูกบัญชีผู้ใช้จาก dropdown ผ่าน RPC 2 ตัวเดิม (`upsert_driver`/`link_driver_user`) · ไม่แตะ DB/schema เพิ่ม · `upsert_driver` คีย์ด้วยเบอร์โทร (เบอร์ซ้ำ = อัปเดตตัวเดิม) · บัญชีที่ถูกผูกแล้วจะไม่ถูกเลือกซ้ำ (`ERR_USER_ALREADY_LINKED`)
- **สิทธิ์:** ไรเดอร์เห็นเฉพาะงานตัวเอง (RLS `my_deliveries`) · ไม่เห็น/แก้ของคนอื่น · การ assign = **ฝั่ง Admin เท่านั้น** (`assign_driver` จาก `/admin/delivery` = DeliveryManagement) · Admin มี `admin_advance_delivery` เป็นอำนาจแยก (กรณีแก้ปัญหา)
- **ไรเดอร์ตัวอย่าง 5 คนปัจจุบัน = ข้อมูลทดสอบทั้งหมด** (ชื่อ QA/STEP2-CT — `drv-qa-w2-01/02` + 3 ตัว test) — **สถานะ `busy` ค้างจากการทดสอบ** · มี user link แค่ 2 คนแรก — **ใช้รับงานจริงได้เฉพาะเมื่อ Owner กำหนดคนจริงถือบัญชีที่ link แล้ว** (แนะนำ: ใช้ `drv-qa-w2-01` เป็น "นักขับทดสอบ" โดย Owner คนขับเอง/คนสนิท พร้อม GPS จริงระหว่างทาง) — ห้ามสมมติว่า QA rider ส่งจริงได้โดยไม่มีคนจริงถือบัญชี

## 7. สคริปต์ทดสอบ E2E — 1 ออเดอร์จริง (ยังไม่รัน — รออนุมัติรอบสุดท้าย)

**กรอบ:** 1 ออเดอร์ · SAME_DAY · PromptPay QR (เงินจริงเข้าบัญชีร้าน = โอนกลับตัวเอง) · Bite Drive ≤5 กม. · ทุกการเปลี่ยนสถานะโดย "ผู้มีอำนาจ" ที่ระบุ — **AI ไม่กดเปลี่ยนสถานะ/ยืนยันเงินแทนใคร**

**งบที่คาด (ไม่เกิน ฿300):** อาหาร `prod-1 ผัดไก่กุ้งเส้นสด` **฿69** (Same Day ของจริงสำหรับครัว) + ค่าส่ง zone-city 0–5 กม. **฿25** (฿35 ถ้าอยู่โซน 0–3 กม.) + service fee/tax = **ไม่มีค่าตั้งในระบบ → คาด ฿0** = **ยอดรวม ~฿94 (สูงสุดไม่เกิน ฿124)** · ต้นทุนสุทธิจริง = วัตถุดิบ+แรง+น้ำมัน (~฿50–80) — **อยู่ในงบ ฿300 เหลือเฟือ** (ถ้าระบบคิดยอดเกิน ฿300 = **หยุดทันที** ตามเงื่อนไข Owner)

**Pre-checks ก่อนวันรัน (ทุกข้อต้องผ่าน):** ① ที่อยู่ผู้รับต้องอยู่ **ในรัศมี 5 กม.จาก `kitchen_location` (10.7016, 102.1429)** — ⚠️ พิกัดครัวอยู่คนละพื้นที่กับชื่อโซน (สีลม/ทองหล่อ) → **Owner ยืนยันที่อยู่ทดสอบ + พิกัดครัวให้ตรงกันก่อน** ② เวลา 8:00–20:00 และเผื่อ cutoff 2 ชม. ③ สินค้า `prod-1` available ④ บัญชีทดสอบลูกค้า (OTP เบอร์ที่กำหนด / quick-login GPS) ⑤ บัญชีไรเดอร์ (`drv-qa-w2-01` + คนจริง + มือถือ GPS) ⑥ session Admin (qa-admin/Owner) ⑦ backup dump ก่อนรัน (`e2e/dbBackup.cjs`)

| Step | การกระทำ (ใครทำ) | ผลที่คาด (ยืนยันจากไหน) | ถ้าล้มเหลว |
|---|---|---|---|
| S1 | ลูกค้าทดสอบเปิดเว็บ → login (OTP/quick-login) | เข้าเมนูเห็น 5 หมวด/6 สินค้า (anon เดิม) | OTP ไม่มา = หยุด ตรวจ `sms-send` (F-07) |
| S2 | เพิ่ม `prod-1` ×1 → ไป cart → reload 1 ครั้ง | ตะกร้าคงเดิม (`bmb-cart-v1`) · ยอดสินค้า ฿69 | ตะกร้าหาย = บันทึกเป็น defect หยุด |
| S3 | Checkout (SAME_DAY, ที่อยู่ทดสอบ, PromptPay) → ยืนยัน | **ออเดอร์สร้างโดย RPC** — ได้ `order_number` · ยอด re-derived: 69+25=฿94 · สถานะ `pending`/payment `pending` | RPC reject = อ่าน error (cutoff/zone/stock) → แก้เงื่อนไขแล้วลองใหม่ 1 ครั้ง |
| S4a | หน้า PaymentConfirmation แสดง QR สถิต + ยอด | ยอดตรงกับ S3 · มีช่องกรอก TXN | ยอดไม่ตรง = หยุด (ERR_AMOUNT_MISMATCH หมายถึงข้อมูลเพี้ยน) |
| S4b | **Owner โอนจริง ฿94 จากแอปธนาคาร → คัดลอก TXN → กรอก** | intent pending → `processing` (metadata.reference = TXN) | กรอกไม่ผ่าน (ERR_NO_PENDING_PROMPTPAY) = ตรวจว่า intent ถูกสร้างไหม |
| S4c | **Owner เปิดแอปธนาคารร้าน เห็นเงินเข้า ฿94 + TXN ตรง → Admin กด confirm** ในออเดอร์ | payment → `paid` · audit_log `payment_processed` | **เงินไม่เข้า/ยอดผิด = ห้ามกด confirm → หยุด+รายงาน** (กติกา Owner) |
| S5 | ครัว (`/admin/kitchen`): เห็นออเดอร์ → เดินหน้า preparing | สถานะ `confirmed`→`preparing` (history บันทึก) | ไม่เห็นในคิว = ตรวจ `kitchen_queue`/payment paid ก่อน |
| S6 | Admin `/admin/delivery` assign `drv-qa-w2-01` → ไรเดอร์เปิด `/rider` รับงาน → `picked_up` → `in_transit` (GPS จริงระหว่างทาง) | assignment สถานะเดินหน้า · order → `dispatched`/`in_transit` | ไรเดอร์ login ไม่ได้ = link ไม่ครบ (§6) — **หยุดก่อน dispatch** |
| S7 | ถึงจุดส่ง → ไรเดอร์ถ่ายรูป POD + เปิด GPS → `delivered` | order `delivered` + `proof_of_delivery_url` · ระบบปล่อย driver | POD/GPS ไม่ผ่าน = ตั้งใจให้บล็อก — ใช้ `admin_advance_delivery` เฉพาะกรณีเหตุผลสมควร+บันทึก |
| S8 | ลูกค้าเปิด tracking ระหว่าง S5–S7 | เห็นสถานะเปลี่ยนตามจริง | ล่าช้า = บันทึก latency |
| S9 (optional) | ซ้อม failure 1 จุด: กรอก TXN ผิด (S4b) หรือ ดู auto-stale notify | ระบบปฏิเสธ/แจ้งเตือนตามออกแบบ | — |

**แผนรับมือล้มเหลว (ทุกกรณี):**
- **จ่ายเงินไม่สำเร็จ/อ้างอิงผิด:** intent ค้าง pending/processing → ไม่เดินหน้าครัว → Admin `cancel_order` (ระบบ release รอบ+คืน stock ใน transaction เดิม) → **ไม่มีการ mark paid โดยไม่เห็นเงิน**
- **โอนซ้ำ/ยอดเกิน:** คืนเงินด้วยโอนกลับ PromptPay ด้วยมือ + บันทึกใน `order_notes`/audit — ระบบไม่มี refund สำหรับ offline (ยอมรับได้ในรอบทดสอบ 1 ใบ)
- **ส่งไม่สำเร็จ (รถ/ที่อยู่/ผู้รับ):** ติดต่อผู้รับ → ถ้าจบไม่ได้: `cancel_order`/`admin_advance_delivery` (บันทึกเหตุผล) → อาหาร/ค่าส่ง = ต้นทุนทดสอบที่ Owner ยอมรับแล้ว
- **ระบบค้าง/queue:** มี auto-stale แจ้งที่ 120 นาที + dead-letter — รายงานทันที ไม่ retry มั่ว
- **ยอดรวมเกิน ฿300 หรือระบบยืนยันเงิน/ไรเดอร์ไม่ได้:** **หยุด + รายงานก่อน** (ไม่ลดขั้นความปลอดภัยเพื่อให้ผ่าน)

## 8. Sample-data cleanup inventory + แผนที่เสนอ (ยังไม่ลบอะไรทั้งสิ้น)

| ตาราง/เอนทิตี | จำนวนแถว (2026-10-14) | test ชัวร์ / ไม่ชัวร์ | FK + audit ที่ต้องระวัง | วิธีที่เสนอ (ต้องอนุมัติก่อนทำ) | แถวที่กระทบ + rollback |
|---|---|---|---|---|---|
| `orders` | 206 (cancelled 205 + delivered 1) | **test ชัวร์** ทั้งหมด (2026-09/10, channels: null 56 / MANUAL 48 / PWA 45 / MESSENGER 38 / FB_GROUP 12 / FB 7) — รอ Owner confirm ซ้ำ | `order_items` · `payment_intents` · `delivery_assignments` · `order_status_history` · `audit_logs` | **ห้ามลบ** — เก็บเป็น archive: label `is_test`/ย้าย schema `archive` หรือ export CSV แล้วเก็บเงียบ | ~206 (+203 items +454 history) · rollback = restore dump |
| `payment_intents` | 56 (stripe 47 / promptpay 9) | test ชัวร์ (stripe test-era + promptpay ยุค closure) | FK → orders · unique `payment_intent_id` | ห้ามลบ (ประวัติเงิน) — archive พร้อม orders | 56 |
| `delivery_assignments` | 10 (cancelled 9 + **assigned 1 ค้าง**) | test ชัวร์ (QA) | FK → orders/drivers | เก็บ + **ปิดงาน assigned ค้าง 1 ใบ** (cancel + เหตุผล) | 10 |
| `drivers` | 5 (QA/STEP2-CT ทั้งหมด, busy ค้าง, linked 2) | test ชัวร์ | `delivery_assignments` · user_id → auth.users | **label เป็น test/ปิด `status`** · สร้าง driver จริงแยก (§6) | 5 · ไม่ลบ (referenced) |
| `delivery_rounds` | 42 | test/เก่า (ยังไม่ confirm — ดูวันที่รอบ) | orders บางส่วนอ้างอิง | ยืนยันวันที่แล้ว archive รอบหมดอายุ | 42 |
| `automation_queue` | 1452 (succeeded 1439 · **dead 13**) | job จริงปน test | — | dead 13: เก็บ/ทำเครื่องหมายพร้อมเหตุผล (F-04 runbook) | 13 |
| `notifications` | 338 | test ชัวร์ส่วนใหญ่ | customer_id | archive ตามอายุ | 338 |
| `order_status_history` / `audit_logs` | 454 / 3,937 | ปนกัน (audit จริงของระบบ) | FK → orders | **ห้ามลบ** (audit trail) — เก็บถาวร | 0 ลบ |
| `profiles` / `customers` | 96 / 37 | ส่วนใหญ่ test (เช่น QA accounts) — **ไม่ชัวร์บางส่วน** | orders.customer_ref · auth.users | **ห้ามลบ** ก่อน Owner ยืนยันรายบัญชี · ทำรายการ test-account list แยก | 0 ลบ (รอบนี้) |
| `products` | 19 (รวม **placeholder "coming soon" ฿1 ×2**) | placeholder ชัวร์ 2 ตัว | order_items (ตัวอื่น) | **ซ่อน/Archive 2 ตัว placeholder** (ไม่ลบ — มี FK ได้) | 2 |
| `product_categories` | 6 (cat-2 archived แล้ว) | — | products | คงเดิม | 0 |

**ลำดับที่เสนอ (ยังไม่ทำ):** ① `e2e/dbBackup.cjs` dump เต็ม ② Owner ยืนยันรายการ "test ชัวร์" ข้างบน ③ ทำ **labeling/archiving** (ไม่ใช่ hard delete) — เริ่มจากปิด assignment ค้าง 1 ใบ + archive placeholder สินค้า 2 ตัว + dead queue 13 ④ orders/payment/history = **เก็บถาวร ไม่ลบ** (กฎหมาย/บัญชี + audit) ⑤ ทุก step = SQL ที่เตรียมไว้ล่วงหน้า + นับแถวก่อน/หลัง + rollback = restore dump

## 9. สิ่งที่ Owner ต้องทำ · ความเสี่ยง · ค่าใช้จ่ายโดยประมาณ

**Owner actions (ก่อนสั่งรัน):** ① ยืนยัน test plan นี้ (รวมงบ) ② กำหนด **บัญชีลูกค้าทดสอบ** (เบอร์ OTP ที่รับได้จริง) ③ กำหนด **คนถือบัญชีไรเดอร์** (ใช้ `drv-qa-w2-01` ที่ link แล้ว หรือสั่ง provision ใหม่ — ทีมทำให้ได้แต่ต้องมีคนจริง) ④ **ยืนยันที่อยู่ส่ง + พิกัดครัว** (ให้อยู่ใน 5 กม. — ดู pre-check ①) ⑤ เตรียมแอปธนาคารร้านไว้ดูเงินเข้า + แอปธนาคารผู้โอน ⑥ (ถ้าจะทดสอบ FB) เตรียมบัญชีทดสอบ Meta + อนุมัติโพสต์ทีละใบ ⑦ อนุมัติกติกา: ทุกการยืนยันเงิน/เปลี่ยนสถานะ = คนจริงกด ⑧ สำรองฐานก่อนรัน
**ความเสี่ยงหลัก:** เงินจริงโอนผิด/ซ้ำ (คืนมือ) · ออเดอร์ค้างถ้าคนไม่อยู่หน้าจอ (มี auto-stale ช่วยเตือน) · GPS/POD ไม่ผ่านถ้าปิดสิทธิ์มือถือ · เมนู/ราคาเปลี่ยนระหว่างทาง (ระบบ re-derive = ยอดอาจไม่เท่าที่คิด — ถ้าเกิน ฿300 หยุด) · โพสต์ FB = เห็นสาธารณะ (ให้ระบุว่าทดสอบ)
**ค่าใช้จ่ายประเมิน:** ยอดโอน ~฿94 (เข้าบัญชีร้านเอง = ไม่ใช่ค่าใช้จ่ายสุทธิ) · ต้นทุนจริง = วัตถุดิบ+แรง+น้ำมัน **~฿50–80** · SMS OTP 1 ข้อความ (~฿0.25–1) · **รวมสุทธิ ≈ ฿60–90 — ต่ำกว่างบ ฿300 มาก** (เผื่อผิดพลาด/ส่งซ้ำ/ค่าส่งโซนสูงก็ยังไม่เกิน ฿150)

### ข้อมูลที่ Owner ยืนยันแล้ว (2026-10-14)

| รายการ | ที่ยืนยัน |
|---|---|
| **บัญชีร้านรับเงิน (PromptPay/โอน)** | ธนาคารกรุงไทย **684-009-0124** สาขาเซ็นทรัลจันทบุรี · ชื่อบัญชี **พิชชาพร จันทโรบล** — ตรงกับ QR สถิตของร้าน (การจับคู่ออเดอร์ = TXN + admin confirm ตาม §3.1) |
| **ไรเดอร์** | มีคนจริงพร้อมทำหน้าที่ — แอดมินจะ provision บัญชีผ่าน **UI ใหม่** ที่ `/admin/delivery` (§6) |
| **ที่อยู่ส่ง + โซน** | กำลังจัดให้พร้อม (รอ Owner ส่งก่อนวันรัน — pre-check ①) |
| **แอปธนาคาร** | พร้อมทั้งฝั่งผู้โอนและผู้รับ (เช็กเงินเข้าจริงได้) |
| **ผู้ทดสอบ Meta (เปลี่ยนจาก test user สังเคราะห์)** | **Pitchaporn Chantharobol = ผู้ทดสอบ (Tester) ในแอป `1737887467512190` ("BITE ME BABY - Main Page TH", ธุรกิจ `1955969644953862`)** — ยืนยันจากหน้า App Roles แล้ว · โต้ตอบ comment/Messenger จริงด้วยคนจริง · ⚠️ เช็คลิสต์ก่อนใช้: บัญชีผู้ทดสอบต้องกด "ยอมรับ" คำเชิญบทบาทใน Meta ให้เสร็จก่อน |
| **Omise Live** | ยังไม่พร้อม — รอการยืนยัน (NO-GO ต่อตาม §4) |
| **Facebook โพสต์** | อนุมัติแบบมี Owner คลิกทุกโพสต์ (§5) — ผู้โต้ตอบจริง = Pitchaporn Chantharobol |

## 10. Go / No-Go

| รายการ | คำตัดสิน | เงื่อนไข |
|---|---|---|
| **Acceptance run 1 ออเดอร์จริง (PromptPay + Bite Drive)** | **✅ CONDITIONAL GO** | ผ่าน pre-checks 7 ข้อ + Owner อนุมัติ test plan รอบสุดท้าย + มีคนจริง 3 บทบาท (ลูกค้า/คนยืนยันเงิน/ไรเดอร์) — ระบบพร้อมรับมือทั้ง happy + failure path |
| จ่ายเงินจริงผ่าน PromptPay QR | **✅ GO** (ในรอบนี้) | chain การยืนยันแข็งแรง (server บังคับ admin-confirm) — เงินเข้าบัญชีร้านตัวเอง |
| โอนธนาคาร (ระบบรองรับ) | **❌ NO-GO (ระบบไม่รองรับ)** | ใช้ QR ผ่านแอปธนาคารแทนได้ทันที · workflow จริง = งานพัฒนาตาม §3.2 (แยกเสนอภายหลัง) |
| Omise Live / บัตรเงินจริง | **❌ NO-GO** | ยังไม่มี live key/KYC — ตาม §4 (test-mode browser ยังไม่เคยรันด้วยซ้ำ) |
| FB post (มี Owner อนุมัติทุกใบ) | **✅ CONDITIONAL GO** | โพสต์ทดสอบระบุ "ทดสอบ" + Owner คลิกเอง · G4 reply = จำกัดที่บัญชีทดสอบ |
| ลบ/เก็บกวาดข้อมูลทดสอบ | **❌ ยังไม่ทำ** | จนกว่า Owner อนุมัติแผน §8 + dump ก่อน |
| ประกาศ Open Shop | **❌ NO-GO** | จนกว่ารอบจริงทั้งเส้นผ่าน + Owner sign-off (ตามกติกาเดิม) |

> **สรุปหนึ่งบรรทัด (อัปเดต 2026-10-14):** Owner อนุมัติแผนแล้ว + ระบบพร้อมทดสอบรับจริง 1 ออเดอร์ผ่าน PromptPay+Bite Drive (งบสุทธิ <฿100 จาก ฿300) · UI Provision ไรเดอร์ส่งมอบแล้ว — **เหลือรอ:** ① ที่อยู่ส่ง+โซนจาก Owner ② แอดมิน provision บัญชีไรเดอร์คนจริง ③ บัญชี Meta กดรับบท Tester ④ นัดหมายวันรัน (8:00–20:00, cutoff 2 ชม.) — ทุกขั้นความปลอดภัยคงไว้ครบ ไม่มีการลดเงื่อนไขใด ๆ
