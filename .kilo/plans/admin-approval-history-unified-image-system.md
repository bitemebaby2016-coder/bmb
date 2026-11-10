# Admin Approval History + Unified Marketing Image System Plan

## Goal

จัดระเบียบสองหัวข้อที่ Owner ระบุว่า "มั่ว" ให้ใช้ง่ายขึ้น เป็นระบบเดียวกัน:

1. **การอนุมัติ (คิวอนุมัติ)** — แยกประวัติ (approved/rejected) ออกจากรายการรอ (pending) เป็นแท็บย่อย ตามรูปแบบ `AdminReviews.tsx` (pending/approved/rejected/all)
2. **ระบบสร้างโพสต์/โปรโมชั่น/แบนเนอร์ + ภาพ** — รวมการสร้างโพสต์ การสร้างโปรโมชั่น การสร้างแบนเนอร์ การเจนภาพ AI และการเลือกภาพขึ้นโฆษณาลอย ให้อยู่ในระบบเดียวกัน ไม่กระจัดกระจายคนละแท็บ

## Decisions (CONFIRMED by Owner)

| # | Decision | Answer |
|---|----------|--------|
| D1 | Approval history tab location | **New `approvals` tab** in `AdminMarketingPromotions.tsx` |
| D2 | Unified content creation | **New `content` tab** as single creation entry point |
| D3 | Persist approval_id to promotions | **Yes** — add `approval_id` column via migration |
| D4 | Floating ad through approval | **Yes** — floating ad images require approval before `/shop` |
| D5 | History tab actions | **Yes** — rejected → "ส่งตรวจใหม่", approved → view-only, pending → approve/reject |

## Current State (from codebase exploration)

### Problem 1: Approval history not separated
| File | Issue |
|------|-------|
| `SocialTab.tsx:87-114` | Shows ALL approvals mixed with no sub-tabs |
| `BannersTab.tsx:245-269` | Banner approvals mixed together with no sub-tabs |
| `AdminReviews.tsx:61-66` | Reference pattern — already has pending/approved/rejected/all tabs |

### Problem 2: Marketing/Promotions/Banners scattered
| Destination | Tab | Image source | Approval linkage |
|-------------|-----|-------------|------------------|
| Marketing post | `social` / `studio` | PostForm + AI album | `content_approvals` → `marketing_posts.approval_id` ✓ |
| Promotion banner | `promotions` | `PromotionsTab` upload/album | approval_id discarded ✗ |
| Floating ad artwork | `banners` / `studio` | Direct `business_settings.floating_ad_image` | No approval ✗ bypasses CNT-01 |
| Deep link | `PromotionsTab:492` | Links to `?tab=approval` | Tab doesn't exist ✗ broken |

### Problem 3: Image generation/selection scattered (3 duplicate implementations)
- Browse AI album: `AiStudioTab`, `PromotionsTab`, `BannersTab` (3×)
- Upload local image: `AiStudioTab`, `PromotionsTab`, `BannersTab` (3×)
- Select as floating ad: `AiStudioTab`, `BannersTab` (2×)

## Files Affected

| File | Role |
|------|------|
| `src/pages/admin/AdminMarketingPromotions.tsx` | Add `approvals` + `content` tabs; wire shared load/save state |
| `src/components/admin/ApprovalHistoryTab.tsx` | **NEW** — approval history with 4 sub-tabs (pending/approved/rejected/all) |
| `src/components/admin/ContentTab.tsx` | **NEW** — unified content creation (gen image + library + post/promo/banner + floating ad selection) |
| `src/components/admin/SocialTab.tsx` | Remove approval queue UI; keep scheduling/calendar only |
| `src/components/admin/BannersTab.tsx` | Remove floating ad + approval queue; keep promotion banner list only |
| `src/components/admin/AiStudioTab.tsx` | Remove post form + floating ad; keep image gen + album management only |
| `src/components/admin/PromotionsTab.tsx` | Remove image upload/browse/album; keep promotion CRUD + toggle/delete |
| `src/lib/contentApproval.ts` | Add `status` filter + pagination params to `listContentApprovals` |
| `supabase/migrations/XXX_unify_approval_linkage.sql` | Add `approval_id` to `promotions` table |
| `src/lib/bmbAdminApi_promotions.ts` | Add `approval_id` to `PromotionRow` type; upsert stores/reads it |
| `src/pages/HomePage.tsx` | Check `content_approvals` status before rendering floating ad |
| `src/components/home/FloatingAdBanners.tsx` | Filter banner promos by approval status = 'approved' |

## Tasks (in order)

### Phase 1: Approval history separation

1. **`contentApproval.ts`** — Add optional `status?: ContentApprovalStatus` and `limit` params to `listContentApprovals()`; add `reviewer_id`/`reviewed_at`/`review_note` fields to `ContentApprovalRow` (if columns exist) or keep optional
2. **`ApprovalHistoryTab.tsx`** (NEW) — Create tab with:
   - 4 sub-tabs: pending / approved / rejected / all (model after `AdminReviews.tsx` lines 61-66)
   - Per-item: title, body, status badge, created_at, image preview, reviewer actions
   - Pending: approve/reject buttons
   - Rejected: "ส่งตรวจใหม่" button (re-submits via `submitContentForApproval` with same content_type/title/body/image_url)
   - Approved: view details only
3. **`AdminMarketingPromotions.tsx`** — Add `approvals` to TABS array + render `ApprovalHistoryTab`
4. **`SocialTab.tsx`** — Remove `Approval Queue` card; keep `Calendar / Scheduling` card only. Props: remove `approvals`/`setApprovals`, keep `posts`/`setPosts`/`load`

### Phase 2: Unified content creation system

5. **`ContentTab.tsx`** (NEW) — Single unified creation UI:
   - Image generation section (moved from `AiStudioTab`): kind/style/subject/note/generate button + result preview
   - Image library section (shared `listAiAlbumFiles`): grid with pick/use/toggle/delete per image
   - Content type selector: post / promotion / banner / announcement
   - Conditional fields:
     - Post: title, body
     - Promotion: name, code, discount_type, discount_value, min_order_amount, dates, scope
     - Banner: banner_image selector (album/upload/external URL), banner_mascot selector
   - "Set as floating ad" checkbox per image/item → writes to `content_approvals` with `content_type: 'banner'`
   - Single "สร้างและส่งตรวจ" button → calls `submitContentForApproval`, then:
     - For promotion: save promotion row + link approval_id (Phase 3)
     - For banner: save to content_approvals only
     - For post: create marketing_post linked to approval_id
6. **`AdminMarketingPromotions.tsx`** — Add `content` to TABS array + render `ContentTab`
7. **`AiStudioTab.tsx`** — Remove: post form (`PostForm`), floating ad toggle, floating ad state. Keep: image generation, album management (list/display/toggle/delete), browse local image
8. **`PromotionsTab.tsx`** — Remove: image upload (`handleUploadBanner`), album browse (`handleBrowseAlbum`/`pickFromAlbum`), mascot upload/album, compose preview. Keep: promotion CRUD (save/toggle/delete), form fields (name/code/discount/dates/scope), promotion list
9. **`BannersTab.tsx`** — Remove: floating ad section, approval queue, image upload/album. Keep: promotion banner list (is_banner=true items) with status badge showing approval status

### Phase 3: Approval linkage migration

10. **Migration `XXX_unify_approval_linkage.sql`** — Add `approval_id` column (references `content_approvals.id`) to `promotions` table
11. **`bmbAdminApi_promotions.ts`** — Add `approval_id?: string | null` to `PromotionRow` type; upsert stores `approval_id`
12. **`PromotionsTab.handleSave()`** — Persist approval_id returned from `submitContentForApproval('banner')` into the promotion row
13. **`BannersTab` banner list** — Show approval status per banner (linked via approval_id → content_approvals.status)

### Phase 4: Floating ad through approval

14. **`HomePage.tsx`** — Before rendering `<FloatingAdBanners>`, check `business_settings.floating_ad_enabled` AND that the referenced floating_ad_image has an approved `content_approvals` entry
15. **`FloatingAdBanners.tsx`** — Filter banner promos: only include those where linked `content_approvals.status === 'approved'`
16. **`ContentTab.tsx`** — Floating ad selection flow: user picks image → system creates `content_approvals` row with `content_type: 'banner'` → `floating_ad_image` only set when approval status = 'approved'

## Validation

1. **TypeScript**: `npx tsc --noEmit` passes
2. **Lint**: `npm run lint` passes (0 errors)
3. **Build**: `npm run build` passes
4. **Tests**: All existing tests pass; no test regressions
5. **Manual verification**:
   - `/admin/marketing-promotions?tab=approvals` — 4 sub-tabs work (pending/approved/rejected/all), rejected items have "ส่งตรวจใหม่"
   - `/admin/marketing-promotions?tab=content` — unified creation end-to-end: generate image → select type → fill form → submit → approval row created
   - Image from ContentTab can be selected as floating ad → goes through approval before showing on `/shop`
   - Promotion created in ContentTab persists `approval_id` → visible in BannersTab banner list status
   - Floating ad on `/shop` only shows approved content

## Out of Scope

- Marketing "events" (กิจกรรม) as separate content type — no existing `content_type: 'event'`; `announcement` covers this
- Legacy page cleanup (`AdminMarketing.tsx`, old routes) — already redirected in `App.tsx`
- `media_assets` table unification — separate from content_approvals
