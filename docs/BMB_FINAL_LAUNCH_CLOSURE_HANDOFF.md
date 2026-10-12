# BMB — FINAL LAUNCH CLOSURE HANDOFF (2026-10-12)

> เอกสารทำงานสำหรับแชตถัดไป — อ่านเล่มนี้แล้วทำงานต่อได้ทันทีโดยไม่ต้อง audit ใหม่ทั้งหมด
> **ห้าม**ใส่ secrets/test passwords/payment credentials/ข้อมูลลูกค้าระบุตัวบุคคลในเอกสารนี้

---

## 1. ตรวจสถานะล่าสุด

- **วันที่/เวลาตรวจ:** 2026-10-12 ~09:00–10:00 (ICT) — รอบ "Login UX + final launch closure"
- รอบก่อนหน้า (2026-10-12 เช้า) = CR-4 production guest-surface E2E → ผลอยู่ §9
- รายงานอ้างอิงก่อนหน้า: `BMB_CUSTOMER_JOURNEY_RECOVERY_GATE_2026-10-10.md` (§16 matrix ต้นแบบ) · `BMB_STATUS_CLOSURE_2026-10-09.md` · `BMB_HANDOFF_AI_AUTOMOTION_AUDIT_2026-10-07.md` (เก่า เฉพาะ AI/automotion)

## 2. Git / worktree / commits รอบนี้

| ค่า | ค่าจริง (ตรวจอีกครั้งก่อนเริ่มงาน) |
|---|---|
| HEAD เริ่มรอบนี้ | `255e677` (main — ไม่ใช่ `8a3de07` ตามรายงานก่อน; เหนือ 4 commits) |
| branch / remote | `main` / `git@github.com-bmb:bitemebaby2016-coder/bmb.git` |
| stash | `stash@{0}: local-edits-before-sync-2026-09-21` — **ห้ามแตะ** คงเดิม |
| worktree untracked | `e2e/screenshots/cr4-*.png` (evidence CR-4) · รูป `public/**` ที่ Owner วางไว้ (ไม่ commit — ไม่ใช่ของรอบนี้) |

**Commits รอบ CR-4 (ก่อนหน้ารอบนี้):**
- `434eb7c` fix(theme): repair dark-theme selectors (65 ตัว) + `vitest.config.ts` css:true + `themeCss.test.ts`
- `255e677` test(e2e): CR-4 production guest-surface harness + results (`e2e/cr4ProdE2E.cjs`, `e2e/cr4-prod-e2e.json`) — CI #392 success

**Commits รอบนี้:**
- `5cc693a` fix(launch): login UX returnTo, SEO route meta, AI chat timeout, GPS coords unwrap (11 ไฟล์, gates ทั้งสามเขียวก่อน commit — §12)
- commit ที่ 2 = เอกสาร handoff นี้เอง (hash ดู `git log -2`)

## 3. โค้ดที่แก้ในรอบนี้ (ทุกไฟล์ตรวจซ้ำจาก source จริง ไม่เชื่อรายงานเก่า)

### 3.1 SEO routes (ซ่อม defect จริงที่ตรวจพบ)
| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/lib/seo.ts` | เพิ่ม `getOrdersMeta()` `/notifications` `/reviews` `getReviewDetailMeta(productId)` — ก่อนหน้าไม่มี meta ของ4 routes เลย |
| `src/components/SeoHelmet.tsx` | เพิ่ม `TrackOrderSeo` / `ReviewDetailSeo` — อ่านพารามิเตอร์จริงด้วย `useParams()` |
| `src/App.tsx` | แทน `getOrderTrackMeta(':orderNumber')` (literal canonical `.../track/:orderNumber` ถูกยิงขึ้น Google จริง — ยืนยันจาก source ก่อนแก้) ด้วย `<TrackOrderSeo/>` · เพิ่ม SEO entries `/orders` `/notifications` `/reviews` `/reviews/:productId` |
| `src/__tests__/seo.test.ts` | +10 tests: canonical ไม่มี placeholder, meta 4 ตัวใหม่, **source-contract test** กัน regression (สตริง `getOrderTrackMeta(':orderNumber')` ห้ามกลับมาใน App.tsx) |

Policy: `/reviews/:productId` canonical → `/reviews` (thin param page — ตาม precedent `/payment/:orderNumber` → `/checkout`)

### 3.2 Chat-hang (root cause จริง = ไม่มี timeout เลยในสาย AI)
- `src/lib/aiService.ts`:
  - ค้นพบ: ไม่มี `AbortSignal`/timeout ที่ใด — `functions.invoke('ai-proxy')` ค้าง = Promise ค้าง = ปุ่มแชต disable ตลอดกาล · `chatWithAIStream` ไม่มี caller ใน production (TalkToBite ใช้ `chatWithAI` blocking)
  - เพิ่ม: `CHAT_ATTEMPT_TIMEOUT_MS=30s` · `CHAT_TOTAL_TIMEOUT_MS=60s` · `CHAT_STREAM_IDLE_TIMEOUT_MS=20s` · `CHAT_CONTEXT_TIMEOUT_MS=8s` — ทุก attempt time-box, stream ตัดจริงด้วย `AbortController` (total + idle), ทั้งสาย fallback ผูก deadline เดียว → **ไม่มีทางเกิน 60s**
  - retry ยังจำกัดเดิม (model A → model B → fallback ข้อความไทย) — ไม่มี unbounded retry
  - `options` ถูกส่งต่อตอน fallback (เดิม `voiceMode` หาย)
- `src/__tests__/aiChatTimeout.test.ts` (ใหม่, 4 tests): invoke ค้าง → fallback ใน budget · SSE stall → abort จริง + settle · path สุขภาพดีไม่ช้าลง/ไม่พัง · ตรวจค่า budget default

### 3.3 Login UX (ลดขั้นตอนลูกค้าเก่า — root cause จากการตรวจจริง)
Root cause ที่ยืนยันแล้ว (ไม่ใช่ "แค่ UI"):
1. ** mất intent** — `ProtectedRoute` + Checkout redirect ไป `/login` โดยไม่ส่ง path เดิม → หลัง login `finishLogin` เสมอ `navigate('/')` → ลูกค้าต้องเดินกลับ checkout/orders เอง
2. **ไม่มี returnTo / already-auth redirect** — ผู้ใช้ที่มี session ยังเห็นฟอร์ม login
3. **ที่อยู่ไม่ถูกคืนมาจากโปรไฟล์** — `mapUserToCustomer` ตั้ง `default_*=0/''` ไม่ query อะไรเลย · checkout อ่านเฉพาะ `locationStore` (localStorage ต่อเครื่อง) → อุปกรณ์ใหม่ = กรอกใหม่ทุกครั้ง ทั้งที่ EF เก็บ `customers.default_address_detail` ไว้แล้ว
4. quick-login form มี `bmb_quick_profile` ใน localStorage อยู่แล้ว (same-device OK) — คงเดิม ไม่แตะ

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `src/App.tsx` | `ProtectedRoute` ส่ง `state={{ from: pathname+search }}` |
| `src/pages/CheckoutPage.tsx` | guest redirect → `/login` พร้อม `state.from='/checkout'` |
| `src/pages/login/LoginPage.tsx` | อ่าน `returnTo` · redirect ออกถ้า session อยู่แล้ว (case A, รอ `isInitializing`) · `finishLogin` → `returnTo \|\| '/'` · เรียก `restoreProfileAddress()` หลัง login สำเร็จ · map error `ERR_TIMEOUT` เป็นข้อความไทย |
| `src/store/authStore.ts` | เพิ่ม `restoreProfileAddress()` — อ่าน `customers.default_address_detail` ของตัวเอง (RLS own-read) → เติม `locationStore` **ข้อความที่อยู่เท่านั้น** |
| `src/lib/locationLogin.ts` | `quickLoginByPhone` ครอบ invoke ด้วย timeout 30s → `ERR_TIMEOUT` (ฟอร์มไม่แข็งค้าง) · **P1 fix**: `getGpsLocation` gps-branch unwrap `pos.coords` (browser shape จริง) + กัน (0,0) — ก่อนหน้า gps-branch ตายใน browser จริงเสมอแล้ว fallback IP เงียบ ๆ (evidence: CR-4 S4b) |
| `src/__tests__/loginUx.test.ts` (ใหม่, 7 tests) | restore ข้อความ · ไม่มอบ trust provenance (CR-2) · ไม่ทับข้อมูลในเครื่อง · no-op เมื่อไม่มีข้อความ · +3 tests regression gps-branch (coords shape/legacy/(0,0)) |

ข้อจำกัดโดยเจตนา (สำคัญสำหรับแชตถัดไป): **ไม่คืนพิกัด default_*** เพราะ migration 015 ไม่มีคอลัมน์ provenance — CR-2 ห้ามมอบ trust แบบพิสูจน์ไม่ได้ และ EF เก่าบน production เคยเขียน `default_*=0,0` (NULL ISLAND) ห้ามเอามาใช้เด็ดขาด. ถ้าต้องการ restore พิกัดจริง = ต้องเพิ่มคอลัมน์ provenance ก่อน (Owner approve — ดู §14)

## 4. สถาปัตยกรรม Login จริง + flow หลังปรับ

**2 ทางเข้าระบบ (จริงจาก source):**
1. **Email/รหัสผ่าน** — `authStore.login` → `supabase.auth.signInWithPassword` (Supabase Auth เป็นเจ้าของ identity — localStorage users ถูกถอดออกตั้งแต่ P0-2)
2. **Quick login (ด่วน)** — ชื่อ+เบอร์+ตำแหน่ง → EF `phone-auto-login` (phone-keyed email `<phone>@phone.bmb.local` + mint session) → `authStore.loginByLocation` → `supabase.auth.setSession(tokens)`

**ไม่มี Facebook/Google/OAuth login ในโค้ด** — ค้น `signInWithOAuth|facebook|oauth` ทั้ง src แล้ว: มีแค่การอ้างถึง FB ใน marketing/FAQ/schema เท่านั้น (§6)

**Session:** `persistSession+autoRefreshToken+detectSessionInUrl` = true (`src/lib/supabase.ts`) · `authStore.checkAuth` restore ตอนบูต + `isInitializing` กัน redirect ผิดจังหวะ (F-02) · ProtectedRoute/AdminRoute รอ isInitializing ก่อนตัดสิน

**Flow หลังปรับรอบนี้:**
- มี session แล้วเปิด `/login` → redirect ไป `returnTo || '/'` ทันที (case A)
- Guest โดน ProtectedRoute/Checkout → `/login` + `state.from` → login สำเร็จ → **กลับหน้าเดิม** (แทนการเสมอ `/`) (case B/D)
- Login สำเร็จ → `restoreProfileAddress()` (best-effort) เติมข้อความที่อยู่จาก `customers` row (case D)
- Quick login client มี timeout 30s — ฟอร์มไม่แข็งถาวรเมื่อ EF ค้าง
- Cart อยู่รอดข้าม reload แล้ว (`cartPersistence.ts` D01 — hydrate + pre-checkout revalidate, server re-derive ราคาตอนสร้างออเดอร์ RPC 025) — ตรวจแล้ว ไม่แก้

**ตรวจแล้วและ "ไม่ใช่ปัญหา":** session persistence/refresh ตาม pattern มาตรฐาน Supabase · order history ใช้ได้หลัง auth (`/orders` ProtectedRoute) · RLS customers own-read มีจริง (migr 006)

## 5. `phone-auto-login` EF — สถานะ 5 ข้อ (ห้ามสับสน)

| ข้อ | สถานะ | หลักฐาน |
|---|---|---|
| 1. local env มีตัวแปรจริง | **มี** (Owner ยืนยัน; ไม่พิมพ์ค่าใด ๆ ลงเอกสาร) | — |
| 2. local build ใช้ตัวแปรนั้น | client ไม่เก็บ secret ฝั่ง EF (ดีไซน์ถูก — service key อยู่ใน EF env เท่านั้น) | `Deno.env` ในไฟล์ EF |
| 3. EF config ครบไหม | **ยังยืนยันไม่ได้จากที่นี่** — ต้อง Owner รัน (ห้าม deploy/แตะ secrets เอง) | คำสั่งด้านล่าง |
| 4. Prod revision = source ล่าสุดไหม | **ไม่ตรง** — prod ยัง rev เก่า `e49c24b` · local = CR-3 fixed (เขียน `default_*` เฉพาะ trusted+valid) | CR-4 รอบก่อน |
| 5. Auth flow ผ่าน test จริงหรือยัง | **ยัง** — E2E matrix #9 BLOCKED | §9 |

**คำสั่งให้ Owner (ยังไม่ได้ทำ — ต้องมีอำนาจ prod):**
```bash
supabase secrets list          # ตรวจว่า key มี — แสดงเฉพาะ presence ห้ามพิมพ์ค่า
supabase functions list        # ตรวจ revision ที่ deploy อยู่
supabase functions deploy phone-auto-login --project-ref ivkdfognyiwjcmrhcnwz   # เมื่อพร้อม — EF-before-frontend
```
**ข้อค้นพบด้าน security จาก source จริง (ต้องตัดสินใจก่อนเปิดร้าน):**
- **โทรศัพท์ = ปัจจัยเดียว** (มี TODO OTP ในไฟล์) — ขัดมาตรฐาน "ห้ามใช้เบอร์อย่างเดียวเป็นหลักฐานความเป็นเจ้าของ" → ต้อง OTP (SMS provider) หรือ Owner ยอมรับความเสี่ยงเป็นลายลักษณ์อักษร
- **ไม่มี rate limiting ใน function** — กัน spam/lockout ไม่ได้
- **ทุก quick login สุ่มรหัสผ่านใหม่ + PUT admin** — ผู้ใช้ email/password เดิมโดนเปลี่ยนรหัสเงียบ ๆ (รู้เบอร์ = เข้า account ได้)
- `verify_jwt=false` + `CORS *` — ไม่มี captcha/turnstile

## 6. Facebook TEST

**ข้อเท็จจริง:** แอป **ไม่มี Facebook Login อยู่ในโค้ด** — ไม่มี `signInWithOAuth`, ไม่มีปุ่ม, ไม่มี callback route (ค้นทั้ง `src/` แล้ว). test user ที่ Owner เตรียมไว้จึง **ยังใช้ทดสอบอะไรไม่ได้** — สถานะคือ NOT IMPLEMENTED ไม่ใช่ "รอ test"

- **สถานะ: NOT IMPLEMENTED — Owner decision required** (เพิ่มจริง/ตัดออกจาก scope เปิดร้าน)
- ถ้าจะเพิ่ม: (1) เปิด provider Facebook ใน Supabase Auth dashboard (2) callback URL ใน Facebook app (3) `supabase.auth.signInWithOAuth({ provider:'facebook', options:{ redirectTo } })` + callback route (4) กัน duplicate account (link ด้วย email เดิม) — ต้องมีเวลา test จริง ไม่ควรทำลวก ๆ ก่อนเปิดร้าน
- ห้ามอ้าง PASS จาก build/mock — ต้อง test user จริง + browser จริงเท่านั้น

## 7. Omise — TEST กับ LIVE แยกสถานะ

**ฝั่งโค้ด (ตรวจจริง — ครบชิ้นส่วน):** EF `omise-checkout` · `omise-webhook` · `omise-refund` · `channel-webhook` (+`stripe-webhook` legacy) · `src/lib/omise.ts` · tests 5+ ไฟล์ (omise / omiseCheckoutLogic / omiseCutover / omiseRefundLogic / omiseWebhookSignature / paymentStateMachine / paymentExceptions) — ผ่านใน suite รอบนี้ (§12). จาก source: webhook signature verify มี · server-side amount/currency check · idempotency/ledger · ไม่เชื่อผลจาก frontend

| สถานะ | ข้อสรุป |
|---|---|
| **TEST** | Owner แจ้งว่าอนุมัติแล้ว (ข้อมูลจาก Owner — ไม่ได้ตรวจสอบจาก dashboard เอง) · โค้ดพร้อม · **checkout E2E จริงผ่าน browser = ยังไม่ได้ทำ** (Owner ทำตาม §12.3) |
| **LIVE** | **ยังไม่พร้อม** — รอ onboarding/identity verification ฝั่ง Omise (Owner) · ห้ามเงินจริง/ทดสอบเงินจริงจนกว่า Owner อนุมัติ · ห้ามเปลี่ยน Production credentials เอง · TEST ผ่าน ≠ LIVE พร้อม |

`recp_test_...` / TEST BANK = ข้อมูลประกอบการ test ฝั่ง Owner เท่านั้น — ห้าม hard-code, ห้ามบันทึกในเอกสารนี้


## 8. GPS / Delivery Test Matrix — ให้ Owner ทำบนมือถือจริง (Android)

**อุปกรณ์:** มือถือ Android จริง + Chrome · **ก่อนเริ่มแต่ละเคส:** Settings → Apps → Chrome → Permissions → Location → "Remove permissions" (หรือ reset ผ่าน Settings → Location → App permission) · **จุดเทส:** หน้า `/login` แท็บ ⚡ เข้าสู่ระบบด่วน (guest ทำได้) และ `/checkout` (ต้อง login — ใช้บัญชีทดสอบ) · **ห้ามสั่งออเดอร์จริง/จ่ายเงินจริง** เพื่อเทส GPS — ดูแค่ badge/ข้อความ/ค่าจัดส่งที่แสดง

**ความสำคัญ:** เคส 1–4 (guest surface) มีหลักฐาน production แล้วบางส่วนจาก CR-4 (§9) — เคส 5–10 ต้องใช้หน้า checkout จริง

| # | เคส | ขั้นตอน | ควรเห็น / ผ่านเมื่อ | ส่งกลับ |
|---|---|---|---|---|
| 1 | อนุญาต Location สำเร็จ | เปิด `/login` → แท็บด่วน → กด 📍ตำแหน่งของฉัน → ยอมรับ permission | badge = "ตำแหน่งของฉัน: **ตำแหน่งจาก GPS** · ละติจูด,ลองจิจูด" (เลขใกล้ตำแหน่งจริง) — **ห้าม**ขึ้น "IP/ครัว" เมื่อ GPS ทำงาน | screenshot badge |
| 2 | ปฏิเสธ permission | ขั้นตอนเดิม → ปฏิเสธ | badge บอกแหล่งที่มาจริง (IP/ครัว) — **ห้าม**มีคำว่า "GPS" ใน badge | screenshot badge |
| 3 | ปิด Location services ของเครื่อง | ปิด Location ระดับเครื่องก่อนกด📍 | ไม่ค้าง "กำลังระบุตำแหน่ง…" เกิน ~30วิ · badge บอก IP/ครัวตามจริง · ฟอร์มใช้ต่อได้ | screenshot + บอกเวลารอ |
| 4 | Browser timeout / อ่านพิกัดไม่ได้ | เปิด location แต่ยืนในที่รับสัญญาณ GPS ไม่ได้ (ในบ้านลึก) กด📍 | จบภายใน ~30–60 วิ พร้อมแหล่งที่มาจริง หรือข้อความ "ไม่พบตำแหน่ง" — ห้ามค้างถาวร | screenshot |
| 5 | หมุดแผนที่เลือกเอง (checkout) | Login → `/checkout` → ใช้แผนที่/ปักหมุด manual | จุดขึ้น label ว่า **manual/ปักหมุด** (ไม่เรียก GPS) · กดยืนยันจุดได้ · เฉพาะ gps/manual เท่านั้นที่สั่งได้ต่อ | screenshot หมุด+label |
| 6 | ใช้ที่อยู่เดิม (saved) | เคส1 สำเร็จก่อน → logout/reload → กลับ checkout | เห็นจุดที่บันทึกไว้ label "ใช้พิกัดที่บันทึกไว้" + ต้องกดยืนยันก่อนสั่ง (confirmed) · ข้อความที่อยู่เติมให้ (รอบนี้เพิ่ม) | screenshot |
| 7 | เปลี่ยนจากที่อยู่เดิมไปที่อยู่อื่น | จากเคส6 ลากหมุด/กรอกที่อยู่ใหม่ | provenance เปลี่ยนตามการกระทำจริง · จุดใหม่ต้องยืนยันใหม่ | screenshot ก่อน/หลัง |
| 8 | นอกพื้นที่จัดส่ง (>5 กม. จากครัว) | ปักหมุดนอกโซนจันทบุรี | ข้อความบอกชัดว่านอกเขต — **ห้าม**โชว์ค่าจัดส่ง 0.00 หรือยอมสั่ง | screenshot |
| 9 | ค่าจัดส่ง/ระยะทางตามพิกัดที่เลือก | เคส6 (ในโซน) เปรียบเทียบกับเคส8 | ค่าจัดส่ง/ระยะทางต่างกันตามพิกัด · ค่ามาจาก server (fee ที่แสดง) | screenshot ทั้งสองเคส |
| 10 | ไม่รับพิกัด 0,0/ค่าผิดรูป | (อัตโนมัติจากระบบ — สังเกตตอนเคส2–4) | ระบบ**ไม่**เก็บ/ไม่ใช้ 0,0 เป็นที่อยู่ลูกค้า — ถ้าเห็นค่า 0,0 ที่ใด = defect แจ้งทันที | screenshot ถ้าเจอ |

**ผลจริงของ Owner กรอกในตารางนี้ (คอลัมน์เพิ่มในแชตถัดไป):** เคส / วันที่ทำ / PASS-FAIL / ไฟล์ screenshot

> หมายเหตุจาก CR-4: badge login ปัจจุบัน fallback ลำดับ GPS→IP→saved→ครัว — **พบ defect จริง**: gps-branch ของ `getGpsLocation` ไม่อ่าน `pos.coords` → ใน browser จริง **ไม่รายงาน GPS แม้ได้ permission** (พบจาก evidence production) — **แก้ในโค้ดแล้วรอบนี้** (§3.3 — unwrap ทั้ง 2 shape + unit tests) แต่ **ต้อง deploy frontend แล้ว Owner รันเคส 1 ซ้ำเพื่อยืนยันบน production**


## 9. E2E Matrix 10 กรณี — ผลจริงแยก 3 ชั้น (Local/CI · TEST · Production)

Matrix ต้นแบบ = gate §16 · หลักฐาน Production มาจากรันจริง 2026-10-12 (`e2e/cr4-prod-e2e.cjs` → `e2e/cr4-prod-e2e.json` + `e2e/screenshots/cr4-*.png`, read-only/guest-safe) · **ห้ามนับ unit test = production evidence**

| # | กรณี | Local/CI | TEST | Production |
|---|---|---|---|---|
| 1 | GPS permission denied → ไม่มี "GPS สำเร็จ" ปลอม | ✓ unit (`locationLogin`/`getTrustedGpsLocation`) | **ไม่มี environment** | **PASS ครึ่งหนึ่ง** — S4a: badge บอก "ตำแหน่งครัว (ค่าเริ่มต้น)" ตามจริง · ครึ่ง checkout (toast) = BLOCKED รอ test account |
| 2 | GPS success + mock coords → label/provenance gps | ✓ unit (handler + deliveryPointStatus) | ไม่มี environment | **FAIL (แล้วแก้แล้ว)** — S4b: permission granted แต่ badge บอก IP → root cause gps-branch ตาย → **แก้โค้ดรอบนี้** (§3.3) — ต้อง deploy แล้วรันซ้ำ · ครึ่ง checkout = BLOCKED |
| 3 | ย้ายหมุด → confirmed:false อัตโนมัติ | ✓ (`locationStore.test.ts:166-178`) | — | **BLOCKED** — อยู่ที่ /checkout (auth-gated) |
| 4 | Saved provenance ไม่ปลอมเป็น GPS | ✓ (provenance 4 tests + deliveryPointStatus) | — | **PASS ครึ่งหนึ่ง** — S4c: badge บอก IP ตามจริง ไม่มี GPS ปลอม · checkout ครึ่ง = BLOCKED |
| 5 | ไม่มี trusted point → สั่งไม่ได้ (orderable:false) | ✓ (test orderable:false + handlePlaceOrder guard) | — | **BLOCKED** (checkout auth-gated) |
| 6 | Fee RPC fail ≠ 0.00 | ✓ (feeUiState error label test) | — | **BLOCKED** (checkout) |
| 7 | นอกโซน → server authority  reject | ✓ | — | **BLOCKED** (fee RPC ต้องมี order จริง) |
| 8 | PromptPay QR + manual | ✓ (assets + state machine) | — | **PARTIAL** — QR asset 200 + bytes ตรง local ทุก byte (S5) · flow runtime (สแกนจ่ายจริง) = BLOCKED รอ Owner Omise TEST (§12.3) |
| 9 | Quick login ไม่มี coords → default_* IS NULL | ✓ (buildQuickLoginCoords 6 tests + shouldPersistDefaultCoords 14) | — | **BLOCKED** รอ test account + DB read · **ความเสี่ยง live**: prod EF ยัง rev เก่า → quick login ไม่มี coords → `Number(null)=0` → `default_*=0,0` NULL ISLAND ทุกครั้ง (ดู §5) |
| 10 | Production DB aggregate audit (ไม่แตะ PII) | — | — | **BLOCKED** — รอ Owner approval SELECT-only |

**สรุป Production evidence ณ 2026-10-12: guest surface 6/7 scenario PASS (1 FAIL จริง = #2 ที่แก้แล้ว) · matrix 10 ข้อ = 2 ครึ่งทาง, 1 แก้แล้วรอ deploy, 6 BLOCKED (ต้อง test account/DB/Owner)**

 Harness อยู่ที่ `e2e/cr4ProdE2E.cjs` (รัน: `node e2e/cr4ProdE2E.cjs` — ใช้ Chrome channel, mobile viewport, ห้ามแก้ production) — ถ้ามี test account ให้เพิ่ม scenario ได้โดยไม่ต้องสร้าง harness ใหม่

## 10. สถานะงานค้างอื่น ๆ (ตรวจจาก source จริง 2026-10-12)

- **SEO routes** — defect จริง 2 ตัวถูกแก้รอบนี้: literal `:orderNumber` canonical (ยิง `https://biteme-baby.com/track/:orderNumber` ขึ้น Google จริง) + 4 routes ไม่มี meta (`/orders` `/notifications` `/reviews` `/reviews/:productId`) → แก้แล้ว + tests กัน regression (§3.1) · `/payment/:orderNumber` ตั้งใจ canonical → `/checkout` (เดิมอยู่แล้ว ไม่แตะ)
- **Chat-hang** — root cause จริง: **ไม่มี timeout/AbortSignal ในสาย AI เลย** (ไม่ใช่ที่ mascotService — ไฟล์นั้นเป็น art-override ล้วน) · `chatWithAIStream` ไม่มี caller production (TalkToBite ใช้ `chatWithAI`) · แก้แล้วทั้ง 2 เส้นทาง + deadline รวม 60s + tests (§3.2)
- **Copy 7 วัน (`theater_daily_copy`)** — ระบบทำงานถูกต้อง (theaterDailyCopy.ts + starter template + merge chain daily→editorial→default + กัน copy รั่วเข้า SEO มี test) · **ยังไม่มีข้อมูลจริง** เพราะต้อง Owner/แอดมินสร้าง: ขั้นตอน = login `/admin` → Settings → ช่อง key กรอก `theater_daily_copy` (ระบบเติมเทมเพลต 7 วันให้) → ตรวจแก้ → **Save** → rotation ขึ้นหน้าร้านทันที (ห้าม AI แก้ business settings แทน Owner)
- **Admin Dashboard / Graphite Theatre / Ambient Music** — **ทำแล้ว** ไม่ค้าง: `AdminNav` sidebar ทุก /admin route (`6a105d9`) · Graphite theme (`html[data-theme=graphite]` — dark selector fix `434eb7c` ยืนยัน runtime แล้ว) · `AmbientMusicToggle` + `ambientMusic.ts` + voice ducking + tests (`ambientMusic.test.ts` ผ่าน)
- **Cloudflare Pages `bitemebaby-5f7.pages.dev`** — ตาม CR-4 context: สแตนด์อโลน build เก่า ห้ามใช้ visual QA · production จริง = `biteme-baby.com` (auto-deploy จาก main) — ยังไม่มีข้อสรุปเรื่องจะลบ/กันไม่ให้ index — ถือเป็น open item เล็ก ๆ


## 11. สิ่งที่ยังเหลือก่อนเปิดร้าน (เรียงตามความสำคัญ)

### P0 — blocker รับเงินจริง/รับลูกค้าจริง
1. **Deploy EF `phone-auto-login` rev ใหม่** — prod ยัง rev เก่า → quick login ทุกครั้ง persist `default_*=0,0` (NULL ISLAND) — คำสั่ง §5 · **ห้ามให้ลูกค้าจริงใช้ quick login ก่อน deploy**
2. **ตัดสินใจ security ของ quick login** — single-factor phone + ไม่มี rate limit + สุ่มรหัสผ่านใหม่ทุกครั้ง (รู้เบอร์ = เข้าบัญชีได้) → OTP (ต้อง SMS provider) หรือยอมรับความเสี่ยงเป็นลายลักษณ์อักษร — Owner เท่านั้น
3. **Omise TEST end-to-end ผ่าน browser จริง** (§12.3) พร้อมตรวจ webhook/order status หลังชำระ — ยังไม่มีหลักฐานการจ่ายจริงแม้โค้ดจะผ่าน unit
4. **Matrix #3,5,6,7 + ครึ่ง checkout ของ #1,#2,#4,#8,#9** — ต้อง test account/OTP จาก Owner (hard-stop: ห้ามใช้บัญชี/ข้อมูลลูกค้าจริง)
5. **GPS matrix §8 เคส 1–4 บนมือถือจริง** — ทำ **หลัง** deploy frontend รอบนี้ (มีตัวแก้ gps-branch แล้ว) + เคส 5–10 หลังมี test account
6. **Omise LIVE** — ห้ามเปิดรับเงินจริงจน onboarding/identity verification จบและ Owner อนุมัติโดยเฉพาะ (TEST ผ่าน ≠ LIVE พร้อม)

### P1 — ควรปิดก่อนวันเปิด หรือเร็วหลังเปิด
1. `getGpsLocation` gps-branch — **แก้แล้วรอบนี้** — เหลือ deploy + Owner รันเคส 1 ซ้ำ + S4b
2. SEO literal/missing meta — **แก้แล้วรอบนี้** — หลัง deploy ตรวจด้วย `curl`/Search Console ว่า canonical ใหม่ถูก index
3. Chat timeout — **แก้แล้วรอบนี้** — หลัง deploy ทดสอบแชตบนมือถือจริง (ส่งข้อความตอน network แย่ ต้องได้คำตอบ ≤ 60 วิ ไม่ใช่ค้าง)
4. Facebook Login — เลือก: **ตัดออกจาก scope เปิดร้าน (แนะนำ)** หรือวางแผนเพิ่มทีหลังพร้อม test user จริง (§6)
5. verify `GRANT SELECT ON customers TO authenticated` บน production — ถ้าไม่มี `restoreProfileAddress` จะทำงานเงียบ ๆ (ไม่พัง) แต่ลูกค้าเก่าจะยังต้องกรอกที่อยู่ — ถ้าจะให้ทำงาน Owner เพิ่ม GRANT (รูปแบบ migr 102) — **การแก้สิทธิ์ DB = Owner approve เท่านั้น**
6. Copy 7 วัน — Owner สร้าง+Save `theater_daily_copy` (§10)

### P2 — หลังเปิดได้
1. `bitemebaby-5f7.pages.dev` — กันไม่ให้ index (noindex/ลบ) กันสับสน
2. `/payment/:orderNumber` ใช้ checkout meta (canonical ถูกแล้ว แต่ title ไม่ unique ต่อ order) — minor
3. Roadmap hardening `phone-auto-login` (captcha/turnstile + rate limit) — หลังตัดสินใจ OTP
4. ถ้าต้องการ restore **พิกัด** จาก server (ไม่แค่ข้อความที่อยู่) → เพิ่มคอลัมน์ provenance บน `customers` ก่อน (Owner approve schema) แล้วค่อยขยาย `restoreProfileAddress`


## 12. Testing gates — คำสั่งและผลล่าสุด (รอบ 2026-10-12)

### 12.1 Automated (AI Dev รันได้เอง)
```powershell
npm run lint        # ESLint ทั้ง repo
npm test            # vitest run — ทั้ง suite (jsdom, offline mock supabase)
npm run build       # tsc && vite build
```
**ผลรอบยืนยันสุดท้าย (2026-10-12, ก่อน commit):** `lint=0 · vitest 783/783 ผ่าน (73 ไฟล์) · build=0` — ผลเต็มอยู่ `%TEMP%\bmb_gates_{lint,test,build}.log`
- E2E production harness (read-only): `node e2e/cr4ProdE2E.cjs` → `e2e/cr4-prod-e2e.json` (ผล 2026-10-12: 6/7 PASS, 1 FAIL จริงถูกแก้แล้ว)
- CI: push ทุกครั้ง trigger `.github/workflows/ci.yml` (lint→test→build) — ตรวจอีกทีผ่าน GitHub Actions API หลัง push (ไม่มี gh CLI บนเครื่องนี้)

### 12.2 สิ่งที่ test ใหม่รอบนี้พิสูจน์แล้ว ( และสิ่งที่ยังไม่พิสูจน์)
- พิสูจน์แล้ว (offline): canonical ไม่มี placeholder · meta 4 routes · chat จบภายใน deadline แม้ proxy ค้าง · stream abort จริง · restore ที่อยู่ไม่ให้ trust · gps-branch อ่าน coords shape จริง · (0,0) ถูกปฏิเสธ
- **ยังไม่พิสูจน์ (ต้อง production/อุปกรณ์จริง):** การ deploy แล้ว canonical ใหม่ถูกเสิร์ฟจริง · chat บนมือถือจริง · quick login จริง · การจ่าย Omise จริงทุก status — ห้ามอ้าง unit test มาแทนหลักฐาน runtime เด็ดขาด

### 12.3 ขั้นตอน Owner — Omise TEST ผ่าน browser จริง
1. เตรียม: account ทดสอบ (ยังไม่มี — อยู่ในเพดาน P0#4) + test mode key ฝั่ง Owner (ห้ามส่งให้ AI, ห้ามบันทึกที่ไหน)
2. เปิด `biteme-baby.com` บนมือถือ/เดสก์ท็อป → login ด้วยบัญชีทดสอบ → สั่งเมนูจริงในโซน → checkout → เลือกบัตรเครดิต/พร้อมเพย์ตามที่ Omise TEST อนุญาต
3. ทำทุกสถานะ: **จ่ายสำเร็จ** · **จ่ายครึ่งทาง/ปิดหน้า** (pending) · **จ่ายแล้วยกเลิก** · **จ่ายผิด/declined** (ใช้ test card ของ Omise)
4. หลังแต่ละเคส: ตรวจ (ก) หน้า `/payment/:orderNumber` เปลี่ยนสถานะตามจริง (ข) order status ใน `/orders` (ค) ฝั่ง Admin → Orders/Payment exceptions (ง) Omise dashboard มี charge ครบ (จ) **webhook**: ฝั่ง Admin → Errors ไม่มี webhook error ใหม่
5. ส่งกลับ: screenshot หน้าจ่ายเงิน + หน้า orders ทุกสถานะ + รายการ order numbers (ไม่ต้องส่งข้อมูลบัตร)
6. ถ้า webhook ไม่เข้า: ตรวจ `omise-webhook` secret ใน Supabase secrets (presence เท่านั้น) — ห้ามเปลี่ยนเองถ้าไม่ใช่สาเหตุชัดเจน

## 13. ขั้นตอนถัดไปสำหรับแชตใหม่ (ไม่ต้อง audit ใหม่)

1. **อ่านเอกสารนี้จบก่อน** + `e2e/cr4-prod-e2e.json` (production evidence จริง) — อย่าเริ่มจากศูนย์
2. ถ้ายังไม่มี commit ของรอบนี้บน origin: ทำต่อจาก §2 (git status ก่อนเสมอ, explicit paths, ห้าม `git add .`)
3. งานที่ทำต่อได้ทันที (ไม่ต้องรอ Owner):
   - verify production หลัง CF auto-deploy: canonical ใหม่ (`curl -s https://biteme-baby.com/track/X1 | findstr canonical`) · แชต timeout จริง · badge GPS (ถ้า permission granted → ต้องขึ้น "ตำแหน่งจาก GPS" แล้ว)
   - เพิ่ม E2E scenario เมื่อมี test account ( harness มีแล้ว)
   - งาน P2 §11
4. งานที่ **ต้องรอ Owner** (ส่งรายการนี้ไปเลย): deploy EF §5 · test account/OTP §9 · GPS matrix §8 · Omise TEST §12.3 · ตัดสินใจ Facebook §6 · Save Copy 7 วัน §10 · approve GRANT customers / provenance column (§11 P1#5, P2#4) · Omise LIVE onboarding
5. กติกาเดิมทั้งหมดยังใช้: no real customer data · EF-before-frontend · no amend/force · preserve stash · no secrets in logs · production E2E = read-only · ห้ามอ้าง "พร้อมเปิดร้านจริง" จนกว่า P0 ทุกข้อมีหลักฐาน

## 14. ข้อเท็จจริง vs สมมติฐาน vs ต้องให้ Owner ยืนยัน

**ข้อเท็จจริงที่ยืนยันแล้วจากโค้ด/หลักฐานจริง (รอบนี้):**
- HEAD เริ่ม/จบ · CI #392 success (255e677) · gates รอบนี้ (ดู §12)
- ไม่มี Facebook/OAuth login ในโค้ดทั้งหมด · ไม่มี timeout ในสาย chat (ก่อนแก้) · SEO literal + meta ขาด (ก่อนแก้) · `getGpsLocation` gps-branch ตายใน browser shape จริง (ก่อนแก้ — ยืนยันด้วย production evidence S4b)
- Production EF = rev เก่า `e49c24b` (CR-4 รอบก่อน) · local EF = CR-3 fixed
- RLS customers own-read มี (migr 006) · ไม่มี provenance column (migr 015) · GRANT authenticated ไม่อยู่ใน migr 102

**สมมติฐาน (ยังไม่มีหลักฐานยืนยัน):**
- `restoreProfileAddress` จะได้ผลจริงบน production — สมมติว่าตาราง customers มี SELECT grant (ถ้าไม่มี = no-op เงียบ)
- Omise TEST "อนุมัติแล้ว" — เชื่อจากคำบอกของ Owner ไม่ได้ตรวจสอบจาก dashboard
- test user Facebook ใหม่ "พร้อมใช้" — ไม่เกี่ยวผลกับโค้ดเพราะ flow ยังไม่มี

**ต้องให้ Owner ยืนยัน/ตัดสินใจเท่านั้น:**
deploy EF · OTP/rate-limit decision · test account/OTP · Omise TEST ทำเอง (§12.3) · Omise LIVE readiness · GPS matrix บนมือถือจริง · Facebook scope · Copy 7 วัน save · DB grants/schema (provenance column) · ข้อมูล test ใด ๆ ที่ Owner จะให้ — ให้ผ่านช่องทางที่เหมาะสม ห้ามวางในแชตสาธารณะ/ไฟล์ที่ commit ได้

---

## 15. รอบ 2026-10-12 (รอบที่ 2) — ตรวจสอบหลัง deploy จริง + ปิดงานที่เหลือ

> อ่านเอกสารข้างบนจบแล้ว อ่านส่วนนี้ต่อ — เป็นรอบที่ "verify production จริง" และปิดงาน
> ที่ AI ทำได้เองให้หมด เหลือไว้เฉพาะงานที่ต้องใช้สิทธิ์/อุปกรณ์/การตัดสินใจของ Owner

### 15.1 ตรวจฐานก่อนเริ่ม

- `HEAD = origin/main = eb6b7e6` · CI `eb6b7e6` = completed/**success** (2 รอบ)
- production `biteme-baby.com` เสิร์ฟ `/assets/index-BYNsKEcM.js` ซึ่ง **มี `ERR_TIMEOUT`**
  (สตริงนี้เพิ่มเข้ามาครั้งแรกใน `5cc693a` ไม่มีใน `255e677`) → **ยืนยันว่า build ใหม่ deploy แล้วจริง**
- stash เดิม `stash@{0}: local-edits-before-sync-2026-09-21` **ไม่ถูกแตะ**
- worktree เหลือเฉพาะ screenshots evidence + รูป `public/**` ที่ Owner วางไว้ (ไม่ commit ตามเดิม)

### 15.2 สิ่งที่ทำในรอบนี้

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `e2e/launchVerify.cjs` (ใหม่) | production harness **read-only/guest-safe** 8 ข้อ — รัน `node e2e/launchVerify.cjs` → `e2e/launch-verify.json` · ไม่ login ไม่สั่งของ ไม่แก้ข้อมูล · ข้อเดียวที่ยิงออกไปคือแชต 1 ข้อความ (guest surface ปกติของหน้าแรก) เพื่อวัด deadline |
| `e2e/launch-verify.json` | หลักฐานผลรัน 2026-10-12 — **8/8 PASS** |
| `supabase/migrations/121_grants_customers_select.sql` (ใหม่) | เตรียม GRANT `SELECT ON customers TO authenticated` ตามรูปแบบ migr 102 (idempotent + verification block) — **ยังไม่ apply** รออนุมัติจาก Owner (§11 P1#5) |
| `src/lib/seo.ts` · `src/components/SeoHelmet.tsx` · `src/App.tsx` | เพิ่ม `getPaymentMeta(orderNumber)` + `<PaymentSeo/>` — `/payment/:orderNumber` title มีเลขออเดอร์จริง (canonical คงชี้ `/checkout`) ปิด §11 P2#2 |
| `src/__tests__/seo.test.ts` | +3 tests: payment meta/canonical · fallback เมื่อไม่มีเลข · source-contract ว่า `/payment` ต้องใช้ `<PaymentSeo/>` และ `robots.txt` ต้องบล็อก `/payment/*` |
| `public/robots.txt` | เพิ่ม `Disallow: /payment/*` — URL มีเลขออเดอร์ ห้าม crawl/index |
| `docs/BMB_OWNER_LAUNCH_CHECKLIST.md` (ใหม่) | เช็กลิสต์ Owner **ภาษาไทย** เรียงตามลำดับความสำคัญ — ทุกขั้นตอนมีคำสั่ง/SQL ให้ copy ไปรันได้เลย |

** gates รอบนี้ (ก่อน commit):** `lint = 0` · `vitest 786/786 ผ่าน (73 ไฟล์)` · `build = 0`

### 15.3 หลักฐาน production จริง (ห้ามแทนที่ด้วย unit test)

| ข้อ | ตรวจอะไร | ผล | รายละเอียด |
|---|---|---|---|
| L1 | `/track/LV-20261012-01` canonical จริง ไม่มี `:orderNumber` | **PASS** | canonical = `https://biteme-baby.com/track/LV-20261012-01` |
| L1b | `/track` ของ guest มี phone gate | **PASS** | ตรง migr 050 (anon ถูกปิดอ่าน `orders` → ต้องใช้ RPC) · หมายเหตุ: console ที่เห็น `[getOrder] 42501` คือ **control flow ที่ตั้งใจ** (ลองอ่านตรง ๆ แล้ว fallback ไป phone gate) **ไม่ใช่ defect** |
| L2 | meta `/orders` `/reviews` ถูกเสิร์ฟจริง | **PASS** | `/notifications` = ProtectedRoute → guest ถูก redirect ไป `/login` จึงเสิร์ฟ meta ของ `/login` — ถูกต้องแล้ว ไม่ใช่ defect |
| L3 | `/reviews/:id` → `/reviews` · `/payment/:n` → `/checkout` | **PASS** | canonical ทั้งคู่ถูก ไม่มี placeholder |
| L4 | GPS **granted** → badge ต้องบอก "ตำแหน่งจาก GPS" | **PASS** | badge = `ตำแหน่งของฉัน: ตำแหน่งจาก GPS · 10.7050, 102.1350` — **ก่อนแก้ CR-4 เคย FAIL** (S4b) → แก้ gps-branch ใน `5cc693a` แล้ว **ยืนยันซ้ำบน production แล้ว** |
| L5 | GPS **denied** → ห้ามอ้าง GPS | **PASS** | badge = `ตำแหน่งโดยประมาณ (IP) · 13.4680, 101.0953` |
| L6 | แชต production ตอบจริงภายในงบ | **PASS — 4.1 วิ** | คำตอบจริงจาก AI (`มีครับเจ้า...`) **ไม่ใช่** fallback · เห็น typing indicator `Bite กำลัง…` ระหว่างรอ · console error = 0 |
| L7 | bundle production มี `5cc693a` | **PASS** | `/assets/index-BYNsKEcM.js` มี `ERR_TIMEOUT` |

### 15.4 ข้อควรระวังสำหรับคนเขียน harness ถัดไป (บทเรียนจากรอบนี้)

1. `<link rel="canonical">` ไม่ใช่ visible element → `waitForSelector` ต้องใช้ `{ state: 'attached' }` (ไม่งั้น timeout ทั้งที่ tag อยู่จริง)
2. ข้อความตัวเองในแชต ≠ คำตอบ และ indicator `Bite กำลัง…` ก็ ≠ คำตอบ — ต้องกรองทั้งสองอย่างมิฉะนั้นได้ PASS ปลอม
3. `/notifications` เป็น ProtectedRoute — เกสต์ถูกพาไป `/login` จึงต้องคาดหวัง canonical `/login` ไม่ใช่ `/notifications`

### 15.5 สรุป P0–P2 หลังรอบนี้

**ปิดแล้ว (มีหลักฐาน production):** P1#1 GPS gps-branch · P1#2 SEO literal/missing meta · P1#3 chat timeout · P2#2 `/payment` title · P2#1 (บางส่วน) — `/payment/*` ถูกบล็อกแล้วใน production จริง

**ยังค้าง = เฉพาะงานที่ต้อง Owner เท่านั้น** — ดูครบทุกขั้นตอนใน `docs/BMB_OWNER_LAUNCH_CHECKLIST.md`:
deploy EF `phone-auto-login` · ตัดสินใจ OTP vs ยอมรับความเสี่ยง · apply migration 121 · test account/OTP · Omise TEST E2E จริง · GPS matrix เคส 1–10 บนมือถือจริง · Copy 7 วัน · Facebook scope · จัดการ `bitemebaby-5f7.pages.dev` (build แช่แข็ง เปลี่ยนจาก repo ไม่ได้) · Omise LIVE onboarding · provenance column

**ยังไม่กล่าวว่า "พร้อมเปิดร้านจริง"** — payment gate (Omise TEST จริง) + test account + EF deploy ยังไม่มีหลักฐาน


