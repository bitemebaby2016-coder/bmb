// ============================================
// Bite Me Baby — Delivery Management Page
// GAP CLOSURE GROUP 2: Route Optimization integration
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getOrders } from '@/lib/bmbAdminApi_orders'
import type { OrderForm } from '@/lib/bmbAdminApi_orders'
import {
  assignOrdersToDrivers,
  calculateRouteDistance,
  getRouteSummary,
  type DeliveryDriver,
  type DeliveryOrder,
  type Route,
} from '@/lib/routeOptimization'
import { updateProviderOrderStatus, getProviderOrders, type ProviderOrder, DEFAULT_PROVIDERS, getProviderApiStatus } from '@/lib/externalProviders'
import { writeAuditLog } from '@/lib/auditLog'
import { showToast } from '@/components/ui/ToastContainer'
import { listDrivers } from '@/lib/bmbAdminApi_drivers'

// Map DB DriverRow to route optimization DeliveryDriver interface
function mapDriver(row: any): DeliveryDriver {
  return {
    id: row.id,
    name: row.driver_name,
    current_latitude: row.current_latitude ?? 10.7016,
    current_longitude: row.current_longitude ?? 102.1429,
    current_orders: [],
    max_capacity: row.max_capacity || 5,
    current_load: row.active_assignments || 0,
    status: row.status === 'on_delivery' ? 'busy' : row.status === 'available' ? 'available' : 'offline',
  }
}

export function DeliveryManagement() {
  const [orders, setOrders] = useState<OrderForm[]>([])
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [providerOrders, setProviderOrders] = useState<ProviderOrder[]>([])
  const [filterStatus, setFilterStatus] = useState('pending')
  const [isOptimizing, setIsOptimizing] = useState(false)

  useEffect(() => { void (async () => { await loadOrders(); await loadDrivers() })() }, [])

  async function loadOrders() {
    const allOrders = await getOrders()
    setOrders(allOrders)
    const provOrders = getProviderOrders()
    setProviderOrders(provOrders)
  }

  async function loadDrivers() {
    const res = await listDrivers()
    if (res.ok && res.drivers && res.drivers.length > 0) {
      setDrivers(res.drivers.map(mapDriver))
    } else {
      setDrivers([])
    }
  }

  // GAP CLOSURE: Optimize delivery routes
  async function handleOptimizeRoutes() {
    setIsOptimizing(true)
    
    // Get pending orders that need delivery
    const pendingOrders = orders.filter(o => 
      ['confirmed', 'preparing', 'ready_for_dispatch'].includes(o.status) && 
      o.delivery_method !== 'self_delivery'
    )

    // Convert to DeliveryOrder format
    const deliveryOrders: DeliveryOrder[] = pendingOrders.map(order => ({
      id: order.id || '',
      order_number: order.order_number,
      dropoff_latitude: order.dropoff_latitude || 10.7016,
      dropoff_longitude: order.dropoff_longitude || 102.1429,
      dropoff_detail: order.delivery_address || '',
      items_count: order.items?.length || 1,
      estimated_weight: (order.items?.length || 1) * 0.5,
      priority: order.total_amount > 500 ? 'vip' : 'normal',
    }))

    if (deliveryOrders.length === 0) {
      showToast('ไม่มีออเดอรที่ต้องจัดส่ง', 'info')
      setIsOptimizing(false)
      return
    }

    // Assign orders to drivers and optimize routes
    const optimizedRoutes = assignOrdersToDrivers(
      deliveryOrders,
      drivers,
      10.7016, // kitchen latitude
      102.1429 // kitchen longitude
    )

    setRoutes(optimizedRoutes)
    
    // Update driver status
    const updatedDrivers = drivers.map(driver => ({
      ...driver,
      status: (optimizedRoutes.some(r => r.driver_id === driver.id) ? 'busy' : 'available') as DeliveryDriver['status'],
    }))
    setDrivers(updatedDrivers)

    // Audit log
    const summary = getRouteSummary(optimizedRoutes)
    writeAuditLog({
      action: 'delivery_assigned',
      entity_type: 'delivery_route',
      entity_id: `route-${Date.now()}`,
      description: `Optimize${summary.totalOrders} ออเดอรเปน ${summary.totalRoutes}route (ระยะทาง ${summary.totalDistance.toFixed(1)} กม.)`,
      metadata: summary
    })

    showToast(`Optimizeสำเรจ! ${summary.totalRoutes}route, ${summary.totalOrders}ออเดอร`, 'success')
    setIsOptimizing(false)
  }

  // Update provider order status
  function handleProviderStatusUpdate(orderId: string, status: ProviderOrder['status']) {
    updateProviderOrderStatus(orderId, status)
    setProviderOrders(getProviderOrders())
    
    writeAuditLog({
      action: 'delivery_status_change',
      entity_type: 'provider_order',
      entity_id: orderId,
      description: `สถานะผ้จัดส่งเปลี่ยนเปน ${status} (${orderId})`,
      metadata: { status }
    })
    
    showToast(`อัปเดตสถานะสำเรจ: ${status}`, 'success')
  }

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus)
  const summary = getRouteSummary(routes)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🛵 จัดการจัดส่ง</h1>
        <Link to="/admin" className="btn btn-outline">← กลับแดชบอรด</Link>
      </div>

      {/* Route Optimization Summary */}
      <div className="card mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-accent text-xl">📍 สถานะroute optimization</h3>
          <button onClick={handleOptimizeRoutes} disabled={isOptimizing} className="btn btn-primary disabled:opacity-50">
            {isOptimizing ? ' กำลังOptimize...' : '🚀 optimizeroute'}
          </button>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{summary.totalRoutes}</div>
            <div className="text-sm text-brand-muted">routeทั้งหมด</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summary.totalOrders}</div>
            <div className="text-sm text-brand-muted">ออเดอรที่ต้องส่ง</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{summary.totalDistance.toFixed(1)} กม.</div>
            <div className="text-sm text-brand-muted">ระยะทางรวม</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{summary.estimatedTotalTime} นาที</div>
            <div className="text-sm text-brand-muted">เวลาประมา</div>
          </div>
        </div>
      </div>

      {/* Drivers Status */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">👨‍✈️ สถานะคนขับรถ</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <div key={driver.id} className={`p-4 rounded-lg border-2 ${
              driver.status === 'available' ? 'border-green-300 bg-green-50' :
              driver.status === 'busy' ? 'border-blue-300 bg-blue-50' :
              'border-gray-300 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold">{driver.name}</div>
                <span className={`badge ${
                  driver.status === 'available' ? 'badge-success' :
                  driver.status === 'busy' ? 'badge-primary' : 'badge-muted'
                }`}>
                  {driver.status === 'available' ? 'พร้อมรับ' : driver.status === 'busy' ? ' sedang ส่ง' : ' offline'}
                </span>
              </div>
              <div className="text-sm text-brand-muted">
                📦 หลด: {driver.current_load}/{driver.max_capacity}<br />
                🚚 ออเดอร: {driver.current_orders.length}
              </div>
            </div>
          ))}
        </div>
      </div>

{/* Delivery Channels — Bite Drive (own fleet) vs external providers (mockup/sandbox) */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4">🚚 ช่องจัดส่ง (Bite Drive vs ภายนอก)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DEFAULT_PROVIDERS.map((p) => {
            const info = getProviderApiStatus(p.id)
            const badgeColor =
              info?.status === 'live' ? 'badge-success' :
              info?.status === 'sandbox' ? 'badge-info' : 'badge-warning'
            const badgeLabel =
              info?.status === 'live' ? '✅ REAL' :
              info?.status === 'sandbox' ? '🧪 Sandbox' : '🔶 MOCKUP pending'
            return (
              <div key={p.id} className="p-4 rounded-lg border-2 border-brand-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold">{p.name}</div>
                  <span className={`badge ${badgeColor}`}>{badgeLabel}</span>
                </div>
                <div className="text-sm text-brand-muted">
                  {info?.note || '—'}<br />
                  base ฿{p.base_fee} • per-km ฿{p.per_km_fee} • max {p.max_distance_km} km
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Provider Orders */}
      {/* Optimized Routes */}
      {routes.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-bold text-brand-accent mb-4">🗺️routeที่ optimize แล้ว</h3>
          <div className="space-y-4">
            {routes.map((route) => {
              const driver = drivers.find(d => d.id === route.driver_id)
              return (
                <div key={route.id} className="p-4 bg-brand-bg rounded-lg border-2 border-brand-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-brand-accent">
                      🚚 {driver?.name || 'Unknown Driver'}
                    </div>
                    <div className="text-sm text-brand-muted">
                      {route.total_distance.toFixed(1)} กม. • {route.estimated_time} นาที
                    </div>
                  </div>
                  <div className="space-y-2">
                    {route.orders.map((order, index) => (
                      <div key={order.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                        <span className="font-medium">{order.order_number}</span>
                        <span className="text-brand-muted">→ {order.dropoff_detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Provider Orders */}
      <div className="card mb-6">
        <h3 className="font-bold text-brand-accent mb-4"> ออเดอรผ้ให้บริการ (${providerOrders.length})</h3>
        <div className="space-y-3">
          {providerOrders.length > 0 ? providerOrders.map((order) => (
            <div key={order.id} className="p-3 bg-brand-bg rounded-lg border border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-bold">#{order.order_number}</div>
                  <div className="text-sm text-brand-muted">{order.dropoff_detail}</div>
                </div>
                <span className={`badge ${
                  order.status === 'delivered' ? 'badge-success' :
                  order.status === 'in_transit' ? 'badge-info' :
                  order.status === 'accepted' ? 'badge-primary' : 'badge-warning'
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="flex gap-2">
                {order.status === 'requested' && (
                  <button onClick={() => handleProviderStatusUpdate(order.id, 'accepted')} className="btn btn-primary text-sm">✅ Accept</button>
                )}
                {order.status === 'accepted' && (
                  <button onClick={() => handleProviderStatusUpdate(order.id, 'picked_up')} className="btn btn-info text-sm">Pick Up</button>
                )}
                {order.status === 'picked_up' && (
                  <button onClick={() => handleProviderStatusUpdate(order.id, 'in_transit')} className="btn btn-info text-sm"> In Transit</button>
                )}
                {order.status === 'in_transit' && (
                  <button onClick={() => handleProviderStatusUpdate(order.id, 'delivered')} className="btn btn-success text-sm"> Delivered</button>
                )}
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-brand-muted">
              ไม่มีออเดอรผ้ให้บริการ
            </div>
          )}
        </div>
      </div>

      {/* Pending Orders Filter */}
      <div className="card">
        <h3 className="font-bold text-brand-accent mb-4"> ออเดอร ({filteredOrders.length})</h3>
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {['all', 'pending', 'confirmed', 'preparing', 'ready_for_dispatch'].map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${filterStatus === status ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-accent'}`}>
              {status === 'all' ? 'ทั้งหมด' : status}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredOrders.slice(0, 10).map((order) => (
            <div key={order.id} className="p-3 bg-brand-bg rounded border border-brand-border flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">{order.order_number}</div>
                <div className="text-xs text-brand-muted">{order.customer_name} • ฿{order.total_amount}</div>
              </div>
              <span className={`badge text-xs ${
                order.status === 'delivered' ? 'badge-success' : 'badge-primary'
              }`}>{order.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
