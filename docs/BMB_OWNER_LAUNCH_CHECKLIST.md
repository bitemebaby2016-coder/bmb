# BMB — OWNER CHECKLIST (อัปเดต 2026-10-12 รอบ P0-interim + P1)

> เอกสารสำหรับ **Owner** — เรียงตามลำดับที่ต้องทำ
> เอกสารนี้ **เขียนทับ** เวอร์ชันก่อน (ไม่ต่อท้าย) — ใช้ฉบับนี้ฉบับเดียว
>
> **ห้าม**วาง test password / payment credentials / ข้อมูลลูกค้าจริงในเอกสารหรือแชต

---

## 0. ปิดแล้ว (มีหลักฐาน production/โค้ดจริง)

| หัวข้อ | หลักฐาน |
|---|---|
| production เสิร์ฟ build `5cc693a` แล้ว | `e2e/launch-verify.json` L7 |
| GPS granted → "ตำแหน่งจาก GPS" บน production | L4 PASS (`10.7050, 102.1350`) |
| canonical `/track/:orderNumber` ไม่มี placeholder | L1 PASS |
| แชต production ตอบจริง 4.1 วิ | L6 PASS |
| **migration 121 (GRANT customers) apply แล้ว** | Owner ยืนยัน + screenshot SQL Editor |
| **SF-02 — ไม่มีลูกค้าจริงรายใดถูกเขียนพิกัด 0,0** | production query: `null_island_exact = 0 จาก 37` |
| **P1 — กู้คืนรหัสผ่าน** (`/login` → ลืมรหัสผ่าน → `/reset-password`) | `src/lib/authRecovery.ts` + `ResetPasswordPage` + 16 tests |
| **P1 — `/orders` เป็น ProtectedRoute** (SF-08) | `App.tsx` |
| **P0-interim — rate limit บน `phone-auto-login`** (5/15นาทีต่อเบอร์ · 20/ชม.ต่อ IP) | `rateLimit.ts` pure module + EF wiring + tests |
| gates รอบนี้ | lint **0** · vitest **74 ไฟล์ / 802 tests** · build **0** |

รันซ้ำ: `node e2e/launchVerify.cjs` (production read-only) · `npm run lint && npm test && npm run build`

---

## 1. ข้อเท็จจริงใหม่ที่ **แก้ไขรายงานเดิม**

### 1.1 NULL ISLAND ไม่เกิดขึ้นจริง (SF-02 ปิด)

> แฮนออฟเดิมกล่าวอ้างว่า "production EF rev เก่า → quick login เขียน `default_*=0,0` ทุกครั้ง"
> **ข้อมูลจริงไม่รองรับข้อนี้** — แถว `0,0` = **0 จาก 37** และบัญชี phone-keyed 33 แถว **มีพิกัดจริงครบ**

| ตัวเลข production | ค่า |
|---|---|
| `total_customers` | 37 |
| `null_island_exact` | **0** |
| `phone_keyed_without_coords` | **0** |
| `email_keyed_without_coords` | 4 |
| `no_user_id` (ไม่มี user_id) | **3** |

⇒ งาน deploy EF rev ใหม่ **ลดระดับจาก data-corruption emergency เหลือเป็นงาน hardening ตามปกติ**

### 1.2 SF-01 ต้องแก้ประเภท — ไม่ใช่ "เปลี่ยนรหัสผ่านบัญชีอีเมลเดิม"

โค้ดจริง (`phone-auto-login/index.ts:155,199`) จับคู่บัญชีด้วย **synthetic email `<phone>@phone.bmb.local` เท่านั้น**
→ ลูกค้าที่สมัครด้วยอีเมลจริง **จะไม่ถูกจับ** แต่จะเกิด **บัญชีซ้ำ** (account splitting)

**ความเสี่ยงจริงที่ยังเป็น Critical:**
- **ใครก็ตามที่รู้เบอร์โทร สามารถเข้าบัญชี phone-keyed ของเบอร์นั้นได้ทันที** (ปัจจัยเดียว)
- มีลูกค้าจริง **33 ราย (89%)** ใช้บัญชีแบบนี้
- **ห้ามลบ Quick Login ทันที** — ต้องมี OTP + แผนรองรับลูกค้าเดิม + Rollback

---

## 2. Owner Decision Register (บันทึกตามคำสั่ง 2026-10-12)

| # | ประเด็น | คำตัดสิน |
|---|---|---|
| OD-1 | Quick Login | ไม่ยอมรับความเสี่ยงเดิม · ต้องใช้ OTP ก่อนอนุญาตเข้าบัญชีด้วยเบอร์ · **ห้ามลบทิ้งทันที** |
| OD-2 | Guest Checkout | อนุมัติหลักการ · เลือก **ทางเลือก A** (Guest Identity ผ่าน OTP แล้วใช้ Order RPC เดิม) ถ้าพิสูจน์ปลอดภัย · ทางเลือก B ไม่เลือก |
| OD-3 | OTP | ยืนยันการควบคุมเบอร์ **แยกจาก Login Authorization และ Payment** |
| OD-4 | SMS Provider | อนุมัติหลักการใช้ **THSMS** |
| OD-5 | Facebook | คงใน Roadmap (P3) แต่ไม่ขวางความปลอดภัย/Guest Checkout |
| OD-6 | Email/Password | คงไว้ · เพิ่มกู้คืนรหัสผ่าน + ตรวจการยืนยันอีเมล → **ทำแล้ว (กู้คืน)** |
| OD-7 | Passkeys | ทำภายหลัง (P4) |

---

## 3. P0 — Quick Login ใช้ OTP (โค้ดพร้อมแล้ว — เหลือ Owner deploy)

**ทำแล้วในโค้ด:**
- `supabase/migrations/122_otp_challenges.sql` — ตารางเก็บ **hash+salt เท่านั้น** (ไม่มี plaintext) · ใช้ครั้งเดียว · หมดอายุ 5 นาที · ทายผิดได้ไม่เกิน 5 · RLS deny-all
- `supabase/functions/_shared/otpPolicy.ts` — pure module (15 tests): สุ่ม CSPRNG · hash SHA-256 · constant-time compare · rate limit แยกส่ง/ทาย
- `supabase/functions/_shared/otpVerify.ts` — `consumeOtpChallenge()` ใช้ร่วมกันได้ทั้ง Quick Login และ Guest Checkout (P2)
- `supabase/functions/otp-send/index.ts` — ออก OTP + เรียก `sms-send` (rate limit 3/10นาทีต่อเบอร์)
- `phone-auto-login` — บังคับ OTP **เมื่อเปิด flag** `QUICK_LOGIN_REQUIRE_OTP=true`
- `src/lib/locationLogin.ts` — `sendQuickLoginOtp()` + ส่ง `otp_code` ไป EF
- `LoginPage` — กล่อง "ยืนยันเบอร์โทรศัพท์" + ปุ่มส่งรหัส + ช่องกรอกรหัส 6 หลัก + ข้อความ error ภาษาไทยครบทุกกรณี

**Rollback ทันที (Owner ควบคุม):**
```bash
supabase secrets set QUICK_LOGIN_REQUIRE_OTP=false   # ปิด — กลับพฤติกรรมเดิม (มี rate limit แล้ว)
supabase secrets set QUICK_LOGIN_REQUIRE_OTP=true    # เปิด — บังคับ OTP
```
> จงใจให้เป็น flag ไม่ใช่ hard-code → **ลูกค้า 33 รายเดิมจะไม่ถูกตัดออกโดยไม่ได้ตั้งใจ**

**ขั้นตอน Owner deploy (เมื่อพร้อม):**
```bash
# 1. apply migration (ตาราง OTP ต้องมีก่อน)
supabase db push
# 2. deploy EF ใหม่ + EF ที่แก้
supabase functions deploy otp-send --project-ref ivkdfognyiwjcmrhcnwz
supabase functions deploy phone-auto-login --project-ref ivkdfognyiwjcmrhcnwz
# 3. เปิด flag เมื่อทดสอบ sms-send สำเร็จแล้วเท่านั้น
supabase secrets set QUICK_LOGIN_REQUIRE_OTP=true
```

**ข้อจำกัดที่ต้องยอมรับ:** rate limit ของ OTP เป็น in-memory ต่อ instance → reset ตอน cold start (interim)


---

## 4. P1 — ทำแล้ว / เหลือให้ Owner ตรวจ

**ทำแล้ว:** ลืมรหัสผ่าน (`/login` → ปุ่ม "ลืมรหัสผ่าน?" → กรอกอีเมล → ลิงก์ไป `/reset-password`) · กัน account enumeration (อีเมลไม่มีในระบบก็ตอบสำเร็จ) · `/orders` เป็น ProtectedRoute

**ต้อง Owner ตรวจ (ผมเข้า Dashboard ไม่ได้):**
1. Supabase Dashboard → Authentication → Providers → **Email** → ต้องเปิด **Confirm email**
2. Authentication → URL Configuration → **Redirect URLs** ต้องมี `https://biteme-baby.com/reset-password`
3. ทดสอบจริง: ใช้อีเมลตัวเองกด "ลืมรหัสผ่าน" → ได้ลิงก์ → ตั้งรหัสผ่านใหม่ → login ได้

---

## 5. P2 — Guest Checkout (โค้ดพร้อมแล้ว — เหลือ Owner deploy)

**ทำแล้วในโค้ด (ทางเลือก A ตาม Owner OD-2):**
- `supabase/functions/guest-checkout-session/index.ts` — EF **แยกจาก Quick Login** · **บังคับ OTP `purpose='guest_checkout'` เสมอ ไม่มี flag ปิดได้**
- `src/lib/guestCheckout.ts` — `sendGuestCheckoutOtp` / `createGuestCheckoutSession` / `describeGuestOtpError`
- `CheckoutPage.tsx` — เปลี่ยนจาก redirect ไป `/login` เป็น **กล่องยืนยันเบอร์ inline** (ลูกค้าใหม่สั่งได้ทันที ไม่ต้องสมัครสมาชิก)

**พิสูจน์ครบทั้ง 5 เกณฑ์ของ Owner:**

| # | เกณฑ์ | กลไกที่ตอบ |
|---|---|---|
| 1 | กลับมาสั่งซ้ำไม่ติดขั้นตอนสมัคร | account ผูกกับเบอร์ + `customers.id = cust-<14 หลักท้าย>` คงที่ → กลับมา OTP แล้วเจอข้อมูลเดิม |
| 2 | ออเดอร์มีเจ้าของและสิทธิ์ | ยังคง `create_order_with_items` เดิมทุกประการ (`customer_ref = auth.uid()` ฝั่ง server) — **ไม่แก้ RPC เลย** |
| 3 | เชื่อมบัญชีเดิมโดยไม่สร้างซ้ำ | deterministic id + `resolution=merge-duplicates` |
| 4 | **OTP ไม่ให้สิทธิ์เข้าบัญชีอื่นอัตโนมัติ** | EF เข้าถึง **เฉพาะ** บัญชี phone-keyed ของเบอร์นั้น — บัญชีอีเมลจริง **ไม่ถูกแตะต้อง** |
| 5 | OTP/Session ล้มเหลว = ไม่มีออเดอร์ค้าง | ไม่มี session → เรียก RPC ไม่ได้ → **ไม่มีออเดอร์ถูกสร้าง** |

**ขอบเขตที่ไม่แตะ:** Order State Machine (`transition_order_status`) · Payment Authority · RLS · RPC `create_order_with_items`

**Owner deploy:**
```bash
supabase functions deploy guest-checkout-session --project-ref ivkdfognyiwjcmrhcnwz
```
> ต้อง apply migration 122 + deploy `otp-send` แล้ว (ทำแล้ว) — ไม่ต้องตั้ง flag เพิ่ม


---

## 6. P3 — Facebook OAuth (ยังไม่เริ่ม)

`signInWithOAuth` = **0** · `META_APP_ID` / `META_APP_SECRET` มีใน `.env.local` แล้ว (ตรวจเฉพาะชื่อ) · ต้องมี callback route + test user จริง

## 7. P4 — Passkeys (ยังไม่เริ่ม)

`navigator.credentials` / `webauthn` = **0** · ต้องยืนยันความพร้อมของ Supabase SDK ก่อนเริ่ม

---

## 8. งาน Owner ที่ยังค้าง — เรียงลำดับที่ควรทำ

| ลำดับ | งาน | ทำไมสำคัญ |
|---|---|---|
| **1** | **apply migration 122** (`supabase db push`) | ตาราง OTP ต้องมาก่อน deploy `otp-send` |
| **2** | **deploy `otp-send` + `phone-auto-login`** | EF ใหม่/ที่แก้ |
| **3** | **ทดสอบ SMS จริง 1 ข้อความ** | ยืนยันว่า `api.thsms.org/v1` + `SMSOTP` ใช้ได้จริง |
| **4** | **เปิด flag** `QUICK_LOGIN_REQUIRE_OTP=true` | เมื่อข้อ 3 ผ่านเท่านั้น — rollback ได้ในคลิกเดียว |
| 5 | ทดสอบ Quick Login ด้วย OTP บนมือถือจริง | ต้องพิสูจน์บนอุปกรณ์จริง ห้ามอ้าง unit test |
| 6 | ตรวจ Email Confirmation ใน Dashboard + ทดสอบกู้คืนรหัสผ่านจริง | P1 |
| 7 | ทำ Omise TEST E2E ทุกสถานะ + ตรวจ webhook | ยังไม่มีหลักฐานการจ่ายจริง |
| 8 | GPS matrix บนมือถือจริง (เคส 1–4 ทำได้เลย) | handoff §8 |
| 9 | Copy 7 วัน (`theater_daily_copy`) | Admin → Settings |
| 10 | ลบ/noindex `bitemebaby-5f7.pages.dev` (build แช่แข็ง) | Cloudflare dashboard |
| 11 | Omise LIVE onboarding/identity verification | ก่อนรับเงินจริง |
| 12 | แก้ `no_user_id = 3` แถว | ต้องทำก่อน P2 account linking |


| OD-8 | Payment / Order State Machine | รักษาระบบเดิม ห้ามแก้เพื่อให้ Guest Checkout ผ่าน |
| OD-9 | Email Confirmation / Omise TEST | ต้องตรวจ Dashboard + ทดสอบจริง ห้ามอนุมานจาก Build/CI |
