// ============================================
// Bite Me Baby — Tenant Selector (TEN-06)
// Popover/list for platform admins to view and switch between tenants.
// Security enforced by RLS + RPCs — this is UX only.
// ============================================

import { useState } from 'react'
import { listTenants } from '@/lib/adminTenantApi'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'

export function TenantSelector() {
  const [open, setOpen] = useState(false)
  const { activeTenantId, availableTenants, setAvailableTenants, setActiveTenant, isAdminScopePlatform } = useAdminTenantContextStore()

  async function loadTenants() {
    if (!isAdminScopePlatform && !activeTenantId) return // tenant admin with no context
    const tenants = await listTenants()
    setAvailableTenants(tenants)
    if (tenants.length > 0 && !activeTenantId) {
      // Default to first tenant if none selected
      setActiveTenant(tenants[0].id)
    }
  }

  function handleSelect(tenantId: string) {
    setActiveTenant(tenantId)
    setOpen(false)
  }

  if (!isAdminScopePlatform && !activeTenantId) return null

  const current = availableTenants.find(t => t.id === activeTenantId)

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); loadTenants() }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-brand-bg/60 hover:bg-brand-bg text-brand-muted hover:text-brand-primary"
        aria-label="Select tenant"
      >
        <span>🏢</span>
        <span className="hidden sm:inline">{current ? current.name : 'Select Tenant'}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 w-72 bg-brand-surface border border-brand-border shadow-xl rounded-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-brand-border">
              <h3 className="text-sm font-bold text-brand-text">Tenants</h3>
            </div>
            <ul className="py-1">
              {availableTenants.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => handleSelect(t.id)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      t.id === activeTenantId
                        ? 'bg-brand-primary/10 text-brand-primary font-semibold'
                        : 'hover:bg-brand-bg text-brand-text'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{t.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        t.status === 'active' ? 'bg-green-100 text-green-700' :
                        t.status === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <span className="text-xs text-brand-muted">{t.slug} · {t.id}</span>
                  </button>
                </li>
              ))}
              {availableTenants.length === 0 && (
                <li className="px-4 py-3 text-sm text-brand-muted">No tenants available.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
