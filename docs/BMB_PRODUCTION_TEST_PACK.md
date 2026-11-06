# BMB — PRODUCTION TEST PACK (ชุดทดสอบรวมสำหรับรันบน production จริง)

> **สั่งโดย Owner 2026-10-26:** "รวบรวมเทสไว้ทดสอบจริงทั้งหมดบนโปรดักชั่นจริง"
> เอกสารนี้ = **รายการทดสอบเดียวที่ใช้ปิดงาน** รวมทุก checklist ที่เคยกระจายอยู่ใน
> `docs/archive/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §4+§5 · `docs/archive/BMB_OWNER_STATUS_REPORT_2026-10-25.md` §D ·
> `docs/archive/BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` §1 (R-16) · Growth & Rewards acceptance ·
> และของใหม่รอบนี้ (CAP-01 เส้นทางสั่งซื้อเดียว · CAP-21 เจาะกลุ่มอัตโนมัติ · CAP-22 AI เลือกเวลา)
>
> **HEAD ล่าสุด = ดู `git log --oneline -1`** (รอบ **R21 ปิดงาน 2026-10-29** — ดู §M) · ก่อนหน้า `02b834c` (apply 160 4 stage + ปิดเซส docs · CI **#595** · Contract **#169**) ·
> **รอบ defect Owner 2026-10-26 (4+1):** **client hours+operating_hours sync = FIXED** (แถบสถานะ/เลือกกรอบ/กดสั่ง) · SW `skipWaiting`+`claim` (ค้าง build เก่า) · markup/coupon/label แก้ · **server 160 = APPLIED+VERIFIED** (Owner สั่ง `__apply 160__` · **w8Apply160 4 stage ALL_PASS** · behavior proof: SAMEDAY 23:3x → `ERR_STORE_CLOSED (8:00–20:00)` · PRE_ORDER ผ่าน) · **Owner retest หลัง deploy = hard reload 1 ครั้ง** · gates `e2e/gates_sync2026-10-26.log` ALL ZERO · **แผนทดสอบทั้งหมด = HANDOFF §2**
> **รอบ R21 (2026-10-29) ทำแล้ว — ขั้นตรวจจริงรวมที่ §M:** migration **170** (ต้นทุน/กำไรสินค้า) · **171** (`my_role()` แก้ is_admin → owner/manager ไม่ถูกแปลงบทบาท) · **172** (cap ส่วนลดรวม 15% ฝั่ง server) · **173** (id ออเดอร์/ประวัติ/แจ้งเตือน = bigint::text ไม่มี `#`/space — หลักฐานก่อนแก้ `e2e/r21eProdIdProbe.json`) · **4 คำสั่ง Owner** (ครัวแจ้งเตือน→หน้าครัว · preparing = หักสต็อกรวม · **ประตูตรวจสลิปก่อนรับออเดอร์** · พร้อมส่ง→หน้าจัดส่ง focus) · **EF CORS image-gen แก้+deploy** · **LoadErrorBanner ครบ 18 หน้า** (6+12) · gates = tsc/lint/vitest/build 0 · CI ทุกรอบเขียว

> **สถานะเอกสารนี้:** runbook สำหรับ **Owner/ผู้ได้รับมอบหมาย** รันเอง · AI ไม่รันแทน (เป็น production write)
> อ้างอิงสถานะปัจจุบัน = `docs/BMB_MASTER_STATUS.md` · **ผลรันทุกขั้นต้องมีหลักฐานจริง (ภาพ/log/query)**
> **คู่มือสอนเดินทุก role (วิธีทำรายข้อ + ต้องเห็นอะไร + จดอะไร):** **รวมอยู่ในไฟล์นี้แล้วที่ §RG + แผน ID เดิม→ใหม่ = §MAP** (ฉบับแยก `BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` ย้ายเข้า `docs/archive/` แล้ว · R62 PHASE 8)

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

> วิธีแต่งตั้ง role = SQL `set_user_role(...)` ใน `docs/archive/BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §5

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

1. ✅ **`177_marketing_publish_due.sql` = APPLIED+VERIFIED production (2026-10-31)**: `marketing_publish_due()` (promote scheduled→published เมื่อถึงเวลา · SECURITY DEFINER) + `marketing_feed_posts()` (promote ก่อนคืนแถว · SETOF) + GRANT anon/authenticated + REVOKE PUBLIC + **pg_cron guarded ทุกนาที** — **`e2e/r39Apply177.cjs` ALL_PASS 6/6 · ledger top=177 · `PROMOTED=2`** (แถวค้าง `mk-mvvspkna-n6uf` 09:50 ICT + `mk-mvvtvqwv-3zjr` → **published แล้ว**) · **feed RPC = anon HTTP 200 · ROWS=3 ทุก published** (`e2e/r39_feed_rpc_probe.cjs`)
2. ✅ **ไม่พึ่ง GH cron อย่างเดียว**: feed หน้าแรก = RPC (คนเปิดหน้า = ปล่อยโพสต์เอง) · `listMarketingPosts` promote ก่อนดึง · **scheduler yml**: marketing ยิงทุกครั้งที่ fire (รวม */5 — เดิมผูกชั่วโมงเดียวที่พัง) · **worker**: รับ `published-but-unpushed` ต่อด้วย FB + ห้าม demote แถว published เป็น failed
3. ✅ **image-gen**: `reference_image_url` (ภาพที่ชี้ → pass with-ref → fail หมด = retry text-only) + **detail = attempts ทุกโมเดล** (เห็น HTTP จริงทุกชื่อ) + คืน `model` ที่สำเร็จ · client = **auto subject/note จากฟอร์ม** (หัวข้อ+เนื้อหาโพสต์) + reference ภาพล่าสุดในชุด → *รอ deploy EF รอบนี้*
4. ✅ **flashTo ครบทุก action**: สร้างโพสต์→แท็บคิว · อนุมัติ/ปฏิเสธ→การ์ดตัวเอง · ตั้งเวลา/AI เลือกเวลา→แถวปฏิทิน · เจนรูป/browse→สตรีมภาพ · CSS `bmb-flash` + `.bmb-flash` keyframes
5. ✅ **gates**: vitest เป้า **9 ไฟล์ 100/100 ผ่าน** (`e2e/r39_vitest_target2.log` — r39Contracts ใหม่ 10 ข้อ) · lint = chain gate ก่อน commit · CI HEAD = ดู probe

### O.2 ขั้นทดสอบ Owner `[O]`

| # | ขั้น | PASS = |
|---|---|---|
| **O-A** | ตั้งเวลาโพสต์ (อนุมัติแล้ว) ~5 นาทีข้างหน้า → รอถึงเวลา → **เปิดหน้าแรก (incognito) หรือแท็บ /admin/marketing** | โพสต์ขึ้นเป็น `published` บนหน้าแรกทันทีที่เปิด · สถานะในตาราง = published ( **ไม่ต้องรอถึงชั่วโมงถัดไป** ) · *ตอนนี้ 2 แถวค้างถูก promote แล้ว = ขึ้นเว็บจริงแล้ว (feed rpc 200 ROWS=3) — ทดสอบเพิ่มด้วยตั้งเวลาใหม่* |
| **O-B** | AI Studio: ไม่กรอกโจทย์ภาพ (ปล่อยว่าง) แต่**กรอกหัวข้อ/เนื้อหาก่อน** + มีภาพในชุดแล้วกด "✨ สร้างภาพ" | เจนได้ = ภาพใหม่ในสตรีม (กระพริบ+เด้ง) · **ล้มเหลว = toast โชว์ attempts ทุกโมเดล** (เช่น `qwen...:HTTP404 · ...`) → ส่งข้อความนั้นมา = ทีมปรับ list ตามหลักฐาน |
| **O-C** | จิ้มปุ่มใดก็ได้ (ตั้งเวลา/อนุมัติ/สร้างโพสต์/รูป) | หน้า **เลื่อนนุ่มไปที่ผลลัพธ์** + **กระพริบวงส้ม**รอบ element ที่เปลี่ยน |
| **O-D** | **สติกเกอร์ — วัดก่อนเปลี่ยนค่า**: ① พิมพ์ต่อเนื่อง ≥4 ใบ แล้ว **วัดด้วยไม้บรรทัด: ระยะขอบล่าง→ขอบล่าง ของดวงติดกัน (มม.)** × 11.81 = ใส่ `stickerFaceHPx` (ช่วง 640–760) → บันทึก → พิมพ์ซ้ำ · ② ถ้ายังเพี้ยน = ปุ่ม 📏 ใบวัดฟีด + **calibrate ม้วนที่ตัวเครื่อง** (feed ค้างตอนใส่ม้วน · คู่มือ B1 Pro) | ขอบบนไม่หาย + ไม่ข้ามดวง ≥4 ใบติด · **ถ่ายรูปพร้อมไม้บรรทัดส่งมา** ถ้าค่ายังไม่ตรง (ทีมไม่เดาค่าเอง) |
| **O-E** | FB: โพสต์ scheduled ตัวที่ถึงเวลา (worker ตัวใหม่) | `provider_post_id` ถูกบันทึก = ขึ้น FB ด้วย (website ขึ้นก่อนตาม O-A ไม่ต้องรอ FB) |

> รายการ **รอการตัดสินใจ = §N.3 (D-1/D-2/D-3) ยังคงเดิม** · BLK-4/5/6 เดิมยังเปิด

## Q. รอบ R41 — 4 ของใหม่จาก Owner (2026-10-31 บ่าย) `[T]`

### Q.0 ต้นตอ (evidence)

| ของ | ต้นตอจริง |
|---|---|
| **Q-A เจน 12:33 = error ตามภาพ** | attempts ใหม่ทำงาน → เห็นจริง: `qwen/qwen-image-3` = **not a valid model ID** · `bytedance-seed/seedream-5-0-flash` = 404 no endpoint · gemini/gpt = chat ตอบ 200 แต่รูปทรง response ที่ parse ไม่ตรง (`no_image`) · ทะเบียนจริง `/api/v1/models` = **12 ตัว output=image ไม่มี qwen/seedream เลย** (`e2e/r41_models_probe.cjs`) |
| **Q-B ชดเชย 62 พิมตรง แต่ faceH 640/709 ยังข้ามดวง (เดี่ยว+ต่อเนื่อง)** | **โมเดลหน้าเติบโตผิด**: `page = faceH + offset` → ทุกใบ +62px (709+62=771 ≠ ระยะฟีดจริง) → เพี้ยนสะสมข้ามดวง · QR ถูกเลื่อนตาม offset จนเลยขอบล่างหน้า · offset ทำงาน = ค่าถึงเครื่องจริง (やは settings ไม่โดน) |
| **Q-C โพสยังไม่มาตามเวลา** | **GH automation-scheduler ง่อยข้ามชั่วโมง** (run ล่าสุด 05:29Z ไม่มีหลังนั้น · ทั้งวัน ~10/288) → queue marketing_publish ไม่รันหลังครบกำหนด · **pg_cron ไม่มีในโปรเจกต์** (`cron.job` = does not exist) → site promote พึ่ง "มีคนเปิดหน้า" อย่างเดียว |
| **Q-D เอไอไม่ตอบโพส** | **inbound ยังทำงาน**: คอมเม้น 05:48Z ตอบ `reply_status=sent` ใน 10 วิ ✓ (webhook→social-ai ปกติ · canAutoSend = full-auto) — ที่พังคือ **outbound/poll**: `g26-poll` ล่าสุด 05:29Z = poll หยุดเมื่อ GH หยุด (worker ตัวเดียว run marketing_publish → FB push + comment poll) |

### Q.1 ปิดแล้ว (โค้ด + gates)

1. ✅ **image-gen**: list ใหม่ = ทะเบียนจริง 6 ตัว (ถอด qwen/seedream · เรียงถูก→แพง) · **images API ก่อน** (`/api/v1/images/generations` — ทุกโมเดล image มี endpoint นี้) + chat fallback + `pickImage` รวมทุกรูปทรง (`b64_json/url/images[]/content parts/source base64`) · **secret `IMAGE_GEN_MODELS` ตั้งค่าใหม่ตอน apply** (ค่าเก่า = ID ผิด!)
2. ✅ **สติกเกอร์ (โมเดลใหม่ R41)**: `stickerPageHeight = faceH เท่านั้น` (offset ไม่ยืดหน้า — ฆ่า +62/ใบ) · เนื้อบนเลื่อนตาม offset ภายในหน้า · **QR = min(ขอบล่างหน้า, tel+40+off) ไม่เลย face** · การ์ดวิธีใช้ปรับเป็น semantics ใหม่ · test อัปเดตตามโมเดลใหม่ (ไม่ weaken — แก้ตามหลักฐาน Owner)
3. ✅ **m178 `178_cron_publish_tick.sql` = APPLIED+VERIFIED production (2026-10-31)**: pg_cron+pg_net **ติดแล้วจริง** · **`bmb-promote` = `* * * * *` active** · **`bmb-tick` = `*/5 * * * *` active** (schedule ผ่าน `format(%L)` — dollar-quote ซ้อนพลาด 1 ครั้ง → แก้ใน `e2e/r41g_schedule_tick.cjs`) · secrets **`BMB_TICK_TOKEN` + `IMAGE_GEN_MODELS` (ทะเบียนใหม่) ตั้งแล้ว** · EF `cron-tick` deploy + gate = **401 ถูกต้อง** · **E2E จริงแล้ว: 06:33Z tick → worker → โพสต์ `mk-mvvz4n44` (05:46) = `published + prov=true` (FB ขึ้น!) + `g26-poll-2026-10-31T06` (comment poll รัน)** — GH = backup เท่านั้น (evidence: `e2e/r41f_state.cjs` · `r41g_schedule_tick.json`)
4. ✅ **gates**: vitest เป้า 8+1 ไฟล์ (sticker 68 + r41) · lint/tsc = chain ก่อน commit · *CI HEAD ก่อนหน้า = `af5f685` in_progress ณ เขียน · `0b70519`/`0985a62` เขียว ✓*

### Q.2 ขั้นทดสอบ Owner `[Q]`

| # | ขั้น | PASS = |
|---|---|---|
| **Q-A** | AI Studio กด "✨ สร้างภาพ" อีกครั้ง | ✅ สำเร็จ = ภาพเข้าพรีวิว+อัลบั้ม (โมเดล gemini/gpt ตัวใหม่ · ทะเบียนจริง) · ❌ = ส่ง attempts ในการ์ดมา (รูปทรง/endpoint ใหม่ที่ยังไม่ตรง) |
| **Q-B** | ตั้งค่าเดิม (ชดเชย 62 · หน้าดวง 709) → **รีเฟรชหน้า** → วิซาร์ด "พิมพ์ต่อเนื่อง 4 ใบ" | ใบ 1–4 **ตรง + ไม่ข้ามดวง** (หน้า = 709 คงที่ทุกใบ — ไม่มี +62 แล้ว) · ถ้ายังข้าม = วัด pitch (ขอบล่าง→ขอบล่าง มม.×11.81) ใส่ "หน้าดวง" ในวิซาร์ด |
| **Q-C** | ตั้งเวลาโพสต์ใหม่ ~10 นาทีข้างหน้า → รอถึงเวลา **ไม่ต้องเปิดหน้าอะไรเลย** | ≤1 นาที: แถว = `published` (cron promote) · หน้าแรกขึ้นเมื่อเปิด · **≤5 นาที**: FB มีโพสต์ (`provider_post_id` ไม่ว่าง — tick→worker) |
| **Q-D** | คอมเม้น/ทัก inbox เพจ → รอ ≤3 นาที (webhook เดิม + poll tick ใหม่) | ตอบอัตโนมัติ (`reply_status=sent`) ทั้งโพสต์และข้อความ |

> **หมายเหตุ**: `BMB_TICK_TOKEN` + `IMAGE_GEN_MODELS(ใหม่)` ตั้งตอน apply m178 (ไม่อยู่ใน git) · ถ้า pg_cron/pg_net ถูก platform ปฏิเสธ = apply ข้ามเงียบ (visit-path + GH ยังเป็น backup — แจ้งใน result json)

### Q.3 ปิดตามคำสั่ง Owner "อนุมัติแอพพลาย 177 178 + ตรวจบั๊ก/ภาษาเพี้ยน" (R42)

| รายการ | ผล (evidence) |
|---|---|
| **m177+m178 re-verify** | `e2e/r42_verify177178.cjs` = **ALL_PASS true** — ledger 176/177/178 ครบ (เติม 178) · fns+acl anon · cron promote/tick active · gate 401 · due=[] (`r42_verify177178.json`) |
| **ตรวจบั๊ก** | CI `1c3b429` **เขียว CI+Contract** · vitest เป้า 86/86 · tsc 0 · lint 0 · (บั๊กที่เจอระหว่างทางแก้แล้ว: verify false-negative · scanner raw-FFFD ตัวเอง) |
| **ภาษาเพี้ยนทั้งหมด** | สแกนใหม่ `e2e/r42_lang_scan.cjs` (U+FFFD · ???? · คำผิด · ข้าม archive/UTF-16): 29 → **0 หลังแก้** (README · config ×2 · contracts_124 · 035 note → "ส่งเองในรัศมี 5 กม." fact-based · HANDOFF_002 ×12 · work-state ×2) · guard ภาษา = **lint OK** |

## P. รอบ R40 — 3 ของใหม่จาก Owner (2026-10-31 สาย 2) `[T]`

### P.0 ต้นตอ

| ของ | ต้นตอจริง |
|---|---|
| **P-A เจนภาพไม่มีสถานะ/พรีวิว/อัลบั้ม — เจนไม่สำเร็จ (non-2xx)** | UI เดิมมีแค่ toast — ไม่รู้ว่ากำลังทำ/เสร็จ/ไปไหน · EF อัปโหลดไป `site-assets/marketing/` (คนละอัลบั้ม) · **log platform ดึงไม่ได้** (3 endpoint 404 — `e2e/r40_imggen_logs2.cjs`) · error body อ่านไม่ได้ = เห็นแค่ "non-2xx" |
| **P-B ตั้งค่าพิมพ์หลายที่แต่พิมพ์ไม่เปลี่ยน** | ปุ่ม **QZ/ไดอะล็อก/ใบเสร็จ-ครัว = HTML path ไม่ใช้ `stickerOffsetYPx/stickerFaceHPx` เลย** (มีแค่ Bluetooth) — Owner วัดผลผิดทาง + หน้าจอไม่เคยโชว์ "ค่าที่ยิงจริง" · `label_type:1` = ค่า validated ของ B1 Pro (registry ทุกโมเดล = 1 ✓ ไม่ผิด) · T40x60 = ยังไม่เคยมี offset วัดบนกระดาษ (registry เดิมยอมรับ) |
| **P-C หัวหาย/ข้ามดวงต่อ + incognito/hard refresh แล้ว** | cache ถูกตัดทิ้งโดย Owner ✓ → เหลือปัญหาค่า/ฮาร์ด → แก้ด้วยวงปิดวิซาร์ด (P-B) |

### P.1 ปิดแล้ว (โค้ด + gates)

1. ✅ **สถานะ/พรีวิว/อัลบั้ม**: `genStatus` 3 สถานะ (⏳ running → ✅ โมเดล+โฟลเดอร์ / ❌ detail) การ์ด `mk-gen-status` + **พรีวิวใหญ่ `mk-gen-result`** + **อัลบั้ม `bmb-images/ai-generated/`** (`mk-ai-album` · จิ้มรูป = `pickAiImage` เลือกใช้ · refresh ข้ามหน้าก็อยู่) · EF อัปโหลดเข้าโฟลเดอร์นี้แล้ว
2. ✅ **error ต้องอ่านได้**: client อ่าน body เป็น **text ก่อน** (json พัง = โชว์ raw) · EF wrap `try/catch` → ทุกกรณีคืน `ERR_UNCAUGHT` + detail (ไม่มี body ว่างอีก)
3. ✅ **วิซาร์ดตั้งค่า (ตั้งหลักใหม่ · `sticker-wizard`)**: ใส่ค่า → **บันทึกอัตโนมัติ** (บันทึกไม่สำเร็จ = ไม่ยิงพิมพ์) → **พิมพ์ด้วยค่านั้นทันที** + toast/จอโชว์ `ชดเชย/หน้าดวง/PNG 472×N px` ทุกครั้ง · ปุ่ม `พิมพ์×4` ตรวจน้ำข้ามดวง (job เดียวผ่าน `printStickerRoll` = เหมือนออเดอร์จริง) · **`btPrintWith` = จุดเดียว** ของทุกปุ่ม BT (จอ=เครื่อง)
4. ✅ **วิธีใช้ 2 ค่า** การ์ดในแผง Bluetooth (ชดเชยฟีด ±px ยังไง · หน้าดวง มม.×11.81/วัด pitch ยังไง) + **ปุ่มที่ไม่ใช้ค่าติด ⚠ "ไม่ใช้ชดเชย" 4 จุด** (QZ · ใบเสร็จ · ครัว · ไดอะล็อก) · helper `mmToStickerPx` (pure)
5. ✅ **gates**: vitest เป้า **8 ไฟล์ 72/72 ผ่าน** (`e2e/r40_vitest_target.log` — r40Contracts ใหม่ 7 ข้อ) · lint/tsc = chain ก่อน commit · CI HEAD = ดู probe

### P.2 ขั้นทดสอบ Owner `[P]`

| # | ขั้น | PASS = |
|---|---|---|
| **P-A** | AI Studio กด "✨ สร้างภาพ" | เห็น **⏳ กำลังสร้าง…** ระหว่างรอ → สำเร็จ = **พรีวิวขึ้น + เด้งไปอัลบั้ม** (จิ้มเลือกใช้ได้) · ล้มเหลว = การ์ดแดง **โชว์เหตุจริงทุกโมเดล** (ส่งข้อความนั้นมา = ปรับโมเดลต่อ) |
| **P-B** | `/admin/settings` → แผง Bluetooth → **วิซาร์ด**: ใส่ `20` → กดปุ่ม "ชดเชยฟีด" → **ดู toast/จอเลข 472×729px** → พิมออกมา | ค่าจอเปลี่ยน = บันทึกจริง (probe ค่า DB ได้) · **กระดาษเปลี่ยนตาม = จบ** · กระดาษไม่เปลี่ยนขณะเลขจอเปลี่ยน = เก็บรูปคู่กับเลขนี้ส่งมา (หลักฐานฮาร์ด/ไลบรารี ไม่ใช่ค่า) |
| **P-C** | หลังตั้งค่าจาก P-B: กด "พิมพ์ต่อเนื่อง 4 ใบ" | หัวไม่หาย + ไม่ข้ามดวง 4 ใบติด · ยังข้าม = ใส่ "หน้าดวง" เป็นมม. (วัด ขอบล่าง→ขอบล่าง ×11.81) ในวิซาร์ดแล้วซ้ำ |

> **หมายเหตุ**: log EF บน platform = ดึงผ่าน API ไม่ได้ (404 ทุก endpoint) → เหตุจริงรอบหน้ามาจาการ์ด `❌` ของ P-A เท่านั้น · ภาพเก่าที่เคยเจน = ยังอยู่ `site-assets/marketing/` (อัลบั้มใหม่โชว์เฉพาะโฟลเดอร์ `ai-generated/`)

### N.3 รายการที่เหลือ "ต้องตัดสินใจ" จาก Owner (ตอบข้อใดข้อหนึ่งก็ปิดข้อนั้นได้)

| # | เรื่อง | ตัดสินใจเรื่องอะไร | ถ้าเลือก "ใช่/สั่งทำ" | ถ้าเลือก "ไม่ใช่/ปล่อย" |
|---|---|---|---|---|
| **D-1** | **BLK-6 — โต้ตอบบนเว็บ** | จะให้มี **ไลก์/คอมเม้นใต้โพสต์ใน feed หน้าแรก (บนเว็บ)** ด้วยไหม? ตอนนี้ "โต้ตอบ" ทั้งหมดอยู่บน **Facebook** (คอมเม้น → social-ai classify → draft → ตอบ · R26/G6) — feed ในเว็บตอนนี้ = อ่านอย่างเดียว | สั่งทำ = AI ออกสเปกก่อนเลย: ตาราง+RPC ให้คนทั่วไปคอมเม้นได้ · กลั่นกรอง/กันสแปม (moderation + ซ่อน/ลบของ admin) · แสดงผลใต้การ์ดโพสต์ | ปิดถาวร = **"โต้ตอบ = FB ฝั่งเดียว"** (feed เว็บ = read-only ตามเดิม) |
| **D-2** | **โมเดล image-gen** | หลังทดสอบ N-D: ถ้าคู่แรก `qwen/qwen-image-3` / `seedream-5-0-flash` ใช้ไม่ได้จริง (404/อื่น) หรือข้าม fallback — จะเอาโมเดลไหนขึ้นคู่แรก/ถอดตัวไหน? (`IMAGE_GEN_MODELS` = env แก้ได้ทันที ไม่ต้อง deploy) | ส่งชื่อโมเดลที่ต้องการมา | ปล่อยตาม list ปัจจุบัน 7 ชื่อ |
| **D-3** | **L-12 `menu_rules`/`stop_conditions` ว่าง** | ในแท็บ "⚙️ กติกา" สองช่องนี้จะเติมค่าเองหรือปล่อยว่าง? (ค่าหลัก window/cooldown/frequency มีครบ → C7/C8 รันได้แล้ว) | Owner เติมในหน้ากติกา | ปล่อยว่าง = ใช้ค่าหลักตามเดิม · ปิด L-12 เป็น "ตั้งใจว่าง" · ✅ **ตัดสินินแล้ว 2026-11-03 (C-1) = เลือกฝั่งขวา**: คงว่างตามเดิม ใช้ค่าหลัก (เงื่อนไข PHASE 3 = ตรวจ fallback + ทดสอบไม่เลือกเมนูผิด + บันทึกความหมาย + ปิด L-12) |

> ที่เหลือเป็น **"รอผลทดสอบ"** (ไม่ใช่การตัดสินใจ) — N-A สติกเกอร์จริง · N-B ปุ่มนำทาง · N-C 3+อัลบั้ม · N-D เจนรูป · N-E browse · N-F feed ขึ้นเว็บ · N-G คอมเม้น FB → AI ตอบ · BLK-3 รอ CI HEAD · BLK-4/5 = ฮาร์ดแวร์/admin JWT ตา Owner — ผลเป็นอย่างไรส่งมาได้เลย ทีมปรับตามหลักฐานทีละรายการ (two-try rule)
---

## R. R43 — บั๊ก 7 ข้อ (Owner 2026-10-31 20:40) · ผล probe + สรุปรอ Owner `[R]`

> รอบนี้ = **read-only probe เท่านั้น** (คำสั่ง "ห้ามโค้ดแก้" ยังอยู่) · ผังเต็ม + evidence = `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-31.md` หัวข้อ R43

### R.1 ผล probe (production evidence จริง — ยังไม่ได้แก้โค้ด)

| # | ข้อ | ต้นตอที่พิสูจน์แล้ว | evidence |
|---|---|---|---|
| R1 | **B2/B3 โพส FB ไม่ตรงเวลา/ไม่ครบ/approve แล้วไม่ขึ้น** | EF `automation-worker` production = **deploy 30 ต.ค. (รอบ R26)** · โค้ด query ใหม่ `or=(scheduled OR published&unpushed)` เพิ่งอยู่ในคอมมิต R39 (31 ต.ค. 10:40) **ไม่เคย deploy** → ตัวจริง query `status=eq.scheduled` อย่างเดียว → m177/m178 promote flip เป็น `published` ≤1 นาที → worker มองไม่เห็น → **`scanned=0` ทุก tick** → **3 แถว published `prov=null` ไม่ขึ้น FB** (`mk-mvwegu4b-o482` 20:00 · `mk-mvvtvqwv-3zjr` 10:17 · `mk-mvvspkna-n6uf` 09:50) + `c60w` **สาย 47.5 นาที** · cron chain เอง = ทำงานจริง (~100%/นาที + ทุก 5 นาที) | `e2e/r43_publish_probe.json` (key `approved_not_on_fb`) · `r43_approval_probe.json` · `r43_due_query_probe.cjs` · `r43_tick_probe.json` · `r43_ef_versions_probe.json` |
| R2 | **B1 ตั้งเวลาได้เดียว + `ERR_APPROVAL_REQUIRED`** | ปุ่ม ⏰ `mk-schedule-*` แสดงกับทุกแถวรวม `pending_approval` ไม่ gate → RPC `marketing_schedule_post` `RAISE ERR_APPROVAL_REQUIRED` (สมมติฐาน ① ยืนยัน · state ค้าง ② ไม่พบในโค้ด) | อ่าน `AdminMarketing.tsx:147/545` + `adminMarketing.ts:90` + m137/m147 |
| R3 | **B4 AI บอก "เปิดถึง 20:00" ทั้งที่ปิด same-day** | prompt ใช้ `SHOP_FACTS_TH` static `"07:00-20:00"` · `getShopContext` ไม่ดึงสถานะสด — reply/inbox/generator ชุดเดียวกัน · state จริงฝั่งเว็บ = `homeProviders.getStoreStatusFromRounds` (EF ไม่ได้ใช้) | อ่าน `social-ai-worker:535` + `_shared/shopContext.ts` |
| R4 | **B6 `?cart=` ว่าง + เคลมผิด catalog** | เว็บรองรับ `cart=` จริง (Layout) แต่ **decode-fail = return เงียบไม่มี toast** · draft validation ไม่บังคับคำตอบอ้าง catalog | อ่าน `Layout.tsx:68-109` + `cartDeepLink.ts` + `shopContext.ts` |
| R5 | **B7 ×4 = 2-เว้น-1** | lib niimbot (`niimbot.js`/`label-size.js`/`label-memory.js`) **ไม่มี logic gap/continuous เลย** = firmware/เซนเซอร์เครื่องจัดการ · `stickerSize` = faceH คงที่ (R41) → หน้าสั้นกว่า pitch จริง | อ่าน `node_modules/niimbot-web-bluetooth/src/*` + `niimbotBt.ts` |
| R6 | **B5 แจ้งเตือนเมื่อบอต AI โพส/ตอบ** | โครง notification ครบ (ตาราง/prefs/RPC/job 5 นาที/push-send/routing) · ยังไม่มี event นี้ → รอ **D-4** | อ่าน migrations 021 + `notificationLinks.ts` + `automation-scheduler.yml` |
| R7 | CI + cron verify (งานค้าง 1-2) | CI `79cd6eb` **NO_FAILED_RUN** · `bmb-promote` ~100%/นาที · `bmb-tick` ทุก 5 นาที · `g26-poll` รายชม. ไม่ขาด | `node e2e\r36_ci_probe.cjs` · `r43_tick_probe.json` |

### R.2 รอ Owner (ตอบรอบเดียวจบ)

1. **ปลดคำสั่งห้ามแก้โค้ด** — เรียงทำ: **① deploy `automation-worker` จาก HEAD (B2/B3 — โค้ดมีแล้ว)** → ② B1 gate + B4 live context + B6 catalog/toast → ③ B7 → ④ B5
2. **D-1..D-4** (§N.3 เดิม + D-4 ช่องทาง/ผู้รับแจ้งเตือนเมื่อบอต AI โพส/ตอบ)
3. **B7: วัด pitch ×4** (ระยะใบ 1→4 มม. ÷ 3 × 11.81 = px) + ถ่ายรูปม้วนหลังพิมพ์
4. **§Q เดิม:** Q-A เจนรูป · Q-C ตั้งเวลา (หลังแก้ B1/B2) · Q-D คอมเม้น ≤3 นาที (หลังแก้ B4) · Q-B ×4 (หลังได้ตัวเลข pitch)

### R.3 ผลแก้ (Owner ปลดห้าม → fix wave 2026-10-31 ~22:00 ICT)

| # | ข้อ | สถานะ | evidence |
|---|---|---|---|
| F1 | **B2/B3** | ✅ **CLOSED (production runtime)** — deploy `automation-worker` v72 @14:51Z → tick 14:55Z `scanned=3/published=3` → **`approved_not_on_fb=[]`** (3 แถวค้างขึ้น FB) · tick ถัดมา scanned=0 = ปกติ | `e2e/r43_ef_versions_probe.json` · `e2e/r43_publish_probe.json` · `e2e/r43_deploy_automation_worker.log` |
| F2 | **B1** | ✅ **FIXED+tested** — gate `schedulable(approved/scheduled/failed)` disabled+คำใบ้ "รออนุมัติ" + guard ใน handleSchedule + map `ERR_APPROVAL_REQUIRED`→ข้อความไทย | `AdminMarketing.tsx` · `src/__tests__/r43Contracts.test.ts` (2 ข้อ) |
| F3 | **B4** | ✅ **FIXED+tested+deployed** — `buildStoreStatusLines` (mirror เว็บ: rounds+hours/operating → sameDayOpen/รอบถัดไป · ZERO-FAKE) ฉีด `STORE STATUS (สด)` + กติกาบังคับ + MAX_CHARS 4000 · `DEPLOY_social-ai-worker/social-post-worker_OK` | `shopContext.ts` · `r43Contracts.test.ts` (4 unit) + `socialAiContinuity.test.ts` |
| F4 | **B6** | ✅ **FIXED+tested** — Layout decode-fail → toast บอกสาเหตุ (ห้ามเงียบ) + rule บังคับชื่อเมนูจาก MENU เท่านั้น | `Layout.tsx` · `r43Contracts.test.ts` |
| F5 | **B7** | ⬜ **BLOCKED — รอ Owner วัด pitch ×4 (มม. ÷3 ×11.81 = px) + รูปม้วน** (ห้ามเดา) | — |
| F6 | **B5** | ⬜ **BLOCKED — รอ D-4 (ช่องทาง + ผู้รับแจ้งเตือน)** · hook จุด reply `sent` / post `published` พร้อม | — |

gates (F2-F4): `npx vitest run` 5 ไฟล์ = **59/59** · `npx tsc --noEmit` = **0** · `npm run lint` = **OK** (eslint + brandNameGuard 499 + languageSanity 1442)
---

## §S — R48 (2026-11-01 รอบ 3) — Notification Hub + GPS ที่อยู่อัตโนมัติ + Theater ปฏิทิน + Maps retest

> คำสั่ง Owner: ระบบแจ้งเตือน E2E (Unified Layer · ไม่ซ้ำ · ไม่แตะ core) + GPS เติมที่อยู่ + ปฏิทิน Theater + ตรวจ Console รอบ 3
> กติกาเดิม §0 บังคับทุกข้อ (hard refresh · บันทึกหลักฐาน · ห้ามใช้ pages.dev)

### S.0 ความจริงเชิงสถาปัตยกรรม (อ่านก่อน — กันเข้าใจผิด)

- **ของเดิมที่ใช้ต่อ (ไม่สร้างใหม่):** `push_subscriptions`+`push-send` EF (VAPID/web-push, m115) · `notifications`+`notification_prefs` (m021) · `automation_queue`+queue-enqueue/dispatcher (m110) · automation-worker `notification_dispatch` (in-app) · pg_cron/pg_net (m178)
- **ของใหม่ R48:** `channel_identities` (PSID/LINE) · `notification_outbox` (transport queue) · RPC 4 ตัว · flags `notification_channels` · EF `notification-dispatcher` · client `notificationManager` · cron `bmb-notify`
- **Queue/Cron "Cloudflare Workers"** ในคำสั่ง Owner = ระบบนี้รันบน stack จริง **GH Actions + pg_cron + Supabase EF** (แบบ m178) — ไม่เปิด Cloudflare Worker ใหม่ (ซ้ำซ้อนของเดิม)
- **LINE = `lineMode:"mock"` (DISABLED)** · เมื่ออนุมัติ: ตั้ง `notification_channels.lineMode='live'` + เขียนผู้ส่งใน dispatcher — **ไม่ต้องแก้ business logic**
- **Abandoned cart 15-30 นาที = ยังไม่เปิด (ซื่อสัตย์):** ตะกร้าอยู่ localStorage `bmb-cart-v1` ไม่มี server cart → ต้องสร้าง `cart_sessions` ก่อน (รอ Owner — ไม่เดา) · **Peak-hour = flag-off** รอ copy+เวลา

### S.1 ขั้นตรวจจริง (Owner รัน · [R] อ่านอย่างเดียว · [O] สร้างข้อมูลเอง)

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| S-1 | Google Console → key → Website restrictions = กด **Save** (รายการถูกแล้ว 4 ตัวตามภาพรอบ 3) | บันทึกสำเร็จ + note "up to 5 minutes" | เวลาที่กด Save |
| S-2 | รอ **5 นาที** เต็ม → เปิด `https://biteme-baby.com/checkout` Chrome ตรง hard refresh | แผนที่+หมุดขึ้น (ไม่ขึ้น "โหลด Google Maps ไม่สำเร็จ") | ภาพ+เวลา |
| S-3 | แท็บเล็ตลูกค้า (ล้างแคชแล้ว) `/checkout` → กด **📍 Use my location (GPS)** | ช่องที่อยู่ **เติมอัตโนมัติ** (ถ้ายังว่าง) + toast เติมแล้ว | ภาพ GPS+ช่องที่อยู่ |
| S-4 | ไรเดอร์ hard refresh (Ctrl+Shift+R) | PWA ใหม่ · แผนที่/ลิงก์ทำงาน (แคชเดิม = เหตุยังไม่ขึ้น) | ภาพ |
| S-5 | `/shop` การ์ดพรีออเดอร์ Theater (hero+การ์ดข้าง) | **ป้ายปฏิทินมุมบนขวา** hover/แตะ = ปฏิทินเดือน วันจัดส่งไฮไลต์ตรงตารางเมนู | ภาพ 2 การ์ด |
| S-6 | สั่งซื้อ 1 ออเดอร์ → รอ ≤5 นาที (`bmb-notify` */5) | outbox มีแถว `ntf-*` → `sent`/`mock`/`failed` (มี last_error บอกช่องทาง) · in-app เหมือนเดิม | `SELECT event_key,status,channel,attempts,last_error FROM notification_outbox ORDER BY created_at DESC LIMIT 5` |
| S-7 | เปิด push (Notification Center) แล้วสั่งอีกออเดอร์ | Web push ถึงเครื่อง (ต้องกด Allow ก่อนถ้ายังไม่เคยเปิด) | ภาพ |
| S-8 | `SELECT value FROM business_settings WHERE key='notification_channels'` | `{push:true, messenger:true, line:false, lineMode:"mock"}` | ค่าที่อ่านได้ |
| S-9 | ดูผล apply | `e2e/r48Apply179-result.json` = `ALL_PASS:true` · ledger top = 179 · `cron.job` มี `bmb-notify` | JSON |
| S-10 **[CAP-14 SMS จริง]** | ตรวจ config `sms` ใน `notification_channels`/THSMS (credit>0) → สั่งออเดอร์พร้อม **เบอร์โทรศัพท์จริงของ Owner** → ระบบส่ง SMS สถานะ (order created/updated ตาม routing) | **ข้อความ SMS ถึงเครื่องจริง** (เครือข่ายไทย · มีชื่อร้าน/สถานะ) | ภาพหน้าจอ SMS + เวลา + ข้อความจริง (ถ้าไม่มา = จุด `last_error` ใน outbox/EF log ส่งมา) |

---

## §T. รอบ R56–R59 (2026-11-02) — รายการทดสอบรวม production ของงานใหม่ทั้งหมด `[R]`/`[O]`

> **สั่งโดย Owner (ปิดเซสชัน R59):** "รอรับผลการทดสอบรายการทั้งหมดตามเอกสาร production test suit"
> หลักฐานฝั่งโค้ด/gates = `AI_WORK_STATE.md` บล็อก **R56–R59** · ขั้นนี้ **Owner รันเอง** บน `https://biteme-baby.com`
> เริ่มด้วย **hard refresh (Ctrl+Shift+R) 1 ครั้ง** · `[R]` = อ่านอย่างเดียว · `[O]` = สร้างข้อมูลทดสอบเอง
> **จำนวนข้อจริง = 19 แถว** (T-A 6 · T-B 3 · T-C 4 · T-D 4 · T-E 2) — รอบ R60 เคยเขียน "20 ข้อ" = **DOC DRIFT แก้แล้ว (R62 D-4) ห้ามเพิ่มข้อปลอม**

### T-A. ระบบตอบ/โพสอัตโนมัติ Facebook (R57 + R58) `[O]`

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| T-A1 | คอมเมนต์ใต้โพส FB จริง เช่น "มีอะไรอร่อยบ้าง" → รอ bot ตอบ | คำตอบอ้างเมนู/ราคาจริงจากเว็บ + ปิดท้ายชวนสั่ง `biteme-baby.com/shop` | ภาพคำตอบ |
| T-A2 | ถามพรีออเดอร์เมนูที่**อยู่ในปฎิทิน** (เทียบวันจาก `/menu` แท็บจองล่วงหน้า) | ตอบ **วันที่ตรงกับปฎิทินจริงเป๊ะ** (ห้ามเดา) | ภาพ + วันจริง |
| T-A3 | ถามเมนูที่**ยังไม่ลงปฎิทิน** | ตอบว่า **"เปิดจองล่วงหน้าเร็ว ๆ นี้"** — ไม่บอกวัน/เดือน | ภาพคำตอบ |
| T-A4 | แตะลิงก์ `…/shop?cart=…` ในคำตอบ จาก Facebook **Android** | **กระโดดไป Chrome ทันที** (ไม่ค้าง in-app) · เปิดมา = มีสินค้าในตะกร้าครบตามที่สรุปไว้ | ภาพ 2 จอ |
| T-A5 | แตะลิงก์เดียวกันจาก **iPhone** | แบนเนอร์บังคับ "เปิดใน Safari" — **ไม่มีปุ่ม "อยู่ที่นี่ต่อ"** | ภาพ |
| T-A6 | ดูโพสที่ bot สร้าง/ตอบล่าสุด | ภาพ+ข้อความตรงข้อมูลจริง ไม่แต่งเมนู/ราคา/วันมั่ว | ภาพโพส |

### T-B. การ์ดประกาศหน้าแรก = ภาพเจน + มาสคอตสลับไม่ซ้ำ (R58) `[R]`

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| T-B1 | hard refresh `/shop` → การ์ดประกาศ/โปรโมชั่นลอย (สูงสุด 2) | โชว์**ภาพ** (ภาพของโพสนั้น → ภาพโฆษณาลอยที่ตั้งไว้ → อัลบั้ม `ai-generated/{promo,festival}`) **แทนมาสคอตตัวใหญ่** | ภาพหน้าจอ |
| T-B2 | ดูน้อง Bite ที่มุมรูป 2 การ์ด | **ตัวเล็ก (46%)** · คนละมุม · **คนละท่า = สลับไม่ซ้ำกัน** | ภาพ 2 การ์ด |
| T-B3 | (ถ้า) ยังไม่มีรูปเจนในระบบเลย | fallback = มาสคอตบนพื้นส้ม ท่าสลับตามลำดับ — ไม่ใช่บล็อกว่าง | ภาพ |

### T-C. เพิ่มเมนู: เลือกรูปจากภาพเจน + ลดขนาดอัตโนมัติ (R59) `[O]`

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| T-C1 | แอดมิน → เมนู → เพิ่ม/แก้เมนู → ช่อง "รูปเมนู" → ปุ่ม **🖼 เลือกจากรูปที่เจน (AI)** | พาเนลคลังภาพเปิด (จาก `bmb-images/ai-generated/`) + เลื่อนไปที่พาเนลอัตโนมัติ | ภาพ |
| T-C2 | กดเลือกรูปสักใบ (โดยเฉพาะใบใหญ่ ~2048px) | toast **"ลดขนาดรูปอัตโนมัติ (กว้างสุด 1024px) แล้วบันทึกเข้าคลังภาพ"** · พรีวิวขึ้น · บันทึกแล้วการ์ดเมนูโหลดเร็ว | ภาพ + toast |
| T-C3 | อัปโหลดไฟล์/ถ่ายกล้องปกติ (รวมไฟล์ใหญ่) | ย่ออัตโนมัติก่อนvalidate เหมือนกัน — ไม่โดน error 5MB สำหรับไฟล์ที่ย่อได้ | ผล |
| T-C4 | (ทางเลือก) เจนรูปเมนูที่ AI Studio ก่อน → กลับมา T-C1 | รูปใหม่ขึ้นคลังทันที | ภาพ |

### T-D. สติกเกอร์ 40×60 — ตัวอักษร/วงกลมใหญ่สุดเท่าที่จะใหญ่ได้ + stroke (R59) `[O]`

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| T-D1 | ตั้งค่า → เครื่องพิมพ์ → ปุ่ม **ทดสอบสติกเกอร์** (ทาง QZ/dialog) | แถว **Pre-Order / Same Day** และ **ทานที่ร้าน / สั่งกลับบ้าน / รับที่ร้าน** = **ขนาดเท่ากันและใหญ่สุด** (9px · วัดจริงแล้ว `e2e/r59_sticker_fit.json`) · วงกลม ○/● ใหญ่ขึ้นชัดเจน · แถว `[PAID]` ใหญ่ขึ้น (7px) | ภาพใบจริง |
| T-D2 | ใบเดียวกันทาง **Bluetooth (Niimbot)** | เท่าทาง dialog (mode/svc = **26px** · paid = **20px**) — สองทางพิมพ์ตรงกัน | ภาพ |
| T-D3 | อ่านค่าที่กรอก/ให้ AI พิม (ORDER LIST · NOTICE · Attn · Add · ยอดรวม) | **ตัวหนาชัด (stroke ชั้นเดียว `.sheet *`)** — หัวข้อจากแบบ Owner ไม่หนาซ้ำจาก rule ที่สอง | ภาพซูม |
| T-D4 | พิมพ์จริง 1 ใบ (auto-print ตอนสั่งซื้อ) | ไม่ล้นขอบ · ไม่ตัดบรรทัด · QR ชิดขอบล่าง · วงกลมติ๊กถูกช่อง | ภาพใบจริง |

### T-E. กติกาสติกเกอร์เดิมรอบ R56 (ยังไม่รัน) `[O]`

| # | ขั้น | ต้องเห็นอะไร | จดอะไร |
|---|---|---|---|
| T-E1 | ใบเสร็จ/ใบครัว 1 ใบ | Date/TIME = เวลาตอนพิมพ์ (ไม่ใช่เวลาสั่ง) · ติ๊ก ● ตรงตาม `order_mode` + หมวดบริการจริง | ภาพ |
| T-E2 | ออเดอร์ที่จ่ายด้วยบัตรเครดิต | `[PAID]` ติ๊กช่อง **B/T** (แก้จุดเดียว `PAID_METHOD_TO_OPTION` ใน `src/lib/stickerForm.ts` ถ้าอยากย้ายช่อง) | ผล |

**เกณฑ์ปิด §T:** ทุกข้อผ่าน = จดผลลง `AI_WORK_STATE.md` (รอบถัดไป) · ข้อไหน fail = จด defect + ภาพ แจ้งรอบหน้า — **ห้ามตัดข้อทิ้ง**


---

## §MAP — Old → New Test ID map (R62 PHASE 8 · แหล่ง ID เดิม → ตำแหน่งใหม่ในไฟล์นี้)

> **ไฟล์เดียวที่ใช้ปิดงาน = เอกสารนี้** · ID จากเอกสารเก่าทั้งหมดชี้มาที่นี่ · **ห้ามใช้ ID จากไฟล์ย้ายเข้า archive แล้วโดยไม่เทียบตารางนี้**

| แหล่งเดิม (ย้ายเข้า `docs/archive/` แล้ว) | ID เดิม | ตำแหน่งใหม่ในไฟล์นี้ |
|---|---|---|
| `docs/archive/BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` §3 (บท 1 ลูกค้า) | B1–B7 · E1 · J1–J4 · RL-DEFECT · RT-L3/4/5/7/8 · H10 | §B · §E · §J · §L-RT · §H (RL-DEFECT = §0 รอบ defect 2026-10-26) |
| เล่มเดิม §4 (บท 2 แอดมิน/Owner) | C1–C8 · E2 · G1 · I1–I4 · K · H1 | §C · §E · §G · §I · §K · §H |
| เล่มเดิม §5–§12 (บท 3–10 role อื่น) | H2 (ครัว) · H3 (คลัง) · H4 (การเงิน) · H5 (การตลาด) · H6 (POS) · H7 (ซัพพอร์ต) · H8 (ผู้ตรวจ) · F1/F2 + H9 (ไรเดอร์) | §H (ตาราง role 13 ค่า) · §F (rider ring) |
| เล่มเดิม §13 (ขั้นผูกเวลา) | B2 (~11:00) · RT-HOURS · C7/C8 | §B2 · §L-RT (RT-HOURS) · §C (C7/C8) |
| `BMB_MASTER_TEST_CHECKLIST_2026-10-28.md` §1 (P0 retest) | 1A–1I | ผล Owner retest 44 ข้อ = บันทึกใน checklist ฉบับนั้น (ยัง KEEP) · ขั้นตรวจจริง = §M/§N/§O/§P/§R |
| เล่มเดิม §2–§4 (P1) | 2-x · 3-x · 4-x | §B–§E · §L-RT · §C (C7/C8) |
| เล่มเดิม §5–§7 (P2/P3) | settings-sync 14 คีย์ · role (§6) · 7-x | §H (role) · §L-RT · §J (G&R) |
| `BMB_PRODUCTION_TEST_PACK.md` §T (R56–R59) | T-A1..T-E2 = **19 แถว** | อยู่ในไฟล์นี้ §T (ไม่เปลี่ยน ID) |

**กติกา:** FAIL = จด defect ใหม่ลง `AI_WORK_STATE.md` · SKIPPED ≠ PASS · ห้ามตัดข้อทิ้ง · เกณฑ์ปิด = §RG §16 (ด้านล่างสุดของไฟล์นี้)

---

## §RG — คู่มือสอนเดินทุก Role (ฉบับเต็ม · รวมมาจาก `BMB_OWNER_ROLE_TEST_GUIDE_2026-10-27.md` → MOVE เข้า `docs/archive/` แล้ว · R62 PHASE 8)


> **หน้าที่ไฟล์นี้:** สอน Owner เดินทดสอบ production ครบทุก role / ทุกฟีเจอร์ ตามลำดับที่ถูกต้อง + บอกว่าข้อไหนต้องเห็นอะไร/พลาดแล้วจดอะไร
> **เกณฑ์ผ่าน-ไม่ผ่านทุกข้อ** = `docs/BMB_PRODUCTION_TEST_PACK.md` (รายการเดียวที่ใช้ปิดงาน) — ไฟล์นี้ = วิธีเดิน/สอนตา **ไม่ตัดสิน PASS ซ้ำ**
> **แผนหลัก** = `docs/archive/BMB_HANDOFF_NEXT_SESSION_2026-10-26.md` §2 (8 ขั้น) · **สถานะจริง** = `docs/BMB_MASTER_STATUS.md` · HEAD ณ เขียนไฟล์นี้ = `d5b29d4` (ยึด `git log --oneline -1` เสมอ)

---

## RG·0. ก่อนเริ่ม — ทำทุกครั้ง (ครั้งแรก ~5 นาที)

1. ใช้ **`https://biteme-baby.com`** เท่านั้น — ห้าม `bitemebaby-5f7.pages.dev` (build เก่า)
2. **Hard reload (Ctrl+Shift+R) 1 ครั้งแรกทุกอุปกรณ์** — SW ใหม่มี `skipWaiting`+`claim` แล้ว (ต้นตอ "UI เก่าค้าง") · หลังจากนั้นถ้าต้องพิสูจน์ว่า "ไม่ค้าง" ใช้ **หน้าต่าง incognito**
3. เปิด DevTools → Console ทิ้งไว้ทุกหน้าที่ตรวจ — error แม้แต่ตัวเดียว = จด
4. เตรียมบันทึกผล: `ข้อ · เวลา · PASS/FAIL · ข้อความ toast สีแดง (คัดลอก verbatim ห้ามจำ) · screenshot`
5. เครื่องหมาย: `[R]` = อ่านอย่างเดียว · `[O]` = สร้างข้อมูลทดสอบของท่านเอง (จดเลข order ไว้)
6. ข้อไหน FAIL = **จดเป็น defect ใหม่** ลง `AI_WORK_STATE.md` แจ้งแชทถัดไป · ห้ามแก้เอกสารให้ดูผ่าน (กติกา 0.2/0.6) · ห้ามตัดข้อทิ้ง

## RG·1. ลำดับรัน 8 ขั้น (แผนที่บทต่าง ๆ ในไฟล์นี้)

| ขั้น (HANDOFF §2) | ทำอะไร | ไปบทที่ |
|---|---|---|
| 1 | อ่านตามลำดับ + hard reload 1 ครั้ง | §0 |
| 2 | Retest defect 4+1 (RL-DEFECT) | §3.1 |
| 3 | RT-HOURS (นอกรอบ 08:00–20:00) | §13 |
| 4 | L-RT (test pack §L-RT) | §3.2 + §13 |
| 5 | B2 ~11:00 + C7/C8 ขั้นรัน | §13 + §8 |
| 6 | §F ring · §G Bing · §H AI · §I copy · L-10 · L-11 | §14 (⚠️ DOC DRIFT) |
| 7 | Backlog audit (ทำแล้วฝั่งโค้ด — เหลือ spot check ด้วยมือ) | §15 |
| 8 | เกณฑ์ปิด | §16 |

## RG·2. เตรียมบัญชี/Role (ครั้งเดียวก่อนเข้าบท 5–12)

> ระบบ role 13 ค่า (migration 146/147) · แต่งตั้งด้วย SQL ใน Supabase Dashboard → SQL Editor (ไม่มี UI)

```sql
-- แต่งตั้งรายบัญชี (เปลี่ยน <UUID> เป็น user id จริง)
SELECT set_config('request.jwt.claims', '{"sub":"<ADMIN-UUID>","role":"authenticated"}', false);
SELECT public.set_user_role('<ADMIN-UUID>'::uuid, 'owner');
SELECT public.set_user_role('<UUID-KITCHEN>'::uuid,   'kitchen');
SELECT public.set_user_role('<UUID-INVENTORY>'::uuid, 'inventory');
SELECT public.set_user_role('<UUID-FINANCE>'::uuid,   'finance');
SELECT public.set_user_role('<UUID-MARKETING>'::uuid, 'marketing');
SELECT public.set_user_role('<UUID-POS>'::uuid,       'pos');
SELECT public.set_user_role('<UUID-SUPPORT>'::uuid,   'support');
SELECT public.set_user_role('<UUID-AUDITOR>'::uuid,   'auditor');
-- rider: ระบบตั้งให้เองเมื่อ link drivers.user_id (trigger drivers_promote_rider)
```

เตรียมบัญชี: **owner/admin 1 · kitchen 1 · inventory 1 · finance 1 · marketing 1 · pos 1 · support 1 · auditor 1 · rider 1 (ผูก drivers) · ลูกค้าทดสอบ 2** (ใช้เบอร์ทดสอบ)

## RG·3. บทที่ 1 — ลูกค้า (Customer) `[B1–B7 · E1 · J1–J4 · RL-DEFECT · RT-L3/4/5/7/8 · H10]`

### RG·3.1 RL-DEFECT — Retest 4+1 ข้อรอบ defect Owner 2026-10-26 (ขั้นที่ 2 ของแผน · สำคัญสุด)

> ทุกข้อ: hard reload ก่อน · ใช้ทั้ง desktop + มือถือ · ถ้าพลาด **จด toast สีแดง verbatim**

| # | ทำอะไร | ต้องเห็น (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| ① โลเคชั่น | หน้าแรก/checkout ให้ระบบอ่านตำแหน่งร้าน/ผู้ใช้ | ระยะทาง/พื้นที่ส่ง **ห่าง ≤ 300 ม.** ถูกต้องตามพิกัดครัวจริง (`kitchen_location`) | ตัวเลขระยะที่ขึ้นจริง |
| ② คูปอง | ใส่โค้ดส่วนลดในตะกร้า → **reload หน้า** → ไป checkout | โค้ด **ยังใช้อยู่ทันที ไม่ต้องกดใหม่** · ไม่คืนสถานะ pending ปลอม | สถานะหลัง reload |
| ③ ที่มาส่วนลด | ดูสรุปยอด checkout | แสดง `ส่วนลด (ประมาณการ · โค้ด XXXX)` — บอกที่มาชัด | ข้อความที่ขึ้นจริง |
| ④ ฿ 2 ตำแหน่ง | ดูราคา/ค่าส่ง/ส่วนลดทุกจุด (รวม markup) | ทศนิยม **2 ตำแหน่งเสมอ** (เช่น ฿201.36 ไม่มี ฿201.359…) | ตัวอย่างที่เพี้ยน |
| ⑤ สร้างออเดอร์จริง | สั่ง SAME_DAY 1 ออเดอร์จนจบ (ขั้น 3.3) | ได้เลข `BMB-YYYYMMDD-xxx` จริง | **toast สีแดงตอนกดสั่ง** + เวลา |

### RG·3.2 เดินหน้าร้านตามฟีเจอร์ (L-RT · test pack §L-RT)

| จุดที่เดิน | ทำอะไร | ต้องเห็น (PASS) |
|---|---|---|
| **RT-L3** จิ้มแล้วเลื่อน | จิ้มแท็บ/หัวข้อ/ลิงก์ฟุตเตอร์/BottomNav บนหน้าแรก · `/menu` · หน้าอื่น | เลื่อนถึงเป้าหมาย (ส่วนใหญ่ = บนสุดของ scroller) **เหมือนกันทุกหน้า ไม่นิ่งค้าง** |
| **RT-L4** `/menu` 2 แท็บ | ดูหัวข้อทั้ง 2 แท็บ (ส่งวันนี้ / จองล่วงหน้า) | หัวข้อครบตามสต็อก · แท็บจอง: การ์ด/ปุ่มเปลี่ยนเป็น "จองล่วงหน้า (ร่วมรอบ)" **ไม่โชว์ "สั่งเลยวันนี้"** |
| **RT-L5** `/vote` | ตรวจ 3 จุดข้อความไทย + รายการเมนู | "กรุณารอ" / "เมนูไหนที่น่าลอง" / "โหวตได้ครั้งละ 1 เมนู" · เห็นเมนูครบไม่ถูกซ่อนผิด |
| **RT-L7** ลำดับหมวด | หัวข้อแนวนอน (หน้าแรก/เมนู) + ฟุตเตอร์ | ลำดับ: ส่งวันนี้ → จองล่วงหน้า → สุขภาพ → เครื่องดื่ม → ของทานเล่น → สำเร็จรูป · ลิงก์ไปหมวดจริง · ฟุตเตอร์ลำดับเดียวกัน |
| **RT-L8** ปุ่มล็อก | การ์ดพรีออเดอร์ยังไม่ถึง/เลยคัทออฟ (list/detail/theater/AI) + cart รอบเก่า | ปุ่ม **สีเทา กดไม่ได้** (`.btn-locked` + aria-disabled) · cart รอบเก่า = แถบเตือน + +/- ใช้ไม่ได้ + checkout ถูกบล็อก |
| B1 `[R]` | หน้าแรก + `/menu` (desktop + มือถือ) | ไม่มี console error · รูป/ป้ายไม่เพี้ยน · หัวข้อ/แท็บไม่โชว์ซ้ำ · การ์ดไม่มีเส้นกรอบ |
| B5 `[R]` | กรณี addItem ถูกบล็อก (ปิดขาย/สินค้าถูกถ่ายโอน) | ขึ้นเตือน **ไม่** โชว์ "เพิ่มแล้ว" และ **ไม่** เด้งไป checkout |
| B6 `[R]` | ปุ่มจากรีวิว (Review CTA) บนสินค้าปิดขาย | ขึ้นเตือน ไม่โชว์ "เพิ่มลงตะกร้าแล้ว" |
| C4 `[R]` | เปิด `/menu?category=<id>` (คัดลอกจากลิงก์หมวด) | เปิดถูกหมวด · ปุ่มจองล่วงหน้ายังใช้ได้ |

### RG·3.3 สั่งซื้อ/จ่ายเงิน (B3/B4/B7 · E1 · J1–J4)

1. **B3 `[O]` SAME_DAY** — เลือกสินค้าในรอบที่ยังไม่เลยคัทออฟ → ตะกร้า → checkout กรอกชื่อ/โทร/ที่อยู่ → สั่ง → ติดตามสถานะจริง · **ระบบห้ามเลือกรอบให้เองผิด**
2. **B4 `[O]` PRE_ORDER** — เลือกวันที่มีเมนูปฏิทิน ภายในคัทออฟ → สำเร็จ · ทดสอบอีกรอบหลังเกินคัทออฟ = **ต้องถูกปฏิเสธพร้อมเวลา HH:MM จริง**
3. **B7 `[O]` ตะกร้าผสม** — เมนูปฏิทิน + สินค้าทั่วไป → เลือกรอบที่ยังไม่ผ่านคัทออฟ → **ออเดอร์เดียวสำเร็จ**
4. **E1 `[O]` จ่ายเงินจริง 1 ออเดอร์** (ช่องทางที่เปิดใช้) + อัปโหลดสลิป → สลิปต้องขึ้นหน้าตรวจของ OrdersHub **ทันที**
5. **J1 คูปอง/โปรโมชัน** — ใช้คูปองจริง 1 ใบ → ส่วนลดถูกตาม scope · ปิด kill switch แล้วใช้ไม่ได้
6. **J2 Referral** — เปิดลิงก์ `?ref=` / ใช้รหัสแนะนำ 1 ครั้ง (หน้า `/share` + ReferralBox ใน checkout) → ได้แต้ม/ผลตอบแทนตามระดับ · ยกเลิกแล้วมี reversal ledger
7. **J3 Loyalty** — สะสมแต้มจากออเดอร์ (ดู `/rewards` + `/profile`) → tier/points ถูก · แต้ม append-only ไม่หาย/ไม่ทับ
8. **J4 Spin/Affiliate/Catalog** — เล่น Spin (`/spin`/RandomMenu) ได้/ไม่ข้าม daily cap · affiliate ไม่จ่ายเงินสด · แคตตาล็อกที่แอดมินเพิ่มใช้ได้
9. **H10 `[O]`** — login ลูกค้า: **ไม่เห็นลิงก์ Admin** · พิมพ์ `/admin` เอง = redirect กลับ `/`

## RG·4. บทที่ 2 — แอดมิน/Owner (บัญชี owner/admin) `[C1–C8 · E2 · G1 · I1–I4 · K · H1]`

### RG·4.1 โครงหน้า + ออเดอร์ + สินค้า

| ขั้น | ทำอะไร | ต้องเห็น (PASS) |
|---|---|---|
| C1 `[R]` | เปิด `/admin` desktop sidebar + มือถือ drawer | **5 กลุ่ม / 19 รายการ** · ทุกลิงก์ไปหน้าจริง · เปลี่ยนหน้าแล้ว scroll ขึ้นบนสุด |
| C2 `[R]` | `/admin/delivery` → แท็บ "รอบจัดส่ง & แพทเทิร์น" | **ไม่มีช่องคัทออฟใด ๆ นอกจาก "ปรับของพรีออเดอร์"** (ช่อง "ปิดรับเดิม (legacy)" หายไปจริง) · แถวรอบ/หน้าแรกไม่โชว์ "ปิดรับ HH:MM" |
| C3 `[R]` | `/admin/products` | ชื่อหมวดใต้การ์ดตรงกับแท็บเสมอ |
| C5 `[R]` | `/admin/orders?mode=PRE_ORDER` | query ถูก preset + grouping header แสดง |
| C6 `[R]` | `/admin/customers` (CAP-21) | แถบสรุปกลุ่ม + คอลัมน์ "กลุ่ม/คำสรุป (อัตโนมัติ)" · **ไม่มีช่องกรอกเกณฑ์/ปุ่มบันทึก** · โหลดใหม่ยังคำนวณเอง |
| E2 `[R]` | อนุมัติสลิปจาก E1 | ผ่าน · สถานะ paid ตรงกับ DB (อ่านจากหน้ารายงาน) · กดซ้ำ = idempotent (R3-E) |
| G1 `[R]` | แผนที่ใน checkout + `/admin/delivery?tab=routes` (มือถือ+desktop) | แผนที่โหลด · ไม่ขึ้น "ยังไม่ได้ตั้งค่า VITE_GOOGLE_MAPS_API_KEY" (ถ้าขึ้น = ต้อง deploy ใหม่หลังตั้ง key) |

### RG·4.2 พิมพ์/Print-to-PDF (§I · test pack I1–I4 · R-16)

| ขั้น | ทำอะไร | ต้องเห็น (PASS) |
|---|---|---|
| I1 | เว้นว่างชื่อเครื่องพิมพ์ทั้งสองช่องใน Settings → สั่งพิมพ์ | เปิดไดอะล็อกเบราว์เซอร์ → เลือก "บันทึกเป็น PDF" |
| I2 | เปิด autoPrint ทั้งสองสวิตช์ → สั่งออเดอร์ทดสอบ → จ่าย → ยืนยันครัว | PDF ใบเสร็จ (เลข order/รายการ/ยอด/วันเวลา ครบ) + PDF คิวครัวครบ · ภาษาไทยไม่เพี้ยน |
| I3 | จำลองเครื่องพิมพ์เสีย → สั่งพิมพ์ | job = `failed` **ไม่ค้าง `sent`** |
| I4 | กดยืนยัน 'printed' ใน UI | job = `printed` (state ตรง DB) |

### RG·4.3 ตรวจระบบแบบรอบด้าน (R3 §12 A–Q = เส้นทาง E2E ลึก — เลือกข้อที่ยังไม่เคยรัน)

| ID | เดินอะไรในฐานะ Owner | จุดที่ต้องเห็น |
|---|---|---|
| **D** | รวม SAME_DAY เข้า batch PRE_ORDER | order_mode/origin/round เดิมไม่เปลี่ยน · มี audit · ไม่สร้างออเดอร์ซ้ำ |
| **J** | Failure matrix: จ่ายล้ม/retry · กดสั่งซ้ำเร็ว · POD ตัดเน็ต · ส่งไม่สำเร็จ · ยกเลิก/คืนเงิน · กดย้อนสถานะสิ้นสุด | idempotent (124) · error ชัดลองใหม่ได้ · refund ผ่าน EF admin-only · สถานะสิ้นสุด **ถูกปฏิเสธ** (TERMINAL) |
| **K** | คูปองหลัง reload → checkout (ซ้ำกับ RL-DEFECT ②③) | ส่วนลดแสดงที่เดียวไม่ซ้ำ · ยอด checkout = ที่ server คิดจริง |
| **O** | ตรวจ backup (§9 + Actions `daily-backup`) | เห็น backup ล่าสุด + drill PASS · ขั้นตอนกู้ทำตามได้จริง (CAP-17) |
| **P** | ดู `automation_queue` + Actions `automation-scheduler` | jobs `sched-*` รันตามเวลา · idempotent · ไม่มี failed ค้าง |
| **Q** | เทียบ `audit_logs` + order_status_history + `payment_intents` | audit ตรงลำดับเวลา · ยอด/สลิป/POD สะท้อนกัน · ไม่มี intent ซ้ำคู่ใหม่ |
| K1/K2 `[R]` | อ่าน `BMB_MASTER_STATUS.md` + `AI_WORK_STATE.md` | ตรง build ที่ใช้ · ไม่มี DONE ไร้ evidence · ข้อไหนเอกสารขัดหน้าจริง = **จด DOC DRIFT** (ถือโค้ด/หน้าจริงถูก) |

### RG·4.4 ตั้งค่า → ต้องเห็นผลจริง (ต่อกับ §15)

เปิด `/admin/settings` แล้วลองแก้ค่าทีละตัว (แก้แล้วคืนค่าเดิม): `hours` · `operating_hours` (branches) · `delivery_policy` · `kitchen_location` · `social_links` · `theater_daily_copy` · `push_config` — ดู §15 ว่าแต่ละค่าต้องไปปรากฏที่ไหน

## RG·5. บทที่ 3 — ครัว (Kitchen) `[H2]`
1. login บัญชี `kitchen` → `/admin` → ต้องเห็นเฉพาะ **ภาพรวม / ออเดอร์ / ครัว / สูตร / รอบ / เมนู** — ไม่เห็น รายงาน/ตั้งค่า/องค์กร
2. เปิดหน้าครัว (R3-F): ออเดอร์จากขั้น 3.3 เข้าคิว **ถูกสาขา/ถูกเวลา** · เปลี่ยนสถานะไปข้างหน้าได้ตาม chain · **ย้อนหลัง/ข้ามขั้นไม่ได้**
3. **สร้าง batch ในหน้าครัวได้จริง** (H2) — จดเลข batch

## RG·6. บทที่ 4 — คลัง (Inventory) `[H3]`
1. login `inventory` → เพิ่ม/แก้/ลบ **วัตถุดิบได้จริง** (grant + policy คืนแล้ว)
2. R3-N: สั่งออเดอร์ที่ผูกสูตร → stock **ลดตอนขาย/คืนตอนยกเลิก** · event ซ้ำไม่ลดซ้ำ · รายงานขาย/จ่าย/คืนตรงออเดอร์ทดสอบ · ไม่โชว์กำไรสุทธิปลอม

## RG·7. บทที่ 5 — การเงิน (Finance) `[H4]`
1. login `finance` → ดูรายงานการเงินได้ · **ปิดวัน (close_day) ได้จริง**
2. เทียบยอด E1/E2 กับรายงาน — ต้องตรงกัน

## RG·8. บทที่ 6 — การตลาด (Marketing) `[H5 · C7/C8 · §H AI]`
1. login `marketing` → เห็นเมนูการตลาดครบ · สร้าง/อนุมัติ/ตั้งเวลาโพสต์ได้ (รวมปุ่ม AI)
2. **C7 (ขั้นรัน — ปลดล็อกแล้วเพราะค่า `marketing_rules` VERIFIED):** `/admin/marketing` → แท็บ "📅 ปฏิทิน" → กด **"🤖 ให้ AI เลือกเวลาทั้งหมด"** → โพสต์ **อนุมัติแล้ว** ถูกตั้งเวลา (toast สรุปจำนวน) · โพสต์ยังไม่อนุมัติ **ไม่ถูกตั้งเวลา** (กติกา CNT-01 ห้าม auto-approve)
3. **C8 (รันหลัง C7):** ทิ้งเวลาถึงชั่วโมงถัดไป → worker รายชั่วโมงเผยแพร่โพสต์อัตโนมัติ → สถานะ `published` **โดยไม่มีใครกด publish มือ**
4. แท็บ "rules": ตรวจแผง PromotionBudget · Referral · Loyalty · Spin · Affiliate · RewardsCatalog + กติกา `marketing_rules` (โพสต์/สัปดาห์ · หน้าต่างเวลา 10:00–19:00 · cooldown 6 ชม. · content_mix) — แก้ค่าแล้วบันทึกได้จริง (ค่า = ตารางจริง ไม่มีฝังโค้ด)
5. L-12 = **✅ ปิดแล้ว (CLOSED 2026-11-03 · มติ C-1)** — `menu_rules`/`stop_conditions` = **ตั้งใจว่าง** · evidence: `marketingAutoSchedule.test.ts` describe L-12 (**14/14 PASS** — planSchedule ทำงานด้วยค่าหลักเมื่อสองฟิลด์เป็น `{}` + contract: executable code ไม่อ่านสองฟิลด์นี้) + header `marketingAutoSchedule.ts` บันทึกความหมาย · ขั้นตรวจ Owner: เปิดแท็บ "⚙️ กติกา" เห็นสองช่องว่าง → กด C7/C8 → **ระบบใช้ค่าหลัก (window 10:00–19:00 · cooldown 6 ชม. · 3 โพสต์/สัปดาห์ · content_mix) ไม่เลือกเมนูผิด ไม่หยุดทำงาน** = PASS

## RG·9. บทที่ 7 — POS `[H6 · R3-M]`
1. login `pos` → เห็น POS/ออเดอร์/ลูกค้า/รายงาน
2. เปิด Web POS → สั่ง/รับ pickup → ตั้งค่าเครื่องพิมพ์ → สั่งพิมพ์ (มีเครื่องจริง) → print job เข้า `print_jobs` + รายงาน **สำเร็จ/ล้มเหลวจริง** · staff เห็นเฉพาะสิทธิ์ตัวเอง ข้อมูลลูกค้า/เงินรั่วไม่ได้

## RG·10. บทที่ 8 — ซัพพอร์ต (Support) `[H7]`
1. login `support` → เปิดออเดอร์/ลูกค้า/แจ้งเตือนได้
2. **แก้ไขอะไรไม่ได้เลย** — ลองกดปุ่มแก้/ลบ ทุกหน้าที่เห็น = ต้องไม่มีหรือกดไม่ได้

## RG·11. บทที่ 9 — ผู้ตรวจ (Auditor) `[H8]`
1. login `auditor` → เปิดได้ **ทุกหน้ารายงาน/บันทึก**
2. **อ่านอย่างเดียวจริง** — ไม่มีปุ่มแก้/ลบ/อนุมัติทำงานได้สักปุ่ม

## RG·12. บทที่ 10 — ไรเดอร์ (Rider) `[F1/F2 · H9 · R3-G/H/I]`
1. login บัญชีที่ผูก `drivers.user_id` แล้ว → `/rider` → PWA ทำงาน (H9) · แผนที่/เส้นทางโหลด (F2)
2. **G (assign):** แอดมินเปิด Delivery Management → assign ไรเดอร์/รอบ → ถูกคน/ถูกไรเดอร์ (Bite Drive) · ไรเดอร์เห็นงานใน PWA · audit `delivery_assigned`
3. **H (POD):** บนมือถือจริง → รับงาน → เดินทาง → ที่จุดส่ง: **ปุ่มถ่ายรูป (กล้อง) และปุ่มเลือกรูปจากเครื่อง ใช้ได้ทั้งคู่** → อัปโหลด → ยืนยันส่ง (F1: รูปขึ้นจริง · สถานะเปลี่ยน · ค้าง `sent/failed` = ไม่ผ่าน) · เน็ตหลุดมีปุ่มลองใหม่ · `pod-photos` มีไฟล์ใต้ `drivers.id/` · **คนอื่นเปิด/ลบ/เขียนทับรูปไม่ได้**
4. **I (track):** ลูกค้าเปิด Track + แอดมินดูหน้าเดียวกัน → ไทม์ไลน์ตรงเหตุการณ์จริงทุกฝั่ง (poll/focus refresh) · delivered ขึ้นพร้อมกันเมื่อรีเฟรช

## RG·13. ขั้นผูกเวลา/เงื่อนไขพิเศษ

### RG·13.1 B2 — แถบสถานะหน้าแรก ~11:00 `[R]` (UNVERIFIED — verify ครั้งแรกของ Owner)
- **เวลา:** ช่วง ~11:00 (มีหน้าต่างเวลา — เช็คนอกเวลาถือว่ายังไม่จบ)
- **ทำ:** เปิดหน้าแรก → อ่านแถบสถานะ
- **PASS =** บอก **เซมเดย์ยังสั่งได้ (ร้านยังเปิด)** + **พรีออเดอร์ = รอบถัดไป (วันที่ 27)** ตามเวลา/รอบจริง
- **FAIL =** ถ้ายังโชว์ "🟢 เปิดรับออเดอร์ เช้า" ทั้งที่เลยคัทออฟแล้ว = defect เดิมยังอยู่ → จด `AI_WORK_STATE.md`

### RG·13.2 RT-HOURS — นอกเวลาเปิดร้าน (ตั้ง `hours` = 08:00–20:00 · ทดสอบ ~20:30 ขึ้นไป หรือ toggle ให้ปิด)
บนหน้าแรก + `/checkout` (incognito/hard reload):
1. แถบสถานะ **ไม่บอกเซมเดย์ "ยังสั่งได้"** (เป็น `preorder_only`/`closed` + โชว์ "ถึง 20:00" เมื่อร้านเปิด)
2. รอบเซมเดย์ใน checkout = **ปิดในการตั้งค่าร้าน**
3. กดสั่งเซมเดย์ = **toast ร้านปิด** · ถ้าฝ่า client ได้ **server 160 บังจริง** → RPC คืน `ERR_STORE_CLOSED: ร้านปิดแล้วตามเวลาที่แอดมินตั้ง (8:00–20:00)` (มี behavior proof แล้ว `e2e/w8Apply160-verify.json` · PRE_ORDER ยังผ่านตามปกติ)
4. เวลาที่แสดงทุกจุด = `HH:MM` (ไม่มี `:00:` เพี้ยน)
5. **toggle `operating_hours` ในแอดมิน = มีผลจริง** (ปิดสวิตช์รอบ → รอบนั้นสั่งไม่ได้ทันที)

### RG·13.3 C7/C8 — ดูบทที่ 8 (precondition ผ่านแล้ว = ค่า `marketing_rules` VERIFIED 2026-10-26)

## RG·14. §F ring · §G Bing · §H AI · §I copy · L-10 record · L-11 LED

> **อัปเดต 2026-10-27 (R9):** Owner สั่ง "Backend+AI Part 1 ไม่เคยสร้างนะ ต้องใช้สร้างใหม่เลย" →
> **สร้างแล้ว: `docs/archive/BMB_BACKEND_AI_PART_1.md`** (เรียบเรียงจากโค้ดจริง — §F ring · §G คีย์แผนที่/ผู้ให้บริการ
> · §H AI CL1–4/A1–4 · §I copy · L-10 · L-11) — ทดสอบตามเอกสารนั้นประกอบตารางด้านล่าง
> **หมายเหตุคงเดิม:** ถ้าท่านมีต้นฉบับเก่าในเครื่อง ส่งมาเทียบ — ต่างกัน = ยึดต้นฉบับท่าน ·
> "ข้อ 7/8/13/16/17/19" = แถว CAP-07/08/13/16/17/19 ใน `BMB_MASTER_STATUS.md` §2 (รอท่านยืนยัน) ·
> **L-11 (LED)** ยังไม่พบในโค้ดใดเลย — ต้องรอท่านนิยาม

| รายการ | คำอธิบายตามโค้ดจริง (ASSUMPTION — รอ Owner ยืนยัน) | วิธีทดสอบ |
|---|---|---|
| **§F ring-system** | ring carousel ของ Food Theater (`/shop` · `FoodTheater.tsx` + `TheaterCards.tsx` — scroll-swipe + `theaterReasons`) | เปิด `/shop` · รูดวงแหวนทั้งมือถือ/เดสก์ท็อป · การ์ดเปลี่ยนเรียบไม่ค้าง · เหตุผลโชว์ตามกติกา (favorite/memory/ใหม่/prep) |
| **§G N-1 (Bing API key ถ้ามี)** | web-search key สำหรับ AI (ทางเลือก — ไม่มี key ข้ามได้) | ถ้ามี key: ทดสอบค้นข้อมูลผ่าน AI แล้วได้ผลจริง · ไม่มี = ข้าม + จด "SKIPPED (no key)" **ไม่นับ PASS** |
| **§H AI (CL1–CL4 / A1–A4)** | บทสนทนา AI Waiter (Talk to Bite) ระดับ CL1–4 + automation A1–4 | คุยกับ AI ครบ 4 ระดับ (ทักทาย/สั่งอาหาร/ถามข้อมูล/แก้ปัญหา) + ตรวจ automation 4 ตัว — **รายละเอียดเกณฑ์ต้องขอจากต้นฉบับ Owner** |
| **§I copy** | ตรวจข้อความ/ป้ายทั้งเว็บ (ไทยธรรมชาติ 100% · ห้ามป้ายเทคนิค/`BANNED_KICKERS`) | เดินหน้าแรก/เมนู/โหวต/checkout/ฟุตเตอร์ — จดทุกจุดที่เจอภาษาไม่ธรรมชาติ |
| **L-10 record (159)** | "ถ้า Owner ยังไม่เคย approve หน้า record" = ตรวจว่าท่านเคยกด approve หน้า record/ledger ของ migration 159 หรือยัง | เปิดหน้า record ที่เกี่ยวข้อง → ถ้ายังไม่เคย approve = กด + จดเวลา (evidence `e2e/w7Apply159-record.json` มี ledger 159 แล้ว) |
| **L-11 LED** | ⚠️ ไม่พบนิยามใน repo — ต้องขอจากต้นฉบับ Owner | ยืนยันกับ Owner ก่อนรัน |

## RG·15. Backlog settings-sync spot check (ผล audit โค้ด 2026-10-27 — `e2e/backlogAudit-settings-sync-2026-10-27.json`)

> Audit ฝั่งโค้ด (เขียน/อ่านจริงทุก key) = **ผ่านครบ 12 key** · ขั้นต่อไปนี้ = ยืนยันด้วยมือว่า **แก้ค่าแล้วเห็นผลจริง** (แก้แล้วคืนค่าเดิม)

| key (ที่มา) | แก้ที่ | ต้องเห็นผลที่ |
|---|---|---|
| `hours` (business_settings) | `/admin/settings` | แถบสถานะหน้าแรก · `/checkout` · server 160 (`ERR_STORE_CLOSED`) |
| `operating_hours` (branches) | `/admin/settings` + toggle รายรอบ | รอบใน checkout · แถบสถานะ · ปุ่ม toggle ปิด = สั่งไม่ได้ |
| `delivery_policy` | `/admin/settings` | รัศมี/ค่าส่ง/markup/ส่งฟรี/สกุลเงิน ในตะกร้า/checkout (`platformConfigBootstrap`) |
| `kitchen_location` | `/admin/settings` | ระยะทาง/โซนจัดส่ง (`config/kitchenLocation.ts`) |
| `order_pattern` (รอบ 3 รอบ/วัน) | `/admin/delivery?tab=rounds` | ชื่อรอบ/เวลาส่ง/ความสามารถรอบ ในหน้าแรก + checkout |
| `order_policy` (คัทออฟพรีออเดอร์) | `/admin/settings` (typed form) | คัทออฟพรีออเดอร์ใน checkout |
| `promotion` budget | `/admin/marketing` → rules → PromotionBudgetPanel | ขอบเขตคูปอง/ส่วนลดที่ลูกค้าใช้ (J1) |
| `loyalty` | LoyaltySettingsPanel | แต้ม/tier ใน `/rewards` `/profile` |
| `referral` | ReferralSettingsPanel | รางวัลแนะนำใน `/share` + ReferralBox |
| `spin` | SpinSettingsPanel | รางวัล/daily cap ใน Spin (J4) |
| `push_config` | `/admin/settings` (admin-managed VAPID) | ได้ notification จริงบนมือถือ (test pack ขั้น 8 ของ acceptance #8) · โค้ดอ่านผ่าน RPC `get_push_config` เท่านั้น |
| `social_links` / `theater_daily_copy` | `/admin/settings` | ลิงก์ Footer/`/contact` · ข้อความวงแหวน `/shop` หมุนตามวัน |

## RG·16. บันทึกผล + เกณฑ์ปิดงาน

**แบบบันทึกต่อข้อ:** `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL/BLOCKED · Order/Ref · Evidence (ภาพ/log/query) · ข้อความ toast ถ้าพลาด`
**FAIL** = จด defect ใหม่ใน `AI_WORK_STATE.md` (ห้ามนับของเดิมซ้ำ) · **SKIPPED ≠ PASS** (ข้ามข้อใดจด "SKIPPED (เหตุผล)")

**ปิดงานได้เมื่อครบ (ทุกข้อต้องมี evidence จริง):**
1. **RL-DEFECT 4+1** ผ่านหลัง hard reload + **RT-HOURS** + **B2 ~11:00** + **C7/C8** ผ่าน
2. **test pack รันผ่านทั้งที่รันได้** (A1–A3 · B · C · E · F · G · H · I · J · K · L-RT) — ไม่มีข้อ FAIL ค้าง
3. **CAP แถว 7/8/13/16/17/19** (ตามคำอธิบาย §14 — รอ Owner ยืนยันเลขข้อ) = ปลดครบ
4. **§F/§G/§H/§I/L-10/L-11** = รันครบหรือมีคำสั่ง Owner ให้ข้ามเป็นลายลักษณ์อักษร
5. ทุกข้อในตาราง §1 ของแฮนด์ออฟมี evidence · **`git status --short` ว่าง** · **HEAD = `git log --oneline -1`** · CI/Contract ของ HEAD ทุกตัวเขียว
6. ตาม UNIVERSAL §4 (งานต้องไม่มี `NOT_STARTED`/`IN_PROGRESS` ค้าง · งาน VERIFY ต้องมีหลักฐาน) + §7.1 gates A–J + §10.1 DoD

> ⚠️ **จนกว่าจะครบ 6 ข้อนี้ — ห้ามพูดว่า "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"** (กติกาเดิมทุกฉบับ)

---

## C4. ภาคผนวก — Runtime-bound test map ตามมติ C-4 (2026-11-03) · **ห้ามตัดข้อทิ้ง**

> มติ Owner (C-4): เก็บรายการทดสอบ **ทั้งหมด** · Developer เตรียมขั้นตอน+ข้อมูลให้ครบ · **Owner รันเอง · ห้าม AI อ้างผ่านแทน** ·
> ตรวจความครบด้วย `node e2e/r63PackC4Check.cjs` → `e2e/r63PackC4-check.json` (ต้อง missing=[])

| CAP (C-4) | ทดสอบเรื่องอะไร | ขั้นในเอกสารนี้ | ต้องเตรียมอะไร |
|---|---|---|---|
| **CAP-10** ตรวจสลิปจริง | อัปโหลดสลิป → แอดมินตรวจ → ยืนยันชำระ | **§E** (การจ่ายเงิน+ตรวจสลิป) + **M4** (ประตูตรวจสลิป) | สลิปโอนจริง/ทดสอบ · ออเดอร์ค้างชำระ |
| **CAP-11** Rider POD จริง | ไรเดอร์ถ่าย/อัปโหลดรูป POD บนมือถือ | **F1** + **§RG §H.3** (ขั้น H POD) | มือถือไรเดอร์ + กล้อง + ออเดอร์จัดส่งจริง |
| **CAP-13** Web push จริง | push ถึงเครื่องจริง | **S-7** (+ S-8 flag) | กด Allow notification · ออเดอร์ทดสอบ |
| **CAP-14** SMS จริง | SMS สถานะถึงเบอร์จริง | **S-10** (เพิ่มรอบนี้) | เบอร์รับจริง · THSMS credit · config เปิด |
| **T-A1/A2/A3/A6** | ตอบ/โพส FB จริง (บัญชี FB) | §T-A | บัญชี Facebook จริงของร้าน |
| **T-A4** | กระโดด Chrome จากแอป FB (Android) | §T-A | มือถือ Android + แอป Facebook |
| **T-A5** | iOS in-app banner + "อยู่ที่นี่ต่อ" | §T-A | iPhone + Safari/FB จริง |
| **T-D1..D4 / T-E1/E2** | พิมพ์สติกเกอร์/ใบเสร็จจริง | §T-D · §T-E | เครื่องพิมพ์ QZ/Niimbot + กระดาษ 40×60 |

> **ผลรันทุกแถว = ส่งกลับพร้อมหลักฐาน (ภาพ/query/log)** · แถวไหนไม่ผ่าน = ทีมแก้ตามหลักฐาน (two-try) · **FINAL CLOSURE รอข้อสรุปชุดนี้**

---

## R64. รีเทสตามที่ Owner รายงาน 6 จุด (2026-11-03 ค่ำ) `[O]`

> ทีมตรวจ evidence ครบแล้ว (ดู `AI_WORK_STATE.md` บล็อก R64) — 4 จุดแก้โค้ดแล้ว (deploy/push รอบนี้) · 1 จุด = ไดรเวอร์ Windows หาย (ทำเอง 30 วิ) · 1 จุด = พิสูจน์แล้วไม่ใช่บั๊ก (แต่มีขั้นให้สังเกต)

| # | ขั้น | ต้องเห็นอะไร |
|---|---|---|
| R64-1 | **ไดรเวอร์พิมพ์ (A):** เปิด ตั้งค่า → เครื่องพิมพ์ → อ่านหัวข้อ **"QZ/คิวเสียงรับแต่ไม่ออก — เช็ค 30 วินาที"** → เช็คไดรเวอร์คิว `Nimbot B1Pro_BmB` | ไดรเวอร์ = **Generic/Text Only = ตัวการ** (ยืนยันแล้วจากเครื่องจริง) → ติดตั้งไดรเวอร์ Nimbot B1 Pro ใหม่ → ตั้ง `qzPrinterName` ชี้คิวไดรเวอร์จริง → กด **ทดสอบใบเสร็จ** กระดาษออก · **ชั่วคราวกดผ่าน Bluetooth = ใช้ได้ทันที (ไม่ผ่านคิว)** |
| R64-2 | **Push (B):** บนแท็บเล็ต → **ล็อกอินด้วยบัญชีลูกค้าก่อน** (ไม่ใช่แอดมิน/ยังไม่ล็อกอิน) → แถบ "เปิดการแจ้งเตือน" เด้งหลังล็อกอิน → เปิด → สั่งออเดอร์ทดสอบ | แถบ **ไม่เด้งบนหน้า /login อีก** (แก้แล้ว) · อุปกรณ์ที่เคยกดไว้บนหน้า login = **ถูกลงทะเบียนเองทันทีที่ล็อกอิน** (auto-reconcile) · push/Notice ถึง = ต้องมี **ออเดอร์ event จริง** (แถว notice เก่า = อ่านหมดแล้ว ไม่มีของใหม่เพราะยังไม่มี event วันนี้) |
| R64-3 | **สรุป AI (C):** คอมเมนต์ใต้โพส "บะหมี่ไก่ย่าง" สั่งอาหาร (ทั้งพิมพ์ชื่อเมนู และแบบสั้น "เอา 2") | สรุป/จับคู่ = **เฉพาะเมนูที่โพสระบุ** · พิมพ์เมนูอื่นนอกโพส = **ถามกลับ ไม่เดา** (worker deploy แล้ว — คอมเมนต์รอบใหม่ใช้กฎใหม่) |
| R64-4 | **Floating (D):** hard refresh `/shop` (ลบแคช+แคช sessionStorage ถ้าเคยปิดการ์ดไว้) | เห็น **1 ประกาศ + 1 โปรโมชั่น HALLOWEEN (มีรูปอัปโหลด)** คู่กัน (สลับชนิดใหม่ — ประกาศ 2 ใบห้ามเต็มโควตาอีก) |
| R64-5 | **ลิงก์จาก FB (E/F):** เปิดลิงก์ `/shop?cart=` จากคอมเมนต์ FB ในแอป Facebook | แถบ **"🔗 คุณเปิดลิงก์จาก Facebook" โผล่ทันทีทุกหน้า** (ไม่เงียบอีก) + ระบบยิง Chrome อัตโนมัติ · ไม่เด้ง = กดปุ่ม **🌐 เปิดในเบราว์เซอร์ภายนอก** (gesture) → ทำตะกร้า/เช็คเอาท์ต่อใน Chrome |
| R64-6 | **Notice bell (B):** ล็อกอินบัญชีลูกค้าที่มีออเดอร์ → เปิดกระดิ่ง | เห็นประวัติ + badge จากออเดอร์ใหม่ (ทดสอบ = สั่งออเดอร์จริง 1 ใบ แล้วดูทั้ง bell + push) |

---

## R67. รอบปิดเซส 2026-11-04 — งาน 4 ข้อที่ AI รันให้แล้ว + ขั้นตรวจของ Owner เริ่มจากหน้าแชท `[R]`/`[O]`

> **สิ่งที่ทีมรันให้แล้ว (ไม่ต้องรันซ้ำ — ดู evidence):** gates ปิดเซส `tsc=0 · lint=0 · vitest 206 files/2,053 tests/0 fail · build=0` (`e2e/_close_gates.log`) · **E2E Matrix PASS 12/12** (`e2e/e2e-result.json`) · **Chat-Hang พิสูจน์สด 3.3 วิ** (`e2e/_r67_chat_live.json`) · **route smoke 39/39** (`e2e/_close_routenav.log`) · **CI `c26c143` = success ทั้ง 2 workflow** (`e2e/_r67_ci_probe.json`)
> **สถานะ = พร้อมให้ Owner ทดสอบ live production แต่ยังไม่ประกาศ PRODUCTION READY** (เกณฑ์ปิดจริง = §RG·§16 ข้างล่าง)

### R67.1 งานที่ปิดแล้วในรอบนี้ (มีหลักฐาน — ห้ามจดซ้ำเป็นงานค้าง)

| # | งาน | ผล | evidence |
|---|---|---|---|
| R67-A | **E2E Matrix** (`e2e/runE2E.cjs`) | **PASS 12/12** — same-day + pre-order + empty-cart + floating banners · ออเดอร์จริง `BMB-20261104-365` + `PO-20261105-931` | `e2e/e2e-result.json` · `e2e/screenshots/01..11*.png` |
| R67-B | **SEO Meta Routes** | ครบ (มี `/orders` `/notifications` `/track/:orderNumber` = dynamic param จริง) | `src/lib/seo.ts` · `r67Contracts` T3 · `seo.test.ts` 30/30 |
| R67-C | **Chat-Hang ของ AI Waiter** | `mascotService` deadline 8s · `TalkToBite` time-box 15s · ผลสด = ตอบจริง 3.3 วิ ไม่ค้าง | `e2e/_r67_chat_live.json` · `r67Contracts` Chat-Hang 4 ตัว |
| R67-D | **FAQ + ตัวเลขโปร ตรง backend** | ลบ hardcode (รอบ/แต้ม/รางวัล/เบอร์) · Footer ส่งฟรีแสดงเฉพาะเมื่อ server enforce · เบอร์ร้าน `082 6096995` ตรงทุกฝั่ง | `src/lib/faqContent.ts` · `Footer.tsx` · `shopContext.ts` |

### R67.2 ขั้นตรวจของ Owner บน production — **เริ่มที่หน้าแชท** `[O]`

| # | ขั้น | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R67-1 | เปิดหน้าแรก `/` → แถบแชท **Talk to Bite** → พิมพ์ "มีอะไรอร่อยบ้าง" → ส่ง | ได้ **คำตอบจริงจากเมนูร้าน** ภายใน ~3–15 วิ · ช่องพิมพ์/ปุ่มส่ง **กลับมาใช้ได้เอง** (ไม่ค้างหมุน) | ถ้าหมุนค้าง > 60 วิ = จดเวลา + ภาพจอ |
| R67-2 | ในแชท กดปุ่มลัดต่าง ๆ (ดูเมนู / แนะนำ / สั่งซ้ำ / เช็กออเดอร์) | ทุกปุ่มตอบ/พาไปหน้าเป้าหมาย **ไม่ค้าง** และ **ไม่มี ErrorBoundary ขึ้นแทนหน้า** | จดข้อความ error บนจอ |
| R67-3 | ดูหน้า `/faq` | ข้อความ/ตัวเลข **ไม่ hardcode** (ค่าส่ง·รัศมี·ส่งฟรี·วิธีชำระเงิน·เวลาเปิดร้าน มาจากระบบ) · เบอร์/อีเมลตรงกับหน้าติดต่อ | จดบรรทัดที่ขัดกับหน้าอื่น |
| R67-4 | ดูฟุตเตอร์ทุกหน้า | ข้อความ "ส่งฟรีเมื่อครบ ฿..." **ขึ้นเฉพาะตอนที่ระบบเปิดใช้จริง** และตัวเลขตรง `delivery_policy.free_shipping_threshold` | จดข้อความ/ตัวเลขที่เห็น |
| R67-5 | เปิด `/orders` และ `/notifications` (ล็อกอินลูกค้า) + `/track/<เลขออเดอร์>` | title/canonical ของแต่ละหน้าถูกต้อง · `/track/<เลข>` ใช้ **เลขจริง** (ไม่ใช่ `:orderNumber`) | จด title ที่เห็น |
| R67-6 | สั่งอาหารทั้ง 2 โหมด (ส่งวันนี้ / จองล่วงหน้า) ในช่วง **08:00–20:00** | ระบบเลือกรอบให้เอง · **ยืนยันพิกัดบนแผนที่** ผ่าน → สั่งได้ · จ่าย → ติดตาม | จดข้อความ error + เวลา |
| R67-7 | สั่ง **นอกเวลาเปิดร้าน** (หลัง 20:00) | **ส่งวันนี้ถูกปฏิเสธ** พร้อมเหตุผล · **รับที่ร้าน** ผ่านได้เมื่อติ๊กยืนยัน "รับนอกเวลาเปิดร้าน" | จดข้อความที่ระบบแจ้ง |

> **บันทึกผล:** แต่ละข้อ = PASS/FAIL + หลักฐาน (ภาพจอ) ลงในไฟล์นี้ แล้วส่งกลับ — แถวไหน FAIL → ทีมแก้ (two-try) ก่อนขั้นถัดไป
> ### ✅ ผลทดสอบจริงของ Owner รอบ 2026-11-05 ~07:30 ICT (Owner ยืนยัน: **"R67 = อนุมัติปิด ไม่ต้องส่งภาพหลักฐาน"**)
>
> | ข้อ | ผล | รายละเอียดจาก Owner |
> |---|---|---|
> | R67-1 | **PASS ฟังก์ชัน / FAIL copy** | คุยได้ **ไม่ค้าง** ✓ — แต่ยังขึ้นคำว่า **"ไบ๊"** อยู่ · Owner ระบุ: "ไบ๊" เป็นแค่การอ่านออกเสียง ถูกทับศัพท์ด้วย **Bite** แล้ว → **งานแก้ = ล้าง copy "ไบ๊" ที่เหลือ** (คิว R69) |
> | R67-2 | **PASS** | "ใช้ได้ทุกลิ้ง" |
> | R67-3 | — | Owner ไม่ได้รายงานผล (ไม่ขึ้นสถานะ) |
> | R67-4 | — | Owner ไม่ได้รายงานผล |
> | R67-5 | **PASS** | "ถูก" |
> | R67-6 | **PARTIAL → งานใหม่** | สั่งได้ แต่ **เส้นทางยังสับสนกับ "รับที่ร้าน"** — ทั้ง Pre-Order และ Same-Day สั่งรับที่ร้านได้ → **ต้องแยกการแสดงผล + การติดตามสถานะ ระหว่าง "จัดส่ง" กับ "รับที่ร้าน"** ตามรูปแบบการสั่งซื้อ (รับเป็นงานหลักใน R69) |
> | R67-7 | — | ยังไม่ถึงขั้นทดสอบ (ต้องหลัง 20:00) |
>
> **สรุป R67 = ปิดตามมติ Owner** · ตกค้าง 2 หัวข้อที่แยกไปเป็นงาน R69 (copy "ไบ๊" + เส้นทางรับที่ร้าน) — **ผลรอบนี้มาจากเส้นช่วง ~07:30 ICT**






---

## R68. รอบปิดงาน 2026-11-05 ตี 1 — ปิดงานค้าง §5.2 ทั้ง 4 ข้อ + ขั้นตรวจของ Owner `[O]`

> **งานที่ทีมรันให้แล้ว (มีหลักฐาน — ห้ามจดซ้ำเป็นงานค้าง):**
> ① **R66-D = ทำแล้วทั้งสองแบบ** (Owner ยืนยัน "ทั้งสองแบบ"): ปิดกะตามเวลาเปิดปิดร้านจริง (นาฬิกากะ 1 วิ · ความยาวกะ · ยอดเงินสดระหว่างกะสด · ป้ายเตือนเลยเวลา + ถามยืนยันก่อนขาย · ปุ่มปิดกะเด่นเมื่อเลยเวลา) + **dynamic links ทุกปุ่ม POS** (ทางลัด = nav ชุดเดิมกรองตามสิทธิ์ role · ปุ่มต่อออเดอร์ = `/admin/orders?status=<สถานะ>` ที่ preset จริงในหน้าออเดอร์) · evidence `git diff` + `e2e/r68_gates*.log`
> ② **test coverage `pos_closeout_order` / `handleHandover` = 22 test ใหม่** (`src/__tests__/r68PosCloseoutHandover.test.ts` — client wrapper · SQL contract 129 · handleHandover ตรวจรหัส · R66-D · console noise ทั้ง 3) · **เดิม = 0**
> ③ **deploy edge function `shopContext` แล้ว**: `social-ai-worker` v72 + `social-post-worker` v66 (อัปโหลด `_shared/shopContext.ts` = เบอร์ `082 6096995`) — evidence `e2e/r68_eflist.json`
> ④ **console noise 3 ตัว ปิดที่ต้นทาง**: `driver_login` ไม่ warn เมื่อได้ `ERR_NOT_A_DRIVER` (error อื่นยัง warn) · `cart_sessions` = session id ต่อผู้ใช้ (ไม่ upsert ทับแถวอีกบัญชี) · query `date ""` = guard ก่อนยิง server (`getPublishedScheduleForDate`/`getActiveRoundsForDate`/`ensureRoundsForDate`)
> ⑤ ซ่อม **time bomb ใน fixture 2 ตัว** (`menuSchedule`/`menuScheduleGate` — `dayAfter` คำนวณแยกจาก `TOMORROW` แล้วชนกันช่วง 17:00–24:00 UTC) — **assertion คงเดิมทุกตัว** ให้ day+1 สืบจาก `TOMORROW`
>
> **สถานะ = โค้ด/EF พร้อมให้ Owner ทดสอบ · ยังไม่ประกาศ PRODUCTION READY** (เกณฑ์ปิดจริง = §RG·§16)

### R68.1 ขั้นตรวจของ Owner — **Web POS (`/admin/pos`) เริ่มก่อน** `[O]`

| # | ขั้น | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R68-1 | เปิด `/admin/pos` (login `pos` หรือ owner) → ดูกล่อง **💵 กะเงินสด** แล้วทิ้งไว้ ~30 วินาที | ป้าย **🕐 เวลาจริง** เดินทุกวินาที · **⏱️ เปิดกะมา** นับเพิ่มเอง · **💵 เงินสดระหว่างกะ** ขึ้นยอด (หรือบอกตรง ๆ ว่า "ดึงยอดไม่ได้" — ห้ามโชว์ 0 ปลอม) | จดภาพ + เวลา |
| R68-2 | ระหว่างที่ร้าน **ยังเปิด** (08:00–20:00) → กดขาย 1 ออเดอร์เงินสด | ไม่มีป้ายเตือนสีแดง · ขายผ่าน · ยอดระหว่างกะ **เพิ่มเองภายใน ~20 วิ** | จดภาพก่อน/หลัง |
| R68-3 | **หลัง 20:00** เปิด `/admin/pos` ใหม่ (hard reload) | ขึ้น **ป้ายแดง `pos-after-hours-banner`**: "เลยเวลาเปิดร้าน 08:00–20:00 แล้ว — เวลาจริง HH:MM น." + บรรทัด "ยังเปิดกะอยู่ → กด ปิดกะ" (ถ้ายังเปิดกะ) · ปุ่ม **ปิดกะ + กระทบยอด** เปลี่ยนเป็นปุ่มแดง | จดข้อความบนป้าย |
| R68-4 | ตอนเลยเวลาเปิดร้าน กดปุ่ม **✅ ขาย** | ขึ้น **กล่องยืนยัน** บอกเวลาเปิดร้านที่ผ่านไป + เวลาจริง + "จะขายกรณีพิเศษต่อไหม" · กด "ยกเลิก" = ไม่ขาย · กด "ตกลง" = ขายได้ (server ยังตัดสินเอง) | จดข้อความกล่อง |
| R68-5 | กรอกเงินนับได้ → กด **ปิดกะ + กระทบยอด** | ยอดคาดหวัง = เงินต้น + เงินสดระหว่างกะ · toast ปิดกะ + ผลต่าง · หน้ากลับเป็น "เปิดกะ" | จดยอด 2 ฝั่งเทียบ |

### R68.2 ขั้นตรวจ — **dynamic links ทุกปุ่ม POS** `[O]`

| # | ขั้น | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R68-6 | บน `/admin/pos` ดูแถว **ทางลัด** ใต้หัวข้อ | มีปุ่มไปหน้าจริง (ภาพรวม · ออเดอร์ · ลูกค้า · รายงาน — **เฉพาะที่ role นี้มีสิทธิ์**) · กดแล้ว **ไปถึงหน้านั้นจริง** ไม่ใช่ลิงก์ตาย | จดปุ่มที่กด + หน้าที่ถึง |
| R68-7 | ใน **คิวรับที่ร้าน** กดปุ่ม **ดูในหน้าออเดอร์** ท้ายแถว | เปิด `/admin/orders?status=<สถานะของออเดอร์นั้น>` แล้ว **แท็บสถานะถูก preset ทันที** (เช่น ready_for_dispatch) | จด URL + สถานะที่ไฮไลต์ |
| R68-8 | หลังขายเสร็จ ในกล่อง **งานพิมพ์ของออเดอร์ล่าสุด** กด **📦 เปิดหน้าออเดอร์** | พาไปหน้า Manage Orders จริง | จดหน้าที่ถึง |

### R68.3 ขั้นตรวจ — **console noise 3 ตัว (F12)** `[O]`

| # | ขั้น | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
## R69. งานถัดไป — ชุด 07:30 ICT 2026-11-05: เส้นทาง "รับที่ร้าน" ออกแบบใหม่จากของเดิม + บั๊กที่ Owner รายงานรอบ strip `[O]`

> **ขอบเขตตามคำสั่ง Owner: "รวบรวมคำสั่งที่เกี่ยวกับรับที่ร้าน ออกแบบเส้นทางใหม่โดยปรับปรุงจากของเดิม — ห้ามสร้างใหม่ — ปรับ UX/UI และการแจ้งเตือนให้ถูกต้อง"**
> · **รอบทดสอบ 07:30 = strip หน้าแรก · R67-1/2/5/6 · ปริ้นเตอร์ · PWA/Notice · รับที่ร้าน** · Owner อนุมัติปิด R67 แล้ว

| # | รายงานจาก Owner (คำจริง) | ต้องเป็นอะไร (เกณฑ์ PASS) |
|---|---|---|
| N-1 | strip บรรทัดแรก: `🔴 เปิดรับออเดอร์ ส่งวันนี้/⚡Same-Day ปิดรับแล้ว` — **บอกเปิดแต่ไฟแดง** ขัดกัน (บรรทัด 3 บอกปิด) | ข้อความ ↔ สถานะ ↔ สี ไฟ ตรงกันทุกบรรทัด (เปิด=เขียวมีคำว่าเปิด · ปิด=แดงมีคำว่าปิด) |
| N-2 | บรรทัด 3 `🛵 ส่งวันนี้/⚡Same-Day : ปิดรับแล้ว` → เปลี่ยนเป็น | **`เริ่มส่ง (HH:MM–HH:MM)`** โดยเวลาในวงเล็บ = **เวลาเปิด-ปิดร้านที่แอดมินตั้งในระบบ** (ไม่ hardcode) |
| N-3 | R67-1: ยังขึ้น **"ไบ๊"** | ใช้ **Bite** (ทับศัพท์แล้ว · "ไบ๊" เป็นแค่การอ่านออกเสียง → ล้าง copy ที่เหลือ) |
| N-4 | R67-6: เส้นทาง **สับสนกับ "รับที่ร้าน"** ทั้ง Pre-Order/Same-Day | **แยกการแสดงผล + ติดตามสถานะ** ตามรูปแบบสั่งซื้อ: `จัดส่ง` vs `รับที่ร้าน` (คนละคำ/คนละสถานะ/คนละหน้าติดตาม) |
| N-5 | ออเดอร์ **รับที่ร้าน** จากแจ้งเตือนหรือแอดมิน → ไป **ศูนย์ขนส่ง/มอบงานไรเดอร์** | ต้องไป **POS รับหน้าร้าน เท่านั้น** ทุกทางเข้า (notification · admin orders) |
| N-6 | ปริ้น **ใบสั่งงานครัว** จากหน้าออเดอร์ไม่ได้ (เข้าคิวแต่ไม่ออก) · ทดสอบบลูทูธ **พิมพ์ได้** (ตรง ไม่ผ่านบราวเซอร์) · ปริ้น **ทับซ้อนกัน** ตรง `PAID / QR CODE SCAN FOR MORE` | สั่งจากหน้าออเดอร์ → ออกจริง · ทั้งสองทางไม่ทับกัน · layout ไม่ซ้อน |
| N-7 | **PWA + แจ้งเตือน Notice ไม่ขึ้น** | push/Notice ขึ้นตาม event ออเดอร์จริง |
| N-8 | รับที่ร้าน: แสดง "ที่อยู่จัดส่ง" → ต้องเป็น **ตำแหน่งร้าน** (โลเคชันที่แอดมินตั้ง = สถานที่ร้านจริงอัตโนมัติ) · รูป **หน้าร้าน + รายละเอียดร้าน** (แอดมินเพิ่มรูปเอง = **แท็บใหม่ข้าง mascot ในตั้งค่าร้าน**) + ปุ่ม **แผนที่นำทางมาร้าน** · **ซ่อน** เซกชั่นที่ไม่เกี่ยวกับรับหน้าร้าน (เช่น "ตรวจสอบจุดจัดส่ง") · ช่องทางจัดส่งที่ระบบเลือก → แสดง **"รับที่ร้าน"** · **โค้ดคูปองที่ตั้งใหม่ไม่ถูกเลือกอัตโนมัติ** ใน dropdown | ครบทุกข้อย่อย · ไม่เห็นศัพท์/รูปของ "จัดส่ง" ตอนสั่งรับที่ร้าน |
| N-9 | **สติกเกอร์ไม่ปริ้นออโต้** (เคยได้) | กลับมาปริ้นออโต้ตามเดิม |
| N-10 | ออเดอร์ทดสอบที่ทีมสร้าง → **วิธีปิด/รับรหัส** | ตอบใน AI_WORK_STATE บล็อก R69 (แอดมินเลื่อนสถานะถึง delivered · รหัสรับ 6 หลักดูจากหน้า track/ใบเสร็จ) |

|---|---|---|---|
| R68-9 | F12 → Console → login ด้วยบัญชี **ลูกค้าทั่วไป** (ไม่ใช่ไรเดอร์) แล้วเปิดหน้าแรก + `/profile` | **ไม่มี** `[Driver] driver_login failed: ERR_NOT_A_DRIVER` สีเหลือง (network ที่เป็น 400 ของ RPC = โดย design server-verified ยังมีได้) | copy ข้อความที่เห็น |
| R68-10 | F12 → Console/Network ที่ `/shop` — เพิ่มของเข้าตะกร้าด้วยบัญชีที่ล็อกอิน | **ไม่มี** `403 cart_sessions … row-level security` | copy ข้อความ |
| R68-11 | เปิดหน้าแรก/checkout ก่อนเลือกวัน (หรือกดไปมาเร็ว ๆ) | **ไม่มี** `400 … invalid input syntax for type date: ""` (menu_schedule / delivery_rounds / ensure_rounds_for_date) | copy ข้อความ |

### R68.4 ขั้นตรวจ — **เบอร์ร้านใน edge function ใหม่** `[O]`

| # | ขั้น | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R68-12 | ถาม AI ช่องทางโซเชียล (คอมเมนต์/Messenger) ว่า "ติดต่อร้านเบอร์อะไร" | ตอบ **082 6096995** (ไม่ใช่ `094 2649269`) | copy คำตอบ |

> **บันทึกผล:** `ข้อ ID · เวลา · อุปกรณ์ · PASS/FAIL · Evidence (ภาพ/console copy)` ลงในไฟล์นี้แล้วส่งกลับ — FAIL = จดเป็น defect ใหม่ใน `AI_WORK_STATE.md` (ทีมแก้แบบ two-try)
> **ยังคงเดิม:** R67-1..R67-7 (หน้าแชท → FAQ → ฟุตเตอร์ → SEO → สั่ง 2 โหมด → นอกเวลา) ยังต้องรันตาม §R67 · เกณฑ์ปิดจริง = §RG·§16

## R70. ชุดทดสอบ live — แชตสมบูรณ์ (ลูกค้า/ไรเดอร์/แอดมิน) + PWA/Push (2026-11-05 ค่ำ)

> **ขอบเขตตามคำสั่ง Owner: "ระบบแชทระหว่าง แอดมิน ลูกค้า ไรเด้อร์ ไม่สมบูรณ์ ลูกค้าและไรเดอร์ไม่มีกล่องข้อความโต้ตอบ
> ไม่มีแจ้งเตือนข้อความ ทำให้สมบูรณ์ตามเหมาะสม · ระบบ pwa และแจ้งเตือนให้เปิดแจ้งเตือนไม่เห็นมาเคยมีใช้งานได้"**
> สิ่งที่แก้: ① กล่องข้อความโต้ตอบครบทุกฝั่ง/ทุกหน้า ② แจ้งเตือนข้อความเข้ากระดิ่ง+push ทุกฝั่ง (migration 183) ③ ป๊อปอัป "เปิดการแจ้งเตือน" ทำงานได้จริง (root cause: bell แย่ง native permission prompt + granted โดยไม่ subscribe)

| # | ขั้นทดสอบ (บน live = biteme-baby.com) | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R70-1 | ล็อกอิน**บัญชีลูกค้า** → `/orders` (ออเดอร์ของฉัน) | ทุกการ์ดออเดอร์เห็น **💬 แชตร้าน** แบบกางอยู่ (ไม่ต้องกดเปิด) พิมพ์-ส่งได้ | copy หน้าจอ |
| R70-2 | ลูกค้าเปิด `/track/<เลขออเดอร์>` (หรือกดจากแจ้งเตือน) | มีการ์ด **💬 แชตกับร้าน/ไรเดอร์** ด้านล่าง — พิมพ์ "ทดสอบแชต R70" ส่งได้ | copy หน้าจอ |
| R70-3 | แอดมินที่ `/admin/orders` ออเดอร์เดียวกัน (แผง แมตย์ออเดอร์) | เห็นข้อความลูกค้าเข้ามา **ภายใน ~10 วิ** (poll) · **กระดิ่งเด้ง + เสียง** "💬 ข้อความใหม่จากลูกค้า" · ตอบกลับได้ | copy หน้าจอ |
| R70-4 | ไรเดอร์ที่ `/rider` (งานที่ผูกออเดอร์นั้น) | แต่ละงานมี **💬 แชตงานนี้ (ลูกค้า/ร้าน)** — เปิดแล้วตอบได้โดยไม่ต้องเปิดงานก่อน · มีเสียง+ป้าย "มีข้อความใหม่" เมื่ออีกฝั่งส่งมา | copy หน้าจอ |
| R70-5 | ลูกค้า (หรือไรเดอร์) ส่งข้อความ → แอดมิน | กระดิ่งแอดมินมีรายการใหม่ "💬 ข้อความใหม่จากลูกค้า/ไรเดอร์" กดแล้วเด้งไป `/admin/orders` | copy หน้าจอ |
| R70-6 | แอดมิน/ไรเดอร์ ส่งข้อความ → ลูกค้า | ① กระดิ่งลูกค้ามี "💬 ข้อความใหม่จากร้าน" (กด → ไป `/track/<order>`) ② **push เด้งบนมือถือ** (ถ้าเปิดการแจ้งเตือนไว้ · dispatcher รอบ ≤5 นาที) | copy หน้าจอ/แจ้งเตือน |
| R70-7 | **ป๊อปอัป "เปิดการแจ้งเตือน"**: ล็อกอินบัญชีลูกค้าบนมือถือ/เบราว์เซอร์ที่**ยังไม่เคย**ให้สิทธิ์ | ~6 วินาทีหลังโหลดหน้า = การ์ดดินน้ำมัน "🔔 รับการแจ้งเตือนสถานะอาหาร" เด้ง (ครั้งเดียว/7 วัน) · กด "เปิดการแจ้งเตือน" → toast สำเร็จ | copy หน้าจอ |
| R70-8 | กรณีเคยกด "อนุญาต" ไปแล้วแต่ไม่เคยได้ push (บั๊กเดิม) | เข้าสู่ระบบแล้วระบบ **สมัคร push ให้อัตโนมัติ** เงียบ ๆ + toast "เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว" | copy toast |
| R70-9 | กด "ไว้ทีหลัง" แล้วกลับมาใหม่ | ป๊อปอัปไม่เด้งซ้ำใน 7 วัน · เปิดได้เองจาก `/notifications` (ปุ่ม อนุญาตการแจ้งเตือน/สวิตช์ Web Push) | copy หน้าจอ |
| R70-10 | สั่งออเดอร์จริง 1 ใบ (ต่อจาก N-7 เดิม) | Notice ที่ `/notifications` + push ขึ้นตาม event ออเดอร์ — ยืนยัน pipeline แจ้งเตือนทั้งสาย | copy หน้าจอ |

> **หมายเหตุฝั่งเทคนิค (ทีม):** push ของข้อความแชตถึงลูกค้าเดินทางผ่าน `notifications → notification-dispatcher (ntf-) → push-send`
> รอบ cron ≤5 นาที — ถ้า R70-6(2) ไม่เด้งภายใน 5-10 นาที ให้เก็บเวลาส่งไว้แล้วแจ้งทีมตรวจ outbox · แอดมิน/ไรเดอร์รับแจ้งแบบ in-app
> (กระดิ่ง/เสียง/ป้ายในแชต) ตามดีไซน์ (แอดมินไม่มี audience push · ไรเดอร์มีสวิตช์ของตัวเองที่ `/rider` สำหรับงานใหม่)
> · ผู้เยี่ยมชมที่ยืนยันด้วยเบอร์ (ไม่ล็อกอิน) ยังไม่เห็นช่องแชต (RLS ต้องมีตัวตน) — แจ้งทีมถ้าต้องการเปิดเพิ่ม

## R71. ชุดทดสอบ live — ฝั่งไดร์เวอร์ (แชตโต้ตอบได้จริง + กระดิ่งเตือนจริง) (2026-11-05 ค่ำ · ต่อจาก §R70)

> **ขอบเขตตามคำสั่ง Owner หลังทดสอบรอบแรก: "ฝั่งไดร์เวอร์ไม่มีแจ้งเตือน ไม่มีหน้าต่างแชทโต้ตอบไม่ได้ ทำให้ถูกต้อง
> (ถ้ามีแล้วไม่ต้องทำ บอกตำแหน่ง) · กระดิ่งเตือนจริง"**
> ต้นเหตุที่แก้: ① m183 ใช้ id แจ้งเตือนซ้ำกันสองแถว → **การส่งของไรเดอร์พังทั้งก้อน (unique violation → rollback)**
> = "โต้ตอบไม่ได้" จริง (m187 แยก id ต่อผู้รับ + พิสูจน์บน production แล้วว่าไรเดอร์ส่งได้) ② ไม่มีแถวรอรับของไรเดอร์เลย
> → ไรเดอร์ไม่รู้ว่ามีข้อความ (m187 แจ้งไรเดอร์ทุกครั้งที่แอดมิน/ลูกค้าส่ง) ③ ไม่มีกระดิ่งฝั่ง /rider (ไม่มี Header)
> → สร้าง **RiderBell** ④ แชตรายงานในรายการงานพับอยู่ → เปิดกางค้าง (`details open`) ⑤ กระดิ่งเดิมมาร์กอ่านไม่ลง
> server บางแถว (ป้ายแดงกลับมาทุก reload) → มาร์กอ่านฝั่ง server ทุกแถว + เด้งเดสก์ท็อปเมื่อหน้าไม่โฟกัส

| # | ขั้นทดสอบ (บน live = biteme-baby.com · บัญชีไรเดอร์ที่แอดมินผูกแล้ว) | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R71-1 | ไรเดอร์ล็อกอิน `/rider` → ดูการ์ดงานแต่ละใบ | ทุกการ์ดมี **💬 แชตงานนี้ (ลูกค้า/ร้าน)** แบบ**กางอยู่** เห็นช่องพิมพ์ทันที (ไม่ต้องกดเปิด) | copy หน้าจอ |
| R71-2 | ไรเดอร์พิมพ์ข้อความในแชตงาน → กดส่ง | ส่ง**สำเร็จ** (ก่อนแก้ = เด้ง error เงียบ ๆ ส่งไม่เข้าจริง) · ลูกค้าที่ `/track` และแอดมินที่ `/admin/orders` เห็นข้อความนั้น | copy หน้าจอ |
| R71-3 | แอดมิน (หรือลูกค้า) ตอบในแชตงานเดียวกัน | ① แชตฝั่งไรเดอร์ขึ้นข้อความภายใน ~10 วิ + เสียง + ป้าย "มีข้อความใหม่" ② **กระดิ่ง "🔔 แจ้งเตือน" บน /rider ขึ้นป้ายแดง + เสียง** (รายการ "💬 ข้อความใหม่จาก…") | copy หน้าจอ |
| R71-4 | ปิดหน้าจอไว้ (สลับแอป) แล้วให้อีกฝั่งส่งข้อความ | เด้ง **browser notification** บนเครื่องไรเดอร์ (ต้องเคยกด "เปิดการแจ้งเตือน" ที่สวิตช์บน /rider ก่อน) | copy หน้าจอ |
| R71-5 | ในกระดิ่ง /rider กด "อ่านทั้งหมดแล้ว ✓" | ป้ายแดงหายและ**ไม่กลับมา**แม้ reload หน้า (มาร์กอ่านฝั่ง server จริงแล้ว — ของเดิมป้ายกลับมาทุกครั้ง) | copy หน้าจอ |
| R71-6 | กระดิ่งแอดมิน/ลูกค้า (Header เดิม): มีข้อความเข้าตอนหน้าไม่โฟกัส | เสียง + ป้ายแดง + **เด้งเดสก์ท็อป** · กดรายการ = ไปหน้าแชต/งานที่เกี่ยวข้อง + ป้ายไม่กลับมาหลัง reload | copy หน้าจอ |
| R71-7 | ปุ่ม 🔔 เปิดการแจ้งเตือน (push) บน /rider (สวิตช์เดิม) | เปิด/ปิดได้ + แจ้งสถานะ permission ตรงจริง (งานใหม่ = push ตามเดิม · ข้อความแชต = แจ้งในแอป/เบราว์เซอร์) | copy หน้าจอ |

> **ตำแหน่งของที่มีอยู่แล้ว (ตามคำสั่ง "ถ้ามีแล้วไม่ต้องทำ บอกตำแหน่ง"):**
> - แชตฝั่งไรเดอร์: `/rider` → การ์ด "📦 ออเดอร์" แต่ละใบ → **💬 แชตงานนี้ (ลูกค้า/ร้าน)** + การ์ด "💬 แชตงาน BMB-…" ของงานที่กำลังส่ง
> - แชตฝั่งลูกค้า: `/orders` (💬 แชตร้าน ทุกการ์ด) และ `/track/<เลขออเดอร์>` (💬 แชตกับร้าน/ไรเดอร์)
> - แชตฝั่งแอดมิน: `/admin/orders` → แผง แมตย์ออเดอร์ → 💬 แชตท้ายแผง
> - กระดิ่งแอดมิน/ลูกค้า: มุมขวาบนของ Header ทุกหน้า (รวม /admin/*) · กระดิ่งไรเดอร์: แถบปุ่มบนสุดของ `/rider`
> - push ฝั่งไรเดอร์ (งานใหม่): สวิตช์ "🔔 เปิดการแจ้งเตือน" ในการ์ดโปรไฟล์บน `/rider` (ของเดิม R66-A2)

## R72. ชุดทดสอบ live — แจ้งเตือนไม่ซ้ำ + เด้งตอนเปิดแอพ + คูปอง + เส้นทางจัดส่ง + รับงาน (2026-11-05 ดึก · ต่อจาก §R71)

> **ขอบเขตตามคำสั่ง Owner หลังทดสอบ §R71 (7 ข้อ):** "เด้งตอนเปิดแอพด้วย · แจ้งเตือนไรเดอร์มีซ้ำ ·
> มุมจอต้องบอกเรื่องข้อความทุกฝั่ง · คูปองแอดมิน (HALLOWEEN10) ใช้ที่เช็คเอาท์ได้ + เพิ่มทีหลังอัตโนมัติ ·
> เซมเดย์นอกเวลา error ถูกต้อง · เส้นทางแจ้งเตือนจัดส่งหายไปอีก + สถานะหลังยืนยันรอบไม่เดินต่อ · ไรเดอร์รับงานไม่ได้"
> **ต้นเหตุที่แก้ (พิสูจน์บน production ทั้งหมด):**
> ① แจ้งเตือนออเดอร์ซ้ำ 2 เท่า = trigger m161 (id `notif-<ts>-<rand>`) กับ automation-worker
> (id `evt-ord-<order>-<status>`) เขียนคนละ id → **m188 ให้ trigger ใช้ id เดียวกับ worker + ON CONFLICT** = เหลือแถวเดียว
> ② กระดิ่งไรเดอร์ซ้ำ = /rider มีกระดิ่งมุมจอ (Header) อยู่แล้ว + RiderBell ของ R71 = ซ้อนกัน 2 ตัว → **ถอด RiderBell** (เหลือกระดิ่งมุมจอเดียวทุก role)
> ③ เด้งเฉพาะตอนหน้าไม่โฟกัส = ตอนนั่งทดสอบอยู่ไม่เห็นอะไรเด้ง → **เด้งเดสก์ท็อปทุกครั้งทั้งตอนเปิดแอป/สลับแอป**
> ④ คูปอง HALLOW10 ไม่ขึ้น dropdown = **end_date 2026-11-04 (หมดอายุเมื่อวาน)** + การ์ดโปรหน้าร้านไม่เช็กวันที่ = โฆษณาคูปองหมดอายุ
> → ต่ออายุเป็น 2026-11-30 แล้ว + การ์ดโปรเช็กช่วงวันที่เดียวกับ dropdown (โปรใหม่เพิ่มทีหลัง = ขึ้นอัตโนมัติทั้งคู่)
> ⑤ สถานะหลัง "ยืนยันรอบจัดส่ง" ไม่เดินต่อ = ขั้นถัดไปอยู่ที่คิวครัว แต่ **พรีออเดอร์ของวันถัดไปไม่ขึ้นในคิวครัว** (กรอบวันที่) = หาปุ่ม "เริ่มทำ" ไม่เจอ
> → คิวครัวโชว์พรีออเดอร์ที่รอเข้าครัวทุกวันที่ · ⑥ แจ้งเตือนสายจัดส่ง (DRIVER_*) กดแล้วไม่ไปหน้าจัดส่ง = ตกจาก map → เพิ่มเข้าเส้นทาง `/admin/delivery`
> ⑦ ไรเดอร์รับงานไม่ได้ = แอดมินกด "มอบหมาย" ไว้ก่อน แล้วไรเดอร์กด "รับงานประกาศ" = `ERR_OFFER_NOT_AVAILABLE` (m163 guard กันทุกกรณี)
> → **m189 fallback: assignment ของตัวเอง = ทำงานเท่า "รับงาน" ทันที** (พิสูจน์บน production แล้ว)

| # | ขั้นทดสอบ (บน live = biteme-baby.com) | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R72-1 | สั่งออเดอร์จริง 1 ใบ (หรือเปลี่ยนสถานะออเดอร์) → ดูกระดิ่งลูกค้า/แอดมิน | ทุกเหตุการณ์ = **1 รายการต่อเหตุการณ์** (เดิมขึ้นซ้ำ 2 — "รับสินค้าแล้ว" ×2) | copy หน้าจอ |
| R72-2 | นั่งหน้าจอค้างไว้ (แอปเปิดอยู่) แล้วให้อีกฝั่งส่งข้อความ/ออเดอร์เปลี่ยนสถานะ | **เด้ง notification บนเดสก์ท็อปทันที** + เสียง + ป้ายแดง (เดิมเด้งเฉพาะตอนสลับแอป) | copy หน้าจอ |
| R72-3 | ฝั่งไรเดอร์ (`/rider`) มีข้อความเข้า | เตือน**ครั้งเดียว** (เดิมซ้ำ 2 ทางจากกระดิ่งคู่) · กระดิ่งมุมจอบนบอก "💬 ข้อความใหม่จาก…" กดแล้วไปหน้าแชต/งาน | copy หน้าจอ |
| R72-4 | แอดมินกับลูกค้า: กดรายการแจ้งเตือน "จัดส่ง:" (ได้รับไรเดอร์/รับงาน/รับของ) | เด้งไป **หน้าจัดส่ง `/admin/delivery`** (ไฮไลต์แถวออเดอร์) — เดิมตกไปหน้าออเดอร์ | copy หน้าจอ |
| R72-5 | หน้าเช็คเอาท์ → เลือกคูปอง | **HALLOW10 ขึ้นในรายการ** (ต่ออายุถึง 30 พ.ย. 69 · โค้ดจริงคือ `HALLOW10` ไม่ใช่ HALLOWEEN10) + โปรใหม่ที่แอดมินเพิ่มภายหลังขึ้นอัตโนมัติ · การ์ดโปรหน้าร้านไม่โชว์คูปองหมดอายุ | copy หน้าจอ |
| R72-6 | พรีออเดอร์ยืนยันรอบแล้ว (วันถัดไป) → เปิด **คิวครัว** `/admin/kitchen` | ออเดอร์**ขึ้นในคิวทันทีพร้อมป้ายวันส่ง** → กด "เริ่มทำ" → "พร้อมแล้ว" → สถานะเดินต่อถึงจัดส่ง + แจ้งเตือนเดินตามทุกขั้น | copy หน้าจอ |
| R72-7 | แอดมินกด "มอบหมาย" ให้ไรเดอร์ → ไรเดอร์กด "รับงานประกาศ" (หรือ "รับงาน") | รับได้**ทุกปุ่ม** (fallback = accept อัตโนมัติ) · งานขึ้น "รับงานแล้ว" ไม่มี error | copy หน้าจอ |
| R72-8 | สั่งเซมเดย์นอกเวลาเปิดร้าน | error ถูกต้องตามเดิม (ยืนยันว่า **ผ่านแล้ว** — ไม่ต้องแก้) | — |

> **หมายเหตุ:** โค้ดคูปองในระบบคือ `HALLOW10` (ชื่อโปรโมชั่น "HALLOWEEN…" อาจทำให้สับสน) — ถ้าต้องการโค้ด
> `HALLOWEEN10` ให้แก้โค้ดใน `/admin/promotions` ได้เลย (ระบบใช้ค่าจาก DB ทั้งหมด = แก้แล้วใช้ได้ทันที)

## R73. ชุดทดสอบ live — สติกเกอร์: ช่องไฟเท่ากัน + เส้นไม่ทับอักษร + NOTICE จากลิงก์จริงของลูกค้า (2026-11-05 ดึก 2 · ต่อจาก §R72)

> **ขอบเขตตามคำสั่ง Owner:** "จัดระเบียบช่องไฟระหว่างบรรทัดของดวงสติ้กเกอร์ใหม่ 15 บรรทัดก่อน qr code ให้เท่ากัน ·
> เส้นแบ่งอย่าทับอักษร ตอนนี้เส้นที่ 2 ทับ delivery เส้นที่ 3 ทับ total ·
> Notice ต้องพิมพ์จากลิงก์จริงของลูกค้ามาปริ้นด้วย ตอนนี้ไม่ปริ้น notice"
> **ต้นเหตุที่แก้ (layout วาดด้วยพิกัดคงที่ใน `stickerPng.ts` / `stickerForm.ts`):**
> ① ช่องไฟ = แถวหัว (brand→tag→Date) เริ่มนอกจังหวะ Δ28/Δ44 แล้วค่อย Δ30 → grid ใหม่ **Δ30 ทุกบรรทัด**
> (ใต้ brand = 15 บรรทัดก่อน QR · เท่ากันทุกบรรทัดรวมแถวว่าง ORDER LIST)
> ② เส้นทับ = เส้นคั่น 2/3 วาดที่ `y−15` = กลางตัวอักษรแถวถัดไป (สูง 20–21px) → ย้ายเป็น **กลางช่องว่าง**
> (`nextY − nextSize − 2`) = ไม่แตะตัวอักษรใดเลย (มีเทสต์บังคับ)
> ③ NOTICE = เดิมรับเฉพาะ `orders.special_instructions` = ใบจริงพิมพ์ `NOTICE : -` เสมอ →
> **`collectOrderNotices`** รวม ① special_instructions ② ข้อความแชตที่ลูกค้าพิมพ์จากลิงก์จริง
> (`order_messages` · เติมตอนพิมพ์ทุกเส้นทาง) ③ หมายเหตุรายเมนูจากกล่องโต้ตอบใส่ตะกร้า
> (`special_request` / `customizations.notice`) — ซ้ำ = ครั้งเดียว · ว่างทุกแหล่ง = "-"

| # | ขั้นทดสอบ (บน live = biteme-baby.com) | ต้องเห็นอะไร (PASS) | ถ้าพลาด = จด |
|---|---|---|---|
| R73-1 | สั่งออเดอร์มีหลายรายการ (≥4 บรรทัดรายการ) → แอดมิน "รับออเดอร์" → ดูดวงสติกเกอร์ที่พิมพ์ออก | **ช่องไฟทุกบรรทัดเท่ากัน** ตั้งแต่ "BITE ME BABY" ถึงแถว [PAID] (รวมแถวว่างของ ORDER LIST) — จังหวะเดียวกันทั้งใบ | ถ่ายรูปดวงสติกเกอร์ |
| R73-2 | ดูเส้นคั่น 3 เส้นบนดวงเดียวกัน | เส้นที่ 2 อยู่**ระหว่าง** NOTICE กับ `[ DELIVERY / CUSTOMER ]` (ไม่ทับคำว่า delivery) · เส้นที่ 3 อยู่ระหว่าง Add กับ `[ TOTAL NET ]` (ไม่ทับ total) · เส้นที่ 1 ใต้ tag ไม่ทับบรรทัด Date | ถ่ายรูปดวงสติกเกอร์ |
| R73-3 | ลูกค้าสั่งจากเว็บจริงพร้อม **หมายเหตุรายเมนู** (ช่องในกล่องโต้ตอบใส่ตะกร้า เช่น "ไม่เผ็ด") | ช่อง **NOTICE :** โชว์หมายเหตุนั้น (เดิมขึ้นเฉพาะในวงเล็บของ ORDER LIST — NOTICE ว่าง) | copy หน้าจอ/ถ่ายรูป |
| R73-4 | ลูกค้าพิมพ์**ข้อความในแชต**จากลิงก์จริงของตน (`/track/...`) เช่น "ขอช้อนส้อม" แล้วแอดมินกดพิมพ์สติกเกอร์/ใบเสร็จ | ช่อง **NOTICE :** มีข้อความแชตของลูกค้ารวมอยู่ (กดพิมพ์ซ้ำหลังแชตใหม่ = ได้ข้อความล่าสุด) | copy หน้าจอ/ถ่ายรูป |
| R73-5 | เทียบดวงจาก **Bluetooth (Niimbot)** กับใบจาก **ปุ่มพิมพ์ Windows/QZ** ออเดอร์เดียวกัน | NOTICE/ช่องข้อมูล**ตรงกันทุกใบ** (สองทางใช้ชุดค่าเดียวกัน) · ช่องไฟ/เส้นคั่นแบบเดียวกัน | ถ่ายรูปคู่กัน |
| R73-6 | ออเดอร์เดิมที่ไม่มีโน้ต/แชตอะไรเลย | NOTICE ขึ้น **"-"** เหมือนเดิม (ไม่พิมพ์ว่าง/ไม่มีขยะ) · ออเดอร์ POS ที่มีป้ายชนิด/ช้อนส้อม = NOTICE เดิมครบ | copy หน้าจอ |

> **หมายเหตุ:** NOTICE = บรรทัดเดียวตามแบบฟอร์ม (ข้อความรวมยาวมาก = ท้ายแถวถูกตัดตามดีไซน์เดิม) ·
> โน้ตแชต = ข้อความ ณ **ตอนพิมพ์** — ถ้าลูกค้าพิมพ์เพิ่มหลังพิมพ์ใบแล้ว กด "พิมพ์" ซ้ำเพื่อให้ได้ข้อความใหม่สุด


## R73h. ชุดทดสอบ live — วันเกิด & ความยินยอม CRM + Talk to Bite รอบ R73e–g (2026-11-06 · ต่อจาก §R73)

> ของใหม่ R73h: การ์ด "วันเกิด & ข้อความพิเศษ" ในหน้าบัญชี (`/profile`) + m193 `crm_consent` (default false = ระบบยังไม่ส่งข้อความใครจนกว่าจะยินยอม) · R73e–g: Talk to Bite gap fills + CRM automation (winback/birthday เฉพาะคนยินยอม · kill-switch `crm_automation`)

| # | ขั้น | PASS = | จด/ถ่าย |
|---|---|---|---|
| R73h-1 `[O]` | ล็อกอิน → `/profile` → หาการ์ด 🎂 "วันเกิด & ข้อความพิเศษ" | เห็นช่องวันเกิด + checkbox "ยินยอมรับข้อความอวยพร/สิทธิพิเศษในเดือนเกิด" + ปุ่มบันทึก | copy หน้าจอ |
| R73h-2 `[O]` | กรอกวันเกิด (วัน/เดือน/ปี ในอดีต) + ติ๊กยินยอม → บันทึก | toast "บันทึกวันเกิดและการตั้งค่าแล้ว 🎂" · โหลดหน้าใหม่แล้วค่าอยู่ครบ | copy หน้าจอ |
| R73h-3 `[O]` | ลองกรอกวันเกิดเป็น **วันอนาคต** → บันทึก | ถูกปฏิเสธพร้อมข้อความ "วันเกิดต้องไม่เป็นวันในอนาคต" (ไม่บันทึก) | copy หน้าจอ |
| R73h-4 `[O]` | เอาเครื่องหมายออกจาก checkbox → บันทึก (ถอนยินยอม) | toast สำเร็จ = ถอนแล้ว · scan รอบถัดไปจะข้ามบัญชีนี้ (ไม่รับข้อความ CRM) | copy หน้าจอ |
| R73h-5 `[R]` | Talk to Bite: "เอาข้าวผัด ไม่เผ็ด เพิ่มไข่ดาว" → ตรวจตะกร้า | ตะกร้ามีข้าวผัด + **customization ไม่เผ็ด/ไข่ดาว** ติดมาด้วย | copy หน้าจอ |
| R73h-6 `[R]` | แชท: "สั่งเหมือนเดิม" | ออเดอร์ก่อนหน้าถูกยกมาพร้อม customization/โน้ตเดิม | copy หน้าจอ |
| R73h-7 `[R]` | แชท: "ขายดีช่วงนี้" / "ทำยังไงถึงจะได้แต้ม" | ขายดี = อิงยอดขายจริง 30 วัน (ไม่มั่ว) · ช่วยเหลือตอบจาก 6 หัวข้อจริงของร้าน | copy หน้าจอ |

## R74-OMNI. แผนทดสอบ omnichannel (Meta/LINE) — **ยกไปแชทถัดไป (ขั้น 3–5)**

> **สถานะเตรียมพร้อม (Owner ยืนยัน 2026-11-06):** ① env/secret + Meta Test User = **มีใน local env แล้ว** ② ยิง webhook จริง → raw message เข้า `order_submissions` = **เคยทำผ่าน SMS สำเร็จแล้ว + มี token อยู่ใน evv local** — foundation (intake/idempotency/webhook dedupe: m043–048/124 · `socialOrderIntake` · `channel-webhook` EF) พร้อม
> **กติกา: ห้าม auto-order ทุกกรณี** — ได้ draft cart ต้องให้ลูกค้ายืนยันก่อนเสมอ

| # | ขั้น (ทำในแชทถัดไป) | PASS = | จด/ถ่าย |
|---|---|---|---|
| OMNI-1 | ตรวจ env local: credentials + Meta Test User ครบ (ตามที่ Owner แจ้ง) | เห็น key ครบ (ไม่ commit ค่าลับลง git) | จดชื่อ key (ไม่จดค่า) |
| OMNI-2 | ยิง webhook จริงซ้ำ (เส้น SMS เดิมที่เคยผ่าน) | raw message เข้า `order_submissions` แถวใหม่ · ยิงซ้ำข้อความเดิม = **ไม่**สร้างแถวซ้ำ (idempotent) | query/log |
| OMNI-3 | ทดสอบ NL parse → draft cart จากข้อความจริง → ลูกค้ายืนยัน | draft cart ถูกต้อง → ยืนยันแล้วได้ออเดอร์จริง (**ไม่มี auto-order**) | copy หน้าจอ |
| OMNI-4 | ปรับ parse dictionary จากข้อความจริงที่เจอ (สำเนียง/ศัพท์ร้าน) | parse ผ่านทุกตัวอย่างที่เจอ | จดตัวอย่างข้อความ + ผล |
| OMNI-5 | ทดสอบ+ปรับปรุงซ้ำจนครบ (Meta + LINE เมื่อได้ Test User) | ทุกช่องทางได้ draft → ยืนยัน ครบ | evidence รวม |


