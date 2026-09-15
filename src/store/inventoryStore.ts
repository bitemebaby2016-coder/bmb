import { create } from "zustand"
import type { Ingredient, ReorderAlert, InventoryTransaction } from "@/types"

interface InventoryStore {
  ingredients: Ingredient[]
  alerts: ReorderAlert[]
  transactions: InventoryTransaction[]
  isLoading: boolean

  // Actions
  setIngredients: (ingredients: Ingredient[]) => void
  addIngredient: (ingredient: Ingredient) => void
  updateIngredient: (id: string, updates: Partial<Ingredient>) => void
  deleteIngredient: (id: string) => void
  addTransaction: (transaction: InventoryTransaction) => void
  setTransactions: (transactions: InventoryTransaction[]) => void

  // Calculations
  checkLowStock: () => void
  getLowStockIngredients: () => Ingredient[]
  getCriticalStockIngredients: () => Ingredient[]
  getIngredientUsage: (productId: string) => Ingredient[]
  calculateReorderQuantity: (ingredient: Ingredient) => number
  estimateCost: (quantity: number, unitPrice: number) => number

  // Alerts
  setAlerts: (alerts: ReorderAlert[]) => void
  resolveAlert: (alertId: string) => void
  getActiveAlerts: () => ReorderAlert[]

  // Bulk operations
  bulkUpdateStock: (updates: Array<{ id: string; quantity: number; reason: string }>) => void
}

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  ingredients: [],
  alerts: [],
  transactions: [],
  isLoading: false,

  setIngredients: (ingredients) => set({ ingredients }),

  addIngredient: (ingredient) => set((state) => ({
    ingredients: [...state.ingredients, ingredient]
  })),

  updateIngredient: (id, updates) => set((state) => ({
    ingredients: state.ingredients.map(ing =>
      ing.id === id ? { ...ing, ...updates, updated_at: new Date().toISOString() } : ing
    )
  })),

  deleteIngredient: (id) => set((state) => ({
    ingredients: state.ingredients.filter(ing => ing.id !== id)
  })),

  addTransaction: (transaction) => set((state) => ({
    transactions: [transaction, ...state.transactions]
  })),

  setTransactions: (transactions) => set({ transactions }),

  checkLowStock: () => {
    const state = get()
    const alerts: ReorderAlert[] = []
    
    state.ingredients.forEach(ingredient => {
      if (ingredient.current_stock <= ingredient.min_stock) {
        const urgency = ingredient.current_stock <= ingredient.min_stock * 0.5 
          ? 'critical' as const 
          : ingredient.current_stock <= ingredient.min_stock * 0.75
            ? 'high' as const
            : 'medium' as const
        
        alerts.push({
          id: `alert-${ingredient.id}`,
          ingredient_id: ingredient.id,
          ingredient_name: ingredient.name,
          current_stock: ingredient.current_stock,
          min_stock: ingredient.min_stock,
          recommended_quantity: Math.max(ingredient.max_stock - ingredient.current_stock, ingredient.min_stock),
          estimated_cost: (ingredient.max_stock - ingredient.current_stock) * ingredient.unit_price,
          urgency,
          generated_at: new Date().toISOString(),
          is_resolved: false
        })
      }
    })
    
    set({ alerts })
  },

  getLowStockIngredients: () => {
    const state = get()
    return state.ingredients.filter(ing => 
      ing.current_stock <= ing.min_stock && ing.current_stock > 0
    )
  },

  getCriticalStockIngredients: () => {
    const state = get()
    return state.ingredients.filter(ing => ing.current_stock <= 0)
  },

  getIngredientUsage: (productId: string) => {
    const state = get()
    // This would normally query from database
    return state.ingredients.map(ing => ({
      ...ing,
      usage_per_product: 0 // placeholder
    }))
  },

  calculateReorderQuantity: (ingredient) => {
    return Math.max(ingredient.max_stock - ingredient.current_stock, ingredient.min_stock)
  },

  estimateCost: (quantity, unitPrice) => {
    return quantity * unitPrice
  },

  setAlerts: (alerts) => set({ alerts }),

  resolveAlert: (alertId) => set((state) => ({
    alerts: state.alerts.map(alert =>
      alert.id === alertId ? { ...alert, is_resolved: true, resolved_at: new Date().toISOString() } : alert
    )
  })),

  getActiveAlerts: () => {
    const state = get()
    return state.alerts.filter(alert => !alert.is_resolved)
  },

  bulkUpdateStock: (updates) => {
    set((state) => ({
      ingredients: state.ingredients.map(ing => {
        const update = updates.find(u => u.id === ing.id)
        if (update) {
          const newStock = Math.max(0, ing.current_stock + update.quantity)
          return {
            ...ing,
            current_stock: newStock,
            status: newStock <= 0 ? 'out_of_stock' as const : 
                    newStock <= ing.min_stock ? 'low_stock' as const : 'in_stock' as const,
            updated_at: new Date().toISOString()
          }
        }
        return ing
      })
    }))
    get().checkLowStock()
  }
}))