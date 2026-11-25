# Plan: Add Strict CI & Testing Rules to UNIVERSAL_MASTER_AI_RULES.md

## Goal
Add a new strict CI & Testing rules section to `UNIVERSAL_MASTER_AI_RULES.md` at the project root.

## Requested Changes (Owner, 2026-11-25)

Add 4 new non-negotiable rules under a suitable section:

### Rule 1: NO SKIP / NO MIGRATION BYPASS
- Strict prohibition against fixing broken CI/CD using skip, comment-out, or ignore approaches on test and migration files.

### Rule 2: NO MANUAL TEST SUBSTITUTE
- Strict prohibition against using "will test on Production/Staging later" as a reason to bypass/fake CI fixes.

### Rule 3: CI MUST REFLECT PRODUCTION
- Ephemeral DB testing environment must run all migrations from 001 to latest consistently.
- No hardcoding version numbers to stop pipelines.

### Rule 4: FIX ROOT CAUSE
- If a new migration breaks due to missing dependency, check CI pipeline run order or update test suite to support the new schema.
- Do not disable checks to make CI pass.

## Context
- File: `D:\A PROJECT\Bite Me Baby\UNIVERSAL_MASTER_AI_RULES.md`
- Current version header: `Version: 2.1 (Enhanced with Atomic Task & No-Placeholder Execution)`
- Existing sections: 0–16 plus Section 13 (Project-Specific Overrides, currently empty placeholder), Section 14 (Standard AI Response Format).
- The new rules logically fit under a new/updated section related to CI & Testing. Given existing numbering, a new section could be added as "SECTION 17: CI & TESTING STRICT RULES" or inserted before Section 14 to avoid renumbering. The owner asked to "ปรับปรุงกฏทำงานเพิ่ม" (add enhance work rules) — the safest approach is to add a new dedicated section with its own rules.

## Decisions
- Place the new rules as a new dedicated section (e.g., Section 17: STRICT CI & TESTING RULES) to keep the edit additive and avoid renumbering existing sections.
- Language: Keep Thai for rule titles/comments per project convention, with English detail lines to match file style (file mixes both).
- Evidence: The user's request is the source for these rules; this task is documentation-only.

## Validation Plan
- After edit, read back the modified region of the file to confirm correct insertion.
- Verify no existing content was accidentally removed.

## Risks / Open Questions
- None blocking. No source code changes involved.
