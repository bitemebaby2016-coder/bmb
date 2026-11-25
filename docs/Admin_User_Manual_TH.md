# คู่มือการใช้งานสำหรับแอดมิน (Admin User Manual)
**Bite Me Baby — ระบบจัดการออเดอร์ อาหาร ส่งมอบ และชำระเงิน**

> **หมายเหตุ**: คู่มือนี้เขียนจากฟีเจอร์และโค้ดที่มีอยู่จริงในโปรเจกต์ (`src/` ปัจจุบัน) เท่านั้น — ไม่ได้แต่งฟีเจอร์ขึ้นมาเอง หากจุดไหนยังไม่ชัดเจนในโค้ด จะมีหมายเหตุว่า **"ควรตรวจสอบเพิ่มเติมกับหน้าเว็บจริง"**

---

## สารบัญ
1. [ภาพรวมระบบและภาษาที่ใช้](#ภาพรวมระบบและภาษาที่ใช้)
2. [ขั้นตอนที่ 1: ลูกค้าเข้ามาดูสินค้า / เริ่มต้นใช้งาน / ติดต่อสอบถาม](#ขั้นตอนที่-1-ลูกค้าเข้ามาดูสินค้า--เริ่มต้นใช้งาน--ติดต่อสอบถาม)
3. [ขั้นตอนที่ 2: การเลือกสินค้า / ตะกร้า / การกรอกข้อมูล / การยืนยันคำสั่งซื้อ](#ขั้นตอนที่-2-การเลือกสินค้า--ตะกร้า--การกรอกข้อมูล--การยืนยันคำสั่งซื้อ)
4. [ขั้นตอนที่ 3: การชำระเงิน / การตรวจสอบสลิปหรือสถานะการจ่ายเงิน](#ขั้นตอนที่-3-การชำระเงิน--การตรวจสอบสลิปหรือสถานะการจ่ายเงิน)
5. [ขั้นตอนที่ 4: การจัดเตรียม / การจัดส่ง / การแจ้งสถานะลูกค้า](#ขั้นตอนที่-4-การจัดเตรียม--การจัดส่ง--การแจ้งสถานะลูกค้า)
6. [ขั้นตอนที่ 5: การปิดการขาย / หลังการขาย / การเก็บข้อมูลหรือรีวิว](#ขั้นตอนที่-5-การปิดการขาย--หลังการขาย--การเก็บข้อมูลหรือรีวิว)
7. [หน้าจอ/เมนูที่แอดมินใช้บ่อย และหน้าที่ปุ่ม/สถานะแต่ละอย่าง](#หน้าจอเมนูที่แอดมินใช้บ่อย-และหน้าที่ปุ่มสถานะแต่ละอย่าง)
8. [กรณีเคสพิเศษ และจุดที่แอดมินมักทำพลาด](#กรณีเคสพิเศษ-และจุดที่แอดมินมักทำพลาด)
9. [เช็คลิสต์สรุปการทำงานประจำวันของแอดมิน (Daily Routine)](#เช็คลิสต์สรุปการทำงานประจำวันของแอดมิน-daily-routine)
10. [จุดเชื่อมต่อกับระบบภายนอก](#จุดเชื่อมต่อกับระบบภายนอก)

---

## ภาพรวมระบบและภาษาที่ใช้

**Bite Me Baby** เป็นแพลตฟอร์มสั่งอาหารที่รองรับ 2 โหมดหลัก:
- **SAME_DAY (ส่งวันเดียวกัน)**: ลูกค้าสั่ง → ร้านรับ → ทำ → ส่งทันที
- **PRE_ORDER (สั่งล่วงหน้า/จองล่วงหน้า)**: ลูกค้าจองล่วงหน้าตามรอบจัดส่ง (เช้า/กลางวัน/เย็น) → ร้านผลิตแบบแบทช์ → ส่งตามวันที่จอง

**สถานะออเดอร์ (Order Status) — เครื่องจักรกลกลาง (State Machine)**:
- **SAME_DAY**: `Created` → `Accepted` (รอรับ) → `Preparing` (กำลังทำ) → `Ready for Pickup` (พร้อมรับ/พร้อมส่ง) → `Dispatched` (ออกจัดส่ง) → `Delivered` (ส่งถึงแล้ว)
- **PRE_ORDER**: `Booked` (จองแล้ว) → `Allocated` (จัดสรร) → `Batch Production` (ผลิตแบทช์) → `Ready for Pickup` → `Dispatched` → `Delivered`
- สถานะสิ้นสุด: `Cancelled` (ยกเลิก), `Failed` (ล้มเหลวระหว่างส่ง)

> **คำแปลศัพท์เทคนิคสำหรับแอดมิน**:
> - **Webhook** = ระบบแจ้งเตือนอัตโนมัติจากผู้ให้บริการชำระเงิน (Omise/Stripe) เมื่อมีการจ่ายเงินสำเร็จ/ล้มเหลว
> - **Trigger** = เหตุการณ์ที่ทำให้ระบบทำงานอัตโนมัติ (เช่น "ลูกค้าสั่งซื้อ" ทริกเกอร์ส่งแจ้งเตือน)
> - **Cron Job** = งานที่รันตามเวลาตาราง (เช่น ตรวจสอบโพสต์ที่ถึงเวลาเผยแพร่ทุกชั่วโมง)
> - **RPC** = ฟังก์ชันฝั่งเซิร์ฟเวอร์ที่แอดมินเรียกผ่านหน้าจอ (เช่น `confirm_offline_payment`)

---

## ขั้นตอนที่ 1: ลูกค้าเข้ามาดูสินค้า / เริ่มต้นใช้งาน / ติดต่อสอบถาม

### 🎯 เป้าหมาย
ลูกค้าเข้าเมนู ดูโปรโมชั่น ติดต่อสอบถาม — ระบบเริ่มจับคู่ความสนใจ

### 🤖 ระบบออโตเมชั่น (Automation) ในขั้นตอนนี้
| ระบบทำอะไรอัตโนมัติ | เงื่อนไข (Trigger) | แอดมินต้องแทรกแซง? |
|-------------------|------------------|------------------|
| โชว์เมนูตามตาราง (Menu Schedule) | วันที่เปลี่ยน / แอดมินกด Publish schedule | ❌ ไม่ต้อง (แอดมินตั้งเวลาเผยแพร่ครั้งเดียว) |
| แจ้งเตือน "ออเดอร์เข้าใหม่" ดังเสียงในครัว | มีออเดอร์สถานะ `pending` ใหม่เข้ามา (เปรียบเทียบกับหน้าก่อนหน้า) | ❌ ไม่ต้อง (ดังอัตโนมัติเมื่อโหลดหน้า `/admin/orders`) |
| สร้างการแจ้งเตือนในแอป (`order_placed`) | ลูกค้ากดยืนยันคำสั่งซื้อสำเร็จ | ❌ ไม่ต้อง (ระบบ `triggerEvent` ยิงอัตโนมัติ) |

### 👤 แอดมินทำอะไรบ้าง? (Manual)
- **ดูแดชบอร์ด** (`/admin/dashboard`): ตรวจ KPI ภาพรวม (ออเดอร์วันนี้, ยอดวันนี้, อัตราสำเร็จ, ลูกค้าทั้งหมด)
- **เปิดหน้า Orders** (`/admin/orders`): กรองสถานะ `pending` เพื่อดูออเดอร์ใหม่ที่ยังไม่ได้รับการยืนยัน
- **ตั้งค่าเมนูประจำวัน** (`/admin/menu-schedule`): กด **Save** แล้ว **Publish** เพื่อให้เมนูขึ้นบนหน้าร้าน

> ⚠ **จุดสังเกต**: หากเมนูไม่ขึ้นบนหน้าร้าน ให้ตรวจสอบว่าแอดมินกด **Publish** แล้วหรือยัง (ต้องมี `is_published = true` ในตาราง `menu_schedule`)

---

## ขั้นตอนที่ 2: การเลือกสินค้า / ตะกร้า / การกรอกข้อมูล / การยืนยันคำสั่งซื้อ

### 🎯 เป้าหมาย
ลูกค้าเลือกอาหาร ใส่ตะกร้า กรอกที่อยู่/หมายเหตุ กดยืนยันสั่งซื้อ

### 🤖 ระบบออโตเมชั่น (Automation) ในขั้นตอนนี้
| ระบบทำอะไรอัตโนมัติ | เงื่อนไข (Trigger) | แอดมินต้องแทรกแซง? |
|-------------------|------------------|------------------|
| **กำหนดโหมดออเดอร์อัตโนมัติ** (SAME_DAY หรือ PRE_ORDER) | ตะกร้ามีเมนูจากปฏิทิน (มี `scheduled_date`) อย่างน้อย 1 รายการ = PRE_ORDER, มิฉะนั้น = SAME_DAY | ❌ ไม่ต้อง (ฟังก์ชัน `deriveCartMode` ใน `cartStore` คำนวณเอง) |
| **คำนวณส่วนลด/โปรโมชั่น** | ลูกค้ากรอกโค้ดคูปอง / มีโปรโมชั่นอัตโนมัติ | ❌ ไม่ต้อง (ระบบ `promotionClient` + `discountGuardrail` ตรวจเพดาน 15% ของยอดสินค้า) |
| **สร้าง Payment Intent** (บันทึกเจตนาชำระเงิน) | ลูกค้าเลือกวิธีชำระเงิน และกดยืนยันสั่งซื้อ | ❌ ไม่ต้อง (ฟังก์ชัน `createPaymentIntent` เรียก RPC `create_payment_intent_record` เอง) |
| **ป้องกันการส่งซ้ำ (Double-submit)** | ลูกค้าคลิกสั่งซื้อ 2 ครั้งติดกัน | ❌ ไม่ต้อง (RPC `create_order_with_items` มี `p_client_submit_key` กันซ้ำ) |
| **ส่งแจ้งเตือน "Order Placed"** | ออเดอร์สร้างสำเร็จ (RPC ตอบสำเร็จ) | ❌ ไม่ต้อง (`triggerEvent('order_placed')` ใน Checkout) |

### 👤 แอดมินทำอะไรบ้าง? (Manual)
- **ดูรายละเอียดออเดอร์** ใน `/admin/orders`: ดูไอเท็ม, โหมด (SAME_DAY/PRE_ORDER), วิธีชำระ, ยอดรวม
- **ยืนยันรับออเดอร์** (ปุ่ม **✅ ยืนยันออเดอร์**): เปลี่ยนสถานะ `pending` → `confirmed`
  - ระบบจะ: พิมพ์ใบสั่งครัวอัตโนมัติ (ถ้าเปิด `autoPrintKitchen`), พิมพ์สติกเกอร์ Bluetooth (ถ้าเปิด `autoPrintStickers`), ดังเสียงเตือนครัว, ส่งแจ้งเตือน `order_confirmed`
- **กรณีมีสลิปโอนค้างตรวจ**: ระบบจะบังคับผ่าน **ประตูตรวจสลิป** (Slip Gate) ก่อนถึงจะกดยืนยันออเดอร์ได้

> ⚠ **จุดสังเกต**: หากออเดอร์ค้างอยู่ที่ `pending` นานเกินไป = แอดมินยังไม่ได้กดยืนยัน (ต้องเข้า `/admin/orders` กรอง `pending` แล้วกดปุ่มสีเขียว)

---

## ขั้นตอนที่ 3: การชำระเงิน / การตรวจสอบสลิปหรือสถานะการจ่ายเงิน

### 🎯 เป้าหมาย
ลูกค้าชำระเงินครบถ้วน ร้านตรวจสอบยืนยัน

### 💳 วิธีชำระเงิน และขั้นตอนแอดมินแต่ละวิธี

| วิธีชำระ | ขั้นตอนลูกค้า | ขั้นตอนแอดมิน (Manual) | ระบบออโต้ (Auto) |
|----------|--------------|------------------------|------------------|
| **PromptPay QR** | สแกน QR โอน → กรอกเลขอ้างอิง (TXN ID) → ส่ง | 1. เปิด **แผงตรวจสลิป** (SlipReviewPanel) <br>2. ดูรูปสลิปจริง <br>3. กด **ยืนยันชำระ** (`confirm_offline_payment`) | - ลูกค้าส่ง TXN ID → `submitOfflinePaymentReference` (pending → processing) <br>- แอดมินกดยืนยัน → RPC `confirm_offline_payment` → `payment_status = paid` <br>- `triggerEvent('payment_confirmed')` |
| **เงินสดปลายทาง (COD)** | ไม่ต้องจ่ายล่วงหน้า | 1. ส่งออเดอร์จนถึง `delivered` <br>2. กลับมา `/admin/orders` หรือ `/admin/payment-exceptions` <br>3. กด **ยืนยันชำระ** (`confirm_offline_payment`) | - ต้องมีสถานะออเดอร์ = `delivered` ถึงจะยืนยันได้ (กاردฝั่งเซิร์ฟเวอร์) <br>- `triggerEvent('payment_confirmed')` |
| **บัตรเครดิต (Omise/Stripe)** | ใส่เลขบัตร → 3D Secure → สำเร็จ | ❌ ไม่ต้องแทรกแซง (ระบบจัดการครบเอง) | - `createCheckout` เรียก Edge Function `omise-checkout` (หรือ Stripe fallback) <br>- Webhook `omise-webhook` / `stripe-webhook` → `record_payment_result` → `payment_status = paid` <br>- `triggerEvent('payment_confirmed')` |

### 📋 หน้าจอที่เกี่ยวข้อง
- **`/admin/orders`** — แท็บหลัก: ดูสถานะชำระ (`payment_status`), วิธีชำระ (`payment_method`), สลิป (SlipThumb)
  - **ประตูตรวจสลิป (Slip Gate)**: ป๊อปอัปแสดงเมื่อแอดมินกดยืนยันออเดอร์ที่มี `payment_status = pending` และมีสลิปอัปโหลดแล้ว → บังคับดูรูป → กดยืนยันชำระ → จึงยืนยันออเดอร์ได้
- **`/admin/payment-exceptions`** — **อ่านอย่างเดียว (Read-only)**: แสดงรายการที่มีปัญหาชำระเงิน
  - หมวดหมู่: `WEBHOOK_MISMATCH`, `MISSING_INTENT`, `STALE_UNPAID` (ค้าง >24ชม.), `PENDING_UNPAID`, `PROCESSING`, `INTENT_FAILED`, `PARTIAL_REFUND`, `REFUNDED`, `OK_COD_AWAITED`, `OK_VOID`, `OK_PAID`
  - **ไม่มีปุ่ม mark paid** — แอดมินต้องไป `/admin/orders` ทำจริง

### ⚠ กรณีผิดพลาดบ่อยและวิธีแก้
| ปัญหา | สาเหตุ | วิธีแก้ |
|--------|--------|--------|
| **"โหลดข้อมูลการชำระเงิน/สลิปไม่สำเร็จ"** (แบนเนอร์แดงบน `/admin/orders`) | RPC `get_payment_intents_for_orders` อ่านไม่ได้ (RLS/Permission) | รอทีมเทคนิคตรวจ RPC / Supabase policies — **ควรตรวจสอบเพิ่มเติมกับหน้าเว็บจริง** |
| กดยืนยันชำระ (COD) แล้ว error `ERR_COD_NOT_DELIVERED` | ออเดอร์ยังไม่ได้สถานะ `delivered` | ต้องส่งออเดอร์ให้ถึง `delivered` ก่อน (ผ่าน `/admin/delivery`) |
| Webhook mismatch (Omise/Stripe) | การชำระเงินสำเร็จฝั่งผู้ให้บริการ แต่ webhook ไม่ได้บันทึกใน DB | ดูที่ `/admin/payment-exceptions` หมวด `WEBHOOK_MISMATCH` → ติดต่อทีมเทคนิคตรวจ log webhook |

---

## ขั้นตอนที่ 4: การจัดเตรียม / การจัดส่ง / การแจ้งสถานะลูกค้า

### 🎯 เป้าหมาย
ร้านทำอาหาร เรียกไรเดอร์/ส่งมอบเอง แจ้งสถานะให้ลูกค้ารับรู้

### 🍳 สายครัว (Kitchen) — `/admin/kitchen`

| การกระทำแอดมิน | ปุ่ม/เมนู | ระบบออโต้ที่ทำงานพร้อมกัน |
|--------------|----------|------------------------|
| **สร้าง Production Batch** | เลือกรอบจัดส่ง → กด **🔥 สร้าง Batch** | รวบรวมออเดอร์ `confirmed`/`preparing` ของรอบนั้น → สร้าง `production_batch` → นำทางไป `/admin/delivery` อัตโนมัติ |
| **เริ่มทำอาหาร** | กด **🔥 เริ่มทำ** (สถานะ `confirmed` → `preparing`) | 1. ตรวจ `order_ready_to_make` (RPC gate) <br>2. `updateOrderStatus` → `preparing` <br>3. **หักสต็อกวัตถุดิบ** (`deductInventoryForOrder` — รวม SAME_DAY + PRE_ORDER) <br>4. `triggerEvent('order_preparing')` |
| **พร้อมส่ง/พร้อมรับ** | กด **✅ พร้อมส่ง** (หรือ **✅ พร้อมรับที่ร้าน** ถ้าเป็น pickup) | 1. ตรวจ gate พร้อม <br>2. `updateOrderStatus` → `ready_for_dispatch` <br>3. `triggerEvent('order_ready_for_dispatch')` <br>4. **นำทางไป `/admin/delivery?focus=ORDERNO` อัตโนมัติ** |
| **พิมพ์ใบสั่งครัว / สติกเกอร์** | กด **🍜 พิมพ์ใบสั่งครัว** / **🏷️ พิมพ์สติกเกอร์** | ใช้ `printService` + `stickerQueue` (Bluetooth) — ต้องเปิดสวิตช์ใน Settings → เครื่องพิมพ์ |

> ⚠ **จุดสังเกต**: หากกดเริ่มทำ/พร้อมส่งแล้ว error → ดูเหตุผลในแบนเนอร์ (เช่น "ครัวยังเริ่มทำไม่ได้: สต็อกไม่พอ" หรือ "Web Bluetooth ไม่รองรับ" สำหรับสติกเกอร์)

### 🛵 สายจัดส่ง (Dispatch) — `/admin/delivery`

| การกระทำแอดมิน | ปุ่ม/เมนู | ระบบออโต้ที่ทำงานพร้อมกัน |
|--------------|----------|------------------------|
| **มอบหมายไรเดอร์** | เลือกไรเดอร์จากรายการ → กด **มอบหมาย** | RPC `assignDriver` (deterministic, audit log) → สร้าง `dispatch_offers` สถานะ `offered` |
| **ไรเดอร์รับงาน** | ไรเดอร์กดรับบนแอป → สถานะ `claimed` | ระบบอัปเดต `dispatch_offers` เอง (polling) |
| **ไรเดอร์รับของ/ออกส่ง** | ไรเดอร์กด "รับของแล้ว" → `picked_up` → `in_transit` | สถานะออเดอร์เดินตาม: `ready_for_dispatch` → `dispatched` → `in_transit` → `arrived` → `delivered` |
| **ยืนยันส่งถึง (POD)** | ไรเดอร์/แอดมินกด "ส่งถึงแล้ว" | `updateOrderStatus` → `delivered` → `triggerEvent('order_delivered')` |

> **หมายเหตุ**: ระบบไรเดอร์ภายนอก (Grab / Lineman / Foodpanda) **ยังค้าง FROZEN ไม่ได้ใช้งาน** — ต้องใช้ไรเดอร์ตัวเองเท่านั้น

### 🔔 การแจ้งสถานะให้ลูกค้า (Notification)
- ทุกครั้งที่แอดมินกดปุ่มเปลี่ยนสถานะ (ยืนยันออเดอร์, เริ่มทำ, พร้อมส่ง, มอบหมายไรเดอร์, ส่งถึง) → ระบบ `triggerEvent` ยิง event ให้ลูกค้า:
  - `order_confirmed`, `order_preparing`, `order_ready_for_dispatch`, `order_dispatched`, `order_delivered`
- ลูกค้าเห็นในศูนย์แจ้งเตือน (NotificationCenterPage) + browser notification (ถ้าเปิดอนุญาต)

---

## ขั้นตอนที่ 5: การปิดการขาย / หลังการขาย / การเก็บข้อมูลหรือรีวิว

### 🎯 เป้าหมาย
ปิดออเดอร์ เก็บข้อมูลเรียนรู้ ดูแลลูกค้าซ้ำ

### 📊 รายงานและข้อมูลหลังการขาย

| หน้า/ฟีเจอร์ | เนื้อหา | ระบบออโต้ |
|-------------|---------|----------|
| **`/admin/reports`** (AdminReports) | รายงานรายวัน: ยอดขาย, จำนวนออเดอร์, AOI, ลูกค้าใหม่/เก่า, Top products, สรุปตามรอบ, สต็อกต่ำ, AI insights | ระบบคำนวณจาก `order_items` + `orders` จริง — ไม่มีข้อมูลปลอม |
| **`/admin/reviews`** (AdminReviews) | รีวิวที่ verified (มาจากออเดอร์จริง) — มีคิวอนุมัติ: `pending` / `approved` / `rejected` | ลูกค้าส่งรีวิว → เข้าคิว `pending` → แอดมินกด approve → ขึ้นบนหน้าร้าน |
| **`/admin/notifications`** | ล็อกการแจ้งเตือนทั้งระบบ (in-app) — ค้นหาได้ด้วย id/type/title | `triggerEvent` ทุก event บันทึกลงตาราง `notifications` อัตโนมัติ |
| **`/admin/payment-exceptions`** | ติดตาม payment ที่ยังค้างปัญหา (read-only) | จำแนกอัตโนมัติทุกครั้งที่โหลดหน้า |

### 🤖 ออโต้เมชั่นหลังการขาย (Post-sale Automation)
| ระบบ | Trigger | ผลลัพธ์ |
|------|---------|---------|
| **แจ้งเตือนสต็อกต่ำ** | วัตถุดิบต่ำกว่า `min_stock` | `triggerEvent('low_stock_alert')` → แจ้งแอดมินในแอป |
| **รางวัลแนะนำเพื่อน (Referral)** | เพื่อนสั่งซื้อครบรอบแรก | `triggerEvent('referral_awarded')` → แต้มเข้า wallet อัตโนมัติ |
| **สะสมแต้มความภักดี** | ออเดอร์สถานะ `delivered` + ชำระครบ | `triggerEvent('loyalty_points_earned')` |
| **โพสต์การตลาด排程** | แอดมินตั้งเวลาเผยแพร่ใน `/admin/marketing` | `marketing_schedule_post` RPC (GH cron ทุกชั่วโมง) → เผยแพร่อัตโนมัติ |

### 🗂 การยกเลิกออเดอร์ (Cancel Order) — กรณีพิเศษ
- **แอดมินกด ✖ Cancel** บน `/admin/orders` (สถานะไหนก็ได้ ยกเว้น `delivered`/`cancelled`/`failed`)
- ระบบเรียก RPC `cancel_order` (Atomic): 
  1. เปลี่ยนสถานะ → `cancelled`
  2. **ปล่อย capacity รอบจัดส่ง** (ถ้าเป็น PRE_ORDER)
  3. **คืนสต็อกวัตถุดิบ** (ถ้าหักไปแล้ว)
  4. บันทึก audit log
- **ลูกค้ายกเลיקเอง**: ไม่มีในระบบปัจจุบัน — ต้องติดต่อแอดมิน

---

## หน้าจอ/เมนูที่แอดมินใช้บ่อย และหน้าที่ปุ่ม/สถานะแต่ละอย่าง

### 1. `/admin/dashboard` — แดชบอร์ดภาพรวม
| โซน | เนื้อหา | การกระทำ |
|------|---------|-----------|
| **KPI Cards** | ออเดอร์วันนี้, ยอดวันนี้, %สำเร็จ, ลูกค้าทั้งหมด | ดูอย่างเดียว (reload on focus) |
| **ต้องดำเนินการ** | ⏳ ออเดอร์ `pending` วันนี้, 🥬 สต็อกต่ำ/หมด | กดลิงก์เข้า Orders / Inventory |
| **ควบคุมร้าน (AdminControl)** | สวิตช์เปิด/ปิดร้าน, โหมด SAME_DAY/PRE_ORDER | Toggle สถานะร้าน |
| **Quick Actions** | 9 ปุ่มลัด: Orders, Kitchen, Pre-Orders, Products, Inventory, Promotions, Customers, Delivery, Settings | คลิกเพื่อนำทาง |

### 2. `/admin/orders` — จัดการออเดอร์ (หน้าสำคัญที่สุด)
| ส่วน | ปุ่ม/สถานะ | หน้าที่ |
|------|-----------|--------|
| **ตัวกรอง** | สถานะ (All/Pending/Confirmed/...), โหมด (All/SAME_DAY/PRE_ORDER), ช่วงเวลา (วันนี้/เดือนที่แล้ว) | กรองรายการ |
| **แผงตรวจสลิป (SlipReviewPanel)** | ดูรูปสลิป, กด **ยืนยันชำระ**, **ปฏิเสธ** | จุดเดียวที่จัดการสลิป PromptPay/COD |
| **ประตูตรวจสลิป (Slip Gate)** | ป๊อปอัป: ดูสลิป → **ยืนยันสลิป & รับออเดอร์** / **ไว้ก่อน** | บังคับก่อนยืนยันออเดอร์ที่มีสลิปค้าง |
| **การ์ดออเดอร์แต่ละใบ** | **✅ ยืนยันออเดอร์** (pending→confirmed), **🍳 ไป Kitchen**, **🛵 ไป Dispatch** / **🛍️ ไป POS** (pickup), **🧾 พิมพ์ใบเสร็จ**, **🍜 พิมพ์ใบสั่งครัว**, **✖ Cancel**, **🕘 History/Audit**, **💸 Refund (Stripe)**, **📞 Call** | จัดการออเดอร์ครบวงจร |
| **แบนเนอร์ error** | "โหลดข้อมูลการชำระเงิน/สลิปไม่สำเร็จ..." | แจ้งปัญหา RPC read payment_intents |

### 3. `/admin/kitchen` — ครัว / ผลิต
| ส่วน | ปุ่ม/สถานะ | หน้าที่ |
|------|-----------|--------|
| **สรุป** | 📦 ออเดอรรอทำ, ✅ พร้อมส่ง, 🔄 Batch ทั้งหมด | ดูภาพรวม |
| **สร้าง Batch** | เลือกรอบ → **🔥 สร้าง Batch** | รวบรวมออเดอร์ของรอบ → นำทางไป Delivery |
| **คิวครัว** | 🔥 เริ่มทำ (confirmed→preparing), ✅ พร้อมส่ง/พร้อมรับ (preparing→ready_for_dispatch) | ควบคุมสายผลิต |
| **ตาราง Batch** | Batch ID, สถานะ, รายการทั้งหมด, พร้อมส่ง, รอดำเนินการ, สร้างเมื่อ | ติดตามแบทช์ |

### 4. `/admin/delivery` — จัดส่ง / Dispatch Center
| ส่วน | ปุ่ม/สถานะ | หน้าที่ |
|------|-----------|--------|
| **คิวจัดส่ง** | ออเดอร์สถานะ confirmed/dispatched/in_transit/arrived/delivered | มองภาพรวม |
| **มอบหมายไรเดอร์** | เลือกไรเดอร์ → กดมอบหมาย | เรียก `assignDriver` RPC |
| **สถานะประกาศ (dispatch_offers)** | offered/claimed/declined/cancelled | ดูว่าไรเดอร์รับงานหรือยัง |
| **Live Map** | ตำแหน่งไรเดอร์ real-time (ถ้าเปิด location sharing) | ติดตามระหว่างทาง |
| **ลงทะเบียนไรเดอร์** | สร้าง driver + ผูกบัญชี login + เลือกพาหนะ | จัดการทีมส่ง |

### 5. `/admin/payment-exceptions` — ตรวจสอบการชำระเงิน (Read-only)
| หมวดหมู่ (Section) | ความหมาย | สีแบดจ์ |
|-------------------|-----------|---------|
| ⚠ Webhook mismatch | Webhook Omise/Stripe ไม่ตรงกับ DB | warning |
| ⚠ ไม่พบ payment intent | ไม่มีแถว payment_intents สำหรับออเดอร์นี้ | warning |
| ⚠ ค้างชำระเกิน 24 ชม. | pending > 24h | warning |
| ⏳ Pending (รอชำระ) | รอลูกค้าชำระ / ส่งสลิป | info |
| 🔄 Processing | ลูกค้าส่ง TXN ID แล้ว รอแอดมินยืนยัน | info |
| ❌ Payment failed | ชำระล้มเหลว (card declined, expired) | danger |
| ↩️ Partial Refund | คืนบางส่วน | primary |
| ↩️ Refund | คืนเต็มจำนวน | primary |
| 💵 COD (รอเก็บตอนส่ง) | ปกติ — ต้องส่งถึงแล้วค่อยยืนยัน | success |
| 🚫 Void (ยกเลิก ไม่เก็บเงิน) | ออเดอร์ cancelled | secondary |
| ✅ Paid (อ้างอิง) | ชำระแล้ว — โชว์เพื่อตรวจสอบ | success |

> **สำคัญ**: หน้านี้ **อ่านอย่างเดียว** — ห้ามกด mark paid เอง ต้องไป `/admin/orders` ทำจริง

### 6. `/admin/notifications` — ล็อกการแจ้งเตือน
- ตาราง: id, recipient (customer_id opaque), event/type, channel, status (read/unread), created_at
- ค้นหาได้, 分页ได้ — ใช้สืบสวนว่าลูกค้าได้รับแจ้งเตือนหรือไม่

### 7. `/admin/settings` และหน้าตั้งค่าอื่นๆ
| หน้า | เนื้อหาสำคัญ |
|------|-------------|
| **Settings → เครื่องพิมพ์** | สวิตช์ `autoPrintKitchen`, `autoPrintStickers`, `autoPrintReceipt`, ตั้งค่า offset Y, face height, density สติกเกอร์ |
| **Settings → Business Hours** | เวลาเปิด/ปิด, เขตเวลา, วันหยุด — ใช้คำนวณ `storeStatus` |
| **Settings → Delivery Policy** | รัศมีส่ง, ค่าส่ง, ยอดขั้นต่ำ |
| **Inventory** | วัตถุดิบ, สต็อก, จุดสั่งซื้อ, Supplier, PO |
| **Promotions** | สร้าง/แก้ไขโปรโมชั่น (fixed/percentage/free shipping/spend threshold/BOGO/combo/loyalty/referral/birthday/flash sale) |
| **Marketing** | Content Planner, โพสต์, กติกาเผยแพร่, best-seller จริงจาก order_items |

---

## กรณีเคสพิเศษ และจุดที่แอดมินมักทำพลาด

| กรณี | อาการ/ปัญหา | สาเหตุ | วิธีแก้ / ป้องกัน |
|------|-------------|--------|------------------|
| **ออเดอร์ค้าง `pending` นาน** | เห็นออเดอร์ใน Orders แต่ไม่มีใครกดยืนยัน | แอดมินลืม/ไม่ได้ดูหน้า `pending` | **เช็ค `/admin/orders` กรอง `pending` ทุกเช้า** (Daily Routine) |
| **ยอดเงินไม่ตรง / สลิปไม่แสดง** | แผงตรวจสลิปโชว์แต่ไม่มีรูป / แบนเนอร์แดง error | RPC `get_payment_intents_for_orders` อ่านล้ม (RLS) | แจ้งทีมเทคนิค — **ควรตรวจสอบเพิ่มเติมกับหน้าเว็บจริง** |
| **ลูกค้าบอกจ่ายแล้วแต่ระบบยัง `pending`** | PromptPay: ลูกค้าส่ง TXN ID แล้ว / COD: ส่งถึงแล้ว | แอดมินยังไม่กดยืนยันชำระ | เข้า SlipReviewPanel / Payment Exceptions → กด **ยืนยันชำระ** |
| **กดยืนยัน COD แล้ว error** | `ERR_COD_NOT_DELIVERED` | ออเดอร์ยังไม่ `delivered` | ต้องส่งออเดอร์ให้ถึง `delivered` ก่อน (ผ่าน Delivery) |
| **พิมพ์ใบสั่งครัว/สติกเกอร์ไม่ทิ้ง** | กดปริ้นแล้วไม่มีกระดาษออก | 1) สวิตช์ Auto-Print ปิด 2) Bluetooth ไม่รองรับ (สติกเกอร์) 3) เครื่องพิมพ์ออฟไลน์ | 1) Settings → เปิดสวิตช์ 2) ใช้ Chrome/Edge (HTTPS) 3) ตรวจสาย/กระดาษ |
| **Pre-order ไม่เข้าคิวครัว** | ออเดอร์ PRE_ORDER อยู่ใน Orders แต่ไม่ขึ้นใน Kitchen | 1) Round ไม่ active 2) Cutoff ผ่านแล้ว 3) สถานะไม่อยู่ใน [confirmed, preparing, ready_for_dispatch] | ตรวจรอบส่งใน Kitchen → สร้าง Batch ใหม่ถ้าจำเป็น |
| **Webhook mismatch** | Payment Exceptions โชว์ `WEBHOOK_MISMATCH` | Omise/Stripe webhook ไม่ได้บันทึกผลชำระใน DB | ติดต่อทีมเทคนิคตรวจ log Edge Function `omise-webhook` / `stripe-webhook` |
| **Marketing post ตั้งเวลาแล้วไม่ขึ้น** | กด Schedule แล้วแต่ไม่เผยแพร่ | GH cron ข้ามรอบ / `marketing_publish_due` ไม่ได้รัน | กด Refresh บน `/admin/marketing` (มีการ `promote scheduled` ตอนโหลดหน้า) |

---

## เช็คลิสต์สรุปการทำงานประจำวันของแอดมิน (Daily Routine)

> **ทำทุกเช้าก่อนเปิดร้าน** (ประมาณ 15-20 นาที)

### ✅ 1. เช็ค KPIs (แดชบอร์ด `/admin/dashboard`)
- [ ] ออเดอร์วันนี้: `{todayOrders}` ราย
- [ ] ยอดวันนี้: `{todayRevenue}` บาท
- [ ] อัตราการสำเร็จ: `{completionRate}%`
- [ ] ลูกค้าทั้งหมด: `{totalCustomers}` ราย

### ✅ 2. เช็คออเดอร์รอดำเนินการ (`/admin/orders` → กรอง `pending`)
- [ ] ยืนยันออเดอร์ที่ยัง `pending` (กด **✅ ยืนยันออเดอร์**)
- [ ] ตรวจสอบ **ประตูตรวจสลิป** (Slip Gate) — หากมีออเดอร์ที่ `payment_status = pending` และมีสลิปแล้ว ให้ดูรูป → กด **ยืนยันสลิป & รับออเดอร์**
- [ ] หากมีออเดอร์ `pending` เกิน 30 นาที → โทรลูกค้ายืนยัน / ตัดสินใจ cancel

### ✅ 3. เช็คคิวครัว (`/admin/kitchen` → ตั้งวันที่วันนี้)
- [ ] ดู **ออเดอรรอทำ** (`pending_orders`) — ต้องมีคนทำ
- [ ] ดู **พร้อมส่ง** (`ready_orders`) — ต้องมีคนจัดส่ง
- [ ] หากมีออเดอร์เยอะในรอบเดียวกัน → กด **🔥 สร้าง Batch** → จะเด้งไปหน้าจัดส่งอัตโนมัติ
- [ ] ตรวจสอบว่าสวิตช์ Auto-Print Kitchen/Sticker เปิดอยู่ (Settings → เครื่องพิมพ์)

### ✅ 4. เช็คสต็อกวัตถุดิบ (`/admin/inventory`)
- [ ] ดูรายการสถานะ `low_stock` / `out_of_stock` / `critical`
- [ ] สั่งซื้อวัตถุดิบที่ขาด (สร้าง PO ในหน้า Inventory)

### ✅ 5. เช็คการชำระเงิน (`/admin/payment-exceptions`)
- [ ] ดูจำนวน **ต้องเฝ้าดู** (attention count) — ควรเป็น 0
- [ ] หากมี `WEBHOOK_MISMATCH` หรือ `MISSING_INTENT` → แจ้งทีมเทคนิคทันที
- [ ] ตรวจ `STALE_UNPAID` (>24ชม.) → ติดต่อลูกค้า / cancel order

### ✅ 6. เช็คการแจ้งเตือน (`/admin/notifications`)
- [ ] ดูว่ามี notification ไหน `unread` ที่ต้องดำเนินการ (เช่น low stock alert)
- [ ] กด **Mark All Read** หากเสร็จสิ้น

### ✅ 7. เผยแพรโปรโมชั่น/โพสต์ที่ถึงเวลา (`/admin/marketing` หรือ `/admin/promotions`)
- [ ] ดูโพสต์สถานะ `scheduled` ที่ถึงเวลาแล้ว → ควรเป็น `published` แล้ว (ระบบ promote ตอนโหลดหน้า)
- [ ] หากยังไม่ขึ้น → กด Refresh หน้า marketing

---

## จุดเชื่อมต่อกับระบบภายนอก

| ระบบภายนอก | จุดเชื่อมต่อในโค้ด | หน้าที่ | สถานะ |
|------------|-------------------|--------|--------|
| **Omise (Payment Gateway)** | `src/lib/omise.ts`, `src/lib/paymentGateway.ts` — Edge Functions: `omise-checkout`, `omise-webhook`, `omise-refund` | ชำระเงินบัตรเครดิต/เดบิต (3D Secure) | ✅ ใช้งานจริง (cutover จาก Stripe) |
| **Stripe (Legacy Fallback)** | `src/lib/paymentGateway.ts` — Edge Function: `create-checkout`, `stripe-webhook` | Fallback กรณี Omise ยังไม่พร้อม | ⚠️ Fallback only |
| **LINE Notify** | `src/lib/billingApi.ts` (comment), `src/pages/admin/AdminBilling.tsx` | แจ้งเตือนงวดบริการตัดงวดร้านพาร์ทเนอร์ | 🔧 ต้องตั้ง secret + automation job รอบถัดไป (บันทึกใน changelog) |
| **Web Bluetooth (Niimbot Printer)** | `src/lib/niimbotBt.ts`, `src/lib/stickerQueue.ts` | พิมพ์สติกเกอร์ Bluetooth 1 ดวง/ชิ้น | ✅ ต้องใช้ Chrome/Edge (HTTPS) |
| **Grab / Lineman / Foodpanda (Rider Providers)** | `src/lib/deliveryRouter.ts`, `src/lib/driverService.ts` — `type DeliveryMethod` | รองรับไรเดอร์ภายนอก | ❌ **FROZEN** — ยังไม่ได้ใช้งาน |
| **GitHub Actions / Cron** | `src/lib/adminMarketing.ts` — `marketing_publish_due`, `marketing_schedule_post` | เผยแพร่โพสต์การตลาดตาม排程 | ✅ GH cron ทุกชั่วโมง (แต่เคยข้ามรอบ → มี promote ตอนโหลดหน้า) |
| **Supabase Edge Functions** | หลายจุด: `create-checkout`, `omise-checkout`, `omise-webhook`, `stripe-webhook`, `record_payment_result`, `marketing_schedule_post`, `marketing_publish_due`, `cancel_order`, `confirm_offline_payment`, `assignDriver`, `deduct_inventory_for_order`, `create_payment_intent_record`, `submit_offline_payment_reference`, `submit_payment_slip`, `create_notification`, `marketing_save_rules`, `set_menu_schedule`, `publish_menu_schedule`, `admin_list_jobs`, `admin_delete_job` | Backend logic ทั้งหมดรันบน Supabase | ✅ ใช้งานจริง |
| **Google Maps / Geocoding** | `src/lib/googleMaps.ts`, `src/lib/deliveryRouter.ts` | คำนวณระยะทาง, เขตส่ง, reverse geocode | ✅ ใช้งานจริง |

---

## สรุปโครงสร้างโฟลเดอร์และไฟล์สำคัญ (Reference)

```
src/
├── lib/
│   ├── orderStateMachine.ts          # State machine สถานะออเดอร์
│   ├── paymentGateway.ts             # Payment intents, slip, confirm/refund
│   ├── paymentExceptions.ts          # จำแนก payment exception
│   ├── notificationService.ts        # สร้าง/อ่าน notification
│   ├── kitchenService.ts             # หักสต็อกวัตถุดิบ (unified)
│   ├── bmbAdminApi_orders.ts         # RPC ออเดอร์ (accept, cancel, confirm payment, etc.)
│   ├── bmbAdminApi_kitchen.ts        # Kitchen summary, batch, ready-to-make gate
│   ├── bmbAdminApi_rounds.ts         # Delivery rounds, menu schedule
│   ├── bmbAdminApi_products.ts       # Product CRUD, schedule
│   ├── bmbAdminApi_promotions.ts     # Promotion CRUD
│   ├── bmbAdminApi_settings.ts       # Business settings
│   ├── adminMarketing.ts             # Marketing posts, schedule, rules
│   ├── adminJobsApi.ts               # Job queue view (automation_queue)
│   ├── billingApi.ts                 # Billing subscriptions, LINE Notify
│   ├── deliveryRouter.ts             # Distance, zone checking
│   ├── discountGuardrail.ts          # เพดานส่วนลด 15%
│   ├── addonMarginGuard.ts           # เพดานส่วนลดแอดออน
│   ├── orderSubmitKey.ts             # Double-submit protection
│   ├── printService.ts               # Kitchen ticket, receipt, sticker
│   ├── stickerQueue.ts               # Bluetooth sticker printing
│   ├── auditLog.ts                   # Audit trail
│   └── ... (อื่นๆ)
├── pages/admin/
│   ├── AdminDashboard.tsx            # KPI, Quick actions, AdminControl
│   ├── AdminOrders.tsx               # จัดการออเดอร์ (หลัก)
│   ├── AdminKitchen.tsx              # ครัว, Batch, Inventory deduct
│   ├── DeliveryManagement.tsx        # Dispatch, Driver assign, Live map
│   ├── AdminPaymentExceptions.tsx    # Payment exceptions (read-only)
│   ├── AdminNotifications.tsx        # Notification logs
│   ├── AdminBilling.tsx              # Billing subscriptions
│   ├── AdminMarketing.tsx            # Content planner, posts
│   ├── AdminPromotions.tsx           # Promotions CRUD
│   ├── AdminProducts.tsx             # Products, categories
│   ├── AdminInventory.tsx            # Ingredients, stock, PO
│   ├── AdminSettings.tsx             # Business settings, printers
│   ├── AdminReports.tsx              # Daily reports
│   ├── AdminReviews.tsx              # Verified reviews queue
│   └── ... (อื่นๆ)
├── store/
│   ├── cartStore.ts                  # Cart logic, mode derivation
│   ├── notificationStore.ts          # triggerEvent, templates, bell sort
│   ├── authStore.ts                  # Auth state
│   └── ...
├── components/admin/
│   ├── SlipReviewPanel.tsx           # Slip review + confirm/reject
│   ├── SlipThumb.tsx                 # Slip thumbnail preview
│   ├── AdminLiveMap.tsx              # Rider live map
│   └── ...
└── types/index.ts                    # Type definitions ทั้งหมด
```

---

## หมายเหตุสุดท้าย

> คู่มือนี้ครอบคลุมฟีเจอร์ที่ **มีอยู่จริงในโค้ด** ณ วันที่สร้าง (2026-11-25) หากพบว่าระบบทำงานต่างจากที่เขียนไว้ (เช่น ปุ่มไม่มี, สถานะไม่ตรง, オオโต้ไม่ทำงาน) ให้:
> 1. ตรวจสอบว่าโค้ด Deploy ล่าสุดแล้วหรือยัง
> 2. ดู Console/Network tab บนเบราว์เซอร์เพื่อหา error
> 3. **ควรตรวจสอบเพิ่มเติมกับหน้าเว็บจริง** และแจ้งทีมพัฒนา

**รวมถึงจุดที่เชื่อมต่อกับระบบภายนอกด้วย** (Omise, Stripe, LINE Notify, Web Bluetooth, GitHub Actions, Supabase Edge Functions, Google Maps) — ภาพรวมตั้งแต่ต้นจนปิดการขายสมบูรณ์ที่สุด