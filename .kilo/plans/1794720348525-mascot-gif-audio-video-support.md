# Plan: Mascot GIF Support + Audio/Video Media Library Support

## Problem Analysis

### Current State
1. **Mascot GIF Upload**: 
   - File inputs use `accept="image/*"` (includes GIF)
   - `uploadMediaAsset` → `compressToWebLimits` returns GIF as-is (line 205)
   - No `validateImageFile` call in `uploadMediaAsset` (only in `uploadRegisteredAsset`/`uploadProductImage`)
   - `MascotBadge` uses `<img>` tag → supports GIF animation
   - `MascotSettingsPage` accepts Media URL from Media Library

2. **Media Library (AdminMedia/AdminMediaPortfolio)**:
   - Accepts `image/*,video/mp4` only
   - `MEDIA_KINDS = ['image', 'video', 'logo', 'hero', 'mascot']` — no 'audio'
   - `validateImageFile` only validates images (JPEG/PNG/WebP/GIF, 5MB)
   - Preview uses `<img>` or CSS `background-image` — image only

3. **Runtime Consumers** (all image-only):
   - `BackgroundLayer` → CSS `background-image`
   - `BrandProvider` → favicon/logo `<link>`
   - `TalkToBite` → chat background CSS
   - `MascotBadge` → `<img>` tag

### Issues to Fix
1. **Mascot GIF**: Large GIFs may fail upload (no size validation in `uploadMediaAsset`)
2. **Audio Support**: Missing from Media Library (kind, validation, upload, preview)
3. **Video Support**: Limited to mp4 only, no broader `video/*` support
4. **Display**: Admin media preview needs to handle audio/video appropriately

## Implementation Plan

### Phase 1: Mascot GIF Upload Fix (bmbAdminApi_media.ts)
- [ ] Add `validateMediaFile` function that handles image/gif/video/audio with appropriate limits
- [ ] Update `uploadMediaAsset` to call validation before upload
- [ ] Increase size limit for GIF (animated GIFs can be larger than 5MB)
- [ ] Keep `compressToWebLimits` returning GIF as-is (preserves animation)

### Phase 2: Add Audio Support to Media Library
- [ ] Add `'audio'` to `MEDIA_KINDS` array
- [ ] Add `AUDIO_MIME_WHITELIST` and `MAX_AUDIO_BYTES` constants
- [ ] Add `validateAudioFile` function
- [ ] Add `validateMediaFile` dispatcher (routes to image/audio/video validation)
- [ ] Update `KIND_LABEL` in AdminMedia/AdminMediaPortfolio to include 'audio'
- [ ] Update file inputs to accept `audio/*` and `video/*` (not just mp4)

### Phase 3: Admin Media Library UI Updates
- [ ] AdminMedia.tsx: Update kind selector, file input accept, preview rendering
- [ ] AdminMediaPortfolio.tsx: Same updates
- [ ] Preview: Use `<audio controls>` for audio, `<video controls>` for video, `<img>` for images

### Phase 4: Mascot Upload Forms (ContentTab.tsx, AdminPromotions.tsx)
- [ ] Keep `accept="image/*"` (includes GIF) — no change needed
- [ ] Ensure uploaded GIF URL works in MascotBadge and FloatingAdBanners

### Phase 5: Testing & Validation
- [ ] Verify mascot GIF upload works end-to-end
- [ ] Verify audio upload works in AdminMedia
- [ ] Verify video upload accepts more formats
- [ ] Verify previews render correctly for all types
- [ ] Run existing tests to ensure no regressions

## Files to Modify

1. `src/lib/bmbAdminApi_media.ts` — Core media handling (validation, kinds, upload)
2. `src/pages/admin/AdminMedia.tsx` — Admin media library UI
3. `src/pages/admin/AdminMediaPortfolio.tsx` — Admin media portfolio UI
4. `src/components/admin/ContentTab.tsx` — Mascot upload in content creation (verify only)
5. `src/pages/admin/AdminPromotions.tsx` — Mascot upload in promotions (verify only)

## Risk Mitigation
- **Backward Compatibility**: All existing image uploads continue working
- **Validation**: New validation only adds audio/video, doesn't change image validation
- **Storage**: Uses same bucket (`bmb-images`), no schema changes to `media_assets`
- **Runtime Consumers**: Unchanged (they only use image assets via `asset_key`)

## Acceptance Criteria
1. Admin can upload GIF mascot (>5MB animated GIF) → displays correctly in MascotBadge and FloatingAdBanners
2. Admin can upload audio files (mp3, wav, ogg) in AdminMedia → appears in library with audio player preview
3. Admin can upload video files (mp4, webm, mov) in AdminMedia → appears in library with video player preview
4. All existing tests pass
5. No regression in image upload/display