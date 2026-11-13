# Plan สรุปผลการตรวจโค้ด 0ea8f8e → 13bd065 + แผนงานที่ต้องทำต่อ

## ผลการตรวจสอบโค้ดจริง (ไม่เชื่อเอกสาร)

### ✅ สิ่งที่ทำถูกต้องแล้ว (ไม่ต้องแก้)
| รายการ | ไฟล์ | รายละเอียด |
|---|---|---|
| Floating Ad limit 3 ใบ | `FloatingAdBanners.tsx:87,275-286` | `slice(0,3)` ถูกต้อง ทั้ง merge และ visible |
| ลิงก์ข้อมูลจริง href=/menu?coupon=CODE | `FloatingAdBanners.tsx:381` | `<Link to={promo.href}>` ใช้ promo.href จริง |
| Kill switch floating_ad_enabled | `FloatingAdBanners.tsx:133-139` | โหลดจาก business_settings ถูกต้อง |
| Cart retry 2 ชั้น (700ms + 2500ms) | `Layout.tsx:131-138` | `cartRetryTimer1 = 700ms`, `cartRetryTimer2 = 2500ms` |
| Cart deep-link ?cart= decode+add | `Layout.tsx:69-138`, `lib/cartDeepLink.ts` | `decodeCartParam(raw)` → addItems → retry 2.5s → strip param |
| Safari text มีอยู่แล้ว | `useInAppBrowser.ts:72`, `InAppBrowserNotice.tsx:168,175` | alert iOS บอก "เปิดใน Safari" + InAppBrowserNotice บอก Safari/Chrome ครบ |
| Intent:// Android button | `InAppBrowserBanner.tsx:17,38-44`, `InAppBrowserNotice.tsx:196-209` | intent:// URL scheme บน `<a href>` native-click สำหรับ Android |

### ❌ สิ่งที่ต้องแก้ไข
| # | ปัญหา | ไฟล์ | แก้ไข |
|---|---|---|---|
| **1** | Comment ผิดบอก max 2 แทน max 3 | `FloatingAdBanners.tsx:5,285` | เปลี่ยน `"max 2"` → `"max 3"` (2 บรรทัด) |
| **2** | InAppBrowserBanner ไม่ได้ detect LINE/IG UA | `useInAppBrowser.ts:26` | เพิ่ม `/LINE\/|Instagram/i` ใน regex FB detection เพราะ owner ต้องการปุ่มเปิดภายนอกเสมอ ไม่ใช่แค่ FB |
| **3** | iOS ใช้ alert() ซึ่งถูก popup blocker บล็อก | `useInAppBrowser.ts:71-73` | เปลี่ยนเป็น Toast notification แบบเดียวกับที่ใช้ทั้งโปรเจค (ToastContainer) |
| **4** | Cart deep-link อาจ fail ถ้า URL ไม่ประกอบด้วย ?cart= | `InAppBrowserBanner.tsx:13-18` | ตรวจสอบ `window.location.search.includes('cart=')` ก่อนสร้าง intent:// URL หากไม่มี → เปิด /shop ตามปกติ หรือแจ้ง owner ว่าลิงค์นี้ไม่ใช่ลิงค์แชร์ออเดอร์ |

### 📝 สิ่งที่ต้องยืนยันกับ owner
- **ข้อ 2**: owner อยากให้ปุ่มเปิดภายนอกแสดงบน LINE/IG ด้วยหรือไม่? (ปัจจุบันเฉพาะ FB เท่านั้น)

## ขั้นตอนการแก้ไข (เรียงตามลำดับ)

### Step 1: แก้ comment ใน FloatingAdBanners.tsx
- บรรทัด 5: `"max 2 at once"` → `"max 3 at once"`
- บรรทัด 285: `"max 2 banners"` → `"max 3 banners"`
- Commit message: `fix: update outdated comments "max 2" → "max 3"`

### Step 2: ขยาย FB UA detection ให้ครอบคลุม LINE/IG
- ไฟล์: `src/hooks/useInAppBrowser.ts` บรรทัด 26
- เดิม: `/FBAV|FB_IAB|FBAN|FBBV/i`
- ใหม่: `/FBAV|FB_IAB|FBAN|FBBV|LINE\/|Instagram\//i`
- Commit message: `feat: expand in-app browser detection to LINE + Instagram`

### Step 3: เปลี่ยน iOS alert เป็น Toast
- ไฟล์: `src/hooks/useInAppBrowser.ts` บรรทัด 71-73
- เดิม: `alert('คัดลอกลิงก์แล้ว — กด ⋯ → "เปิดใน Safari"')`
- ใหม่: ส่ง toast จาก `showToast()` ที่ import จาก `components/ui/ToastContainer`
- ต้อง refactor `useInAppBrowser` ให้รับ `toastRef` หรือใช้ pattern event bus แทน alert โดยตรง
- Commit message: `fix: replace iOS alert with Toast notification`

### Step 4: รองรับ ?cart= ใน intent:// URL
- ไฟล์: `src/components/InAppBrowserBanner.tsx` บรรทัด 13-18
- เพิ่ม condition: เช็คว่า `window.location.search` มี `cart=` หรือไม่
- หากมี → สร้าง intent:// URL พร้อม ?cart= (ทำได้โดยดึง `window.location.href` มาใช้ได้เลย — เดิมก็ทำอยู่แล้ว แต่ต้องทดสอบว่า intent:// transport query string ได้ครบ)
- หากไม่มี → แสดง banner ปกติ แต่ disable ปุ่ม "เปิดใน Chrome" หรือเปลี่ยนข้อความเป็นการแนะนำให้ owner จิ้มลิงค์จากแชทเอง
- Commit message: `fix: ensure ?cart= param preserved in intent:// navigation`

## การทดสอบหลังแก้ไข
1. `npm run lint && npm run typecheck:functions && npm run build && npx vitest run` — คาดผ่านทั้งหมด
2. ทดสอบจริงบน production (hard reload `https://biteme-baby.com`):
   - ✅ Orange banner ขึ้นเมื่อเปิดจาก FB/LINE/IG
   - ✅ iOS ไม่มี alert แต่เห็น toast notification แทน
   - ✅ ลิงค์ที่มี `?cart=<encoded>` ไป Chrome พร้อมใส่ตะกร้า
   - ✅ ลิงค์ที่ไม่มี `?cart=` ไม่พัง — แสดง banner ปกติหรือแนะนำวิธี

## เอกสารที่เกี่ยวข้อง
- `AI_WORK_STATE.md` — อัปเดตล่าสุดรอบ 11 (session close 2026-11-11)
- `docs/BMB_MASTER_STATUS.md` — LIVE-TEST 2026-11-10 entry แสดง PASS 7/7
- `.kilo/plans/pending-tasks-next-session.md` — Live retest เหลือ §T-A เพียงข้อเดียว
- `.kilo/plans/1794392899939-status-recon-live-prep.md` — แผน reconcile docs เดิม
- ไฟล์นี้: `.kilo/plans/1794470398120-fix-found-issues.md` — แผนแก้ bugs ที่พบ
