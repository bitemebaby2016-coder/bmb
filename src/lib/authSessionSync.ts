// ============================================
// BMB — auth session sync (N3 · R19 · QA review 1.6)
// ============================================
// ปัญหาเดิม (probe = 0 จุด `onAuthStateChange` ใน src/): session หมดอายุ หรือโดน
// signOut จากเครื่องอื่นระหว่างใช้งาน → authStore ค้าง `isAuthenticated=true` →
// query ถัดไปโดน RLS ปฏิเสธแบบ **empty เงียบ** ไม่เด้ง /login
// ทางแก้ = listener กลาง (mount ใน App): SIGNED_OUT → clear + redirect /login
// (คง `from`) · TOKEN_REFRESHED → refreshRole() · USER_UPDATED/SIGNED_IN → re-map customer
//
// ส่วน decision เป็น pure function เพื่อให้ unit test ได้โดยไม่ต้องยุ่งกับ Supabase
// ============================================

export interface AuthSyncInput {
  /** event จาก `supabase.auth.onAuthStateChange` */
  event: string
  /** ค่า `isAuthenticated` ของ authStore ณ วินาทีที่ event ถึง (ก่อน clear) */
  wasAuthenticated: boolean
  /** `location.pathname + location.search` ปัจจุบัน (ใช้ตัดสิน redirect + เก็บเป็น `from`) */
  path: string
}

export interface AuthSyncAction {
  /** clear authStore ทั้งก้อน */
  clear: boolean
  /** re-map customer จาก session.user ล่าสุด */
  remapUser: boolean
  /** ดึง roles.role ใหม่ (RLS-guarded) */
  refreshRole: boolean
  /** เด้งไป /login */
  redirectLogin: boolean
  /** หน้าที่ผู้ใช้ยืนอยู่ — ส่งเป็น state.from ให้ login เสร็จแล้วกลับหน้าเดิม */
  from: string | null
}

export const LOGIN_PATH = '/login'

const IDLE: AuthSyncAction = { clear: false, remapUser: false, refreshRole: false, redirectLogin: false, from: null }

/**
 * Pure decision table ของ listener กลาง — แยกจาก Supabase/React เพื่อให้ test ตรง ๆ ได้
 *
 * กติกาสำคัญ:
 * - `SIGNED_OUT` redirect เฉพาะตอนที่ **เคยล็อกอินจริง** และยังไม่ได้อยู่ /login
 *   (กัน boot loop: ตอนเปิดหน้าใหม่ไม่มี session จะไม่ต้องถูกเด้งซ้ำ)
 * - `TOKEN_REFRESHED` ไม่ clear อะไร — แค่รีเฟรช role (role เปลี่ยนใน DB ระหว่าง session ได้)
 * - event อื่น ๆ (INITIAL_SESSION / PASSWORD_RECOVERY / …) = ไม่ทำอะไร —
 *   boot path ยังคงเดิมผ่าน `checkAuth()` ใน main.tsx
 */
export function resolveAuthSyncAction({ event, wasAuthenticated, path }: AuthSyncInput): AuthSyncAction {
  const p = path || '/'
  const onLogin = p === LOGIN_PATH || p.startsWith(`${LOGIN_PATH}?`) || p.startsWith(`${LOGIN_PATH}#`)
  switch (event) {
    case 'SIGNED_OUT': {
      const redirectLogin = wasAuthenticated && !onLogin
      return { ...IDLE, clear: true, redirectLogin, from: redirectLogin ? p : null }
    }
    case 'TOKEN_REFRESHED':
      return { ...IDLE, refreshRole: wasAuthenticated }
    case 'USER_UPDATED':
      return { ...IDLE, remapUser: true }
    case 'SIGNED_IN':
      return { ...IDLE, remapUser: true, refreshRole: wasAuthenticated }
    default:
      return { ...IDLE }
  }
}
