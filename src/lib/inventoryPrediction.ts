// ============================================
// Bite Me Baby — Advanced Inventory Prediction
// ============================================

import { storageGet, storageSet } from './bmbStorage'
import { getOrders } from './bmbAdminApi_orders'
import { getProducts } from './bmbAdminApi_products'
import { calculateDemandForecast, getProductionRecommendations } from './demandForecasting'

export interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  current_stock: number
  min_stock: number
  max_stock: number
  unit_price: number
  supplier_name: string
  supplier_phone: string
  reorder_point: number
  lead_time_days: number
  usage_rate: number
  last_reorder_date: string | null
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'critical'
  created_at: string
  updated_at: string
}

export interface InventoryTransaction {
  id: string
  ingredient_id: string
  quantity: number
  type: 'in' | 'out' | 'adjustment'
  reason: string
  reference_id?: string
  created_at: string
}

export interface ReorderRecommendation {
  ingredient_id: string
  ingredient_name: string
  current_stock: number
  recommended_order: number
  estimated_cost: number
  urgency: 'normal' | 'urgent' | 'critical'
  expected_delivery_days: number
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'ing-rice',
    name: 'ข้าว',
    category: 'grains',
    unit: 'กก',
    current_stock: 50,
    min_stock: 20,
    max_stock: 100,
    unit_price: 45,
    supplier_name: 'Farm supplier',
    supplier_phone: '081-234-5678',
    reorder_point: 25,
    lead_time_days: 2,
    usage_rate: 5,
    last_reorder_date: null,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ing-prawn',
    name: 'กุ้งสด',
    category: 'seafood',
    unit: 'กก',
    current_stock: 15,
    min_stock: 5,
    max_stock: 30,
    unit_price: 250,
    supplier_name: 'ตลาดปลา',
    supplier_phone: '082-345-6789',
    reorder_point: 8,
    lead_time_days: 1,
    usage_rate: 3,
    last_reorder_date: null,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ing-chicken',
    name: 'ไก่',
    category: 'meat',
    unit: 'กก',
    current_stock: 20,
    min_stock: 8,
    max_stock: 40,
    unit_price: 120,
    supplier_name: 'ฟารมไก่',
    supplier_phone: '083-456-7890',
    reorder_point: 10,
    lead_time_days: 2,
    usage_rate: 4,
    last_reorder_date: null,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ing-vegetables',
    name: 'ผักสด',
    category: 'vegetables',
    unit: 'กก',
    current_stock: 30,
    min_stock: 15,
    max_stock: 60,
    unit_price: 30,
    supplier_name: 'สวนผักท้องถิ่น',
    supplier_phone: '084-567-8901',
    reorder_point: 20,
    lead_time_days: 1,
    usage_rate: 6,
    last_reorder_date: null,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'ing-sauce',
    name: 'อสและเครื่องปรุง',
    category: 'condiments',
    unit: 'ขวด',
    current_stock: 40,
    min_stock: 20,
    max_stock: 80,
    unit_price: 25,
    supplier_name: 'ร้านเครื่องปรุง',
    supplier_phone: '085-678-9012',
    reorder_point: 25,
    lead_time_days: 3,
    usage_rate: 8,
    last_reorder_date: null,
    status: 'in_stock',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export function getInventoryItems(): InventoryItem[] {
  return storageGet<InventoryItem[]>('bmb_inventory', DEFAULT_INVENTORY)
}

export function updateInventoryItem(id: string, updates: Partial<InventoryItem>): InventoryItem | null {
  const items = getInventoryItems()
  const index = items.findIndex((i: InventoryItem) => i.id === id)
  
  if (index === -1) return null
  
  items[index] = { ...items[index], ...updates, updated_at: new Date().toISOString() }
  storageSet('bmb_inventory', items)
  return items[index]
}

export function addInventoryTransaction(transaction: Omit<InventoryTransaction, 'id' | 'created_at'>): InventoryTransaction {
  const transactions = storageGet<InventoryTransaction[]>('bmb_inventory_transactions', [])
  
  const newTransaction: InventoryTransaction = {
    ...transaction,
    id: `txn-${Date.now()}`,
    created_at: new Date().toISOString()
  }

  transactions.push(newTransaction)
  storageSet('bmb_inventory_transactions', transactions)

  const items = getInventoryItems()
  const index = items.findIndex((i: InventoryItem) => i.id === transaction.ingredient_id)
  
  if (index !== -1) {
    const newStock = Math.max(0, items[index].current_stock + (transaction.type === 'in' ? transaction.quantity : -transaction.quantity))
    items[index].current_stock = newStock
    items[index].status = calculateStockStatus(newStock, items[index].min_stock, items[index].max_stock)
    items[index].updated_at = new Date().toISOString()
    storageSet('bmb_inventory', items)
  }

  return newTransaction
}

function calculateStockStatus(current: number, min: number, max: number): InventoryItem['status'] {
  if (current <= 0) return 'out_of_stock'
  if (current <= min * 0.5) return 'critical'
  if (current <= min) return 'low_stock'
  return 'in_stock'
}

export async function predictInventoryNeeds(days: number = 7): Promise<ReorderRecommendation[]> {
  const items = getInventoryItems()
  const forecast = await calculateDemandForecast()
  const productionRec = await getProductionRecommendations()
  
  const recommendations: ReorderRecommendation[] = []

  items.forEach((item: InventoryItem) => {
    const expectedUsage = item.usage_rate * days
    const forecastMultiplier = forecast.predictedOrders / 20
    const adjustedUsage = expectedUsage * forecastMultiplier
    
    const reorderQuantity = Math.max(
      item.max_stock - item.current_stock,
      adjustedUsage * item.lead_time_days
    )
    
    const estimatedCost = reorderQuantity * item.unit_price
    
    let urgency: 'normal' | 'urgent' | 'critical' = 'normal'
    const daysUntilOut = item.current_stock / (item.usage_rate * forecastMultiplier)
    if (daysUntilOut <= item.lead_time_days) {
      urgency = 'critical'
    } else if (daysUntilOut <= item.lead_time_days * 2) {
      urgency = 'urgent'
    }

    recommendations.push({
      ingredient_id: item.id,
      ingredient_name: item.name,
      current_stock: item.current_stock,
      recommended_order: Math.round(reorderQuantity),
      estimated_cost: Math.round(estimatedCost),
      urgency,
      expected_delivery_days: item.lead_time_days
    })
  })

  const urgencyOrder = { critical: 0, urgent: 1, normal: 2 }
  recommendations.sort((a: ReorderRecommendation, b: ReorderRecommendation) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return recommendations
}

export function getLowStockAlerts(): ReorderRecommendation[] {
  const items = getInventoryItems()
  const alerts: ReorderRecommendation[] = []

  items.forEach((item: InventoryItem) => {
    if (item.current_stock <= item.reorder_point) {
      const urgency = item.current_stock <= item.min_stock * 0.5 ? 'critical' : 'urgent'
      
      alerts.push({
        ingredient_id: item.id,
        ingredient_name: item.name,
        current_stock: item.current_stock,
        recommended_order: item.max_stock - item.current_stock,
        estimated_cost: (item.max_stock - item.current_stock) * item.unit_price,
        urgency,
        expected_delivery_days: item.lead_time_days
      })
    }
  })

  return alerts.sort((a: ReorderRecommendation, b: ReorderRecommendation) => {
    const urgencyOrder = { critical: 0, urgent: 1, normal: 2 }
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
  })
}

export function calculateInventoryValue(): number {
  const items = getInventoryItems()
  return items.reduce((sum: number, item: InventoryItem) => sum + (item.current_stock * item.unit_price), 0)
}

export async function generateInventoryReport(): Promise<{
  totalItems: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  reorderRecommendations: ReorderRecommendation[]
  dailyUsage: Record<string, number>
}> {
  const items = getInventoryItems()
  const alerts = getLowStockAlerts()
  const forecast = await calculateDemandForecast()
  
  const dailyUsage: Record<string, number> = {}
  items.forEach((item: InventoryItem) => {
    dailyUsage[item.name] = item.usage_rate
  })

  return {
    totalItems: items.length,
    totalValue: calculateInventoryValue(),
    lowStockCount: alerts.length,
    outOfStockCount: items.filter((i: InventoryItem) => i.status === 'out_of_stock').length,
    reorderRecommendations: await predictInventoryNeeds(7),
    dailyUsage
  }
}

export async function simulateOrderImpact(orderItems: Array<{ product_id: string; quantity: number }>): Promise<{
  ingredients_affected: string[]
  stockDecrease: Record<string, number>
  potential_out_of_stock: string[]
}> {
  const items = getInventoryItems()
  const products = await getProducts()
  
  const stockDecrease: Record<string, number> = {}
  const ingredientsAffected: string[] = []
  const potentialOutOfStock: string[] = []

  orderItems.forEach((orderItem: { product_id: string; quantity: number }) => {
    const product = products.find((p: any) => p.id === orderItem.product_id)
    if (product) {
      const ingredientId = `ing-${product.category_id}`
      const decrease = orderItem.quantity
      
      stockDecrease[ingredientId] = (stockDecrease[ingredientId] || 0) + decrease
      
      const item = items.find((i: InventoryItem) => i.id === ingredientId)
      if (item) {
        ingredientsAffected.push(item.name)
        const newStock = item.current_stock - decrease
        if (newStock <= 0) {
          potentialOutOfStock.push(item.name)
        }
      }
    }
  })

  return {
    ingredients_affected: [...new Set(ingredientsAffected)],
    stockDecrease,
    potential_out_of_stock: [...new Set(potentialOutOfStock)]
  }
}