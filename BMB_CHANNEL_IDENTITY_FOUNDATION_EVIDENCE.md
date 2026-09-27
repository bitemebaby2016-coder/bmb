# BMB_CHANNEL_IDENTITY_FOUNDATION_EVIDENCE.md
**IDENTITY FOUNDATION — External Channel Identity → Canonical Customer · วันที่: 2026-09-27**
ภาษาไทยเป็นหลัก · TEST DATA ONLY

## 1. Owner Authorization
- Owner command "BMB — OWNER AUTHORIZATION / F-14 IDENTITY FOUNDATION" (2026-09-27):
  อนุมัติ **Identity Schema Foundation เท่านั้น** · ห้าม Facebook/Messenger production integration ·
  ห้าม W3-D · NO SELF-LINKING · deny-by-default · design ตาม F-14 evidence §14

## 2. Design Delta จากแบบร่าง §14
- **ไม่มี design delta** — implement ตรงตามแบบร่าง (columns/PK/FK/UNIQUE/INDEX/RLS/GRANTS
  ตรงตามที่รายงานไว้) · เพิ่มเติมจาก audit ระหว่างงาน (อธิบายใน §12): migration 047 เพิ่ม
  unique_violation handling ใน link RPC (concurrency จริง)

## 3. Production Baseline
- HEAD = `ed1b8dd` (F-14) · production migrations ล่าสุด = 045 → migration ถัดไป = **046** ·
  F-14 CORE = PASS (16/16) · ไม่มี identity table ก่อนงานนี้

## 4. Schema (migration 046) — additive, reversible
- TABLE `customer_channel_identities`:
  - id uuid PK (gen_random_uuid) · channel text NOT NULL · external_user_id text NOT NULL ·
    customer_ref uuid NOT NULL FK → auth.users(id) ON DELETE CASCADE · display_name text NULL ·
    created_at/updated_at
- **UNIQUE (channel, external_user_id)** = durable duplicate guard (channel เป็นส่วนของ key —
  Facebook ID ≠ Messenger ID) · INDEX (customer_ref)
- **data minimization**: ไม่มี column token/secret/message content ใด ๆ

## 5. RLS / Grants (deny-by-default)
- RLS ENABLE · policy เดียว: `cci_admin_read` (SELECT TO authenticated USING is_admin())
- **ไม่มี** anon/customer/driver SELECT policy · **ไม่มี** INSERT/UPDATE/DELETE policy ใด ๆ
- REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated (defense-in-depth)
- writes เกิดได้เฉพาะผ่าน SECURITY DEFINER admin RPCs (audited)
- `resolve_channel_identity` = service_role only (REVOKE FROM PUBLIC, GRANT to service_role)

## 6. RPC Contracts (server-authoritative)
| RPC | สิทธิ์ | พฤติกรรม |
|---|---|---|
| `link_channel_identity(p_channel, p_external_user_id, p_customer_ref, p_display_name)` | admin only (ERR_ONLY_ADMIN) | สร้าง mapping; duplicate → no-op พร้อม existing; collision (owner อื่น) → **ไม่ reassign เงียบ ๆ** รายงาน collision=true + audit |
| `unlink_channel_identity(p_id)` | admin only | ลบ mapping + audit (relink ต้อง link ใหม่ชัดเจน) |
| `resolve_channel_identity(p_channel, p_external_user_id)` | service_role only | lookup → canonical customer (สำหรับ verified adapter ในอนาคต) |

## 7. NO SELF-LINKING
- ไม่มี flow ใดที่ customer JWT + arbitrary external_user_id → link ได้
- customer/driver เรียก link → ERR_ONLY_ADMIN (runtime-verified)
- link/unlink ทั้งหมด = admin/operational operation พร้อม actor จาก auth.uid()

## 8. Privacy / Data Minimization
- เก็บเฉพาะ: channel / external_user_id / customer link / display_name (optional) ·
  **ไม่เก็บ** access token / OAuth secret / password / message content / profile payload ·
  external_user_id ไม่ถูก expose ให้ frontend (RLS deny)

## 9. Auditability (ใช้ audit_logs เดิม — ไม่สร้าง audit system ใหม่)
- actions: `identity_linked` / `identity_link_duplicate` / `identity_link_rejected`
  (collision ทั้ง pre-check และ concurrent) / `identity_unlinked` — พร้อม actor + metadata
- runtime ยืนยัน: ทั้ง 4 actions มีจริงใน audit_logs (probe)

## 10. Migration
- **046** channel_identity_foundation (table + index + RLS + REVOKE + 3 RPCs + grants)
- **047** identity_concurrency_fix (link RPC: catch unique_violation → collision audited
  — จากบั๊กจริงที่ production concurrent probe พบ: parallel link → ฝั่งหนึ่ง raw 400)
- ทั้งคู่ additive/reversible (DROP TABLE + DROP FUNCTION) · ไม่แตะ orders เดิม · ไม่ backfill

## 11. Production Apply
- `npx supabase db push` — 046, 047 applied (log: "Applying... Finished") · ไม่มี SQL error

## 12. Production E2E — `e2e/identity-foundation-e2e.json` · TEST DATA ONLY · **PASS 19/19**
| ตรวจ | ผล |
|---|---|
| customer self-link (arbitrary external id + JWT) → ERR_ONLY_ADMIN | PASS |
| driver link → ERR_ONLY_ADMIN | PASS |
| admin link → created (FACEBOOK) | PASS |
| duplicate link (same channel+ext) → same id, duplicate=true | PASS |
| same external id + different channel (MESSENGER) → separate identity | PASS |
| same channel + different external id → separate | PASS |
| identity collision (different customer) → rejected, owner unchanged | PASS |
| admin SELECT เห็น · customer/driver SELECT 0 rows · anon 401 | PASS ×4 |
| direct table INSERT by customer → 403 | PASS |
| resolve via service_role → linked + customer_ref ถูกต้อง | PASS |
| resolve via anon → denied (401) | PASS |
| unlink → row หาย · relink → row ใหม่ | PASS ×2 |
| **concurrent identity creation (parallel, different customers) → ONE row + collision (DB constraint)** | PASS |
| audit trail ครบ 4 actions | PASS |

## 13. Regression (ทั้งหมดหลัง migration บน production)
- **F-05 Order History 12/12** ✓ · **F-06 Driver Identity 14/14** ✓ (หลังเตรียม test order
  dispatchable — precondition ด้าน test data) · **F-18 RLS 15/15** ✓
- **W3-A 11/11** ✓ · **W3-B 13/13** ✓ (หมายเหตุ: ครั้งแรกพบ ERR_CAPACITY_FULL — ความจุของ
  **test round** `round-w3b-test` เต็มจาก test orders สะสม → ขยาย capacity ของ test round
  เอง (test data) — ไม่ใช่ regression) · **W3-C 12/12** ✓ · **F-14 16/16** ✓
- tsc 0 · vitest 22 files / 179 tests ✓ · build ✓ · lint 0 · git/dist secret scan CLEAN
- test count note (ตามข้อ 13 ของ Owner): ก่อน exclude รายงาน 44 files/358 tests (นับซ้ำจาก
  `src/.kilo/worktrees` 2 ชุด) → ปัจจุบัน **22 files / 179 tests = canonical unique suite**
  (แจ้งไว้แล้วใน F-14 evidence §21 — ไม่มี canonical test หาย)

## 14. GAP
1. Facebook/Messenger/LINE **production adapter + webhook** = NOT STARTED (ต้องรอรอบถัดไป —
   foundation พร้อมเรียกใช้: source_channel + external_ref_id + duplicate guard + identity
   mapping + resolve RPC)
2. GDPR-style erasure/unlink policy ยังไม่ได้ออกแบบลึก (ปัจจุบัน: admin unlink manual +
   FK cascade กับ auth.users)

## 15. READY
- Identity Foundation = READY (schema + constraints + RLS + RPC + audit runtime-verified)
- โครงสร้างพร้อมสำหรับ W3-C-EXTERNAL (adapters) เมื่อ Owner เปิด

## 16. BLOCKED
- External channel production integration (ทุกช่องทาง) — NOT STARTED ตามคำสั่ง
- W3-D Notifications — NOT STARTED ตามคำสั่ง

## 17. Quality Gate
tsc 0 ✓ · vitest 22/179 ✓ · build ✓ · lint 0 ✓ · git/dist/runtime secret scan ✓ ·
RLS matrix (identity table) ✓ · ACL (REVOKE) ✓ · production E2E 19/19 ✓ · concurrency ✓ ·
regression ครบ ✓

## 18. Final Gate (แยก verdict)
```
Identity schema          = PASS
Identity constraints     = PASS
Identity security        = PASS
Identity RLS             = PASS
Identity RPC             = PASS
Concurrency              = PASS (DB constraint จริง)
Production verification  = PASS (19/19)
Regression               = PASS (F-05/F-06/F-18/W3-A/W3-B/W3-C/F-14 ครบ)
Quality Gate             = PASS

F-14 CORE                = PASS
IDENTITY FOUNDATION      = PASS
Facebook integration     = NOT STARTED
Messenger integration    = NOT STARTED
W3-D                     = NOT STARTED
```
**ห้ามสรุปเป็น "W3-C = PASS" จนกว่า external channel implementation จะถูกทำและ verified จริง**