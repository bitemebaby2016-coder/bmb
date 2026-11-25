# Admin User Manual — Plan

## Overview
Produce a Thai-language Admin User Manual organized by Customer & Order Journey (Steps 1–5), covering real features from the Bite Me Baby codebase, with automation highlights, admin UI maps, common failure cases, and a daily routine checklist.

## Context
- **Project**: Bite Me Baby — a Thai food-ordering platform (same-day + pre-order), with admin dashboard, kitchen, delivery, payment, and notification systems.
- **Tech Stack**: React + TypeScript + Supabase + Zustand stores + custom RPCs (migrations 001–190+).
- **Goal**: Enable an admin to operate the system confidently from order intake through post-sale, understanding what runs automatically vs. what requires manual intervention.

## Key Files & Folders (Summary)

### Order Journey
- `src/pages/admin/AdminOrders.tsx` — Main order list, accept/confirm/pay/cancel/print actions
- `src/pages/admin/AdminKitchen.tsx` — Kitchen queue, batch creation, status transitions, inventory deduction
- `src/pages/admin/DeliveryManagement.tsx` — Driver assignment, dispatch board, live map
- `src/lib/orderStateMachine.ts` — State machine: SameDay (Created→Accepted→Preparing→Ready→Dispatched→Delivered) vs PreOrder (Booked→Allocated→Batch→Ready→Dispatched→Delivered)
- `src/lib/paymentGateway.ts` — Payment intents (Omise/Stripe/promptpay/COD), slip upload/submit, offline confirmations
- `src/lib/bmbAdminApi_orders.ts` — RPCs: getOrdersPaged, updateOrderStatus, acceptOrder, cancelOrder, confirmOfflinePayment, rejectOfflinePayment
- `src/lib/kitchenService.ts` — deductInventoryForOrder (unified stock for SAME_DAY + PRE_ORDER)
- `src/lib/bmbAdminApi_kitchen.ts` — createBatch, getKitchenSummary, getOrderReadyToMake

### Payment & Exceptions
- `src/lib/paymentExceptions.ts` — classifyPaymentException, groupPaymentExceptions, PAYMENT_EXCEPTION_META
- `src/pages/admin/AdminPaymentExceptions.tsx` — Read-only payment exception view (webhook mismatch, missing intent, stale/pending/failed, partial/refund, COD awaited, void, paid)
- `src/lib/omise.ts` / `src/lib/paymentGateway.ts` — Omise cutover, card checkout, webhook handling

### Notifications & Automation
- `src/lib/notificationService.ts` — createNotification, setNotificationPref, getMyNotifications, markRead
- `src/store/notificationStore.ts` — triggerEvent (order_placed, order_confirmed, order_preparing, order_ready_for_dispatch, order_dispatched, order_delivered, payment_confirmed, payment_pending, low_stock_alert, promotion_expired, referral_awarded, loyalty_points_earned, system_announcement), NOTIFICATION_TEMPLATES
- `src/lib/adminMarketing.ts` — scheduleMarketingPost, listMarketingPosts, marketing rules, bestSellerProducts
- `src/lib/adminJobsApi.ts` — adminListJobs, adminDeleteJob (automation job queue view)
- `src/lib/billingApi.ts` — listBillingSubscriptions, billingStatusBadge, daysUntilDue (LINE Notify installment reminders)

### Structure / Catalog
- `src/lib/bmbAdminApi_rounds.ts` — delivery rounds, menu schedules
- `src/lib/bmbAdminApi_products.ts` — product admin CRUD, category, schedule
- `src/lib/productSchedule.ts` — product schedule map, mode eligibility
- `src/lib/deliveryRouter.ts` — distance checking for delivery zones

### Other Notable
- `src/lib/adminOrderDisplay.ts` — badges: orderModeBadge, paymentStateBadge, deliveryStateBadge, fulfillmentBadge
- `src/store/cartStore.ts` — cart derivation, mode (SAME_DAY/PRE_ORDER), line_key isolation
- `src/lib/contentApproval.ts` — content approval gate for marketing posts

## Manual Structure (by Customer & Order Journey)

### Step 1: ลูกค้าดูสินค้า / เริ่มต้นใช้งาน / ติดต่อสอบถาม
- **Admin-visible effects**: New-order chime (detectNewPendingOrders in AdminOrders load), notification triggers `order_placed`
- **Admin actions**: View new orders in `/admin/orders` (filter `pending`), hear kitchen chime
- **Automation**: `triggerEvent('order_placed')` fires → in-app notification + browser bell

### Step 2: เลือกสินค้า / ตะกร้า / กรอกข้อมูล / ยืนยันคำสั่งซื้อ
- **Key admin page**: `/admin/orders` — see order items, mode badge (SAME_DAY / PRE_ORDER), payment method
- **Automation**: 
  - Cart derives mode automatically (cartStore.deriveCartMode): PRE_ORDER if any calendar item, else SAME_DAY
  - Promotions evaluated via promotionClient, discount guardrails
  - Payment intent created via `createPaymentIntent` (omise/Stripe/promptpay/COD)
- **Manual admin overrides**: 
  - Accept order: `handleAcceptOrder` → `updateOrderStatus(order, 'confirmed')` → triggers `order_confirmed` notification
  - Slip gate: If payment_status='pending' and slip uploaded → show SlipReviewPanel → `confirmOfflinePayment` → then accept

### Step 3: ชำระเงิน / ตรวจสอบสลิปหรือสถานะการจ่ายเงิน
- **Key pages**: `/admin/payment-exceptions` (read-only exception overview), `/admin/orders` (payment badges + slip gate)
- **Payment methods & admin flow**:
  - **PromptPay QR**: Customer submits TXN ID → `submitOfflinePaymentReference` → admin confirms via `confirmOfflinePayment` → order → `paid`
  - **COD**: No prepayment; admin confirms after delivery via `confirmOfflinePayment` (requires order = delivered)
  - **Credit Card**: Omise/Stripe checkout → webhook `record_payment_result` → `payment_confirmed` → order → `paid`
- **Common mistakes**: 
  - Order stuck `pending` with payment pending → check slip gate (SlipReviewPanel)
  - Payment intents read error → "โหลดข้อมูลการชำระเงิน/สลิปไม่สำเร็จ" banner (R3 D-08)
  - COD confirm blocked → order must be `delivered` first (paymentGateway: `confirm_offline_payment requires order = delivered`)

### Step 4: จัดเตรียม / จัดส่ง / แจ้งสถานะลูกค้า
- **Kitchen**: `/admin/kitchen` — create batch, start cooking (`kitchenAct → 'preparing'`), deduct inventory, transition to `ready_for_dispatch`
- **Dispatch**: `/admin/delivery` — assign driver (`assignDriver`), track POD, advance status via `updateOrderStatus`
- **Automation points**:
  - `kitchenAct → 'preparing'` → `deductInventoryForOrder` (unified stock deduct) → `triggerEvent('order_preparing')`
  - `kitchenAct → 'ready_for_dispatch'` → `triggerEvent('order_ready_for_dispatch')` → navigate to `/admin/delivery?focus=ORDERNO`
  - Driver assignment → `assignDriver` RPC → dispatch_offers status tracked
  - Delivery completion → status chain: `ready_for_dispatch` → `dispatched` → `arrived` → `delivered`
- **Manual overrides**: 
  - Cancel order: `handleCancelOrder` → `cancelOrder` RPC (atomic: capacity release + inventory restore + audit)
  - Failed delivery: `target === 'Failed' && current === 'Dispatched'` → `Failed` state

### Step 5: ปิดการขาย / หลังการขาย / การเก็บข้อมูลหรือรีวิว
- **Admin pages**: 
  - `/admin/reports` (AdminReports.tsx — daily revenue, top products, round summary, low stock)
  - `/admin/reviews` (AdminReviews.tsx — verified customer reviews, reply)
  - `/admin/payment-exceptions` — monitor lingering exceptions
  - `/admin/notifications` — notification log
- **Automation**: 
  - Low stock alerts → `low_stock_alert` notification type
  - Referral awards → `referral_awarded` notification
  - Loyalty points → `loyalty_points_earned` notification
  - Marketing posts scheduled via `scheduleMarketingPost` → `marketing_schedule_post` RPC
- **Daily routine checklist** (see below)

## Admin UI Maps & Frequent Menus

| Menu Page | Primary Buttons / Status | Key Observations |
|-----------|-------------------------|------------------|
| `/admin/orders` | ✅ ยืนยันออเดอร์ (pending→confirmed), ❌ Cancel, 📋 Print receipt/ticket, 💸 Refund (Stripe), 🕘 History/Audit, 🧾 Slip gate (if pending pay) | Filter by status/mode/scope; paymentReadError banner if RPC fails |
| `/admin/kitchen` | ➕ สร้าง Batch, 🔥 เริ่มทำ, ✅ พร้อมรับ/พร้อมส่ง, 📦 พิมพ์สติกเกอร์, 📊 สรุปสต็อก | Batch creation → navigate to delivery; inventory deduct on `preparing` transition |
| `/admin/delivery` | 🛵 ไป Dispatch, 📋 มอบหมายไรเดอร์, 📍 Live Map, 🛠️ ลงทะเบียนไรเดอร์ | Assign driver via `assignDriver`; external riders (Grab/Lineman/Foodpanda) FROZEN |
| `/admin/payment-exceptions` | 📊 ยอดรวมที่ต้องเฝ้าดู, แท็บ Webhook mismatch, Missing intent, Stale unpaid, Pending, etc. | Read-only — never mark paid manually; actions redirect to confirm/stripe-refund |
| `/admin/notifications` | 🔔 Refresh, 🔍 Search id/type/title, Pagination | View in-app notification logs; recipient shown as opaque customer_id |
| `/admin/dashboard` | KPI cards (today orders/revenue/completion/total), Quick links to orders/kitchen/products/inventory/promotions/customers/delivery/settings | Reload on focus; shows `pendingOrders`, `lowStockItems` as "ต้องดำเนินการ" |

## Common Failure Cases & Fixes

| Issue | Root Cause | Fix / Admin Action |
|-------|-----------|-------------------|
| ออเดอร์ค้างสถานะ `pending` | Admin ยังไม่กดยืนยัน (acceptOrder) | เข้า `/admin/orders` → กด ✅ ยืนยันออเดอร์ |
| ยอดชำระไม่ตรง / สลิปไม่แสดง | Payment intents RPC error (R3 D-08) | ตรวจสอบแผง Payment Exceptions → หาก error "โหลดข้อมูลการชำระเงิน/สลิปไม่สำเร็จ" → รอคำสั่งแก้ RPC |
| ลูกค้ายกเลิกออเดอร์ | costumer เองหรือ admin ใช้ Cancel | Admin: กด ✖ Cancel → ยืนยันเหตุผล → `cancelOrder` รีสต็อกอัตโนมัติ |
| ระบบออโต้ไม่ทำงาน (print ไม่ทิ้ง, notification ไม่ขึ้น) | สวิตช์ปิด (autoPrintKitchen/autoPrintStickers), Web Bluetooth ไม่รองรับ, RPC error | ตั้งค่าที่ Settings → เครื่องพิมพ์ → เปิดสวิตช์; ใช้ Chrome/Edge สำหรับสติกเกอร์ Bluetooth |
| ออเดอร์ Pre-order ไม่เข้าครัว | Round not active, cutoff passed, or order status not in [confirmed, preparing, ready_for_dispatch] | ตรวจสอบรอบส่งที่ AdminKitchen → ถ้าต้องให้เข้าคราว ให้สร้าง Batch ใหม่ |
| สลิปโอนเงินขึ้นไม่ได้ | สลิปอัปโหลดไม่ครบ/ไม่ถูกต้อง → ต้อง `submit_payment_slip` ก่อน `confirm_offline_payment` | เข้า SlipReviewPanel → ดูรูป → ยืนยัน → `confirmOfflinePayment` |

## Daily Routine Checklist (แอดมินประจำวัน)

1. **เช็ค KPIs** (แดชบอร์ด `/admin/dashboard`)
   - ออเดอร์วันนี้: `{todayOrders}` ราย
   - ยอดวันนี้: `{todayRevenue}` บาท
   - อัตราการสำเร็จ: `{completionRate}%`
   - ลูกค้าทั้งหมด: `{totalCustomers}` ราย

2. **เช็คออเดอร์รอดำเนินการ**
   - เข้าหน้า `/admin/orders` → ตั้งค่าสถานะ `pending`
   - ยืนยันออเดอร์ที่ยังไม่ได้รับการยืนยัน (✅ ยืนยันออเดอร์)
   - ตรวจสอบประตูตรวจสลิป หากมี `payment_status = pending` และอัปโหลดสลิปแล้ว

3. **เช็คคิวครัว**
   - เข้า `/admin/kitchen` → ตั้งวันที่
   - ตรวจสอบออเดอร์รอทำ (`pending_orders`) และพร้อมส่ง (`ready_orders`)
   - หากจำเป็น → สร้าง Batch ใหม่ → เด้งไปหน้าจัดส่ง

4. **เช็คสต็อกวัตถุดิบ**
   - เข้าหน้า `/admin/inventory` → ตรวจสอบรายการ `low_stock` / `out_of_stock`
   - สั่งซื้อวัตถุดิบใหม่หากจำเป็น

5. **เช็คการชำระเงิน**
   - เข้าหน้า `/admin/payment-exceptions` → ตรวจสอบว่ามี exception ใหม่หรือไม่
   - หากมี `WEBHOOK_MISMATCH` หรือ `MISSING_INTENT` → ติดตามและแจ้งทีมเทคนิค

6. **เช็คการแจ้งเตือน**
   - เข้าหน้า `/admin/notifications` → ตรวจสอบ notification ที่ยังไม่ได้อ่าน
   - กด Mark All Read หากเสร็จสิ้นแล้ว

7. **เผยแพรโปรโมชั่น (ถ้ามี)**
   - ตรวจสอบหน้า `/admin/promotions` → ตั้งเวลาเผยแพร่ หากถึงเวลา then กด Publish

## External System Connections (Note)
- **LINE Notify**: สำหรับแจ้งงวดบริการตัดงวด (ดูที่ AdminBilling — ต้องตั้ง secret + automation job รอบถัดไป)
- **Omise/Stripe**: ชำระเงินบัตรอัตโนมัติผ่าน Edge Functions (createCheckout, omise-webhook, stripe-webhook) — admin ไม่ต้องสัมผัสการชำระเงินโดยตรง
- **Web Bluetooth**: สติกเกอร์ Bluetooth ต้องใช้ Chrome/Edge รองรับ niimbot printer
- **Driver providers**: Grab / Lineman / Foodpanda — ยังค้าง FROZEN ไม่ได้ใช้งานในระบบปัจจุบัน
- **Background jobs**: คิวงานอัตโนมัติ ดูที่ `/admin/jobs` (adminListJobs / adminDeleteJob) — งานที่ล้มเหลวซ้ำต้องแอดมินตัดสินใจ

---
*แผนนี้สร้างจากการวิเคราะห์ไฟล์ต้นทางใน `src/` รวมถึง `lib/`, `pages/admin/`, `store/`, และ `types/`. ฟีเจอร์ที่กล่าวถึงเป็นจริงในโค้ดแล้ว ไม่ได้แต่งขึ้นใหม่*