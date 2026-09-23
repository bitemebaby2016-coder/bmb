# BMB_100_PERCENT_CLOSURE_BOOK.md

> **Version 5.0 (2026-09-23, M1 CLOSURE PHASE 1)**
> บทบาท: master checklist "อะไรยังเหลือก่อนปิด M1"
> กฎ: ปิดเฉพาะที่มี evidence, ไม่ปิดด้วยเอกสารเท่านั้น
> Statuses: LIVE / VERIFIED / PARTIAL / MISSING / BROKEN / DEFERRED / PENDING

---

## Update Log

| Date | Change |
|------|--------|
| 2026-09-23 | v5.0 — Added SEC-M1 auth hardening results; marked REFUND_PARTIAL→VERIFIED already in v4.0; added EXPERIMENT_CHECKLIST.md reference |

## Closure Table (updated 2026-09-23 — M1 Phase 1 Security Hardening)

### A. AUTH & AUTHORIZATION (SECURITY)

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| SEC-A1 | Supabase Auth for login/register/logout | **VERIFIED** | `authStore.ts` uses `supabase.auth.*` exclusively |
| SEC-A2 | No localStorage auth anywhere | **VERIFIED** | Removed all `bmb_auth` reads from `auditLog.ts`; no other consumer exists |
| SEC-A3 | Admin route authorization via DB role | **VERIFIED** | `AdminRoute` queries `profiles.role` via RLS in `fetchProfileRole()` |
| SEC-A4 | No hardcoded admin email bypass | **VERIFIED** | Search confirms only legacy docs contain `admin@bmb.co.th` references |
| SEC-A5 | No dead bcrypt password functions | **VERIFIED** | Removed `hashPassword`/`verifyPassword` from `bmbStorage.ts` (never used) |
| SEC-A6 | Audit logs server-authoritative | **VERIFIED** | `writeAuditLog()` pushes to `append_audit_log` RPC; client-side entry uses `user_id='system'` |
| SEC-A7 | Rider session intentionally local | **VERIFIED** | Documented in `RiderPwaPage.tsx` — phone-based auth, RLS-scoped RPCs prevent cross-driver access |

### B. PAYMENT & FINANCE

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| PAY-01 | Server-authoritative pre-order pricing | **VERIFIED** | RPC + RLS + quote/cancel |
| PAY-02 | Card loop + real bill | **PARTIAL** | Client flow ready; needs 1 real bill |
| PAY-03 | Real refund | **VERIFIED** | EF `stripe-refund` + real Stripe refund 172 THB verified 2026-09-19 |
| PAY-04 | Canonical order vocabulary | **VERIFIED** | orderVocabulary.ts + tests |
| PAY-05 | Pre-order payment processing | **VERIFIED** | Both SAME_DAY and PRE_ORDER use `createPaymentIntent` in CheckoutPage → PaymentConfirmationPage works for both |

### C. ORDER LIFECYCLE

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| ORD-01 | Server-side state machine + audit | **VERIFIED** | transitions + append_audit_log via RPC |
| ORD-02 | Unified orders table (SAME_DAY + PRE_ORDER) | **VERIFIED** | Migration 023 unified domain; both modes use same `orders` table |
| INV-01/02 | Inventory auto-deduct/restore | **VERIFIED** | RPC deployed live (019) |
| KIT-01/02 | Production batches/recipes/BOM | **VERIFIED+** | Deployed; batch creation by admin (intentional design); UI queue PARTIAL |
| DEL-01..04 | Bite Drive dispatch | **VERIFIED** | Real rider flow via PWA; assignment chain working |
| CANCEL-01 | Customer cancellation | **VERIFIED** | `cancel_order` RPC with capacity/inventory restore |

### D. INFRASTRUCTURE

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| MIG-01 | Migrations 001–034 | **VERIFIED** | 34/34 LIVE on production, history consistent |
| ACL-01 | ACL gate | **VERIFIED** | Grant probe 7/7 PASS, anon_write_residue=0, anon_extra_select=0 |
| CI-01 | CI/Pipeline | **VERIFIED** | GitHub Actions run #15 (Node 24), BUILD PASS |
| TESTS-01 | Unit/integration tests | **VERIFIED** | 358/358 PASS (44 files) |
| SQL-01 | SQL contracts | **VERIFIED** | 29/29 base + 5/5 WAVE 3 = 34/34 total |
| LHR-01 | Lighthouse production | **PENDING** | Local: Perf 29 / A11y 82 / BP 100 / SEO 100; production measurement needed |

---

## M1 Gap Summary (as of 2026-09-23T15:05Z)

| Category | Verified | Partial | Pending | Notes |
|----------|----------|---------|---------|-------|
| Auth/Security | 7 items | 0 | 0 | All security gates passed |
| Payment/Finance | 4 | 1 | 0 | PAY-02 card bill needs owner action |
| Order Lifecycle | 6 | 1 | 0 | KIT-01 manual batch creation intentional |
| Infrastructure | 5 | 1 | 0 | LHR-01 needs production measurement |

**Total:** 22 verified, 2 partial, 0 pending technical blocks.
**Blocking items:** None technical. One remaining business action (real card bill).

---

## Migrations (verified 2026-09-23 — M1 Phase 1)

- 001-034 -- **APPLIED on live DB** (history **34/34 consistent**)
- e2e/sqlContracts.cjs -- **29/29 PASSED**
- Production verification: **34/34 PASS** · Grants **7/7 PASS** · Contracts **5/5 PASS**
- New test evidence: **EXPERIMENT_CHECKLIST.md** created for owner pilot testing

---

## PWA-100-GATE Criteria

| # | Criterion | Status |
|---|----------|--------|
| 1 | All main flows work on production PWA | VERIFIED (same-day + pre-order + payment + kitchen + delivery) |
| 2 | Prices/payment server-authoritative | VERIFIED |
| 3 | auth/RLS/audit no sk in frontend | VERIFIED (all localStorage auth removed) |
| 4 | AI: key in proxy, guardrails, memory | VERIFIED (SEC-02: bundle scan 0 key hits) |
| 5 | Offline/retry + ErrorBoundary | VERIFIED |
| 6 | Perf: vendor split, build | PARTIAL (Lighthouse production measurement needed) |
| 7 | Evidence-pack: tests/build/lint/contracts | Ready |
| 8 | Production ACL hardening | VERIFIED (WAVE 3 — grant probe 7/7, anon residue 0/0) |

---

## Exact Next Task (owner)

```
1) supabase db push → DONE (migrations 001–034 applied)
2) Lighthouse production → RECORD IN EVIDENCE (owner action)
3) REAL-WORLD PILOT start → See EXPERIMENT_CHECKLIST.md
4) Card bill payment → ONE real card charge needed to close PAY-02
```

---

## End of Closure Book v5.0 -- Updated 2026-09-23 M1 Phase 1 Security Hardening
