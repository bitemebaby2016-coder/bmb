# Pending Tasks for Next Session (Owner Approved 2026-11-09 18:09)

Record of tasks to be completed in the next session. These should be merged into AI_WORK_STATE.md.

---

## 🚀 Deploy & Migration (Must Complete Before Live Test)

- [x] **Apply Migration 201** on Production DB — ✅ APPLIED 2026-11-09T18:15Z (`e2e/prodApplyMigrations.cjs --files 201`) · history version='201' recorded
- [x] **Deploy Edge Functions** (social-ai-worker) — ✅ DEPLOYED exit=0 (`node e2e/_ttDeployFns.cjs` log `TT_DEPLOY_DONE 2026-11-09T18:15:38.863Z`)

---

## 🧪 Live Retest Sequence (from BMB_REMAIN_TESTS_LIVE_2026-11-09.md)

1. **D2** — SAME_DAY prompt incorrect "รอบเดียว 11:00-15:00" → RT-5.1/5.4
2. **D4** — In-app browser native click + guide (intent://)
3. **D5** — Post missing day/round details → RT-3.6
4. **§T-A** — Cart retry 2.5s (Layout.tsx)
5. **R91** — Hard reload confirm card scale equal + logo/stars
6. **R90** — Task 1: Review button under CTA (CSS clip fix glass top:30%) · Task 2: Expired promos (passed "หายแล้ว")

---

## 🏃 Test Suites Not Yet Run

- [ ] RT-4 · RT-HOURS · RT-6.2 · RT-6.1 (E1 waived) · RT-6.4B2 · CAP-14 + CAP 7·8·13·16·17·19
- [ ] **RT-8 = STILL BLOCKED** (criteria not met)

---

## 🐛 Pre-existing Test Failures (Fix in Separate PRs)

These are NOT caused by recent changes:

| Test File | Issue |
|-----------|-------|
| `roleSystem.test.ts` | navGroupsForRole expects old routes (`/admin/marketing`, `/admin/promotions`, `/admin/media`) vs new (`/admin/marketing-promotions`, `/admin/media-portfolio`) |
| `r86TestHygieneRules.test.ts` | Expects `testId="cod-enabled-toggle"` but code has `testId="cod-switch-toggle"` |
| `socialAiContinuity.test.ts` | Expects pattern `/social-links-config/` and `.filter((key) => !TYPED_FORM_KEYS.has(key))` but code refactored |

---

## 📝 Note for Next Session

Update `AI_WORK_STATE.md` with the above checklist at the top (after SESSION CLOSE banner). The three test failures are pre-existing and should be fixed in a dedicated PR/phase separate from live testing work.