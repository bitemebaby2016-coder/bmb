# Bite Me Baby — Restaurant Commerce & Operations Platform (PWA)

> **สถานะตรวจสอบล่าสุด:** 2026-09-20 · **Commit:** `887944f` · **Production:** https://bitemebaby-5f7.pages.dev + Supabase `ivkdfognyiwjcmrhcnwz`
> **Tests:** 106/106 ผ่าน (วัดจริง 2026-09-20) · **Build:** ผ่าน (tsc strict + vite, PWA sw.js) · **Lint/CI:** ยังไม่มี

## Current Product

PWA สั่งอาหารจริงของร้าน Bite Me Baby (จันทบุรี) — Landing/Menu/Cart/Checkout/Payment (PromptPay/COD/บัตร)/Tracking/Admin Command Center — เป็น **production tenant ลำดับแรก** ของแพลตฟอร์มที่กำลังพัฒนา ราคา/ออเดอร์/การชำระเงินเป็น server-authoritative (Supabase RPC + RLS + Stripe webhook verified)

## Current Production Status (สรุป — รายละเอียด + evidence ใน CURRENT_STATE)

- **ใช้งานจริงแล้ว:** PWA storefront ครบ flow · ออเดอร์ server-authoritative · PromptPay TXN + COD · Stripe webhook (production-verified 6/6 ปี 2026-09-19) · Admin core · PWA install
- **ยังไม่ปิด (Domain A):** pre-order server-side pricing (P0) · บิลบัตรจริงครบวงจร + refund จริง · inventory auto-deduct · ไดรเวอร์จริง (ยัง MOCK) · AI server proxy (key ยังอยู่ใน client) · CI/lint · Lighthouse Perf 29→90
- **สถานะเอกสาร:** ตาม Domain A closure table — "ปิดครบ" ของ Domain A = **BMB Production 100% เท่านั้น ไม่ใช่ SaaS พร้อมขาย**

## Current Phase

**PHASE 0 — TRUTH LOCK: ดำเนินการแล้ว (2026-09-21 — REST-level 48/48 ผ่าน, `e2e/truth-lock-result.json`)** · เหลือ owner รัน `e2e/truth-lock.sql` ใน SQL Editor เพื่อปิด SEC-01 ระดับ SQL (dump `pg_policies` + migration markers) · กำลังทำ **PHASE 1 — MONEY + ORDER** · Roadmap v2: PHASE 0–4 → PWA-100-GATE → REAL-WORLD PILOT → PATCH LOOP → **M1: BMB Production 100%** → PHASE 5–7 → SAAS GATE → PHASE 8–15 → **M2: BMB SaaS Ready**

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
npm test           # vitest — 106 tests (offline in-memory Supabase mock)
npm run build      # tsc + vite build (สร้าง dist/ + sw.js)
```

Env: Supabase URL + anon key, `VITE_OPENROUTER_API_KEY` (⚠️ จะถูกย้ายเข้า server proxy ใน Phase 4 — SEC-02), Stripe keys อยู่ฝั่ง Edge Function env เท่านั้น · E2E/smoke scripts ใน `e2e/` (ดู CURRENT_STATE S-7)

## Document Update Rule

หลัง implement แต่ละ phase: อัปเดต README (ภาพรวม) → CURRENT_STATE (ความจริง + evidence) → MASTER_PRODUCT_SPEC (ถ้า target เปลี่ยน — รวม PRODUCT PATCH mechanism) → CLOSURE_BOOK (ปิด/เปิด item ระบุ Domain) · **ห้ามประกาศความสำเร็จด้วยเอกสาร — พิสูจน์ด้วย evidence** (LIVE/PARTIAL/SKELETON/MISSING/BROKEN/VERIFIED/DEFERRED · Domain B ใช้ TARGET/REQUIRED FOR SAAS/DEFERRED/NOT YET IMPLEMENTED)
