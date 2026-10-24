# BMB — Role / Permission / AI Audit + Gap Register (2026-10-24)

> **Handoff task 5 (P2, DOCS ONLY).** อ้างอิงโค้ดจริง + migrations จริง · **ไม่มีการ
> แก้ auth/RLS/schema ในเอกสารชิ้นนี้** — ทุกข้อการแก้ไขเป็น **PROPOSAL** รอ Owner
> อนุมัติเป็นลายลักษณ์อักษรก่อนออก migration (directive §6: ห้ามสร้างระบบ role
> ที่สอง, ห้ามแตะ auth/RLS โดยไม่ผ่าน matrix นี้ก่อน)

## 0. Labels (ใช้ทั้งเอกสาร)

| Label | ความหมาย |
|---|---|
| IMPLEMENTED | มีในโค้ด/DB แล้ว (source evidence) |
| CONNECTED | เชื่อมต่อฝั่ง client ↔ server แล้ว |
| DEPLOYED | อยู่ใน production แล้ว (migration ledger / build) |
| RUNTIME VERIFIED | เคยยืนยันด้วย runtime evidence แล้ว |
| DOCUMENTED | มีแค่เอกสาร/แผน — ยังไม่มีการ implement |
| MISSING | ยังไม่มีทั้งโค้ดและแผนที่ใช้ได้จริง |
| BLOCKED | ติด Owner decision / blocker ที่ระบุ |
| DEFERRED | จงใจเลื่อนไปรอบหลัง — มีเหตุผลระบุ |

## 1. Role inventory (IMPLEMENTED · source: src/lib/bmbAdminApi_users.ts:18, migration 006)

- **โมเดลเดียว**: `profiles.role` ∈ {`admin`, `staff`, `customer`} — ค่าผูกตอน signup
  โดย trigger `on_auth_user_created` (migration 006) · **ไม่มีระบบ role ที่สอง**
- Authority จริงอยู่ที่ DB/RLS: `is_admin()`, `is_staff()`, `is_tenant_admin()`,
  `is_tenant_admin_of(tenant_id)` (+ `has_service_role()` สำหรับ channel intake)
- Client gating (ชั้นอำนวยความสะดวกเท่านั้น):
  - `AdminRoute` (App.tsx:124-148): ทุก `/admin/*` page route ห่อไว้ — รอ
    session restore → fetch `profiles.role` จาก DB → ผ่านเฉพาะ `admin`/`staff`
    (guest → /login, role อื่น → /) — **IMPLEMENTED + source-contract test**
    (`src/__tests__/adminNavFeedback.test.ts`)
  - `shouldShowAdminLink(role)` (src/lib/adminUi.ts:109): แสดงลิงก์ Admin เมื่อ
    `admin`/`staff` — email fallback ถูกถอดไปแล้ว (Owner Decision 12)
  - RLS = ประตูจริง — client UI โกงได้แค่ "มองเห็นปุ่ม" ไม่ใช่ "อ่านได้"

## 2. Role × permission matrix (perceived permissions — code + RLS evidence)

| Capability | admin | staff | customer | anon | Evidence / authority |
|---|---|---|---|---|---|
| อ่าน/เขียน business_settings, rounds config, promotions, menu publish | ✅ | ❌ | ❌ | read few | `is_admin()` policies (021/024/039/077…) |
| อ่าน catalog/rounds/inventory/recipes/settings (POS+kitchen) | ✅ | ✅ READ | read published | read catalog | `*_staff_select` policies (129) |
| เขียน orders/items (สร้างออเดอร์) | ✅ | ✅ | ✅ own | ❌ | `create_order_with_items` (GRANT authenticated, RLS own/customer) |
| อ่าน orders ทั้งร้าน | ✅ | ✅ | own only | ❌ | 129 `orders_staff_select` + customer policies |
| เขียน order status history / auto-rounds / dispatch | ✅ | ส่วนหน้า (kitchen/delivery UI) | ❌ | ❌ | `is_admin()` policies (018/040/…) + RPCs |
| payment_intents (ตรวจสลิป/เขียน intent) | ✅ | SELECT บางส่วน | own read | ❌ | 129 staff SELECT + 034/129/133 GRANT/REVOKE — **D-08 เคยขาด GRANT (แก้แล้วตาม Recovery Plan)** |
| media / content approvals / marketing posts | ✅ | ❌ (ไม่มี policy staff) | ❌ | read published | 021/055 `is_admin()` |
| inventory / recipes เขียน | ✅ | READ | ❌ | ❌ | 129 staff SELECT + `is_admin()` manage |
| finance/reports, daily_closings, print_jobs, shifts | ✅ | SELECT (closings/shifts) | ❌ | ❌ | 130/128/129 |
| tenants/brands (white-label) | ✅ | ❌ | ❌ | read brands | `is_tenant_admin*` (065/071/077/109) |
| audit_log | ✅ | ❌ | ❌ | ❌ | 018 `is_admin()` |
| notifications (customer rows) | อ่าน own/admin | ❌ | own | ❌ | RLS own/admin (NOT-01) + `markAllNotificationsRead` (own rows) |
| AI studio / automation / marketing AI | ✅ | ❌ | Talk-to-Bite public | public safe caps | 021 `is_admin()` + guardrails client |

**ข้อสังเกตเชิงนโยบาย (DEFERRED → Owner):** `staff` เห็น "ทุกเมนูแอดมิน" (nav ชุดเดียว
admin/staff) โดย RLS คุมข้อมูล — ผลลัพธ์ = หน้าที่ staff ไม่มีสิทธิ์อ่านจะโชว์ว่าง/ error
จริง ยัง **ไม่มี per-role nav hiding** — เก็บเป็น proposal §5-P2 (ห้ามทำก่อน Owner อนุมัติ
matrix ขั้นสุดท้าย)

## 3. Page × permission matrix (admin pages)

Gate ร่วมของทุกแถว: **`AdminRoute` (admin|staff) + RLS เป็นตัวตัดสินข้อมูลจริง**
(ทุกหน้าใน `src/pages/admin/*` + `AdminControlPage` = IMPLEMENTED, wired ใน App.tsx
ทั้งหมด — พิสูจน์ด้วย source-contract test "every nav target is a registered route")

| Page (route) | API surface | RLS authority | staff เห็นข้อมูล? | fine-grained role split |
|---|---|---|---|---|
| /admin (dashboard) | bmbAdminApi_* aggregate | mixed | partial | MISSING (proposal) |
| /admin/orders +pos+kitchen+rounds+delivery | orders/kitchen/rounds APIs | `is_admin()` manage + `is_staff()` SELECT (129) | ✅ | MISSING |
| /admin/products (MenuHub + menu-schedule) | bmbAdminApi_products, bmbMenuSchedule | `is_tenant_admin`/`is_admin` (071/077) + staff SELECT | read | MISSING |
| /admin/promotions, marketing, content-approvals | promotions/marketing APIs | `is_admin()` (021/022) | ❌ | MISSING |
| /admin/customers | users/customers APIs | `is_admin()` + own | ❌ | MISSING |
| /admin/inventory, recipes | inventory/recipes APIs | staff SELECT (129) + admin manage | read | MISSING |
| /admin/reports, pos (finance) | finance APIs | `is_admin()` (130) + closings staff SELECT | partial | MISSING |
| /admin/media, portfolio, asset-audit | media/portfolio APIs | `is_admin()` (055/094/097) | ❌ | MISSING |
| /admin/settings, tenants, control | settings/tenancy APIs | `is_admin()`/`is_tenant_admin` | ❌ | MISSING |
| /admin/audit-log, errors, notifications(admin), ai-studio | audit/errors/notif/AI APIs | `is_admin()` (018/021/115) | ❌ | MISSING |
| /rider (PWA public demo) | driver RPCs | `driver_id` own / `is_admin()` (020/041) | n/a | MISSING (gap #6) |

## 4. RLS data-access matrix (table group × authority)

| Table group | Policy authority | Roles reaching it | Source |
|---|---|---|---|
| business_settings, promotions, media, print_jobs, audit_log, portfolio, push | `is_admin()` | admin | 018/021/022/077/115/128/094 |
| kitchen/production tables | `is_admin()` | admin | 019 |
| menu_schedule manage | `is_tenant_admin`/`is_admin` + **ไม่มี grant INSERT/UPDATE ให้ authenticated** (เขียนตรงถูกปฏิเสธ — contract 145 G6) | admin ผ่าน RPC เท่านั้น | 071/077 + grant scan |
| catalog (products, categories, addons) | `is_tenant_admin` manage + anon read published + staff SELECT | admin/staff/anon | 071 + 129 |
| orders, order_items, rounds, inventory, recipes, payment_intents SELECT, closings, shifts | `is_staff()` / `is_admin()` | staff+admin | 129/130 |
| order writes / status history | RPC `create_order_with_items` + `is_admin()` history | authenticated(สร้าง)/admin(ประวัติ) | 025/040 + 129 |
| drivers / locations | `driver_id = own` / `is_admin()` | rider+admin | 020/041 |
| notifications (customer) | own / admin read | customer+admin | NOT-01 |
| brands / tenants | `is_tenant_admin*` | admin/tenant-admin | 059/065/077 |

## 5. Gap register (12-category framework — คงจาก handoff §8)

| # | Category | สถานะวันนี้ | Label |
|---|---|---|---|
| 1 | OWNER | ไม่มี role แยก — owner = admin | MISSING |
| 2 | ADMIN/GM | `admin` + RLS | IMPLEMENTED · DEPLOYED |
| 3 | KITCHEN STAFF | `staff` + AdminKitchen/POS | IMPLEMENTED (partial) |
| 4 | INVENTORY | หน้า+API มี ไม่มี role แยก | IMPLEMENTED (no-role) |
| 5 | FINANCE | reports/closings มี ไม่มี role split | IMPLEMENTED (no-role) |
| 6 | RIDER | RiderPwaPage + driver policies — ไม่มี role ใน profiles | PARTIAL |
| 7 | CUSTOMER | `customer` + RLS own | IMPLEMENTED · RUNTIME VERIFIED (ทั่วไป) |
| 8 | SUPPORT | ไม่มี | MISSING |
| 9 | MARKETING | หน้ามี (admin เท่านั้น) ไม่มี role แยก | IMPLEMENTED (no-role) |
| 10 | AUDIT/READ-ONLY | AuditLogPage มี ไม่มี read-only role | IMPLEMENTED (no-role) |
| 11 | DEVELOPER | ไม่มี (ผ่าน repo/CI) | MISSING |
| 12 | SYSTEM/AUTOMATION | GitHub Actions + service_role | IMPLEMENTED · DEPLOYED |

## 6. AI / automation inventory (reuse — ห้าม duplicate)

- **มีแล้ว**: `src/lib/ai/*` (aiService, aiModels, aiToolCalling, aiGuardrails×2, aiMemory,
  aiServerMemory, aiDbContext, aiVoice, aiRouting), `AdminAiStudio.tsx`, `TalkToBite`,
  `theaterDailyCopy.ts`, automation-scheduler workflow, notification/push services
- **กันชน AI**: aiGuardrails + aiGuardrailsAdv + guard test suite (มีเทสต์คุม)
- **ห้ามสร้าง**: model router ที่สอง / ระบบ role ที่สอง / matrix ที่สาม (directive §6)

## 7. Staged proposal (PROPOSAL ONLY — ห้ามออก migration ก่อน Owner อนุมัติ)

| Stage | เนื้อหา | Label |
|---|---|---|
| P0 | ยึดโมเดล 3 ค่าเดิม — matrix นี้ = baseline | DOCUMENTED |
| P1 | Owner/admin split + read-only auditor = เพิ่มค่าใน `profiles.role` เดิม **เท่านั้น** (ไม่สร้างตาราง/ระบบใหม่) + per-role nav hiding | BLOCKED (รอ Owner) |
| P2 | staff fine-grained (kitchen/inventory/pos) = policy ชุดใหม่บน `is_staff()` | BLOCKED (รอ Owner) |
| P3 | dedicated rider role ใน profiles + ย้าย driver gating | BLOCKED (รอ Owner) |
| P4 | support/developer roles | DEFERRED (ยังไม่มี product surface) |

**Owner decisions required ก่อน P1-P3:** ยืนยัน matrix ขั้นสุดท้าย + ชื่อค่า role ที่ยอมรับ
ใน `on_auth_user_created` chain — ทุก stage ต้องมาพร้อม contract test ของตัวเอง

## 8. Evidence index

- Roles: `src/lib/bmbAdminApi_users.ts:18` · migration 006
- Route gate: `src/App.tsx:124-148` + `src/__tests__/adminNavFeedback.test.ts`
- Nav: `src/lib/adminUi.ts` (`ADMIN_NAV_ITEMS/GROUPS`, `shouldShowAdminLink:109`)
- RLS (migrations): 018/019/020/021/022/024/039/040/041/046/055/059/065/071/077/093/
  094/097/109/115/128/129/130 — grep `is_admin|is_staff|is_tenant_admin`
- menu_schedule write = RPC เท่านั้น (grant scan + contract 145 G6)
- Notifications: `src/lib/notificationService.ts` + RLS own/admin
- Production: `supabase_migrations.schema_migrations` 118..145 (หลัง apply 145)

## 9. STATUS UPDATE — 2026-10-24 round 13 (Owner sign-off → IMPLEMENTED ทั้งหมด)

> Owner: **"P1-p3 อนุมัติ signoff · งาน missing ทำให้หมด · งาน partial ทำให้สมบูรณ์ทั้งระบบ ·
> จะรอทดสอบบนโปรดักชั่นจริงเท่านั้น"** → ลงมือแล้วผ่าน contract ทั้ง Docker และ production

| Gap/Stage | Label เดิม | **Label ใหม่ (หลักฐาน)** |
|---|---|---|
| #1 OWNER | MISSING | **IMPLEMENTED · DEPLOYED** — `owner` ใน profiles_role_check + `is_owner()` + is_admin ครอบ owner · แต่งตั้งด้วย `set_user_role` (สูตร SQL อยู่ acceptance #14) |
| #3 KITCHEN | partial | **IMPLEMENTED · DEPLOYED** — `is_kitchen()` + policies recipes/batches/batch_items + RPC guards `kitchen_queue`/`create_production_batch` (canonical 3-arg) |
| #4 INVENTORY | no-role | **IMPLEMENTED · DEPLOYED** — `is_inventory()` + inventory/inventory_transactions write policy + **GRANT S/I/U/D คืน** (034 เคยตัด = UI insert พังแฝง ตอนนี้ซ่อมแล้ว) |
| #5 FINANCE | no-role | **IMPLEMENTED · DEPLOYED** — `is_finance()` + daily_closings write policy + `close_day`/`get_daily_sales` gate +is_finance |
| #6 RIDER | PARTIAL | **IMPLEMENTED · DEPLOYED** — `rider` + backfill (production linked driver = rider แล้ว) + trigger `drivers_promote_rider` + 3 policies อ้าง `is_rider()` |
| #8 SUPPORT | MISSING | **IMPLEMENTED · DEPLOYED** — `support` + SELECT policies orders/order_items/customers/notifications (read-only พิสูจน์โดย contract 147 G5) |
| #9 MARKETING | no-role | **IMPLEMENTED · DEPLOYED** — `marketing` + posts/rules write policies + RPC gates 2 ตัว |
| #10 READ-ONLY AUDITOR | MISSING role | **IMPLEMENTED · DEPLOYED** — `auditor` + `_audit_read` SELECT policies 16 ตาราง + GRANT audit_logs · read-only พิสูจน์ G6 |
| #11 DEVELOPER | MISSING | **IMPLEMENTED · DEPLOYED** — `developer` (ชุด read เดียวกับ auditor) · พิสูจน์ G6 |
| P1 per-role nav | DEFERRED | **IMPLEMENTED · DEPLOYED** — `navGroupsForRole()` + AdminNav filter + AdminRoute `isAdminCapableRole` (11 ค่า) + role sync เข้า store |
| P1/P2/P3 staged proposal | BLOCKED | **SIGNED OFF 2026-10-24 → IMPLEMENTED** — migrations **146+147** (ledger 146/147 แล้ว) |
| assignment RPC | — | **IMPLEMENTED** — `set_user_role` (admin gate · owner-only owner-promote · self-guard · audit) — ยังไม่มี UI (ตาม scope เดิม) |

**หลักฐาน:** vitest 134 files/1385 tests exit 0 (roleSystem +10) · lint 0 · build 0 · tsc 0 ·
Docker replay ALL_GREEN (001→147) · contracts 127–147 ALL_PASS exit 0 · production
apply/verify/contract/record STAGE_OK ทุกขั้น (`e2e/r7Apply146-*.json`) ·
**ยังไม่ได้พิสูจน์ = runtime บนเบราว์เซอร์จริง (Owner checklist #14a-#14j)**