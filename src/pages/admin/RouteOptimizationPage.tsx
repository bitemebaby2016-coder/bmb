// ============================================
// Bite Me Baby — Route Optimization Admin Page
// GAP CLOSURE P1-2: Create UI for routeOptimization.ts algorithms
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { KITCHEN_LAT, KITCHEN_LNG } from '@/config/kitchenLocation'
import {
  assignOrdersToDrivers,
  getRouteSummary,
  toRouteOrders,
  toRouteDrivers,
  type Route,
} from '@/lib/routeOptimization'
import { getOrdersByStatuses } from '@/lib/bmbAdminApi_orders'
import { adminListDrivers, type AdminDriverRow } from '@/lib/driverService'
import { supabase } from '@/lib/supabase'

// E2 (2026-10-22): หน้านี้อ่านข้อมูลจริงเท่านั้น — mock/demo data ของเดิม
// (ออเดอร์/ไรเดอร์จำลองในไฟล์นี้) ถูกลบทิ้งทั้งหมด ตามกติกาข้อ 5
// (ห้ามเหลือของปลอมในหน้าแอดมิน)
//   - ออเดอร์จริงของรอบส่ง (orders สถานะกำลังส่ง) + ไรเดอร์จริงที่ลงทะเบียน/ผูกบัญชี
//     แล้ว (drivers ผ่าน list_drivers RPC 037 — ตัวเดียวกับที่ DeliveryManagement ใช้)
//   - เครื่องมือวางเส้นทาง "อ่านอย่างเดียว" — การมอบหมายจริงอยู่ที่
//     DeliveryManagement (assign_driver RPC) เท่านั้น

const ACTIVE_DELIVERY_STATUSES = ['ready_for_dispatch', 'dispatched', 'in_transit', 'arrived']

export function RouteOptimizationPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [realOrders, setRealOrders] = useState<ReturnType<typeof toRouteOrders>>([])
  const [realDrivers, setRealDrivers] = useState<ReturnType<typeof toRouteDrivers>>([])
  const [driverRows, setDriverRows] = useState<AdminDriverRow[]>([])
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const kitchenLat = KITCHEN_LAT
  const kitchenLon = KITCHEN_LNG

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [orders, driverRes] = await Promise.all([
        getOrdersByStatuses(ACTIVE_DELIVERY_STATUSES),
        adminListDrivers(),
      ])
      setRealOrders(toRouteOrders(orders))
      setDriverRows(driverRes.drivers)
      setRealDrivers(toRouteDrivers(driverRes.drivers, { latitude: kitchenLat, longitude: kitchenLon }))
      const { data } = await supabase
        .from('branches')
        .select('service_radius_km')
        .eq('is_default', true)
        .maybeSingle()
      setRadiusKm(data?.service_radius_km != null ? Number(data.service_radius_km) : null)
    } catch (e) {
      setLoadError(String(e).slice(0, 120))
    } finally {
      setLoading(false)
    }
  }, [kitchenLat, kitchenLon])

  useEffect(() => { void load() }, [load])

  function handleOptimizeRoutes() {
    // วางแผนจากข้อมูลจริงเท่านั้น — สำเนา driver objects เพราะ optimizer
    // สะสม load ระหว่างคำนวณ (เครื่องมือนี้อ่านอย่างเดียว ไม่มอบหมายงานที่นี่)
    setRoutes(assignOrdersToDrivers(realOrders, realDrivers.map((d) => ({ ...d })), kitchenLat, kitchenLon))
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

      {/* Optimize — E2: วางแผนจากข้อมูลจริง (ออเดอร์/ไรเดอร์ที่โหลดมา ไม่มีของปลอม) */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={handleOptimizeRoutes}
          disabled={loading || realOrders.length === 0}
          className="btn btn-primary text-lg py-3 px-8 disabled:opacity-50"
          data-testid="optimize-routes"
        >
          🗺️ วางแผนเส้นทาง (ข้อมูลจริง)
        </button>
        <span className="text-sm text-brand-muted">
          ออเดอร์กำลังส่ง {realOrders.length} · ไรเดอร์ผูกบัญชี {driverRows.length}
        </span>
        <button onClick={() => void load()} className="btn btn-outline text-sm" disabled={loading}>รีเฟรช</button>
      </div>
      {loadError && <div className="mb-4 text-sm text-red-600">⚠ โหลดข้อมูลไม่สำเร็จ: {loadError}</div>}
      {/* Routes Display */}
      {routes.length > 0 && (
        <div className="space-y-4">
          {routes.map((route) => {
            const driver = realDrivers.find(d => d.id === route.driver_id)
            return (
              <div key={route.id} className="card border-2 border-brand-primary">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold text-lg">🛵</div>
                    <div>
                      <h3 className="font-bold text-lg text-brand-accent">{driver?.name || 'Unknown'}</h3>
                      <p className="text-sm text-brand-muted">งานที่ถือ: {route.orders.length} · โหลด {driver?.current_load ?? 0}/{driver?.max_capacity ?? '—'}</p>
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
                      <div className="text-sm text-brand-muted">📦 {order.items_count} ชิ้น</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drivers Status — E2: ไรเดอร์จริงจากตาราง drivers (list_drivers RPC 037) */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-brand-accent mb-4">Driver Status (ไรเดอร์จริง)</h2>
        {driverRows.length === 0 ? (
          <div className="card text-center py-8 text-brand-muted" data-testid="route-no-drivers">
            ยังไม่มีไรเดอร์ที่ลงทะเบียน/ผูกบัญชี — เพิ่มและผูกบัญชีได้ที่หน้า Delivery Management
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {driverRows.map((driver) => (
              <div key={driver.id} className="card" data-testid="route-driver-row">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${driver.status === 'available' ? 'bg-green-500' : driver.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'}`}>{(driver.driver_name || '?')[0]}</div>
                  <div>
                    <div className="font-bold">{driver.driver_name}</div>
                    <div className={`text-sm ${driver.status === 'available' ? 'text-green-600' : driver.status === 'busy' ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {driver.status === 'available' ? 'Available' : driver.status === 'busy' ? 'On Delivery' : driver.status}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-brand-muted">
                  งานที่ถืออยู่: {driver.active_assignments}/{driver.max_capacity ?? '—'}
                  {driver.last_active && <div>ออนไลน์ล่าสุด: {new Date(driver.last_active).toLocaleString()}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Zone Info */}
      <div className="mt-8 card bg-blue-50 border-2 border-blue-200">
        <h3 className="font-bold text-blue-900 mb-2">📍 Delivery Zone Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div><strong>Kitchen:</strong> {KITCHEN_LAT}, {KITCHEN_LNG} (Chanthaburi)</div>
          <div><strong>รัศมีบริการ:</strong> {radiusKm != null ? `${radiusKm} km (branches.service_radius_km)` : '— (ยังไม่ได้ตั้งค่า)'}</div>
          <div><strong>Distance Formula:</strong> Haversine</div>
          <div><strong>Algorithm:</strong> Nearest Neighbor</div>
        </div>
      </div>

      {!routes.length && !loading && (
        <div className="text-center py-16 text-brand-muted">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-brand-accent mb-2">ยังไม่มีแผนเส้นทาง</h3>
          <p>กด "วางแผนเส้นทาง (ข้อมูลจริง)" เพื่อคำนวณจากออเดอร์ที่กำลังส่งและไรเดอร์ที่ผูกบัญชีแล้ว</p>
        </div>
      )}
    </div>
  )
}