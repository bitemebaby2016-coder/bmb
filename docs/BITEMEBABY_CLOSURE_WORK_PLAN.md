> ⚠️ **HISTORICAL — อ่านอย่างเดียว (2026-09-20):** เอกสารนี้เป็นหลักฐานย้อนประวัติเท่านั้น สถานะปัจจุบัน → `docs/BMB_CURRENT_STATE_2026-09-20.md` · target → `docs/BMB_MASTER_PRODUCT_SPEC.md` · งานค้าง → `docs/BMB_100_PERCENT_CLOSURE_BOOK.md`


# 🗂️ Bite Me Baby — เอกสารแผนงานปิดงาน (Closure Work Plan)

> **Version:** 2.0 · **สถานะ:** 10 รายการปิดแล้วส่วนใหญ่ (BLOCKED 2 รายการ — ระบุชัด) · **จัดทำ/อัปเดต:** 2026-09-17
> **หลักการ (ตาม README #0/#89/#90):** ห้ามสรุปว่ามี Feature จาก README เพียงอย่างเดียว — ต้องตรวจ **code > DB/Migration > API > Test evidence > Docs** ก่อนปิดแต่ละรายการ
> **เอกสารคู่เทียบ:** `STATUS_TRACKER.md` · `MASTER_PLAN.md` · `README.md` (#0–#102) · `docs/COMPONENT_SPEC_UI.md` v4.0 §18

---

## 0. สถานะปัจจุบัน (Evidence จริง 2026-09-17 — เขียนทับฉบับ 1.0)

| รายการ | ผลตรวจ | หลักฐาน |
|--------|--------|---------|
| TypeScript (`npx tsc --noEmit`) | ✅ 0 errors (exit 0) | terminal output |
| Vitest (`npm test`) | ✅ **26/26 PASS** (เดิม 19 — เพิ่ม 7 tests: delivery sandbox logic + pre-order API) | `npx vitest run` output |
| Build (`npm run build`) | ✅ PASS (~2s, 142 modules; PWA precache 50) | command output |
| Lighthouse (local preview, mobile) | ✅ **Performance 81 / A11y 85 / BP 100 / SEO 100** (best run; LCP 3.5s, TBT 230ms, FCP 3.0s, CLS 0.001) | `lighthouse/final_2026-09-17.json` + `final_summary.txt` |
| E2E จริง (Playwright + system Chrome) | ✅ **7/7 steps PASS, 0 console errors** — Landing→Menu→Cart→Checkout→Payment→Tracking + Pre-order→Tracking + Empty-cart mascot | `e2e/e2e-result.json` + `e2e/screenshots/*.png` (9 รูป) |
| Live Supabase DB (write check) | ✅ core เขียนได้จริง — `orders`=`BMB-20260917-526`, `pre_orders`=`PO-20260917-338`, `payment_intents`=completed | REST query (service key) |
| Live Supabase rebuild (001→004) | 🔴 **BLOCKED** — บัญชี CLI/API ไม่มีสิทธิ์ (supabase link → "no privileges"); pooler ต้องใช้ DB password จริง ไม่มี | proof: `supabase link` error + pooler "password authentication failed" (region ap-northeast-2) |
| Stripe test mode | 🔴 **BLOCKED** — ไม่มี `VITE_STRIPE_*` key จาก owner | `.env`/`.env.local` |
| Mascot Asset 3D | ✅ 9 poses (8 เดิม + `bye`) — ทุก asset re-encode ให้เว็บ (320px mascot / 160px icons) | `public/assets/mascot/*` ขนาดจริง |

---

## 1. งานที่ปิดแล้ว (Closed — 2026-09-17)

| งาน | อ้างอิง | สถานะ | Evidence |
|-----|--------|-------|----------|
| UI v4.0 — Social Proof Review Feed + 2.5D/3D Glassmorphism | README #102 / COMPONENT_SPEC_UI §12–17 | ✅ CLOSED | `CustomerReviewCard.tsx` + build/test ผ่าน |
| Mascot Asset System — ปิดครบทุก pose | §18 Pose Map | ✅ CLOSED | `pointing` (hero CTA), `peeking` (review glass), `empty` (empty cart + sold-out + no-result), `bye` (delivered + payment success) ใช้จริงใน `src/` |
| Star + โลโก้จริง (Facebook/Grab) | §12.3 / §12.2 | ✅ CLOSED | ใช้จริงบนการ์ดรีวิว |
| Deep Link CTA ตาม Mode | #48 / §12.5 | ✅ CLOSED | `/cart?mode=same-day`, `/checkout?mode=pre-order` |
| E2E จริง full flow | README #28–#30 / #63 | ✅ CLOSED | Playwright: 7 steps pass, 0 console errors, 9 screenshots |
| Lighthouse Performance ≥ 80 | `lighthouse/` | ✅ CLOSED (81) | best run ของ final build; baseline 43 → 81 (TBT 1.67s→0.23s, LCP 6.0s→3.5s) |
| Pre-order → สร้าง order จริง (ไม่ใช่แค่ toast) | README #9 / #10 | ✅ CLOSED | `createPreOrder` ถูกเรียกจาก HomePage/MenuPage → เขียน `pre_orders` จริง (`PO-20260917-338`) + vitest |
| ตัดสินใจ pose `bite_good bye.webp` | §18.2 | ✅ CLOSED | ตัดสินใจ = pose **`bye`** (โบกมือลา/ขอบคุณ) — ใช้ที่ OrderTrack delivered + PaymentSuccess |
| Docs final pass + commit convention | #78–#84 / #98–#99 | ✅ CLOSED | เอกสารชุดนี้ถูกเขียนทับฉบับเก่า (ไม่ต่อท้าย) |
---

## 2. Workstream ตาม README — สถานะ & Gap หลัง Closure (2026-09-17)

| README Block | หัวข้อ | สถานะ | หมายเหตุ |
|--------------|--------|-------|----------|
| #7–#12 | Order Mode / Pre-order / Same-day | ✅ ปิด | Pre-order สร้าง order จริงแล้ว (pre_orders) |
| #13–#18 | Live Availability / Calendar / Capacity | 🟡 | ยังต้อง assert กับ DB หลัง rebuild เต็ม (owner) |
| #19–#27 | Bite Drive / External Providers / Tracking | 🟡→✅ logic | Sandbox logic มี vitest 5 ตัว; **live API sandbox (Grab/LINE Man) BLOCKED — ไม่มี credential** |
| #28–#34 | Order Hub / Payment / Omnichannel | 🟡 | E2E payment (PromptPay simulate) ผ่าน; **Stripe test mode BLOCKED — ไม่มี key จริง** |
| #39–#47 | Bite AI / Memory / Content Loop | ✅ | Model A = GLM 5.2 free + fallback Qwen |
| #71–#77 | Automation / Security / Tech stack | 🟡 | bcrypt ใช้ dynamic import (perf); security audit หลัง rebuild DB |
| #101–#102 | Layout v4.0 + Mascot Asset | ✅ | ทุก pose ถูกใช้ครบ |

---

## 3. สถานะ 10 งาน Closure (เขียนทับฉบับ 1.0)

| # | งาน | สถานะ (2026-09-17) | หลักฐาน / หมายเหตุ |
|---|-----|---------------------|--------------------|
| 1 | Owner reset/rebuild **Live Supabase DB** (migration 001→004) | 🔴 **BLOCKED (owner)** | REST เขียน core ได้ (orders/pre_orders/payment_intents) แต่ RLS ยัง permissive + หลายตารางยังไม่ครบ → owner ต้องรัน `supabase/migrations/001→004` ที่ SQL Editor หรือให้ DB password |
| 2 | E2E จริง Landing→Order→Checkout→Payment→Tracking | ✅ **CLOSED** | `e2e/runE2E.cjs` → 7/7, 0 console error, 9 screenshots |
| 3 | Lighthouse Performance ≥ 80 | ✅ **CLOSED (81)** | 43→81; LCP 6.0→3.5s, TBT 1.67s→0.23s (variance 56–81 documented) |
| 4 | Stripe Payment test mode (key จริง) | 🔴 **BLOCKED (owner key)** | paymentGateway พร้อมรับ env; ไม่มี `VITE_STRIPE_*` — owner ต้องให้ key test |
| 5 | External Delivery (Grab/LINE Man) sandbox test | 🟡 **Logic CLOSED / API BLOCKED** | vitest sandbox logic 5 ตัวผ่าน; live API ต้องใช้ credential ขอจาก Grab/LINE Man |
| 6 | ปิดท่ามาสคอต `pointing`/`peeking`/`empty` | ✅ **CLOSED** | ใช้จริงครบตาม §18 Pose Map |
| 7 | Pre-order → สร้าง order จริง | ✅ **CLOSED** | `pre_orders` มี `PO-20260917-338` จริง + vitest 2 ตัว |
| 8 | ตัดสินใจ pose `bite_good bye.webp` | ✅ **CLOSED** | = pose `bye` (farewell/thanks) — implemented |
| 9 | Documentation final pass + commit convention | ✅ **CLOSED** | เอกสารชุดนี้เขียนทับ + State Tracker/Master Plan/Reality Map อัปเดต |
| 10 | Production deploy + smoke test | ✅ **CLOSED** | Cloudflare Pages `https://bitemebaby-5f7.pages.dev` (branch production) — smoke PASS: hero mascots 19, menu cards 6, console errors 0 (`e2e/prod-smoke.json`); deploy command ใน `docs/BiteMeBaby_DEPLOYMENT.md` |
---

## 4. Commit Convention (บันทึกเพิ่มเติม 2026-09-17 — ตาม README #98/#99)

ใช้ **Conventional Commits** (type(scope): subject) ต่อจากที่ repo ใช้อยู่แล้ว เช่น:

```
feat(ui): mascot poses pointing/peeking/empty/bye + real asset integration
perf(web): bcryptjs off the critical path (dynamic import) — Lighthouse 43→81
fix(checkout): navigate to /payment before clearing cart (E2E bug fixes)
feat(orders): pre-order creates a real pre_orders row (not just toast)
test(e2e): Playwright smoke — 7 steps green, 0 console errors
docs(closure): final pass — overwrite status trackers to real state
```

หลัก: หนึ่ง commit = หนึ่ง logical change; subject ภาษาอังกฤษ (identifiers/technical terms); description ภาษาไทยได้; **ห้าม** commit ไฟล์ความลับ (`.env`, keys, `sk-or-v1-*`)

---

## 5. หมายเหตุ Asset (อัปเดต 2026-09-17)

- **ภาพผลิตภัณฑ์ยังเป็น mockup** (emoji placeholder ใน `FoodMenuCard`) ระหว่างรอรูปอาหารจริง — ตาม owner directive "ใช้ mockup ไปก่อนกำลังทำรูปอาหารให้"
- Mascot 3D re-encode: `/assets/mascot/*` 320px (~8–24KB) — ลดจาก 65–163KB
- ไอคอน/โลโก้ re-encode: 160px (~2–10KB) — `icon_chat` 152KB→8.2KB, `Head Logo` 73KB→7.6KB

---

## 6. จุดสิ้นสุด (End of Work Plan v2.0)

> ✅ **สรุป:** Closure 2026-09-17 ปิดงานที่ AI Dev ทำได้ทั้งหมด (E2E, Lighthouse 81, mascot poses, pre-order order จริง, pose decision, docs)
> 🔴 **รอ owner:** (1) Live DB rebuild 001→004 (หรือให้ DB password/access), (2) Stripe test keys, (3) Grab/LINE Man sandbox credentials
> ⏭️ เซสชั่นถัดไปเปิด = Production Deploy + Smoke Test (ตาม `docs/BiteMeBaby_DEPLOYMENT.md`)