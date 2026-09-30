# 02 — API Integrations (Single Source of Truth)

> อัปเดต: 2026-09-30 · อ้างอิงโค้ดจริง ณ commit `c411799`

## 1. Supabase Edge Functions (`supabase/functions/`)
| Function | หน้าที่ | Auth |
|---|---|---|
| `ai-proxy` | OpenRouter chat completions relay — **SSE streaming** เมื่อ body มี `stream: true`; ฝัง guardrails ฝั่ง server; JWT verify 2 ชั้น (platform + ตรวจ `/auth/v1/user` เอง); fallback model ทำที่ client | JWT (anon key ถูกปฏิเสธ) |
| `stripe-webhook` | รับ 3 events (succeeded/failed/refunded) — signature HMAC timing-safe → `record_payment_result` idempotent → update `payment_status` | Stripe signature |
| `create-checkout` | สร้าง Stripe Checkout Session สำหรับ order/pre-order | JWT |
| `stripe-refund` | คืนเงินจากหน้า admin | JWT + is_admin |
| `phone-auto-login` | PWA quick login ด้วยเบอร์โทร (ไม่มี OTP — owner decision, เอกสารข้อจำกัดอยู่ใน header ของ function) | — |
| `automation-worker` | scheduled jobs (content/push pipeline) | service_role |
| `channel-webhook` | omnichannel channel identity ingest | secret |

## 2. Stripe
- ฝั่ง client: เฉพาะ `VITE_STRIPE_PUBLISHABLE_KEY` (public) — secret อยู่ฝั่ง server เท่านั้น (`supabase secrets set`)
- Webhook endpoint: `…/functions/v1/stripe-webhook` — ลงทะเบียน 3 events ใน Stripe Dashboard
- Idempotency: `record_payment_result` กัน replay ซ้ำ
- Cutover live: สลับ `pk_live_…` + `supabase secrets set STRIPE_SECRET_KEY=sk_live_…` + register webhook ฝั่ง live

## 3. AI (OpenRouter)
- Models: A = `nvidia/nemotron-3-ultra-550b-a55b:free` (primary), fallback = `qwen/qwen3.7-flash`
- Client: `src/lib/aiService.ts` — `chatWithAI()` (blocking) / `chatWithAIStream()` (SSE, fallback อัตโนมัติเป็น blocking)
- Context: `src/lib/ai/aiContextBuilder.ts` — Active Branch + Catalog (M092) + Delivery Rounds, in-memory cache TTL 12 นาที (`invalidateAiContextCache()` สำหรับ force refresh)
- Guardrails: ฝังใน `ai-proxy` server-side (ห้ามสัญญา/แก้ราคา/สถานะออเดอร์ — read-only advice)

## 4. External Delivery Providers (สถานะจริง)
- Adapters: `src/lib/providers/` + `externalProviders.ts` — foundation พร้อมแต่ **ยังไม่ active**
- `foodpanda.ts`: status `mockup_pending` — ไม่มี credentials; quotes เป็น estimate เท่านั้น (แสดง label "mockup" ใน UI จริง)
- ตาราง `provider_orders` พร้อม (0 rows) — จะเปิดใช้เมื่อได้ sandbox keys จริง (`VITE_GRAB_SANDBOX_*`, `VITE_LINEMAN_SANDBOX_API_KEY`)

## 5. Maps / Routing
- Google Maps Platform: Routes API, Places API, Maps JS, Geocoding (`VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`, `VITE_GOOGLE_ROUTES_API_KEY`)
- Fallback: Mapbox (`VITE_MAPBOX_ACCESS_TOKEN`)
- Kitchen origin: `VITE_DELIVERY_KITCHEN_LAT/LNG` (ค่า default = สาขาหลัก Chanthaburi)

## 6. Supabase Client
- Client เดียว: `src/lib/supabase.ts` (anon key เท่านั้น — service_role ถูกถอดออกจาก bundle แล้ว P0-1)
- Storage: bucket `bmb-images` (media_assets M011) — upload ผ่าน admin API