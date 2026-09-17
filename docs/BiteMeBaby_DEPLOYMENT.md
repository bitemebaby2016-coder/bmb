# Deployment Guide — คู่มือการติดตั้งและเผยแพร่ระบบ Bite Me Baby

## ภาพรวม
Bite Me Baby เป็น Vite/PWA frontend application ที่สามารถ deploy บน static hosting platform ใดๆ ได้ Schema ฐานข้อมูลและ migration ถูกกำหนดไว้สำหรับการบูรณาการกับ Supabase

---

## 🚀 Production Status (2026-09-17 — Closure Final)

| รายการ | ผล |
|--------|-----|
| **Platform** | Cloudflare Pages (`bitemebaby-5f7.pages.dev`) |
| **Production URL** | https://bitemebaby-5f7.pages.dev |
| **Branch** | `production` (production branch ของ project) — deploy ด้วย `wrangler pages deploy dist --project-name bitemebaby --branch production` |
| **Latest Deployment** | ✅ 2026-09-17 — 79 files uploaded |
| **Smoke Test** | ✅ PASS — title `Bite Me Baby - สั่งอาหารจัดส่งเมืองจันทบุรี`, hero mascots 19, menu cards 6, console errors 0 (`e2e/prod-smoke.json`) |
| **E2E (pre-deploy, local)** | ✅ 7/7 PASS (`e2e/e2e-result.json` + `e2e/screenshots/`) |

**Comand ที่ใช้ตอน deploy:**
```bash
npm run build
npx wrangler pages deploy dist --project-name bitemebaby --branch production --commit-dirty=true
# smoke: node e2e/prodSmoke.cjs   (targets https://bitemebaby-5f7.pages.dev)
```

**หมาย имеет:** Git commit/push ต้องทำก่อนอีก (ดู `git log`); deploy ต่อไปใช้คำสั่ง выше แล้วรัน `node e2e/prodSmoke.cjs` đểยืนยัน

---

## ข้อกำหนดเบื้องต้น (Pre-requisites)
1. **Node.js** >= 20.x
2. **npm** (มาพร้อมกับ Node)
3. **Supabase account** (future state — สำหรับ database และ auth)

## การพัฒนาในเครื่อง (Local Development)

### ติดตั้ง Dependencies

```bash
npm install
```

### เริ่ม Development Server

```bash
npm run dev
```

Server จะทำงานที่ `http://localhost:3000` (กำหนดค่าใน `vite.config.ts`)

### Build สำหรับ Production

```bash
npm run build
```

Output จะไปอยู่ที่ `dist/` directory

### Preview Production Build

```bash
npm run preview
```

## ตัวแปรสภาพแวดล้อม (Environment Variables)

สร้างไฟล์ `.env` ใน root ของโปรเจกต์:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
```

> **สำคัญ:** ห้าม commit ไฟล์ `.env` เข้า version control เด็ดขาด — ตัวแปร `VITE_OPENROUTER_*` ใช้โดย AI Chat (`aiService.ts`) เท่านั้น

## ตัวเลือกการ Deploy (Deployment Platforms)

### Option 1: Vercel (แนะนำ)
1. Push code ไป GitHub repository
2. ไปที่ [Vercel Dashboard](https://vercel.com)
3. Import repository
4. ตั้ง environment variables
5. Deploy อัตโนมัติเมื่อมีการ push

### Option 2: Netlify
1. Push code ไป GitHub
2. เชื่อมต่อกับ Netlify
3. ตั้ง build command: `npm run build`
4. ตั้ง publish directory: `dist`
5. Deploy

### Option 3: Cloudflare Pages
1. Push code ไป GitHub
2. เชื่อมต่อกับ Cloudflare Pages
3. Configure build settings
4. Deploy

### Option 4: Self-Hosting
1. รัน `npm run build`
2. Upload `dist/` directory ไปยัง server ของคุณ
3. Configure web server (Nginx/Apache) ให้ serve static files
4. เปิดใช้ HTTPS ด้วย Let's Encrypt

## การตั้งค่า Supabase (Future State)

เมื่อต้องการ migrate ไปใช้ Supabase สำหรับ backend:

1. สร้าง Supabase project
2. รัน migrations ใน `supabase/migrations/`
3. เปิดใช้ authentication
4. Configure Row Level Security (RLS) policies
5. Set up storage buckets สำหรับ images
6. Set up Edge Functions หากจำเป็น

### ขั้นตอนการ Migrate
1. อัปเดต `src/lib/supabase.ts` ให้ใช้ credentials จริง
2. แทนที่การเรียก `storageGet`/`storageSet` ด้วย Supabase queries
3. อัปเดต `bmbAdminApi_*.ts` ให้ใช้ Supabase client
4. Configure Supabase Auth ใน `authStore.ts`
5. ทดสอบทุกฟีเจอร์อย่างละเอียด

## การตั้งค่า PWA

Bite Me Baby มี PWA manifest (`public/manifest.json`) สำหรับ:
- ติดตั้งบนอุปกรณ์มือถือได้
- รองรับการทำงานแบบ offline (วางแผน)
- เพิ่มหน้าจอโฮมได้

เพื่อเปิดใช้งาน PWA เต็มรูปแบบ:
1. ตรวจสอบว่า `vite-plugin-pwa` มีการกำหนดค่าอยู่แล้ว (มีอยู่ใน package.json)
2. Set up service worker caching strategy
3. Configure push notifications

## การติดตามและการตรวจสอบ (Monitoring & Logs)
- Build logs: เช็กลog files ใน root ของโปรเจกต์ (`build.log`)
- Application logs: Browser console และ network tab
- Error tracking: บูรณาการ Sentry หรือเครื่องมือคล้ายกันใน production

## Domain และ DNS
สำหรับ deployment ใน production:
1. ซื้อ domain (เช่น `bitemebaby.co.th`)
2. Configure DNS A/AAAA records หรือ CNAME ไปยัง hosting platform
3. เปิดใช้ HTTPS (อัตโนมัติบน معظمแพลตฟอร์ม)
4. ตั้ง custom domain ใน dashboard ของ hosting

## CI/CD Pipeline (แนะนำ)

```
GitHub Push
    ↓
[Run Tests]       # เพิ่ม test suite ในอนาคต
    ↓
[Build]           # npm run build
    ↓
[Deploy to Staging]
    ↓
[Manual Approval]
    ↓
[Deploy to Production]
```

## รายการตรวจสอบก่อน Deploy (Checklist Before Deployment)

- [ ] Build ผ่านโดยไม่เกิด error
- [ ] ทุก route ทำงานได้ถูกต้อง
- [ ] Environment variables ถูกตั้งค่าแล้ว
- [ ] PWA manifest ถูกต้อง
- [ ] SEO meta tags ถูกกำหนดค่าไว้
- [ ] Responsive design ได้รับการทดสอบแล้ว
- [ ] Authentication ทำงานได้
- [ ] Cart และ checkout flow ทำงานได้
- [ ] AI chat functionality ทำงานได้
- [ ] Admin panel สามารถเข้าถึงได้
- [ ] Error handling อยู่แล้ว
- [ ] HTTPS เปิดใช้งานแล้ว