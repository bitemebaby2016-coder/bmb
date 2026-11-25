# Plan: Consolidate Duplicate Test Groups in BMB_WORK_QUEUE.md

## Objective
Consolidate duplicate test groups in WORK_QUEUE:
- Group A Round 2 (A-4R, A-5) → merge into Group H (H-1, H-2 are identical tests)
- Group B Round 2 (B-3, B-4, B-5) → merge into Group I (related to I-8 Social AI "1 reply = 1 link")
- Remove duplicate group sections
- Update summary table and status counts

## Current State Analysis

### Duplicates Identified
| Group A-R2 | Group H | Match |
|------------|---------|-------|
| A-4R: copy → Chrome has cart (hotfix) | H-1: ปุ่มคัดลอกพาตะกร้าสด | **Exact duplicate** |
| A-5: snapshot expires 30 min | H-2: Snapshot หมดอายุ 30 นาที | **Exact duplicate** |

| Group B-R2 | Group I | Match |
|------------|---------|-------|
| B-3: cancel old order = system rejects | I-8: 1 reply = 1 link (Social AI order mgmt) | **Related - same feature** |
| B-4: edit = always ask confirmation | I-8: Social AI order management | **Related - same feature** |
| B-5: edit after confirm = cancel old + new | I-8: Social AI order management | **Related - same feature** |

### Status of All Groups
- All groups (A-R2, B-R2, H, I) are **LIVE_TEST_PENDING** - code is CODE_CLOSED but Owner live tests pending
- Code implementations already documented in CHANGELOG (R102, R103, R104, R63, R63b, R63c, R63d)
- WORK_QUEUE should only track outstanding LIVE TESTS, not duplicate entries

## Plan Steps

### 1. Edit BMB_WORK_QUEUE.md
- **Remove** "## 🔄 กลุ่ม A รอบ 2 — Retest หลัง Hotfix" section (lines 183-189)
- **Remove** "## 🔄 กลุ่ม B รอบ 2 — Social AI Order Management" section (lines 192-199)
- **Keep** Group H and Group I as the canonical live test groups
- **Update** summary table at top (lines 11-22):
  - Remove "Live Tests E-I + A/B-R2 | 40 | ⏸️ PAUSED" row
  - Add separate rows for each group with correct counts
  - Update total count
- **Update** "DONE 2026-11-25 r2" note (line 28) to reflect consolidated groups
- **Update** section 4.1 in AI_WORKING_STATE.md if needed (but that's a separate doc)

### 2. Verify No Other References
- Check if any other documents reference "A-R2" or "B-R2" groups
- Update references if found

### 3. Validation
- Ensure WORK_QUEUE still has all 40 live tests (8+6+7+7+7+5 = 40)
- Verify no test cases are lost in consolidation
- Confirm CHANGELOG already has code implementation records (no need to add)

## Affected Files
- `docs/BMB_WORK_QUEUE.md` - Primary consolidation target

## Risk Assessment
- **Low risk**: Pure documentation reorganization
- **No code changes** - only consolidating duplicate test group entries
- **No test cases lost** - A-R2 tests are exact duplicates of H-1/H-2; B-R2 tests are covered by I group Social AI tests

## Validation Steps
1. Read updated WORK_QUEUE.md
2. Verify summary table counts match actual test cases
3. Verify all 40 live tests still represented
4. Confirm no duplicate entries remain