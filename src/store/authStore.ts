import { create } from "zustand"
import type { Customer } from "@/types"
import { supabase } from "@/lib/supabase"
import { quickLoginByPhone, type QuickLoginInput } from "@/lib/locationLogin"

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

  setCustomer: (customer: Customer | null) => void
  setIsAuthenticated: (auth: boolean) => void
  setLoyaltyPoints: (points: number) => void
  setReferralCode: (code: string) => void
  addPoints: (points: number) => void
  redeemPoints: (points: number) => boolean

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
export async function fetchProfileRole(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle()
  return (data?.role as string | null) ?? null
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  customer: null,
  isAuthenticated: false,
  isLoading: true,
  loyaltyPoints: 0,
  referralCode: '',

  setCustomer: (customer) => set({ customer, isAuthenticated: !!customer }),
  setIsAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setLoyaltyPoints: (points) => set({ loyaltyPoints: points }),
  setReferralCode: (code) => set({ referralCode: code }),
  addPoints: (points) => set((state) => ({ loyaltyPoints: state.loyaltyPoints + points })),

  redeemPoints: (points) => {
    const state = get()
    if (state.loyaltyPoints < points) return false
    set({ loyaltyPoints: state.loyaltyPoints - points })
    return true
  },

  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    set({
      customer: mapUserToCustomer(user),
      isAuthenticated: true,
      isLoading: false
    })
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
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ customer: null, isAuthenticated: false, loyaltyPoints: 0, referralCode: '' })
  },

  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        set({
          customer: mapUserToCustomer(session.user),
          isAuthenticated: true,
          isLoading: false
        })
      } else {
        set({ customer: null, isAuthenticated: false, isLoading: false })
      }
    } catch {
      set({ customer: null, isAuthenticated: false, isLoading: false })
    }
  }
}))

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