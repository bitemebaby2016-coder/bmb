// ============================================
// Bite Me Baby — Route Optimization Admin Page
// GAP CLOSURE P1-2: Create UI for routeOptimization.ts algorithms
// ============================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  assignOrdersToDrivers,
  getRouteSummary,
  type DeliveryOrder,
  type DeliveryDriver,
  type Route,
} from '@/lib/routeOptimization'

export function RouteOptimizationPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [kitchenLat] = useState(10.7016)
  const [kitchenLon] = useState(102.1429)
  const [isOptimizing, setIsOptimizing] = useState(false)

  const mockOrders: DeliveryOrder[] = [
    { id: '1', order_number: 'BMB-001', dropoff_latitude: 10.71, dropoff_longitude: 102.15, dropoff_detail: '123/45 Soi Sukhumvit', items_count: 2, estimated_weight: 1.5, priority: 'normal' },
    { id: '2', order_number: 'BMB-002', dropoff_latitude: 10.72, dropoff_longitude: 102.16, dropoff_detail: '456 Phaya Thai Rd', items_count: 3, estimated_weight: 2.0, priority: 'urgent' },
    { id: '3', order_number: 'BMB-003', dropoff_latitude: 10.70, dropoff_longitude: 102.13, dropoff_detail: '789 Rama Rd', items_count: 1, estimated_weight: 0.8, priority: 'normal' },
    { id: '4', order_number: 'BMB-004', dropoff_latitude: 10.73, dropoff_longitude: 102.17, dropoff_detail: '101 Soih Sukhumvit 21', items_count: 4, estimated_weight: 3.0, priority: 'vip' },
    { id: '5', order_number: 'BMB-005', dropoff_latitude: 10.69, dropoff_longitude: 102.14, dropoff_detail: '202 Ploenchit Rd', items_count: 2, estimated_weight: 1.2, priority: 'normal' },
  ]

  const mockDrivers: DeliveryDriver[] = [
    { id: 'driver-1', name: 'Somchai', current_latitude: kitchenLat, current_longitude: kitchenLon, current_orders: [], max_capacity: 10, current_load: 0, status: 'available' },
    { id: 'driver-2', name: 'Somying', current_latitude: kitchenLat + 0.01, current_longitude: kitchenLon - 0.01, current_orders: [], max_capacity: 8, current_load: 0, status: 'available' },
    { id: 'driver-3', name: 'Wichai', current_latitude: kitchenLat - 0.005, current_longitude: kitchenLon + 0.015, current_orders: [], max_capacity: 12, current_load: 0, status: 'busy' },
  ]

  async function handleOptimizeRoutes() {
    setIsOptimizing(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    const optimizedRoutes = assignOrdersToDrivers(mockOrders, mockDrivers, kitchenLat, kitchenLon)
    setRoutes(optimizedRoutes)
    setIsOptimizing(false)
  }

  const summary = getRouteSummary(routes)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">🗺️ Route Optimization</h1>
        <Link to="/admin" className="btn btn-outline">← Back to Dashboard</Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-brand-surface">
          <div className="text-sm text-brand-muted">Routes</div>
          <div className="text-3xl font-bold text-brand-primary">{summary.totalRoutes}</div>
        </div>
        <div className="card bg-brand-surface">
          <div className="text-sm text-brand-muted">Total Orders</div>
          <div className="text-3xl font-bold text-brand-primary">{summary.totalOrders}</div>
        </div>
        <div className="card bg-brand-surface">
          <div className="text-sm text-brand-muted">Total Distance</div>
          <div className="text-3xl font-bold text-brand-accent">{summary.totalDistance.toFixed(1)} km</div>
        </div>
        <div className="card bg-brand-surface">
          <div className="text-sm text-brand-muted">Est. Time</div>
          <div className="text-3xl font-bold text-brand-accent">{summary.estimatedTotalTime} min</div>
        </div>
      </div>

      {/* Optimize Button */}
      <div className="mb-6">
        <button onClick={handleOptimizeRoutes} disabled={isOptimizing || routes.length > 0} className="btn btn-primary text-lg py-3 px-8 disabled:opacity-50">
          {isOptimizing ? '⏳ Optimizing...' : routes.length > 0 ? '✅ Optimized' : '🚀 Optimize Routes'}
        </button>
      </div>
      {/* Routes Display */}
      {routes.length > 0 && (
        <div className="space-y-4">
          {routes.map((route) => {
            const driver = mockDrivers.find(d => d.id === route.driver_id)
            return (
              <div key={route.id} className="card border-2 border-brand-primary">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-lg">🛵</div>
                    <div>
                      <h3 className="font-bold text-lg text-brand-accent">{driver?.name || 'Unknown'}</h3>
                      <p className="text-sm text-brand-muted">Load: {route.total_weight}/{driver?.max_capacity || 0} kg</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-brand-primary">{route.total_distance.toFixed(1)} km</div>
                    <div className="text-sm text-brand-muted">{route.estimated_time} min</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {route.orders.map((order, idx) => (
                    <div key={order.id} className="flex items-center gap-3 p-3 bg-brand-bg rounded-lg">
                      <div className="w-8 h-8 bg-brand-secondary rounded-full flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.order_number}</span>
                          {order.priority === 'urgent' && <span className="badge badge-warning text-xs">Urgent</span>}
                          {order.priority === 'vip' && <span className="badge badge-info text-xs">VIP</span>}
                        </div>
                        <div className="text-sm text-brand-muted">{order.dropoff_detail}</div>
                      </div>
                      <div className="text-sm text-brand-muted">📦 {order.items_count} items • ⚖️ {order.estimated_weight} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drivers Status */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-brand-accent mb-4">Driver Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockDrivers.map((driver) => (
            <div key={driver.id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${driver.status === 'available' ? 'bg-green-500' : driver.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'}`}>{driver.name[0]}</div>
                <div>
                  <div className="font-bold">{driver.name}</div>
                  <div className={`text-sm ${driver.status === 'available' ? 'text-green-600' : driver.status === 'busy' ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {driver.status === 'available' ? 'Available' : driver.status === 'busy' ? 'On Delivery' : 'Offline'}
                  </div>
                </div>
              </div>
              <div className="text-sm text-brand-muted">Capacity: {driver.current_load}/{driver.max_capacity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone Info */}
      <div className="mt-8 card bg-blue-50 border-2 border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">📍 Delivery Zone Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div><strong>Kitchen:</strong> 10.7016, 102.1429 (Chanthaburi)</div>
          <div><strong>Max Radius:</strong> 5 km</div>
          <div><strong>Distance Formula:</strong> Haversine</div>
          <div><strong>Algorithm:</strong> Nearest Neighbor</div>
        </div>
      </div>

      {!routes.length && !isOptimizing && (
        <div className="text-center py-16 text-brand-muted">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">No routes yet</h3>
          <p>Click "Optimize Routes" to calculate the best delivery routes for drivers</p>
        </div>
      )}
    </div>
  )
}