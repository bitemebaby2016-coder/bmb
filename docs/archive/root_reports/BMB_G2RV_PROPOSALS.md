# BMB — G2-RV Proposal Pack (AUDIT / PROPOSAL ONLY — 2026-10-02)

สถานะ: **ห้าม implement ทุกส่วน** จนกว่า Owner approve — เอกสารนี้รวม Part A (Asset Security Model), Part B (RLS Options), Part D (Consumer Options), Part E (E2E Prerequisites)

# PART A — Tenant/Brand Asset Security Model Audit

หลักฐานทั้งหมดจาก live production probe (2026-10-02): tenants=1, brands=1, media_assets=9 (category=product, kind=image), mascot_overrides=0

## ตาราง Matrix

| Asset category | Owner (table) | Tenant scope | Brand scope | Public/Private | Who can read | Who can write | service_role | Customer (browser) | Admin |
|---|---|---|---|---|---|---|---|---|---|
| Product media (media_assets, category=product, 9 rows → products.image_url) | media_assets (registry cols จาก 105) | tenant_id = **NULL** ทุก row (ยังไม่ assign) | brand_id = NULL | Public (Storage public URL + policy public read) | ทุกคน (anon+auth) | is_admin() (global admin เท่านั้น) | full (grant) | เห็นรูปสินค้าผ่าน URL | global admin CRUD ผ่าน AdminMedia/AdminProducts |
| Brand assets (brands.logo_url, logo_url_icon, theme_tokens) | brands | brands.tenant_id (มีจริง) | row-level = brand เอง | Public read | ทุกคน (brands_public_read) | **is_tenant_admin(brands.tenant_id)** — tenant-scoped แล้ว | full | เห็นโลโก้/theme ผ่าน BrandProvider (flag OFF = ยังใช้ static) | tenant admin ของ tenant นั้น + platform |
| Mascot assets (mascot_overrides: role_name, media_url, tenant_id, brand_id) | mascot_overrides | มี tenant_id (NULL = global default) | มี brand_id | Public read | ทุกคน (mascots_public_read_v2) | is_admin() หรือ is_tenant_admin(tenant_id) | full | เห็น mascot ผ่าน mascotService | tenant admin + global admin |
| Global/system assets (favicon.svg, PWA icons, manifest, OG) | **ไม่อยู่ใน DB** — build-time static | n/a | n/a | Public | ทุกคน | repo/CD เท่านั้น | n/a | เห็น (browser chrome/manifest) | ผ่าน repo (Owner) |
| Payment-controlled (PromptPay QR) | **ไม่มี DB record** — static file | n/a | n/a | Public file | ทุกคน | repo เท่านั้น | n/a | เห็นบนหน้า payment | repo — **ห้ามเข้า registry/social** (คงสถานะเดิม) |
| Registry entries อนาคต (asset_key: brand.logo ฯลฯ) | media_assets (105) | tenant_id nullable — **ยังไม่มีนิยามบังคับ** | brand_id nullable | ตาม policy | ปัจจุบัน: ทุกคนอ่านได้ | is_admin() — global เท่านั้น | full | ขึ้นกับ Option (Part B) | ต้องขยายเป็น is_tenant_admin ถ้าเลือก Option 2/3 |

## คำตอบ A–I (จาก evidence)

- **A. Tenant A อ่าน asset ของ Tenant B ได้หรือไม่?** — **ได้ในปัจจุบัน** (media_assets_public_read = true; admin policy ไม่กรอง tenant) — ส่วน brands/mascot มี tenant scoping แล้ว
- **B. Brand A1 อ่าน asset Brand A2 ได้หรือไม่?** — media_assets: ได้ (ไม่มี brand scoping); brands row: อ่านได้ทุกคนแต่ *เขียน* ไม่ได้ (is_tenant_admin กรอง)
- **C. Global asset มีจริงหรือไม่?** — มี 2 ระดับ: (1) build-time static (favicon/PWA/OG/PromptPay) ไม่อยู่ใน DB (2) media_assets rows ที่ tenant_id/brand_id = NULL — NULL = "global โดยบังเอิญ" ตามคำเตือนของ Owner
- **D. Global asset ใครสร้าง/แก้?** — static: repo/CD; media_assets NULL-scope: global admin (is_admin()) — ยังไม่มีนิยาม "global asset catalog" ที่ชัดเจน
- **E. Product asset tenant-owned หรือ global?** — row จริงทั้ง 9 = NULL (ที่มาจริงคือ tenant เดียวที่ prod มี — tenant_id ควร backfill เป็น tenant-bmb-001 ตาม convention ของ is_tenant_admin — เป็น Owner decision)
- **F. Brand asset brand-owned หรือ tenant-owned?** — brands row = tenant-owned (brands.tenant_id); asset ระดับ "แบรนด์นี้เท่านั้น" (logo) ควร brand-scoped, asset ระดับ tenant ควร tenant-scoped
- **G. Mascot asset อยู่ระดับใด?** — mascot_overrides มี tenant_id + brand_id; NULL = global default pose — โครงสร้างพร้อมทั้งสองระดับ
- **H. Customer browser เห็นอะไรได้บ้าง?** — product images, brand logo/theme, mascot, favicon/PWA/OG static, PromptPay file — ทั้งหมดผ่าน public URL ไม่ต้อง login
- **I. Admin mutate อะไรได้บ้าง?** — global admin: ทุกอย่าง media_assets + mascot + brands ใด ๆ; tenant admin: brands/mascot เฉพาะ tenant ตัวเอง — **media_assets ยังจำกัด global admin เท่านั้น**
# PART B - RLS Design Options (PROPOSAL - not ranked, Owner decides)

## Option 1 - Tenant-scoped RLS (media_assets only)

- Security: tenant = hard boundary; every media_assets row requires tenant_id NOT NULL (global = separate explicit policy); read: own tenant + global; write: is_tenant_admin(row.tenant_id) or platform
- Migration impact: backfill 9 rows -> tenant-bmb-001; ADD COLUMN NOT NULL/DEFAULT (additive); media_assets_admin USING -> is_tenant_admin(tenant_id) OR platform
- Consumer impact: bmbAdminApi_media must send tenant_id on insert (admin session already has profiles.tenant_id); AdminMedia filter
- Backward compat: breaks if old client inserts without tenant_id (needs DEFAULT + trigger)
- Admin behavior: tenant admin manages own tenant only; platform admin all tenants
- Customer behavior: unchanged if public read kept (but must decide read visibility policy)
- service_role: full (cross-tenant automation server-side per Decision 1)
- Risk: cross-tenant READ policy must be explicitly decided
- Test requirements: F, I, A-D browser, 2-tenant fixture

## Option 2 - Tenant + Brand-scoped RLS

- Adds brand_id scope enforcement; read = tenant match AND (brand_id IS NULL OR brand context match); write = is_tenant_admin AND brand in tenant
- Migration impact: Option 1 + brand_id backfill + complex policy + "active brand context" in session/JWT (claim design needed - not just RLS)
- Consumer impact: largest - client must send brand context on every query
- Backward compat: breaks most (brand context absent in current session)
- Risk: highest claim plumbing; true DB-level cross-brand prevention inside tenant
- Test requirements: F+G + brand fixtures

## Option 3 - Hybrid (tenant boundary + brand scope + explicit global policy)

- Tenant boundary = hard rule (tenant_id NOT NULL); brand scope = only category=brand (logo/favicon/brand UI); global = explicit category=global + platform-admin-only write - NULL must have NO meaning (fixes accidental-global)
- Migration impact: Option 1 + category convention + three-layer policy
- Consumer impact: smallest (existing rows already category=product from 105; AdminMedia already has scope column)
- Backward compat: best
- Admin behavior: platform = global; tenant admin = own tenant + own brand
- Customer behavior: read by category
- Risk: medium - three policy sets, but no JWT claim changes
- Test requirements: F, G (brand category only), H, I, J + 2 tenant/2 brand fixtures

PROPOSAL NOTE (technical - NOT a choice on behalf of Owner): Option 3 matches Decision 1 best structurally (tenant = iron, brand = sub-scope, global = explicit) with smallest consumer impact.

# PART D - Consumer Decision Proposal (getRuntimeAssetUrl)

Scope per order: brand logo/icon, brand favicon, brand UI asset ONLY - PromptPay/payment/social/kitchen EXCLUDED

| Candidate | Current source | New source | Runtime path | Fallback | Tenant scope | Brand scope | Risk | E2E requirements |
|---|---|---|---|---|---|---|---|---|
| Brand logo/icon | brands.logo_url / logo_url_icon (AdminBrands) - flag OFF = static Logo.webp | media_assets category=brand, asset_key=brand.logo | BrandProvider (ON) -> getRuntimeAssetUrl(brand.logo.<slug>) -> img | brands.logo_url_icon -> static file | tenant | brand-scoped | LOW - BrandProvider has fallback; flag-gated | Test E, G, browser A-D |
| Brand favicon | index.html static + BrandProvider dynamic (flag ON) | registry asset_key=brand.favicon | BrandProvider.onMount -> favicon link element | brands.logo_url_icon -> static favicon.svg | tenant | brand-scoped | LOW - extension of existing logic | E + favicon swap verify |
| Brand UI asset (hero/badge in brand context) | static import (src/assets/hero.png - BUILD-TIME) | registry category=brand | page-level getRuntimeAssetUrl + onError fallback | original static file | tenant | brand-scoped | MEDIUM - build-time to runtime = layout impact | E + visual regression |

Matches Owner Decision 3: start with brand logo/icon -> favicon (lowest risk, 2-layer fallback, flag-gated) - CONFIRMED: no implementation this round.

# PART E - E2E Environment Prerequisites (A-J browser)

Dependency order: Migration replayability must be fixed FIRST (see BMB_MIGRATION_REPLAYABILITY_AUDIT.md) before local/isolated stack installs

1. Isolated Supabase (local Docker stack or second project) - currently blocked by fresh-replay defects (035: 42P13, 065: 42703)
2. Migration history strategy per Owner decision (S1/S2/S3 in audit file)
3. Admin account in isolated stack (local auth admin API - NO production credentials)
4. Tenant A / Tenant B fixtures (tenants + profiles.tenant_id binding)
5. Brand A1/A2 (Tenant A) / Brand B1 (Tenant B)
6. media_assets fixtures per scope: asset_key=brand.logo, URL A != URL B + Storage objects A/B (local bucket)
7. Playwright (already in devDependencies ^1.54.1) + specs covering A-J through real Admin UI routing
8. Env vars via .env.e2e (gitignored by existing .env* pattern): VITE_SUPABASE_URL/ANON_KEY of test stack + E2E admin credentials (per-run, never in repo)
9. Verify fixtures complete (tenant/brand/asset IDs, is_active, is_mock, storage linkage) before run
10. After strategy approved: fresh replay must pass + schema diff vs production before stack is considered equivalent

# PART F - Current Gate Status (no status change without evidence)

A BLOCKED / B BLOCKED / C PASS / D PASS / E OWNER DECISION / F OWNER DECISION / G OWNER DECISION / H UNIT VERIFIED / I NOT VERIFIED / J UNIT VERIFIED

G2-RV = NOT READY - awaiting Owner decisions
