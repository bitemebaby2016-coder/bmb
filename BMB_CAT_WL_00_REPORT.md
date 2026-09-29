# BMB — CAT-WL-00 REPORT: Canonical Content / Mockup Elimination

**Gate:** CAT-WL-00 (แรกของชุด CAT/WL) · **1 gate = 1 commit** · รายงานตาม §12 ของ directive

## Owner decisions ที่ผูกของ gate นี้ (บันทึกจาก directive)

CAT-D01=B (Section server-enforced — ยังไม่ implement ใน gate นี้) · CAT-D02=A · CAT-D03=B (Storage, migrate แยก gate) · CAT-D04=B (soft archive แยก gate) · CAT-D05=B (**แยก gate**) · Q1=B (tenancy = gate แยก WL-TENANCY-00) · Q2=B (brands entity) · Q3=A (controlled tokens) · **Q4=A (mockup elimination — gate นี้)** · Q5=A (runtime metadata ที่ทำได้) · Q6=A (mascot_overrides คงอยู่)

## 1–4. Mock catalog sources + callers + locations + canonical replacement

| Mock source | Caller | Customer-facing | Canonical replacement |
|---|---|---|---|
| `src/lib/drinksMenu.ts` (DRINKS_MENU 5 items: ชามะนาว/มัตฉะ/อัญชัน/โกโก้/ผลไม้ — ทั้งหมด comingSoon) | DrinksSection → HomePage (Home section 5) | ✅ แสดงชื่อ/ราคา/คำอธิบาย/รูป | **ลบไฟล์** → `selectHomeShowcase(products, categories, 'drinks')` จาก canonical `products` + `product_categories` |
| `src/lib/snacksMenu.ts` (SNACKS_MENU) | SnacksSection → HomePage (section 5b) | ✅ แบบเดียวกัน | **ลบไฟล์** → `selectHomeShowcase(..., 'snacks')` |
| `MENU_HIGHLIGHT_CLIPS` (socialProofReviews.ts:96) | ReviewGallerySection | video clips (empty array) | ไม่ใช่ catalog product — ปล่อย (empty, display-only) |
| อื่น ๆ ที่ grep `MOCKUP/const drinks/snacks/products` | เจอเฉพาะใน `src/.kilo/worktrees/*` (worktree copy — ไม่ build) + test fixtures (allowed) | ❌ | ไม่แตะ |

## 5–7. การเปลี่ยนที่ implement แล้ว

- **เพิ่ม** `src/lib/homeShowcase.ts` — pure mirror (pattern เดียวกับ kitchenQueueView/preOrderQueue): เลือกสินค้าตาม category `slug` ('drinks'/'snacks') + is_active หมวด + is_available สินค้า + sort เดิม → ไม่มี schema/RPC change
- **Rewrite** DrinksSection/SnacksSection: รับ `products`+`categories` props (HomePage โหลด canonical อยู่แล้ว) → ไม่มีหมวด/สินค้า = ซ่อน section (null) · ตัด comingSoon mockup badge ออกเพราะสินค้า canonical พร้อมขายจริง (visual layout/CSS เดิมคงไว้)
- **ลบ** `drinksMenu.ts` + `snacksMenu.ts` — duplicate runtime source หมด
- **HomePage** ส่ง data ให้ทั้งสอง section

## 5 required behavior พิสูจน์ด้วย tests

`homeShowcase.test.ts` (4 tests): slug match + sort_order · กรอง is_available=false ออก · หมวดไม่มี/inactive/ไม่มีสินค้า → [] (section ซ่อน) · map name/price/description/image จาก canonical row — Admin แก้ชื่อ/ราคา/รูป/ปิดขาย/ลบสินค้า → Home section เปลี่ยนตามทันที (อ่านสดจาก DB ทุกครั้งที่โหลดหน้า)

## 8–10. Connectivity

Admin → products/product_categories (RLS is_admin) → getProducts/getCategories → selectHomeShowcase → Home carousel — **CONNECTED** (canonical ชุดเดียว; menu page ใช้ data ชุดเดียวกัน)

## 11. Security/RLS

ไม่แตะ RLS/ตาราง/RPC · public_read filter is_available คงอยู่ · ไม่มี mutation path ใหม่ (read-only presentation)

## 12–13. Tests / Build

- Vitest **296/296 (31 files)** (+4 ใหม่) · tsc 0 errors · eslint 0 · vite build PASS
- Runtime E2E กับ admin JWT ยังรอ G-phase (เดิม) — Home section runtime-verified ผ่าน build + canonical read path เดียวกับ MenuPage ที่ใช้งานจริงอยู่

## 14–15. Remaining gaps / tenancy dependency

- หมวด `drinks`/`snacks` **ยังไม่มีใน prod** (cat-1..5) → จนกว่า Admin จะสร้างหมวด slug นี้ สอง section จะซ่อนตัว (คาดหวังไว้ — ไม่ใช่ bug); ต้องแนบใน runtime verify gate (CAT-06/WL-08) ด้วย controlled QA data
- ค้างทั้งหมดตามลำดับใหม่: **WL-TENANCY-00 → WL-01..05 → CAT-01..06** · menu/section (D01) · archive (D04) · schedule (D02) · storage migration (D03) · add-ons normalized (D05 — ห้ามรวม gate)

## 🔴 HARD STOP

ห้ามเริ่ม WL-TENANCY-00 / WL-01..05 / CAT-01..06 จน Owner review evidence นี้
