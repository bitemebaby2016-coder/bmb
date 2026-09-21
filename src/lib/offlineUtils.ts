// ============================================
// Bite Me Baby — Offline / retry utilities (PWA-02)
// ============================================

/** Retry an async operation with exponential backoff (used by checkout/load flows). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; onRetry?: (attempt: number, error: unknown) => void } = {},
): Promise<T> {
  const retries = options.retries ?? 2
  const base = options.baseDelayMs ?? 800
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      attempt += 1
      if (attempt > retries) throw err
      options.onRetry?.(attempt, err)
      await new Promise((r) => setTimeout(r, base * Math.pow(2, attempt - 1)))
    }
  }
}

export interface OfflineState {
  online: boolean
  /** true when the last action hit a network failure and the UI offered retry. */
  needsRetry: boolean
  lastError: string | null
}

/** Minimal "did this request fail because we are offline?" heuristic. */
export function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /network|offline|fetch failed|Failed to fetch|ECONNREFUSED|timeout/i.test(msg)
}

export function createOfflineState(): OfflineState {
  return { online: typeof navigator === 'undefined' ? true : navigator.onLine, needsRetry: false, lastError: null }
}