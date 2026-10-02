# BMB SOCIAL AI — ASSET INVENTORY (AUDIT ARTIFACT ONLY)

Gate: S0.1 → Next Gate (Phase A) · Date: 2026-10-02 · Mode: AUDIT ONLY — no assets created, no code changed.

Evidence hierarchy applied: actual files in `public/` and `src/assets/` were listed by command; consumers verified by grep of real imports/URL references. **Nothing below is assumed from the original proposal.**

## Existing asset structure (verified by filesystem listing)

```
public/
  favicon.svg, og-image.png, pwa-192x192.png, pwa-512x512.png, manifest.json,
  robots.txt, sitemap.xml, _headers
  Facebook Logo.webp, Grab Food Logo.webp, Head Logo.webp, Logo_Sticker_Circle.webp,
  Star.webp, icon_chat.webp, icon Profile.webp, icon_Nav_bar_chat.webp, icon_Quick_chat.webp
  bite-mascot.svg, mascot_Bite_{Main,Thinking,Waiting,Welcome,Good bye}.webp, icons.svg
  assets/mascot/*.webp        (18 mascot pose/state images)
  assets/Qr Code/BMB_Promptpay_Qr.webp
  assets/reviews/*.jpg        (38 review screenshots) + assets/reviews/small/review-01..37.jpg
  images/{drinks,snacks}/*.svg (5 drink + 5 snack SVG icons)
  images/{pre-order,same day}/ (directories present — NO FILES observed inside)
  fonts/ (Nunito + Quicksand woff2 + fonts.css)
src/assets/
  hero.png, typescript.svg, vite.svg
  images/  (EMPTY directory)
  logo/    (EMPTY directory)
```

## Asset inventory table

| Asset | Required? | Used By | Actual Consumer | Format | Dimensions | Max Size | Storage Location | Current Source | Runtime Verified | Owner Action |
|---|---|---|---|---|---|---|---|---|---|---|
| Facebook comment auto-reply | - | - | - | text (no image) | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | - | Meta comment object | - | None (text-only reply; no asset needed) |
| Messenger private reply image attachment | OPTIONAL | - | - | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | - | - | - | Decide if replies ever attach images |
| Auto-Post image | REQUIRED (future Auto-Post) | future auto_post worker | - | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | Storage bmb-images (canonical per AdminProducts.tsx:56-57) | media_assets / product images | UNVERIFIED (DB shape not readable) | Decide source of post images |
| Product images (canonical) | EXISTS | AdminProducts, catalog | uploadProductImage -> Storage -> media_assets -> products.image_url | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | Storage bmb-images | Admin upload | UNVERIFIED (DB deployment) | None |
| Static catalog icons (drinks/snacks) | EXISTS + CONNECTED | catalog UI | /images/drinks/*.svg, /images/snacks/*.svg | SVG | NOT SPECIFIED BY CURRENT IMPLEMENTATION | small | public/images/ | repo | BUILD VERIFIED | None |
| Review screenshots | EXISTS + CONNECTED | homepage reviews | /assets/reviews/small/review-*.jpg | JPG | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | public/assets/reviews/ | repo | BUILD VERIFIED | None |
| Mascot images (18 poses) | EXISTS + CONNECTED | UI mascot system | MascotBadge.tsx (/assets/mascot/*.webp + fallbacks /mascot_*.webp) | WEBP | NOT SPECIFIED BY CURRENT IMPLEMENTATION | NOT SPECIFIED BY CURRENT IMPLEMENTATION | public/assets/mascot/ + public/ | repo | BUILD VERIFIED | None |
| Facebook Logo.webp | EXISTS + CONNECTED | review source badge | CustomerReviewCard.tsx:30 | WEBP | NOT SPECIFIED BY CURRENT IMPLEMENTATION | small | public/ | repo | BUILD VERIFIED | None |
| Logo_Sticker_Circle.webp | EXISTS | brand identity | NOT CONNECTED to Social AI | WEBP | NOT SPECIFIED BY CURRENT IMPLEMENTATION | small | public/ | repo | - | Only if Auto-Post branding needs it |
| PromptPay QR (BMB_Promptpay_Qr.webp) | EXISTS | payment UI | /assets/Qr Code/ | WEBP | NOT SPECIFIED BY CURRENT IMPLEMENTATION | small | public/assets/Qr Code/ | repo | BUILD VERIFIED | MUST NOT appear in AI-generated public posts |
| OpenGraph preview image | EXISTS | social crawlers | index.html:25 -> https://bitemebaby.com/og-image.png | PNG | NOT SPECIFIED BY CURRENT IMPLEMENTATION (Meta recommends 1200x630 - NOT SPECIFIED BY CURRENT IMPLEMENTATION) | NOT SPECIFIED BY CURRENT IMPLEMENTATION | public/og-image.png + external domain | repo + domain | UNVERIFIED (domain reachability not probed) | Verify bitemebaby.com/og-image.png returns 200 |
| PWA icons | EXISTS + CONNECTED | PWA manifest | vite.config.ts manifest | PNG | 192x192, 512x512 (manifest-declared) | - | public/ | repo | BUILD VERIFIED | None |
| White-label brand identity | EXISTS (schema) | tenant system | brands (mig 072/073), mascot_overrides (mig 076-078), brand_id/tenant_id | DB rows | - | - | Supabase tables | migrations | UNVERIFIED (DB) | Decide if Social AI is brand-scoped now or single-brand |
| Generated post/caption workflow | MISSING | - | text-only generator exists: contentAutomation.ts - localStorage bmb_content_*; publishContent() is a LOCAL FLAG, not a real publisher | text | - | - | localStorage (NOT durable) | - | - | Replace with durable social_posts design (D-07/D-08) - NOT built |
| Post templates | MISSING | - | none (no template code or files) | - | - | - | - | - | - | Only if Owner wants templated posts |
| Hero.png / src/assets subdirs | EXISTS (hero) / EMPTY dirs | hero page | hero.png used by hero component | PNG | NOT SPECIFIED BY CURRENT IMPLEMENTATION | large | src/assets/ | repo | BUILD VERIFIED | Optional cleanup of empty src/assets/images, src/assets/logo |

## Classifications summary

- EXISTS + CONNECTED: mascot set, review screenshots, Facebook Logo, drink/snack SVGs, PWA icons, canonical product-image upload path (code-connected)
- EXISTS + NOT CONNECTED (to Social AI): og-image.png (HTML meta only), Logo_Sticker_Circle.webp, contentAutomation.ts (generator only, no publisher)
- MISSING: post templates, generated post-image workflow, any durable post/caption record
- BLOCKED: confirmation of production media shape (base64 vs URL) - requires DB access
- UNKNOWN: contents of public/images/pre-order and public/images/same day (directories observed with no files listed)

## Key facts (evidence-backed)

1. Facebook comment auto-reply needs NO image assets - reply is text-only; no asset prerequisite.
2. Auto-Post image selection should reuse the canonical media_assets/bmb-images path - no new storage contract needed; only the DB-shape question (legacy base64) remains open.
3. contentAutomation.ts is NOT a publishing system - localStorage draft store + local publish flag. It must not be treated as Auto-Post infrastructure (D-07/D-08).
4. No social/brand asset directory exists and none is required by any current code path (see Phase B in the main audit).
