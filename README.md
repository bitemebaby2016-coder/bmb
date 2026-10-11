# 🍽️ BITE ME BABY — แพลตฟอร์มสั่งอาหารพร้อม AI Waiter (PWA)

แอปสั่งอาหารสำหรับร้าน **Bite Me Baby** (ครัวกลาง/Cloud Kitchen จันทบุรี) — ลูกค้าสั่งได้จากหน้าเดียว พร้อมผู้ช่วย AI "น้อง Bite" (แชท + เสียง) และหน้าเวทีเมนู Food Theater ที่คัดเมนูจากแคตตาล็อกจริง

- **Production:** https://biteme-baby.com (Cloudflare Pages auto-deploy จาก branch `main`)
- **Repo:** `D:\A PROJECT\Bite Me Baby` → `github.com:bitemebaby2016-coder/bmb`
- **สถานะ:** ระบบหลักถึง production แล้ว — แต่การเปิดรับออร์เดอร์จริงยังมีเงื่อนไขต้องปิดก่อน (§10) และตัวเลข gate ล่าสุดให้ดูจาก CI เสมอ ห้ามเชื่อตัวเลขในเอกสารโดยไม่รันเอง
- ⚠️ `bitemebaby-5f7.pages.dev` = build เก่าค้าง (stale) — ห้ามใช้ตรวจงาน visual/behavior

## 1. BITE ME BABY คืออะไร (จากโค้ดจริง)

ร้านอาหารออนไลน์ที่รวม 3 ระบบใน PWA เดียว:

1. **หน้าร้านลูกค้า** — ค้นเมนู ดูรอบจัดส่ง ใส่ตะกร้า ชำระเงิน ติดตามออเดอร์ (เส้นทางสั่งซื้อเส้นเดียว canonical ทั้ง same-day และ pre-order)
2. **Bite AI Waiter** — แชท/เสียงสั่งอาหารภาษาไทยจากข้อมูลร้านจริง (เมนู+ราคา รอบส่ง โปรโมชั่น สถานะออเดอร์) ผ่าน Edge Function `ai-proxy` (SSE)
3. **Admin Dashboard** — จัดการออเดอร์ เมนู สต็อก รอบจัดส่ง ลูกค้า สื่อ โปรโมชั่น หลายสาข�� พร้อม RLS isolation ซ้อน 2 ชั้น

## 2. ลูกค้าได้อะไร + เริ่มใช้งาน

- **เริ่ม:** เปิด https://biteme-baby.com → หน้า `/shop` ดูเมนูที่ Bite เลือกมาให้ได้ทันที ไม่ต้องล็อกอิน
- **สั่ง:** แตะเพิ่มลงตะกร้า หรือบอก Bite ในแชท/เสียงให้จัดให้ → ตรวจตะกร้า → เลือกรอบ/วัน → ชำระเงิน → ติดตามด้วยเลขออเดอร์
- **บัญชี:** สมัคร/ล็อกอินไว้ดูประวัติสั่ง แต้ม และคูปอง (หน้า /profile, /orders, /rewards)

## 3. Customer journey (ตรวจสอบได้จากเส้นทางจริง)

```
/ (TalkToBite landing) ─→ /shop (FoodTheater: picks จาก catalog จริง)
        │                      │
        │                 /menu (เมนูทั้งหมด + แท็บกรอง)
        ▼                      ▼
   แชทสั่งอาหาร ─────────→ ตะกร้าเดียว (cartStore, canonical)
                              │
                    /checkout?mode=same-day | pre-order
                    (รอบจัดส่ง + cutoff + capacity ตรวจที่ RPC)
                              │
              ชำระเงิน: บัตร Omise · QR PromptPay · เงินสดปลายทาง
                              │
              /track/:orderNumber → /orders (ประวัติ)
```

ยืนยันในโค้ด: `parseOrderIntent`/`applyOrderModify` (`src/lib/talkToBite.ts`) → `cartStore.addItem` เส้นเดียว → `paymentGateway.createCheckout` (บัตรหลัก = Omise cutover, Stripe เป็น fallback ระหว่างยังไม่ตั้งค่า Omise) → webhook idempotent

## 4. Bite AI waiter / Talk to Bite / Food Theater (implementation ปัจจุบัน)

- **Talk to Bite:** state machine ใน `src/lib/talkToBite.ts` + `aiService.ts` (SSE ผ่าน `ai-proxy` EF), guardrails/ความจำฝั่งเซิร์ฟเวอร์ (`aiGuardrails`, `aiServerMemory`, `aiDbContext`)
- **เสียง:** Web Speech API th-TH + EF `voice-tts` (`aiVoice.ts`)
- **Food Theater (`/shop`):** `FoodTheater.tsx` + `TheaterCards.tsx` — ring carousel แบบ scroll-snap (ปุ่ม ลูกศร swipe คีย์บอร์ด), เหตุผลแนะนำบนการ์ดมาจากสัญญาณจริงเท่านั้น (`theaterReasons`: ❤️ favorite จาก memory, 🍗 คู่กับตะกร้า, ✨ เมื่อ `created_at` ยืนยัน, ⏱️ `prep_minutes`, 🔥 `is_featured`) และ **copy หมุนเวียน 7 วัน** (`theaterDailyCopy.ts` — §9)

## 5. ฟีเจอร์ที่มีจริงและสถานะ

| กลุ่ม | ไฟล์ยืนยัน | สถานะ |
|---|---|---|
| สั่งซื้อ same-day + pre-order + รอบจัดส่ง | `CheckoutPage`, RPCs/migrations | ใช้งานใน production |
| ชำระเงิน 3 ช่องทาง (Omise/QR/COD + Stripe fallback) | `paymentGateway.ts`, EF `omise-*`/`stripe-*` | **บัตร Omise รอ Owner ทดสอบ TEST card ก่อนเปิดจริง** |
| AI แชท/เสียง | EF `ai-proxy`, `aiService`, `aiVoice` | ใช้งานได้; chat-hang ยังค้างใน backlog |
| Food Theater + copy 7 วัน | `FoodTheater`, `theaterDailyCopy` | ใหม่ — ผ่าน unit tests + gates |
| Admin หลายสาขา + RLS | `src/pages/admin/*` (26 หน้า) | ใช้งานใน production |
| Delivery zones/ค่าส่ง/ETA/Driver | `deliveryRouter`, `routeOptimization`, `googleMaps` | ระบบจริง; **GPS matrix รอ Owner ทดสอบ** |
| Queue dispatch + automation/social workers | EF `queue-*`, `automation-*`, `social-*` | deploy แล้ว |
| PWA (manifest/offline) | `vite-plugin-pwa`, `public/` | เปิดใช้ |
| E2E production matrix | `e2e/` | **ยัง 0/10 — เงื่อนไขก่อนเปิดร้าน (§10)** |

## 6. สถาปัตยกรรมและ tech stack (ตรวจจากไฟล์จริง)

- **Frontend:** React 19 + TypeScript 5.9 + Vite 8 + Tailwind 4 + `vite-plugin-pwa` · routing `react-router-dom` 7 · meta/JSON-LD `react-helmet-async` · state `zustand` (`store/` + `stores/`)
- **Backend:** Supabase — Postgres + RLS 2 ชั้น, migrations 123 ไฟล์ (`supabase/migrations/`), Edge Functions 18 ตัว + `_shared` (`ai-proxy`, `omise-*`, `stripe-*`, `create-checkout`, `queue-*`, `sms-send`, `push-send`, `voice-tts`, `channel-webhook`, social/automation workers)
- **การจ่ายเงิน:** Omise (บัตร, server-side charge + 3-D Secure) · QR PromptPay + เงินสดปลายทาง ผ่าน payment intent + admin confirm · Stripe = fallback เก่า
- **CI/CD:** `.github/workflows/ci.yml` — push `main`/PR → `npm ci` → lint → test → build (Node 24) · deploy = Cloudflare Pages auto-deploy จาก `main`
- **Testing:** Vitest (unit, pure logic เป็นหลัก) + Playwright (probes/e2e scripts ใน `e2e/`)

```
Browser (PWA) ──► Supabase (Postgres + RLS) ◄── Edge Functions (queue/social/sms…)
     │                    ▲
     └──► ai-proxy (SSE) ─┘      omise-* / stripe-* (webhook idempotent)
```

## 7. โครงสร้างโฟลเดอร์ (ตรวจนับจาก repo ปัจจุบัน)

```
├── src/
│   ├── lib/            # service layer ~95 ไฟล์ (จุดเดียวที่แตะ DB/AI/payment)
│   │   ├── ai/         # context builder (branch/catalog/rounds, TTL cache)
│   │   ├── theater*    # theaterGeometry/Reasons/Editorial/DailyCopy (pure)
│   │   └── faqContent  # คำถาม FAQ ไฟล์เดียวทั้งหน้าเว็บและ JSON-LD
│   ├── components/     # 24 หมวด: theater/ ai/ cart/ order/ payment/ admin/ layout/ ui/ …
│   ├── pages/          # 27 หน้าสาธารณะ + pages/admin/ อีก 26 หน้า
│   ├── store/ stores/  # zustand stores (cart/auth/bite-ai/…)
│   ├── hooks/ config/ types/ assets/
│   └── __tests__/      # Vitest 68 ไฟล์
├── supabase/
│   ├── migrations/     # 123 ไฟล์ (schema + RLS + seed)
│   └── functions/      # 18 Edge Functions + _shared
├── public/             # sitemap.xml, robots.txt, PWA assets, รูปภาพ
├── docs/               # 01–04 (เอกสารหลัก) + log/รายงานย่อย + archive/
├── e2e/                # Playwright spec + probes/acceptance scripts
├── scripts/            # build/ops scripts
└── .github/workflows/  # ci.yml, automation-scheduler.yml
```

## 8. ติดตั้ง ตั้งค่า และรันงาน

```bash
npm install
cp .env.example .env        # กรอกค่า — ดูคำอธิบายใน docs/04_DEPLOYMENT_RUNBOOK.md
npm run dev                 # Vite dev server
npm test                    # vitest run (unit ทั้งหมด)
npm run lint                # eslint .
npm run build               # tsc + vite build (production PWA)
npm run preview             # เสิร์ฟ dist ที่ build แล้ว
```

**ตัวแปร environment (ชื่อ — ไม่ใส่ค่าจริงในเอกสาร):**

- ฝั่ง client (`VITE_*`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENROUTER_MODEL`, `VITE_VOICE_SERVER_TTS`, `VITE_STRIPE_PUBLISHABLE_KEY`, `OMISE_*_TEST_MODE` (3 ตัว), `VITE_GRAB_SANDBOX_*`, `VITE_LINEMAN_SANDBOX_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` (+`MAP_ID`/`ROUTES_API_KEY`), `VITE_MAPBOX_*`, `VITE_DELIVERY_KITCHEN_LAT/LNG`
- ฝั่งเซิร์ฟเวอร์ (Secrets ใน Supabase EF config — **ห้าม commit**): ค่าลับ Omise/Stripe/SMS/AI provider ตั้งผ่าน `supabase secrets`
- CI ใช้ค่า placeholder เท่านั้น (`ci.yml` env = dummy values)

## 9. Copy 7 วัน + ข้อกำหนด SEO/AEO/GEO

### Copy หมุนเวียนตามวัน (Theater)

- **ที่เก็บ:** `business_settings` key **`theater_daily_copy`** (JSON) + key เดิม **`theater_editorial`** (copy ฐาน) — แก้ผ่าน `/admin/settings` (key/value editor เดิม ไม่มี CMS ใหม่, ไม่มี migration)
- **กลุ่มตามวัน (timezone ระบบ = Asia/Bangkok UTC+7):** จ = Menu Discovery · อ = Signature/Recommendation · พ = Craving/Occasion · พฤ = Convenience · ศ = Value & Choice · ส = New/Fresh Highlights (ใช้คำว่าใหม่/สดเฉพาะมีข้อมูลยืนยัน) · อา = Ask Bite
- **กติกา:** สุ่มเฉพาะกลุ่มวันนั้นและเฉพาะ item ที่ `published !== false` + fields ครบ; ค่าคงที่ตลอดวัน (seed จากวันที่ — refresh/remount ไม่เปลี่ยน, ไม่กระพริบ); fallback เมื่อปิด rotation/โหลดไม่สำเร็จ/ไม่มีของเผยแพร่ → `theater_editorial` → ค่า default ในโค้ด
- **แก้ยังไงให้เห็นจริง:** `/admin/settings` → กด "➕ เพิ่ม key" → `theater_daily_copy` (ได้เทมเพลต 7 วันเติมให้) → ตรวจแก้ในโหมด JSON → **Save** → เปิด `/shop` เห็นหัวข้อ/คำทัก/ปุ่ม/ป้ายแนะนำใหม่ทันที
- **ข้อห้าม:** copy ห้าม hard-code ราคา ส่วนลด เวลาส่ง พื้นที่ คุณสมบัติอาหาร หรือคำกล่าวอ้าง "ขายดีสุด" โดยไม่มีข้อมูลระบบยืนยัน — ป้ายบนการ์ด (❤️✨⏱️🔥) มาจาก `theaterReasons` ซึ่งตรวจสัญญาณจริงเท่านั้น

### SEO / AEO / GEO

- **SEO:** meta ทุกหน้ามาจาก `src/lib/seo.ts` + `SeoHelmet` (title/description/canonical/hreflang/JSON-LD) — **คงที่ ไม่ผูกกับ copy หมุนเวียน** (มี test ล็อก) · static tags ใน `index.html` ทำเครื่องหมาย `data-rh` เพื่อให้ Helmet "แทนที่" แทนที่จะซ้ำ (แก้ duplicate canonical/title/og ที่ตรวจพบจากของจริง) · canonical = URL ตัวเอง · `public/sitemap.xml` (+`/shop`, namespace ถูกต้อง) + `robots.txt`
- **AEO:** FAQ JSON-LD สร้างจาก `src/lib/faqContent.ts` ไฟล์เดียวกับที่หน้า `/faq` แสดง (schema ไม่มีทางเพี้ยนจากเนื้อหาที่เห็น) — เพิ่มคำตอบใหม่ = แก้ที่เดียว
- **GEO:** ข้อมูลธุรกิจใน `SITE_CONFIG`/`HOME_SCHEMA` (ชื่อ ที่ตั้ง รัศมี 5 กม. เวลาเปิด ช่องทางติดต่อ) ต้องตรงกับความจริง — **ห้ามเพิ่มที่อยู่/สาขา/รีวิว/ราคา ที่ Owner ยังไม่ยืนยัน**
- **ข้อจำกัดที่ทราบ:** metadata บาง route (orders/reviews/notifications, /track ใช้พารามิเตอร์ literal) ยังไม่ครบ/ไม่ถูก — บันทึกใน Launch Readiness ไม่ขยายไปแก้ในชุดงานนี้

## 10. สถานะและงานที่ต้องปิดก่อนเปิดร้านจริง

ยัง **ไม่** ถือว่าพร้อมรับออร์เดอร์จริงจนกว่าจะปิดรายการเหล่านี้ (รายละเอียด/เกณฑ์/ผู้รับผิดชอบ อยู่ในรายงาน Launch Readiness ล่าสุด):

1. **Owner ทดสอบจริง:** บัตร Omise (TEST card บนเบราว์เซอร์จริง) และ GPS/delivery matrix
2. **Production E2E matrix** — ยัง 0/10 ต้องผ่านครบก่อนเปิด
3. **Production DB audit** (aggregate/EF probe) — รอ Owner approval
4. **Chat-hang** ของ `mascotService` (timeout) — ต้องปิดก่อนใช้แชทจริงในงานจริง
5. **SEO route metadata** บางหน้าไม่ครบ + `bitemebaby-5f7.pages.dev` stale ต้องระบุ/ลบจาก Dashboard
6. ข้อความ FAQ เดิมมีตัวอักษรภาษาไทยบางจุดผิดรูป (ของเก่า) — รอ Owner ตรวจแก้, คำกล่าวอ้างราคา/โปรโมชั่นใน FAQ (`฿30` คูปอง, รหัสโปร) ต้องยืนยันกับระบบจริงก่อนพึ่งพา

## 11. เอกสารประกอบ + กติกาการทำงานของ repo

| เอกสาร | เนื้อหา |
|---|---|
| [docs/01_SYSTEM_ARCHITECTURE.md](docs/01_SYSTEM_ARCHITECTURE.md) | DB schema, Multi-Branch RLS, data flow |
| [docs/02_API_INTEGRATIONS.md](docs/02_API_INTEGRATIONS.md) | Webhooks, Edge Functions, delivery providers |
| [docs/03_ADMIN_USER_GUIDE.md](docs/03_ADMIN_USER_GUIDE.md) | คู่มือ Admin Dashboard |
| [docs/04_DEPLOYMENT_RUNBOOK.md](docs/04_DEPLOYMENT_RUNBOOK.md) | Env, Supabase secrets, cutover |

**กติกาที่ห้ามละเมิด:**

1. เริ่มงานจากสถานะ git จริงเสมอ (`git status`/`git log`/`origin/main`) — เอกสาร/แฮนด์ออฟเก่า = ข้อมูลประกอบเท่านั้น
2. ปิดงาน/ส่งแฮนด์ออฟ ต้อง re-verify จากสถานะปัจจุบัน: commit SHA, ผล gates ที่รันจริงล่าสุด, build ที่ deploy จริง
3. Work loop: ตรวจสถานะ → แก้ → รัน gates (`npm test`, `tsc`, `eslint`, `build`) → ตรวจของจริง → รายงาน → commit/push แบบไฟล์ที่ระบุ (ห้าม `git add .`)
4. อัปเดตเอกสารทันทีที่สถานะเปลี่ยน ห้ามปล่อยให้เอกสารไล่หลังโค้ด
5. Workspace จริง = repo `D:\A PROJECT\Bite Me Baby` เท่านั้น
6. ห้าม commit secrets — ค่าลับอยู่ใน Supabase Secrets / `.env` (ไม่ track)