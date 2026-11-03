# FIX LOG — 2026-10-01: โครงสร้างเมนู 2 ชั้น (Section → Category) มีผลทุกหน้า (ทางเลือก B ตาม owner)

## ปัญหาเดิม (owner report: heading / section / หมวดหมู่ ซ้ำกันชนกัน)
- คำสับสน: admin เรียก `product_categories` ว่า "Category headings (หัวข้อ)" และเรียก `menu_sections` ว่า "Sections (หัวข้อเมนู)" — 2 ชั้นที่ต่างกันถูกเรียกชื่อเดียวกัน
- Section มีผลเฉพาะหน้าเมนู (MenuPage) แต่ **หน้าแรกไม่ใช้ Section เลย** → สร้าง Section แล้วดูเหมือนไม่มีอะไรเปลี่ยน

## นิยามใหม่ (ใช้ชื่อเดียวทั้งระบบ — ห้ามใช้คำว่า "หัวข้อ" ซ้ำ)
| ชั้น | ตาราง | ชื่อเรียกใหม่ | บทบาทบนหน้าจอ |
|---|---|---|---|
| 1 (บน) | `menu_sections` | **กลุ่มเมนู (Section)** | หัวข้อกลุ่มใหญ่ครอบหลายหมวด (เช่น "อาหารวันนี้") |
| 2 (ล่าง) | `product_categories` | **หมวดหมู่ (Category)** | ปุ่มกรองในหน้าเมนู + ชื่อ carousel รายหมวด |
| — | `products` | เมนู | สินค้าในหมวด |

ลำดับชั้น: **เมนู → กลุ่มเมนู (Section) → หมวดหมู่ (Category) → เมนูย่อย (Product)** — CAT-01/migration 055 เดิม

## การแก้
1. **หน้าแรก (HomePage + CategorySections.tsx)**: โหลด `getSections()` แล้วจัดกลุ่มเหมือนหน้าเมนู — มี Section → หัวข้อกลุ่มใหญ่ (h2) ครอบ carousel หมวด (h3); ไม่มี Section → แสดงแบบเดิม (backward-compatible); หมวดใน Section ที่ปิดไม่แสดง (ตาม server gate CAT-D01=B)
2. **หน้าเมนู (MenuPage)**: ใช้ Section อยู่แล้วผ่าน `buildCatalogGroups` — ไม่แก้
3. **Admin (/admin/products)**: เปลี่ยน label ทั้งหมดให้ตรงนิยาม — "📚 กลุ่มเมนู (Section — กลุ่มใหญ่ครอบหลายหมวด)" / "🏷️ หมวดหมู่ (Category — ปุ่มกรองในหน้าเมนู)"; toast แก้ข้อความเพี้ยนเดิม ("หัวข้อหมด…", PUA char ปนในไฟล์) เป็น "หมวดหมู่อัปเดตแล้ว!" / "เพิ่มหมวดหมู่สำเร็จ!"; dropdown ผูกหมวด → "กลุ่มเมนู (Section)"

## ทดสอบ (ผ่านทั้งหมด)
- `tsc --noEmit` 0 errors · `vitest` **358/358** · `npm run build` PASS
- ไม่มี test ผูก CategorySections เดิม — พฤติกรรมไม่มี Section คงเดิม (ระบุใน component)

## ให้ owner ทดสอบบนจริง
1. `/admin/products` → สร้าง **กลุ่มเมนู (Section)** เช่น "ของว่าง & ขนม"
2. แก้หมวดหมู่ (เช่น ขนมครก) → เลือกกลุ่มที่สร้างใน dropdown "กลุ่มเมนู"
3. หน้าแรก + หน้าเมนู → เห็นหัวข้อกลุ่มใหญ่ครอบ carousel/รายการของหมวดนั้นทันที (hard refresh Ctrl+Shift+R)

---

# HOTFIX — 2026-10-01 (owner report: CI ตก + เสียงยัง eng + แอดมินไม่รู้เมนูไปหมวดไหน)

| ปัญหา | สาเหตุ | แก้ |
|---|---|---|
| **CI / Test + Lint + Build ตก** (GitHub Actions แดง) | eslint `no-misleading-character-class` — ใส่ variation selector (U+FE0F, combining char) ใน character class ของ `speakableText` | แยก `.replace(/\uFE0F/g,'')` ออกจาก char class → lint 0 ผ่าน |
| **เสียงยังพูดอังกฤษบนเว็บจริง** | Cloudflare Pages build **ไม่มี** `VITE_VOICE_SERVER_TTS` (env ต้องตั้งที่ Pages ไม่ได้อ่านจาก .env ใน repo) → production ยังใช้ browser TTS | เปลี่ยนเป็น **AUTO**: ถ้าเครื่องลูกค้าไม่มี Thai voice → ใช้ server TTS อัตโนมัติ (ไม่ต้องตั้ง env เลย) พร้อม env override: `=1` บังคับใช้, `=0` ปิด |
| **เพิ่มเมนูไม่รู้ไปหมวดไหน** (ปกติ/preorder/ส่งวันนี้ ใส่ไม่ถูก) | ฟอร์มเมนูไม่มีช่องเลือกโหมดขาย (`is_preorder` ไม่เคยมีในฟอร์ม) | เพิ่ม **🛒 โหมดขาย** dropdown ในฟอร์มเพิ่ม/แก้ไขเมนู: "ส่งวันนี้ (same-day)" / "จองล่วงหน้า (pre-order)" — sync `is_preorder` + `available_same_day` + `available_preorder`; การ์ดเมนูใน admin แสดง badge "📅 จองล่วงหน้า / 🛒 ส่งวันนี้" |

**ทดสอบ:** lint 0 · tsc 0 · vitest 358/358 · build PASS

**ทางเลือกเสริมสำหรับ owner:** ถ้าต้องการบังคับเสียง server ทุกเครื่อง (เสียงไทยจาก server เสมอ) → เพิ่ม env var ใน Cloudflare Pages → Settings → Environment variables: `VITE_VOICE_SERVER_TTS = 1` แล้ว redeploy — แต่ตอนนี้ AUTO จัดการให้แล้วโดยไม่ต้องทำ
