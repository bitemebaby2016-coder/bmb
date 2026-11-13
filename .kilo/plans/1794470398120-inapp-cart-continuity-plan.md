# Plan แก้ไข InAppBrowser Banner + Cart Continuity — 0ea8f8e → 13bd065

## ปัญหาหลักที่เจ้าของแจ้ง
1. **Orange banner ลิงก์สีส้มใช้ไม่ได้** — เคยใช้ได้ ดูให้ด้วยรับออเดอร์ไปใส่ตะกร้า
2. **LINE/IG ยังไม่มี API** — แต่ให้สร้างโค้ดเตรียมโครงสร้างรอไว้ให้สมบูรณ์
3. **Continuity หลุด** — ต้องต่อเนื่องจาก AI ตอบโพส/คอมเมนต์/ข้อความ → ลิงค์ที่มี ?cart= → เปิดเบราว์เซอร์ภายนอก → มีของในตะกร้าครบบริบทเดียวกัน
4. **Cart deep-link (?)cart= ไม่เติม** — จากบริบท AI ที่ตอบในโพสต์/ข้อความ/WPA ต้องเป็นบริบทเดียวกันต่อเนื่องกันรับงานต่อกันให้ถูกต้อง

---

## การตรวจพบจากโค้ดจริง

### ✅ มีอยู่แล้วถูกต้อง
| รายการ | ไฟล์ | สถานะ |
|---|---|---|
| Floating Ad limit 3 ใบ | `FloatingAdBanners.tsx:87` | `slice(0,3)` ถูกต้อง — แค่ comment ผิด (แก้ในข้อ 1) |
| Cart retry 2 ชั้น (700ms + 2500ms) | `Layout.tsx:131-138` | มีอยู่แล้ว |
| Cart decode+add → strip param | `Layout.tsx:69-138`, `lib/cartDeepLink.ts` | มีอยู่แล้ว |
| iOS Safari guide | `useInAppBrowser.ts:72` | alert บอก "เปิดใน Safari" — เปลี่ยนเป็น Toast ในข้อ 3 |
| Android intent:// button | `InAppBrowserBanner.tsx:17,38-44` | มีอยู่แล้ว |

### ❌ ต้องแก้ 4 ข้อ

#### ข้อ 1: Comment ผิดบอก max 2 แทน max 3
**ไฟล์:** `src/components/home/FloatingAdBanners.tsx`
- บรรทัด 5 (comment): `"max 2 at once"` → `"max 3 at once"`
- บรรทัด 285 (comment): `"max 2 banners"` → `"max 3 banners"`
- **เหตุผล:** โค้ดทำงานถูกต้อง (`slice(0,3)`) แต่ comment เก่าทำให้ developer สับสน

#### ข้อ 2: ขยาย UA Detection สำหรับ LINE/IG + เตรียม API Structure
**ไฟล์หลัก:** `src/hooks/useInAppBrowser.ts`
- บรรทัด 26: เดิม `/FBAV|FB_IAB|FBAN|FBBV/i` → เพิ่ม LINE/IG:
  ```typescript
  const fbUA = /FBAV|FB_IAB|FBAN|FBBV|LINE\/|Instagram\//i.test(ua)
  ```
- เพิ่ม state/type ใหม่สำหรับ LINE/IG platform info:
  ```typescript
  export type InAppPlatform = 'facebook' | 'line' | 'instagram' | 'other'
  ```
- เพิ่มฟังก์ชัน `detectPlatform()`:
  - ตรวจสอบ UA → คืน `'facebook' | 'line' | 'instagram' | 'other'`
  - ใช้แยก UI guide ตาม platform ต่อเมื่อมี API
- **หมายเหตุ:** LINE/IG ยังไม่มี push notification API เหมือน FB ดังนั้นตอนนี้แค่ detect แสดง banner ปกติ — ไม่ต้อง integrate กับ LINE SDK/IG API

#### ข้อ 3: เปลี่ยน iOS alert เป็น Toast Notification
**ไฟล์หลัก:** `src/hooks/useInAppBrowser.ts`
- บรรทัด 71-73: เดิมใช้ `alert()` ซึ่งถูก popup blocker บล็อก
- แก้ใหม่: ใช้ `showToast()` จาก `components/ui/ToastContainer`
- เนื่องจาก hook ไม่สามารถ import component ได้โดยตรง → ใช้ pattern **EventBus** หรือ **callback ref**:
  ```typescript
  // ใน useInAppBrowser hook
  interface UseInAppBrowserReturn {
    // ... existing
    showToast: (message: string, variant?: 'info' | 'success' | 'warning') => void
  }
  ```
- หรือง่ายสุด: สร้าง `toastEmitter` module-level event bus แบบเดียวกับที่ใช้ทั้งโปรเจค:
  ```typescript
  // lib/toastBus.ts (new)
  const listeners = new Set<(msg: ToastMsg) => void>()
  export function subscribeToast(fn) { listeners.add(fn); return () => listeners.delete(fn) }
  export function emitToast(msg: ToastMsg) { listeners.forEach(f => f(msg)) }
  
  // ToastContainer.subscribe(toastBus) → render ทุก emit
  // useInAppBrowser.emitToast({message: '...', variant: 'info'})
  ```
- ข้อความใหม่: `"คัดลอกลิงก์แล้ว — กด ⋯ มุมบนขวา → "เปิดใน Safari" → วางลิงก์"`

#### ข้อ 4: แก้ Cart Continuity — ?cart= ต้องผ่านไปยังเบราว์เซอร์ภายนอกได้ครบ
**ไฟล์หลัก:** `src/components/InAppBrowserBanner.tsx`
- **ปัญหาหลัก:** intent:// URL scheme อาจตัด query string ออก
- **ตรวจสอบ:** บรรทัด 13-18 ใน `InAppBrowserBanner.tsx`:
  ```typescript
  const currentUrl = window.location.href  // ควรรวม ?cart= ด้วย
  const intentUrl = isAndroid
    ? `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;...`
  ```
  - `currentUrl` คือ `window.location.href` — รวม query string อยู่แล้ว
  - แต่ถ้า `currentUrl` เป็น `https://biteme-baby.com/shop?cart=xxx`
  - intent:// จะกลายเป็น `intent://biteme-baby.com/shop?cart=xxx#Intent;scheme=...`
  - **ต้องทดสอบว่า Chrome รองรับ ?cart= ใน intent:// URL หรือไม่**
- **สิ่งที่ต้องเพิ่ม:**
  1. เช็คว่า `window.location.search` มี `cart=` หรือไม่ → เก็บ flag `hasCartParam`
  2. หากมี → สร้าง toast แจ้งเตือนชัดเจน: `"กำลังนำรายการ ${itemCount} รายการในตะกร้า ไปยัง Chrome..."`
  3. หากไม่มี → เปลี่ยนข้อความ banner เป็น `"คุณกำลังเปิดหน้าร้าน — ลิงค์แชร์ออเดอร์ต้องมี ?cart= จากแชท AI จึงจะมีสินค้าในตะกร้า"`
  4. เพิ่ม debug logging: `console.log('[InAppBanner] intentURL:', intentUrl, 'search:', window.location.search)`
- **ไฟล์รอง:** `src/components/layout/Layout.tsx` บรรทัด 69-138
  - Effect ที่จัดการ `?cart=` รันทุกครั้งที่หน้าโหลด → **ต้องแน่ใจว่าไม่-strip ?cart= ก่อน retry เสร็จ**
  - บรรทัด 109-114: strip ?cart= AFTER successful cart restoration → **ถูกต้องแล้ว**

---

## ลำดับการแก้ไข

### Step 1: แก้ Comment FloatingAdBanners.tsx
```
sed: บรรทัด 5 → "max 3 at once"
sed: บรรทัด 285 → "max 3 banners"
```

### Step 2: ขยาย UA Detection + เตรียม Platform Type
**ไฟล์:** `src/hooks/useInAppBrowser.ts`
```diff
- const fbUA = /FBAV|FB_IAB|FBAN|FBBV/i.test(ua)
+ const fbUA = /FBAV|FB_IAB|FBAN|FBBV|LINE\/|Instagram\//i.test(ua)
+ const detectedPlatform = /LINE\//i.test(ua) ? 'line' : /Instagram\//i.test(ua) ? 'instagram' : 'facebook'
```
- เพิ่ม export type: `InAppPlatform = 'facebook' | 'line' | 'instagram' | 'other'`
- เพิ่ม exported value: `export const DETECTED_PLATFORM: InAppPlatform`
- **รองรับ APIfuture:** สร้าง `src/lib/platformAPI.ts` (new file) ที่มี interfaces สำหรับ LINE Push API และ IG Graph API placeholder:
  ```typescript
  export interface PlatformAPI {
    line?: { pushNotification(userId: string, message: string): Promise<void> }
    instagram?: { sendDirectMessage(userId: string, message: string): Promise<void> }
  }
  ```

### Step 3: เปลี่ยน iOS alert เป็น Toast
**ไฟล์:** `src/hooks/useInAppBrowser.ts` + สร้าง `src/lib/toastBus.ts` (new)
```typescript
// src/lib/toastBus.ts (new)
interface ToastMsg { message: string; variant?: 'info' | 'success' | 'warning'; duration?: number }
const listeners = new Set<(msg: ToastMsg) => void>()
export function onToast(fn: (msg: ToastMsg) => void) { listeners.add(fn); return () => listeners.delete(fn) }
export function notifyToast(msg: ToastMsg) { listeners.forEach(f => f({ ...msg, duration: msg.duration ?? 4000 })) }
export function dismissAllToasts() { listeners.clear() }

// ใน App.tsx หรือ main.tsx — subscribe ToastContainer to toastBus:
// import { onToast } from '@/lib/toastBus'
// useEffect(() => onToast(({ message, variant }) => showToast(message, variant)), [])
```

**แก้ไข iOS branch ใน `openExternally()`:**
```diff
- alert('คัดลอกลิงก์แล้ว — กด ⋯ → "เปิดใน Safari"')
+ navigator.clipboard?.writeText(url).catch(() => {})
+ notifyToast({ message: 'คัดลอกลิงก์แล้ว — กด ⋯ มุมบนขวา → "เปิดใน Safari"', variant: 'info' })
```

### Step 4: แก้ Cart Continuity — ?cart= ผ่าน intent:// + UX ชัดเจน
**ไฟล์:** `src/components/InAppBrowserBanner.tsx`
```diff
+ const urlParams = new URLSearchParams(window.location.search)
+ const hasCartParam = urlParams.has('cart')
+ const cartItems = hasCartParam ? (() => { try { const d = JSON.parse(atob(urlParams.get('cart')!.replace(/-/g,'+').replace(/_/g,'/'))) ; return d.items?.length || 0 } catch { return 0 }})() : 0
```
- ถ้า `hasCartParam`:
  - เปลี่ยนข้อความ banner: `"กำลังนำรายการ ${cartItems} รายการในตะกร้า ไปยัง Chrome..."`
  - ปุ่ม Chrome: คงเดิม (intent:// URL พร้อม ?cart=)
  - เพิ่ม console.log: `console.log('[InAppBanner] Cart items found:', cartItems)`
- ถ้า !hasCartParam:
  - เปลี่ยนข้อความ banner: `"คุณกำลังเปิดหน้าร้าน — ลิงค์ที่มี ?cart= จากแชท AI จะเติมตะกร้าอัตโนมัติ เมื่อเปิด Chrome"`
  - ปุ่ม Chrome: disabled หรือเปลี่ยนข้อความเป็น "คลิกเพื่อเปิดเบราว์เซอร์ — ลิงค์นี้จะนำทางไปที่ https://biteme-baby.com/shop"

---

## Validation หลังแก้ไข

### 1. Gates
```bash
npm run lint && npm run typecheck:functions && npm run build && npx vitest run
```

### 2. ทดสอบจริงบน production (hard reload `https://biteme-baby.com`):

#### Scenario A: เปิดจาก Facebook Chat (มี ?cart=)
1. ส่งลิงค์ `https://biteme-baby.com/shop?cart=<base64>` จาก FB Messenger ให้ตัวเอง
2. กดลิงค์ → เห็น orange banner + ข้อความ "กำลังนำรายการ X รายการในตะกร้า..."
3. กด "เปิดใน Chrome" → Chrome เปิด → หน้าโหลด → ตะกร้ามีสินค้า X รายการ (retry 2.5s)
4. ✅ PASS = Cart continuity สำเร็จ

#### Scenario B: เปิดจาก Facebook Chat (ไม่มี ?cart=)
1. กดลิงค์ → เห็น orange banner + ข้อความแนะนำว่ามี ?cart= ถึงจะเติมตะกร้า
2. กด "เปิดใน Chrome" → Chrome เปิด → หน้าแรกเปล่า ไม่มีตะกร้า
3. ✅ PASS = ไม่พัง — แสดง banner แนะนำ

#### Scenario C: เปิดจาก LINE/Instagram
1. กดลิงค์จาก LINE → เห็น orange banner (UA detection ผ่าน LINE/)
2. กดปุ่ม → ทำเหมือน Scenario A/B
3. ✅ PASS = LINE/IG detection ทำงาน

#### Scenario D: iOS Safari
1. กด "เปิดในเบราว์เซอร์ภายนอก" → ไม่เห็น alert pop-up
2. เห็น toast notification ด้านล่างของจอ
3. ✅ PASS = Toast แสดงแทน alert

#### Scenario E: Floating Ad limit
1. มีโปรโมชั่นมากกว่า 3 ใบใน DB
2. เห็น floating ad แสดง 3 ใบเท่านั้น
3. ✅ PASS = Limit ทำงานถูกต้อง

---

## Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| intent:// URL scheme ตัด query string บนบางอุปกรณ์ | ใช้ `browser_fallback_url` fallback → กลับมาหน้าเดิมพร้อม ?cart= |
| ToastBus ทำให้ toast ซ้อนหลายตัวตอน hot-reload | ใช้ debounce/dedup key ใน ToastContainer |
| LINE/IG detection false positive (user agent ถูก spoof) | ยอมรับได้ —banner ขึ้นโดยไม่เสียประโยชน์ |
| Cart decode fail → cartItems = 0 → toast บอก "0 รายการ" | ใส่ guard: `if (cartItems === 0) show generic message instead of count` |
| `atob()` fail บน malformed base64 | Wrap in try/catch + fallback → `cartItems = 0` |

## เอกสารที่เกี่ยวข้อง
- `AI_WORK_STATE.md` — อัปเดตล่าสุดรอบ 11 (session close 2026-11-11)
- `docs/BMB_MASTER_STATUS.md` — LIVE-TEST 2026-11-10 entry แสดง PASS 7/7
- `.kilo/plans/pending-tasks-next-session.md` — Live retest เหลือ §T-A เพียงข้อเดียว
- ไฟล์นี้: `.kilo\plans\1794470398120-final-plan-fix-and-deploy.md` — แผนแก้ไข bugs ที่เจอ
