# BMB_02_RLS_PRODUCTION_AUDIT.md
**Read-only RLS/GRANT reality (production)** Â· Evidence: `e2e/prod-phase2-audit.json → rls/policies/policy_exprs/table_grants`

## ผลจาก catalog จริง

- **RLS ON ทุกตาราง** (ไม่มี relrowsecurity=false)
- Pattern หลักของ policies: `is_admin()` (SECURITY DEFINER helper) + `auth.uid()` ownership + deny-by-false placeholders

## Access matrix ที่ยืนยันจาก policy expression จริง

| Resource | anon | authenticated | service_role |
|---|---|---|---|
| orders SELECT | เฉพาะ status ∈ {delivered, cancelled} (orders_anon_read) | own (customer_ref=auth.uid()) หรือ is_admin() | full (grant) |
| orders INSERT | none | check(customer_ref = auth.uid()) | full |
| orders UPDATE | none | **using=false (block ทุกกรณี — ต้องผ่าน RPC)** | full |
| orders DELETE | none | none (เฉพาะ is_admin() ผ่าน orders_admin_manage) | full |
| payment_intents | using=false (deny) | own + own_create (ผ่าน order_number→orders.customer_ref) | full |
| business_settings | using=false | SELECT=true (อ่านได้) Â· write เฉพาะ is_admin() | full |
| customers | using=false | own read + is_admin() manage | full |
| products | SELECT เมื่อ is_available=true | admin manage | full |
| recipes | **SELECT=true (anon อ่านสูตรได้ทั้งหมด — by design แต่ mission ท้าทายจุดนี้)** | admin manage | full |
| delivery_rounds | SELECT เมื่อ status='active' | admin manage | full |
| drivers | deny | SELECT=true (อ่านได้ทุกคน login) Â· write is_admin() | full |
| public_profiles (view) | — | SELECT เท่านั้น | full |

## Grants (ผล table_grants)

- **anon write residue = 0** (anon ไม่มี INSERT/UPDATE/DELETE บนตารางใด — ตรงเป้า 033)
- service_role = full CRUD ครบ (service_role_missing=0)
- authenticated ได้ grant CRUD กว้างในหลายตาราง (customers, recipes, drivers, ai_*, delivery_assignments, provider_orders, system_errors...) — **ความปลอดภัยจริงพึ่ง policy expressions ไม่ใช่ grant narrowing** — policy ข้างบนจำกัดได้จริงเพียงพอสำหรับหลายตาราง แต่ตารางที่ policy = "authenticated ALL is_admin()" + grant กว้าง ผลลัพธ์ก็ปลอดภัยเพราะ policy กรอง อย่างไรก็ตามตารางที่ policy รูปแบบ `auth_read using=true` (เช่น drivers) = authenticated ทุกคนอ่านได้ทั้งตาราง (รวมเบอร์โทรไรเดอร์) — **MEDIUM finding**

## Anon runtime probe

- anon_orders_read = 17 rows ใน table — แต่ policy กรองด้วย status (delivered/cancelled) → anon เห็นเฉพาะ delivered/cancelled (ป้องกันข้อมูล live) — จริงหรือไม่ต้อง live-test (Phase 9: NOT VERIFIED)

## Cross-customer access

- orders/payment_intents มี ownership predicate จริง (`customer_ref = auth.uid()`) ที่ระดับ policy — **live cross-user test = NOT VERIFIED (Phase 9)**
