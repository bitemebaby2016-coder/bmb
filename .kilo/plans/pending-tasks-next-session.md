# Pending Tasks for Next Session (Owner Approved 2026-11-09 18:09, Updated 2026-11-11)

Record of tasks to be completed in the next session. These should be merged into AI_WORK_STATE.md.

---

## ✅ Completed This Session (2026-11-10)

- [x] **Floating Ad + Promotion Banner Settings** — `floating_ad_enabled` Kill Switch (AdminSettings) + max cards 2→3 + real links (href=/menu?coupon=CODE) + image upload/browse (Supabase album + external URL) + CNT-01 approve/reject wired + onBannerChange reloads — **CODE_CLOSED + PUSHED + DEPLOYED** (`260351c`)

---

## 🚀 Deploy & Migration (Must Complete Before Live Test)

- [x] **Apply Migration 201** on Production DB — ✅ APPLIED 2026-11-09T18:15Z (`e2e/prodApplyMigrations.cjs --files 201`) · history version='201' recorded
- [x] **Deploy Edge Functions** (social-ai-worker) — ✅ DEPLOYED exit=0 (`node e2e/_ttDeployFns.cjs` log `TT_DEPLOY_DONE 2026-11-09T18:15:38.863Z`)

---

## 🧪 Live Retest Sequence (from BMB_REMAIN_TESTS_LIVE_2026-11-10.md — Owner verified 2026-11-10 16:37)

**Owner verified PASS (7/7):** IMG-GEN, D4, R91, R92-G, D2, D5, R92-S — **all code-deployed, gates 4/4 green**

**Remaining Live Retest (1 item):**
- [ ] **§T-A** — Cart retry 2.5s (Layout.tsx:131-138) · hard reload `https://biteme-baby.com` · test `?cart=` from FB → Chrome jump → cart has items within 2.5s

---

## 🏃 Test Suites Not Yet Run (Owner workflow — not code tasks)

- [ ] RT-4 · RT-HOURS · RT-6.2 · RT-6.1 (E1 waived) · RT-6.4B2 · CAP-14 + CAP 7·8·13·16·17·19
- [ ] **RT-8 = STILL BLOCKED** (meta-rule: cannot close until RT-1..7 all pass)

---

## 🐛 Pre-existing Test Failures (Fix in Separate PRs)

These are NOT caused by recent changes:

| Test File | Issue |
|-----------|-------|
| `roleSystem.test.ts` | navGroupsForRole expects old routes (`/admin/marketing`, `/admin/promotions`, `/admin/media`) vs new (`/admin/marketing-promotions`, `/admin/media-portfolio`) |
| `r86TestHygieneRules.test.ts` | Expects `testId="cod-enabled-toggle"` but code has `testId="cod-switch-toggle"` |
| `socialAiContinuity.test.ts` | Expects pattern `/social-links-config/` and `.filter((key) => !TYPED_FORM_KEYS.has(key))` but code refactored |

---

## 📦 Backlog — Not Live Retest (Code mostly fixed; awaiting Owner verification / separate phase)

| Item | Status | Notes |
|------|--------|-------|
| **R88** Contract Tests | CI green 51/51 passing (`c08c93f`), `m199` applied PROD | Code complete; not part of live retest sequence |
| **R81** Review Moderation | RPC missing `status` column → filter `undefined` fixed | Code complete; Owner retest pending (web push, Smart Escape) |
| **R82** Chat/Web Push Identity | `eq.` fix, subscription check, `orderWindow.ts` mirror | Code complete; Owner retest pending (A2', B8', B9') |
| **R73h/R73g** Birthday/Consent UI | `m193` consent, day/time grid | Code complete; Owner test pending |

---

## 📝 Note for Next Session

Update `AI_WORK_STATE.md` with the above checklist at the top (after SESSION CLOSE banner). The three test failures are pre-existing and should be fixed in a dedicated PR/phase separate from live testing work.

**Key reconciliation done 2026-11-11:**
- `AI_WORK_STATE.md` round 11 updated: D2/D5/R92-G/R92-S marked ✅ code-deployed, §T-A only pending live retest
- `BMB_MASTER_STATUS.md` top entry updated: LIVE-TEST 2026-11-10 reflects 7/7 Owner-verified, §T-A only remaining
- `pending-tasks-next-session.md` restructured: Live retest = §T-A only; R88/R81/R82 moved to backlog