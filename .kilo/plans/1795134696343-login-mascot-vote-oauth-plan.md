# แผนแก้ไข: Mascot, Logout, โหวต, OAuth/Passkey, login เบอร์โทร

## สถานะปัจจุบัน (อ้างอิงจากโค้ดจริง)
- `src/components/ai/BiteMascot.tsx:350` — ปุ่มมาสคอตมีทั้ง `animate-float` (translateY) + `hover:scale-105` (scale) → transform ทับกัน หลุดเฟรม
- `src/components/ui/MascotWrapper.tsx:128` — wrapper มี `animate-float` อีกชั้น = ลอยซ้อนสองชั้น
- `src/components/layout/Header.tsx:41-44` — `handleLogout()` เรียก `logout()` โดยไม่ `await` แล้วสั่ง `window.location.href = '/'` ทันที → signOut อาจยังไม่เสร็จก่อนหน้าจะโหลดใหม่ → session ค้าง → เข้าใหม่ไม่ได้
- `src/lib/voteClient.ts` — เรียก `supabase.rpc('preorder_vote_status')` / `preorder_vote_cast` ต้องมี migration 208 ติดตั้งบน Supabase server ถ้ายังไม่ deploy → โหลดค้าง / โหวต error `load_failed`
- `src/lib/socialLogin.ts`, `src/lib/passkeyLogin.ts`, `src/pages/login/LoginPage.tsx` — โค้ด frontend พร้อม แต่ต้องตั้งค่า provider ใน Supabase Dashboard ก่อนจึงใช้จริงได้
- `src/store/authStore.ts:238-262` — มี `loginByPhone(phone, password)` แล้ว แต่ยังไม่เปิดใน UI LoginPage

## งานที่ต้องทำ (implementation)

### 1. แก้ mascot hover / アニメชันซ้อน
**ไฟล์:** `src/components/ai/BiteMascot.tsx` บรรทัด 350
- ลบ `animate-float` ออกจาก className ของปุ่มมาสคอต (ปล่อยให้ `MascotWrapper` จัดการลอยชั้นเดียว)
- เก็บ `hover:scale-105 active:scale-95 transition-transform` ไว้ที่ปุ่มเช่นเดิม
- ตรวจสอบ `MascotWrapper.tsx:128` ว่ามี `animate-float` ชั้นเดียวพอ (ไม่ต้องแก้ถ้าถูกแล้ว)

### 2. แก้ logout ให้จริง เข้าใหม่ได้
**ไฟล์:** `src/components/layout/Header.tsx` ฟังก์ชัน `handleLogout()` (บรรทัด 41-44)
- เปลี่ยนจาก `logout(); window.location.href = '/'` เป็น `await logout(); navigate('/login')` (หรือ `window.location.href = '/login'` หลัง await)
- ต้อง `await logout()` ให้ `supabase.auth.signOut()` เสร็จก่อนจึงนำทางออก
- redirect ไป `/login` (ไม่ใช่ `/`) เพื่อให้ผู้ใช้เห็นหน้า login ทันที
- แก้ทั้งเวอร์ชันเดสก์ท็อป (บรรทัด 41-44) และเมนูมือถือ (บรรทัด 217-221) ที่เรียก `handleLogout()` เช่นกัน

### 3. แก้ระบบโหวตขัดข้อง
**ไฟล์:** `src/lib/voteClient.ts`, `src/pages/VotePage.tsx`
- ตรวจสอบว่า migration 208 (`preorder_vote_cast.sql`) ถูก deploy บน Supabase server แล้วหรือไม่ — ต้องมีฟังก์ชัน `preorder_vote_status()` และ `preorder_vote_cast(p_product_id text)` รวมถึงตาราง `preorder_votes` พร้อม index `idx_preorder_votes_unique_identity`
- ถ้ายังไม่deploy ให้นำ migration 208 และ 058 (`preorder_votes_close_anon_insert.sql`) มาใช้กับฐานข้อมูล production
- ใน `VotePage.tsx` ตรวจสอบว่า `fetchVoteStatus()` คืน `null` เมื่อไร แสดงข้อความ "โหลดผลโหวตไม่สำเร็จ — กด 'ลองใหม่'" ให้ชัดเจน (มีอยู่แล้วที่บรรทัด 200-202)

### 4. ตั้งค่า OAuth/Passkey ให้ใช้ได้จริง
** Supabase Dashboard (ทำฝั่งผู้ดูแลระบบ):**
- **Google:** เปิดใช้ provider Google + ใส่ Client ID / Secret → frontend (`signInWithSocial('google')`) พร้อมแล้ว
- **Facebook:** เปิดใช้ provider Facebook + ใส่ Client ID / Secret → frontend (`signInWithFacebook`) พร้อมแล้ว
- **LINE:** ลงทะเบียนเป็น Custom OIDC Provider (Channel ID/Secret, scopes `openid profile email`) → frontend (`signInWithSocial('line')`) พร้อมแล้ว
- **Passkey / WebAuthn:** frontend ตรวจ `isPasskeySupported()` แล้วแสดงปุ่มเมื่อเบราว์เซอร์รองรับ → ยืนยันว่าทำงานบน Chrome/Safari ปัจจุบัน

**ไฟล์ frontend:** ไม่ต้องแก้โค้ด (พร้อมแล้ว) แค่ทดสอบหลังตั้งค่า Dashboard เสร็จ

### 5. เพิ่มวิธี login ด้วยเบอร์โทร
**ไฟล์:** `src/pages/login/LoginPage.tsx`
- เพิ่ม state `mode` เป็น `'email' | 'quick' | 'phone'` (มี `'email'`, `'quick'` แล้ว)
- เพิ่มแท็บ/ฟอร์ม "เข้าสู่ระบบด้วยเบอร์โทร" มี input เบอร์โทร + รหัสผ่าน
- เรียก `loginByPhone(qPhone, qPassword)` จาก `useAuthStore` (มีอยู่ใน `authStore.ts:238`)
- แสดง error แปลเป็นภาษาไทยผ่าน `describeLoginError()` เช่นเดิม

## เกณฑ์รับความถูกต้อง (validation)
1. Mascot: hover แล้วขยาย/หดนุ่ม ไม่กระตุก ไม่หลุดกรอบ ไม่ลอยซ้อนสองชั้น
2. Logout: กดออกแล้วหน้าไปที่ `/login` ทันที session ถูกล้างจริง กด "เข้าสู่ระบบ" ใหม่ได้ไม่ติด session เดิม
3. โหวต: โหลดสถานะโหวตได้จาก server โหวตแล้วตัวเลขเปลี่ยนจริง ไม่ค้างที่ `load_failed`
4. Google/Facebook/LINE OAuth: กดปุ่มแล้วเด้งไปหน้า provider จริง กลับมาแล้ว login สำเร็จ
5. Passkey: ปุ่มแสดงเมื่อเบราว์เซอร์รองรับ ยืนยันตัวตนผ่าน Face/Touch ID ได้
6. เบอร์โทร: ฟอร์มโทรศัพท์ปรากฏในหน้า login กรอกเบอร์ + รหัสผ่านแล้วเข้าระบบได้

## หมายเหตุ
- งานที่ 1, 2, 3, 5 แก้ในโค้ด frontend ได้ทันที
- งานที่ 4 ต้องผู้ดูแลระบบตั้งค่า Supabase Dashboard ก่อนจึงทดสอบได้จริง