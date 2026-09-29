# BMB — WHITE-LABEL READINESS AUDIT (Brand / Mascot / Media / Theme / Multi-store)

**ฐาน:** `a528cdd` · **ประเภท gate: AUDIT ONLY — supersedes CAT-01; NO implementation** · probe read-only (`e2e/ct-wl-probe.cjs`)
**ผล: 🔴 HARD STOP — OWNER DECISION REQUIRED (architecture gap: tenancy = MISSING, brand runtime config = MISSING)**

---

## A. Current Architecture

```
Platform (single-store assumption ทั้งระบบ)
├─ Brand identity   = BUILD-TIME STATIC (index.html, manifest.json, seo.ts, public assets) — ไม่มี brand key ใน business_settings
├─ Theme            = CSS design tokens --color-brand-* (index.css, 34 vars) — code static, ไม่มี Admin control
├─ Mascot           = mascot_overrides (021) + RPC upsert_mascot_override + mascotService + MascotSettingsPage — DEPLOYED+CONNECTED แต่ 0 rows (PWA ใช้ static default)
├─ Media            = bucket bmb-images + media_assets — DEPLOYED/NOT CONNECTED (CAT-D03 pending)
├─ Catalog          = products/product_categories canonical (CONNECTED — ดู CATALOG AUDIT e9d0c5d)
├─ Settings         = business_settings key-value (RLS: admin ALL is_admin / anon deny qual=false / auth read) — PWA อ่านเฉพาะ CheckoutPage
└─ Tenant           = **ไม่มี tenant_id/store_id/business_id/organization_id/brand_id ในตารางใดเลย** (probe ยืนยัน 37 ตาราง)
```

## B. Brand Inventory

| รายการ | Current Source | Admin? | PWA runtime? |
|---|---|---|---|
| Store name | hardcoded (index.html title, seo.ts, manifest) | ❌ | hardcoded |
| Logo | static file public/ (Logo_Sticker_Circle.webp, favicon.svg) | ❌ | static |
| Logo variants (light/dark/mono/compact) | ไม่มี | ❌ | ไม่มี |
| Favicon / App icon | public/favicon.svg (build static; manifest icons ชุดเดียว sizes=any) | ❌ | build-time |
| OG/Twitter/JSON-LD | index.html + seo.ts hardcoded (bitemebaby.com, og-image.png) | ❌ | hardcoded |
| Tagline/description | hardcoded (index.html meta, manifest) | ❌ | hardcoded |
| Contact/social | index.html JSON-LD (facebook.com/bitemebaby) + pages | ❌ | hardcoded |
| Business hours | business_settings.hours + operating_hours (DB) | ✅ AdminSettings | ✅ CheckoutPage (บาง key) |
| Delivery identity/policy | business_settings.delivery_policy (radius_km 10, THB) | ✅ | ✅ CheckoutPage |
| Store identifier/kitchen location | business_settings.kitchen_location | ✅ | read ทาง order flow |
| **brand_identity key** | **ไม่มีใน business_settings** (prod keys = delivery_policy, hours, kitchen_location, operating_hours, order_policy) | — | — |

## C. Mascot Inventory

- **Architecture มีจริง (first-class แล้ว ~80%):** ตาราง `mascot_overrides(role_name, media_url, alt, updated_by, updated_at)` + RPC `upsert_mascot_override` (is_admin) + RLS (admin ALL / anon SELECT) + `mascotService.getMascotOverrides/resolveOverride` (PWA read) + `MascotSettingsPage` (Admin UI) + `MASCOT_ROLES` 23 poses + 14 3D set
- **Prod data = 0 rows** → PWA resolve ไม่เจอ override → ใช้ static default (public/mascot_Bite_*.webp, bite-mascot.svg, assets/mascot/) = **ACCEPTABLE brand default**
- **Contexts ต่อจริง:** MascotBadge ใน CartPage, MenuPage, OrderTrackPage, PaymentConfirmationPage, CustomerReviewCard, FoodMenuCard + BiteMascot/MascotWrapper
- **Gap:** ไม่มี mascot name/description/scope/active/sort ใน schema · บาง context (empty/error/loading/celebration) ไม่มี role ครบใน MASCOT_ROLES · Admin ต้องใส่ media_url เอง (ยังไม่ผูก uploadMediaAsset)

## D. Theme Inventory

- `--color-brand-*` design tokens 34 vars ใน index.css: primary #F97316 / light #FB923C / dark #EA580C / secondary #FBBF24 / accent #92400E / bg #FFF7ED / surface / text #1C1917 / muted / border / success #22C55E (+warning/danger)
- Components ใช้ tokens → **เปลี่ยนทั้งธีมได้ที่จุดเดียว** แต่จุดนั้นคือ **code** ไม่ใช่ config · theme_color #F97316 ซ้ำใน index.html + manifest
- ไม่มี theme key ใน business_settings · ไม่มี validation/fallback runtime

## E. Media Inventory

- ใช้จริง: public/ static (mascot, logo, icons, og-image.png, fonts, assets/mascot/, assets/reviews/, Qr Code)
- Catalog: products.image_url = base64 9 รูป (~1MB) — CAT-D03 PENDING
- Storage: bucket `bmb-images` ว่าง · media_assets 0 rows · uploadMediaAsset 0 callers

## F. PWA Branding Inventory

| Surface | ค่า | Runtime? |
|---|---|---|
| manifest.json (name/short_name/description/theme_color #F97316/background #FFF7ED/icons favicon เดียว) | BMB hardcoded | **BUILD-TIME STATIC** |
| favicon.svg | static | BUILD-TIME |
| index.html title/description/OG/Twitter/JSON-LD | BMB hardcoded | BUILD-TIME STATIC |
| SeoHelmet.tsx | อ่านจาก seo.ts (hardcoded BRAND) | runtime-render แต่ source = code ไม่ใช่ DB |
| Splash/loading | ไม่มีแยก | — |

→ **เปลี่ยน brand ปัจจุบันต้อง redeploy เสมอ → ยังไม่ใช่ runtime white-label**

## G. Hardcoded Brand Findings

- **ACCEPTABLE (default/seed):** public assets (logo/mascot/favicon/og), MASCOT_ROLES default mapping, index.css token values (default theme), "BMB" ใน AI/log prefix (internal)
- **NOT ACCEPTABLE (customer-facing runtime เปลี่ยนไม่ได้ผ่าน config):** index.html (title/OG/Twitter/JSON-LD/domain), manifest.json, seo.ts (19 refs incl. social URL/domain), หน้า content ลูกค้าที่ฝังชื่อร้านใน copy (HomePage/AboutPage/CheckoutPage/SharePage/SeoHelmet ฯลฯ), **drinksMenu.ts/snacksMenu.ts = STATIC MOCKUP catalog บน HomePage** (name/price/description/รูป — display-only ไม่หยิบลงตะกร้า แต่เป็น customer-facing content ใน code = ขัดหลัก canonical catalog)

## H. Admin Control Matrix

| Area | มี UI? | ต่อ canonical? |
|---|---|---|
| Brand identity | ❌ | — |
| Mascot | ✅ MascotSettingsPage | ✅ (mascot_overrides via RPC) |
| Media | ✅ หน้าเปล่า + lib | ❌ (0 callers) |
| Catalog | ✅ | ✅ (CATALOG AUDIT e9d0c5d) |
| Store info | ✅ AdminSettings | ✅ business_settings |

## I. Customer PWA Runtime Matrix

Mascot = DB override→fallback static (**CONNECTED**) · Theme = code tokens (code static) · Brand text/OG/manifest = build static · Catalog = canonical DB (CONNECTED) · drinks/snacks home section = **static mockup (non-canonical)** · business_settings = DB (CONNECTED, hours/policy keys)

## J. White-label Readiness Matrix

| Area | Current Source | Admin Control | Customer PWA | Runtime Source | Hardcoded? | Multi-brand Ready? | Status |
|---|---|---|---|---|---|---|---|
| Store name | code | ❌ | hardcoded | code | YES | NO | MISSING (runtime) |
| Logo + variants | static file | ❌ | static | code/file | YES | NO | MISSING |
| Favicon/App icon | build static | ❌ | build | build | YES | NO | MISSING |
| Mascot | mascot_overrides + static fallback | ✅ | ✅ | DB→fallback | default only | NO (no scope field) | **CONNECTED** (single-brand) |
| Mascot poses | MASCOT_ROLES (23+14) | ✅ per role | ✅ | DB→fallback | roles list อยู่ใน code | NO | CONNECTED (single-brand) |
| Theme | index.css tokens | ❌ | tokens | code | YES | NO | MISSING (runtime) |
| Typography | ไม่มี config (fonts static) | ❌ | static | code | YES | NO | MISSING |
| Hero/promo images | static + base64 | ❌/part | static/DB | mixed | YES | NO | PARTIAL |
| OG/PWA metadata | build static | ❌ | build | build | YES | NO | MISSING (runtime) |
| Description/contact/hours | บางส่วน DB | ✅ (hours/policy) | บางส่วน | DB+code | YES | NO | PARTIAL |
| Menu/Sections/Categories/Products | canonical DB | ✅ | ✅ | DB | NO | NO (no tenant) | CONNECTED |
| Add-ons | products.addons | ✅ | ✅ | DB | NO | NO | CONNECTED |
| Menu schedule | 039 (inactive) | ❌ | n/a | server | — | NO | DEPLOYED/NOT CONNECTED |
| Availability / Archive | guards / ไม่มี | ✅/❌ | filtered | server | NO | NO | CONNECTED / MISSING |

**WHITE-LABEL READINESS = PARTIAL** (mascot+catalog ใกล้ครบ; brand/theme/PWA-metadata/tenant = MISSING)
**WHITE-LABEL TENANCY FOUNDATION = MISSING** (ไม่มี tenant/store/brand column ในทั้ง 37 ตาราง)

## K. Multi-store / Tenant Readiness

- **ไม่มี tenancy ใด ๆ** — single-store assumption ทั้ง order spine (orders, payment_intents, delivery_assignments), catalog, customers, media
- ถ้าต้อง multi-store: scoping ต้องวางที่ catalog+media+brand+settings+orders+customers+RLS — **เป็น architecture migration ใหญ่ ไม่ใช่ feature**
- Isolation ทดสอบไม่ได้เพราะไม่มี model → ห้ามเรียก multi-tenant/white-label production ready ใด ๆ

## L. Security / RLS

- mascot_overrides: admin ALL(is_admin) / anon SELECT ✅
- business_settings: admin ALL(is_admin) / **anon policy cmd=ALL แต่ qual `false` = deny (ยืนยันจาก pg_policies — safe)** / authenticated SELECT ✅
- media_assets: admin ALL(is_admin) / public SELECT ✅
- ไม่พบ public write จริง · ไม่พบ service_role ใน browser

## M. Duplicate Systems

- **drinksMenu/snacksMenu vs products (DB)** = duplicate product representation บน HomePage (static vs canonical) — ต้อง Owner ตัดสิน (Q4)
- ไม่พบ theme/brand system ซ้ำ · mascot มีชุดเดียว (overrides + static default)

## N. Missing Capabilities

brand_identity config key · theme config + validation/fallback · logo variants + runtime logo source · runtime PWA metadata/OG · mascot ownership metadata (name/scope/active/sort) · media upload ต่อ AdminProducts/AdminMascot · menu/section (CAT-D01) · archive (CAT-D04) · menu schedule UI (CAT-D02) · **tenancy**

## O. Proposed Implementation Gates (placeholder — derive จริงหลัง Owner decisions)

- **WL-01** Brand config (business_settings key `brand_identity` + Admin + PWA runtime read) — ใช้ business_settings ไม่ต้อง migration ใหม่ หรือ ตาราง brands ถ้า Owner เลือก multi-brand foundation (Q2)
- **WL-02** Theme → controlled design tokens จาก config + default/fallback/validation (Q3)
- **WL-03** Media/Logo — รอ CAT-D03 Storage + ต่อ uploadMediaAsset เข้า Brand/Mascot/Product
- **WL-04** Mascot metadata v2 (Q6) + contexts เพิ่ม + ผูก upload
- **WL-05** PWA branding runtime (runtime title/OG; ระบุข้อจำกัด build-time manifest/icon) (Q5)
- **WL-06** Tenant/Store isolation — **ห้ามเริ่มจน Owner ตัดสิน Q1**
- **WL-07** Admin Guide (สร้างแล้วใน audit นี้ — docs/ADMIN_GUIDE_TH.md, ปรับปรุงตาม implementation)
- **WL-08** Runtime E2E (Admin→DB→PWA proof, controlled QA data only)

## P. Dependencies

WL-01..05 รอ Owner Q1–Q6 · WL-03 รอ CAT-D03 · WL-04 ผูก WL-03 · WL-05 จำกัดด้วย build-time surfaces · WL-06 ใหญ่สุด (แยก gate เดี่ยว) · ทับซ้อนกับ CATALOG: CAT-D01..D05 ยัง PENDING — white-label ไม่ขัด catalog decisions แต่ต้องรวมลำดับเป็นชุดเดียวหลัง Owner ตัดสิน

## Q. Owner Decisions Required

| # | Decision | ทางเลือก |
|---|---|---|
| Q1 | **Tenancy model** | A=คง single-store + brand config ชุดเดียวก่อน (ถูกที่สุด) / B=tenant architecture จริง (brands + store scoping + RLS + order spine migration — ใหญ่) |
| Q2 | **Brand config storage** | A=business_settings key `brand_identity` (JSON) / B=ตาราง brands แยก (รองรับ multi-brand ภายหลัง) |
| Q3 | **Theme ownership** | A=controlled design tokens จาก brand config (แนะนำ — กัน UI แตก) / B=คง code (ไม่ทำ config) |
| Q4 | **drinksMenu/snacksMenu static mockup** | A=ย้ายเข้า products (canonical) / B=คง display-only mockup ชั่วคราว |
| Q5 | **PWA metadata strategy** | A=runtime title/OG ผ่าน settings + ยอมรับ manifest/icon ยัง build-time / B=รอ custom-domain/multi-store |
| Q6 | **Mascot ownership schema** | A=extend mascot_overrides เพิ่ม metadata / B=ย้ายไป media_assets + asset_type |

(ค้างเดิม: CAT-D01..D05 — CAT-D03 ผูกกับ WL-03 โดยตรง)

## 🔴 HARD STOP — OWNER DECISION REQUIRED

พบ architecture conflict ระดับต้องตัดสินก่อน: tenancy = MISSING (§K) และ brand runtime config = MISSING (§B/F) — ห้าม implement WL-01..WL-08 และ CAT-01..CAT-06 จนกว่า Owner จะตอบ Q1–Q6 + CAT-D01..D05
