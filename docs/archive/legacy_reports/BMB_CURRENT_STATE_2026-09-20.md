# BMB_CURRENT_STATE_2026-09-20.md

> **สถานะตรวจสอบล่าสุด:** 2026-09-22 · **HEAD:** `ed1ac58` (docs sync checkpoint)
> **บทบาทเอกสาร:** "ความจริงของระบบวันนี้" -- ยึด CODE + LIVE DB + TEST evidence เป็น source of truth
> สถานะปัจจุบันอ้างอิงจาก audit รอบนี้เท่านั้น -- **overwrite ไม่ append**
> เอกสารอื่น (`README`, `MASTER_PRODUCT_SPEC`, `CLOSURE_BOOK`) = reference ไม่ใช่ proof

---

## 1. Executive Summary

Bite Me Baby = production-first Cloud Kitchen Platform; ร้านจริงจันทบุรี (Grab + social)
PWA live บน https://bitemebaby-5f7.pages.dev, Supabase project `ivkdfognyiwjcmrhcnwz`
เงิน/คำสั่งซื้อ = server-authoritative (RPC + RLS + Stripe webhook verified)

**PHASE 6 UI/Admin closure** และ **PHASE 7 Content Approval UI** เสร็จสมบูรณ์แล้ว (2026-09-21)
**WAVE 3 DB Hardening (migrations 033/034)** VERIFIED ผ่าน production (2026-09-22)

**Migrations 001–034:** ทั้งหมด APPLIED บน production DB แล้ว (`supabase db push` — history 34/34 consistent) --> ACL gate PASS (grant probe 7/7), contracts 5/5 PASS, REST anon recipes leak CLOSED

### ระดับความคืบหน้าภาพรวม

| หมวด | สถานะจริง | Evidence |
|------|-----------|----------|
| Customer Storefront (Landing/Menu/Cart/Checkout/Payment/Tracking) | **LIVE** | Production PWA ผ่าน flow |
| Order Spine (same-day + pre-order) | **VERIFIED** | RPC on live DB + tests |
| Payment (PromptPay + COD + Card/Stripe) | **VERIFIED** | Webhook verified 6/6 (2026-09-19) + real refund verified |
| Refund | **VERIFIED** | EF `stripe-refund` + real Stripe refund 172 THB (2026-09-19) |
| Kitchen & Inventory (019) | **VERIFIED** | Live DB deployed + RPCs |
| Bite Drive / Delivery (020) | **APPLIED + LIVE** (db push 2026-09-21) | DB applied + REST probes 29/29 PASSED |
| AI (proxy + guardrails + memory) | **VERIFIED** | Code deployed, server-side |
| Notifications (021) | **VERIFIED** | Live DB deployed |
| Customer Intelligence (022) | **VERIFIED** | Live DB deployed |
| Content Approval (022 + UI) | **LIVE** | `/admin/content-approvals` functional |
| Admin Dashboard/UI (Phase 6+7) | **LIVE** | Category headings, image upload, AdminNav |
| PWA (installable, service worker, offline) | **VERIFIED** | sw.js + 52 precache entries |
| Security (RLS) | **VERIFIED** | Hardened 005-006 + WAVE 3 (033/034) ACL alignment |

---

## 2. Production Reality

| Channel | Status | Evidence |
|---|---|---|
| PWA production | **LIVE** -- https://bitemebaby-5f7.pages.dev | e2e/prod-smoke.json |
| Supabase production | `ivkdfognyiwjcmrhcnwz.supabase.co` | e2e REST probes |
| Stripe webhook (EF) | **VERIFIED** 6/6 (2026-09-19) | e2e/webhook-smoke-result.json |
| Real orders | มีจริง (ตัวอย่าง: BMB-*, PO-*) | e2e/e2e-result.json |

---

## 3. Repository Snapshot

- Frontend: React + TypeScript strict + Vite + Tailwind + Zustand + react-router + vite-plugin-pwa
- Pages: ~38 (`src/pages/` -- customer/admin/rider/ai)
- Lib layer: `src/lib/*`; Stores: `src/store/` + `src/stores/`; Admin: `src/pages/admin/*`
- Edge Functions (Deno): `create-checkout`, `stripe-webhook`, `stripe-refund`, `phone-auto-login`, `ai-proxy`
- Migrations: **001–034** ใน `supabase/migrations/` (34/34 applied, history consistent)
- Tests: **22 test files** (`src/__tests__/`) — **179/179 PASS**
- E2E: `e2e/sqlContracts.cjs`, `e2e/prodSmoke.cjs`, `e2e/webhook-smoke.cjs`, `e2e/prodCheckGrants.cjs`, `e2e/prodRunContracts.cjs`, `e2e/prodCheckMigrations.cjs`

---

## 4. Money + Order Spine (Server-Authoritative)

- Create order: RPC `create_order_with_items` (migration 007) -- ราคา/ยอดจากฐานข้อมูล
- Pre-order: RPC `create_pre_order_with_items` / `quote_pre_order` / `cancel_pre_order` (migration 017)
- Payments: `record_payment_result` / webhook verified, idempotent + amount-match (008/010)
- Audit: `append_audit_log` (018) -- ใน money/order RPCs
- Vocabulary: `orderVocabulary.ts` (PAY-04) -- canonical

---

## 5. Migration Status (Live DB, probe 2026-09-22 — WAVE 3 VERIFIED)

| Migration | File Present | Code Ready | DB Applied | Live Verified | Status | Evidence |
|-----------|:-----------:|:-----------:|:-----------:|:-------------:|--------|----------|
| 001–016 | YES | YES | YES | YES | **APPLIED** | Base schema + RLS + add-ons/banner |
| 017 (pre-order) | YES | YES | YES | YES | **APPLIED** | pre-order RPCs + RLS revoke |
| 018 (audit log) | YES | YES | YES | YES | **APPLIED** | `append_audit_log` |
| 019 (kitchen/core) | YES | YES | YES | YES | **APPLIED** | deduct/restore/batches/recipes/kitchen_queue |
| 020 (bite drive) | YES | YES | YES | YES | **APPLIED + LIVE** | db push 2026-09-21 -- REST probes ERR control PASS 4/4 |
| 021 (notifications/AI) | YES | YES | YES | YES | **APPLIED** | notif/errors/memory/mascot |
| 022 (phases 5-7) | YES | YES | YES | YES | **APPLIED** | customer_intelligence, content_approvals |
| 023 (order spine) | YES | YES | YES | YES | **APPLIED** | canonical orders + mode gate |
| 024 (round lifecycle) | YES | YES | YES | YES | **APPLIED** | round template + cutoff |
| 025 (canonical RPC) | YES | YES | YES | YES | **APPLIED** | create_order_with_items v3 |
| 026 (inventory agg) | YES | YES | YES | YES | **APPLIED** | create_production_batch |
| 027 (kitchen) | YES | YES | YES | YES | **APPLIED** | kitchen queue + batch |
| 028 (op guarantees) | YES | YES | YES | YES | **APPLIED** | confirmed=>deducted invariant |
| 029 (promptpay cast) | YES | YES | YES | YES | **APPLIED** | payment_ref to_jsonb |
| 030 (transition fix) | YES | YES | YES | YES | **APPLIED** | order_transition_allowed ELSE |
| 031 (ACL drift) | YES | YES | YES | YES | **APPLIED** | default-privileges + 33 fn REVOKE |
| 032 (execute drift) | YES | YES | YES | YES | **APPLIED** | 5 PUBLIC EXECUTE revokes |
| **033 (table ACL)** | **YES** | **YES** | **YES** | **YES** | **APPLIED** | **GRANT/REVOKE alignment (F-3)** |
| **034 (prod drift)** | **YES** | **YES** | **YES** | **YES** | **APPLIED** | **REVOKE-only F-3 follow-up** |

> **UPDATE 2026-09-22 (WAVE 3):** `supabase db push` สำเร็จ (033 + 034 recorded) -- history **34/34 consistent** -- `e2e/prodCheckMigrations.cjs --remote` = **34/34** -- `e2e/prodCheckGrants.cjs --remote` = **7/7 PASS** -- `e2e/prodRunContracts.cjs` = **5/5 PASS** (023/028/029/030/033) -- REST anon recipes leak CLOSED (401)

---

## 6. Tests -- Build -- Lint (วัดจริง 2026-09-22)

| Gate | ผลลัพธ์จริง | หมายเหตุ |
|------|------------|----------|
| `npm test` | **179/179 PASS** (22/22 files — มี VITE_SUPABASE_URL/ANON_KEY ใน env; ยืนยัน 2026-09-22) | ไม่มี env = 154 (2 files module-level fail — environment difference ไม่ใช่ logic error) |
| `npm run build` | **PASS** -- tsc strict + vite + PWA sw.js (52 entries) | Precache 52 entries |
| `npm run lint` | **0 errors** | QA-02 baseline |
| **CI (GitHub Actions)** | **PASS** — run #15 head `ed1ac58` (test + lint + build, Node 24) | Node 24 fixed jsdom engines |
| `node e2e/sqlContracts.cjs --include-new` | **29/29 PASSED** (หลัง push 020) | bite-drive 4/4 deployed -- evidence ใน sql-contract-result.json |
| `e2e/prodCheckMigrations.cjs --remote` | **34/34 PASS** | history consistent local==remote |
| `e2e/prodCheckGrants.cjs --remote` | **7/7 PASS** | anon_write_residue=0, anon_extra_select=0 |
| `e2e/prodRunContracts.cjs` | **5/5 PASS** | contracts 023/028/029/030/033 |

### Test Files Detail (22 files, 179 tests)

| Test File | Status | Notes |
|-----------|--------|-------|
| addonDisplay.test.ts | PASS | |
| adminUi.test.ts | PASS | 11 tests (Phase 6 UI) |
| aiGuardrails.test.ts | PASS | |
| aiServerMemory.test.ts | PASS | |
| aiModels.test.ts | PASS | 2 tests (Model A = GLM 5.2 free + fallback) |
| api.test.ts | PASS | 36 tests |
| availabilityEngine.test.ts | PASS | 5 tests |
| biteAIStore.test.ts | PASS | 8 tests |
| cartIsolationStore.test.ts | PASS | 6 tests |
| deliveryFeeApi.test.ts | PASS | 5 tests (ต้องมี VITE_SUPABASE_URL/ANON_KEY ใน env) |
| deliveryRouter.test.ts | PASS | |
| deliveryRouterStore.test.ts | PASS | 3 tests |
| kitchenService.test.ts | PASS | 4 tests (ต้องมี VITE_SUPABASE_URL/ANON_KEY ใน env) |
| offlineUtils.test.ts | PASS | 5 tests |
| orderStateMachine.test.ts | PASS | 10 tests |
| orderVocabulary.test.ts | PASS | 5 tests |
| paymentStateMachine.test.ts | PASS | 15 tests |
| phases5_7.test.ts | PASS | 5 tests |
| preOrderApi.test.ts | PASS | 2 tests |
| deliverySandbox.test.ts | PASS | 5 tests |

---

## 7. PHASE 6 UI/Admin -- เสร็จแล้ว (fact ใน code)

| Item | Status | ตำแหน่ง |
|------|--------|---------|
| Category headings manager | **LIVE** | `/admin/products` -- สร้าง/เปลี่ยนชื่อ/ซ่อน/ลบ heading |
| Image upload: cancel/remove | **LIVE** | ปุ่ม Remove image + URL fallback + preview |
| Admin navigation | **LIVE** | AdminNav ทุกหน้า `/admin` + Header ตาม role + BottomNav Dashboard |
| คู่มือ User/Admin | **UPDATED (overwrite)** | `docs/BiteMeBaby_ADMIN_GUIDE_TH.md`, `docs/BiteMeBaby_USER_GUIDE.md` |

---

## 8. PHASE 7 -- Growth UI เสร็จแล้ว

| Item | Status | ตำแหน่ง |
|------|--------|---------|
| Content approval workflow UI | **LIVE** | `/admin/content-approvals` -- submit/approve/reject + note |
| Banner promotions auto-submit | **LIVE** | บันทึก banner --> ไป approval อัตโนมัติ |
| CNT-01 lib | **VERIFIED** | `src/lib/contentApproval.ts` (canPublish), RPC on live DB |

---

## 9. PWA-100-GATE Status

- **Test/build/lint**: ผ่าน (ดู Section 6) — 179/179 tests, build PASS, lint 0
- **SQL contracts**: 29/29 PASSED (2026-09-21) + **WAVE 3 production contracts 5/5 PASS** (2026-09-22)
- **Production PWA**: LIVE (bitemebaby-5f7.pages.dev)
- **Residual blockers**:
  - ~~Owner SQL suite (`e2e/contracts_020_bite_drive.sql` ใน SQL Editor)~~ **RESOLVED 2026-09-21** — owner รันผ่าน (Success, transaction rolled back — หลังแก้ haversine_km 42883)
  - Lighthouse Perf >= 90 --> รอ owner รัน production
  - ~~AI key VITE_OPENROUTER_API_KEY ยังอยู่ใน .env.local~~ **RESOLVED 2026-09-21** — production bundle scan = **0 key hits**; chat ใช้ `ai-proxy` EF (key server-side) — legacy key ใน .env.local เครื่อง owner ไม่ถูก bundle และไม่ถูก client code อ่าน (aiToolCalling.ts เป็น dead path)
  - Card loop: ต้องการ bill จริงรายการเดียวสำหรับ PAY-02 ครบ
- **WAVE 3 Verification (2026-09-22)**: ACL gate PASS (grant probe 7/7), contracts 5/5 PASS production, REST anon recipes leak CLOSED, F-5 dormant, history 34/34 consistent

---

## 10. Known Unresolved Issues

| # | Issue | Domain | Status | Owner Action |
|---|-------|--------|--------|--------------|
| 1 | ~~Migration 020 ไม่อยู่บน live DB~~ RESOLVED: db push สำเร็จ 2026-09-21 | DEL-01..04 | **VERIFIED** | -- |
| 2 | ~~SQL contracts 28/29~~ RESOLVED: 29/29 PASSED (compute_delivery_fee_rpc deployed) | DEL-01 | **VERIFIED** | -- |
| 3 | Lighthouse รอบวัดแรก (2026-09-21, owner, **PREVIEW deploy** c04ffb8b): Perf **41** / A11y 85 / BP 100 / SEO 61, LCP 29.3s, TBT 910ms, SI 18.1s, CLS 0 | PWA-01 | PARTIAL | วัดซ้ำบน production domain (bitemebaby-5f7.pages.dev) + แก้ LCP |
| 4 | ~~SEC-02: AI key ใน .env.local~~ RESOLVED: production bundle scan 0 key hits (2026-09-21), chat ผ่าน ai-proxy EF | SEC-02 | **VERIFIED** | -- |
| 5 | REFUND: EF พร้อมแต่ไม่มี evidence การคืนเงินจริง — **RESOLVED 2026-09-19: real Stripe refund 172 THB verified** | REFUND | **VERIFIED** | -- |
| 6 | Card loop: ไม่มี bill จริง | PARTIAL | PENDING | ต้องการ 1 real bill |
| 7 | External courier APIs (Grab / LINEMAN / Foodpanda) — **ทุกเจ้ายังรอ API keys** (sandbox/mock) | DEL-EXT | DEFERRED/SANDBOX | รอ keys จาก call-center |

---

## 11. Next Required Actions

1. ~~db push + contracts~~ **DONE 2026-09-21** (29/29 PASSED)
2. ~~Owner: Supabase SQL Editor -- รัน `e2e/contracts_020_bite_drive.sql` (owner suite)~~ **DONE 2026-09-21** (PASS — transaction rolled back)
3. **WAVE 3 DB Hardening** — **COMPLETE 2026-09-22** (migrations 033/034 applied + verified production)
4. **Owner:** Lighthouse บน production --> ลงหลักฐานใน evidence pack
5. **REAL-WORLD PILOT** (2-4 สัปดาห์) --> PATCH/HARDENING LOOP --> **M1 = BMB PRODUCTION 100%**
6. **SAAS PRODUCTIZATION GATE** --> Domain B (PHASE 8+)

---

## 12. Session Continuity Rule

เปิด session ใหม่โดยอ่านตามลำดับนี้:

```
1. README.md
2. docs/BMB_CURRENT_STATE_2026-09-20.md <-- เอกสารหลัก
3. docs/BMB_MASTER_PRODUCT_SPEC.md
4. docs/BMB_100_PERCENT_CLOSURE_BOOK.md
5. CODE / LIVE DB / TEST evidence
```

เมื่อเกิด conflict:

```
CODE / LIVE DB / TEST/EVIDENCE --> override --> DOCUMENT
```

---

## 13. Evidence References

| Evidence | ตำแหน่ง |
|----------|---------|
| Tests 179/179 | `npm test` (2026-09-22 — env ครบ; ไม่มี env = 154) |
| CI | GitHub Actions run #15 **PASS** (Node 24 — test+lint+build, head `ed1ac58`) |
| Build + PWA | `npm run build` --> dist/sw.js (52 entries) |
| Lint 0 errors | `npm run lint` |
| SQL contracts REST | `e2e/sql-contract-result.json` (**29/29** -- 2026-09-21T14:27Z re-run) |
| WAVE 3 Production Verification | `e2e/prod-check-grants-result.json` (7/7 PASS), `e2e/prod-contracts-result.json` (5/5 PASS), `e2e/prod-check-result.json` (34/34 history) |
| SEC-02 bundle scan | production JS scan 2026-09-21 = **0 key hits** (index.html + 9 bundles) — `ai-proxy` EF only |
| Owner SQL suites | `e2e/contracts_*.sql` |
| Prod smoke / webhook | `e2e/prod-smoke.json`, `e2e/webhook-smoke-result.json` |
| PHASE 6/7 tests | `src/__tests__/adminUi.test.ts` (11 tests) |
| Guides | `docs/BiteMeBaby_ADMIN_GUIDE_TH.md`, `docs/BiteMeBaby_USER_GUIDE.md` |

---

**สุดท้าย Current State -- เขียนทับทุกครั้งหลังจาก audit ด้วย evidence จริง ไม่ใช่ append**
