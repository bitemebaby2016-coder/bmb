# Fix Plan: §T-A Cart Retry + Duplicate Banner + AI Menu Name

## Current Status (2026-11-11) — User Reports Still Broken After Deploy

**User feedback**: "ไม่หายทั้งคู่เลย" (both issues persist) + "กดเปิดโดยโครมก็ยังไม่มีสินค้าในตะกร้า" (even Chrome has empty cart)

### What Was Done (Code Changes Committed)
- ✅ Removed `InAppBrowserNotice` import + usage from `Layout.tsx`
- ✅ Moved `?cart=` stripping to AFTER successful cart restoration (Layout.tsx lines 108-114)
- ✅ Updated `r46LinkOut.test.ts` to test new `InAppBrowserBanner` in `App.tsx`
- ✅ All local tests pass (`npm run lint`, `npm run build`, `npm run test`)

### What's Still Broken (Per User)
1. **Duplicate Banner**: Still seeing two banners (old + new)
2. **§T-A Cart Empty in Chrome**: Even when opening via "เปิดใน Chrome", cart is empty

---

## Root Cause Analysis (New Findings)

### Issue 1: Duplicate Banner — Possible Causes
| Cause | Evidence | Check |
|-------|----------|-------|
| **Service Worker caching old JS** | PWA uses `vite-plugin-pwa` with `injectManifest`; SW caches `index-CgvPWEJO.js` | Need to verify deployed version vs local build |
| **Old `InAppBrowserNotice` still rendered somewhere** | User says "ทั้งคู่" (both) — implies old banner + new banner both visible | Search codebase for other usages |
| **Facebook in-app browser cache** | FB WebView aggressively caches pages | Hard refresh / clear FB cache needed |

### Issue 2: §T-A Cart Empty in Chrome — Possible Causes
| Cause | Evidence | Check |
|-------|----------|-------|
| **Intent URL missing `browser_fallback_url`** | Old `InAppBrowserNotice` had `s.browser_fallback_url=${encodeURIComponent(href)}`; new `InAppBrowserBanner` doesn't | Chrome may fail to open intent without fallback |
| **Cart restoration failing silently** | `decodeCartParam` → catalog fetch → `addItem`; any step can fail without visible error if `added === 0` | Need logging / toast on failure paths |
| **Race: Layout strips URL before user clicks** | `InAppBrowserBanner` captures `currentUrl` at render (line 13); if restoration is fast, URL stripped before click | But fix moved strip to AFTER `added > 0` — should be OK unless restoration fails |
| **Product IDs in cart don't match current catalog** | Social post cart encoded with old product IDs; catalog changed | Check `decodeCartParam` output vs `getProducts()` |
| **Deployed version doesn't have the fix** | CI passed but deployment might be stale | Verify deployed build hash |

---

## Investigation Plan

### Step 1: Verify Deployed Version
- Check Cloudflare Pages / hosting dashboard for latest build commit hash
- Compare with local `git log --oneline -1`
- Force cache clear + redeploy if needed

### Step 2: Search for Residual `InAppBrowserNotice` Usage
```bash
grep -r "InAppBrowserNotice" src/ --include="*.tsx"
```
- Should only exist in deprecated file `src/components/layout/InAppBrowserNotice.tsx`

### Step 3: Fix Intent URL in `InAppBrowserBanner` (Critical for §T-A)
**File**: `src/components/InAppBrowserBanner.tsx`
- Add `s.browser_fallback_url` to intent URL (matching old `externalBrowserIntentUrl` helper)
- This ensures Chrome has a fallback if intent scheme fails

```typescript
const intentUrl = isAndroid
  ? `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
  : null;
```

### Step 4: Add Debug Logging to Cart Restoration (Layout.tsx)
- Add `console.log` / toast at each stage: decode, catalog fetch, item matching, addItem result
- Helps diagnose why cart is empty in Chrome

### Step 5: Verify Cart Restoration Flow End-to-End
- Test with a known-good `?cart=<b64>` parameter
- Check `decodeCartParam` output
- Check `getProducts()` returns expected IDs
- Check `addItem` returns `'added'`

---

## Implementation Tasks (Priority Order)

### Task 1: Fix Intent URL — Add `browser_fallback_url` (High Priority)
**File**: `src/components/InAppBrowserBanner.tsx` line 16-18
```typescript
const intentUrl = isAndroid
  ? `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
  : null;
```
**Why**: Without fallback URL, Chrome may not open the link at all, or may open a blank page.

### Task 2: Search & Remove Any Residual `InAppBrowserNotice` (High Priority)
**Command**: `grep -r "InAppBrowserNotice" src/ --include="*.tsx"`
**Action**: Remove any remaining imports/usages outside the deprecated file.

### Task 3: Add Diagnostic Toast/Logging to Cart Restoration (Medium Priority)
**File**: `src/components/layout/Layout.tsx` in the `runAdd` function
- Toast on decode failure (already exists)
- Toast on catalog fetch failure
- Toast on zero items matched (already exists)
- Toast on `addItem` returning non-'added' (new)

### Task 4: Force Clean Redeploy (High Priority)
- Clear hosting cache (Cloudflare Pages: "Retry deployment" + "Clear build cache")
- Verify service worker updates (PWA `skipWaiting` + `clients.claim`)

### Task 5: Test §T-A Flow Manually (Validation)
1. Generate valid `?cart=<b64>` link
2. Open in FB WebView
3. Click "เปิดใน Chrome"
4. Verify cart has items in external Chrome
5. Check only ONE banner (orange top banner)

---

## Risk Assessment

| Task | Risk | Mitigation |
|------|------|------------|
| Fix intent URL | Low — adds fallback parameter only | Test on Android Chrome |
| Remove residual imports | Low — only removes dead code | Grep first to confirm |
| Add diagnostic toasts | Low — only adds visibility | Remove after debug |
| Force redeploy | Medium — cache issues | Verify commit hash in build log |

---

## Validation Checklist

- [ ] Only ONE banner (orange "กำลังเปิดใน Facebook") in FB WebView
- [ ] Click "เปิดใน Chrome" → Chrome opens with cart items
- [ ] Cart items persist after navigation
- [ ] No console errors in Chrome DevTools
- [ ] Service worker updated (check Application tab)

---

## Next Steps

1. **Immediate**: Implement Task 1 (intent URL fix) + Task 2 (grep residual)
2. **Deploy**: Force clean redeploy with cache clear
3. **Test**: Manual §T-A flow test in FB WebView → Chrome
4. **Iterate**: If still broken, add Task 3 diagnostics and redeploy

The most likely culprit for §T-A is **missing `browser_fallback_url` in intent URL** — Chrome may silently fail to navigate without it.