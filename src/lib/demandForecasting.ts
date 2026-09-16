// ============================================
// Bite Me Baby — Demand Forecasting System
// Predicts order volume for production planning
// ============================================

import { getOrders } from './bmbAdminApi_orders'

export interface DemandForecast {
  date: string
  dayOfWeek: string
  deliveryRound: 'morning' | 'midday' | 'evening'
  predictedOrders: number
  predictedRevenue: number
  confidence: number // 0-100
  recommendedPrep: number // recommended meal count
  peakHours: string[]
}

export interface HistoricalData {
  date: string
  dayOfWeek: string
  deliveryRound: string
  orderCount: number
  revenue: number
}

// Get historical order data
export async function getHistoricalData(days: number = 30): Promise<HistoricalData[]> {
  const orders = await getOrders()
  const historical: HistoricalData[] = []
  const today = new Date()

  // Group orders by date, day, and round
  const grouped: Record<string, { count: number; revenue: number }> = {}

  orders.forEach((order: any) => {
    const orderDate = new Date(order.created_at)
    const daysDiff = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff <= days) {
      const dateStr = orderDate.toISOString().slice(0, 10)
      const dayOfWeek = orderDate.toLocaleDateString('en-US', { weekday: 'long' })
      const round = order.delivery_round || 'evening'
      
      const key = `${dateStr}-${dayOfWeek}-${round}`
      
      if (!grouped[key]) {
        grouped[key] = { count: 0, revenue: 0 }
      }
      
      grouped[key].count++
      grouped[key].revenue += order.total_amount
    }
  })

  // Convert to array
  Object.entries(grouped).forEach(([key, data]) => {
    const [date, dayOfWeek, deliveryRound] = key.split('-')
    historical.push({
      date,
      dayOfWeek,
      deliveryRound: deliveryRound as 'morning' | 'midday' | 'evening',
      orderCount: data.count,
      revenue: data.revenue
    })
  })

  return historical.sort((a, b) => b.date.localeCompare(a.date))
}

// Calculate demand forecast
export async function calculateDemandForecast(
  date: string = new Date().toISOString().slice(0, 10),
  deliveryRound: 'morning' | 'midday' | 'evening' = 'evening'
): Promise<DemandForecast> {
  const historical = await getHistoricalData(30)
  const today = new Date(date)
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })

  // Get historical data for same day of week and round
  const similarData = historical.filter((h: HistoricalData) => 
    h.dayOfWeek === dayOfWeek && h.deliveryRound === deliveryRound
  )

  // Calculate average
  const avgOrders = similarData.length > 0 
    ? similarData.reduce((sum: number, h: HistoricalData) => sum + h.orderCount, 0) / similarData.length 
    : 10 // Default if no data
  
  const avgRevenue = similarData.length > 0 
    ? similarData.reduce((sum: number, h: HistoricalData) => sum + h.revenue, 0) / similarData.length 
    : 3000

  // Calculate confidence (based on data availability)
  const confidence = similarData.length > 5 
    ? Math.min(90, 50 + similarData.length * 5) 
    : 30

  // Predicted values with some variance
  const predictedOrders = Math.round(avgOrders * (0.9 + Math.random() * 0.2))
  const predictedRevenue = Math.round(avgRevenue * (0.9 + Math.random() * 0.2))

  // Recommended prep (10% buffer)
  const recommendedPrep = Math.round(predictedOrders * 1.1)

  // Peak hours (based on delivery round)
  const peakHours: string[] = []
  if (deliveryRound === 'morning') {
    peakHours.push('06:00-08:00')
  } else if (deliveryRound === 'midday') {
    peakHours.push('11:00-13:00')
  } else {
    peakHours.push('17:00-19:00')
  }

  return {
    date,
    dayOfWeek,
    deliveryRound,
    predictedOrders,
    predictedRevenue,
    confidence: Math.round(confidence),
    recommendedPrep,
    peakHours
  }
}

// Generate daily forecast report
export async function generateDailyForecast(date: string = new Date().toISOString().slice(0, 10)): Promise<DemandForecast[]> {
  const rounds: ('morning' | 'midday' | 'evening')[] = ['morning', 'midday', 'evening']
  
  const results = await Promise.all(rounds.map(round => calculateDemandForecast(date, round)))
  return results
}

// Get production recommendations
export async function getProductionRecommendations(date: string = new Date().toISOString().slice(0, 10)): Promise<{
  totalRecommended: number
  byCategory: Record<string, number>
  byRound: DemandForecast[]
  alerts: string[]
}> {
  const forecasts = await generateDailyForecast(date)
  const totalRecommended = forecasts.reduce((sum, f) => sum + f.recommendedPrep, 0)

  // Category distribution (simplified - in real app would analyze order history)
  const byCategory: Record<string, number> = {
    'dish': Math.round(totalRecommended * 0.35),
    'rice': Math.round(totalRecommended * 0.30),
    'curry': Math.round(totalRecommended * 0.20),
    'drink': Math.round(totalRecommended * 0.15),
    'dessert': Math.round(totalRecommended * 0.10)
  }

  // Generate alerts
  const alerts: string[] = []
  forecasts.forEach(f => {
    if (f.confidence < 50) {
      alerts.push(`⚠️ ความมั่นใจต่ำสำหรับ ${f.deliveryRound} (${f.confidence}%) - ควรเตรียมสำรอง`)
    }
    if (f.predictedOrders > 30) {
      alerts.push(`📈.example: ${f.deliveryRound} อาจมีออเดอรสง (${f.predictedOrders} ออเดอร) - เตรียมคนเพิ่ม`)
    }
  })

  return {
    totalRecommended,
    byCategory,
    byRound: forecasts,
    alerts
  }
}

// Calculate inventory requirements based on forecast
export async function calculateInventoryRequirements(
  forecast: DemandForecast,
  menuItems: Array<{ id: string; name: string; ingredients: string[] }>
): Promise<Record<string, number>> {
  // Simplified - in real app would map menu items to ingredients
  const requirements: Record<string, number> = {}
  
  const predictedOrders = forecast.predictedOrders
  const recommendedPrep = forecast.recommendedPrep

  // Assume each order uses ~2 ingredients on average
  const totalIngredientsNeeded = recommendedPrep * 2

  // Distribute across ingredients (simplified)
  const ingredientNames = ['ข้าว', 'กุ้ง', 'หม', 'ผัก', 'อส', 'เครื่องปรุง']
  ingredientNames.forEach(ing => {
    requirements[ing] = Math.round(totalIngredientsNeeded / ingredientNames.length)
  })

  return requirements
}