# BMB — HANDOFF: งานปรับปรุง UX/UI (สั่งงานส่งต่อ — 2026-10-08)

**ประเภท:** HANDOFF / WORK ORDER — ส่งต่อให้ AI/ทีมรอบถัดไปทำต่อ
**สั่งโดย:** Owner (จากคำสั่งในแชท 2026-10-08) · **ทำโดย:** AI รับช่วงถัดไป
**Repo:** `D:\A PROJECT\Bite Me Baby` (branch `main`) · HEAD ณ วันสั่งงาน = `f214ad8` (= origin/main)
**อ่านก่อนเริ่ม:** `BMB_OPEN_ITEMS_OWNER_TESTS_2026-10-08.md` (สถานะรวม) + `BMB_CURRENT_PRODUCTION_CLOSURE_BASELINE.md` (baseline) + `.clinerules` §15.2 (gates: tsc/lint/vitest/build ก่อน commit · commit feature + docs แยก · push)

---

## 0. ขอบเขตและหลัก

- **งานนี้ = UX/UI เท่านั้น** — ห้ามแตะ logic เงิน/order authority/migration ใหม่/EF ที่ deploy แล้ว (ถ้าพบบั๊ก UI ที่ชน logic → รายงานก่อนแก้)
- ภาษา UI หลัก = **ไทยเต็มรูปแบบ** (มาตรฐานจาก `LoginPage.tsx`/`RegisterPage.tsx` ที่ทำแล้ว — reuse น้ำเสียง/คำศัพท์ชุดเดิม)
- **ห้ามเขียน/ออกเสียงชื่อร้านผิด**: "Bite Me Baby" = **"ไท์มีเบบี้"** · มาสคอต = **"ไท์"** (codepoints `0E44 0E1A 0E35 0E17 0E31 0E49` — ต้องมี บ.) — ห้ามมี "บิท" / "ไท์ (ไม่มี บ.)" ใน UI string หรือ prompt ใด ๆ
- ทุกไฟล์ต้องเป็น **UTF-8 ไม่มี mojibake** (สแกนด้วย node script แบบรอบก่อน: ทุก `.ts/.tsx/.sql/.md` ห้ามมี replacement char หรือ byte pattern ผิด)
- ทดสอบ mobile ได้ผ่าน **tunnel** (`npm run dev` + `ngrok http 3000` หรือ `npx localtunnel --port 3000` — config `vite.config.ts` ตั้งให้แล้ว) — ใช้ตอน verify หน้าจอเล็ก/จากเครื่องอื่น

## 1. งานที่สั่ง (เรียงลำดับทำ)

### UX-1 — กวาด UI ภาษาไทยทั้งแอป (P0)
- scan หา English user-facing string ที่เหลือใน `src/pages/**` + `src/components/**` (ยกเว้น code/identifier/log ภายใน)
- แปลเป็นไทยให้ครบ (placeholder, label, error message, button, empty state, title)
- ไฟล์เป้าหมายเริ่มต้น (ตรวจก่อน ถ้าเจอเพิ่มขยายให้หมด): `RegisterPage`, `CheckoutPage`, `PaymentConfirmationPage`, `OrdersPage`, `AccountPage`, admin pages ที่ owner ใช้บ่อย (`DeliveryManagement`, `KDS`, `Products`)
- **Acceptance:** grep หา string อังกฤษ user-facing เหลือ = 0 ( whitelist ชื่อแบรนด์/ technical terms ที่ตั้งใจ)

### UX-2 — ฟอร์มชำระเงิน Omise ภาษาไทย + สถานะ 3DS ชัดเจน (P0 — ชน P0-1)
- `OmiseCardForm` / `CardPaymentForm`: label ไทยทั้งหมด (เลขบัตร วันหมดอายุ CVC ชื่อบนบัตร ปุ่ม "ชำระเงิน")
- สถานะ: กำลังสร้าง token → กำลังตัดเงิน → **"กรุณายืนยันตัวตน 3-D Secure ที่หน้าธนาคาร"** → กลับมา "รอผลชำระเงิน (webhook)" — ทุกสถานะมีข้อความไทย + spinner ห้ามค้างเงียบ
- error mapping ไทย: บัตรไม่ผ่าน/เงินไม่พอ/ยกเลิกโดยผู้ถือบัตร/หมดเวลา 3DS
- **Acceptance:** ครอบคลุมทุก branch ใน `paymentGateway.createCheckout` path ของ omise + fallback stripe ไม่พัง (รัน test เดิม `omiseCutover`/`omiseCheckoutLogic` ผ่าน)

### UX-3 — รูปสถานที่จัดส่ง + GPS ในเส้นทางสั่งของ (P0)
- ทำแล้วในหน้า Login (ปุ่ม `📷 เพิ่มรูปสถานที่จัดส่ง` ข้าง GPS + preview + remember-once) → **งานต่อ:**
  - `CheckoutPage`: ให้เพิ่ม/เปลี่ยนรูป+ที่อยู่ ได้ก่อนยืนยันออเดอร์ (reuse `uploadDeliveryPhoto` + `saveDeliveryProfile` + `bmb_quick_profile`)
  - `DeliveryManagement`: preview รูปกดดูใหญ่ได้ (tap → full-screen) + fallback ข้อความ "ไม่มีรูป"
  - ตรวจ mobile: ปุ่มกล้อง/GPS กดง่าย นิ้วเดียว ไม่ชน clavier
- **Acceptance:** เส้นทาง login → checkout → มีรูป+GPS ในแถว order จริง (probe DB `customers` / `orders.customer_ref`)

### UX-4 — Talk-to-Bite: pronunciation + หน้าตา (P1)
- system prompt มี rule แล้ว → **งาน UI:** ตอนแอป render ชื่อร้านในข้อความ Bite/หัวข้อ ให้ใช้ "ไท์มีเบบี้" เสมอ (ตรวจ `TalkToBite.tsx`, `BiteHero.tsx`, `MascotBadge`, landing)
- เพิ่ม: ข้อความ error/typing/thai voice status เป็นไทยทั้งหมด
- **Acceptance:** เปิด `/` และ `/talk-to-bite` ไม่พบ "บิท"/ชื่ออังกฤษผิดใน UI

### UX-5 — Mobile polish ผ่าน tunnel (P1)
- รัน dev + tunnel → เปิดจากมือถือ 4G/5G → เช็ก: BottomNav, ตะกร้า, checkout, payment, orders, delivery photo camera input, GPS permission prompt
- แก้ overflow/touch-target < 44px ที่พบ
- **Acceptance:** รายงานรายการจุดที่แก้ + screenshot อย่างน้อย 5 หน้าจอ (หน้าแรก, login, checkout, payment, orders)

## 2. เกตปิดงาน (ห้าม commit ก่อนผ่านครบ)

```
npx tsc --noEmit        → 0 error
npm run lint            → 0 error
npm test                → ทุกไฟล์ PASS (base = 55 files/589 tests ณ 2026-10-07 — ห้ามลบ test เดิม)
npm run build           → PASS
node moji scan          → 0 bad lines
```
แล้ว commit (feature + docs แยก) → `git push origin main` → ยืนยัน `HEAD == origin/main` + worktree clean

## 3. รายงานปิดงาน (เทมเพลต)
สรุปเป็นตาราง: UX-1…UX-5 → ทำอะไรบ้าง / ไฟล์ไหน / acceptance ผ่าน? / สิ่งที่พบเพิ่ม (ถ้ามี ให้แยก "ใหม่ — รอ Owner สั่ง" ห้ามลุยเองถ้าอยู่นอกขอบเขต §0)

---
*สั่งงานโดย Owner 2026-10-08 · handoff นี้อ่านเข้าใจได้คนเดียวโดยไม่ต้องเปิดแชท*