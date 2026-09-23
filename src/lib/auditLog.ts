// ============================================
// Bite Me Baby — Audit Log System
// Track all critical actions for security & compliance
// ============================================

import { storageGet, storageSet } from './bmbStorage'
import { supabase } from './supabase'

export type AuditAction = 
  | 'user_login'
  | 'user_register'
  | 'user_logout'
  | 'admin_dashboard_view'
  | 'order_create'
  | 'order_approve'
  | 'order_reject'
  | 'order_status_change'
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'inventory_update'
  | 'inventory_low_stock_alert'
  | 'profile_update'
  | 'settings_change'
  | 'data_export'
  | 'payment_processed'
  | 'payment_refund'
  | 'delivery_assigned'
  | 'delivery_status_change'

export interface AuditLogEntry {
  id: string
  timestamp: string
  user_id: string | 'system'
  user_email: string | null
  action: AuditAction
  entity_type: string // e.g., 'order', 'product', 'user'
  entity_id: string | null
  description: string
  metadata: Record<string, any> | null
  ip_address?: string | null
  user_agent?: string | null
}

const LOG_STORAGE_KEY = 'bmb_audit_logs'
const MAX_LOG_ENTRIES = 5000 // Keep last 5000 entries, prune oldest

/**
 * Write an audit log entry
 */
export function writeAuditLog(params: {
  action: AuditAction
  entity_type: string
  entity_id?: string | null
  description: string
  metadata?: Record<string, any> | null
}): void {
  try {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      user_id: 'system', // server will overwrite with real auth session UID
      user_email: null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      description: params.description,
      metadata: params.metadata || null,
      ip_address: null, // Will capture from backend in full version
      user_agent: navigator.userAgent
    }
    
    const logs = getAuditLogs()
    logs.unshift(entry) // Add to beginning for newest-first order
    
    // Prune old logs if exceeding max
    if (logs.length > MAX_LOG_ENTRIES) {
      storageSet(LOG_STORAGE_KEY, logs.slice(0, MAX_LOG_ENTRIES))
    } else {
      storageSet(LOG_STORAGE_KEY, logs)
    }
  } catch (error) {
    console.error('[BMB] Failed to write audit log:', error)
  }

  // SEC-03 (Phase 1): also persist server-side via RPC append_audit_log (fire-and-forget).
  void pushAuditLogServer({
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id || null,
    description: params.description,
    metadata: params.metadata || {},
    user_email: null, // email set server-side from auth session; client email is a hint only
  }).catch(() => {})
}

/**
 * SEC-03: persist an audit entry in the DB (audit_logs table, migration 018).
 * user_id is set server-side from the session (never trusted from the client).
 */
export async function pushAuditLogServer(params: {
  action: AuditAction
  entity_type: string
  entity_id?: string | null
  description: string
  metadata?: Record<string, any> | null
  user_email?: string | null
}): Promise<{ ok: boolean } | null> {
  try {
    const { data, error } = await supabase.rpc('append_audit_log', {
      p_action: params.action,
      p_entity_type: params.entity_type,
      p_entity_id: params.entity_id || null,
      p_description: params.description,
      p_metadata: params.metadata || {},
      p_user_email: params.user_email || null,
    })
    if (error) {
      console.warn('[BMB] Server audit push failed (offline/guest):', error.message)
      return null
    }
    return data as unknown as { ok: boolean }
  } catch (e) {
    console.warn('[BMB] Server audit push exception:', String(e).slice(0, 120))
    return null
  }
}

/**
 * SEC-03 upgrade: read user email from Supabase Auth session instead of
 * localStorage bmb_auth (which is stale after P0-2 migration).
 * The RPC append_audit_log sets user_id server-side; this email is only
 * a convenience hint for filtering/searching.
 * NOTE: Currently passes null because server sets real UID via auth context.
 */

/**
 * Get all audit logs (with optional filters)
 */
export function getAuditLogs(filters?: {
  action?: AuditAction
  entityType?: string
  userId?: string
  startDate?: string
  endDate?: string
  limit?: number
}): AuditLogEntry[] {
  let logs = getStoredLogs()
  
  if (filters) {
    if (filters.action) logs = logs.filter(l => l.action === filters.action)
    if (filters.entityType) logs = logs.filter(l => l.entity_type === filters.entityType)
    if (filters.userId) logs = logs.filter(l => l.user_id === filters.userId)
    if (filters.startDate) logs = logs.filter(l => l.timestamp >= filters.startDate!)
    if (filters.endDate) logs = logs.filter(l => l.timestamp <= filters.endDate!)
    if (filters.limit) logs = logs.slice(0, filters.limit)
  }
  
  return logs
}

/**
 * Get recent audit logs summary for dashboard
 */
export function getAuditSummary(): {
  totalEntries: number
  todayEntries: number
  topActions: Array<{ action: string; count: number }>
  suspiciousActivities: number
} {
  const logs = getStoredLogs()
  const today = new Date().toISOString().slice(0, 10)
  
  const todayLogs = logs.filter(l => l.timestamp.startsWith(today))
  
  const actionCounts: Record<string, number> = {}
  logs.forEach((log: AuditLogEntry) => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
  })
  
  const topActions = Object.entries(actionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }))
  
  // Suspicious: multiple failed logins or unusual patterns
  const suspiciousActivities = logs.filter((l: AuditLogEntry) => 
    l.description.toLowerCase().includes('failed') || 
    l.description.toLowerCase().includes('unauthorized')
  ).length
  
  return {
    totalEntries: logs.length,
    todayEntries: todayLogs.length,
    topActions,
    suspiciousActivities
  }
}

/**
 * Clear audit logs (admin only)
 */
export function clearAuditLogs(): boolean {
  try {
    storageSet(LOG_STORAGE_KEY, [])
    return true
  } catch {
    return false
  }
}

function getStoredLogs(): AuditLogEntry[] {
  return storageGet<AuditLogEntry[]>(LOG_STORAGE_KEY, [])
}