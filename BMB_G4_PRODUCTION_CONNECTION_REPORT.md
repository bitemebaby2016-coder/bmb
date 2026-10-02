# BMB G4 — REAL META CONNECTION / PRODUCTION E2E · REPORT

วันที่: 2026-10-02 · Baseline: HEAD == origin/main == e278db0 · Production function = channel-webhook **v6**

## External actions (Owner)

| Action | Status |
|---|---|
| Real Page ID ให้มาแล้ว | **862940416913026** (CONNECTED — ใช้จริง) |
| Meta App webhook subscription เปิดแล้ว | IMPLEMENTED (ฝั่ง Meta) — แต่ Owner ระบุ "เฟซยังไม่อัพเดท" ⇒ handshake verify-and-save ยังไม่สำเร็จสมบูรณ์ |
| Verify token ตั้งไว้ (ผ่าน "cf"/local env) | DOCUMENTED — ⚠️ ดู WARNING ด้านล่าง |
| Page Access Token ถูกแชร์ใน chat | DOCUMENTED — **ไม่ถูกจัดเก็บ/ใช้/พิมพ์ซ้ำในที่ใดของงานนี้**; G4 inbound ไม่ต้องใช้ token นี้; แนะนำ rotate เมื่อกังวล (exposed ผ่าน chat) |

## ⚠️ CRITICAL WARNING (ต้องตรวจก่อน handshake จะสำเร็จ)

Verify token ที่ Meta App webhook config ใช้ **ต้องเท่ากับ `CHANNEL_WEBHOOK_VERIFY_TOKEN` ใน Supabase secrets ของ production** เท่านั้น (GET handshake จะ 403 ถ้าไม่ตรง) — Owner ระบุว่าตั้ง token "ใน cf และ env local" ⇒ **ถ้า token ใน Meta config ไม่ตรงกับค่าใน Supabase secrets handshake จะล้มเหลว** (fail-closed ตาม design) · นอกจากนี้ callback URL ที่ Meta ต้องเรียกคือ `https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/channel-webhook` — ถูก route ผ่าน Cloudflare ก็ได้ แต่ signature/token ต้องถึง endpoint นี้โดย raw body ไม่ถูกแตะ (proxy ที่ re-serialize body จะทำ HMAC ตรวจไม่ผ่าน)

## Production verification results (this gate)

| Item | Status |
|---|---|
| channel-webhook v6 deployed + reachable | DEPLOYED + RUNTIME VERIFIED (401/403 probes) |
| Real page binding: FACEBOOK + MESSENGER `862940416913026` → tenant-bmb-001, is_active=true | **RUNTIME VERIFIED** (INSERTED via platform path; 2 active bindings) |
| Brand derivation target (single-brand D3) | RUNTIME VERIFIED — default brand = **brand-bmb-main** (จาก brands.is_default config boundary) |
| Security negative: POST no signature → 401 | RUNTIME VERIFIED (re-run this gate) |
| Security negative: GET wrong verify token → 403 | RUNTIME VERIFIED |
| Caller-supplied tenant/brand override | RUNTIME VERIFIED (G3/G4 harness — RPC ไม่รับพารามิเตอร์) |
| Cross-tenant isolation / anon social_events access | RUNTIME VERIFIED (T1–T23, S1–S8 คงอยู่; bindings policy platform-only) |
| Meta handshake จริง (Meta → callback → challenge echo) | **MISSING/BLOCKED** — รอ Owner กด Verify & Save ใน Meta App ให้สำเร็จ (เฟซยังไม่อัพเดท) |
| Real Meta event → HMAC → binding → derive → ingest → social_events row | **MISSING/BLOCKED** — social_events = 0 rows; รอ real event หลัง handshake สำเร็จ |
| Duplicate/replay on real event | **MISSING** — จะ verify ด้วย real event ที่ Meta redeliver ผ่าน webhook path เท่านั้น |
| No business bypass (order/payment/inventory/kitchen) | RUNTIME VERIFIED ระดับ code+DB (S8 + harness 4) — real-event confirm จะทำซ้ำเมื่อมี event |

## Checklist สถานะ G4 PASS (จากคำสั่ง)

1. v6 deployed ✅ · 2. Meta subscribed ⏳ (verify-and-save ยังไม่เสร็จ) · 3. real Page binding ✅ · 4. real event received ❌ · 5. HMAC verified ❌(real event ยังไม่มี) · 6-9. ❌ (รอ 4) · 10. ❌ · 11. ✅(code/DB) · 12. ✅ negative (401/403) · 13. ✅ T1–T23 · 14. ✅ (367/367, lint, build, scan 0) · 15. ✅ HEAD==origin/main · 16. ✅ WORKTREE CLEAN

## FINAL RESULT

```
G4 = HOLD — EXTERNAL DEPENDENCY

ขั้นตอนที่เหลือ (Owner, ฝั่ง Meta):
1) ยืนยัน callback URL ใน Meta App =
   https://ivkdfognyiwjcmrhcnwz.supabase.co/functions/v1/channel-webhook
2) ยืนยัน hub.verify_token ใน Meta config == CHANNEL_WEBHOOK_VERIFY_TOKEN
   ใน Supabase secrets (ถ้าต่างกัน จะ 403 fail-closed — แก้ที่ Meta config)
3) กด Verify & Save จน Meta แสดง subscribed
4) ทิ้งให้เกิด 1 real event (comment/message บน page 862940416913026)
   แล้วแจ้งกลับ — AI Dev จะตรวจ chain จริง:
   social_events row (platform/page/event_id/tenant/brand/type/state)
   + duplicate/replay + ไม่มี business bypass → แล้วจึงอัปเดต G4 = PASS
```

เมื่อ real event เข้า: ตรวจด้วยคำสั่ง read-only (`SELECT` จาก social_events ตาม page_id 862940416913026) — ไม่ mutate, ไม่แตะ secrets