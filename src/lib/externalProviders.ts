// ============================================
// Bite Me Baby — External Delivery Providers Integration
// ============================================

export type ProviderType = 'grab_rider' | 'linemen_rider' | 'foodpanda_rider' | 'self_delivery' | 'custom'

/**
 * Live-API status of each delivery channel (Task: check Bite Drive own fleet vs
 * external Grab/LINE MAN/FoodPanda).
 *   live          — real API wired end-to-end
 *   sandbox       — sandbox credentials exist (env) but no live contract yet
 *   mockup_pending— UI/pricing mock only; awaiting API keys from the call center
 */
export const PROVIDER_API_STATUS: Record<
  string,
  { status: 'live' | 'sandbox' | 'mockup_pending'; label: string; note: string }
> = {
  grab: {
    status: 'sandbox',
    label: 'Grab Sandbox',
    note: 'Sandbox client id/secret exist in .env — live API still pending (awaiting keys from the call center)',
  },
  lineman: {
    status: 'sandbox',
    label: 'LINE MAN Sandbox',
    note: 'Sandbox API key exists — live API still pending (awaiting keys from the call center)',
  },
  foodpanda: {
    status: 'mockup_pending',
    label: 'FoodPanda (mockup)',
    note: 'Mock pricing only — no credentials yet',
  },
  self: {
    status: 'live',
    label: 'Bite Drive (own fleet)',
    note: 'The store own drivers — real routes via routeOptimization (temporary MOCK drivers)',
  },
}

export function getProviderApiStatus(providerId: string): { status: string; label: string; note: string } | null {
  return PROVIDER_API_STATUS[providerId] ?? null
}

export interface DeliveryProvider {
  id: string
  name: string
  type: ProviderType
  base_fee: number
  per_km_fee: number
  min_distance_km: number
  max_distance_km: number
  estimated_time_minutes: number
  is_active: boolean
  rating: number
  coverage_area: {
    center_latitude: number
    center_longitude: number
    radius_km: number
  }
}

export interface ProviderOrder {
  id: string
  provider_id: string
  order_number: string
  pickup_latitude: number
  pickup_longitude: number
  dropoff_latitude: number
  dropoff_longitude: number
  dropoff_detail: string
  items_count: number
  total_weight: number
  status: 'requested' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  estimated_delivery_time: number
  actual_delivery_time: number | null
  created_at: string
  updated_at: string
}

export const DEFAULT_PROVIDERS: DeliveryProvider[] = [
  {
    id: 'grab',
    name: 'Grab Rider',
    type: 'grab_rider',
    base_fee: 40,
    per_km_fee: 8,
    min_distance_km: 1,
    max_distance_km: 20,
    estimated_time_minutes: 30,
    is_active: true,
    rating: 4.5,
    coverage_area: {
      center_latitude: 10.7016,
      center_longitude: 102.1429,
      radius_km: 15
    }
  },
  {
    id: 'lineman',
    name: 'Lineman',
    type: 'linemen_rider',
    base_fee: 35,
    per_km_fee: 7,
    min_distance_km: 1,
    max_distance_km: 15,
    estimated_time_minutes: 25,
    is_active: true,
    rating: 4.3,
    coverage_area: {
      center_latitude: 10.7016,
      center_longitude: 102.1429,
      radius_km: 12
    }
  },
  {
    id: 'foodpanda',
    name: 'Foodpanda',
    type: 'foodpanda_rider',
    base_fee: 38,
    per_km_fee: 7.5,
    min_distance_km: 1,
    max_distance_km: 18,
    estimated_time_minutes: 28,
    is_active: true,
    rating: 4.4,
    coverage_area: {
      center_latitude: 10.7016,
      center_longitude: 102.1429,
      radius_km: 14
    }
  },
  {
    id: 'self',
    name: 'Bite Drive (Self-delivery)',
    type: 'self_delivery',
    base_fee: 30,
    per_km_fee: 4,
    min_distance_km: 0,
    max_distance_km: 5,
    estimated_time_minutes: 20,
    is_active: true,
    rating: 4.6,
    coverage_area: {
      center_latitude: 10.7016,
      center_longitude: 102.1429,
      radius_km: 5
    }
  }
]

export function calculateProviderCost(
  provider: DeliveryProvider,
  distanceKm: number,
  itemsCount: number
): number {
  if (distanceKm < provider.min_distance_km || distanceKm > provider.max_distance_km) {
    return -1
  }

  const baseCost = provider.base_fee
  const distanceCost = distanceKm * provider.per_km_fee
  const itemCost = itemsCount * 2

  return baseCost + distanceCost + itemCost
}

export function getBestProvider(
  order: {
    dropoff_latitude: number
    dropoff_longitude: number
    items_count: number
    estimated_weight: number
  },
  kitchenLat: number = 10.7016,
  kitchenLon: number = 102.1429,
  providers: DeliveryProvider[] = DEFAULT_PROVIDERS
): { provider: DeliveryProvider; cost: number; estimatedTime: number } | null {
  const distance = calculateDistanceSimple(kitchenLat, kitchenLon, order.dropoff_latitude, order.dropoff_longitude)

  const availableProviders = providers.filter((p: DeliveryProvider) => {
    if (!p.is_active) return false
    if (distance < p.min_distance_km || distance > p.max_distance_km) return false
    
    const coverageDistance = calculateDistanceSimple(
      p.coverage_area.center_latitude,
      p.coverage_area.center_longitude,
      order.dropoff_latitude,
      order.dropoff_longitude
    )
    return coverageDistance <= p.coverage_area.radius_km
  })

  if (availableProviders.length === 0) {
    return null
  }

  const providerCosts = availableProviders.map((provider: DeliveryProvider) => ({
    provider,
    cost: calculateProviderCost(provider, distance, order.items_count),
    estimatedTime: provider.estimated_time_minutes + Math.ceil(distance * 2)
  }))

  providerCosts.sort((a: any, b: any) => a.cost - b.cost)

  return providerCosts[0]
}

export async function requestProviderDelivery(
  providerId: string,
  order: Omit<ProviderOrder, 'id' | 'created_at' | 'updated_at'>
): Promise<ProviderOrder> {
  const providerOrder: ProviderOrder = {
    ...order,
    id: `prov-order-${Date.now()}`,
    status: 'accepted',
    estimated_delivery_time: 30 as number,
    actual_delivery_time: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const orders = storageGet<ProviderOrder[]>('bmb_provider_orders', [])
  orders.push(providerOrder)
  storageSet('bmb_provider_orders', orders)

  return providerOrder
}

export function updateProviderOrderStatus(orderId: string, status: ProviderOrder['status']): boolean {
  const orders = storageGet<ProviderOrder[]>('bmb_provider_orders', [])
  const index = orders.findIndex((o: ProviderOrder) => o.id === orderId)
  
  if (index === -1) return false
  
  orders[index].status = status
  orders[index].updated_at = new Date().toISOString()
  
  if (status === 'delivered') {
    orders[index].actual_delivery_time = new Date().toISOString() as unknown as number | null
  }
  
  storageSet('bmb_provider_orders', orders)
  return true
}

export function getProviderOrders(): ProviderOrder[] {
  return storageGet<ProviderOrder[]>('bmb_provider_orders', [])
}

function calculateDistanceSimple(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function storageGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem('bmb_' + key)
    if (raw === null) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem('bmb_' + key, JSON.stringify(value))
  } catch (e) {
    console.error('storageSet failed:', e)
  }
}