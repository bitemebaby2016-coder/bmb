# BMB — HANDOFF NEXT SESSION (2026-11-02 · ปิดเซสชันหลัง R55 ครบทุกข้อ)

> **อ่านทันที:** `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` (บล็อก 🟢 ปิดเซสชัน บนสุด) → ไฟล์นี้

---

## 1. งานที่ต้องทำเป็นอย่างแรก (แชทหน้า)

### ① CI probe ครั้งเดียว (ห้าม poll)
```
node e2e\r53_ci_probe.cjs
```
- เช็ค run ของ **`c08c93f`** (code) + commit docs ปิดเซสชันรอบนี้ = **completed/success · NO_FAILED_RUN**
- ตอนปิดเซส 2026-11-02 = `CI` + `Contract Tests (isolated PostgreSQL)` ของ `c08c93f` = **in_progress** (probe ครั้งเดียวแล้ว · `NO_FAILED_RUN` ✓)
- ถ้า FAIL → อ่าน log workflow ที่ fail → แก้ → gates ใหม่ → commit → push → probe อีกครั้งเดียว

### ② รอ Owner ทดสอบจริงบน production (ตรวจสอบตาม checklist นี้ถ้าเขาส่ง feedback)
1. **เจนภาพเมนูใน AI Studio โดยไม่แนบรูปตัวอย่าง** (พิมพ์ชื่อเมนู + โน้ต → Generate) — โมเดลหลัก `bytedance-seed/seedream-5-0-flash` (ได้ 1:1 2048²) / รอง `qwen/qwen-image-2.1-pro` (ได้ **4:3 2368×1776 — เหมาะกับเมนู**)
2. **อัลบั้มแยกตามหมวด** — แท็บ menu/promo/festival ที่อัลบั้มภาพ (`ai-generated/<kind>/`)
3. **ปุ่มต่อรูป:** `ใช้` / `ปิด-เปิด` (ย้ายไฟล์จริง `↔ _disabled/<kind>/`) / `ลบ`
4. **ห้ามใช้อัตโนมัติ** — เจนแล้วห้ามเด้งเข้าแอดอัตโนมัติ ถ้าขนาดผิด (`mk-gen-qa-warn`) เตือนเฉย ๆ
5. **ปุ่ม "ตั้งเป็นโฆษณาลอย"** (แท็บ promo/festival) → ภาพลอยหน้าแรกแทนมาสคอต (น้อง Bite ประกอบมุมรูป) — ถ้า wm- รูปนั้นมีมาสคอตในไฟล์แล้ว = ไม่ซ้ำ
6. **รีวิว 6 รายการ** — ขึ้นชื่อเมนูจริง + ปุ่ม "เพิ่มเมนูนี้เข้าตะกร้า" ใส่สินค้าจริงได้
7. **ล็อกอินแล้วกดโลโก้/หน้าแรก → `/shop`** (BottomNav "หน้าแรก" ก็ /shop แล้ว)
8. **โลโก้ FB footer/การ์ดรีวิว** = เท่ากัน (Owner ยืนยัน "หายแล้ว" แล้ว — ปิดแล้ว)

---

## 2. สถานะปิดแล้ววันนี้ (R55 + งานตรวจ Owner 4 ข้อ · commit `c08c93f` · push ✓ · gates ทุกอย่างเขียว)

| ข้อ | ผลลัพธ์ | หลักฐาน |
|---|---|---|
| **R55 โลโก้ FB ไม่เท่ากัน** | ✅ ปิด (Owner ยืนยันเอง) | extent gmean/box FB 0.911/LINE 0.891/Messenger 0.955 · prod=local sha256 · box uniform 24×24+15×15 — `e2e/r55_alpha_bbox\|overlay\|prod_shot\|prod_file.cjs` |
| **ภาษารีวิวยังเพี้ยน** | ✅ อ่านทวนภาพต้นฉบับทั้ง 69 ใบด้วย vision → แก้จริง | `e2e/r55_vision_reviews.cjs` · ชื่อ `ชิสากุหนุ เรนยุคุร`→**ชุติกาญจน์ เจริญฤทธิ์** · ข้อความ 6 รายการ = ค่าจริง · GUBGIB 11 Mar→**6 Apr 2026** |
| **รีวิวรูปไม่ลิ้งเมนู** | ✅ ผูก `productId`/`foodName` → products จริง 6/6 (HTTP 200) | `e2e/r55_review_imgs.cjs` · CTA เพิ่มเมนูจริงเข้าตะกร้า |
| **AI Studio 7 ข้อ** | ✅ ครบ (โมเดล/อัลบั้ม/ปุ่ม ใช้-ปิด-ลบ/ห้ามอัตโนมัติ/โฆษณาลอย/4:3/no-reference) | EF `image-gen` DEPLOYED · secret `IMAGE_GEN_MODELS` ตั้งแล้ว · smoke 2 โมเดล = OK (`e2e/r55_smoke.log`) |
| **ล็อกอิน → /shop** | ✅ Header logo conditional | `Header.tsx` + BottomNav มีอยู่แล้ว |

- **Gates:** `tsc = 0` · `lint OK` (eslint + brandNameGuard 520 + languageSanity 1528) · **vitest ทุกชุด PASSED** (142 + re-run contract 51/51)
- **Contract tests 5 ไฟล์** = ปรับตาม directive ใหม่ (โมเดล ID ใหม่ · per-kind folders · no-auto-use) — regression จะแดงเอง
- Evidence scripts อยู่ใน commit แล้ว (20 ไฟล์ `e2e/r55_*.cjs|ps1|png` + commit msg `e2e/r55_commit_msg.txt`)
- Stage = clean (ลบ `tmp_r55_rev_*` + evidence PNG แล้ว · smoke สร้างใหม่ได้จาก script)

## 3. Backlog เดิมที่ยังไม่ได้แตะ
- Social AI rule (MascotSetting) · cart re-add 700ms · SEO ทุก route · PSID/LINE/abandoned cart · retest T6-T10

## 4. กติกา/เครื่องมือ (ห้ามลืม)
- **cmd quote พังง่าย:** `git commit -F file` เสมอ · path มี space → script `.cjs` ห่อ
- **CI = `e2e/r53_ci_probe.cjs` ครั้งเดียว** ห้าม poll · test = `npx vitest run` single-run เท่านั้น
- **งาน >30s (smoke โมเดล):** แยก process ด้วย `powershell Start-Process -File ... -WindowStyle Hidden` (script ตัวอย่าง `e2e/r55_smoke_qwen.ps1`) → ผลเข้า `e2e/r55_smoke.log`
- **อ่านภาพด้วยโมเดล vision** (`e2e/r55_vision_reviews.cjs` pattern): `read_files` เปิด JPEG ใหญ่ไม่ได้/หมดโควตา → ใช้ OpenRouter vision อ่านแทน · ย่อภาพ = `e2e/r55_shrink.ps1` (PNG ≤480px → `read_files` อ่านได้)
- **verify ไฟล์ production** = sha256 เทียบ local (`e2e/r55_prod_file.cjs`) — อย่าเชื่อแค่หน้าเว็บ
- อัปเดต ledger ทุกครั้ง: `AI_WORK_STATE.md` (บล็อกบนสุด) + `docs/BMB_MASTER_STATUS.md` (entry บนสุด)
