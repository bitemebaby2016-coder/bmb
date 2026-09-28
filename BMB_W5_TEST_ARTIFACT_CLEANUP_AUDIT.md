# BMB_W5_TEST_ARTIFACT_CLEANUP_AUDIT

**Date:** 2026-09-28 · **Mode:** READ-ONLY CLASSIFICATION ONLY — **NOTHING deleted / refunded / revoked / mutated / schema-changed / payment-state-changed.** Purpose: classify each artifact so the Owner can decide.

Classification legend (per artifact): **SAFE DELETE · SAFE REFUND · KEEP FOR EVIDENCE · OWNER ACTION REQUIRED · DEPENDENCY / RISK**

---

## Summary Matrix

| # | Artifact | Verdict | Owner action needed? | Dependency / Risk |
|---|---|---|---|---|
| 1 | Order `PO-20260929-131` | **KEEP FOR EVIDENCE** | No (until report archived) | Low — holds QA test data only |
| 2 | Order `BMB-20260928-900` | **SAFE DELETE** (pre-fix guard residue) | Yes (approve delete) | None; cancelled, zero charges |
| 3 | Order `BMB-20260928-322` | **SAFE DELETE** (guard probe) | Yes (approve delete) | One open PI (`pi_3UKYWZ…`) to cancel first |
| 4 | QA auth `+66990000001` | **SAFE DELETE** | Yes (approve) | None (orphan, reuse-bug residue) |
| 5 | QA auth `+66990000002` | **SAFE DELETE** | Yes (approve) | None (orphan, reuse-bug residue) |
| 6 | QA auth `+66990000003` (`QA W52`) | **KEEP / OWNER ACTION** | Yes (final call) | Role already restored to `customer` |
| 7 | Driver `QA W52 Driver` (`+66990000100`) | **SAFE DELETE** (post-pilot) | Yes (approve) | Keep staffed for W5-3 pilot; delete after |
| 8 | Stripe TEST charges (3 × 110.00) | **SAFE REFUND** (TEST mode) | Yes (approve + EF/admin) | TEST money; optional to refund |
| 9 | Orphan/pending PaymentIntents | **OWNER ACTION REQUIRED** | Yes | Must cancel PIs before deleting orders |

---

## 1. Order `PO-20260929-131` — **KEEP FOR EVIDENCE**
- Status: `delivered` / `paid` · PRE_ORDER · scheduled 2026-09-29 · QA identity.
- **Classification:** KEEP FOR EVIDENCE (it IS the H2 proof; cited in readiness report). Do NOT touch.
- **Dependency/Risk:** holds only test data (no real PII). No external system dependency. Safe to leave indefinitely, or Owner may later delete after the report is archived.

## 2. Order `BMB-20260928-900` — **SAFE DELETE** (pre-fix residue)
- Status: `cancelled` · SAME_DAY · created for the FIRST (pre-fix) guard probe; `create-checkout` ran → 2 open PIs created in Stripe but **no DB rows, zero charges**.
- **Classification:** SAFE DELETE (order row + its child rows) — but the 2 Stripe PIs attached to it must be **cancelled first** (Stripe-side), otherwise they are orphaned intents (see #9).
- **Owner action required:** approve DB delete; approve/cancel Stripe PIs.
- **Risk:** if deleted before PI cancel → orphan intents in Stripe (harmless in TEST but untidy).

## 3. Order `BMB-20260928-322` — **SAFE DELETE** (guard probe)
- Status: `cancelled` · created for the FIXED guard probe (`w5w2-pi-guard.json`); 2× `create-checkout` → **same PI** (`pi_3UKYWZ3yHrQLTgfK1Qvzh96Z`), 1 `payment_intents` row, zero charges.
- **Classification:** SAFE DELETE (order + its 1 PI row). Cancel the open Stripe PI first.
- **Owner action required:** approve delete + cancel the open PI.
- **Risk:** the open PI will otherwise idle until Stripe auto-cancels.

## 4. & 5. QA auth users `+66990000001` → `+66990000002` — **SAFE DELETE** (orphans)
- Both are **orphan residue of the `phone-auto-login` reuse bug** (created during W5-2 before the fix; no usable session/order). No `delivered` evidence depends on them.
- **Classification:** SAFE DELETE (Auth admin destructive — production delete requires **Owner approval** per rule).
- **Risk:** none functionally; deletion is one-way (Auth). Keep until Owner approves.

## 6. QA auth user `+66990000003` = `QA W52` / customer `cust-66990000003` — **KEEP / OWNER ACTION**
- The active H2 identity (order `PO-…` owner). **Privilege tier ALREADY REVOKED to `customer`** (verified). No admin rights remain.
- **Classification:** KEEP FOR EVIDENCE until report archived. **OWNER ACTION REQUIRED** for final disposition (retain as dormant QA test account vs delete).
- **Risk:** it can submit real orders if used in the PWA — keep it as a known test account; do not promote. No active risk while un-promoted.

## 7. Driver `QA W52 Driver` (`+66990000100`, `drv-…-c10a`, status AVAILABLE, `QA TEST VEHICLE`) — **SAVE FOR PILOT / SAFE DELETE LATER**
- Used for W5-2 assignment; now available (assignment completed/delivered).
- **Classification:** **KEEP for the W5-3 physical pilot** (it is the natural TEST DRIVER), then **SAFE DELETE** after pilot completes. Final deletion = OWNER ACTION.
- **Risk:** if a real dispatch later targets this driver record, it could be contacted — flag phone as QA/test to prevent contamination.

## 8. Stripe TEST charges — **SAFE REFUND (TEST MODE)**
- 3 × 110.00 THB (test money) on `PO-…-131` (`pi_3UKWV33…`, `pi_3UKWWA3…`, `pi_3UKWX13…`), all **TEST MODE** (pk_test).
- **Classification:** SAFE REFUND **optional** — TEST money has no value; refund is hygiene only. Requires `stripe-refund` EF/admin or Stripe Dashboard (OWNER).
- **Risk:** none; strictly test funds. No action strictly required.

## 9. Orphan / pending PaymentIntents — **OWNER ACTION REQUIRED**
- (a) 2 pending PIs from `BMB-20260928-900` (no DB row, uncancelled). (b) 1 open PI `pi_3UKYWZ…` on `BMB-20260928-322`. All TEST mode.
- **Classification:** CANCEL in Stripe Dashboard (TEST) or via EF — OWNER action. DB rows to remove only with their parent orders.
- **Dependency/Risk:** must be cancelled **before** their order rows are deleted (keeps Stripe↔DB consistent). No payment risk in TEST mode.

---

## Dependencies & ordering (if Owner approves cleanup)
1. Cancel open/orphan Stripe PIs (Stripe TEST) → 2. delete orders `BMB-20260928-900` / `-322` (+ their child rows) → 3. delete orphan auth users `+66990000001/2` → 4. optional: refund 3 TEST charges → 5. keep `PO-…-131` + `+66990000003` + `QA W52 Driver` for evidence/pilot → 6. after pilot: delete driver record.

**As of this audit: nothing above has been executed. Classification only.**