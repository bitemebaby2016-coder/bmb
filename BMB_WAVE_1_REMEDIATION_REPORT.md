# BMB_WAVE_1_REMEDIATION_REPORT.md
**WAVE 1 — SECURITY & ADMIN AUTHORITY (F-01, F-02, F-17)**
วันที่: 2026-09-27 · Scope: เฉพาะ Wave 1
Status vocabulary: ใช้ READY/PARTIAL/BLOCKED/… เท่านั้น (ไม่ใช้ DONE/COMPLETE/100%)

## §1 Baseline
- HEAD ก่อนเริ่ม: `fdc7898` (main, origin/main)
- Remote: `git@github.com-bmb:bitemebaby2016-coder/bmb.git`
- Pre-implementation audit แล้ว: router, auth provider (Supabase Auth), session impl,
  admin guard, public credential sources, env usage, AI transport, ai-proxy source

## §2 F-01 Remediation — PUBLIC ADMIN CREDENTIAL
1. `src/lib/adminUi.ts` — ถอด email fallback (`admin@bmb.co.th`/`owner@bmb.co.th`)
   ออกจาก `shouldShowAdminLink` → ใช้ `profiles.role === 'admin'` เท่านั้น (+อัปเดต test)
2. `docs/BiteMeBaby_API.md`, `SUPABASE_SETUP.md` — redact credential ออกจากเอกสาร
3. Production verify (Admin API, service key จากไฟล์ local gitignored):
   - ผู้ใช้ `admin@bmb.co.th` ไม่พบใน production auth (ไม่มีบัญชีให้ ban)
   - ยืนยันสด: login ด้วย `admin@bmb.co.th/admin123` → **HTTP 400 Invalid login
     credentials** → public credential ใช้ไม่ได้แล้ว = PASS
4. Dedicated Test Admin: สร้าง `qa-admin@bmb.co.th` (email_confirm + profiles.role='admin')
   - Password สุ่ม → เก็บใน `supabase/secrets.local.env` (gitignored, ไม่ commit, ไม่อยู่
     ใน build/docs/logs) ช่องทาง BMB_TEST_ADMIN_EMAIL / BMB_TEST_ADMIN_PASSWORD
   - Login สด → **HTTP 200** = PASS
- Evidence: `e2e/wave1-f01-auth-ops.json`

## §3 F-02 Remediation — ADMIN SESSION (reload/deep-link)
Root cause:
- RC-1: `main.tsx` defer `checkAuth()` 1.5s หลัง first paint → ตอน reload `/admin/*`
  guard เห็น isAuthenticated=false ก่อน restore เสร็จ → redirect /login (16/16)
- RC-2 (พบใหม่ระหว่าง verification): production DB ไม่มี GRANT SELECT บน `public.profiles`
  ให้ authenticated → `fetchProfileRole()` ตอบ 42501 → role=null → AdminRoute พาไป `/`
  (ยืนยันสดด้วย JWT ของ qa-admin)

แก้จริง (code, non-destructive):
1. `src/main.tsx` — เริ่ม `checkAuth()` ก่อน first render
2. `src/store/authStore.ts` — เพิ่ม `isInitializing` (จน session restore เสร็จ)
3. `src/App.tsx` — ProtectedRoute/AdminRoute รอด้วย spinner ระหว่าง isInitializing
   (ยังตรวจ role จาก DB จริงทุกครั้ง — ไม่มี client-only fake authorization)
4. `src/store/authStore.ts` — fetchProfileRole fallback RPC `public.is_admin()`
   (SECURITY DEFINER; ทดสอบสดบน production = true) — DB ยังเป็น authority
5. `supabase/migrations/PROPOSED_wave1_profiles_grant.sql` — PROPOSED (ยังไม่รัน):
   `GRANT SELECT ON public.profiles TO authenticated;`

ผล Admin E2E (production build + `vite preview` + Playwright, 28 checks):
- Login PASS · Reload /admin PASS · Deep-link 16/16 เฉพาะ route ที่มีจริง PASS
- Session persistence (reload→navigate→reload→deep-link) PASS
- Logout → block PASS (รวม reload หลัง logout) · Unauthorized → /login PASS
- **ห้ามนับ dead route**: `/admin/pre-orders|kitchen|recipes` มีใน ADMIN_NAV_ITEMS แต่
  ไม่มี route ใน App.tsx (ตก catch-all → `/`) → ไม่นับ PASS, บันทึกเป็น finding แยก
Evidence: `e2e/wave1-admin-e2e.json` (25/28; fail 3 = dead nav routes เท่านั้น)
Residual: PROPOSED GRANT รอ Owner รัน + re-verify บน production หลัง deploy

## §4 F-17 Remediation — SECRET HYGIENE
1. `src/lib/aiVoice.ts` — เคยเรียก OpenRouter ตรงด้วย `VITE_OPENROUTER_API_KEY`
   → แก้เป็นเรียกผ่าน ai-proxy (JWT): Client → Supabase Auth JWT → ai-proxy → OpenRouter
2. `src/lib/aiToolCalling.ts` — ตรวจแล้วสะอาดบนดิสก์ (ใช้ ai-proxy อยู่แล้ว)
3. `.env` — ลบ VITE_SUPABASE_SERVICE_ROLE_KEY / VITE_STRIPE_SECRET_KEY /
   VITE_STRIPE_WEBHOOK_SECRET → ย้ายไป `supabase/secrets.local.env` (ไม่มี VITE_ prefix,
   gitignored) กัน Vite inline เข้า build
4. `.env.local` — ลบ `VITE_OPENROUTER_API_KEY` (ค่าย้ายเข้า secrets.local.env; แนะนำ
   **rotate key นี้** ใน OpenRouter ก่อน `supabase secrets set` ตอน deploy ai-proxy Wave 3)
5. `.env.example` — ลบ secret vars + ใส่หมายเหตุสถาปัตยกรรม
6. คงไว้ตามสถาปัตยกรรม: anon/publishable key, Stripe publishable, Google Maps keys
   (client by design — แนะนำ restrict ที่ GCP), Grab/LINE MAN sandbox mock values

Verification:
- Source: grep `VITE_OPENROUTER_API_KEY` ใน src/ = 0 hits
- Build: `npm run build` PASS → สแกนทั้ง dist/ (initial + lazy chunks + assets + sw)
  = **238 ไฟล์, hits = 0** (patterns: sk-or-*, VITE_OPENROUTER_API_KEY, sk_test/live_*,
  whsec_*, sb_secret_*, "role":"service_role", VITE_*SECRET*)
- Path ปัจจุบัน: Client → JWT → ai-proxy → OpenRouter (key server-side only)
- Evidence: `e2e/wave1-build-secret-scan.json`

## §5 Files Changed (4 commits หลัง fdc7898)
| Commit | Purpose | Files |
|---|---|---|
| 6755742 | F-02: session restore ก่อน render | src/main.tsx, src/store/authStore.ts, src/App.tsx |
| 78dd15e | F-01: ถอด email fallback + redact docs | src/lib/adminUi.ts, src/__tests__/adminUi.test.ts, docs/BiteMeBaby_API.md, SUPABASE_SETUP.md |
| db85c79 | F-17: AI voice ผ่าน ai-proxy + purge env | src/lib/aiVoice.ts, src/pages/VoiceDemoPage.tsx, .env.example |
| a75b28d | fetchProfileRole fallback is_admin() + harness/evidence | src/store/authStore.ts, e2e/wave1*.cjs + wave1*.json |

## §6 Migrations / Config Changed
- EXECUTED: ไม่มี migration ใหม่ — มีเพียง auth ops บน Supabase (สร้าง qa-admin + profiles.role) ตาม D-12
- PROPOSED (ยังไม่รัน): supabase/migrations/PROPOSED_wave1_profiles_grant.sql
- Config: .env / .env.local / .env.example จัดระเบียบ; secrets ไปที่ supabase/secrets.local.env (gitignored)

## §7 Security Verification
- npx tsc --noEmit = PASS (exit 0)
- npx vitest run = **44 test files passed (0 failed)** รวม test ใหม่ F-01 (legacy email ไม่ถูกเชื่อ)
- npm run build = PASS (exit 0)
- Production auth สด: public credential 400 / test admin 200 / is_admin() = true

## §8 Admin E2E Verification
- 25/28 PASS (e2e/wave1-admin-e2e.json) — ตามรายละเอียด §3
- ข้อจำกัด: ทดสอบบน local preview ของ production build — ยังไม่ได้ verify บน
  bitemebaby-5f7.pages.dev หลัง deploy (re-run e2e/wave1AdminE2E.cjs ด้วย BASE_URL prod)

## §9 Build Secret Scan
- สแกนทั้ง dist/ (initial + lazy chunks + assets + sw) = 238 ไฟล์ → **0 hits**

## §10 Production Evidence
- admin@bmb.co.th/admin123 → 400 Invalid login credentials (สด 2026-09-27)
- qa-admin@bmb.co.th → login 200, profiles.role=admin, is_admin()=true
- ไฟล: e2e/wave1-f01-auth-ops.json, e2e/wave1-admin-e2e.json, e2e/wave1-build-secret-scan.json

## §11 Remaining Findings (ห้าม mark โดยไม่มี evidence)
- F-02 residual: GRANT SELECT profiles (PROPOSED รอ Owner) — client ชดเชยด้วย is_admin() RPC แล้วใช้งานได้จริง
- Production deploy: build ใหม่ยังไม่ได้ deploy ขึ้น Cloudflare — รอการ push หรือ owner
- Dead nav routes: /admin/pre-orders, /admin/kitchen, /admin/recipes ไม่มี route จริง (Wave 2/4 โดเมน)
- F-03 ai-proxy ยังไม่ deploy (Wave 3) — OpenRouter key ควร rotate + supabase secrets set
- Findings อื่น (F-04..F-23) คงสถานะเดิมตาม GAP MAP

## §12 Commit / HEAD
- HEAD หลัง Wave 1: **a75b28d** (main, ยังไม่ push origin — รอการอนุมัติ deploy)

## §13 Rollback Notes
- git revert <sha> ราย commit ได้ปลอดภัย (ไม่มี executed schema change)
- F-01 rollback: ลบ/unban qa-admin ผ่าน Supabase Dashboard; password อยู่ secrets.local.env
- F-17 rollback: กู้คืน secrets กลับ .env ไม่แนะนำ (risk เดิม) — restore จาก secrets.local.env ด้วยมือถ้าจำเป็น

---

# HARD STOP

```
WAVE 1 = VERIFIED (local production-build verification) / PRODUCTION DEPLOY PENDING

F-01 = PASS — public credential ตาย (400 สด), ไม่ปรากฏใน UI/docs/code,
       test credential อยู่ secret channel เท่านั้น
F-02 = PASS (code + local E2E 25/28, dead routes ยกเว้นตามกติกา)
       residual: PROPOSED GRANT + prod deploy รอ Owner
F-17 = PASS — source/initial bundle/ALL lazy chunks/build = 0 secret hits;
       AI key = server-side only (ai-proxy)

HEAD = a75b28d (main, unpushed)
Production verification = รอ deploy (git push → Cloudflare) แล้ว re-run
  e2e/wave1AdminE2E.cjs กับ BASE_URL=https://bitemebaby-5f7.pages.dev

Remaining blockers = (1) PROPOSED migration รอ Owner รัน (ไม่บังคับ — client ชดเชยแล้ว)
                     (2) production deploy รออนุมัติ
Next recommended Wave = WAVE 2 (Order History + Driver Identity)
```

**HARD STOP — WAIT FOR OWNER**
