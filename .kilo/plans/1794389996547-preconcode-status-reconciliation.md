# Plan: Status Reconciliation & Next Work — Bite Me Baby

## Context
- Project: **Bite Me Baby** (cloud kitchen ordering, Bangkok) — AI waiter, food theater, admin dashboard, omise payment.
- Source of truth: `AI_WORK_STATE.md` (session close 2026-11-11) + `BMB_MASTER_STATUS.md` (owner directive 2026-10-26, canonical single-file). **Do NOT trust docs alone** — cross-check every claim against real code/git.
- Branch: `main`, up to date with `origin/main`. Working tree clean. Most recent pushes: `13bd065`, `aa464f3`, `05ab1f0`, `7acef64`, `c78aa9c`, `4dc1a16`, ...
- Gates reported green: tsc=0, lint OK, vitest ALL PASSED, build OK (CI #394).

## Verified from actual code (not docs)

| Area | Code state | Matches doc? |
|---|---|---|
| Floating Ad max 3 cards + real data links (`href=/menu?coupon=CODE`) | `FloatingAdBanners.tsx` slice(0,3); `c78aa9c` push/deploy; gates 4/4 | ✅ |
| AI Gen image scope (no auto floating ad; FB/post/manual only) | `pickMarketingAiImage`, `mascotForPosition`, `mascotCornerForPosition`, `mergeBannerFeed` | ✅ |
| Kill switch `floating_ad_enabled` from `business_settings` | `FloatingAdBanners.tsx` effect loads kill switch + sources filter | ✅ |
| §T-A cart retry 2.5s (700ms cold-start → 2500ms retry) | `Layout.tsx` lines 131-138: `cartRetryTimer2 = 2500ms` | ✅ |
| D4 intent:// native-click + guide ("Open in Browser") | commit `d9e975d`, `browser_fallback_url` fix | ✅ |
| R91 hard reload card scale equal + logo/stars | CSS fix `.hc-slide` flex 250px mobile-first; verified `_r91_probe.cjs` | ✅ |
| R90 review button under CTA clip glass top:30%; expired promos gone | CSS fix `top:30%` + gap padding; `/promotions` filters `isPromoLiveNow` | ✅ |
| R92-G guide "open via Chrome or Safari" bundle proof | `R92_GUIDE_NEW=true`, `R92_GUIDE_OLD_GONE=true` | ✅ |
| R92-S compress >300px / ≤100KB auto (uploadMediaAsset etc.) | `compressToWebLimits()` (300px/100KB) | ✅ |

## Discrepancy found (docs vs code)
- `AI_WORK_STATE.md` (round 11, 2026-11-11) claims **only §T-A left, all else done, gates 4/4**.
- `BMB_MASTER_STATUS.md` (owner directive 2026-10-26, canonical) lists **D2–D5 not run, RT-8 still BLOCKED, R88 contract tests in progress, R81/R82/R74-OMNI unresolved**.
→ **Code shows §T-A present and built-in; docs are stale.** Both must be aligned.

## Remaining live retest (backlog)
1. **D2** — SAME_DAY prompt wrong ("around 11:00-15:00" → should be "anytime during open hours"). Root cause in `orderWindow.ts`/prompt rules (no round ref, SAME_DAY = store open always).
2. **D4** — In-app browser native click + guide (intent://). Already shipped; verify FB WebView handles.
3. **D5** — Post missing day/round details. Check `AdminAiStudio.tsx` `compose()`.
4. **§T-A** — Cart retry 2.5s (present in code, verify hydration).
5. **R91** — Hard reload confirm card scale equal + logo/stars (fixed).
6. **R92-G** — Guide "open via Chrome/Safari" bundle proof (fixed).
7. **R92-S** — Compress 300×300/100KB auto (code/test/deploy; test updated).

## Open / Unresolved
- **R88** — Contract tests still in progress (probe `c08c93f`, 51/51 passing, CI gate). Blocked?
- **R81** — Review moderation bug (RPC missing `status` column → filter `undefined`).
- **R82** — Chat/web push identity link failure (PSID/LINE subscription mismatch).
- **R73h/R73g** — Birthday scan consent (`m193`), UI day/time grid rows.
- Pre-existing test failures (`roleSystem`, `r86TestHygieneRules`, `socialAiContinuity`) — separate PRs.

## Immediate actions (this session)
1. **Reconcile docs**: Mark §T-A complete in `AI_WORK_STATE.md`; move D2/D5/R82/R81/R88 to backlog; correct `BMB_MASTER_STATUS.md` to reflect code reality.
2. **Inspect `src/pages/admin/AdminAiStudio.tsx`** `compose()` for D5 (remove hardcoded "06-09/11-14/17").
3. **Run full gate suite**: `npm run lint && npm run typecheck:functions && npm run build && npx vitest run` → expect 4/4 green.
4. **Address R88** (contract tests isolated PG replay) if CI still red.
5. **Push final changes** to `main`, trigger production deploy.

## Next session handoff
- Update `AI_WORK_STATE.md` (add §T-A complete, clear D2/D5/R92-G/R92-S as in-progress).
- Create plan file `1794389996547-preconcode-status-reconciliation.md` (saved below).
