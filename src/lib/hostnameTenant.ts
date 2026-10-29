// ============================================
// Bite Me Baby — hostname → tenant resolver (Task 2 · Custom Domain / Theme CI)
// ============================================
// Worker (workers/tenant-proxy) ส่ง header `X-BMB-Tenant-Domain` มาให้ฝั่งนี้แปลงเป็น
// tenant_id แล้วส่งต่อให้ระบบธีมเดิม (BrandProvider / resolvedBrandStore) —
// **ไม่มี logic ธีม/แบรนด์ใหม่** ที่นี่มีแค่ "ชื่อโฮสต์ ↔ ร้าน" (pure) + query lookup
// กฎ:
//   * biteme-baby.com (+ www) = tenant-bmb-001 (DEFAULT — ทำงานแม้ m175 ยังไม่ apply)
//   * โดเมนอื่น = ตาราง tenants.custom_domain (migration 175 · ยังไม่ apply → null)
//   * query พัง/ยังไม่มีคอลัมน์ = null (ห้ามเดา · caller ใช้ default ต่อ)
// ============================================

import { supabase } from './supabase'

export const DEFAULT_TENANT_ID = 'tenant-bmb-001'
export const DEFAULT_HOSTS = ['biteme-baby.com', 'www.biteme-baby.com', 'localhost', '127.0.0.1']

/** normalize: lower + ตัด scheme (://) + ตัด port + ตัด www. หน้า — pure */
export function normalizeHostname(host: string | null | undefined): string {
  const raw = (host ?? '').trim().toLowerCase()
  if (!raw) return ''
  const noScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const noPort = noScheme.split(':')[0]
  return noPort.startsWith('www.') ? noPort.slice(4) : noPort
}

/**
 * resolve เฉพาะกรณีรู้ได้ทันที (pure) — host หลักของ BMB = default tenant
 * @returns tenant id หรือ null เมื่อต้อง lookup จาก DB
 */
export function canonicalHostTenant(host: string | null | undefined): string | null {
  const h = normalizeHostname(host)
  if (!h) return null
  if (h === 'biteme-baby.com' || h === 'localhost' || h === '127.0.0.1') return DEFAULT_TENANT_ID
  return null
}

/**
 * resolve เต็มรูปแบบ: pure ก่อน → ค่อย query tenants.custom_domain (m175)
 * @returns tenant id | null (null = ไม่รู้จัก/ยังไม่มีข้อมูล — ห้ามเดา)
 */
export async function resolveTenantByHostname(host: string | null | undefined): Promise<string | null> {
  const direct = canonicalHostTenant(host)
  if (direct) return direct
  const h = normalizeHostname(host)
  if (!h) return null
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('custom_domain', h)
      .limit(1)
      .maybeSingle()
    if (error) return null // m175 ยังไม่ apply / RLS — คืน null ไม่ใช่ default เดา
    return (data as { id?: string } | null)?.id ?? null
  } catch {
    return null
  }
}