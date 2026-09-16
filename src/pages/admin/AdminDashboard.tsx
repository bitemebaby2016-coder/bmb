import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardStats } from '@/lib/bmbAdminApi_users'

export function AdminDashboard() {
  const [stats, setStats] = useState({
    todayOrders: 0, todayRevenue: 0, pendingOrders: 0,
    completionRate: 0, lowStockItems: 0, totalOrders: 0,
    totalRevenue: 0, totalCustomers: 0
  })

  useEffect(() => {
    setStats(getDashboardStats())
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-brand-bg min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent mb-2">
          📊 แดชบอร์ดจัดการร้าน
        </h1>
        <p className="text-brand-muted text-lg">ภาพรวมธุรกิจ Bite Me Baby</p>
      </div>

      {/* Stats Cards - Premium Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">📦</div>
            <span className="text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">วันนี้</span>
          </div>
          <div className="text-3xl font-bold text-orange-700 mb-1">{stats.todayOrders}</div>
          <div className="text-sm text-orange-600 font-medium">ออเดอร์วันนี้</div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">💰</div>
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">วันนี้</span>
          </div>
          <div className="text-3xl font-bold text-green-700 mb-1">฿{stats.todayRevenue.toLocaleString()}</div>
          <div className="text-sm text-green-600 font-medium">รายได้วันนี้</div>
        </div>
        <div className="card bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-2xl">⏳</div>
            <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">รอดำเนินการ</span>
          </div>
          <div className="text-3xl font-bold text-yellow-700 mb-1">{stats.pendingOrders}</div>
          <div className="text-sm text-yellow-600 font-medium">รอดำเนินการ</div>
        </div>
        <div className="card bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-2xl">⚠️</div>
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">ต้องระวัง</span>
          </div>
          <div className="text-3xl font-bold text-red-700 mb-1">{stats.lowStockItems}</div>
          <div className="text-sm text-red-600 font-medium">วัตถุดิบใกล้หมด</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link to="/admin/orders" className="card text-center hover:scale-105 transition-all hover:shadow-xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="text-4xl mb-3">📋</div>
          <div className="font-bold text-brand-accent text-lg">จัดการออเดอร์</div>
          <div className="text-sm text-brand-muted mt-1">ดูและจัดการทุกออเดอร์</div>
        </Link>
        <Link to="/admin/products" className="card text-center hover:scale-105 transition-all hover:shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
          <div className="text-4xl mb-3">🍽️</div>
          <div className="font-bold text-brand-accent text-lg">จัดการเมนู</div>
          <div className="text-sm text-brand-muted mt-1">เพิ่ม/แก้ไขเมนูอาหาร</div>
        </Link>
        <Link to="/admin/inventory" className="card text-center hover:scale-105 transition-all hover:shadow-xl bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200">
          <div className="text-4xl mb-3">📦</div>
          <div className="font-bold text-brand-accent text-lg">สต็อกวัตถุดิบ</div>
          <div className="text-sm text-brand-muted mt-1">จัดการวัตถุดิบและสต็อก</div>
        </Link>
        <Link to="/promotions" className="card text-center hover:scale-105 transition-all hover:shadow-xl bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200">
          <div className="text-4xl mb-3">🎟️</div>
          <div className="font-bold text-brand-accent text-lg">โปรโมชั่น</div>
          <div className="text-sm text-brand-muted mt-1">สร้างและจัดการโปรโมชั่น</div>
        </Link>
        <Link to="/admin/delivery" className="card text-center hover:scale-105 transition-all hover:shadow-xl bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200">
          <div className="text-4xl mb-3">🛵</div>
          <div className="font-bold text-brand-accent text-lg">จัดจัดส่ง</div>
          <div className="text-sm text-brand-muted mt-1">Route optimization + ผู้ให้บริการ</div>
        </Link>
      </div>

      {/* Overview Summary - Premium Style */}
      <div className="card bg-gradient-to-br from-brand-bg-warm to-brand-bg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-brand-accent">📊 สรุปภาพรวม</h3>
          <span className="text-sm text-brand-muted">ข้อมูลทั้งหมด</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-6 bg-white rounded-xl border-2 border-brand-border-light hover:border-brand-primary transition-colors">
            <div className="text-4xl font-bold text-brand-primary mb-2">{stats.totalOrders}</div>
            <div className="text-sm text-brand-muted font-medium">ออเดอร์ทั้งหมด</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border-2 border-brand-border-light hover:border-brand-primary transition-colors">
            <div className="text-4xl font-bold text-brand-primary mb-2">฿{stats.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-brand-muted font-medium">รายได้ทั้งหมด</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border-2 border-brand-border-light hover:border-brand-primary transition-colors">
            <div className="text-4xl font-bold text-brand-primary mb-2">{stats.totalCustomers}</div>
            <div className="text-sm text-brand-muted font-medium">ลูกค้าทั้งหมด</div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl border-2 border-brand-border-light hover:border-brand-primary transition-colors">
            <div className="text-4xl font-bold text-brand-primary mb-2">{stats.completionRate}%</div>
            <div className="text-sm text-brand-muted font-medium">ส่งสำเร็จ</div>
          </div>
        </div>
      </div>
    </div>
  )
}