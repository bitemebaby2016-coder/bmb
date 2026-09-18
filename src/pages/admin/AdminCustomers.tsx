// ============================================
// Admin — Customers (D13 gap, Phase D)
// ============================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getCustomersWithStats, type CustomerWithStats } from '@/lib/bmbAdminApi_customers'

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setCustomers(await getCustomersWithStats())
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-brand-accent">👥 Customers</h1>
        <Link to="/admin" className="btn btn-outline">← Dashboard</Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-surface">
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-right px-3 py-2">Orders</th>
              <th className="text-right px-3 py-2">Total spent</th>
              <th className="text-right px-3 py-2">Loyalty pts</th>
              <th className="text-right px-3 py-2">Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-brand-border">
                <td className="px-3 py-2 font-medium">{c.full_name}</td>
                <td className="px-3 py-2">{c.phone || '—'}</td>
                <td className="px-3 py-2 text-brand-muted">{c.email || '—'}</td>
                <td className="px-3 py-2 text-right">{c.order_count || 0}</td>
                <td className="px-3 py-2 text-right">฿{(c.order_total || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{c.loyalty_points || 0}</td>
                <td className="px-3 py-2 text-right text-brand-muted">
                  {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-12 text-brand-muted">No customers yet.</div>
      )}
    </div>
  )
}