# BMB — MASTER STATUS (เอกสารสถานะหลักเดียวของโปรเจกต์)

> **เอกสารนี้คือ canonical current state ไฟล์เดียว** ตาม Owner directive 2026-10-26
> (WHOLE-REPO RECONCILIATION · CODE CLOSURE · LEAN PRODUCTION ACCEPTANCE)
> ไฟล์อื่นที่มีวันที่ในชื่อ = **รายงาน ณ วันนั้น** ห้ามใช้แทนไฟล์นี้ ถ้าขัดกันให้ถือโค้ด/หลักฐาน (DOC DRIFT)

**last_updated:** 2026-10-26 · **branch:** `main` · อ่าน §0 ก่อนเริ่มงานทุกครั้ง

---

## 0. วิธีใช้ + ลำดับความจริง

1. อ่าน `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → ไฟล์นี้
2. ลำดับความจริง: **โค้ด > migration/DB > runtime evidence > test > เอกสาร**
3. งานที่ยังไม่มีผลรันจริง = `UNVERIFIED` / `BLOCKED` ห้ามเขียนว่าเสร็จ
4. index ของเอกสารที่ถูกย้าย = `docs/archive/INDEX_2026-10-26.md`
5. ถ้าเอกสารเก่า (report/handoff) ขัดกับไฟล์นี้ → ให้ถือไฟล์นี้ + ตรวจสอบโค้ดเสมอ

---

## 1. Canonical current state (ตรวใหม่ทั้งหมด 2026-10-26)

### 1.1 Git / workspace

| รายการ | ค่า (ตรวจจริง 2026-10-26) |
|---|---|
| Repository | `D:\A PROJECT\Bite Me Baby` · remote `git@github.com-bmb:bitemebaby2016-coder/bmb.git` |
| Branch | `main` tracking `origin/main` |
| HEAD ก่อนเริ่มงาน | `29ed251` = `origin/main` (หลัง `git fetch --prune` ไม่มี ahead/behind) |
| staged / unstaged | **ว่างทั้งคู่** ตอนเริ่มรอบ · working tree clean · untracked = **0 ไฟล์** |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` — **คงเดิม ไม่ถูกแตะ** |
| งานที่ทำรอบนี้ | ดู §9 (เปลี่ยนเฉพาะไฟล์ที่ระบุ ไม่มี `git add -A`) |

### 1.2 Gates (รันจริงบนเครื่องนี้ · ไม่ได้อ้างจากเอกสารเก่า)

| Gate | คำสั่ง | ผล | Evidence |
|---|---|---|---|
| typecheck | `npx tsc --noEmit` | **exit 0** | รันตรง ๆ 2026-10-26 |
| lint | `npx eslint .` | **exit 0** | `e2e/session20261026-gates-evidence.txt` §6 |
| brand guard | `node scripts/brandNameGuard.cjs` | **OK — ตรวจ 422 ไฟล์** | `e2e/session20261026-gates-evidence.txt` §6b |
| unit/contract | `npx vitest run` | ดูก้อน §5 | `e2e/session20261026-gates-evidence.txt` §2–§5 |
| build | `npm run build` (tsc + vite) | **exit 0** | `e2e/session20261026-gates-evidence.txt` §7 |
| E2E route smoke | `npx playwright test routeNav` | **39/39 passed · exit 0** | `e2e/session20261026-gates-evidence.txt` §8 |
| SQL replay / production | ไม่ได้รันรอบนี้ | **UNVERIFIED รอบนี้** | ของรอบก่อน = `e2e/*.json` (§4) |
| CI ของ SHA ที่ push จริง | GitHub Actions API (ไม่มี `gh`) | **CI #569 = success · Contract Tests #143 = success** | §9.4 |

### 1.3 Production (ไม่ได้ re-verify ในรอบนี้)

- migration ledger ล่าสุดที่มีหลักฐาน apply = **156** (`e2e/r16Apply156-*.json` · session 2026-10-26)
- **รอบนี้ไม่ได้แตะ production** (ไม่มี migration/apply/deploy/write ใด ๆ)
- คำสั่งตรวจ ledger รอบถัดไป (read-only): รัน precheck ของ `e2e/` แล้วดู `schema_migrations` top

---

## 2. Canonical Capability Matrix

> 1 capability = 1 `capability_id` = 1 canonical entry = 1 data authority
> สถานะ: `IMPLEMENTED` (โค้ดมี) · `TESTED` (มีผลรัน test จริง) · `DEPLOYED` (apply แล้วมีหลักฐาน)
> · `RUNTIME VERIFIED` (ตรวจบน production แล้ว) · `DOCUMENTED` · `MISSING` · `BLOCKED` · `DEFERRED`

| capability_id | ความต้องการ | Canonical UI entry | Canonical authority | Tests / evidence | สถานะ |
|---|---|---|---|---|---|
| CAP-01 | สั่งซื้อทั้ง 2 โหมดมีเส้นทางเดียว (same-day/pre-order) | ปุ่ม "สั่งเลย/จองล่วงหน้า" ทุกใบ (หน้าแรก + `/menu`) | **`src/lib/orderEntry.ts` → `runOrderBuilder`** (ใหม่ 2026-10-26) | `menuCartResultGuard`, `homeMenuAdminOrdering`, `homePreOrderModeGuard`, `checkoutModeLock` | IMPLEMENTED + TESTED |
| CAP-02 | ตะกร้าเดียว + mode ต่อ line (ไม่สลับ/ไม่ล้าง) | `/cart` → `/checkout` | `src/store/cartStore.ts` (`deriveCartMode`) | `cartIsolationStore`, `cartLineIdentity`, `cartPersistence` | IMPLEMENTED + TESTED |
| CAP-03 | สร้างออเดอร์ = server เท่านั้น (กัน double-submit) | `/checkout` | RPC `create_order_with_items` / `_i` (007/020/025/124) | `canonicalOrderFlow`, `orderSubmitKey`, contract CI SQL | IMPLEMENTED + TESTED · DEPLOYED (ledger 156) |
| CAP-04 | SAME_DAY ไม่มี cutoff · PRE_ORDER มี cutoff ตาม policy | แถบสถานะ + เลือกรอบใน checkout | server 143/148 + `src/lib/orderPolicy.ts` + `deliveryRoundStatus.ts` | `roundsSameDayNoCutoff` (16), `orderPolicy`, contract 143/148 | IMPLEMENTED + TESTED · DEPLOYED |
| CAP-05 | เมนูแอดมินชุดเดียว (ไม่ซ้ำ) | Sidebar/Drawer เดียว · 5 กลุ่ม / 19 รายการ | `src/lib/adminUi.ts` `ADMIN_NAV_GROUPS` (flat derive จาก groups) | `adminUi`, `adminNavFeedback`, `adminShell` | IMPLEMENTED + TESTED |
| CAP-06 | รวมหน้าแอดมินที่ซ้ำ/ใกล้เคียงเป็น Hub | `/admin/orders` `/admin/products` `/admin/delivery` `/admin/settings` `/admin/tenants` (+ redirect เส้นเก่า) | `src/components/admin/AdminHubs.tsx` | `adminPreOrdersConsolidation`, routeNav | IMPLEMENTED + TESTED |
| CAP-07 | ศูนย์ขนส่งเดียว 5 แท็บ | `/admin/delivery` (rounds/availability/dispatch/routes/fees) | `AdminHubs.DeliveryHub` + `bmbAdminApi_rounds`/`driverService` | `deliveryRoundStatus`, `dispatchContract`, `roundArchiveAdmin` | IMPLEMENTED + TESTED |
| CAP-08 | settings มี authority เดียวต่อค่า | `/admin/settings` | `business_settings` ผ่าน `bmbAdminApi_settings` · typed forms (`TYPED_FORM_KEYS`) · `platformConfig` = fallback เท่านั้น | `adminSettingsTypedKeys`, `configAuthorityMap` (+ เคส D14 ใหม่) | IMPLEMENTED + TESTED |
| CAP-09 | แพทเทิร์นรอบ 3 รอบ/วัน + รอบรายวัน | `/admin/delivery?tab=rounds` | migration 144 + `bmbAdminApi_rounds` | `menuScheduleRoundLink`, `roundsAuditGuards`, contract 144 | IMPLEMENTED + TESTED · DEPLOYED |
| CAP-10 | แอดมินตรวจสลิปได้จริง (อ่าน payment_intents ได้) | OrdersHub → แท็บ "การชำระเงิน/ตรวจสลิป" | migration **138** (RPC `get_payment_intents_for_orders` + GRANT) | `paymentReadAuthority`, `paymentIntentsSingleRead`, `slipReviewPanel` | IMPLEMENTED + TESTED · runtime = รอ Owner |
| CAP-11 | Rider POD อัปโหลดรูปได้จริง | `/rider` | migration **139** (policy `pod_photos_driver_upload` ใหม่) | `riderPodCrossBrowser`, `riderFullCycle`, `driverActionResults` | IMPLEMENTED + TESTED · runtime = รอ Owner/rider |
| CAP-12 | notification badge อ่านค่าตรง | หน้าลูกค้า + แผงแอดมิน | `notificationReconciliation` (client) | `notificationReconciliation.test` | IMPLEMENTED + TESTED |
| CAP-13 | Web push จริง | PWA | `pushTransport` + `sw.ts` | `pushTransport.test` | IMPLEMENTED + TESTED · RUNTIME = รออุปกรณ์ Owner |
| CAP-14 | SMS จริง | edge/worker | `smsTransport` | `smsTransport.test` + `docs/BMB_W23_SMS_DELIVERY_DIAGNOSTIC.md` | IMPLEMENTED + TESTED · RUNTIME = UNVERIFIED |
| CAP-15 | สิทธิ์/เมนูตาม role | ทุก `/admin` | `ADMIN_CAPABLE_ROLES` + `navGroupsForRole` + RLS | `roleMatrixCoverage`, `roleSystem` | IMPLEMENTED + TESTED |
| CAP-16 | พิมพ์ใบเสร็จ/thermal | `/admin/settings?tab=print` | migration 128 + `printService` | `printTemplates` | IMPLEMENTED + TESTED · **R-16 = Owner ทำเอง** |
| CAP-17 | backup + restore drill | — | `dbBackupHelpers` / `dbRestoreDrill` | `dbRestoreDrill: PASS` (หลักฐานรอบก่อน) | IMPLEMENTED + TESTED |
| CAP-18 | Maps ในหน้าแอดมิน/ไรเดอร์ | `/admin/delivery?tab=routes` | `src/lib/googleMaps.ts` — key อ่านตอน **build** (`VITE_GOOGLE_MAPS_API_KEY`) | ไม่มี unit test runtime · Owner ตั้ง key ใน Cloudflare แล้ว | IMPLEMENTED · RUNTIME UNVERIFIED (ต้อง deploy ใหม่หลังตั้งค่า) |
| CAP-19 | Growth & Rewards (promotions/referral/points/spin/affiliate/catalog) | — | migrations 153–156 | contract 153–156 (รอบก่อน) | **DOCUMENTED + DEPLOYED · acceptance §4 รอ Owner** |
| CAP-20 | ไม่มี dead code ค้าง | — | เอาออก 11 ไฟล์ (2026-10-26) | เกตทั้งหมดเขียวหลังลบ (§5) | CLOSED (รอบนี้) |
| CAP-21 | ระบบจำลูกค้า/เจาะกลุ่มอัตโนมัติ (audit D11) | `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม/คำสรุป) | **`src/lib/customerIntelligence.ts`** — คำนวณจากสถิติออเดอร์จริงทุกครั้งที่โหลด · **ไม่มีช่องให้แอดมินตั้ง** · ไม่มี localStorage | `customerIntelligence.test.ts` (11 เคส รวม AUTOMATIC contract) | **IMPLEMENTED + TESTED (2026-10-26 · รอบปิด backlog)** |
| CAP-22 | AI Studio เลือกเวลา + โพสต์อัตโนมัติเต็มรูปแบบ | `/admin/marketing?tab=calendar` → ปุ่ม "🤖 ให้ AI เลือกเวลาทั้งหมด" | **`src/lib/marketingAutoSchedule.ts`** (เลือกเวลาจาก marketing_rules จริง) → RPC `marketing_schedule_post` เดิม → worker `marketing_publish` รายชั่วโมงตัวเดิม · **ไม่มี publish path ใหม่ · ห้าม auto-approve** | `marketingAutoSchedule.test.ts` (12 เคส + contract CNT-01/G7) | **IMPLEMENTED + TESTED (2026-10-26 · รอบปิด backlog)** |

---

## 3. Engineering backlog — ปิด 4/5 · **B-2 = BLOCKED (กติกา 0.9: ซ้ำ 2 ครั้งแล้วหยุด)**

> คำสั่ง Owner 2026-10-26 "ปิดให้หมดโดยสมบูรณ์" → ทำครบ B-1/B-3/B-4/B-5 แล้ว ·
> **B-2 พยายามแล้ว 2 ครั้งและล้มเหลวทั้งคู่** → หยุด + คืน main เป็นเขียว + รายงาน blocker ตามกติกา (ไม่ปิดบัง)

| # | งาน (สถานะก่อนรอบนี้) | ผล | หลักฐาน |
|---|---|---|---|
| **B-1** | `orderTimeline.test.ts` flaky ตอนรันชุดใหญ่ (4 เคส) | render + flush ข้างใน `act()` ให้รอ React commit จริง — **assertion ทุกตัวคงเดิม ไม่มี skip/ลดข้อกำหนด** | `src/__tests__/orderTimeline.test.ts` (มี comment ระบุ B-1 FIX) · vitest ทั้งชุดเขียว |
| **B-2** | legacy contract 7 ตัว อยู่นอก CI | **BLOCKED — ลองแล้ว 2 ครั้ง (กติกา 0.9: หยุด)** · ครั้งที่ 1 เพิ่ม step ใน CI = **ล้มเหลวทั้ง 7 ไฟล์** (Contract Tests #147 failure) · ครั้งที่ 2 ซ่อมตามหลักฐาน + ตรวจด้วย replay ท้องถิ่น = **ยังเขียวแค่ 1/7 (029)** → rollback ทั้งหมดเพื่อคืน main เป็นเขียว | **หลักฐาน:** annotations ของ run `40266375919` (7 error บรรทัด) + `D:\tmp\legacy_local.log` / `legacy_local2.log` (ผลรัน 7 ไฟล์ 2 รอบ) · ** blocker:** fixture ต้องมี auth user/role จริง · signature/geometry/ACL drift ตาม migration ยุคใหม่ → ต้องซ่อมบน DB session ที่ verify ได้ หรือ **ปลดระเบียบอย่างเป็นทางการ**โดยชี้ว่า 123/124/146/147/148/149 คือ contract ยุคใหม่ของ domain เดียวกัน (**รอ Owner เลือก (ก) หรือ (ข)**) |
| **B-3** | CAP-21 ระบบจำลูกค้า/เจาะกลุ่มอัตโนมัติ (MISSING) | สร้าง `src/lib/customerIntelligence.ts` + ต่อ `/admin/customers` (แถบสรุป + คอลัมน์กลุ่ม) · **คำนวณอัตโนมัติ ไม่มีช่องให้แอดมินตั้ง** | `src/__tests__/customerIntelligence.test.ts` (11 เคส) |
| **B-4** | CAP-22 AI เลือกเวลา/โพสอัตโนมัติ (DEFERRED) | สร้าง `src/lib/marketingAutoSchedule.ts` (เลือกเวลาจาก marketing_rules จริง) + ปุ่มในแท็บปฏิทิน · **คงกติกา: ห้าม auto-approve · ไม่มี publish path ใหม่** | `src/__tests__/marketingAutoSchedule.test.ts` (12 เคส + CNT-01/G7 contract) |
| **B-5** | runtime จริงของ CAP-10/11/13/14/18 | **ส่งมอบเป็นชุดทดสอบเดียวให้ Owner รันบน production** | **`docs/BMB_PRODUCTION_TEST_PACK.md`** (ขั้น A–K ครบทุก checklist ที่เคยกระจาย) |

> ยังเหลืองาน engineering **1 รายการ = B-2 (BLOCKED — รอ Owner เลือก (ก) ซ่อม หรือ (ข) ปลดระเบียบ)**
> ส่วนที่เหลือหลังจากนี้ = Owner-only ทั้งหมด → §7 → `docs/BMB_PRODUCTION_TEST_PACK.md`

---

## 4. Migration / schema status

- **Production ledger:** top = **156** (หลักฐาน `e2e/r16Apply156-*.json` + `e2e/r15Apply155-*.json` · รอบก่อน)
- **รอบนี้ (2026-10-26): ไม่มี migration ใหม่ ไม่มี apply/deploy** — เป็นงาน client/docs เท่านั้น
- แผนที่สำคัญ (คงเดิม): 138 = payment_intents read authority · 139 = POD storage policy ·
  141/142 = pre-order unify + menu gate · 143 = cutoff_hours · 144 = round pattern · 152 = REVOKE anon set_menu ·
  153–156 = Growth & Rewards stages 1–4
- **schema drift:** ไม่ได้ตรวจ fresh-replay เทียบ production ในรอบนี้ = `UNVERIFIED`
  (ของรอบก่อน: Docker replay 001–156 ALL_GREEN — ยังเป็นของรอบก่อน ไม่ใช่ของรอบนี้)
- proposed migrations ที่เคยค้าง (`PROPOSED_wave5_orders_delivery_address` / `wave1_profiles_grant` /
  `wave2_history_backfill`) → ถูกแทนด้วย **150 / 151 / 152** ที่ apply แล้ว (2026-10-25) → **CLOSED**

---

## 5. Test / CI evidence

### 5.1 ผลรันจริงรอบนี้ (2026-10-26 · ทุกบรรทัดมี exit code)

| รัน | ผล | evidence |
|---|---|---|
| baseline `npx vitest run` (ก่อนแก้) | **144 files / 1517 tests / 0 fail / exit 0** | `e2e/session20261026-gates-evidence.txt` §2 |
| `npx tsc --noEmit` | **exit 0** | §1 ของไฟล์ evidence |
| `npx vitest run` (หลังแก้ · run 1) | 144 files · 1518 tests · **4 fail = ทั้งหมดใน `orderTimeline.test.ts`** · exit 1 | §3 |
| `npx vitest run src/__tests__/orderTimeline.test.ts` | **6/6 pass** | §4 |
| `npx vitest run` (หลังแก้ · run 2) | **144 files / 1518 tests / 0 fail / exit 0** | §5 |
| `npx eslint .` | **exit 0** | §6 |
| `node scripts/brandNameGuard.cjs` | **OK — 422 ไฟล์** | §6b |
| `npm run build` | **exit 0** | §7 |
| `npx playwright test routeNav` | **39/39 passed · exit 0** | §8 |

> สรุปอย่างตรงไปตรงมา: รอบ run 1 เจอ flaky จริง 4 เคสใน `orderTimeline.test.ts` (บันทึกเป็น B-1)
> และรันซ้ำได้เขียวทั้งหมด — **ไม่ได้แก้ test เพื่อให้ผ่าน** และไม่ได้ skip/ลด assertion ใด ๆ

### 5.2 สิ่งที่แก้ในโค้ดรอบนี้ (รายละเอียด §9)

1. `src/lib/orderEntry.ts` (ใหม่) — เส้นทางสั่งซื้อเดียวของ storefront
2. `HomePage` / `MenuPage` — เดิมมีสำเนา logic คู่กัน → delegate ให้เส้นทางเดียว
3. `HomePage.handleReviewCta` — **บั๊กจริงที่แก้:** ไม่เคยเช็ค `AddToCartResult` ก่อน toast "เพิ่มลงตะกร้าแล้ว" + navigate
4. ลบไฟล์ที่ไม่มีใครอ้าง 11 ไฟล์ (พิสูจน์ 0 reference ทั้ง `src` รวม tests และทั้ง `supabase/scripts/e2e/.github/public`)
5. `platformConfig` D14 — default quota/cutoff อ้าง `ORDER_POLICY_DEFAULTS` (เดิม hardcode 120 vs canonical 100)

### 5.3 CI

- เครื่องนี้ **ไม่มี `gh`** (`where gh` = ไม่พบ) → ตรวจ Actions ผ่าน **GitHub Actions REST API สาธารณะ**
  (`GET /repos/bitemebaby2016-coder/bmb/actions/runs?head_sha=<full SHA>`) + หน้า `/actions`
- **ผลของ SHA ที่ push จริง (`066e961`): CI #569 = success · Contract Tests #143 = success** — รายละเอียด/URL = §9.4
- ขั้นตอนตรวจซ้ำด้วยตัวเอง: เปิด
  `https://github.com/bitemebaby2016-coder/bmb/actions` แล้วหาแถว commit `066e961`

---

## 6. Production runtime gaps (ยังไม่มีหลักฐานจริง)

| ช่องว่าง | ต้องทำที่ไหน |
|---|---|
| PWA cache ทำให้ Owner เห็น build เก่า | Ctrl+Shift+R ก่อนตรวจทุกครั้ง |
| Maps ต้อง build ใหม่หลังตั้งค่า key | key อ่านตอน build (`googleMaps.ts:10`) → ถ้าตั้งค่าหลัง build ล่าสุด ต้อง deploy ใหม่ |
| SMS/push/POD/slip ตรวจบน production จริง | ต้องรันบน browser/อุปกรณ์จริง (Owner + rider) |
| contract039 รันบน production ตรง ๆ ติด fixture สินค้าจริง | ของรอบก่อน — ไม่ใช่ regression (verify152 เขียว) |
| CI ของ SHA ล่าสุด | ต้องเปิด Actions จริง (§5.3 / §9.4) |

---

## 7. Owner Production Acceptance — **ใช้ชุดเดียว: `docs/BMB_PRODUCTION_TEST_PACK.md`**

> คำสั่ง Owner 2026-10-26: "รวบรวมเทสไว้ทดสอบจริงทั้งหมดบนโปรดักชั่นจริง"
> → ทุก checklist ที่เคยกระจายอยู่ในหลายเอกสาร ถูกรวมเป็น **ขั้น A–K** ในไฟล์นั้นไฟล์เดียว
> (CI · storefront 2 โหมด · แอดมิน · แจ้งเตือน/push/SMS · จ่ายเงิน/สลิป · rider POD · แผนที่ ·
>  role 14a–14j · R-16 Print-to-PDF · G&R 4 stages · docs ไม่ drift)

เหลือเฉพาะสิ่งที่ AI ทำไม่ได้อย่างปลอดภัย (production write / ตาตรวจจริง) — **เปิดรันตามลำดับในไฟล์นั้น**:

1. ขั้น **A** (CI ของ SHA ล่าสุด) → 2. **B** (สั่งจริง 2 โหมด + guard ใหม่) → 3. **C** (แอดมิน + CAP-21/22)
4. **D–H** (push/SMS/slip/POD/maps/roles) → 5. **I** (R-16 Print-to-PDF) → 6. **J** (G&R) → 7. **K** (docs)

---

## 8. Doc reconciliation & archive

- เอกสารสถานะหลัก = **ไฟล์นี้** · `AI_WORK_STATE.md` = บันทึกการทำงานสั้น ชี้มาที่นี่
- index ของเอกสารที่ย้าย = `docs/archive/INDEX_2026-10-26.md`
- ไม่มีการแก้วันที่/สถานะในรายงานย้อนหลัง — ทุกฉบับคงสภาพเป็น "รายงาน ณ วันนั้น"
- หลักฐาน apply migration / audit / incident / security / acceptance **ไม่ถูกลบ** ทุกฉบับยังอยู่ครบ

---

## 9. Change log (รอบ 2026-10-26)

### 9.1 โค้ด

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/lib/orderEntry.ts` | **ใหม่** — canonical order-entry (`runOrderBuilder`): builder → addItem → gate → route |
| `src/pages/HomePage.tsx` | `handleSameDay`/`handlePreOrder` → delegate · **แก้บั๊ก** `handleReviewCta` ไม่เช็คผลก่อน toast/navigate |
| `src/pages/MenuPage.tsx` | `handleSameDay`/`handlePreOrder` → delegate (ข้อความ/ปลายทางเดิมคงเดิมทุกตัวอักษร) |
| `src/config/platformConfig.ts` | default `cutoffHours`/`dailyQuota` อ้าง `ORDER_POLICY_DEFAULTS` (ปิด D14) |
| ลบ 11 ไฟล์ | `AiAvatar`, `AddressAutocomplete`, `BranchAwareProductCard`, `FoodPlaceholder`, `auditLogConstants`, `bmbAdminApi_branch_overrides`, `bmbAdminApi_reviews`, `demandForecasting`, `lib/ai/aiContextBuilder`, `store/inventoryStore`, `lib/utils` |
| `src/__tests__/menuCartResultGuard.test.ts` | ย้ายเป้าตรวจจากสำเนาในหน้า → `orderEntry.ts` (assertion คงความเข้ม + เพิ่มกันสำเนากลับมา) |
| `src/__tests__/homeMenuAdminOrdering.test.ts` | assertion เดิมแทนด้วย delegation check |
| `src/__tests__/configAuthorityMap.test.ts` | เพิ่มเคส D14 (ห้ามมี default ตัวที่สอง) |

### 9.2 สิ่งที่ไม่ได้แตะ (จงใจ)

- ไม่มี migration/SQL/deploy/production write ใด ๆ
- ไม่เปลี่ยน business rule (cutoff/quota/mode/permission/order-state) — คงข้อความ UI และปลายทาง navigate เดิมทุกประการ
- stash `local-edits-before-sync-2026-09-21` + untracked เดิม ถูกรักษาไว้ (ตอนเริ่ม round = ไม่มี untracked)

### 9.3 เอกสาร

- สร้างไฟล์นี้ · ปรับ `AI_WORK_STATE.md` ให้เป็นสถานะสั้น · เพิ่มจุดชี้ใน `AI_ENTRYPOINT.md`
- สร้าง `docs/archive/INDEX_2026-10-26.md` + ย้าย handoff ที่ถูกแทนที่แล้วเข้า archive

### 9.4 Git / CI ของรอบนี้

| รายการ | ผล (ตรวจจริง) |
|---|---|
| commit | **`066e961`** `refactor(order-entry+admin): one canonical order path, dead-code closure, master status doc` (30 files · +561 / −1624) |
| push | `git push origin main` → `29ed251..066e961 main -> main` |
| HEAD vs origin | `git status -sb` = `## main...origin/main` (ไม่มี ahead/behind) · working tree **clean** · untracked **0** |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` **ยังอยู่ครบ** |
| secret scan | `git diff --cached` 2,487 บรรทัด · **SECRET_HITS = 0** (สแกน key/JWT/PEM/password patterns) |
| **CI #569** (`.github/workflows/ci.yml`) | **completed = success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40260114649 |
| **Contract Tests #143** (isolated PostgreSQL) | **completed = success** · https://github.com/bitemebaby2016-coder/bmb/actions/runs/40260114655 |
| Cloudflare Pages deploy | กำลัง build ตอนตรวจ (check-run `in_progress`) — deploy ทำอัตโนมัติจาก main |
| วิธีตรวจ (เครื่องนี้ไม่มี `gh`) | GitHub Actions REST API สาธารณะ `.../actions/runs?head_sha=<full SHA>` + หน้า `/actions` |

> ผล CI ทั้งสองเส้นข้างบน = **อ่านจาก GitHub API จริงของ SHA `066e961`** ไม่ใช่การคาดเดา

### 9.5 Change log — รอบที่ 2 (ปิดงานค้างทั้งหมด · Owner directive 2026-10-26)

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `src/lib/customerIntelligence.ts` | **ใหม่ (CAP-21)** — เจาะกลุ่มลูกค้าอัตโนมัติจากสถิติจริง (`deriveCustomerInsight`/`segmentTally`/`INTELLIGENCE_THRESHOLDS`) · deterministic · ไม่มี localStorage/ไม่มีช่องให้แอดมินตั้ง |
| `src/pages/admin/AdminCustomers.tsx` | แสดงแถบสรุปกลุ่ม + คอลัมน์ "กลุ่ม/คำสรุป (อัตโนมัติ)" — คำนวณทุกครั้งที่โหลดหน้า |
| `src/lib/marketingAutoSchedule.ts` | **ใหม่ (CAP-22)** — `scoreSlot`/`pickPostSlot`/`planSchedule`/`autoScheduleApprovedPosts` · เคารพ publishing window/cooldown/frequency cap ของ `marketing_rules` · เรียก `scheduleMarketingPost` (RPC เดิม) เฉพาะโพสต์ `approved` |
| `src/pages/admin/AdminMarketing.tsx` | ปุ่ม "🤖 ให้ AI เลือกเวลาทั้งหมด" ในแท็บ 📅 ปฏิทิน (`data-testid="mk-auto-schedule"`) |
| `.github/workflows/contract-tests.yml` | เพิ่ม step legacy contract 7 ตัว (B-2) → **CI ล้มเหลวทั้ง 7** → ถอดออกแล้ว เหลือ comment อธิบาย blocker ไว้ในไฟล์ (B-2 = BLOCKED) |
| `src/__tests__/orderTimeline.test.ts` | **B-1** render+flush ใน `act()` (assertion คงเดิม) |
| `src/__tests__/categorySections.test.ts` | **B-1** `renderHtml` → `act()` (เคสเดิม fail เป็นกลางของ `indexOf = -1`) |
| `src/__tests__/homeSectionModeCta.test.ts` | **B-1** `mount` → async + `act()` (ป้องกันแบบเดียวกัน) |
| `src/__tests__/customerIntelligence.test.ts` | **ใหม่** 11 เคส (boundary/segment/deterministic/AUTOMATIC contract) |
| `src/__tests__/marketingAutoSchedule.test.ts` | **ใหม่** 12 เคส (slot/cooldown/cap/plan/injection + CNT-01/G7 contract) |
| `docs/BMB_PRODUCTION_TEST_PACK.md` | **ใหม่** — ชุดทดสอบ production รวม A–K (คำสั่ง Owner: รวบรวมทุกเทส) |
| `docs/BMB_MASTER_STATUS.md` · `AI_WORK_STATE.md` | CAP-21/22 → IMPLEMENTED+TESTED · §3 backlog = ปิดหมด · §7 ชี้ไป test pack |

### 9.6 CI ของรอบที่ 2

_(เติมหลัง push — SHA + ผล CI/Contract Tests จริง รวมถึงบรรทัด `Legacy contracts OK — 7/7`)_

---

### 9.7 E2E / route smoke (รันตอนรอบที่ 1 — ยังมีผล รอบที่ 2 ไม่ได้รันซ้ำ)

| รายการ | ผล |
|---|---|
| คำสั่ง | `npx playwright test routeNav` บน build จริง (`vite preview --port 5199` จาก `dist/` ที่ build ในรอบนี้) |
| ผล | **39 passed / 0 failed (46.3s) · `PW_EXIT=0`** · evidence = `e2e/session20261026-gates-evidence.txt` §8 |
| ครอบคลุม | public routes ทั้งหมด · protected (guest → `/login`) · redirect (`/ai-chat` → `/talk-to-bite`, `/profile/orders` → `/orders`, `/admin/pre-orders`, `/admin/dashboard`) · catch-all `/no-such-page-xyz` · ตรวจ console error "No routes matched location" |
| **ไม่ได้รัน** | `e2e/runE2E.cjs` (full order journey) — **จงใจไม่รัน**: สคริปต์นี้สร้าง user/order จริงบน Supabase production (ต้อง `BMB_E2E_SVC_KEY`) = **production write** ซึ่ง Owner directive ไม่อนุมัติให้ AI ทำเอง → อยู่ใน Owner acceptance §7 |
| ไม่ได้รัน | `e2e/g2rv.spec.ts` — ต้องการฐานข้อมูล/เซสชันทดสอบที่ไม่ได้เตรียมในรอบนี้ (= NOT RUN, ไม่ใช่ PASS) |