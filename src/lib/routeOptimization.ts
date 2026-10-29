// ============================================
// Bite Me Baby — Advanced Route Optimization
// Optimizes delivery routes for Bite Drive
// ============================================

import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'
// R21e cosmetic (Owner "รวม haversine"): canonical = deliveryRouter.haversineDistanceKm
// (สูตรเดียวกันทุกตัวอักษร — เดิม copy ซ้ำ 3 ฉบับ) — deliveryRouter ไม่ import ไฟล์นี้ → ไม่มี cycle
import { haversineDistanceKm } from './deliveryRouter'

export interface DeliveryOrder {
  id: string
  order_number: string
  dropoff_latitude: number
  dropoff_longitude: number
  dropoff_detail: string
  items_count: number
  estimated_weight: number
  priority: 'normal' | 'urgent' | 'vip'
}

export interface DeliveryDriver {
  id: string
  name: string
  current_latitude: number
  current_longitude: number
  current_orders: string[]
  max_capacity: number
  current_load: number
  status: 'available' | 'busy' | 'offline'
}

export interface Route {
  id: string
  driver_id: string
  orders: DeliveryOrder[]
  total_distance: number
  estimated_time: number
  total_weight: number
  optimized: boolean
}

// R21e cosmetic: delegate ไป canonical haversine (deliveryRouter) — เดิมเป็นสูตร copy ซ้ำกัน
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2)
}

// Estimate delivery time
export function estimateDeliveryTime(distanceKm: number, ordersCount: number): number {
  return distanceKm * 2 + ordersCount * 5
}

// Calculate route distance (nearest neighbor algorithm)
export function calculateRouteDistance(orders: DeliveryOrder[], startLat: number, startLon: number): { totalDistance: number; route: DeliveryOrder[] } {
  const remainingOrders = [...orders]
  const route: DeliveryOrder[] = []
  let currentLat = startLat
  let currentLon = startLon
  let totalDistance = 0

  while (remainingOrders.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Infinity

    remainingOrders.forEach((order, index) => {
      const distance = calculateDistance(currentLat, currentLon, order.dropoff_latitude, order.dropoff_longitude)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    const nearestOrder = remainingOrders[nearestIndex]
    route.push(nearestOrder)
    totalDistance += nearestDistance
    currentLat = nearestOrder.dropoff_latitude
    currentLon = nearestOrder.dropoff_longitude
    remainingOrders.splice(nearestIndex, 1)
  }

  return { totalDistance, route }
}

// Assign orders to drivers (capacity-aware)
export function assignOrdersToDrivers(
  orders: DeliveryOrder[],
  drivers: DeliveryDriver[],
  kitchenLat: number,
  kitchenLon: number
): Route[] {
  const routes: Route[] = []
  const availableDrivers: DeliveryDriver[] = drivers.filter((d: DeliveryDriver) => d.status === 'available')

  const priorityOrder: Record<string, number> = { urgent: 0, vip: 1, normal: 2 }
  const sortedOrders: DeliveryOrder[] = [...orders].sort((a: DeliveryOrder, b: DeliveryOrder) => priorityOrder[a.priority] - priorityOrder[b.priority])

  sortedOrders.forEach((order: DeliveryOrder) => {
    // Find best driver (simplified - just assign to first available)
    const bestDriver = availableDrivers.find((d: DeliveryDriver) => d.current_load < d.max_capacity)
    
    if (bestDriver) {
      const driverId = bestDriver.id
      let route: Route | undefined = routes.find((r: Route) => r.driver_id === driverId)
      
      if (!route) {
        route = {
          id: `route-${driverId}-${Date.now()}`,
          driver_id: driverId,
          orders: [],
          total_distance: 0,
          estimated_time: 0,
          total_weight: 0,
          optimized: false
        }
        routes.push(route)
      }

      route.orders.push(order)
      bestDriver.current_orders.push(order.id)
      bestDriver.current_load += order.items_count
    }
  })

  routes.forEach((route: Route) => {
    const { totalDistance, route: optimizedRoute } = calculateRouteDistance(
      route.orders,
      kitchenLat,
      kitchenLon
    )
    
    route.orders = optimizedRoute
    route.total_distance = totalDistance
    route.estimated_time = estimateDeliveryTime(totalDistance, route.orders.length)
    route.total_weight = route.orders.reduce((sum: number, o: DeliveryOrder) => sum + o.estimated_weight, 0)
    route.optimized = true
  })

  return routes
}

// ============================================
// E2 (2026-10-22): REAL-data adapters — no demo rows ever
// ============================================
// The admin route tool reads live `orders` + `drivers` only. These pure mappers
// convert real rows into the optimizer's input shape and are unit-tested
// (routeRealData.test.ts). Fields the system does not really know (e.g. package
// weight) stay zero — inventing numbers is exactly what E2 forbids.

export function toRouteOrders(orders: ReadonlyArray<{
  id?: string | null
  order_number: string
  dropoff_latitude: number | null
  dropoff_longitude: number | null
  delivery_address?: string | null
  items?: Array<{ quantity?: number }> | null
}>): DeliveryOrder[] {
  return orders
    .filter((o) => o.dropoff_latitude != null && o.dropoff_longitude != null)
    .map((o) => ({
      id: o.id || o.order_number,
      order_number: o.order_number,
      dropoff_latitude: o.dropoff_latitude as number,
      dropoff_longitude: o.dropoff_longitude as number,
      dropoff_detail: o.delivery_address || '',
      items_count: Math.max(1, (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)),
      estimated_weight: 0, // ไม่มีข้อมูลน้ำหนักจริงในระบบ — ห้ามเดา (E2)
      priority: 'normal',
    }))
}

export function toRouteDrivers(drivers: ReadonlyArray<{
  id: string
  driver_name: string
  status: string
  max_capacity?: number | null
  current_latitude?: number | null
  current_longitude?: number | null
  active_assignments?: number | null
}>, fallback: { latitude: number; longitude: number }): DeliveryDriver[] {
  return drivers.map((d) => ({
    id: d.id,
    name: d.driver_name,
    current_latitude: d.current_latitude ?? fallback.latitude,
    current_longitude: d.current_longitude ?? fallback.longitude,
    current_orders: [],
    max_capacity: d.max_capacity && d.max_capacity > 0 ? d.max_capacity : 10, // 10 = ค่า default ของ schema
    current_load: d.active_assignments ?? 0,
    status: d.status === 'offline' ? 'offline' : d.status === 'busy' ? 'busy' : 'available',
  }))
}
/**
 * DEL-04 — ETA calibration: a delivery report is accurate if the model error
 * is within the closure tolerance (< 15 minutes per stop).
 */
export const ETA_ACCURACY_TOLERANCE_MIN = 15

export function etaAccuracyMinutes(estimatedMinutes: number, actualMinutes: number): number {
  return Math.abs(estimatedMinutes - actualMinutes)
}

export interface EtaReport {
  estimated: number
  actual: number
}

export function etaAccuracySummary(reports: EtaReport[]): {
  withinTolerance: boolean
  maxErrorMinutes: number
  meanErrorMinutes: number
  totalReports: number
} {
  if (reports.length === 0) return { withinTolerance: true, maxErrorMinutes: 0, meanErrorMinutes: 0, totalReports: 0 }
  const errors = reports.map((r) => etaAccuracyMinutes(r.estimated, r.actual))
  const max = Math.max(...errors)
  const mean = errors.reduce((s, e) => s + e, 0) / errors.length
  return {
    withinTolerance: max <= ETA_ACCURACY_TOLERANCE_MIN,
    maxErrorMinutes: max,
    meanErrorMinutes: Math.round(mean * 10) / 10,
    totalReports: reports.length,
  }
}

/**
 * DEL-04 — calibrated ETA: uses the observed historical minutes-per-km when
 * samples exist (falls back to the stock 2 min/km heuristic).
 */
export function calibratedEtaMinutes(
  distanceKm: number,
  ordersCount: number,
  minutesPerKmHistory?: number[],
): number {
  if (minutesPerKmHistory && minutesPerKmHistory.length > 0) {
    const base = minutesPerKmHistory.reduce((s, m) => s + m, 0) / minutesPerKmHistory.length
    return Math.round(distanceKm * base + ordersCount * 5)
  }
  return estimateDeliveryTime(distanceKm, ordersCount)
}

// Get route summary
export function getRouteSummary(routes: Route[]): {
  totalRoutes: number
  totalOrders: number
  totalDistance: number
  estimatedTotalTime: number
  averageOrdersPerRoute: number
} {
  const totalOrders = routes.reduce((sum: number, r: Route) => sum + r.orders.length, 0)
  const totalDistance = routes.reduce((sum: number, r: Route) => sum + r.total_distance, 0)
  const estimatedTotalTime = routes.reduce((sum: number, r: Route) => sum + r.estimated_time, 0)

  return {
    totalRoutes: routes.length,
    totalOrders,
    totalDistance,
    estimatedTotalTime,
    averageOrdersPerRoute: totalOrders / routes.length || 0
  }
}

// Calculate delivery cost
export function calculateDeliveryCost(distanceKm: number, ordersCount: number): number {
  const baseCost = 30
  const distanceCost = distanceKm * 5
  const orderCost = ordersCount * 2
  
  return baseCost + distanceCost + orderCost
}

// Check if delivery is within zone
export function isWithinDeliveryZone(
  lat: number,
  lon: number,
  kitchenLat: number = KITCHEN_LAT,
  kitchenLon: number = KITCHEN_LNG,
  maxDistanceKm: number = 5
): boolean {
  const distance = calculateDistance(lat, lon, kitchenLat, kitchenLon)
  return distance <= maxDistanceKm
}