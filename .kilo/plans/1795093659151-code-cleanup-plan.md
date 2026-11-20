# Plan: Code & Documentation Cleanup + Feature Verification

## Overview
Clean up messy code/documentation, identify hardcoded values/bugs, and verify which features (beyond remaining live tests) work correctly.

## Code Quality Issues

### 1. `src/lib/aiVoice.ts` - Magic numbers & hardcoded values
- **Line 166**: `VOICE_REPLY_ENABLED_KEY = 'bmb_voice_reply_enabled'` — string literal should be constant
- **Line 223**: `SERVER_TTS_CHUNK = 180` — magic number, should be configurable/env
- **Line 230-256**: `splitWordSafe()` — Intl.Segmenter fallback to `[text]` when unavailable; needs better error handling
- **Line 244**: `chunks.push(word.slice(i, i + max))` — hardcoded chunking logic for Thai word segmentation
- **Line 263-267**: `pickThaiVoice()` — returns null if no Thai voice; caller must handle

### 2. `src/App.tsx` - Route consolidation
- **Lines 256-353**: `InAppBrowserBanner` routes — many duplicate `Suspense fallback={<LoadingSpinner />}` patterns
- **Lines 308-351**: Admin routes all use `AdminRoute` + `Layout` + `AdminNav` — could be factored into a helper
- **Line 314**: `/admin/pre-orders` redirect — should verify this is still needed after m207
- **Line 321**: `/admin/payment-exceptions` redirect — similar check

### 3. Duplicate/Unused code
- **`src/.kilo/`**: Contains worktree copies of tests (per vitest.config.ts exclude comment: "duplicates of real tests, stale copies cause flaky failures")
- Several test files in `src/__tests__/` may have redundant test cases

## Documentation Cleanup

### 1. Archive stale docs per `BMB_DOCUMENT_INVENTORY_AND_ARCHIVE_MAP.md §5`
- 50 docs in `docs/` → `docs/archive/` (BLOCKED: code/migration references)
- 49 root reports → `docs/archive/root_reports/`
- Move completed per the map, keep only KEEP files at root

### 2. Update `BMB_REMAIN_TESTS_LIVE_2026-11-15.md`
- Current state: Group E only (7 items: E-1 through E-7)
- Groups A-D: Mostly PASS from round 1, some retests needed (A-4R, A-5, B-3/4/5)

## Feature Verification Status (from docs)

| Group | Status | Notes |
|-------|--------|-------|
| **A** (Cart/Continuitly) | ⚠️ Retest needed | A-4R (clipboard fix), A-5 (30min snapshot) |
| **B** (Order Memory + AI) | ⚠️ Retest needed | B-3 (cancel old), B-4 (edit confirm), B-5 (edit→cancel+new) |
| **C** (Cross-channel context) | ✅ PASS | C-1/2/3 all passed round 1 |
| **D** (Grounding + comments) | ✅ PASS | D-1/2 all passed round 1 |
| **E** (Rider tabs + maps) | 🆕 New | E-1~E-7 need live test after m180+m207 deploy |

## Validation Plan

### Code checks (run locally):
1. `npm run lint` — should pass 0 errors (per eslint config baseline)
2. `npm run build` — `tsc && vite build` should succeed
3. `npm test` — vitest: 2257 tests PASS (per docs), check remaining groups

### Documentation checks:
1. Run `node e2e/r62DocRefs.cjs` → verify no new code references moved docs
2. Confirm `docs/archive/` has all files from §5.1 and §5.2

### Feature verification:
1. Run remaining live tests: A-4R, A-5, B-3, B-4, B-5, E-1~E-7
2. Verify: hard reload (Ctrl+Shift+R), test on `https://biteme-baby.com`
3. Record: ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · evidence (ภาพ/copy ข้อความ)

## Risks & Assumptions
- **Risk**: Removing duplicate theater section (home-sec-bite-picks) may break scroll references — Owner L-3 fallback handles missing target
- **Risk**: Dark mode close button colors — already identified in plan P0-C-049, need CSS overrides
- **Assumption**: Server-side aiPolicy stays authoritative; client model list in aiModels.ts is re-export only

## Acceptance Criteria
- ✅ Code: lint 0 errors, build succeeds
- ✅ Docs: archive stale files per inventory map
- ✅ Tests: remaining live test groups pass after hotfixes
- ✅ Features: A-D core functionality verified working; E group needs live test

## Next Steps

### 1. Code Cleanup
- Remove duplicate theater section from `src/pages/HomePage.tsx` (P0-C-048)
- Add dark mode overrides for close buttons in `src/index.css` (P0-C-049)
- Fix `aiVoice.ts` hardcoded values:
  - Convert `VOICE_REPLY_ENABLED_KEY` to constant
  - Make `SERVER_TTS_CHUNK` configurable via env
  - Improve `splitWordSafe()` error handling
- Consolidate Admin routes in `src/App.tsx`

### 2. Documentation Cleanup
- Archive stale docs per inventory map (§5)
- Update `BMB_REMAIN_TESTS_LIVE_2026-11-15.md` with current status

### 3. Feature Verification
- Run remaining live tests (A-4R, A-5, B-3, B-4, B-5, E-1~E-7)
- Verify A-D core functionality works
- Test E group features after m180+m207 deployment

### 4. Testing Verification
- Run `npm test` to confirm 2257 tests PASS
- Run `npm run lint` and `npm run typecheck`
- Verify build with `npm run build`