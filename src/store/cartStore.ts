import { create } from "zustand"
import type { CartItem, Promotion, Product } from "@/types"

interface CartStore {
  items: CartItem[]
  couponCode: string
  appliedPromotion: Promotion | null
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  isCheckoutOpen: boolean

  // Actions
  addItem: (product: Product, quantity?: number, customizations?: Record<string, string | string[]>) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  setCouponCode: (code: string) => void
  setAppliedPromotion: (promo: Promotion | null) => void
  setDeliveryFee: (fee: number) => void
  setCheckoutOpen: (open: boolean) => void

  // Calculations
  recalculate: () => void
  getCartCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  couponCode: '',
  appliedPromotion: null,
  subtotal: 0,
  discount: 0,
  deliveryFee: 0,
  total: 0,
  isCheckoutOpen: false,

  addItem: (product, quantity = 1, customizations = {}) => {
    set((state) => {
      const existingItem = state.items.find(item => item.product.id === product.id)
      let newItems: CartItem[]
      
      if (existingItem) {
        newItems = state.items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      } else {
        newItems = [...state.items, {
          product,
          quantity,
          customizations,
          subtotal: product.price * quantity
        }]
      }
      
      return { items: newItems }
    })
    get().recalculate()
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter(item => item.product.id !== productId)
    }))
    get().recalculate()
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    
    set((state) => ({
      items: state.items.map(item =>
        item.product.id === productId
          ? { ...item, quantity, subtotal: item.product.price * quantity }
          : item
      )
    }))
    get().recalculate()
  },

  clearCart: () => set({ items: [], couponCode: '', appliedPromotion: null, subtotal: 0, discount: 0, deliveryFee: 0, total: 0 }),

  setCouponCode: (code: string) => set({ couponCode: code }),

  setAppliedPromotion: (promo) => set({ appliedPromotion: promo }),

  setDeliveryFee: (fee) => set({ deliveryFee: fee }),

  setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),

  recalculate: () => {
    const state = get()
    const subtotal = state.items.reduce((sum, item) => sum + item.subtotal, 0)
    const discount = state.appliedPromotion 
      ? state.appliedPromotion.type === 'fixed_discount' 
        ? Math.min(state.appliedPromotion.discount_value, subtotal)
        : state.appliedPromotion.type === 'percentage_discount'
          ? Math.min(subtotal * (state.appliedPromotion.discount_value / 100), state.appliedPromotion.max_discount_cap || subtotal)
          : 0
      : 0
    
    const total = Math.max(0, subtotal - discount + state.deliveryFee)
    
    set({ subtotal, discount, total })
  },

  getCartCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0)
}))