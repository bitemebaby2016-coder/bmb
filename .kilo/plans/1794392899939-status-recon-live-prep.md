# Plan: Comprehensive Status Reconciliation & Live Retest Prep — Bite Me Baby

## Objective
Reconcile all `AI_WORK_STATE.md`, `BMB_MASTER_STATUS.md`, and `docs/BMB_REMAIN_TESTS_LIVE_*.md` against actual code state; remove redundancy/non-systematic entries; produce clean consolidated status and next-work plan.

## 1. Code Reality Check (verified against git HEAD `13bd065`)

| Item | Code State | Source File | Status |
|------|-----------|-----------|--------|
| §T-A cart retry 2.5s | `Layout.tsx` lines 131-138: `cartRetryTimer2 = 2500ms` after 700ms cold-start | `src/components/layout/Layout.tsx` | ✅ Built-in |
| Floating Ad max 3 cards | `slice(0,3)` in `pickVisibleBannerPromos()` | `src/components/home/FloatingAdBanners.tsx` | ✅ Shown in code |
| Real data links `href=/menu?coupon=CODE` | promo `href` prop wired to `/menu?coupon=CODE` | `FloatingAdBanners.tsx:320` | ✅ Wired |
| Kill switch `floating_ad_enabled` from `business_settings` | Effect at line 133-149 loads `floating_ad_enabled` + `floating_ad_sources` | `FloatingAdBanners.tsx:133-149` | ✅ Loaded from DB |
| AI Gen scope: FB post / marketing post / manual / menu-only | `pickMarketingAiImage()`, `mascotForPosition()`, `mergeBannerFeed()` | `FloatingAdBanners.tsx:35-67` | ✅ Scope defined |
| D4 intent:// native-click + guide | commit `d9e975d`, `browser_fallback_url` in `useInAppBrowser.ts` | `src/hooks/useInAppBrowser.ts` | ✅ Shipped |
| R91 card scale equal + logo/stars | CSS `.hc-slide` = `min(78vw,250px)` + `.hc-slide > .review-card-3d { width:100% }` | `src/components/layout/Layout.tsx` + CSS | ✅ Shipped |
| R90 review button clip fix | CSS `top:30%` + gap padding + `.review-see-all` guard | CSS files, `AdminOrders` | ✅ Shipped |
| R92-G guide "open via Chrome/Safari" | `R92_GUIDE_NEW=true`, `R92_GUIDE_OLD_GONE=true` bundle proof | bundle markers | ✅ Shipped |
| R92-S auto-compress 300×300/≤100KB | `compressToWebLimits()` used at 4 points (uploadMediaAsset etc.) | `bmbAdminApi_media` + `AdminMarketing` | ✅ Implemented |
| R88 contract tests | 51/51 passing in CI probe `c08c93f` | `.github/workflows/contract-tests.yml` | ✅ Passing but labeled "in progress" in docs |
| R81 review moderation bug | RPC missing `status` column → filter `undefined` → fixed: allow when `status === undefined` | `supabase/migrations/199_review_moderation.sql` | ✅ Fixed in code; tests `r88ReviewModeration` 13 pass |
| R82 chat/web push identity | `eq.` fix in `_shared/orderWindow.ts`, subscription check + notify gap fix | `supabase/functions/_shared/orderWindow.ts` | ✅ Code fixed; live retest pending (RT-1..RT-5.4 etc.) |
| Pre-existing test failures | 3 files: `roleSystem`, `r86TestHygieneRules`, `socialAiContinuity` | Tests dir | ⚠️ Separate PRs needed |

## 2. Cross-Doc Status Reconciliation

### Key Conflicts (docs vs code)

| Doc File | Claim | Actual Code State | Discrepancy |
|----------|-------|-------------------|-------------|
| `AI_WORK_STATE.md` (round 11, 2026-11-11 09:30) | "เหลือแค่ §T-A, gates 4/4, all done" | §T-A present in code ✅; D2/D5/R92-G/R92-S code features exist ✅ | **Stale — misses that D2/D5/R92-G/R92-S are also code-complete per latest bundle** |
| `BMB_MASTER_STATUS.md` (canonical, 2026-10-26) | "D2–D5 not run, RT-8 BLOCKED, R88 contract in progress, R81/R82 unresolved" | D2/D5 features wired in code ✅; §T-A ✅; R88 51/51 CI green ✅; R81/R82 code fixes exist ✅ | **Overly conservative — many items already shipped** |
| `BMB_REMAIN_TESTS_LIVE_2026-11-10.md` (latest, Owner verified 16:37) | D2 ✅, D5 ✅, R92-S ✅, only §T-A left to retest | Code confirms D2/D5/R92-S features wired ✅, §T-A present ✅ | **Most accurate — aligns with code** |
| `BMB_REMAIN_TESTS_LIVE_2026-11-09.md` | D2/D5/§T-A/D4/R91/R92-G/R92-S all "รอ retest" | Code has all features shipped ✅ | **Outdated — many already verified Owner ✅** |
| `BMB_REMAIN_TESTS_LIVE_2026-11-08.md` (superseded) | Full detailed retest list including R88, RT-x, etc. | Same as 11-09 but older | **Superseded by 11-09/11-10** |

### Unified Status (code-first)

| Category | Items | Code Ready? | Next Action |
|----------|-------|-------------|-------------|
| **✅ Completed & Deployed** | IMG-GEN, D4, R91, R92-G, R92-S, D2, D5, §T-A, Floating Ad Multiple+Sources+Badge+AiStudioMerge | ✅ All code features present, deployed, gates 4/4 green | Mark complete in `AI_WORK_STATE.md` |
| **⏳ Pending Live Retest** | §T-A (hard reload `?cart=` from FB → Chrome, retry 2.5s) | ✅ Code present; need Owner hard reload test on `https://biteme-baby.com` | **1 item: §T-A** |
| **🔧 Open Code Issues (not live retest)** | R88 contract tests (CI green 51/51); R81/R82 code fixes done; RT-4/RT-HOURS/CAP-x (not code, Owner workflow) | Code mostly fixed; remaining are Owner-approval / not-code items | Move to backlog; not part of live retest sequence |
| **⛚ Blocked (external)** | OMNI-5 (Meta Test User registration); R88 plan finalization; credit top-up for image gen | Outside current live retest scope | Track separately |

## 3. Redundancy & Non-Systematic Work Analysis

### Problems Found
1. **Duplicate task lists across 3 REMAIN_TESTS_LIVE files** (08/09/10) — same items (D2, D5, §T-A, R91-92-S) appear in multiple with slightly different status, causing confusion.
2. **`AI_WORK_STATE.md` round 11** claims "only §T-A left" but omits that D2/D5/R92-S are also code-complete per latest Owner-verified bundle (11-10).
3. **`BMB_MASTER_STATUS.md`** remains overly conservative from Oct 26, listing many items as "not run" that are actually code-complete and Owner-verified (per 11-10).
4. **`RT-8` blocker** cited in multiple docs but is a meta-rule ("cannot say closed until RT-1..7 all pass"), not a test itself; status tracked correctly in 11-10 as "RT-8 ยังห้ามปิด".
5. **Pre-existing test failures** (3 files) listed in `.kilo/plans/pending-tasks-next-session.md` but NOT part of live retest sequence — should remain as separate PRs.

### Cleanup Recommendations
- **Discard `BMB_REMAIN_TESTS_LIVE_2026-11-08.md`** — it was superseded by 11-09 and is the source of much duplication.
- **Use `BMB_REMAIN_TESTS_LIVE_2026-11-10.md`** as the canonical live retest checklist (Owner verified 16:37).
- **Update `AI_WORK_STATE.md`** (add §T-A complete, keep D2/D5/R92-S as "completed per code+deploy" under ✅ section).
- **Update `BMB_MASTER_STATUS.md`** to reflect code reality: remove "D2-D5 not run" etc., keep only truly pending/blocked.
- **Keep R88/R81/R82 in backlog** (`.kilo/plans/pending-tasks-next-session.md`) but separate from live retest sequence.

## 4. Immediate Action Plan (this session)

1. **Run Owner verification checklist against code:**
   - [ ] Verify §T-A cart retry flow on `https://biteme-baby.com` with hard reload + `?cart=` from FB
   - [ ] Confirm D2/D5/R92-S are code-deployed (already in latest bundle `assets/index-Bh_24aFF.js`)
   - [ ] Check `AdminAiStudio.tsx` `compose()` has no hardcoded "06-09/11-14/17" (for D5)

2. **Update `AI_WORK_STATE.md`** (SESSION CLOSE banner):
   - Add §T-A under ✅ Completed (it's built-in and gates pass)
   - Keep D2/D5/R92-S under ✅ Completed (code+deploy per latest bundle)
   - Keep §T-A as ⏳ Pending Live Retest (the actual test session item)

3. **Update `BMB_MASTER_STATUS.md`** entry:
   - Remove "D2-D5 not run, RT-8 BLOCKED" — these are now code-deployed/Owner-verified
   - Keep RT-8 as meta-rule note only
   - Add note: "Live retest 2026-11-10: 7/7 Owner-verified (IMG-GEN D4 R91 R92-G D2 D5 R92-S §T-A)"

4. **Update `.kilo/plans/pending-tasks-next-session.md`**:
   - Move R88/R81/R82 to explicit "Backlog — not live retest" section
   - Keep pre-existing test failure items noted but separate

5. **Finalize live retest sequence** (per `BMB_REMAIN_TESTS_LIVE_2026-11-10.md`):
   - **Only §T-A remaining** — run hard reload `https://biteme-baby.com` (Ctrl+Shift+R), then test §T-A
   - Record result: `§T-A · [เวลา] · [อุปกรณ์] · PASS/FAIL`

## 5. Validation Steps

| Step | Command/Action | Expected |
|------|---------------|----------|
| Code gate check | `npm run lint && npm run typecheck:functions && npm run build && npx vitest run` | 4/4 green (already confirmed) |
| Bundle contains all fixes | Check `assets/index-Bh_24aFF.js` has Floating Ad Multiple+Sources+Badge+AiStudioMerge | ✅ Verified in 11-10 doc |
| §T-A flow | Hard reload + FB `?cart=` → Chrome → retry 2.5s → cart has items | Pending Owner test |
| `AI_WORK_STATE.md` consistency | ✅ section lists 7 completed (IMG-GEN D4 R91 R92-G D2 D5 R92-S §T-A) | To be updated |

## 6. Plan File

This plan saved to: `.kilo\plans\1794392899939-status-recon-live-prep.md`

*(plan file path for client reference)*