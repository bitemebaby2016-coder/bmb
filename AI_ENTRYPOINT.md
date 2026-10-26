# AI ENTRYPOINT
# Version: 1.1 (Enhanced with Atomic Task Bootstrap)
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
2. Read `AI_WORK_STATE.md` (short current-session ledger) **and** `docs/BMB_MASTER_STATUS.md`
   (CANONICAL current state · capability matrix · engineering backlog · evidence)
3. Follow these files as mandatory operating rules/state.
4. Do not modify project files before completing these steps.
5. **ATOMIC EXECUTION RULE:** Do not attempt macro-prompts or whole-project generation. Pick the active Task ID from `AI_WORK_STATE.md` and execute step-by-step (one small file/function at a time).
6. Do not repeat work that is already `PASS` + verified without new evidence.
7. Investigate the repository before asking questions.
8. Ask the user only when genuinely blocked or an explicit product decision
   is required.
9. No Evidence = Not Done.
10. SKIPPED ≠ PASS.
11. Documentation changes cannot make implementation pass.
12. Never reduce/redefine requirements to make work appear complete.
13. Maximum 2 attempts for a single bug/build/test failure.
14. Model switching does NOT reset the attempt counter.
15. After Attempt 2 fails: STOP and produce the Mandatory Halt Report.
16. After meaningful work, update `AI_WORK_STATE.md` (+ `docs/BMB_MASTER_STATUS.md` if state changed).
17. **DO NOT RE-ISSUE OLD REPORTS AS NEW WORK.** Any `docs/*.md` with a date in the name is a
    point-in-time report/handoff. Before planning, check `docs/BMB_MASTER_STATUS.md` (canonical) —
    if a report disagrees with it or with the code, flag `DOC DRIFT` and follow the Source of Truth
    hierarchy instead of restarting an audit from zero.

===============================================================================
OPERATING FLOW
===============================================================================

AI_ENTRYPOINT.md
      ↓
UNIVERSAL_MASTER_AI_RULES.md
      ↓
AI_WORK_STATE.md (Check Active Task ID & Atomic Scope)
      ↓
Project Product Spec / Codex
      ↓
Relevant Code / DB / API / Tests
      ↓
Implement (Surgical & Complete per Task)
      ↓
Verify with actual evidence
      ↓
Update AI_WORK_STATE.md
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
FINAL RULE
===============================================================================

DO NOT MAKE THE PROJECT LOOK COMPLETE.
MAKE THE PROJECT ACTUALLY COMPLETE — OR CLEARLY RECORD WHY IT IS NOT.