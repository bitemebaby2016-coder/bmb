// ============================================
// Bite Me Baby Admin API - Users & Dashboard
// P0-2 FIX (2026-09-18): localStorage user DB removed
//   Identity/password ตอนนี้อยู่กับ Supabase Auth (auth.users + profiles)
//   ไม่มี: bmb_users / bcrypt ใน browser / ADMIN_DEFAULT_HASH hardcode
// ============================================

import { supabase } from './supabase'
import { getOrdersAggregated, getOrdersSince } from './bmbAdminApi_orders'
import { getInventory } from './bmbAdminApi_inventory'
import type { Ingredient } from '@/types'

export interface User {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  role: 'customer' | 'admin' | null
  is_active: boolean | null
  created_at?: string | null
}

/**
 * อ่าน user profiles จาก Supabase (public_profiles view + profiles via RLS)
 * Password hash ไม่ถูก expose ให้ client อีกเลย
 */
export async function getUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('public_profiles').select('*')
  if (error) {
    console.error('[getUsers] Error:', error)
    return []
  }
  return (data || []) as User[]
}

/**
 * อ่าน full profile (รวม role) — เฉพาะ self/admin (RLS)
 */
export async function getUserProfile(id: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('[getUserProfile] Error:', error)
    return null
  }
  return data as User | null
}

// ============================================
// REMOVED in P0-2: createUser() / authenticateUser() / initializeAdmin()
//   — functions เดิมเขียน password_hash ลง localStorage ใน browser.
//   Login/Register ตอนนี้ไปผ่าน Supabase Auth (store/authStore.ts),
//   role มาจาก profiles (trigger on_auth_user_created, migration 006).
//   Admin คนแรก สร้างที่ Supabase Dashboard / RPC — ไม่ใน code.
// ============================================

export interface DashboardStats {
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  completionRate: number
  lowStockItems: number
  totalOrders: number
  totalRevenue: number
  totalCustomers: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // W4-E-1 (D1): aggregated reads replace the full-table getOrders() fetch —
  // totals via count-exact + column-limited batched sum; today's slice is a
  // small gte(created_at) query. Aggregation math is unchanged.
  const today = new Date().toISOString().slice(0, 10)
  const [agg, todays, inventory] = await Promise.all([
    getOrdersAggregated(),
    getOrdersSince({ sinceISO: `${today}T00:00:00.000Z`, columns: ['created_at', 'status', 'total_amount'] }),
    getInventory(),
  ])
  const users = await getUsers()

  const todayOrders = (todays as any[]).filter((o: any) => String(o.created_at).startsWith(today))
  const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0)
  const pendingOrders = todayOrders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed').length
  const deliveredOrders = todayOrders.filter((o: any) => o.status === 'delivered').length
  const completionRate = todayOrders.length > 0 ? Math.round((deliveredOrders / todayOrders.length) * 100) : 0
  const lowStockItems = inventory.filter((i: Ingredient) => i.status === 'low_stock' || i.status === 'out_of_stock').length

  return {
    todayOrders: todayOrders.length,
    todayRevenue,
    pendingOrders,
    completionRate,
    lowStockItems,
    totalOrders: agg.total,
    totalRevenue: agg.totalRevenue,
    totalCustomers: users.filter((u: User) => (u.role ?? 'customer') === 'customer').length
  }
}