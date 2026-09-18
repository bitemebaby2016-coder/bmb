# SECURITY_REMEDIATION_PLAN — Bite Me Baby

> Baseline: `e6b3e65` | Date: 2026-09-18 | Phase B-B (Recommended — รออนุมัติ)
> ตาม master handoff §27: forensic (B-A) ก่อน → จัดลำดับ P0/P1 (B-B) แล้วจึงแก้

---

## Priority ตาม §28 (P0) / §29 (P1)

## P0-1 Service-role key exposure (**EXPOSED**) 🔴
1. ลบ `supabaseAdmin` ออกจาก client (`src/lib/supabase.ts:34-41`) — client ต้องไม่มี service-role
2. ลบ `VITE_SUPABASE_SERVICE_ROLE_KEY` ออกจาก `.env` / `.env.local`
3. ย้าย privileged ops ไป **Edge Function** (server-side) ที่เรียกด้วย service_role
4. **Rotate service-role key** บน Supabase Dashboard (เพราะ bundle ที่ leak แล้ว) — เป็น manual step ของ owner
5. ตรวจ bundle ใหม่: `grep -r 'sb_secret_' dist/` → ต้องไม่มี

## P0-2 Authentication → Supabase Auth (เลิก localStorage) 🔴
1. `Register` → `supabase.auth.signUp(email,password)` + insert `profiles(id=auth.uid(), role='customer')`
2. `Login` → `supabase.auth.signInWithPassword`
3. Session → `supabase.auth.onAuthStateChange` (ไม่ใช้ `bmb_auth`)
4. ลบ `authenticateUser/ByPhone/createUser/verifyPassword` ฝั่ง browser (และ `ADMIN_DEFAULT_HASH`)
5. ลบ `initializeAdmin()` ที่ boot ไม่ให้สร้าง admin แบบ hardcode

## P0-3 Admin privilege → ไม่มี role escalation 🔴
1. `profiles` — trigger `BEFORE UPDATE` block การเปลี่ยน `role` จากผู้ใช้ทั่วไป (อนุญาตเฉพาะ admin/EF)
2. `AdminRoute` (App.tsx) → ตรวจ `isAdmin()` จาก Supabase (RLS) ไม่ใช้ localStorage flag/email fallback
3. Admin คนแรก ตั้งผ่าน Supabase Dashboard (owner) หรือ Edge Function

## P0-4 Price authority → server-side 🔴
1. สร้าง **RPC/Edge Function** `create_order_with_items(payload)`:
   - load `products.price` จาก DB (authoritative)
   - recalc subtotal / discount (promotions table) / delivery_fee / total
   - insert order + items ใน transaction เดียว
2. Client ส่งเฉพาะ `product_id, quantity, options, coupon` — **ไม่ trust** `total_amount/unit_price/discount/delivery_fee`
3. เพิ่ม CHECK constraint `total_amount >= 0`

## P0-5 Payment → real integration (เลิก simulation) 🔴
1. Stripe Payment Intent สร้างจาก Edge Function (server-side secret)
2. Client ส่ง payment_method_id → EF → `stripe.paymentIntents.confirm`
3. Webhook `/webhook/stripe` → verify signature → update payment_intents + orders.payment_status
4. State: pending → processing → paid/failed; idempotency + amount match
5. COD → ยังไม่ mark paid จนกว่ายืนยันที่หน้ารับของ

## P0-6 Order state machine 🔴
1. trigger/RPC validate transition (allow-list จาก status→status)
2. actor: admin เท่านั้นเปลี่ยน; customer ยกเลิกได้ถ้าอยู่สถานะที่อนุญาต
3. client ส่ง status ไม่ได้ตามใจ (ปัจจุบัน `updateOrderStatus` รับอะไรก็ได้)

## P0-7 RLS hardening (migration 006) 🔴
1. `DROP POLICY p_public_all_*` ทั้ง 9 ตาราง (delivery_rounds, reviews, promotions, notifications, loyalty_points, preorder_votes, inventory_transactions, ai_conversations, ai_recommendations)
2. สร้าง policy ใหม่ตาม `RLS_MATRIX.md` ที่ต้องการ (public read เฉพาะที่จำเป็น)
3. แก้ `orders_anon_read`: เฉพาะ `status='delivered' OR 'cancelled'` (ลบ `OR phone IS NOT NULL`)
4. แก้ `pre_orders_anon_read`: ปิดหรือให้เฉพาะข้อมูลที่ public ได้จริง
5. `profiles`: public read จำกัด field; own update **ห้าม role**; admin manage
6. `inventory`: anon **อ่านไม่ได้** (admin RPC เท่านั้น)
7. `customers`: own read ใช้ `auth.uid() = user_id`
8. `is_admin()`: เพิ่ม `SET search_path = public`
9. GRANT: จำกัด anon SELECT เฉพาะที่จำเป็น; authenticated W เฉพาะตารางที่ควร

---

## P1 (รองลงมา)
| # | งาน | หมายเหตุ |
|---|-----|----------|
| P1-1 | Capacity race condition → RPC reserve_capacity ด้วย row lock + check < max | ป้องกัน oversell |
| P1-2 | Inventory reservation/consumption บน order (transaction) | ลด stock เมื่อ confirm |
| P1-3 | Migrate business data จาก localStorage → Supabase (register/login/orders/promotions/reviews) | ลด dual-store |
| P1-4 | `audit_logs` table + trigger write | แทน localStorage audit |
| P1-5 | PromotionsPage/ReviewPage ใช้ DB (ไม่ใช้ hardcode/localStorage) | consistency |
| P1-6 | Payment reconciliation: pending ไม่ mark paid โดยไม่ verify | initiation |

---

## Tests Required (Phase B DoD)
- [ ] `grep dist/ assets` ไม่พบ service-role → PASS
- [ ] RLS live test: anon SELECT products ✅ / anon SELECT orders → DENY / user แก้ role ตัวเอง → DENY / admin full / cross-user DENY
- [ ] Auth e2e: signUp → login → session → logout → refresh token
- [ ] Price tamper test: ส่ง total=0, price=0 → server recalc/DENY
- [ ] Order state: delivered→pending DENY, skip state DENY
- [ ] Payment: webhook signature verify, duplicate webhook idempotent, amount mismatch reject

---

## Files ที่จะแก้ (เมื่ออนุมัติ B-B)
- `supabase/migrations/006_secure_rls_hardening.sql` (ใหม่)
- `src/lib/supabase.ts`, `src/store/authStore.ts`, `src/lib/bmbAdminApi_users.ts`
- `src/pages/login/LoginPage.tsx`, `src/pages/login/RegisterPage.tsx`
- `src/lib/bmbAdminApi_orders.ts`, `src/lib/paymentGateway.ts`, `src/lib/cartStore.ts`
- `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/App.tsx`

---

## DoD อย่างย่อ
- bundle ไม่มี service-role + rotate เสร็จ (owner)
- RLS matrix test ผ่านทุก cell
- Auth ทั้งหมดผ่าน Supabase; AdminRoute ตรวจ DB
- ราคา/state/payment ถูก enforce server-side
- localStorage business keys ปลอดจาก authoritative role
## Status Update (2026-09-18 — applied via commits `4f8c5c9` + this session)

| Priority | Status | Where |
|----------|--------|-------|
| P0-1 (bundle service-role) | ✅ client purge done; **rotate key = owner** | supabase.ts, .env/.env.local |
| P0-2 (Supabase Auth) | ✅ DONE | authStore.ts, Login/Register, AdminRoute |
| P0-3 (admin privilege) | ✅ DONE | profiles guard trigger + is_admin() |
| P0-4 (price authority) | ✅ DONE (migration 007 live) | `create_order_with_items` |
| P0-5 (payment real) | ✅ code done in this session / ⛔ deploy blocked (owner) | migration 008 + `create-checkout`/`stripe-webhook` EF + paymentGateway.ts |
| P0-6 (order state machine) | ✅ code done in this session / ⛔ apply migration 008 to live DB (owner) | migration 008 (`order_transition_allowed`, trigger, `transition_order_status`) |
| P0-7 (RLS hardening) | ✅ DONE (migration 006 live) | 006 |

**Tests Required (Phase B DoD) update:** `grep dist/` no service-role ✅; auth e2e ⛔ (live email rate-limit today, retry later); price tamper ✅ (mock contract test `ERR_AMOUNT_MISMATCH`); order state ✅ (14 offline contract tests); payment webhook idempotency ✅ (mock test); **live webhook test ⛔** (needs EF deployed + Stripe webhook endpoint configured in Stripe Dashboard).

→ Full audit trail: `PHASE_C_TRUSTED_BACKEND_FORENSIC.md`