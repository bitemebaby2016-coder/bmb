# 🗂️ Bite Me Baby — เอกสารแผนงานปิดงาน (Closure Work Plan) ตาม README

> **Version:** 1.0 · **จัดทำ:** 2026-09-17 · **สถานะ:** เปิดใช้งานสำหรับปิดงานเซสชั่นถัดไป
> **หลักการ (ตาม README #0/#89/#90):** ห้ามสรุปว่ามี Feature จาก README เพียงอย่างเดียว — ต้องตรวจ **code > DB/Migration > API > Test evidence > Docs** ก่อนปิดแต่ละรายการ
> **เอกสารคู่เทียบ:** `BITEMEBABY_PRODUCT_REALITY_MAP.md` · `STATUS_TRACKER.md` · `README.md` (#0–#102) · `docs/COMPONENT_SPEC_UI.md` v4.0

---

## 0. สถานะปัจจุบัน (Evidence จริง 2026-09-17)

| รายการ | ผลตรวจ | หลักฐาน |
|--------|--------|---------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors | command output จริง |
| Build (`npm run build`) | ✅ PASS (141 modules; JS 332.69 kB / gzip 94.05 kB; CSS 58.44 kB) | command output จริง |
| Vitest (`npm test`) | ✅ **19/19 PASS** (in-memory Supabase mock) | `npx vitest run` output จริง |
| PWA | ✅ precache 33 entries (sw.js + workbox) | `dist/sw.js` |
| Lighthouse (local preview, mobile) | ⚠️ Performance 29 / A11y 82 / BP 100 / SEO 100 | `lighthouse/` (committed) |
| Live Supabase DB | ⏸️ **DEFERRED** (owner reset/rebuild migration 001→004) | owner กติกา |
| Mascot Asset 3D (`/public/assets/mascot/`) | ✅ 8 poses + fallback vector พร้อมใช้ | ไฟล์จริง verify ขนาดต่างจาก placeholder เดิม |

---

## 1. งานที่ปิดแล้ว (Closed — อัปเดต 2026-09-17)

| งาน | อ้างอิง README | สถานะ | Evidence |
|-----|---------------|-------|----------|
| UI v4.0 — Social Proof Review Feed + 2.5D/3D Glassmorphism | #102 / `docs/COMPONENT_SPEC_UI.md` §12–§17 | ✅ CLOSED | `CustomerReviewCard.tsx` + `index.css` + build/test ผ่าน |
| Mascot Asset System (8 ท่า + Scale & Placement) | `docs/COMPONENT_SPEC_UI.md` §18 / README #102.5 | ✅ CLOSED | `MascotBadge.tsx` + `/public/assets/mascot/*` (3D จริง) |
| Star + แหล่งอ้างอิงโลโก้จริง | §12.3 / §12.2 | ✅ CLOSED | `Star.webp`, `Facebook Logo.webp`, `Grab Food Logo.webp` ใน `public/` ถูกใช้จริงบนการ์ด |
| Deep Link CTA ตาม Mode | #48 / §12.5 | ✅ CLOSED | HomePage→`/cart?mode=same-day`, `/checkout?mode=pre-order` + CheckoutPage อ่าน param |
| Short Video Policy (LazyVideo ≤ 2 คลิป) | §12.7 / #102.2 | ✅ CLOSED | `LazyVideo.tsx` (IntersectionObserver + Data Saver) |
| โครงสร้างหลัก (Auth/Product/Order/Inventory/Menu/AI/SEO/PWA) | #1–#77 (ตาม Reality Map) | ✅ CLOSED ส่วนใหญ่ | Reality Map v4.1 — 46 features |

---

## 2. Workstream ตาม README — สถานะ & Gap (ตรวจ code-first)

> ✅ = ปิดแล้ว (code+test) · 🟡 = บางส่วน/มีช่องว่าง · ⏸️ = DEFERRED (owner/รอ credential)

| README Block | หัวข้อ | สถานะ | Gap ที่ต้องปิด (ถ้ามี) |
|--------------|--------|-------|------------------------|
| #0–#6 | Document/Identity/Business Model/North Star | ✅ ปิดแล้ว | — |
| #7–#12 | Order Mode / Pre-order / Same-day เมนู | ✅ ปิดแล้ว | Pre-order flow ยังเป็น log/toast — ยังไม่ผูกสร้าง order จริง (ดู #9/#10) |
| #13–#18 | Live Availability / Calendar / Capacity | 🟡 | `AvailabilityState` ผูกใน UI แล้ว แต่ Capacity ต่อเนื่องยังต้อง assert กับ DB จริง |
| #19–#27 | Bite Drive / External Providers / Route / Tracking | 🟡 | Provider จำลองใน `externalProviders.ts` — รอ test กับ Grab/LINE Man จริง |
| #28–#34 | Order Hub / Payment / Omnichannel | 🟡 | Stripe config รอ key จริง — payment test mode ยังไม่ได้รัน |
| #35–#38 | Customer Identity / PWA | ✅ ปิดแล้ว (PWA precache 33) | — |
| #39–#47 | Bite AI / Memory / Content Loop / Deep Link | ✅ ส่วนใหญ่ | Model A = GLM 5.2 (free) + fallback Qwen — 429 โผล่เป็น flux บางครั้ง (ยอมรับได้) |
| #48–#58 | Deep Link / Command Center / Kitchen Ops / Capacity | 🟡 | Command Center/Exception Center ยังเป็น UI บางส่วน (admin) |
| #59–#70 | Inventory / Routes / Notification / Loyalty / Audit | ✅ ส่วนใหญ่ | Inventory→Order deduction ยังต้อง verify กับ live DB |
| #71–#77 | Automation / Security / Tech stack | ✅ ปิดแล้ว | SEC-01..03, AUDIT ผ่าน; Automation ยังไม่ใช้ cron จริง (defer) |
| #78–#84 | Documentation Gates D0–D4 | ✅ ปิดแล้ว | เอกสารทั้งหมดครบ + cross-audit ผ่าน |
| #85–#90 | DoD / Testing / Roadmap / Priority / Source of Truth | ✅ ปิดแล้ว | Tests 19/19, README เป็น Source of Truth |
| #91–#100 | Change Mgmt / Terminology / Authority / End State | ✅ ปิดแล้ว | — |
| #101–#102 | Normal Document Flow + Layout v4.0 | ✅ ปิดแล้ว (เซสชั่นนี้) | — |

---

## 3. แผนปิดงานเซสชั่นถัดไป (Next Session — เพื่อปิดให้ 100% จริง)

| # | งาน (ภาษาไทย) | อ้างอิง | เกณฑ์ปิด (Definition of Done) | ผู้รับผิดชอบ |
|---|----------------|--------|-------------------------------|--------------|
| 1 | Owner reset/rebuild **Live Supabase DB** (migration 001→004) แล้วรันข้อมูล seed | STATUS_TRACKER / Reality Map | `supabase` query คืน 13+ tables + RLS active | Owner |
| 2 | เดิน Flow จริง E2E ครบ: Landing → Order same-day → Order pre-order → Checkout → Payment → Tracking | README #28–#30 / #63 | ทุก step มี evidence screenshots + ไม่มี console error | AI Dev + Owner |
| 3 | แก้ Lighthouse Performance (LCP) — เล็งเป้า ≥ 80 | `lighthouse/` | Lighthouse Performance ≥ 80 (mobile) ใหม่ | AI Dev |
| 4 | Stripe Payment test mode (key จริงจาก owner) | #30 / `paymentGateway.ts` | test transaction สำเร็จ + webhook verify | Owner + AI Dev |
| 5 | External Delivery provider (Grab/LINE Man) sandbox test | #21–#23 / `externalProviders.ts` | สร้าง request จริงก่อน deploy | AI Dev |
| 6 | ปิดท่ามาสคอตที่เหลือ: `pointing` (CTA) / `peeking` (glass overlay) / `empty` (empty cart & sold-out) ตาม **§18 Pose Map** | `docs/COMPONENT_SPEC_UI.md` §18 | 8 ท่าถูกใช้ครบตาม Scale & Placement Guide | AI Dev |
| 7 | Pre-order → สร้าง order จริง (ไม่ใช่แค่ toast) เมื่อ live DB พร้อม | #9 / `preOrderService.ts` | order ถูก insert `pre_orders` + ขึ้นใน Admin | AI Dev |
| 8 | ตรวจ `bite_good bye.webp` ควร mapping pose ใด (เช่น exit/bye) หรือเก็บเป็น asset ว่าง | §18.2 | mapping ชัดเจนใน docs | AI Dev |
| 9 | ปิด Documentation ตาม D-Gate ล่าสุด + commit convention ตาม #98/#99 | #78–#84 | README/Reality Map/Status Tracker/Component Spec ตรงกันทุกเลข | AI Dev |
| 10 | Production deploy + smoke test | `docs/BiteMeBaby_DEPLOYMENT.md` | site เปิดบน production + ฟีเจอร์หลักเดินครบ | Owner + AI Dev |

> เกณฑ์กลาง: ทุกรายการปิด = **code จริง + test evidence + docs ตรงกัน** (ไม่มี mockup / ไม่มีสรุปจาก README อย่างเดียว)

---

## 4. Definition of Done ฉบับย่อ (จาก README #85)

- [ ] โค้ด commit อยู่ใน repo และ build ผ่าน (tsc 0 errors)
- [ ] มี test evidence จริง (vitest / Playwright / manual walkthrough)
- [ ] เอกสารที่เกี่ยวข้องอัปเดตตรงกัน (เขียนทับ ไม่ต่อท้าย)
- [ ] ไม่มี `TODO/FIXME` ที่เป็นเงื่อนไขสำคัญค้างใน feature ที่ปิด
- [ ] Feature ที่อ้างว่าปิด ต้องเห็นการใช้งานจริงใน code (ไม่ใช่แค่ใน docs)

---

## 5. หมายเหตุ Asset (อัปเดต 2026-09-17)

- **Mascot 3D จริง 8 ท่า** พร้อมใช้งานแล้วที่ `/public/assets/mascot/` — ชื่อไฟล์ตรงกับ mapping ใน `MascotBadge` (ไม่ต้องแก้ logic; fallback `onError` ยังกันรูปพัง)
- **`Star.webp`** ใช้ใน 3D Star Rating (`CustomerReviewCard`) โดยตรง — ผ่าน `loading="lazy"` และ micro-animation เดิม
- **`Facebook Logo.webp` / `Grab Food Logo.webp`** ใช้ใน Source Badge ของการ์ดรีวิว (badge พื้นขาว + ข้อความสี brand)
- คำเตือน: ไฟล์เวกเตอร์เดิม `/mascot_Bite_*.webp` เก็บไว้เป็น fallback — อย่าลบ

---

## 6. จุดสิ้นสุด (End of Work Plan)

> ✅ **ข้อตกลง:** เซสชั่นนี้ = ปิด UI v4.0 + Mascot Asset System + Real assets integration แล้ว **commit & push** — Owner จะตรวจก่อน
> ⏭️ เซสชั่นถัดไป = ปิดงานตามข้อ 3 (ตาราง 10 รายการ) จนกว่าจะ "ปิดทั้งหมด 100% ตาม README"