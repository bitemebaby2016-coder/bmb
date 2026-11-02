# BMB — HANDOFF NEXT SESSION (2026-11-02 · ปิดเซสชันหลัง R54/R55)

> **อ่านทันที:** `AI_ENTRYPOINT.md` → `UNIVERSAL_MASTER_AI_RULES.md` → `AI_WORK_STATE.md` (บล็อก 🔴 R55 บนสุด) → ไฟล์นี้

---

## 1. งานค้างเดียวที่ Owner สั่งไว้ — R55 🔴 (ทำเป็นอย่างแรก)

**คำสั่ง Owner (ถ้อยคำจริง):** "แล้วขนาดโลโก้เฟซบุ๊คล่ะ มึงไม่ได้ทำให้มันเท่ากันโดยใช้ไฟล์โลโก้ใหม่ที่บอก" +
"มันคนละไฟล์กัน ส่งโลโก้ใหม่ไฟล์เดิมเปลี่ยนขนาดไปให้มึง … แค่ชี้ไฟล์ให้ถูก … `D:\A PROJECT\Bite Me Baby\public` **ชื่อ FB logo** … มึงแค่มั่วงานโลโก้แมสเสนเจอร์กับงานโลโก้เฟซบุคไอโง่"

**แปล:** ① ไฟล์ที่ถูก = **`public/FB logo.webp`** (path+ชื่อที่ Owner บอก — ชี้ไปแล้วถูกต้องใน `socialLinks.ts` + `CustomerReviewCard`) ② **Messenger = คนละงาน** (เขาเปลี่ยนไฟล์เอง `2026-11-01 12:52Z` — ไม่ใช่งานเรา) ③ **งานที่เหลือ = ทำให้ "ขนาด" โลโก้ FB เท่ากับโลโก้อื่นตอนแสดงผล**

### หลักฐานที่วัดแล้ว (ห้ามวัดซ้ำ ใช้ได้เลย)
| ไฟล์ | dimensions | bytes | mtime (UTC) |
|---|---|---|---|
| `FB logo.webp` (ของ Owner — ใช้ไฟล์นี้) | **500×500** square | 10430 | **2026-11-02T05:05Z** (ใหม่วันนี้ · อยู่ใน commit `8ca9ea8` ✓) |
| `Facebook Logo.webp` (เก่า ทรงแบ่๊า — ไม่ใช้แล้ว) | 160×160 | 1874 | 2026-09-17 |
| `Messenger logo.webp` (Owner เปลี่ยนเอง — คนละงาน) | 300×300 | 6082 | 2026-11-01T12:52Z |
| `Grab Food Logo.webp` / `line logo.webp` | 160×160 | 2876/2284 | 2026-09-17 / 2026-10-30 |

- **ทุกไฟล์ = สี่เหลี่ยมจัตุรัส** (ratio 1.000 · script: `e2e/r54_logo_size.cjs` — header parser VP8/VP8L/VP8X)
- **CSS = uniform ทุกจุดแล้ว:** Footer ปุ่มโซเชียล `<img>` = `w-6 h-6 object-contain` (`src/components/layout/Footer.tsx:165` · `imgClass` ว่างทุก row — N3 ลบ `scale-90` แล้ว) · การ์ดรีวิว `.review-source-logo` = 15×15px (`src/index.css:439`)
- ⇒ **สมมติฐานหลัก = artwork padding / visual weight ภายใน `FB logo.webp` ต่างจากโลโก้อื่น** (ภาพ 3D glossy มี margin โปร่งใส → ตอนย่อเหลือ 24px/15px ดูเล็ก/ใหญ่กว่า flat badge ที่ edge-to-edge)

### ขั้นตอนทำต่อ (ตามลำดับ)
1. **Measure alpha/visible bbox** ของ `FB logo.webp` เทียบ `Grab Food Logo.webp`/`line logo.webp`/`Messenger logo.webp` ด้วย **playwright canvas** (devDep ติดตั้งแล้ว — เช็ค browser ก่อน: `npx playwright --version` + ลอง launch chromium) — **เครื่องนี้ไม่มี magick/ffmpeg/cwebp** (เช็คแล้ว)
2. ถ้า padding ต่างจริง → **normalize โดยคงชื่อ `FB logo.webp`** (crop เข้าขอบเนื้อภาพ + scale ให้ visible fraction = reference 160×160 → `canvas.toDataURL('image/webp')` บันทึกทับ)
3. **Verify:** `read_files` เปิดดูภาพใหม่ + screenshot footer row 24px ข้างโลโก้อื่นเปรียบเทียบ (เก็บเป็น evidence)
4. **Gates:** `npx tsc --noEmit` · `npm run lint` · `npx vitest run src/__tests__/r34Contracts.test.ts src/__tests__/footerLinksReal.test.ts src/__tests__/headingOrderFooter.test.ts src/__tests__/mediaFlow.test.ts` → commit `-F` → push → **CI probe ครั้งเดียว**
5. **Fallback:** ถ้า padding เท่ากันอยู่แล้ว → ไล่หา render site อื่นที่ box ไม่ uniform (TopBar / หน้าติดต่อ / จุดที่ใช้ `social.img`) — ยังไม่พบนอกจาก Footer.tsx:165 + CustomerReviewCard

---

## 2. สถานะปิดแล้ววันนี้ (R54 — 5 ข้อ feedback Owner · commit `8ca9ea8` + `91ac2ee` · CI ทุก run = success)

1. ✅ Strip บรรทัด Same-Day มี **ไฟเขียวกระพริบ** สถานะจริงตามเวลาที่ตั้ง (`strip-line-dot` + `stripDotBlink` · reduced-motion guard) — ข้อความ 3 บรรทัดคงเดิม
2. ✅ **"ไบ๊" ใน DB หายจริง** — `e2e/r53_dbfix.cjs` SERVICE ROLE PATCH `theater_daily_copy` → `VERIFY_ALL_CLEAN` 20/20 + anon `FOUND_VARIANTS NONE`
3. ✅ โลโก้ FB ชี้ `/FB logo.webp` (ไฟล์ใหม่) — Messenger คงเดิม = ของ Owner เอง
4. ✅ รีวิวรอบแก้: ข้อความถูก 6 รายการ (อ่านภาพต้นฉบับ · `r53_shrink.ps1` ย่อภาพใหญ่) · `SocialProofReview.image` = ภาพอาหารจริง 6 products · โลโก้สลับ FB↔Grab · **อัลบั้ม 32 ใบ = modal จากปุ่ม "ดูทั้งหมด"** (ไม่โชว์ inline)
5. ✅ Gates: tsc 0 · lint OK (brandNameGuard 520 + languageSanity 1508) · vitest 13 ไฟล์ 124 tests · **CI runs 8ca9ea8/6052348/192d8c9 = ทุกอัน success · NO_FAILED_RUN**

## 3. Backlog เดิมที่ยังไม่ได้แตะ (มาจาก handoff ก่อน)
- Social AI rule (MascotSetting) · cart re-add 700ms · SEO ทุก route · PSID/LINE/abandoned cart · retest T6-T10

## 4. กติการอบ/เครื่องมือที่ใช้บ่อย (ถนัดไว้)
- **cmd quote พังง่าย:** `-m "..."` โดนตัด → ใช้ `git commit -F file` เสมอ · path มี space → script `.cjs` ห่อแทน
- **ไม่มี magick/ffmpeg/cwebp** — image processing ผ่าน playwright canvas หรือ System.Drawing (jpg ใช้ได้ webp ต้องทดสอบ)
- **CI = e2e/r53_ci_probe.cjs ครั้งเดียว** ห้าม poll · test = single-run เท่านั้น
- อัปเดต ledger ทุกครั้ง: `AI_WORK_STATE.md` (บล็อกบนสุด) + `docs/BMB_MASTER_STATUS.md` (entry บนสุด)
