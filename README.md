# 🍽️ Bite Me Baby — Restaurant Ordering PWA (Production-Ready)

แอปสั่งอาหารจัดส่ง (PWA) สำหรับร้าน **Bite Me Baby** จันทบุรี — หน้าร้านลูกค้า, Admin Dashboard แบบ Multi-Branch, ระบบชำระเงิน Stripe, รอบจัดส่งรายสาขา และผู้ช่วย AI "น้อง Bite" (แชท + เสียง)

**สถานะ:** Production-Ready · Tests 705+ · tsc 0 errors · Build ผ่าน (ตรวจจาก HEAD ปัจจุบันเสมอ — ห้ามเชื่อตัวเลขนี้ถ้าไม่ได้รันเอง)
**Production:** https://biteme-baby.com (CF Pages auto-deploy จาก `main`) · Supabase project `ivkdfognyiwjcmrhcnwz`
**⚠️ `bitemebaby-5f7.pages.dev` = build เก่าค้าง (stale) — ห้ามใช้ตรวจงาน visual/behavior โดยไม่เช็ค asset hash ก่อน

## 📂 โครงสร้างโฟลเดอร์หลัก
```
├── src/                  # ซอร์สโค้ด React + TypeScript
│   ├── lib/              # Service layer (Supabase API, AI, payments) — จุดเดียวที่แตะ DB
│   │   └── ai/           # AI context builder (branch/catalog/rounds, TTL cache 12 นาที)
│   ├── components/       # UI components (ai/, home/, layout/, admin/, ui/)
│   ├── pages/            # Routes (public + /admin/*)
│   └── __tests__/        # Vitest — 36 files / 331 tests
├── supabase/
│   ├── migrations/       # M076–M095 (schema + RLS + seed production data)
│   └── functions/        # Edge Functions (ai-proxy SSE, stripe-webhook, …)
├── docs/                 # เอกสาร 4 ไฟล์หลัก (ด้านล่าง)
│   └── archive/legacy_reports/   # รายงาน/สคริปต์เก่าทั้งหมด (179 ไฟล์)
├── public/               # รูปภาพ/manifest/PWA assets
├── e2e/                  # End-to-end specs
└── scripts/              # Build/ops scripts
```

## 📚 เอกสาร (Single Source of Truth)
| เอกสาร | เนื้อหา |
|---|---|
| [01_SYSTEM_ARCHITECTURE.md](docs/01_SYSTEM_ARCHITECTURE.md) | DB Schema, Multi-Branch Isolation (RLS 2 ชั้น), Data Flow |
| [02_API_INTEGRATIONS.md](docs/02_API_INTEGRATIONS.md) | Stripe Webhook, Edge Functions (ai-proxy SSE), Delivery Providers |
| [03_ADMIN_USER_GUIDE.md](docs/03_ADMIN_USER_GUIDE.md) | คู่มือ Admin Dashboard, Branch Switcher, AI Studio v2 |
| [04_DEPLOYMENT_RUNBOOK.md](docs/04_DEPLOYMENT_RUNBOOK.md) | Env Variables, Supabase Secrets, Cutover สั่งซื้อจริง |

## 📏 วิธีทำงานที่ถูกต้องของโปรเจค (Working Rules — ห้ามละเมิด)

1. **เริ่มงานจากสถานะล่าสุดจริงเท่านั้น** — ทุกครั้งก่อนแตะงาน ให้ `git fetch` + ตรวจ `git log` / `git status` / `git diff` ของ repo (`D:\A PROJECT\Bite Me Baby`) ว่า HEAD ตรงกับ `origin/main` หรือยัง เอกสาร/แฮนด์ออฟ/รายงานเก่า = **ข้อมูลประกอบเท่านั้น** ห้ามเชื่อเป็นพระเจ้า ต้องตรวจสถานะปัจจุบันจาก git และโค้ดจริงเสมอ
2. **ก่อนปิดงาน / ส่งแฮนด์ออฟ / เริ่มงานใหม่** — ต้อง re-verify จากสถานะปัจจุบันทุกครั้ง: commit SHA ล่าสุด, ผล gates ที่รันจริงรอบล่าสุด, และของจริงที่ deploy แล้ว (asset hash / URL) ห้ามอ้างอิงตัวเลขจากย่อหน้าก่อนหน้าโดยไม่ตรวจซ้ำ
3. **ลูปการทำงาน (Work Loop)** — ตรวจสถานะจริง → วางแผน → แก้ไข → รัน gates (`npx vitest run`, `tsc`, `eslint`, `build`) → ตรวจของจริง (preview/live ด้วย Playwright หรือ HTTP) → รายงาน → **รับอนุมัติ** → commit/push (ไม่มี push/deploy โดยไม่รายงานก่อน)
4. **Context compact** — โน้ตแฮนด์ออฟทุกฉบับต้องอ้าง **commit SHA ล่าสุด** + ผล gates ล่าสุดที่รันจริง; รอบถัดไป hydrate จาก git เป็นอันดับแรก ไม่ใช่จากโน้ต
5. **ปรับปรุงเอกสารทันทีที่สถานะเปลี่ยน** — deploy ใหม่ / commit ใหม่ / ตัดสินใจของ Owner เปลี่ยน → อัปเดตเอกสารที่เกี่ยวข้อง (README / docs / gate doc) ในรอบนั้นเลย ห้ามปล่อยให้เอกสารไล่หลังโค้ด
6. **Workspace ที่ถูกต้อง** — งานทั้งหมดทำใน repo จริงเท่านั้น ห้ามทำงานใน chat workspace หรือสำเนาเก่า

## 🚀 เริ่มต้นใช้งาน (Development)
```bash
npm install
cp .env.example .env     # กรอก keys ตาม docs/04_DEPLOYMENT_RUNBOOK.md
npm run dev              # Vite dev server
npx vitest run           # test suite
npm run build            # production build + PWA
```

## ✨ ฟีเจอร์เด่น
- 🛒 สั่งอาหาร + รอบจัดส่งรายสาขา (cutoff + capacity validation ระดับ RPC)
- 💳 Stripe Checkout + Webhook idempotent
- 🐶 น้อง Bite — AI แชท/เสียง (Web Speech API th-TH) ตอบจากข้อมูลร้านจริงแบบ SSE streaming
- 🤖 Admin AI Content Studio v2 — A/B แคปชัน 3 โทน, ประวัติ/รายการโปรด, ปฏิทินคอนเทนต์
- 🏪 Multi-Branch — Branch Switcher + RLS isolation ซ้อน 2 ชั้น