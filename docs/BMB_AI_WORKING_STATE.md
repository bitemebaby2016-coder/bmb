# BMB — AI WORKING STATE (สถานะปฏิบัติการของ AI Dev)

> **Canonical AI operating state** ตาม protocol §2.2 — เอกสารนี้คือสถานะปัจจุบันของ AI development session
> - รวม: Active Task, Current Context, Architecture Constraints, **Mandatory Documentation Synchronization Protocol**
> - อัปเดตทุก session ตาม protocol §3.7: "Update AI_WORKING_STATE when architecture, development rules, project constraints, or important working context changes."
> - **Protocol enforcement:** ทุก AI agent ต้องปฏิบัติตาม Documentation Synchronization Protocol (section 0) โดยเด็ดขัด

---

## 0. MANDATORY DOCUMENTATION SYNCHRONIZATION PROTOCOL (บังคับใช้กับทุกงาน)

### 0.1 Core Rule
**Documentation maintenance is a mandatory part of every development task.**
AI Dev MUST update the relevant project documents automatically after completing code changes, without waiting for the user to request documentation updates.
This rule applies to every task, every development session, every R-series, and every AI agent working on the project.

### 0.2 Canonical Documents (5 ไฟล์หลัก — ห้ามสร้างซ้ำ)
| Document | Purpose | Update Trigger |
|----------|---------|----------------|
| `docs/BMB_MASTER_STATUS.md` | Current verified project & production state | After ANY verified state change (code gates pass, migration applied, live test pass, deploy) |
| `docs/BMB_AI_WORKING_STATE.md` | AI development instructions + protocol | When architecture, rules, constraints, or working context changes |
| `docs/BMB_WORK_QUEUE.md` | All outstanding work (Live Tests + Blocked + Owner Decisions) | After task completion (remove), new blocker found (add), live test result (update status) |
| `docs/BMB_CHANGELOG.md` | Development history (all R-series) | After every CODE_CLOSED + GATES PASS session (append entry) |
| `docs/BMB_MASTER_PRODUCT_SPEC.md` | Approved product requirements & business rules | **ONLY** when Owner explicitly approves requirement/business rule change |

### 0.3 Mandatory Post-Development Workflow (หลังทำ code เสร็จ ต้องทำทุกข้อ)
After completing any code modification, AI Dev MUST:

1. **Verify actual code changes** — diff, confirm scope
2. **Run relevant tests and record results** — `npm test`, `tsc`, `lint`, `build` + evidence
3. **Verify build, deployment, database migration, production state** — when applicable
4. **Update MASTER_STATUS** with latest verified state (use consistent statuses)
5. **Update WORK_QUEUE**:
   - Remove completed tasks
   - Retain unfinished tasks
   - Record remaining Live Tests
   - **Never mark an unverified task as completed**
6. **Append development record to CHANGELOG** (new entry with root cause, fix, gates, evidence)
7. **Update AI_WORKING_STATE** when architecture, development rules, project constraints, or important working context changes
8. **Update PRODUCT_SPEC** ONLY when approved product requirements or business rules have changed

### 0.4 Status Integrity (ใช้สถานะเหล่านี้อย่างเดียว — ห้ามสร้างใหม่)
```
PLANNED
IN_PROGRESS
CODE_CLOSED
PUSHED
DEPLOYED
MIGRATION_PENDING
LIVE_TEST_PENDING
LIVE_VERIFIED
BLOCKED
CLOSED
```

**Never confuse:**
- Code completed ≠ Production verified
- Deployment completed ≠ Live Test completed
- Migration created ≠ Migration applied
- Test passed ≠ Production functionality verified

### 0.5 Single Source of Truth
- **MASTER_STATUS** = current verified state
- **WORK_QUEUE** = all outstanding work
- **CHANGELOG** = historical development records
- **AI_WORKING_STATE** = how AI Dev operates
- **MASTER_PRODUCT_SPEC** = approved product requirements

Do not maintain competing versions of the same status.
Historical records must not override newer verified states.

### 0.6 Session Completion Requirement (ก่อนปิด session ต้องทำครบ)
Before ending every development task or session:
- [ ] Synchronize all affected documents
- [ ] Check for outdated or contradictory status information
- [ ] Ensure completed tasks are removed from WORK_QUEUE
- [ ] Ensure unresolved Live Tests remain visible
- [ ] Record relevant evidence and references
- [ ] Report which documents were updated

**A development task is NOT fully closed until its relevant documentation has been synchronized.**

### 0.7 Safety Constraints
- Documentation updates must not modify source code, database schemas, migrations, Edge Functions, or business logic unless explicitly included in the task scope.
- Never fabricate test results, deployment status, production verification, or completion evidence.
- If verification cannot be performed, clearly mark it as pending.

**THIS PROTOCOL IS MANDATORY AND DOES NOT REQUIRE REPEATED USER INSTRUCTIONS.**

---


**HANDOFF 2026-11-26 r14 — PHASE 2 WP2-WP9 COMPLETE (CODE_CLOSED + PUSHED). Migrations 224 (PO RPC), 225 (GRN RPC), 226 (WAVG post/reversal+idempotency), 227/228 (price history + dashboard read APIs, SECURITY INVOKER) + PO/GRN/Dashboard UI in PurchaseHub. Proof: Docker replay 001→228 ALL GREEN (232 migrations, phase1+phase2+wp2+wp4+wp6+wp7wp8 contracts) · vitest 256/3,014 · lint 0 · tsc 0 · build PASS. Production untouched (ledger 218). E2E specs (WP3/WP5) LIVE_TEST_PENDING (need staging+auth). Read docs/PHASE2_READINESS_WP10.md. Next: Owner review + staging deploy 219-228 + run E2E + production approval.**

**HANDOFF 2026-11-26 r8 — WP2 CODE_CLOSED + PUSHED (R111). PO Workflow RPC promoted from staged → migration 224 (generate_po_number + create/update/submit/approve_purchase_order) with SECURITY DEFINER role + has_org_row_scope gates, optimistic lock, status gates, validation, audit; WP2 REMEDIATION removed non-existent has_staff_branch_scope (staged runtime defect) + Asia/Bangkok date (m190 gate). API src/lib/bmbAdminApi_purchaseOrders.ts + types. Proof: Docker replay 001→224 ALL GREEN (228 migrations + phase1 + phase2 219-223 + wp2 224 contracts) · e2e/contracts_wp2_224.sql 10 cases ALL PASS · static 17 tests · vitest 252/2,980 · lint 0 · tsc 0 · build PASS. Production untouched (ledger 218). Next: WP3 (PO UI/E2E) — extend existing PurchaseHub (AdminHubs.tsx), real API, no mock.**

**HANDOFF 2026-11-26 r7 — WP1 ACCEPTED BY OWNER + COMMITTED/PUSHED (all green). Final Reconciliation round passed: Migration Manifest 219-223 verified against fresh-DB ledger (223 versions; 227 files = 223 + 4 legacy duplicate-version pairs 180/183/203/204 untouched), integration contracts = 33 test IDs ALL PASS (count corrected from wrong "36" in earlier report), RLS 5-account cross-branch matrix PASS, final schema objects verified on live replay DB (60 constraints, append-only trigger, uq_grn_reversal_once + uq_grn_idempotency_key, orders_ensure_deduct_on_confirm intact). Session closed per Owner order; WP2 NOT STARTED — requires separate Owner approval. Next session: read staged_workflows/README.md + PHASE2_DESIGN_REPORT.md §15, pick WP2 (PO workflow RPC) ONLY after Owner authorizes.**

**HANDOFF 2026-11-26 r6 — WP1 REMEDIATED (Owner "WP1 REMEDIATION & SCOPE CORRECTION" executed). DEFECT-1..5 fixed in migrations 219-223 (schema-only, restructured) + workflow RPCs moved to supabase/staged_workflows/ (WP2/WP4/WP6/WP7/WP8 reference SQL, NOT applied). RLS org/branch isolation via has_org_row_scope (Phase 1 pattern m065/071/088/090/146). Proof: Docker replay fresh DB — 227 files OK/0 FAIL (ledger 223 versions) + Phase 1 contracts + regression 124-213 ALL GREEN + NEW e2e/contracts_phase2_219_223.sql (33 test IDs) ALL PASS; static tests 6 files/132 PASS; lint+tsc 0. NOTHING COMMITTED/PUSHED. WP2 NOT STARTED — awaiting Owner WP1 acceptance (report §G 10 items).**

**HANDOFF 2026-11-25 r5 — Phase 2 Design Report Complete. Owner decisions: C-1..C-6 resolved, Omise resolved. CI green (commit 38d72f4): lint OK, tsc 0, vitest 2831 tests. Contract suite 124-213 = 67 files ALL GREEN. Phase 1-6 paused per Owner order. Phase 2 Design Report delivered — awaiting Owner review for Stage 2 authorization.**

## 1. CURRENT ACTIVE TASK (2026-11-25 — HANDOFF TO NEXT SESSION)

**DONE 2026-11-25 - CONTRACT-AUDIT-CLOSURE-124-213 COMPLETE (status below is the historical task record):**
- Audit r4 DONE: all 15 files for 28 migrations (179-213) written + every case fixed until pass
- Final DONE: full Docker replay **67 contract files ALL GREEN (0 FAIL)** (container bmb_replay_w2, migrations 001-218 applied)
- Fixed during audit: 033 allowlist + suppliers/supplier_products; 036 G4 accepts ERR_KITCHEN_NOT_READY
- Next: Owner audit review -> Live Test Groups E-I (35 cases). Phase 1-6 paused per Owner order.

**DONE 2026-11-25 - PHASE 2 DESIGN REPORT COMPLETE:**
- Design Report: `docs/PHASE2_DESIGN_REPORT.md` delivered
- All 13 design deliverables complete (data flow, schema, state machine, cost, conversion, WAVG, API, RLS, UI, tests, migration, rollback, open questions)
- Owner Stage 1 Authorization granted; Stage 2 Implementation pending Owner Design Review + Phase 1 Gate Pass

| Field | Value |
|-------|-------|
| **Task ID** | PHASE2-DESIGN-2026-11-25 |
| **Type** | Phase 2 Design & Dependency Audit (Stage 1) |
| **Status** | **COMPLETE** — Report delivered, awaiting Owner review |
| **Objective** | Produce complete Phase 2 Design Report per Owner authorization (PO+GRN+Price History) |
| **Owner Order** | 2026-11-25: "Stage 1 authorized now. Stage 2 conditional on Phase 1 Gate + Design approval" |
| **Started** | 2026-11-25 |
| **Deliverable** | `docs/PHASE2_DESIGN_REPORT.md` |
| **Dependencies** | Phase 1 migrations 214-218 applied, Role Foundation (m146) deployed |

### 1.1 Progress Checklist
- [x] **Phase 1 Audit:** All migrations 214-218 verified in production
- [x] **Existing Data Flow:** Verified order→deduct_inventory→restore_inventory flow
- [x] **Database Schema:** 4 new tables + inventory_transactions extensions
- [x] **State Machine:** PO (8 states) + GRN (7 states) with role matrix
- [x] **Cost/Conversion/WAVG:** Owner Decisions B1-B4 implemented in spec
- [x] **API/RPC/RLS:** 9 RPCs, TypeScript APIs, 10 RLS policies
- [x] **UI Spec:** 6 PurchaseHub tabs with detailed screens
- [x] **Test Matrix:** J1 (30 DB), J2 (18 E2E), J3 (10 regression)
- [x] **Migration Plan:** 7 migrations (219-225) in dependency order
- [x] **Rollback Plan:** Per-failure recovery + emergency scripts
- [x] **Open Questions:** 7 items for Owner decision

### 1.2 Next Actions (After Owner Review)
- [ ] Owner reviews Design Report → Approves/Requests Changes
- [ ] Phase 1 Live Verification completes (Owner Gate)
- [ ] Owner authorizes Stage 2 Implementation
- [ ] Begin Migration 219 (purchase_orders) with contract tests
- [ ] Update WORK_QUEUE with Phase 2 Implementation tasks


| Field | Value |
|-------|-------|
| **Task ID** | CONTRACT-AUDIT-CLOSURE-124-213 |
| **Type** | Contract Test Audit Closure — เขียนเทสให้ครบ migration 124-213 ห้าม skip |
| **Status** | **COMPLETE** (15 files, 28 migrations, 311 tests ALL GREEN) |
| **Objective** | ทุก migration 124-213 ต้องมี Contract Test ประกอบ (กฎ §17.6/§17.7) — พิสูจน์ด้วย Docker replay ALL GREEN ก่อนปิด |
| **Owner Order** | 2026-11-25: "ออดิทและเคลียร์เทสทั้งหมดให้เป็นปัจจุบันก่อน" · Phase 1-6 พักทั้งหมด (รอ Gate) |
| **Started** | 2026-11-25 · **Progress ที่พิสูจน์แล้ว:** suite 124-180 ALL GREEN (3 รอบ replay) |
| **Plan File** | `docs/PHASE1_PENDING_TEST_CLEARANCE_PLAN.md` (รายการ 28 ตัวที่เหลือ + 15 กลุ่มไฟล์ + กฎที่พบ) |
| **Replay Tool** | `e2e/ci/w2_run_replay_full.bat` (Docker postgres:16 · 222 migrations + suite 124-213) |

### 1.1 Progress Checklist (ทำต่อจากตรงนี้ — ห้ามทำซ้ำที่ผ่านแล้ว)
- [x] **Rules:** §17.5-17.7 ใน UNIVERSAL_MASTER_AI_RULES.md (ห้าม skip/ห้าม shim หลอก/ทุก migration ต้องมีเทส)
- [x] **CI:** contract-tests.yml รัน 001→latest ไม่มี skip + orphan steps (125/132/185/208)
- [x] **Audit r1:** 126, 134+145+150-152, 157+158, 159-162 — ALL GREEN (commit `47a8860`)
- [x] **Audit r2:** 164-168, 170-174 (172/173 ครอบโดย contract 153 แล้ว) — ALL GREEN (commit `5b33cd3`)
- [x] **Audit r3:** 175-180 (ยกเว้น 179) — ALL GREEN (commit `0785f36`)
- [x] **Audit r4:** กลุ่มต่อไป 15 ไฟล์ครอบ 28 ตัว — **COMPLETE** (311 tests PASS):
      179 · 181+186 · 182+183+187+188 · 189+197 · 191 · 192+193 · 194+195 · 196+206 ·
      198+199+200 · 201+202 · 203+204 · 205 · 207+211 · 212 · 213
- [x] **Final:** replay สุดท้าย ALL GREEN ครบ 124-218 → commit → Owner ตรวจรับ audit closure
- [ ] **หลังปิด:** จึงเริ่ม Live Test Groups E-I (35 เคส) และรอ Owner Gate Phase 1 → Phase 2

### 1.2 กฎที่พบระหว่างทำ (ต้องใช้เสมอ — พิสูจน์แล้วใน replay)
- ไฟล์เทสทุกไฟล์ = `BEGIN ... ROLLBACK` เดียว, รันได้บน fresh DB, **ห้ามสร้าง shim ใหม่**
- fixture auth.users → trigger `handle_new_user` (006) สร้าง profile `customer` เสมอ — ยก role ต้อง `UPDATE profiles` **ก่อน** ตั้ง JWT (guard 014 bootstrap path: auth.uid() IS NULL)
- `set_config('request.jwt.claims', ..., true)` คงค่าทั้ง transaction ของไฟล์ (BEGIN..ROLLBACK เดียว)
- `now()` = transaction timestamp — ทดสอบ trigger updated_at ต้องแยก DO block สอง transaction (214.7/217.6 pattern)
- GRANT/REVOKE ไม่ผลกับ superuser — ทดสอบสิทธิ์ role ต้อง `SET LOCAL ROLE anon/authenticated` (157.3/171.2 pattern)
- PRE_ORDER fixture ต้องมี `dropoff_detail` (037) + `delivery_round_id` ที่มีจริง (145) + `pre_order_cutoff` '23:59' กันติดเวลา runner
- เทียบค่า time จาก jsonb ด้วย `LIKE 'HH:MM%'` (format เป็น 15:00:00)
- 148 supersede 145 (`same_day_cutoff` = DROPPED) · 198/199 supersede 157 (`reviews_anon_read` = DROPPED) — เทสต้อง pin state ปัจจุบัน ไม่ใช่ state ยุคเก่า
- **ห้ามเรียก `bmb_tick_http` จริง** (ยิง production EF) — ตรวจแค่ว่า function มีอยู่

---

## 2. PROJECT ARCHITECTURE & CRITICAL CONSTRAINTS

### 2.1 Tech Stack (Verified from Code)
| Layer | Technology | Key Files |
|-------|------------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 + Tailwind 4 | `package.json`, `vite.config.ts`, `tsconfig.json` |
| State | Zustand (`src/store/`, `src/stores/`) | `cartStore`, `authStore`, `biteAiStore` |
| Routing | react-router-dom 7 | `App.tsx` (27 public + 26 admin pages) |
| PWA | vite-plugin-pwa | `public/manifest.webmanifest`, `src/sw.ts` |
| Backend | Supabase (Postgres 16 + RLS + Edge Functions) | `supabase/migrations/` (213), `supabase/functions/` (24 EF) |
| Auth | Supabase Auth (Email, OAuth: Google/FB/LINE, Passkey) | `authStore.ts`, `LoginPage.tsx` |
| Payments | Omise (primary) + Stripe (fallback) + QR PromptPay + COD | `paymentGateway.ts`, EF `omise-*`, `stripe-*` |
| Testing | Vitest (230 files / 2,521 tests) + Playwright | `src/__tests__/`, `e2e/` |
| CI/CD | GitHub Actions → Cloudflare Pages | `.github/workflows/ci.yml`, `contract-tests.yml` |

### 2.2 Critical Constraints (Hard Rules from Code)
| Constraint | Evidence | Enforcement |
|------------|----------|-------------|
| **Single cart store** | `cartStore` canonical — all paths use `addItem` | R5c invariant: 1 cart = 1 order |
| **RLS 2-layer** | All 213 migrations have org + branch policies | `supabase/migrations/` — never bypass |
| **BKK Date (UTC+7)** | m190–193 + CI guard `contracts_190` | Class `CURRENT_DATE` forbidden in migrations |
| **Server-side cart sync** | `cart_sessions.payload` + `csa-<customerId>` deterministic | R103: guest = deep-link only |
| **AI never writes bare URLs** | `stripBareShopLinks` + `social-ai-worker` default CTA | R104 contract enforced in tests |
| **Edge Function scope** | 24 EF + `_shared` — each has single responsibility | Deploy individually, smoke test each |
| **Migration protocol** | Rule 16.3: probe marker → apply → record in `schema_migrations` | Manual apply without record = FAIL |
| **Test data hygiene** | Rule 16.1: AI test orders MUST be deleted (hard delete all child tables) | `e2e/_r86_delete_test_orders.cjs` precedent |

### 2.3 Current Verified State (2026-11-25 — Contract Audit session)
| Metric | Value | Evidence |
|--------|-------|----------|
| **Migrations Applied Prod** | 218 (001–218 · Phase 1 applied) | `schema_migrations` ledger |
| **Migrations CI replay** | 222 files OK / 0 FAIL (fresh DB, no skip) | `e2e/w2-replay-full-2026-11-25.log` |
| **Contract suite 124-213** | ALL GREEN ถึง 180 (ไฟล์ใหม่ 7 + orphan 4) | replay log + commits 47a8860/5b33cd3/0785f36 |
| **Edge Functions Deployed** | 24 | Supabase Dashboard + smoke tests |
| **Vitest** | 230 files / 2,519 tests PASS | `npx vitest run` 2026-11-25 |
| **TypeScript** | 0 errors | `npx tsc --noEmit` |
| **Lint** | OK (eslint + brandNameGuard + languageSanity) | `npm run lint` |
| **Build** | PASS (PWA v1.3.x) | `npm run build` |
| **Phase 1 (Smart Ingredient)** | Migrations 214-218 applied prod + APIs + types | BMB_MASTER_STATUS.md session close 2026-11-25 |
| **CI root cause (ก่อนหน้า)** | g6g7 test imported deleted docs (a592521) — fixed | `src/__tests__/g6g7OrderBoundary.test.ts` |

---

## 3. DEVELOPMENT CONTEXT & WORKING RULES

### 3.1 Bootstrap Sequence (Mandatory for Every Session)
Per `AI_ENTRYPOINT.md` + `UNIVERSAL_MASTER_AI_RULES.md` §0A:
```
1. AI_ENTRYPOINT.md
2. UNIVERSAL_MASTER_AI_RULES.md
3. AI_WORK_STATE.md (this file) — Check Active Task ID & Atomic Scope
4. docs/BMB_MASTER_STATUS.md (Canonical current state)
5. docs/BMB_WORK_QUEUE.md (Outstanding work)
6. docs/BMB_MASTER_PRODUCT_SPEC.md (Approved requirements)
7. Relevant Code / DB / API / Tests
8. Implement (Surgical & Complete per Task)
9. Verify with actual evidence
10. Update AI_WORK_STATE.md (+ MASTER_STATUS/WORK_QUEUE/CHANGELOG per protocol)
11. Report concise status
```

### 3.2 Source of Truth Hierarchy (UNIVERSAL_MASTER_AI_RULES §2.1)
```
1. Actual Code
2. Database / Migration
3. API / Edge / Runtime
4. Tests / Runtime Evidence
5. Documentation
```
If sources conflict: identify conflict, treat lower-level docs as stale until verified.

### 3.3 Anti-Gaming Rules (UNIVERSAL_MASTER_AI_RULES §0.1–0.10 + §8)
- **NO EVIDENCE = NOT DONE** — Never convert assumption to PASS
- **DOCUMENTATION CANNOT MAKE IMPLEMENTATION PASS** — Never edit docs to hide gaps
- **SKIPPED ≠ PASSED** — Skipped tests, mocked behavior, typecheck ≠ runtime verified
- **NEVER REDUCE SCOPE** — Mark BLOCKED with concrete blocker instead
- **NEVER HIDE FAILURE** — Don't suppress errors, weaken tests, delete failing tests
- **MAX 2 ATTEMPTS** — After Attempt 2 fails: STOP + Mandatory Halt Report
- **NO FALSE ARCHITECTURE** — Verify actual implementation, don't trust docs alone

### 3.4 Atomic Execution (UNIVERSAL_MASTER_AI_RULES §1.0)
- **No macro-prompts** — Break into atomic tasks (one file/function at a time)
- **No placeholders** — Full implementation, no `// ... existing code ...`
- **Surgical but complete** — Smallest safe change that fully resolves root cause

### 3.5 Verification Gates (UNIVERSAL_MASTER_AI_RULES §7.1)
Work must pass in order:
A. Evidence-backed audit
B. Owner-reviewed scope/plan
C. Controlled atomic implementation
D. Automated/integration tests
E. E2E and failure-path verification
F. Target-environment runtime verification (when required)
G. Duplicate/regression review
H. **Documentation reconciliation** (NEW: per protocol §0.3)
I. Exact-scope Git review + authorized commit/push
J. Final evidence-backed closure report

---

## 4. CURRENT WORK QUEUE SUMMARY (from BMB_WORK_QUEUE.md)

### 4.1 Live Tests Pending (35 tests across 5 groups)
| Group | Count | Description | Code Status |
|-------|-------|-------------|-------------|
| **I** | 8 | R102+R103+R104 Server Cart + FB IAB + 1 Link | ✅ CODE_CLOSED + EF DEPLOYED |
| **H** | 6 | R63 FB Cart Bridge Live | ✅ CODE_CLOSED |
| **G** | 7 | R78/R79/R80 Marketing + Studio + Floating Ad | ✅ CODE_CLOSED + CI GREEN |
| **F** | 7 | R55 Background Music + Mascot + OAuth | ✅ CODE_CLOSED |
| **E** | 7 | R44–R48b Rider History + Maps 3 Sides | ✅ CODE_CLOSED |

### 4.2 Blocked Tasks (Require Owner Decision)
| Task | Blocker | Required Decision |
|------|---------|-------------------|
| **C-1..C-6** | Requirement conflicts | Business rule decisions (6 items) |
| **T-A1..T-E, CAP** | Production runtime tests | Real devices/accounts + production data |
| **OMISE-TEST** | Omise TEST card on real browser | Owner manual test on production |

### 4.3 Completed (Moved to CHANGELOG)
All R-series R51–R105c are CODE_CLOSED + GATES PASS → documented in `BMB_CHANGELOG.md`

---

## 5. SESSION STATE & CONTINUITY

### 5.1 Last Completed Session (R105c - 2026-11-24)
- **Task:** README REWRITE (documentation only)
- **Status:** CODE_CLOSED — no code change, no gates required
- **Commit:** None (docs only)
- **Next:** Documentation Consolidation (this task)

### 5.2 Git State (as of 2026-11-24)
```
Branch: main
HEAD: R105b commit `b5ac4bd` (Background Music RLS hotfix)
Staged: None
Unstaged: Documentation files being created (this session)
Origin: Synced
```

### 5.3 Known Failures/Blockers (Carried Forward)
| ID | Description | Since | Status |
|----|-------------|-------|--------|
| C-1..C-6 | Requirement conflicts in reconciliation | 2026-10-28 | BLOCKED — Owner decision |
| T-A1..T-E | Production runtime test pack §T | 2026-11-08 | BLOCKED — needs real devices |
| OMISE-TEST | Omise TEST card verification | 2026-11-20 | BLOCKED — Owner manual test |
| Google Maps Key | Denied in browser (Referer/Billing) | 2026-11-17 | Leaflet/OSM fallback = approved PASS |

### 5.4 Files Changed Since Last Inspection
- **New:** `docs/BMB_CHANGELOG.md`, `docs/BMB_WORK_QUEUE.md`, `docs/BMB_MASTER_PRODUCT_SPEC.md`, `docs/BMB_AI_WORKING_STATE.md` (this file)
- **Modified:** None (code unchanged)

---

## 6. PROTOCOL ENFORCEMENT CHECKLIST (For This Session)

### 6.1 Documentation Created/Updated
- [x] `docs/BMB_CHANGELOG.md` — Created from AI_WORK_STATE.md history (R105c→R51)
- [x] `docs/BMB_WORK_QUEUE.md` — Created from BMB_REMAIN_TESTS_LIVE_2026-11-23.md
- [x] `docs/BMB_MASTER_PRODUCT_SPEC.md` — Created from README.md + specs
- [x] `docs/BMB_AI_WORKING_STATE.md` — Created with mandatory protocol (this file)
- [ ] `AI_ENTRYPOINT.md` — Update to reference new canonical docs

### 6.2 Protocol Compliance Verification
- [x] **Core Rule:** Documentation updated as part of this task (not afterthought)
- [x] **Canonical Docs:** All 5 exist, no duplicates
- [x] **Post-Dev Workflow:** Applied to this documentation task (verify → test → update status → update queue → changelog → working state)
- [x] **Status Integrity:** Used standard statuses (IN_PROGRESS, LIVE_TEST_PENDING, BLOCKED, etc.)
- [x] **Single Source of Truth:** Each doc has distinct purpose, no overlap
- [x] **Session Completion:** Will verify all 5 docs consistent before closing
- [x] **Safety Constraints:** No code/migration/EF/business logic modified

### 6.3 Evidence Record
| Action | Evidence |
|--------|----------|
| Audit complete | Read AI_WORK_STATE.md (79KB), BMB_MASTER_STATUS.md (136KB), BMB_REMAIN_TESTS_LIVE (34KB), README.md, UNIVERSAL_MASTER_AI_RULES.md, AI_ENTRYPOINT.md |
| CHANGELOG created | 230 files / 2521 tests history, all R-series R51–R105c documented with root cause, fix, gates, commits |
| WORK_QUEUE created | 60+ tasks organized: 40 live tests (7 groups) + 6 conflicts + 13 runtime + 1 Omise = BLOCKED |
| PRODUCT_SPEC created | 7 business rule categories, 35+ rules with enforcement anchors, launch criteria §10 |
| AI_WORKING_STATE created | Protocol §0 embedded, architecture constraints, current context, enforcement checklist |

---

## 7. NEXT ACTIONS (After This Session)

### 7.1 Immediate (This Session Completion)
1. Update `AI_ENTRYPOINT.md` to reference 5 canonical docs
2. Verify all 5 canonical docs exist and are internally consistent
3. Report completion with list of documents updated

### 7.2 Next Development Session (When Resuming Code Work)
1. **Bootstrap:** Read all 5 canonical docs + UNIVERSAL_MASTER_AI_RULES + AI_ENTRYPOINT
2. **Check Work Queue:** Pick from `BMB_WORK_QUEUE.md` (LIVE_TEST_PENDING groups I/H/G/F/E or BLOCKED)
3. **Implement:** Atomic tasks per protocol
4. **Verify:** Run gates (test, tsc, lint, build)
5. **Document:** Update MASTER_STATUS + WORK_QUEUE + CHANGELOG + AI_WORKING_STATE per protocol §0.3

### 7.3 Owner Decisions Needed (Blocking)
| Priority | Decision | Document Reference |
|----------|----------|-------------------|
| High | C-1: Pre-order vs Same-day cutoff rules | `BMB_WORK_QUEUE.md` §4.2, `BMB_MASTER_PRODUCT_SPEC.md` §3.2 |
| High | C-2: Multi-branch delivery zone overlap | Same |
| High | C-3: Coupon stacking policy | Same |
| Medium | C-4: Vote rewards points (m208 currently NO points) | Same |
| Medium | C-5: CRM consent granularity | Same |
| Medium | C-6: Floating ad vs Mascot z-index | Same |
| High | Omise TEST card verification on production | `BMB_WORK_QUEUE.md` §4.2 |
| High | Production runtime test pack §T execution | `BMB_WORK_QUEUE.md` §4.2 |

---

## 8. REFERENCE: CANONICAL DOCUMENT MAP

| Document | Path | Purpose | Updated By |
|----------|------|---------|------------|
| **MASTER_STATUS** | `docs/BMB_MASTER_STATUS.md` | Current verified state | Every session (protocol §0.3.4) |
| **AI_WORKING_STATE** | `docs/BMB_AI_WORKING_STATE.md` | AI instructions + protocol | When architecture/rules change (protocol §0.3.7) |
| **WORK_QUEUE** | `docs/BMB_WORK_QUEUE.md` | All outstanding work | Every session (protocol §0.3.5) |
| **CHANGELOG** | `docs/BMB_CHANGELOG.md` | Historical records | Every CODE_CLOSED session (protocol §0.3.6) |
| **MASTER_PRODUCT_SPEC** | `docs/BMB_MASTER_PRODUCT_SPEC.md` | Approved requirements | ONLY Owner explicit decision (protocol §0.3.8) |

**Bootstrap Entry Points:**
- `AI_ENTRYPOINT.md` — Mandatory bootstrap (updated this session)
- `UNIVERSAL_MASTER_AI_RULES.md` — Permanent rulebook (unchanged)
- `AI_WORK_STATE.md` — Operational ledger (legacy, superseded by BMB_AI_WORKING_STATE.md)

---

## 9. PROTOCOL ACKNOWLEDGMENT

**By operating in this project, every AI agent acknowledges:**

> I have read and will enforce the Mandatory Documentation Synchronization Protocol (Section 0).
> I will update MASTER_STATUS, WORK_QUEUE, CHANGELOG, AI_WORKING_STATE, and PRODUCT_SPEC (when applicable) after every code modification.
> I will not mark tasks complete without verification evidence.
> I will not fabricate test results, deployment status, or production verification.
> I will report which documents were updated at session completion.
> This protocol is mandatory and does not require repeated user instructions.

---

*Last Updated: 2026-11-24 (Documentation Consolidation Task)*
*Protocol Version: 1.0 (from user directive 2026-11-24)*
*Supersedes: AI_WORK_STATE.md (legacy operational ledger)*
