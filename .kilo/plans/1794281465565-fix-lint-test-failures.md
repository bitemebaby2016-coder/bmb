# Fix Lint & Test Failures Plan

## Summary
- **Lint FAIL**: 1 file — `src/components/theater/FoodTheater.tsx` has UTF-8 BOM
- **Test FAIL**: 10 test files / 15 tests / 2 errors — cleanup issues (setTimeout/setInterval not cleared, promises not awaited)

---

## 1. Fix Lint: UTF-8 BOM in FoodTheater.tsx

### Problem
```
languageSanity: FAIL — พบ BOM / U+FFFD / ตัวอักษรชุดอื่น (1 จุด)
  src/components/theater/FoodTheater.tsx (UTF-8 BOM)
```

### Fix
- Open `src/components/theater/FoodTheater.tsx` in VS Code
- File → Save with Encoding → **UTF-8** (NOT "UTF-8 with BOM")
- Or use Notepad++: Encoding → Convert to UTF-8

---

## 2. Fix Test Cleanup Issues (10 files, 15 tests)

### Root Cause
Tests use `setTimeout`/`setInterval` via `act(async () => { await new Promise(r => setTimeout(r, 0)) })` pattern but:
1. Don't clear timers in `afterEach`/`afterAll`
2. Don't properly await all async operations before test teardown
3. `vi.useFakeTimers()` not used where appropriate

### Affected Test Files (from grep + error output)
1. `src/__tests__/adminOrdersModeFilter.test.ts` — explicit in error
2. `src/__tests__/checkoutMixedSplit.test.ts` — uses flush() with 4x setTimeout
3. `src/__tests__/checkoutModeLock.test.ts` — uses flush() with 3x setTimeout
4. `src/__tests__/homePreOrderModeGuard.test.ts` — uses flush() with 3x setTimeout
5. `src/__tests__/r65PickupHoursNotRounds.test.ts` — uses flush() with 4x setTimeout
6. `src/__tests__/slipThumbStates.test.ts` — uses flush() with 2x setTimeout
7. `src/__tests__/slipReviewPanel.test.ts` — uses flush() with 2x setTimeout
8. `src/__tests__/adminPreOrdersConsolidation.test.ts` — uses flush() with 2x setTimeout
9. `src/__tests__/shopRoute.test.ts` — uses setTimeout(100)
10. `src/__tests__/votePageUi.test.ts` — uses setTimeout in act

### Fix Pattern for Each File

#### Option A: Use `vi.useFakeTimers()` (Recommended)
```ts
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllTimers()
})

// In tests, replace:
await act(async () => {
  await new Promise((r) => setTimeout(r, 0))
})
// With:
await act(async () => {
  vi.advanceTimersByTimeAsync(0)
})
```

#### Option B: Proper Cleanup with real timers
```ts
afterEach(async () => {
  // Clear any pending timers
  vi.clearAllTimers()
  // Unmount React roots
  if (root) {
    await act(async () => root.unmount())
  }
  if (container) container.remove()
  // Wait for microtasks
  await Promise.resolve()
})
```

#### Option C: Return promises from async operations in tests
```ts
// Instead of:
it('test', async () => {
  setTimeout(() => { expect(true).toBe(true) }, 100)
})

// Use:
it('test', async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
  })
  expect(true).toBe(true)
})
```

### Specific Fixes per File

| File | Primary Issue | Fix Approach |
|------|---------------|--------------|
| `adminOrdersModeFilter.test.ts` | `flush()` uses 2x setTimeout, `afterEach` unmounts but timers may leak | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` in afterEach |
| `checkoutMixedSplit.test.ts` | `flush()` uses 4x setTimeout, no timer cleanup | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `checkoutModeLock.test.ts` | Same pattern | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `homePreOrderModeGuard.test.ts` | Same pattern | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `r65PickupHoursNotRounds.test.ts` | Same pattern | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `slipThumbStates.test.ts` | `flush()` uses 2x setTimeout | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `slipReviewPanel.test.ts` | `flush()` uses 2x setTimeout | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `adminPreOrdersConsolidation.test.ts` | `flush()` uses 2x setTimeout | Add `vi.useFakeTimers()` + `vi.clearAllTimers()` |
| `shopRoute.test.ts` | `setTimeout(100)` in test body | Await the promise properly, add cleanup |
| `votePageUi.test.ts` | `setTimeout` in act | Await properly, add cleanup |

---

## 3. Validation Steps

### After Each Fix
```powershell
npm run lint      # Must pass (0 errors)
npm run test      # Must pass (0 failed, 0 errors)
npm run build     # Must pass
```

### Expected Results
- **Lint**: `brandNameGuard: OK` + `languageSanity: OK`
- **Tests**: All 223 test files pass, 2287 tests pass, 0 errors
- **Build**: Exit code 0

---

## 4. Rollout Order (Low Risk → High Risk)

1. **FoodTheater.tsx** — Single file, no logic change, just encoding
2. **Test files with `vi.useFakeTimers()` pattern** — Consistent fix, low risk
3. **Run full test suite** — Verify no regressions
4. **Run build** — Verify production build works

---

## 5. Open Questions

- Any test files that intentionally test real-time behavior (e.g., `liveTrackingClient.test.ts`, `r15DeliveryLiveRefresh.test.ts`) that should NOT use fake timers?
- Should we add a global test setup (`test-setup.ts`) with `vi.useFakeTimers()` default?

---

## Plan File
Saved to: `.kilo/plans/1794281465565-fix-lint-test-failures.md`