// ============================================
// BMB — R21 · เฟส 1 A1-A8 auth contracts
// A1 = probeProfileRole 3 สถานะ (ok+role / ok+null / error) — ห้ามรวมเป็น null เดียว
// A4 = logout ต้องล้าง store เสมอแม้ signOut() reject
// A5 = refreshRole error ต้อง "คง role เดิม" + ห้าม reject (จุดเรียกเป็น void)
// A2/A3/A6 = source contracts ของ AdminRoute/LoginPage (state.from · returnTo ก่อน · fast-path)
// NOTE: ไฟล์ต้องเป็น `.ts` (vitest include ไม่รับ .tsx)
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signOutMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      getUser: vi.fn(async () => ({ data: { user: null } })),
      setSession: vi.fn(async () => ({ data: { user: null }, error: null })),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
    from: vi.fn(),
    rpc: vi.fn(async () => ({ data: null, error: { message: 'no rpc' } })),
  },
  getCurrentUser: async () => null,
}))

vi.mock('@/lib/locationLogin', () => ({
  quickLoginByPhone: vi.fn(async () => ({ ok: false, error: 'ERR_TEST' })),
}))

import { useAuthStore, probeProfileRole, fetchProfileRole } from '@/store/authStore'

beforeEach(() => {
  signOutMock.mockReset()
  signOutMock.mockResolvedValue(undefined)
  useAuthStore.setState({
    customer: null, isAuthenticated: false, isLoading: false,
    loyaltyPoints: 0, referralCode: '', lastLoginError: null, role: null, isInitializing: false,
  })
})

describe('A1 — probeProfileRole 3 สถานะ (ok+บทบาท / ok+ไม่มีบทบาท / error)', () => {
  it('ไม่มี session → ok + role null (ไม่ใช่ error — กัน AdminRoute เตะคนออก)', async () => {
    expect(await probeProfileRole()).toEqual({ status: 'ok', role: null })
  })

  it('profiles อ่านได้ + มีบทบาท → ok + ชื่อบทบาทจริง (ไม่ map เป็น admin)', async () => {
    const { supabase } = await import('@/lib/supabase')
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: { user: { id: 'u-owner' } } },
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'owner' }, error: null }) }) }),
    })
    expect(await probeProfileRole()).toEqual({ status: 'ok', role: 'owner' })
  })

  it('profiles + rpc ล้มหมด (เน็ตหลุด) → status error ชัดเจน (ไม่ใช่ null เงียบ ๆ)', async () => {
    const { supabase } = await import('@/lib/supabase')
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: { user: { id: 'u1' } } },
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => { throw new Error('fetch failed') } }) }),
    })
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fetch failed'))
    expect((await probeProfileRole()).status).toBe('error')
  })

  it('fetchProfileRole wrapper คง API เดิม (error → null) — caller เก่าไม่พัง', async () => {
    expect(await fetchProfileRole()).toBe(null)
  })
})

describe('A4 — logout ต้องล้าง store เสมอ (แม้ signOut reject)', () => {
  it('signOut throw → isAuthenticated=false + role=null ทันที (ไม่ค้างล็อกอิน)', async () => {
    useAuthStore.setState({ isAuthenticated: true, role: 'owner', loyaltyPoints: 9 })
    signOutMock.mockRejectedValueOnce(new Error('network down'))
    await useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.isAuthenticated).toBe(false)
    expect(s.role).toBe(null)
    expect(s.loyaltyPoints).toBe(0)
  })
})

describe('A5 — refreshRole error ต้องคง role เดิม + ห้าม reject', () => {
  it('probe ล้มเหลว → คง role เก่าและ resolve ค่าเดิม (void caller ไม่สร้าง unhandled rejection)', async () => {
    useAuthStore.setState({ role: 'manager' })
    const { supabase } = await import('@/lib/supabase')
    ;(supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: { user: { id: 'u1' } } },
    })
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => { throw new Error('net down') } }) }),
    })
    ;(supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('net down'))
    expect(await useAuthStore.getState().refreshRole()).toBe('manager')
    expect(useAuthStore.getState().role).toBe('manager')
  })
})


// --- A2/A3/A6 source contracts (App.tsx / LoginPage / authStore ตัวจริง) ---
import appSrc from '@/App.tsx?raw'
import loginSrc from '@/pages/login/LoginPage.tsx?raw'
import storeSrc from '@/store/authStore.ts?raw'

describe('A2/A3/A6 — source contracts (AdminRoute + LoginPage + authStore)', () => {
  it('AdminRoute ส่ง state.from (A2) + probe error = banner ลองใหม่ ไม่เตะออก (A1) + เรียก probeProfileRole', () => {
    expect(appSrc).toContain('state={{ from: location.pathname + location.search }}')
    expect(appSrc).toContain('admin-route-role-error')
    expect(appSrc).toContain('probeProfileRole()')
  })

  it('AdminRoute fast-path จาก store role (A6) — ไม่บล็อกด้วย spinner เมื่อมี role แล้ว', () => {
    expect(appSrc).toContain('if (!probeDone && !role) return <LoadingSpinner />')
    expect(appSrc).toContain('const role = storeRole')
    expect(appSrc).toContain('setStoreRole(r)')
  })

  it('LoginPage: returnTo มาก่อนเสมอ (A3) — ห้ามบังคับ admin ไป /admin แล้วทิ้ง deep-link', () => {
    expect(loginSrc).toContain("navigate(returnTo || (role === 'admin' ? '/admin' : '/'), { replace: true })")
  })

  it('authStore: logout มี finally + login/loginByLocation ห้าม reject (A4/A5) + probe 3 สถานะ (A1/A7)', () => {
    expect(storeSrc).toContain('} finally {')
    expect(storeSrc).toContain("error: e instanceof Error ? e.message : 'ERR_QUICK_LOGIN_THREW'")
    expect(storeSrc).toContain("lastLoginError: e instanceof Error ? e.message : 'LOGIN_THREW'")
    expect(storeSrc).toContain("supabase.rpc('my_role')")
    expect(storeSrc).toContain('export type RoleProbe')
  })
})
