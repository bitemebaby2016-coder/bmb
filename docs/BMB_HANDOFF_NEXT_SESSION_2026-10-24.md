# BMB — SESSION HANDOFF (2026-10-24, close of session)

> Authoritative handoff for the next session. Resume from THIS file + the committed
> repository state, not from conversation memory. Owner directive date: 2026-10-24.

## 1. Session objective & actual completion status

- Objective: recover current CI failure, clarify delivery-schedule model, reconcile order
  ***841 / notification defects, audit admin navigation + role/AI model, then close with a
  complete handoff.
- Completion status: **INCOMPLETE (session closed by Owner instruction).**
  Owner decision during the session: **"ไม่อนุมัติโค้ด" (no feature code this session) —
  handoff + remaining work go to the NEXT chat.** Therefore only this documentation was
  produced this session. All code/fix work is queued as next-session tasks (section 11).

## 2. Repository / branch / SHAs

- Root: `D:\A PROJECT\Bite Me Baby`
- Branch: `main`
- HEAD: `ada7bb5` (`ada7bb54f0ab5d9208e03cdaa0c6b043a3ce7c34`)
- origin/main: `ada7bb5` (match)
- Latest commit: `feat(R5d): pre-order cutoff = order_policy.cutoff_hours before delivery (2h) ...`
  (2026-10-24 11:51 +0700)
- Staged diff: none
- Unstaged tracked diff: none
- Untracked files: none (temp probe `e2e/tmpPlanProbe.cjs` was NOT created and does not exist)
- Stash: `stash@{0}: On main: local-edits-before-sync-2026-09-21` — PRESERVED, untouched

## 3. BUILD FAILURE ROOT CAUSE (the red checks)

Both workflows last PASSED at `5fdb81e` (run CI 532 / Contract 106, 2026-10-24 00:18) and
went RED starting with the R5c commits (`eec55c7`/`ffd29ae`). Two independent causes:

| Workflow (run id) | Fail step | Root cause | Fix (queued, NOT applied) |
|---|---|---|---|
| Contract Tests `40064017931` (job 120783340681) | Contract 123 P8 | `e2e/contracts_123_menu_publish.sql:122` expects `ERR_PRODUCT_UNAVAILABLE`, but migration 142's `ERR_PRE_ORDER_REQUIRES_MENU` gate fires first (pre-order cart with no calendar-menu row) | add a `menu_schedule` row for `prod-5` on date `d` in the P8 fixture so the menu gate passes and the ORIGINAL product-availability assertion is restored (strict, not weakened) |
| CI `40064017932` (job 120783340693) | Unit tests | `src/pages/CheckoutPage.tsx:334` `branch.branch_id` — `resolvePublicBranch` returns null in test env → TypeError (unhandled) → vitest exits 1 | change to `branch?.branch_id ?? null` |

Also discovered: workflow `.github/workflows/contract-tests.yml` only runs contracts through
**141** — `contracts_142/143/144` are NOT wired into CI (queued as next-session task).

## 4. MIGRATION 124 — CORRECTION (my earlier statement was WRONG)

Verified read-only against production DB:
- `supabase_migrations.schema_migrations` contains 118..144 inclusive — **124 IS applied**
- function `create_order_with_items_i` exists (count = 1)
- table `order_submissions` exists

So the user is correct: 124 (and every migration) is already applied in production.
The note inside `supabase/migrations/124_order_submit_idempotency.sql` claiming "isolated/CI
only — do not apply to production until Owner approves" is now **stale** and must be
reconciled next session (either the file header is updated, or the W5C R1-R15 risks get an
explicit Owner sign-off recorded). Do NOT re-apply or rewrite migration history.

In CI, step "Apply migration 124" shows `skipped` ONLY because the earlier Contract-123
step failed and skipped all later steps — it is NOT evidence that 124 is missing.

## 5. Delivery schedule model — findings & decision

Traced UI + state + API + tables. Current REAL semantics (labels are misleading):

| UI label | Actual meaning |
|---|---|
| "แพทเทิร์น 3 รอบ/วัน" (round pattern) | ONE shared daily fulfillment template (morning/midday/evening) used by BOTH pre-order and same-day — single capacity bucket per round |
| "รอบรายวัน" (daily rounds) | The real per-date rows generated from that pattern (`round-YYYYMMDD-<key>`) |
| Looks like "duplicate" | It is NOT two systems — it is template vs instance, but the UI does not say so |
| Pre-order cutoff | `delivery_start - order_policy.cutoff_hours` (2h) |
| Same-day cutoff | round `cutoff_time` |
| "เมนูและตาราง" (menu & schedule) | Pre-order = admin's special-round calendar menu (`menu_schedule`) |

**Owner decision recorded:** separate the controls as **"ปรับของพรีออเดอร์" / "ปรับของเซมเดย์"**.
Approach approved in principle: ONE shared round + capacity, but TWO cutoff columns
(same-day cutoff / pre-order cutoff) so each order type is tunable independently. Do NOT
create a new schedule table. This is a scoped, non-breaking design — confirm exact column
naming + migration plan with Owner before implementing (see task 4, section 11).

Open sub-decision for Owner (ask before coding): whether "2 pre-order menu items per day
across a weekly schedule" (directive §3-A) is the intended rule to enforce, since current
implementation allows publishing whatever the admin selects.

## 6. Order ***841 / notification reconciliation

Verified read-only on production:
- `orders`: `BMB-20261023-841` → `status = 'delivered'` (authoritative state is CORRECT)
- `notifications` for 841: 6 rows (`confirmed / pending / dispatched / delivered /
  ready_for_dispatch / preparing`) — **all `is_read = true`**

So the DB is fine. The defects are client-side (this is why I must NOT claim the alerts are
cleared — that needs runtime verification next session):

1. Badge stays red: `src/store/notificationStore.ts` `hydrateServerNotifications()`
   skips rows whose id already exists → a stale local row never updates its `is_read` on
   reload, so the badge reverts to red after refresh.
2. "Mark all read" is not durable: `markAllAsRead()` only mutates local state — it never
   writes to the server, so a reload brings the unread badge back.
3. Stale "preparing" message shown as latest: the rows are timestamped out of order
   (`preparing` 11:29:07 is AFTER `delivered` 11:29:05), so sorting by `created_at` shows the
   stale message instead of the real delivered state.
4. Old messages not openable + popup does not auto-close after read → part of the same bell
   component defect (the 3 red alerts in the screenshot are these stuck rows).

Fix plan (next session, no production mutation): make server state authoritative in the
hydrate merge, make `markAllAsRead` persist server-side, sort/order by real order-state
sequence (not raw timestamp), auto-dismiss popup on confirmed read, keep history reachable,
then verify at runtime that the badge clears and stays cleared. Add regression tests for
delivered-order reconciliation, history access, mark-read, popup dismissal, unread-count,
and notification idempotency. Any DB correction must be targeted + audited, never a blanket
clear.

## 7. Admin menu / navigation / action feedback (directive §5)

Status: **AUDIT ONLY — not fixed (no code this session).** Queued as next-session task 3.

Must cover: every visible menu item links to a real page; no broken/duplicate/misleading
links; mark unimplemented features instead of empty placeholders; menu visibility follows
permission; clicking an action scrolls/navigates to the actual task (scroll-to-top on route
change, scroll-to-section for in-page targets, no movement when already at top); clear
loading/success/error/disabled states; test desktop + mobile + async render.

## 8. Role / permission / AI audit (directive §6) — inventory + gap register

**Current implementation inventory (read-only scan):**
- Role model is **`profiles.role`** with only **`admin` | `staff` | `customer`**
  (`src/lib/bmbAdminApi_users.ts:18`) — values are attached by `on_auth_user_created`
  trigger (migration 006).
- RLS authority is DB-side: `is_admin()`, `is_staff()`, `is_tenant_admin()`,
  `is_tenant_admin_of()` (policies across `business_settings`, `orders`,
  `order_status_history`, `promotions`, `media`, etc.).
- Client nav gating: `shouldShowAdminLink(role)` in `src/lib/adminUi.ts:109` —
  shows admin link for `admin`/`staff`; RLS is the real gate.
- Route guard: `AdminRoute` wrapper around `/admin/*` routes (App.tsx).
- Role inventory per page/API: 30+ `bmbAdminApi_*.ts` modules + 30 `src/pages/admin/*`
  pages + `RiderPwaPage.tsx` — full matrix still to be drawn (task 5).

**Gap register (12-category framework vs current 3 roles):**

| Category | Status today |
|---|---|
| 1 OWNER | MISSING (no distinct owner role; owner = admin) |
| 2 ADMIN / GM | IMPLEMENTED (`admin`) |
| 3 KITCHEN STAFF | PARTIAL (`staff` via AdminKitchen + POS) |
| 4 INVENTORY / PURCHASING | PARTIAL (InventoryPage + bmbAdminApi_inventory; no role) |
| 5 FINANCE / ACCOUNTING | MISSING (reports exist; no role/authority split) |
| 6 RIDER / DELIVERY | PARTIAL (RiderPwaPage; no dedicated role) |
| 7 CUSTOMER | IMPLEMENTED (`customer` + RLS) |
| 8 CUSTOMER SUPPORT | MISSING |
| 9 MARKETING / CONTENT | PARTIAL (AdminMarketing + content-approvals; no role) |
| 10 AUDITOR / READ-ONLY | MISSING (AuditLogPage exists; no read-only role) |
| 11 DEVELOPER / TECHNICAL | MISSING |
| 12 SYSTEM / AUTOMATION | MISSING (automation-scheduler runs under owner account) |

**Rule (directive §6):** do NOT build a second role system and do NOT create migrations
until the full role×permission / page×permission / RLS matrix + staged proposal is written
and Owner approves the exact plan. All auth schema / RLS / privilege work stays a
**documented proposal** until then.

**AI / automation inventory (reuse, don't duplicate):**
- Existing: `src/lib/ai/` (`aiService`, `aiModels`, `aiToolCalling`, `aiGuardrails`,
  `aiGuardrailsAdv`, `aiMemory`, `aiServerMemory`, `aiDbContext`, `aiVoice`, `aiRouting`),
  `AdminAiStudio.tsx`, `TalkToBite`, `theaterDailyCopy.ts`.
- Target (directive §6 lean model): ONE capability set exposed by permission-scoped
  interfaces (Owner Command Center / task+approval inbox / kitchen / inventory / finance /
  support / marketing / tech-monitoring) — reuse existing notification + workflow infra;
  no duplicate assistants.
- AI must NOT authorize prices, payments, stock, fees, refunds, capacity, or order-state
  transitions. Automation needs distinct least-privilege service identities (today the
  scheduler runs under the owner account — flag as gap).

## 9. Features reused vs duplicates avoided

- Reused existing notification + workflow infra for the "one task/approval inbox" concept.
- No new schedule table — consolidating the existing pattern/instance instead.
- No new role system — auditing `profiles.role` + RLS first.
- No duplicate AI assistant — extending the existing `ai*` modules.
- Round-pattern UI: reuse `AdminRounds.tsx` + `order_pattern` (already deployed) rather than
  a new dashboard.

## 10. Test / CI results

- Local vitest (last full run, commit `ada7bb5` source): **130 files / 1347 tests reported
  passing**, but vitest also emitted an **unhandled-error warning** — which is exactly the
  `CheckoutPage.tsx:334` crash that fails CI. Treat local as NOT fully green; the next
  session must get a clean exit code (no unhandled errors).
- tsc: clean. eslint (`--max-warnings=0`): clean. secret scan: 0.
- Contract tests on production (ROLLBACK, zero persistence): 143 G1-G8 + 144 G1-G5 GREEN
  (`e2e/r5cApply143-*.json`).
- **CI runs (all head_sha `ada7bb5`):** Contract Tests `40064017931` = FAILURE (Contract 123
  P8); CI `40064017932` = FAILURE (unit tests); automation-scheduler `40068197295` = SUCCESS.
  Last green: `5fdb81e` (CI 532 / Contract 106).

## 11. Production status & unverified claims

- Verified (read-only): migration ledger 118..144; `create_order_with_items_i` present;
  `order_submissions` present; `BMB-20261023-841` = delivered; its 6 notifications all read.
- Verified via contract (ROLLBACK): 143 (pre-order cutoff + today-allowed + order_setting
  hardening) G1-G8 GREEN; 144 (round pattern) G1-G5 GREEN.
- **NOT runtime-verified (do NOT claim done):** the entire owner production test list in
  `docs/BMB_R5_PRE_ORDER_SEPARATION_2026-10-23.md` §8; the notification badge actually
  clearing; admin navigation/scroll behaviour; role/AI proposals.

## 12. Open risks / blockers / Owner approvals

- **R1 (blocks CI):** the two red failures in section 3 — first task of next session.
- **R2:** notification badge reconciliation not runtime-verified (DB is clean, client is not).
- **R3:** delivery-schedule two-cutoff consolidation — design approved in principle, exact
  schema + migration needs Owner sign-off before coding.
- **R4:** migration 124 file header says "not for production" but it IS applied — reconcile
  the docs vs W5C R1-R15 sign-off.
- **R5:** Directive §7 reminder stands: do NOT modify production migration history, do NOT
  enable deferred automation (Meta write / business-mutation) without the separate approval
  gate.

**Owner approvals needed before the matching task is coded:**
1. Confirm CI-fix approach is just the 2 scoped fixes (already the plan) — no behaviour change.
2. Approve exact two-cutoff schedule schema (same-day cutoff + pre-order cutoff per round).
3. Confirm the "2 pre-order menu items per day" rule to enforce (§3-A) or drop it.
4. Approve the role/permission matrix + staged plan from task 5 before ANY auth/RLS change.

## 13. Next-session tasks (priority order, with files + acceptance criteria)

1. **Fix CI (P0).** `src/pages/CheckoutPage.tsx:334` → `branch?.branch_id ?? null`;
   `e2e/contracts_123_menu_publish.sql` P8 → add `menu_schedule` row for `prod-5` on `d`
   (keeps the strict `ERR_PRODUCT_UNAVAILABLE` assertion); wire `contracts_142/143/144` into
   `.github/workflows/contract-tests.yml`. Acceptance: CI + Contract Tests both GREEN on push,
   vitest clean exit (no unhandled errors), no weakened assertions.
2. **Notification reconciliation (P1).** `src/store/notificationStore.ts`
   (`hydrateServerNotifications`, `markAllAsRead`), `src/lib/notificationService.ts`, bell/
   popup component. Acceptance: badge clears and stays cleared after reload + across sessions;
   history reachable; popup auto-dismisses on read; delivered order shows delivered (not
   stale "preparing"); regression tests pass; runtime-verified on the 841 case.
3. **Admin menu + navigation feedback (P1).** Audit all `src/pages/admin/*` + Layout nav.
   Acceptance: every visible item links to a real page; unimplemented marked; permission-
   aware; action click scrolls/navigates to the task (scroll-top on route change, scroll-to-
   section in-page); desktop + mobile tested.
4. **Delivery-schedule consolidation (P1).** `AdminRounds.tsx` + `order_pattern` +
   `delivery_rounds` cutoff columns; label clearly "ปรับของพรีออเดอร" / "ปรับของเมเดย".
   Acceptance: pre-order and same-day share one round + capacity without double-counting;
   independent cutoffs; pickup window kept distinct; regression tests for shared-slot booking.
5. **Role / permission / AI audit output (P2, docs only).** Produce role×permission,
   page×permission, RLS data-access matrices + gap register + staged proposal (labels:
   IMPLEMENTED / CONNECTED / DEPLOYED / RUNTIME VERIFIED / DOCUMENTED / MISSING / BLOCKED /
   DEFERRED). Acceptance: maps to real code; NO second role system; auth/RLS changes stay
   proposals until Owner approves.
6. **E2E / production acceptance plan (P2).** Map tests to the real customer journey
   (browse → cart → order → pay → prepare → deliver → notify), find gaps, produce an ordered
   real-production acceptance checklist without unauthorized mutations.
7. **Close-out (P2).** Update `AI_WORK_STATE.md` + this handoff with results, then commit by
   exact paths only (no `git add -A`) and push.

## 14. Next session FIRST action

Run:

    git -C "D:\A PROJECT\Bite Me Baby" log --oneline -5
    git -C "D:\A PROJECT\Bite Me Baby" status --short

Confirm HEAD == `ada7bb5` == origin/main (or note the drift), then start task 1 (fix CI).

---

## FINAL REPORT FORMAT (fill at next close)

- SESSION STATUS: INCOMPLETE (closed by Owner: no code this session) — work continues next session
- BUILD FAILURE ROOT CAUSE: Contract 123 P8 stale fixture (pre-142 behaviour) + CheckoutPage.tsx:334 null `branch_id`
- REPOSITORY ROOT: D:\A PROJECT\Bite Me Baby
- HEAD: ada7bb5
- origin/main: ada7bb5
- STAGED DIFF: none
- UNSTAGED DIFF: none
- UNTRACKED FILES: none
- STASH STATUS: stash@{0} local-edits-before-sync-2026-09-21 (preserved)
- COMPLETED WORK: this handoff + role/AI gap register + schedule-model findings + migration 124 correction
- TEST RESULTS: local vitest 130 files / 1347 tests reported passing BUT unhandled-error warning present (treat as not fully green); tsc + eslint clean; contract 143 G1-G8 + 144 G1-G5 green
- CI RESULTS: Contract Tests 40064017931 FAIL, CI 40064017932 FAIL, automation-scheduler 40068197295 PASS (last green 5fdb81e)
- PRODUCTION RUNTIME STATUS: migrations 118..144 applied; 841 = delivered (DB clean); client notification defects open; owner test list UNTESTED
- ROLE / AI AUDIT STATUS: DOCUMENTED (inventory + gap register) — not implemented
- BLOCKERS: R1 CI red (first task), R2 notification runtime verify, R3 schedule schema sign-off, R4 migration 124 doc reconcile
- OWNER ACTIONS REQUIRED: confirm CI approach; approve two-cutoff schedule schema; confirm/drop the 2-pre-order-items rule; approve role matrix before any auth change
- HANDOFF DOCUMENT: docs/BMB_HANDOFF_NEXT_SESSION_2026-10-24.md
- NEXT SESSION FIRST ACTION: `git -C "D:\A PROJECT\Bite Me Baby" log --oneline -5` + `git status --short`, then task 1 (fix CI)
- FINAL GIT STATUS: clean on ada7bb5, this commit adds the handoff + AI_WORK_STATE update

---

## 15. SESSION RESULTS — รอบ 12 (2026-10-24, ทำครบทั้ง 7 งานตาม §13)

| งาน | สถานะ | หลักฐาน |
|---|---|---|
| 1 ซ่อม CI + wire 142-145 | DONE (โค้ด) — รอผล CI บน GitHub | vitest 133/1375 exit0 · lint0 · build0 · Docker replay ALL_GREEN · contracts 127-145 PASS · **แถม:** contract 141 G1/G4 reconcile (stale จาก 142) |
| 2 แจ้งเตือน 841 | DONE (โค้ด+เทสต์) — **runtime UNVERIFIED** | เทสต์ใหม่ 10 ข้อ · production probe 6 แถวจริง (preparing 11:29:07 ใหม่กว่า delivered 11:29:05) |
| 3 เมนู/nav แอดมิน | DONE | audit ไม่มี dead link/placeholder · scroll-top on route change (jsdom-safe) · เทสต์ 7 ข้อ · playwright routeNav 39/39 |
| 4 รอบจัดส่ง 2-คัทออฟ + กฎ ≥2 | **DONE + APPLIED PRODUCTION** | Owner อนุมัติรอบนี้ · migration 145 (ledger มี 145 แล้ว) · contract 145 G1-G6 เขียว Docker+production · 143/144 regression production PASS · evidence `e2e/r6Apply145-*.json` |
| 5 role/permission/AI audit | DONE (DOCUMENTED — รอ Owner sign-off P1-P3) | `docs/BMB_ROLE_PERMISSION_AI_AUDIT_2026-10-24.md` |
| 6 E2E/acceptance plan | DONE | `docs/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` (checklist 13 ขั้น) |
| 7 close-out | DONE | `AI_WORK_STATE.md` รอบ 12 +  section นี้ + commit เฉพาะ path + push |

**เพิ่มเติมที่ไม่มีในแผนเดิม (เจอระหว่างทาง):**
- fixture `SET cutoff_time` 12 ไฟล์ + `concurrency_124.sh` ต้องคู่กับ `same_day_cutoff` หลัง 145
- R4: header ของ migration 124 reconcile แล้ว (comment-only)

**FINAL REPORT (รอบ 12):**
- SESSION STATUS: COMPLETE (7/7 tasks) — เหลือ Owner runtime acceptance + CI watch
- REPOSITORY ROOT: D:\A PROJECT\Bite Me Baby
- TEST RESULTS: vitest 133 files/1375 tests exit 0 (ใหม่ 3 files/28 tests) · lint 0 · build 0 · playwright 39/39
- CONTRACT RESULTS: Docker replay ALL_GREEN (001-145) + contracts 127-145 PASS · production contract 145 + 143/144 PASS
- PRODUCTION RUNTIME: ledger 118..145 (145 applied+verified+recorded) · ไม่มี production data mutation อื่น
- CI RESULTS: รอ push (ดูผล 2 workflows หลัง commit นี้)
- BLOCKERS: ไม่มีฝั่งโค้ด · Owner actions = checklist #1-#13 + role matrix P1-P3 sign-off
- HANDOFF DOCUMENT: docs/BMB_HANDOFF_NEXT_SESSION_2026-10-24.md (§15 = ผลรอบนี้)
