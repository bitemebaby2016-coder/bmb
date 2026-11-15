# R206 — Mascot Self-Service ใช้งานได้จริง (bucket Bite_Mascot + preview + upload + live refresh)

## สาเหตุที่แท้จริง (พิสูจน์จากโค้ด + ภาพจอ Owner 2026-11-15)
1. **Bucket `Bite_Mascot` ไม่มีในโค้ด/มิเกรชันเลย** — Owner สร้างเองใน dashboard + อัปโหลด `Bite_main.gif` (image/gif, 279.74 KB) แต่ไม่มี storage policies → ถ้า bucket private = URL public โหลดไม่ได้ → `<img>` fail
2. **MascotBadge/BiteMascot silent-fallback** — `handleError` เปลี่ยนกลับรูปเดิมเงียบ ๆ เมื่อโหลด URL ไม่ได้ → แอดมินเห็น "ไม่มีอะไรเปลี่ยน" โดยไม่รู้สาเหตุ
3. **MascotSettingsPage ไม่มี feedback จริง**:
   - `upsertMascotOverride` คืน boolean แต่ UI ไม่เช็ค → save ล้มเหลวเงียบ
   - ไม่มี preview รูปต่อ role → ใส่ URL แล้วตรวจไม่ได้ (ปุ่ม 🔄 ที่ถูกวงไว้ในภาพ = กดแล้วไม่เห็นอะไร)
   - ไม่มีปุ่มอัปโหลด → ต้องเปิด Supabase dashboard คัดลอก URL เอง
   - ข้อความบอก bucket `bmb-images` — เข้าใจผิด (จริง ๆ วาง https อะไรก็ได้)
4. **Same-session refresh ไม่มี** — MascotBadge/BiteMascot โหลด override ครั้งเดียวต่อ session → mounted components ไม่รู้ว่า override เปลี่ยน

## งานตามลำดับ
1. **Migration 206** `supabase/migrations/206_mascot_bucket_selfservice.sql` — สร้าง/ปรับ bucket `Bite_Mascot` (public, ≤15MB, image mime) + policies (public read · admin-only upload/update/delete) — pattern 119 (bucket_id literal)
2. **mascotService.ts** — `MASCOT_BUCKET` · `validateMascotFile` (GIF/PNG/WebP/JPG ≤15MB) · `uploadMascotAsset` (อัปโหลดเข้า bucket จริง คืน public URL) · `listMascotBucketFiles` (quick-pick) · `MASCOT_OVERRIDES_CHANGED_EVENT` + `notifyMascotOverridesChanged`
3. **MascotBadge.tsx + BiteMascot.tsx** — ฟัง event → reload override แบบ force → แสดงทันทีใน session เดิม (ไม่ต้อง deploy/refresh หน้า)
4. **MascotSettingsPage.tsx** — preview ต่อ role (พร้อม error state ชี้สาเหตุ) + save feedback สำเร็จ/ล้มเหลว + ปุ่มอัปโหลดไฟล์เข้า bucket ตรง + ล้างค่ากลับค่าเริ่มต้น + quick-pick ไฟล์ใน bucket + แก้ข้อความ bucket จริง
5. **Tests** `r206MascotSelfService.test.ts` — service/upload/validate/event + UI lock (preview/feedback/upload/clear) + migration contract
6. **`e2e/_r206Apply.cjs`** — apply migration 206 เข้า prod (pattern _r205Apply.cjs) + verify bucket/policies

## เกณฑ์สำเร็จ
- Owner อัปโหลด GIF จากหน้า Mascot Self-Service ได้เลย (เข้า bucket Bite_Mascot) หรือวาง URL ใด ๆ → มี preview ยืนยันก่อน/หลังบันทึก
- บันทึกแล้ว mascot หน้าเว็บเปลี่ยนจริงแบบไม่ต้อง deploy (new session + same-session via event)
- โหลดไม่ได้ (private/404) = หน้าแอดมินแสดงสาเหตุ ไม่เงียบ
- Gates: lint ✅ tsc ✅ vitest ✅ build ✅
