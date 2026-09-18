# 🔐 DATABASE_SECURITY_AUDIT — Bite Me Baby

> Baseline Commit: `e6b3e65` | Audit Date: 2026-09-18 | Phase B — Forensic
> Principle: Evidence > Claims

---

## Executive Summary

ตรวจ migration 001-005 + actual source code พบ **P0 (service-role key ใน client bundle)** และ **RLS ผิดพลาดทั่วระบบ** — ระบบยังไม่ปลอดภัยสำหรับ production

| ระบบ | Source of Truth จริง | ผล |
|------|---------------------|-----|
| Authentication | localStorage (`bmb_users`) | 🔴 BROKEN |
| Authorization | localStorage (`bmb_admin_role`) | 🔴 BROKEN — bypass ได้ |
| ราคา/ยอดรวม | Client (`cartStore`) | 🔴 BROKEN — ปลอมได้ |
| Payment | Client simulation | 🔴 BROKEN — fake success |
| RLS | 9/18 ตารางยัง permissive | 🔴 BROKEN |
| Capacity | trigger increment ไร้ max check | 🟡 PARTIAL — oversell ได้ |
| Inventory | UI=localStorage, API=Supabase ไม่ sync | 🟡 PARTIAL |

---

## 1. P0 — SERVICE-ROLE KEY EXPOSURE: **EXPOSED**

### 1.1 Evidence Chain

| # | Evidence | File |
|---|----------|------|
| 1 | Client code อ่าน `VITE_SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase.ts:9` |
| 2 | สร้าง `supabaseAdmin` ด้วย service-role key ใน **client code** | `src/lib/supabase.ts:34-41` |
| 3 | `.env` มีค่าจริง (รูปแบบ `sb_secret_*`) | `.env` |
| 4 | **Build output `dist/assets/supabase-DaLDiMEI.js` มีค่าจริงของ key ถูก Vite inline** | `dist/` |
| 5 | Vite inline env ทุกตัว prefix `VITE_*` ลง client build | `vite.config.ts` |

### 1.2 Impact
- ใครก็ได้เปิด DevTools → ดึง service-role key จาก bundle
- Service-role key **bypass RLS ทั้งหมด** — อ่าน/เขียน/ลบทุกตารางทุกแถว
- ถ้า live build (Cloudflare) ใช้ env เดียวกัน → **production ถูก compromise แล้ว**

### 1.3 Notes
- ✅ `.env`, `.env.local` **ไม่เคยถูก commit** ขึ้น git (gitignore ครอบ)
- ⚠️ ไม่สามารถยืนยัน Cloudflare Pages build env ได้ — ต้องตรวจ Dashboard
- Remediation → `SECURITY_REMEDIATION_PLAN.md` P0-1 (rotate + โครงสร้างใหม่)

---

## 2. AUTHENTICATION (BROKEN — client-based)

| # | Issue | Evidence | Severity |
|---|-------|----------|----------|
| AU-1 | User DB อยู่ใน localStorage (`bmb_users`) | `bmbAdminApi_users.ts:21-23` | 🔴 CRITICAL |
| AU-2 | Password verify ใน browser | `bmbStorage.ts:102-104` | 🔴 CRITICAL |
| AU-3 | Admin hash hardcode ใน source | `bmbAdminApi_users.ts:106` | 🔴 CRITICAL |
| AU-4 | Session เก็บ localStorage (`bmb_auth`) | `authStore.ts:98-108` | 🔴 CRITICAL |
| AU-5 | Demo credentials แสดงบนหน้า Login | `LoginPage.tsx:145-147` | 🟡 HIGH |
| AU-6 | `initializeAdmin()` สร้าง admin อัตโนมัติที่ boot | `main.tsx:21-31` | 🟡 HIGH |

### 2.1 Auth Flow (real)

```
Register → createUser() → localStorage bmb_users (bcrypt ใน browser)
Login → authenticateUser() → อ่าน localStorage → bcrypt compare → set bmb_admin_role flag
Session → authStore.checkAuth() → อ่าน localStorage bmb_auth
Admin → AdminRoute อ่าน localStorage.getItem('bmb_admin_role') === 'true'
```

- ไม่มี Supabase Auth `signUp`/`signInWithPassword` เรียกจากหน้า Login/Register
- `profiles` table มี schema แต่ frontend ไม่ใช้จริงสำหรับ auth

---

## 3. RLS FORENSIC

### 3.1 is_admin() Function

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;
```

| # | Finding | Risk |
|---|---------|------|
| IS-1 | **ไม่มี `SET search_path`** ใน SECURITY DEFINER | 🟠 search_path hijack (attacker ควบคุม schema/object) |
| IS-2 | อ่าน `profiles` ไม่ qualify schema | 🟠 พึ่ง default search_path |
| IS-3 | ใช้ `auth.uid()` ถูกต้อง (JWT) | ✅ |
| IS-4 | SECURITY DEFINER = รันด้วย privilege เจ้าของ | ✅ |
| IS-5 | ไม่ recursive | ✅ |

**สรุป:** ควรเพิ่ม `SET search_path = public` ทันที

### 3.2 ตารางที่ 005 ครอบคลุม

| Table | Policy | ช่องโหว่ |
|-------|--------|----------|
| `orders` anon SELECT | `status IN ('delivered','cancelled') OR customer_phone IS NOT NULL` | 🔴 **anon อ่านทุก order ที่มี phone** — PII หลุด |
| `orders` auth own | `customer_phone = auth.email()` | 🟠 phone vs email mismatch |
| `order_items` anon | DENY | ✅ |
| `order_items` auth | subquery orders | 🟠 identity mismatch ต่อเนื่อง |
| `pre_orders` anon SELECT | `status='pending' OR customer_name IS NOT NULL` | 🔴 anon อ่านทุก pre-order พร้อมชื่อลูกค้า |
| `pre_orders` auth own | `customer_phone = auth.email()` | 🟠 mismatch |
| `payment_intents` | anon DENY; auth own | ✅/🟠 |
| `profiles` anon SELECT | `USING (true)` | 🔴 อ่าน profile ทั้งหมด (email/phone/name/role) |
| `profiles` auth UPDATE | `auth.uid()=id` **ไม่มี role guard** | 🔴 **user แก้ role ตัวเองเป็น admin ได้!** |
| `products` anon SELECT | `is_available=true` | ✅ |
| `product_categories` | `is_active=true` | ✅ |
| `inventory` anon SELECT | `USING (true)` | 🔴 เปิด stock/supplier/ต้นทุน |
| `customers` anon | DENY | ✅ |
| `customers` auth | `phone = auth.email() OR is_admin()` | 🟠 phone vs email mismatch |

### 3.3 ตารางที่ 005 **ไม่ได้ปิด** (ยัง permissive จาก 001/003)

`delivery_rounds`, `reviews`, `promotions`, `notifications`, `loyalty_points`, `preorder_votes`, `inventory_transactions`, `ai_conversations`, `ai_recommendations`

→ ยังมี `p_public_all_*` จาก 001/003:
```sql
CREATE POLICY p_public_all_<table> ON <table>
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

| Table | Risk |
|-------|------|
| `delivery_rounds` | 🔴 anon เปลี่ยน capacity/cutoff ได้ |
| `reviews` | 🔴 anon ลบ/ปลอม review |
| `promotions` (001 schema) | 🔴 anon เปลี่ยน discount เป็น 99% ได้ |
| `notifications` | 🔴 อ่าน notification ใครก็ได้ |
| `loyalty_points` | 🔴 เติมแต้มเอง |
| `preorder_votes` | 🔴 โหวตปลอม/ลบ |
| `inventory_transactions` | 🔴 แก้ประวัติ stock |
| `ai_conversations` | 🔴 อ่านประวัติแชทคนอื่น |
| `ai_recommendations` | 🔴 ปลอม recommendation |

### 3.4 GRANTS (005)

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
```
- ⚠️ `GRANT SELECT ... TO anon` = anon อ่านได้ทุกตารางที่ RLS อนุญาต
- ⚠️ `INSERT/UPDATE/DELETE TO authenticated` ทุกตาราง — ไม่จำกัดเฉพาะตารางที่ควรเขียน

---

## 4. DATA INTEGRITY — PRICE AUTHORITY (BROKEN)

### 4.1 Flow (real)

```
Customer browser
  → cartStore.recalculate(): subtotal = Σ item.subtotal (client)   [cartStore.ts:99]
  → discount = appliedPromotion.discount_value (client)            [cartStore.ts:100-106]
  → total = subtotal − discount + deliveryFee                        [cartStore.ts:108]
  → CheckoutPage: orderData.total_amount = useCartStore().total    [CheckoutPage.tsx]
  → createOrder(orderData) → INSERT orders(total_amount)           [bmbAdminApi_orders.ts:79]
```

| # | Issue | Risk |
|---|-------|------|
| PR-1 | `total_amount` ตาม client ส่ง | 🔴 ส่ง 0 ได้ |
| PR-2 | `unit_price` มาจาก product.price ของ cart (client) | 🔴 ส่ง 0.01 ได้ |
| PR-3 | ไม่มี server-side recalc จาก `products.price` | 🔴 |
| PR-4 | delivery_fee มาจาก `calculateProviderCost` (lib) — client ยังเป็นคนเลือก | 🟠 ต้อง validate server |
| PR-5 | DB trigger `calculate_item_total` = quantity × unit_price (client ส่ง) | 🟠 ไม่ใช่ราคาจริงจาก products |
| PR-6 | ไม่มี CHECK constraint `total >= 0` (แค่ NOT NULL) | 🟠 negative/zero total |

---

## 5. PAYMENT FORENSIC (BROKEN — FAKE)

### 5.1 Evidence (`paymentGateway.ts`)

```
confirmPayment():
  await setTimeout(1500)          → simulate delay
  status: 'completed'             → FAKE
  receipt_url: https://pay.stripe.com/receipts/<id>   → FAKE URL
  → update payment_intents + orders.payment_status='paid'
```

### 5.2 Missing (อ้างอิง Master Handoff §14)
- Stripe PaymentIntent server-side / webhook / amount match / idempotency / replay / timeout / provider failure path

**Payment เป็น simulation 100% — ต้องแก้ก่อน launch**

---

## 6. CAPACITY (PARTIAL — oversell risk)

- ✅ trigger `increment_delivery_round_count` AFTER INSERT → current_count +1
- ❌ ไม่ตรวจ `current_count < max_capacity` ก่อนเพิ่ม
- ❌ ไม่มี transaction/row lock (11 concurrent → 11 insert ผ่าน)
- ❌ ไม่มี trigger ลด count เมื่อ order cancelled

---

## 7. INVENTORY (PARTIAL)

- ✅ `bmbAdminApi_inventory.ts` อ่าน/เขียน Supabase `inventory`
- ❌ `InventoryPage.tsx` ใช้ `inventoryStore` (Zustand in-memory) — ไม่ได้อ่านจาก Supabase
- ❌ ไม่มี reservation/consumption เมื่อสั่ง order

---

## 8. AUDIT LOG (localStorage only)

- `auditLog.ts` → `bmb_audit_logs` (localStorage)
- **ไม่มีตาราง `audit_logs` ใน DB** (migration 001-005)
- Privileged action ถูก audit ผ่าน localStorage = ลบ/ปลอมได้

---

## 9. SECRETS SCAN (ข้อ 22)

| Secret type | Location | Exposure |
|-------------|----------|----------|
| Supabase service-role | `.env` + dist bundle | 🔴 **EXPOSED ใน client build** |
| Supabase anon | `.env` | ✅ intended (public) |
| OpenRouter | `.env` / `.env.local` | ✅ gitignore ครอบ ไม่ใน git |
| Stripe secret (test) | `.env` | ⚠️ placeholder `sk_test_...` |
| Stripe webhook | `.env` | ⚠️ placeholder |

**Result:** git-tracked 128 files → **secret hit 0** ✅ (ไม่มี secret ใน code ที่ commit)

---

## 10. DB SCHEMA GAP (เทียบ architecture เป้าหมาย)

| Table | มีอยู่ | ใช้จริง | ต้องแก้ |
|-------|-------|--------|---------|
| `profiles` | ✅ | ❌ (auth ยัง localStorage) | เชื่อม Supabase Auth |
| `reviews` | ✅ (001) | ❌ (ReviewPage hardcode; reviewApi localStorage) | ใช้ DB + RLS |
| `promotions` | ✅ (001) | ❌ (localStorage/hardcode; promotionIntelligence ไม่ถูกใช้) | ใช้ DB + RLS |
| `audit_logs` | ❌ | N/A | ต้องสร้าง |
| `business_settings` | ❌ | N/A | Phase D |
| `media_assets` | ❌ | N/A | Phase D |
| `delivery_zones` | ❌ | N/A | Phase D |

---

*Continue → `RLS_MATRIX.md`, `AUTHORIZATION_AUDIT.md`, `DATA_AUTHORITY_MAP.md`, `SECURITY_REMEDIATION_PLAN.md`*