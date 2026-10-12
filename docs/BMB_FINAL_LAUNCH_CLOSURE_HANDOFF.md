# BMB — HANDOFF (อัปเดต 2026-10-12 รอบ P0-interim + P1)

> เอกสารทำงานสำหรับแชตถัดไป — **ฉบับนี้เขียนทับฉบับก่อน** ใช้เล่มเดียว
> **ห้าม**ใส่ secrets / test passwords / payment credentials / ข้อมูลลูกค้าระบุตัวบุคคล

---

## 1. Git / worktree baseline (ตรวจอีกครั้งก่อนเริ่มงาน)

| ค่า | ค่าจริง |
|---|---|
| HEAD | `6c70a4d` (= `origin/main`, ahead/behind 0/0) |
| branch / remote | `main` / `git@github.com-bmb:bitemebaby2016-coder/bmb.git` |
| CI | run#394 (`6c70a4d`) = completed/**success** |
| stash | `stash@{0}: On main: local-edits-before-sync-2026-09-21` — **ห้ามแตะ** |
| worktree untracked | `e2e/screenshots/{cr4-*,launch-*}.png` (evidence) · รูป `public/**` ของ Owner (ไม่ commit) |

**กติกาที่ยังใช้ทั้งหมด:** no real customer data · EF-before-frontend · no amend/force · preserve stash · no secrets in logs · production E2E = read-only · ห้ามอ้าง "พร้อมเปิดร้านจริง" จนกว่าจะมีหลักฐาน · อัปเดตเอกสาร = **เขียนทับ ห้ามต่อท้าย**

---

## 2. ข้อแก้ไขที่สำคัญ — รายงานเดิม **ผิด** 2 จุด (ยืนยันด้วย production จริง)

### 2.1 NULL ISLAND ไม่เกิดขึ้นจริง (SF-02 ปิด)

**เดิม (ผิด):** "production EF rev เก่า → quick login เขียน `default_*=0,0` ทุกครั้ง"
**จริง:** production query ผ่าน `e2e/dbq.cjs` (aggregate, ไม่แตะ PII):

| ตัวเลข | ค่าจริง |
|---|---|
| `total_customers` | 37 |
| `null_island_exact` | **0** |
| `phone_keyed_without_coords` | **0** |
| `email_keyed_without_coords` | 4 |
| `has_address_detail` | 31 |
| `no_user_id` | **3** |

⇒ deploy EF rev ใหม่ **ไม่ใช่ data-corruption emergency** — เป็นงาน hardening ตามปกติ

### 2.2 SF-01 ต้องแก้ประเภท

**เดิม (ผิดบางส่วน):** "ผู้ใช้ email/password เดิมโดนเปลี่ยนรหัสผ่านเงียบ ๆ"
**จริง:** `phone-auto-login/index.ts:155,199` จับคู่ด้วย **synthetic email `<phone>@phone.bmb.local` เท่านั้น**
→ ลูกค้าอีเมลจริง **ไม่ถูกจับ** แต่ได้ **บัญชีซ้ำ** (account splitting)

**ความเสี่ยงจริงที่ยัง Critical:**
- รู้เบอร์ = เข้าบัญชี phone-keyed ของเบอร์นั้นได้ทันที (ปัจจัยเดียว ไม่มี rate limit จนถึงรอบนี้)
- **33 จาก 37 บัญชี (89%) เป็น phone-keyed** → **ห้ามลบ Quick Login ทันที**

### 2.3 EF revision บน production

`GET /v1/projects/{ref}/functions` → `phone-auto-login` อัปเดตล่าสุด **2026-10-11 09:25 ICT**
(ก่อน commit `5cc693a` วันที่ 2026-10-12 10:09) → **ยังไม่ใช่โค้ดรอบแก้ล่าสุด**
⚠️ endpoint `/versions` คืน 404 → **ยืนยัน hash ไม่ได้** ยืนยันได้แค่วันเวลา

---

## 3. สถาปัตยกรรม Login จริง

**ช่องทางเข้าระบบ 2 ทาง:**
1. **Email/Password** — `authStore.login` → `supabase.auth.signInWithPassword`
2. **Quick Login** — ชื่อ+เบอร์+ตำแหน่ง → EF `phone-auto-login` (phone-keyed email) → `authStore.loginByLocation` → `setSession`

**ไม่มี Facebook/Google/OAuth/Passkey ในโค้ด** — `signInWithOAuth` = 0 · `navigator.credentials`/`webauthn` = 0

**Session:** `persistSession+autoRefreshToken+detectSessionInUrl` = true (`src/lib/supabase.ts`) · `isInitializing` กัน redirect ผิดจังหวะ

**ProtectedRoute ใช้กับ:** `/profile` `/notifications` `/rewards` `/viral` `/voice-demo` และ **`/orders` (เพิ่มรอบนี้)**
`/checkout` มี gate ในตัวเอง (`CheckoutPage.tsx:96-103`)

**Order creation:** RPC `create_order_with_items` — `v_uid := auth.uid()` · `GRANT EXECUTE ... TO authenticated` เท่านั้น → **guest สั่งไม่ได้โดย design**

**Guest tracking:** migr 050 `REVOKE SELECT orders FROM anon` + RPC `track_order(order_number, phone)` (rate limit 5 fail/15 นาทีต่อเบอร์ + anti-enumeration)

---

## 4. Edge Functions ที่เกี่ยวข้อง

| EF | สถานะ |
|---|---|
| `phone-auto-login` | มี rate limit แล้วรอบนี้ (in-memory, interim) · prod อัปเดต 2026-10-11 |
| `sms-send` | CODE-READY, **AWAITING PROVIDER CREDENTIALS** — ต้อง `SMS_PROVIDER`/`SMS_API_KEY`/`SMS_SENDER_NAME` ไม่งั้นคืน 503 honest BLOCKED · provider `thsms_org` |
| `create-checkout` | มี single-open-PI guard (idempotent checkout) |
| `omise-checkout` | "never create a second charge" |
| `omise-webhook` | HMAC-SHA256 `Omise-Signature` + constant-time compare |
| `omise-refund` | `Idempotency-Key` + ledger |

**ห้ามแตะ Payment Authority / Order State Machine (`transition_order_status`) เพียงเพื่อให้ Guest Checkout ผ่าน** (Owner OD-8)

---

## 5. งานที่ทำเสร็จรอบนี้ (2026-10-12 รอบ 2)

| กลุ่ม | ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|---|
| **P1 — SF-04** | `src/lib/authRecovery.ts` (ใหม่) | `sendPasswordReset` (กัน account enumeration — "User not found" ตอบสำเร็จเสมอ) · `updatePassword` · `canUpdatePassword` |
| | `src/pages/ResetPasswordPage.tsx` (ใหม่) | ตั้งรหัสผ่านใหม่หลังกดลิงก์จากอีเมล · รอ session จาก `detectSessionInUrl` · **ไม่รับ uid/email จาก URL** (กัน IDOR by design) |
| | `src/pages/login/LoginPage.tsx` | ปุ่ม "ลืมรหัสผ่าน?" + โหมด forgot + map `ERR_RATE_LIMITED` |
| | `src/App.tsx` | route `/reset-password` |
| **P1 — SF-08** | `src/App.tsx` | `/orders` ครอบด้วย `ProtectedRoute` (defense in depth) |
| **P0-interim — SF-01** | `supabase/functions/phone-auto-login/rateLimit.ts` (ใหม่) | pure module: sliding window · `QUICK_LOGIN_PHONE_RULE` 5/15นาที · `QUICK_LOGIN_IP_RULE` 20/ชม. · `clientIpOf` · `sweep` กันหน่วยความจำรั่ว |
| | `supabase/functions/phone-auto-login/index.ts` | wire rate limit → 429 + `Retry-After` |
| | `e2e/launchVerify.cjs` | L2 expectation: `/orders` เป็น auth-gated แล้ว → canonical `/login` |
| **tests** | `src/__tests__/accountRecovery.test.ts` (ใหม่, 16 tests) | enumeration กัน · redirectTo · password length · rate limit boundary/滑动/แยกคีย์/IP สูงกว่าเบอร์/sweep |

**gates (ก่อน commit):** `lint = 0` · `vitest 74 ไฟล์ / 802 tests ผ่าน` · `build = 0`

### 5.1 สิ่งที่ **ยังไม่ได้ทำ** และทำไม

| งาน | เหตุผลที่เลื่อน |
|---|---|
| OTP (ออก + ยืนยัน) | **BLOCKED** — ต้อง Owner provision `SMS_*` secret ให้ EF `sms-send` ก่อน |
| Quick Login ใช้ OTP ก่อนออก session | ขึ้นกับ OTP ข้างบน |
| Guest Checkout (ทางเลือก A) | ขึ้นกับ OTP + ต้องแก้ `no_user_id = 3` แถวก่อน |
| Facebook OAuth / Passkeys | P3/P4 ตาม Owner — ไม่ขวางเส้นทางหลัก |

---

## 6. บทเรียนจาก harness รอบก่อน (กันทำซ้ำ)

1. `<link rel="canonical">` ไม่ใช่ visible element → `waitForSelector` ต้องใช้ `{ state: 'attached' }`
2. ข้อความตัวเองในแชต ≠ คำตอบ และ indicator `Bite กำลัง…` ก็ ≠ คำตอบ — ต้องกรองทั้งสองอย่าง
3. `/orders` และ `/notifications` เป็น ProtectedRoute → เกสต์ต้องได้ canonical `/login`
4. console `[getOrder] 42501` บน `/track` คือ **control flow ที่ตั้งใจ** (fallback ไป phone gate) ไม่ใช่ defect

---

## 7. หลักฐาน production ที่มีอยู่

| รายการ | ไฟล์ |
|---|---|
| production verification 8/8 PASS | `e2e/launch-verify.json` + `e2e/screenshots/launch-*.png` |
| harness | `node e2e/launchVerify.cjs` (read-only, guest-safe) |
| production DB read-only probe | `node e2e/dbq.cjs "<SQL>"` (ใช้ `SUPABASE_ACCESS_TOKEN` จาก `.env.local`) |

---

## 8. สิ่งที่ต้องให้ Owner ทำ (ครบทุกขั้นตอนใน `docs/BMB_OWNER_LAUNCH_CHECKLIST.md`)

1. **ตั้ง `SMS_*` secret** + ทดสอบส่ง SMS จริง 1 ข้อความ → เปิดทาง P0 (OTP) และ P2 (Guest Checkout)
2. ตรวจ Email Confirmation ใน Dashboard + ทดสอบกู้คืนรหัสผ่านจริง
3. ทำ Omise TEST E2E ทุกสถานะ + ตรวจ webhook
4. GPS matrix บนมือถือจริง (เคส 1–4 ทำได้เลย)
5. Copy 7 วัน (`theater_daily_copy`)
6. ลบ/noindex `bitemebaby-5f7.pages.dev` (build แช่แข็ง ไม่มี `ERR_TIMEOUT`)
7. Omise LIVE onboarding
8. ตัดสินใจ provenance column (optional)
9. ยืนยัน revision hash ของ EF

---

## 9. ข้อเท็จจริง vs สมมติฐาน

**ยืนยันแล้วจากหลักฐานจริง:** ไม่มีพิกัด 0,0 ใน production · 33/37 เป็น phone-keyed · `signInWithOAuth`=0 · `resetPasswordForEmail` มาก่อนรอบนี้=0 · `create_order_with_items` GRANT authenticated เท่านั้น · CI run#394 success · gates รอบนี้เขียว

**ยังเป็นสมมติฐาน (ห้ามอ้าง):** ผล Omise TEST จริง · ต้นทุน/วงเงิน OTP จริงของ THSMS · สถานะ Email Confirmation บน dashboard · ตัว revision hash ของ EF · ความพร้อมของ Supabase passkeys

**ต้องให้ Owner ตัดสินใจ/ยืนยันเท่านั้น:** provision SMS secret · ตรวจ Email Confirmation · Omise TEST · GPS matrix · Facebook scope · Passkeys timing · provenance column · ข้อมูล test ใด ๆ ต้องผ่านช่องทางเหมาะสม ห้ามวางในแชตสาธารณะ/ไฟล์ที่ commit ได้

