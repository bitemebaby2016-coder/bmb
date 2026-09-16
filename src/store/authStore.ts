import { create } from "zustand"
import type { Customer } from "@/types"
import { authenticateUser, authenticateUserByPhone } from '@/lib/bmbAdminApi_users'

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
  logout: () => void
  checkAuth: () => void
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
    const user = await authenticateUser(email, password)
    if (!user) return false
    
    const customer: Customer = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      line_id: '',
      default_latitude: 0,
      default_longitude: 0,
      default_address_detail: '',
      loyalty_points: 0,
      total_orders: 0,
      total_spent: 0,
      created_at: user.created_at,
      updated_at: user.created_at
    }
    
    set({ customer, isAuthenticated: true, isLoading: false })
    return true
  },

  loginByPhone: async (phone: string, password: string) => {
    const user = await authenticateUserByPhone(phone, password)
    if (!user) return false
    
    const customer: Customer = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      line_id: '',
      default_latitude: 0,
      default_longitude: 0,
      default_address_detail: '',
      loyalty_points: 0,
      total_orders: 0,
      total_spent: 0,
      created_at: user.created_at,
      updated_at: user.created_at
    }
    
    set({ customer, isAuthenticated: true, isLoading: false })
    return true
  },

  logout: () => {
    set({ customer: null, isAuthenticated: false, loyaltyPoints: 0, referralCode: '' })
  },

  checkAuth: () => {
    const stored = localStorage.getItem('bmb_auth')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        set({ customer: data.customer, isAuthenticated: data.isAuthenticated, isLoading: false })
      } catch {
        set({ isLoading: false })
      }
    } else {
      set({ isLoading: false })
    }
  }
}))

// Save auth state to localStorage
useAuthStore.subscribe((state) => {
  if (state.isAuthenticated && state.customer) {
    localStorage.setItem('bmb_auth', JSON.stringify({
      customer: state.customer,
      isAuthenticated: state.isAuthenticated
    }))
  } else {
    localStorage.removeItem('bmb_auth')
  }
})