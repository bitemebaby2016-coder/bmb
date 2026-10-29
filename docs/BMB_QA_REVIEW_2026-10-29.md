# BMB — Senior QA / Code Review (2026-10-29 · R19)

> ตรวจทั้ง Frontend + Supabase + Edge Functions ตามคำสั่ง Owner · เก็บเป็น checklist ถาวร
> หลักฐาน = อ่านโค้ดจริง + probe นับจุดแดงทั้ง `src/` (ts/tsx ทั้งหมด) + CI จริงจาก GitHub Actions API
> ระดับ: ✅ = ผ่านมีหลักฐาน · ⚠️ = จุดเสี่ยง/ต้อง follow-up · 🔧 = แก้แล้วรอบนี้

---

## เฟส 1 — Auth / Database Connection (ความปลอดภัย + RLS)

| # | จุดตรวจ | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| 1.1 | service-role key รั่วใน bundle? | ✅ | `src/lib/supabase.ts` มีแค่ anon key (P0-1) — privileged = EF/RPC เท่านั้น |
| 1.2 | Session persist / refresh อัตโนมัติ? | ✅ | `autoRefreshToken+persistSession+detectSessionInUrl` ใน createClient |
| 1.3 | ลูป Login↔Dashboard ตอน token restore? | ✅ | `ProtectedRoute`/`AdminRoute` รอ `isInitializing` ก่อนตัดสิน (`App.tsx:103-151`) · redirect เก็บ `state.from` กลับหน้าเดิมหลัง login |
| 1.4 | AdminGate เช็คสิทธิ์จาก DB? | ✅ | `fetchProfileRole()` (profiles ผ่าน RLS · fallback `is_admin()` RPC) + `isAdminCapableRole` 11 บท (146) · มี `cancelled` flag กัน setState หลัง unmount |
| 1.5 | logout เด้งหน้า Login ถูก? | ✅ | `authStore.logout` clear store + `supabase.auth.signOut` · guard ใช้ `<Navigate replace>` |
| 1.6 | **มี listener กลาง `onAuthStateChange`?** | ⚠️ | **probe = 0 จุดใน `src/`** — session หมดอายุ/โดน signOut จากเครื่องอื่น mid-use → store ค้าง `isAuthenticated=true`, query โดน RLS ปฏิเสธแบบ **empty เงียบ** ไม่เด้ง /login → **งาน N3 (P1): subscribe กลาง** — `SIGNED_OUT` → clear + redirect `/login` (คง `from`) · `TOKEN_REFRESHED` → `refreshRole()` · `USER_UPDATED` → re-map customer |
| 1.7 | RLS/ACL มี gate รันจริง? | ✅ | Contract Tests (ephemeral PG): `033` anon set · `147` role matrix · `157` anon scoping · `164` business_settings — **CI คือ verifier ต้องเขียวทุก push** |
| 1.8 | Guest OTP = ไม่ใช่หลักฐานชำระเงิน? | ✅ | ข้อความในหน้า + `migrations 122` ระบุชัด · ไม่ให้สิทธิ์เข้าบัญชีอื่น |
| 1.9 | EF รับเงิน กันเรียกปลอม? | ✅ | `stripe-webhook`/`omise-webhook` verify signature (test `stripeWebhookSignature`) · ไม่ต้อง CORS (server-to-server) |

---

## เฟส 2 — Core Business Logic (ออเดอร์ · ตะกร้า · หลังบ้าน)

| # | จุดตรวจ | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| 2.1 | **Double submission กดเบิ้ล?** | ✅ | RPC `create_order_with_items_i` มี `p_client_submit_key` (124) — retry payload เดิมคืนออเดอร์เดิม (toast บอกเลขเดิม) · `SubmitKeyRing` · payment intent เดียวต่อออเดอร์ (`ensureReplaySafeIntent`) |
| 2.2 | ปุ่ม disable ตอนโหลด? | ✅ | `disabled={isProcessing \|\| !selectedRoundId}` · `gSending/gSubmitting/photoBusy` · รวม **15 จุด** ผูก busy-state กับ disabled |
| 2.3 | ราคา/คูปอง/ค่าส่ง = server authority? | ✅ | client DISPLAY ONLY — RPC ตีราคาใหม่ตอน INSERT · fee มี `feeUiState` กันโชว์ค่าเก่า + ปุ่ม "ลองคำนวณใหม่" |
| 2.4 | โหมดออเดอร์ (R5c) เพี้ยนได้ไหม? | ✅ | `deriveCartMode` = ผลจากบรรทัดตะกร้า · ไม่มี free-date pre-order · `?mode=` ไม่เปลี่ยนโหมด (test `checkoutModeLock`) |
| 2.5 | ร้านปิด = สั่งไม่ได้ทั้ง client+server? | ✅ | mirror `shopHoursGate` + `trg_shop_hours`/160 `ERR_STORE_CLOSED` |
| 2.6 | ลูปไรเดอร์ปิดเองได้? | ✅ | R13=166 (path sanitize+arrived+self-heal) · R14=167 (batch id/hop) · R16=168 (multi-job) — evidence `e2e/r1*-result.json` ทุกตัว |
| 2.7 | **Regression policy/storage path** | 🔧 แก้แล้ว | **CI แดง 10 รัน (#188–#197)** เพราะ 166 ไม่ decode `%XX` → `driver_path_folder('drv-%20…') ≠ ('drv- …')` → RLS บล็อก INSERT = contract 138-139 G7 · **แก้ = `migrations/169_pod_path_percent_encoding.sql`** |
| 2.8 | งานซ้ำเชิงโครงสร้าง (known) | ✅ ปิดแล้ว (R21e) | haversine 3 ฉบับ → **delegate ตัวเดียว** `deliveryRouter.haversineDistanceKm` · `confirmOfflinePayment` wrapper 2 → **delegate ตัวเดียว** `paymentGateway` · id จาก `to_char` → **migration 173 แก้ 3 function ที่ live จริง** (bigint::text pattern R14/167 · หลักฐาน production `e2e/r21eProdIdProbe.json`) |
| 2.9 | External providers (Grab/Lineman/Foodpanda) | ⚠️ | mock ทั้งหมด — รอ Owner ตัดสินใจ credentials หรือปิด module |

---

## เฟส 3 — UI/UX Edge Cases (ปุ่มซ้ำ · หน้าโหลด · แจ้งเตือน)

| # | จุดตรวจ | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| 3.1 | White screen of death? | ✅ | `ErrorBoundary` ครอบแอป → fallback ปุ่ม "ลองใหม่/รีเฟรช" + ดูรายละเอียด + `reportError` ส่ง feed แอดมิน (ADM-01) |
| 3.2 | alert() / console.log debug หลุด? | ✅ | probe = **alert 0 · console.log 0** (R17 ลบแล้ว) · `console.error` 179 = สาย error |
| 3.3 | XSS ผ่าน innerHTML? | ✅ | `dangerouslySetInnerHTML = 0` · `innerHTML` เฉพาะไฟล์เทสต์ |
| 3.4 | API ล่ม = toast หรือค้างเงียบ? | ✅ หลัก | path หลักมี try/catch + `showToast` + `describe*` แปลง error code เป็นคำสั่งไทย (order submit/login/guest OTP) |
| 3.5 | Loading/empty state? | ✅ พื้นฐาน | Suspense = มาสคอต "น้อง Bite กำลังจัดเตรียมของ…" · `isInitializing` spinner · empty: `no-rounds` / empty-cart redirect `/cart` / `preorder-requires-menu` — ⚠️ **Owner เช็ค empty state รายหน้า (Orders/Notifications/Admin) เป็น checklist** |
| 3.6 | interval รั่ว (ไม่ clearInterval)? | ✅ | probe: production `setInterval 15 = clear 15` ผูกคู่ครบ (ขาด 2 ตัว = ไฟล์เทสต์) · polling 20 วิ ตั้งใจ (R15) |
| 3.7 | empty catch เงียบ? | ⚠️ จงใจ | เหลือ 2 = `MascotWrapper` localStorage best-effort (มี comment) |
| 3.8 | `as any` / TODO | ⚠️ quality | `as any` 222 จุด (cleanup ทีละส่วนได้) · TODO 1 = `homeProviders` หมายเหตุ AI-CLEANUP |
| 3.9 | `location.reload` นอก ErrorBoundary? | ⚠️ minor | `PromotionsPage:124` จุดเดียว — แทนด้วย refetch รอบถัดไป |

---

## หมวด 4 — PWA / Offline / Storage

| # | จุดตรวจ | ผล | หมายเหตุ |
|---|---|---|---|
| 4.1 | SW เก่าค้างจนโค้ดใหม่ไม่ขึ้น? | ✅ แก้แล้ว (รอบ defect 2026-10-26) | `injectManifest` + **`skipWaiting`+`clients.claim`** · `registerType: 'autoUpdate'` |
| 4.2 | Cache busting static? | ✅ | Vite hash ในชื่อไฟล์ + precache js/css/html/img/font ≤3MB · **กติกา: hard reload 1 ครั้งหลัง deploy** |
| 4.3 | Web push handler ครบ? | ✅ | เขียน `src/sw.ts` เอง มี `push`/`notificationclick` |
| 4.4 | Responsive/คีย์บอร์ดมือถือ? | ⚠️ Owner checklist | จุดเสี่ยง = หน้าเช็คเอาท์ (การ์ดยาว + ปุ่มท้ายฟอร์ม) · RiderPWA (โหมดถุงมือ) — เทสต์บนมือถือจริงรอบ retest |

---

## หมวด 5 — Edge Functions / API Integration

| # | จุดตรวจ | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| 5.1 | CORS ครบ? | ✅ | **19/19 EF ที่เรียกจากเบราว์เซอร์มี `Access-Control-Allow-Origin: *`** (probe) · 2 ตัวที่ไม่มี = `stripe-webhook`/`omise-webhook` (server-to-server) |
| 5.2 | Response ค่าว่าง/รูปแบบเพี้ยน? | ✅ หลัก | null-guard รอบด้าน (เช่น `branch?.branch_id ?? null`) · fee มี state `error` + retry |
| 5.3 | Timeouts? | ✅ | `aiChatTimeout` test · raw fetch ส่วนใหญ่มี error path |
| 5.4 | Raw `fetch()` 8 จุด | ⚠️ | `googleMaps.ts` ×5 = **API key ฝั่ง client → จำกัดด้วย HTTP referrer ใน Google Cloud** (แจ้ง Owner) · `aiService/aiVoice/locationLogin` = มี try/catch |
| 5.5 | CORS `*` อันตรายไหม? | ✅ เงื่อนไข | ปลอดภัยต่อเมื่อ **`verify_jwt = on` คงเดิมทุกตัว** — ห้ามปิดโดยไม่อ่าน policy |

---

## สรุปสิ่งที่แก้/สั่งต่อ (เรียง P)

1. **🔧 แก้แล้วรอบนี้:** migration **169** (CI contract 138-139 %XX regression จาก 166) + copy หน้าเช็คเอาท์ 7 จุด (ตามคำสั่ง Owner)
2. **N3 (P1):** เพิ่ม `onAuthStateChange` global sync (1.6) — ปิดอาการ "session หมดอายุแล้วหน้าค้างสถานะเก่า"
3. **P1:** จำกัด Google Maps API key ด้วย referrer (5.4)
4. ~~**P2 (cosmetic เดิม):** รวม haversine · confirmOfflinePayment wrappers · to_char ids~~ → **ทำแล้วทั้งหมด (รอบ R21e — ดู §ท้ายสุด)**
5. **Owner checklist:** empty state รายหน้า (3.5) · responsive มือถือ (4.4)

*จัดทำ 2026-10-29 (R19) · probe รันจริงบน src ทั้งหมด · ไม่มีข้อความไหนเขียนโดยไม่ได้ตรวจโค้ด*

---

# รอบ R21 (2026-10-29) — re-check ตามคำสั่ง Owner รอบ 2 (ไล่ทีละเฟส) + สิ่งที่แก้แล้ว

> ระดับเดิม: ✅ = ผ่านมีหลักฐาน · ⚠️ = จุดเสี่ยงต้อง follow-up · 🔧 = แก้แล้วรอบนี้

## เฟส 1 — Auth / Database Connection (ตรวจซ้ำหลัง N3)

| # | จุดตรวจ | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| A1 | **`AdminRoute` เตะออกเมื่อเน็ตขัดข้อง** | ⚠️ P1 | `fetchProfileRole()` คืน `null` ทั้งตอน "ไม่มีบทบาท" และตอน query fail (`authStore.ts:92-109` กลืน error) → `App.tsx:151` `<Navigate to="/" />` = admin จริงหลุดกลางคัน · **แก้ = คืน 3 สถานะ ok/error/denied** |
| A2 | `AdminRoute` ไม่ส่ง `state.from` | ⚠️ P1 | `App.tsx:148` — ต่างจาก `ProtectedRoute` → deep-link `/admin/orders?tab=x` ถูกเด้ง login แล้วหาย · **แก้ = ส่ง `state.from` เหมือน ProtectedRoute** |
| A3 | LoginPage บังคับ admin ไป `/admin` เสมอ | ⚠️ P1 | `LoginPage.tsx:112` เพิกเฉย `returnTo` (ขัด case B/D) · **แก้ = `returnTo` มาก่อนเสมอ** |
| A4 | `logout()` ไม่มี try/catch | ⚠️ P1 | `authStore.ts:243-246` + `Header.tsx:41-42` fire-and-forget → `signOut()` reject = ค้างสถานะล็อกอิน + unhandled rejection · **แก้ = `try/finally` ล้าง store เสมอ** |
| A5 | `login/loginByPhone/loginByLocation/refreshRole` ไม่มี try/catch | ⚠️ P2 | `refreshRole()` ถูก `void` ทุกจุด → rejection ลอยตอนเน็ตหลุด |
| A6 | `AdminRoute` ยิง query ทุกเปลี่ยนหน้า admin | ⚠️ P2 | mount ต่อ route = 1-2 roundtrip + spinner กระพริบ · **แก้ = ใช้ role จาก store ก่อน แล้ว refresh background** |
| A7 | fallback `is_admin()` map `true → 'admin'` | ⚠️ P2 | `authStore.ts:103-104` บทจริง owner/manager ถูกแปลงเป็น `'admin'` · **แก้ = rpc คืนชื่อบทบาทจริง** |
| A8 | `isAdmin()` ใน `supabase.ts` = dead code | ⚠️ P3 | ไม่มี caller + `.single()` ไม่เช็ค error → ลบหรือแก้ `maybeSingle()` |
| A9 | listener กลาง `onAuthStateChange` (N3) | 🔧 แล้ว | R20 ติดแล้ว — เหลือ Owner retest |
| A10 | RLS/`SET search_path`/EF verify_jwt | ✅ | RLS เปิดครบ (`001:490-507` + `005`) · `SECURITY DEFINER` ของ 007/025/027 มี `SET search_path = public` ทุกตัว · `phone-auto-login` = `verify_jwt=false` แต่บังคับ OTP · `queue-enqueue` = `verify_jwt=true` |
| A11 | double-submit หน้า login | ✅ | `disabled={isLoading/isSendingOtp/isSendingReset}` ทุกปุ่ม (`LoginPage:366,418,466,505,513,556,615`) |

## เฟส 2 — Core Business Logic (ทำตามคำสั่ง Owner ทั้ง 3 ข้อ + ระบบพิมพ์)

| # | งาน | ผล | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| B1 | **ตารางต้นทุนสินค้า** | 🔧 | migration **170 APPLIED** (ledger 170 · evidence `e2e/r21Apply170-result.json` ALL_PASS): `cogs`/`packaging_cost`/`other_unit_cost` (NUMERIC >=0 + CHECK) + `unit_cost` GENERATED · grant ไม่เปลี่ยน |
| B2 | **Helper Gross Margin / Net Profit** | 🔧 | `src/lib/marginCalc.ts` = `computeMargin` (ต่อหน่วย) + `computeOrderProfit` (ทั้งออเดอร์ · gross/net/extraCost) + tier 4 ระดับ + formatters · แผงกำไร **real-time** ในฟอร์ม `AdminProducts` (`data-testid=product-margin-panel`) · test `marginCalc.test.ts` 13 ข้อ |
| B3 | **Guardrail ส่วนลด 15% ในตะกร้า** | 🔧 | `src/lib/discountGuardrail.ts` = คูปอง+แต้ม+referral ≤15% ของยอดสินค้า (sanitize NaN/ลบ · `ZERO_SUBTOTAL` case) · `CheckoutPage` โชว์ `data-testid=discount-guardrail` + **บล็อกปุ่มสั่งซื้อ** · test `discountGuardrail.test.ts` 10 ข้อ |
| B4 | **server-side cap 15%** | ⚠️ งานต่อ (P2) | ตอนนี้ client guard อย่างเดียว — RPC `create_order_with_items_i` ยัง re-price ตาม promo เดิม (ไม่แตะเพื่อไม่เสี่ยง contract) |
| B5 | **ระบบพิมพ์ใบสั่งเข้าครัว — เลือก/เพิ่มเครื่องเอง** | 🔧 | registry ใน `business_settings.print_settings` (แอดมินเพิ่ม/ลบ/ผูกใบเสร็จ+ใบสั่งครัว · preset Nimbot B1Pro 50 มม.) — pure helpers ทั้งหมดใน `printService.ts` · `AdminPrintSettings` มีตาราง + ทดสอบรายเครื่อง · test `printerRegistry.test.ts` 11 ข้อ |
| B6 | **พิมพ์อัตโนมัติจากเทมเพลตเดิม** | 🔧 | `AdminOrders.handleAcceptOrder` → `autoPrintKitchenTicket()` (ใช้ `buildKitchenTicketHtml` เดิม · เคารพ `autoPrintKitchen` · พังไม่กระทบออเดอร์) |
| B7 | **แอดมินสั่งพิมพ์เองต่อออเดอร์** | 🔧 | ปุ่ม `🧾 พิมพ์ใบเสร็จ` / `🍜 พิมพ์ใบสั่งครัว` → `printOrderTicket()` = enqueue idempotent → render → mark `sent`/`failed` |
| B8 | ความซื่อสัตย์เรื่อง "พิมพ์สำเร็จ" | ⚠️ ข้อจำกัด | เบราว์เซอร์ยังเป็นคนเลือกเครื่องจริง (`window.print`) → ต้องตั้ง Nimbot เป็น default printer ของ Windows หรือเลือกในไดอะล็อก · ระบบ**ไม่เคย**อ้างว่าพิมพ์สำเร็จจนกว่าจะได้ยืนยัน (ตรรกะเดิมคงไว้) |
| B9 | งานเดิมที่ทราบอยู่แล้ว (known) | ✅ ปิดแล้ว (R21e) | haversine รวมเหลือตัวเดียว (canonical `deliveryRouter`) · `confirmOfflinePayment` เหลือตัวเดียว (canonical `paymentGateway`) · to_char ids = **m173** แก้ ord-/osh-/notif- (หลักฐานก่อนแก้ = id `ord- ###########-xxxxxx` จริงใน production) |

## เฟส 3 / 4 — ยังไม่ได้ทำรอบนี้

| # | หัวข้อ | สถานะ |
|---|---|---|
| C1 | UI/UX edge cases (loading/empty/ข้อความแจ้งเตือน) รอบใหม่ | ⏳ เฟสถัดไป |
| C2 | PWA cache/service worker + responsive มือถือ รอบใหม่ | ⏳ เฟสถัดไป |
| C3 | 4 คำสั่งเดิมของ Owner (หน้าครัวจากแจ้งเตือน · เซมเดย์ส่งทันที+ตัดสต็อกรวม · ตรวจสลิปก่อน/พร้อมรับ · เด้ง `/admin/delivery` แท็บจัดส่ง) | ⏳ ค้างอยู่ในแฮนด์ออฟ (ยังไม่ได้ทำ) |

*gates รอบ R21: tsc 0 · lint 0 · vitest 167 files / 1,724 tests / 0 fail · build 0 · migration 170 APPLIED*

---

# รอบ R21 · เฟส 3 — UI/UX edge cases (loading / empty / error / double-submit)

> หลักการเดียวกับ Owner: **"ระบบล้มเหลวต้องบอกผู้ใช้"** — ห้ามปล่อยหน้าเงียบจนผู้ใช้เข้าใจผิดว่า "ไม่มีข้อมูล"

## แก้แล้ว (6 หน้า · มี banner + ปุ่มลองใหม่ refetch จริง)

| หน้า | ปัญหาเดิม (probe จริง) | สิ่งที่แก้ |
|---|---|---|
| `HomePage` | `loadData()` catch มีแค่ `console.error` → เน็ตหลุด = โชว์เหมือน "ไม่มีสินค้าเลย" | `loadError` + banner `data-testid=home-load-error` + ลองใหม่ด้วย `reloadKey` (ไม่ใช่ `location.reload`) |
| `MenuPage` | เหมือนกัน — หน้าเมนูเปล่าเงียบ ๆ | banner `menu-load-error` + `reloadKey` |
| `OrdersPage` | catch มีแค่ `console.error` → **"ยังไม่มีออเดอร์" ปลอม** | banner `orders-load-error` · **ซ่อนข้อความ empty ระหว่าง error** (`!loadError`) |
| `NotificationCenterPage` | **ไม่มี try/catch เลย** → ถ้า `getMyNotifications()` throw = ค้าง "กำลังโหลด…" ไม่จบสักที | try/catch/**finally** + banner `notif-load-error` + `reloadKey` |
| `AdminKitchen` | catch เฉย ๆ → summary = 0 เหมือนไม่มีงาน | banner `kitchen-load-error` + ลองใหม่ |
| `AdminProducts` | catch เฉย ๆ → หน้าเมนูเปล่าเหมือนไม่มีเมนู | banner `products-load-error` + `loadAll()` ซ้ำ |

- ตัวประกอบกลางตัวเดียว: **`src/components/ui/LoadErrorBanner.tsx`** (`role="alert"` + ปุ่ม 🔄 + optional action) — ใช้ร่วมกับหน้าอื่นในรอบถัดไป
- test **`src/__tests__/loadErrorBanner.test.ts` (5 ข้อ)** — render/click/testId/secondary/empty message

## ตรวจแล้วผ่าน (มี loading + empty + error ครบอยู่แล้ว)

| หน้า | หลักฐาน |
|---|---|
| `AdminOrders` | `loadError` + banner ตั้งแต่รอบก่อน (`AdminOrders.tsx:70`) · cancel กดซ้ำ = `if (cancelling) return` + `disabled` |
| `PaymentConfirmationPage` | `loadError` + `retrying` guard + `retry-payment` button |
| `RouteOptimizationPage` | `loadError` + banner |
| `RiderPwaPage` | `loadError` + `rider-retry-*` ทุก action |
| `RewardsPage` | `catalog-empty` + toast "แต้มไม่พอ" |
| `PromotionsPage` | ปุ่มลองใหม่ = refetch (R20 เปลี่ยนจาก `location.reload` แล้ว) |
| `NotificationCenterPage` (push) | toggle `disabled={pushBusy || !pushSupported || !pushServerEnabled}` + ข้อความไทย 4 กรณี |
| `CheckoutPage` | submit key ring 124 (กัน double-submit) + `disabled={isProcessing || ...}` |

## ยังไม่ได้แก้ — backlog เฟสถัดไป (probe เจอ `console.error` เฉย ๆ ไม่มี UI ฟ้อง) → **ทำแล้วทั้ง 12 หน้าในรอบ R21d (ดู §ล่างสุด)**

`DeliveryManagement` · `AdminRounds` · `InventoryPage` · `AuditLogPage` · `AdminPaymentExceptions` · `AdminRecipes` · `AdminBrands` · `AdminAssetAudit` · `AdminPortfolio` · `AdminTenants` · `VotePage` · `ReviewPage` — ใช้แพตเทิร์น `LoadErrorBanner` เดิมได้ทันที (หน้าละ ~4 จุด)

**gates เฟส 3:** tsc 0 · lint 0 (`e2e/gates_r21b_lint.log`) · **vitest 168 files / 1,729 tests / 0 fail** (`e2e/gates_r21b_vitest.log` · รันเดี่ยว) · build 0 (`e2e/gates_r21b_build.log`)

---

# รอบ R21 · เฟส 1 แก้ครบ + เฟส 4 (PWA/EF/responsive) + 4 คำสั่ง Owner (2026-10-29 · เฟสเดียวกันรอบสอง)

## เฟส 1 — A1-A8 แก้ในโค้ดแล้วทั้งหมด (ตารางด้านบน = ผลตรวจก่อนแก้)

| # | สถานะ | สิ่งที่ทำ | หลักฐาน |
|---|---|---|---|
| A1 | 🔧 แก้แล้ว | `probeProfileRole()` คืน **3 สถานะ** (`ok+role` / `ok+null` / `error`) · AdminRoute: probe error + ไม่มี role เก่า → **banner ลองใหม่** ไม่ใช่ `<Navigate to="/">` | `authStore.ts` · `App.tsx` `admin-route-role-error` · `authProbeRoles.test.ts` |
| A2 | 🔧 แก้แล้ว | AdminRoute ส่ง `state={{ from: pathname+search }}` เหมือน ProtectedRoute | `App.tsx` · test |
| A3 | 🔧 แก้แล้ว | `navigate(returnTo \|\| (role === 'admin' ? '/admin' : '/'))` — returnTo มาก่อนเสมอ | `LoginPage.tsx:114` · test |
| A4 | 🔧 แก้แล้ว | `logout()` = try/**finally** ล้าง store เสมอแม้ `signOut()` reject | `authStore.ts` · test (signOut throw → store ล้าง) |
| A5 | 🔧 แก้แล้ว | `login`/`loginByPhone`/`loginByLocation` try/catch คืน false/error สงบ · `refreshRole` error → **คง role เดิม** + ห้าม reject | `authStore.ts` · test |
| A6 | 🔧 แก้แล้ว | AdminRoute: store มี role → **เข้าหน้าทันที** + probe background (ไม่กระพริบ spinner) | `App.tsx` `if (!probeDone && !role)` |
| A7 | 🔧 แก้แล้ว | **migration 171 `my_role()`** (SECURITY DEFINER · search_path pinned · ปิด anon) คืนชื่อบทบาทจริง · `is_admin` boolean เหลือแค่ fallback สุดท้าย | `171_my_role_rpc.sql` · **APPLIED production แล้ว** (`e2e/r21cApply171-result.json` ALL_PASS · ledger top=171) |
| A8 | 🔧 แก้แล้ว | ลบ `isAdmin()` dead code ออกจาก `supabase.ts` (มีแค่ mock ใน tests) | `supabase.ts` |

**test ใหม่:** `src/__tests__/authProbeRoles.test.ts` (10 ข้อ — 3 สถานะ probe · logout finally · refreshRole คง role · source contracts A2/A3/A6)

## เฟส 4 — PWA / Edge Functions / responsive (audit + แก้จริง)

### PWA ✓ ทำงานครบอยู่แล้ว (audit ยืนยันจาก dist จริง)
- `vite-plugin-pwa` strategies=**injectManifest** + **`src/sw.ts` เขียนเอง** (W3-D-7): precache + NavigationRoute (deep-link offline) + `push`/`notificationclick`/`pushsubscriptionchange` + skipWaiting/clientsClaim (OWNER FIX 2026-10-26)
- `dist/` build วันนี้มี `sw.js` + `registerSW.js` + `manifest.webmanifest` + `<link rel=manifest>` + register script ✓
- **แก้:** ลบ `public/manifest.json` เก่าซ้ำ (dist เคย ship **2 manifests** — อันเก่าใน public/ มี icon แค่ favicon.svg ไม่อ้าง pwa-192/512)

### Edge Functions — CORS/OPTIONS matrix (source + **live probe production**)
| EF | OPTIONS+CORS | หมายเหตุ |
|---|---|---|
| ai-proxy · otp-send · guest-checkout-session · phone-auto-login · create-checkout · omise-checkout · voice-tts | ✓ ครบ | ตอบ CORS headers ทุกเมธอด |
| **image-gen** | ❌→🔧 **deploy แล้ว** | เดิมตอบ `200 "ok"` **เปล่า ๆ ไม่มีหัว CORS** (probe ก่อนแก้ = ไม่มี Access-Control-* เลย) → browser preflight จาก biteme-baby.com ล้ม (AdminMarketing invoke) · แก้ + **deploy production** · **probe หลังแก้: ACAO * + allow-headers + allow-methods ✓** |
| **queue-enqueue** · **push-send** | ❌→🔧 **deploy แล้ว** | เหมือนกัน (server-to-server ไม่กระทบตอนนี้ — กันหลุดเมื่อเปิดให้ browser เรียก) |
| workers/webhooks/sms/stripe/omise (server-only) | n/a | ไม่ต้อง CORS |

- evidence: `e2e/efOptions-image-gen.txt` (ก่อน) · `e2e/efOptions-image-gen-after.txt` (หลัง) · deploy ผ่าน `e2e/r21cDeployImageGen.cjs <fn>`

### Responsive (source-level audit)
- viewport meta ✓ `width=device-width, initial-scale=1.0` (`index.html:6`)
- safe-area มือถือ = BottomNav (`--bmb-bottom-nav-h` + `env(safe-area-inset)` ใน `index.css`) ✓ · ไม่พบ fixed-width ที่ทำให้แนวนอนล้นในหน้าหลัก
- **ข้อจำกัด:** ตรวจนี้เป็น static audit — ยังไม่มีการเปิดจริงบนมือถือ (Owner retest ด้วย iPhone/Android จริง)

## 4 คำสั่ง Owner — ทำแล้ว (รอบนี้)

| # | คำสั่ง | สิ่งที่ทำ | หลักฐาน |
|---|---|---|---|
| 1 | แจ้งเตือน → หน้าครัว | ทีมครัว (`role=kitchen`) กดแจ้งเตือน **ออเดอร์ใหม่/ยืนยันแล้ว** (`ORDER_CREATED/PLACED/CONFIRMED/PAYMENT_CONFIRMED`) → **`/admin/kitchen` ทันที** (งาน preparing/ready เดิมก็ไปครัวอยู่แล้ว) · role อื่นยังเป็น `/admin/orders` ตามเดิม | `notificationLinks.ts` · `notificationLinks.test.ts` (13 ข้อ) |
| 2 | สต็อกรวมทุก round | เริ่มทำครัว (`preparing`) = **`deduct_inventory_for_order` RPC เดียว** — SAME_DAY (ส่งทันที) + PRE_ORDER ทุก round ตัดจากกองวัตถุดิบเดียวกัน · ยกเลิกออเดอร์ = `cancel_order` คืนสต็อกอัตโนมัติ (มีอยู่แล้ว atomic) · ตัดไม่สำเร็จ = toast แดงชัด | `AdminKitchen.tsx` `deductInventoryForOrder` |
| 3 | ตรวจสลิปก่อนรับออเดอร์ | กด "รับออเดอร์" ที่ออเดอร์เงินโอนค้างตรวจ (`payment_status=pending` + มี `slip_path`) → **เปิดประตูตรวจสลิป** (modal): โชว์ **รูปสลิปจริง (SlipThumb)** + เหตุผลที่ server จะปฏิเสธ (`paymentConfirmability`) → ปุ่ม **"✅ ยืนยันสลิป & รับออเดอร์"** = `confirm_offline_payment` ตัวเดิม → แล้วค่อย accept · ปุ่ม disabled ถ้า confirmable=false · ไม่มีการ UPDATE เงินจาก client | `AdminOrders.tsx` `slipGate` / `slip-gate-modal` / `handleSlipGateConfirm` |
| 4 | เด้งไปหน้าจัดส่งหลังส่งครัว | ครัวกด "พร้อมส่ง" → **`navigate('/admin/delivery?focus=<เลข>')`** (ไฮไลต์แถวออเดอร์นั้นทันที) · แจ้งเตือนสถานะจัดส่ง → `/admin/delivery?focus=` (R13 เดิม) · AdminOrders มีปุ่ม `🛵 ไป Dispatch` | `AdminKitchen.tsx` |

**gates รอบนี้:** tsc 0 · lint 0 (462 ไฟล์ / languageSanity 1,284) · **vitest 169 files / 1,740 tests / 0 fail** (`gates_r21b_vitest.log`) · build = `gates_r21b_build.log`

## ยังคงค้างรอบถัดไป (บันทึก — ไม่ประกาศว่าปิด loop)

1. ~~backlog 12 หน้า LoadErrorBanner~~ → **ทำแล้วทั้งหมด (รอบ R21d — ดู §ท้ายสุด)**
2. server-side cap ส่วนลด 15% (P2) · cosmetic (to_char ids · haversine dup · confirmOfflinePayment wrappers)
3. retests B2 / C7 / C8 / RL-DEFECT / Part 5-7 (ต้อง E2E/Owner จริง) · responsive มือถือจริง · retest Auth/RLS A1-A8 บน production (login จริง · เน็ตหลุดจริง · my_role ของ owner/manager)

---

# รอบ R21d — backlog 12 หน้า LoadErrorBanner ทำหมดแล้ว (2026-10-29)

หลักการเดิม: **โหลดล้มเหลวต้องฟ้อง + ปุ่มลองใหม่ refetch จริง + ห้ามโชว์ข้อความ empty ปลอม**

| หน้า | testId | ข้อความปลอมที่ถูกปิด (`!loadError`) |
|---|---|---|
| `DeliveryManagement` | `dispatch-load-error` | "ไม่มีออเดอร์รอ dispatch" (เฉพาะโหลดแรก — silent refresh ล้มเหลวไม่ปล่อย banner ทับข้อมูลเดิม) |
| `AdminRounds` | `rounds-load-error` | "ยังไม่มีรอบที่เก็บไว้" (เดิมมีแค่ toast) |
| `InventoryPage` | `inventory-load-error` | "ยังไม่มีวัตถุดิบ" |
| `AuditLogPage` | `audit-load-error` | "ยังไม่มีบันทึก" (query error → return เงียบ) |
| `AdminPaymentExceptions` | `payexc-load-error` | "ไม่มี payment ที่ต้องเฝ้าดู" |
| `AdminRecipes` | `recipes-load-error` | "ยังไม่มี Recipe ในระบบ" |
| `AdminBrands` | `brands-load-error` | "No brands found." (bRes.error → return เงียบ) |
| `AdminAssetAudit` | `asset-load-error` | "สินค้าทุกตัวมีรูปครบแล้ว" |
| `AdminPortfolio` | `portfolio-load-error` | หน้าเปล่า (catch เฉย ๆ) |
| `AdminTenants` | `tenants-load-error` | "No tenants found." |
| `VotePage` | `vote-load-error` | หน้าโหวตว่างเปล่า |
| `ReviewPage` | `review-load-error` | "No reviews yet." |

- ทุกหน้า: `import LoadErrorBanner` + `loadError` state + `setLoadError('')` ตอนเริ่มโหลด + ข้อความไทยใน catch/query-error + banner ปุ่ม 🔄 (หน้าที่โหลดผ่าน effect ใช้ `retryKey`, หน้าที่มี `load/loadAll/loadInventory` เรียกตรง ๆ)
- ตรวจแล้ว: source-contract tests ของ 4 หน้าหลัก (DeliveryManagement/VotePage/ReviewPage/AdminRounds) ผ่านครบ · probe script = `e2e/r21dProbe.cjs`

---

# รอบ R21e — P2 server cap + cosmetic ปิดหมด (2026-10-29 · Owner "ทำงานที่ค้างให้หมด")

| รายการ | ผล | หลักฐาน |
|---|---|---|
| **server cap ส่วนลด 15% (P2)** | ✅ **m172 APPLIED production** — `promotion_apply_rules` (จุดตัดสินส่วนลดที่เดียวของ `create_order_with_items`) เพิ่ม (4c) `LEAST(v_disc, ROUND(v_sub*0.15,2))` · contract 153+154 อัปเดตตามกติกาใหม่ (G2 GRUSE 20→15 · G5/G8 50→22.5 · 154 G6 คูปอง referral 30→15 บนยอด 100) | **`r21eApply172-result.json` ALL_PASS · probe `has_cap=true`** · Contract #214 + CI #640 ✓ · client guardrail = `discountGuardrail.ts` (บล็อกปุ่ม) |
| **to_char ids ~40 จุด** | ✅ **m173 APPLIED production** — แก้ **3 function ที่ live จริง** (ที่เหลือ ~37 จุด = body ประวัติที่ถูก CREATE OR REPLACE ทับแล้ว ไม่มีตัวตนใน DB) · fix = `((extract(epoch…)*1000)::bigint)::text` (pattern R14/167 พิสูจน์แล้ว) | **`r21eApply173-result.json` ALL_PASS (3 fn = bigint · mask เก่าหมด · ledger top=173)** · **หลักฐาน production ก่อนแก้** (`e2e/r21eProdIdProbe.json`): `orders.id = 'ord- ###########-a04759'` (mask 11 หลักล้น → `#` + space นำ) · `order_status_history.id = 'osh-  1793…'` (mask 14 หลัก → space นำ) · generator = `e2e/r21eGen173.cjs` (extract VERBATIM กันพิมพ์เพี้ยน) · แถวเก่าปล่อยเป็นประวัติ |
| **haversine หลายฉบับ** | ✅ canonical เดียว = `deliveryRouter.haversineDistanceKm` · `googleMaps.haversineDistanceSimple` + `routeOptimization.calculateDistance` = delegate (ชื่อ/พารามิเตอร์เดิมคงไว้ — ไม่แตะผู้เรียก ~15 จุด) | targeted tests deliveryRouter/routeRealData ผ่าน |
| **confirmOfflinePayment wrapper 2** | ✅ canonical = `paymentGateway.confirmOfflinePayment` (คืน `PaymentConfirmResult`) · `bmbAdminApi_orders.confirmOfflinePayment` = delegate (คง `{success,error?}` ให้ AdminOrders) | paymentStateMachine/adminOrdersModeFilter/adminPreOrdersConsolidation ผ่าน |

- **ข้อจำกัดโดยเจตนา (ตามกฏ repo):** ห้ามแก้ migration ที่ apply แล้ว → แก้ด้วย CREATE OR REPLACE ในไฟล์ใหม่ (172/173) เท่านั้น · แถว id เก่าใน DB ปล่อยเป็นประวัติ (id ใหม่เท่านั้นที่ clean)
- เอกสาร: **TEST_PACK §M** (ขั้นตรวจ M1-M12 ของทุกสิ่งที่ทำรอบ R21) · MASTER_STATUS §1.3 · AI_WORK_STATE · แฮนออฟ

---

# รอบ R21f — 5 คำสั่ง Owner (2026-10-29)

| คำสั่ง | ผล | หลักฐาน/รายละเอียด |
|---|---|---|
| **มิเกรชั่นที่ยังไม่ได้ apply** | ✅ **ไม่มีค้าง** — parity สมบูรณ์ **local 173 = ledger 173** (ขาด/เกิน 0 ทั้งสองทาง) · `PROPOSED_*` 3 ไฟล์ = **ถูกแทนที่โดย design** (wave1 = SUPERSEDED ไม่จำเป็น · wave2 → m151 · wave5 → m150 — ทั้งคู่ apply แล้ว) → probe = `e2e/r21fSchemaProbe.json` + `e2e/r21fMigParity.cjs` | CI ก็ apply ครบทุกไฟล์ทุกรอบ (contract green) |
| **หน้าลูกค้า: แผนที่ตำแหน่งไรเดอร์** | ✅ **m174 `order_rider_position`** (SECURITY DEFINER · เฉพาะเจ้าของออเดอร์/admin · anon = null) + `riderPositionApi.ts` + การ์ด **🛵 ตำแหน่งไรเดอร์ ใน `/track/:orderNumber`** ระหว่าง `dispatched/in_transit/arrived` (poll 12 วิ · reuse `RiderMiniMap`) | คอลัมน์จริง probe ก่อนเขียน RPC (`r21fSchemaProbe.json`) · privacy: ไม่ enumerate |
| **ไรเดอร์: แผนที่นำทางทุกจุด** | ✅ ปุ่ม **🧭 นำทางรายจุด** ในรายการเส้นทาง (googleMapsDirUrl origin→จุดเดียว · ฟรีไม่ใช้ key) + ปุ่ม **🧭 เปิดนำทางไปจุดส่งนี้** ในการ์ดงานกำลังส่ง | การ์ดเส้นทางเดิมมีลิงก์รวม+แผนที่+polyline อยู่แล้ว (R16) — เพิ่มรายจุดครบทุกจุด |
| **สูตรอาหารครบทุกเมนู + เพิ่มใหม่ได้** | ✅ dropdown วัตถุดิบ = **`getInventory()` ทั้งคลัง** (เดิม derive จาก recipes = เลือกไม่ได้ถ้าไม่มีสูตรเดิม) · การ์ด **📋 เมนูที่ยังไม่มีสูตร** (products สดทุกโหลด → สินค้าใหม่โผล่เอง) กด + เติมฟอร์มได้ · แก้ typo "สตรอาหาร/ปริมา" | |
| **เวลาเปิด/ปิดหน้าแรกไม่ตรงที่แอดมินตั้ง** | ✅ **root cause = dead UI**: การ์ด "🏬 Branch (รัศมี + เวลาสาขา)" เขียนแค่ `branches.operating_hours` — **ไม่มีที่ไหนอ่าน** (หน้าแรก/เช็คเอาท์/mascot อ่าน `business_settings.hours`) → `saveBranch()` **mirror ไป `business_settings.hours`** + validate HH:MM + toast ยืนยัน + label อธิบาย | mirror = "1 เรื่อง = 1 ที่ = ทางบันทึกเดียว" (กติกา audit D-02) · parse = `parseHHMM` ตัวเดียวกับที่ logic ใช้ |