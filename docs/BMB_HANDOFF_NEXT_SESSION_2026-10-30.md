# Bite Me Baby — HANDOFF + SESSION CLOSURE (ปิดเซสชัน 2026-10-29 · R20)

> ฉบับนี้ = **รายงานปิดงานเซสชัน 2026-10-29 (รอบ R20) + แฮนด์ออฟส่งต่อแชทหน้า** (ต่อจาก `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-29.md`)
> canonical state = `AI_WORK_STATE.md` + `docs/BMB_MASTER_STATUS.md` (ขัดกันให้ถือ 2 ไฟล์นั้น + โค้ดจริง)
> รอบนี้เริ่มจากคำสั่ง Owner **`__apply 169__`** + "ทำงานที่เหลือต่อตามแฮนออฟทั้งหมดตามกฏ"

---

## §1. รายงานรอบนี้ (R20 · 2026-10-29)

| งาน | เนื้อหา | evidence |
|---|---|---|
| ✅ **apply 169 บน production (Owner สั่ง `__apply 169__`)** | script ใหม่ `e2e/r19Apply169.cjs` (แบบ `r*Apply*.cjs` เดิม · Management API `/database/query` · token จาก `.env.local`) 4 stage = **precheck** (ledger top **168** · def เดิมของ 166 = ยังไม่ decode `%XX` · behavior probe `space_eq=false`) → **apply** `supabase/migrations/169_pod_path_percent_encoding.sql` → **verify** = probe พฤติกรรมจริง `driver_path_folder('drv-%20c139-60bc') = driver_path_folder('drv- c139-60bc')` → **true** (ก่อน apply = false) · `%23`↔`#` true · mixed true · def ใหม่มี `(%[0-9A-Fa-f]{2})+` ตัดก่อน strip · `pod_path_is_driver` ยัง **SECURITY DEFINER + STABLE + เรียก driver_path_folder** → **record ledger top = 169** · ยืนยันซ้ำด้วย `e2e/r19Verify169.cjs` (กรอง def ด้วย identity args ที่ถูกต้อง) | `e2e/r19Apply169-result.json` · `e2e/r19Verify169-result.json` |
| 🔐 **N3 (P1 · QA review ข้อ 1.6): listener auth กลาง** | `onAuthStateChange` ใน `src/` เดิม = **0 จุด** → สร้าง `src/lib/authSessionSync.ts` (**pure decision** `resolveAuthSyncAction` — test ได้โดยไม่ยุ่ง Supabase) + `src/components/AuthSessionSync.tsx` (mount ครั้งเดียวใน `App.tsx` ใต้ BrowserRouter → navigate แบบ SPA) + actions ใหม่ใน `authStore`: `clearSession()` / `syncFromAuthUser()` · **กติกา:** `SIGNED_OUT` → clear store + เด้ง `/login` เก็บ `state.from` **เฉพาะตอนเคยล็อกอินจริงและยังไม่ได้อยู่ `/login`** (กัน boot loop ตอนเปิดแท็บใหม่) · `TOKEN_REFRESHED` → `refreshRole()` (เฉพาะ authenticated) · `USER_UPDATED`/`SIGNED_IN` → re-map customer · **ห้าม await supabase ใน callback** (ถือ lock) → ทุกคำสั่ง defer ด้วย `setTimeout(0)` | `src/__tests__/authSessionSync.test.ts` (9 ข้อ) · tsc 0 |
| 📣 **N1 (Owner สั่งจาก 4-2): แอดมินแก้ copy แถบสถานะเอง** | คีย์ **`business_settings.store_status_copy`** = 4 บรรทัด (เซมเดย์เปิด · วันนี้ปิดรับแต่ยังจองล่วงหน้าได้ · ไม่มีรอบเปิดรับ · พรีออเดอร์ปิดรับแล้ว) — **ไฟ 🟢/🔴 (`sameDayOpen`/`preOrderOpen`) ยังคำนวจากรอบจริงเสมอ = ห้าม override** (กติกา Owner) · **บรรทัดเปิดรับ "เปิดรับ พรีออเดอร์ : … (ปิดรอบ …)" = ข้อมูลสด R18 ไม่รับ override** · `src/lib/storeStatusCopy.ts` (mirror `seoSettings`: live store + subscribe + cache 7 นาที + merge กันค่าว่าง) · `StoreStatusStrip` ใช้ `useSyncExternalStore` + โหลดตอน mount · ฟอร์มใน `AdminSettings` (`data-testid="store-status-copy-config"`) + ใส่ `TYPED_FORM_KEYS` (ทางบันทึกเดียว — generic editor ห้ามเขียน) · **ไม่มี migration** (default ฝั่ง client = ค่าจริง · key ถูกสร้างตอนแอดมินกดบันทึกครั้งแรก) | `src/lib/storeStatusCopy.ts` · `src/__tests__/storeStatusCopy.test.ts` (10 ข้อ) |
| 📄 **N2 (checklist ข้อ 2-8 "รอปรับปรุงเพิ่ม"): `docs/BMB_BACKEND_AI_PART_1.md`** | ไล่ตรวจทุก § เทียบโค้ดจริงแล้วแก้/เติม: **§F** เส้นทางสั่งซื้อจริง (เดิมบอกว่าผ่าน `runOrderBuilder` ตรง ๆ → จริง = เพิ่มตะกร้า `FoodTheater.add()` → `deriveOrderMode` → `useCartStore.addItem` · ปุ่มปรับแต่ง/จอง → `HomePage.tsx:343` → `runOrderBuilder`) + gate L-8 toast · **§G** เพิ่ม **P1: คีย์ Google Maps ฝั่ง client ต้องจำกัด HTTP referrer ใน Google Cloud** + สถานะ external providers (mock · `external_methods_enabled=[]`) · **§H** ไฟล์ AI ครบ (`aiMemory`/`aiServerMemory`/`aiModels`) + proxy = EF **`ai-proxy`** (`aiService.ts:176/435` · timeout race `:173`) + เทสต์ 7 ไฟล์ · **§I** ขยายเป็น copy **ทั้งเว็บ** (ตาม role guide §14) + `BANNED_KICKERS` + guards อัตโนมัติ · **L-10** ฯลฯ (evidence `e2e/w7Apply159-record.json`) · **L-11** ยังไม่มีนิยาม | `docs/BMB_BACKEND_AI_PART_1.md` |
| 🧹 **cosmetic (QA 3.9)** | `PromotionsPage` ปุ่ม "ลองใหม่" = **refetch** (`reloadKey`) แทน `window.location.reload` — เหลือจุดเดียวใน `ErrorBoundary` (ซึ่งถูกแล้ว) | `src/pages/PromotionsPage.tsx` |
| 🧪 **gates ท้องถิ่น + CI จริง** | tsc exit 0 · eslint + **brandNameGuard 454 ไฟล์** + **languageSanity 1,269** OK · **vitest 164 files / 1,690 tests / 0 fail** (`e2e/gates_r19b_vitest.log`) · **vite build exit 0** (`e2e/gates_r19b_build.log`) · **CI จริงบน HEAD `05d5e64`: Contract Tests #203 success · CI #629 success · Pages = เสิร์ฟ build รอบนี้แล้ว** (`index-DxSKTZ39.js` + `index-D0SHhvmB.css` = HTTP 200 ที่ `biteme-baby.com` — probe `e2e/r19bProdProbe.cjs`) · ประวัติ: `c017360` = CI #628 **failure** (languageSanity จุดเดียวในแฮนออฟ → แก้ที่ `05d5e64`) + Contract #202 success · ดู `BMB_MASTER_STATUS.md` §9.0 แถว 45-46 | `e2e/gates_r19b_*.log` · §9.0 แถว 45-46 |

**Production state:** ledger top = **169** (migrations 163–169 APPLIED · 169 = รอบนี้) · Pages = auto-deploy จาก main · git HEAD ให้ตรวจจริงด้วย `git log --oneline -1` เสมอ · รอบก่อน (R19) = Contract #200 · CI #626 · Pages ✓ บน `e8831c2`

---

## §2. บทเรียนรอบนี้ (ห้ามลืม)

1. **`pg_get_function_identity_arguments()` คืน "ชื่อ parameter" ด้วย** (`p_id text` ไม่ใช่ `text`) — query กรอง `= 'text'` เงียบ ๆ คืน `[]` แล้ว assertion ของ script **ไม่มี error แค่ค่า false** → รู้ได้จาก behavior probe เท่านั้น (บทเรียนเดียวกับ §9.8 เรื่อง `to_regprocedure`) · script ที่แก้แล้ว = `e2e/r19Verify169.cjs` (กรองด้วย `proname IN (...)` + แสดง args จริง)
2. **`supabase.auth.onAuthStateChange` callback ถือ lock ของ supabase-js** → ห้าม `await` คำสั่ง supabase อื่นในนั้น (deadlock) — ทุกอย่างต้อง `setTimeout(..., 0)` ออกมาก่อน (`AuthSessionSync.tsx` ทำไว้แล้ว)
3. **เทสต์ที่ assert "ข้อความ/โค้ดดิบ" (`?raw`) จะพังเมื่อแก้สเปก** — รอบนี้ข้อดี = จับให้เห็นทันที 3 ไฟล์ตอนเพิ่ม key เข้า `TYPED_FORM_KEYS`: `adminSettingsTypedKeys.test.ts` · `socialAiContinuity.test.ts` · `r12SeoAdminCopy.test.ts` → **ถ้าแก้ชุดค่า/ข้อความใน `AdminSettings`/strip ต้องไล่ 3 ไฟล์นี้ด้วย** (อัปเดตแล้ว — เหตุผล = spec เปลี่ยนโดย Owner = N1)
4. **guards สองตัว (`brandNameGuard`/`languageSanity`) อยู่ใน `npm run lint` และ CI step "Lint"** — กวาด **`src/` + `e2e/` + `docs/` ทั้งหมด (1,269 ไฟล์)** → **ห้ามมีอักขระชุดอื่น (จีน/ญี่ปุ่น/BOM/U+FFFD) ในไฟล์ใดก็ตาม** สองจุดที่โดนเองรอบนี้: `e2e/r19Verify169.cjs:2` + `docs/BMB_HANDOFF_NEXT_SESSION_2026-10-30.md:28` (ตัวหลังทำ **CI #628 แดง** — ทั้งที่ local เคยเขียวรอบก่อน เพราะเขียนไฟล์เพิ่มหลังรัน lint) → **กติกา: รัน `npm run lint` อีกครั้งเสมอหลังเขียน/แก้ไฟล์ใด ๆ ก่อน commit**
5. **Pattern apply production ยังใช้เดิม:** `e2e/r*Apply*.cjs` → Management API `/database/query` + insert ledger ด้วย `ON CONFLICT DO NOTHING` + evidence JSON ชื่อ `r*Apply*-result.json` — ห้าม apply โดยไม่มี precheck/verify
6. **cmd.exe ตีความ `>` เป็น redirect** → `node -e "…=>console.log(…)"` พังและ**สร้างไฟล์ขยะชื่อ `console.log('ERR`** (โดนเอง 1 ไฟล์ หลุดเข้า commit → ลบด้วย chore commit) → **กติกา: คำสั่ง inline ที่มี `=>`/`>` ให้เขียนเป็น script ไฟล์ใน `e2e/` แล้วรัน `node e2e/...`** · เครื่องนี้ไม่มี `gh` + log endpoint ต้องสิทธิ์ admin → ใช้ `e2e/r19bCi.cjs` (Actions API = ไม่ต้องใช้ token เพราะ repo เป็น public)

---

## §3. งานที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

1. **✅ ปิดรอบ R21e แล้ว (2026-10-29):** CI = Contract **#214 ✓** + CI **#640 ✓** (m172/173 พิสูจน์บน PG จริง) · **apply production แล้ว**: `r21eApply172-result.json` + `r21eApply173-result.json` = **ALL_PASS · ledger top=173** · probe หลังแก้ = `has_cap=true` · งานที่เหลือของแชทใหม่ = **ข้อ 2 (ส่ง Owner retest)** + ข้อ 3-6 ด้านล่าง
2. **🆕 retest ส่ง Owner = `docs/BMB_PRODUCTION_TEST_PACK.md` §M (M1-M12)** — ครอบคลุมทุกอย่างที่ทำ/apply รอบ R21: ต้นทุน/กำไร (170) · พิมพ์ครัว · **cap 15% (172)** · **ประตูตรวจสลิป** · แจ้งเตือนครัว→หน้าครัว · พร้อมส่ง→delivery focus · preparing=หักสต็อกรวม · my_role (171) · Auth A1-A6 · **id ออเดอร์ใหม่ (173 — สั่งออเดอร์จริง 1 ออเดอร์แล้วดู id)** · LoadErrorBanner · EF CORS · (เดิม: N1 แถบสถานะ · N3 auth listener · N2 Backend doc)
3. **P1 (Owner ทำใน Google Cloud):** จำกัด **HTTP referrer** ของคีย์ Google Maps (`src/lib/googleMaps.ts` ยิงจาก client 5 จุด) — ทำในคอนโซล ไม่ใช่โค้ด
4. ~~cosmetic (ค้างเดิม)~~ → **ปิดแล้ว (R21e)**: to_char ids = m173 · haversine 3→1 · confirmOfflinePayment 2→1
5. external providers (Grab/Lineman/Foodpanda) = รอ Owner ตัดสินใจ credentials หรือปิด module
6. ของค้างเดิม: **B2** (~11:00) · **C7/C8 ขั้นรัน** · **RL-DEFECT 4+1** · **Part 5/6/7** · L-11 (LED) รอนิยาม · Backend+AI รอเทียบต้นฉบับ · ดู §5

---

## §4. รายการทดสอบทั้งหมด (ส่งให้แชทหน้า)

**เริ่มจาก `docs/BMB_MASTER_TEST_CHECKLIST_2026-10-28.md`** — hard reload ก่อนเสมอ · `biteme-baby.com` เท่านั้น

### A. retest เดิมที่ยังค้าง (เท่ากับแฮนออฟ 2026-10-29 §4A — ยังไม่เปลี่ยน)
- **1I ทั้ง 6 ข้อ** · 2-1/2-2/2-4/2-5/2-6/2-7 · 3-3 · 3-4 · 3-5 · 3-9
- 4-3 (C7) · 4-4 (C8) · 4-5 (RL-DEFECT) — **มีหน้าต่างเวลา**
- Part 5 = settings-sync 14 คีย์ · Part 6 = role guide · 7-1/7-2/7-3/7-5/7-6 · Part 8 · Part 9 (เกณฑ์ปิด)
- แถบสถานะ stripe 2 (R18 copy): ต้องขึ้น `🟢 เปิดรับ พรีออเดอร์ : จองล่วงหน้า รอบ <ชื่อรอบ> <วันที่> (ปิดรอบ HH:MM)`
- copy หน้าเช็คเอาท์ 7 จุด (R19) + หัวข้อที่คงเดิม + placeholder.svg (R17) + ไม่มี log console (R17) + QA checklist (empty state / responsive)

### B. ทดสอบสิ่งที่ทำรอบนี้ (R20) — ใหม่
- **N1:** `/admin/settings` → การ์ด **"📣 แถบสถานะหน้าแรก (ข้อความ)"** → เห็นช่อง 4 บรรทัด · แก้ → บันทึก → toast สำเร็จ · หน้าแรกแถบสถานะเปลี่ยนตาม · **กลับค่า default ได้โดยล้างช่อง (ไม่บันทึกค่าว่างลง DB)** · **ไฟ 🟢/🔴 สองบรรทัดต้องยังเปิด/ปิดจากรอบจริง** (ปิดรอบ → 🔴 ทันที ไม่ต้องรอ reload) · ป้าย `เปิดรับ พรีออเดอร์ : … (ปิดรอบ …)` **ไม่เปลี่ยน** ตามช่องเหล่านี้ (ข้อมูลสด)
- **N3:** (ก) ล็อกอินค้างไว้ แล้ว signOut จากเครื่องอื่น → เครื่องนี้เด้ง `/login` ทันที (ไม่ค้างหน้าเก่า) · (ข) อยู่หน้า `/orders` แล้ว session หมด → เด้ง `/login` และล็อกอินใหม่ต้องกลับ `/orders` · (ค) เปิดแท็บใหม่ตอนไม่มี session → **ห้ามถูกเด้งวน** (เข้าหน้าแรกได้ปกติ)
- **N2:** อ่าน `docs/BMB_BACKEND_AI_PART_1.md` แล้วยืนยัน §F/§G/§H/§I/L-10 (หรือส่งต้นฉบับเดิมมาเทียบ)
- **CI:** ✅ เขียวบน HEAD `d52ab30` (Contract Tests **#205** · CI **#631** · Pages asset 200) — ดู §9.0 แถว 45-48 (เหลือตรวจซ้ำของ docs commit สุดท้าย = แถว 49)

### C. งานที่สั่งค้าง (ทำก่อนส่ง test รอบหน้า)
- P1 คีย์ Google Maps = จำกัด referrer ใน Google Cloud (Owner) · cosmetic 3 ชุด · external providers = รอ Owner

---

## §5. เกณฑ์ปิดงาน (ยังห้ามประกาศ "ปิดครบทุกลูป")

ยังขาด: **C7/C8 ขั้นรัน** · **B2 หลักฐาน** · **RL-DEFECT 4+1** · **Part 5/6/7 ส่วนที่ค้าง** · **test pack ทั้งหมดไม่มี FAIL ค้าง** · **CI ทุก workflow เขียวบน HEAD ใหม่ของรอบนี้** (ต้องตรวจหลัง push) → ยังห้ามพูด "ปิดครบทุกลูป / เหลือ Owner อย่างเดียว"

---

---

## §6. รอบ R21 (2026-10-29 · เฟส 2 "Core Business Logic" + ระบบพิมพ์เข้าครัว) — เพิ่มหลัง R20

### ทำแล้ว (มีหลักฐาน)
- ✅ **migration 170 APPLIED + VERIFIED บน production** (ledger top **170** · evidence `e2e/r21Apply170-result.json` = ALL_PASS) = `products.cogs` / `packaging_cost` / `other_unit_cost` (NUMERIC >=0 + CHECK) + `unit_cost` **GENERATED** · UPDATE grant ไม่เปลี่ยน
- 🔧 **margin helper** `src/lib/marginCalc.ts` (`computeMargin` ต่อหน่วย · `computeOrderProfit` ทั้งออเดอร์) + **แผงกำไรสดในฟอร์ม AdminProducts** (`data-testid=product-margin-panel`) + test `marginCalc.test.ts` 13 ข้อ
- 🔧 **guardrail ส่วนลด 15%** `src/lib/discountGuardrail.ts` (คูปอง+แต้ม+referral) + `CheckoutPage` (`data-testid=discount-guardrail`) **บล็อกปุ่มยืนยันสั่งซื้อ** ตอนเกินเพดาน + test 10 ข้อ · **server-side cap = งานต่อ (P2)**
- 🔧 **ระบบพิมพ์ใบสั่งอาหารเข้าครัว (พัฒนาจากของเดิม ไม่สร้างเทมเพลตใหม่):** ทะเบียนเครื่องพิมพ์ใน `business_settings.print_settings` (แอดมินเพิ่ม/ลบ/ผูก "ใบเสร็จ"/"ใบสั่งครัว" เอง · preset **Nimbot B1Pro**) · **รับออเดอร์ → auto-print ใบสั่งครัว** ด้วย `buildKitchenTicketHtml` เดิม (พังไม่กระทบออเดอร์) · ปุ่ม `🧾 พิมพ์ใบเสร็จ` / `🍜 พิมพ์ใบสั่งครัว` ต่อแถวออเดอร์ · `printOrderTicket` = enqueue idempotent → render → mark `sent`/`failed` · test `printerRegistry.test.ts` 11 ข้อ
- 🔎 **เฟส 1 (Auth/RLS) re-check = เจอ A1-A8 (ยังไม่ได้แก้โค้ด)** — รายละเอียด + แนวทางแก้ = `docs/BMB_QA_REVIEW_2026-10-29.md` หัวข้อ "รอบ R21"
- **gates R21:** tsc 0 · lint 0 (`e2e/gates_r21_lint.log`) · **vitest 167 files / 1,724 tests / 0 fail** (`e2e/gates_r21_vitest.log`) · build 0 (`e2e/gates_r21_build.log`)
- 🔧 **เฟส 3 (UI/UX edge cases) — แก้ "หน้าเงียบตอนโหลดล้มเหลว" 6 หน้า:** `HomePage` · `MenuPage` · `OrdersPage` · `NotificationCenterPage` (เดิมไม่มี try/catch → **ค้าง "กำลังโหลด…" ตลอดกาล**) · `AdminKitchen` · `AdminProducts` — ใช้ banner กลาง **`src/components/ui/LoadErrorBanner.tsx`** (role=alert + ปุ่ม 🔄 ลองใหม่ = refetch จริง) · `OrdersPage` ซ่อนข้อความ "ยังไม่มีออเดอร์" ระหว่าง error · test `loadErrorBanner.test.ts` 5 ข้อ · **backlog 12 หน้า = QA review §เฟส 3** · gates: tsc 0 · lint 0 (`gates_r21b_lint.log`) · **vitest 168 files / 1,729 tests / 0 fail** (`gates_r21b_vitest.log`) · build 0 (`gates_r21b_build.log`)
- 🔧 **R21e ปิดของค้าง P2+cosmetic ทั้งหมด (2026-10-29 · Owner "ทำงานที่ยังค้างให้หมดตามกฏ"):** **m172** server cap ส่วนลดรวม 15% — `promotion_apply_rules` = จุดตัดสินส่วนลดเดียวของ `create_order_with_items` เพิ่ม (4c) `LEAST(v_disc, ROUND(v_sub*0.15,2))` · contract 153 อัปเดตตามกติกาใหม่ · **m173** to_char id fix — `((extract(epoch…)*1000)::bigint)::text` (pattern R14/167) ใน 3 live fns (create_order_with_items/orders_notify_hook/write_order_status_history) · **หลักฐาน production ก่อนแก้** = `e2e/r21eProdIdProbe.json` (`ord- ###########-a04759` · `osh-  1793…`) · haversine 3 ฉบับ → delegate ตัวเดียว `deliveryRouter.haversineDistanceKm` · confirmOfflinePayment wrapper 2 → canonical `paymentGateway` · **TEST_PACK §M M1-M12** = ขั้นตรวจ runtime ของทุกอย่างที่ทำ/apply รอบ R21
- 🔧 **R21d backlog 12 หน้า (2026-10-29 · ปิดรายการเฟส 3):** `LoadErrorBanner` ครบ 12 หน้าค้าง (DeliveryManagement · AdminRounds · InventoryPage · AuditLogPage · AdminPaymentExceptions · AdminRecipes · AdminBrands · AdminAssetAudit · AdminPortfolio · AdminTenants · VotePage · ReviewPage) — ทุกหน้า: banner ลองใหม่ refetch จริง + **ปิดข้อความ empty ปลอมด้วย `!loadError`** (AuditLog/Brands ดัก query error แยกด้วย) · รายละเอียด = QA review §รอบ R21d
- 🔧 **เฟส 1 แก้ครบ A1-A8 + เฟส 4 + 4 คำสั่ง Owner (เฟสเดียวกันรอบสอง):** `probeProfileRole` 3 สถานะ (A1 · error ≠ denied) · AdminRoute `state.from`+fast-path (A2/A6) · returnTo ก่อน (A3) · logout try/finally (A4) · login*/refreshRole try/catch (A5) · **migration 171 `my_role()` APPLIED production — ledger top=171** (`r21cApply171-result.json` ALL_PASS) (A7) · ลบ `isAdmin()` dead code (A8) · **EF: image-gen/queue-enqueue/push-send OPTIONS ไม่มี CORS (probe production) → แก้+deploy แล้ว · probe หลังแก้ ACAO ✓** · PWA audit ครบ (ลบ `public/manifest.json` ซ้ำ) · **Owner asks:** ครัวกดแจ้งเตือนใหม่ → `/admin/kitchen` · เริ่ม preparing = `deduct_inventory_for_order` (สต็อกรวมทุก round) · **ประตูตรวจสลิปก่อนรับออเดอร์** (SlipThumb รูปจริง+confirm_offline_payment → accept) · พร้อมส่ง → `/admin/delivery?focus=` · test ใหม่ `authProbeRoles.test.ts` (10) + notificationLinks (13) · **gates: tsc 0 · lint 0 (462) · vitest 169 files/1,740 tests/0 fail · build 0** · รายละเอียด = QA review §รอบ R21 รอบสอง

### ทดสอบสิ่งที่ทำรอบ R21
- `/admin/products` → เพิ่ม/แก้เมนู → กรอกต้นทุน 3 ช่อง → แผง "📊 กำไร (คำนวณสด)" เปลี่ยนทันทีที่พิมพ์ · บันทึกสำเร็จ (คอลัมน์มีจริงบน production แล้ว)
- หน้าตั้งค่าเครื่องพิมพ์ → เพิ่ม "Nimbot B1Pro — ครัว" → ผูกเป็นเครื่องของ "ใบสั่งครัว" → บันทึก → กด "ทดสอบใบสั่งครัว" (toast ต้องบอกชื่อเครื่องที่ผูกไว้)
- `/admin/orders` → กด "ยืนยันออเดอร์" → ไดอะล็อกพิมพ์ของเบราว์เซอร์โผล่ (ใบสั่งครัว) · ปุ่ม `🧾 พิมพ์ใบเสร็จ` / `🍜 พิมพ์ใบสั่งครัว` กดได้ทุกออเดอร์
- ตะกร้า/เช็คเอาท์: ใช้คูปองเกิน 15% ของยอดสินค้า → ข้อความแดง `data-testid=discount-guardrail` + ปุ่มสั่งซื้อถูกบล็อก → ลดเหลือ 15% → ปลดบล็อก
- **ตั้งค่า Nimbot ครั้งเดียว:** ติดตั้งไดรเวอร์ของ Nimbot → ตั้งเป็นเครื่องพิมพ์ค่าเริ่มต้นของ Windows (หรือเลือกเครื่องในไดอะล็อกพิมพ์ของ Chrome) — ระบบส่งคำสั่งผ่าน `window.print` จึงต้องพึ่งค่าตรงนี้

### ค้างต่อ (เรียงลำดับทำรอบถัดไป)
1. **เฟส 3** = UI/UX edge cases (loading/empty/ข้อความแจ้งเตือน) · **เฟส 4** = PWA cache/service worker + responsive มือถือ
2. **แก้ A1-A8 (เฟส 1)** — เริ่ม 4 จุด P1: `AdminRoute` error/denied แยกกัน · ส่ง `state.from` · `returnTo` ของ admin · `logout` แบบ try/finally
3. **4 คำสั่งเดิมของ Owner (ยังไม่ได้ทำ):** เด้งจากแจ้งเตือนเข้าหน้าครัว · เซมเดย์ "ส่งทันที" + ตัดสต็อกรวมเดียวกันทุกรอบ · ตรวจสลิปมาก่อน/พร้อมกับตอนรับออเดอร์ (เห็นรูปแนบ) · เด้ง `https://biteme-baby.com/admin/delivery` แท็บจัดส่งอัตโนมัติ
4. server-side cap 15% (P2) · cosmetic 3 ชุด · B2/C7/C8/RL-DEFECT/Part 5-6/7 → §5 ยังใช้ได้ทั้งหมด

---

*จัดทำ 2026-10-29 (R20) · Owner สั่ง `__apply 169__` → production ledger = 169 · N1/N2/N3 = ปิดงานค้างจากแฮนออฟ 2026-10-29 · CI ของรอบนี้ดู `BMB_MASTER_STATUS.md` §9.0 แถว 45 · **อัปเดต R21:** เพิ่ม §6 (ledger 170 · margin · guardrail 15% · ระบบพิมพ์เข้าครัว) · gates R21 = tsc/lint/vitest/build ทุกตัว 0*
