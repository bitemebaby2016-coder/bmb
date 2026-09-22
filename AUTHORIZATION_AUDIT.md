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

---

## 6. CURRENT STATE — POST-WAVE 3 VERIFIED (2026-09-22)

> **Baseline:** `ed1ac58` | **Verified:** local + production via `e2e/prodCheckGrants.cjs`, `prodRunContracts.cjs`, `prodCheckMigrations.cjs`

### 6.1 DB/ACL Remediation Status (COMPLETED & VERIFIED)

| Finding | Original Severity | Current Status | Evidence |
|---------|-------------------|----------------|----------|
| F2 — Frontend uses anon for admin operations | 🔴 CRITICAL | ✅ **Mitigated by grant layer** (RLS policies block access; grants aligned per 033) | Grant probe 7/7 PASS (local + remote), contracts 023/028/029/030/033 5/5 PASS production |
| F3 — profiles role escalation (RLS) | 🔴 CRITICAL | ✅ **Remediated** (migration 006 + 033 guard, migration 034 REVOKE authenticated ALL on profiles) | anon_profiles_write=0 ✅, auth_profiles_write=0 ✅ |
| F4 — Phone vs Email identity mismatch | 🟠 HIGH | ⚠️ **Still present in RLS policy logic** (not fixed by 033/034) | Policy `customer_phone = auth.email()` still exists; no application fix |
| F5 — Audit log client-side only | 🟠 HIGH | ⚠️ **Application-level finding** (DB audit_logs table created via 018 but frontend not fully migrated) | `audit_logs` table exists (production); frontend still dual-store |
| F1 — AdminRoute bypass (UI only) | 🔴 CRITICAL | ⚠️ **NOT SOLVED by DB fixes** (localStorage-based auth persists in frontend code) | Code evidence: `App.tsx:74` still reads `bmb_admin_role` from localStorage |

### 6.2 What Was Fixed (DB Layer Only)

- **Migration 033** (table-ACL alignment): Restored service_role grants, aligned authenticated/anon table privileges, revoked public_profiles view-write, revoked pre_orders auth writes
- **Migration 034** (prod ACL drift remediation): REVOKE anon non-canonical I/U/D + SELECT; REVOKE authenticated ALL on F-5 tables (payment_intents, inventory, profiles); minimal GRANT for contracts
- **Result**: Production ACL gate = PASS, anon residue 0/0, REST leak closed, canonical reads intact

### 6.3 What Remains (Application/Auth Architecture Work)

| Domain | Current State | Required Migration | Notes |
|--------|---------------|--------------------|-------|
| Browser → Supabase Auth signIn | localStorage-only (`bmb_auth`) | Migrate Login/Register to `supabase.auth.signInWithPassword` | **NOT done by 033/034**; application-layer change |
| AdminRoute authorization | UI check via `localStorage.bmb_admin_role` | Check `profile.role` via RLS/isAdmin() | **NOT done by 033/034**; DB grant now correct, but frontend bypass remains |
| Price authority | Client cart calculation (`cartStore.ts`) | Server-side recalc via RPC/EF | **NOT done by 033/034**; 033/034 are grant-only, no schema change |
| Payment spine | Stripe EF deployed (2026-09-19) ✅ | Already partially done | Webhook verified; client simulation in `paymentGateway.ts` may still exist |
| Order state machine | Server-enforced (migration 008/030) ✅ | Already done | Allow-list + trigger working |
| Capacity/Inventory | Server-trigger (migration 007+) ✅ | Already done | Gaps documented in deep audit (G-02, G-03) |

### 6.4 Distinction: DB ACL Remediation ≠ Full Application Authentication

> **Important:** Migration 033/034 resolved the **grant/ACL layer** (what PostgREST enforces). This does NOT mean:
> - The browser is using Supabase Auth (it still uses localStorage)
> - AdminRoute checks database roles (it checks localStorage flag)
> - Price/payment flows are server-authoritative (many still rely on client calculations)
>
> These are **application-level architectural changes** that require separate implementation phases. The DB is now properly secured, but the application frontend has not yet been fully migrated to use Supabase Auth or enforce authority server-side.

---

**End of AUTHORIZATION_AUDIT**
*Baseline e6b3e65 | Current state ed1ac58 (WAVE 3 Verified) | Principles: Evidence > Claims, Historical forensic preserved*