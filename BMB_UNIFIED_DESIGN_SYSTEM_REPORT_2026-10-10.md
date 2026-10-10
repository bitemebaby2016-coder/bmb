# BMB — UNIFIED DESIGN SYSTEM / THEATER / MOBILE-FIRST PWA REFACTOR: WORK REPORT (2026-10-10)

**ประเภท:** IMPLEMENTATION REPORT (ตาม §12 ของคำสั่ง Owner 2026-10-10) · **ไม่ประกาศ COMPLETE/OPEN-SHOP READY**
**Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`) · **base HEAD:** `2e5fb6a` → **feature commit:** `9f23165` (docs commit ตามหลัง)
**งานค้างอื่น (closure §7 / P0–P3 / UX-1..5 / CHAT extras): ยังคง "ไม่แตะ" เหมือนเดิม** — เฉพาะ Owner สั่งเพิ่มเท่านั้น

## 0. Owner Decisions ที่ใช้ (ตอบ 5 ข้อจาก Audit Report)

| # | คำสั่ง | การนำไปใช้ |
|---|---|---|
| 1 | ธีม 3 → 2 **ใช่** | `orange`→`light` · `gray`→`dark` · `dark`→`dark` (deterministic migration ที่ `getTheme()` + bootstrap) |
| 2 | สีแบรนด์ **เปลี่ยนเป็นค่าเดียวทั้งระบบ** | `#FF5E1E` เดียว — `@theme`, `index.html`, `vite.config.ts`, `public/manifest.json`, `ErrorBoundary`, `BrandProvider`, `AdminBrands` default, `resolvedBrandStore`, `types` (ผลสแกน: **`#F97316` เหลือ 0 ทั้ง repo**) |
| 3 | ภาพ **สลับกันใช้ + จะมีเพิ่ม + ย้ายโฟลเดอร์เลย** | `public/assets/resturant background/` → **`public/assets/restaurant-bg/`** · light→`bg_1` dark→`bg_2` (array ขยายได้ใน `src/lib/backgrounds.ts`) |
| 4 | Theater **ยืนยันเปลี่ยน** | base = Light stage ขาว/ครีม · `data-theme=dark` = charcoal stage — ไม่มีธีมที่ 3 |
| 5 | งาน **รวม** + งานค้างอื่น "ไม่แตะ" | CHAT-1..7 ถูก absorb เข้า Stage B/C/F ตามขอบเขต · closure §7 ไม่ถูกแตะ |

## 1. Stage A — Audit & Baseline — **DOCUMENTED + RUNTIME VERIFIED**
Audit Report + Dependency Map + Execution Plan ส่งในแชทก่อนเริ่ม (Owner review แล้ว) · baseline รันจริง: tsc=0 · lint=0 · vitest 57/609 · build=0 (2026-10-10 ก่อนแก้)

## 2. Stage B — Theme Architecture & Design Tokens — **IMPLEMENTED**
**ไฟล์:** `src/lib/theme.ts` (rewrite: `ThemeName='light'|'dark'`, `migrateTheme()`, `THEME_CHANGE_EVENT`) · `index.html` (bootstrap 2 ธีม + theme-color กันกระพริบ) · `src/index.css` (block gray ถูกลบทั้งหมด · Dark Glass charcoal `#121214` + `--glass-*` tokens + `.glass-surface` `@supports` guard · a11y text shades) · `Header.tsx`/`TalkToBite.tsx` toggle ☀️/🌙 · `vite.config.ts`/`manifest.json` theme_color
**กำจัด third path:** ไม่เหลือ `data-theme='gray'` ใน CSS/HTML (เหลือแค่บรรทัด migrate ใน bootstrap ที่ตั้งใจ) · toggle = ปุ่มเดิม 2 phase (Header + แชท)
**Glass:** `.glass-surface` เฉพาะ Header/BottomNav (fallback = พื้นทึบเดิมถ้าไม่รองรับ backdrop-filter) — ไม่โปร่งแสงกับทุกการ์ดตามสเปก

## 3. Stage C — Background System — **IMPLEMENTED**
**ไฟล์ใหม่:** `src/components/layout/BackgroundLayer.tsx` (fixed z-0, `pointer-events:none`, admin override `asset_key='site.background'` ผ่าน `getRuntimeAssetUrl()` registry เดิม — **ไม่สร้างระบบชุดสอง**) · `src/lib/backgrounds.ts` · CSS `.site-background*` (blur 16px + scrim แยกธีม + reduced-motion)
**mount:** `Layout.tsx` (content ห่อ `relative z-10`) · **Chat:** `TalkToBite` fallback `bgUrl ?? defaultBackground(theme)` — ไม่มี registry → ใช้ภาพธีม
**หลักฐาน:** HTTP 200 + bootstrap ในหน้าจริง · matrix 28/28 `hasBgLayer=true`
**ยังไม่ได้พิสูจน์ (BLOCKED):** upload เปลี่ยนภาพจริงผ่าน UI Admin (ต้อง login admin + storage policy จริง — โค้ด/registry/tests เดิมไม่ถูกแตะ, `assetRegistry.test`/`mediaFlow.test` ผ่าน)

## 4. Stage D — Food Card Presentation — **IMPLEMENTED** (token-level)
การ์ด 5 ชุด + `CategorySections` คง layout/business hooks เดิมทั้งหมด (`onSameDay/onPreOrder/onAdd` ไม่แตะ) · hardcode ที่แก้: `text-amber-700`→`text-brand-primary` (F1) · hover `bg-brand-secondary`→`bg-brand-primary-dark hover:text-white` (F2) · dark-sweep เพิ่ม: `.home-card/.snack-card/.flad-card/.ob-sheet/.ob-chip/.ob-qty-btn/.review-source-badge/.share-card/.border-orange-50` + hover `usp/trust` · dead CSS `.quick-action` ลบ (หลักฐาน: ไม่มี usage ใน tsx) · sold-out/pre-order/stock logic ไม่แตะ

## 5. Stage E — Theater Theme Integration — **IMPLEMENTED**
`index.css` theater tokens เขียนใหม่ 2 ชุด (light stage `#FFF7ED` family / dark `#121214`) + token ใหม่ `--theater-fg/fg-muted/price/btn-fg/card-top/bottom/shadow` · `.theater-*` ทุก rule เลิก hardcode `#fff` → var · **blue accent ถูกลบ**: `.theater-reason` border ฟ้า→accent, badge `sky`→`amber`, ราคา side-pick `sky-300`→`--theater-price`, คอมเมนต์ "blue accent" แก้แล้ว · `TheaterCards/FoodTheater` `text-white/text-slate-300` → `text-[var(--theater-*)]`
**preserve:** carousel scroll-snap/dots/keyboard/qty/OrderBuilder path/reason chips = ไม่แตะ (tests `theaterReasons` ผ่าน)
**หลักฐานรันจริง:** `/shop` เปิดใน 2 ธีมผ่าน Playwright → `hasTheater=true` ทั้งคู่ + screenshot `bmb_shop390_light/dark.png`, `bmb_desktop_dark.png`

## 6. Stage F — Mobile-First & PWA — **IMPLEMENTED** (ส่วนที่พิสูจน์ได้ในเครื่องนี้)
- `body`: `min-height:100dvh` (+vh fallback) · `overflow-x: clip` (ไม่ใช่ `overflow:hidden` ที่ body แบบเหมารวม — เนื้อหายาวเลื่อนได้ตามเดิม)
- `BottomNav`: `pb-[env(safe-area-inset-bottom)]` (ก่อนหน้าไม่มี — iPhone กลืนได้) · `.sticky-cart-bar` มี safe-area อยู่แล้ว + dark override เพิ่ม
- **บั๊กที่พบและแก้:** Footer อีเมลลิงก์ล้น 8px ที่จอ 320 (`break-all`) · Layout hide-on-scroll ฟัง `window` ทั้งที่ `main` เป็น scroll container → ย้าย listener ไปที่ `main` (ไม่เปลี่ยน architecture การ scroll ของหน้า)
- **หลักฐาน Playwright จริง (11 + 28 cases):** viewports 320×568/360×800/375×812/390×844/430×932 × `/`,`/shop`,`/menu`,`/cart` × 2 ธีม → **overflowX=0 ทั้ง 28 เคส (ก่อนแก้ Footer เจอ 2 เคส 8px ที่ 320)**, `data-theme` ตรงทุกเคส, console error ที่เห็นทั้งหมด = HMR WebSocket ของ dev server ล้วน (ไม่ใช่ error แอป)
- **ยังไม่ได้พิสูจน์ (BLOCKED):** ทดสอบมือถือจริงผ่าน tunnel 4G (งาน Owner ตาม closure §6.2-1 ยังค้าง), keyboard/checkout กับจอจริง, PWA install/offline บนอุปกรณ์ — ต้องทำนอกเครื่องนี้

## 7. Stage G — Cross-page Integration & Regression — **RUNTIME VERIFIED (ตามขอบเขตเครื่อง)**
gates ทั้ง 4 หลังแก้รอบสุดท้าย + matrix ด้านบน + grep ยืนยัน: `#F97316`=0 · `theme === 'orange'|'gray'`=0 · `data-theme='gray'` ใน CSS=0 · moji scan `bad=0` (ตรวจ 20 ไฟล์ที่แตะ) · business flows คุมด้วย test เดิม+ใหม่ 622 ตัวไม่ตก

## 8. Stage H — Final Verification (gates รันจริง 2026-10-10 รอบ post-edit)

```
npx tsc --noEmit → 0 error
npm run lint     → 0 problem
npm test         → 58 files / 622 tests PASSED (base 57/609 + theme.test ใหม่ 13, 0 fail/skip)
npm run build    → PASS (dist + sw.js, precache 137 entries)
moji scan        → 0 bad lines (ไฟล์ที่แตะทั้งหมด)
Playwright       → 28/28 viewport×page×theme ไม่มี overflow · 12 screenshot ใน %TEMP%\bmb_*.png
```

## 9. Known Risks / Remaining Blockers (ตรงไปตรงมา)
1. **ตรวจด้วยตา/contrast จริง** — screenshot อยู่ที่ `%TEMP%\bmb_*.png` (ไม่ commit) ให้ Owner เปิดดูเอง; tunnel 4G = ยังเป็นงาน Owner
2. **อัปโหลดภาพ `site.background` จริงผ่าน Admin UI** — ยังไม่ได้ runtime ด้วย account จริง (BLOCKED เหมือนเดิม)
3. ไม่ได้เปลี่ยน Service Worker strategy ใด ๆ (ตามสเปกห้าม) — cache เดิมต่อไป
4. `BrandProvider`/`resolvedBrandStore` fallback `#FF5E1E` แล้ว แต่ white-label flag ยัง OFF — ถ้ามี brand row ใน DB ที่เก็บสีเก่า `#F97316` ค่า DB จะยังชนะ (ตั้งใจ: brand config ของ tenant ไม่ถูกเขียนทับโดยโค้ด) — **ถ้าต้องการให้ค่า DB เปลี่ยนด้วย ให้สั่งเพิ่ม**
5. งานค้าง closure §7 / P0–P3 / UX-1..5 / CHAT เสริม (redesign ฟอง, speaking indicator ฯลฯ) = **ไม่ถูกแตะ** ตามคำสั่ง

## 10. Git Evidence
```
9f23165 feat(design-system): unified two-theme refactor (light/dark) + brand #FF5E1E + themed theater + site background layer + mobile fixes  ← feature (23 files, +510/-291) · push แล้ว
2e5fb6a (base) docs(chat-uiux): handoff ...
```
docs commit นี้ตามหลัง → push แล้ว `HEAD == origin/main` · worktree clean · feature + docs แยกตาม §10

---
*จัดทำโดย Cline (AI) 2026-10-10 — ทุก status มาจากรันจริง/สแกนจริง ไม่มี PASS โดยไม่มี evidence · tunnel/Omise/งานค้างอื่นยังเป็นของ Owner ตามเดิม*