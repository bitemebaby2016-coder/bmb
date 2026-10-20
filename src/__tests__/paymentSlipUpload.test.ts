// ============================================
// Bite Me Baby — Payment slip upload (mig 133) client contract tests
// ============================================
// Verifies the client↔server contract of the slip evidence flow against a
// hand-rolled supabase fake (the three helpers only touch auth/storage/rpc):
//   - uploadPaymentSlip stores the file under the CALLER'S OWN folder only
//   - unauthenticated upload is rejected (ERR_NOT_AUTHENTICATED)
//   - submitPaymentSlip records evidence via submit_payment_slip RPC (server is
//     the sole authority — client can never mark paid)
//   - getPaymentSlipSignedUrl surfaces signed URLs / null on failure

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'uid-123' } as { id: string } | null,
  uploadError: null as { message: string } | null,
  rpcError: null as { message: string } | null,
  signedUrl: 'https://signed.example/slip.jpg' as string | null,
  signedUrlError: null as { message: string } | null,
  uploadCalls: [] as Array<{ path: string; opts: Record<string, unknown> }>,
  rpcCalls: [] as Array<{ name: string; params: Record<string, unknown> }>,
  signedUrlCalls: [] as string[],
  uploadResultData: {} as Record<string, unknown>,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string, _file: unknown, opts: Record<string, unknown>) => {
          state.uploadCalls.push({ path, opts })
          return { data: state.uploadResultData, error: state.uploadError }
        },
        createSignedUrl: async (path: string) => {
          state.signedUrlCalls.push(path)
          return {
            data: state.signedUrlError ? null : { signedUrl: state.signedUrl },
            error: state.signedUrlError,
          }
        },
      }),
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      state.rpcCalls.push({ name, params })
      return { data: {}, error: state.rpcError }
    },
  },
}))

import { uploadPaymentSlip, submitPaymentSlip, getPaymentSlipSignedUrl } from '@/lib/paymentGateway'

function makeFile(name = 'slip.png', type = 'image/png', size = 1024): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => {
  state.user = { id: 'uid-123' }
  state.uploadError = null
  state.rpcError = null
  state.signedUrl = 'https://signed.example/slip.jpg'
  state.signedUrlError = null
  state.uploadCalls = []
  state.rpcCalls = []
  state.signedUrlCalls = []
})

describe('mig 133 — uploadPaymentSlip', () => {
  it('stores the slip under the caller own folder (<uid>/<order>-<ts>.<ext>)', async () => {
    const res = await uploadPaymentSlip('BMB-20261020-337', makeFile('สลิป.png', 'image/png'))
    expect(res.success).toBe(true)
    expect(res.path).toMatch(/^uid-123\/BMB-20261020-337-\d+\.png$/)
    expect(state.uploadCalls).toHaveLength(1)
    expect(state.uploadCalls[0].path).toBe(res.path)
    expect(state.uploadCalls[0].opts.contentType).toBe('image/png')
  })

  it('sanitizes exotic extensions to a safe suffix', async () => {
    // 'x.JpE;g!' → 'jpe;g!' → strip specials → 'jpeg' (safe suffix kept)
    const res = await uploadPaymentSlip('BMB-1', makeFile('x.JpE;g!', 'image/jpeg'))
    expect(res.success).toBe(true)
    expect(res.path).toMatch(/^uid-123\/BMB-1-\d+\.jpeg$/)
  })

  it('rejects unauthenticated uploads (ERR_NOT_AUTHENTICATED)', async () => {
    state.user = null
    const res = await uploadPaymentSlip('BMB-1', makeFile())
    expect(res.success).toBe(false)
    expect(res.error).toBe('ERR_NOT_AUTHENTICATED')
    expect(state.uploadCalls).toHaveLength(0)
  })

  it('surfaces storage errors instead of faking success', async () => {
    state.uploadError = { message: 'storage denied' }
    const res = await uploadPaymentSlip('BMB-1', makeFile())
    expect(res.success).toBe(false)
    expect(res.error).toBe('storage denied')
  })
})

describe('mig 133 — submitPaymentSlip (server-authoritative evidence)', () => {
  it('calls submit_payment_slip RPC with order number + slip path', async () => {
    const res = await submitPaymentSlip('BMB-1', 'uid-123/BMB-1-1.png')
    expect(res.success).toBe(true)
    expect(state.rpcCalls).toEqual([
      { name: 'submit_payment_slip', params: { p_order_number: 'BMB-1', p_slip_path: 'uid-123/BMB-1-1.png' } },
    ])
  })

  it('propagates RPC guards (ERR_SLIP_PATH_FORBIDDEN / ERR_NO_PENDING_PROMPTPAY)', async () => {
    state.rpcError = { message: 'ERR_SLIP_PATH_FORBIDDEN' }
    const res = await submitPaymentSlip('BMB-1', 'someone-else/x.png')
    expect(res.success).toBe(false)
    expect(res.error).toBe('ERR_SLIP_PATH_FORBIDDEN')
  })
})

describe('mig 133 — getPaymentSlipSignedUrl', () => {
  it('returns the signed URL for admin/owner preview', async () => {
    const url = await getPaymentSlipSignedUrl('uid-123/BMB-1-1.png')
    expect(url).toBe('https://signed.example/slip.jpg')
    expect(state.signedUrlCalls).toEqual(['uid-123/BMB-1-1.png'])
  })

  it('returns null when the bucket refuses (no leak, no throw)', async () => {
    state.signedUrlError = { message: 'not allowed' }
    const url = await getPaymentSlipSignedUrl('uid-123/BMB-1-1.png')
    expect(url).toBeNull()
  })
})