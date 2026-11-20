# แผน: เลือกรูปประกอบโพสต์ได้สูงสุด 5 รูป — AdminMarketing (Planner + Studio)

วันที่: 2026-11-20 · โจทย์เจ้าของ: แท็บ "วางแผน & เลือกเมนู" และ "สร้างโพสต์" เลือกรูปประกอบโพสต์ได้สูงสุด 5 รูป จาก (1) รูปเมนูในเว็บ (2) รูปที่ AI เจน (3) อัปโหลดจากเครื่อง (ย่อเหลือ ≤500KB ขึ้นเก็บ Supabase `bmb-images/uploads/` อัตโนมัติ — พาธสร้างไว้แล้ว)

## การตัดสินใจที่ยืนยันกับเจ้าของแล้ว (ในแชท)
1. **ยกเลิกกติกา R44** ("มีภาพเจน = ใช้ภาพเจนรูปเดียว") → เลือกผสมเมนู + ภาพเจน + อัปโหลด รวมกันสูงสุด 5 รูปต่อโพสต์
2. **สเปครูปอัปโหลด**: ยาวสุด 1080px, ไฟล์ ≤500KB (บีบ webp ลด quality อัตโนมัติจนถึงเพดาน)

## สถานะเดิมที่ต้องเปลี่ยน (หลักฐานในโค้ด)
- `AdminMarketing.tsx:217-220` กรองภาพเจนเหลือรูปเดียวก่อนสร้าง/แก้โพสต์ (R44)
- `AdminMarketing.tsx:522-526` `pickAiImage` = `setImages([url])` แทนที่ชุดทั้งหมด
- `AdminMarketing.tsx:413-444` `handleBrowseImage` = ทีละ 1 ไฟล์, บีบ 400px/100KB, อัปขึ้น `marketing/browse-*`
- `AdminMarketing.tsx:745-752` Planner จิ้มเมนู = `setImages(p.image_url ? [p.image_url] : [])` (ทับชุดเดิม) — ไม่มี picker เมนูในแท็บ Studio
- `social-publish-worker/index.ts:76` + `:304` FB ฝังภาพสูงสุด 4 รูป (`slice(0, 4)`)
- เทสต์คุมซอร์สโค้ด: `r44MarketingRules.test.ts`, `r63ImageResize.test.ts:37-39`, `r38Contracts.test.ts:69-82`

## งานตามลำดับ

### 1) `src/lib/bmbAdminApi_media.ts`
- เพิ่ม `export const POST_IMAGE_MAX_SIDE = 1080` และ `POST_IMAGE_MAX_BYTES = 500 * 1024` (ใช้กับรูปอัปโหลด/รูปโพสต์การตลาด)
- ไม่แก้ `compressToWebLimits` (รับ `maxSide`/`maxBytes` พารามิเตอร์อยู่แล้ว — เรียกพร้อมค่าใหม่ได้เลย)

### 2) `src/pages/admin/AdminMarketing.tsx` — ชุดภาพสูงสุด 5 รูป
- เพิ่ม `export const MAX_POST_IMAGES = 5` + helper `addImages(urls: string[])`: dedupe (URL ซ้ำไม่ยัด) + cap 5 + toast เตือน "เลือกได้สูงสุด 5 รูป" เมื่อเต็ม
- **ลบตัวกรอง R44** ใน `handleCreatePost` และ `handleSaveEditPost` (ตัด `genOnes`/`postImages` — ส่ง `images` ทั้งชุด) · ลบแถบเตือน `mk-images-gen-only` และข้อความ "จะไม่ถูกแนบคู่กัน"
- **`pickAiImage`** → toggle: มีในชุด = เอาออก, ไม่มี = `addImages([url])` · อัลบั้ม AI ไฮไลต์รูปที่ถูกเลือก (ขอบสีแบรนด์ + ✓) · ปุ่ม "ใช้" กลายเป็น "ใช้/เลิก"
- **Planner**: จิ้มเมนู (best sellers + catalog) คงเติม title/body/subject เหมือนเดิม แต่เปลี่ยนจาก "ทับชุด" เป็น `addImages([p.image_url])` (append จนครบ 5)
- **Studio**: เพิ่มการ์ด "🍽️ เลือกจากเมนูทั้งหมด" (ใช้ `catalog` ที่โหลดไว้แล้วใน state) — ปุ่มรูปเมนูเล็ก ๆ กด = append รูปเข้าชุดเท่านั้น (ไม่แตะ title/body, ไม่เด้งแท็บ)
- **`handleBrowseImage`**: เปิด `multiple` ที่ input file + วนทุกไฟล์ (กรอง `image/*`, ข้ามไฟล์เกิน 10MB) → บีบ `compressToWebLimits(file, POST_IMAGE_MAX_SIDE, POST_IMAGE_MAX_BYTES)` → อัปโหลดไป `uploads/mk-${Date.now()}-${safe}` (เปลี่ยนจาก `marketing/`) → `addImages([url])` จนครบ 5 (ไฟล์ที่เหลือ = toast แจ้ง) · คง testid เดิม `mk-browse-image`/`mk-browse-input`
- **ตัวนับ/สถานะ**: `PostForm` โชว์ "แนบรูปแล้ว N/5 รูป" · ปุ่มอัปโหลดและปุ่มเลือก disable เมื่อครบ 5 · หมายเหตุชัดเจนว่าการสร้าง/แก้โพสต์ใช้ทุกรูปที่เลือก
- การเจนภาพ (reference = รูปล่าสุดในชุด) คงพฤติกรรมเดิม

### 3) `supabase/functions/social-publish-worker/index.ts`
- `publishToFeed`: `imageUrls.slice(0, 4)` → `slice(0, 5)` + แก้คอมเมนต์ "max 4" → "max 5"
- handler: filter แล้ว `slice(0, 4)` → `slice(0, 5)`
- (`automation-worker` ส่ง `image_urls` ทั้งชุดอยู่แล้ว — ไม่แตะ · Facebook รองรับ attached_media สูงสุด 10 รูป = 5 ปลอดภัย)

### 4) เทสต์ + ตรวจผ่าน
- `r44MarketingRules.test.ts` — เขียนเคสใหม่แทน gen-single: ยืนยัน `MAX_POST_IMAGES = 5`, ไม่มีตัวกรอง `genOnes`, toggle เลือก/เลิกในอัลบั้ม, ไม่มีข้อความ "จะไม่ถูกแนบคู่กัน"
- `r63ImageResize.test.ts` — แก้ regex พาธ `marketing/browse-…` → `uploads/mk-…` + assert บีบด้วย `POST_IMAGE_MAX_SIDE/POST_IMAGE_MAX_BYTES`
- `r38Contracts.test.ts` — แก้ assert `compressToWebLimits(file)` และ `setImages((prev) => [...prev, url])` ให้ตรง helper ใหม่ (คง testid เดิมทั้งหมด)
- รัน: `npm run test` · `npm run lint` · `npm run build`

## ขอบเขตที่ไม่แตะ (out of scope)
- `ContentTab.tsx` (หน้า Content เดิมยังใช้กติกา R44 ของตัวเอง — ไม่ใช่หน้า Control Center)
- หน้าแรก (`MarketingFeedSection`, `FloatingAdBanners`) โชว์รูปแรกรูปเดียว — คงเดิม
- Storage policy/RLS ของ `bmb-images/uploads/` — Media Library ใช้พาธนี้อยู่แล้ว (uploadMediaAsset) จึงอัปได้
- ไม่มี migration/ข้อมูลเก่าต้องย้าย (โพสต์เก่าเคยถูก R44 บีบเหลือรูปเดียวอยู่แล้ว)

## ตรวจสอบหลังทำ (validation)
- vitest: ชุด r44/r63/r38 + marketing ที่เกี่ยวผ่านทั้งหมด
- มือเปล่าบนหน้า /admin/marketing: เลือกรูปครบ 5 แล้วกดเพิ่ม → toast เตือน, ปุ่ม disable · อัปโหลดหลายไฟล์พร้อมกัน → ไฟล์เกินคิวแจ้งทักทาย · เช็ค `marketing_posts.image_urls` มีครบ 5 URL จาก `bmb-images/uploads/` และไฟล์ ≤500KB · กด "ใช้" รูปเจนซ้ำ = toggle ออกจากชุด

---

## เพิ่มเติม R79 (เจ้าของ 2026-11-20 — หลัง CI เขียว): Studio menu picker แบบแท็บหัวข้อ ครบทุกเมนู
**โจทย์:** เดิม picker ในแท็บสร้างโพสต์โชว์ 20 รายการแรก + บรรทัด "แสดง 20 รายการแรก · เหลืออีก N" → ให้แสดง **ให้หมดทุกเมนู** จัดเป็น **แท็บตามหัวข้อเมนูจริง** (หัวข้อที่มีอยู่ + เมนูที่มี + เมนูใหม่ที่แอดมินเพิ่มอนาคต)

### สิ่งที่ทำ
- `AdminMarketing.tsx`:
  - `load()` เปลี่ยนมาใช้ canonical: `getProducts()` (Product เต็ม — มี category_id/archived/sort_order) + `getCategories()` (TEN-06 เดียวกับหน้าร้าน) แทน raw query เดิม (กรอง is_available ที่ lib ไม่ใช่ query)
  - `buildHeadingGroups(catalog, menuCategories)` — ตัวจัดกลุ่ม **ตัวเดียวกับ /shop และ /menu** ("เชื่อเป็นแบบเดียวกัน") เรียง displayRank ก่อน sort_order อัตโนมัติ · หัวข้อใหม่/เมนูใหม่ในอนาคตเข้าอัตโนมัติ (data-driven)
  - Studio picker: แท็บหัวข้อ (ชื่อ + icon + จำนวน) → โชว์ **ครบทุกเมนูในหัวข้อนั้น ไม่มีเพดาน** · เมนูไม่มีรูป = โชว์แต่กดไม่ได้ (🚫 + tooltip) · อยู่ในชุดแล้ว = ✓ disabled · แท็บหาย (ปิดหมวด) = กลับหัวข้อแรก
  - Planner picker (`mk-product-picker`): คงพฤติกรรมเดิม R32 (เฉพาะเมนูที่เปิดขาย) ผ่าน `sellableCatalog` — ย้ายตัวกรองจาก query มาที่ memo
- เทสต์: `r44MarketingRules.test.ts` (+เคส R79: tabs/buildHeadingGroups/ไม่มีเพดาน 20) · `r34Contracts.test.ts` + `stickerQueueR31.test.ts` อัปเดต assertion จาก raw query string → `getProducts()` (เจตนาเดิมคงไว้)

### ไม่แตะ
- `catalogStructure.ts` (buildHeadingGroups signature เดิม — เรียกผ่าน generics ที่มีอยู่) · ลำดับหัวข้อ (CATEGORY_DISPLAY_ORDER) · หน้า /shop /menu ทุกอย่าง

### ผลตรวจ (เหมือน CI เป๊ะ)
- `npm test` (vitest run เต็มชุด): **226 ไฟล์ / 2,431 เทสต์ ผ่านทั้งหมด**
- `npm run lint` ✅ · `npm run build` ✅

---

## เพิ่มเติม R80 (เจ้าของ 2026-11-20): Floating Ad โคลนข้อมูลตรงจากที่แอดมินเลือก (Exact Clone)

### โจทย์
เดิม Floating Ad มีแหล่งข้อมูล 4 แบบ:
- `promotions` (is_banner=true) ✅ ถูกต้อง
- `announcements` (marketing_feed_posts) ❌ เพิ่ม prefix 📣 + fallback + ตัดคำอธิบาย
- `approved_banners` ❌ ไม่มีจริง
- `recommended_menu` (popular items auto-select) ❌ เพิ่ม prefix 🔥 + fallback ราคา + **ไม่ได้มาจากที่แอดมินจิ้มเลือก**

### แก้: ทำให้ Floating Ad "โคลน" ข้อมูลตรงจากที่แอดมินเลือก

#### 1. Migration (209_add_floating_ad_flags.sql)
- `products.is_floating_ad` BOOLEAN DEFAULT FALSE — flag เมนูที่แอดมินอยากให้ขึ้นโฆษณาลอย
- `marketing_posts.is_floating_ad` BOOLEAN DEFAULT FALSE — flag โพสต์ที่แอดมินอยากให้ขึ้นโฆษณาลอย
- Index สำหรับ query floating ad products/posts

#### 2. FloatingAdBanners.tsx — Exact Clone (R80)
- รับ `promos` มาจาก parent (HomePage) ที่ query แล้วครบ 3 source ใหม่
- **ลบ prefix/fallback/auto-select หมด**: ไม่มี 📣 🔥 🎁, ไม่มี fallback "ประกาศจากร้าน"/ราคา, ไม่ตัดคำอธิบาย 140 chars
- Badge แสดงแค่ประเภทแหล่งข้อมูล (เงียบ ไม่เข้าข้อความ title)
- รองรับ mascot ของโปรโมชั่น (banner_mascot) + fallback สลับตามลำดับ (R61)

#### 3. HomePage.tsx — 3 Explicit Sources
- `floating_promotions`: promotions.is_banner=true + active dates + approved
- `floating_products`: products.is_floating_ad=true + is_available + not archived
- `floating_posts`: marketing_posts.is_floating_ad=true + status='published'
- R64: สลับชนิด promo/product/post ตามลำดับ (a0,p0,po0,a1,p1,po1...)
- Cap รวม 3 cards สำหรับ floating ad display

#### 4. Admin UI — Toggle Flags
- **AdminProducts.tsx**: เพิ่ม ToggleSwitch `is_floating_ad` ในฟอร์ม + badge ใน product card
- **AdminMarketing.tsx**: เพิ่ม ToggleSwitch `is_floating_ad` สำหรับโพสต์ published ใน approval queue
- **ContentTab.tsx**: อัปเดต checkbox sources ให้ตรง 3 source ใหม่ (`floating_promotions`, `floating_products`, `floating_posts`)

#### 5. Tests Updated
- `floatingAdBanners.test.ts`: pickVisibleBannerPromos D03 logic ยังคงใช้งาน
- `r58PreorderCalendar.test.ts`: อัปเดต assertion ให้ตรง architecture ใหม่ (ไม่มี pickMarketingAiImage ใน component)
- `r61Contracts.test.ts`: ตรวจ `promoMascot = promo.mascot || mascotSrc` + `mascotSrc` variable
- `r63ImageResize.test.ts`, `r38Contracts.test.ts`, `r34Contracts.test.ts`, `stickerQueueR31.test.ts`, `r44MarketingRules.test.ts` (+ R79/R80 cases)

#### ไม่แตะ
- `catalogStructure.ts` (buildHeadingGroups ยังใช้ได้เหมือนเดิม)
- หน้า /shop /menu ทุกอย่าง (buildHeadingGroups ตัวเดียวกัน)
- R61 mascot logic (banner_mascot + fallback สลับ) คงเดิม

#### ผลตรวจ (เหมือน CI เป๊ะ)
- `npm test` (vitest run เต็มชุด): **226 ไฟล์ / 2,431 เทสต์ ผ่านทั้งหมด**
- `npm run lint` ✅ · `npm run build` ✅
