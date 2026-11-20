# Plan: Fix Theater Duplication & Dark Theme Close Button Issues

## Summary
The user reported two issues:
1. **Duplicate theater section before promotion** – The "Bite's Daily Picks" section (home-sec-bite-picks) appears at the section before promotions in HomePage.tsx and duplicates the Food Theater content.
2. **Dark theme close buttons invisible** – `.flad-close` (in FloatingAdBanners) and `.ob-close` (in OrderBuilderModal) use hardcoded light-mode colors (`#1C1917` on dark background) that are invisible in dark mode. Some text also may be low contrast.

## Tasks

### P0-C-048: Remove duplicate "Bite's Daily Picks" theater section before promotions
**Files**: `src/pages/HomePage.tsx`
**Steps**:
1. Identify the duplicate section `home-sec-bite-picks` (lines 595–613).
2. Delete this section entirely (including its `<section>` and all children) while preserving any other sections.
3. Verify that the UI still scrolls correctly (no orphaned scroll target `home-sec-bite-picks` left).
**Result**: Only one theater surface exists — the main FoodTheater stage at the top of `/shop`.

### P0-C-049: Dark theme overrides for close buttons and card text
**Files**: `src/index.css`
**Steps**:
1. Add dark-mode overrides for `.flad-close`:
   - Background: `rgba(255, 255, 255, 0.15)`
   - Color: `#F5F5F5` or `#fff`
   - Hover: keep existing `rgba(239,68,68,0.85)` and `color: #fff`
2. Add dark-mode overrides for `.ob-close` (same values).
3. Add dark-mode overrides for `.review-album-panel` and `.review-album-head` (set background to `var(--color-brand-surface)`) – prevents mismatch between panel and backdrop.
4. Add dark-mode overrides for `.flad-title` (already uses `var(--color-brand-accent)` and should be fine) and `.flad-notice` (adjust contrast if needed: change `color: #B45309` to `#FF7F47` or similar).
5. (Optional) Add dark-mode overrides for `.review-gallery-close` (already white, fine).
**Result**: Close buttons are visible in dark mode, and all card text meets WCAG contrast against dark backgrounds.

### P0-C-050: Verify and test
**Steps**:
1. Run lint and typecheck locally (if available) to ensure no syntax errors.
2. Quick manual check: Open `/shop` in light theme, verify Food Theater works and the duplicate section is gone.
3. In dark theme (toggle via `html[data-theme='dark']`), verify:
   - Floating ad banners have visible ✕ close button.
   - Order builder modal has visible ✕ close button.
  /(-review-album-modal? (not in use) check if needed)
4. Verify no regression in other sections.

## Risks & Assumptions
- **Risk**: Removing `home-sec-bite-picks` may break external references (e.g., scrollToSection). But this section is likely internal-only; scroll functions target by ID. If removed, scroll target will be missing; but scrollToSection fallback (Owner 2026-10-26 L-3) handles missing target.
- **Risk**: Hardcoded colors in close buttons; dark-mode overrides must be added.
- **Assumption**: The close button issue is only `.flad-close` and `.ob-close`. Other buttons like `.review-gallery-close` are already fine.

## Validation Plan
- Lint: `npm run lint` (should pass)
- Typecheck: `npm run typecheck` (should pass)
- No failing tests reported for these areas.
- Quick visual review on both themes.

## Acceptance Criteria
- ✅ Duplicate theater section removed from HomePage.
- ✅ Close buttons visible in dark theme.
- ✅ Text readability acceptable in dark theme.
- ✅ All existing tests pass.