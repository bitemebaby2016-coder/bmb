// ============================================
// Bite Me Baby — Global error reporter (ADM-01, migration 021)
// Captures window errors/unhandled rejections and pushes them to the
// system_errors feed so admins see failures < 5 minutes without digging logs.
// ============================================

import { supabase } from './supabase'

const QUEUE: Array<{ message: string; source: string; level: string; details: Record<string, unknown> }> = []
let flushing = false
let lastFlush = 0
const FLUSH_INTERVAL_MS = 5000
const MAX_DETAIL_LENGTH = 1000

async function flush() {
  if (flushing || QUEUE.length === 0) return
  flushing = true
  const batch = QUEUE.splice(0, Math.min(QUEUE.length, 20))
  for (const item of batch) {
    try {
      await supabase.rpc('record_system_error', {
        p_message: item.message.slice(0, 1000),
        p_source: item.source,
        p_level: item.level,
        p_details: JSON.parse(JSON.stringify(item.details || {})),
      })
    } catch {
      // reporter must never break the app
    }
  }
  flushing = false
}

function scheduleFlush() {
  const now = Date.now()
  if (now - lastFlush >= FLUSH_INTERVAL_MS) {
    lastFlush = now
    void flush()
  } else {
    setTimeout(() => void flush(), FLUSH_INTERVAL_MS)
  }
}

export function reportError(message: string, details?: Record<string, unknown>): void {
  QUEUE.push({
    message: String(message).slice(0, MAX_DETAIL_LENGTH),
    source: 'client',
    level: 'error',
    details: details ?? {},
  })
  scheduleFlush()
}

export function installGlobalErrorReporter(): () => void {
  const onError = (event: ErrorEvent) => {
    reportError(event.message || String(event.error || 'unknown error'), { file: event.filename, line: event.lineno })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const msg = event.reason instanceof Error ? event.reason.message : String(event.reason)
    reportError(`UnhandledRejection: ${msg}`)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}