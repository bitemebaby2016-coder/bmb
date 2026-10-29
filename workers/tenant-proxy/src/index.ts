// ============================================
// Bite Me Baby — tenant-proxy Worker (Task 2 · Custom Domain Routing)
// ============================================
// Cloudflare Worker = reverse proxy บางเบา: ทุก request จากโดเมนลูกค้า
//   1) normalize host →  lookup tenants.custom_domain ผ่าน Supabase REST
//      (service key = secret `SUPABASE_SERVICE_ROLE_KEY` ของ Worker — ไม่ใช่ key แอป)
//   2) fetch ต่อไปยัง PWA origin เดิม (ORIGIN) คง path/query/method/body ทุกอย่าง
//   3) แนบ X-BMB-Tenant-Id / X-BMB-Tenant-Domain ให้แอปฝั่งหน้าใช้ resolve ธีม
//      (src/lib/hostnameTenant.ts → BrandProvider/ธีมเดิม — ไม่มี logic ธีมซ้ำใน Worker)
// lookup ไม่เจอ = tenant = DEFAULT (ร้านหลัก) — ไม่ block, ไม่เดาเป็นร้านอื่น
// deploy: wrangler deploy จากโฟลเดอร์นี้ (Owner) · route = เพิ่ม custom domain ใน
//   Cloudflare dashboard ชี้เข้า worker นี้ (ขั้น Owner — บันทึกใน changelog)
// ============================================

export interface Env {
  ORIGIN: string
  DEFAULT_TENANT_ID: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

function normalizeHost(host: string): string {
  const h = (host || '').trim().toLowerCase().split(':')[0]
  return h.startsWith('www.') ? h.slice(4) : h
}

/** lookup tenant จาก custom_domain — null = ไม่รู้จัก (เรียก caller ใช้ default) */
async function lookupTenant(host: string, env: Env): Promise<string | null> {
  const h = normalizeHost(host)
  if (!h || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  try {
    const url = `${env.SUPABASE_URL}/rest/v1/tenants?select=id&custom_domain=eq.${encodeURIComponent(h)}&limit=1`
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!res.ok) return null // m175 ยังไม่ apply (42703/406) = ไม่เดา
    const rows = (await res.json()) as Array<{ id?: string }>
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url)
    const tenantId = (await lookupTenant(incoming.hostname, env)) || env.DEFAULT_TENANT_ID

    const target = new URL(request.url)
    const originUrl = new URL(env.ORIGIN)
    target.protocol = originUrl.protocol
    target.host = originUrl.host

    const headers = new Headers(request.headers)
    headers.set('X-BMB-Tenant-Id', tenantId)
    headers.set('X-BMB-Tenant-Domain', normalizeHost(incoming.hostname))
    headers.set('Host', originUrl.host)

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body
      // @ts-expect-error duplex จำเป็นสำหรับ streaming body บน Cloudflare runtime
      init.duplex = 'half'
    }

    try {
      const upstream = await fetch(target.toString(), init)
      const res = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      })
      res.headers.set('X-BMB-Tenant-Id', tenantId)
      return res
    } catch (e) {
      return new Response('ต้นทางไม่ตอบสนอง (origin unreachable) — ลองใหม่', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  },
}