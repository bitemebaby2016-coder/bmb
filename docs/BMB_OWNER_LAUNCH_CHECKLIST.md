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

## 6. P3 — Facebook Login (โค้ดพร้อมแล้ว — เหลือ Owner ตั้งค่า 2 ฝั่ง)

**ทำแล้วในโค้ด:**
- `src/lib/socialLogin.ts` — `signInWithFacebook` · `socialRedirectTo` · `readSocialNext` · `consumeSocialCallbackError` · `describeSocialError`
- `LoginPage.tsx` — ปุ่ม Facebook + แปล error callback เป็นภาษาไทย + อ่าน `?next=` คืนหน้าที่ผู้ใช้ตั้งใจ
- `src/__tests__/socialLogin.test.ts` — **12 tests**

**3 ข้อคุ้มครองที่ test ยืนยัน:**
1. **กัน open-redirect** — `//evil.com` / `https://evil.com` ถูกปฏิเสธ → fallback เป็น `/`
2. **ไม่ leak raw error code** ให้ลูกค้าเห็น
3. **เส้นขอบบัญชีคงเดิม** — ข้อความ error ห้ามพูดถึงการชำระเงินหรือ "รวมบัญชี"

**ทำไม Facebook เข้าถึงบัญชี Quick Login/Guest Checkout ไม่ได้ (โดยการออกแบบ)**
บัญชีเหล่านั้นใช้ synthetic email `<phone>@phone.bmb.local` — Facebook ไม่มีทางคืนอีเมลรูปนี้
⇒ ยืนยันด้วย Facebook แล้วได้บัญชีของตัวเองเท่านั้น **ไม่มีทาง takeover บัญชีเบอร์โทรได้**
และระบบ **ไม่รวมบัญชีอัตโนมัติ** ระหว่าง Facebook กับบัญชีอีเมล/รหัสผ่านเดิม

### ⚠️ Owner ต้องตั้ง 2 ฝั่งนี้เอง (ตั้งให้ไม่ได้ — ไม่มีใน Management API)

**1) Supabase Dashboard** → `https://supabase.com/dashboard/project/ivkdfognyiwjcmrhcnwz`
- **Authentication → Providers → Facebook** → Enable → ใส่ **App ID** + **App Secret** (จาก `.env.local`)
- **Authentication → URL Configuration → Redirect URLs** → เพิ่ม:
  ```
  https://biteme-baby.com/login
  https://biteme-baby.com/login/**
  ```

**2) Meta for Developers** → App Settings
- **Facebook Login → Settings → Valid OAuth Redirect URIs** → เพิ่ม:
  ```
  https://ivkdfognyiwjcmrhcnwz.supabase.co/auth/v1/callback
  ```
- **App Review → Permissions and Features** → ยืนยัน `email` + `public_profile`
- ถ้า App ยังอยู่สถานะ **Development** → เพิ่มบัญชี Facebook ที่จะทดสอบเป็น **Test User**
  (บัญชีอื่นจะเห็นปุ่มแต่กดไม่ได้)

**ทดสอบ:** เข้า `/login` → ปุ่ม "เข้าสู่ระบบด้วย Facebook" → ได้ session → กลับหน้าเดิมที่มาก่อน

## 7. P4 — Passkeys (โค้ดพร้อมแล้ว — เหลือ Owner ทดสอบบนเครื่องจริง)

**ความพร้อมของ SDK ตรวจแล้ว:** `@supabase/supabase-js` **2.116.0** (ติดตั้งอยู่แล้ว)
มีครบ → `supabase.auth.signInWithPasskey()` · `registerPasskey()` · `mfa.passkey.{list,delete}`

**ทำแล้วในโค้ด:**
- `src/lib/passkeyLogin.ts` — `signInWithPasskey` · `registerPasskey` · `listPasskeys` · `removePasskey` · `isPasskeySupported` · `describePasskeyError`
- `LoginPage.tsx` — ปุ่ม "เข้าสู่ระบบด้วย Passkey" (แสดงเฉพาะเบราว์เซอร์ที่รองรับ และยังไม่มี session)
- `ProfilePage.tsx` (`/profile`) — สร้าง / รายชื่อ / ลบ Passkey
- `src/__tests__/passkeyLogin.test.ts` — **6 tests**

**ข้อคุ้มครองที่ test ยืนยัน:**
1. ไม่ leak raw error code (`webauthn_challenge_expired` / `ERROR_CEREMONY_ABORTED`) ให้ลูกค้าเห็น
2. แยกแยะได้ว่า "ยกเลิกเอง" ต่างจาก "challenge หมดอายุ" (คนละวิธีแก้)
3. ผู้ใช้ที่ยังไม่มี Passkey ถูกบอกทางชัดเจนว่าต้องทำอะไรต่อ
4. ข้อความห้ามพูดถึงการชำระเงินหรือ "รวมบัญชี"
5. **สมัครต้องมี session อยู่แล้ว** → ไม่มีทางผูก passkey เข้าบัญชีคนอื่น

**Owner ต้องเปิด (Dashboard):**
- **Authentication → Passkeys** → เปิดใช้งาน (ถ้ายังไม่ขึ้น ให้รีเฟรชหรือรอ propage หลัง deploy)
- ไม่ต้องตั้งอะไรใน Meta

**ทดสอบบนเครื่องจริง:**
1. เข้า `/login` → ปุ่ม "เข้าสู่ระบบด้วย Passkey" ต้อง**ไม่ขึ้น**ถ้าเครื่องไม่รองรับ
2. login ด้วยวิธีอื่น → `/profile` → "+ สร้าง Passkey" → ยืนยัน Face/Touch ID
3. logout → `/login` → กดปุ่ม Passkey → เข้าได้โดยไม่ต้องพิมพ์อะไร

---

## 8. งาน Owner ที่ยังค้าง — เรียงลำดับที่ควรทำ

> อัปเดตอัตโนมัติหลัง Owner ตั้งค่า Facebook/Passkeys ครบ และผม probe production จริง (read-only)

| ลำดับ | งาน | สถานะ (ยืนยันแล้วเมื่อ 2026-10-12) |
|---|---|---|
| ~~1~~ | ~~apply migration 122~~ | ✅ **ทำแล้ว** — Owner รัน `supabase db push` สำเร็จ |
| ~~2~~ | ~~deploy `otp-send` + `phone-auto-login`~~ | ✅ **ทำแล้ว** — ขึ้น production ทั้งคู่ |
| 3 | ทดสอบ SMS จริง 1 ข้อความ | ⬜ ยังไม่มีหลักฐาน — ยืนยัน `api.thsms.org/v1` + `SMSOTP` |
| 4 | เปิด flag `QUICK_LOGIN_REQUIRE_OTP=true` | ⬜ **ทำได้หลังข้อ 3 ผ่านเท่านั้น** — rollback ได้ในคลิกเดียว |
| 5 | ทดสอบ Quick Login ด้วย OTP บนมือถือจริง | ⬜ ต้องพิสูจน์บนอุปกรณ์จริง ห้ามอ้าง unit test |
| 6 | ตรวจ Email Confirmation ใน Dashboard + ทดสอบกู้คืนรหัสผ่านจริง | ⬜ ไม่มี API อ่านค่านี้ — ต้องดูใน Dashboard เอง |
| 7 | ทำ Omise TEST E2E ทุกสถานะ + ตรวจ webhook | ⬜ ยังไม่มีหลักฐานการจ่ายจริง |
| 8 | GPS matrix บนมือถือจริง (เคส 1–4 ทำได้เลย) | ⬜ handoff §8 |
| ~~9~~ | ~~Copy 7 วัน (`theater_daily_copy`)~~ | ⚠️ **ข้อมูลในเช็คลิสต์เดิม "ผิด"** — ผม probe แล้วตาราง `theater_daily_copy` **ไม่มีอยู่จริง** ในสคีมา (และไม่มีตารางที่ชื่อขึ้นต้นด้วย copy/daily/theater/announcement เลย) จึงไม่มีอะไรให้กรอกใน Admin → Settings · **ต้องถาม Owner ก่อนว่าฟีเจอร์นี้หมายถึงอะไรจริง ๆ แล้วค่อยออกแบบให้ถูก** |
| 10 | ลบ/noindex `bitemebaby-5f7.pages.dev` | ⬜ **ยัง live อยู่จริง** — ผม probe แล้วได้ HTTP **200** (production `biteme-baby.com` ก็ 200) |
| 11 | Omise LIVE onboarding/identity verification | ⬜ ก่อนรับเงินจริง |
| ~~12~~ | ~~แก้ `no_user_id = 3` แถว~~ | ✅ **ปิดแล้ว** — ดูรายละเอียดด้านล่าง |

### ข้อ 12 (`no_user_id`) — สิ่งที่ probe จริง + สิ่งที่แก้แล้ว

**ตัวเลขจริงจาก production (read-only):**

| สิ่งที่วัด | ค่า |
|---|---|
| แถว `customers` ทั้งหมด | 37 |
| มี `user_id` ผูกบัญชี | 34 |
| `user_id IS NULL` (orphan) | **3** |
| ออเดอร์ `customer_ref IS NULL` | **15** ← Owner ยืนยันแล้วว่าเป็นข้อมูลทดสอบ ไม่กระทบเงินจริง |

**ทำไมไม่ต้อง "ย้าย/ลบ" ข้อมูล 3 แถวนั้น:**
RLS `customers_own_read` ใช้ `user_id = auth.uid()` → `NULL = anything` ได้ `NULL`
⇒ แถว orphan **มองไม่เห็นสำหรับ user ทั่วไปโดยอัตโนมัติ** — ไม่รั่ว, ไม่ error, เห็นเฉพาะ `is_admin()`
ดังนั้นการ "แก้ไขข้อมูล" จึง**ไม่จำเป็นและมีความเสี่ยงมากกว่าปล่อยไว้**

**สิ่งที่ทำจริง (code, commit ล่าสุด):**
- `src/types/index.ts` — เพิ่ม `user_id?: string | null` ลง `Customer` พร้อม comment อธิบายว่าห้ามสมมติว่ามีค่า
  (ก่อนหน้านี้ type **ไม่มี field นี้เลย** จึงไม่มีทางบังคับให้คนเขียนโค้ดรุ่นหลังรองรับ null)
- `src/lib/customerOwnership.ts` — pure helpers ที่ null-safe ทุกตัว:
  `isOrphanCustomer` · `canCustomerBeReadBy` · `describeOwnershipState` · `countOwnedAndOrphan`
- `src/__tests__/customerOwnership.test.ts` — **14 tests** ยืนยัน:
  - แถว null **ไม่มีทาง** อ่านได้โดย user ทั่วไป (ตรงกับ SQL semantics)
  - anon ถูกปฏิเสธเสมอ
  - admin เห็นรวมแถว orphan
  - ฟังก์ชิน **ไม่มีทาง throw** ไม่ว่า input จะเป็นอะไร
  - ข้อความแอดมินไม่ leak uid/PII

**Guest Checkout (P2) จะไม่มีทางสร้าง orphan row:** EF สร้าง auth user ก่อนแล้วจึงผูก `user_id` เสมอ
ดังนั้นแถวนี้เป็นของยุคก่อนระบบเท่านั้น



| OD-8 | Payment / Order State Machine | รักษาระบบเดิม ห้ามแก้เพื่อให้ Guest Checkout ผ่าน |
| OD-9 | Email Confirmation / Omise TEST | ต้องตรวจ Dashboard + ทดสอบจริง ห้ามอนุมานจาก Build/CI |
