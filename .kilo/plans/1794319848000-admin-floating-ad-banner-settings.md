# Admin Floating Ad & Promotion Banner Settings Plan

## Goal

ทำให้หน้าแอดมินตั้งค่า **โฆษณาลอย (Floating Ad)** และ **แบนเนอร์โปรโมชั่น** ได้ครบถ้วน:
- เลือก/อัปโหลด/เปลี่ยนรูปได้จากหน้านี้ (จาก Supabase storage และจากเครื่อง/ลิงก์ภายนอก)
- มีสวิทซ์เปิด/ปิดสำหรับโฆษณาลอย
- แสดงได้สูงสุด 3 อัน (ข่าวสาร / แบนเนอร์ / โปรโมชั่น / กิจกรรม)
- ลิงก์จริง + ส่วนลดจริงใช้งานได้ถูกต้อง
- ปุ่มอนุมัติ/ปฏิเสธแบนเนอร์ในคิว CNT-01 ใช้งานจริง (ไม่ใช่ stub)

## Files Affected

| File | Role |
|------|------|
| `src/components/home/FloatingAdBanners.tsx` | Floating ad overlay on `/shop` — add enable switch check, increase max cards 2→3, ensure real href links |
| `src/pages/HomePage.tsx` | Check `floating_ad_enabled` before rendering; pass proper coupon href to banner promos |
| `src/components/admin/BannersTab.tsx` | Admin tab — add image upload/browse for floating ad, wire up approve/reject buttons, wire up `onBannerChange` |
| `src/pages/admin/AdminSettings.tsx` | Add `floating_ad_enabled` to `TYPED_FORM_KEYS`, add ToggleSwitch panel |
| `src/lib/bmbAdminApi_settings.ts` | (Optional) Add typed accessor helpers if needed |

## Background / Current State (from codebase exploration)

- `FloatingAdBanners.tsx` (line 28 imported in HomePage) already renders max **2** overlay cards on `/shop`, merged from announcements (`marketing_feed_posts` RPC) + promotions (`is_banner=true`). Each card has ✕ close, per-promo sessionStorage dismiss (D03), image precedence: promo-specific → `floating_ad_image` → album → mascot fallback. **No on/off switch exists.**
- `BannersTab.tsx` (`/admin/marketing-promotions?tab=banners`) shows floating ad image + removal button only (no upload), promotion banners list, and banner approval queue with **stub** approve/reject buttons (empty callbacks). `onBannerChange` is a `console.log` stub.
- `PromotionsTab.tsx` already has full CRUD: `is_banner` flag, local upload, AI album selection, mascot selection, content approval submission via `submitContentForApproval('banner', ...)`, compose preview.
- `SettingsTab.tsx` manages marketing rules + G&R panels (budget, referral, loyalty, spin, affiliate, rewards) — **no floating ad settings yet.**
- `AdminSettings.tsx` is the settings hub with `TYPED_FORM_KEYS` and `ToggleSwitch` panels for `master_open`, `cod_enabled`, `crm_automation`, `promotion_policy`.
- `contentApproval.ts` provides `reviewContent(id, 'approved'\|'rejected', note)` RPC — already used by `SocialTab.tsx` for post approvals.
- `HomePage.tsx` line 468 renders `<FloatingAdBanners promos={bannerPromos} notice={siteCopy.adNotice} />`. `bannerPromos` filtered by `is_banner===true`, `is_active!==false`, Thai date range. **No kill-switch check.**

## Tasks (in order)

### 1. Add `floating_ad_enabled` setting + kill-switch check
- Add `'floating_ad_enabled'` to `TYPED_FORM_KEYS` in `AdminSettings.tsx`
- Add a ToggleSwitch panel (after `promotion_policy`) labeled "โฆษณาลอย (Floating Ad)" with description "ปิด = ซ่อนโฆษณาลอยทั้งหมดจากหน้าแรก · เปิด = แสดงตามที่ตั้งค่าไว้"
- In `HomePage.tsx`: read `settings?.floating_ad_enabled` alongside `store_master_open`; **skip rendering `FloatingAdBanners`** when `floating_ad_enabled === false` or `masterOpen === false`
- In `FloatingAdBanners.tsx`: read `business_settings.floating_ad_enabled`; return null when disabled

### 2. Increase max visible cards from 2 → 3
- In `FloatingAdBanners.tsx`: change all `slice(0, 2)` to `slice(0, 3)` for announcements and visible promos
- Verify interleaved merge (`feedPosts.flatMap(...visiblePromos[i]...).slice(0, 3)`) keeps announcement-first ordering

### 3. Real links + real discount on banner cards
- In `HomePage.tsx`: map `bannerPromos` entries to include `href` — point to `/menu?coupon=<code>` when `coupon` exists, else `/menu`
- In `FloatingAdBanners.tsx`: render card `<a href={promo.href || '#'}>` — ensure CTA button uses real href
- Verify discount applies at checkout via existing `promotions.code` flow (already implemented in order builder — no new code needed, just ensure banner click carries the coupon)

### 4. Image upload/browse for floating ad in BannersTab
- Add local file upload (`<input type="file" accept="image/*">`) using existing `uploadMediaAsset` from `@/lib/bmbAdminApi_media` (same pattern as `PromotionsTab.handleUploadBanner`)
- Add "เลือกจากคลังภาพ AI" button using existing `listAiAlbumFiles` (same pattern as `PromotionsTab.handleBrowseAlbum` / `pickFromAlbum`)
- Show current `floating_ad_image` preview with remove button (already exists)
- Call `setBusinessSetting('floating_ad_image', url)` on save
- Reuse `onBannerChange` callback to notify parent `AdminMarketingPromotions` of changes

### 5. Wire up banner approval queue (CNT-01) in BannersTab
- Replace stub approve/reject buttons with real calls to `reviewContent(id, 'approved')` / `reviewContent(id, 'rejected', note)` from `@/lib/contentApproval`
- On success: refresh approvals list via `listContentApprovals()`, show toast
- On reject: prompt for reason note (same pattern as `SocialTab.handleReject`)
- Add `data-testid` attributes for testability

### 6. Wire up `onBannerChange` callback
- In `AdminMarketingPromotions.tsx`: implement `handleBannerChange` to refresh banners/promotions state instead of `console.log`
- Pass through to `BannersTab` and `PromotionsTab` (already wired, just needs real implementation)

## Validation Steps

1. **TypeScript**: `npx tsc --noEmit` must pass
2. **Lint**: `npm run lint` must pass (0 errors)
3. **Build**: `npm run build` must pass
4. **Manual verification**:
   - Open `/admin/settings` → floating ad ToggleSwitch appears and saves
   - Open `/admin/marketing-promotions?tab=banners` → can upload image, browse AI album, approve/reject banner
   - Open `/shop` → floating ad shows up to 3 cards; toggle off hides all; links carry coupon code to `/menu`
   - Toggle floating ad OFF in settings → `/shop` shows no floating ad cards

## Open Questions / Out of Scope

- **Marketing events**: User mentioned "กิจกรรม" (events) as one of 3 ad types. Current code has `content_type: 'announcement'` for announcements and `is_banner` for promotions. No separate "event" type exists. **Out of scope** unless user clarifies event post type.
- **External image links**: User said "ลิงก์ภายนอก" (external links). Already supported via URL input field in PromotionsTab; will add to BannersTab floating ad section.
- **Test files**: No new tests required for this plan. Existing tests must not regress.

## Plan File

Saved to: `.kilo/plans/1794319848000-admin-floating-ad-banner-settings.md`
