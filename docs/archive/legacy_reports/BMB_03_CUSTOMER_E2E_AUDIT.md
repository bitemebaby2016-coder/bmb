# BMB_03_CUSTOMER_E2E_AUDIT.md
**Phase 3 — Customer E2E / Real User Audit (BLACK-BOX FIRST)**
**Audit date:** 2026-09-27 · **Production:** https://bitemebaby-5f7.pages.dev
**Method:** Playwright headless browse บน production จริง (read-only: browse/cart-localStorage เท่านั้น — ไม่สร้าง order จริง ไม่จ่ายเงิน ไม่แตะ DB ฝั่งเขียน) + correlation กับ Phase 2 evidence
**Raw evidence:** `e2e/prod-phase3-e2e.json` + screenshots `e2e/p3-*.png` · script `e2e/prodAuditPhase3.cjs`

## 1. Test Environment

- Browser: Chromium headless (Playwright) · Desktop 1280x800 · Mobile 390x844 · locale th-TH
- Clean session ทุก probe (new context = CUSTOMER-A first-visit)
- ห้ามสร้าง production order/การเงินจริง → order creation/payment E2E ระบุ NOT VERIFIED/BLOCKED ตามเงื่อนไข

## 2. Customer Journey Map (จะอัปเปดจากผล probe จริง)
(RESULT_PLACEHOLDER)

## 1. Test Environment

- Chromium headless ผ่าน Playwright (msedge channel) · Mobile 390x844 (primary) + Desktop 1280x800 · locale th-TH · clean session ต่อ probe (= CUSTOMER-A first visit)
- CUSTOMER-B (returning) = จำลองไม่ได้เต็มรูปแบบ — ไม่มี test account → order-creation journeys = NOT VERIFIED (§26)
- CUSTOMER-C (failure) = ทดสอบเฉพาะ unauth และ empty-state เท่าที่ปลอดภัย
- **0 console errors ทุก probe**

## 2. Customer Journey Map (Master Journey Matrix)

| Journey | UI | Backend | DB | Runtime (observed) | E2E | Status |
|---|---|---|---|---|---|---|
| First Visit (Landing) | ✓ render, 0 errors | — | — | ✓ | ✓ browsed | READY |
| Menu browse | ✓ 7 items จาก DB | ✓ getProducts | ✓ products | ✓ | ✓ | READY (DB=9 vs UI=7 — §5) |
| Product detail (OrderBuilder) | ✓ | — | — | ✓ เปิดได้ | ✓ | READY |
| Add to Cart | ✓ toast + badge=1 | — | — | ✓ in-memory | ✓ | PARTIAL (ไม่ทน reload — C-1) |
| Cart view | ✓ empty state ถูกต้อง | — | — | ✓ | ✓ | PARTIAL |
| Preorder journey | ✓ ปุ่มแยก (10) | ✓ RPC 025 | ✓ trigger | UI-only | NOT VERIFIED (login) | PARTIAL |
| Same-day journey | ✓ ปุ่มแยก (7) | ✓ RPC | ✓ | UI-only | NOT VERIFIED | PARTIAL |
| Delivery ≤5km | fee = server quote | ✓ compute_delivery_fee_rpc | ✓ zones | NOT VERIFIED (login-gated) | NOT VERIFIED | PARTIAL |
| Delivery >5km | ✗ ไม่มี UI เลือก | ✓ backend | ✓ | ✗ | ✗ | BLOCKED (frontend) |
| Checkout | ✓ auth-gate พร้อม | ✓ | — | ✓ | NOT VERIFIED | PARTIAL |
| Payment | ✓ UI | ✓ EF | ✓ | NOT VERIFIED (ห้ามจ่ายเงินจริง) | NOT VERIFIED | PARTIAL |
| Confirmation | ✓ | ✓ | ✓ | NOT VERIFIED | NOT VERIFIED | PARTIAL |
| Tracking | ✓ timeline | ✓ getOrder | ✓ | ✓ (display-state = client machine) | ✓ browsed | PARTIAL (copy bugs) |

## 3. First Visit (observed, mobile)

- Title: "Bite Me Baby - สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม." — สื่อสารธุรกิจชัด ✓
- Sections: 🔥 เมนูวันนี้ (Same-day) / 📅 เมนูจองล่วงหน้า / 🎟️ โปรโมชั่น / ⭐ รีวิว / 📢 แชร์ ✓
- **OBSERVED:** drinks section แสดง ✓ แต่ **snacks section ไม่แสดง** (code มี SnacksSection.tsx แต่ runtime ไม่พบ)
- Nav links 30+ ครบ (categories, info, social) — ไม่พบ dead link ใน scan

## 4. Menu (runtime จริง)

7 รายการ: ลุยสวนหมูสับเห็ดหอม 69 · ผัดไทยกุ้งสด 69 · เมี่ยงแซลม่อน 79 · ปลาต้มผักกาดดอง 99 · เมี่ยงหมู+กุ้ง 99 · สปาเกตตี้ผัดพริกแห้งกุ้ง 99 · ข้าวลาบอกไก่+ไข่ต้ม 69
- **prod-6 "เมนูใหม่: ข้าวกุ้งกระเทียม" (is_available=true, is_preorder=true, scheduled 2026-10-01) ไม่แสดง** → menu gate 039 กรองถูกต้องตาม design weekly-menu
- ป้าย "จองล่วงหน้า (2)" ไม่ตรงการ์ดจองที่มองเห็นจริง — OBSERVED inconsistency
- ราคา/เวลาเตรียม (10-20 min) แสดงต่อการ์ด ✓

## 5. Menu Source Reality (ตอบคำสั่ง §5)

| จุด | Source จริง | Evidence |
|---|---|---|
| MenuPage | **DB products + menu gate 039** | runtime 7/9 items ตรง DB |
| HomePage drinks | **STATIC lib (drinksMenu.ts)** | DrinksSection.tsx:10 |
| HomePage snacks | STATIC lib + **ไม่ render ณ audit date** | SnacksSection.tsx:10 + probe false |
| **HOME MENU ≠ PRODUCT DATABASE** | **CONFIRMED — เครื่องดื่มใน home ไม่มีใน DB products เลย (DB มีแต่อาหารคาว)** | prod-phase2-audit.json products_sample |

## 6. Product → Cart (runtime พิสูจน์)

- คลิก "เพิ่มลงตะกร้า" → **toast "✅ สั่งซื้อสำเร็จ — เปิดดูตะกร้าได้เลย!" + cart badge = 1** (p3-after-add.png)
- Runtime ใช้ `store/cartStore` จริง (badge ตอบสนอง)
- **CRITICAL C-1: Cart ไม่ persist — full navigation/reload แล้ว /cart แสดง "ตะกร้าว่าง"** เพราะ store/cartStore ไม่มี persist middleware (grep = 0 hits) · localStorage หลัง reload มีแค่ `bmb_bmb_users`
  - ผู้ใช้ SPA-nav จะเห็นของต่อ แต่ **refresh ครั้งเดียว = ตะกร้าหายหมด** = HIGH
- Toast copy ผิด: "สั่งซื้อสำเร็จ" ทั้งที่แค่ใส่ตะกร้า — MISLEADING (MEDIUM)
- Empty cart state: mascot + ปุ่มดูเมนู ✓

## 7-9. Preorder / Same-day / UX แยกสองโหมด

- UI แยกชัดตลอด: แท็บวันนี้/จองล่วงหน้า + ปุ่มแยกต่อการ์ด ✓ — ลูกค้าไม่น่าสับสน
- Backend enforcement ยืนยันแล้ว (Phase 2) · **E2E ข้าม checkout = NOT VERIFIED (login-gated)**
- preorder_max_days=40 (business_settings จริง) — runtime behavior NOT VERIFIED

## 10-11. Delivery Journey + Safety

- Customer flow: CheckoutPage hardcode `delivery_method: 'self_delivery'` (CheckoutPage.tsx:99,201) — **ไม่มีทางเลือก Bite Drive/rider ใน UI ทุกกรณี**
- ≤5 km / >5 km ที่ระดับ DB/RPC = รองรับ (delivery_zones 3 zone + is_outside_self_zone + enum 4 ทาง — Phase 2) · **Runtime UI = จำกัด self_delivery เท่านั้น → >5 km = BLOCKED ที่ frontend**
- Fee quote แสดงแบบ server-authoritative (feeSource server/local-mirror) — live quote = NOT VERIFIED (login-gated)
- ห้าม trigger external rider จริง → **FOUNDATION ONLY** ไม่ใช่ READY

## 12. Customer Information

- Fields ต้องมี: name/phone/address(lat,lng,detail)/notes — อยู่ใน CheckoutPage + profile default (locationStore)
- Validation ที่พบ: auth gate (login ก่อน), round required (ปุ่ม disabled จนเลือกรอบ) — invalid phone/address = NOT VERIFIED runtime
- Default address ตำแหน่ง fallback = kitchen coords (10.7016, 102.1429) เมื่อไม่มี saved location — OBSERVED (ลูกค้าใหม่ที่ไม่กรอกจะได้ default = ค่าส่ง zone-in-city)

## 13-16. Checkout / Payment / Confirmation / Tracking

- CheckoutPage: สรุปยอดเป็น "ประมาณการ" ชัดเจน + ระบุ "ราคา/ส่วนลด/ค่าส่งเป็นสิทธิ์ของเซิร์ฟเวอร์" ✓ ตรง architecture
- Payment UI: promptpay_qr (default) / cash_on_delivery — credit_card ไม่มีตัวเลือกใน UI probe (paymentMethod state เริ่ม promptpay) — OBSERVED: UI เลือก 2 ทาง
- **Payment authority: ไม่มีทางที่ลูกค้า self-mark paid** (PaymentConfirmationPage submit TXN → processing เท่านั้น — Phase 1 code evidence + Phase 2 RPC) ✓ ตรง architecture
- Tracking: /track/TEST-001 render ได้โดยไม่ต้อง login (anon) — timeline "รอการยืนยัน→ยืนยันแล้ว→กำลังทำ..." — **แสดงเป็น client state machine defaults ไม่ได้อ่าน DB จริงทั้งหมด** (TEST-001 DB status=confirmed แต่ timeline แสดง generic) — PARTIAL display-state
- **Copy bugs ใน tracking:** "กำลังงทำ" (ซ้ำ ง), "ส่งสำเรจ" (ตก ต) — OBSERVED ใน trackBody (LOW)

## 17-18. Refresh / Reload / Session Resilience

| ทดสอบ | ผลจริง |
|---|---|
| Add item → reload | **ตะกร้าหายทั้งหมด** (C-1) — HIGH |
| /cart → reload | empty state ✓ ไม่ crash |
| localStorage keys | แค่ `bmb_bmb_users` (ไม่มี cart key) |
| Checkout unauth | redirect flow พร้อม (ต้อง live login เพื่อยืนยัน — NOT VERIFIED) |
| Duplicate order risk | ปุ่ม place-order disabled ขณะ isProcessing ✓ (code) — runtime NOT VERIFIED |

## 19. Failure Matrix (ที่ทดสอบได้)

| Scenario | Expected | Actual | Backend | DB | Status |
|---|---|---|---|---|---|
| Empty cart | reject | แสดง empty state + ปุ่มดูเมนู | — | — | READY (UI) |
| Unauth checkout | redirect login | gate พร้อม (code) | 007 reject anon | ✓ | PARTIAL/NOT VERIFIED live |
| Product unavailable | reject | UI ไม่แสดงสินค้าไม่พร้อมขาย (policy is_available) | ✓ RPC | ✓ | READY (จาก evidence รวม) |
| Round closed / capacity / cutoff | reject | UI gate มี (code) + RPC ✓ | ✓ | ✓ | NOT VERIFIED live |
| Invalid date (PRE_ORDER) | reject | client lead-days gate (code) | ✓ trigger | ✓ | NOT VERIFIED live |
| Payment fail | no paid | client ไม่มีสิทธิ์ mark paid | ✓ | ✓ | READY (code+DB) |
| Duplicate submit | one order | disabled button + RPC (idempotency NOT VERIFIED) | PARTIAL | — | NOT VERIFIED |
| Session loss | recover | cart หาย (C-1) | — | — | **BROKEN (UX)** |

## 22-25. Findings รวม

**CRITICAL:** ไม่พบ new (ai-proxy/EF จาก Phase 2 ยังเป็น critical ฝั่ง AI)

**HIGH:**
- H-1: Cart ไม่ persist หลัง refresh (C-1) — data loss ต่อผู้ใช้จริง
- H-2: HOME MENU ≠ DB (drinks จาก static lib ไม่มีใน DB) — admin แก้ไม่มีผลที่ home

**MEDIUM:**
- M-1: Delivery >5km BLOCKED ที่ frontend (hardcode self_delivery) ทั้งที่ backend พร้อม
- M-2: Toast "สั่งซื้อสำเร็จ" สับสนกับการสั่งจริง
- M-3: /track เปิดได้โดยไม่ login — timeline จาก client machine อาจสื่อสารสถานะผิดจริง
- M-4: ป้าย "จองล่วงหน้า (2)" ไม่ตรงของจริง

**LOW:**
- L-1: สะกดผิดใน tracking ("กำลังงทำ", "ส่งสำเรจ")
- L-2: /login **แสดง demo admin credentials บนหน้า login สาธารณะ** ("Demo Admin: admin@bmb.co.th / admin123" — aiChatBody capture) — ถ้าบัญชีนี้ยังใช้ได้จริงบน production = ต้องยืนยัน/รีเม็ดทันที (ยกระดับเป็น HIGH ถ้า verify ได้ — NOT VERIFIED ว่ายัง login ได้)
- L-3: Snacks section ไม่แสดงบน home

## 26. NOT VERIFIED (รวม)

- การสร้าง order จริงทั้งสอง mode (ต้อง login + ห้ามสร้าง order จริงโดยไม่ได้รับอนุญาต)
- Payment ทั้ง success/fail/cancel/duplicate (ห้ามใช้เงินจริง)
- Delivery fee quote live ทั้ง ≤5/>5 km, invalid location
- Capacity full / round closed / cutoff passed live reject
- Session loss ระหว่าง checkout, back/forward, network interruption
- สถานะการ login จริงของ demo admin account
- CUSTOMER-B returning customer full journey

## 27. Evidence Index

- `e2e/prod-phase3-e2e.json` (5 probes: home-mobile, menu-mobile, cart-flow-mobile, track-unauth-mobile, home-desktop)
- Screenshots: p3-home-mobile.png, p3-menu-mobile.png, p3-after-add.png (toast+badge), p3-cart.png (empty after reload), p3-checkout-gate.png, p3-track.png, p3-ai-chat.png (login+demo creds), p3-home-desktop.png
- Code: CheckoutPage.tsx:99,201 (self_delivery hardcode), store/cartStore.ts (ไม่มี persist), DrinksSection.tsx:10, SnacksSection.tsx:10, FoodMenuCard.tsx:129-141 (testids)
- DB: e2e/prod-phase2-audit.json (products_sample, business_settings, menu gate functions)

## 20-22. Mobile UX / Accessibility / PWA (observed)

- Mobile 390x844: ไม่มี horizontal scroll ทั้ง home และ menu ✓ · bottom nav 5 tab ✓ · sticky header + badge ✓
- PWA: manifest.json ✓ · service worker registered ✓ (swRegistered=true) · installable surface ✓ — **offline behavior/cache policy = NOT VERIFIED (ต้องตัด network จริง)**
- Desktop 1280x800: render ✓ ไม่ overflow ✓
- Accessibility (obvious-level): toast feedback ✓, disabled button state ✓ (code), placeholder-only labels ใน search บางจุด, contrast ของ badge ส้มบนขาวพอใช้ — ไม่ได้ทำ full WCAG
- Touch targets: ปุ่มสั่ง/จองเต็มความกว้างการ์ด ✓

## PHASE 3 STATUS SUMMARY

```
READY: Landing, Menu browse, Product detail, Add-to-cart (in-session), Empty states, PWA install surface
PARTIAL: Cart (no persist), Preorder, Same-day, Delivery ≤5km, Tracking
BLOCKED: Delivery >5km (frontend), Checkout/Payment/Confirmation E2E (no test account + safety rule)
BROKEN: Session loss → cart data loss (H-1)
NOT VERIFIED: order creation live, payment live, capacity/cutoff live, demo admin login live
```