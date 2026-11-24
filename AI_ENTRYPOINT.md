# AI ENTRYPOINT
# Version: 2.0 (Documentation Consolidation + Protocol Enforcement)
# Universal project bootstrap for all AI coding agents
#
# This file is intentionally short.
# It exists to force every AI agent to enter the project through the same
# operating procedure without duplicating the full rules or product spec.

===============================================================================
STOP — MANDATORY AI BOOTSTRAP
===============================================================================

Before doing ANY project work:

1. Read `UNIVERSAL_MASTER_AI_RULES.md`
2. Read `docs/BMB_AI_WORKING_STATE.md` (AI instructions + **Mandatory Documentation Protocol**) **and** `docs/BMB_MASTER_STATUS.md` (CANONICAL current state)
3. Read `docs/BMB_WORK_QUEUE.md` (All outstanding work: Live Tests + Blocked + Owner Decisions)
4. Read `docs/BMB_MASTER_PRODUCT_SPEC.md` (Approved product requirements & business rules)
5. Follow these files as mandatory operating rules/state.
6. Do not modify project files before completing these steps.
7. **ATOMIC EXECUTION RULE:** Do not attempt macro-prompts or whole-project generation. Pick the active Task ID from `docs/BMB_AI_WORKING_STATE.md` and execute step-by-step (one small file/function at a time).
8. Do not repeat work that is already `LIVE_VERIFIED` / `CLOSED` + verified without new evidence.
9. Investigate the repository before asking questions.
10. Ask the user only when genuinely blocked or an explicit product decision is required.
11. No Evidence = Not Done.
12. SKIPPED ≠ PASS.
13. Documentation changes cannot make implementation pass.
14. Never reduce/redefine requirements to make work appear complete.
15. Maximum 2 attempts for a single bug/build/test failure.
16. Model switching does NOT reset the attempt counter.
17. After Attempt 2 fails: STOP and produce the Mandatory Halt Report.
18. After meaningful work, update **ALL affected canonical docs** per **Mandatory Documentation Synchronization Protocol** (BMB_AI_WORKING_STATE.md §0):
   - `docs/BMB_MASTER_STATUS.md` — latest verified state
   - `docs/BMB_WORK_QUEUE.md` — remove completed, retain unfinished, record live tests
   - `docs/BMB_CHANGELOG.md` — append development record
   - `docs/BMB_AI_WORKING_STATE.md` — when architecture/rules/context changes
   - `docs/BMB_MASTER_PRODUCT_SPEC.md` — ONLY when Owner explicitly approves requirement change
19. **DO NOT RE-ISSUE OLD REPORTS AS NEW WORK.** Any `docs/*.md` with a date in the name is a point-in-time report/handoff. Before planning, check `docs/BMB_MASTER_STATUS.md` (canonical) — if a report disagrees with it or with the code, flag `DOC DRIFT` and follow the Source of Truth hierarchy instead of restarting an audit from zero.

===============================================================================
CANONICAL DOCUMENTS (5 ไฟล์หลัก — ห้ามสร้างซ้ำ)
===============================================================================

| Document | Purpose | Updated When |
|----------|---------|--------------|
| `docs/BMB_MASTER_STATUS.md` | Current verified project & production state | Every verified state change |
| `docs/BMB_AI_WORKING_STATE.md` | AI development instructions + protocol | Architecture/rules/context changes |
| `docs/BMB_WORK_QUEUE.md` | All outstanding work (Live Tests + Blocked) | Every session / task completion |
| `docs/BMB_CHANGELOG.md` | Development history (all R-series) | Every CODE_CLOSED + GATES PASS |
| `docs/BMB_MASTER_PRODUCT_SPEC.md` | Approved product requirements | ONLY Owner explicit decision |

===============================================================================
OPERATING FLOW
===============================================================================

AI_ENTRYPOINT.md
      ↓
UNIVERSAL_MASTER_AI_RULES.md
      ↓
docs/BMB_AI_WORKING_STATE.md (Check Active Task ID, Protocol §0, Atomic Scope)
      ↓
docs/BMB_MASTER_STATUS.md (Canonical current state)
      ↓
docs/BMB_WORK_QUEUE.md (Outstanding work)
      ↓
docs/BMB_MASTER_PRODUCT_SPEC.md (Approved requirements)
      ↓
Relevant Code / DB / API / Tests
      ↓
Implement (Surgical & Complete per Task)
      ↓
Verify with actual evidence
      ↓
Update ALL affected canonical docs (Protocol §0.3)
      ↓
Report concise status

===============================================================================
SOURCE OF TRUTH
===============================================================================

Unless the project explicitly defines another hierarchy:

1. Actual Code
2. Database / Migration
3. API / Edge / Runtime
4. Tests / Runtime Evidence
5. Documentation

===============================================================================
ANTI-GAMING
===============================================================================

NEVER:
- edit documentation just to obtain PASS;
- edit work-state just to hide failures;
- skip/delete/weaken tests to obtain PASS;
- silently reduce scope;
- silently change requirements;
- claim runtime behavior from static inspection when runtime verification exists;
- repeat the same failed fix without new evidence;
- create duplicate tasks for the same objective;
- use code placeholders (e.g. `// ... existing code ...`) to fake completion.

===============================================================================
MANDATORY DOCUMENTATION SYNCHRONIZATION PROTOCOL (Summary)
===============================================================================

**Core Rule:** Documentation maintenance is a mandatory part of every development task.
AI Dev MUST update relevant project documents automatically after completing code changes.

**Post-Development Workflow (Protocol §0.3):**
1. Verify actual code changes
2. Run relevant tests and record results
3. Verify build, deployment, migration, production state
4. Update MASTER_STATUS with latest verified state
5. Update WORK_QUEUE: remove completed, retain unfinished, record live tests
6. Append development record to CHANGELOG
7. Update AI_WORKING_STATE when architecture/rules/context changes
8. Update PRODUCT_SPEC ONLY when Owner explicitly approves requirement change

**Session Completion (Protocol §0.6):** Before ending every task/session:
- Synchronize all affected documents
- Check for outdated/contradictory status
- Ensure completed tasks removed from WORK_QUEUE
- Ensure unresolved Live Tests remain visible
- Record evidence and references
- Report which documents were updated

**A development task is NOT fully closed until its relevant documentation has been synchronized.**

===============================================================================
FINAL RULE
===============================================================================

DO NOT MAKE THE PROJECT LOOK COMPLETE.
MAKE THE PROJECT ACTUALLY COMPLETE — OR CLEARLY RECORD WHY IT IS NOT.

(End of file)