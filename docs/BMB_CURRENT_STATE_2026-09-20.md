# BMB_CURRENT_STATE_2026-09-20.md

> **สถานะตรวจสอบล่าสุด:** 2026-09-21 · **HEAD:** `0e85c370306fab97c842eccf5be2a1ff0522f7bd`
> **บทบาทเอกสาร:** "ความจริงของระบบวันนี้" -- ยึด CODE + LIVE DB + TEST evidence เป็น source of truth
> สถานะปัจจุบันอ้างอิงจาก audit รอบนี้เท่านั้น -- **overwrite ไม่ append**
> เอกสารอื่น (`README`, `MASTER_PRODUCT_SPEC`, `CLOSURE_BOOK`) = reference ไม่ใช่ proof

---

## 1. Executive Summary

Bite Me Baby = production-first Cloud Kitchen Platform; รานจริงจันทบุรี (Grab + social)
PWA live บน https://bitemebaby-5f7.pages.dev, Supabase project `ivkdfognyiwjcmrhcnwz`
เงิน/คำสั่งซื้อ = server-authoritative (RPC + RLS + Stripe webhook verified)

**PHASE 6 UI/Admin closure** และ **PHASE 7 Content Approval UI** เสร็จสมบูรณ์แล้ว (2026-09-21)

**Migration 020 (Bite Drive):** APPLIED บน production DB แล้ว (2026-09-21, `supabase db push` — 020/021/022 recorded) --> Bite Drive RPCs LIVE (REST contracts 29/29)

### ระดับความคืบหน้าภาพรวม

| หมวด | สถานะจริง | Evidence |
|------|-----------|----------|
| Customer Storefront (Landing/Menu/Cart/Checkout/Payment/Tracking) | **LIVE** | Production PWA ผ่าน flow |
| Order Spine (same-day + pre-order) | **VERIFIED** | RPC on live DB + tests |
| Payment (PromptPay + COD + Card/Stripe) | **VERIFIED** | Webhook verified 6/6 (2026-09-19) |
| Refund | **PARTIAL** | EF พร้อม แต่ยังไม่พิสูจน์ real refund |
| Kitchen & Inventory (019) | **VERIFIED** | Live DB deployed + RPCs |
| Bite Drive / Delivery (020) | **APPLIED + LIVE** (db push 2026-09-21) | DB applied + REST probes 29/29 PASSED |
| AI (proxy + guardrails + memory) | **VERIFIED** | Code deployed, server-side |
| Notifications (021) | **VERIFIED** | Live DB deployed |
| Customer Intelligence (022) | **VERIFIED** | Live DB deployed |
| Content Approval (022 + UI) | **LIVE** | `/admin/content-approvals` functional |
| Admin Dashboard/UI (Phase 6+7) | **LIVE** | Category headings, image upload, AdminNav |
| PWA (installable, service worker, offline) | **VERIFIED** | sw.js + 80 precache entries |
| Security (RLS) | **VERIFIED** | Hardened across 005-006 |

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
- Migrations: 001--022 ใน `supabase/migrations/`
- Tests: 21 test files (`src/__tests__/`)
- E2E: `e2e/sqlContracts.cjs`, `e2e/prodSmoke.cjs`, `e2e/webhook-smoke.cjs`

---

## 4. Money + Order Spine (Server-Authoritative)

- Create order: RPC `create_order_with_items` (migration 007) -- ราคา/ยอดจากฐานข้อมูล
- Pre-order: RPC `create_pre_order_with_items` / `quote_pre_order` / `cancel_pre_order` (migration 017)
- Payments: `record_payment_result` / webhook verified, idempotent + amount-match (008/010)
- Audit: `append_audit_log` (018) -- ใน money/order RPCs
- Vocabulary: `orderVocabulary.ts` (PAY-04) -- canonical

---

## 5. Migration Status (Live DB, probe 2026-09-21)

| Migration | File Present | Code Ready | DB Applied | Live Verified | Status | Evidence |
|-----------|:-----------:|:-----------:|:-----------:|:-------------:|--------|----------|
| 001--016 | YES | YES | YES | YES | **APPLIED** | Base schema + RLS + add-ons/banner |
| 017 (pre-order) | YES | YES | YES | YES | **APPLIED** | pre-order RPCs + RLS revoke |
| 018 (audit log) | YES | YES | YES | YES | **APPLIED** | `append_audit_log` |
| 019 (kitchen/core) | YES | YES | YES | YES | **APPLIED** | deduct/restore/batches/recipes/kitchen_queue |
| 020 (bite drive) | YES | YES | YES | YES | **APPLIED + LIVE** | db push 2026-09-21 -- REST probes ERR control PASS 4/4 |
| 021 (notifications/AI) | YES | YES | YES | YES | **APPLIED** | notif/errors/memory/mascot |
| 022 (phases 5-7) | YES | YES | YES | YES | **APPLIED** | customer_intelligence, content_approvals |

> **UPDATE 2026-09-21:** `supabase db push` สำเร็จ (020 + 021 + 022 recorded) -- `node e2e/sqlContracts.cjs --include-new` = **29/29 PASSED**

---

## 6. Tests -- Build -- Lint (วัดจริง 2026-09-21)

| Gate | ผลลัพธ์จริง | ข้อมูลเอกสารเดิม | หมายเหตุ |
|------|------------|-----------------|----------|
| `npm test` | **163/163 PASS** (21/21 files — มี VITE_SUPABASE_URL/ANON_KEY ใน env; ยืนยันซ้ำ 2026-09-21) | บอก 163/163 | ไม่มี env = 154 (2 files module-level fail — environment difference ไม่ใช่ logic error) |
| `npm run build` | **PASS** -- tsc strict + vite + PWA sw.js (80 entries) | บอกผ่าน | Precache 80 entries |
| `npm run lint` | **0 errors** | บอก 0 | QA-02 baseline |
| **CI (GitHub Actions)** | **PASS** — run #15 head `0e85c37` (test + lint + build) | แดงตั้งแต่ run #3-#14 | root cause: Node 20 ไม่ตรง jsdom 30 engines (^24.15) — แก้เป็น Node 24 แล้ว |
| `node e2e/sqlContracts.cjs --include-new` | **29/29 PASSED** (หลัง push 020) | เดิมบอก 25/29 | bite-drive 4/4 deployed -- evidence ใน sql-contract-result.json |

### Test Files Detail

| Test File | Status | Notes |
|-----------|--------|-------|
| addonDisplay.test.ts | PASS | |
| adminUi.test.ts | PASS | 11 tests (Phase 6 UI) |
| aiGuardrails.test.ts | PASS | |
| aiServerMemory.test.ts | PASS | |
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
| providers.test.ts | PASS | |
| routeEta.test.ts | PASS | 5 tests |
| stripeRefundLogic.test.ts | PASS | |
| stripeWebhookSignature.test.ts | PASS | 5 tests |

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

- **Test/build/lint**: ผ่าน (ดู Section 6)
- **SQL contracts**: 29/29 PASSED (2026-09-21)
- **Production PWA**: LIVE
- **Residual blockers**:
  - ~~Owner SQL suite (`e2e/contracts_020_bite_drive.sql` ใน SQL Editor)~~ **RESOLVED 2026-09-21** — owner รันผ่าน (Success, transaction rolled back — หลังแก้ haversine_km 42883)
  - Lighthouse Perf >= 90 --> รอ owner รัน production
  - ~~AI key VITE_OPENROUTER_API_KEY ยังอยู่ใน .env.local~~ **RESOLVED 2026-09-21** — production bundle scan = **0 key hits**; chat ใช้ `ai-proxy` EF (key server-side) — legacy key ใน .env.local เครื่อง owner ไม่ถูก bundle และไม่ถูก client code อ่าน (aiToolCalling.ts เป็น dead path)
  - Card loop: ต้องการ bill จริงรายการเดียวสำหรับ PAY-02 ครบ

---

## 10. Known Unresolved Issues

| # | Issue | Domain | Status | Owner Action |
|---|-------|--------|--------|--------------|
| 1 | ~~Migration 020 ไม่อยู่บน live DB~~ RESOLVED: db push สำเร็จ 2026-09-21 | DEL-01..04 | **VERIFIED** | -- |
| 2 | ~~SQL contracts 28/29~~ RESOLVED: 29/29 PASSED (compute_delivery_fee_rpc deployed) | DEL-01 | **VERIFIED** | -- |
| 3 | Lighthouse รอบวัดแรก (2026-09-21, owner, **PREVIEW deploy** c04ffb8b): Perf **41** / A11y 85 / BP 100 / SEO 61, LCP 29.3s, TBT 910ms, SI 18.1s, CLS 0 | PWA-01 | PARTIAL | วัดซ้ำบน production domain (bitemebaby-5f7.pages.dev) + แก้ LCP |
| 4 | ~~SEC-02: AI key ใน .env.local~~ RESOLVED: production bundle scan 0 key hits (2026-09-21), chat ผ่าน ai-proxy EF | SEC-02 | **VERIFIED** | -- |
| 5 | REFUND: EF พร้อมแต่ไม่มี evidence การคืนเงินจริง | PARTIAL | PENDING | ต้องการ refund จริง 1 รายการ |
| 6 | Card loop: ไม่มี bill จริง | PARTIAL | PENDING | ต้องการ 1 real bill |
| 7 | External courier APIs (Grab / LINEMAN / Foodpanda) — **ทุกเจ้ายังรอ API keys** (sandbox/mock) | DEL-EXT | DEFERRED/SANDBOX | รอ keys จาก call-center |

---

## 11. Next Required Actions

1. ~~db push + contracts~~ **DONE 2026-09-21** (29/29 PASSED)
2. ~~Owner: Supabase SQL Editor -- รัน `e2e/contracts_020_bite_drive.sql` (owner suite)~~ **DONE 2026-09-21** (PASS — transaction rolled back)
3. **Owner:** Lighthouse บน production --> ลงหลักฐานใน evidence pack
4. **REAL-WORLD PILOT** (2-4 สัปดาห์) --> PATCH/HARDENING LOOP --> **M1 = BMB PRODUCTION 100%**
5. **SAAS PRODUCTIZATION GATE** --> Domain B (PHASE 8+)

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
| Tests 163/163 | `npm test` (2026-09-21 21:26 น. — env ครบ; ไม่มี env = 154) |
| CI | GitHub Actions runs #15/#16 **PASS** (Node 24 — test+lint+build, heads `0e85c37`/`f03a0f7`) |
| Build + PWA | `npm run build` --> dist/sw.js (80 entries) |
| Lint 0 errors | `npm run lint` |
| SQL contracts REST | `e2e/sql-contract-result.json` (**29/29** -- 2026-09-21T14:27Z re-run) |
| SEC-02 bundle scan | production JS scan 2026-09-21 = **0 key hits** (index.html + 9 bundles) — `ai-proxy` EF only |
| Owner SQL suites | `e2e/contracts_*.sql` |
| Prod smoke / webhook | `e2e/prod-smoke.json`, `e2e/webhook-smoke-result.json` |
| PHASE 6/7 tests | `src/__tests__/adminUi.test.ts` (11 tests) |
| Guides | `docs/BiteMeBaby_ADMIN_GUIDE_TH.md`, `docs/BiteMeBaby_USER_GUIDE.md` |

---

**สุดท้าย Current State -- เขียนทับทุกครั้งหลังจาก audit ด้วย evidence จริง ไม่ใช่ append**
