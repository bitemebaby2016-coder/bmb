# 🚀 HANDOFF — Physical Pilot → AI Assistant Extensions (AI-EXT)

**วันที่:** 2026-09-30 · **สถานะ:** Physical Pilot เปิดหน้าร้านพร้อมแล้ว (Open-Shop Ready)
**Git baseline:** ล่าสุดบน `origin/main`

---

## 1. ✅ Phase ที่ปิดแล้ว: Physical Pilot / Open-Shop Gates

| Gate | ผล | หลักฐาน |
|------|-----|---------|
| Migrations M081–M095 deploy Supabase | ✅ สำเร็จ | Seed ผ่าน: Branch + Rounds + Zones พร้อมใช้ |
| Env: Stripe / Google Maps / Supabase keys | ✅ ครบ | `.env` มีจริง, `WEBHOOK_SECRET` ตั้งแล้ว |
| `npx tsc --noEmit` | ✅ 0 errors | — |
| `npx vitest run` | ✅ 36/36 files, 331/331 tests | — |
| `npm run lint` | ✅ 0 errors (แก้ no-irregular-whitespace 3 ไฟล์แล้ว) | canonicalOrderFlow.test.ts / bmbAdminApi_orders.ts / AdminOrders.tsx |
| `npm run build` | ✅ Exit 0 + PWA/Service Workers generated | — |

**E2E ยืนยันแล้ว (code-path audit):**
- Public Order: CheckoutPage → `p_branch_id` + `p_scheduled_date` → M089 RPC (validate ERR_ROUND_BRANCH_MISMATCH) → orders.branch_id + audit_log metadata.branch_id
- Stripe Webhook: signature HMAC timing-safe → record_payment_result idempotent → update payment_status
- Admin Isolation: BranchSwitcher (AdminNav) → activeBranchId → getOrdersPaged filter + RLS M088 ซ้อน 2 ชั้น
- Guest Tracking: OrderTrackPage — owner RLS / guest phone RPC, anti-enumeration

## 2. 🎯 Phase ถัดไป: AI Assistant Extensions (น้อง Bite & Content Studio)

### สิ่งที่สร้างไปแล้วในรอบนี้ (AI-EXT baseline)

| ไฟล์ | หน้าที่ |
|------|---------|
| `src/lib/ai/aiContextBuilder.ts` | `buildAiStoreContext()` — รวม Branch (URL `?branch=`) + Catalog (M092) + Rounds วันนี้/พรุ่งนี้ เป็น system context ให้ AI |
| `src/lib/aiService.ts` | `chatWithAI(msg, runtimeContext?)` — รับ context แทรกเข้า system message (ไม่ทำลาย caller เดิม) |
| `src/components/ai/BiteChatWidget.tsx` | วิดเจ็ตมุมขวาล่างบนหน้าร้าน: text chat + 🎙️ Web Speech API (th-TH) + 🔊 ตอบด้วยเสียง (SpeechSynthesis) |
| `src/pages/admin/AdminAiStudio.tsx` | Content Studio: 3 Quick Templates (เปิดร้าน/เมนูขายดี/อัลบั้มผลงาน) จาก featured products + M094 portfolio + M093 verified reviews, AI polish, One-Click Copy |
| Wiring | Route `/admin/ai-studio` (App.tsx L231) + Nav "AI Studio" (adminUi.ts) + Widget mount บน HomePage (L298) |

### งานต่อยอดที่แนะนำในเฟสถัดไป
1. **Voice polish** — ต่อยอด `AIVoiceService` (src/lib/aiVoice.ts) ให้ widget ใช้ tool-calling สั่งเปิดเมนู/สั่งซื้อจากเสียง
2. **Streaming responses** — อัปเกรด ai-proxy Edge Function ให้ stream SSE ลด latency การพิมพ์ตอบ
3. **Content Studio v2** — กำหนดเวลาโพสต์ (schedule queue), A/B แคปชัน, ประวัติ generate ต่อผู้ใช้
4. **Context caching** — แคช buildAiStoreContext 10–15 นาที เลี่ยง query ซ้ำทุกแชท
5. **รัน vitest หลัง merge AI-EXT** — ยืนยัน 36/36 ยังคงผ่าน (tsc + build ผ่านแล้วในรอบนี้)

## 3. 📋 Cutover Checklist (ก่อน Open-Shop จริง)
- [ ] Stripe Dashboard: register webhook endpoint `…/functions/v1/stripe-webhook` (3 events: succeeded/failed/refunded)
- [ ] ทดสอบออเดอร์จริง 1 รอบ → เช็ค orders.branch_id + audit_logs
- [ ] สลับ live keys: `pk_live_…` + `supabase secrets set STRIPE_SECRET_KEY=sk_live_…`
- [ ] Custom domain/SSL บน Supabase Hosting (ถ้ามี)

---
*สร้างโดย Cline — พร้อมต่อยอดเฟส AI ต่อทันที*