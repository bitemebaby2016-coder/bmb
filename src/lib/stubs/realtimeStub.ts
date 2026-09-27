/**
 * Bundle-size stub for @supabase/realtime-js.
 *
 * The app NEVER subscribes to realtime (the former subscribeToTable helper in
 * lib/supabase.ts was removed as dead code in W4-C). RealtimeClient + Phoenix (~100KB raw) were
 * shipped to every user for nothing. This stub implements the exact surface
 * SupabaseClient uses (setAuth/channel/getChannels/removeChannel/
 * removeAllChannels) as no-ops. If realtime is ever needed for real, remove
 * the alias in vite.config.ts.
 */
export class RealtimeClient {
  constructor(_url: string, _opts?: unknown) {}
  setAuth(): this { return this }
  getChannels(): unknown[] { return [] }
  removeAllChannels(): unknown[] { return [] }
  removeChannel(ch?: unknown): unknown {
    return ch && typeof ch === 'object' ? { ...(ch as object), state: 'closed' } : { state: 'closed' }
  }
  channel(_name?: string, _opts?: unknown): never {
    throw new Error('REALTIME_DISABLED: realtime is stubbed out of the bundle (see src/lib/stubs/realtimeStub.ts)')
  }
}
