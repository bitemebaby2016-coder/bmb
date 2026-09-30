# 🍽️ Bite Me Baby — Restaurant Ordering PWA (Production-Ready)

แอปสั่งอาหารจัดส่ง (PWA) สำหรับร้าน **Bite Me Baby** จันทบุรี — หน้าร้านลูกค้า, Admin Dashboard แบบ Multi-Branch, ระบบชำระเงิน Stripe, รอบจัดส่งรายสาขา และผู้ช่วย AI "น้อง Bite" (แชท + เสียง)

**สถานะ:** Production-Ready · Migrations M081–M095 deploy ครบ · Tests 331/331 · tsc 0 errors · Build ผ่าน
**Production:** https://bitemebaby-5f7.pages.dev · Supabase project `ivkdfognyiwjcmrhcnwz`

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