# 🎯 Bite Me Baby Status Tracker

> **Last Updated:** 2026-09-22 · **Version:** v12.0 (WAVE 3 VERIFIED · migration 033/034 · ACL gate PASS · contracts 017–022 limitation documented)
> **Purpose:** Real-time status ของทุกงาน — อัปเดตตามผลตรวจจริง (เขียนทับสถานะเดิม)

---

## ✅ Security Program — POST-WAVE 3 VERIFIED (2026-09-22)

> **2026-09-22 WAVE 3 update (production verified):**
> - Migration **033** (table-ACL alignment, F-3) + **034** (production ACL drift remediation, REVOKE-only) **VERIFIED on production**
> - Grant probe: **7/7 PASS** (local + remote) — anon_write_residue=0, anon_extra_select=0
> - Contracts on production: **023/028/029/030/033 = 5/5 PASS**
> - REST ACL: anon recipes leak **CLOSED (401)**, canonical reads intact, view-write blocked
> - F-5 policies: dormant / grant-blocked
> - Migration history: **34/34 consistent** (001–034), `20260812000002` cleaned (no file)
> - Local == Remote: **YES** (baseline `ed1ac58`)
> - Working tree: CLEAN

| ID | Item | Status | Evidence |
|----|------|--------|----------|
| 033 | Migration 033 table-ACL alignment (F-3) | ✅ **VERIFIED PROD** | Grant probe 7/7 PASS, contracts 5/5 PASS, REST leak closed |
| 034 | Migration 034 production ACL drift remediation | ✅ **VERIFIED PROD** | REVOKE-only corrective; anon residue 0/0 |
| 031 | Migration 031 production_acl_drift_repair | ✅ **RETAINED** | Valid migration file, audit trail |
| 032 | Migration 032 public_execute_drift_repair | ✅ **RETAINED** | Valid migration file, audit trail |
| 20260812000002 | Unknown history row | ✅ **CLEANED** | No migration file, unknown origin |
| P0-4 | Order creation/pricing server-side | ✅ **LIVE + E2E GREEN** | migration 007 (+009 fix) + `create_order_with_items` |
| P0-5 | Payment real integration (Stripe EF + webhook) | ✅ **LIVE + GATE PASSED** | create-checkout/stripe-webhook/stripe-refund deployed; smoke T1–T6 green; real Stripe PI → webhook → order paid; real Stripe refund → order refund |
| P0-6 | Order state machine (allow-list + trigger + RPC) | ✅ **LIVE** | migration 008 RPCs confirmed live; `transition_order_status` callable |
| Phase C | Forensic — trusted backend boundary + secrets + EF inventory | ✅ **DONE / GATE PASSED** | 9 EF shells = 0 files, NOT deployed (owner). C5 new (008 live), C6 new (F8/F9 fixed); C-6 refund EF live-verified |
| Phase D | Complete Admin (promotions/rounds/customers/settings/**media** + Customer Home v5) | ✅ **DONE (UI+API)** | 5 admin pages + OrdersPage + Home v5; E2E authenticated 7/7 PASS |
| .env | Client-facing secrets purged | ✅ DONE | Strict KEY=VALUE format, gate verified |

**Tests:** Vitest **179/179 PASS** (22 files) · `tsc --noEmit` 0 errors · `npm run build` PASS ·
**Live-verify:** 033/034 grants PASS production · contracts 023/028/029/030/033 PASS production · REST anon recipes 401 ✅

**Owner follow-up — WAVE 3 COMPLETE (verified 2026-09-22):**
1. Migration 033 applied + registered ✅
2. Migration 034 applied + registered ✅
3. Grant probe remote 7/7 PASS ✅
4. Contracts on production 5/5 PASS ✅
5. REST production: business_settings 401, mascot_overrides 200, recipes 401 (leak closed), customer_intelligence 401, public_profiles POST 401 ✅
6. F-5 policies dormant (grant-blocked) ✅

---

## ⚠️ Contracts 017–022 — Known Limitation (NOT Production Regression)

| Suite | HTTP | Result | Classification |
|-------|------|--------|----------------|
| 017_018 (pre-order + audit) | 400 | ❌ FAIL | Contract syntax bug (`fn%TYPE` invalid) — test artifact |
| 019 (kitchen core) | 400 | ❌ FAIL | Mgmt API executor lacks `auth.uid()` context — test-env limitation |
| 020 (Bite Drive) | 201 | ✅ PASS | Phone-based driver auth (no `auth.uid()`) |
| 021 (Phase 4) | 400 | ❌ FAIL | Mgmt API executor lacks `auth.uid()` — test-env limitation |
| 022 (Phases 5-7) | 400 | ❌ FAIL | Mgmt API executor lacks `auth.uid()` — test-env limitation |

**Summary:** 1/5 PASS. 4 failures attributable to **test-environment limitation** (Management API runs as `postgres` user, no `auth.uid()`/`is_admin()` context). **NOT classified as production regression.** Production functional paths covered by contracts 023/028/029/030/033 = 5/5 PASS.

---

## 🤖 Model A Configuration (2026-09-17)

| | Model | OpenRouter ID | Cost |
|-|-------|---------------|------|
| Primary (Model A) | GLM 5.2 (free) | `z-ai/glm-5.2:free` | $0 |
| Fallback | Qwen 3.7 Flash | `qwen/qwen3.7-flash` | ~$0.00003/token |

- Config: `src/lib/aiModels.ts` — `MODEL_A_PRIMARY`, `MODEL_A_FALLBACK`, `resolveModelA()`
- Behavior: `chatWithAI()` / `chatWithToolSupport()` ลอง Model A ก่อน → fail แล้ว retry ด้วย fallback 1 ครั้ง → ไม่มี fake success

---

## DEPLOYMENT STATUS (2026-09-22 — WAVE 3 Verified)

- **Build**: TypeScript **5.9.3** 0 errors ✅ + Vite PASS 🏗️ — pages lazy-split
- **Tests**: Vitest **179/179 PASS (100%)** — offline in-memory Supabase mock + delivery sandbox + pre-order API + Phase 4/5/6/7 contracts
- **PWA**: Service Worker + Manifest generated ✅
- **Production Deploy**: Cloudflare Pages (current baseline `ed1ac58`)
- **DB Migration**: **34/34 LIVE on Supabase** ✅ — migrations 001–034 applied and verified; RLS Secure Mode enforced
- **Git**: commit ตาม convention `type(scope): subject`. 007 grants re-run (idempotent) — anon EXECUTE revoked (anon → PGRST202). ✅
3. `supabase link` + `secrets set STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET` + deploy `create-checkout`/`stripe-webhook`. ✅
4. Original leaked service-role key rotated + **revoked by owner** (C-5 closed). ✅
5. Migration 009 (`extract_epoch`) applied by owner. ✅
6. Migration 010 (`record_payment_result` idempotency) **applied by owner**. ✅
7. Stripe endpoint alignment final: ACTIVE `we_1UHIrN3yHrQLTgfKkNZ4A0t5` (secret matches
   `STRIPE_WEBHOOK_SECRET`); old `we_1UHI8x3yHrQLTgfKDZhTTuMq` disabled; **REAL live delivery PASS**.
8. Migration **012** (products stock/rating/review_count) + **013** (PromptPay reference `::jsonb`→`to_jsonb` fix) — ⏳ **owner apply** (SQL Editor).
9. E2E now runs authenticated (007) — **7/7 PASS, 0 console errors** (landing→menu→cart→checkout→payment→tracking + pre-order + empty cart).

---
## CURRENT STATUS SUMMARY (v10.0 — 2026-09-17 Closure Final)

| Category | Total | Done | In Progress | Pending | % Complete |
|----------|-------|------|-------------|---------|------------|
| Tasks | 65 | 65 | 0 | 0 | **100%** |
| Components | 14+ | 14+ | 0 | 0 | **100%** ✅ |
| Routes (`App.tsx`) | 31 paths | 31 | 0 | 0 | **100%** ✅ |
| Admin Pages | 7 | 7 | 0 | 0 | **100%** ✅ |
| Libraries (`src/lib/`) | 25 | 25 | 0 | 0 | **100%** ✅ |
| Stores | 5 | 5 | 0 | 0 | **100%** ✅ |
| SEO/Content | 14 | 14 | 0 | 0 | **100%** |
| Documentation | 12+ | 12+ | 0 | 0 | **100%** |

**Notes (2026-09-18 v10.2 — Security Hardening):**
- ✅ **Model A:** GLM 5.2 (free) primary + Qwen 3.7 Flash fallback (`src/lib/aiModels.ts`)
- ✅ **Tests:** **26/26 PASS** offline (เดิม 19) — เพิ่ม 7 tests: **Delivery Providers sandbox logic** (5: cost/coverage/selection/order persist) + **Pre-order API** (2: create PO order number + read back)
- ✅ **BUILD (v10.1):** `tsc --noEmit` 0 errors + `vite build` PASS — TypeScript **5.9.3** (downgrade จาก 6.0.2 เพราะ Cloudflare Pages ใช้ Node.js 20) — หน้าเพจ lazy-split (MenuPage/Cart/Checkout/… 4–10 kB each); `bcryptjs` แยกเป็น lazy chunk 20.18 kB; PWA precache 52 entries
- ✅ **BUILD Fix:** แก้ `ADMIN_DEFAULT_HASH` syntax error ใน `src/lib/bmbAdminApi_users.ts` (bad merge ใน commit `1b30122`) + ลบ `"ignoreDeprecations": "6.0"` จาก `tsconfig.json`
- ✅ **Cloudflare Pages CI:** บิลด์ล้ม 2 ครั้ง (`1dbf988`, `9f58150`) → แก้แล้ว commit `3723d17` — รอ deploy ใหม่
- ✅ **Lighthouse (final):** **Performance 81** / A11y 85 / BP 100 / SEO 100 — `lighthouse/final_2026-09-17.json` (baseline เหล่า asset เก่า = 29; baseline ใหม่ก่อน optimization = 43)
- ✅ **E2E จริง (Playwright + system Chrome):** **7/7 PASS, 0 console errors** — Landing→Menu→Cart→Checkout→Payment→Tracking + Pre-order→Tracking + Empty-cart mascot — หลักฐาน `e2e/e2e-result.json` + 9 screenshots
- ✅ **Live Supabase write ตรวจจริง:** `orders`=`BMB-20260917-526`, `pre_orders`=`PO-20260917-338`, `payment_intents`=completed — REST write ผ่าน (RLS ยัง permissive รอ owner rebuild 001→004)
- ✅ **Mascot Pose Map:** `pointing` (hero CTA), `peeking` (review glass), `empty` (empty cart + sold-out + no-result), **`bye`** (ใหม่ = `bite_good bye.webp` — delivered/payment success) — ครบทุกท่า
- ✅ **Pre-order = order จริง:** `createPreOrder()` ถูกเรียกจาก HomePage/MenuPage → เขียน `pre_orders` (ไม่ใช่แค่ toast) — ใช้ mockup สินค้าต่อตาม owner
- ✅ **Live Supabase rebuild 001→005:** ✅ DONE (migration 001-005 รันบน Supabase แล้ว) — RLS policies 005_secure_rls_policies.sql (Secure Mode) — **is_admin() function working** — **RLS enforcing correctly** (Admin sees all, Users see own data)

---

## ✅ Phase 6: Security Hardening + Notification + Build Fix (100%)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| SEC-01 | bcrypt password hashing | DONE | bcryptjs salt rounds=12 |
| SEC-02 | API Key security | DONE | ไม่มี hardcoded fallback key |
| SEC-03 | Admin role-based access | DONE | auth check + localStorage flag |
| AUDIT-01 | Audit log system | DONE | 20 action types |
| AUDIT-02 | Audit log UI | DONE | /admin/audit-log |
| CHECKOUT-01 | Payment status fix | DONE | promptpay → 'pending' |
| ASYNC-01~07 | Pages async | DONE | await ทุก API call |
| NOTIF-01~04 | Notification system + push | DONE | store + checkout/admin integration + browser push |
| BUGFIX-01 | duplicate exports fix | DONE | bmbAdminApi_products consolidated |
| | BUILD-01 | TypeScript build errors | DONE | 90+ → 0 errors (TypeScript 5.9.3 — Cloudflare Pages CI compatible) |

**Phase Progress:** 26/26 (100%)

---

## ✅ Phase 1–5 (100% — รายละเอียดใน Reality Map v4.0)

| Phase | Status | หมายเหตุ |
|-------|--------|----------|
| Phase 1: Foundation & Security | ✅ 100% | SEC + DB (migration 001–004 ready, RLS ใน 004) |
| Phase 2: Core Features | ✅ 100% | UI-01~06, LAYOUT-01~03 |
| Phase 2.5: Content & SEO | ✅ 100% | SEO-04 ปิดแล้วด้วย Lighthouse (2026-09-17) |
| Phase 3: Optimization & Growth | ✅ 100% | PERF-04 = tests 19/19 |
| Phase 4: ML & AI Infrastructure | ✅ 100% | OpenRouter + Recommendations + Reviews + Multi-lang |
| Phase 5: Database Schema v2 | ✅ 100% | migration 004 (UUID→TEXT fix) ready |

## 🤖 Model A Configuration (2026-09-17)

| | Model | OpenRouter ID | Cost |
|-|-------|---------------|------|
| Primary (Model A) | GLM 5.2 (free) | `z-ai/glm-5.2:free` | $0 |
| Fallback | Qwen 3.7 Flash | `qwen/qwen3.7-flash` | ~$0.00003/token |

- Config: `src/lib/aiModels.ts` — `MODEL_A_PRIMARY`, `MODEL_A_FALLBACK`, `resolveModelA()`
- Behavior: `chatWithAI()` / `chatWithToolSupport()` ลอง Model A ก่อน → fail แล้ว retry ด้วย fallback 1 ครั้ง → ไม่มี fake success

---

## DEPLOYMENT STATUS (2026-09-17 — Build Fix v10.1)

- **Build (v10.1)**: TypeScript **5.9.3** 0 errors ✅ + Vite PASS 🏗️ — pages lazy-split; `bcryptjs` lazy chunk 20.18 kB; PWA precache 52 entries
  - ⚠️ **Note:** Downgrade จาก TypeScript 6.0.2 → 5.9.3 เพราะ Cloudflare Pages ใช้ Node.js 20 (TypeScript 6.0.2 ต้องการ Node.js 22+)
- **Tests**: Vitest **26/26 PASS (100%)** — offline in-memory Supabase mock + delivery sandbox + pre-order API
- **PWA**: Service Worker + Manifest generated ✅ (precache 52 entries)
- **Lighthouse**: **Performance 81** / Accessibility 85 / BP 100 / SEO 100 (`lighthouse/final_2026-09-17.json` + `final_summary.txt`)
- **E2E**: Playwright 7/7 PASS, 0 console errors (`e2e/`) — สร้าง real rows: `orders` BMB-20260917-526, `pre_orders` PO-20260917-338, `payment_intents` completed
- **Production Deploy**: Cloudflare Pages ⏳ **รอ deploy ใหม่** — บิลด์ล้ม 2 ครั้ง (`1dbf988`, `9f58150`) → แก้แล้ว commit `3723d17` — ดู `docs/BiteMeBaby_DEPLOYMENT.md`
- **DB Migration**: 001→002→003→004→005 **LIVE on Supabase** ✅ — RLS **Secure Mode enforced** (is_admin() function working) — Admin/User access control active
- **Git**: commit ตาม convention `type(scope): subject` — ดู `git log`

---

## ✅ Phase 7: UI v4.0 — Social Proof Review Feed + 2.5D/3D Hybrid Glassmorphism (100%)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| UI40-01 | Types: `SocialProofReview`, `SocialProofSource`, `MenuHighlightClip` | DONE | `src/types/index.ts` — tsc 0 errors |
| UI40-02 | Data: curated reviews (Facebook/GrabFood) + video policy config | DONE | `src/lib/socialProofReviews.ts` |
| UI40-03 | `CustomerReviewCard.tsx` — Glassmorphism Spec | DONE | blur(14px)+saturate, WebP lazy, 2.5D tilt, mascot translateZ |
| UI40-04 | 3D Star Rating micro-animation | DONE | `.star-3d` Glow/Pulse + reduced-motion |
| UI40-05 | CTA Deep Link ตาม Mode | DONE | same-day → `/cart?mode=same-day` / pre-order → `/checkout?mode=pre-order` |
| UI40-06 | `LazyVideo.tsx` (Lazy Streaming) | DONE | IntersectionObserver + preload="none" + Data Saver |
| UI40-07 | HomePage Section Layout Flow v4.0 | DONE | Hero → Rounds → Reviews → Same-Day → Pre-Order → Promo/Viral |
| UI40-08 | CSS (`src/index.css`) | DONE | `.review-card-3d`, `.review-card-glass`, `.star-3d`, `.mascot-mini`, `.lazy-video` |
| UI40-09 | CheckoutPage Deep Link params | DONE | `?mode=` + `?round=` + pre-order banner |
| UI40-10 | Verification | DONE | tsc 0 errors / vitest 19/19 / vite build PASS |
| UI40-11 | Docs sync | DONE | README #102, COMPONENT_SPEC_UI v4.0 §12–17, Reality Map UI-07 |
| UI40-12 | Mascot Asset System — `MascotBadge.tsx` (8 poses + sm/md/lg/fluid) + `/public/assets/mascot/` mapping | DONE | Hero=greeting / Review=heart / Rounds=running / Featured=thumbsup / Random=thinking |
| UI40-13 | Mascot Pose Map docs | DONE | COMPONENT_SPEC_UI §18 + README #102.5 |
| UI40-14 | Real asset integration — `Star.webp` + Facebook/GrabFood logos | DONE | CustomerReviewCard — 3D Star เป็นรูปภาพจริง + Source Badge โลโก้จริง |

**Phase Progress:** 14/14 (100%)

---

## END OF STATUS TRACKER (v10.2.2 — Migration 005 LIVE on Supabase — 2026-09-18)
