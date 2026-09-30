# BMB — CAT-03A IMPLEMENT REPORT (media migration — EXECUTED)

**Gate:** CAT-03A implementation · Owner decisions locked: D1=APPROVED · D2=14 DAYS · D3=CAT-03B separate gate
**Date:** 2026-09-29 · Baseline `74ba824c`

## EXECUTED
- **Migration 057** (prior gate, live) — canonical storage policies
- **Migration 058** — RE-D1: DROP `preorder_votes_anon` INSERT policy (policy-only, data-safe) — **DEPLOYED TO PROD**
- **Media migration** — `e2e/ct-cat03a-migrate.cjs` (2 batches, idempotent, deterministic paths) — **EXECUTED + RUNTIME VERIFIED**
  - Batch 1 (prod-1..prod-6): **6/6 verified**
  - Batch 2 (admin-created ×3): **3/3 verified**
  - prod-w3c-test-pre: ไม่มีรูป — ห้ามสร้าง fake image (คงเดิม)
- Final state: **products 10 (9 migrated to canonical URL, 1 no image) · base64 products = 0 · media_assets = 9 · orders 202/order_items 199 intact · reviews/votes/menu_schedule untouched**

## Storage exception found (documented, NOT bypassed silently)
`bmb-images_authenticated_upload` (011/057) ไม่เคย apply ได้จริง — storage-api ของ project นี้**ไม่ resolve claims จาก user JWT** (signature/claim extraction mismatch — เดิมที Admin upload ผ่าน UI จึงไม่เคยทำงานจริง). Evidence: same 403 RLS AccessDenied กับ admin JWT ทุก variant (apikey=JWT / publishable+Bearer / legacyAnon+Bearer), ขณะที่ PostgREST DB RLS ผ่านปกติ (media_assets admin insert 201) และ service key ผ่าน (bypass RLS ตาม design).
**การจัดการตาม CAT-03 contract §4:** migration ใช้ **service key เฉพาะ storage upload** (server-side trusted path) — DB writes ทั้งหมด (media_assets + products) ยังเป็น **admin authenticated path** ที่ผ่าน RLS/is_admin() จริง. **ไม่มีการเปิด broad policy**.
**ผลต่อ Admin UI:** upload ปกติจากหน้า Admin ยังโดน 403 จนกว่าจะแก้ JWT-secret mismatch ระดับ platform (Owner action / support) — รายงานเป็น **MISSING (Owner platform fix)**

## Rollback evidence (RE-D2 = 14 days)
- Backup: `e2e/artifacts/cat03a-backup-batch{1,2}.json` (original Base64 ครบ 9 rows, **gitignored — local only**)
- Manifest: `e2e/artifacts/cat03a-manifest-batch{1,2}.json` (product_id, original, target_object_path, media_asset_id, migration_status, verification_status)
- Rollback procedure: `PATCH products.image_url = original_image_url` ต่อ id (orders ไม่ถูกแตะเด็ดขาด)
- **DAY 0–14: NO CLEANUP** · CAT-03B = **DEFERRED** (ต้องมี Owner approval + fresh verification)

## TESTS
Vitest **331/331 (36 files, +8)** · tsc 0 · eslint 0 · build PASS · git diff --check 0 · secret scan: ไม่มี key ใน repo (scripts ดึง keys runtime ผ่าน SUPABASE_ACCESS_TOKEN จาก env)

## สถานะ
IMPLEMENTED: migration script + RE-D1 058 + review closure code · CONNECTED: products.image_url ↔ media_assets ↔ storage objects ↔ PWA (canonical เดียว) · DEPLOYED: 058 · RUNTIME VERIFIED: 9/9 migrated + public read 200 + anon INSERT denied + data invariants · DOCUMENTED: report นี้ + REVIEW_CLOSURE + audit docs status · MISSING: Admin UI live upload (platform JWT issue — Owner) · BLOCKED: — · DEFERRED: CAT-03B cleanup, Admin upload platform fix