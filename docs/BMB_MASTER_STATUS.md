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
| lint | `npx eslint .` | **exit 0** | `D:\tmp\lint.log` |
| brand guard | `node scripts/brandNameGuard.cjs` | **OK — ตรวจ 422 ไฟล์** | `D:\tmp\brand.log` |
| unit/contract | `npx vitest run` | ดูก้อน §5 | `D:\tmp\vitest.log`, `D:\tmp\vitest2.log` |
| build | `npm run build` (tsc + vite) | **exit 0** | `D:\tmp\build.log` |
| SQL replay / production | ไม่ได้รันรอบนี้ | **UNVERIFIED รอบนี้** | ของรอบก่อน = `e2e/*.json` (§4) |
| CI ของ SHA ที่ push | ไม่มี `gh` ในเครื่อง | ดู §5.3/§9.4 | — |

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
| CAP-21 | ระบบจำลูกค้า/เจาะกลุ่มอัตโนมัติ (D11 ของ Owner) | ไม่มี UI | เดิม `customerIntelligence*` → ถูกลบใน C8 (2026-10-24) และ **ไม่มีของแทน** | ไม่มี test/โค้ด | **MISSING / DEFERRED** — ต้องถาม Owner ว่าทำต่อหรือปัดทิ้ง |
| CAP-22 | AI Studio + ตั้งเวลาโพสต์ | `/admin/marketing?tab=ai` + Calendar | RPC `marketing_schedule_post` (137/147) + `adminMarketing.ts` + `queue-enqueue` EF | `marketingClient` (asserts `rpc('marketing_schedule_post'`) | IMPLEMENTED (ตั้งเวลาเองได้) · **ส่วน "ให้ AI เลือกเวลา/โพสอัตโนมัติเต็มรูปแบบ" = DEFERRED** (Owner 2026-10-24) |

---

## 3. Engineering backlog (งานโค้ดที่ยังค้างจริง · ไม่รวมงาน Owner)

| # | งาน | เหตุผล/หลักฐาน | ลำดับ |
|---|---|---|---|
| B-1 | `orderTimeline.test.ts` **ไม่เสถียรตอนรันชุดใหญ่** — run 1 fail 4 เคส, รันตัวไฟล์เดียว 6/6 ผ่าน, run 2 ผ่านทั้งหมด | `D:\tmp\vitest.log` (fail) · `D:\tmp\ot.log` (pass) · `D:\tmp\vitest2.log` (exit 0) · อาการ = render ไม่ทัน `setTimeout(0)` flush (มี act warning) | P1 — ทำให้ deterministic โดย await commit จริง (**ห้ามลด assertion / ห้าม skip**) |
| B-2 | legacy contract 7 ตัว (017/018/019/020/021/022/029/033) นอก CI | คำสั่ง Owner "ไม่ซ่อม" — บันทึกเป็น known state ไม่ใช่ defect ที่ถูกซ่อน | P3 (ตามคำสั่ง) |
| B-3 | CAP-21 ระบบจำลูกค้าอัตโนมัติ | ถูกลบพร้อมของเดิม ไม่มีของแทน | P2 — รอ Owner ตัดสินใจ |
| B-4 | CAP-22 ระบบให้ AI เลือกเวลา/โพสอัตโนมัติเต็มรูปแบบ | RPC+Calendar มีแล้ว แต่ไม่มีระบบ auto-schedule | P2 — รอ Owner สั่ง |
| B-5 | ตรวจ runtime จริงของ CAP-10/11/13/14/18 | ต้องใช้ production/device/browser จริง | P1 (คู่กับ Owner acceptance) |

**ไม่มี blocker ฝั่ง engineering ที่ติด permission/สิทธิ์ production ในรอบนี้** — งานที่เหลือล้วนเป็น
งานที่ต้องใช้ environment จริง หรือการตัดสินใจของ Owner

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

| รัน | ผล |
|---|---|
| baseline `npx vitest run` (ก่อนแก้) | **144 files / 1517 tests / 0 fail / exit 0** (`D:\tmp\vitest.log` เวอร์ชันแรก) |
| `npx tsc --noEmit` | **exit 0** |
| `npx vitest run` (หลังแก้ · run 1) | 144 files · 1518 tests · **4 fail = ทั้งหมดใน `orderTimeline.test.ts`** · exit 1 |
| `npx vitest run src/__tests__/orderTimeline.test.ts` | **6/6 pass** (`D:\tmp\ot.log`) |
| `npx vitest run` (หลังแก้ · run 2) | **144 files / 1518 tests / 0 fail / exit 0** (`D:\tmp\vitest2.log`) |
| `npx eslint .` | **exit 0** |
| `node scripts/brandNameGuard.cjs` | **OK — 422 ไฟล์** |
| `npm run build` | **exit 0** |

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

## 7. Owner Production Acceptance checklist

(เหลือเฉพาะสิ่งที่ AI ทำแทนไม่ได้อย่างปลอดภัย — หน้า/อุปกรณ์/บัญชีภายนอก)

1. **hard refresh (Ctrl+Shift+R)** แล้วตรวจ `/shop` + `/menu`: หัวข้อ/แท็บไม่ซ้ำ, การ์ดไม่มีกรอบ,
   แถบสถานะ 2 เลน (เซมเดย์ไม่มีคัทออฟ · พรีออเดอร์โชว์รอบถัดไป + cutoff)
2. **สั่งจริง 2 โหมด** (เส้นทางใหม่): เพิ่มของจากหน้าแรก/หน้าเมนูทั้งสองโหมด → เข้าตะกร้า →
   checkout สร้างออเดอร์ได้ · กรณี addItem ถูกบล็อกต้องขึ้นข้อความเตือน **ไม่** โชว์ว่าเพิ่มสำเร็จ
3. `/admin/orders?mode=PRE_ORDER` + OrdersHub + ศูนย์ขนส่ง 5 แท็บ — เมนูซ้าย 5 กลุ่ม/19 รายการ
4. **R-16 = Print-to-PDF** ตาม runbook `docs/BMB_OWNER_PREP_R16_D6_MIGRATIONS_2026-10-25.md` §1
5. **acceptance §4 ของ Growth & Rewards** (promotions/referral/tiers/engagement)
6. ตรวจ **CI ของ SHA ล่าสุด** ใน GitHub Actions (เครื่อง AI ไม่มี `gh`)
7. ตรวจ runtime จริง CAP-10 (ตรวจสลิป) / CAP-11 (POD ไรเดอร์) / CAP-13 (push) / CAP-14 (SMS) / CAP-18 (Maps)
8. ตัดสินใจ CAP-21 (ระบบจำลูกค้าอัตโนมัติ) และ CAP-22 (auto-post ของ AI)
9. (ถ้าต้องการหลักฐานอัตโนมัติเต็มเส้นทาง) รัน `node e2e/runE2E.cjs` เอง — สร้าง user/order **จริง** บน Supabase
   production (ต้อง `BMB_E2E_SVC_KEY`) · AI ไม่รันแทนเพราะเป็น production write

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

### 9.5 E2E / route smoke ของรอบนี้

| รายการ | ผล |
|---|---|
| คำสั่ง | `npx playwright test routeNav` บน build จริง (`vite preview --port 5199` จาก `dist/` ที่ build ในรอบนี้) |
| ผล | **39 passed / 0 failed (46.3s) · `PW_EXIT=0`** · log = `D:\tmp\pw.log` |
| ครอบคลุม | public routes ทั้งหมด · protected (guest → `/login`) · redirect (`/ai-chat` → `/talk-to-bite`, `/profile/orders` → `/orders`, `/admin/pre-orders`, `/admin/dashboard`) · catch-all `/no-such-page-xyz` · ตรวจ console error "No routes matched location" |
| **ไม่ได้รัน** | `e2e/runE2E.cjs` (full order journey) — **จงใจไม่รัน**: สคริปต์นี้สร้าง user/order จริงบน Supabase production (ต้อง `BMB_E2E_SVC_KEY`) = **production write** ซึ่ง Owner directive ไม่อนุมัติให้ AI ทำเอง → อยู่ใน Owner acceptance §7 |
| ไม่ได้รัน | `e2e/g2rv.spec.ts` — ต้องการฐานข้อมูล/เซสชันทดสอบที่ไม่ได้เตรียมในรอบนี้ (= NOT RUN, ไม่ใช่ PASS) |