// ============================================
// Bite Me Baby — AI Upstream Timeout (G5, STEP 4 / F2 fix)
// ============================================
// Bounded upstream wait for every OpenRouter/Groq call in ai-proxy.
// Failure is fail-safe: the request aborts, the caller receives an explicit
// error — no business mutation exists on this path (AI is read-only advice),
// so a timeout can never create or duplicate a business action.

export class TimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`upstream timeout after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) throw new TimeoutError(timeoutMs)
    throw err
  } finally {
    clearTimeout(timer)
  }
}
