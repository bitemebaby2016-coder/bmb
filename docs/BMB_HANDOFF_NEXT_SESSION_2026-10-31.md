# Handoff → แชทหน้า (2026-10-31 · ปิดเซสชัน R35)

> ยึด `AI_WORK_STATE.md` บล็อก R35 (ล่าสุด) + `docs/BMB_MASTER_STATUS.md` (canonical) · ถ้าขัดกัน = โค้ดจริง > เอกสาร

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

### 1.3 gates + CI รอบ R35
- **ผ่านแล้ว (ท้องถิ่น):** vitest **91/91** (8 ไฟล์: stickerPng/bmbSticker/stickerQueueR31/homePopular/r34Contracts/**r35Contracts ใหม่**/socialAiContinuity/homeSectionModeCta) · eslint 0 · tsc 0 · build ดู `e2e/r35_build.log`
- **ยังไม่รัน:** full vitest ทั้งชุด (~1,670 tests) + `npm run lint` (brandNameGuard+languageSanity) — **รอบหน้ารันแล้ว commit+push** (อย่าอ้างว่าผ่านจนกว่าจะมีหลักฐาน)

### 1.4 งานค้างสะสม (ยังเปิดอยู่)
1. e2e auto-print ออเดอร์จริง (R31 โค้ดพร้อม · Owner ยืนยัน "รับออเดอร์แล้วสติกเกอร์ปริ้นอัตโนมัติจากใบสั่งซื้อจริง ตรงรายละเอียดกับ notice" แล้ว)
2. QZ Tray = ทุกครั้ง incognito + Remember this decision (Owner ยืนยัน 2026-10-30)
3. CI รอบ R34 (`4b2ffda`/`a6b3b34`) — ยังไม่ได้กลับมาเช็ค (gh CLI ไม่มีในเครื่อง)

## 2. ไฟล์ที่แก้รอบ R35 (ทั้งหมดยังไม่ commit)

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

- [ ] full `npx vitest run` + `npm run lint` → ผ่าน = commit+push รอบ R35
- [ ] Owner: พิมพ์สติกเกอร์จริง 1 ออเดอร์ → ถ่ายรูปส่งมา ( Menu/Notice/QR/ขอบดวง )
- [ ] EF image-gen deploy + secret `BMB_OPENROUTER_API_KEY` + เจนรูปจริง 1 ใบ
- [ ] e2e auto-print จริง (ถ้ายังไม่ทำ)
- [ ] เช็ค CI R34 (`4b2ffda`/`a6b3b34`) บน Actions (ค้างตั้งแต่รอบก่อน)
