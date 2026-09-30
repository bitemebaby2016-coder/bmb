# 01 — System Architecture (Single Source of Truth)

> อัปเดต: 2026-09-30 · อ้างอิงโค้ดจริง ณ commit `c411799` (Migrations M081–M095 ทั้งหมด deploy แล้ว)

## 1. Stack
- **Frontend:** React 18 + TypeScript + Vite (PWA — vite-plugin-pwa, generateSW) + Tailwind (brand tokens ใน `src/index.css`)
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions + Storage bucket `bmb-images`)
- **State:** Zustand (`cartStore`, `authStore`, `biteAIStore`, `inventoryStore`)
- **Payments:** Stripe (create-checkout → webhook → record_payment_result idempotent)
- **AI:** OpenRouter ผ่าน Edge Function `ai-proxy` (key ฝั่ง server เท่านั้น)

## 2. DB Schema หลัก (Migrations 076–095)
| กลุ่ม | Tables / Features |
|---|---|
| Core commerce | `orders`, `order_items`, `products`, `product_categories`, `promotions`, `payment_intents`, `pre_orders` |
| Multi-branch (M081–M091) | `branches` (slug, is_default, lat/lng, status) · `delivery_rounds.branch_id` (M082) · `delivery_zones.branch_id` (M083) · `drivers.branch_id` (M084) · `delivery_assignments.branch_id` (M085) · `business_settings.branch_id` (M086) · `NOT NULL branch` enforcement (M087) · `profiles.branch_id` (M090) · `orders.branch_id` (M091) |
| Branch-scoped catalog (M092) | `products.branch_overrides` — override ราคา/availability ต่อสาขา (`available_same_day`, `available_preorder`, `is_available`, `is_featured`, `sort_order`) |
| Reviews (M093) | `reviews` enhanced — verified purchase, rating, comment, `product_id`, `order_number` |
| Portfolio (M094) | `admin_portfolio_items` (title, description, image_url, display_order, is_active) |
| Seed (M095) | ข้อมูลจริง: Branch + Delivery Rounds + Zones (idempotent, conflict on `(tenant_id, code)`) |

## 3. Branch Isolation (2 ชั้น)
1. **Application layer:** Admin `BranchSwitcher` (AdminNav) → `activeBranchId` → ทุก query/filter ผูก branch
2. **Database layer (M088):** RLS policies ซ้อน 2 ชั้น — อ่านเฉพาะ rows ของ branch ที่ profile สังกัด / owner เห็นทุกสาขา
- Customer: สาขา resolve จาก URL `?branch=<slug>` → default branch
- Order flow: CheckoutPage ส่ง `p_branch_id` + `p_scheduled_date` → RPC M089 validate (error `ERR_ROUND_BRANCH_MISMATCH` หาก round/branch ไม่ตรง) → `orders.branch_id` + audit_log `metadata.branch_id`

## 4. RLS Overview
- ทุกตาราง business มี RLS: `public_read` (anon SELECT ที่ได้รับ grant), `admin_manage` (ผ่าน `is_admin()` RPC), owner-wide access
- Order tracking: owner RLS / guest phone RPC พร้อม anti-enumeration
- Admin authorization: `is_admin()` ตรวจจาก `profiles` (role=admin) — ไม่ใช้ localStorage flag

## 5. Data Flow (Order)
```
Customer PWA → CheckoutPage → M089 RPC (validate branch+round+cutoff)
  → orders + order_items (branch_id, audit_log)
  → Stripe Checkout (create-checkout EF) → webhook (signature HMAC timing-safe)
  → record_payment_result (idempotent) → payment_status updated
Admin → BranchSwitcher → getOrdersPaged (RLS branch filter) → จัดการรอบส่ง/ครัว
```

## 6. AI Suite Data Flow
```
BiteChatWidget (HomePage, มุมขวาล่าง)
  → aiContextBuilder.buildAiStoreContext() [cache TTL 12 นาที]
      ← branches + products (M092) + delivery_rounds (วันนี้/พรุ่งนี้)
  → aiService.chatWithAIStream() → SSE /functions/v1/ai-proxy (JWT verified)
      ← guardrails ฝังฝั่ง server + stream deltas → typing effect
```

## 7. โครงสร้างซอร์สโค้ด
- `src/lib/` — service layer เดียวเท่านั้นที่แตะ Supabase (`bmbAdminApi_*.ts`, `aiService.ts`, `ai/aiContextBuilder.ts`)
- `src/pages/` — routes; `src/components/` — UI; `src/__tests__/` — 36 files / 331 tests (Vitest)
- ไม่มี mock/hardcode business data ใน component — ทุกข้อมูลจาก Supabase