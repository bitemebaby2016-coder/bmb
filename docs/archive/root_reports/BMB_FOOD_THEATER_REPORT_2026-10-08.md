# BMB — รายงานปิดงาน UX/UI: BITE FOOD THEATER (Visual Theater × AI Waiter Stage)

**ประเภท:** WORK REPORT — ปิดงานตามคำสั่ง Visual Theater (2026-10-08)
**ทำโดย:** AI (Cline) รับช่วงต่อจาก handoff `BMB_HANDOFF_UXUI_2026-10-08.md`
**Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`) · HEAD เริ่มงาน = `8d1fd2d` (= origin/main)
**หลัก:** §0 ของคำสั่ง — ห้ามสร้างระบบใหม่ทับของเดิม ใช้ซ้ำ engine/data/cart/mascot เท่านั้น

---

## 0. ผลรวม Gates (ผ่านครบหมดแล้วก่อน commit)

| Gate | ผล |
|---|---|
| `npx tsc --noEmit` | ✅ 0 error |
| `npm run lint` | ✅ 0 error |
| `npm test` | ✅ 57 files / 607 tests PASS (base 55/589 ไม่ลบของเดิม + ใหม่ 2/18) |
| `npm run build` | ✅ PASS |
| mojibake scan (source scope 352 ไฟล์: src/ + supabase/functions + root docs) | ✅ 0 bad |

**หมายเหตุ mojibake:** ไฟล์ที่ยัง encode ผิด = ของเก่าใน `docs/archive/legacy_reports/` (double-encoding CP437 จาก commit ปีก่อน) = นอก scope + ห้าม rewrite เอกสารประวัติ (anti-gaming) — ไม่ได้แตะ

---

## 1. Forensic Audit (source = authority)

| ตรวจ | พบจริง |
|---|---|
| `/` | `TalkToBiteHomePage` → `<TalkToBite mode="home">` full-screen landing (**Meet Bite มีอยู่แล้ว**) |
| `/shop` | `HomePage` — บรรทัดแรก `<TalkToBite mode="hero" />` = **duplicate landing** (ขัด §4) → ถูกถอดแล้ว |
| Floating Bite | `initialPhase="conversation"` = direct chat มีอยู่แล้ว (§12 ✓) — แต่ `fullContext` ไม่เคยส่งเข้า AI |
| Engine ซ้ำ | **ไม่มี** — AI/cart/memory/voice/product source เดียวทุกอย่าง |
| Mascot | 24 ไฟล์จริง + `MascotBadge` 23 ท่า + `bitePoseForState()` map ครบ + มีเทสต์ |
| Design tokens | จริง = ส้ม `#F97316` — คงส้มเป็น action color (§27) + blue เป็น accent light เฉพาะ theatre |
| เทสต์ที่กระทบ | ไม่มีเทสต์ import HomePage/TalkToBite/BiteMascot → แก้ UI ปลอดภัย |

---

## 2. สิ่งที่ทำ (Phase 2–7)

**Phase 2 — Components ใหม่ (presentation layer ล้วน):**
- `src/lib/theaterReasons.ts` — `recommendReason()` จากข้อมูลจริงเท่านั้น: ❤️ favorite (server memory) → 🍗 category ตรงตะกร้า → ✨ created_at ≤14 วัน → ⏱️ prep ≤10 นาที → 🔥 is_featured · ไม่มี signal = ไม่แสดง chip
- `src/components/theater/TheaterCards.tsx` — `RecommendationCard` (LEVEL 2) + `TheaterHeroCard` (LEVEL 3, qty stepper + เพิ่ม/ปรับแต่ง) · LEVEL 1 = `ProductCard` เดิม (ไม่ลบ)
- `src/components/theater/FoodTheater.tsx` — stage บน `/shop`: mascot + carousel (scroll-snap + prev/next + dots + keyboard + swipe) + empty state + ปุ่มตะกร้า
- เทสต์ใหม่ `theaterReasons.test.ts` (+10) · `bitePageContext.test.ts` (+8)

**Phase 3 — `/shop` (แก้ duplicate):**
- `HomePage.tsx` — ถอด `<TalkToBite mode="hero" />` → `<FoodTheater />` · picks จาก `pickTopAvailable()` (helper เดิม) · add → canonical `cartStore.addItem` (mode + isolation เหมือน TalkToBite) · customize → `OrderBuilder` เดิม · ไม่มี fetch ใหม่ ไม่มีข้อมูลปลอม

**Phase 4 — TalkToBite presentation (ไม่แตะ conversation logic):**
- products message → **theater strip** (`RecommendationCard` + reason จาก favoriteCats + cart จริง) — "Bite speaks → Bite presents"
- **ต่อท่อ context**: `fullContext` → `chatWithAI()` runtimeContext (parameter เดิม ไม่แตะ logic AI)
- landing เพิ่ม `.ttb-stage-glow` accent (Phase 6 — layout ไม่เปลี่ยน)

**Phase 5 — Floating Bite context-aware:**
- `src/lib/bitePageContext.ts` — `sectionFromPath()` (route → section) + `pageContextLine()` (Thai จาก state จริงเท่านั้น · order status ใช้ label จริง ไม่ปั้น)
- `BiteMascot.tsx` — section จาก `useLocation()` (ก่อนหน้านี้ทุก route ไม่ส่ง `activeSection` → context ตายตัว) · pose ตาม section จริง · bubble ข้ามตอน upsell/chat · context string ประกอบจาก route + cart จริง → `openChat()` → TalkToBite ส่งต่อ AI ผ่าน fullContext · **ยังเปิด conversation ตรง** (§12 คงเดิม)

**Phase 7 — Mascot:** mapping มีอยู่แล้ว — reuse ล้วน ไม่มี asset ใหม่

**ไม่ทำตาม scope (§31):** ไม่แตะ logic เงิน/migration/EF · ไม่สร้าง engine ใหม่ · ไม่ลบ `ProductCard` · ไม่แก้ `docs/archive/`


---

## 3. Acceptance Check (ตาม §33)

| เกณฑ์ | ผ่าน? | หลักฐาน |
|---|---|---|
| ไม่มี duplicate AI/cart/product/memory/voice | ✅ | audit — engine เดียว, FoodTheater เรียก `cartStore.addItem`/`pickTopAvailable`/`OrderBuilder` ตัวเดิม |
| `/` = Meet Bite | ✅ | ไม่แตะโครง landing — เพิ่มแค่ stage glow accent |
| `/shop` = food-first | ✅ | section แรก = FoodTheater (mascot + hero card อาหารจริง) |
| `/shop` ไม่ repeat Bite landing | ✅ | `<TalkToBite mode="hero" />` ถูกถอดแล้ว |
| Floating Bite เปิด conversation ตรง | ✅ | คง `initialPhase="conversation"` + ต่อ context จริงเข้า AI |
| BMB คงส้ม / ไม่ replace theme | ✅ | tokens เดิมไม่แตะ, blue เป็น accent light เฉพาะ theatre |
| มี 2.5D theater composition | ✅ | `.theater-slide` perspective/rotate/scale + `.theater-hero` depth + glow |
| Mascot reuse ไม่มี asset ใหม่ | ✅ | ใช้ `MascotBadge`/`bitePoseForState`/pose เดิมทั้งหมด |
| ไม่เพิ่ม dependency หนัก | ✅ | ไม่มี dependency ใหม่ — CSS transforms + scroll-snap ล้วน |
| เทสต์เดิมไม่ถูกลบ | ✅ | 55/589 PASS ครบ + เพิ่ม 2 files/18 tests |

---

## 4. ไฟล์ที่แก้/สร้างทั้งหมด

| ไฟล์ | สถานะ |
|---|---|
| `src/lib/theaterReasons.ts` | ใหม่ |
| `src/__tests__/theaterReasons.test.ts` | ใหม่ (+10) |
| `src/lib/bitePageContext.ts` | ใหม่ |
| `src/__tests__/bitePageContext.test.ts` | ใหม่ (+8) |
| `src/components/theater/TheaterCards.tsx` | ใหม่ |
| `src/components/theater/FoodTheater.tsx` | ใหม่ |
| `src/pages/HomePage.tsx` | แก้ (ถอด TalkToBite hero → FoodTheater) |
| `src/components/ai/TalkToBite.tsx` | แก้ (products→theater strip + fullContext pipe + stage glow) |
| `src/components/ai/BiteMascot.tsx` | แก้ (route-derived section + context + pose) |
| `src/index.css` | แก้ (append theatre CSS + reduced-motion + mobile) |

---

## 5. สิ่งที่พบเพิ่ม (ใหม่ — รอ Owner สั่ง ห้ามลุยเองถ้านอก scope)

1. **mojibake เก่า** ใน `docs/archive/legacy_reports/` (9 ไฟล์) + `supabase/migrations/035` + `HANDOFF_002_SCHEMA.md` — double-encoding ก่อน baseline · ทดลองแก้แล้วมีความเสี่ยงทำลายข้อมูล → **revert ทั้งหมด** · แนะนำให้เป็นงาน docs reconcile (P1-1) ของ Owner
2. **Tunnel test (Owner)** — ยัง PENDING ตาม `BMB_OPEN_ITEMS_OWNER_TESTS_2026-10-08.md` §1
3. **P0-1 Omise checkout** — ยังรอ Owner คลิก (ไม่เกี่ยวกับงานนี้)
4. **UX-1..UX-5 จาก handoff เดิม** — งานนี้ทำเฉพาะ Visual Theater command · UX-1 (กวาด UI ไทยทั้งแอป), UX-2 (ฟอร์ม Omise ไทย), UX-3 (รูป+GPS checkout), UX-5 (mobile tunnel) **ยังไม่ได้ทำ** — สั่งได้เลยถ้าต้องการต่อ

---

## 6. วิธี verify ด้วยตัวเอง

```
cd "D:\A PROJECT\Bite Me Baby"
npx tsc --noEmit        → 0 error
npm run lint            → 0 error
npm test                → 57 files / 607 tests PASS
npm run build           → PASS
npm run dev             → http://localhost:3000/shop (Food Theaters stage แรกสุด)
                         → Floating Bite แตะ → conversation ตรง + context หน้าจริง
                         → "/" = Meet Bite เดิม (มี glow accent ใหม่)
```

---
*จัดทำโดย Cline (AI) — 2026-10-08 · gates ผ่านครบก่อน commit · ไม่มีการประกาศ COMPLETE โดยไม่มี evidence*
