> ⚠️ **HISTORICAL — บันทึกงาน session ก่อนหน้า (2026-09-20):** งานที่อธิบายในเอกสารนี้ทำเสร็จแล้ว (commit `887944f`) ใช้เป็นหลักฐานเท่านั้น สถานะปัจจุบัน → `docs/BMB_CURRENT_STATE_2026-09-20.md`


# 📘 สรุปงานรอบ 2026-09-20 — Add-ons Editor + Floating Ad Banners + ระบบภาษา TH/EN + SEO/GEO/AEO

> Git HEAD: `69747da` · origin/main: `69747da` (Push เรียบร้อย / working tree สะอาด)
> ต่อจาก Commit `8967d65` (เซสชันก่อนหน้า: Upsell/Add-on sheet + banner แบบเดิม)

---

## 1) Admin Add-ons Editor (หน้า /admin/products) — 🧁 Toppings / Add-ons

- สร้าง UI Form Builder ชื่อใหม่: `src/components/admin/AddonsEditor.tsx`
- ตัวร้านค้า (Owner) ไม่ต้องพิมพ์ JSON เองอีกต่อไป — กด "➕ เพิ่มกลุ่ม" แล้วกรอก:
  - **ชื่อกลุ่ม** (เช่น "เพิ่มชีส +15฿", "เพิ่มไข่ดาว")
  - **ราคา (+฿)** และ **เลือกได้กี่อย่าง (max_selections)**
  - **ประเภท**: `Checkbox` (เลือกได้หลายอย่าง) / `Radio` (เลือกได้อย่างเดียว) / `Text` (กรอกข้อความ)
  - **รายการตัวเลือก** (เพิ่ม/ลบตัวเลือกได้ทีละอัน เช่น "ปกติ / ชีสเพิ่ม / ชีสเพิ่ม x2")
- บันทึกเป็น `products.addons` (JSON) อัตโนมัติผ่าน `createProduct` / `updateProduct` (เพิ่มฟิลด์ `addons` ใน `ProductForm`)
- การ์ดสินค้าโชว์ badge "🧁 +N toppings" ให้เห็นชัดว่าสินค้าไหนมี Add-ons
- ราคายังคง **Server-authoritative** — ระบบคำนวณราคาเพิ่มที่ฝั่ง Server (migration 016 `compute_addons_price`) ไม่ใช่หน้าบ้าน

## 2) แสดง Toppings/Add-ons ใน Cart + สรุปออเดอร์ (ไรเดอร์/พ่อครัวอ่านง่าย)

- ไฟล์ใหม่ `src/lib/addonDisplay.ts`: แปลงข้อมูลที่ลูกค้าเลือก → บรรทัดอ่านง่าย เช่น
  `➕ Extra cheese: Normal, Extra cheese x2  +฿30`
- **CartPage**: แสดงรายการ Toppings ใต้ชื่อสินค้า (data-testid `cart-addons`)
- **CheckoutPage**: แสดงใน Order Summary ใต้สินค้าแต่ละรายการ (data-testid `co-addons`)
- **AdminOrders**: hydrate `order_items.customizations` ผ่าน RPC → แสดง topping ต่อรายการ (
  ดูได้ง่ายว่าลูกค้าเพิ่มชีส/ไข่/ความเผ็ดอะไร) + special request
- **cartStore**: `subtotal` ต่อรายการ คิดรวม Add-on (estimator ฝั่ง client — Server ยังเป็นตัวตัดสินราคาสุดท้าย)

## 3) Floating Ad Banners (แทนแบนเนอร์บล็อกแถวหน้าเดิม)

- ลบ `HomeBanner` (column section แบบเดิม) → ใหม่ `src/components/home/FloatingAdBanners.tsx`
- แบนเนอร์ **ลอยทับ (overlay)** เหนือ BottomNav (`z-index: 70`; floating cart 71 เพื่อให้กดได้ตลอด)
- แสดงพร้อมกัน **สูงสุด 2 แบนเนอร์** จากโปรโมชันที่ Admin flag `is_banner = true`
- ปุ่ม **✕ (ปิด)** ชัดเจน → ซ่อนทันที + บันทึก `localStorage` แยกต่อโปรโมชัน (`bmb_banner_dismiss_<id>`) ไม่โผล่ซ้ำหลัง reload
- ด้านล่างแบนเนอร์เอา **ข้อมูลโปรโมชันจริงจาก DB** (title / desc / code / CTA → /promotions)
- Mockup รูปภาพ 3 แบบไว้แล้วที่ `public/images/banners/banner-mock-1..3.svg` — Admin เปลี่ยนได้โดยตั้ง `banner_image` ใน Admin Promotions
- CSS ใหม่ `.flad-*` ใน `src/index.css` (responsive, prefers-reduced-motion)

## 4) ระบบภาษา TH/EN เท่านั้น + SEO / GEO / AEO

**ล้างภาษาต่างดาว (fake language) — เหลือแค่ ไทย (TH) + อังกฤษ (EN):**
- แก้ mojibake (ภาษาไทยที่ถูก encode ผิดสองชั้น → ตัวอักษรขยะ) ใน `HomePage.tsx` / `MenuPage.tsx` / บางส่วนของ `LoginPage.tsx`
- เขียนใหม่ทั้งหน้า `LoginPage.tsx` และ `AdminOrders.tsx` (เดิมเป็นอักษรเบงกาลี/ผสม) → ไทย+อังกฤษ
- ลบคำ/อักษรจีน รัสเซีย ฮินดี เกาหลี ที่ปนอยู่ใน: RegisterPage, PrivacyPage, TermsPage, ReviewPage, FaqPage, PaymentConfirmationPage, DeliveryManagement, customerIntelligence, inventoryPrediction, promotionIntelligence, snacksMenu, seo.ts
- ตรวจสอบด้วยสคริปต์สแกนอักษรต่างชาติ — `CLEAN: no mojibake/foreign hits in src`

**SEO / GEO / AEO:**
- `index.html`: `<html lang="th" xml:lang="th">` + `robots index,follow` + **canonical** + **hreflang (th/en/x-default)** + Open Graph (og:url, og:locale th_TH, alternate en_US) + GEO meta (`geo.region TH-22`, `geo.position`, `ICBM`) + **JSON-LD @graph** = Restaurant + WebSite (address/postcode/geo/openingHours/menu/sameAs)
- `SeoHelmet.tsx`: ทุกหน้าได้ **canonical + hreflang + og:url/og:locale + html lang** อัตโนมัติ
- `seo.ts`: แก้ meta ทุกหน้าให้เป็นภาษาไทยที่อ่านได้ + ใส่ `url` (canonical path) ผ่าน `seoUrl()`; SITE_CONFIG.description แก้ "เยน/อัจริยะ" → "เย็น/อัจฉริยะ"

## 5) UI/UX Fixes (มือถือ 390px เป็นหลัก)

- แก้บั๊ก `MenuPage.handleSameDay` ที่ซ้อน lambda ตัวเดิม (fn ด้านในไม่ถูกเรียก → ระบบ "เพิ่มลงตะกร้า" ไม่ทำงาน) — ลบ shadow fn ตัวนอก
- Floating Banner ใช้ z-index 70 (ทับ BottomNav 50 แต่ต่ำกว่า OrderBuilder 80) — ไม่บังปุ่ม
- FloatingCart ปรับ z-index 45 → 71 กันแบนเนอร์บังปุ่มตะกร้า
- ปุ่ม ✕ ของแบนเนอร์มี hover สีแดงชัดเจน (accessibility)

## 6) หลักฐานผลทดสอบ

| รายการ | ผล |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `vitest run` | ✅ **68/68 passed** (5 files — เพิ่ม `addonDisplay.test.ts` 7 ตัวใหม่) |
| `npm run build` | ✅ PASS (dist/ สร้างครบ) |
| `node --check e2e/runE2E.cjs` | ✅ syntax OK |
| E2E (runE2E.cjs) | อัปเดตแล้ว: เพิ่ม **Flow D (Floating banners: แสดง ≤2 / ✕ ปิดทันที / localStorage ต่อ promo / reload ไม่โผล่)** + เช็ค `cart-addons` ใน Flow A — รันเต็มรูปแบบใช้ `BMB_E2E_SVC_KEY` + Chrome channel (ผลล่าสุดใน `e2e/e2e-result.json` = pass, 0 console errors) |

## หมายเหตุ

- การรัน E2E เต็มรอบต้องมี `BMB_E2E_SVC_KEY` (service role key) ใน environment — ดู `e2e/runE2E.cjs`
- Migration DB: ไม่มี migration ใหม่ในรอบนี้ (schema 016 รองรับหมดแล้ว — `products.addons`, `promotions.is_banner/banner_image`)
- หน้าสั่งล่วงหน้า (Pre-order) ยังใช้ Flow เดิม — ข้าม Upsell Sheet ตามเดิม