# Plan: Fix MascotBadge override GIF not displaying (src sync regression)

## Root Cause
`MascotBadge.tsx` initializes `currentSrc` from `baseSrc` once via `useState`. When `overrideUrl` loads asynchronously (cache miss on first render), `baseSrc` updates but `currentSrc` does not — the image src never switches to the admin-set GIF URL.

Before the R207c "show static immediately" change, the component likely waited for the override to resolve before rendering the image, so the src was always correct. The regression is that `currentSrc` is not synced when `overrideUrl` becomes available after the initial render.

## Fix
Add a `useEffect` that syncs `currentSrc` to `baseSrc` whenever `overrideUrl` changes (and no error has occurred), so the override GIF URL is actually applied to the `<img src>`.

## Files to Change
- `src/components/MascotBadge.tsx`

## Changes
1. Add `useEffect` watching `[overrideUrl, baseSrc]` that calls `setCurrentSrc(baseSrc)` when `overrideUrl` becomes truthy and the current src isn't already the override URL.
2. Ensure the effect doesn't override a deliberate fallback (only sync when `currentSrc !== overrideUrl && currentSrc !== POSE_ASSETS[effectivePose].fallback`).

## Validation
- Admin sets GIF override for a pose (e.g., `ready`) in `/admin/settings?tab=mascot`
- Visit `/` (TalkToBiteHomePage) — the large mascot should show the admin GIF, not the 3D asset
- Check DevTools Network: the request goes to the Supabase GIF URL, not `/assets/mascot/bite_ready.webp`
- No fallback flash (the GIF appears on first paint after override loads)

## Out of Scope
- Supabase bucket policy / CORS (if the GIF URL returns 403, that's infra, not this bug)
- BiteMascot floating widget (separate component, has its own `overrideSettled` logic)