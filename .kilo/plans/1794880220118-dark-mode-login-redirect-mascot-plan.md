# แผนแก้ไข: dark mode เริ่มต้น + redirect /shop หลังล็อกอิน + ย้ายมาสคอต peeking (รีวิว)

## เป้าหมาย (จากคำขอผู้ใช้)
1. ผู้ใช้ทุกคน (ยังไม่เคยตั้งค่าธีม) เริ่มต้นด้วย **dark mode**
2. หลังล็อกอิน/สมัคร → ส่งไป **/shop** โดยตรง ไม่ต้องกลับหน้าแรกแล้วกดเข้าร้านใหม่
3. มาสคอตท่า **peeking** ที่โผล่บนการ์ดรีวิว → **เลื่อนตำแหน่งลง** จากตำแหน่งปัจจุบัน (ผู้ใช้บอก "จาก 20%")

## สถานะปัจจุบัน (ยืนยันจากโค้ดแล้ว)
- **ธีม**: `src/lib/theme.ts:34` `migrateTheme()` คืน `'light'` เป็นค่า fallback เมื่อ localStorage ว่าง/ค่าอื่น; `getTheme()` บรรทัด 41 catch fallback ก็ `'light'`; `index.html:13-23` inline script กันกระพริบก่อน paint fallback ก็ `'light'` → ผู้ใช้ใหม่ได้ธีมสว่าง
- **redirect หลังล็อกอิน**: `src/lib/socialLogin.ts:39` `readSocialNext(fallback = '/')` คืน `'/'` เมื่อไม่มี `?next=`; `src/pages/login/LoginPage.tsx:41-43` `returnTo = state.from || readSocialNext() || null` → เข้า `/login` ตรงๆ จะได้ `returnTo = '/'`; บรรทัด 91 (fast-path เมื่อล็อกอินอยู่แล้ว) และ 116 (หลัง login สำเร็จ) ทำ `navigate(returnTo || '/shop')` / `navigate(returnTo || (role === 'admin' ? '/admin' : '/shop'))` → เมื่อ `returnTo = '/'` ก็จะ `navigate('/')` กลับหน้าแลนดิ้ง (`/`) แทนที่จะไป `/shop` → ผู้ใช้ต้องกด "สั่งอาหารเลย" บนหน้าแรกอีกรอบ (`src/pages/login/RegisterPage.tsx:76` มีปัญหาเดียวกันตอนสมัครเสร็จ)
- **มาสคอต peeking รีวิว**: `src/index.css:744-754` `.mascot-peek { position: absolute; top: -10px; right: -6px }` (โผล่ที่ขอบบนสุดของการ์ดรีวิว, `.review-card-3d` คือ relative container); `src/index.css:414-431` `.review-card-glass { top: 20% }` (กรอบรีวิวเริ่มที่ 20% ของการ์ด); ใช้ใน `src/components/CustomerReviewCard.tsx:157-163` ซึ่งเรนเดอร์ผ่าน `ReviewCarouselSection` บน `/shop` (`src/pages/HomePage.tsx:583-591`)

## งานที่ต้องทำ (implementation tasks)
1. **ค่าเริ่มต้นเป็น dark mode**
   - `src/lib/theme.ts`: `migrateTheme()` fallback `'light'` → `'dark'` (บรรทัด 34); `getTheme()` catch `'light'` → `'dark'` (บรรทัด 41)
   - `index.html`: inline script fallback `'light'` → `'dark'` (บรรทัด 17); `meta theme-color` กรณี non-light คง `#121214` (อยู่แล้ว, ไม่ต้องแตะ)
   - หมายเหตุ: ผู้ใช้ที่มีค่าใน localStorage แล้ว (light/graphite) ยังคงใช้ธีมเดิม — เปลี่ยนเฉพาะค่าเริ่มต้นของผู้ใช้ใหม่/ยังไม่ตั้งค่า
2. **หลังล็อกอิน/สมัคร → /shop โดยตรง (ถ้าไม่มี deep-link ที่ตั้งใจจริง)**
   - `src/pages/login/LoginPage.tsx`: คำนวณ `returnTo` ใหม่ — อ่าน `state.from` หรือ `readSocialNext()` เช่นเดิม แต่ถ้าค่าที่ได้คือ `'/'` ให้เท่ากับ `null` (ไม่ถือว่าเป็นปลายทางที่ตั้งใจ); คง `navigate(returnTo || '/shop')` บรรทัด 91 และ `navigate(returnTo || (role === 'admin' ? '/admin' : '/shop'))` บรรทัด 116 ไว้เหมือนเดิม (ทดสอบเดิมที่เช็กข้อความ navigate ยังผ่าน)
   - `src/pages/login/RegisterPage.tsx`: เดียวกันที่ `navigate(returnTo || '/shop')` บรรทัด 76
   - ผล: เข้า `/login` ตรงๆ / social โดยไม่มี `?next=` → หลังล็อกอินไป `/shop` ทันที; deep-link จริงเช่น `/checkout`, `/orders`, `/admin/orders?tab=x` ยังถูกส่งกลับตามเดิม
3. **เลื่อนมาสคอต peeking ลง** — ยังขาดคำตอบ (ดูคำถามสำคัญข้างล่าง); แก้ที่ `src/index.css` `.mascot-peek` (และ/หรือ `.review-card-glass` ตามที่ตกลง)

## คำถามสำคัญ (ขาด 1 ข้อก่อนลงมือทำข้อ 3)
มาสคอต peeking ปัจจุบันอยู่ที่ `top: -10px` (ขอบบนสุดของการ์ดรีวิว) ในขณะที่กรอบรีวิว `.review-card-glass` เริ่มที่ `top: 20%` ผู้ใช้ระบุ "จากปัจจุบัน 20% ให้เลื่อนตำแหน่งลงมา" → ต้องการตำแหน่งใหม่เท่าไหร่?

ตัวเลือกที่แนะนำ (เลือกหนึ่ง):
- `top: 30%` (ต่ำกว่าขอบบนกรอบรีวิวเล็กน้อย — mascot โผล่ให้เห็นชัดขึ้นไม่ติดขอบภาพ)
- `top: 25%` (เลื่อนลงนิดเดียว)
- ระบุค่าอื่นเอง (เช่น `top: 35%`, หรือให้ชิดขอบล่างของภาพอาหารแทน)

## การทดสอบความถูกต้อง (ก่อนส่งงาน)
- `npm run lint` (eslint + `node scripts/brandNameGuard.cjs`)
- `npm run test` (vitest run) — `theme.test.ts`, `loginContextRestoration.test.ts`, `socialLogin.test.ts` ต้องผ่าน; หากเปลี่ยนค่า fallback ใน `theme.ts` ให้อัปเดต `theme.test.ts` บรรทัด 46-50 และ 54-56 เป็น `'dark'`
- `npm run build` (tsc + vite build) ต้องผ่าน

## หมายเหตุไม่อยู่ในขอบเขตครั้งนี้
- การ redirect ผู้ใช้ที่ล็อกอินอยู่แล้วแล้วเข้า `/` โดยตรง (ขอให้เป็นเรื่องถัดไปหากต้องการ)
- ธีม graphite ยังคงมีอยู่เหมือนเดิม (cycle light → dark → graphite ไม่ต้องแก้)
