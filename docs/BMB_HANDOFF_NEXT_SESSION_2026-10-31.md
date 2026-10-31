# Handoff → แชทหน้า (2026-10-31 · ปิดเซสชัน R35+R36)

> ยึด `AI_WORK_STATE.md` บล็อก R35+R36 (ล่าสุด) + `docs/BMB_MASTER_STATUS.md` (canonical) · ถ้าขัดกัน = โค้ดจริง > เอกสาร

## 0. HEAD + CI (สำคัญสุด — เช็คก่อนงานอื่น)

- **HEAD = `ff9132f` (push แล้ว · fix CI รอบ 2)** — R37: languageSanity จับอักขระจีน **2 จุดในเอกสาร** ของ `7048283` (`BMB_HANDOFF...md:7` + `BMB_MASTER_STATUS.md:7` — อ้าง fallback เดิมตรง ๆ เป็นหลักฐาน) → แก้เป็นคำไทย · verify = `npm run lint` เต็ม OK + `npx tsc --noEmit` 0
- **CI `e4c3ad7` = success ทุก workflow ✅** (งานแรกตามแฮนออฟ — ปิดแล้ว · พิสูจน์ด้วย `node e2e/r36_ci_probe.cjs`)
- **CI `7048283` = failure ที่ Lint (#5)** (Test/Contract/Cloudflare = ผ่าน) → สาเหตุซ้ำแบบ = อักขระจีนใน docs → **แก้ใน `ff9132f`** → **งานแรกของแชทหน้า = เช็ค CI `ff9132f` ครั้งเดียวให้เขียว** (probe ตัวเดิม ไม่ต้อง token)
- ก่อนหน้า: `e4c3ad7` (fix CI รอบ 1) · `aa1b295` (R35) · `a6b3b34`/`4b2ffda` (R34)

## 1. งานค้างที่ต้องทำต่อ (เรียงลำดับความสำคัญ)

### 1.1 Owner ทดสอบพิมพ์สติกเกอร์จริง (R35 — บล็อกหลัก)
- **แก้แล้ว:** ค่า Menu/Notice เริ่มหลัง `:` **บนบรรทัดเดียวกับป้าย** (Menu ≤2 บรรทัด · Notice ≤2 บรรทัด) · ช่วงเส้น Tel→QR **ลดเหลือ 40px** (เดิม ~160px)
- **ยังไม่ verify:** การพิมพ์จริง — Owner กดยืนยันออเดอร์ → ดูว่า (1) Menu/Notice อ่านตรงบรรทัดเดียวกับป้าย (2) QR ชิดขึ้นจริง (3) **ยังข้ามดวงไหม**
- **ถ้ายังข้ามดวง:** พิมพ์ใบวัดฟีด → วัดเส้นขอบล่าง → ใส่ `stickerFaceHPx` ในหน้าตั้งค่าพิมพ์ (min 640 max 760 · ค่าเริ่ม 709) → ทดสอบซ้ำ

### 1.2 image-gen EF deploy + คีย์ + โมเดล (R35)
- **คีย์:** โค้ดอ่าน `BMB_OPENROUTER_API_KEY` ก่อน · fallback `OPENROUTER_API_KEY` (dev) — ** Owner ยืนยันคีย์ `BMB_openrouter_api_key` = แยกสำหรับงานคอนเทนต์/เจนรูป/marketing/talk-to-bite**
  - **เช็ค:** `supabase secrets get BMB_OPENROUTER_API_KEY` (production ตั้งยัง? ถ้ายัง = โค้ดยัง fallback คีย์ dev อยู่)
- **โมเดล (ยืนยันจากภาพหน้าโมเดลจริง Owner):** `qwen/qwen-image-3` + `bytedance-seed/seedream-5-0-flash` = **มีจริง** (probe `/api/v1/models` สาธารณะไม่เจอ = index คนละชุด) — ใส่เป็น 2 candidate แรกใน `IMAGE_MODEL_CANDIDATES` แล้ว · env `IMAGE_GEN_MODELS` override ได้
- **ทำ:** deploy `supabase functions deploy image-gen` → ลองเจนรูปโปรโมต 1 ใบจริงจาก AdminMarketing → ถ้า fallback ข้าม 2 ตัวแรกไป gemini = บันทึกว่าโมเดลคู่แรกใช้ไม่ได้จริง (แล้วถอดออก/สลับลำดับ)

### 1.3 gates + CI รอบ R35/R36
- **ผ่านแล้ว (ท้องถิ่น):** vitest **91/91** (8 ไฟล์) · **`npm run lint` เต็ม = OK** (eslint + brandNameGuard 491 + languageSanity 1391 — หลัง fix R36) · tsc 0 · build `e2e/r35_build.log` ✓ · r34+r35 re-run = 12/12
- **CI:** `aa1b295` = Lint พัง (แก้แล้วใน `e4c3ad7`) · **`e4c3ad7` = รอเช็คครั้งเดียว** (Contract ของเขา success แล้ว) · full vitest ท้องถิ่น ~1,670 = ยังไม่รัน — **CI Test step พิสูจน์ผ่านแล้ว ไม่ซ้ำโดยไม่จำเป็น**

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

- [ ] **เช็ค CI `e4c3ad7` ครั้งเดียว** → เขียว = ปิด loop CI (ใช้ `node e2e/r36_ci_probe.cjs` ดูผล/log)
- [ ] Owner: พิมพ์สติกเกอร์จริง 1 ออเดอร์ → ถ่ายรูปส่งมา (Menu/Notice บรรทัดเดียวกัน · QR ชิด · ขอบดวง)
- [ ] EF image-gen deploy + secret `BMB_OPENROUTER_API_KEY` + เจนรูปจริง 1 ใบ
- [ ] e2e auto-print จริง (ถ้ายังไม่ทำ)
- [ ] (ถ้าต้องการ) full vitest ทั้งชุด local — CI Test ผ่านแล้ว ไม่บังคับ
