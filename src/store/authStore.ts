import { create } from "zustand"
import type { Customer } from "@/types"
import { supabase } from "@/lib/supabase"
import { quickLoginByPhone, type QuickLoginInput } from "@/lib/locationLogin"
import { useLocationStore } from "./locationStore"

// P0-2 FIX (2026-09-18): Authentication ถูกย้ายไป Supabase Auth แล้ว
// ---------------------------------------------------------------
// ก่อนหน้า: อ่าน/เขียน localStorage bmb_users/bmb_auth + bcrypt ใน browser
//   → user DB อยู่ใน client → ปลอม/ถูกขโมยได้
// หลังจาก: Supabase Auth เป็นเจ้าของ identity (JWT session, backend
//          hashing, refresh, logout) — client มีแค่ anon key + session
// ---------------------------------------------------------------

interface AuthStore {
  customer: Customer | null
  isAuthenticated: boolean
  isLoading: boolean
  loyaltyPoints: number
  referralCode: string
  /** Raw Supabase error from the last failed login (surfaced as Thai guidance on /login). */
  lastLoginError: string | null
  /** Current user role from `profiles.role` (RLS-guarded) — drives admin UI visibility. */
  role: string | null
  /**
   * F-02 FIX (Wave 1): true ตั้งแต่ boot จนกว่า checkAuth() จะ restore session
   * จาก Supabase Auth เสร็จครั้งแรก — route guards ต้อง "รอ" ช่วงนี้ (โชว์ spinner)
   * แทนที่จะตัดสินด้วย isAuthenticated=false แล้ว redirect ไป /login ทันที
   * (สาเหตุเดิมของ "session หายเมื่อ reload / deep-link /admin/* 16/16 → /login")
   */
  isInitializing: boolean

  setCustomer: (customer: Customer | null) => void
  setIsAuthenticated: (auth: boolean) => void
  setLoyaltyPoints: (points: number) => void
  setReferralCode: (code: string) => void
  addPoints: (points: number) => void
  redeemPoints: (points: number) => boolean
  setRole: (role: string | null) => void
  refreshRole: () => Promise<string | null>
  /**
   * N3 (R19 · QA 1.6): clear ทุก field ของ store เมื่อ Supabase Auth แจ้ง SIGNED_OUT
   * (session หมดอายุ / โดน signOut จากเครื่องอื่น mid-use) — กันหน้าค้าง
   * `isAuthenticated=true` แล้ว query โดน RLS ปฏิเสธแบบ empty เงียบ
   */
  clearSession: () => void
  /**
   * N3 (R19 · QA 1.6): USER_UPDATED/SIGNED_IN → re-map customer จาก auth user ล่าสุด
   * (คง role/points ไว้ — ไม่ใช่การ logout)
   */
  syncFromAuthUser: (user: Parameters<typeof mapUserToCustomer>[0]) => void

  login: (email: string, password: string) => Promise<boolean>
  loginByPhone: (phone: string, password: string) => Promise<boolean>
  /** New quick login — name + phone + location (Edge Function phone-auto-login). */
  loginByLocation: (input: QuickLoginInput) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

// Map Supabase Auth user → Customer (สำหรับ UI state; identity อยู่ที่
// `supabase.auth` ไม่ใช่ localStorage)
function mapUserToCustomer(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, any>
  phone?: string | null
  created_at?: string
}): Customer {
  return {
    id: user.id,
    email: user.email || '',
    phone: user.phone || user.user_metadata?.phone || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
    line_id: '',
    default_latitude: 0,
    default_longitude: 0,
    default_address_detail: '',
    loyalty_points: 0,
    total_orders: 0,
    total_spent: 0,
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.created_at || new Date().toISOString()
  }
}

// Get current profile role (RLS จะคัดเฉพาะของตัวเอง/ที่อนุญาต)
// F-02 FIX (Wave 1): production บางตารางไม่มี table-level GRANT SELECT ให้
// authenticated (เช่น profiles) → direct select ตอบ 42501 แม้จะมี RLS policy
// fallback ที่ 1: RPC `is_admin()` (SECURITY DEFINER อ่าน profiles.role —
// ใช้งานได้จริงบน production, DB ยังเป็น authority) แล้ว map true → 'admin'
export async function fetchProfileRole(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle()
  if (!error) return (data?.role as string | null) ?? null
  try {
    const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin')
    if (!rpcError && isAdmin === true) return 'admin'
  } catch {
    /* fallthrough */
  }
  return null
}

/**
 * Map the raw Supabase Auth error to actionable Thai guidance.
 * สาเหตุที่พบบ่อยบน production:
 *  - "Email not confirmed"      → สมัครแล้วแต่ยังไม่กดลิงก์ยืนยัน (Supabase default เปิด Confirm email)
 *  - "Invalid login credentials" → อีเมล/รหัสผ่านไม่ถูก
 *  - "Email rate limit exceeded" → Supabase built-in SMTP จำกัดอีเมล/ชั่วโมง
 */
export function describeLoginError(raw: string | null): string {
  const msg = (raw ?? '').toLowerCase()
  if (msg.includes('email not confirmed')) {
    return 'อีเมลนี้ยังไม่ได้ยืนยัน (Email not confirmed) — เปิดลิงก์ยืนยันที่ได้รับทางอีเมล หรือให้เจ้าของร้านไปกด Confirm ที่ Supabase Dashboard → Authentication → Users แล้วลองใหม่'
  }
  if (msg.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้าลืมรหัสผ่าน ให้เจ้าของร้านกด "Send password recovery" ที่ Supabase Dashboard → Authentication → Users'
  }
  if (msg.includes('rate limit')) {
    return 'พยายามหลายครั้งเกินไป (rate limit) — รอสักครู่แล้วลองใหม่อีกครั้ง'
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ — ตรวจอินเทอร์เน็ต/ตั้งค่า VITE_SUPABASE_URL แล้วลองใหม่'
  }
  if (raw) {
    return `เข้าสู่ระบบไม่สำเร็จ: ${raw}`
  }
  return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  customer: null,
  isAuthenticated: false,
  isLoading: true,
  loyaltyPoints: 0,
  referralCode: '',
  lastLoginError: null,
  role: null,
  isInitializing: true,

  setCustomer: (customer) => set({ customer, isAuthenticated: !!customer }),
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setLoyaltyPoints: (points) => set({ loyaltyPoints: points }),
  setReferralCode: (code) => set({ referralCode: code }),
  setRole: (role) => set({ role }),
  refreshRole: async () => {
    const role = await fetchProfileRole()
    set({ role })
    return role
  },
  clearSession: () =>
    set({
      customer: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
      loyaltyPoints: 0,
      referralCode: '',
      role: null,
      lastLoginError: null,
    }),
  syncFromAuthUser: (user) =>
    set({ customer: mapUserToCustomer(user), isAuthenticated: true, isLoading: false, isInitializing: false }),
  addPoints: (points) => set((state) => ({ loyaltyPoints: state.loyaltyPoints + points })),

  redeemPoints: (points) => {
    const state = get()
    if (state.loyaltyPoints < points) return false
    set({ loyaltyPoints: state.loyaltyPoints - points })
    return true
  },

  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Keep the REAL reason (email_not_confirmed / invalid credentials / rate limit…)
      // so /login can guide the user instead of a blanket "Invalid email or password".
      set({ lastLoginError: error.message })
      return false
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ lastLoginError: 'NO_SESSION_USER' })
      return false
    }
    set({
      customer: mapUserToCustomer(user),
      isAuthenticated: true,
      isLoading: false,
      lastLoginError: null,
    })
    void get().refreshRole?.()
    return true
  },

  loginByPhone: async (phone: string, password: string) => {
    // Supabase Auth ใช้ email/OTP ตาม default — สำหรับตอนนี้ phone login
    // ใช้ email field ถ้า email == phone pattern ให้ผ่าน (Enterprise config ภายหลัง)
    const { error } = await supabase.auth.signInWithPassword({
      email: phone.includes('@') ? phone : `${phone}@phone.bmb.local`,
      password
    })
    if (error) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    set({
      customer: mapUserToCustomer(user),
      isAuthenticated: true,
      isLoading: false
    })
    void get().refreshRole?.()
    return true
  },

  loginByLocation: async (input: QuickLoginInput) => {
    const res = await quickLoginByPhone(input)
    if (!res.ok || !res.session) {
      return { ok: false, error: res.error || 'ERR_QUICK_LOGIN' }
    }
    const { data, error } = await supabase.auth.setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    })
    if (error || !data.user) {
      return { ok: false, error: error?.message || 'ERR_SESSION_SET' }
    }
    set({
      customer: mapUserToCustomer(data.user),
      isAuthenticated: true,
      isLoading: false,
    })
    void get().refreshRole?.()
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ customer: null, isAuthenticated: false, loyaltyPoints: 0, referralCode: '', role: null })
  },

  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({
          customer: mapUserToCustomer(session.user),
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false
        })
        void get().refreshRole?.()
      } else {
        set({ customer: null, isAuthenticated: false, isLoading: false, role: null, isInitializing: false })
      }
    } catch {
      set({ customer: null, isAuthenticated: false, isLoading: false, role: null, isInitializing: false })
    }
  }
}))

/**
 * Launch-closure (case D — ลูกค้าเก่ากลับมาสั่งซ้ำ): ดึง "ข้อความที่อยู่" ที่บันทึก
 * ไว้ในแถว customers ของตัวเอง (RLS own-read, migration 006/015) มาเติม
 * locationStore ให้อัตโนมัติ — อุปกรณ์ใหม่/browser ใหม้ไม่ต้องกรอกที่อยู่ซ้ำ
 * (quick-login เคยบันทึกผ่าน EF update_profile แล้ว).
 *
 * ข้อจำกัดโดยเจตนา:
 *   - คืน "ข้อความที่อยู่" เท่านั้น — ไม่คืนพิกัด default_* เพราะ migration 015
 *     ไม่มีคอลัมน์ provenance และ CR-2 ห้ามมอบความน่าเชื่อถือแบบที่พิสูจน์ไม่ได้
 *     (EF เก่าบน production เคยเขียน default_*=0,0 — ห้ามเอามาใช้เด็ดขาด)
 *   - best-effort: ถ้าตารางไม่มี SELECT grant ให้ authenticated (กรณีเดียวกับ
 *     profiles ก่อนหน้านี้) จะเงียบ ๆ ไม่ block การ login
 */
export async function restoreProfileAddress(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    const { data } = await supabase
      .from("customers")
      .select("default_address_detail")
      .eq("user_id", uid)
      .maybeSingle()
    const detail = (data as { default_address_detail?: string | null } | null)
      ?.default_address_detail?.trim()
    if (!detail) return
    const loc = useLocationStore.getState()
    if (loc.location.addressDetail) return // ข้อมูลในเครื่องมีอยู่แล้ว — ไม่ทับ
    // source เดิมคงไว้ (provenance policy ของ locationStore จัดการต่อเอง)
    loc.setLocation({ addressDetail: detail, source: loc.location.source })
  } catch {
    /* best-effort — never blocks login */
  }
}

// สมัครสมาชิกผ่าน Supabase Auth (แทน createUser ที่เขียน localStorage)
export async function signUpWithEmail(data: {
  name: string
  email: string
  phone: string
  password: string
}): Promise<{ ok: boolean; error?: string }> {
  // Email domain การันตี uniqueness; signUp ต้องการ email เดียวกัน
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.name,
        phone: data.phone
      }
    }
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}