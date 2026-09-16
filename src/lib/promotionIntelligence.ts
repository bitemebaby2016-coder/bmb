// ============================================
// Bite Me Baby — AI Promotion Intelligence
// AI-powered promotion recommendations and optimization
// ============================================

import { storageGet, storageSet } from './bmbStorage'
import { getOrders } from './bmbAdminApi_orders'
import { getProducts } from './bmbAdminApi_products'
import type { Product } from '@/types'

export interface Promotion {
  id: string
  name: string
  code: string
  type: 'fixed_discount' | 'percentage_discount' | 'free_shipping' | 'spend_threshold' | 'buy_x_get_y' | 'combo' | 'loyalty' | 'referral' | 'birthday' | 'flash_sale' | 'round_based'
  discount_value: number
  max_discount_cap: number
  min_spend: number
  starts_at: string
  ends_at: string
  is_active: boolean
  usage_count: number
  max_uses: number
  created_at: string
}

export interface PromotionInsight {
  promotion_id: string
  name: string
  performance: 'excellent' | 'good' | 'average' | 'poor'
  conversionRate: number
  revenueImpact: number
  recommendations: string[]
}

// Default promotions
export const DEFAULT_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-welcome',
    name: 'ลกค้าใหม่ลด 10%',
    code: 'WELCOME10',
    type: 'percentage_discount',
    discount_value: 10,
    max_discount_cap: 100,
    min_spend: 0,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_count: 0,
    max_uses: 1000,
    created_at: new Date().toISOString()
  },
  {
    id: 'promo-freeship',
    name: 'ส่งฟรีเมื่อื้อครบ 200',
    code: 'FREESHIP200',
    type: 'free_shipping',
    discount_value: 30,
    max_discount_cap: 30,
    min_spend: 200,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_count: 0,
    max_uses: 500,
    created_at: new Date().toISOString()
  },
  {
    id: 'promo-lunch50',
    name: 'ลด 50 บาทเมื่อื้อครบ 300',
    code: 'LUNCH50',
    type: 'fixed_discount',
    discount_value: 50,
    max_discount_cap: 50,
    min_spend: 300,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_count: 0,
    max_uses: 200,
    created_at: new Date().toISOString()
  },
  {
    id: 'promo-morning15',
    name: 'ลด 15% รอบเช้า',
    code: 'MORNING15',
    type: 'percentage_discount',
    discount_value: 15,
    max_discount_cap: 150,
    min_spend: 100,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_count: 0,
    max_uses: 300,
    created_at: new Date().toISOString()
  }
]

// Get all promotions
export function getPromotions(): Promotion[] {
  return storageGet<Promotion[]>('bmb_promotions', DEFAULT_PROMOTIONS)
}

// Get active promotions
export function getActivePromotions(): Promotion[] {
  const now = new Date().toISOString()
  return getPromotions().filter(p => 
    p.is_active && 
    p.ends_at > now &&
    (p.max_uses === 0 || p.usage_count < p.max_uses)
  )
}

// Apply promotion to order
export function applyPromotion(
  orderTotal: number,
  promotionCode: string
): { discount: number; promotion: Promotion | null } {
  const promotions = getActivePromotions()
  const promotion = promotions.find(p => p.code === promotionCode.toUpperCase())
  
  if (!promotion) {
    return { discount: 0, promotion: null }
  }

  let discount = 0

  switch (promotion.type) {
    case 'fixed_discount':
      if (orderTotal >= promotion.min_spend) {
        discount = Math.min(promotion.discount_value, orderTotal)
      }
      break

    case 'percentage_discount':
      if (orderTotal >= promotion.min_spend) {
        discount = orderTotal * (promotion.discount_value / 100)
        discount = Math.min(discount, promotion.max_discount_cap)
      }
      break

    case 'free_shipping':
      if (orderTotal >= promotion.min_spend) {
        discount = promotion.discount_value // Free shipping value
      }
      break

    case 'spend_threshold':
      if (orderTotal >= promotion.min_spend) {
        discount = promotion.discount_value
      }
      break

    default:
      discount = 0
  }

  // Increment usage count
  const allPromotions = getPromotions()
  const index = allPromotions.findIndex(p => p.id === promotion.id)
  if (index !== -1) {
    allPromotions[index].usage_count++
    storageSet('bmb_promotions', allPromotions)
  }

  return { discount, promotion }
}

// Get promotion insights
export async function getPromotionInsights(): Promise<PromotionInsight[]> {
  const promotions = getPromotions()
  const orders = await getOrders()
  const insights: PromotionInsight[] = []

  promotions.forEach((promo: Promotion) => {
    // Count orders using this promotion (simplified)
    const usageCount = promo.usage_count
    const conversionRate = usageCount > 0 ? (usageCount / orders.length) * 100 : 0
    
    // Calculate revenue impact (simplified)
    const avgDiscount = promo.type === 'percentage_discount' 
      ? promo.discount_value / 100 
      : promo.discount_value / 1000
    const revenueImpact = usageCount * (orders.reduce((sum: number, o: any) => sum + o.total_amount, 0) / orders.length || 0) * avgDiscount

    // Determine performance
    let performance: 'excellent' | 'good' | 'average' | 'poor' = 'average'
    if (conversionRate > 20) performance = 'excellent'
    else if (conversionRate > 10) performance = 'good'
    else if (conversionRate < 5) performance = 'poor'

    // Generate recommendations
    const recommendations: string[] = []
    if (performance === 'poor') {
      recommendations.push('📉转化率ต่ำ - ลองเพิ่มส่วนลดหรือลดขั้นต่ำ')
    }
    if (usageCount > promo.max_uses * 0.8) {
      recommendations.push('⚠️ ใกล้หมดควตา - เพิ่ม max_uses หรือต่ออายุ')
    }
    if (promo.ends_at < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()) {
      recommendations.push('⏰ ใกล้หมดอายุ - ต่ออายุหรือสร้างปรมชั่นใหม่')
    }

    insights.push({
      promotion_id: promo.id,
      name: promo.name,
      performance,
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenueImpact: Math.round(revenueImpact),
      recommendations
    })
  })

  return insights
}

// AI recommends new promotions
export async function recommendPromotions(): Promise<Array<{
  type: string
  description: string
  expectedConversion: number
  expectedRevenue: number
}> > {
  const orders = await getOrders()
  const products = await getProducts()
  const insights = getPromotionInsights()

  const recommendations: Array<{
    type: string
    description: string
    expectedConversion: number
    expectedRevenue: number
  }> = []

  // Analyze order patterns
  const avgOrderValue = orders.length > 0 
    ? orders.reduce((sum: number, o: any) => sum + o.total_amount, 0) / orders.length 
    : 200

  // Recommendation 1: Spend threshold for free shipping
  if (avgOrderValue < 250) {
    recommendations.push({
      type: 'spend_threshold',
      description: 'สร้างปรมชั่น "ส่งฟรีเมื่อื้อครบ ฿250" เพื่อเพิ่ม average order value',
      expectedConversion: 15,
      expectedRevenue: 5000
    })
  }

  // Recommendation 2: Flash sale for slow-moving items
  const featuredProducts = products.filter((p: Product) => p.is_featured)
  if (featuredProducts.length > 0) {
    recommendations.push({
      type: 'flash_sale',
      description: 'ทำ Flash Sale สำหรับเมนแนะนำ ลด 20% ใน 2 ชั่วมง',
      expectedConversion: 25,
      expectedRevenue: 8000
    })
  }

  // Recommendation 3: Loyalty points multiplier
  recommendations.push({
    type: 'loyalty',
    description: 'เพิ่มแต้ม 2x สำหรับออเดอรรอบเช้า (morning round)',
    expectedConversion: 20,
    expectedRevenue: 3000
  })

  // Recommendation 4: Combo deal
  const dishCount = products.filter((p: Product) => p.category_id === 'cat-1').length
  const drinkCount = products.filter((p: Product) => p.category_id === 'cat-4').length
  
  if (dishCount > 0 && drinkCount > 0) {
    recommendations.push({
      type: 'combo',
      description: 'สร้างชุดคอมบ "จานเดียว + เครื่องดื่ม" ราคาพิเศษ ฿99',
      expectedConversion: 30,
      expectedRevenue: 10000
    })
  }

  return recommendations
}

// Create new promotion
export function createPromotion(data: Partial<Promotion>): Promotion {
  const promotions = getPromotions()
  const newPromo: Promotion = {
    id: `promo-${Date.now()}`,
    name: data.name || 'New Promotion',
    code: data.code || `PROMO${Date.now()}`,
    type: data.type || 'fixed_discount',
    discount_value: data.discount_value || 0,
    max_discount_cap: data.max_discount_cap || 0,
    min_spend: data.min_spend || 0,
    starts_at: data.starts_at || new Date().toISOString(),
    ends_at: data.ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    usage_count: 0,
    max_uses: data.max_uses || 0,
    created_at: new Date().toISOString()
  }

  promotions.push(newPromo)
  storageSet('bmb_promotions', promotions)
  return newPromo
}

// Update promotion
export function updatePromotion(id: string, data: Partial<Promotion>): Promotion | null {
  const promotions = getPromotions()
  const index = promotions.findIndex(p => p.id === id)
  
  if (index === -1) return null
  
  promotions[index] = { ...promotions[index], ...data }
  storageSet('bmb_promotions', promotions)
  return promotions[index]
}

// Delete promotion
export function deletePromotion(id: string): boolean {
  const promotions = getPromotions()
  const filtered = promotions.filter(p => p.id !== id)
  
  if (filtered.length === promotions.length) return false
  
  storageSet('bmb_promotions', filtered)
  return true
}