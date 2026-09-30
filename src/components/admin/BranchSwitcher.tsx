// ============================================
// Bite Me Baby — Branch Switcher (TEN-07)
// Horizontal dropdown in AdminNav: quick-scope admin pages to one branch.
// Uses the existing AdminTenantContextStore + bmbAdminApi_branches.ts.
// ============================================

import { useState, useEffect } from 'react'
import { useAdminTenantContextStore } from '@/lib/adminTenantContext'
import { getBranchesForTenant } from '@/lib/bmbAdminApi_branches'

export function BranchSwitcher() {
  const { activeBranchId, availableBranches, setAvailableBranches, setActiveBranchId } = useAdminTenantContextStore()

  // Load branches on mount or when tenant changes
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getBranchesForTenant()
        if (!cancelled) setAvailableBranches(list)
      } catch (e) {
        console.error('[BranchSwitcher] Failed to load branches:', e)
      }
    })()
    return () => { cancelled = true }
  }, [setAvailableBranches])

  // If no branches loaded yet, show a loading state
  if (!availableBranches || availableBranches.length === 0) {
    return <div className="text-xs text-brand-muted px-2 py-1">⏳ กำลังโหลดสาขา...</div>
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-brand-muted hidden sm:inline">🏪</span>
      <select
        value={activeBranchId || ''}
        onChange={(e) => setActiveBranchId(e.target.value || null)}
        className="bg-transparent border border-brand-border rounded px-2 py-1 text-xs font-medium text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer min-w-[80px]"
        aria-label="เลือกสาขา"
      >
        <option value="">ทุกสาขา</option>
        {availableBranches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  )
}
