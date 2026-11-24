# BMB — Phase 0 Audit Report: Smart Ingredient & Cost Management
**วันที่:** 2026-11-24  
**สถานะ:** AUDIT COMPLETE — **OWNER APPROVED WITH CONDITIONS**  
**Scope:** Repository Audit, Existing Admin Consolidation & Architecture Plan  
**Owner Decision:** `OWNER DECISION — APPROVED WITH CONDITIONS` (2026-11-24)  

---

## 0. Owner Decisions Summary (Must Implement Exactly)

### 0.1 Approved Admin Navigation Target Structure (7 Hubs)
| Hub | Tabs | Source |
|-----|------|--------|
| **1. MenuHub** | Products/Menu, Recipes/BOM, Menu Schedule, Cost Analysis/Margin Simulation | Extend existing MenuHub |
| **2. InventoryHub** | Ingredient Master, Stock Overview, Stock Transactions, Low Stock Alerts | Move from SettingsHub + extend |
| **3. PurchaseHub** | Suppliers, Supplier Product Mapping, Purchase Orders, Goods Receiving (GRN), Purchase Price History, Receipt OCR/Price Review | NEW |
| **4. DeliveryHub** | Kitchen/Production, Delivery Rounds, Dispatch, Routes, Zones & Fees, Availability | Merge AdminKitchen + extend |
| **5. MarketingHub** | Posts, Promotions, AI Studio, Floating Ads, Media Library, Portfolio, Approval Queue | Merge 3 existing pages |
| **6. Customers & Communication** | Customers, Notifications, Reviews | KEEP existing |
| **7. Settings / Organization / Analytics** | SettingsHub, OrgHub, Reports/Analytics, Audit Log, System Errors | KEEP + extend |

**Constraints:** Reuse existing Hubs; Inventory NOT under Settings; Cost Analysis near Menu/Recipe; Purchase+Receiving together; preserve role-based nav; legacy routes redirect.

### 0.2 Cost Model Decisions (Binding)
1. **Append-only price history** — every purchase price recorded, never overwritten
2. **Separate Last Purchase Price from Moving Weighted Average (WAVG)** — different fields, different purposes
3. **Perpetual Moving Weighted Average = primary Stock Valuation method** — verify impact vs current before production use
4. **Landed Cost per GRN** — stored for audit trail, includes discount/shipping/tax allocation
5. **Separate Ingredient Preparation Yield from Recipe/Batch Yield** — prevent double-deducting waste
6. **Recipe Cost from BOM + actual ingredient costs** — Packaging/Other Unit Cost use existing product fields
7. **Cost Snapshots by period** — prevent today's price changes from affecting historical order COGS

### 0.3 OCR Configuration (Binding)
- **Priority 1:** GLM 5.3 Flash (verify vision, JSON mode, reasoning control)
- **Priority 2:** Qwen3.7-Flash / qwen/qwen-vl-plus (verify capabilities)
- **OpenRouter + existing AI Policy** — add OCR task, use `reasoning: { effort: "none" }`
- **Admin Review mandatory** — OCR only extracts, never approves prices or adjusts stock
- **Supplier mapping manual in Phase 1** — semi-auto in Phase 2, auto in Phase 3

### 0.4 Purchase & Stock Flow (Binding)
- **Two-step:** PO Approval (price commitment, no stock change) → GRN Posting (physical receipt, stock change)
- **Atomic, idempotent GRN** — prevent duplicate stock increments
- **Partial receipt, rejection, returns, price variance** handled at GRN level
- **Three price states:** Committed (PO), Realized (GRN), Approved (policy)

### 0.5 Phase Execution Rules (Binding)
- **Phase 1 authorized now** — Phase 2-6 approved roadmap only
- **No auto-advancement** — each Phase requires Owner gate review
- **No changes to:** `deduct_inventory_for_order`, `restore_inventory_for_order`, `transition_order_status`, existing COGS logic
- **All migrations:** RLS + Contract Tests + Rule 16.3 (Probe → Apply → Ledger)

---

## 1. Repository & Production Architecture Snapshot

### 1.1 Git State (2026-11-24)
| Item | Value |
|------|-------|
| **Branch** | `main` (up to date with `origin/main`) |
| **HEAD** | `b5ac4bd` (R105b — Background Music RLS Hotfix) |
| **Working Tree** | Clean (no staged/unstaged changes) |
| **Stash** | 1 stash: `local-edits-before-sync-2026-09-21` (old, unrelated) |
| **Migrations Applied Prod** | 213 (001–213) — verified via `schema_migrations` ledger |
| **Edge Functions Deployed** | 24 (ai-proxy, omise-*, stripe-*, create-checkout, queue-*, automation-*, social-*, cart-session-sync, background-music-*, floating-ad-config, etc.) |

### 1.2 Tech Stack (Verified from Code)
| Layer | Technology | Key Evidence |
|-------|------------|--------------|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 + Tailwind 4 | `package.json`, `vite.config.ts` |
| State | Zustand (`src/store/`, `src/stores/`) | `cartStore`, `authStore`, `biteAiStore` |
| Routing | react-router-dom 7 | `App.tsx` (27 public + 26 admin routes) |
| PWA | vite-plugin-pwa | `public/manifest.webmanifest`, `src/sw.ts` |
| Backend | Supabase (Postgres 16 + RLS + Edge Functions) | `supabase/migrations/` (213), `supabase/functions/` (24 EF) |
| Auth | Supabase Auth (Email, OAuth: Google/FB/LINE, Passkey) | `authStore.ts`, `LoginPage.tsx` |
| Payments | Omise (primary) + Stripe (fallback) + QR PromptPay + COD | `paymentGateway.ts`, EF `omise-*`, `stripe-*` |
| Testing | Vitest (230 files / 2,521 tests) + Playwright | `src/__tests__/`, `e2e/` |
| CI/CD | GitHub Actions → Cloudflare Pages | `.github/workflows/ci.yml`, `contract-tests.yml` |

### 1.3 Critical Architecture Constraints (Hard Rules from Code)
| Constraint | Evidence | Enforcement |
|------------|----------|-------------|
| **Single cart store** | `cartStore` canonical — all paths use `addItem` | R5c invariant: 1 cart = 1 order |
| **RLS 2-layer** | All 213 migrations have org + branch policies | `supabase/migrations/` — never bypass |
| **BKK Date (UTC+7)** | m190–193 + CI guard `contracts_190` | Class `CURRENT_DATE` forbidden in migrations |
| **Server-side cart sync** | `cart_sessions.payload` + `csa-<customerId>` deterministic | R103: guest = deep-link only |
| **AI never writes bare URLs** | `stripBareShopLinks` + `social-ai-worker` default CTA | R104 contract enforced in tests |
| **Edge Function scope** | 24 EF + `_shared` — each has single responsibility | Deploy individually, smoke test each |
| **Migration protocol** | Rule 16.3: probe marker → apply → record in `schema_migrations` | Manual apply without record = FAIL |
| **Test data hygiene** | Rule 16.1: AI test orders MUST be deleted | `e2e/_r86_delete_test_orders.cjs` precedent |

---

## 2. Existing Feature Matrix (with Evidence)

### 2.1 Recipe / BOM และสูตรอาหาร
| Feature | Status | Evidence |
|---------|--------|----------|
| **Recipes table (BOM)** | ✅ IMPLEMENTED | Migration 019: `public.recipes` (product_id, ingredient_id, quantity_per_unit, UNIQUE) |
| **Recipe CRUD API** | ✅ IMPLEMENTED | `src/lib/bmbAdminApi_recipes.ts`: `listRecipes`, `upsertRecipe`, `deleteRecipe` |
| **Admin Recipes Page** | ✅ IMPLEMENTED | `src/pages/admin/AdminRecipes.tsx` — product dropdown, ingredient dropdown (from inventory), qty per unit |
| **Recipe-Inventory Join** | ✅ IMPLEMENTED | RPC `list_recipes_with_inventory` (migration 037/035) joins `recipes` + `inventory` |
| **Recipe Costing** | ❌ MISSING | No cost fields in `recipes` table; `products` has `cogs`, `packaging_cost`, `other_unit_cost` (migration 170) but no BOM-level cost rollup |
| **Yield / Waste per Recipe** | ❌ MISSING | No yield_factor, waste_pct columns in `recipes` |
| **Sub-recipes** | ❌ MISSING | Flat structure only (product → ingredient) |

### 2.2 Ingredient Master และ Stock Management
| Feature | Status | Evidence |
|---------|--------|----------|
| **Inventory Table** | ✅ IMPLEMENTED | Migration 001: `inventory` (id, name, category, unit, current_stock, min_stock, max_stock, unit_price, supplier_name, supplier_phone, status, last_restocked_at) |
| **Inventory CRUD API** | ✅ IMPLEMENTED | `src/lib/bmbAdminApi_inventory.ts`: `getInventory`, `createInventory`, `updateInventoryStock`, `deleteInventory`, `getLowStockAlerts` |
| **Admin Inventory Page** | ✅ IMPLEMENTED | `src/pages/admin/InventoryPage.tsx` — full CRUD, low-stock alerts with urgency tiers, manual stock adjustment |
| **Inventory Transactions** | ✅ IMPLEMENTED | Migration 001: `inventory_transactions` (type: in/out/adjustment/waste, reference_type, reference_id, notes) |
| **Auto Status Calculation** | ✅ IMPLEMENTED | Trigger `update_inventory_status()` sets status from stock levels (in_stock/low_stock/out_of_stock) |
| **Auto Deduct at Confirm** | ✅ IMPLEMENTED | Migration 019: `deduct_inventory_for_order()` — deducts via recipes, creates transactions, auto sold-out (INV-02) |
| **Auto Restore at Cancel/Fail** | ✅ IMPLEMENTED | Migration 019: `restore_inventory_for_order()` — restores stock, recovers availability |
| **Aggregated Deduction Fix** | ✅ IMPLEMENTED | Migration 026: fixes v_done_ids bug — aggregates per ingredient across order items |
| **Purchase Order Table** | ⚠️ PARTIAL (TYPE ONLY) | `src/types/index.ts` defines `PurchaseOrder`, `PurchaseOrderItem` but **NO DB TABLE**, NO migration, NO API |
| **Supplier Master Table** | ❌ MISSING | Only `supplier_name`, `supplier_phone` text fields in `inventory` — no normalized supplier table |
| **Supplier Product Mapping** | ❌ MISSING | No mapping table linking supplier SKU → ingredient |
| **Unit Conversion (Purchase/Use)** | ❌ MISSING | Single `unit` field in inventory; no conversion factors |
| **Package Size, Gross/Net Weight** | ❌ MISSING | Not in schema |
| **Landed Cost Components** | ❌ MISSING | Only `unit_price` in inventory; no discount, shipping, tax breakdown |
| **Stock Valuation Method** | ❌ MISSING | No WAVG/FIFO/LIFO tracking; `unit_price` is single value |

### 2.3 Product / Menu / Menu Categories
| Feature | Status | Evidence |
|---------|--------|----------|
| **Products Table** | ✅ IMPLEMENTED | Migration 001 + 002 + 170: `products` (id, name, price, category_id, image_url, is_available, is_featured, is_preorder, prep_minutes, **cogs, packaging_cost, other_unit_cost**, unit_cost generated, branch_id) |
| **Categories (Menu Headings)** | ✅ IMPLEMENTED | Migration 001: `product_categories` + migration 055: `menu_sections` (Section → Category hierarchy) |
| **Admin Products Page** | ✅ IMPLEMENTED | `src/pages/admin/AdminProducts.tsx` — full CRUD, add-ons editor, margin calculator (real-time), AI image browser, category management, move/merge products |
| **Branch Overrides** | ✅ IMPLEMENTED | Migration 092: `product_branch_overrides` (per-branch availability, stock, sort_order) |
| **Pre-order / Same-day Gates** | ✅ IMPLEMENTED | Migration 023: `available_same_day`, `available_preorder` canonical columns; per-category switches (migration 185) |
| **Gross Margin Display** | ✅ IMPLEMENTED | `src/lib/marginCalc.ts` — computes unit_cost = cogs + packaging + other; gross profit, margin %, tier label |

### 2.4 Supplier และ Purchase Management
| Feature | Status | Evidence |
|---------|--------|----------|
| **Supplier Table** | ❌ MISSING | Only denormalized `supplier_name`, `supplier_phone` in `inventory` |
| **Purchase Orders** | ❌ MISSING | Types exist (`src/types/index.ts`) but no DB table, no migration, no API |
| **Purchase Price History** | ❌ MISSING | No history table; `inventory.unit_price` is single current value |
| **Supplier Product Mapping** | ❌ MISSING | No mapping table |
| **Goods Receipt / GRN** | ❌ MISSING | No receiving workflow; stock update is manual via `updateInventoryStock` |
| **Invoice Matching (3-way)** | ❌ MISSING | Not implemented |

### 2.5 Order, Sales และต้นทุนที่เกี่ยวข้อง
| Feature | Status | Evidence |
|---------|--------|----------|
| **Orders Table** | ✅ IMPLEMENTED | Migration 001: `orders` (full order lifecycle, delivery rounds, payment, totals) |
| **Order Items** | ✅ IMPLEMENTED | Migration 001: `order_items` (product_id, quantity, unit_price, customizations, item_total trigger) |
| **Order Status Transition** | ✅ IMPLEMENTED | Migration 019/025/030: `transition_order_status` RPC with canonical hop chain (m212: preparing → ready_for_dispatch → dispatched → in_transit → arrived → delivered) |
| **Server-side Cart Sync** | ✅ IMPLEMENTED | Migration 213: `cart_sessions.payload` + `csa-<customerId>` deterministic; R103 |
| **Cross-channel Cart (Deep-link)** | ✅ IMPLEMENTED | R101–R104: `?cart=` v2 payload (mods, line_mode), IAB guard, 1 reply = 1 link |
| **Payment (Omise/Stripe/QR/COD)** | ✅ IMPLEMENTED | 4 payment EFs + `paymentGateway.ts` unified interface; webhook idempotency |
| **Recipe Cost → Order Cost** | ❌ MISSING | Orders store `unit_price` (selling price); no COGS rollup from BOM at order time |
| **Margin Analysis per Order** | ❌ MISSING | No per-order COGS/margin stored; `AdminReports` shows revenue only |

### 2.6 Admin Navigation, Sidebar, Tabs, Pages และ Settings
| Feature | Status | Evidence |
|---------|--------|----------|
| **Admin Nav Groups (3 groups)** | ✅ IMPLEMENTED | `src/lib/adminUi.ts`: `ADMIN_NAV_GROUPS` — Operations, Customers, Settings |
| **Per-Role Nav Filtering** | ✅ IMPLEMENTED | `ROLE_NAV_ALLOW` map for pos/kitchen/inventory/finance/marketing/support |
| **Admin Hubs (Composed Pages)** | ✅ IMPLEMENTED | `src/components/admin/AdminHubs.tsx`: OrdersHub, DeliveryHub, SettingsHub, MenuHub, OrgHub |
| **Settings Hub Tabs** | ✅ IMPLEMENTED | 6 tabs: store, print, mascot, music, storefront, (generic JSON editor for other keys) |
| **Business Settings API** | ✅ IMPLEMENTED | `src/lib/bmbAdminApi_settings.ts`: `getBusinessSettings`, `setBusinessSetting` via RPC |
| **Settings Keys (Typed)** | ✅ IMPLEMENTED | `order_policy`, `social_links`, `seo`, `store_status_copy`, `store_master_open`, `cod_enabled`, `crm_automation`, `promotion_policy`, `floating_ad_enabled` |
| **Generic JSON Editor** | ✅ IMPLEMENTED | For any other keys in `business_settings` |

### 2.7 AI / OpenRouter Configuration และ OCR Infrastructure
| Feature | Status | Evidence |
|---------|--------|----------|
| **AI Routing Policy (Server)** | ✅ IMPLEMENTED | `supabase/functions/_shared/aiPolicy.ts`: task → model mapping, primary/fallback, maxTokens, timeout, ACTIVE/RESERVED |
| **AI Proxy EF** | ✅ IMPLEMENTED | `supabase/functions/ai-proxy/index.ts`: server-side routing, guardrails, rate limit, streaming, fallback retry |
| **Client Model Resolution** | ✅ IMPLEMENTED | `src/lib/aiModels.ts` re-exports policy; `resolveModelA(envModel)` |
| **Models (Current)** | ✅ CONFIGURED | Web: qwen/qwen3.7-flash (primary), xiaomi/mimo-v2.6-flash (fallback); FB: deepseek/deepseek-v4-flash → qwen/qwen3.7-flash; STT: google/gemini-2.5-flash → whisper-large-v3 (Groq) |
| **Reasoning Control** | ✅ IMPLEMENTED | `REASONING_OFF = { enabled: false }` passed to OpenRouter for qwen3.7-flash |
| **Vision/OCR Models** | ❌ NOT CONFIGURED | No vision model in policy; no OCR pipeline; `image-gen` EF uses qwen/qwen-image-2.1-pro + seedream for generation only |
| **OCR Infrastructure** | ❌ MISSING | No receipt OCR EF, no image upload for OCR, no parsing logic, no review workflow |

---

## 3. Recipe → Ingredient → Stock → Purchase → Order Data Flow

### 3.1 Current Flow (Verified from Code)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Product   │────▶│   Recipes   │────▶│  Inventory  │
│  (Menu)     │     │   (BOM)     │     │  (Stock)    │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Order Item │     │ get_inventory│     │ inventory_  │
│  (qty,price)│     │ _requirements│     │ transactions│
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │         ┌──────────┴──────────┐       │
       │         ▼                     ▼       ▼
       │  ┌─────────────┐         ┌─────────────┐
       │  │transition_  │         │  deduct_    │
       └─▶│ order_status│────────▶│ inventory_  │
          │   (confirm) │         │ for_order   │
          └─────────────┘         └─────────────┘
                 │                        │
                 │                        ▼
                 │                 ┌─────────────┐
                 │                 │  Auto       │
                 │                 │  Sold-out   │
                 │                 │  (INV-02)   │
                 │                 └─────────────┘
                 │
                 ▼
          ┌─────────────┐
          │  Order      │
          │  Completed  │
          └─────────────┘
```

### 3.2 Key Functions (Verified)
| Function | Migration | Purpose |
|----------|-----------|---------|
| `get_inventory_requirements(product_id, qty)` | 019 | Returns BOM ingredients with required qty, current stock, feasibility |
| `deduct_inventory_for_order(order_number)` | 019 | Atomic deduct at CONFIRM; creates `inventory_transactions` type='out'; triggers auto sold-out |
| `restore_inventory_for_order(order_number)` | 019 | Atomic restore at CANCEL/FAIL; reverses transactions; recovers availability |
| `transition_order_status(order_number, new_status)` | 019/025 | Canonical state machine; calls deduct/restore at confirm/cancel |
| `list_recipes_with_inventory()` | 037 | Admin API: recipes joined with inventory (name, unit, category, stock status) |

### 3.3 Missing Links for Cost Management
| Missing Link | Impact |
|--------------|--------|
| **Recipe-level cost** | Cannot compute dish COGS from BOM (only product-level `cogs` manual entry) |
| **Purchase price history** | No trend analysis; `unit_price` overwritten |
| **Landed cost breakdown** | No discount/shipping/tax capture |
| **Yield/Waste factor** | Recipe qty_per_unit = theoretical; no yield adjustment |
| **Stock valuation method** | No WAVG/FIFO — `unit_price` single value |
| **Supplier master** | No normalized supplier data; denormalized in inventory |
| **Purchase order → GRN → Stock** | No receiving workflow; stock update manual |

---

## 4. Admin Navigation Audit & Consolidation Plan

### 4.1 Current Admin Nav Structure (from `src/lib/adminUi.ts`)

| Group ID | Label | Items (to, label, icon) |
|----------|-------|-------------------------|
| **operations** | ดำเนินงาน | `/admin` (ภาพรวม), `/admin/orders` (ออเดอร์), `/admin/pos` (POS), `/admin/kitchen` (ครัว/ผลิต), `/admin/recipes` (สูตรอาหาร), `/admin/products` (เมนูและตารางเมนู), `/admin/marketing` (การตลาดและโปรโมชั่น) |
| **customers** | ลูกค้าและเนื้อหา | `/admin/customers` (ลูกค้า), `/admin/notifications` (การแจ้งเตือน), `/admin/media-portfolio` (คลังรูปภาพและผลงาน), `/admin/reviews` (อนุมัติรีวิว) |
| **settings** | ตั้งค่าระบบ | `/admin/inventory` (สต็อกวัตถุดิบ), `/admin/reports` (รายงานการเงิน), `/admin/delivery` (การขนส่ง), `/admin/audit-log` (บันทึกการทำงาน), `/admin/errors` (ปัญหาระบบ), `/admin/settings` (ตั้งค่าร้าน), `/admin/tenants` (องค์กรและแบรนด์), `/admin/onboarding` (เปิดร้านใหม่), `/admin/billing` (งวดบริการ) |

### 4.2 Current Hub Composition (from `src/components/admin/AdminHubs.tsx`)

| Hub | Title | Tabs (key, label, component) |
|-----|-------|------------------------------|
| **OrdersHub** | ออเดอร์และการชำระเงิน | `orders` (📦 ออเดอร์ → AdminOrders), `payment` (💳 การชำระเงิน/ตรวจสลิป → AdminPaymentExceptions) |
| **DeliveryHub** | การจัดการขนส่ง | `rounds` (🕒 รอบจัดส่ง & แพทเทิร์น → AdminRounds), `availability` (✅ ความพร้อมรับออเดอร์ → TransportAvailabilityBoard), `dispatch` (🛵 จัดส่ง/มอบหมายงาน → DeliveryManagement), `routes` (🗺️ วางแผนเส้นทาง → RouteOptimizationPage), `fees` (💰 ค่าส่ง/โซน → DeliveryZonesPanel) |
| **SettingsHub** | ตั้งค่าร้าน | `store` (⚙️ ตั้งค่าร้าน/สาขา → AdminSettings), `print` (🖨️ เครื่องพิมพ์ → AdminPrintSettings), `mascot` (🤖 มาสคอต → MascotSettingsPage), `music` (🎵 เพลงพื้นหลัง → BackgroundMusicSettingsPage), `storefront` (🏪 หน้าร้าน → StoreFrontSettingsPage) |
| **MenuHub** | เมนูและตารางเมนู | `products` (🍽️ เมนู/สินค้า → AdminProducts), `schedule` (📅 ตารางเมนูรอบพิเศษ → AdminMenuSchedule) |
| **OrgHub** | องค์กรและแบรนด์ | `tenants` (🏢 องค์กร/ร้านค้า → AdminTenants), `brands` (🏳️ แบรนด์ → AdminBrands) |

### 4.3 Standalone Admin Pages (Not in Hubs)
| Page | Route | Note |
|------|-------|------|
| AdminDashboard | `/admin` | Root dashboard |
| AdminKitchen | `/admin/kitchen` | Production batches, kitchen queue |
| AdminRecipes | `/admin/recipes` | BOM management |
| AuditLogPage | `/admin/audit-log` | Server-side audit trail |
| AdminErrorsPage | `/admin/errors` | Error monitoring |
| AdminCustomers | `/admin/customers` | Customer management |
| AdminNotifications | `/admin/notifications` | Notification center |
| AdminReports | `/admin/reports` | Financial reports |
| AdminPos | `/admin/pos` | Web POS |
| AdminOnboarding | `/admin/onboarding` | New store wizard |
| AdminBilling | `/admin/billing` | Subscription billing |
| AdminMarketing | `/admin/marketing` | Marketing posts, studio, floating ad |
| AdminMarketingPromotions | `/admin/marketing-promotions` | Promotions management |
| AdminMediaPortfolio | `/admin/media-portfolio` | Media library + portfolio |
| AdminReviews | `/admin/reviews` | Review approval queue |
| AdminRounds | `/admin/rounds` | (Redirected to DeliveryHub) |
| AdminSettings | `/admin/settings` | (In SettingsHub) |
| AdminPrintSettings | `/admin/print-settings` | (Redirected to SettingsHub) |
| AdminTenants | `/admin/tenants` | (In OrgHub) |
| AdminBrands | `/admin/brands` | (Redirected to OrgHub) |

### 4.4 Redundancy & Consolidation Analysis

| Issue | Current State | Impact |
|-------|---------------|--------|
| **Recipes + Inventory split** | `/admin/recipes` (standalone) + `/admin/inventory` (in SettingsHub) | Same data domain (BOM ↔ Stock); user must switch pages to see recipe + stock together |
| **Products + Recipes split** | `/admin/products` (MenuHub) + `/admin/recipes` (standalone) | Product creation and BOM editing separated |
| **Delivery split** | DeliveryHub (5 tabs) + standalone AdminKitchen | Kitchen production batches related to delivery rounds |
| **Marketing split** | `/admin/marketing` (standalone) + `/admin/marketing-promotions` (standalone) + `/admin/media-portfolio` (standalone) | 3 pages for marketing content; could be unified |
| **SettingsHub has Inventory but not Recipes** | Inventory tab in SettingsHub; Recipes separate | Inconsistent grouping |
| **Reports standalone** | `/admin/reports` not in any hub | Financial reports should be near orders/pos |

### 4.5 Approved Target Navigation Structure (Owner Decision — Binding)

The Owner has approved the following 7-Hub structure. This replaces all previous proposals.

| Hub | Title | Tabs (key, label, component) | Implementation |
|-----|-------|------------------------------|----------------|
| **1. MenuHub** | เมนูและสินค้า | `products` (🍽️ เมนู/สินค้า → AdminProducts), `recipes` (🧪 สูตรอาหาร/BOM → AdminRecipes), `schedule` (📅 ตารางเมนูรอบพิเศษ → AdminMenuSchedule), `cost-analysis` (📊 ต้นทุนและกำไร → **NEW** CostAnalysisPage) | Extend existing MenuHub |
| **2. InventoryHub** | วัตถุดิบและคลัง | `master` (📦 วัตถุดิบ → InventoryPage), `overview` (📈 ภาพรวมสต็อก → **NEW** StockOverviewPage), `transactions` (📋 รายการเคลื่อนไหว → **NEW** StockTransactionsPage), `alerts` (⚠️ แจ้งเตือนสต็อกต่ำ → Low Stock from InventoryPage) | Move from SettingsHub + extend |
| **3. PurchaseHub** | จัดซื้อและซัพพลายเออร์ | `suppliers` (🏪 ผู้ขาย → **NEW** SupplierMasterPage), `mapping` (🔗 Mapping ผู้ขาย-วัตถุดิบ → **NEW** SupplierMappingPage), `purchase-orders` (📋 ใบสั่งซื้อ → **NEW** PurchaseOrderPage), `receiving` (📥 รับสินค้า/GRN → **NEW** GoodsReceiptPage), `price-history` (📊 ประวัติราคา → **NEW** PriceHistoryPage), `ocr-review` (🔍 ตรวจสอบ OCR → **NEW** OCRReviewPage) | NEW Hub |
| **4. DeliveryHub** | ครัวและจัดส่ง | `kitchen` (🍳 ครัว/ผลิต → AdminKitchen), `rounds` (🕒 รอบจัดส่ง → AdminRounds), `dispatch` (🛵 จัดส่ง/มอบหมาย → DeliveryManagement), `routes` (🗺️ วางแผนเส้นทาง → RouteOptimizationPage), `zones-fees` (💰 โซน/ค่าส่ง → DeliveryZonesPanel), `availability` (✅ ความพร้อม → TransportAvailabilityBoard) | Merge AdminKitchen + extend |
| **5. MarketingHub** | การตลาดและเนื้อหา | `posts` (📝 โพสต์ → AdminMarketing), `promotions` (🎁 โปรโมชั่น → AdminMarketingPromotions), `studio` (🎨 AI Studio → AdminMarketing), `floating-ads` (🫘 Floating Ads → AdminMarketing), `media` (🖼️ คลังรูปภาพ → AdminMediaPortfolio), `portfolio` (🖼️ ผลงาน → AdminMediaPortfolio), `approval` (✅ คิวอนุมัติ → AdminMarketing) | Merge 3 existing pages |
| **6. Customers & Communication** | ลูกค้าและการสื่อสาร | `customers` (👥 ลูกค้า → AdminCustomers), `notifications` (🔔 การแจ้งเตือน → AdminNotifications), `reviews` (⭐ รีวิว → AdminReviews) | KEEP existing |
| **7. Settings / Org / Analytics** | ตั้งค่า/องค์กร/วิเคราะห์ | `settings` (⚙️ SettingsHub), `org` (🏢 OrgHub), `reports` (📊 Reports/Analytics → AdminReports + **NEW** CostAnalyticsPage), `audit` (📋 Audit Log → AuditLogPage), `errors` (🐛 System Errors → AdminErrorsPage) | Extend existing |

**Constraints (Binding):**
- Reuse existing Hubs before creating new ones
- InventoryHub MUST NOT be under SettingsHub
- Cost Analysis tab in MenuHub (near Recipe/BOM)
- PurchaseHub contains both PO and GRN (same context)
- All legacy routes redirect via `<Navigate replace />` preserving query params
- Role-based nav filtering (`ROLE_NAV_ALLOW`) preserved

### 4.6 Consolidation Action Matrix (Updated per Owner Decision)

| Current Page/Tab | Target Hub | Action | Impact |
|------------------|------------|--------|--------|
| `/admin/recipes` (standalone) | MenuHub → `recipes` tab | **MOVE** | Redirect to `/admin/products?tab=recipes` |
| `/admin/inventory` (SettingsHub) | InventoryHub → `master` tab | **MOVE** | Redirect to `/admin/inventory?tab=master` |
| `/admin/kitchen` (standalone) | DeliveryHub → `kitchen` tab | **MOVE** | Redirect to `/admin/delivery?tab=kitchen` |
| `/admin/marketing` + `/admin/marketing-promotions` + `/admin/media-portfolio` | MarketingHub (merged) | **MERGE** | 3 routes → 1 hub with 7 tabs |
| `/admin/reports` (standalone) | Settings/Org/Analytics → `reports` tab | **MOVE** | Redirect to `/admin/settings?tab=reports` |
| **NEW**: Supplier Master | PurchaseHub → `suppliers` tab | **CREATE** | New table, RLS, API, page |
| **NEW**: Supplier Mapping | PurchaseHub → `mapping` tab | **CREATE** | New table, RLS, API, page |
| **NEW**: Purchase Orders | PurchaseHub → `purchase-orders` tab | **CREATE** | New table, RLS, API, page |
| **NEW**: GRN/Receiving | PurchaseHub → `receiving` tab | **CREATE** | New workflow, inventory_transactions type='in' |
| **NEW**: Price History | PurchaseHub → `price-history` tab | **CREATE** | ingredient_price_history table |
| **NEW**: OCR Review | PurchaseHub → `ocr-review` tab | **CREATE** | ocr_jobs table + review workflow |
| **NEW**: Cost Analysis | MenuHub → `cost-analysis` tab | **CREATE** | Recipe costing + margin simulation |
| **NEW**: Stock Overview | InventoryHub → `overview` tab | **CREATE** | Dashboard view |
| **NEW**: Stock Transactions | InventoryHub → `transactions` tab | **CREATE** | inventory_transactions view |

### 4.7 Deep Link Preservation Strategy
All existing routes MUST remain accessible via redirect:
```typescript
// Example: /admin/recipes → /admin/products?tab=recipes
<Route path="/admin/recipes" element={<Navigate to="/admin/products?tab=recipes" replace />} />
```
This preserves bookmarks, shared links, and browser history.

---

## 5. Smart Ingredient & Cost Management — Readiness & Gaps

### 5.1 Current State Assessment

| Domain | Component | Status | Gap Details |
|--------|-----------|--------|-------------|
| **Ingredient Master** | `inventory` table | ✅ IMPLEMENTED | Core fields exist; missing: yield_factor, waste_pct, package_size, gross_weight, net_weight, conversion factors |
| **Supplier Master** | Denormalized in inventory | ❌ MISSING | No dedicated table; no supplier_id FK; no contact info beyond name/phone; no payment terms, lead time |
| **Supplier Product Mapping** | None | ❌ MISSING | No mapping table (supplier_sku ↔ ingredient_id, supplier_unit, conversion_factor, last_price, effective_date) |
| **Purchase Price History** | Single `unit_price` | ❌ MISSING | No history table; overwritten on each manual update; no trend analysis |
| **Purchase Unit / Use Unit / Conversion** | Single `unit` field | ❌ MISSING | No purchase_unit, use_unit, conversion_factor (e.g., buy in "carton/24pcs", use in "piece") |
| **Package Size, Gross/Net Weight** | None | ❌ MISSING | Not in schema |
| **Landed Cost Components** | Single `unit_price` | ❌ MISSING | No discount, shipping, tax, insurance breakdown; no landed_cost = unit_price + freight + tax + insurance - discount |
| **Yield / Waste** | None | ❌ MISSING | No yield_factor (e.g., 0.85 for vegetable trim), waste_pct in recipes or ingredients |
| **Recipe Costing** | Product-level `cogs` only | ⚠️ PARTIAL | Product has manual `cogs`, `packaging_cost`, `other_unit_cost`; no BOM rollup from ingredient costs |
| **Stock Valuation** | Single `unit_price` | ❌ MISSING | No WAVG/FIFO/LIFO; no valuation layers; `unit_price` is manual entry |
| **Cost Change Impact** | None | ❌ MISSING | No "what-if" simulation when ingredient price changes; no affected menu list with new margins |

### 5.2 Cost Definitions (Owner Approved — Binding)

| Term | Definition | Storage |
|------|------------|---------|
| **Last Purchase Price** | Most recent GRN line landed cost per use unit for this ingredient | `ingredient_price_history` (latest realized) + dedicated field on ingredient |
| **Moving Weighted Average Cost (WAVG)** | Perpetual: `SUM(layer_qty × layer_cost) / SUM(layer_qty)` across all realized GRN receipts | Computed on demand; cached per ingredient |
| **Landed Cost (per GRN line)** | `purchase_unit_price + (shipping + tax + insurance - discount) / qty_received` allocated per line, converted to use unit | `goods_receipt_items.landed_cost_per_use_unit` + `ingredient_price_history` |
| **Recipe Cost (Raw)** | `SUM(ingredient_qty_per_unit × ingredient_wavg_cost)` | Computed via RPC `calculate_recipe_cost` |
| **Ingredient Preparation Yield** | Loss from raw purchase to usable form (peel, trim, thaw) — e.g., 0.85 for vegetables | `inventory.prep_yield_factor` (default 1.0) |
| **Ingredient Waste %** | Expected waste during prep — separate from yield | `inventory.prep_waste_pct` (default 0) |
| **Recipe / Batch Yield** | Loss during cooking/batching — e.g., evaporation, trim | `recipes.batch_yield_factor` (default 1.0) |
| **Recipe Cost (Yield-Adjusted)** | `Recipe_Cost_Raw / (prep_yield_factor × batch_yield_factor)` | Prevents double-deducting waste |
| **Product COGS (from BOM)** | `Recipe_Cost_Yield_Adjusted + packaging_cost + other_unit_cost` | Uses existing `products.packaging_cost`, `products.other_unit_cost` |
| **Stock Valuation** | `WAVG × current_stock` (Perpetual Moving Weighted Average) | Replaces manual `unit_price` for valuation |
| **Cost Snapshot** | Periodic freeze of product COGS + ingredient WAVG for historical reporting | `cost_analysis_snapshots` table |

**Critical Rules:**
- **No double waste deduction:** Ingredient prep yield/waste applies at ingredient level; Recipe batch yield applies at recipe level. Never apply same waste factor twice.
- **Historical COGS immutable:** Cost snapshots freeze COGS at order time. Today's price changes never retroactively alter past order margins.
- **`inventory.unit_price` legacy field:** RETAIN for backward compatibility. New WAVG stored separately. Migration must document mapping.
- **Landed cost allocation:** Shipping/tax/discount allocated proportionally by line subtotal unless admin overrides.

### 5.3 Unit Conversion Standard (Owner Approved — Binding)

**Definition:** `conversion_factor` = **quantity of USE UNITS per 1 PURCHASE UNIT**

| Example | Purchase Unit | Use Unit | conversion_factor | Calculation |
|---------|---------------|----------|-------------------|-------------|
| Carton of bottles | carton | bottle | 24 | 1 carton = 24 bottles |
| Bottle of sauce | bottle | ml | 500 | 1 bottle = 500 ml |
| Carton → ml | carton | ml | 12,000 | 24 × 500 = 12,000 |
| Kg → g | kg | g | 1,000 | 1 kg = 1,000 g |

**Formula:**
```
use_unit_qty = purchase_qty × conversion_factor
landed_cost_per_use_unit = landed_cost_per_purchase_unit / conversion_factor
```

**Validation Rules:**
- `conversion_factor > 0`
- `purchase_unit` and `use_unit` must be defined for each supplier_product mapping
- Inventory base unit = `use_unit` (all internal calculations in use units)

### 5.4 Yield / Waste Separation (Owner Approved — Binding)

| Level | Factor | Purpose | Example |
|-------|--------|---------|---------|
| **Ingredient Prep** | `prep_yield_factor` (0-1) | Raw → Usable (peel, trim, thaw) | Carrot 1kg → 0.85kg usable = 0.85 |
| **Ingredient Prep** | `prep_waste_pct` (0-100) | Expected waste % during prep | 15% waste = 15 |
| **Recipe / Batch** | `batch_yield_factor` (0-1) | Cooking/batch loss (evaporation, trim) | Soup 10L → 9L after simmer = 0.90 |

**Calculation Chain:**
```
Purchased Qty (purchase unit)
    → × conversion_factor
    = Qty in Use Units
    × prep_yield_factor
    = Usable Qty for Recipe
    × qty_per_unit (per recipe)
    = Raw Recipe Ingredient Qty
    × batch_yield_factor
    = Final Yield per Recipe Unit
```

**Enforcement:** Migration adds `prep_yield_factor`, `prep_waste_pct` to `inventory`; `batch_yield_factor` to `recipes`. RPC `calculate_recipe_cost` uses both.

### 5.5 Purchase Price History States (Owner Approved — Binding)

| State | Source | Trigger | Stock Impact | Use for Valuation |
|-------|--------|---------|--------------|-------------------|
| **Committed** | PO Approval | Admin approves PO | NONE | NO — reference only |
| **Realized** | GRN Posting | Warehouse confirms receipt | YES — stock increases | YES — feeds WAVG |
| **Approved** | Policy Gate | Admin/auto approves for costing | N/A | YES — if different from Realized |

**Flow:**
```
Draft PO → Approve PO (Committed) → Receive GRN (Realized) → Approve for Costing (Approved)
     │              │                    │                        │
     ▼              ▼                    ▼                        ▼
  price_history  price_history      price_history           price_history
  status='committed'  status='realized'  status='approved'
  no stock change   stock += qty       feeds WAVG            costing uses this
```

**Validation:** GRN posting must be atomic + idempotent. Duplicate GRN for same PO line = blocked or creates variance record.

### 5.6 Required Database Changes (Phase 1+) — Corrected per Owner Decisions

| Table | New Columns / Tables | Purpose | Owner Notes |
|-------|----------------------|---------|-------------|
| `inventory` | `prep_yield_factor` (numeric, default 1.0), `prep_waste_pct` (numeric, default 0), `purchase_unit` (text), `use_unit` (text), `conversion_factor` (numeric, default 1), `package_size` (numeric), `gross_weight` (numeric), `net_weight` (numeric), `supplier_id` (FK), `wavg_cost` (numeric, generated), `last_purchase_price` (numeric) | Enrich ingredient master; separate prep yield from batch yield; store WAVG separately from legacy unit_price | `unit_price` RETAINED for backward compat; `wavg_cost` is new valuation field |
| **NEW** `suppliers` | `id`, `name`, `code`, `contact_name`, `phone`, `email`, `address`, `payment_terms_days`, `lead_time_days`, `is_active`, `created_at`, `updated_at`, `tenant_id`, `branch_id` | Normalized supplier master | Create FIRST (B5), then add FK to inventory |
| **NEW** `supplier_products` | `id`, `supplier_id`, `ingredient_id`, `supplier_sku`, `supplier_name`, `purchase_unit`, `use_unit`, `conversion_factor`, `last_committed_price`, `last_realized_price`, `last_approved_price`, `last_purchase_date`, `min_order_qty`, `lead_time_days`, `is_preferred`, `tenant_id`, `branch_id` | Supplier ↔ Ingredient mapping with 3 price states | Price states: committed/realized/approved |
| **NEW** `purchase_orders` | `id`, `supplier_id`, `branch_id`, `status` (draft/pending/ordered/received/cancelled), `expected_date`, `total_committed_amount`, `discount`, `shipping`, `tax`, `notes`, `created_by`, `created_at`, `updated_at`, `tenant_id` | Purchase order header (price commitment only) | NO stock change on approve |
| **NEW** `purchase_order_items` | `id`, `purchase_order_id`, `ingredient_id`, `supplier_product_id`, `qty_ordered`, `purchase_unit`, `committed_unit_price`, `discount`, `shipping_allocated`, `tax_allocated`, `committed_landed_cost_per_use_unit` | PO line items with committed landed cost | Committed prices only |
| **NEW** `goods_receipts` | `id`, `purchase_order_id`, `branch_id`, `received_date`, `received_by`, `notes`, `created_at`, `tenant_id` | GRN header (physical receipt event) | Links to PO |
| **NEW** `goods_receipt_items` | `id`, `goods_receipt_id`, `purchase_order_item_id`, `ingredient_id`, `qty_received`, `realized_unit_price`, `realized_landed_cost_per_use_unit`, `quality_status` (ok/partial/rejected), `variance_notes` | GRN line items; triggers stock + WAVG update | Atomic, idempotent; realized prices |
| **NEW** `ingredient_price_history` | `id`, `ingredient_id`, `supplier_id`, `purchase_unit_price`, `landed_cost_per_use_unit`, `effective_date`, `source` (po_committed/grn_realized/grn_approved/manual), `reference_id`, `status` (committed/realized/approved), `wavg_after` (numeric), `tenant_id` | Append-only price history with 3 states | `wavg_after` captures WAVG after this entry |
| `recipes` | `batch_yield_factor` (numeric, default 1.0), `batch_waste_pct` (numeric, default 0), `cost_per_unit` (generated), `last_cost_calculated_at` | Recipe-level costing with batch yield | Separate from ingredient prep yield |
| **NEW** `cost_analysis_snapshots` | `id`, `product_id`, `ingredient_id`, `snapshot_date`, `product_cogs`, `ingredient_wavg`, `recipe_cost`, `margin_pct`, `tenant_id` | Periodic cost freeze for historical reporting | Prevents retroactive COGS changes |

### 5.7 Calculation Logic (Owner Approved — Binding)

| Calculation | Formula | Trigger |
|-------------|---------|---------|
| **Committed Landed Cost/Use Unit (PO)** | `committed_landed_cost = (committed_unit_price × conversion_factor) + (shipping + tax + insurance - discount) / qty_ordered` | PO Approve |
| **Realized Landed Cost/Use Unit (GRN)** | `realized_landed_cost = (realized_unit_price × conversion_factor) + (shipping + tax + insurance - discount) / qty_received` | GRN Post |
| **WAVG Update** | `new_wavg = (old_wavg × old_stock + realized_landed_cost × qty_received) / (old_stock + qty_received)` | GRN Post (atomic) |
| **Recipe Cost (Raw)** | `SUM(ingredient_qty_per_unit × ingredient_wavg_cost)` | RPC `calculate_recipe_cost` |
| **Recipe Cost (Yield-Adjusted)** | `Recipe_Cost_Raw / (prep_yield_factor × batch_yield_factor)` | RPC `calculate_recipe_cost` |
| **Product COGS** | `Recipe_Cost_Yield_Adjusted + packaging_cost + other_unit_cost` | RPC `calculate_product_cogs` |
| **Margin Impact Simulation** | `New_Margin = (Price - New_COGS) / Price` | Admin Cost Analysis tab |

---

## 6. Hybrid Price Input — Feasibility Assessment (Updated)

### 6.1 Channel Assessment

| Channel | Feasibility | Current Status | Requirements |
|---------|-------------|----------------|--------------|
| **Makro Official API / Partner Feed** | ⚠️ UNVERIFIED | No integration | Must verify: partnership agreement, API access, rate limits, data freshness, Terms of Service. **Cannot assume public API exists.** |
| **OCR ใบเสร็จ (Receipt OCR)** | ✅ FEASIBLE (Infra missing) | No OCR pipeline | Requires: vision-capable model (GLM 5.3 Flash / Qwen-VL), image upload EF, parsing logic, review workflow, duplicate detection |
| **Supplier CSV / Excel** | ✅ FEASIBLE | No import tool | Requires: standard template, column mapping, validation, preview, admin approval before commit |
| **Manual Price Entry** | ✅ IMPLEMENTED | `InventoryPage` has unit_price input | Already works; needs enhancement: history, audit trail, approval workflow |

### 6.2 Central Price Registry Requirement
All channels MUST feed into a **single source of truth**:
- `ingredient_price_history` (append-only)
- Current `inventory.unit_price` = latest approved landed cost per use unit
- Every price change: create history record → update current → audit log

### 6.3 Approval Workflow (Mandatory)
| Step | Description |
|------|-------------|
| 1. **Input** | OCR result / CSV import / Manual entry → creates **Draft Price Record** |
| 2. **Validation** | System checks: price variance vs history (%), required fields, duplicate detection |
| 3. **Admin Review** | Price Review page shows: ingredient, old price, new price, variance %, source, confidence (OCR) |
| 4. **Approve/Reject/Adjust** | Admin approves → writes to `ingredient_price_history` + updates `inventory.unit_price` + audit log |
| 5. **Propagate** | Trigger recipe cost recalculation → product margin update → alert if margin below threshold |

---

## 7. OCR — OpenRouter Configuration

### 7.1 Current AI Policy (Verified from `supabase/functions/_shared/aiPolicy.ts`)

| Task | Primary Model | Fallback Model | Max Tokens | Timeout | Status |
|------|---------------|----------------|------------|---------|--------|
| chat | qwen/qwen3.7-flash | xiaomi/mimo-v2.6-flash | 1800 | 30s | ACTIVE |
| streaming | qwen/qwen3.7-flash | xiaomi/mimo-v2.6-flash | 1800 | 45s | ACTIVE |
| recommendation | qwen/qwen3.7-flash | xiaomi/mimo-v2.6-flash | 1500 | 30s | ACTIVE |
| voice_stt | google/gemini-2.5-flash | whisper-large-v3 (Groq) | 300 | 60s | ACTIVE |
| content_automation | deepseek/deepseek-v4-flash | qwen/qwen3.7-flash | 2200 | 60s | ACTIVE |
| admin_ai | qwen/qwen3.7-flash | xiaomi/mimo-v2.6-flash | 1800 | 30s | ACTIVE |
| social_post_draft | deepseek/deepseek-v4-flash | qwen/qwen3.7-flash | 2200 | 60s | ACTIVE |

### 7.2 Required OCR Models (Per Plan)
| Priority | Model ID | Vision? | Reasoning: none? | JSON Mode? | OpenRouter Routing? |
|----------|----------|---------|------------------|------------|---------------------|
| 1 | GLM 5.3 Flash | Need to verify | Need to verify | Need to verify | Need to verify |
| 2 | Qwen3.7-Flash / qwen/qwen-vl-plus | Need to verify | Need to verify | Need to verify | Need to verify |

### 7.3 Verification Required (Before Implementation)
- [ ] Check OpenRouter model catalog for `glm-5.3-flash` (or correct ID) — vision support, reasoning control, JSON mode
- [ ] Check `qwen/qwen-vl-plus` or `qwen/qwen3.7-flash` vision capabilities
- [ ] Test with sample receipt images (1500-2000px width)
- [ ] Verify `reasoning: { enabled: false }` and `response_format: { type: "json_object" }` work
- [ ] Add OCR task to `aiPolicy.ts` with appropriate model, maxTokens (~3000 for receipt), timeout (60s)

### 7.4 OCR Pipeline Requirements (From Plan)
| Requirement | Implementation Approach |
|-------------|------------------------|
| เก็บต้นฉบับและผล OCR ดิบ | New table `ocr_jobs` (id, image_path, raw_json, model_id, prompt_version, status, created_at) |
| แยกค่าอ่านได้ / ค่าที่ระบบแนะนำ | OCR result: `{ extracted: {...}, suggested: {...}, confidence: {...} }` |
| ไม่เดาตัวเลข — null ถ้าอ่านไม่ได้ | Parsing logic: if confidence < threshold → null |
| แยก Confidence ต่อ Field | Model must return per-field confidence; else compute from position |
| ตรวจยอดรวม/ส่วนลด/VAT/ค่าขนส่ง/ยอดสุทธิด้วย Code | Server-side validation: sum line items ≈ subtotal; subtotal - discount + vat + shipping = total |
| Admin Review ก่อนอนุมัติ | OCR Review page: show image + extracted fields + confidence; approve/edit/reject |
| เก็บ Model ID, Prompt Version, Raw JSON, ประวัติแก้ไข | `ocr_jobs` table + `ocr_job_edits` (job_id, field, old_value, new_value, editor, edited_at) |
| ป้องกันใบเสร็จซ้ำ/บันทึกซ้ำ | Hash image (perceptual hash) → check existing; supplier + date + total + items as composite key |
| ไม่ให้ข้อความในเอกสารสั่งระบบ | Guardrail: OCR output treated as data only; never passed to AI as instruction |

### 7.5 Supplier Mapping Workflow
| Phase | Approach |
|-------|----------|
| **Phase 1 (Manual)** | OCR extracts line items → Admin reviews → manually maps to Ingredient Master → confirm |
| **Phase 2 (Semi-auto)** | Confirmed mappings stored in `supplier_products` → auto-suggest for same supplier SKU |
| **Phase 3 (Auto)** | High-confidence exact matches (supplier_sku + name + unit) → auto-approve with threshold |

---

## 8. Purchase & Stock Flow — Separation Design

### 8.1 Current Flow (Single Step)
```
Manual Stock Update (InventoryPage)
    │
    ▼
updateInventoryStock(id, qty, reason)
    │
    ▼
inventory.current_stock += qty
inventory_transactions INSERT (type='in'/'out'/'adjustment')
```
**Problem:** No distinction between "price approval" and "physical receipt"

### 8.2 Target Flow (Two-Step)

#### Step 1: Purchase Order Approval (Price Commitment)
```
Create PO (Draft) → Add Items (supplier_products) → Set Prices → Admin Approve PO
    │
    ▼
PO Status: 'ordered' (price locked, commitment recorded)
    │
    ▼
ingredient_price_history INSERT (source='po', reference_id=po_id, status='committed')
```
- **No stock change** at this stage
- Price is **committed** but not yet **realized**

#### Step 2: Goods Receipt (Physical Receipt)
```
Receive Goods (GRN) → Scan/Count Items → Record Actual Qty Received → Quality Check → Confirm GRN
    │
    ▼
FOR EACH LINE:
  1. Calculate Landed Cost per Use Unit
  2. INSERT ingredient_price_history (source='grn', realized=true)
  3. UPDATE inventory.current_stock += qty_received
  4. INSERT inventory_transactions (type='in', reference_type='grn', reference_id=grn_id)
  5. UPDATE inventory.unit_price = latest landed cost (or WAVG)
  6. Trigger recipe cost recalculation
```
- **Stock changes HERE** (physical receipt)
- **Landed cost realized HERE**
- Partial receipt, rejection, variance all handled at GRN level

### 8.3 Handling Edge Cases
| Scenario | Handling |
|----------|----------|
| **Partial Receipt** | GRN line `qty_received` < `qty_ordered`; PO remains 'ordered' for balance; new GRN for next delivery |
| **Return / Rejection** | GRN line `quality_status='rejected'`; `qty_received=0`; no stock change; PO line remains open |
| **Price Variance at Receipt** | GRN captures actual `unit_price`; variance vs PO price recorded; `landed_cost_per_use_unit` based on actual |
| **Over-receipt** | `qty_received` > `qty_ordered` → warning; admin must approve variance |

---

## 9. Architecture — Core Engine Design

### 9.1 Existing Multi-Tenant / Branch / Permissions (Verified)

| Layer | Implementation | Evidence |
|-------|----------------|----------|
| **Tenant** | `tenants` table (migration 059+), `business_settings` per tenant (migration 075), RLS `tenant_id` on all tables | Migrations 059–080, 075, 079 |
| **Branch** | `branches` table (migration 081), `branch_id` on products, orders, delivery_rounds, delivery_zones, customers, inventory (TEN-07) | Migrations 081–092 |
| **RLS** | 2-layer: org (tenant) + branch isolation; all 213 migrations have policies | `supabase/migrations/` — `branch_rls_policies`, `tenant_crud_rpc_and_rls` |
| **Roles** | 11 admin-capable roles (owner, admin, staff, pos, kitchen, inventory, finance, marketing, support, auditor, developer) | `src/lib/adminUi.ts` `ADMIN_CAPABLE_ROLES` |
| **Per-Role Nav** | `ROLE_NAV_ALLOW` map filters hub tabs | `src/lib/adminUi.ts` |

### 9.2 Core Engine Extensibility Principles
| Principle | Current Compliance | Action Needed |
|-----------|-------------------|---------------|
| **Tenant-aware from Day 1** | ✅ All new tables must have `tenant_id` | Enforce in migration templates |
| **Branch-aware for inventory/orders** | ✅ `branch_id` on relevant tables | Add `branch_id` to new ingredient/purchase tables |
| **RLS by default** | ✅ All tables have RLS | New tables must include policies in same migration |
| **Server-side canonical logic** | ✅ RPCs for deduct/restore/transition | New logic in RPCs (SECURITY DEFINER) |
| **Audit trail** | ✅ `append_audit_log` RPC + `inventory_transactions` | Extend to purchase/price events |
| **Idempotency** | ✅ PO/GRN deterministic IDs, dedup guards | Apply to new purchase flow |

### 9.3 Avoiding Duplication
| Existing System | Do Not Recreate | Extend Instead |
|-----------------|-----------------|----------------|
| `inventory` + `inventory_transactions` | New stock tables | Add purchase-related transaction types |
| `recipes` + `get_inventory_requirements` | New BOM engine | Add cost fields, yield, waste |
| `business_settings` + RPC | New config tables | Add ingredient/purchase settings keys |
| `audit_log` + `append_audit_log` | New audit tables | Use existing RPC |
| `suppliers` (denormalized) | New supplier table | Normalize existing data |

---

## 10. Deliverables Summary

### 10.1 Completed in This Audit
1. ✅ **Repository & Production Architecture Snapshot** — Section 1
2. ✅ **Existing Feature Matrix with Evidence** — Section 2
3. ✅ **Recipe → Ingredient → Stock → Purchase → Order Data Flow** — Section 3
4. ✅ **Admin Navigation Audit & Consolidation Table** — Section 4
5. ✅ **Database Schema / RLS / Trigger / Function Impact** — Sections 2, 3, 5, 8, 9
6. ✅ **Price Input Channels & OCR Feasibility** — Sections 6, 7
7. ✅ **Reusable Existing Components** — Section 2 (all IMPLEMENTED items)
8. ✅ **Gap Analysis** — Sections 2, 5 (all MISSING/PARTIAL items)
9. ✅ **Target Architecture** — Sections 4, 5, 8, 9
10. ✅ **Phase-by-Phase Implementation Plan** — Section 11
11. ✅ **Acceptance Criteria & Test Plan** — Section 12
12. ✅ **Risk, Rollback & Production Safety Plan** — Section 13

---

## 11. Phase-by-Phase Implementation Plan

### Phase 0: Audit & Plan (THIS REPORT)
- **Status:** COMPLETE
- **Deliverable:** This document
- **Gate:** Owner approval to proceed

### Phase 1: Foundation — Ingredient Master Enrichment & Supplier Master
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 1.1 | **Migration: Create `suppliers` table + RLS** (MUST BE FIRST per B5) | 0.5 day | — |
| 1.2 | **Migration: Add `supplier_id` FK to `inventory` + backfill from denormalized data** (dry run + Owner review for ambiguous matches) | 1 day | 1.1 |
| 1.3 | Migration: Add `prep_yield_factor`, `prep_waste_pct`, `purchase_unit`, `use_unit`, `conversion_factor`, `package_size`, `gross_weight`, `net_weight`, `wavg_cost`, `last_purchase_price` to `inventory` | 1 day | 1.2 |
| 1.4 | **Migration: Create `supplier_products` mapping table + RLS** (with 3 price states: committed/realized/approved) | 1 day | 1.1 |
| 1.5 | Migration: Add `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at` to `recipes` | 0.5 day | 1.3 |
| 1.6 | API: `bmbAdminApi_suppliers.ts` (CRUD) + `bmbAdminApi_supplierProducts.ts` | 1 day | 1.4 |
| 1.7 | Admin: Supplier Master page (CRUD) in PurchaseHub `suppliers` tab | 1 day | 1.6 |
| 1.8 | Admin: Supplier Product Mapping page in PurchaseHub `mapping` tab | 1 day | 1.7 |
| 1.9 | Admin: Enrich InventoryPage (InventoryHub `master` tab) with new fields (prep yield, units, conversion, WAVG display) | 1 day | 1.3 |
| 1.10 | Data migration: Backfill `supplier_id` — dry run report: exact matches, ambiguous, unmatched | 0.5 day | 1.2 |

**Phase 1 Gate:** All migrations applied prod, supplier CRUD works, inventory enriched with WAVG/prep yield/unit conversion, existing data migrated with Owner-verified backfill, Cost Analysis tab reads new fields.

### Phase 2: Purchase Orders & Goods Receipt (Core Flow)
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 2.1 | Migration: `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `ingredient_price_history` + RLS (with `status` column: committed/realized/approved, `wavg_after` on history) | 1.5 days | Phase 1 |
| 2.2 | RPC: `create_purchase_order`, `approve_purchase_order` (sets status=committed, writes price_history status=committed, NO stock change), `create_goods_receipt`, `post_goods_receipt` (atomic, idempotent: updates stock + WAVG + writes price_history status=realized + realized_landed_cost) | 2 days | 2.1 |
| 2.3 | RPC: `approve_price_for_costing` (sets price_history status=approved, updates ingredient.last_approved_price) | 0.5 day | 2.2 |
| 2.4 | API: `bmbAdminApi_purchases.ts` (PO + GRN CRUD) | 1 day | 2.2 |
| 2.5 | Admin: PurchaseHub — PO List, Create PO, Approve PO tabs | 1.5 days | 2.4 |
| 2.6 | Admin: PurchaseHub — GRN List, Create GRN (from PO), Post GRN tabs (partial receipt, rejection, variance handling) | 1.5 days | 2.5 |
| 2.7 | Admin: PurchaseHub — Price History tab (shows 3 states, WAVG timeline, variance PO vs GRN) | 1 day | 2.6 |
| 2.8 | Integration: GRN posting → `inventory_transactions` type='in' + `wavg_cost` update + recipe cost trigger | 1 day | 2.2 |
| 2.9 | Validation: 3-way match (PO ↔ GRN ↔ Invoice) — optional Phase 2+ | 1 day | 2.6 |

**Phase 2 Gate:** Full PO(Committed) → GRN(Realized) → Approved flow working; price history with 3 states populated; WAVG updated atomically; stock valuation uses WAVG; partial receipt/rejection/variance handled.

### Phase 3: Recipe Costing & Margin Engine
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 3.1 | RPC: `calculate_recipe_cost(product_id)` — uses `ingredient_wavg_cost × qty_per_unit / (prep_yield_factor × batch_yield_factor)` with separate prep yield (ingredient) and batch yield (recipe) | 1 day | Phase 1, 2 |
| 3.2 | RPC: `calculate_product_cogs(product_id)` — recipe cost + `packaging_cost` + `other_unit_cost` (existing product fields) | 0.5 day | 3.1 |
| 3.3 | RPC: `create_cost_snapshot()` — periodic freeze of product COGS + ingredient WAVG for historical reporting (prevents retroactive changes) | 0.5 day | 3.2 |
| 3.4 | API: `bmbAdminApi_costing.ts` — cost calculation, margin simulation, snapshot management | 1 day | 3.3 |
| 3.5 | Admin: MenuHub `cost-analysis` tab — per-product COGS breakdown by ingredient, margin %, yield factors, what-if simulation | 1.5 days | 3.4 |
| 3.6 | Admin: Price Impact Simulation — "What if ingredient X price changes?" → affected products + new margins + snapshot comparison | 1 day | 3.5 |
| 3.7 | Scheduled: Nightly recipe cost recalculation (pg_cron) → update `recipes.cost_per_unit`, create daily `cost_analysis_snapshots` | 0.5 day | 3.3 |

**Phase 3 Gate:** Recipe costs computed from WAVG + dual yield factors; product margins accurate; what-if simulation works; cost snapshots created daily; historical order COGS immutable.

### Phase 4: Hybrid Price Input & OCR
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 4.1 | Verify OCR models on OpenRouter: **GLM 5.3 Flash** (priority 1) — vision, JSON mode, `reasoning: { effort: "none" }`; **Qwen3.7-Flash / qwen/qwen-vl-plus** (priority 2) — same verification | 1 day | — |
| 4.2 | Add OCR task to `aiPolicy.ts` with approved model, `reasoning: { effort: "none" }`, `response_format: { type: "json_object" }`, maxTokens=3000, timeout=60s | 0.5 day | 4.1 |
| 4.3 | Migration: `ocr_jobs`, `ocr_job_edits` tables + RLS (store: image_path, raw_json, extracted_json, suggested_json, confidence_per_field, model_id, prompt_version, status) | 0.5 day | 4.2 |
| 4.4 | EF: `ocr-process` — upload image (1500-2000px width) → call vision model → return structured JSON + per-field confidence; validate totals (subtotal ≈ sum lines, total = subtotal - discount + vat + shipping) | 1.5 days | 4.3 |
| 4.5 | EF: `ocr-review` — admin review workflow: show image + extracted fields + confidence; approve/edit/reject → on approve: write `ingredient_price_history` status=approved + update `last_approved_price` | 1 day | 4.4 |
| 4.6 | Admin: PurchaseHub `ocr-review` tab — upload queue, review interface, supplier mapping assistant (manual Phase 1) | 1 day | 4.5 |
| 4.7 | Admin: PurchaseHub `ocr-upload` tab — drag-drop receipt, preview, submit | 1 day | 4.6 |
| 4.8 | CSV/Excel Import: Template + validation + preview + admin approve → price_history status=approved | 1 day | Phase 2 |
| 4.9 | Duplicate detection: perceptual hash + supplier/date/total/items composite key | 0.5 day | 4.4 |

**Phase 4 Gate:** OCR processes receipts at 1500-2000px → admin reviews every result → approved prices flow to price_history (status=approved) → ingredient.last_approved_price updated; supplier mapping manual in Phase 1.

### Phase 5: Admin Navigation Consolidation (Per Owner Approved 7-Hub Structure)
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 5.1 | Extend MenuHub: add `cost-analysis` tab (CostAnalysisPage), move AdminRecipes to `recipes` tab | 1.5 days | Phase 1-3 |
| 5.2 | Create InventoryHub: move InventoryPage to `master` tab, add `overview`, `transactions`, `alerts` tabs | 1.5 days | Phase 1 |
| 5.3 | Create PurchaseHub: 6 tabs (suppliers, mapping, purchase-orders, receiving, price-history, ocr-review) | 2 days | Phase 2 |
| 5.4 | Extend DeliveryHub: move AdminKitchen to `kitchen` tab | 0.5 day | Phase 1 |
| 5.5 | Create MarketingHub: merge AdminMarketing + AdminMarketingPromotions + AdminMediaPortfolio into 7 tabs | 1.5 days | Phase 1 |
| 5.6 | Extend Settings/Org/Analytics: add `reports` tab (AdminReports + CostAnalyticsPage), keep `audit`, `errors` | 1 day | Phase 3 |
| 5.7 | Add redirects for ALL legacy routes (`/admin/recipes` → `/admin/products?tab=recipes`, `/admin/inventory` → `/admin/inventory?tab=master`, `/admin/kitchen` → `/admin/delivery?tab=kitchen`, `/admin/marketing` → `/admin/marketing?tab=posts`, etc.) | 1 day | 5.1-5.6 |
| 5.8 | Update `ADMIN_NAV_GROUPS`, `ROLE_NAV_ALLOW` for 7-Hub structure | 0.5 day | 5.7 |
| 5.9 | Test per-role nav filtering (pos/kitchen/inventory/finance/marketing/support) | 0.5 day | 5.8 |

**Phase 5 Gate:** All admin pages accessible via 7 Hubs; legacy URLs redirect preserving query params; role-based permissions intact; no broken deep links.

### Phase 6: Reporting & Analytics
| Task | Description | Est. Effort | Dependencies |
|------|-------------|-------------|--------------|
| 6.1 | Migration: `cost_analysis_snapshots` (daily product COGS, margin, ingredient WAVG) | 0.5 day | Phase 3 |
| 6.2 | RPC: `get_cost_trends(ingredient_id, days)`, `get_margin_alerts(threshold_pct)`, `get_purchase_spend_by_supplier(days)` | 1 day | 6.1 |
| 6.3 | Admin: Settings/Org/Analytics `reports` tab — Cost Trends, Margin Alerts, Purchase Spend by Supplier, WAVG vs Last Purchase Price variance | 1.5 days | 6.2 |
| 6.4 | Admin: Cost Analytics page — historical COGS vs current, margin waterfall, ingredient cost contribution | 1 day | 6.3 |
| 6.5 | Scheduled: Daily cost snapshot (pg_cron) + weekly margin alert check | 0.5 day | 6.1 |

**Phase 6 Gate:** Cost trend reports, margin alerts, purchase analytics, historical COGS comparison available; snapshots prevent retroactive changes.

---

## 12. Acceptance Criteria & Test Plan (Updated per Owner Decisions)

### 12.1 Phase 1 Acceptance Criteria
| ID | Criterion | Test Method |
|----|-----------|-------------|
| P1-AC1 | `suppliers` table created first with RLS; admin can CRUD | Migration probe + Vitest: create/read/update/delete via API |
| P1-AC2 | `inventory` has `supplier_id` FK added; backfill dry run reported (exact matches, ambiguous, unmatched) | Migration probe + SQL dry-run report reviewed by Owner |
| P1-AC3 | `inventory` has all new columns: `prep_yield_factor`, `prep_waste_pct`, `purchase_unit`, `use_unit`, `conversion_factor`, `package_size`, `gross_weight`, `net_weight`, `wavg_cost`, `last_purchase_price` | Migration probe + `SELECT column_name FROM information_schema.columns` |
| P1-AC4 | `supplier_products` table created with 3 price states (committed/realized/approved); mapping links supplier SKU → ingredient | Vitest: create mapping, verify FK constraints + price state columns |
| P1-AC5 | `recipes` has `batch_yield_factor`, `batch_waste_pct`, `cost_per_unit`, `last_cost_calculated_at` | Migration probe |
| P1-AC6 | InventoryPage (InventoryHub `master` tab) shows new fields; save updates them; WAVG displayed separately from legacy unit_price | E2E: edit ingredient, verify new fields persist + WAVG shown |
| P1-AC7 | Supplier Master page (PurchaseHub `suppliers` tab) CRUD works | E2E: create/edit/delete supplier |
| P1-AC8 | Supplier Mapping page (PurchaseHub `mapping` tab) links supplier SKU ↔ ingredient with conversion_factor | E2E: create mapping, verify conversion math |

### 12.2 Phase 2 Acceptance Criteria
| ID | Criterion | Test Method |
|----|-----------|-------------|
| P2-AC1 | PO created in 'draft' → approve → 'ordered'; **no stock change**; writes `ingredient_price_history` status=committed | Vitest: create PO, approve, verify `inventory.current_stock` unchanged + history row status=committed |
| P2-AC2 | GRN created from PO; partial receipt supported (qty_received < qty_ordered); PO remains 'ordered' | Vitest: create GRN with partial qty, verify PO status + GRN line |
| P2-AC3 | GRN posting → **atomic & idempotent**: `inventory_transactions` type='in' + `current_stock` increase + `wavg_cost` updated + `ingredient_price_history` status=realized with `wavg_after` | Vitest: post GRN, verify transaction + stock delta + WAVG math + history row status=realized + wavg_after |
| P2-AC4 | Realized landed cost per use unit calculated correctly: `(realized_unit_price × conversion_factor) + (shipping + tax + insurance - discount) / qty_received` | Vitest: known input → verify output math |
| P2-AC5 | `ingredient_price_history` append-only with 3 states: PO=committed, GRN=realized, Approve=approved; `wavg_after` captured on realized rows | Vitest: check history rows, source, status, wavg_after |
| P2-AC6 | `inventory.wavg_cost` updated to new WAVG after GRN; legacy `unit_price` RETAINED unchanged for backward compat | Vitest: post GRN, verify wavg_cost = new WAVG, unit_price unchanged |
| P2-AC7 | Partial receipt, rejection (quality_status=rejected), price variance (realized ≠ committed) all handled at GRN level | Vitest: test each scenario |
| P2-AC8 | `approve_price_for_costing` sets history status=approved + updates `ingredient.last_approved_price` | Vitest: call RPC, verify history + ingredient field |

### 12.3 Phase 3 Acceptance Criteria
| ID | Criterion | Test Method |
|----|-----------|-------------|
| P3-AC1 | `calculate_recipe_cost` uses `ingredient_wavg_cost × qty_per_unit / (prep_yield_factor × batch_yield_factor)` — dual yield, no double waste | Vitest: known recipe + ingredient WAVG + yields → verify math |
| P3-AC2 | Product COGS = Recipe Cost (yield-adjusted) + `packaging_cost` + `other_unit_cost` (existing product fields) | Vitest: known product → verify |
| P3-AC3 | Cost Analysis page (MenuHub `cost-analysis` tab) shows per-ingredient breakdown + total COGS + margin % + yield factors | E2E: open page, verify numbers match RPC |
| P3-AC4 | Price Impact Simulation: change ingredient WAVG → shows affected products + new margins + snapshot comparison | E2E: simulate +10% on chicken → list affected dishes with new margin % |
| P3-AC5 | `create_cost_snapshot()` freezes product COGS + ingredient WAVG daily; historical order COGS immutable | SQL: check `cost_analysis_snapshots` created; verify past order COGS unchanged after price change |
| P3-AC6 | Nightly job updates `recipes.cost_per_unit` + creates daily snapshots | SQL: check `last_cost_calculated_at` = yesterday + snapshots exist |

### 12.4 Phase 4 Acceptance Criteria
| ID | Criterion | Test Method |
|----|-----------|-------------|
| P4-AC1 | **GLM 5.3 Flash** verified on OpenRouter: vision + JSON mode + `reasoning: { effort: "none" }` works | Manual: test API call with receipt image |
| P4-AC2 | OCR model returns structured JSON with per-field confidence; validates totals (sum lines ≈ subtotal, total = subtotal - discount + vat + shipping) | Manual: upload test receipt → inspect raw JSON + validation |
| P4-AC3 | OCR Review page (PurchaseHub `ocr-review` tab) shows image + extracted fields + confidence; admin can edit → approve | E2E: process receipt → review → edit field → approve |
| P4-AC4 | Approved OCR → writes `ingredient_price_history` status=approved + updates `ingredient.last_approved_price` | Vitest: approve → verify history + ingredient field |
| P4-AC5 | Duplicate receipt detection blocks re-upload (perceptual hash + composite key) | E2E: upload same image twice → second blocked |
| P4-AC6 | CSV import validates columns, shows preview, admin approves → price_history status=approved | E2E: upload CSV → preview → approve → verify |
| P4-AC7 | Supplier mapping manual in Phase 1 (OCR extracts → admin maps → confirm) | E2E: OCR result → manual map → confirm |

### 12.5 Phase 5 Acceptance Criteria
| ID | Criterion | Test Method |
|----|-----------|-------------|
| P5-AC1 | All 26 legacy admin routes redirect to 7-Hub tabs preserving query params (302 or client Navigate) | E2E: visit each legacy route → lands on correct hub+tab |
| P5-AC2 | 7-Hub structure implemented: MenuHub(4), InventoryHub(4), PurchaseHub(6), DeliveryHub(6), MarketingHub(7), Customers&Comm(3), Settings/Org/Analytics(5) | Visual: verify all tabs exist |
| P5-AC3 | Per-role nav filtering works (pos/kitchen/inventory/finance/marketing/support see only permitted tabs) | Vitest: `navGroupsForRole('pos')` returns correct tabs |
| P5-AC5 | Deep links with `?tab=` work (e.g., `/admin/delivery?tab=kitchen`) | E2E: navigate to deep link → correct tab active |
| P5-AC6 | No broken deep links; all bookmarks/shareable URLs functional | Manual: test 20+ common deep links |

### 12.6 Test Strategy
| Test Type | Tool | Coverage |
|-----------|------|----------|
| Unit / Integration | Vitest (230 files, 2521 tests) | All RPCs, API functions, utility functions |
| E2E Admin Flows | Playwright | PO→GRN→Stock, OCR Review, Cost Simulation, Navigation |
| Migration Contract | CI `contract-tests.yml` | Replay migrations on ephemeral PG |
| Load / Concurrency | k6 (future) | GRN posting concurrent, price history writes |
| Manual/Owner | Real devices | OCR accuracy, UX flow, live test packs (§T) |

---

## 13. Risk, Rollback & Production Safety Plan

### 13.1 Risks & Mitigations (Updated per Owner Decisions)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Migration data loss** | Low | Critical | Rule 16.3: probe marker → apply → record in `schema_migrations`; test on staging first; backup before prod |
| **Breaking existing inventory deductions** | Medium | High | Phase 1 only adds columns (no DROP); Phase 2 new tables; existing `deduct_inventory_for_order` unchanged |
| **RLS policy gaps on new tables** | Medium | High | Every migration includes RLS policies; CI contract tests verify anon/authenticated access |
| **OCR model hallucination / misread** | High | Medium | Confidence thresholds; admin review mandatory; no auto-commit; duplicate detection; 1500-2000px image requirement |
| **Price history bloat** | Low | Medium | Partition `ingredient_price_history` by month; retention policy (2 years) |
| **Recipe cost recalculation performance** | Low | Medium | Materialized view or cached `cost_per_unit`; nightly batch; index on `ingredient_id` in price history |
| **Supplier data migration mismatch** | Medium | Medium | **Create suppliers table FIRST (B5)**; fuzzy match `supplier_name` + `supplier_phone`; dry-run report; Owner review for ambiguous; no auto-fuzzy-bind |
| **Double waste deduction** | Medium | High | **Dual yield design (B3)**: `prep_yield_factor` (ingredient) × `batch_yield_factor` (recipe); RPC enforces formula; test cases for both |
| **WAVG vs legacy unit_price confusion** | Medium | Medium | **Separate fields (B1)**: `wavg_cost` for valuation, `unit_price` retained for compat; documentation + migration notes |
| **Retroactive COGS changes** | Medium | High | **Cost snapshots (B1.7)**: daily freeze via `cost_analysis_snapshots`; historical orders reference snapshot |
| **Admin nav breaking bookmarks** | Low | Low | All legacy routes redirect via `<Navigate replace />`; test all 26 admin routes |

### 13.2 Rollback Procedures (Updated)

| Phase | Rollback Trigger | Procedure |
|-------|------------------|-----------|
| **Phase 1** | New columns cause app errors / backfill mismatch | 1. Revert migration (DROP COLUMN if added) 2. Restore `inventory` from backup 3. Drop `suppliers`, `supplier_products` 4. Redeploy previous EF/code |
| **Phase 2** | PO/GRN flow breaks orders / WAVG corruption | 1. Disable PurchaseHub tabs (feature flag) 2. Revert migrations (DROP TABLE purchase_orders, goods_receipts, ingredient_price_history) 3. `inventory` untouched (only reads `wavg_cost`) 4. Restore `inventory.wavg_cost` from backup if corrupted |
| **Phase 3** | Cost calculations wrong / snapshot failures | 1. Disable Cost Analysis tab 2. Revert `recipes` columns 3. Drop `cost_analysis_snapshots` 4. `products.packaging_cost`/`other_unit_cost` unchanged (existing fields) |
| **Phase 4** | OCR produces bad data / model unavailable | 1. Disable OCR EF (remove from `aiPolicy.ts`) 2. Drop `ocr_jobs` tables 3. Price history unchanged (only new writes affected) 4. Fallback to manual/CSV entry |
| **Phase 5** | Nav redirects broken / role permissions | 1. Revert `App.tsx` routes 2. Restore `ADMIN_NAV_GROUPS`, `ROLE_NAV_ALLOW` 3. Clear browser cache instruction |
| **Phase 6** | Report performance / data accuracy | 1. Disable Reports tab 2. Drop `cost_analysis_snapshots` (if not used by Phase 3) 3. Revert RPCs |

### 13.3 Production Safety Checklist (Per Phase) — Binding
- [ ] **Migration Probe** — Run probe script on prod (read-only) before apply
- [ ] **Apply Migration** — Owner applies via Supabase Dashboard / CLI
- [ ] **Record in Ledger** — Verify `schema_migrations` has entry (Rule 16.3)
- [ ] **Smoke Test EF** — Deploy EF, run smoke test (fake payload → 200 OK)
- [ ] **Run Gates** — `tsc --noEmit` 0, `npm run lint` OK, `vitest run` all pass, `npm run build` PASS
- [ ] **Owner Live Test** — Owner tests critical path on production (per Work Queue)
- [ ] **Document** — Update `BMB_MASTER_STATUS.md`, `BMB_CHANGELOG.md`, `BMB_WORK_QUEUE.md`

### 13.4 Hard Constraints (Non-Negotiable)
| Constraint | Enforcement |
|------------|-------------|
| **No DROP TABLE on prod without Owner explicit approval** | Migration review gate |
| **No breaking changes to `deduct_inventory_for_order` / `transition_order_status`** | These are canonical; extend only |
| **RLS on every new table** | CI contract test fails if missing |
| **BKK Date (UTC+7) in all migrations** | `contracts_190` CI guard |
| **Idempotent migrations** | `IF NOT EXISTS`, `ON CONFLICT DO NOTHING` |
| **No mock/stub data in production code** | Code review gate |
| **All price changes audited** | `append_audit_log` + `ingredient_price_history` |

---

## 14. Appendix: Key File References

| Area | Key Files |
|------|-----------|
| **Recipes/BOM** | `supabase/migrations/019_kitchen_core.sql`, `src/lib/bmbAdminApi_recipes.ts`, `src/pages/admin/AdminRecipes.tsx` |
| **Inventory/Stock** | `supabase/migrations/001_initial_schema.sql`, `019_kitchen_core.sql`, `026_inventory_aggregate_fix.sql`, `src/lib/bmbAdminApi_inventory.ts`, `src/pages/admin/InventoryPage.tsx` |
| **Products/Menu** | `supabase/migrations/001_initial_schema.sql`, `170` (costs), `src/lib/bmbAdminApi_products.ts`, `src/pages/admin/AdminProducts.tsx` |
| **Orders/Cart** | `supabase/migrations/001_initial_schema.sql`, `019_kitchen_core.sql`, `213_cart_sessions_payload.sql`, `src/lib/cartStore.ts`, `src/lib/cartDeepLink.ts` |
| **Admin Nav** | `src/lib/adminUi.ts`, `src/components/admin/AdminHubs.tsx`, `src/components/admin/AdminNav.tsx`, `src/App.tsx` |
| **AI/OCR** | `supabase/functions/_shared/aiPolicy.ts`, `supabase/functions/ai-proxy/index.ts`, `src/lib/aiModels.ts` |
| **Settings** | `supabase/migrations/075_business_settings_extend_tenant.sql`, `src/lib/bmbAdminApi_settings.ts`, `src/pages/admin/AdminSettings.tsx` |
| **Types** | `src/types/index.ts` (Ingredient, PurchaseOrder, Supplier, RecipeRow, etc.) |

---

## 15. Sign-Off

**Audit Completed By:** AI Agent (Phase 0)  
**Date:** 2026-11-24  
**Status:** **OWNER APPROVED WITH CONDITIONS** — Phase 1 Authorized  
**Owner Decision Reference:** `OWNER DECISION — APPROVED WITH CONDITIONS` (2026-11-24)  
**Next Action:** Implement Phase 1 corrections (B1-B6) → Begin Phase 1 coding → Gate Review → Phase 2 Authorization

> **Note:** This audit follows the mandatory "No Evidence = Not Done" principle. All IMPLEMENTED claims reference actual code files, migrations, or runtime evidence. All MISSING claims are verified by absence in schema, migrations, and codebase. No assumptions about future work are presented as current state.
>
> **Binding Constraints from Owner:**
> - Phase 1 authorized NOW; Phase 2-6 approved roadmap only
> - No auto-advancement — each Phase requires Owner gate review
> - No changes to canonical RPCs: `deduct_inventory_for_order`, `restore_inventory_for_order`, `transition_order_status`
> - Suppliers table MUST be created FIRST (B5)
> - Dual yield design: prep yield (ingredient) × batch yield (recipe) — no double waste
> - Three price states: Committed (PO) → Realized (GRN) → Approved (Policy)
> - WAVG separate from legacy unit_price; cost snapshots prevent retroactive COGS changes
> - GLM 5.3 Flash priority for OCR; `reasoning: { effort: "none" }`; admin review mandatory
> - 7-Hub admin structure binding; InventoryHub not under Settings
> - All migrations: RLS + Contract Tests + Rule 16.3