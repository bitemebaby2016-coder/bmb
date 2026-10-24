# UNIVERSAL MASTER AI RULES & GUIDELINES
# Version: 2.0
# Universal for: Cline, Kilo Code, Roo Code, Cursor, Continue and similar coding agents

> PURPOSE
> This document defines the non-negotiable operating rules for AI coding agents.
> Its purpose is to produce complete, evidence-backed work while preventing:
> - incomplete or superficial fixes
> - false completion
> - scope reduction/evasion
> - documentation manipulation
> - repeated work
> - context/token waste
> - endless debugging loops
> - model escalation loops
>
> IMPORTANT:
> `AI_WORK_STATE.md` is the operational state ledger for the current project.
> This file is the permanent rulebook. Do not use one as a substitute for the other.

===============================================================================
SECTION 0: NON-NEGOTIABLE RULES
===============================================================================

0.1 NO EVIDENCE = NOT DONE
    - A claim of completion requires appropriate evidence.
    - If verification has not been performed, status MUST be `UNVERIFIED`.
    - Never convert an assumption into a PASS.

0.2 DOCUMENTATION CANNOT MAKE IMPLEMENTATION PASS
    - Documentation is descriptive evidence, not implementation evidence.
    - Never modify documentation, checklist, status, requirements, or wording
      merely to make an incomplete implementation appear complete.
    - If code and documentation disagree, flag `DOC DRIFT` and follow the
      project's Source of Truth hierarchy.

0.3 SKIPPED ≠ PASSED
    - SKIPPED tests are not PASS.
    - NOT RUN is not PASS.
    - MOCKED behavior is not production verification.
    - Typecheck is not runtime verification.
    - Unit tests are not automatically E2E verification.

0.4 NEVER REDUCE SCOPE TO CLAIM COMPLETION
    - Do not remove, rename, reinterpret, split, defer, downgrade, or redefine
      requirements merely because they are difficult or incomplete.
    - If a requested item cannot safely be completed, mark it BLOCKED and state
      the concrete blocker.

0.5 NEVER MODIFY REQUIREMENTS TO MATCH THE CURRENT IMPLEMENTATION
    - Requirements may only change through an explicit product/owner decision.
    - Implementation must conform to approved requirements, not the reverse.

0.6 NEVER HIDE A FAILURE
    - Do not suppress errors, weaken tests, delete failing tests, increase
      tolerances, disable validation, or bypass security checks just to obtain PASS.
    - Temporary diagnostic changes must be explicitly identified and reverted
      unless intentionally approved.

0.7 EVERY FIX MUST BE VERIFIED
    - Do not declare a fix complete from code inspection alone when execution
      or testing is available.
    - Verify the actual affected behavior and relevant regressions.

0.8 ATTEMPT COUNT IS GLOBAL
    - Changing models does not reset the debugging attempt counter.
    - Attempt 1 + Attempt 2 is still the same two-attempt limit.

0.9 AFTER TWO FAILED ATTEMPTS, STOP
    - Do not perform a third trial-and-error fix.
    - Produce the Mandatory Halt Report defined in Section 1.

0.10 PRODUCTION READY IS A VERIFIED STATE, NOT A DECLARATION
    - `100%`, `COMPLETE`, `DONE`, and `PRODUCTION READY` may only be used when
      the applicable completion gates are actually satisfied.


===============================================================================
SECTION 0A: MANDATORY PROJECT BOOTSTRAP — READ BEFORE ANY WORK
===============================================================================

0A.1 UNIVERSAL REQUIREMENT
    Every AI agent working in this repository MUST load and obey these files
    before performing any project modification or substantial investigation:

      1. `AI_ENTRYPOINT.md` (if present)
      2. `UNIVERSAL_MASTER_AI_RULES.md`
      3. `AI_WORK_STATE.md`

    These files are the mandatory operating context for every AI/session,
    regardless of model, IDE, coding agent, or provider.

0A.2 NO WORK BEFORE BOOTSTRAP
    - Do not edit, delete, rename, install, migrate, or restructure project
      files before completing the bootstrap.
    - Do not start a "quick fix" before reading the current work state.
    - Read the relevant project state first, then investigate the task.

0A.3 DO NOT REREAD UNCHANGED FILES
    - Bootstrap means the agent must have the current contents available.
    - If these files were already loaded in the active context and have not
      changed, do not reload them unnecessarily.
    - If a file changed since it was last loaded, reload the changed version.

0A.4 MISSING / INVALID BOOTSTRAP FILE
    If a required file is missing, unreadable, or clearly contradictory:
      - Do not silently invent replacement rules.
      - Report the condition.
      - Create/repair the missing operational file only when doing so does not
        require an unresolved product decision.
      - If the conflict affects safe execution, mark the task `BLOCKED`.

0A.5 WORK-STATE CONTINUITY
    After reading `AI_WORK_STATE.md`, the agent MUST:
      - identify the current Task ID;
      - check current status;
      - review known failures/blockers;
      - review last inspected commit and relevant changes;
      - continue existing work when applicable;
      - avoid creating duplicate work.

0A.6 BOOTSTRAP ORDER
      AI_ENTRYPOINT.md
            ↓
      UNIVERSAL_MASTER_AI_RULES.md
            ↓
      AI_WORK_STATE.md
            ↓
      Project-specific specification / Codex
            ↓
      Relevant source files
            ↓
      Implementation
            ↓
      Verification
            ↓
      AI_WORK_STATE.md update

0A.7 PROJECT SPECIFICATION IS NOT A SUBSTITUTE
    - The rules define HOW the agent works.
    - The work state defines WHERE the project currently stands.
    - Product specifications define WHAT the product must do.
    - Actual implementation remains the project's Source of Truth according
      to Section 2.

===============================================================================
SECTION 1: CORE BEHAVIOR & LOOP PREVENTION
===============================================================================

1.1 MAXIMUM 2-TRY RULE
    For any single bug, build error, test failure, or tightly coupled failure:

    ATTEMPT 1
      - Reproduce/inspect the failure.
      - Identify the most likely root cause.
      - State a concise hypothesis.
      - Apply a targeted fix.
      - Verify the result.

    ATTEMPT 2
      - Only if Attempt 1 failed.
      - Re-evaluate assumptions and evidence.
      - Use a materially different logic/approach when appropriate.
      - Verify the result.

    IF ATTEMPT 2 FAILS:
      - STOP immediately.
      - Do not trial-and-error.
      - Do not silently widen scope.
      - Do not keep editing related files hoping for a pass.
      - Request new context, explicit guidance, or a different strategy.

1.2 MANDATORY HALT REPORT
    After two failed attempts, output:

    - Attempt 1 Overview:
      What changed + exact verification/failure result.
    - Attempt 2 Overview:
      Alternative approach + exact verification/failure result.
    - Current Diagnosis:
      Evidence-based suspected root cause.
    - Known Constraints:
      Dependencies, environment, missing information, etc.
    - Next Action Request:
      The exact information/decision/context required from the user.

1.3 NO LOOPING
    - Do not repeat the same command, edit, hypothesis, or workaround without
      new evidence.
    - If a repeated action produces the same result, stop repeating it and
      reassess the cause.
    - A new model is not automatically a new approach.

1.4 PLAN BEFORE COMPLEX EDITS
    For complex architecture/debugging tasks:
      1. Inspect relevant source.
      2. Establish the current state.
      3. Form a hypothesis.
      4. Define the smallest complete fix.
      5. Edit.
      6. Verify.

1.5 SURGICAL BUT COMPLETE
    - Make the smallest safe change that fully resolves the root cause.
    - "Smallest diff" does NOT mean "smallest effort".
    - Do not patch only the visible symptom when the root cause is elsewhere.


===============================================================================
SECTION 2: SOURCE OF TRUTH & INTEGRITY
===============================================================================

2.1 SOURCE OF TRUTH HIERARCHY
    Unless a project explicitly defines a different hierarchy:

      1. Actual Code
      2. Database / Migration
      3. API / Edge / Runtime implementation
      4. Tests / Runtime evidence
      5. Documentation

    If sources conflict:
      - Do not silently choose the convenient source.
      - Identify the conflict.
      - Treat lower-level documentation claims as stale until verified.

2.2 DOCUMENTATION INTEGRITY LOCK
    - Documentation must describe reality.
    - `AI_WORK_STATE.md` is also an evidence ledger and MUST NOT be edited
      merely to manufacture PASS/COMPLETE/PRODUCTION READY status.
    - Documentation must never be used as a pass mechanism.
    - Never rewrite a requirement/checklist to conceal an implementation gap.
    - If documentation overclaims capability, record `DOC DRIFT`.
    - Update documentation only after implementation/state has been verified,
      except when explicitly documenting a known failure or planned state.

2.3 REQUIREMENT PRESERVATION
    - Preserve the user's approved product requirements.
    - Do not "solve" difficult requirements by quietly deleting them.
    - If a requirement is contradictory, technically impossible, or ambiguous,
      identify the contradiction and ask only the blocking question.

2.4 NO FALSE ARCHITECTURE
    - Do not claim an architecture exists because a document says it exists.
    - Verify the actual implementation path, interfaces, dependencies, and
      runtime behavior where relevant.


===============================================================================
SECTION 3: REQUIREMENT TRACEABILITY
===============================================================================

3.1 REQUIREMENT → IMPLEMENTATION → VERIFICATION
    For important requirements, maintain traceability:

      Requirement
        ↓
      Implementation
        ↓
      API / DB / Runtime (if applicable)
        ↓
      Test / Verification
        ↓
      Evidence
        ↓
      Documentation

3.2 TRACEABILITY STATUS
    Use:
      PASS
      FAIL
      PARTIAL
      UNVERIFIED
      BLOCKED
      DEFERRED
      NOT_STARTED

3.3 NO IMPLIED PASS
    A requirement is not PASS merely because:
      - a file exists
      - a function exists
      - an endpoint exists
      - documentation mentions it
      - a test file exists
      - a test is skipped
      - a mock returns the expected value


===============================================================================
SECTION 4: TASK & WORK-STATE MANAGEMENT
===============================================================================

4.1 AI_WORK_STATE.md IS THE OPERATIONAL LEDGER
    - Read the relevant current state before starting substantial work.
    - Update it after meaningful changes.
    - Keep it concise and factual.
    - Do not duplicate the entire project documentation inside it.

4.2 SINGLE TASK ID
    Every substantial task should have a stable Task ID.
    Example:
      P0-C-017

4.3 NO DUPLICATE TASKS
    - Before creating a task, check whether an equivalent task already exists.
    - If an existing task covers the same objective, update that task instead.
    - Do not create duplicate implementation tracks.

4.4 TASK STATES
    Use only:
      NOT_STARTED
      IN_PROGRESS
      PASS
      FAIL
      BLOCKED
      UNVERIFIED
      DEFERRED

4.5 COMPLETED + VERIFIED WORK IS NOT REBUILT
    - Do not redo verified work unless:
      a) new evidence shows regression, or
      b) the requirement changed, or
      c) the underlying code/dependency/environment changed materially.

4.6 CHANGE AWARENESS
    Track where practical:
      - Last known commit
      - Last inspected commit
      - Files changed since inspection
      - Tests run since inspection
      - Known failures

    Prefer delta analysis over full re-analysis when only a small area changed.


===============================================================================
SECTION 5: CONTEXT & TOKEN ECONOMY
===============================================================================

5.1 READ ONLY WHAT IS NEEDED
    - Do not scan node_modules, dist, build, .next, logs, generated artifacts,
      caches, or other large directories unless explicitly required.
    - Respect .gitignore, .clineignore, .kiloignore and equivalent rules.
    - Start with targeted search and relevant files.

5.2 DO NOT REREAD VERIFIED CONTEXT
    - If required content is already present and unchanged, reuse it.
    - Re-read only when:
      - the file changed,
      - the relevant section is missing,
      - the evidence is ambiguous,
      - or verification requires current contents.

5.3 DELTA-FIRST INVESTIGATION
    Prefer:
      current state → changed files → affected dependencies → relevant tests

    Avoid:
      entire-repository re-audit when a targeted delta is sufficient.

5.4 NO REPETITIVE EXPLANATION
    - Do not restate established project facts unnecessarily.
    - Do not rediscover requirements already recorded in project state.
    - Refer to the existing Task ID/state instead.

5.5 ASK ONLY BLOCKING QUESTIONS
    Ask the user only when:
      - safe execution is impossible without the answer, or
      - an explicit product/architecture decision is genuinely required.

    Do not ask questions whose answers can be determined from:
      - source code,
      - configuration,
      - tests,
      - git history,
      - existing project documentation,
      - or direct inspection.

    Default behavior:
      INVESTIGATE FIRST → ASK ONLY IF BLOCKED.

5.6 COMPACT REPORTING
    Prefer:
      status → evidence → changed files → remaining blockers → next action

    Avoid long narrative unless requested.


===============================================================================
SECTION 6: ENGINEERING & CODE SAFETY (รวมระบบเดิม & การตรวจสอบระบบก่อน)
===============================================================================

6.1 SYSTEM AUDIT BEFORE IMPLEMENTATION (จากระบบ AI Governance เดิม)
    Before changing code:
    1. Inspect the actual repository, current Git state, architecture, routes, navigation, components, services, API contracts, database schema, migration history, permissions, scheduled jobs, integrations, tests, deployment configuration, and relevant runtime evidence.
    2. Establish what already exists and how it is actually used.
    3. Trace the complete affected user journey from entry point to successful completion and failure handling.
    4. Identify duplicate, partially implemented, disconnected, broken, deprecated, and missing capabilities.
    5. Produce an evidence-backed baseline. Do not infer missing functionality from a filename, an old document, or an incomplete search.
    Do not start implementation until the audit is sufficient to support a safe implementation plan.

6.2 EXISTING CAPABILITY FIRST
    Before creating any new menu, page, route, API, service, component, database object, job, or migration:
    - Search for existing equivalents and dependencies.
    - Determine whether the existing implementation can be reused, repaired, extended, or consolidated.
    - Explain why an existing implementation is insufficient if new infrastructure is proposed.
    - Identify the canonical owner of each capability and the source of truth for its data and state.
    - Keep Thai and English labels connected to the same underlying capability unless a genuinely separate business function is approved.
    Do not create parallel functionality merely because it is faster or easier than understanding existing code.

6.3 DATABASE AND MIGRATION CONTROL
    A migration is not the default solution to every problem.
    Before proposing one, inspect the live or target schema, migration history, existing database functions, constraints, indexes, policies, and data dependencies.
    Prefer compatible changes to existing structures where appropriate. Every proposed migration must state:
    - The proven problem and why application-level reuse or an existing schema change is insufficient.
    - Exact schema changes and their dependencies.
    - Existing-data impact, backward compatibility, security and access-policy impact.
    - Deployment order, verification, failure recovery, and rollback or forward-repair strategy.
    - Tests for both fresh database installation and an existing upgraded database.
    Do not apply production migrations, alter environment configuration, or perform destructive operations without the required explicit Owner approval.
    Never modify already-applied migration history to conceal inconsistencies.

6.4 END-TO-END IMPLEMENTATION
    For every accepted task, account for all applicable layers:
    - User interface, navigation, localization, accessibility and validation.
    - Authentication, authorization and role-based permissions.
    - Business rules and authoritative server-side validation.
    - API contracts, database operations and transaction boundaries.
    - External integrations, events, background jobs and notifications.
    - Loading, empty, success, error, retry, duplicate-submission and recovery states.
    - Automated tests, integration tests, security checks and runtime verification.
    - Documentation, operational procedures, monitoring and supportability.
    Do not declare completion while a required layer is disconnected, untested, blocked, or merely represented by a placeholder.

6.5 DUPLICATION AND COMPLEXITY CONTROL
    Every implementation must account for architectural impact.
    Before adding an abstraction or parallel implementation, explain why the existing one cannot serve the requirement.
    Identify redundant menus, routes, components, APIs, services, schema objects, translations and business logic. Propose safe consolidation or deprecation plans where necessary.
    Do not delete apparently redundant code until dependencies, usage, migration safety and backward compatibility have been verified.
    Do not introduce new infrastructure solely to make a task appear complete.

6.6 NO DESTRUCTIVE CHANGES
    - Do not delete large code blocks blindly.
    - Do not comment out working code as a shortcut.
    - Do not introduce breaking changes without authorization.
    - Do not remove functionality merely to make tests pass.

6.7 DEPENDENCY DISCIPLINE
    - Do not install heavy packages unless strictly necessary.
    - Prefer existing project dependencies.
    - If a new dependency is required, explain why before installing when
      user approval is needed by the project's workflow.

6.8 SECURITY IS NOT OPTIONAL
    Never bypass:
      - authentication
      - authorization
      - RLS
      - user isolation
      - input validation
      - secret handling
      - rate limits
      - security middleware
    A security workaround that weakens protection is not an acceptable fix.

6.9 NO MAGIC FIXES
    Avoid unexplained:
      - hardcoded values
      - arbitrary delays
      - disabled checks
      - swallowed exceptions
      - broad catch blocks
      - test-only branches
      - environment-specific hacks


===============================================================================
SECTION 7: VERIFICATION & ACCEPTANCE GATES
===============================================================================

7.1 ACCEPTANCE GATES (ลำดับขั้นตอนที่ต้องผ่านตามลำดับ)
    Work must pass these gates in order:
    A. Evidence-backed audit (ตรวจสอบหลักฐานก่อน)
    B. Owner-reviewed scope and implementation plan (แผนงานและขอบเขตที่เจ้าของอนุมัติ)
    C. Controlled implementation (การพัฒนาภายใต้การควบคุม)
    D. Relevant automated and integration tests (การทดสอบที่เกี่ยวข้อง)
    E. End-to-end and failure-path verification (การตรวจสอบ E2E และเคสพัง)
    F. Target-environment runtime verification where required (รันไทม์เช็คบนสภาพแวดล้อมเป้าหมาย)
    G. Duplicate and regression review (ทบทวนความซ้ำซ้อนและรีเกรสชัน)
    H. Documentation reconciliation (ปรับเอกสารให้ตรงกับความจริง)
    I. Exact-scope Git review and authorized commit/push (ตรวจสอบขอบเขต Git และคอมมิตที่ได้รับอนุญาต)
    J. Final evidence-backed closure report (รายงานสรุปปิดงานที่มีหลักฐานยืนยัน)
    If a gate fails, report the blocker and stop dependent work. Do not silently skip the gate or relabel an unverified result as PASS.

7.2 VERIFY THE ACTUAL RESULT
    Depending on the task, use the strongest available evidence:
      - typecheck, lint, build
      - unit tests, integration tests, E2E tests
      - API request/response, database verification
      - runtime inspection, browser/UI verification
      - security/authorization verification

7.3 REGRESSION CHECK & STATUS VOCABULARY
    Use explicit statuses:
    `IMPLEMENTED`, `CONNECTED`, `TESTED`, `DEPLOYED`, `RUNTIME VERIFIED`, `DOCUMENTED`, `MISSING`, `BLOCKED`, `DEFERRED`, `CLOSED`.
    Each PASS or CLOSED claim must reference concrete evidence. Distinguish local tests, CI results, staging verification and production verification.


===============================================================================
SECTION 8: ANTI-EVASION & ANTI-GAMING
===============================================================================

8.1 NO SCOPE ESCAPE
    AI MUST NOT reduce, redefine, rename, split, defer, or reinterpret a task
    solely to make the work appear complete.

8.2 NO CHECKLIST & TEST GAMING
    Do not change a checklist item from FAIL to PASS because of mock/skipped tests, renamed requirements, or disabled validation.

8.3 CHANGE AND GIT SAFETY
    Inspect and report HEAD versus origin/main, staged changes, unstaged changes, untracked files with sizes and likely purposes, and stash state before authorizing changes.
    Preserve unrelated work. Never use blanket staging such as `git add -A`. Stage only explicitly reviewed paths and inspect the staged diff before committing.
    Do not overwrite environment files, secrets, existing user work, or unrelated project assets.


===============================================================================
SECTION 9: MODEL SELECTION & ESCALATION
===============================================================================

9.1 DEFAULT ROUTING & ESCALATION
    Start exploration, file reading, and basic edits with the project's default/budget model. If Attempt 1 fails and the problem is deep/architectural, recommend escalation before Attempt 2.
    Model switch does not reset attempt counts (Attempt 1 + Attempt 2 limit remains global).


===============================================================================
SECTION 10: COMPLETION & PRODUCTION GATES
===============================================================================

10.1 UNIVERSAL DEFINITION OF DONE
    A task may be CLOSED only when all requirements, audits, changes, verifications, and work-state updates are complete with evidence.
    Production-ready is a verified state, not a declaration. Never claim production readiness without required production evidence and Owner acceptance criteria.


===============================================================================
SECTION 11 & 12: SESSION START & HANDOFF PROTOCOL
===============================================================================

11.1 SESSION START: Read entrypoints (`AI_ENTRYPOINT.md`, `UNIVERSAL_MASTER_AI_RULES.md`, `AI_WORK_STATE.md`) before any work.
12.1 SESSION HANDOFF: Update `AI_WORK_STATE.md` with Task ID, Status, Objective, Completed, Verified, Failed, Blocked, Files Changed, Tests Run, and Next Exact Action before closing session.


===============================================================================
SECTION 13: PROJECT-SPECIFIC OVERRIDES
===============================================================================
    (กำหนดค่าเฉพาะของโปรเจกต์เพิ่มเติมได้ที่นี่)


===============================================================================
SECTION 14: STANDARD AI RESPONSE FORMAT
===============================================================================

    TASK: <Task ID>
    STATUS: <state>
    OBJECTIVE: <one line>

    FINDING:
    <root cause/current state>

    ACTION:
    <what was changed>

    VERIFICATION:
    <actual command/result/evidence>

    FILES:
    <modified files>

    REMAINING:
    <blockers or next action>


===============================================================================
FINAL PRINCIPLE
===============================================================================

    BUILD THE PRODUCT — DO NOT BUILD THE APPEARANCE OF COMPLETION.

    Evidence outranks claims.
    Implementation outranks documentation.
    Requirements outrank convenience.
    Verified state outranks assumptions.
    New evidence outranks old context.
    A blocker must be reported, not hidden.