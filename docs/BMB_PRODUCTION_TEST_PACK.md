# BMB — PRODUCTION TEST PACK (ชุดทดสอบรวมสำหรับรันบน production จริง)

> **สั่งโดย Owner 2026-10-26:** "รวบรวมเทสไว้ทดสอบจริงทั้งหมดบนโปรดักชั่นจริง"
> เอกสารนี้ = **รายการทดสอบเดียวที่ใช้ปิดงาน** รวมทุก checklist ที่เคยกระจายอยู่ใน
> `BMB_E2E_PRODUCTION_ACCEPTANCE_PLAN_2026-10-24.md` §4+§5 · `BMB_OWNER_STATUS_REPORT_2026-10-25.md` §D ·
> `BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` §1 (R-16) · Growth & Rewards acceptance ·
> และของใหม่รอบนี้ (CAP-01 เส้นทางสั่งซื้อเดียว · CAP-21 เจาะกลุ่มอัตโนมัติ · CAP-22 AI เลือกเวลา)
>
> **HEAD ล่าสุด = `5215cf4`** (รอบ defect SW+hours sync+160 · CI **#593** = success · Contract **#167** = success · Pages success แล้ว · ตรวจจริง = `git log --oneline -1`) · ก่อนหน้า `6d83cba` (#590/#164) · `67f10b8` = โค้ดปิด UI (#585/#159) ·
> **แก้ตาม D-1/2/3 (2026-10-26):** §0/UI/L-10/B2/C7C8 อัปเดตสถานะจริง · L-3/4/5/7/8 → **L-RT** · **159 = APPLIED+VERIFIED** (`e2e/w7Apply159-*.json`) ·
> **รอบ defect Owner 2026-10-26 (4+1):** **client hours+operating_hours sync = FIXED** (แถบสถานะ/เลือกกรอบ/กดสั่ง) · SW `skipWaiting`+`claim` (ค้าง build เก่า) · markup/coupon/label แก้ · **server 160 = APPLIED+VERIFIED** (Owner สั่ง `__apply 160__` · **w8Apply160 4 stage ALL_PASS** · behavior proof: SAMEDAY 23:3x → `ERR_STORE_CLOSED (8:00–20:00)` · PRE_ORDER ผ่าน) · **Owner retest หลัง deploy = hard reload 1 ครั้ง** · gates `e2e/gates_sync2026-10-26.log` ALL ZERO · **แผนทดสอบทั้งหมด = HANDOFF §2**

> **สถานะเอกสารนี้:** runbook สำหรับ **Owner/ผู้ได้รับมอบหมาย** รันเอง · AI ไม่รันแทน (เป็น production write)
> อ้างอิงสถานะปัจจุบัน = `docs/BMB_MASTER_STATUS.md` · **ผลรันทุกขั้นต้องมีหลักฐานจริง (ภาพ/log/query)**

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

## สรุปเกณฑ์ปิดงาน (ฉบับตรงความจริง)

- **รันได้เลย:** A1 · A2 · A3 (ผ่าน = verify) · B (รวม B2 เป็น verify · รอช่วง ~11:00) · **C7/C8 (ค่า = VERIFIED แล้ว · รันได้เลย)** · D · E · F · G · H · I · J · K · **L-RT**
- **สถานะพิเศษ (2026-10-26):** **B2 = UNVERIFIED** (เกณฑ์ ~11:00 — เช็ค 22:29 ไม่ตรงเวลา) · **C7/C8 = precondition VERIFIED (mrRead) · ขั้นรัน NOT RUN** · ~~L-10~~ = **APPLIED+VERIFIED** (w7Apply159 · ledger 159) · L-12 = ทางเลือก · **Pages serving = VERIFIED** (marker `btn-locked`) · **parity ย่อย = onlyProd 0** · **server 160 = APPLIED+VERIFIED** (w8Apply160 4 stage · rollback cmd ใน record JSON) · **client hours sync = FIXED (deploy แล้วมีผล · test 17 เคส + gates_sync ALL ZERO)** · **Owner retest 4+1 = hard reload 1 ครั้ง (SW เก่าค้างจริง — ไม่มี skipWaiting)**
- **ไม่ต้องรันซ้ำ (ปิดแล้วมี evidence):** L-1/L-2/L-6/L-9 · **L-3/L-4/L-5/L-7/L-8** (test+gates+CI `67f10b8`) · B-2 legacy contract (7/7) · schema parity (มีรายงาน) — อยากตรวจซ้ำหลัง deploy = ดู **L-RT**
- **ห้ามสรุปว่า "พร้อม Production 100%" / "ปิดครบทุกลูป"** จนกว่า: (1) L-RT + ขั้น B/E/I ผ่านตา Owner หลัง deploy ใหม่ (2) B-2 + schema parity บันทึก แล้วตามเดิม (3) **marketing_rules/B2 มีหลักฐานใหม่** — *(ทำแล้ว ✓ Pages marker · ✓ **159 apply+verify 4 stage** 2026-10-26 · ledger 159)*
- รายการที่ AI รันให้แล้ว (ไม่ต้องรันซ้ำ): tsc/eslint/vitest/build/route-smoke/CI — ดู `docs/BMB_MASTER_STATUS.md` §5 + **§9.0** · HEAD = `5f891de` (#586/#160)