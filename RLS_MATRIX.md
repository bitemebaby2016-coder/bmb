# RLS_MATRIX — Bite Me Baby

> Baseline: `e6b3e65` | Date: 2026-09-18 | Phase B
> วิเคราะห์จาก migration 001, 003, 005 (policy ตาม SQL จริง)

## Legend
- **anon** = unauthenticated (Supabase anon key)
- **auth** = authenticated (Supabase Auth JWT)
- **admin** = `is_admin()` == true (ผ่าน profiles.role)
- **R** = SELECT allowed ตาม policy
- **W** = INSERT/UPDATE/DELETE allowed
- **O** = OWN ONLY (ต้อง match identity)
- **A** = ALL rows
- **D** = DENY
- **?** = identity mismatch (phone vs email) → behavior ไม่ guaranteed

---

## 1. ตารางที่ 005 ครอบคลุม

| Resource | anon S/I/U/D | auth (user) S/I/U/D | admin S/I/U/D |
|----------|-------------|---------------------|---------------|
| `products` | R(is_available)/D/D/D | R(is_available)/D/D/D | A/A/A/A |
| `product_categories` | R(is_active)/D/D/D | R(is_active)/D/D/D | A/A/A/A |
| `orders` | 🔴 R(delivered/cancelled OR phone IS NOT NULL)/D/D/D | O(phone=auth.email)/W(insert own)/D/D | A/A/A/A |
| `order_items` | D/D/D/D | O(subquery own orders)/W/D/D | A/A/A/A |
| `pre_orders` | 🔴 R(pending OR name NOT NULL)/D/D/D | O/W(insert own)/D/D | A/A/A/A |
| `payment_intents` | D/D/D/D | O(own via orders)/W(insert own)/D/D | A/A/A/A |
| `profiles` | 🔴 R(USING true) — **PII leak** | R + U(own, **ไม่มี guard กัน role**) | A/A/A/A |
| `inventory` | 🔴 R(USING true) — supplier/stock leak | R/D/D/D | A/A/A/A |
| `customers` | D/D/D/D | O(phone=auth.email OR admin)/D/D/D | A/A/A/A |

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