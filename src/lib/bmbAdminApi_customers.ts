// ============================================
// Bite Me Baby Admin API — Customers (D13 gap)
// Phase D: customers list + per-customer order stats (admin RLS).
// ============================================

import { supabase } from './supabase'

export interface CustomerRow {
  id: string
  user_id?: string
  full_name: string
  phone?: string
  email?: string
  address?: string
  loyalty_points: number
  created_at?: string
}

export interface CustomerWithStats extends CustomerRow {
  order_count: number
  order_total: number
  last_order_at?: string
}

export async function getCustomersAdmin(): Promise<CustomerRow[]> {
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
  if (error) { console.error('[getCustomersAdmin] Error:', error); return [] }
  return (data || []) as CustomerRow[]
}

/** Enrich customers with aggregate order stats (join-free: 2 queries). */
export async function getCustomersWithStats(): Promise<CustomerWithStats[]> {
  const customers = await getCustomersAdmin()
  if (customers.length === 0) return []

  const { data: orders, error } = await supabase
    .from('orders')
    .select('customer_id,customer_name,total_amount,created_at,status')
    .order('created_at', { ascending: true })
  if (error) { console.error('[getCustomersWithStats] orders error:', error); return customers.map(c => ({ ...c, order_count: 0, order_total: 0 })) }

  const byCustomer: Record<string, { count: number; total: number; last?: string }> = {}
  for (const o of (orders || []) as any[]) {
    const key = o.customer_id || ''
    if (!key) continue
    const acc = (byCustomer[key] ||= { count: 0, total: 0, last: undefined })
    acc.count += 1
    acc.total += Number(o.total_amount || 0)
    if (!acc.last || o.created_at > acc.last) acc.last = o.created_at
  }

  return customers.map(c => {
    const s = (byCustomer[c.id] ||= { count: 0, total: 0, last: undefined })
    return { ...c, order_count: s.count, order_total: s.total, last_order_at: s.last }
  })
}