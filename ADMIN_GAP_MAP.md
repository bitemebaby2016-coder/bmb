# ADMIN_GAP_MAP - Bite Me Baby

> **Target Commit:** e007d08
> **Phase:** A (Real Codebase Audit)
> **Date:** 2026-09-18
> **Principle:** Evidence > Claims

---

## Executive Summary

Admin ปัจจุบันมี 7 หน้า (AdminDashboard, AdminOrders, AdminProducts, InventoryPage, DeliveryManagement, RouteOptimizationPage, AuditLogPage) แต่ยังไม่เปน **Cloud Kitchen Command Center** ตามเป้าหมาย (PHASE D)

**Gap สรุป:** มี CRUD พื้นานสำหรับ products/orders แต่อย่างอื่นส่วนให่ (promotions, rounds, capacity, content, media, customers detail, business settings) ยังไม่มี/เปน mock/localStorage

---

## 1. Admin Capability Matrix (ปัจจุบัน vs ที่ควรมี)

| Capability (ตาม Master Handoff D1-D16) | สถานะปัจจุบัน | Evidence | Priority |
|----------------------------------------|-------------|----------|----------|
| D1 Admin Dashboard | PARTIAL - มี stats cards แต่อ่านจาก getOrders+getInventory (users localStorage) | AdminDashboard.tsx | HIGH |
| D2 Order Management | PARTIAL - มี filter+status update แต่อ่านเอง whole list ไม่มี pagination/search | AdminOrders.tsx | HIGH |
| D3 Product/Menu Management | VERIFIED - CRUD ครบ (create/edit/hide/delete) แต่ BASE64 image ใน localStorage | AdminProducts.tsx | HIGH |
| D4 Category Management | VERIFIED - CRUD ครบผ่าน bmbAdminApi_products.ts แต่ ไม่มี UI แยก category | bmbAdminApi_products.ts | MEDIUM |
| D5 Pricing/Promotion | MISSING - ไม่มี Admin UI จัดการ promotion (มี getPromotions/updatePromotion ใน lib แต่ไม่ถกใช้ใน admin) | promotionIntelligence.ts (ไม่ถกเรียกจาก admin) | HIGH |
| D6 Media Library | MISSING - image upload เปน base64 ลง localStorage อย่างเดียว | bmbStorage.ts:fileToBase64 | MEDIUM |
| D7 Content Management | MISSING - HomePage hero/promo เปน hardcoded JSX | HomePage.tsx:327-351 | MEDIUM |
| D8 Round Management | MISSING - ไม่มี Admin UI ด/แก้ delivery_rounds (มี table อย่แล้วใน DB) | supabase migration 001 | HIGH |
| D9 Capacity Management | MISSING - ไม่มี UI ด/แก้ capacity ไม่มี capacity enforcement ฝั่ง server | delivery_rounds table (max_capacity/current_count) | HIGH |
| D10 Kitchen/Production | MISSING - ไม่มีหน้าด production plan/demand | demandForecasting.ts (lib เท่านั้น) | LOW |
| D11 Inventory | PARTIAL - InventoryPage ใช้ inventoryStore (Zustand LOCAL) ไม่ได้ sync กับ Supabase inventory table | inventoryStore.ts | HIGH |
| D12 Delivery/Dispatch | PARTIAL - DeliveryManagement ใช้ MOCK_DRIVERS hardcoded, providerOrders เกบใน localStorage | DeliveryManagement.tsx:26-30 | MEDIUM |
| D13 Customers | MISSING - ไม่มี admin หน้า customers (มี customers table ใน DB) | supabase migration 001 | MEDIUM |
| D14 Reviews | MISSING - ไม่มี admin หน้าจัดการ reviews (curated reviews hardcoded ใน socialProofReviews.ts) | reviewApi.ts (localStorage) | LOW |
| D15 Business Settings | MISSING - ไม่มี settings table/UI (kitchen lat/lng hardcoded 10.7016/102.1429) | externalProviders.ts | HIGH |
| D16 Admin Authorization | CRITICAL - AdminRoute ใช้ localStorage flag ไม่ได้ยืนยันกับ Supabase profiles | authStore.ts, bmbAdminApi_users.ts | CRITICAL |

---

## 2. Critical Admin Gaps (จัดลำดับความสำคั)

### CRITICAL (ต้องแก้ก่อน launch)

| # | Gap | ปัหาจริง | Fix ที่แนะนำ |
|---|-----|----------|-------------|
| AG-01 | Auth/Authorization เปน localStorage | อะไรกเปลี่ยน localStorage เปน admin ได้ | ย้ายไป Supabase Auth + profiles.role + RLS |
| AG-02 | ไม่มีการคำนวราคาฝั่ง server | ลกค้า/แฮกเกอรส่ง price=0 ได้ | Backend/DB trigger คำนว total ใหม่ |
| AG-03 | Payment เปน simulation | Stripe not integrated จริง | ใช้ Stripe Payment Intent + webhook |

### HIGH (ต้องมีก่อน Admin ใช้งานจริง)

| # | Gap | ปัหาจริง | Fix ที่แนะนำ |
|---|-----|----------|-------------|
| AG-04 | ไม่มี promotion management UI | เปลี่ยน promo ต้องแก้ code | สร้าง promotions table + Admin UI |
| AG-05 | ไม่มี round/capacity management UI | ปรับรอบส่งต้องแก้ source | สร้าง UI + API กับ delivery_rounds |
| AG-06 | Inventory ไม่อ่านจาก Supabase | stock ลกค้าไม่เหน stock จริง | ใช้ Supabase inventory table ผ่าน API เดียวกัน |
| AG-07 | Business settings hardcoded | แก้รัศมี/ค่าส่งต้องแก้ code | business_settings table + UI |
| AG-08 | No customer management | เหน customer ไหนไม่ได้ | สร้าง admin/customers |
| AG-09 | Media/Image เปน base64 | LocalStorage เตมเรว, ไม่เหนภาพฝั่ง admin อื่น | Supabase Storage bucket |

### MEDIUM (รอบ 2)

| # | Gap | ปัหาจริง | Fix ที่แนะนำ |
|---|-----|----------|-------------|
| AG-10 | Content ไม่ใช่ CMS | แก้ hero/promo ต้องแก้ code | home_sections table / ใช้ Supabase |
| AG-11 | Delivery drivers เปน mock | route optimization ไม่ได้ผกกับ real driver | drivers table + status sync |
| AG-12 | Order ต้องเหน order_items | AdminOrders แสดงแค่ items array ใน order row | join order_items |

---

## 3. Admin หน้าปัจจุบัน: จุดแขง/จุดอ่อน

### AdminDashboard.tsx
- จุดแขง: stats cards ดดี, link ไปหน้าต่าง ๆ ครบ (มีไป /promotions ึ่งไม่ใช่ admin route!)
- จุดอ่อน: ใช้ getDashboardStats จาก bmbAdminApi_users ึ่งอ่าน users จาก localStorage; read inventory จาก getInventory (Supabase) แต่ inventoryStore กไม่ใช้มัน; ปุ่มลิงก /promotions (customer page) แทน /admin/promotions
- Privacy: lowStockItems ใช้ status ของ inventory ที่เปน localStorage only

### AdminOrders.tsx
- จุดแขง: filter status, ปุ่มยืนยัน/เริ่มทำ/พร้อมส่ง/ส่ง, trigger notification, audit log
- จุดอ่อน: ไม่มี pagination, ไม่มี search, อ่าน items เปน array ใน row (ยังไม่มี join), ไม่ตรวจ status transition validity, ปุ่มทรหาไม่ทำอะไร, updateOrderStatus เชค oldOrder แต่ไม่ validate

### AdminProducts.tsx
- จุดแขง: CRUD ครบ (add/edit/delete), preview image, toggle is_available/is_featured
- จุดอ่อน: ไม่มี is_preorder toggle ใน edit form (มีใน types แต่ form ไม่มี), ไม่มี sort_order UI, image เปน base64

### InventoryPage.tsx
- จุดแขง: low stock alert, add/edit/delete, table view
- จุดอ่อน: ใช้ inventoryStore (Zustand) ที่เปน memory/localStorage ไม่ใช้ getInventory() จาก Supabase + inventoryPrediction.ts ต่อเลย; "สร้างใบสั่งื้อ" ปุ่มไม่ทำอะไร

### DeliveryManagement.tsx
- จุดแขง: route optimization, provider status update
- จุดอ่อน: drivers เปน MOCK, kitchen lat/lng hardcoded, orders อ่านจาก getOrders (ทั้งชุด), providerOrders localStorage

### RouteOptimizationPage.tsx
- จุดแขง: แสดงผล algorithm
- จุดอ่อน: ใช้ mockOrders hardcoded (ไม่ได้ดึงจาก orders จริง), ไม่มี map ภาพ

### AuditLogPage.tsx
- จุดแขง: filter, clear, summary
- จุดอ่อน: อ่านจาก localStorage auditLog.ts ไม่ใช่ DB

---

## 4. Admin User Journey ที่ควรมี (Complete Admin)

### Owner Login
`
Owner login (Supabase Auth)
  → profiles.role = admin → RLS อนุาต
  → redirect /admin
`

### Admin ต้องทำได้ (ไม่แก้ code)
1. เปลี่ยนชื่อ/ราคา/รป/desc ปรดักต ✅ (มี)
2. เปิด/ปิดขาย / feature / preorder ✅ บางส่วน (มีสลับ available/featured แต่ไม่ใช่ preorder ใน form)
3. จัดการ categories ✅ (ผ่าน lib แต่ไม่มี UI แยก)
4. สร้าง/edit/เปิดปิด promotion ❌ (ไม่มี UI)
5. จัดการ delivery rounds (เวลา/รอบ/capacity) ❌ (ไม่มี UI)
6. ด order + order_items + เปลี่ยนสถานะตาม state machine ⚠️ (เปลี่ยนได้แต่ไม่ตรวจ transition)
7. จัดการ inventory + sync กับ Supabase ⚠️ (ทำได้แต่ localStorage)
8. จัดการ customers + orders ของแต่ละลกค้า ❌ (ไม่มีหน้า)
9. จัดการ delivery zone/fee ❌ (hardcoded)
10. จัดการ business settings (open/close hours, radius) ❌ (ไม่มี)
11. ด production/demand ❌ (มี lib ไม่มี UI)
12. จัดการ review featured/hide ❌ (curated อย่ lib hardcoded)
13. จัดการ media library ❌ (base64 only)

---

## 5. Gap → File Mapping (ต้องแก้อะไร)

| Gap | Files ที่เกี่ยวข้อง | งาน |
|-----|--------------------|-----|
| AG-01 Auth | authStore.ts, bmbAdminApi_users.ts, main.tsx, LoginPage, RegisterPage, AdminRoute (ใน App.tsx) | ย้ายไป Supabase Auth |
| AG-02 Server price | cartStore.ts, CheckoutPage, bmbAdminApi_orders.createOrder, paymentGateway | ใช้ DB trigger/Edge function |
| AG-03 Real payment | paymentGateway.ts, CheckoutPage, (เพิ่ม webhook) | Stripe integration |
| AG-04 Promotion UI | ต้องสร้าง promotions table + admin/promotions page | migration 006 + UI |
| AG-05 Round UI | ต้องสร้าง admin/rounds page + ใช้ delivery_rounds | migration (ถ้าจำเปน) + UI |
| AG-06 Inventory sync | inventoryStore.ts, InventoryPage, bmbAdminApi_inventory | ใช้ Supabase เปน source of truth |
| AG-07 Settings | ต้องสร้าง business_settings table + admin/settings | migration + UI |
| AG-08 Customers | ต้องสร้าง admin/customers + customers table join | UI ใหม่ |
| AG-09 Media | ต้องสร้าง Supabase Storage bucket + admin/media | migration/storage + UI |

---

## 6. สรุป

| ผล | จำนวน |
|----|-------|
| VERIFIED (ทำงานจริงใน admin) | 3 ระบบ (products CRUD, orders status, audit log view) |
| PARTIAL (มีบางส่วน/ไม่ครบ) | 4 ระบบ (dashboard, inventory, delivery, route) |
| MISSING (ไม่มี) | 9 ระบบ (promotions, rounds, capacity, customers, media, content, settings, kitchen, reviews) |
| CRITICAL (security) | 1 (auth/authorization เปน localStorage) |

Admin ปัจจุบัน = **read/resolve Dashboard** ไม่ใช่ **Command Center** ตามเป้าหมายปิดช่องว่าง D1-D16

---

**END OF ADMIN_GAP_MAP**