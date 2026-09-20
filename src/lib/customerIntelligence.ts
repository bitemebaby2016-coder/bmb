// ============================================
// Bite Me Baby — Customer Intelligence System
// Aggregates customer data for AI insights
// ============================================

import { storageGet, storageSet } from './bmbStorage'
import { getOrders } from './bmbAdminApi_orders'
import { getReviews } from './reviewApi'
import { getCustomerMemory } from './aiMemory'
import type { Review } from './reviewApi'

export interface CustomerMemory {
  customer_id: string
  name: string | null
  preferred_dietary: string[]
  favorite_categories: string[]
  order_frequency: string
  average_order_value: number
  last_order_date: string | null
  total_orders: number
  total_spent: number
  feedback: string[]
  referral_code?: string
  loyalty_points?: number
  created_at: string
  updated_at: string
}

export interface CustomerIntelligence {
  customer_id: string
  name: string | null
  total_orders: number
  total_spent: number
  average_order_value: number
  favorite_categories: string[]
  preferred_dietary: string[]
  order_frequency: string
  last_order_date: string | null
  average_rating_given: number
  review_count: number
  referral_count: number
  loyalty_points: number
  segments: string[]
  created_at: string
  updated_at: string
}

const INTELLIGENCE_PREFIX = 'bmb_customer_intelligence_'

// Calculate customer intelligence from raw data
export async function calculateCustomerIntelligence(customerId: string): Promise<CustomerIntelligence> {
  const orders = (await getOrders()).filter((o: any) => o.customer_id === customerId)
  const allReviews = storageGet<Review[]>('bmb_reviews', [])
  const reviews = allReviews.filter((r: Review) => r.customer_id === customerId)
  const memory = null as CustomerMemory | null

  const totalOrders = orders.length
  const totalSpent = orders.reduce((sum: number, o: any) => sum + o.total_amount, 0)
  const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0
  
  // Calculate favorite categories
  const categoryCounts: Record<string, number> = {}
  orders.forEach((order: any) => {
    order.items?.forEach((item: any) => {
      const catId = item.product_id?.substring(0, 4) || 'unknown'
      categoryCounts[catId] = (categoryCounts[catId] || 0) + 1
    })
  })
  
  const favoriteCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat)

  // Calculate average rating given
  const averageRatingGiven = reviews.length > 0 
    ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length 
    : 0

  // Determine order frequency
  let orderFrequency = 'unknown'
  if (totalOrders === 0) {
    orderFrequency = 'new_customer'
  } else if (totalOrders <= 3) {
    orderFrequency = 'occasional'
  } else if (totalOrders <= 10) {
    orderFrequency = 'regular'
  } else {
    orderFrequency = 'loyal'
  }

  // Determine segments
  const segments: string[] = []
  if (totalSpent > 1000) segments.push('high_value')
  if (orderFrequency === 'loyal') segments.push('loyal_customer')
  if (reviews.length > 0) segments.push('active_reviewer')
  if (memory?.referral_code) segments.push('referrer')
  if (averageRatingGiven >= 4) segments.push('satisfied')

  return {
    customer_id: customerId,
    name: memory?.name || null,
    total_orders: totalOrders,
    total_spent: totalSpent,
    average_order_value: averageOrderValue,
    favorite_categories: favoriteCategories,
    preferred_dietary: memory?.preferred_dietary || [],
    order_frequency: orderFrequency,
    last_order_date: memory?.last_order_date || null,
    average_rating_given: averageRatingGiven,
    review_count: reviews.length,
    referral_count: 0,
    loyalty_points: memory?.loyalty_points || 0,
    segments,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// Store customer intelligence
export function storeCustomerIntelligence(customerId: string, intelligence: CustomerIntelligence): void {
  storageSet(INTELLIGENCE_PREFIX + customerId, intelligence)
}

// Get customer intelligence
export function getCustomerIntelligence(customerId: string): CustomerIntelligence | null {
  return storageGet<CustomerIntelligence | null>(INTELLIGENCE_PREFIX + customerId, null)
}

// Get all customer intelligence (for admin)
export function getAllCustomerIntelligence(): CustomerIntelligence[] {
  const allIntelligence: CustomerIntelligence[] = []
  const keys = Object.keys(localStorage)
    .filter((k: string) => k.startsWith(INTELLIGENCE_PREFIX))
  
  keys.forEach((key: string) => {
    const data = storageGet<CustomerIntelligence | null>(key, null) as CustomerIntelligence | null
    if (data) {
      allIntelligence.push(data)
    }
  })
  
  return allIntelligence
}

// Generate customer insights for AI
export async function generateCustomerInsights(customerId: string): Promise<string> {
  const intelligence = await calculateCustomerIntelligence(customerId)
  const memory = null as CustomerMemory | null

  const insights: string[] = []
  
  if (intelligence.name) {
    insights.push(`ลกค้าชื่อ ${intelligence.name}`)
  }
  
  if (intelligence.total_orders > 0) {
    insights.push(`สั่ง ${intelligence.total_orders} ครั้ง รวม ${intelligence.total_spent.toFixed(0)} บาท`)
    insights.push(`ค่าเลี่ยต่อออเดอร: ${intelligence.average_order_value.toFixed(0)} บาท`)
  }
  
  insights.push(`ความถี่การสั่ง: ${intelligence.order_frequency}`)
  
  if (intelligence.favorite_categories.length > 0) {
    insights.push(`หมวดหม่ที่ชอบ: ${intelligence.favorite_categories.join(', ')}`)
  }
  
  if (intelligence.preferred_dietary.length > 0) {
    insights.push(`ชอบอาหาร: ${intelligence.preferred_dietary.join(', ')}`)
  }
  
  if (intelligence.review_count > 0) {
    insights.push(`ให้รีวิว ${intelligence.review_count} ครั้ง (avg ${intelligence.average_rating_given.toFixed(1)} ดาว)`)
  }
  
  if (intelligence.segments.length > 0) {
    insights.push(`กลุ่มลกค้า: ${intelligence.segments.join(', ')}`)
  }
  
  insights.push(`แต้มสะสม: ${intelligence.loyalty_points} แต้ม`)
  
  return insights.join(' | ')
}

// Get recommendations based on customer intelligence
export async function getCustomerRecommendations(customerId: string): Promise<string[]> {
  const intelligence = await calculateCustomerIntelligence(customerId)
  const recommendations: string[] = []
  
  if (intelligence.order_frequency === 'new_customer') {
    recommendations.push('WELCOME10 - ลด 10% สำหรับลกค้าใหม่')
  }
  
  if (intelligence.order_frequency === 'regular' || intelligence.order_frequency === 'loyal') {
    recommendations.push(' loyalty_points - แลกแต้มกับรางวัล')
  }
  
  if (intelligence.segments.includes('high_value')) {
    recommendations.push('VIP - ข้อเสนอพิเศษสำหรับลกค้าระดับ VIP')
  }
  
  if (intelligence.favorite_categories.length > 0) {
    recommendations.push(`เมนแนะนำตามหมวดหม่ที่ชอบ: ${intelligence.favorite_categories.join(', ')}`)
  }
  
  return recommendations
}