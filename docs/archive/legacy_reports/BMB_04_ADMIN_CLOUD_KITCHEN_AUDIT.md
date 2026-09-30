# BMB_04_ADMIN_CLOUD_KITCHEN_AUDIT.md
**Phase 4 — Admin / Cloud Kitchen Command Center Reality Audit (READ-ONLY)**
**Audit date:** 2026-09-27 · HEAD `fdc7898` · Production Supabase `ivkdfognyiwjcmrhcnwz`
**Method:** Playwright runtime (login ด้วย demo credentials ที่ UI แสดงสาธารณะ — ตามคำสั่ง §1) + code trace + DB evidence จาก Phase 2 · **ไม่มี mutation ใด ๆ ต่อ production** (ไม่กด save/confirm/refund)
**Raw evidence:** `e2e/prod-phase4-admin.json` (+screenshots p4-*.png) · `e2e/prodAuditPhase4.cjs` · retry `e2e/prod-phase4b-admin-spa.json` (+`prodAuditPhase4b.cjs`, ถูก rate-limit)

## 1. Admin Authentication (runtime จริง)

| ตรวจ | ผล | Evidence |
|---|---|---|
| Login ด้วย demo creds ที่ UI แสดงสาธารณะ | **สำเร็จจริง → ไปถึง /admin dashboard** (header "Admin A", badge แจ้งเตือน, metrics "ออเดอร์วันนี้ 0 · รายได้วันนี้ ฿0 · รอดำเนินการ 0 · วัตถุดิบใกล้หมด") | p4-after-login.png, prod-phase4-admin.json |
| Unauth direct access /admin | **redirect ไป /login ✓** (guard ทำงาน) | p4-unauth-admin.png |
| **Session persistence (full reload)** | **BROKEN — ทุก /admin/* ที่เปิดด้วย URL ตรง ๆ หลัง login = โดน redirect กลับ /login ทั้ง 16 หน้า** (redirect=true 16/16) | prod-phase4-admin.json → pages |
| Logout | มีปุ่ม "ออก" ใน header (runtime UI) — ทดสอบ = NOT VERIFIED (หลีกเลี่ยง rate-limit) |
| Retry login (4b) | **Supabase auth rate-limit** → landed=/login — จำกัดการทดสอบ per-page SPA nav |

**SECURITY FINDING S-1 (HIGH):** demo admin credentials (`admin@bmb.co.th` / `admin123`) **ใช้งานได้จริงบน production** และแสดงบนหน้า login สาธารณะ → ทุกคนที่เปิดเว็บเข้า Command Center ได้ (ทดสอบ login สำเร็จ = พิสูจน์แล้ว ไม่ใช่ assumption)
**FINDING S-2 (HIGH):** Admin session ไม่ทน page reload → deep-link/direct URL access ใช้ไม่ได้ ต้องเดินผ่าน SPA nav เท่านั้น (ผลข้างเคียง: การทำ automation/monitoring ฝั่ง admin เปราะ)

## 2. Admin Route Inventory (จาก App.tsx จริง)

Routed (16): /admin (Dashboard) · /admin/control · /admin/inventory · /admin/orders · /admin/products · /admin/content-approvals · /admin/audit-log · /admin/delivery · /admin/route-optimization · /admin/promotions · /admin/rounds · /admin/customers · /admin/settings · /admin/media · /admin/errors · /admin/mascot

**Imported แต่ไม่มี Route = DEAD (App.tsx:36-38):**
- `AdminKitchen.tsx` — **หน้า Kitchen ไม่มี route เข้าถึงไม่ได้เลย**
- `AdminPreOrders.tsx` — หน้า pre-order admin DEAD
- `AdminRecipes.tsx` — หน้าสูตรอาหาร DEAD

Nav (AdminNav) อ้าง pathname prefix — nav item ที่ไม่มีใน list ตาม runtime body แรก = ตรวจต่อ (navItems capture ถูก rate-limit)

## 3. Menu Management

| Capability | Admin UI | Function | DB | Status |
|---|---|---|---|---|
| Create/Edit product | AdminProducts | bmbAdminApi_products (direct CRUD) | products table ✓ | PARTIAL (runtime mutation NOT VERIFIED — ห้ามแตะข้อมูล) |
| Price/description/image/category | ✓ fields | ตรง CRUD | ✓ | PARTIAL |
| available_same_day / available_preorder | มี columns จริงใน DB | products CRUD | ✓ | PARTIAL |
| Stock | products.stock (int) | ✓ | ✓ | PARTIAL |
| **ผลต่อ Customer** | — | — | — | **MenuPage ✓ ตรง DB + menu gate 039 · HomePage drinks/snacks = STATIC → Admin แก้ไม่มีผลที่ home (ยืนยันซ้ำ H-2)** |
| Weekly menu schedule | **ไม่มี admin UI สำหรับ menu_schedule/publish_menu_schedule** | RPC มีใน DB (039) | ✓ | MISSING (backend พร้อม แต่ Admin ใช้ไม่ได้) |

## 4-5. Preorder / Same-day / Round Management (production ค่าจริง)

- Round config จริง (delivery_rounds, 15 rows): morning (cutoff 05:00-08:00, cap 60) · midday (cutoff 09:00-10:30, cap 80) · evening (cutoff 16:00, cap 100) — per-date instantiation โดย ensure_rounds_for_date
- Admin UI: AdminRounds → getDeliveryRoundsAdmin/upsertDeliveryRound/setRoundStatus/resetRoundCapacity → DB ✓ (RPC/DB = READY · runtime mutation NOT VERIFIED)
- business_settings จริง: order_policy(pre_order_lead_days=1, preorder_max_days=40, max_items_per_order=20, cancel_window_minutes=5) · operating_hours(all open=true) — AdminSettings → setBusinessSetting ✓
- **Enforcement chain ยืนยันแล้วใน Phase 2** (create_order_with_items + enforce_pre_order_window + enforce_operating_hours) → Admin setting → DB → backend enforce → customer ✓ (ทาง code/DB) · runtime mutation test = NOT VERIFIED

## 6. Order Management

- AdminOrders → getOrders / **updateOrderStatus → RPC transition_order_status** / confirmOfflinePayment → RPC / markPaymentFailed → RPC / stripeRefundOrder → EF stripe-refund
- Illegal transition: DB trigger order_transition_allowed (030 ELSE fix live — Phase 2)
- Audit trail: audit_logs (31 rows) + append_audit_log RPC
- **จุดอ่อนที่พบจาก production data (Phase 2): ออเดอร์จริง 17 ออเดอร์ทุกตัวยัง status=pending/confirmed → Admin ยังไม่เคยรัน lifecycle เลยก็ได้; lifecycle ครบทาง DB/RPC (READY) แต่ runtime usage = UNKNOWN**
- Destructive test ห้ามทำ → illegal transition live = NOT VERIFIED

## 7. Payment (Admin verification)

- PromptPay/COD verification: AdminOrders → confirm_offline_payment (admin-only RPC, rule-gated COD ต้อง delivered) ✓ DB authority จริง
- Refund: EF stripe-refund v3 deployed ✓ — production evidence: 1 refunded PI (ทำจริง 1 ครั้ง 2026-09-19)
- ไม่ทำ real refund → safe-path only

## 8. Kitchen Command Center

- **AdminKitchen page = DEAD (no route)** — ไม่มีหน้า kitchen ที่เข้าถึงได้
- /admin/control (AdminControlPage + components/dashboard/AdminControl) = หน้า control ที่ routed — runtime = NOT VERIFIED (rate-limit)
- ข้อมูล production: production_batches/production_batch_items มี tables + RPC (get_kitchen_summary, create_production_batch) — **ไม่พบ rows count probe ของ production_batches (UNKNOWN ปริมาณจริง)**
- สรุป: kitchen surface ที่ใช้ได้จริง = **AdminOrders (รายการออเดอร์) เท่านั้น** — kitchen-specific workflow = DEAD/DORMANT

## 9. Delivery (Admin side)

- DeliveryManagement (routed) → getOrders + **listDrivers (DB-driven จริง ไม่ใช่ MOCK_DRIVERS ตามเอกสารเก่า)** + provider adapter UI
- UI แสดงสถานะ provider ตรงไปตรงมา: "🧪 Sandbox" / "🔶 MOCKUP pending" (DeliveryManagement.tsx:205-216) — **ผู้พัฒนายอมรับใน UI ว่า external providers ยัง mockup**
- drivers=0, delivery_assignments=0 (Phase 2) → dispatch flow ไม่เคยใช้จริง
- >5km: backend ✓ / customer frontend ✗ (M-1 ยืนยันซ้ำ) — Admin ไม่มีทางแก้จาก UI

## 10-11. Customer/Order Detail + CRUD/RLS

- Admin เห็น PII ผ่าน orders+customers — policy is_admin() gate (Phase 2) ✓
- ทุก admin write ใช้ **authenticated JWT + RLS is_admin()** — ไม่มี service-role ใน frontend ✓
- Orders write ผ่าน SECURITY DEFINER RPC + trigger ✓
- ⚠️ authenticated grants กว้างหลายตาราง — ความปลอดภัยจริงพึ่ง policy expression (ยืนยันแล้วใน Phase 2)

## 12. Business Settings → Consumer chain

| Setting | Admin edit | DB | Consumer | Customer effect | Status |
|---|---|---|---|---|---|
| order_policy.pre_order_lead_days | ✓ | ✓ | CheckoutPage + enforce_pre_order_window | ✓ | PARTIAL |
| order_policy.preorder_max_days | ✓ | ✓ | enforce_pre_order_window (RPC) | ✓ | PARTIAL (NOT VERIFIED runtime) |
| order_policy.cancel_window_minutes | ✓ | ✓ | enforce_pre_order_cancel_window | ✓ | PARTIAL |
| operating_hours.*_open | ✓ | ✓ | enforce_operating_hours trigger | ✓ | PARTIAL |
| delivery_policy.radius_km | ✓ | ✓ | **consumer ไม่พบใน code scan** | ✗ | **DISCONNECTED (suspect)** |
| kitchen_location | ✓ | ✓ | deliveryFeeApi origin | ✓ | PARTIAL |
| hours (10:00-22:00) | ✓ | ✓ | ไม่พบ consumer | ✗ | **DEAD CONFIG (suspect)** |

## 13. AI / Automation (Admin surface)

- **ai-proxy ยังไม่ deploy บน production** (Phase 2 Management API — re-verified, ไม่ redeploy) → **Bite AI chat = BROKEN บน production** (CRITICAL คงเดิม)
- AdminContentApprovals routed จริง แต่ content_approvals=0 rows → DORMANT (ไม่เคยใช้)
- route-optimization page routed แต่ lib dormant (Phase 1)
- Automation: ไม่พบ Make.com/FB/Messenger/LINE inbound — MISSING/FOUNDATION ONLY (คงเดิม)

## 14. Duplicates / Dormant (admin-side)

| รายการ | สถานะ |
|---|---|
| AdminKitchen/AdminPreOrders/AdminRecipes (no route) | DEAD |
| RiderPwaPage vs dashboard/RiderPWA | DUPLICATE |
| External provider adapters | MOCKUP/Sandbox (UI ยอมรับเอง) |
| content_approvals / mascot_overrides | tables+UI แต่ 0 rows = DORMANT |
| route-optimization | routed, lib dormant |

## 15. Admin → Customer consistency

- Safe mutation test = **ไม่ทำ** (ห้ามเปลี่ยน production data) → **NOT VERIFIED ตามกติกา**
- จาก code+DB: product change → MenuPage ✓ ทันที · → HomePage ✗ (static lib)

## 16. Master Matrix

| Capability | Admin UI | Frontend Function | RPC/API | DB | RLS/Auth | Runtime | Customer/Kitchen Effect | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Login | ✓ | authStore | Supabase Auth | profiles.role | is_admin | ✓ login สำเร็จ | — | READY (แต่ demo creds public = S-1) | p4-after-login.png |
| Session/direct URL | ✓ | — | — | — | — | ✗ reload หลุด 16/16 หน้า | — | BROKEN (S-2) | prod-phase4-admin.json |
| Dashboard metrics | ✓ | getDashboardStats | — | orders/inventory | is_admin | ✓ (0/0/0 ตรง DB) | — | READY | p4-after-login.png |
| Orders list + status | ✓ | bmbAdminApi_orders | transition_order_status | orders+trigger | is_admin | PARTIAL | ✓ | READY (DB) | Phase 2 |
| Offline payment verify | ✓ | confirmOfflinePayment | confirm_offline_payment | orders+PI | is_admin RPC | NOT VERIFIED (mutation) | ✓ mark paid | READY (DB) | Phase 2 |
| Refund | ✓ | stripeRefundOrder | EF stripe-refund v3 | PI | JWT+admin | ✓ (1 refund จริง) | ✓ | READY | Phase 2 |
| Products CRUD | ✓ | bmbAdminApi_products | REST CRUD | products | is_admin | NOT VERIFIED | MenuPage ✓ / Home ✗ | PARTIAL | Phase 2+3 |
| Rounds CRUD | ✓ | upsertDeliveryRound | REST/RPC | delivery_rounds | is_admin | NOT VERIFIED | ✓ cutoff/capacity | PARTIAL | Phase 2 |
| Business settings | ✓ | setBusinessSetting | REST | business_settings | is_admin | NOT VERIFIED | บางตัว ✓ บางตัว DEAD | PARTIAL/CONTRADICTED | §12 |
| Kitchen workflow | ✗ DEAD | — | get_kitchen_summary | production_batches | — | — | ✗ | MISSING (UI dead) | App.tsx:36-38 |
| Pre-orders admin | ✗ DEAD | — | — | pre_orders | — | — | — | MISSING | App.tsx:36 |
| Recipes admin | ✗ DEAD | — | — | recipes | — | — | — | MISSING | App.tsx:36 |
| Delivery mgmt | ✓ | listDrivers + adapters | REST | drivers/provider_orders | is_admin | NOT VERIFIED | ไม่เคยใช้ | PARTIAL | DeliveryManagement.tsx:205-216 |
| Content approvals | ✓ | contentApproval RPC | review_content | content_approvals | is_admin | ✓ 0 rows | ✓ gate | DORMANT | Phase 2 |
| Media library | ✓ | bmbAdminApi_media | storage | media_assets | is_admin | NOT VERIFIED | ✓ | PARTIAL | Phase 2 |
| AI chat (Bite) | n/a | aiService | ai-proxy ไม่ deploy | — | — | ✗ | ✗ | BROKEN (CRITICAL) | Phase 2 EF list |
| Audit log | ✓ | auditLog | append/read | audit_logs(31) | is_admin | ✓ rows จริง | — | READY | Phase 2 |

## 17. Evidence separation

- CODE: App.tsx:36-38,134-195 · bmbAdminApi_* · DeliveryManagement.tsx:205-216
- DB: e2e/prod-phase2-audit.json
- RUNTIME: e2e/prod-phase4-admin.json + p4-*.png (+ retry 4b rate-limited)

## 18-19. Carry-forward re-verification

- **H-1 (cart persist):** customer-side — สถานะคงเดิม
- **H-2 (home menu static):** ยืนยันซ้ำ — root cause = DrinksSection/SnacksSection lib — คง HIGH
- **M-1 (>5km):** admin ไม่มี UI แก้ — root cause frontend — คง BLOCKED ฝั่ง customer
- **M-2/M-4:** customer copy/label — ไม่เกี่ยว admin
- **M-3 (tracking display-state):** admin มี transition RPC จริง — root cause = lifecycle usage ที่ยังว่าง (orders จริงยัง pending หมด)
- **ai-proxy CRITICAL:** คงเดิม (4/14 EF deployed) — root cause = deployment layer
- **NEW S-1 (demo creds ใช้ได้จริง, CRITICAL) / S-2 (session reload, HIGH):** auth/session layer

## 20. Answers (§18)

1. **Admin ได้จริง:** login (demo), dashboard DB-driven, orders/payment/refund ผ่าน DB authority, CRUD products/rounds/settings/media ผ่าน RLS is_admin
2. **UI แต่ backend ไม่รองรับ:** ไม่พบ — พบด้านกลับ (ข้อ 3) มากกว่า
3. **Backend รองรับแต่ Admin ใช้ไม่ได้:** Kitchen workflow (RPC ครบ, หน้า DEAD) · menu_schedule (039 ไม่มี UI) · AdminPreOrders/Recipes DEAD · provider dispatch (sandbox)
4. **Admin แก้แล้ว Customer ไม่เปลี่ยน:** HomePage drinks/snacks · delivery_policy.radius_km · hours
5. **Admin แก้ DB แต่ backend ไม่ enforce:** ไม่พบ — backend enforce ครบ (ตรงข้ามกลับกัน)
6. **Mock/static:** home drinks/snacks lib · provider adapters (MOCKUP pending) · tracking timeline client-state
7. **ติด RLS/Auth:** S-2 session reload · rider identity = phone (Phase 2) · mutation ทั้งหมดผ่าน is_admin RLS ✓
8. **Order lifecycle จริง:** DB/RPC ครบ pending→delivered แต่ production ใช้จริงแค่ pending/confirmed → PARTIAL/UNKNOWN
9. **Preorder/Same-day/Round/Capacity/Cutoff เชื่อมจริง:** ✓ ทั้ง chain (DB→RPC→trigger→UI) — mutation runtime NOT VERIFIED
10. **Delivery/Driver/≤5/>5:** DB+RPC ✓ จริง · customer UI ✗ >5km · driver identity = phone ⚠️ · dispatch ไม่เคยใช้
11. **Payment verification ↔ DB authority:** ✓ จริง (confirm_offline_payment / record_payment_result / stripe-refund + refund จริง 1 ครั้ง)
12. **AI/Automation:** ai-proxy BROKEN · content approvals DORMANT · Make/omnichannel MISSING
13. **Critical:** ai-proxy not deployed · S-1 demo admin creds ใช้ได้จริง + public · High: S-2 · H-2 · H-1(customer) · Medium: M-1..M-4 · Low: copy bugs, snacks, dead config
14. **Root cause layer:** S-1/S-2=auth/session · H-2=data-source(frontend) · M-1=frontend · ai-proxy=deployment · kitchen dead=routing · DEAD CONFIG=consumer-wiring
15. **Dependency order:** (1) rotate demo admin creds + fix session persistence → (2) deploy ai-proxy และ EF ที่จำเป็น → (3) route/ตัด AdminKitchen/PreOrders/Recipes → (4) sync home menu เข้า DB → (5) เปิด delivery method UI → (6) เชื่อม/ตัด DEAD CONFIG → (7) live E2E ด้วย test account

## 21. PHASE 4 STATUS

**PHASE 4 PARTIAL**

Blocked/missing:
- Per-page admin SPA browse — blocked: Supabase auth rate-limit หลัง login แรก + S-2 (session ไม่ทน reload)
- Admin mutation E2E (product/round/settings → customer) — blocked: ห้ามแก้ production data
- Illegal transition live — blocked: ไม่มี safe mechanism + ห้ามแก้ order จริง
- Required next: test admin account + owner อนุญาต mutation บน test row / หน้าต่างเวลา rate-limit ผ่าน

**HARD STOP — รอคำสั่งถัดไป**