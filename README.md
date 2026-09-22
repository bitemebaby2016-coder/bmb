# Bite Me Baby — Restaurant Commerce & Operations Platform (PWA)

> **สถานะตรวจสอบล่าสุด:** 2026-09-22 · **Commit:** `ed1ac58` (ดู `git log --oneline -1`) · **Production:** https://bitemebaby-5f7.pages.dev + Supabase `ivkdfognyiwjcmrhcnwz`
> **Tests:** 179/179 PASSED (22 files) · **Build:** ผ่าน (tsc strict + vite, PWA sw.js) · **Lint:** 0 errors · **CI: PASS** (GitHub Actions run #15 — Node 24, test+lint+build)
> **DB Migration:** 34/34 LIVE (001–034); **ACL Gate:** PASS (grant probe 7/7, anon residue 0/0)

## Current Product

PWA สั่งอาหารจริงของร้าน Bite Me Baby (จันทบุรี) — Landing/Menu/Cart/Checkout/Payment (PromptPay/COD/บัตร)/Tracking/Admin Command Center — เป็น **production tenant ลำดับแรก** ของแพลตฟอร์มที่กำลังพัฒนา ราคา/ออเดอร์/การชำระเงินเป็น server-authoritative (Supabase RPC + RLS + Stripe webhook verified)

## Current Production Status (สรุป — รายละเอียด + evidence ใน CURRENT_STATE)

- **ใช้งานจริงแล้ว:** PWA storefront ครบ flow · ออเดอร์ server-authoritative · PromptPay TXN + COD · Stripe webhook (production-verified 6/6 ปี 2026-09-19) · Admin core · PWA install
- **Wave 3 Verified (2026-09-22):** Migration 033/034 applied; ACL gate PASS (grant probe 7/7); contracts 023/028/029/030/033 = 5/5 production; REST leak closed; F-5 policies dormant
- **ยังไม่ปิด (Domain A — ตาม CLOSURE_BOOK):** บิลบัตรจริง 1 รายการ (PAY-02) · refund จริง (PAY-03) · Bite Drive real rider flow (RPCs deployed — รอ REAL-WORLD PILOT) · SEC-02 AI key ออกจาก client · Lighthouse Perf ≥ 90 (PWA-01)
- **สถานะเอกสาร:** ตาม Domain A closure table — "ปิดครบ" ของ Domain A = **BMB Production 100% เท่านั้น ไม่ใช่ SaaS พร้อมขาย**

## Current Phase

**PHASE 5-7 + WAVE 1–3 DB Hardening COMPLETE (baseline `ed1ac58`):**
Phase 6/7 UI closure (content-approvals, category headings, image upload, AdminNav, role-based Header) · Phase 4/5 RPCs (AI memory, customer intelligence, content approval workflow) · Wave 1 RLS hardening (005/006) · Wave 2 ACL repair (031/032) · Wave 3 table-ACL alignment (033) + production drift remediation (034) — all verified on production.

**Tests:** 163/163 PASS (21 files) · build PASS (tsc strict + vite + PWA sw.js) · lint 0 errors · **CI PASS** (GitHub Actions run #15 — Node 24).

**Owner status 2026-09-22:** Migration 033+034 applied via `supabase db push` — **34/34 verified production**; Grant probe 7/7 PASS; contracts 023/028/029/030/033 = 5/5 PASS production; REST anon leak CLOSED → NEXT: Await owner instruction for Wave 4 / next phase.

## Future SaaS Direction (ไม่ได้ implement — DEFERRED ทั้งหมด)

เป้าหมายระยะยาว = **Restaurant Commerce & Operations Platform** (Cloud Kitchen / Restaurant / Cafe / Takeaway / Bakery / Food Brand / Catering / Small Chain / Multi-location) — requirement ชุด SaaS (Storefront Builder, Theme Engine, Reservation, QR, Dine-in, CRM/Loyalty, Marketing, Procurement, Analytics, AI Copilot/Forecasting, White-label, Billing, Multi-tenant = 215 items) อยู่ใน **CLOSURE DOMAIN B = DEFERRED** และ **ห้ามบล็อก PWA 100%** — จะเริ่มได้หลัง M1 + REAL-WORLD PILOT + PATCH LOOP ผ่าน SAAS PRODUCTIZATION GATE เท่านั้น

## Master Documents (แหล่งความจริง — Session Continuity)

| เอกสาร | ตอบคำถาม |
|---|---|
| `docs/BMB_CURRENT_STATE_2026-09-20.md` | **วันนี้ระบบมีอะไรจริง?** (LIVE/PARTIAL/MISSING/BROKEN + evidence) |
| `docs/BMB_MASTER_PRODUCT_SPEC.md` | **ระบบต้องเป็นอะไร?** (Domain A target + Domain B SaaS §20) |
| `docs/BMB_100_PERCENT_CLOSURE_BOOK.md` | **อะไรยังต้องทำ?** (Domain A/B + PWA-100-GATE + phase v2 + token plan) |
| `README.md` (ไฟล์นี้) | ภาพรวมสำหรับมนุษย์ |

เอกสารอื่นทั้งหมดใน `docs/` = historical evidence เท่านั้น (ห้ามใช้ประกาศสถานะ) · คู่มือใช้งาน: `docs/BiteMeBaby_ADMIN_GUIDE_TH.md`, `docs/BiteMeBaby_USER_GUIDE.md`

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest — 163 tests (offline in-memory Supabase mock; ต้องมี VITE_SUPABASE_URL/ANON_KEY ใน env)
npm run build      # tsc + vite build (สร้าง dist/ + sw.js)
```

Env: Supabase URL + anon key · AI key อยู่ฝั่ง **server เท่านั้น** (`ai-proxy` Edge Function — SEC-02 verified 2026-09-21: production bundle scan = 0 key hits, client ไม่อ่าน key) · Stripe keys อยู่ฝั่ง Edge Function env เท่านั้น · E2E/smoke scripts ใน `e2e/` (ดู CURRENT_STATE S-7)

## Document Update Rule

หลัง implement แต่ละ phase: อัปเดต README (ภาพรวม) → CURRENT_STATE (ความจริง + evidence) → MASTER_PRODUCT_SPEC (ถ้า target เปลี่ยน — รวม PRODUCT PATCH mechanism) → CLOSURE_BOOK (ปิด/เปิด item ระบุ Domain) · **ห้ามประกาศความสำเร็จด้วยเอกสาร — พิสูจน์ด้วย evidence** (LIVE/PARTIAL/SKELETON/MISSING/BROKEN/VERIFIED/DEFERRED · Domain B ใช้ TARGET/REQUIRED FOR SAAS/DEFERRED/NOT YET IMPLEMENTED)
