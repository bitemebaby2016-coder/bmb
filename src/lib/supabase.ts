import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Supabase Client Configuration
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ivkdfognyiwjcmrhcnwz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// P0-1 FIX (2026-09-18): service-role key ถูกถอดออกจาก client bundle เรียบร้อย
// ---------------------------------------------------------------
// ก่อนหน้า: supabaseAdmin = createClient(url, VITE_SUPABASE_SERVICE_ROLE_KEY)
//   → Vite อ่าน VITE_* env ลง inline ใน bundle → key รั่วสู่ทุก user
// หลังจาก: client มีแค่ anon key; ทุก privileged operation ต้องย้ายไป
//          Edge Function / RPC (server-side, service_role เก็บ server เท่านั้น)
//          ดู SECURITY_REMEDIATION_PLAN.md P0-1
// ---------------------------------------------------------------

// Validate configuration
if (!supabaseUrl || supabaseUrl === 'https://your-project.supabase.co') {
  console.warn('[Supabase] ⚠️ VITE_SUPABASE_URL not configured. Using default.')
}
if (!supabaseAnonKey || supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.warn('[Supabase] ⚠️ VITE_SUPABASE_ANON_KEY not configured. API calls will fail.')
}

// Public client (for browser — uses RLS policies)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export default supabase

// ============================================
// Helper: Get current user from Supabase Auth
// ============================================
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

// ============================================
// Helper: Check if user is admin
// ============================================
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  // Check profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

// ============================================
// Helper: Realtime subscription helper
// ============================================
export function subscribeToTable(
  tableName: string,
  callback: (payload: any) => void,
  event: '*'|'INSERT'|'UPDATE'|'DELETE' = '*'
) {
  const channel = supabase
    .channel(`table-${tableName}`)
    .on(
      'postgres_changes',
      { event, schema: 'public', table: tableName },
      callback
    )
    .subscribe()

  return channel
}

export function unsubscribeFromChannel(channel: any) {
  supabase.removeChannel(channel)
}