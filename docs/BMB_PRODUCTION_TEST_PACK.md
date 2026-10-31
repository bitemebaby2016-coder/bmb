# BMB — PRODUCTION TEST PACK (ชุดทดสอบรวมสำหรับรันบน production จริง)

> **สั่งโดย Owner 2026-10-26:** "รวบรวมเทสไว้ทดสอบจริงทั้งหมดบนโปรดักชั่นจริง"
> เอกสารนี้ = **รายการทดสอบเดียวที่ใช้ปิดงาน** รวมทุก checklist ที่เคยกระจายอยู่ใน
> `BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §4+§5 · `BMB_OWNER_STATUS_REPORT_2026-10-25.md` §D ·
> `BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` §1 (R-16) · Growth & Rewards acceptance ·
> และของใหม่รอบนี้ (CAP-01 เส้นทางสั่งซื้อเดียว · CAP-21 เจาะกลุ่มอัตโนมัติ · CAP-22 AI เลือกเวลา)
>
> **HEAD ล่าสุด = ดู `git log --oneline -1`** (รอบ **R21 ปิดงาน 2026-10-29** — ดู §M) · ก่อนหน้า `02b834c` (apply 160 4 stage + ปิดเซส docs · CI **#595** · Contract **#169**) ·
> **รอบ defect Owner 2026-10-26 (4+1):** **client hours+operating_hours sync = FIXED** (แถบสถานะ/เลือกกรอบ/กดสั่ง) · SW `skipWaiting`+`claim` (ค้าง build เก่า) · markup/coupon/label แก้ · **server 160 = APPLIED+VERIFIED** (Owner สั่ง `__apply 160__` · **w8Apply160 4 stage ALL_PASS** · behavior proof: SAMEDAY 23:3x → `ERR_STORE_CLOSED (8:00–20:00)` · PRE_ORDER ผ่าน) · **Owner retest หลัง deploy = hard reload 1 ครั้ง** · gates `e2e/gates_sync2026-10-26.log` ALL ZERO · **แผนทดสอบทั้งหมด = HANDOFF §2**
> **รอบ R21 (2026-10-29) ทำแล้ว — ขั้นตรวจจริงรวมที่ §M:** migration **170** (ต้นทุน/กำไรสินค้า) · **171** (`my_role()` แก้ is_admin → owner/manager ไม่ถูกแปลงบทบาท) · **172** (cap ส่วนลดรวม 15% ฝั่ง server) · **173** (id ออเดอร์/ประวัติ/แจ้งเตือน = bigint::text ไม่มี `#`/space — หลักฐานก่อนแก้ `e2e/r21eProdIdProbe.json`) · **4 คำสั่ง Owner** (ครัวแจ้งเตือน→หน้าครัว · preparing = หักสต็อกรวม · **ประตูตรวจสลิปก่อนรับออเดอร์** · พร้อมส่ง→หน้าจัดส่ง focus) · **EF CORS image-gen แก้+deploy** · **LoadErrorBanner ครบ 18 หน้า** (6+12) · gates = tsc/lint/vitest/build 0 · CI ทุกรอบเขียว

> **สถานะเอกสารนี้:** runbook สำหรับ **Owner/ผู้ได้รับมอบหมาย** รันเอง · AI ไม่รันแทน (เป็น production write)
> อ้างอิงสถานะปัจจุบัน = `docs/BMB_MASTER_STATUS.md` · **ผลรันทุกขั้นต้องมีหลักฐานจริง (ภาพ/log/query)**
> **คู่มือสอนเดินทุก role (วิธีทำรายข้อ + ต้องเห็นอะไร + จดอะไร):** `docs/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md`

---

## 0. ก่อนเริ่ม (preconditions) + **สถานะความจริง (เกณฑ์แก้แล้ว 2026-10-26)**

> **กติกาใหม่ของไฟล์นี้ (Owner): ห้ามสั่งตรวจ "สิ่งที่ยังทำไม่สำเร็จ" ว่าต้องผ่าน**
> → รายการที่ **ยังปิดไม่ได้** ถูกย้ายไป **§L** (ห้ามใช้ตัดสิน ACCEPT จนกว่าจะปิด) ·
> ขั้นที่ **มีเงื่อนไข** ทำเครื่องหมาย **[ต้องทำก่อน]** ไว้หน้าแถว

**Engineering blocker / เงื่อนไข ณ วันนี้ (อัปเดต 2026-10-26 รอบปิดงาน):**

- [x] **B-2** legacy contract 7 ตัว = **ปิดแล้ว (W-2)** — ทั้ง 7 ไฟล์ EXIT=0 บน replay ท้องถิ่น 2 รอบ
      (รอบ fresh replay 001–157 `OK=157 FAIL=0`) · step กลับเข้า `contract-tests.yml` แล้ว
      → **A2 ให้ตรวจว่า Contract Tests success และมีบรรทัด `Legacy contracts OK — 7/7`**
- [x] **schema parity** fresh replay vs production = **รันแล้ว (W-1) + apply 157/158 แล้ว** — รอบสุดท้าย
      **MATCH** = tables/columns/indexes/constraints/sequences/triggers/views/**rls/acl_tables/ledger 158** ·
      drift ที่เหลือ 3 กลุ่มอธิบายครบใน `e2e/w1-parity-report-2026-10-26.md`
      (legacy 6 ตัว = เลือก DROP → **159 APPLIED 2026-10-26** · §L L-10 ปิด · **parity ย่อยหลัง 159 = รันแล้ว**: onlyProd = **0** (legacy จบจริง) · เหลือ local-only **11** = D3 ชุดเดิม (uuid×10 extension placement + get_all_orders_for_admin — src caller **NONE** ยืนยันวันนี้) → evidence `e2e/w1-parityfn-after159-2026-10-26.json` · scope = ชุด fn+flags ไม่เทียบ body)
- [x] **CAP-22 `marketing_rules` = VALUES VERIFIED ใหม่ 2026-10-26 (Management API · read-only)** — อ่านได้จริง:
      window **10:00–19:00** · cooldown **6 ชม.** · **3** โพสต์/สัปดาห์ · content_mix {menu40/brand10/festival20/promotion30} ·
      `menu_rules`/`stop_conditions` = `{}` (คอลัมน์ในตารางเดียวกัน · ว่าง = ทางเลือก ไม่ blocker) → **precondition C7/C8 ผ่าน**
      · evidence `e2e/mrRead-2026-10-26.json` · *(probe anon รอบก่อน = 42501 → ใช้เส้น Management API แทน · ไม่มี write)*
      · **ขั้นทดสอบจริง C7/C8 = ยัง NOT RUN — รอ Owner**
- [x] **UI ฝั่งลูกค้า 9 ข้อ = ปิดครบ 9/9 ฝั่งโค้ด (2026-10-26)** — L-1/L-2/L-6/L-9 (รอบก่อน) +
      **L-3/L-4/L-5/L-7/L-8 ปิดรอบนี้** (มี test รายข้อ · gates ALL ZERO · CI `67f10b8` = #585/#159) →
      **ไม่ใช่งานค้างแล้ว** — เหลือแค่ **runtime verification ที่ §L → L-RT** (ห้ามสั่งแก้ · ห้ามนับเป็น defect เดิม)

- [ ] ใช้ `https://biteme-baby.com` เท่านั้น · **ห้าม**ใช้ `bitemebaby-5f7.pages.dev` (build เก่า ถูกลบแล้ว)
- [ ] **Ctrl+Shift+R (hard refresh)** ทุกครั้งก่อนตรวจ — กัน PWA cache เก่า
- [ ] เครื่องหมาย: `[R]` = อ่านอย่างเดียว · `[O]` = สร้างข้อมูลทดสอบของท่านเอง (จด order number ไว้) ·
      **[ต้องทำก่อน]** = มีเงื่อนไข ต้องปิดก่อนจึงรันได้
- [ ] ขั้นไหนล้มเหลว = จด defect ลง `AI_WORK_STATE.md` + แจ้งรอบถัดไป **ห้ามตัดข้อทิ้ง** ·
      **ห้ามนับขั้นใน §L เป็น "ผ่าน/ไม่ผ่าน" ของ acceptance** จนกว่าจะแก้เสร็จ

## A. CI / gate ของ SHA ล่าสุด `[R]`

| # | ขั้น | PASS = |
|---|---|---|
| A1 | เปิด Actions → **CI** ของ SHA ล่าสุด | success |
| A2 | เปิด Actions → **Contract Tests (isolated PostgreSQL)** ของ SHA เดียวกัน | **success** · **มีบรรทัด `Legacy contracts OK — 7/7`** (B-2 กลับเข้า gate แล้ว 2026-10-26 — ถ้าไม่เห็นบรรทัดนี้ = DOC DRIFT แจ้งทันที) |
| A3 | Cloudflare Pages deploy ของ SHA เดียวกัน | success (build ใหม่ขึ้น production) · **หมายเหตุ 2026-10-26: job = success (5f891de) + marker ตรวจแล้ว — `btn-locked` (โค้ดใหม่ 67f10b8) อยู่ใน CSS+JS หน้าจริง = serving ≥ 67f10b8 ✓ VERIFIED** (ชื่อไฟล์ asset ต่างจาก local = env inlining ไม่ใช่ stale · build id อ่านไม่ได้) |

## B. Storefront — ดู/สั่ง ทั้ง 2 โหมด `[R]/[O]`

| # | ขั้น | PASS = |
|---|---|---|
| B1 `[R]` | เปิดหน้าแรก + `/menu` (desktop + มือถือ) | ไม่มี console error · รูป/ป้ายไม่เพี้ยน · หัวข้อ/แท็บ "ส่งวันนี้/จองล่วงหน้า" ไม่โชว์ซ้ำ · การ์ดไม่มีเส้นกรอบ |
| B2 `[R]` | แถบสถานะหน้าแรก | **UNVERIFIED (2026-10-26)** — code-fix มาจาก **L-6 ที่ปิดแล้ว** (มี test) แต่ **ยังไม่มีหลักฐาน runtime ใหม่** → ขั้นนี้ = **verify ครั้งแรกของ Owner**: ตอน ~11:00 เปิดหน้าแรก → ต้องบอก **เซมเดย์ยังสั่งได้ (ร้านยังเปิด)** + **พรีออเดอร์ = รอบถัดไป (วันที่ 27)** ตามเวลา/รอบจริง · ถ้ายังโชว์ "🟢 เปิดรับออเดอร์ เช้า" ทั้งเลยคัทออฟ = defect เดิมยังอยู่ (จดลง `AI_WORK_STATE.md`) · *(เช็คช่วง 22:29 = เกิน ~11:00 → verify เต็มรูปแบบต้องรอรอบเช้า/Owner)* |
| B3 `[O]` | **สั่ง SAME_DAY** 1 ออเดอร์จากหน้าแรก หรือ `/menu` (รอบยังไม่เลย cutoff) | เข้าตะกร้า → checkout สำเร็จ → ติดตามสถานะจริง · **ไม่มีการเลือกรอบให้เองผิด** |
| B4 `[O]` | **สั่ง PRE_ORDER** บนวันที่มีเมนูปฏิทิน ภายใน cutoff ก่อนส่ง | สำเร็จ · ถึง/เกินคัทออฟต้องถูกปฏิเสธพร้อมเวลา HH:MM จริง |
| B5 `[R]` **(ของใหม่)** | กรณี addItem ถูกบล็อก (ปิดขาย/สินค้าถูกถ่ายโอน) | ขึ้นข้อความเตือน **ไม่** โชว์ว่า "เพิ่มแล้ว" และ **ไม่** เด้งไป checkout |
| B6 `[R]` **(ของใหม่)** | ปุ่มจากรีวิว (Review CTA) บนสินค้าที่ปิดขาย | ต้องขึ้นเตือน ไม่โชว์ "เพิ่มลงตะกร้าแล้ว" (guard ใหม่ของ `handleReviewCta`) |
| B7 `[O]` | ตะกร้าผสม (เมนูปฏิทิน + สินค้าทั่วไป) → เลือกรอบที่ยังไม่ผ่านคัทออฟ | ออเดอร์เดียว สร้างสำเร็จ |

## C. แอดมิน `[R]`

| # | ขั้น | PASS = |
|---|---|---|
| C1 | `/admin` desktop sidebar + มือถือ drawer | 5 กลุ่ม / 19 รายการ · ทุกลิงก์ไปหน้าจริง · scroll ขึ้นบนสุดเมื่อเปลี่ยนหน้า |
| C2 | ศูนย์ขนส่ง `/admin/delivery` → แท็บ "รอบจัดส่ง & แพทเทิร์น" | **ไม่มีช่องคัทออฟใด ๆ นอกจาก "ปรับของพรีออเดอร์"** (ช่อง "ปิดรับเดิม (legacy)" หายไปจริง) · แถวรอบ/หน้าแรกไม่โชว์ "ปิดรับ HH:MM" จากค่าเดิม |
| C3 | `/admin/products` | ชื่อหมวดใต้การ์ดตรงกับแท็บเสมอ |
| C4 | `/menu?category=<id>` deep-link | เปิดถูกหมวด · ปุ่มจองล่วงหน้ายังใช้ได้ |
| C5 | `/admin/orders?mode=PRE_ORDER` | query ถูก preset + grouping header แสดง |
| C6 **(ของใหม่ CAP-21)** | `/admin/customers` | มีแถบสรุปกลุ่มลูกค้า + คอลัมน์ "กลุ่ม/คำสรุป (อัตโนมัติ)" · **ไม่มีช่องให้กรอกเกณฑ์/ปุ่มบันทึกกลุ่ม** · โหลดใหม่แล้วยังคำนวณเอง |
| C7 **(ของใหม่ CAP-22)** `[precondition VERIFIED 2026-10-26 (mrRead) · ขั้น = NOT RUN — รอ Owner]` | `/admin/marketing` → แท็บ "📅 ปฏิทิน" | **สถานะ:** ค่า = **อ่านยืนยันใหม่ 2026-10-26 ผ่าน Management API** (`e2e/mrRead-2026-10-26.json`: window 10:00–19:00 · cooldown 6 · 3/สัปดาห์ · content_mix ครบ) = precondition **ผ่าน** · ขั้นนี้ยังไม่มีใครรัน → **verify ขั้นสุดท้าย = Owner กด "🤖 ให้ AI เลือกเวลาทั้งหมด"** → โพสต์ **อนุมัติแล้ว** ถูกตั้งเวลา (toast สรุปจำนวน) · โพสต์ยังไม่อนุมัติ**ไม่ถูกตั้งเวลา** |
| C8 **(ของใหม่ CAP-22)** `[precondition VERIFIED ตาม C7 · ขั้น = NOT RUN — รันหลัง C7]` | ทิ้งเวลาให้ถึงชั่วโมงถัดไป (หรือตั้งเวลาในอดีตเล็กน้อย) | worker รายชั่วโมงเผยแพร่โพสต์อัตโนมัติ → สถานะ `published` โดย **ไม่มีใครกด publish มือ** |

## E. การจ่ายเงิน + ตรวจสลิป `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| E1 `[O]` | จ่ายเงินจริง 1 ออเดอร์ (ช่องทางที่เปิดใช้) + อัปโหลดสลิป | สลิปขึ้นหน้าตรวจของ OrdersHub ทันที |
| E2 `[R]` | แอดมินอนุมัติสลิป | ผ่าน · สถานะ paid ตรงกับ DB (อ่านจากหน้ารายงาน) |

## F. ไรเดอร์ `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| F1 `[O]` | Rider: อัปโหลด POD รูปแรกบนมือถือ | รูปขึ้นจริง · สถานะจัดส่งเปลี่ยน (ค้าง `sent/failed` = ไม่ผ่าน) |
| F2 `[R]` | เปิด `/rider` | PWA ทำงาน · แผนที่/เส้นทางโหลด |

## G. แผนที่ `[R]`

| # | ขั้น | PASS = |
|---|---|---|
| G1 | แผนที่ใน checkout + `/admin/delivery?tab=routes` (มือถือ + desktop) | แผนที่โหลด · ไม่ขึ้นข้อความ "ยังไม่ได้ตั้งค่า VITE_GOOGLE_MAPS_API_KEY" (ถ้าขึ้น = **deploy ใหม่หลังตั้ง key** แล้วลองอีกครั้ง) |

## H. ระบบ role 13 ค่า (146/147) `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| H1 (14a) | login owner/admin | เห็นเมนูแอดมินครบทุกกลุ่ม |
| H2 (14b) | login kitchen → `/admin` | เห็นเฉพาะ ภาพรวม/ออเดอร์/ครัว/สูตร/รอบ/เมนู · สร้าง batch ในหน้าครัวได้จริง |
| H3 (14c) | login inventory | เพิ่ม/แก้/ลบ วัตถุดิบได้จริง |
| H4 (14d) | login finance | ดูรายงานการเงิน + ปิดวัน (close_day) ได้ |
| H5 (14e) | login marketing | สร้าง/อนุมัติ/ตั้งเวลา โพสต์การตลาดได้ (รวมปุ่ม AI เลือกเวลา) |
| H6 (14f) | login pos | เห็น POS/ออเดอร์/ลูกค้า/รายงาน |
| H7 (14g) | login support | เปิดออเดอร์/ลูกค้า/แจ้งเตือน — **แก้ไขอะไรไม่ได้** |
| H8 (14h) | login auditor | เปิดได้ทุกหน้ารายงาน/บันทึก — **อ่านอย่างเดียวจริง** |
| H9 (14i) | login rider → `/rider` | PWA ทำงานปกติ |
| H10 (14j) | login customer | ไม่เห็นลิงก์ Admin · เข้า `/admin` ไม่ได้ (redirect `/`) |

> วิธีแต่งตั้ง role = SQL `set_user_role(...)` ใน `BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §5

## I. R-16 · Print-to-PDF (รอบแรก ตามคำสั่ง Owner 2026-10-26) `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| I1 | เว้นว่างชื่อเครื่องพิมพ์ทั้งสองช่องใน Settings → สั่งพิมพ์ | เปิดไดอะล็อกเบราว์เซอร์ → เลือก "บันทึกเป็น PDF" |
| I2 | เปิด autoPrint ทั้งสองสวิตช์ → สั่งออเดอร์ทดสอบ → จ่าย → ยืนยันครัว | PDF ใบเสร็จเปิดได้ (เลข order/รายการ/ยอด/วันเวลา ครบ) + PDF คิวครัวครบ · ภาษาไทยไม่เพี้ยน |
| I3 | ทดสอบ failure: ปิดเครื่องพิมพ์(จำลอง) แล้วสั่งพิมพ์ | job = `failed` ไม่ค้าง `sent` |
| I4 | กดยืนยัน 'printed' ใน UI | job = `printed` (state ตรง DB) |

## I2. R30–R33 · Nimbot B1 Pro ผ่าน Web Bluetooth (ทางหลัก) `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| I2-1 | เปิด `/admin/settings` ห้ว Bluetooth → กด **🔗 เชื่อม & พิมพ์ทดสอบ** (Chrome/Edge หน้าปกติ ไม่ใช่ Incognito) | เลือก B1 Pro → กระดาษออก 1 ดวง · preview รูปมีตัวอักษร |
| I2-2 | **📏 พิมพ์ใบวัดฟีด** → อ่านเส้นเทียบขอบบนดวงจริง | เส้น **0px ตรงขอบบนพอดี** = offset 0 · **เส้น 0px หายเหนือขอบ** (หัว BITE ME BABY หลุด = บั๊กปัจจุบัน = เครื่องเริ่มพิมพ์ก่อนขอบ) → เส้นที่ตรงขอบบนพอดีมีเลข **N → ใส่ offset = +N** · มี**แถบขาว N px เหนือเส้น 0px** (เครื่องเริ่มช้า) → ใส่ offset = **−N** |
| I2-3 | ใส่ค่า "ชดเชยฟีดแนวตั้ง" (ตามที่อ่านได้) → บันทึก → กดทดสอบซ้ำ | เนื้อหา (หัว BITE ME BABY ถึง Thank You) อยู่ในขอบดวง พอดี ไม่ข้ามร่อง ไม่มีแถบขาวก่อนร่อง |
| I2-4 | ออเดอร์จริง ≥2 ชิ้น → กด "รับออเดอร์" | toast "กำลังพิมพ์ N ใบ" → "ยืนยันครบ" · กระดาษออก N ดวง (1 ดวง/ชิ้น · qty 2 = 2 ดวง) |
| I2-5 | (Fallback เท่านั้น) QZ Tray test sticker | ออกหรือไม่ออก = ตัวเสริม — ทางหลัก = BT · queue Windows = ตายรู้แล้ว |

## J. Growth & Rewards acceptance (4 stages · apply 153–156) `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| J1 | **Promotions (153)** — สร้างแคมเปญ + ใช้คูปองจริง 1 ใบ | ส่วนลดถูกต้องตาม scope · kill switch ปิดแล้วใช้ไม่ได้ |
| J2 | **Referral (154)** — ใช้รหัสแนะนำ 1 ครั้ง | ได้แต้ม/ผลตอบแทนตามระดับ · ยกเลิกแล้วเกิด reversal ledger |
| J3 | **Loyalty (155)** — สะสมแต้มจากออเดอร์ | tier/points ถูกต้อง · แต้ม append-only (ไม่หาย/ไม่ทับ) |
| J4 | **Engagement (156)** — spin + affiliate + catalog | spin ได้/ไม่ข้าม daily cap · affiliate ไม่จ่ายเงินสด · catalog ที่แอดมินเพิ่มใช้ได้ |

## K. เอกสาร/สถานะ ไม่ให้ drift `[R]`

| # | ขั้น | PASS = |
|---|---|---|
| K1 | อ่าน `docs/BMB_MASTER_STATUS.md` + `AI_WORK_STATE.md` | ตรงกับ build ที่ใช้อยู่ · ไม่มีคำว่า DONE โดยไม่มี evidence |
| K2 | ถ้ามีข้อไหนในเอกสารนี้ "ขัด" กับหน้าจริง | ถือ **โค้ด/หน้าจริง** = ถูก · จดเป็น DOC DRIFT ให้รอบถัดไปแก้เอกสาร |

---

## L. §L = **ไม่มีงานค้างแบบ blocker แล้ว** + **Runtime verification ของรายการที่ปิดแล้ว** (อัปเดตหลัง 159 apply · 2026-10-26)

> §L ตอนนี้ = ~~L-10~~ **ปิด = 159 APPLIED+VERIFIED 2026-10-26** (Owner อนุมัติ · evidence `e2e/w7Apply159-*.json` · ledger 159) ·
> **L-RT** = ขั้นตรวจ runtime ของ 5 ข้อที่โค้ดปิดแล้ว · L-12 = ทางเลือก (ไม่ blocker) ·
> **L-RT ไม่ใช่งานค้าง** — ปิดแล้วฝั่งโค้ด (test + gates + CI) · ผลไม่ตรงของจริง = จด defect ใหม่ ห้ามเหมาเป็นของเดิม

| # | สิ่งที่ยังไม่สำเร็จ | ต้องเห็นอะไรตอนนี้ | ปิดเมื่อ |
|---|---|---|---|
| L-10 | ~~แผน W-1 เหลือ 1 ข้อ~~ **Owner เลือก DROP + apply แล้ว** | **ปิด ✅ 2026-10-26 — 159 APPLIED บน production**: precheck (6 fn · identity args ตรงจริง · trigger 0 · caller 0 · backup 9) → apply (pg_proc 0) → verify (products anon 200 · rpc 404 PGRST202) → record (**ledger top 159**) | ปิด 2026-10-26 · evidence `e2e/w7Apply159-{precheck,apply159,verify,record}.json` |
| L-11 | ~~B-6 (P0) guest อ่านเมนูไม่ได้~~ | **ปิดแล้ว ✅** — apply 157+158 (Owner อนุมัติ) · PostgREST ทุก endpoint = 200 · เปิด `/menu` จริง = เห็นเมนูครบ + ไม่มี console error | ปิด 2026-10-26 |
| L-12 | **CAP-22 `menu_rules`/`stop_conditions` ยังว่าง** | ค่าหลัก (window/cooldown/frequency) มีครบแล้ว → C7/C8 รันได้ · 2 ค่าที่ว่าง = ทางเลือก | Owner เติม/ปล่อยว่าง |

> **ปิดแล้วรอบนี้ (ย้ายออกจาก §L → กลายเป็นขั้นตรวจจริง):**
> **L-1** ป้าย BITE · AI WAITER STAGE (ค่าเริ่มต้น + guard ต้อนรับค่าเก่า) · **L-2** ป้าย (Marketing Testimonials) ·
> **L-6** แถบสถานะ ~11:00 (บอกเซมเดย์+รอบถัดไปตามเวลาจริง) · **L-9** เฟรมเมนู 1:1 + เฟรมโปรโมชั่นเท่ากัน
> (`src/styles/frameCanonical.css`) · **B-2 (เดิม L-10 เดิม)** = ปิด · **schema parity (เดิม L-11 เดิม)** = รันแล้วมีรายงาน
> · **L-3/L-4/L-5/L-7/L-8 ปิดรอบนี้ (2026-10-26 · `67f10b8`)** = มี test รายข้อ · gates ALL ZERO · CI #585/#159
>   → ย้ายไปเป็นขั้น **L-RT** ด้านล่าง (runtime verify หลัง deploy · **ไม่ใช่งานค้าง**)
> · **L-10** = **159 APPLIED บน production 2026-10-26** (precheck→apply→verify→record · ledger top 159 · evidence `e2e/w7Apply159-*.json`)

### L-RT · Runtime verification ของ 5 ข้อที่โค้ดปิดแล้ว (Owner รันบน production/ring — ไม่ใช่งานค้าง)

> ใช้ตรวจซ้ำ **หลัง deploy ใหม่** เท่านั้น · **ห้ามจดเป็น "งานที่ยังไม่ทำ"** · ผลไม่ตรง = จด defect ใหม่ลง `AI_WORK_STATE.md`
> · ทุกข้อ: Ctrl+Shift+R ก่อน · ใช้ `https://biteme-baby.com`

| # | ขั้น | PASS = |
|---|---|---|
| RT-L3 | จิ้มแท็บ/หัวข้อ/ลิงก์ฟุตเตอร์/BottomNav บนหน้าแรก · `/menu` · หน้าอื่น | เลื่อนถึงเป้าหมาย (ส่วนใหญ่ = บนสุดของหน้า scroller) **เหมือนกันทุกหน้า** — ไม่นิ่งค้าง |
| RT-L4 | เปิด `/menu` ดูหัวข้อทั้ง 2 แท็บ (ส่งวันนี้ / จองล่วงหน้า) | หัวข้อครบตามสต็อก · โหมดถูกทั้งคู่ · แท็บจอง: การ์ด/ปุ่มเปลี่ยนเป็นโหมด "จองล่วงหน้า (ร่วมรอบ)" ไม่โชว์ "สั่งเลยวันนี้" |
| RT-L5 | เปิด `/vote` | ไทยถูก 3 จุด ("กรุณารอ" / "เมนูไหนที่น่าลอง" / "โหวตได้ครั้งละ 1 เมนู") · เห็นเมนูครบตามรายการ (ไม่ถูกซ่อนผิด) |
| RT-L7 | หัวข้อแนวนอน (หน้าแรก/เมนู) + ฟุตเตอร์ | ลำดับ: ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ของทานเล่น → สำเร็จรูป · ลิงก์ไปหมวดจริง · ฟุตเตอร์ลำดับเดียวกัน |
| RT-L8 | การ์ดพรีออเดอร์ยังไม่ถึง/เลยคัทออฟ ทุกจุด (list/detail/theater/AI) + cart ที่มีรอบเก่า | **ปุ่มสีเทา + กดไม่ได้** (`.btn-locked` · aria-disabled) · cart รอบเก่า = แถบเตือน + +/- ใช้ไม่ได้ + checkout ถูกบล็อก |
| RT-HOURS | **(ใหม่ · sync 2026-10-26)** นอกเวลาเปิดร้าน (ตั้ง `hours` = 8:00–20:00 · ทดสอบ ~20:30 ขึ้นไป) บนหน้าแรก + `/checkout` (incognito/hard reload) | แถบสถานะ **ไม่บอกเซมเดย์ "ยังสั่งได้"** (เป็น `preorder_only`/`closed` + โชว์ "ถึง 20:00" เมื่อเปิด) · รอบเซมเดย์ใน checkout = **ปิดในการตั้งค่าร้าน** · กดสั่งเซมเดย์ = toast ร้านปิด · ปุ่ม toggle `operating_hours` ปิด = ปิดจริง · เวลาโชว์เป็น `HH:MM` (ไม่มี `:00:`) |

---

## M. R21 · รอบปิดงาน 2026-10-29 — ขั้นตรวจของสิ่งที่ทำ/apply แล้ว `[R]`/`[O]`

> ทุกข้อ: Ctrl+Shift+R (hard reload) 1 ครั้ง · production = `https://biteme-baby.com`
> · **state ฝั่งโค้ด/test/CI = ปิดแล้ว** — ตารางนี้ = runtime verify ตา Owner (ไม่ใช่งานค้างของ AI)

| # | ขั้น | PASS = |
|---|---|---|
| M1 | **ต้นทุน/กำไร (170)** เปิด `/admin/products` → แก้สินค้า | เห็นช่องต้นทุน (วัตถุดิบ/บรรจุภัณฑ์/อื่น) + แผงกำไร % คำนวณจริง · บันทึกแล้วค้าง reload |
| M2 | **พิมพ์ครัว (R21)** ตั้งเครื่องพิมพ์ Nimbot ใน `Settings → การพิมพ์` → แอดมิน "รับออเดอร์" ออเดอร์ใหม่ | ตั๋วครัวถูกส่งเข้าคิวพิมพ์อัตโนมัติ · ปุ่ม 🖨 รายออเดอร์ในหน้า Orders/Kitchen พิมพ์ได้จริง · job = `sent` (ไม่ค้าง `failed`) |
| M3 | **cap ส่วนลด 15% (172)** ใส่คูปอง/แต้มรวมเกิน 15% ของยอดสินค้า | ฝั่งตะกร้า = toast เตือนไทย + ปุ่มสั่งถูกบล็อก (guardrail เดิม) · **server หักได้ไม่เกิน 15% จริง** (คูปอง 50% ของยอด 100 → หัก 15 · ของ 1,000 → หัก 150 — ดูยอดในออเดอร์ที่สร้าง) |
| M4 | **ประตูตรวจสลิป (Owner ask)** ลูกค้าอัปโหลดสลิปออเดอร์ → แอดมิน `/admin/orders` กด "รับออเดอร์" | **เด้ง popover ตรวจสลิปก่อน** (เห็นรูปจริง + ปุ่ม "ยืนยันชำระเงิน" → `confirm_offline_payment`) — ไม่รับข้ามสลิปอีกต่อไป |
| M5 | **แจ้งเตือนครัว (Owner ask)** มีออเดอร์เข้าใหม่ (แอดมิน/ลูกค้าสั่ง) → บทบาทครัวกด bell | กระโดดไป **`/admin/kitchen`** (ไม่ใช่หน้าอื่น) |
| M6 | **ส่งต่อหน้าจัดส่ง (Owner ask)** ครัวกด "พร้อมส่ง" | ระบบพาไป **`/admin/delivery?focus=<order>`** — ออเดอร์ถูกไฮไลต์ |
| M7 | **หักสต็อกรวม (Owner ask)** แอดมินเริ่ม "กำลังเตรียม" | สต็อกวัตถุดิบถูกหักผ่าน `deduct_inventory_for_order` (รวมทุกรอบ) |
| M8 | **my_role (171 · A7)** login owner/manager จริง | หน้าแอดมิน/บทบาทถูกต้อง **ไม่ถูกแปลงเป็น admin** (อาการเดิมถูกปิด) |
| M9 | **Auth A1-A6 retest** — login ผิด → ข้อความไทย+ลองใหม่ได้ · refreshRole ตอนเซสชันหาย · logout ค้างหน้า login จริง · หน้าแอดมิน login แล้วกลับหน้าเดิม | ผ่านครบ (QA review §A1-A8 — ฝั่งโค้ด+test ปิดแล้ว · ขั้นนี้ = ยืนยันบน production) |
| M10 | **id ออเดอร์ใหม่ (173)** สั่งออเดอร์ทดสอบ 1 ออเดอร์ → ดู `orders.id` (report/SQL แอดมิน) | id ใหม่ = `ord-<ตัวเลข 13 หลัก จริง>-<md5>` — **ไม่มี `#` ไม่มี space** (แถวเก่าปล่อยไว้เป็นประวัติ) |
| M11 | **LoadErrorBanner (18 หน้า)** ปิดเน็ต/ DevTools offline แล้วเปิดหน้า Orders/Notifications/Admin ใด ๆ → โหลดไม่ขึ้น → คืนเน็ตแล้วกด 🔄 | เห็น banner "โหลดข้อมูลไม่สำเร็จ" + ปุ่มลองใหม่ refetch จริง — **ไม่เห็นข้อความ "ไม่มีข้อมูล" ปลอม** |
| M12 | **EF image-gen CORS (R21)** ใช้ฟีเจอร์ AI สร้างรูป/คิว | ไม่ติด CORS (ก่อนแก้ = OPTIONS ไม่มี `Access-Control-Allow-Origin` → probe `e2e/efOptions-*.txt`) |
| M13 | **แผนที่ไรเดอร์หน้าลูกค้า (R21f · m174)** สั่งออเดอร์ → แอดมินรับ+มอบหมาย+มอบงาน (สถานะ `dispatched/in_transit`) → เปิด `/track/<เลข>` (ของตัวเอง) | เห็นการ์ด **🛵 ตำแหน่งไรเดอร์** + แผนที่ปักไรเดอร์+จุดส่ง (poll 12 วิ · เวลาอัปเดตโชว์) · **คนอื่น/guest เปิดลิงก์เดียวกัน = ไม่เห็นพิกัด** (RPC คืน null) |
| M14 | **ปุ่มนำทางรายจุด (R21f)** ไรเดอร์มีงาน ≥1 จุด (หรือเปิดงานเดี่ยว) | การ์ด "🗺️ เส้นทางส่งของวันนี้" มีปุ่ม **🧭 นำทาง รายจุด** + การ์ดงานที่กำลังส่งมี **🧭 เปิดนำทางไปจุดส่งนี้** — เปิด Google Maps จริง (ไม่ต้องใช้ API key) |
| M15 | **สูตรอาหารครบทุกเมนู (R21f)** เปิด `/admin/recipes` | dropdown วัตถุดิบ = **คลังทั้งหมด** (เลือกได้แม้สินค้ายังไม่มีสูตร) · เห็นการ์ด **📋 เมนูที่ยังไม่มีสูตร (N เมนู)** กด + เติมในฟอร์มได้ · **สินค้าใหม่ที่เพิ่มใน `/admin/products` โผล่ในรายการนี้เอง** |
| M16 | **เวลาเปิด/ปิดตรงกัน (R21f)** แอดมินตั้งเวลาในการ์ด "🏬 Branch (รัศมี + เวลาสาขา)" → บันทึก → เปิดหน้าแรก (incognito/reload) | toast ยืนยัน "ซิงค์ไปหน้าแรกแล้ว (business_settings.hours)" · **สถานะ 🟢/🔴 หน้าแรก+เช็คเอาท์ตรงกับเวลาที่ตั้ง** (root cause เดิม = การ์ดนี้เขียนแค่ `branches.operating_hours` ซึ่งไม่มีที่ไหนอ่าน — dead UI) · รูปแบบผิด (ไม่ใช่ HH:MM) = เตือน + ไม่ซิงค์ |

---

## สรุปเกณฑ์ปิดงาน (ฉบับตรงความจริง)

- **รันได้เลย:** A1 · A2 · A3 (ผ่าน = verify) · B (รวม B2 เป็น verify · รอช่วง ~11:00) · **C7/C8 (ค่า = VERIFIED แล้ว · รันได้เลย)** · D · E · F · G · H · I · J · K · **L-RT**
- **สถานะพิเศษ (2026-10-26):** **B2 = UNVERIFIED** (เกณฑ์ ~11:00 — เช็ค 22:29 ไม่ตรงเวลา) · **C7/C8 = precondition VERIFIED (mrRead) · ขั้นรัน NOT RUN** · ~~L-10~~ = **APPLIED+VERIFIED** (w7Apply159 · ledger 159) · L-12 = ทางเลือก · **Pages serving = VERIFIED** (marker `btn-locked`) · **parity ย่อย = onlyProd 0** · **server 160 = APPLIED+VERIFIED** (w8Apply160 4 stage · rollback cmd ใน record JSON) · **client hours sync = FIXED (deploy แล้วมีผล · test 17 เคส + gates_sync ALL ZERO)** · **Owner retest 4+1 = hard reload 1 ครั้ง (SW เก่าค้างจริง — ไม่มี skipWaiting)**
- **ไม่ต้องรันซ้ำ (ปิดแล้วมี evidence):** L-1/L-2/L-6/L-9 · **L-3/L-4/L-5/L-7/L-8** (test+gates+CI `67f10b8`) · B-2 legacy contract (7/7) · schema parity (มีรายงาน) — อยากตรวจซ้ำหลัง deploy = ดู **L-RT**
- **ห้ามสรุปว่า "พร้อม Production 100%" / "ปิดครบทุกลูป"** จนกว่า: (1) L-RT + ขั้น B/E/I ผ่านตา Owner หลัง deploy ใหม่ (2) B-2 + schema parity บันทึก แล้วตามเดิม (3) **marketing_rules/B2 มีหลักฐานใหม่** — *(ทำแล้ว ✓ Pages marker · ✓ **159 apply+verify 4 stage** 2026-10-26 · ledger 159)*
- รายการที่ AI รันให้แล้ว (ไม่ต้องรันซ้ำ): tsc/eslint/vitest/build/route-smoke/CI — ดู `docs/BMB_MASTER_STATUS.md` §5 + **§9.0** · HEAD = `5f891de` (#586/#160)
---

## N. รอบ Owner 2026-10-31 (7 คำสั่ง · R38) — บล็อก / งานค้าง / ขั้นตรวจ `[R]`/`[O]`

> ฝั่ง AI ปิดแล้วมีหลักฐาน = ห้ามจดซ้ำเป็นงานค้าง · ยังไม่ verify ด้วยตา/ฮาร์ดแวร์ = ระบุ "รอ Owner ทดสอบ"

### N.0 รายการที่บล็อก/ค้างอยู่ ณ 2026-10-31 (สถานะความจริง)

| # | รายการ | สถานะ | ปิดเมื่อ |
|---|---|---|---|
| ~~BLK-1~~ | **m176 = APPLIED+VERIFIED production (Owner สั่ง "apply 176")** — `e2e/r38Apply176-result.json` **ALL_PASS 8/8** (grant anon + policy เฉพาะ `published` + ลบ `deny_anon` + **ledger top=176**) · `NOTIFY pgrst, 'reload schema'` แล้ว **anon probe = HTTP 200** (เห็น 1 published · อีก 1 non-published ถูก RLS กรอง = พิสูจน์ filter) | **ปิด ✅ 2026-10-31** | — (เหลือแค่ CF deploy ใหม่ + มีโพสต์ published → feed ขึ้นจริง = ขั้น N-F) |
| ~~BLK-2~~ | **m175 = APPLIED จริงแล้ว (แถวเอกสารเดิมเขียนผิด/stale — แก้ตามหลักฐาน)** — `e2e/r22Apply175-result.json` (2026-10-30): ledger top 175 + objects ครบ · **recheck live รอบ apply 176 = `billing175Live: true`** (`billing_subscriptions` + `tenants.custom_domain` อยู่จริง — ใน `e2e/r38Apply176-result.json`) | **ปิด ✅** | — |
| BLK-3 | full vitest ~1,670 ท้องถิ่น = ยังไม่รัน (รอบ R38 = vitest 8 ไฟล์ targeted + tsc 0) | UNVERIFIED local · ให้ **CI ของ HEAD รอบ R38** ตัดสิน | CI Test+Lint+Build = success |
| BLK-4 | **พิมพ์สติกเกอร์จริงหลังแก้ faceH 670→709 = ยังไม่ verify** (ฮาร์ดแวร์) | WAITING Owner | ถ่ายรูป ≥2 ใบต่อกัน = ขอบบนไม่หายทุกใบ (ขั้น N-A) |
| BLK-5 | **เจนรูปจริง 1 ใบหลังตั้ง `IMAGE_GEN_MODELS` = ยังไม่ verify** (ต้อง admin JWT) | WAITING Owner | สำเร็จ + จดโมเดลที่ใช้จริง (ขั้น N-D) |
| BLK-6 | **"โต้ตอบ" บนเว็บ (ไลก์/คอมเม้นใน feed)** = ยังไม่มีสเปก/ไม่มีฟีเจอร์ — ตอนนี้คอมเม้นอยู่ที่ FB → social-ai ตอบ (R26/G6) | OPEN QUESTION | Owner ยืนยันขอบเขต (ต้องการในเว็บด้วยไหม) |

### N.1 ปิดแล้วรอบ R38 (มีหลักฐาน — ห้ามจดซ้ำเป็นงานค้าง)

1. ✅ **สติกเกอร์ตัดขอบบน ("ตั้งค่าไม่ถูก")**: production `print_settings.stickerFaceHPx` **670 → 709** — read-back จริง `e2e/r38_print_fix.cjs` (BEFORE 670 · UPDATE 709 · AFTER 709 · offset คง 0) — ต้นตอ: หน้า 670px < ดวงจริง 709px (40×60 ที่ Owner ยืนยัน) → หน้าถัดไปเริ่มก่อนขอบบน (ขอบหายสะสมทุกใบ) + ช่วงขาวแปลกตามรูป
2. ✅ **image-gen เจนไม่ได้ / โมเดล gemini flash HTTP 404**: ต้นตอ = secret เก่า `IMAGE_GEN_MODEL` (โมเดลร้าง) override default → **ตั้ง secret `IMAGE_GEN_MODELS` แล้ว** ( list ใหม่ขึ้นใน `supabase secrets list` — คู่แรก `qwen/qwen-image-3` + `bytedance-seed/seedream-5-0-flash` )
3. ✅ **ลิงก์แผนที่ไรเดอร์ไปหน้าติดตั้งแอป**: `openMapsUrl()` ใน `deliveryPlan.ts` = intent URL + `package=com.google.android.apps.maps` + `S.browser_fallback_url` ( iOS/desktop คง URL เดิม ) — ใช้ครบทั้ง 3 ปุ่มใน `RiderPwaPage` + test
4. ✅ **ส่งสำเร็จโชว์ 3 ล่าสุด + อัลบั้มประวัติ**: `RiderPwaPage` กรอง `delivered` · เรียง `pod_captured_at` ใหม่ก่อน · `slice(0,3)` ในรายการหลัก · overflow เป็นอัลบั้มพับเปิด/ปิด + test
5. ✅ **AI Studio ปุ่ม browse ไฟล์รูปเมนู**: `mk-browse-image` → upload `bmb-images/marketing/…` → public URL ต่อเข้าชุด `images` เดียวกับภาพ AI/แคตตาลอก (ใช้ร่วมการเจนภาพ/โพสต์) + test
6. ✅ **ดึงเข้าเว็บ = m176 APPLIED+VERIFIED production (Owner สั่ง "apply 176")**: `MarketingFeedSection` mount หน้าแรก + apply ผ่าน `e2e/r38Apply176.cjs` → **ALL_PASS 8/8** (grant anon · policy `marketing_posts_anon_published` · ลบ `deny_anon` · **ledger top=176** · m175 recheck `billing175Live=true`) · PostgREST cache ค้างหลัง GRANT → สั่ง **`NOTIFY pgrst, 'reload schema'`** (`e2e/r38PgrstReload.cjs`) → **anon probe = HTTP 200** (1 published เห็น · 1 non-published ถูก RLS กรอง = พิสูจน์ filter) + test
7. ✅ **gates R38**: vitest **8 ไฟล์ = OK** (รวม `r38Contracts.test.ts` ใหม่) · **tsc 0** · lint = รันก่อน commit (chain gate) · **วงจร CI แดง→แก้**: Contract `4a7321f` = failure ที่ `contracts_033` G1b `unexpected-SELECT=1` (= marketing_posts ที่ m176 grant) → **แก้ allowlist + G1a บังคับ grant + G1c scope-assert published ใหม่** (security ไม่ได้อ่อนลง — เสริม assertion) · **CI Test `4a7321f` = success ✓**

### N.2 ขั้นทดสอบของ Owner (7 คำสั่ง) `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| N-A | **สติกเกอร์**: `/admin/settings` → การพิมพ์ → ค่า `stickerFaceHPx` ต้องโชว์ **709** (probe ซ้ำ 2026-10-31 = **live แล้ว** `e2e/r39_sched_probe.cjs`) → พิมต่อเนื่อง ≥4 ใบ → **วัดระยะขอบล่าง→ขอบล่าง 2 ดวงติด (มม.) × 11.81 = ใส่ค่าใหม่** (709 ไม่รวมช่องว่างระหว่างดวง) → บันทึก → พิมซ้ำ | ขอบบนไม่หายทุกใบ · หัว BITE ME BABY ครบ · ไม่ข้ามดวง ≥4 ใบติด — **ถ้ายังตัด = ใบวัดฟีด + calibrate ม้วนที่เครื่อง + ถ่ายรูปพร้อมไม้บรรทัดส่งมา ห้ามเดาค่าเอง** (= O-D §O) |
| N-B | **ปุ่มนำทางไรเดอร์**: มือถือ Android เปิด `/rider` ที่มีงาน → กด 🧭 ทั้ง 3 ปุ่ม (เส้นทางรวม / รายจุด / งานนี้) | **เปิดแอป Google Maps ตรง ๆ** (ไม่ใช่หน้าติดตั้งแอป) · เครื่องไม่มีแอป = fallback เปิดเว็บ |
| N-C | **ส่งสำเร็จ 3 ล่าสุด**: ไรเดอร์มีงาน `delivered` ≥4 | รายการหลักเห็นแค่ 3 ใหม่สุด · ปุ่ม `📚 อัลบั้มประวัติ ส่งสำเร็จ` เปิดดูที่เหลือครบ |
| N-D | **เจนภาพ**: AdminMarketing → AI Studio → ใส่หัวข้อ → ✨ สร้างภาพ | สำเร็จ · โมเดลคู่แรก (qwen/seedream) ใช้ได้ — ถ้า fallback ข้ามไป gemini จดชื่อโมเดลจริงที่โชว์ใน error มาแจ้ง |
| N-E | **Browse ไฟล์**: ปุ่ม `📁 เลือกไฟล์รูปเมนูจากเครื่อง` | รูปจากเครื่องเข้าชุดภาพ → ใช้กับโพสต์ + ภาพโปรโมต/เทศกาล ร่วมกับภาพ AI ได้ |
| N-F | **โพสต์ + ดึงเข้าเว็บ** (**m176 apply แล้ว ✓** — เหลือขั้นนี้อย่างเดียว): สร้างโพสต์ → กล่องอนุมัติ → อนุมัติ → ตั้งเวลา/รอ publish → เปิดหน้าแรก incognito | โพสต์โผล่ในหัวข้อ **"ประกาศล่าสุดจาก BITE ME BABY"** (ตอนนี้ยังไม่มี build feed ขึ้น/ยังไม่มีโพสต์ published ใหม่ = ปกติ) |
| N-G | **โต้ตอบ**: คอมเม้นใต้โพสต์ FB ที่ publish แล้ว | social-ai classify → draft → ตอบ (R26/G6) · **โต้ตอบในเว็บ = ดู D-1 ใน N.3** |

## O. รอบ R39 — 4 ของใหม่จาก Owner (2026-10-31 สาย) `[T]`

### O.0 ต้นตอ (พิสูจน์แล้ว — ไม่ใช่เดา)

| ของ | ต้นตอจริง (evidence) |
|---|---|
| **O-A ตั้งเวลาโพสต์ไม่ขึ้น (ค้าง scheduled)** | GH cron `7 * * * *` **ไม่ fire** — run ล่าสุด `#1860 = 01:55Z (08:55 ICT)` ไม่มีรอบ 02:07/03:07Z · แถวจริง `mk-mvvspkna-n6uf` (09:50 ICT) = `publish_attempts=0 · error=null` = **worker ไม่เคยแตะ** (`e2e/r39_sched_probe.cjs`) |
| **O-B เจนภาพยังติด gemini** | error เดิมโชว์ "โมเดลตัวสุดท้าย" เท่านั้น — **actual attempts ทุกโมเดลไม่เคยถูกเปิดเผย** (ไม่รู้ว่า qwen/seedream fail ด้วยเหตุอะไร) · ฝั่ง secret `IMAGE_GEN_MODELS` + โค้ดคู่แรก qwen/seedream = ตั้งแล้ว (R38) |
| **O-C จิ้มปุ่มไม่เด้งไปจุดที่ทำงาน** | ไม่มี scroll/feedback หลัง action — แก้ = `flashTo()` (retry รอ re-render · smooth scroll · กระพริบวงส้ม `bmb-flash`) |
| **O-D สติกเกอร์ 709 แล้วยังหัวหาย+ข้ามดวง** | **DB ถูกแล้ว**: `print_settings.stickerFaceHPx = 709 · stickerOffsetYPx = 0` live (probe รอบนี้) — ค้างที่ **ค่า pitch จริงบนม้วน** (709 = 60 มม. มาตรฐาน *ไม่รวมช่องว่างระหว่างดวง*) + calibrate ม้วนที่เครื่อง → **ต้องวัด ไม่เดา** (ดู O-D ขั้นทดสอบ) |

### O.1 ปิดแล้ว (โค้ด + gates)

1. ✅ **`177_marketing_publish_due.sql`**: `marketing_publish_due()` (promote scheduled→published เมื่อถึงเวลา · SECURITY DEFINER) + `marketing_feed_posts()` (promote ก่อนคืนแถว · SETOF) + GRANT anon/authenticated + REVOKE PUBLIC + **pg_cron guarded ทุกนาที** (ไม่มี extension = ข้ามเงียบ) → *PREPARED — หลัง CI เขียว = apply*
2. ✅ **ไม่พึ่ง GH cron อย่างเดียว**: feed หน้าแรก = RPC (คนเปิดหน้า = ปล่อยโพสต์เอง) · `listMarketingPosts` promote ก่อนดึง · **scheduler yml**: marketing ยิงทุกครั้งที่ fire (รวม */5 — เดิมผูกชั่วโมงเดียวที่พัง) · **worker**: รับ `published-but-unpushed` ต่อด้วย FB + ห้าม demote แถว published เป็น failed
3. ✅ **image-gen**: `reference_image_url` (ภาพที่ชี้ → pass with-ref → fail หมด = retry text-only) + **detail = attempts ทุกโมเดล** (เห็น HTTP จริงทุกชื่อ) + คืน `model` ที่สำเร็จ · client = **auto subject/note จากฟอร์ม** (หัวข้อ+เนื้อหาโพสต์) + reference ภาพล่าสุดในชุด → *รอ deploy EF รอบนี้*
4. ✅ **flashTo ครบทุก action**: สร้างโพสต์→แท็บคิว · อนุมัติ/ปฏิเสธ→การ์ดตัวเอง · ตั้งเวลา/AI เลือกเวลา→แถวปฏิทิน · เจนรูป/browse→สตรีมภาพ · CSS `bmb-flash` + `.bmb-flash` keyframes
5. ✅ **gates**: vitest เป้า **9 ไฟล์ 100/100 ผ่าน** (`e2e/r39_vitest_target2.log` — r39Contracts ใหม่ 10 ข้อ) · lint = chain gate ก่อน commit · CI HEAD = ดู probe

### O.2 ขั้นทดสอบ Owner `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| **O-A** | ตั้งเวลาโพสต์ (อนุมัติแล้ว) ~5 นาทีข้างหน้า → รอถึงเวลา → **เปิดหน้าแรก (incognito) หรือแท็บ /admin/marketing** | โพสต์ขึ้นเป็น `published` บนหน้าแรกทันทีที่เปิด · สถานะในตาราง = published ( **ไม่ต้องรอถึงชั่วโมงถัดไป** ) |
| **O-B** | AI Studio: ไม่กรอกโจทย์ภาพ (ปล่อยว่าง) แต่**กรอกหัวข้อ/เนื้อหาก่อน** + มีภาพในชุดแล้วกด "✨ สร้างภาพ" | เจนได้ = ภาพใหม่ในสตรีม (กระพริบ+เด้ง) · **ล้มเหลว = toast โชว์ attempts ทุกโมเดล** (เช่น `qwen...:HTTP404 · ...`) → ส่งข้อความนั้นมา = ทีมปรับ list ตามหลักฐาน |
| **O-C** | จิ้มปุ่มใดก็ได้ (ตั้งเวลา/อนุมัติ/สร้างโพสต์/รูป) | หน้า **เลื่อนนุ่มไปที่ผลลัพธ์** + **กระพริบวงส้ม**รอบ element ที่เปลี่ยน |
| **O-D** | **สติกเกอร์ — วัดก่อนเปลี่ยนค่า**: ① พิมพ์ต่อเนื่อง ≥4 ใบ แล้ว **วัดด้วยไม้บรรทัด: ระยะขอบล่าง→ขอบล่าง ของดวงติดกัน (มม.)** × 11.81 = ใส่ `stickerFaceHPx` (ช่วง 640–760) → บันทึก → พิมพ์ซ้ำ · ② ถ้ายังเพี้ยน = ปุ่ม 📏 ใบวัดฟีด + **calibrate ม้วนที่ตัวเครื่อง** (feed ค้างตอนใส่ม้วน · คู่มือ B1 Pro) | ขอบบนไม่หาย + ไม่ข้ามดวง ≥4 ใบติด · **ถ่ายรูปพร้อมไม้บรรทัดส่งมา** ถ้าค่ายังไม่ตรง (ทีมไม่เดาค่าเอง) |
| **O-E** | FB: โพสต์ scheduled ตัวที่ถึงเวลา (worker ตัวใหม่) | `provider_post_id` ถูกบันทึก = ขึ้น FB ด้วย (website ขึ้นก่อนตาม O-A ไม่ต้องรอ FB) |

> รายการ **รอการตัดสินใจ = §N.3 (D-1/D-2/D-3) ยังคงเดิม** · BLK-4/5/6 เดิมยังเปิด

### N.3 รายการที่เหลือ "ต้องตัดสินใจ" จาก Owner (ตอบข้อใดข้อหนึ่งก็ปิดข้อนั้นได้)

| # | เรื่อง | ตัดสินใจเรื่องอะไร | ถ้าเลือก "ใช่/สั่งทำ" | ถ้าเลือก "ไม่ใช่/ปล่อย" |
|---|---|---|---|---|
| **D-1** | **BLK-6 — โต้ตอบบนเว็บ** | จะให้มี **ไลก์/คอมเม้นใต้โพสต์ใน feed หน้าแรก (บนเว็บ)** ด้วยไหม? ตอนนี้ "โต้ตอบ" ทั้งหมดอยู่บน **Facebook** (คอมเม้น → social-ai classify → draft → ตอบ · R26/G6) — feed ในเว็บตอนนี้ = อ่านอย่างเดียว | สั่งทำ = AI ออกสเปกก่อนเลย: ตาราง+RPC ให้คนทั่วไปคอมเม้นได้ · กลั่นกรอง/กันสแปม (moderation + ซ่อน/ลบของ admin) · แสดงผลใต้การ์ดโพสต์ | ปิดถาวร = **"โต้ตอบ = FB ฝั่งเดียว"** (feed เว็บ = read-only ตามเดิม) |
| **D-2** | **โมเดล image-gen** | หลังทดสอบ N-D: ถ้าคู่แรก `qwen/qwen-image-3` / `seedream-5-0-flash` ใช้ไม่ได้จริง (404/อื่น) หรือข้าม fallback — จะเอาโมเดลไหนขึ้นคู่แรก/ถอดตัวไหน? (`IMAGE_GEN_MODELS` = env แก้ได้ทันที ไม่ต้อง deploy) | ส่งชื่อโมเดลที่ต้องการมา | ปล่อยตาม list ปัจจุบัน 7 ชื่อ |
| **D-3** | **L-12 `menu_rules`/`stop_conditions` ว่าง** | ในแท็บ "⚙️ กติกา" สองช่องนี้จะเติมค่าเองหรือปล่อยว่าง? (ค่าหลัก window/cooldown/frequency มีครบ → C7/C8 รันได้แล้ว) | Owner เติมในหน้ากติกา | ปล่อยว่าง = ใช้ค่าหลักตามเดิม · ปิด L-12 เป็น "ตั้งใจว่าง" |

> ที่เหลือเป็น **"รอผลทดสอบ"** (ไม่ใช่การตัดสินใจ) — N-A สติกเกอร์จริง · N-B ปุ่มนำทาง · N-C 3+อัลบั้ม · N-D เจนรูป · N-E browse · N-F feed ขึ้นเว็บ · N-G คอมเม้น FB → AI ตอบ · BLK-3 รอ CI HEAD · BLK-4/5 = ฮาร์ดแวร์/admin JWT ตา Owner — ผลเป็นอย่างไรส่งมาได้เลย ทีมปรับตามหลักฐานทีละรายการ (two-try rule)