# Plan: Upgrade Food-Menu Image Generation Pipeline (Studio)

## Context
Existing pipeline (do NOT build a parallel system — extend these):
- `supabase/functions/image-gen/index.ts` — EF: builds prompt from `KIND_PRESETS[kind](subject,note)` + `STYLE_MODIFIERS[style]`, calls OpenRouter (images API → chat fallback), uploads to `bmb-images/ai-generated/<kind>/`, returns public URL.
- `src/lib/aiImageStudio.ts` — single source for client post-steps: `compressGeneratedToWeb()` (Canvas webp ≤300KB), `applyBrandWatermark()` (logo pill + mascot), `checkGenQuality()`.
- `src/lib/bmbAdminApi_media.ts` — `compressToWebLimits()`, `listAiAlbumFiles()`.
- UI: `src/components/admin/ContentTab.tsx` (form "✨ สร้างภาพ" + `genStatus`) and `src/pages/admin/AdminMarketing.tsx` (tab `studio`, the main menu page Owner uses — R129).
- Storage/DB: bucket `bmb-images`, folder `ai-generated/<kind>/`; URL kept in post `image_urls`; generated images are NOT auto-attached (admin presses "ใช้" from album) — preserve this rule.

Current gaps vs new spec: no segmentation/BG-removal, no trim/alpha-webp, no JSON payload, presets wrongly say "ร้านของหวาน", watermark always drawn even when mascot=none.

## Decisions (confirmed with Owner)
1. **BG removal = external API `BEN2` (primary)**; if BEN2 not configured/fails → **fallback = admin manual cutout** (keep white-bg image, mark status). Actual BEN2 endpoint/key wiring = **TODO** (env-configurable, clean integration point). No heavy client ML dependency.
2. **Standard output = 1024×1024 + equal margin**, transparent, webp quality ~0.85, target ≤500KB.
3. Reuse existing Canvas client processing; BEN2 call must be server-side (needs secret).
4. Preserve existing album + manual "ใช้" flow (no auto-attach, no new migration unless URL persistence requires it — avoid).

## Iron rules to encode (System Prompt, studio/menu only)
- Geometry Lock: lock camera angle + aspect ratio to the reference/original; Zero Hallucination (no invented items).
- Pure white background `#FFFFFF`; 45° studio lighting; `100mm macro look, tack-sharp focus`; no extra props.
- Never generate a logo; never render "Bite Me Baby" as a dessert shop — infer product type from the menu name.
- Watermark/logo must use system logo `/Logo_Sticker_Circle.webp` (never generated).
- If mascot = none → NO watermark at all (no logo pill, no text).

## JSON payload (client → EF)
Extend `handleGenerateImage` body and EF `body` type with: `menu_name`, `category`, `container_type`, `texture_keywords[]` (auto-matched by category). Mapping table (client helper in `aiImageStudio.ts`):
- ของทอด (fried): crispy, golden, crunchy · container: จานกระเบื้อง/ตะกร้า
- เครื่องดื่มเย็น (cold drink): frosty, condensation, refreshing · container: แก้วใส/หลอด
- เบเกอรี่ (bakery): flaky, buttery, soft crumb · container: จานพาสเทล/กระดาษไขมัน
- สลัด (salad): fresh, crisp greens, vibrant · container: ชามพาสเทล
- ข้าวหน้าต่างๆ (rice dishes): fluffy rice, glossy, steam · container: จานร้อน/ชาม
- default: appetizing, fresh, detailed · container: จานเดี่ยว
EF consumes these to enrich the prompt (replaces free-form `note` for studio where appropriate, but keep `note` as extra).

## Ordered tasks (atomic, one file/function at a time)
1. **`src/lib/aiImageStudio.ts`** — add `buildStudioPayload(kind, subject, note)` returning `{menu_name, category, container_type, texture_keywords}` via category map; export `DEFAULT_PAD_SIZE=1024`, `WEBP_QUALITY=0.85`, `WEBP_MAX_BYTES=500*1024`.
2. **`src/lib/aiImageStudio.ts`** — add `trimTransparent(bmp)` (scan alpha bbox, crop), `resizeAndPad(bmp, size, margin)` (center on transparent 1024 canvas), `toAlphaWebp(file)` (quality 0.85, loop down to ≤500KB). Compose new `finalizeStudioImage(transparentUrl)` = fetch → trim → resize/pad → webp → upload overwrite to `ai-generated/studio/` → return URL. Reuse `compressGeneratedToWeb` internals.
3. **`src/lib/aiImageStudio.ts`** — change `applyBrandWatermark`: if `mascotChoice==='none'` return `srcUrl` unchanged (no logo/text). Keep system logo only.
4. **`supabase/functions/image-gen/index.ts`** — add `SYSTEM_RULES` constant (iron rules above); send as `{role:'system'}` in chat path AND prepend to prompt for images-API path (studio/menu only). Remove "ร้านของหวาน" from all presets; add "ห้ามเจนโลโก้; สรุปประเภทจากชื่อเมนู".
5. **`supabase/functions/image-gen/index.ts`** — accept new body fields; add `removeBackground` step: if `kind==='studio'` and BEN2 configured (`BEN2_API_KEY`/`BEN2_ENDPOINT` env, TODO) → POST image, get transparent PNG, upload to `ai-generated/studio/`, return `url` (transparent) + `bg_removed:true`; on any failure/not-configured → return white-bg `url` + `bg_removed:false` + `fallback:'manual'` (admin cuts). Never block generation.
6. **`src/components/admin/ContentTab.tsx`** — add "รายละเอียดเพิ่มเติมสำหรับสร้างภาพ" textarea above the generate button, shown only when `genKind==='studio'`; wire into `handleGenerateImage` via `buildStudioPayload`. Extend `genStatus` with sub-phase text (กำลังลบพื้นหลัง/ตัดขอบ/แปลง webp) using existing status box; after EF returns, if `bg_removed` call `finalizeStudioImage` then `applyBrandWatermark`.
7. **`src/pages/admin/AdminMarketing.tsx`** — mirror task 6 in the `studio` tab (same helper, same status), no layout rebuild; reuse existing `genStatus`/`handleGenerateImage`.
8. **Tests** — update contract tests that assert preset/prompt text (`r34Contracts`, `r39Contracts`, `r41Contracts`, `r47AiStudio`, `r61Contracts`, `marketingClient`) to match new rules WITHOUT weakening; add unit tests for `buildStudioPayload`, `trimTransparent`/`resizeAndPad` (via jsdom canvas mock or pure geometry), and watermark `none` = no-op. Do not skip/disable.
9. **Docs sync** (Protocol §0.3): update `docs/BMB_MASTER_STATUS.md`, `BMB_WORK_QUEUE.md`, `BMB_CHANGELOG.md`, `BMB_AI_WORKING_STATE.md` (architecture change) after verification. No PRODUCT_SPEC change without Owner approval.

## Risks / notes
- Canvas `toBlob('image/webp', q)` has no separate `alphaQuality` (sharp concept) → approximate with single quality 0.85; note in code comment. If BEN2 returns webp, re-encode once.
- White-threshold not used (per decision) → no risk of eating white food, but manual fallback depends on admin.
- BEN2 secret/endpoint unknown → clean TODO + env fallback; generation must still succeed with white bg.
- EF `images/generations` path has no system role → prepend rules into prompt string there.
- Keep `verify_jwt`+isAdmin guard untouched (security).

## Validation
- `npx tsc --noEmit`, `npm run lint`, `npm test` (vitest run), `npm run build`.
- E2E smoke (reuse `e2e/_r129ImageGenStudioSmoke.cjs` pattern): kind=studio → expect `bg_removed` true (if BEN2 set) or `fallback:manual` (if not) + 1024×1024 webp ≤500KB in `ai-generated/studio/`; cleanup test file after (Rule 16.1).
- Manual: `/admin/marketing` → Studio → extra prompt box visible only for studio → generate → status shows BG/trim/webp phases → album has transparent webp; mascot=none yields no watermark.

## Open items (TODO, non-blocking)
- BEN2 API endpoint + auth secret name (recommend `BEN2_API_KEY`, `BEN2_ENDPOINT`) and request/response contract.
- Confirm whether final studio URL should ever auto-write to a menu row (current: no; keep manual "ใช้").