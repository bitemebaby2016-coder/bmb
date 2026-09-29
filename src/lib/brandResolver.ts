

// ============================================
// Bite Me Baby — Brand Resolver (TEN-05: Customer/Public Routing Foundation)
// Pure server-side/public resolver: resolve by URL param, subdomain hint, or default.
// Returns canonical { tenant_id, brand_id, brand } tuple.
// All downstream consumers use this — never hardcode if/else per brand.
// ============================================

import { supabase } from './supabase'

export type ResolvedBrandResult = {
  /** Brand slug that led to resolution */
  slug: string
  /** Brand primary key */
  brand_id: string
  /** Tenant ID this brand belongs to */
  tenant_id: string
  /** Full brand row from DB (presentation fields) */
  brand: {
    id: string
    tenant_id: string
    name: string
    display_name: string
    tagline: string
    description: string
    logo_url_icon: string
    status: 'active' | 'inactive' | 'suspended'
    is_default: boolean
    is_published: boolean
    theme_tokens: Record<string, any>
    created_at: string
    updated_at: string
  } | null
  /** Fallback path: how we arrived at this brand */
  source: 'url-param' | 'tenant-default' | 'first-active' | 'fallback'
}

/** Resolve brand by slug — returns only active+published brands */
export async function resolveBrandBySlug(slug: string): Promise<ResolvedBrandResult | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug.trim())
    .eq('is_published', true)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  return {
    slug,
    brand_id: data.id,
    tenant_id: data.tenant_id!,
    brand: data as any,
    source: 'url-param'
  }
}

/** Resolve default brand for a given tenant */
export async function resolveDefaultBrand(tenantId: string): Promise<ResolvedBrandResult | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .eq('is_published', true)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  return {
    slug: data.slug,
    brand_id: data.id,
    tenant_id: data.tenant_id!,
    brand: data as any,
    source: 'tenant-default'
  }
}

/** Resolve fallback: first active published brand for a tenant */
export async function resolveFirstActiveBrand(tenantId: string): Promise<ResolvedBrandResult | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_published', true)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    slug: data.slug,
    brand_id: data.id,
    tenant_id: data.tenant_id!,
    brand: data as any,
    source: 'first-active'
  }
}

/**
 * Universal brand resolver — input varies, output always consistent.
 * Resolution chain:
 * 1. ?brand=<slug> → direct lookup
 * 2. Default brand for resolved tenant → via tenants.default_brand_id
 * 3. First active brand for tenant → fallback
 * 4. Global fallback → first active brand across all tenants
 */
export interface UrlParamContext {
  brandSlug?: string
}

export interface ResolveOptions {
  urlParams?: UrlParamContext
  /** Optional explicit tenant_hint (NOT trusted — only used for fallback ordering) */
  tenantHint?: string
}

export async function resolveBrand(opts: ResolveOptions): Promise<ResolvedBrandResult> {
  const urlParams = opts?.urlParams; const tenantHint = opts?.tenantHint

  // 1. Direct URL param lookup
  if (opts.urlParams?.brandSlug && opts.urlParams.brandSlug.trim()) {
    const result = await resolveBrandBySlug(opts.urlParams!.brandSlug)
    if (result) return result
    // Invalid/inactive slug → fall through
    console.warn('[BrandResolver] Brand not found or not active:', opts.urlParams?.brandSlug)
  }

  // 2. Try tenant_hint's default brand
  if (tenantHint) {
    const result = await resolveDefaultBrand(tenantHint)
    if (result) return result
  }

  // 3. Try tenant_hint's first active brand
  if (tenantHint) {
    const result = await resolveFirstActiveBrand(tenantHint)
    if (result) return result
  }

  // 4. Global fallback — first active published brand (single-tenant BMB)
  const globalFallback = await resolveFirstActiveBrand('tenant-bmb-001')
  if (globalFallback) return globalFallback

  // 5. Ultimate fallback — cannot happen in normal operation
  // But if somehow no brands exist, return fallback marker
  console.error('[BrandResolver] No active brands found! Returning fallback.')
  return {
    slug: 'unknown',
    brand_id: '',
    tenant_id: 'tenant-bmb-001',
    brand: null,
    source: 'fallback'
  }
}

/** Quick validation — does this brand slug exist and is it accessible? */
export async function validateBrandAccessible(slug: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('brands')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug.trim())
    .eq('is_published', true)
    .eq('status', 'active')

  if (error) return false
  return (count ?? 0) > 0
}
