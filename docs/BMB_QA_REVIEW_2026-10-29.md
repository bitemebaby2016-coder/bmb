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
| 2.8 | งานซ้ำเชิงโครงสร้าง (known) | ⚠️ | haversine 2 ฉบับ · `confirmOfflinePayment` wrapper 2 · id จาก `to_char` ~40 จุด = cosmetic ค้างเดิม |
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
4. **P2 (cosmetic เดิม):** รวม haversine · confirmOfflinePayment wrappers · to_char ids
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
| B9 | งานเดิมที่ทราบอยู่แล้ว (known) | ⚠️ | haversine 2 ฉบับ · `confirmOfflinePayment` wrapper 2 · id จาก `to_char` ~40 จุด = cosmetic |

## เฟส 3 / 4 — ยังไม่ได้ทำรอบนี้

| # | หัวข้อ | สถานะ |
|---|---|---|
| C1 | UI/UX edge cases (loading/empty/ข้อความแจ้งเตือน) รอบใหม่ | ⏳ เฟสถัดไป |
| C2 | PWA cache/service worker + responsive มือถือ รอบใหม่ | ⏳ เฟสถัดไป |
| C3 | 4 คำสั่งเดิมของ Owner (หน้าครัวจากแจ้งเตือน · เซมเดย์ส่งทันที+ตัดสต็อกรวม · ตรวจสลิปก่อน/พร้อมรับ · เด้ง `/admin/delivery` แท็บจัดส่ง) | ⏳ ค้างอยู่ในแฮนด์ออฟ (ยังไม่ได้ทำ) |

*gates รอบ R21: tsc 0 · lint 0 · vitest 167 files / 1,724 tests / 0 fail · build 0 · migration 170 APPLIED*