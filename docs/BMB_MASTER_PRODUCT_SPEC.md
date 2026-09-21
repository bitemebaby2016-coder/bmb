# BMB_MASTER_PRODUCT_SPEC.md

> **Version:** 2.0 (Scope Revision: Restaurant Commerce & Operations Platform — 2026-09-20) · **Commit base:** `6be8e30`
> **บทบาทเอกสารนี้:** "ระบบ BMB ต้องเป็นอะไรเมื่อ product target สำเร็จ" — ไม่ใช่สถานะปัจจุบัน
> สถานะปัจจุบันอยู่ที่ `BMB_CURRENT_STATE_2026-09-20.md` · สิ่งที่ยังต้องทำอยู่ที่ `BMB_100_PERCENT_CLOSURE_BOOK.md`
> ห้ามเขียน target ให้ดูเหมือนมี implementation แล้ว ทุก requirement ระบุคลาส: **REQUIRED / OPTIONAL / DEFERRED**
> ข้อกำหนดต้นฉบับ 100 หัวข้อ: `docs/Bite Me Baby — เอกสารข้อกำหนดโปรเจกต์ฉบับสมบูรณ์.txt` (historical input ของเอกสารนี้)

---

## 0. Product Definition (FINAL PRINCIPLE)

> **A production-first Cloud Kitchen Operating Platform, with Bite Me Baby as the first real operating kitchen.**

ลำดับความสำคัญ (บังคับใช้ทุกการตัดสินใจ):

```text
REAL BUSINESS > REAL ORDERS > REAL KITCHEN > REAL DELIVERY > REAL DATA > AI > AUTOMATION > WHITE-LABEL
```

- ห้ามให้ visual/AI novelty กลายเป็น P0 ถ้าไม่กระทบ business-critical flow
- AI = ผู้ช่วย (conversation/recommendation) — **SYSTEM = authority** (price/stock/payment/order/delivery/rules)
- สถานะปัจจุบันของทุก subsystem อ้างอิงจาก CURRENT_STATE เท่านั้น (ห้ามสรุปจากชื่อไฟล์)

## 1. CUSTOMER STOREFRONT (PWA)

- **CURRENT:** LIVE — Landing/Menu/Product/Cart/Checkout/Payment/Tracking/Orders/Profile ใช้งานจริง + e2e ผ่าน
- **TARGET (REQUIRED):** เส้นทางเดียวที่ลูกค้าทุก channel (social/Grab/walk-in) สั่งซื้อ-ติดตามได้จริงบนมือถือ; offline-tolerant UX; error/retry states ครบ; Lighthouse Perf ≥ 90 (ปัจจุบัน 29)
- **OPTIONAL:** Random menu, Viral/Share, vote system

## 2. AUTHENTICATION & ACCOUNTS

- **CURRENT:** LIVE — Supabase Auth (email+password, phone-pattern, quick-login ผ่าน EF `phone-auto-login`), auto-profile role='customer', admin role จาก `profiles`
- **TARGET (REQUIRED):** identity ทุก channel เชื่อม `customers` record เดียว (phone unique), ไม่มี pattern hack (`@phone.bmb.local`), recovery flow ครบ
- **OPTIONAL:** OTP/SMS provider จริง, LINE OA login

## 3. MENU / CATALOG / AVAILABILITY

- **CURRENT:** LIVE — products/categories/add-ons (016) + availability engine (quota+cutoff) + admin CRUD; **category headings (ชื่อหมبق الغذاء) managed from `/admin/products` (PHASE 6, 2026-09-21)**
- **TARGET (REQUIRED):** availability จาก **recipe/BOM + inventory จริง** ไม่ใช่ manual toggle เท่านั้น; ราคา add-on re-derive ฝั่ง server
- **OPTIONAL:** รูปอาหาร AI-generated (มี media library รองรับ), multi-language

## 4. CART & CHECKOUT

- **CURRENT:** LIVE — versioned cart (v1/v2) + isolation modal + order builder + server-authoritative order creation (007)
- **TARGET (REQUIRED):** flow เดียวสำหรับ same-day + pre-order โดย **ทั้งสองโหมดผ่าน server-side pricing** (pre-order ยังไม่ผ่าน — S-2); promotion code ตรวจฝั่ง server; delivery fee จาก `delivery_zones` ฝั่ง server

## 5. PAYMENT

- **CURRENT:** webhook Stripe VERIFIED · PromptPay offline-reference LIVE · COD LIVE · Refund EF พร้อม-ยังไม่พิสูจน์ · card loop ขาดหลักฐานบิลจริง
- **TARGET (REQUIRED):** บัตรครบวงจร 1 บิลจริง (create-checkout → Stripe.js confirm → webhook → paid) + refund จริง 1 รายการ · PromptPay TXN + admin confirm ตามปัจจุบัน (**bank auto-verification = OPTIONAL ไม่ block closure**) · ทุก method idempotent + amount-match + ตรวจย้อนหลังได้
- **DEFERRED:** TrueMoney/wallet อื่น

## 6. ORDER (SPINE)

- **CURRENT:** LIVE server-side allow-list + trigger + capacity lock + cancel/fail rules; แต่ vocabulary ซ้อน 3 ชั้น (server enum / client chain / provider enum)
- **TARGET (REQUIRED):** state machine ชุดเดียว (canonical vocabulary + mapping ชัดเจน), ทุก transition มี audit ฝั่ง server, cancel/fail กระทบ capacity + inventory ถูกต้อง
- **OPTIONAL:** auto-accept rules, cutoff ยืดหยุ่นต่อวัน

## 7. KITCHEN OPERATIONS

- **CURRENT:** PARTIAL — rounds+capacity+cutoff; ไม่มี batch/production
- **TARGET (REQUIRED):** วงจร `ORDER→CAPACITY→BATCH→KITCHEN→READY→DELIVERY`: production queue แยกจาก order queue, batch ต่อ round, สถานะเตรียมอาหารต่อ batch, handoff ไป delivery
- **OPTIONAL:** prep-time prediction, kitchen display auto-sort

## 8. INVENTORY

- **CURRENT:** PARTIAL — ตาราง+admin+transactions; **ไม่มี auto-deduct**
- **TARGET (REQUIRED):** หักสต็อกอัตโนมัติเมื่อ order ยืนยัน (server-side), low-stock → auto ปิดขายเมนูที่เกี่ยว, คืนสต็อกเมื่อ cancel, transactions ผูก user/audit ฝั่ง DB
- **OPTIONAL:** forecasting อัตโนมัติ (มี heuristic แล้ว), purchasing/PO

## 9. DELIVERY / BITE DRIVE

- **CURRENT:** pricing logic LIVE; drivers MOCK; external = sandbox/mockup; fee ยังไม่ authoritative จาก `delivery_zones` ใน RPC
- **TARGET (REQUIRED):** `Customer Address → Distance → Zone → Fee → Method → Round → Driver → Route`: fee จาก zones ฝั่ง server, ไดรเวอร์จริง (rider PWA รับงาน/อัปเดตสถานะ), tracking ลูกค้าจาก unified state
- **OPTIONAL/DEFERRED:** live Grab/LINEMAN API (รอ keys/contract จาก call-center — ปัจจุบัน sandbox), multi-vehicle route optimization

## 10. BITE AI (SERVICE STAFF)

- **CURRENT:** VERIFIED ส่วน chat — chat จริงผ่าน **ai-proxy EF** (key server-side, production bundle ไม่มี key — ตรวจ 2026-09-21) + fallback Qwen; tools = **SKELETON** (`aiToolCalling.ts` มี definitions แต่ไม่มี component เรียกใช้ — ไม่ถูก bundle); get_order await แก้แล้ว (ตรวจ 2026-09-21)
- **TARGET (REQUIRED):** AI ผ่าน **server proxy** (ไม่มี key ใน bundle), guardrails ทดสอบได้ (ห้ามค้างราคา/สั่งเกิน stock — AI แนะนำได้ แต่การกระทำต้องผ่าน RPC ที่ enforce กฎ), memory ฝั่ง server ต่อ customer, fallback chain คงเดิม
- **OPTIONAL:** voice, pro-active nudges, AI ช่วยจัด promotion

## 11. CUSTOMER INTELLIGENCE

- **CURRENT:** PARTIAL — heuristic client-side + customers table + loyalty (client store)
- **TARGET (REQUIRED):** profile/history/preferences/frequency/AOV/segmentation คำนวณฝั่ง server (view/scheduled job), timeline ต่อลูกค้าใน admin, ผลลัพธ์ feed recommendation
- **DEFERRED:** ML ranking, churn model

## 12. CONTENT / GROWTH

- **CURRENT:** PARTIAL — contentAutomation/socialProof/promotions/banner (016) ฝั่ง client+admin
- **TARGET (REQUIRED):** AI content ต้องมี **approval workflow ก่อน publish** เสมอ (ห้าม auto-publish), campaign→analytics (conversion วัดจาก orders จริง)
- **OPTIONAL:** scheduler โพสต์, A/B copy

## 13. ADMIN / COMMAND CENTER

- **CURRENT:** LIVE core; audit log client-side; ไม่มี error/exception feed
- **TARGET (REQUIRED):** เห็นครบในจอเดียว: Today's Orders / Kitchen / Capacity / Inventory / Payments / Delivery / Customers / AI / **Errors+Exceptions** / Analytics; audit log ฝั่ง DB; เปลี่ยน mascot/brand assets เองได้ (ADMIN-07 — owner อนุมัติ 2026-09-20, ทำใน Phase 4)
- **OPTIONAL:** mobile admin app

## 14. NOTIFICATIONS

- **CURRENT:** notificationStore + dropdown มี; ไม่มี center แยกประเภท
- **TARGET (REQUIRED):** Transactional (order milestones จาก unified state) / Marketing / Bite / Operational แยกช่อง + เปิด-ปิดต่อช่อง
- **OPTIONAL:** web-push

## 15. PWA / PERFORMANCE

- **CURRENT:** installable + precache จริง; Lighthouse Perf 29
- **TARGET (REQUIRED):** Perf ≥ 90 บนมือถือจริง (code-split หน้าหนัก, ลดขนาด supabase chunk, image strategy), offline fallback ครอบคลุมหน้าหลัก, error boundary ครบ
- **OPTIONAL:** background sync สำหรับ offline orders

## 16. SECURITY & COMPLIANCE

- **CURRENT:** RLS secure + EF ปลอดภัยระดับดี; ค้าง S-1/S-3/S-4/S-5/S-6 (ดู CURRENT_STATE §15)
- **TARGET (REQUIRED):** ปิด S-1 (AI proxy), ยืนยัน/แก้ S-3 (orders anon read บน live DB), audit server-side, retire legacy key env name, consent capture (PDPA) เพิ่มจากหน้า privacy/terms ที่มีอยู่
- **OPTIONAL:** rate limiting ต่อ EF

## 17. WHITE-LABEL PLATFORM

- **CURRENT:** ยังไม่มี (single-tenant, brand/config บางส่วนใน `platformConfig.ts`)
- **TARGET (DEFERRED → Phase 8):** multi-tenant (tenant_id + RLS isolation, brand config ต่อ tenant, onboarding, platform billing)
- **กฎ:** ห้าม refactor สู่ platform ก่อน Phase 1–5 เสร็จ (dogfood ต้องแข็งแรงก่อน)

## 18. Priority Classes (ใช้กับทุก requirement)

| Class | ความหมาย |
|---|---|
| **P0** | เงิน/ออเดอร์/ความปลอดภัย/ความถูกต้องข้อมูล |
| **P1** | จำเป็นต่อ operation จริงทุกวัน |
| **P2** | ประสบการณ์ลูกค้า/ประสิทธิภาพ |
| **P3** | growth/intelligence/optimization |
| **P4** | future/white-label/automation ขั้นสูง |

Mascot/visual = P2 เสมอ (ห้ามขึ้น P0 ตามกฎข้อนี้)

---

## 19. PRODUCT DIRECTION v2 — Restaurant Commerce & Operations Platform (2026-09-20)

เป้าหมายระยะยาวขยายจาก "Cloud Kitchen Ordering Platform" เป็น:

> **Restaurant Commerce & Operations Platform** — รองรับ Cloud Kitchen / Restaurant / Cafe / Takeaway / Bakery / Food Brand / Catering / Small Chain / Multi-location

**TWO MILESTONES (ห้ามหลอมรวมกันเด็ดขาด):**

| Milestone | นิยาม | สถานะ ณ 2026-09-20 |
|---|---|---|
| **M1 — BMB PRODUCTION 100%** | Bite Me Baby เดินธุรกิจจริงผ่านแพลตฟอร์มได้อย่างน่าเชื่อถือ (Domain A ปิดครบ + PWA-100-GATE PASS + pilot + patch loop) | กำลังดำเนิน (ดู Closure Book Domain A) |
| **M2 — BMB SAAS READY** | ร้านที่สอง onboard และเดินร้านได้จริงโดยไม่ต้องแก้ code เฉพาะ BMB (Domain B ปิดตาม SaaS-Ready definition) | ยังไม่เริ่ม (DEFERRED) |

**HARD RULE (ข้อ 32 ของคำสั่ง):** ข้อกำหนด Future SaaS ทั้งหมด (Reservation/Theme/QR/Builder/Catering/AI Forecasting ฯลฯ) **ห้าม** กลายเป็นเงื่อนไขของ PWA 100% เว้นแต่ธุรกิจจริงของ BMB ปัจจุบันต้องใช้ — ลำดับที่ถูกต้องคือ:

```text
PWA CORE → 100% PRODUCTION COMPLETE → REAL-WORLD USE → FEEDBACK → PATCH/IMPROVEMENT → SAAS PRODUCTIZATION
BUILD → VERIFY → USE IN REAL BUSINESS → LEARN → PATCH → STABILIZE → PRODUCTIZE → MULTI-TENANT → SELL
```

## 20. FUTURE SAAS PRODUCT REQUIREMENTS (Domain B)

> **สถานะที่อนุญาตใน section นี้ มีเพียง 4 ค่า:** `TARGET` · `REQUIRED FOR SAAS` · `DEFERRED` · `NOT YET IMPLEMENTED`
> **ห้าม** ใช้ LIVE/COMPLETE กับ section นี้ จนกว่า Domain A ปิด + SaaS Productization Gate ผ่าน
> ค่าเริ่มต้นของทุก item: **TARGET · NOT YET IMPLEMENTED** — ถ้ามีพื้นฐานใน Domain A (เช่น cart/payment ของ BMB เอง) จะระบุเป็นหมายเหตุ "พื้นฐานใน Domain A: …" เท่านั้น ไม่ใช่การ implement แบบ generic

### 20.1 PILLAR A — COMMERCE (COM)

`- COM-001 Storefront · COM-002 Menu · COM-003 Product Detail · COM-004 Cart · COM-005 Checkout · COM-006 Payment · COM-007 Pickup · COM-008 Delivery · COM-009 Dine-in · COM-010 Catering`

- COM-001..008: **REQUIRED FOR SAAS** (พื้นฐานใน Domain A: PWA storefront/cart/checkout/payment LIVE ของ BMB เอง — แต่ยัง hardcode ร้านเดียว → generic tenant version = NOT YET IMPLEMENTED)
- COM-009 Dine-in, COM-010 Catering: **DEFERRED** (Phase 10)

### 20.2 TABLE RESERVATION (RES) — 25 requirements

`RES-001 Reservation Engine · RES-002 Table Management · RES-003 Zone Management · RES-004 Floor Plan · RES-005 Table Capacity · RES-006 Time Slots · RES-007 Opening Hours · RES-008 Booking Cutoff · RES-009 Party Size Rules · RES-010 Buffer Time · RES-011 Confirmation · RES-012 Cancellation · RES-013 Reschedule · RES-014 No-show · RES-015 Walk-in · RES-016 Waitlist · RES-017 Customer Notes · RES-018 Special Occasion · RES-019 Reminder · RES-020 Check-in · RES-021 Table Assignment · RES-022 Multi-location · RES-023 Reservation Analytics · RES-024 Reservation Rules · RES-025 Deposit/Prepayment`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 10** (RES-022/023 ผูก Phase 8/12)
- **ต้อง integrate กับ:** Customer / Order / Kitchen Capacity / Inventory Forecast / Analytics — เมื่อ implement (ยังไม่ทำตอนนี้)

### 20.3 THEME / BRAND EXPERIENCE ENGINE (THEME) — 24 requirements

`THEME-001 Logo · THEME-002 Primary Color · THEME-003 Secondary Color · THEME-004 Accent Color · THEME-005 Typography · THEME-006 Button Style · THEME-007 Card Style · THEME-008 Navigation · THEME-009 Hero · THEME-010 Menu Layout · THEME-011 Product Card · THEME-012 Checkout UI · THEME-013 Reservation UI · THEME-014 Order Tracking UI · THEME-015 Custom Sections · THEME-016 Banner · THEME-017 Promotion Blocks · THEME-018 Social Links · THEME-019 Favicon · THEME-020 SEO Metadata · THEME-021 Open Graph · THEME-022 Theme Presets · THEME-023 Preview · THEME-024 Publish`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 9**
- กฎ: ใช้ **Design Tokens** — ร้านต้องไม่แก้ raw CSS · flow: `Theme Preset → Customization → Preview → Publish`
- หมายเหตุ: mascot self-service ของ BMB (ADM-07, Domain A Phase 4) เป็นต้นแบบ subset — ไม่ใช่ theme engine

### 20.4 DIGITAL STOREFRONT BUILDER (SITE) — 14 requirements

`SITE-001 Storefront · SITE-002 Page Builder · SITE-003 Section Builder · SITE-004 Navigation Builder · SITE-005 Landing Page · SITE-006 Menu Page · SITE-007 Reservation Page · SITE-008 About · SITE-009 Gallery · SITE-010 Contact · SITE-011 SEO · SITE-012 Custom Domain · SITE-013 Preview · SITE-014 Publish/Unpublish`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 9** (SITE-012 Custom Domain ผูก WL-002/003 → Phase 8/15)

### 20.5 QR MENU + QR ORDERING (QR) — 7 requirements

`QR-001 Digital Menu QR · QR-002 Table QR · QR-003 Table Ordering · QR-004 Dynamic QR · QR-005 QR Analytics · QR-006 QR Regeneration · QR-007 Table Identification`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 9/10**
- QR ต้องระบุ `tenant → location → table` (เมื่อ LOC มีจริง)

### 20.6 DINE-IN ORDER DESK (DINE) — 9 requirements (ไม่สร้าง hardware POS)

`DINE-001 Open Table · DINE-002 Table Order · DINE-003 Add Order · DINE-004 Split Order · DINE-005 Merge Order · DINE-006 Void · DINE-007 Bill · DINE-008 Payment Status · DINE-009 Table Status`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 10** (lightweight Order Desk เท่านั้น)

### 20.7 CUSTOMER / CRM (CRM) — 10 requirements

`CRM-001 Customer Profile · CRM-002 Customer Timeline · CRM-003 Membership · CRM-004 Loyalty Points · CRM-005 Tier · CRM-006 Rewards · CRM-007 Coupon · CRM-008 Birthday Reward · CRM-009 Visit Frequency · CRM-010 Segmentation`

- CRM-001/002/009/010: **REQUIRED FOR SAAS** (พื้นฐานใน Domain A: customers table + CI-01) · CRM-003..008: **DEFERRED → Phase 11**
- Loyalty ปัจจุบันของ BMB ยังเป็น client store (Domain A เปิด) — generic CRM ยัง NOT IMPLEMENTED

### 20.8 MARKETING AUTOMATION (MKT) — 8 requirements

`MKT-001 Campaign · MKT-002 Audience · MKT-003 Segmentation · MKT-004 Coupon · MKT-005 Promotion · MKT-006 Scheduled Campaign · MKT-007 Campaign Analytics · MKT-008 Conversion Tracking`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 11** · **การ publish ต้องมี governance/approval ชัดเจนเสมอ** (AI ช่วย generate content ภายหลังได้ แต่ห้าม auto-publish)

### 20.9 CUSTOMER FEEDBACK / REVIEW (REV) — 9 requirements

`REV-001 Order Feedback · REV-002 Rating · REV-003 Food Rating · REV-004 Service Rating · REV-005 Delivery Rating · REV-006 Value Rating · REV-007 Issue Ticket · REV-008 Resolution · REV-009 Customer Recovery`

- REV-002: พื้นฐานใน Domain A (reviews table + reviewApi มีจริง) → generic ยัง NOT IMPLEMENTED · REV-001..006 **REQUIRED FOR SAAS → Phase 11** · REV-007..009 **DEFERRED → Phase 11**

### 20.10 CATERING / EVENT ORDERS (CAT) — 9 requirements

`CAT-001 Catering Inquiry · CAT-002 Event Date · CAT-003 Guest Count · CAT-004 Package · CAT-005 Custom Menu · CAT-006 Quote · CAT-007 Deposit · CAT-008 Production Schedule · CAT-009 Delivery Schedule`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 10** (CAT-008/009 ต้องผูก KIT/DEL ของ Domain A เมื่อ implement)

### 20.11 MULTI-LOCATION (LOC) — 10 requirements

`LOC-001 Location · LOC-002 Location Settings · LOC-003 Location Menu · LOC-004 Location Hours · LOC-005 Location Staff · LOC-006 Location Inventory · LOC-007 Location Kitchen · LOC-008 Location Delivery · LOC-009 Location Analytics · LOC-010 Location Switching`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 8** · hierarchy เป้าหมาย: `Platform → Tenant → Brand → Location` — **ห้ามสมมติว่า code ปัจจุบันมีอยู่แล้ว** (ปัจจุบัน single-tenant ทั้งระบบ)

### 20.12 STAFF / IAM (IAM) — 8 requirements

`IAM-001 Staff Account · IAM-002 Role · IAM-003 Permission · IAM-004 Location Permission · IAM-005 Invite Staff · IAM-006 Remove Staff · IAM-007 Audit Log · IAM-008 Session Management`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 8** · role ผู้เข้าเกณฑ์: Owner/Manager/Kitchen/Cashier/Waiter/Driver/Marketing — **ต้องออกแบบ permission matrix ก่อน implement** (พื้นฐานใน Domain A: profiles.role + is_admin() — ยัง 2 role เท่านั้น)

### 20.13 PROCUREMENT / INVENTORY INTELLIGENCE (INV-PRO) — 10 requirements

`INV-PRO-001 Ingredient · INV-PRO-002 Recipe · INV-PRO-003 Stock · INV-PRO-004 Stock Movement · INV-PRO-005 Supplier · INV-PRO-006 Purchase Order · INV-PRO-007 Receiving · INV-PRO-008 Cost · INV-PRO-009 Waste · INV-PRO-010 Food Cost`

- INV-PRO-001..004: **REQUIRED FOR SAAS** — พื้นฐานสร้างใน **Domain A Phase 2** แล้ว (INV-01/KIT-02) → generic version = NOT YET IMPLEMENTED
- INV-PRO-005..010: **DEFERRED → Phase 10** · ต้องเชื่อมวงจร `Order → Recipe → Ingredient → Stock → Purchase Requirement`

### 20.14 ANALYTICS (ANA) — 14 requirements

`ANA-001 Revenue · ANA-002 Orders · ANA-003 AOV · ANA-004 Repeat Rate · ANA-005 Top Menu · ANA-006 Menu Performance · ANA-007 Food Cost · ANA-008 Gross Margin · ANA-009 Delivery Cost · ANA-010 Customer Acquisition · ANA-011 Reservation Metrics · ANA-012 No-show Metrics · ANA-013 Kitchen Capacity · ANA-014 Location Analytics`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 12** (ANA-011/012 ผูก RES, ANA-014 ผูก LOC, ANA-007/008 ผูก INV-PRO-008/010)

### 20.15 AI BUSINESS COPILOT (AI-BIZ) — 8 requirements

`AI-BIZ-001 Business Q&A · AI-BIZ-002 Sales Analysis · AI-BIZ-003 Menu Analysis · AI-BIZ-004 Margin Analysis · AI-BIZ-005 Customer Analysis · AI-BIZ-006 Inventory Recommendation · AI-BIZ-007 Capacity Recommendation · AI-BIZ-008 Daily Business Brief`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 12**
- **กฎเหล็ก:** AI อ่านข้อมูล canonical เท่านั้น และ **ห้ามเป็น authority** ต่อ price/stock/payment/order/delivery/permissions (สอดคล้อง §0 และ Domain A AI-02)

### 20.16 AI FORECASTING (AI-FC) — 6 requirements

`AI-FC-001 Demand Forecast · AI-FC-002 Prep Recommendation · AI-FC-003 Inventory Forecast · AI-FC-004 Capacity Forecast · AI-FC-005 Reservation Forecast · AI-FC-006 Delivery Demand Forecast`

- ทั้งหมด **TARGET · DEFERRED → Phase 12** — **ห้าม implement จนกว่าจะมี production data เพียงพอ** (data-driven gating)

### 20.17 WHITE-LABEL / CUSTOM DOMAIN (WL) — 8 requirements

`WL-001 Tenant Branding · WL-002 Custom Domain · WL-003 Subdomain · WL-004 Favicon · WL-005 Metadata · WL-006 Tenant Theme · WL-007 Tenant Assets · WL-008 Tenant Email Identity`

- ทั้งหมด **TARGET · NOT YET IMPLEMENTED · DEFERRED → Phase 8/15**

### 20.18 SAAS PLATFORM (SAAS) — 26 requirements

`SAAS-001 Multi-tenancy · SAAS-002 Tenant isolation · SAAS-003 Tenant onboarding · SAAS-004 Tenant configuration · SAAS-005 Tenant billing · SAAS-006 Subscription plans · SAAS-007 Usage metering · SAAS-008 Payment isolation · SAAS-009 AI usage isolation · SAAS-010 Delivery usage isolation · SAAS-011 Tenant analytics · SAAS-012 Tenant admin · SAAS-013 Platform admin · SAAS-014 Feature flags · SAAS-015 Plan entitlements · SAAS-016 Upgrade · SAAS-017 Downgrade · SAAS-018 Cancellation · SAAS-019 Data export · SAAS-020 Data deletion · SAAS-021 Backup/recovery · SAAS-022 Audit logs · SAAS-023 Rate limiting · SAAS-024 Abuse protection · SAAS-025 Billing failure handling · SAAS-026 Multi-tenant production verification`

- SAAS-001..004, 014, 022, 023: **REQUIRED FOR SAAS → Phase 8** · SAAS-005..013, 015..021, 024..025: **DEFERRED → Phase 13** · SAAS-026: **REQUIRED FOR SAAS → Phase 14** (Second Tenant Pilot)

### 20.19 SaaS-Ready Definition (ผลลัพธ์ของ Milestone 2)

ร้านที่สองต้องทำวงจรนี้ได้ **โดยไม่ต้องมี developer แทรกแซงในการใช้งานปกติ:**

```text
Sign Up → Create Restaurant → Brand Restaurant → Create Menu → Configure Hours →
Configure Delivery → Configure Tables → Accept Orders → Accept Reservations →
Manage Kitchen → Manage Customers → Use Analytics → Use AI → Receive Payments →
Pay BMB Subscription → Upgrade/Downgrade → Export Data → Cancel
```

---

**End of Master Product Spec v2 — Domain B ทุก item ถูกส่งต่อเป็น DEFERRED tree ใน `BMB_100_PERCENT_CLOSURE_BOOK.md` (CLOSURE DOMAIN B) — ห้าม implement ก่อน PWA-100-GATE ผ่าน**

