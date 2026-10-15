# BMB — UX FIX HANDOFF (2026-10-15)
# แฮนออฟงานแก้ UX: เซกชันซ้อนกัน · ปฏิทินมุมจอ · หมวดหมู่มั่ว

> **เอกสารนี้คือชุดงานที่เปิดให้ทำต่อได้ทันทีในแชทใหม่**
> โปรเจกต์: `D:\A PROJECT\Bite Me Baby` (ห้ามใช้ `chat\bmb` — เก่า)
> สถานะ: งานเพิ่มไรเดอร์ (migration 125) **ปิดแล้ว** — เหลือ 4 งาน UX ด้านล่าง
> กติกา: ไม่มี placeholder · ชุดทดสอบต้องผ่านจริงก่อนรายงาน · **ห้าม commit/push จนกว่าเจ้าของสั่ง**

---

## 0. สรุปปัญหาที่เจ้าของรายงาน (อ้างอิงภาพหน้าจอ 2026-10-15)

| # | ปัญหา | ต้นตอจริง (ตรวจโค้ดแล้ว) |
|---|---|---|
| 1 | บอกให้เปลี่ยนชื่อ "เมนูวันนี้" → "เมนูยอดนิยม" แต่ถูกสร้างเซกชันใหม่มาซ้อน ทุกเซกชัน/ทุกหน้าเหมือนทำงานแยกกัน | HomePage มีทั้งช่อง "เมนูยอดนิยม" (ระบบใหม่) และ "เมนูวันนี้" (เดิม) พร้อมกัน |
| 2 | UX ปฏิทินมุมจอไม่เหมือนกัน | การ์ดแต่ละแบบใช้คนละคอมโพเนนต์/คนละสไตล์ |
| 3 | ปฏิทินเอามาจากไหน — วันที่ผิด | การ์ดอ่าน `products.scheduled_date` (คอลัมน์เก่า) ไม่ใช่ `menu_schedules` (ของจริงจากหน้า Menu Schedule / migration 039) |
| 4 | หมวดหมู่แสดงมั่ว (หมวดหลัก/หมวดรอง) + หาช่องแก้หัวข้อ/ใส่รูป "เมนูวันนี้" ในแอดมินไม่เจอ | สองหน้าจัดกลุ่มคนละแบบ + ช่อง "เมนูวันนี้" เป็น hardcoded ไม่มีตัวควบคุมในแอดมินเลย |

**สิ่งที่เจ้าของจะจัดการเอง:** ข้อมูลเมนูในแอดมิน (ชื่อ/รูป/หมวดที่สังกัด/คำบรรยาย เช่น "Test description" ที่โชว์บนหน้าเว็บ)

---

## 1. หลักฐานต้นตอ (ไฟล์จริง / บรรทัดจริง)

### 1.1 เซกชันซ้อนกัน — "เมนูวันนี้" vs "เมนูยอดนิยม"

- `src/pages/HomePage.tsx` **บรรทัด 347–357** — ช่อง **"เมนูยอดนิยม"**
  - หัวข้อจาก `popularCfg.title` (ค่า default `'เมนูยอดนิยม'`)
  - ข้อมูลจาก `resolvePopularItems()` ใน `src/lib/homePopular.ts`
  - แอดมินคุมช่องนี้ผ่าน `src/components/admin/HomePopularManager.tsx`
- `src/pages/HomePage.tsx` **บรรทัด 359–369** — ช่อง **"🔥 เมนูวันนี้ — สั่งอาหารจัดส่งจันทบุรี ได้เลย"**
  - **hardcoded** ทั้งหัวข้อและ `sr-only` ("เมนูวันนี้") — แก้จากแอดมินไม่ได้
  - ข้อมูล `sameDayItems` จาก `getHomeProducts()`
- `src/pages/HomePage.tsx` **บรรทัด 371–383** — ช่อง "จองล่วงหน้า" (หัวข้อแก้ได้แล้วผ่าน `siteCopy.homePreOrderTitle`)
- `src/pages/HomePage.tsx` **บรรทัด 385–386** — `CategorySections` (หมวดหมู่ DB-driven)

**ผลที่เกิด:** สินค้าชุดเดิมโผล่ซ้ำ 2–3 ช่อง (เมนูยอดนิยม + เมนูวันนี้ + หมวด "ส่งวันนี้ / Same Day")
**ผลที่แอดมินเจอ:** หา "เมนูวันนี้" เพื่อเปลี่ยนหัวข้อ/ใส่รูปไม่เจอ — เพราะช่องนั้นไม่มีตัวควบคุมในแอดมินเลย (แผง `HomePopularManager` คุมช่อง "เมนูยอดนิยม" เท่านั้น)

### 1.2 ปฏิทินมุมจอ UX ไม่เหมือนกัน

- `src/components/home/ScheduleDateBadge.tsx` — ดีไซน์มาตรฐาน (ป้ายวัน-เดือนมุมรูป + ป๊อปอัปปฏิทินเดือนตอน hover) ใช้ใน:
  - `src/components/home/HomeProductCard.tsx` บรรทัด 61–63
  - `src/components/home/CategorySections.tsx` บรรทัด 69–71
  - `src/components/FoodMenuCard.tsx` บรรทัด 84–86
- `src/components/home/BranchAwareProductCard.tsx` **บรรทัด 81–83** — ใช้ **ป้ายข้อความล้วน** `<span className="home-card-scheduled">พร้อมส่ง {formatThaiDate(...)}</span>` → คนละดีไซน์
- CSS `.sched-cal` ใน `src/index.css` **บรรทัด ~1385–1490**:
  - `.sched-cal { pointer-events: none }` → popup ทับการ์ด/ปุ่มข้าง ๆ และ **บนมือถือแตะไม่ขึ้นเลย** (พึ่ง hover อย่างเดียว)
  - hover selectors ครอบ `.drink-card / .snack-card / .home-card / .fmc-card / .menu-card` แต่พฤติกรรมจริงต่างกันตาม container

### 1.3 ปฏิทินผูกข้อมูลผิด ("เอามาจากไหน")

- ทุกจุดอ่านวันที่จาก **`products.scheduled_date`** (คอลัมน์เก่า):
  - `src/lib/homeShowcase.ts` บรรทัด 53 (`scheduledDate: p.scheduled_date`)
  - `src/lib/homePopular.ts` บรรทัด 159 (`scheduledDate: p.scheduled_date`)
  - `src/components/FoodMenuCard.tsx` บรรทัด 84 (`product.scheduled_date`)
- **ของจริง** ที่แอดมินตั้ง = ตาราง **`menu_schedules`** ผ่านหน้า `/admin/menu-schedule` (`src/pages/admin/AdminMenuSchedule.tsx` — "Menu Schedule (canonical — migration 039)"): เลือก 2 เมนู PRE_ORDER ต่อวัน + Publish
- **หลักฐานในภาพ:** ปฏิทินโชว์ "พร้อมส่ง 1 ต.ค." ทั้งที่หน้า Menu Schedule ตั้งไว้ **16 ต.ค.** (และ 1 ต.ค. เป็นอดีตไปแล้ว)

### 1.4 หมวดหมู่มั่ว (หมวดหลัก/หมวดรอง)

- โครงจริง 2 ชั้น: **กลุ่มเมนู (`menu_sections` = หมวดหลัก)** ครอบ **หมวดหมู่ (`product_categories` = หมวดรอง)**
- `src/pages/MenuPage.tsx` บรรทัด 194 — ใช้ `buildCatalogGroups(filtered, categories, sections)` → Menu → Section → Category (ถูกต้อง)
- `src/components/home/CategorySections.tsx` — หน้าแรกจัดกลุ่มอีกแบบ (section ครอบ carousel หมวด + `loose` หมวดที่ไม่อยู่ในกลุ่ม) → **สองหน้าไม่เหมือนกัน**
- `CategorySections.tsx` บรรทัด 149–175 — หมวดว่างแสดงการ์ดเปล่า "ยังไม่มีเมนูในหมวดนี้ — เร็ว ๆ นี้ 🍽️" (ในภาพมีหมวด "จองล่วงหน้า / พรีออเดอร์ — 0 dishes" โผล่)
- ชื่อหมวดซ้ำกับช่องโหมดขาย ("ส่งวันนี้ / Same Day", "จองล่วงหน้า / พรีออเดอร์") → สินค้าโผล่ซ้ำหลายช่อง

---

## 2. แผนงานที่ต้องทำ (A–F)

### A. รวมเซกชันหน้าแรก = เหลือ "เมนูยอดนิยม" ช่องเดียว
1. ลบช่อง "เมนูวันนี้" (`HomePage.tsx` บ.359–369) แล้ววางช่อง "เมนูยอดนิยม" (ระบบ `homePopular`) แทนตำแหน่งเดิม
2. คงพฤติกรรมเดิม: หัวข้อแก้ได้ในแอดมิน (`config.title` ใน `HomePopularManager` — มีฟิลด์ "หัวข้อช่อง" แล้ว) · ค่าเริ่มต้น "เมนูยอดนิยม"
3. **เพิ่มการจัดการรูปต่อเมนู** ใน `HomePopularManager.tsx`: แสดง thumbnail ของแต่ละเมนูที่เลือก + ปุ่มเปลี่ยนรูป (อัปเดต `image_url` ของ product) — ปิดช่องว่าง "เมนูที่จะใส่รูปภาพเข้าเมนูวันนี้ก็ไม่มี"
4. อัปเดต `sr-only`/aria-label ไม่ให้เหลือคำว่า "เมนูวันนี้"
5. คงช่อง "จองล่วงหน้า" ไว้ (ดูข้อยืนยัน ข้อ 3)

### B. ปฏิทินมุมจอเป็นหนึ่งเดียวทุกใบ ทุกหน้า
1. ยึด `ScheduleDateBadge` เป็นดีไซน์มาตรฐานเดียว (ป้ายวัน-เดือนมุมรูป + ป๊อปอัปปฏิทินเดือน — แบบในภาพที่เจ้าของแนบ)
2. แทนที่ป้ายข้อความใน `BranchAwareProductCard.tsx` บ.81–83 ด้วย `ScheduleDateBadge` — ลบ/เลิกใช้ `.home-card-scheduled`
3. แก้ `.sched-cal` ใน `index.css`:
   - popup ไม่ทับปุ่ม CTA / การ์ดข้าง ๆ (พลิกตำแหน่งอัตโนมัติเมื่อชนขอบ)
   - รองรับแตะ/โฟกัสบนมือถือ (เลิกพึ่ง hover อย่างเดียว — ใช้ `:focus-within` + toggle บน tap)
   - หน้าตา/behavior เดียวกันทั้ง `/shop`, `/menu`, ทุกธีม (สว่าง/มืด/น้ำเงิน)

### C. ผูกปฏิทินกับข้อมูลจริง (menu_schedules / migration 039)
1. สร้าง `src/lib/productSchedule.ts`: query `menu_schedules` เฉพาะที่ `is_published` → map `product_id` → วันจัดส่งถัดไป (join `delivery_rounds` ถ้ามี round key)
2. เปลี่ยนทุกจุดที่อ่าน `products.scheduled_date` มาใช้ helper นี้:
   - `src/lib/homeShowcase.ts` บ.53 · `src/lib/homePopular.ts` บ.159 · `src/components/FoodMenuCard.tsx` บ.84
   - เงื่อนไขแสดงผล (`item.preorder && item.scheduledDate` ฯลฯ) ต้องไม่โชว์วันเก่า — ไม่มีตาราง = ไม่แสดงป้าย
3. Unit test ใหม่: วันที่ต้องตรงกับ `menu_schedules` เสมอ / ค่าเก่าใน `products.scheduled_date` ต้องไม่ถูกใช้ / ไม่มีแถว published = ไม่มีป้าย

### D. หมวดหลัก → หมวดรอง แสดงเหมือนกันทุกหน้า
1. ใช้ `buildCatalogGroups` (ตัวที่ `MenuPage.tsx` บ.194 ใช้อยู่) เป็นฟังก์ชันจัดกลุ่ม**เดียว**ทั้ง `/shop` (`CategorySections`) และ `/menu`
2. รูปแบบหัวข้อ: **หมวดหลัก (Section) → หมวดรอง (Category) → การ์ด**; ปุ่มกรองหมวดจัดกลุ่มตามหมวดหลักด้วย
3. หมวดว่าง: **ซ่อน**แทนการแสดงการ์ดเปล่า (default — ดูข้อยืนยันข้อ 2)
4. ป้ายในแอดมิน (`/admin/products`) ปรับเป็น **"หมวดหลัก (กลุ่มเมนู)" / "หมวดรอง (หมวดหมู่)"** ให้ตรงกับคู่มือ บ.9

### E. กติกาโหมดขายในการ์ด
- การ์ด dual-mode ในหมวด "ส่งวันนี้" แสดงทั้งปุ่มเพิ่มตะกร้า + ปุ่มจอง + ปฏิทินซ้อน — ใช้ `SectionMode` (ตามช่อง/หมวดที่การ์ดอยู่) บังคับปุ่มเดียวต่อการ์ด (กลไก prop `mode` มีแล้วใน `HomeProductCard`/`CategorySections` — ขยายให้ครบทุกช่อง)
- ข้อมูลเมนู (ชื่อ/รูป/หมวด/คำบรรยาย) = เจ้าของจัดในแอดมินเอง

### F. ปิดงาน + regression
1. วนตรวจจนผ่านจริง: `npx tsc --noEmit` → `npm test` → `npm run build` → `npm run lint`
   - เก็บ warning ค้าง `src/__tests__/homeSectionModeCta.test.ts` บรรทัด 14 (unused eslint-disable) ด้วย
2. Playwright 3 ขนาดจอ (390 / 768 / 1280) บน dev server:
   - ปฏิทินหน้าตาเหมือนกันทุกการ์ด/ทุกหน้า · ไม่มีช่องเมนูซ้ำ · หมวดหลัก→รองเหมือนกันทั้ง /shop และ /menu
3. อัปเดต `docs/03_ADMIN_USER_GUIDE.md` บท 9 (เมนู/หมวดสองชั้น) และบท 18 (เมนูยอดนิยม + ปฏิทิน)

---

## 3. จุดที่ต้องยืนยันกับเจ้าของ (1 นาทีตอนเริ่มงาน)

1. **ดีไซน์ปฏิทินมาตรฐาน** — default: แบบในภาพแนบ (ป้ายวัน-เดือน + ป๊อปอัปเดือน). ถ้า "รูปล่าง" หมายถึงภาพอื่น → บอก 1 บรรทัด แล้วปรับ CSS ของ `ScheduleDateBadge` (คอมโพเนนต์เดียว แก้จุดเดียวจบ)
2. **หมวดว่าง** — ซ่อนเลย หรือคง "เร็ว ๆ นี้"? **default: ซ่อน**
3. **ช่อง "จองล่วงหน้า"** — คงเป็นช่องแยก หรือรวมเข้าหมวด? **default: คงไว้** (คนละโหมดขาย + หัวข้อแก้ได้แล้วผ่าน `siteCopy.homePreOrderTitle`)

---

## 4. กติกา/สภาพแวดล้อมสำหรับคนรับช่วง

- โปรเจกต์: `D:\A PROJECT\Bite Me Baby` — ห้ามใช้ `chat\bmb` (เก่า)
- ค้นโค้ดข้อความไทย: ใช้ไฟล์ `.cjs` ช่วย (เขียน temp ใน `D:\A PROJECT\Bite Me Baby` แล้วลบ) — PowerShell/Select-String ข้าม encoding เพี้ยน
- dev server เดิมอาจค้างที่ `localhost:5173` (`node node_modules/vite/bin/vite.js --port 5173`)
- **ห้าม commit/push จนกว่าเจ้าของสั่ง** · ไม่มี placeholder · ทดสอบผ่านจริงก่อนรายงาน
- เซสชันก่อนหน้าปิดแล้ว (อย่าแตะซ้ำ): migration 125 เพิ่มไรเดอร์ · ธีมพื้นน้ำเงิน · spacing fix (`@layer base`) · มาสคอตร้านปิด · คู่มือแอดมิน 28 บท

## 5. ไฟล์หลักที่เกี่ยวข้อง (cheat sheet)

| ไฟล์ | เกี่ยวกับ |
|---|---|
| `src/pages/HomePage.tsx` (บ.347–386) | ลำดับเซกชันหน้าแรก — จุดที่ต้องรวมช่อง |
| `src/lib/homePopular.ts` | ระบบ "เมนูยอดนิยม" + `site_copy` |
| `src/components/admin/HomePopularManager.tsx` | แผงแอดมินคุมช่อง + ต้องเพิ่มการจัดการรูป |
| `src/lib/homeShowcase.ts` (บ.53) | ที่มา scheduledDate ผิด |
| `src/components/home/CategorySections.tsx` | เซกชันหมวดหน้าแรก + empty state |
| `src/components/home/ScheduleDateBadge.tsx` | ปฏิทินมุมจอ (ดีไซน์มาตรฐาน) |
| `src/components/home/BranchAwareProductCard.tsx` (บ.81–83) | ป้ายปฏิทินคนละแบบ — ต้องแทนที่ |
| `src/components/home/HomeProductCard.tsx` (บ.61) / `src/components/FoodMenuCard.tsx` (บ.84) | จุดใช้ scheduled_date |
| `src/index.css` (บ.~1385–1490) | CSS `.sched-cal` — popup/มือถือ |
| `src/pages/admin/AdminMenuSchedule.tsx` + migration 039 | แหล่งข้อมูลวันจัดส่งจริง (`menu_schedules`) |
| `src/pages/MenuPage.tsx` (บ.194) | `buildCatalogGroups` — เกณฑ์จัดกลุ่มที่ถูกต้อง |
| `src/__tests__/homePopular.test.ts`, `menuSchedule*.test.ts`, `homeSectionModeCta.test.ts` | ชุดทดสอบที่ต้องอัปเดต/ดูแล |

---
*สร้างเมื่อ 2026-10-15 · สถานะ: พร้อมเริ่มงานทันที*
