# AUTHORIZATION_AUDIT — Bite Me Baby

> Baseline: `e6b3e65` | Date: 2026-09-18 | Phase B

---

## 1. Identity Model (ปัจจุบัน)

- **ไม่มี** Supabase Auth signUp/signIn เรียกจากหน้า Login/Register (`LoginPage` เรียก `authenticateUser` จาก `bmbAdminApi_users`)
- Identity ทั้งหมดมาจาก localStorage:
  - `bmb_auth` — session `{ customer, isAuthenticated }`
  - `bmb_users` — user list รวม `password_hash` + `role`
  - `bmb_admin_role` — flag `'true'`/`'false'`
- `profiles.id` (UUID, FK `auth.users`) มีใน DB แต่ frontend **ไม่ได้สร้าง** row ให้ user ที่ลงทะเบียนผ่าน localStorage

---

## 2. Authorization Mapping (real)

| Operation | ตรวจจาก | โดย backend/DB? | Result |
|-----------|---------|-----------------|--------|
| เข้าถึง `/admin/*` | `localStorage.bmb_admin_role === 'true'` OR `customer.email==='admin@bmb.co.th'` (`App.tsx:74`) | ❌ UI only | 🔴 BYPASSABLE |
| เข้าถึง `/profile /rewards /viral /ai-chat` | `authStore.isAuthenticated` (จาก localStorage `bmb_auth`) | ❌ UI only | 🔴 BYPASSABLE |
| SELECT products (customer) | RLS `is_available=true` | ✅ | OK |
| INSERT orders | RLS `orders_own_create` — อนุญาตเฉพาะ authenticated | ✅ policy | ⚠️ frontend ใช้ anon key → **insert จะ FAIL** หลัง 005 |
| UPDATE order status | RLS: admin-only | ✅ policy | ⚠️ frontend ใช้ anon → UI หยุดทำงาน |
| Admin CRUD products | RLS: admin-only (is_admin) | ✅ policy | ⚠️ frontend ใช้ anon → **FAIL** |
| Admin dashboard stats | Supabase + localStorage users | 🔴 | ตัวเลขจาก 2 แหล่ง ไม่ตรงกัน |

---

## 3. Key Findings

### F1 — AdminRoute bypass (UI only) 🔴
```tsx
// App.tsx:74
const isAdminUser = localStorage.getItem('bmb_admin_role') === 'true'
  || customer.email === 'admin@bmb.co.th'  // fallback
```
→ เปิด DevTools → `localStorage.setItem('bmb_admin_role','true')` → เข้า admin UI ได้ทันที

### F2 — Frontend ใช้ anon client สำหรับ operation ที่ต้องการ admin/auth 🔴
- `bmbAdminApi_products/orders/inventory/reviews` → `supabase` (anon)
- Migration 005 อนุญาต insert/update/delete เฉพาะ authenticated + admin
- **ผล:** หลังเปิด RLS secure → CRUD ทั้งหมดจาก anon จะ fail → `createOrder` fallback ไป localStorage (dual-store ยิ่งซ้ำ)

### F3 — profiles role escalation (RLS) 🔴
```sql
-- 005
CREATE POLICY profiles_own_write ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```
- ไม่มี guard ห้ามเปลี่ยน `role` → user (ถ้า authenticated จริง) แก้ profile ตัวเอง `role='admin'` ได้
- `is_admin()` จะ return true → ผ่าน policy admin ทั้งหมด = **privilege escalation**

### F4 — Phone vs Email identity mismatch 🟠
- Policies ใช้ `customer_phone = auth.email()`
- user sign-in ด้วย email แต่ order เก็บ `customer_phone` (เบอร์โทร) → match ไม่ได้ → own-read policy ไม่ทำงานตามที่ตั้งใจ

### F5 — Audit log ฝั่ง client 🟠
- `writeAuditLog()` เก็บ localStorage `bmb_audit_logs` — ไม่มี server traceability

---

## 4. Required Authority Model (เป้าหมาย Phase C/D)

1. Browser → **Supabase Auth** signIn → JWT → RLS (anon client เท่านั้น)
2. `profiles.id = auth.uid()`; `role` ตั้งโดย **secure trigger / Edge Function** เท่านั้น — client แก้ไม่ได้
3. Admin operations → **Edge Function / RPC** (service_role อยู่ server-side เท่านั้น)
4. Price / payment / order state → **backend (EF/RPC/trigger) เท่านั้น**
5. AdminRoute → ตรวจจาก profile ใน DB (ผ่าน RLS/isAdmin) **ไม่ใช้ localStorage**

---

## 5. Remediation References
→ `SECURITY_REMEDIATION_PLAN.md` (P0-2, P0-3, P0-4, P0-7)