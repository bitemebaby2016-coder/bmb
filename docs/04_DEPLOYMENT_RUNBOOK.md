# 04 — Deployment Runbook

> อัปเดต: 2026-09-30 · Project: `ivkdfognyiwjcmrhcnwz` (Supabase) · Repo: `bitemebaby2016-coder/bmb`

## 1. Environment Variables (`.env` — copy จาก `.env.example`)
| ตัวแปร | ใช้ที่ไหน | หมายเหตุ |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | client | บังคับ — ห้ามใช้ service_role ฝั่ง client (P0-1) |
| `VITE_OPENROUTER_MODEL` | client (model id เท่านั้น) | A: `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | client | public key เท่านั้น |
| `VITE_GOOGLE_MAPS_API_KEY` / `MAP_ID` / `ROUTES_API_KEY` | routing/ETA | Google Cloud Console |
| `VITE_MAPBOX_ACCESS_TOKEN` | fallback routing | ทางเลือก |
| `VITE_DELIVERY_KITCHEN_LAT/LNG` | routing origin | default สาขาหลัก |
| `VITE_GRAB_SANDBOX_*` / `VITE_LINEMAN_SANDBOX_API_KEY` | delivery providers | ยังไม่ active (mockup_pending) |

⚠️ ห้าม commit `.env` (GitHub Push Protection จะ block secret scanning)

## 2. Supabase Secrets (ฝั่ง server — `supabase secrets set`)
```
OPENROUTER_API_KEY=sk-or-…      # ai-proxy
STRIPE_SECRET_KEY=sk_live_…     # create-checkout / stripe-refund / webhook
STRIPE_WEBHOOK_SECRET=whsec_…   # stripe-webhook signature verify
```
ตรวจรายการ: `supabase secrets list` · auth ของ CLI: `supabase login` หรือ `SUPABASE_ACCESS_TOKEN`

## 3. ขั้นตอน Deploy
```bash
# Frontend (Cloudflare Pages / static dist/)
npm run build          # → dist/ + PWA service worker (vite-plugin-pwa)

# Edge Functions (ทีละตัว — เมื่อแก้ code ใน supabase/functions/)
supabase functions deploy ai-proxy
supabase functions deploy stripe-webhook
# (create-checkout, stripe-refund, phone-auto-login, automation-worker, channel-webhook)

# Migrations: รันใน Supabase SQL Editor เรียงลำดับไฟล์ใน supabase/migrations/
# สถานะปัจจุบัน: M081–M095 deploy ครบแล้ว (seed ผ่าน: Branch + Rounds + Zones)
```

## 4. Cutover Checklist (สั่งซื้อจริง)
- [ ] Stripe Dashboard: register webhook `…/functions/v1/stripe-webhook` (events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`)
- [ ] ทดสอบออเดอร์จริง 1 รอบ → ตรวจ `orders.branch_id` + `audit_logs` + `payment_status`
- [ ] สลับ live keys: `pk_live_…` ใน `.env` + `supabase secrets set STRIPE_SECRET_KEY=sk_live_…`
- [ ] ตรวจ webhook signature (HMAC timing-safe) + idempotency (replay ซ้ำต้องไม่ double-count)
- [ ] Custom domain/SSL (ถ้ามี) + อัปเดต `HTTP-Referer` ใน ai-proxy

## 5. Verification ก่อน Release
```bash
npx tsc --noEmit     # 0 errors
npx vitest run       # 36 files / 331 tests
npm run build        # exit 0 + PWA generated
```

## 6. Troubleshooting
| อาการ | สาเหตุ/ทางแก้ |
|---|---|
| Deploy functions 401 Unauthorized | access token หมดอายุ → `supabase login` ใหม่ หรือ generate Access Token ใหม่ |
| AI ตอบไม่รู้จักเมนูใหม่ | context cache 12 นาที — รอรีเฟรช หรือเรียก `invalidateAiContextCache()` |
| แชทไม่ stream (ตอบทีเดียวจบ) | Edge Function เวอร์ชันเก่า → deploy `ai-proxy` ใหม่ (ระบบจะ fallback เป็น blocking เอง) |
| Stripe webhook 400 | เช็ค `STRIPE_WEBHOOK_SECRET` ตรง endpoint ฝั่ง Dashboard |
| anon อ่านตารางไม่ได้ | เช็ค RLS grant (public_read) ตาม M088 / migrations |