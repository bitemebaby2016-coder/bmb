# DATA_AUTHORITY_MAP — Bite Me Baby

> Baseline: `e6b3e65` | Date: 2026-09-18 | Phase B

---

## 1. localStStorage/browser keys → purpose → authoritative?

| Key | Purpose | Authoritative? | อยู่ DB ด้วย? | ปลอดภัย? | ต้อง migrate? |
|-----|---------|----------------|--------------|----------|----------------|
| `bmb_users` | user DB + password hashes | ❌ client | ควรเป็น auth.users/profiles | 🔴 tamperable | ✅ Supabase Auth |
| `bmb_auth` | session (customer + flag) | ❌ client | ควรเป็น Supabase session | 🔴 tamperable | ✅ Supabase Auth |
| `bmb_admin_role` | admin flag | ❌ client | profiles.role | 🔴 tamperable | ✅ profile.role |
| `bmb_audit_logs` | audit trail | ❌ client | ไม่มี table | 🔴 | ✅ new audit_logs |
| `bmb_promotions` | promotion data | ❌ client | promotions (001) มีแต่ unused | 🔴 | ✅ promotions table |
| `bmb_reviews` | reviews | ❌ client | reviews (001) มี | 🔴 | ✅ reviews table |
| `bmb_provider_orders` | provider delivery orders | ❌ client | ไม่มี | 🔴 | ✅ new table (Phase D) |
| `bmb_inventory` | inventory state (Zustand) | ❌ client | inventory (001) มี | 🔴 | ✅ inventory table |
| `bmb_inventory_transactions` | inventory tx | ❌ client | inventory_transactions มี | 🔴 | ✅ |
| `bmb_pre_orders` | pre-order fallback | ⚠️ fallback | pre_orders (001) มี | 🟠 | ✅ pre_orders |
| `bmb_payment_intents` | payment fallback | ⚠️ fallback | payment_intents มี | 🟠 | ✅ payment_intents |
| `bmb_ai_memory_*` | AI memory | ❌ client | ai_conversations (memory ต่างกัน) | 🟠 | ✅ |
| `bmb_customer_intelligence_*` | customer intel | ❌ client | ไม่มี | 🟠 | ✅ |

**ข้อสรุป:** ทุก business-critical key ต้อง migrate ขึ้น Supabase

---

## 2. Client / Server Boundary Map (Master Handoff §23)

```
PUBLIC CLIENT (browser)
├── products/categories read (public)              ✅ OK
├── orders create (ใช้ anon)                        🔴 ผิด boundary → ต้อง auth + RPC
├── price/total calculate                          🔴 ผิด boundary → ต้อง server
├── payment confirm                                🔴 ผิด boundary → ต้อง provider + webhook
├── user/pass verify                               🔴 ผิด boundary → Supabase Auth
├── admin UI check (localStorage)                  🔴 ผิด boundary → profile.role via RLS
├── service-role key ใน bundle                     🔴 ผิด boundary → รั่วไปแล้ว
└── promotions/reviews/inventory ใช้ localStorage   🔴 ผิด boundary → ต้อง DB

TRUSTED BACKEND (ต้องสร้าง Phase C/D)
├── Edge Function / Supabase RPC
│   ├── checkout (คำนวณราคา server-side)
│   ├── payment intent + webhook verify
│   ├── order state transition (validate machine)
│   ├── capacity reservation (transaction + lock)
│   └── admin operations (service_role เฉพาะที่นี่)
└── service_role key อยู่ server-side เท่านั้น

SUPABASE
└── RLS ต้องแก้:
    ├── anon read เฉพาะสินค้า/หมวดหมู่/วันที่ open round
    ├── own policy ใช้ auth.uid()/user_id (ไม่ใช่ phone vs email)
    ├── admin ผ่าน is_admin() (เพิ่ม SET search_path)
    └── DROP p_public_all ทั้ง 9 ตาราง
```

---

## 3. Summary
- Source of truth เป้าหมาย: **Supabase tables** สำหรับ business data; **Supabase Auth** สำหรับ identity
- localStorage ใช้ได้เฉพาะ: UI convenience (theme, cart draft, last search) — **ห้าม** เป็น transaction/authority/sensitive data