# BMB — แฮนออฟ: ปรับระบบแอดมิน + หน้าร้าน (same-day / preorder)

> **สร้าง:** 2026-10-13 · **HEAD ต้นฉบับ:** `f297424` = `origin/main` · **CI:** run#408 success
> **ปรับปรุง (Phase 0):** 2026-10-13 บน `HEAD = 4b4dc1486952b688cab20fefa9f3d2e89dfdbc7c` = `origin/main`
> **จุดประสงค์:** ส่งต่องานให้แชทใหม่ทำต่อ **โดยไม่ต้องสำรวจซ้ำ** — เนื้อหาในไฟล์นี้ผ่านการ probe โค้ดจริงแล้ว
>
> ⚠️ **เอกสารนี้ถูกแทนที่บางส่วนโดย Master Plan ชุดใหม่ (Owner OD-6):**
> `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` · `BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md` · `BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md` · `BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md`
> **แผน implementation อย่างเป็นทางการ = Master Plan** · ไฟล์นี้คงไว้เป็น reference ของบริบทเดิม + บทเรียน + กฏ Owner

---

## 0. กฏของ Owner (ห้ามฝ่าฝืน)

1. **typecheck แบบ fresh เท่านั้น** — `npx tsc --noEmit --incremental false` · ห้ามเช็คจาก cache
2. **闸门 100%** ก่อนส่งงานเสมอ: tsc 0 · `npm run lint` 0 · `npm test` 0 · `npm run build` 0
3. **เอกสาร overwrite ห้าม append** — ทวนไฟล์เดิมทั้งหมด ไม่ใช่ต่อท้าย
4. **ไม่มี secret ในเอกสารหรือในแชท** (token/password/URL ภายใน)
5. **stage ด้วย path เฉพาะเท่านั้น** — ห้าม `git add -A` · และ **ห้ามปล่อยไฟล์ค้างใน staged**
6. **ภาษาไทย** ทั้งเอกสารและข้อความ UI
7. **PowerShell อ่านภาษาไทยเพี้ยน** — งานที่ต้องอ่าน/เขียนไทยให้ใช้ **node script** เสมอ
8. **push แล้วต้องเช็ค CI** จน `completed/success` แล้วจึงรายงานว่าเสร็จ

---

## 1. สถานะปัจจุบัน (ตรวจแล้ว 2026-10-13)

| รายการ | ค่า |
|---|---|
| HEAD | `4b4dc14` (ต้นฉบับเอกสารนี้เขียนบน `f297424` — ต่อมาเป็น commit docs) |
| origin/main | `4b4dc14` (ตรงกัน) |
| staged files | **0** |
| untracked files | 13 ไฟล์ (`e2e/screenshots/*.png` 10 · webp 3) — **ห้ามแตะ/ห้ามรวม commit** |
| stash | `local-edits-before-sync-2026-09-21` — **ห้ามแตะ** |
| CI | run#408 `completed/success` (ของ `f297424` — ของ HEAD ปัจจุบันยังไม่ได้ตรวจ) |
| `tsc --incremental false` | 0 |
| lint + `brandNameGuard.cjs` | 0 (สแกน 340 ไฟล์) |
| vitest | 79 ไฟล์ / 860 tests (รันยืนยัน 2026-10-13 — EV-002) |
| build | 0 |

### หัวข้อที่ปิดแล้วในรอบก่อน (ไม่ต้องทำซ้ำ)

- **ชื่อมาสคอต** — จอแสดง `Bite` · TTS ออกเสียง `ไบ๊` · guard ดักชื่อไทยผิด (`scripts/brandNameGuard.cjs` ผูกกับ `npm run lint`) · prompt ทุกจุดบอกโมเดลว่าชื่อ `Bite` แล้ว
- **ธีม** — `graphite` เปลี่ยนเป็น **Deep Blue Intelligence** (พื้น `#0A1026` / surface `#111A38` / border `#22305C`) · accent ส้มแบรนด์คงเดิม
- **`theater_daily_copy`** — เป็น **key ใน `business_settings`** (ไม่ใช่ตาราง) · Owner เพิ่มคีย์และเซฟแล้ว · โค้ดครบทั้งสาย (`src/lib/theaterDailyCopy.ts` + 15 tests + `FoodTheater`)
- label อังกฤษตัวสุดท้าย (`aria-label="Close"`) → `ปิด`

---

## 2. ปัญหาที่ต้องแก้ (วิเคราะห์จากโค้ดจริง)

> **CORRECTION (Phase 0 audit 2026-10-13):** ข้อ 2.1 ด้านล่างเป็นรายงานเดิมที่ Owner ส่งมา — ผลตรวจ source รอบใหม่พบว่า **อาการ "ปุ่มทั้งสองในคารูเซล 3+4" NOT REPRODUCED จากโค้ดปัจจุบัน** (ดู RC-5 ใน Master Plan + EV-007) และค้นพบเพิ่ม **RC-1** (ปุ่มกรองโหมดใน `AdminOrders` ไม่ได้เชื่อม query) ซึ่งหนักกว่าที่รายงานไว้ — ยืนยันอาการจริงต้องตรวจบน `biteme-baby.com` (OD-2)

### 2.1 หน้าร้าน — สินค้าซ้ำ 4 ชั้น + ปุ่มขัดกับหัวข้อ

`src/pages/HomePage.tsx` ยิงสินค้าซ้ำกันบนหน้าเดียว:

| บรรทัด | Section | หัวข้อที่ประกาศ | การ์ดที่ offer |
|---|---|---|---|
| 215 | `FoodTheater` | — | ปุ่มทั้งสอง |
| 271–280 | คารูเซล "🔥 **เมนูวันนี้**" | same-day | **ปุ่มทั้งสอง** ⚠️ (ตามรายงานเดิม — ดู correction) |
| 282–294 | คารูเซล "📅 **จองล่วงหน้า**" | preorder | **ปุ่มทั้งสอง** ⚠️ (ตามรายงานเดิม — ดู correction) |
| 297 | `CategorySections` | ทุกหมวด | ปุ่มทั้งสอง |

**อาการที่ Owner รายงาน ("มั่วระหว่าง same day กับ preorder"):**
- การ์ดใต้หัวข้อ "เมนูวันนี้" ยังมีปุ่ม *"จองล่วงหน้า"*
- การ์ดใต้หัวข้อ "จองล่วงหน้า" ยังมีปุ่ม *"สั่งเลย"*
- → หัวข้อประกาศโหมดเดียว แต่การ์ดเสนอทั้งสองโหมด

**หลักฐานโค้ด (รายงานเดิม):**
- `HomePage.tsx:181-185` — ทั้ง `sameDayItems` และ `preOrderItems` ส่ง `onSameDay` **และ** `onPreOrder` เข้า `HomeProductCard` เหมือนกันเป๊ะ
- `HomeProductCard.tsx:11-12, 22, 25` — component รับทั้งสอง callback และ render ทั้งสองปุ่ม ไม่เคยเช็คว่าตัวเองอยู่ใน section ไหน
- `CategorySections.tsx:185` — `ShowcaseCard` ก็รับทั้งสองเหมือนกัน

**⚠️ ผลตรวจ Phase 0 (EV-007):** `HomeProductCard` ปัจจุบัน render **ปุ่มเดียว** ตาม `item.cta` ที่ derive จาก mode (`homeProviders.ts:65`, `HomeProductCard.tsx:73-80`) และ split ใน `getHomeProducts` เป็น exclusive → คารูเซล 3+4 ไม่มีปุ่มคู่ตามโค้ด · ปุ่มคู่จริงอยู่ที่ `ShowcaseCard` (`CategorySections.tsx:71-95`) และ `FoodMenuCard` (`FoodMenuCard.tsx:123-134`) — **สรุป RC-5 = NOT REPRODUCED ต้องยืนยันบน production build**

**ผลข้างเคียง (ยืนยันแล้ว — RC-4):** สินค้าชิ้นเดียวกันโผล่ซ้ำถึง 3 ผิวบนหน้าเดียว (`HomePage.tsx:215,279,292,297`)

### 2.2 แอดมิน — ซ้ำจริง 1 คู่

| หน้า | บรรทัด | หน้าที่ (probe จริง) | 判定 |
|---|---|---|---|
| `src/pages/admin/AdminOrders.tsx` | 420 | ออเดอร์ทั้งหมด · `filterMode: 'all'\|'SAME_DAY'\|'PRE_ORDER'` (L55) · grouping เมื่อ `filterMode==='PRE_ORDER'` (L195) · cancel | **canonical** |
| `src/pages/admin/AdminPreOrders.tsx` | 160 | `.from('orders').eq('order_mode','PRE_ORDER')` (L25-27) · status filter (L68) · `cancelOrder` | 🔴 **ซ้ำ 100%** |
| `src/pages/admin/AdminKitchen.tsx` | 256 | แบ่ง `⚡ SAME_DAY` / `📅 PRE_ORDER (ถึงรอบแล้ว)` / `รอบหน้า — แสดงเพื่อวางแผน` (L150-153) | ✅ production view — **ห้ามรวม** |
| `src/pages/admin/AdminMenuSchedule.tsx` | 187 | `productId → round key` (`''`=ทุกรอบ, `'__off__'`=ปิด) · canonical = migration 039 `menu_schedule` | ✅ catalog schedule — **ห้ามรวม** |
| `src/pages/admin/AdminRounds.tsx` | 127 | Delivery Rounds & Capacity | ✅ capacity — **ห้ามรวม** |

**`AdminPreOrders` ไม่มีอะไรที่ `AdminOrders` ทำไม่ได้** — query ชุดเดียวกัน, filter ชุดเดียวกัน, action (`cancelOrder`) ชุดเดียวกัน ต่างแค่ hardcode filter ไว้ตอนโหลด

**🔴 พบเพิ่มในรอบ Phase 0 (RC-1 / EV-003):** `AdminOrders.loadOrders` (`AdminOrders.tsx:70-78`) **ไม่ได้ส่ง `orderMode` เข้า `getOrdersPaged`** ทั้งที่ API รองรับ (`bmbAdminApi_orders.ts:138,147`) และ `filteredOrders = orders` ไม่ client-filter (L191) → **ปุ่มกรอง SAME_DAY/PRE_ORDER ปัจจุบันไม่กรองอะไรเลย** (มีผลแค่เปิด/ปิด grouping) — **ต้องแก้ก่อนยุบหน้า** (Phase 3 ก่อน Phase 4 ตาม OD-7)

> `src/lib/homeShowcase.ts` = pure display mirror ใช้โดย `CategorySections` ที่เดียว → **ไม่ซ้ำ** ห้ามแตะ

---

## 3. แผนงานที่ต้องทำ (ฉบับเดิม — ถูกแทนที่โดย Master Plan)

> ⚠️ **แผนจริงตอนนี้:** `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` §7 + `BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md`
> **ลำดับ implementation (OD-7): Phase 3 → Phase 1 → Phase 2** · Phase 4 รอ Phase 3 · A2 = DEFERRED (OD-1)
> เนื้อหาด้านล่างคงไว้เป็น context ดั้งเดิมของ งาน A/B/C/D

### งาน A — หน้าร้าน: การ์ดต้องตรงกับโหมดของ section → **= Phase 5 (A1)**

**เป้า:** การ์ดใน section ใด ต้อง offer เฉพาะโหมดของ section นั้น

- `HomeProductCard` + `ShowcaseCard` ต้องรับ prop บอกโหมด เช่น `mode?: 'same_day' | 'pre_order' | 'auto'`
- `mode='same_day'` → render เฉพาะปุ่มสั่งเลย
- `mode='pre_order'` → render เฉพาะปุ่มจองล่วงหน้า
- `mode='auto'` (section หมวด ไม่มีโหมดกำกับ) → ตัดสินจาก `available_preorder ?? is_preorder` ของสินค้า
- `HomePage.tsx:181-185` ต้องส่ง `mode` ต่างกันตาม section (ต่างจากปัจจุบันที่ส่งเหมือนกัน)
- **ต้องมี test** ยืนยันว่าการ์ดใน section same-day ไม่มีปุ่ม preorder

### งาน B — หน้าร้าน: ยุบ section ที่ซ้ำ → **DEFERRED (OD-1)**

*Owner เลือกแล้ว: ทำ A1 ก่อน · A2 (B1/B2) เลื่อน — ห้ามทำใน Phase 1-6*

- **B1** เอา section 3+4 (คารูเซล two-mode) ออก → เหลือ `CategorySections` (ขับด้วย DB, แอดมินแก้ได้ไม่ต้อง deploy)
- **B2** เอา showcase ของ `CategorySections` ออก → เหลือคารูเซลสองอันตามโหมด (ชัดเรื่องโหมด แต่ hardcode กว่า)

### งาน C — แอดมิน: ยุบ `AdminPreOrders` เข้า `AdminOrders` → **= Phase 4 (หลัง Phase 3)**

1. `AdminOrders` มี `filterMode='PRE_ORDER'` + grouping + cancel อยู่แล้ว → **ไม่ต้องเพิ่มฟีเจอร์** — แต่ **ต้องแก้ RC-1 ก่อน** (ส่ง `orderMode` เข้า query)
2. ลบ `src/pages/admin/AdminPreOrders.tsx`
3. ลบ route ใน `src/App.tsx` แล้วให้ `/admin/pre-orders` **redirect** ไป `AdminOrders` พร้อม preset `filterMode='PRE_ORDER'` (กัน bookmark เสีย)
4. ตรวจว่ามี menu/nav item ชี้หน้าเดิม (`adminUi.ts:15,68`, `AdminDashboard.tsx:14`) — อัปเดตให้ถูก
5. ตรวจ `src/__tests__/` มี test อ้าง `AdminPreOrders` ไหม (รอบ Phase 0 ค้นแล้ว = **0**) แล้วโยกตาม
6. **ห้ามลบ** `AdminKitchen` / `AdminMenuSchedule` / `AdminRounds` — คนละหน้าที่

### งาน D — งานค้างอื่นที่ยังไม่ได้ทำ (นอก scope SAME_DAY/PRE_ORDER)

| งาน | หมายเหตุ |
|---|---|
| ตรวจตัวสะกดภาษาไทยทุกหน้า | โปรแกรมจับไม่ได้ ต้องอ่านเอง |
| ลบ/noindex `bitemebaby-5f7.pages.dev` | ยัง live HTTP 200 — ทำใน Cloudflare |
| SMS จริง 1 ข้อความ → เปิด flag `QUICK_LOGIN_REQUIRE_OTP` | ต้องทดสอบก่อนเปิด · rollback ได้ในคลิกเดียว |
| GPS matrix บนมือถือจริง (เคส 1–4) | ต้องอุปกรณ์จริง |
| Omise TEST E2E ทุกสถานะ + webhook | ต้องหลักฐานจ่ายจริง |
| Email Confirmation ใน Dashboard | ไม่มี API อ่านค่า ต้องดูเอง |

---

## 4. คำสั่งที่ใช้บ่อย

```powershell
# 闸门แบบ fresh (ห้ามใช้แบบไม่มี --incremental false)
Set-Location 'D:\A PROJECT\Bite Me Baby'
npx tsc --noEmit --incremental false
npm run lint        # eslint + scripts/brandNameGuard.cjs
npm test
npm run build
```

**หมายเหตุ PowerShell:** คำสั่งที่อ่าน/เขียนภาษาไทยให้รันผ่าน **node script** (`node xxx.cjs`) เสมอ — console จะเพี้ยนแต่ไฟล์ที่ node เขียนจะถูก

---

## 5. จุดที่ห้ามพลาด (บทเรียนจากสองรอบก่อน)

1. **แก้ display อย่างเดียวไม่พอ** — ถ้า prompt ยังบอกโมเดลว่าชื่อ `ไบ๊` โมเดลก็เขียน `ไบ๊` กลับมาทุกข้อความ (เกิดจริงแล้วรอบ `f297424`)
2. **hex hardcode ในบล็อก CSS ที่แชร์ dark+graphite** จะย้อมธีมใหม่ทิ้ง — ต้องเป็น `var(--color-brand-*)` (เกิดจริงตอนทำธีม)
3. **ลิสต์ชื่อห้ามต้องไม่ชนคำไทยปกติ** — `บิต` ⊂ เครดิต/เดบิต, `บับ` ⊂ บับเบิล → guard จะจับผิดแล้วแก้ไม่จบ (เกิดจริง)
4. **อย่าสร้างของซ้ำโดยไม่อ่านของเดิม** — เคยสร้าง migration+EF+component สำหรับ `theater_daily_copy` ทั้งที่ของเดิมมีครบและเขียนไว้ชัด "no second store, no migration" → ต้องลบออก
5. **local build ผ่านไม่ใช่หลักฐาน** — stale incremental cache เคยซ่อน type error 8 จุดให้ CI ตก

---

## 6. ดัชนีเอกสาร SAME_DAY / PRE_ORDER (Phase 0 เพิ่ม)

| เอกสาร | หน้าที่ |
|---|---|
| `BMB_SAME_DAY_PRE_ORDER_MASTER_PLAN.md` | แผนหลัก · baseline · RC-1..7 · OD-1..7 · roadmap |
| `BMB_SAME_DAY_PRE_ORDER_PHASE_CONTRACTS.md` | สัญญาแต่ละ Phase (files/tests/acceptance/rollback) |
| `BMB_SAME_DAY_PRE_ORDER_REGRESSION_MATRIX.md` | Invariants INV-01..20 + นิยาม canonical eligibility |
| `BMB_SAME_DAY_PRE_ORDER_EVIDENCE_LOG.md` | EV-001..013 (อ้างอิงได้) + MISSING evidence ME-01..07 |

**Owner decisions อนุมัติแล้ว (2026-10-13):** OD-1 A1 ก่อน/A2 deferred · OD-2 ตรวจ production ที่ `biteme-baby.com` · OD-3 สินค้าไร้สิทธิ์ทั้งสองโหมดไม่แสดงในพื้นที่สั่งซื้อ · OD-4 cart lock เป็นหลัก ห้ามเปลี่ยนโหมดเงียบ ๆ · OD-5 FoodTheater ใช้ eligibility ตามโหมด · OD-6 เอกสาร 4 ชิ้น + ไฟล์นี้ · OD-7 ลำดับ Phase 3 → 1 → 2 (Phase 4 รอ 3)


