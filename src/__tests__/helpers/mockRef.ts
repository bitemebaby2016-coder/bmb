// ============================================
// Shared reference so test files can reach the SAME in-memory Supabase mock
// instance that the mocked '@/lib/supabase' module returns.
// (vi.mock factories are hoisted — a separate module avoids init-order issues.)
// ============================================

export const mockRef: { current: any } = { current: null }

export function mockTables(): Record<string, any[]> {
  return mockRef.current?.__tables ?? {}
}