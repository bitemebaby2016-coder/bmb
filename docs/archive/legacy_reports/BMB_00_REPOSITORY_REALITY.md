# BMB_00_REPOSITORY_REALITY.md
**Phase 0 — Repository & Environment Discovery**
**Audit date:** 2026-09-27 · **Evidence level:** SOURCE CODE + CONFIG + MIGRATIONS (runtime = NOT YET VERIFIED ใน phase นี้)
**Rule ปฏิบัติ:** เอกสารเก่าทุกชิ้นถือเป็น UNVERIFIED CLAIM

---

## 1. Repository จริงมีอะไร

**Repo:** `git@github.com-bmb:bitemebaby2016-coder/bmb.git` · branch `main` · HEAD `fdc7898` ("fix: BiteHero import Link from react-router-dom (Cloudflare build fix)")

### 1.1 โครงสร้างหลัก (verified จาก filesystem)

| ส่วน | เนื้อหาจริง |
|---|---|
| `src/` (frontend PWA) | React 19 + Vite + Tailwind 4 + Zustand + react-router-dom 7 + PWA (vite-plugin-pwa) · ~40 components · ~35 pages (customer + admin 17 หน้า + info 6 หน้า) · 22 test files (vitest) |
| `src/lib/` | 60+ service modules: supabase client, orderStateMachine, orderVocabulary, paymentGateway, deliveryRouter, kitchenService, availabilityEngine, aiService, 12 `bmbAdminApi_*` modules, providers (biteDrive, grab, lineman, foodpanda) |
| `src/store/` + `src/stores/` | **มี 2 โฟลเดอร์ store ซ้ำ** (cartStore.ts ทั้งคู่) — DUPLICATE candidate |
| `supabase/migrations/` | **039 migration files (001–039)** + HANDOFF_002_SCHEMA.md |
| `supabase/functions/` | 14 Edge Functions: stripe-webhook, stripe-refund, create-checkout, check-inventory, calculate-promotion, ai-proxy, ai-daily-report, daily-report, generate-rewards, inventory-reorder, phone-auto-login, random-menu-draw, track-share, vote-menu |
| `e2e/` | `.cjs` scripts (runE2E, prodSmoke, webhook-smoke, truthLock, prodRunContracts, prodApplyMigrations) + SQL contract files 017–039 + screenshots + result JSON — มี production run artifacts |
| `docs/` | ~25 เอกสาร spec/plan/evidence (ถือเป็น historical claim เท่านั้น) |
| `scripts/` | 5 utility scripts (checkProductionHeaders, promoteAdmin, fix035) |
| `supabase.temp/` | local secrets (srkey.local) — **service role key อยู่บน disk ใน project folder** |

### 1.2 Legacy / Dead / Duplicate (evidence)

| ประเภท | หลักฐาน | สถานะ |
|---|---|---|
| **Stale worktree copy ทั้ง repo** | `src/.kilo/worktrees/satisfying-aphid/` มี src + supabase + docs + public สำเนาเก่า (ไม่มี admin pages, functions เฉพาะ ai-proxy) | DUPLICATE / legacy snapshot — ห้ามใช้เป็น evidence |
| Vite scaffold leftovers | `src/counter.ts`, `src/main.ts` (entry จริงคือ `src/main.tsx`) | dead code |
| Zustand store ซ้ำ | `src/store/cartStore.ts` vs `src/stores/useCartStore.ts` ฯลฯ | DUPLICATE (ต้องยืนยัน active ผ่าน import graph ใน Phase 1) |
| Root ปน log/scratch files | `build.log, new_build.txt, tsc_output.txt, vt-*.log, lh-*.log, fix_all_pages.cjs, final_build.txt` ฯลฯ | technical debt (repo hygiene) |
| `supabase-migration.sql` ที่ root | SQL ไฟล์นอก migrations/ — ต้องเทียบกับ migration chain | UNKNOWN รอ Phase 2 |
| `.env.example` ประกาศ `VITE_STRIPE_SECRET_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_OPENROUTER_API_KEY`, `VITE_GRAB_SANDBOX_*` | `.env.example:10,14,23-24,30-32` | **CONTRADICTED** กับ `src/lib/supabase.ts:10-16` ที่ระบุ key privileged อยู่ server เท่านั้น — เอกสาร setup ชี้ทางผิด (ความเสี่ยง: owner ตั้ง VITE_SECRET แล้ว Vite inline ลง bundle เหมือนบั๊กเดิม P0-1) |
| Env hardcode fallback | `src/lib/supabase.ts:7` fallback URL `https://ivkdfognyiwjcmrhcnwz.supabase.co` | ยอมรับได้ (anon-only) แต่เป็น hardcoded env |

---

## 2. Repository "อ้าง" ว่ามีอะไร (README / docs — UNVERIFIED CLAIM)

จาก `README.md` (ยุค 2026-09-22):

- PWA storefront ครบ flow, ออเดอร์ server-authoritative, PromptPay TXN + COD, Stripe webhook production-verified 6/6
- Migration **34/34 LIVE (001–034)**, ACL gate PASS (grant probe 7/7), contracts 5/5 production
- Tests "179/179 PASSED (22 files)" (บรรทัด 4) **ขัดกับบรรทัด 23 ของไฟล์เดียวกัน: "163/163 PASS (21 files)"**
- SEC-02: AI key ฝั่ง server เท่านั้น (production bundle scan = 0 key hits)
- ยังไม่ปิด (ยอมรับเอง): PAY-02 บิลจริง, PAY-03 refund, Bite Drive real pilot, Lighthouse ≥ 90

## 3. Discrepancies สำคัญ

```
CONTRADICTION #1 — จำนวน migrations
Expected (README): 34/34 LIVE (001–034)
Actual (supabase/migrations/): 039 files (001–039) + contracts 035–039 ใน e2e/
Evidence: supabase/migrations/035..039*.sql, e2e/contracts_0*{35,36,37,38,39}*.sql
Impact: README stale; ต้องยืนยันกับ production DB ว่า 035–039 apply แล้วหรือไม่ (drift check — Phase 2)

CONTRADICTION #2 — จำนวน tests (RESOLVED ด้วย live run 2026-09-27)
README อ้าง 179/179 (README.md:4) และ 163/163 (README.md:23) — ทั้งคู่ผิดทั้งคู่
Actual (npm test, 2026-09-27): 358/358 pass, 44 test files
   = 22 ไฟล์จริง (src/__tests__/) + 22 ไฟล์ duplicate จาก src/.kilo/worktrees/... ถูก vitest หยิบมารันซ้ำ
Impact: (a) ตัวเลขใน README ไม่น่าเชื่อถือ (b) worktree ปน test suite ทำให้ผล test บวมเท็จ (c) coverage จริง ≈ 179 tests ใน 22 ไฟล์ (ยังต้องตรวจรายไฟล์)

CONTRADICTION #3 — key handling
Expected (README/SEC-02, supabase.ts:10-16): secret ทุกตัวอยู่ server เท่านั้น
Actual: .env.example + SUPABASE_SETUP.md + docs/BiteMeBaby_DEPLOYMENT.md ยังสอนใส่
       VITE_SUPABASE_SERVICE_ROLE_KEY / VITE_STRIPE_SECRET_KEY (VITE_ = จะโดน inline ลง bundle)
Evidence: .env.example:10,23-24 · SUPABASE_SETUP.md:36-38 · src/lib/supabase.ts:12-13 (บันทึกบั๊กเดิม)
Impact: เอกสาร setup เป็นบ่อเกิด security regression ซ้ำ

CONTRADICTION #4 — Stripe
Expected (.env.example:21): "BLOCKED (keys not provided yet). Code path ready"
Expected (README): Stripe webhook production-verified
Evidence จริง: e2e/webhook-smoke-result.json + functions/stripe-webhook (production URL จริง)
Impact: เอกสารสองยุคขัดกัน — ต้องยืนยัน payment จริงใน Phase 8
```

## 4. ค้นหาตาม Mission (สรุปเบื้องต้น — ลงลึกใน Phase 15)

- **TODO:** `AI_WORK_STATE.md:468` — "remove MOCK_STOCK/MOCK_BADGE/MOCK_RATING overlays in homeProviders.ts" (ต้องยืนยันว่า code ปัจจุบันยังเหลือไหม)
- **Mock/hardcode ที่เอกสารเดิมชี้ไว้ (ยังไม่ยืนยัน):** `DeliveryManagement.tsx` MOCK_DRIVERS, `socialProofReviews.ts` curated reviews, `drinksMenu.ts`/`snacksMenu.ts` เมนูเป็น lib ไม่ใช่ DB (ขัดหลัก "admin แก้เมนูแล้ว customer เห็น" — ยืนยัน Phase 5/6)
- **Mock images:** `public/images/mock/`, `public/images/drinks/*.svg` (mockup สินค้า)
- **Dead code:** `src/counter.ts`, `src/main.ts`
- **Duplicate:** `src/store/` vs `src/stores/`; worktree `src/.kilo/worktrees/satisfying-aphid/`; CustomerTimeline ซ้ำ 2 ที่ (components/ และ components/dashboard/)
- **Dormant candidates:** `demandForecasting.ts`, `routeOptimization.ts`, `customerIntelligence.ts`, `inventoryPrediction.ts`, `providers/foodpanda|grab|lineman` (อาจไม่มี runtime path จริง — ยืนยัน Phase 1)

## 5. Environment

- `.env` มีจริงใน project (ไม่แสดงค่า secret ในรายงานนี้) + `supabase.temp/srkey.local` (service role บน local disk — ใช้โดย e2e scripts)
- Production Supabase: `ivkdfognyiwjcmrhcnwz` · Hosting: Cloudflare Pages (`bitemebaby-5f7.pages.dev`)
- **RUNTIME VERIFICATION BLOCKED (phase นี้):** ยังไม่ได้ยิง production DB/runtime — จะทำใน Phase 2 เป็นต้นไป

---

## 6. คำตอบตาม Format

**Repository actually contains:**
React/Vite PWA storefront + admin command center (17 admin pages) + rider PWA + Supabase backend (39 migrations, 14 Edge Functions) + e2e/contract tooling ที่เคยรันผ่าน production จริง + เอกสาร/planning จำนวนมาก + build/log debris + worktree duplicate หนึ่งชุด

**Repository claims:**
Production-verified order spine, Stripe webhook 6/6, ACL gate 7/7, tests pass, SEC-02 closed, "Domain A 100% closure" ทาบ CLOSURE_BOOK

**Important discrepancies:**
(1) migration count 34 vs 39 · (2) test count 179 vs 163 ใน README ไฟล์เดียว · (3) เอกสาร env สอนใส่ secret แบบ VITE_ ขัดหลัก server-only · (4) Stripe สถานะขัดกันระหว่างเอกสารยุคเก่า/ใหม่

**Potential legacy areas:**
`src/.kilo/worktrees/…`, `src/counter.ts`, `src/main.ts`, `docs/` ยุคเก่า (GAP_ANALYSIS, ARCHITECTURE), `supabase-migration.sql` ที่ root, log/scratch files ที่ root

**Potential duplicate areas:**
`src/store` vs `src/stores` · menu data (`drinksMenu.ts`/`snacksMenu.ts`) vs DB products · delivery providers (biteDrive + grab/lineman/foodpanda) · review sources (`realReviews`, `socialProofReviews`, `reviewApi`) · `CustomerTimeline.tsx` ซ้ำ 2 ที่

