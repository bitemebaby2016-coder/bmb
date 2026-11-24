# 🍽️ BITE ME BABY — ร้านอาหารที่ขายได้ทั้งบนเว็บ ในแชท และหน้าร้าน (AI-Powered PWA)

> **Elevator pitch (30 วินาที):**
> Bite Me Baby คือแพลตฟอร์มร้านอาหารครบวงจร 1 แอป — ลูกค้าสั่งผ่านผู้ช่วย AI "น้อง Bite" (พูดได้ แชทได้ จำความชอบได้), แม่ค้าขายผ่านคอมเมนต์ Facebook/LINE ด้วย AI Sales ที่เขียนลิงก์ตะกร้าเป๊ะทุกโพสต์, ไรเดอร์รับงานบน PWA พร้อมพิสูจน์การส่งด้วยรูป, และเจ้าของร้านเห็นทุกอย่างบน Admin เดียว — ครัว คลัง คูปอง CRM รายงาน และเว็บ POS ครบในตัว
> ออกแบบเป็น **multi-tenant SaaS** ตั้งแต่วันแรก (เปิดร้านใหม่ = wizard หน้าเดียวจบ) และทุกฟีเจอร์ที่อวดอยู่บนหน้านี้ **มีโค้ดจริง เทสต์จริง รันบน production จริง** ที่ https://biteme-baby.com

- **Production:** https://biteme-baby.com (Cloudflare Pages auto-deploy จาก `main`)
- **Repo:** `github.com:bitemebaby2016-coder/bmb` · Workspace `D:\A PROJECT\Bite Me Baby`
- **สถานะ (อัปเดต 2026-11-24 · R105b):** ระบบหลัก + AI Waiter + AI Sales + Rider Ops + Background Music = LIVE ผ่าน live test · งานค้างเหลือแค่ชุดทดสอบ live ตามเช็กลิสต์ (§10) · ตัวเลข gate ล่าสุดให้ดูจาก CI เสมอ ห้ามเชื่อตัวเลขในเอกสารโดยไม่รันเอง
- ⚠️ `bitemebaby-5f7.pages.dev` = build เก่าค้าง (stale) — ห้ามใช้ตรวจงาน visual/behavior

---

## เรื่องเล่าของแพลตฟอร์มนี้ (เล่าให้นักลงทุนฟัง)

### ตอนที่ 1 — ลูกค้าไม่ต้อง "ใช้แอป" แอปก็รับออเดอร์ให้

เว็บเปิดได้ทันที ไม่ต้องล็อกอิน ไม่ต้องโหลด Play Store (PWA install ได้ ใช้ offline ได้)
ลูกค้าเจอหน้า **Food Theater** — คารูสเซลเมนูจากแคตตาล็อกจริงของร้าน พร้อมเหตุผลแนะนำที่มาจากสัญญาณจริง (สั่งซ้ำของคุณ · คู่กับของในตะกร้า · เมนูฟีเจอร์) **ไม่มีการแต่งเรื่อง "ขายดี" โดยไม่มียอดขายยืนยัน** — หลักการทั้งระบบ

- **สั่งแบบคนไทยจริง:** พิมพ์/พูดกับน้อง Bite ได้ว่า "เอาข้าวผัดกะเพราหมูสองจาน เผ็ดน้อย ไม่ใส่น้ำแข็ง" — AI เข้าใจออปชัน ส่งเข้าตะกร้าจริง สั่งซ้ำครั้งต่อไปแค่บอก "เหมือนเดิม"
- **ตะกร้าติดตัวทุกที่:** ลูกค้าเก็สต์มีตะกร้าที่กู้คืนด้วยลิงก์ (`?cart=`) · ลูกค้าที่ล็อกอินซิงก์ตะกร้าข้ามเครื่องอัตโนมัติผ่าน server-side cart (R103)
- **จ่ายเงินได้จริง:** บัตร (Omise, server-side + 3-D Secure) · QR PromptPay · เงินสดปลายทาง · ติดตามออเดอร์แบบ real-time พร้อมแผนที่ไรเดอร์
- **จัดส่งแบบมีระบบ:** รอบจัดส่ง same-day + pre-order พร้อม cutoff และ capacity ที่ตรวจฝั่ง server เสมอ (ไม่เชื่อฟอร์มลูกค้า)

### ตอนที่ 2 — AI Sales ที่ขายของได้จริงบน Facebook และ LINE

โมเดลธุรกิจของร้านค้าไทยไม่ใช่ "ดันคนมาหน้าเว็บ" แต่คือ **คอมเมนต์ Facebook / แชท LINE** — เราวาง AI ลงในสนามนั้นตรง ๆ:

- AI ตอบทุกคอมเมนต์/ข้อความจากข้อมูลเมนู+ราคา+รอบส่งจริง แล้วปิดการขายด้วยลิงก์ตะกร้า
- **กติกาเหล็ก "1 reply = 1 ลิงก์ของระบบ" (R104):** AI ห้ามเขียน URL เองทุกกรณี — ทุกข้อความมีลิงก์ร้านถูกต้องอันเดียวเสมอ → หมดปัญหา "ลิงก์เปล่า" ที่ลูกค้ากดแล้วเจอตะกร้าว่าง
- **สะพาน Facebook In-App → เบราว์เซอร์จริง (R101–R103):** กดลิงก์จากคอมเมนต์ใน WebView = เห็นตะกร้าตามที่ AI สรุปพอดี · กดซ้ำไม่กองของ · คัดลอกไปเปิด Chrome ก็ตะกร้าตามไปทุกเครื่อง (guest) และซิงก์ผ่านบัญชีสำหรับลูกค้าประจำ
- AI สร้างคอนเทนต์เองด้วย — โพสต์การตลาดแนบรูปได้ 5 รูป (เจน + อัปโหลด) ผ่าน Admin AI Studio

### ตอนที่ 3 — ไรเดอร์ไม่ใช่ "พาร์ทเนอร์เดินส่งของ" แต่คือระบบลอจิสติกส์ที่ตรวจสอบได้

PWA ไรเดอร์ (`/rider`) วิ่งบนมือถือปกติ:

- รับงาน → เช็คอิน GPS ถึงหน้าร้าน → รับของ → เดินทาง → ถ่ายรูป **พิสูจน์การส่ง (POD)** → ปิดงาน ลูกค้าเห็นรูป POD + เวลาจริงบนหน้าติดตาม
- ระบบมอบหมาย + offer + offline gate — ไรเดอร์ออฟไลน์รับงานไม่ได้ มีเหตุผลเป็นภาษาไทย
- **พิมพ์สติกเกอร์/ใบเสร็จจากเครื่องจริง:** Bluetooth label printer (Niimbot) + QZ-Tray — 1 ออเดอร์ = สติกเกอร์ 1 ดวงรวมทุกเมนู (R63d)
- แผนที่ real-time เส้นทางรายออเดอร์ + แผนที่รวม พร้อม fallback ไม่ขาว (R64)

### ตอนที่ 4 — Admin คือ "สมองกลาง" ของร้าน (ไม่ใช่แค่หน้าดูออเดอร์)

- **ครัว:** คิวทำอาหารแบบ batch + ประตู `ready_to_make` · สูตรอาหาร · สต็อก inventory
- **การขาย:** เว็บ POS · รายงานการเงิน/ยอดขาย · ปริ้นเตอร์
- **การตลาด:** โพสต์ AI 5 รูป · Floating Ads ที่โชว์ "ตรงต้นฉบับ 100%" ของสิ่งที่แอดมินเลือก (R80) · โปรโมชั่นที่ระบบจริง (เพดานส่วนลด/สิทธิคงเหลือ/stackable)
- **CRM อัตโนมัติ:** winback ลูกค้าหายไป 45 วัน + อวยพรวันเกิด — **ส่งเฉพาะคนที่กดยินยอม** + kill-switch (m192/193)
- **ลูกค้าประจำ:** แต้ม/ระดับสมาชิก · referral · คูปอง · โหวตเมนูล่วงหน้า (server RPC จริง ห้ามแต้มปลอม — R53)
- **รีวิว:** verified reviews ผ่านคิวอนุมัติก่อนเผยแพร่ (แอดมินอนุมัติ/ตอบกลับ/ลบ)
- **หลายร้าน หลายสาขา:** tenants → brands → branches พร้อม RLS isolation ซ้อน 2 ชั้น + onboarding wizard + billing งวดบริการ (m175) — สถาปัตยกรรม SaaS พร้อมขยาย

### ตอนที่ 5 — Brand ที่มี "บรรยากาศ"

เพลงบรรเลงเล่นเองจาก bucket ของร้าน (แอดมินอัปโหลด/ลบ/สลับได้ RLS ปลอดภัย R105) · มาสคอต "น้อง Bite" ลอยตามหน้าเว็บแบบตั้งค่าเองได้ · ธีม 3 แบบ · copy หมุนเวียนรายวันแก้จากแอดมิน

---

## ตัวเลขที่ยืนยันได้ (ตรวจจาก repo — ไม่ใช่คำอวย)

| ตัวเลข | หลักฐาน |
|---|---|
| **2,521 เทสต์ ผ่าน 100%** (230 ไฟล์ Vitest) | `npm run test` รันวันที่ 2026-11-24 · log `e2e/_r105b_vitest_full.log` |
| **213 migrations** อยู่ใน production | `supabase/migrations/001–213` + record `supabase_migrations.schema_migrations` (probe `e2e/_r105bRecord196.cjs`) |
| **24 Edge Functions** + shared libs | `supabase/functions/` (ai-proxy, omise-*, stripe-*, queue-*, social-*, automation-*, voice-tts, image-gen, push/sms/otp, cron-tick…) |
| **Contract replay ทุก migration** บน ephemeral Postgres ทุก push | GitHub Actions `contract-tests.yml` · Docker replay ALL_GREEN (R82b) |
| **RLS 2 ชั้น + ACL drift repair + timezone guard** | migration 065/106/157/158 + BKK-date class guard (m190–193) ใน CI |
| **Production จริงบนโดเมนตัวเอง** | biteme-baby.com — Cloudflare Pages · Supabase prod `ivkdfognyiwjcmrhcnwz` |
| **PWA offline + push notification hub** | `vite-plugin-pwa` + m179 + web push (SW vibrate/requireInteraction) |

## ฟีเจอร์หลัก → จุดยืนยันในโค้ด (สรุป)

| กลุ่ม | ไฟล์/ระบบยืนยัน | สถานะ |
|---|---|---|
| AI Waiter (แชท+เสียงไทย) จำออปชัน สั่งซ้ำ ขายดีจากยอดจริง | `talkToBite.ts`, `aiService.ts`, EF `ai-proxy`/`voice-tts`, server memory/guardrails/db context | LIVE (E2E TTB 5/5) |
| AI Sales Facebook/LINE (1 reply = 1 ลิงก์) | EF `social-ai-worker` (deploy 2026-11-24), `socialLinkFormat.ts`, `socialOrderIntake` | LIVE (Owner deploy เอง exit=ok) |
| ตะกร้าข้ามช่องทาง (deep link + server sync) | `cartDeepLink.ts` v2, `cartSessionSync.ts`, `cartPersistence.ts`, `InAppBrowserBanner.tsx` | LIVE (live test กลุ่ม I ตามเช็กลิสต์) |
| สั่งซื้อ same-day/pre-order + รอบส่ง server-authoritative | `CheckoutPage`, RPC/migrations 024/025/144/145/148 | LIVE |
| ชำระเงิน 3 ช่องทาง + payment intent | `paymentGateway.ts`, EF `omise-*`, `stripe-*`, `create-checkout` | LIVE — **บัตร Omise รอ Owner ทดสอบ TEST card** |
| Rider PWA (งาน/POD/แผนที่/สติกเกอร์ Bluetooth) | `RiderPwaPage.tsx`, `RiderPod.tsx`, `RiderMiniMap`, m166/168/197/207–212 | LIVE (delivery sync hop fix m212) |
| ครัว + inventory + เว็บ POS + รายงาน | `AdminKitchen`, m019/027/054/129/130/134, `AdminPos`, `AdminReports` | LIVE |
| CRM winback/birthday (ความยินยอม) | m192/193, pg_cron, `customers.crm_consent` | LIVE |
| การตลาด AI: โพสต์ 5 รูป + Floating Ad exact-clone | m209, `AdminMarketing`, `FloatingAdTab`, EF `image-gen` | LIVE |
| Verified reviews + คิวอนุมัติ | m093/098/198–200, `AdminReviews` | LIVE |
| Loyalty/Referral/คูปอง/โหวตเมนู (RPC จริง) | m154/155/172, m208, `RewardsPage`, `VotePage` | LIVE |
| Multi-tenant SaaS (onboarding + billing) | TEN-05/06 (m059–074, m175), `AdminOnboarding`, `AdminBilling` | LIVE |
| เพลงบรรเลงจาก bucket + RLS ถูกต้อง | m196, `backgroundMusic.ts`, `AmbientMusicToggle.tsx` | LIVE (R105b live test ผ่าน) |
| Login: เบอร์โทร + OAuth 4 ช่องทาง + Passkey | `LoginPage`, R54, R25/R55 config เสร็จ | LIVE |
| PWA offline + push notifications | `vite-plugin-pwa`, m115/179, `sw.ts` | LIVE |

## เส้นทางลูกค้า (ตรวจได้จาก App.tsx)

```
/ (Talk to Bite landing) → /shop (Food Theater · แคตตาล็อกจริง)
      │                        │
      │   แชท/เสียง AI สั่งของ ──┼──► /menu (เมนู+แท็บหมวด+จองล่วงหน้า)
      ▼                        ▼
           ตะกร้าเดียว (cartStore · server sync ข้ามเครื่อง)
                          │
              /checkout?mode=same-day|pre-order
              (รอบส่ง + cutoff + capacity ตรวจที่ RPC)
                          │
        บัตร Omise · QR PromptPay · เงินสดปลายทาง
                          │
        /track/:orderNumber (real-time + POD รูปจริง) → /orders
```

รอบหลังบ้าน: `/rider` (ไรเดอร์ PWA) · `/admin/*` (ครัว/สต็อก/คำสั่งซื้อ/การส่ง/การตลาด/ลูกค้า/ตั้งค่า/POS/รายงาน)

## Tech stack (ตรวจจากไฟล์จริง)

- **Frontend:** React 19 + TypeScript 5.9 + Vite 8 + Tailwind 4 + `vite-plugin-pwa` · routing React Router 7 · state Zustand · code-split ทุกหน้า (หน้าแรก eager ไว้ LCP)
- **Backend:** Supabase — Postgres + RLS 2 ชั้น · 213 migrations · 24 Edge Functions + `_shared`
- **การจ่ายเงิน:** Omise (บัตร server-side charge + 3-D Secure) · QR PromptPay + COD ผ่าน payment intent + admin confirm · webhook idempotent · Stripe = fallback
- **AI:** LLM proxy (SSE streaming) + fallback chain หลายโมเดล · TTS เสียงไทย (Web Speech + EF `voice-tts`) · image generation
- **CI/CD:** GitHub Actions (lint → vitest → tsc+build, Node 24) + **contract-tests.yml** replay ทุก migration บน ephemeral Postgres ทุก push · deploy = Cloudflare Pages auto จาก `main`
- **Testing:** Vitest 230 ไฟล์ / 2,521 tests · Playwright/e2e probes (`e2e/`)

```
Browser (PWA) ──► Supabase (Postgres + RLS) ◄── Edge Functions (social/automation/queue/notify)
   │  ▲                  ▲                          ▲
   │  └─ ai-proxy (SSE) ┴─ omise/stripe (idempotent) ─ voice-tts / image-gen
   └─ service worker (offline + push)
```

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env        # กรอกค่า — ดู docs/04_DEPLOYMENT_RUNBOOK.md
npm run dev                 # dev server
npm test                    # vitest run ทั้งหมด
npm run lint                # eslint + brandNameGuard
npm run build               # tsc + vite build (production PWA)
```

**Verify harness (DB replay + behavioral · ใช้ก่อน push งาน DB):** `e2e/ci/_r73e_verify.bat` (Windows · เปิด Docker Desktop ก่อน) — replay migration ทั้งหมด + night-sim + CRM behavioral + legacy contracts

**Environment variables (ชื่อ — ไม่ใส่ค่าจริง):**

- Client (`VITE_*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENROUTER_MODEL`, `VITE_VOICE_SERVER_TTS`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_MAPS_API_KEY` (+`MAP_ID`/`ROUTES_API_KEY`), `VITE_MAPBOX_*`, `VITE_DELIVERY_KITCHEN_LAT/LNG`, `VITE_GRAB_SANDBOX_*`, `VITE_LINEMAN_SANDBOX_API_KEY`
- Server secrets ตั้งผ่าน `supabase secrets` — ห้าม commit
- CI ใช้ placeholder เท่านั้น

## สถานะจริงวันนี้ และสิ่งที่ต้องปิดก่อนเปิดร้านเงินจริง

**พร้อมแล้ว (มีหลักฐาน):** ทุกกลุ่มฟีเจอร์ตารางข้างบน LIVE บน production · เทสต์ 2,521 ผ่าน · contract replay เขียว · RLS/timezone guard ครบ · migration ledger ตรงกับไฟล์ repo (probe 2026-11-24)

**เงื่อนไขก่อนเปิดรับออเดอร์จริง (เกณฑ์ปิด = [`docs/BMB_PRODUCTION_TEST_PACK.md`](docs/BMB_PRODUCTION_TEST_PACK.md)):**

1. **Owner ทดสอบจริง:** บัตร Omise (TEST card บนเบราว์เซอร์จริง) · GPS/delivery matrix · ชุด live test ค้างตาม [`docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md`](docs/BMB_REMAIN_TESTS_LIVE_2026-11-23.md) (กลุ่ม H/I — cart bridge + 1-link ที่แก้ล่าสุด)
2. **CONFLICT C-1..C-6** (`docs/BMB_REQUIREMENT_RECONCILIATION.md` §3) — รอ Owner ตัดสินใจ
3. **Runtime tests อุปกรณ์จริง** ใน test pack §T — NOT RUN

## เอกสารประกอบ + กติกาการทำงานของ repo

| เอกสาร | เนื้อหา |
|---|---|
| [docs/01_SYSTEM_ARCHITECTURE.md](docs/01_SYSTEM_ARCHITECTURE.md) | DB schema, Multi-Branch RLS, data flow |
| [docs/02_API_INTEGRATIONS.md](docs/02_API_INTEGRATIONS.md) | Webhooks, Edge Functions, delivery providers |
| [docs/03_ADMIN_USER_GUIDE.md](docs/03_ADMIN_USER_GUIDE.md) | คู่มือ Admin Dashboard |
| [docs/04_DEPLOYMENT_RUNBOOK.md](docs/04_DEPLOYMENT_RUNBOOK.md) | Env, Supabase secrets, cutover |
| [docs/BMB_PRODUCTION_TEST_PACK.md](docs/BMB_PRODUCTION_TEST_PACK.md) | **ชุดทดสอบเดียวที่ใช้ปิดงานบน production** |
| [docs/BMB_MASTER_STATUS.md](docs/BMB_MASTER_STATUS.md) | สถานะรวมรายรอบ (ล่าสุด R105b) |
| [AI_WORK_STATE.md](AI_WORK_STATE.md) | Ledger สถานะปฏิบัติการล่าสุด (อ่านก่อนเริ่มงานทุกครั้ง) |

**กติกาที่ห้ามละเมิด:**

1. ทุก AI session ต้องผ่าน bootstrap ก่อนแตะไฟล์ใด ๆ: อ่าน `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` → `docs/BMB_MASTER_STATUS.md`
2. เริ่มงานจากสถานะ git จริงเสมอ (`git status`/`git log`/`origin/main`) — เอกสารเก่า = ข้อมูลประกอบเท่านั้น
3. Work loop: ตรวจสถานะ → แก้ → รัน gates (`npm test`, `tsc`, `eslint`, `build`) → ตรวจของจริง → รายงาน → commit/push แบบไฟล์ที่ระบุ (ห้าม `git add .`)
4. Manual apply migration ต้อง probe marker ก่อน + บันทึก `supabase_migrations.schema_migrations` เสมอ (กฎ 16.3)
5. อัปเดตเอกสารทันทีที่สถานะเปลี่ยน ห้ามปล่อยให้เอกสารไล่หลังโค้ด
6. ห้าม commit secrets — ค่าลับอยู่ใน Supabase Secrets / `.env` (ไม่ track)
