# RLS_MATRIX — Bite Me Baby

> Version 2.0 | Baseline (this revision): `dc6e7ca` | Date: 2026-09-22 | Phase 3B · after migration 033
> Source of truth: LIVE local DB (supabase_db_ivkdfognyiwjcmrhcnwz) — policy layer from `pg_policies`,
> grant layer from `has_table_privilege` probe (`e2e/prodCheckGrants.cjs`).
> Version 1.x (Phase-B baseline, migrations 001/003/005) preserved in §6 as history.

## Legend
- **anon** = unauthenticated (anon key) · **auth** = authenticated (Auth JWT) · **admin** = `is_admin()`
- **S/I/U/D** = SELECT/INSERT/UPDATE/DELETE
- **Policy layer (RLS)**: RLS policy ที่ตั้งไว้ · **Grant layer (ACL)**: ข้อมimit ที่ PostgREST ใช้จริง
- **🌐 = F-5 candidate**: policy เปิดกว (USING=true / permissive) แต่ NO grant → dormant, ไม่มี access จริง

---

## 1. Policy layer (RLS) — post-033 สถานจริง

| Table | anon | auth (user) | admin | Notes / F-5 |
|-------|------|-------------|-------|-------------|
| `products` | S WHERE is_available | S WHERE is_available | ALL | — |
| `product_categories` | S WHERE is_active | S WHERE is_active | ALL | — |
| `delivery_rounds` | S WHERE status=active | S WHERE status=active | ALL | — |
| `delivery_zones` | S WHERE is_active | S WHERE is_active | ALL | — |
| `promotions` | S WHERE is_active | S WHERE is_active | ALL | — |
| `orders` | S WHERE status IN (delivered,cancelled) | S own/uid; I own; U where-false (dead) | ALL | — |
| `reviews` | S WHERE is_verified | own S/I/U | ALL | — |
| `preorder_votes` | S true + I true (**active by design**, grants match) | S true + I true | ALL | storefront vote capture |
| `profiles` | S true 🌐 (`profiles_public_read`) | S own (uid=id); U own (uid=id) | ALL | anon **grant-blocked**; reads route via `public_profiles` view (no-PII) |
| `payment_intents` | ALL true 🌐 (`payment_intents_policy`) | own S; own I | ALL | **fully un-granted** — dormant; never add grants |
| `inventory` | S false (`inventory_anon_read`) | S true 🌐 (`inventory_public_read`) grant-blocked | ALL | anon denied; auth read dormant |
| `inventory_transactions` | S false | own/admin | ALL | — |
| `media_assets` | S true 🌐 | S true 🌐 + I/U/D (**033 grant**) | ALL | anon dormant; auth S/I/U/D active (admin-app) |
| `mascot_overrides` | S true (**033 anon grant**) | S/I/U/D (**033**) | ALL | storefront mascot fixed |
| `business_settings` | S false | S true (**033 grant — checkout 403 fixed**) | ALL | — |
| `content_approvals` | S false | S own/admin (**033 grant**) | ALL | — |
| `customers` | false | S own/admin | ALL | — |
| `drivers` | false | S true (granted 031-era) | ALL | — |
| `delivery_assignments` | false | S admin-or-driver-phone | ALL | — |
| `notification_prefs` | false | S/I/U/D own | ALL | — |

---

## 2. ตารางที่ 005 **ยังไม่ได้ปิด** — ยังมี `p_public_all` (CRITICAL)

| Resource | anon S/I/U/D | auth S/I/U/D | admin S/I/U/D |
|----------|-------------|--------------|---------------|
| `delivery_rounds` | R/A/A/A | R/A/A/A | R/A/A/A |
| `reviews` | R/A/A/A | R/A/A/A | R/A/A/A |
| `promotions` | R/A/A/A | R/A/A/A | R/A/A/A |
| `notifications` | R/A/A/A | R/A/A/A | R/A/A/A |
| `loyalty_points` | R/A/A/A | R/A/A/A | R/A/A/A |
| `preorder_votes` | R/A/A/A | R/A/A/A | R/A/A/A |
| `inventory_transactions` | R/A/A/A | R/A/A/A | R/A/A/A |
| `ai_conversations` | R/A/A/A | R/A/A/A | R/A/A/A |
| `ai_recommendations` | R/A/A/A | R/A/A/A | R/A/A/A |

---

## 3. Cross-user Test Matrix (Master Handoff §11)

| Test | Setup | Expected | Actual (จาก policy) |
|------|-------|----------|---------------------|
| User A → read Order B | A select orders ของ B | DENY | 🟠 `customer_phone = auth.email()` — A phone (บันทึกเมื่อสั่ง) ≠ B email → DENY โดยบังเอิญ แต่ logic ผิด |
| User A → modify Order B | A update order B | DENY | ✅ D (update ไม่มี policy สำหรับผู้ใช้ทั่วไป) |
| User A → modify Profile B | A update profiles(id=B) | DENY | ✅ D จาก `WITH CHECK (auth.uid()=id)` แต่ A **ตั้ง role ตัวเองเป็น admin ได้** 🔴 |
| User A → modify Payment B | A update payment_intents ของ B | DENY | ✅ D (own only / admin) |
| User A → read admin data (inventory/promotions/reviews) | A select | DENY | 🔴 **การันตีไม่ได้** — anon ยัง R/A บน 9 ตาราง permissive |

---

## 4. สรุป Findings (จากการวิเคราะห์ SQL จริง)

1. 🔴 `orders` anon read **overbroad** — `OR customer_phone IS NOT NULL` เทียบเท่าเปิดทุกแถว (เกือบทุกออเดอร์มี phone) → **PII leak**
2. 🔴 `pre_orders` anon read **overbroad** — `OR customer_name IS NOT NULL` → เปิดทุกแถว
3. 🔴 `profiles` — anon R ทุก profile (email/phone/name/role) + own UPDATE **ไม่มี guard กันเปลี่ยน role** = **privilege escalation**
4. 🔴 **9 ตารางยัง permissive** (`p_public_all`) — anon CRUD เต็ม
5. 🔴 `inventory` public read — เลือ supplier/unit_price/stock
6. 🟠 phone vs email identity mismatch เกือบทุก policy (customer_phone=email ของ auth)
7. 🟠 `is_admin()` ไม่มี `SET search_path` (sec definer)
8. 🟠 GRANT SELECT to anon ทุกตาราง (RLS เป็น last line แต่ policy leak หลายจุด)

---

## 5. VERIFICATION STATUS

- ⚠️ Matrix นี้วิเคราะห์จาก SQL ของ migration **ยังไม่ได้ execute จริงบน live DB**
- ต้องทดสอบจริง (ต่อ `RLS_MATRIX` DoD ใน Phase B-B): anon SELECT products ✅ / anon SELECT orders → DENY (หลัง fix) / user role self-change → DENY / admin full / cross-user DENY