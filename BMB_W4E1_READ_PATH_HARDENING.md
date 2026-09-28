# BMB_W4E1_READ_PATH_HARDENING.md
**W4-E-1 — Admin / AI Analytics Read Path Hardening (D1) + Test Coverage (D9) · วันที่: 2026-09-27 · OWNER-APPROVED · ไม่มี migration/RLS/business-logic change**

**สถานะ: D1 = CLOSED · D9 = CLOSED (ผ่าน gate ครบ — รายละเอียดด้านล่าง)**

## D1 — ก่อน → หลัง (ทุก caller ของ getOrders())

| Caller | ก่อน (full-table) | หลัง (bounded read) | Semantics |
|---|---|---|---|
| bmbAdminApi_users.getDashboardStats | getOrders() ทั้งตาราง | getOrdersAggregated() (count exact + head) + getOrdersSince(today, 3 คอลัมน์) | คณิตศาสตร์เดิมทุกตัวเลข (todayOrders/todayRevenue/pending/completionRate/totalOrders/totalRevenue) |
| customerIntelligence.calculateCustomerIntelligence | getOrders() + filter customer_id client-side | getOrdersByCustomer(customerId) (server-side eq) | ชุดข้อมูลเดิมเป๊ะ (RLS + รายการเดียวกัน) |
| demandForecasting.getHistoricalData | getOrders() ทั้งตาราง | getOrdersSince(gte now-days, columns: created_at/delivery_round/total_amount) | เก็บ daysDiff<=days check เดิมไว้ — ผลลัพธ์เดิม |
| promotionIntelligence.getPromotionInsights | getOrders() (ใช้แค่ length + avg total) | getOrdersAggregated() { total, totalRevenue } | conversionRate/revenueImpact คำนวณสูตรเดิม (avg = totalRevenue/total, 0 เมื่อไม่มี orders) |
| promotionIntelligence.recommendPromotions | getOrders() (ใช้แค่ avg) | getOrdersAggregated() | avgOrderValue = totalRevenue/total (fallback 200 เมื่อไม่มี orders — เดิม) |
| OrdersPage (customer history) | getOrders() ไม่มี filter | getOrdersByCustomer(customer.id) | RLS-own เท่าเดิม + server-side filter; UI/behavior เดิม |
| DeliveryManagement.loadOrders | getOrders() ทั้งตาราง | getOrdersByStatuses(['pending','confirmed','preparing','ready_for_dispatch']) | tabs/route-optimize ใช้เฉพาะ statuses เหล่านี้ — behavior เดิม |

**Dead code removed (0 callers, verified by grep)**: `getOrdersAdmin()` · orders-table `getDashboardStats()` · unused imports (inventoryPrediction, aiToolCalling)
**getOrders() = KEPT** (rule 11: ยังมี test callers; ไม่มี production caller เหลือ — พิสูจน์ด้วย grep หลังแก้)

## Query strategy ใหม่
- `getOrdersAggregated()`: `select('total_amount', {count:'exact', head:true})` → total โดยไม่ดึง rows + batched sum (pages ของ 1000, single column) → totalRevenue
- `getOrdersSince({sinceISO, columns})`: gte(created_at) + column-limited select — analytics ดึงเฉพาะที่จำเป็น
- `getOrdersByStatuses([...])`: in-filter + order + hydrate items (สำหรับ admin ops)
- `getOrdersByCustomer(id)`: eq-filter + hydrate (มีอยู่แล้วจากเดิม — นำมาใช้)

## D9 — tests เพิ่ม (src/__tests__/ordersPaged.test.ts — 11 tests)
1. default page/pageSize (ทั้งหมด + exact count) · 2. explicit page/pageSize (range math ที่ตำแหน่งถูกต้อง) · 3. status filter (rows + count) · 4. count exact ไม่ขึ้นกับ page window · 5. empty page ([] + total คงเดิม) · 6. stable ordering (created_at desc, เหมือนกันข้าม calls) · 7. error propagation (degrade → {orders:[],total:0} ตาม contract) · 8. getOrdersAggregated (count + sum ถูกต้อง) · 9. getOrdersByStatuses · 10. getOrdersByCustomer · 11. getOrdersSince (gte bound)
- Mock เสริม surface ที่ PostgREST มีจริง: gte/in/range/select(count,head) + injectable read-failure — mirror real semantics (ไม่ใช่ mock ที่พิสูจน์ตัวเอง: assert ที่ contract ของ API layer: page→range math, filter→eq/in, count, ordering)

## ผลก่อน/หลัง
- vitest: ก่อน 22 files / 179 tests → หลัง 23 files / 190 tests (เพิ่ม 11 — ทั้งหมดเป็น tests ใหม่ของ D9; ไม่มี test เดิมถูกลบ/แก้)
- ไม่มี production mutation ใด (write paths/RPC/RLS ไม่ถูกแตะ — diff เฉพาะ read paths)
- getCustomersWithStats (bmbAdminApi_customers) = เดิม column-limited (5 คอลัมน์) สำหรับ per-customer aggregation — KEEP (ตรงตามหลักการ query เฉพาะที่จำเป็น)

**หมายเหตุ execution audit trail**: ระหว่างรอบนี้ editor tool มี intermittent error ทำให้เกิด commit ขนาดเล็กหลายรายการและมี push retry — ทุก commit ผ่าน secret scan และสถานะสุดท้าย HEAD == origin/main · WORKTREE CLEAN (audit trail ครบถ้วนใน git log)

## RUNTIME VERIFIED (production, READ-ONLY probes 2026-09-27 · หลัง push)

```text
AGG: total=157 totalRevenue=291,632 ฿ rows=157 (batched single-column sum = count exact ✓)
SINCE-today: ทำงานถูกต้อง (ชุดวันนี้)
BY-STATUSES: ทำงานถูกต้อง (ชุดเดียวกับ admin filter เดิม)
```
(ตัวเลขจาก live probe จริง ณ เวลาตรวจ — โครงสร้าง query ตรงกับ helpers ใหม่ทุก pattern)

## GATE จริง (ผลรัน)
- tsc: 0 errors · eslint --quiet: 0 · build: ✓ (vite ไม่มี error) · secret scan (src+dist): 0
- vitest: **23 files / 190 tests passed** (ก่อน 179 → หลัง 190; +11 = D9 tests ใหม่ทั้งหมด; ไม่มี test เดิมถูกแก้/ลบ)
- scheduler (automation-scheduler): ต่อเนื่อง success หลัง push · CI: ผ่านบน commit ใหม่
- Regression baseline ที่เกี่ยว: ไม่มี write-path/RPC/RLS change ใด → mutation probes (F-05/F-06/F-18/identity) ไม่จำเป็นต้องรันซ้ำ — read paths ที่เปลี่ยนถูก verify สดตามด้านบน + w3dNotificationsE2E probe = PASS (read-only)

## STATUS

```text
IMPLEMENTED      = D1 read-path migration (7 callers) + 3 new read helpers + dead-code removal
CONNECTED        = AdminDashboard (stats) · OrdersPage · DeliveryManagement · AI analytics (4 modules)
DEPLOYED         = ผ่าน git push (Vercel/CI pipeline เดิม) — ไม่มี Edge Function deploy ใหม่
RUNTIME VERIFIED = live read-only probes (aggregated/since/statuses) + vitest 190/190 + build ✓
MISSING          = ไม่มี
BLOCKED          = ไม่มี
DEFERRED         = ไม่มี (D2 ยังอยู่ future phase ตาม matrix — ไม่ใช่ scope นี้)
```

## GATE
- tsc 0 · vitest 23 files/190 tests ✓ · eslint 0 · build ✓ · secret scan 0 · HEAD == origin/main · WORKTREE = CLEAN

## Wave 4 Readiness Summary (Final)

| Phase | Commit | Status |
|---|---|---|
| W4-A admin pagination | 1f6d140 | DONE |
| W4-B placeholder EF audit + cleanup | 4c05cf7 · 1873047 | DONE / CLEANUP COMPLETE |
| W4-C realtime audit + dead-code cleanup | 45ade88 · aab0619 | DONE / CLEANUP COMPLETE |
| W4-D TODO/marker audit | d06761c | DONE (OTP FROZEN · P1-1 FROZEN · P1-2/3/5 DEFERRED) |
| W4-E-0 debt reality audit | 67e4652/f26fec6/62841ca | DONE (D1/D2/D9) |
| W4-E-1 read-path hardening + D9 | — | DONE — D1 CLOSED · D9 CLOSED |

**จบ Wave 4 — พร้อมรับคำสั่ง Wave 5 จาก Owner**
คงเหลือ: D2 (MEDIUM, future phase) — ไม่มี CRITICAL/HIGH
Wave 4 = COMPLETE · พร้อมรับคำสั่ง Wave 5 จาก Owner
