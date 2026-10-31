# Handoff → แชทหน้า (2026-10-31 · ปิดเซสชัน R35+R36)

> ยึด `AI_WORK_STATE.md` บล็อก R35+R36 (ล่าสุด) + `docs/BMB_MASTER_STATUS.md` (canonical) · ถ้าขัดกัน = โค้ดจริง > เอกสาร

## 0. HEAD + CI (สำคัญสุด — เช็คก่อนงานอื่น)

- **R38 ปิดแล้ว (2026-10-31 · 7 คำสั่ง Owner):** สติกเกอร์ faceH 670→709 (production read-back) · image-gen `IMAGE_GEN_MODELS` secret ตั้งแล้ว · ลิงก์แผนที่ intent:// เปิดแอป · delivered 3 ล่าสุด+อัลบั้ม · ปุ่ม browse รูปเมนู · feed หน้าแรก + **m176 APPLIED+VERIFIED** (ALL_PASS 8/8 · ledger top=176 · anon probe 200 · `e2e/r38Apply176-result.json` · PostgREST reload ผ่าน `r38PgrstReload.cjs`) · **รายการบล็อก/งานค้าง/ขั้นทดสอบ = `docs/BMB_PRODUCTION_TEST_PACK.md` §N** · **รายการรอ Owner ตัดสินใจ = §N.3 (D-1 โต้ตอบในเว็บ · D-2 โมเดล image-gen · D-3 กติกาช่องว่าง)** (ยึด §N ก่อนหัวข้ออื่นถ้าขัดกัน)

- **HEAD = `3dc3342` (push แล้ว = `ff9132f` fix CI รอบ 2 + `c22e869`/`3dc3342` docs)** — R37: languageSanity จับอักขระจีน **2 จุดในเอกสาร** ของ `7048283` (`BMB_HANDOFF...md:7` + `BMB_MASTER_STATUS.md:7` — อ้าง fallback เดิมตรง ๆ เป็นหลักฐาน) → แก้เป็นคำไทย · verify = `npm run lint` เต็ม OK + `npx tsc --noEmit` 0
- **CI = เขียวหมด (พิสูจน์แล้ว):** `e4c3ad7` ✅ · **`ff9132f` CI+Contract ✅** · **`c22e869` CI+Contract ✅** · **NO_FAILED_RUN** ทุก workflow (probe `node e2e/r36_ci_probe.cjs` ไม่ต้อง token)
- **CI `7048283` (แดงรอบเดียว) = failure ที่ Lint (#5)** → สาเหตุซ้ำแบบ = อักขระจีนในเอกสาร → **แก้ใน `ff9132f`** → **งานแรกของแชทหน้า = เช็ค CI HEAD `3dc3342` ครั้งเดียวให้เขียว** (ทุก push = run ใหม่ · probe ตัวเดิม)
- ก่อนหน้า: `e4c3ad7` (fix CI รอบ 1) · `aa1b295` (R35) · `a6b3b34`/`4b2ffda` (R34)

## 1. งานค้างที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

### 1.1 Owner ทดสอบพิมพ์สติกเกอร์จริง (R35 — บล็อกหลัก)
- **แก้แล้ว:** ค่า Menu/Notice เริ่มหลัง `:` **บนบรรทัดเดียวกับป้าย** (Menu ≤2 บรรทัด · Notice ≤2 บรรทัด) · ช่วงเส้น Tel→QR **ลดเหลือ 40px** (เดิม ~160px)
- **ยังไม่ verify:** การพิมพ์จริง — Owner กดยืนยันออเดอร์ → ดูว่า (1) Menu/Notice อ่านตรงบรรทัดเดียวกับป้าย (2) QR ชิดขึ้นจริง (3) **ยังข้ามดวงไหม**
- **ถ้ายังข้ามดวง:** พิมพ์ใบวัดฟีด → วัดเส้นขอบล่าง → ใส่ `stickerFaceHPx` ในหน้าตั้งค่าพิมพ์ (min 640 max 760 · ค่าเริ่ม 709) → ทดสอบซ้ำ

### 1.2 image-gen EF deploy + คีย์ + โมเดล (R35) — **AI ปิดแล้ว (R37) เหลือ Owner กดเจน**
- ✅ **secret `BMB_OPENROUTER_API_KEY` = ตั้งบน production แล้ว** (พิสูจน์: `supabase secrets list` มีชื่อนี้ · digest ตรง `OPENROUTER_API_KEY`) → โค้ดที่อ่าน BMB ก่อน = ใช้คีย์จริง ไม่ fallback dev
- ✅ **EF `image-gen` deploy แล้ว** (`supabase functions deploy image-gen` = `DEPLOY_OK` บน project `ivkdfognyiwjcmrhcnwz` · evidence `e2e/r37_deploy_imagegen.log`)
- ✅ **liveness probe:** OPTIONS = **HTTP 200 `ok`** (CORS preflight ไม่ถูกบล็อก) · POST ไม่มี JWT = **HTTP 401 `UNAUTHORIZED_NO_AUTH_HEADER`** (verify_jwt กัน anon) — evidence `e2e/r37_imggen_options.txt` / `r37_imggen_noauth.txt`
- ⏳ **เหลือ Owner:** เปิด AdminMarketing → เจนรูปโปรโมต **1 ใบจริง** (admin JWT) — ถ้า fallback ข้าม 2 ตัวแรก (`qwen/qwen-image-3`, `bytedance-seed/seedream-5-0-flash`) ไป gemini = บันทึกว่าโมเดลคู่แรกใช้ไม่ได้จริง (แล้วถอด/สลับลำดับ · env `IMAGE_GEN_MODELS` override ได้)

### 1.3 gates + CI รอบ R35/R36
- **ผ่านแล้ว (ท้องถิ่น):** vitest **91/91** (8 ไฟล์) · **`npm run lint` เต็ม = OK** (eslint + brandNameGuard 491 + languageSanity 1391 — หลัง fix R36) · tsc 0 · build `e2e/r35_build.log` ✓ · r34+r35 re-run = 12/12
- **CI:** `aa1b295`/`7048283` = Lint พัง (แก้ใน `e4c3ad7`/`ff9132f`) · **`e4c3ad7` · `ff9132f` · `c22e869` = success ✅ ทุก workflow (CI+Contract) · NO_FAILED_RUN** · full vitest ท้องถิ่น ~1,670 = ยังไม่รัน — **CI Test step พิสูจน์ผ่านแล้ว ไม่ซ้ำโดยไม่จำเป็น**

### 1.4 งานค้างสะสม (ยังเปิดอยู่)
1. e2e auto-print ออเดอร์จริง (R31 โค้ดพร้อม · Owner ยืนยัน "รับออเดอร์แล้วสติกเกอร์ปริ้นอัตโนมัติจากใบสั่งซื้อจริง ตรงรายละเอียดกับ notice" แล้ว)
2. QZ Tray = ทุกครั้ง incognito + Remember this decision (Owner ยืนยัน 2026-10-30)
3. ~~CI รอบ R34/R35~~ = แทนที่ด้วยสถานะ `e4c3ad7` (หัวข้อ 0)

## 2. ไฟล์ที่แก้รอบ R35+R36 (push แล้วทั้งหมด — HEAD `e4c3ad7`)

| ไฟล์ | แก้ |
|---|---|
| `src/lib/stickerPng.ts` | Menu/Notice valX บรรทัดเดียวกับป้าย ≤2/≤2 · qrY=min(face, tel+40) |
| `src/pages/MenuPage.tsx` | ถอดชิปรอบ + ลบ state/import rounds · เรียงวันใกล้ก่อน |
| `src/pages/HomePage.tsx` | preOrderShowcase sort วันใกล้ก่อนก่อน slice(8) |
| `supabase/functions/image-gen/index.ts` | คีย์ BMB ก่อน dev · candidates +qwen-image-3 +seedream-5-0-flash |
| `src/__tests__/r35Contracts.test.ts` | ใหม่ 5 ข้อ (sticker/banner/sort) |
| `src/__tests__/stickerPng.test.ts` | +R35 2 ข้อ · แก้ faceH=660/`…` expectation |
| `src/__tests__/socialAiContinuity.test.ts` | +image-gen surfaces +เช็ค BMB<dev +โมเดล 2 ตัว |
| `e2e/r35_or_*.cjs` | probe scripts (diag/web) — evidence |
| `AI_WORK_STATE.md` | บล็อก R35 |

## 3. ทดสอบทั้งหมดที่ต้องทำ (แชทหน้า)

- [x] **เช็ค CI `e4c3ad7` / `ff9132f` / `c22e869`** → **success ทุก workflow ✅ · NO_FAILED_RUN** (R37 · `node e2e/r36_ci_probe.cjs`)
- [x] ~~CI `7048283` แดงที่ Lint~~ → แก้ 2 จุดในเอกสาร = `ff9132f` (verify `npm run lint` + `tsc` ผ่าน)
- [ ] **เช็ค CI HEAD `3dc3342` ครั้งเดียว** → ให้เขียว (probe ตัวเดิม · ทุก push = run ใหม่)
- [ ] Owner: พิมพ์สติกเกอร์จริง 1 ออเดอร์ → ถ่ายรูปส่งมา (Menu/Notice บรรทัดเดียวกัน · QR ชิด · ขอบดวง)
- [x] ~~secret `BMB_OPENROUTER_API_KEY` + EF image-gen deploy~~ = **ทำแล้ว ✓** (ดู 1.2 — เหลือ liveness ก็ผ่านแล้ว)
- [ ] Owner: เจนรูปจริง 1 ใบจาก AdminMarketing (admin JWT · คู่แรก qwen-image-3 / seedream-5-0-flash)
- [ ] e2e auto-print จริง (ถ้ายังไม่ทำ)
- [ ] (ถ้าต้องการ) full vitest ทั้งชุด local — CI Test ผ่านแล้ว ไม่บังคับ
