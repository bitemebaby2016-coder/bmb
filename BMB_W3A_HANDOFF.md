# BMB_W3A_HANDOFF.md
**Wave 3-A — AI Gateway · วันที่: 2026-09-27 · GATE = PASS · HARD STOP**

## สิ่งที่เสร็จ (W3-0 + W3-A)
- **W3-0 Reality Reconciliation**: ยืนยันจาก production runtime (ไม่ใช่เอกสาร) —
  Cloudflare production = build จาก `84fbd75` (asset fingerprint + SHA256 match 6/6) ·
  `c6a4014` ใน BMB_WAVE_2_HANDOFF เป็นข้อมูล Wave 1 ที่ stale → แก้เอกสารแล้ว ·
  **ไม่มี DEPLOYMENT GAP** · แก้ CI lint (eslint ignores scripts/*.cjs) → lint 0 errors
- **W3-A AI Gateway (F-03/F-04)**: audit `supabase/functions/ai-proxy` (ไม่สร้าง duplicate) →
  set `OPENROUTER_API_KEY` (existing key, ไม่ rotate) บน Supabase production →
  **deploy ai-proxy ครั้งแรกบน production** → พบ auth defect (anon ได้ 200) →
  แก้ด้วย in-function JWT verification → redeploy → runtime probe PASS 11/11

## Production evidence
- `e2e/w3a-ai-proxy-runtime.json` — 11/11 (unauth 401 · anon 401 · CORS · 400/405 ·
  valid 200 ครบ contract · guardrail · provider error 502 · 0 secret leak)
- Supabase functions list: ai-proxy ACTIVE (ivkdfognyiwjcmrhcnwz) · secrets list:
  OPENROUTER_API_KEY present
- Cloudflare production = `84fbd75` (ไม่แตะ src/ ในงานนี้ — ไม่ต้อง redeploy frontend)
- tsc 0 · vitest 44 files / 358 tests · build ✓ · lint ✓ · dist+git secret scan 0 hits

## Commits (W3-A)
- fix(ci): eslint ignores for scripts/*.cjs
- docs(w3-0): handoff reconciliation — production = 84fbd75
- feat(w3a): ai-proxy JWT verification (defense-in-depth)
- test(w3a): production runtime probe harness + evidence
- docs(w3a): evidence + handoff

## Security results
- AI provider key = server-side only (Deno.env) · ไม่อยู่ใน client/dist/logs/git
- Authentication boundary verified ที่ production runtime (ไม่ใช่แค่ source)
- AI transaction authority: ไม่มี (read-only advice + server-side guardrail)

## GAP (ไม่ blocker — เสนอให้ Owner จัดลำดับภายหลัง)
1. No rate limiting/quota บน ai-proxy (authenticated users ไม่จำกัด)
2. No explicit upstream timeout/retry
3. `tools` param ไม่ถูก forward (chatWithToolSupport tool path dormant)
4. CORS ACAO=* (ยอมรับได้เพราะ JWT required)

## Owner Decisions ที่ค้าง (ไม่กระทบ W3-A)
- Wave 2 คงค้าง 3 ข้อ: F-05 backfill · F-18 recipes visibility column · F-06 SMS OTP provider
- W3-B จะต้องมี decision: automation scope/policy (รอ Owner)

## W3-B prerequisites (จาก GAP MAP)
- F-14/F-15/F-16 อยู่ใน W3-B/C/D ตาม scope · เริ่มด้วย audit เหมือน W3-A
- ห้ามทำ W3-B จน Owner ออกคำสั่ง (HARD STOP ปัจจุบัน)

## Exact next command (เมื่อ Owner อนุมัติ)
`START W3-B AUTOMATION` → W3-B ต้องเริ่มด้วย AUDIT (automation/workers/inventory EF
ที่ยังไม่ deploy: check-inventory, inventory-reorder, generate-rewards, daily-report,
ai-daily-report) แล้วไล่ AUDIT→IMPLEMENT→TEST→PROD VERIFY→GATE→COMMIT→PUSH→HARD STOP

## สถานะ git หลัง push
HEAD == origin/main · worktree CLEAN · ไม่มี force push
