# BMB_WAVE_2_HANDOFF.md
**วันที่: 2026-09-27 · Wave 2 = Production Gate PASS**

## สิ่งที่ทำเสร็จ
- F-05: `order_status_history` (authoritative trigger, same-transaction, RLS deny-by-default,
  actor mapping ครบ) — **PASS 12/12 on Production** (`e2e/wave2-order-history.json`)
- F-06: `drivers.user_id` + JWT-bound RPCs + scoped RLS + `link_driver_user` +
  RiderPWA email/password login — **PASS 14/14 adversarial tests on Production**
  (`e2e/wave2-driver-security.json`) — phone-only identity ถูกปิดถาวร
- F-18: `recipes` anon → deny, authenticated → read, admin → write
  (`042_recipes_rls_intent.sql`) — matrix PASS 15/15 (`e2e/wave2-rls.json`)
- Quality: tsc 0 · vitest 44 files · build ✓ · dist scan 0 hits

## Production evidence
- `e2e/wave2-order-history.json` · `e2e/wave2-driver-security.json` · `e2e/wave2-rls.json`
- `e2e/wave2-setup.json` (provisioning) · `BMB_WAVE_2_PRODUCTION_APPLY_EVIDENCE.md`
- Cloudflare production deployment ยืนยันจาก runtime (2026-09-27, W3-0 Reality
  Reconciliation): production คือ build จาก `84fbd75` — asset fingerprint match 6/6
  (index-DphkYgGq.js / rolldown-runtime-hePW80VL.js / react-vendor-DK_VtTwx.js /
  state-vendor-Brj8_dxs.js / supabase-vendor-OACgMRo1.js / index-vxWXmwip.css) และ
  SHA256 ตรง local build จาก 84fbd75 ทุกไฟล์ที่สุ่มตรวจ · ข้อความเดิมที่ระบุ
  `c6a4014` = เก่าแล้ว (ข้อมูลจาก Wave 1 deployment `42809703` — ถูก overwrite ด้วย
  deployment ใหม่ก่อน Wave 2 gate) · **Wave 2 client (RiderPWA) deploy แล้ว — ไม่มี
  DEPLOYMENT GAP**

## Commits (Wave 2)
2530eba (F-05) · d289706 + c0f2f09 (F-06 migration) · 68f1419 (F-06 client) ·
7d3fd41 / 90157b6 / 2267014 (harness fixes) · d3153c6 (report) · หลัง gate: evidence+handoff commits

## Tests
tsc 0 · vitest 44/44 · build ✓ · F-05 12/12 · F-06 14/14 · F-18 15/15 · dist scan 0 hits

## Remaining GAP
1. F-05 backfill strategy — รอ Owner (HISTORICAL_BASELINE vs BACKFILL_UNKNOWN; ~2 แถวเก่า)
2. F-18 recipes row-level visibility column — schema decision รอ Owner
3. F-06 SMS OTP provider — infrastructure MISSING (Admin provisioning ใช้งานได้แล้ว)

## Owner Decisions ที่รอ (สรุป)
1. อนุมัติ/ไม่อนุมัติ backfill (ถ้าอนุมัติ HISTORICAL_BASELINE → อนุญาตให้รัน PROPOSED file)
2. ออกแบบ recipes visibility (เพิ่ม column หรือยอมรับ table-level ตามปัจจุบัน)
3. SMS OTP provider (ถ้าต้องการ) — ไม่เร่งด่วน

## Wave 3 prerequisites (จาก GAP MAP + Owner decisions ล็อกแล้ว)
- F-03/F-04: ai-proxy deploy (OpenRouter key = server-side secret — ต้อง
  `supabase secrets set OPENROUTER_API_KEY` ก่อน deploy; Owner: **ไม่ rotate**)
- F-14: schema `source_channel` + `external_ref_id` + idempotency (ตาม Decision 09) —
  เป็น schema change → ต้องได้ Owner sign-off ตามขั้นตอน migration ปกติ
- F-15/F-16: ตัดสิน EF dormant + notification transport (Owner decisions ค้างจาก GAP MAP)

## Exact recommended next scope
**W3-A — AI Gateway**: deploy ai-proxy + `supabase secrets set OPENROUTER_API_KEY`
+ runtime probe → STOP/VERIFY (ไม่แตะ provider/keys นอก scope)

**HARD STOP — รอคำสั่ง Owner สำหรับ Wave 3**
