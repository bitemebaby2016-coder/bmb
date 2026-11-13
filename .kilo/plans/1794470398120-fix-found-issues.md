# Plan: แก้ไขปัญหาที่พบหลังตรวจสอบโค้ด 0ea8f8e → 13bd065

## ปัญหาที่พบ (5 ข้อ)

### ① Floating Ad แสดงมากเกิน 3 ใบ
**สถานะ:** โค้ด **ถูกต้องแล้ว** (limit 3 จริง) แต่ **comment ผิด** ทำให้สับสน
- `pickVisibleBannerPromos`: `slice(0,3)` ✅ ถูกต้อง
- แต่ละแหล่งจำกัด 3 ก่อน merge (announcements/promos/recommended) ✅ ถูกต้อง
- **Comment ผิด:**
  - บรรทัด 5: `"max 2 at once"` ควรเป็น `"max 3"`
  - บรรทัด 285: `"max 2 banners"` ควรเป็น `"max 3 banners"`
- **สรุป:** ไม่กระทบการทำงานจริง แค่ comment เก่า

### ② ลิงก์สีส้ม (InAppBrowserBanner) ไม่ทำงาน
**สถานะ:** โค้ดมีอยู่แล้ว แต่ **อาจไม่แสดงหากไม่เข้าเงื่อนไข FB detection**
- `useInAppBrowser.ts` บรรทัด 26: เช็ค UA ด้วย `/FBAV|FB_IAB|FBAN|FBBV/`
- หาก UA ไม่ตรง = banner ไม่ขึ้น (`isFB=false`)
- iOS: ใช้ `alert()` กับข้อความ **"เปิดใน Safari"** (บรรทัด 72) ซึ่งใช้งานผ่านได้
- Android: ใช้ `intent://` URL scheme บน anchor tag (`<a href={intentUrl}>`)
- **ปัญหาที่อาจเกิด:**
  - ผู้ใช้เปิดจาก LINE/Instagram/หรือ browser อื่น → banner ไม่แสดงเพราะUAไม่ตรงกับ FB
  - iOS ใช้ `alert()` อาจถูกบล็อกโดย Browser/Safari popup blocker
  - Dismissed state persist ใน `localStorage['bmb:inapp:dismissed']` หากผู้ใช้เคยกด dismiss จะไม่แสดงอีกเลย

### ③ คำว่า "/safari" ควรถูกเพิ่มกลับ
**สถานะ:** มีอยู่แล้วใน `useInAppBrowser.ts` บรรทัด 72:
```javascript
alert('คัดลอกลิงก์แล้ว — กด ⋯ (สามจุด) มุมบนขวา → "เปิดใน Safari"')
```
และใน `InAppBrowserNotice.tsx` บรรทัด 168, 169, 175 ก็มีการกล่าวถึง Safari อยู่แล้ว
- **สรุป:** ไม่มีอะไรต้องเพิ่ม กลับมีอยู่แล้ว

### ④ Cart deep-link (?cart=) ไม่เติมลงตะกร้าเมื่อเปิดใน External Browser
**สถานะ:** โค้ดทำงานเฉพาะเมื่ออยู่ใน **FB WebView** เท่านั้น
- `Layout.tsx` บรรทัด 69-138: Effect ที่จัดการ `?cart=` จะรันทุกครั้งที่หน้าโหลด
- แต่หากผู้ใช้คลิกปุ่ม "เปิดใน Chrome" (intent://) → **เบราว์เซอร์ใหม่จะโหลดเพจแยก** โดยไม่มี cart param เดิม
- **ปัญหาหลัก:** intent:// URL ที่สร้างจาก InAppBrowserBanner บรรทัด 17:
  ```javascript
  `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;action=android.intent.action.VIEW;s.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
  ```
  - `currentUrl` คือ `window.location.href` ปัจจุบัน (เช่น `https://biteme-baby.com/shop`)
  - หากหน้าปัจจุบันมี `?cart=<b64>` อยู่แล้ว → intent:// จะไปหน้าเดิมพร้อม cart param → **ควรทำงานได้**
  - **แต่** หากผู้ใช้เข้ามาโดยไม่มี `?cart=` หรือ cart param หายไปแล้ว → intent:// จะไปหน้าเปล่า → ไม่มีของใส่ตะกร้า

### ⑤ งานซ้ำซ้อน/ทำไม่เสร็จ 8 ชั่วโมงที่ผ่านมา
**สถานะ:** ต้องดู commit history เพื่อระบุ

## ลำดับการแก้ไข

### 1. แก้ Comment ผิดใน FloatingAdBanners.tsx (5 นาที)
- บรรทัด 5: เปลี่ยน `"max 2 at once"` → `"max 3 at once"`
- บรรทัด 285: เปลี่ยน `"max 2 banners"` → `"max 3 banners"`

### 2. ตรวจสอบและปรับปรุง InAppBrowserBanner สำหรับ External Browser + Cart
**ปัญหาคือ:** เมื่อผู้ใช้จิ้มลิ้งค์ Facebook (ที่มี `?cart=...`) → ไปยัง FB WebView → เห็น orange banner → คลิก "เปิดใน Chrome" → Chrome เปิดหน้าเว็บ → **แต่ต้องแน่ใจว่า ?cart= ถูกส่งไปด้วย**

**สิ่งที่ต้องทำ:**
1. ตรวจสอบว่า intent:// URL ที่สร้างใน InAppBrowserBanner มี `?cart=` รวมอยู่ด้วยหรือไม่
2. หาก URL ปัจจุบันไม่มี `?cart=` (เช่น ผู้ใช้แค่เปิดหน้าแรก ไม่ใช่ลิงค์แชร์ออเดอร์) → intent:// จะไปหน้าเปล่า → ไม่มีอะไรให้แก้ไข เพราะไม่มี cart data ให้เติม
3. **ยืนยัน:** หาก `window.location.href` ตอนนั้นรวม `?cart=<encoded>` อยู่แล้ว → intent:// จะนำไปครบ

### 3. เพิ่มทางเลือกสำหรับ iOS (ที่ไม่ได้ใช้ alert)
**ปัญหาคือ:** iOS ใช้ `alert()` ซึ่ง可能被 блоки
**แก้:** สร้าง panel UI แทน alert (เหมือน InAppBrowserNotice ที่มี step-by-step instruction)

### 4. รายงานสถานะแต่ละ Commit
เนื่องจากไม่สามารถรัน git log ได้โดยตรง → ขอแจ้งวิธีตรวจสอบเอง:
```powershell
git --no-pager log --oneline 0ea8f8e..13bd065
```

## สรุปสั้นๆ

| ปัญหา | สถานะ | การแก้ไข | เวลา |
|---|---|---|---|
| Floating Ad เยอะกว่า 3 | ✅ Code ถูก / ❌ Comment ผิด | แก้ comment 2 บรรทัด | 5 นาที |
| Orange link ไม่ทำงาน | ✅ มีอยู่แล้ว / อาจไม่แสดง | ตรวจสอบ FB detection + dismissed state | 15 นาที |
| คำว่า /safari หาย | ✅ มีอยู่แล้วใน 3 ไฟล์ | ไม่ต้องแก้ | 0 นาที |
| Cart deep-link ไม่เติม | ✅ Code ถูกแต่ต้องทดสอบ | ตรวจสอบ intent:// URL ประกอบด้วย ?cart= | 15 นาที |
| งานซ้ำ/ไม่เสร็จ | ต้องดู git log | รอคุณสั่ง | - |
