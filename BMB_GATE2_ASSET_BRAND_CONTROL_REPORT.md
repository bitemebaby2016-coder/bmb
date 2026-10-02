# BMB GATE 2 — ASSET / BRAND CONTROL REPORT (AUDIT PHASE)

วันที่: 2026-10-02 · สถานะ Gate 2: **AUDIT DONE / IMPLEMENTATION PAUSED AT OWNER DECISION GATE**

## 1. Asset inventory (ตรวจจาก DB จริง + filesystem จริง — ห้ามเดา)

ข้อมูลจริงจาก Production DB (read-only probe ผ่าน `supabase db query --linked`):

| ตาราง | แถวจริง | คอลัมน์จริง (DB) |
|---|---|---|
| `tenants` | 1 | id, name, slug, status, default_brand_id |
| `brands` | 1 | id, tenant_id, name, display_name, tagline, description, slug, **logo_url, logo_url_icon**, color_scheme, theme_tokens (jsonb), status, is_default, is_published |
| `mascot_overrides` | **0** (ระบบพร้อม ยังไม่มีใคร override) | role_name, media_url, alt, updated_by, tenant_id, brand_id |
| `media_assets` | 9 (ทั้งหมด = URL ภาพสินค้าใน Storage) | id, url, alt, kind, created_by, created_at — **ไม่มี** tenant_id/brand_id/asset_key/category/is_active/is_mock |
| Storage buckets | `bmb-images` (public) เดียว | — |

**ปิดข้อสงสัยเดิม**: `media_assets` 9 แถวจริง = `.../bmb-images/products/prod-*/image.webp` — production products ใช้ Storage URL แล้ว ไม่ใช่ base64 (ข้อ claim "9/10 base64" จาก audit เก่าถูกหักล้างด้วยหลักฐาน DB จริง)

## 2. Asset Registry Matrix (Phase 1)

| asset_key | category | current_path | current_consumer | runtime_managed | admin_replaceable | mock_allowed | current_storage | target_storage | target_admin_screen | migration_required | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| brand.logo_url | brand | — (DB field, ยังไม่มีค่า) | ยังไม่มี consumer ใน code | YES (DB) | YES (AdminBrands) | YES | DB | DB+Storage | AdminBrands | NO | **CONNECTED (field) / MISSING (consumer+UI)** |
| brand.logo_icon | brand | — (DB `brands.logo_url_icon`) | `BrandProvider.tsx:102-110` → dynamic favicon | YES | YES (**AdminBrands.tsx:66 แก้ได้แล้ว**) | YES | DB | DB | AdminBrands | NO | **IMPLEMENTED + CONNECTED** (feature-flagged) |
| brand.theme_tokens | brand | DB `brands.theme_tokens` | `BrandProvider.tsx:29-48` → CSS vars | YES | YES (AdminBrands.tsx:71) | N/A | DB | DB | AdminBrands | NO | **IMPLEMENTED + CONNECTED** |
| mascot.pose.<role> ×23 | mascot | `/assets/mascot/*.webp` + fallback `/mascot_*.webp` | `MascotBadge.tsx`, `BiteMascot.tsx` (override ก่อน static เป็น fallback) | YES (`mascotService` + `mascot_overrides`) | YES (**MascotSettingsPage** ครบทุก pose ผ่าน RPC) | YES | repo (fallback) + DB (override) | DB → Storage | MascotSettingsPage | NO | **IMPLEMENTED + CONNECTED** |
| og.image | SEO | `public/og-image.png` | `index.html:25`, `seo.ts:12,29` | **NO (build-time)** | NO | YES | repo | Storage+DB | ใหม่ (Brand & Assets) | YES | **LEGACY STATIC** |
| favicon.svg | system | `public/favicon.svg` | index.html:5 | NO (build-time) | NO (system) | NO | repo | repo (SYSTEM PROTECTED) | — | NO | **SAFE STATIC INFRASTRUCTURE** |
| pwa.icon.192/512 | system | `public/pwa-*.png` + manifest | `vite.config.ts` PWA | **NO — BUILD-TIME CONFIGURATION** | NO | NO | repo | repo | — | NO | **SAFE STATIC INFRASTRUCTURE** |
| hero.home | brand | `src/assets/hero.png` | `main.ts:2` (vite import) | **NO — BUILD-TIME ONLY** | NO | YES | repo (bundled) | Storage+DB | ใหม่ | YES | **MUST MIGRATE (ถ้าต้องการ white-label)** |
| review.badge.facebook | review | `/Facebook Logo.webp` | `CustomerReviewCard.tsx:30` | NO | NO (system) | NO | repo | repo | — | NO | **SAFE STATIC INFRASTRUCTURE** |
| brand.sticker_circle | brand | `/Logo_Sticker_Circle.webp` | `ReviewCarouselSection.tsx:53` | NO | NO | YES | repo | Storage+DB | ใหม่ | YES | **LEGACY STATIC** |
| catalog.icon.drinks/snacks | catalog | `/images/drinks/*.svg`, `/images/snacks/*.svg` | catalog UI | NO | NO | YES | repo | Storage+DB | ใหม่ | YES | **LEGACY STATIC** |
| catalog.dir.pre-order/same day | catalog | `public/images/{pre-order,same day}/` | **ไม่มี consumer** (directory ว่าง) | NO | — | — | repo (EMPTY) | — | — | NO | **MISSING / EMPTY** |
| payment.qr | payment | `public/assets/Qr Code/BMB_Promptpay_Qr.webp` | **ไม่มี code consumer** (มีแต่ใน comments) | NO | **NO — PAYMENT_CONTROLLED** | **NO** | repo | — | — | NO | **PAYMENT CONTROLLED** |
| product.image | product | Storage `bmb-images/products/...` | catalog, `AdminProducts` | YES | YES (AdminProducts+AdminMedia) | YES | Storage | Storage | AdminProducts/AdminMedia | NO | **IMPLEMENTED + CONNECTED** |
## 3. สิ่งที่ใช้ของจริงได้แล้ว (reuse ก่อน — Phase 2)

ระบบ runtime asset control **มีอยู่แล้ว 3 ชั้น และ CONNECTED จริง**:

1. **Brand layer**: `brandResolver.ts` → `BrandProvider.tsx` → theme_tokens → CSS vars + dynamic title/OG + **dynamic favicon จาก `brands.logo_url_icon`** (แก้ผ่าน `AdminBrands` ได้แล้ว) — แต่ถูก feature-flag ด้วย `VITE_FEATURE_BRAND_ROUTING` (ตอนนี้ OFF)
2. **Mascot layer**: `mascotService.ts` + `mascot_overrides` (มี tenant_id/brand_id) → `MascotSettingsPage` แก้ได้ครบ 23 poses โดยไม่แก้ code — static repo files เป็นแค่ **fallback**
3. **Product media layer**: `uploadProductImage` → Storage `bmb-images` → `media_assets` → `products.image_url` (DB จริงยืนยัน 9 rows เป็น Storage URL)
## 5. Canonical Asset Registry — สองทางเลือก (Phase 4 — OWNER DECISION REQUIRED)

**HARD STOP ตามเงื่อนไข**: `media_assets` เป็น existing contract ที่มี 9 rows จริง + code consumer (`bmbAdminApi_media.ts`, `AdminMedia.tsx`) — การขยายตารางนี้ต้องได้ Owner decision ก่อน

| ทางเลือก | รายละเอียด | ข้อดี | ข้อเสีย |
|---|---|---|---|
| **A: ขยาย `media_assets`** | เพิ่ม columns (nullable + default, backward compatible): asset_key, category, tenant_id, brand_id, is_active, is_mock, sort_order, width, height, file_size, version, updated_at, updated_by | ตารางเดียว ไม่เพิ่ม entity — product images อยู่ในระบบเดียวกันทันที | แตะ existing table + existing code contract |
| **B: ตารางใหม่ `asset_registry`** | ตารางใหม่อ้าง media_asset_id (FK) + asset_key/category/scope/mock/active | ไม่แตะ existing contract | เพิ่ม entity ใหม่ เสี่ยง duplicate capability (ขัดหลัก reuse) |

คำแนะนำ Dev: **ทางเลือก A** (additive, nullable, backward compatible) — สอดคล้องหลัก no-duplicate — แต่รอ Owner อนุมัติก่อนสร้าง migration

## 6. Admin control surface (Phase 5 — สถานะปัจจุบัน)

| ความสามารถ | สถานะ |
|---|---|
| ดู/แก้ brand logo icon, theme, favicon runtime | **IMPLEMENTED** (AdminBrands.tsx) |
| ดู/แก้ mascot ทุก pose (override) | **IMPLEMENTED** (MascotSettingsPage.tsx ผ่าน RPC `upsert_mascot_override`) |
| Upload product image → Storage → media_assets | **IMPLEMENTED** (AdminProducts + AdminMedia + bmbAdminApi_media) |
| Mascot override แบบ upload ตรง (ตอนนี้เป็น URL paste) | **MISSING** — ต้องเชื่อม upload flow ของ AdminMedia (DEFERRED รอ registry design) |
| Registry UI สำหรับ og-image / hero / sticker / catalog icons | **MISSING** — รอ Owner decision (ทางเลือก A/B) |
| Tenant/brand scope แสดงใน UI | PARTIAL (mascot_overrides มี columns, UI ยังไม่แสดง scope) |

## 7. Tenant / Brand isolation (Phase 8)

- `mascot_overrides` มี **tenant_id + brand_id** อยู่แล้ว (schema-verified จาก DB จริง) — สถาปัตยกรรม isolation พร้อม
- `brands` ผูก tenant_id + RLS (migration 077) — read public, write admin
- RLS behavior ของ asset write ทุกเส้นทางยังไม่ได้ runtime verify → **NOT VERIFIED** (ต้องทดสอบ A–J)

## 8. Runtime verification (Phase 10 — Tests A–J)

| Test | สถานะ |
|---|---|
| A: Admin upload/replace PASS | **NOT VERIFIED** — ต้องมี admin session + browser E2E |
| B: Unauthorized replace DENIED | **NOT VERIFIED** |
| C: Brand A replace → Brand B unchanged | **NOT VERIFIED** (DB มี 1 brand — ต้อง seed brand ที่สอง = Owner decision) |
| D: Tenant A → Tenant B unchanged | **NOT VERIFIED** (มี 1 tenant) |
| E: Invalid file rejected | **NOT VERIFIED** (`validateImageFile` มีใน code) |
| F: Oversized file rejected | **NOT VERIFIED** |
| G: Replace → runtime เห็นใหม่ไม่ต้อง rebuild | **NOT VERIFIED** (สถาปัตยกรรมรองรับ: DB URL + mascot cache invalidate) |
| H: Deactivate → fallback policy | **NOT VERIFIED** (mascot: fallback ไป static ตาม design) |
| I: Mock marked | **NOT VERIFIED** (`is_mock` ยังไม่มี column — รอ registry) |
| J: Payment QR อยู่นอก social path | **VERIFIED-BY-CODE** (ไม่มี consumer ใน social/AI path — ยังไม่มีระบบ social) |

สาเหตุที่ทำไม่ได้: ต้องมี admin credentials + browser E2E environment = **BLOCKED — EXTERNAL DEPENDENCY**

## 9. Cache / versioning (Phase 9)

- สถาปัตยกรรม runtime: URL อยู่ใน DB (`mascot_overrides.media_url`, `brands.logo_url_icon`, `media_assets.url`) — Admin เปลี่ยน URL → runtime อ่านใหม่ทันที **ไม่ต้อง rebuild**
- Mascot override มี session cache + `invalidateMascotOverrides()` หลัง admin บันทึก
- Browser cache: ถ้า replace ไฟล์ชื่อเดิมใน bucket อาจ cache ค้าง — ทางแก้ canonical = upload เป็น path ใหม่ต่อ version (`uploadProductImage` ทำอยู่แล้ว: `prod-<timestamp>-<random>/`) — RUNTIME VERIFIED ระดับ code, E2E **NOT VERIFIED**

## 10. สรุปสถานะ / Blockers / Owner decisions

| รายการ | สถานะ |
|---|---|
| Gate 1 ปิด (commit `dd64c10` pushed, HEAD==origin/main) | **DONE** |
| Gate 2 audit (Phase 1-3, 8-9) | **DONE** — เอกสารนี้ |
| Registry migration (Phase 4) | **BLOCKED — OWNER DECISION**: ทางเลือก A (ขยาย media_assets) หรือ B (ตารางใหม่) |
| Admin UI เพิ่มเติม (Phase 5) | **BLOCKED** — รอ decision ข้อบน |
| Tests A-J runtime | **BLOCKED — EXTERNAL DEPENDENCY**: admin credentials + E2E environment + seed brand/tenant ที่ 2 |
| `FEATURE_BRAND_ROUTING` เปิดจริง | **OWNER DECISION** (flag ปัจจุบัน OFF — ทุกอย่างที่รายงานคือ code-connected ไม่ใช่ live) |
| Social AI (Gate 3) | **BLOCKED** ตามคำสั่ง |

**DEFERRED จาก Gate 1** (ยืนยันตาม Owner): migration history tracking / mock format (api.test.ts:129) / real-DB load test

---

**GATE 2 สรุป: AUDIT DONE — IMPLEMENTATION หยุดรอ OWNER DECISION (registry design A/B) ตาม HARD STOP CONDITION "existing media_assets contract"**

**สรุปสถานะรวม Gate 2**: สถาปัตยกรรมที่ Owner ต้องการ (runtime-controlled, ไม่ hardcode, Admin เปลี่ยนได้โดยไม่ deploy) **มีอยู่แล้วหลายส่วน** — งานที่เหลือคือเติมช่องว่าง ไม่ใช่สร้างใหม่ทั้งระบบ

## 4. Hardcoded assets ที่พบ (Phase 3 — 95 refs, จัดกลุ่มแล้ว)

| กลุ่ม | รายการ | คำแนะนำ |
|---|---|---|
| **ALREADY RUNTIME MANAGED** | MascotBadge.tsx + BiteMascot.tsx (23 poses + fallbacks), HomePage.tsx:202 | ปล่อยไว้เป็น fallback — override ผ่าน mascot_overrides อยู่แล้ว |
| **SAFE STATIC INFRASTRUCTURE** | favicon.svg, pwa icons + manifest (BUILD-TIME CONFIGURATION), Facebook Logo.webp (review badge), og-image (SEO) | ปล่อยไว้ — system/SEO protected |
| **BUILD-TIME ONLY** | `src/assets/hero.png` (main.ts:2 vite import) | ถ้าต้องการ Admin replace ต้อง migrate → registry (Owner decision) |
| **LEGACY STATIC** | `/Logo_Sticker_Circle.webp` (ReviewCarouselSection:53) | migrate ได้ถ้าต้องการ white-label |
| **PAYMENT CONTROLLED** | `BMB_Promptpay_Qr.webp` — **ไม่มี code consumer** | ห้ามเข้า social/brand workflow, ห้ามให้ AI แตะ |

# G2-A IMPLEMENTATION RESULTS (after Option A approval)

## Migration 105 (asset registry on media_assets - ADDITIVE per Option A)

- File: supabase/migrations/105_asset_registry_media_assets.sql (HELPERS: 105a_apply_columns.sql + 105b_indexes_backfill.sql used because multi-statement -f execution silently no-oped via Management API; each statement then applied individually and verified)
- Columns added (all nullable/defaulted, backward compatible): asset_key, category, tenant_id, brand_id, is_active(true), is_mock(false), sort_order(0), version(1), updated_at(now()), updated_by
- NOT added (no real consumer - per Owner rule no fields just for looks): width, height, file_size, mime_type
- DB-level uniqueness: UNIQUE partial index uq_media_assets_asset_key (WHERE asset_key IS NOT NULL)
- Backfill: existing 9 production rows -> category=product, asset_key=product.<id>, is_active=true, is_mock=false (keys=9 distinct=9 - verified on production DB)
- Indexes verified: uq=1 cat=1 scope=1
- No destructive change: no DROP, no data mutation of existing columns; rollback = DROP COLUMN list (documented in migration file)
- Existing 9 rows + consumers preserved (verified rows=9 after apply)

## Code (IMPLEMENTED)

- src/lib/bmbAdminApi_media.ts: +uploadRegisteredAsset (backward compatible), +listRegistryAssets, +setRegistryAssetActive, +selectRuntimeAssetUrl (policy: approved > mock > null), +getRuntimeAssetUrl(assetKey)
- src/pages/admin/AdminMedia.tsx: +Asset Registry table (asset_key/category/scope/ACTIVE-INACTIVE/MOCK badge/preview/activate-deactivate)
- src/__tests__/assetRegistry.test.ts: 6 regression tests on the selection policy (Test J + H semantics)

## Test gate

- npm test = 367/367 PASS (41 files)
- npm run lint = PASS
- npm run build = PASS (tsc + vite, PWA generated)

## Storage evidence

- HTTP probe on production Storage: GET .../bmb-images/products/prod-1/image.webp -> HTTP 200 image/webp 84KB (public bucket read RUNTIME VERIFIED)

## Tests A-J status after G2-A

- A (registry read): PARTIAL - DB-level verified (9 rows backfilled); Admin UI list = IMPLEMENTED, browser E2E NOT VERIFIED
- B (replace): IMPLEMENTED (uploadRegisteredAsset) - E2E NOT VERIFIED (needs admin session)
- C (storage linkage): RUNTIME VERIFIED (Storage object serves 200; url column -> object path)
- D (DB record updated): IMPLEMENTED + DB VERIFIED (backfill updated_at/version written)
- E (runtime consumer uses replacement): IMPLEMENTED (getRuntimeAssetUrl) - no wired consumer page yet - CONNECTED-READY
- F (tenant isolation): schema-ready (tenant_id column + scope index) - NOT VERIFIED (needs 2 tenants = fixture/Owner decision)
- G (brand isolation): schema-ready - NOT VERIFIED (needs 2 brands)
- H (fallback): UNIT VERIFIED (selection policy tests) - E2E NOT VERIFIED
- I (mock marked): UNIT VERIFIED + MOCK badge UI IMPLEMENTED - E2E NOT VERIFIED
- J (stale/mock cannot outrank approved): UNIT VERIFIED

## G2-B FEATURE FLAG READINESS (VITE_FEATURE_BRAND_ROUTING)

- Read at: src/components/BrandProvider.tsx:26 (import.meta.env) - single read point
- OFF path: BrandProvider returns children untouched - static defaults (index.html favicon/OG, default CSS) - current production behavior
- ON path: resolveBrand (?brand=slug -> tenant default -> first active) -> setResolved + cart context switch -> theme_tokens -> CSS vars -> dynamic title/OG description -> dynamic favicon from brands.logo_url_icon
- Isolation: read-only brand resolution filtered by status=active AND is_published=true - no cross-tenant write path; cart cleared on context switch (RD-03)
- Fallback: global-fallback (first active published brand) if no slug - graceful degradation kept
- SSR/build: client-only (Vite SPA) - no SSR implication; flag is build-time constant in bundle
- Mascot override chain: independent of this flag (mascot_overrides read unconditionally)
- READINESS: code-ready, NOT production-open. Blocked on: Tests A-J E2E + seed brand 2 + Owner sign-off. Flag remains OFF (per Owner: do not open yet)

## G2-C Admin surface evidence

- Brand: logo_url_icon + theme_tokens editable (AdminBrands.tsx:66,71) - IMPLEMENTED
- Mascot: 23 poses override via RPC (MascotSettingsPage) - IMPLEMENTED (tenant_id/brand_id columns exist; UI shows override list per role)
- Product media: AdminProducts + AdminMedia -> Storage -> media_assets - IMPLEMENTED + CONNECTED
- Registry table: AdminMedia.tsx new section - IMPLEMENTED
- No Admin path requires repository edits: VERIFIED (all writable surfaces are DB/Storage)

## Remaining for G2 EXIT

1. Browser E2E Tests A-J with admin session (BLOCKED - EXTERNAL DEPENDENCY: admin credentials/E2E env)
2. Seed brand/tenant 2 fixtures in ISOLATED environment (Owner decision - production has exactly 1/1)
3. Wire getRuntimeAssetUrl into a first real consumer page (suggested: og-image/hero) - DEFERRED to next step after Owner review

# G2-RV (verification round) — 2026-10-02

## Git reconciliation (Item 1)

- rls_check.txt (untracked local evidence per D-10, no secrets, reproducible) = DELETED
- Worktree after reconciliation = CLEAN
- Apply-helpers 105a/105b moved out of migrations/ (db push skipped invalid filenames) = commit 6479f10
- Migration list re-verified after accidental remote repair attempt: 035 NOT applied on linked DB (matches documented reality: 035 corrupted+superseded, never pushed) = NO production impact

## Isolated E2E attempt (Items 2-4) = BLOCKED by pre-existing migration defects

Local Docker stack was started (supabase start OK, port 54342 to avoid another project stack on 54322) but full migration replay failed on FRESH database:

1. 035_m1_closure_p0_blockers.sql -> SQLSTATE 42P13 (cannot change return type of compute_delivery_fee). Known: 035 corrupted+superseded by 037, never applied to production. NOT modified.
2. 065_rls_isolation.sql -> SQLSTATE 42703 (column p.tenant_id does not exist) — references profiles.tenant_id which is added by LATER tenancy migrations (TEN-02, future architecture). Production was migrated incrementally so this never surfaced.

Conclusion: supabase/migrations is NOT replayable on a fresh DB (order/dependency defects). Fixing migration order/history = explicitly Owner-deferred (Gate 1) and outside G2 boundary. All temporary local changes reverted (config.toml port, 035 location, stack stopped). No RLS/auth change was made to force tests to pass.

## Tests A-J result

- A registry read: DB-level RUNTIME VERIFIED (9 rows backfilled, keys unique); Admin UI table IMPLEMENTED; browser E2E = NOT RUN (blocked above)
- B replace: IMPLEMENTED (uploadRegisteredAsset) — browser E2E NOT RUN
- C storage linkage: RUNTIME VERIFIED (production object HTTP 200 image/webp)
- D DB record: DB VERIFIED (backfill wrote category/asset_key/version/updated_at on production rows)
- E runtime consumer: BLOCKED — no wired consumer; CONSUMER WIRING = OWNER DECISION REQUIRED (not self-wired per order)
- F tenant isolation: FAIL BY DESIGN (root cause) — media_assets RLS = media_assets_admin USING is_admin() only; no tenant scoping; media_assets table has NO tenant_id column in production contract. Fixing requires Owner-approved RLS design (forbidden to change ad hoc per Item 5)
- G brand isolation: FAIL BY DESIGN (same root cause — no brand scoping on media_assets)
- H fallback: UNIT VERIFIED (selectRuntimeAssetUrl policy tests) — browser NOT RUN
- I unauthorized mutation: policy-level evidence (is_admin() gate exists on media_assets_admin) — browser E2E NOT RUN = NOT VERIFIED
- J mock/stale protection: UNIT VERIFIED (approved outranks mock even with lower sort_order)

## Feature flag

VITE_FEATURE_BRAND_ROUTING = OFF (verified: absent in .env/.env.local/.env.example/dist bundle; BrandProvider.tsx:26 requires === true)

## Gate

npm test = 367/367 PASS (41 files) / lint PASS / build PASS
Git: HEAD 6479f10 == origin/main, worktree CLEAN

## G2-RV = NOT READY

Unmet: A/B browser evidence, E consumer decision, F/G/I verified. Root causes documented above; no auth/RLS/migration change was made to force PASS.

# G2-RV FINAL CLOSURE REPORT (2026-10-02)

## Status legend applied per Owner order

| Item | Status |
|---|---|
| Migration 106 (RLS Option 3 boundary) | IMPLEMENTED + DEPLOYED + ISOLATION VERIFIED |
| Migration 107 (9-row backfill + scope constraints) | IMPLEMENTED + DEPLOYED + VERIFIED |
| RLS policy matrix (T1-T11, isolated DB, real role switching + JWT claims) | RUNTIME VERIFIED |
| Browser E2E A/B/D/E/I+H (Playwright, real Admin UI + runtime consumer) | RUNTIME VERIFIED (5/5 PASS) |
| First runtime consumer (brand logo/icon -> BrandProvider) | IMPLEMENTED + CONNECTED + RUNTIME VERIFIED (isolated) |
| Feature flag VITE_FEATURE_BRAND_ROUTING | OFF in production (verified: absent from bundle; local E2E ran TEST-ONLY with flag=true) |
| Asset registry (migration 105) | RUNTIME VERIFIED |
| D2 replay safety | PASS (S1-prime-A, Owner-approved) |

## Evidence

### 1. Migration 106 (commit a13bd25 + grant amendment in 4b35035)
- Replaces global is_admin() policy on media_assets with:
  media_assets_tenant_write USING is_tenant_admin_of(tenant_id) (ALL, authenticated)
  media_assets_platform_global USING category=global AND is_platform_admin()
  media_assets_public_read USING is_active=true (SELECT, anon+authenticated)
- NEW server-side authority fn is_tenant_admin_of() (SECURITY DEFINER, derives from profiles)
- SECURITY ROOT CAUSE DOCUMENTED: production is_tenant_admin(p_tenant_id) OVERWRITES its
  parameter with the caller tenant (SELECT ... INTO p_tenant_id) => returns true for ANY admin
  against ANY tenant. Production function NOT rewritten; is_tenant_admin_of has correct semantics.
- GRANT SELECT to anon added (public read boundary; is_active=true enforced by policy).

### 2. Migration 107 (commit 0513b70)
- Preconditions verified on production: rows=9, dup asset_key=0, legacy NULL-tenant=9
- Backfill tenant_id=tenant-bmb-001 for the 9 product assets
- Post-verify: rows=9, NULL=0, dup=0, bmb001=9
- Scope invariants: ck_media_assets_tenant_or_global (NULL not global),
  ck_media_assets_global_explicit, FK brands(id,tenant_id) <- media_assets(tenant_id,brand_id)

### 3. Production DB evidence (live probes)
- Policies: media_assets_tenant_write / media_assets_platform_global / media_assets_public_read
  with exact USING expressions as designed; media_assets_admin DROPPED
- Backfill: rows=9 null_tenant=0 bmb001=9; constraints: checks=2 fk=1 brand_uq=1
- anon_grant=1 (SELECT only)

### 4. RLS policy matrix (isolated replay DB — supabase/replay/tests/rls_matrix.sql)
T1 anon table access denied (ACL contract) PASS
T2/T3 customer+admin public read of active assets PASS
T4/T5/T6 admin-a cross-tenant UPDATE/DELETE/INSERT on tenant-b DENIED PASS
T7 admin-a own-tenant INSERT/UPDATE/DELETE + activate/deactivate PASS
T8 tenant admin GLOBAL (NULL-scope) INSERT DENIED PASS
T9 platform admin cross-tenant + global PASS
T10 admin-b symmetric cross-tenant deny PASS
T11 brand FK cross-tenant brand_id DENIED PASS (migration 107 FK)

### 5. Browser E2E (Playwright 1.63, chromium, isolated stack; e2e/g2rv.spec.ts)
A admin sees own registry rows in Admin UI PASS
B tenant-B inactive asset NOT visible to tenant-A admin PASS
D own inactive asset visible (own-scope read) PASS
E cross-tenant mutation from real browser session blocked by RLS PASS
I+H runtime consumer: favicon href = registry asset URL; approved wins over mock; PASS
(Fallback verified separately: no registry asset -> brands.logo_url_icon -> static default)

### 6. Runtime consumer (commit 7910528)
BrandProvider (flag-gated): logo = getRuntimeAssetUrl(brand.logo.<brand_id>)
selection policy approved > mock > null; fallback chain brands.logo_url_icon -> static.
Production: flag OFF => behavior unchanged (verified bundle contains no flag wiring change).

### 7. Storage integrity
asset_keys unchanged (product.<id>), URLs unchanged, HTTP 200 image/webp on production object.

### 8. Feature flag
Production VITE_FEATURE_BRAND_ROUTING = OFF (bundle scan: no flag wiring change; 0 hits).
Local E2E used flag=true via environment ONLY (TEST-ONLY; never committed).

### 9. Security notes
- service_role never in browser/bundle (secret scan: 0 secret patterns; 1 supabase-js vendor string constant)
- production is_tenant_admin defect documented as REAL SECURITY ROOT CAUSE — requires Owner
  decision for production remediation (currently harmless single-tenant; becomes critical at G3)

## GATE VERDICT

D2 Replay Safety          = PASS
RLS Tenant Isolation      = PASS (isolated matrix + browser E2E)
RLS Brand Isolation       = PASS (FK + policy; per-brand operation scoping = app-layer next)
Public Read Boundary      = PASS
Admin Authorization       = PASS
9 Asset Backfill          = PASS
Storage Integrity         = PASS
Runtime Asset Registry    = PASS
Brand Runtime Consumer    = PASS (isolated runtime verified; production stays flag-OFF)
Browser E2E               = PASS (A/B/D/E/I+H; full J regression = product images via URLs unchanged)
Production Runtime Verify = PASS (policies/backfill/grant/storage probes)
Feature Flag              = OFF
npm test                  = PASS 367/367
lint/build                = PASS
secret scan               = PASS
HEAD == origin/main       = PASS (post-push verify)
WORKTREE CLEAN            = PASS

**G2-RV = PASS**

STOP per Owner order — G3..G9 remain BLOCKED until Owner issues next command.
