// ============================================
// Bite Me Baby Admin API — Media Library (D6 gap, Phase D)
// Phase D: uploads go to Storage bucket `bmb-images`, metadata rows to `media_assets`.
// Requires migration 011 storage policies + media_assets RLS (owner-applied) to work live.
// ============================================

import { supabase } from './supabase'

export interface MediaAssetRow {
  id: string
  url: string
  alt: string
  kind: 'image' | 'video' | 'logo' | 'hero' | 'mascot'
  created_by?: string | null
  created_at?: string
}

export const MEDIA_BUCKET = 'bmb-images'

export const MEDIA_KINDS: MediaAssetRow['kind'][] = ['image', 'video', 'logo', 'hero', 'mascot']

export async function listMediaAssets(): Promise<MediaAssetRow[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[listMediaAssets] Error:', error); return [] }
  return (data || []) as MediaAssetRow[]
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export async function uploadMediaAsset(
  file: File,
  kind: MediaAssetRow['kind'],
  alt = '',
): Promise<MediaAssetRow | null> {
  const path = `uploads/${Date.now()}-${sanitizeName(file.name)}`
  const { data: up, error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr || !up) { console.error('[uploadMediaAsset] storage error:', upErr); return null }

  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  const { data: user } = await supabase.auth.getUser()
  const callerTenant = await getCallerTenantId()
  const id = `media-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  // G2-RV Option 3: tenant_id required for non-global rows (scope CHECK, migration 107).
  // Authorization is re-validated server-side by RLS (is_tenant_admin_of) — client value is never trusted alone.
  const row = { id, url: urlData.publicUrl, alt, kind, created_by: user?.user?.id, tenant_id: callerTenant } as MediaAssetRow

  const { data, error } = await supabase.from('media_assets').insert(row).select().single()
  if (error) {
    console.error('[uploadMediaAsset] row insert error:', error)
    await supabase.storage.from(MEDIA_BUCKET).remove([path]) // rollback the stored file
    return null
  }
  return data as MediaAssetRow
}

export async function deleteMediaAsset(asset: MediaAssetRow): Promise<boolean> {
  let ok = true
  const path = extractPath(asset.url)
  if (path) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
    if (error) ok = false
  }
  const { error: rowErr } = await supabase.from('media_assets').delete().eq('id', asset.id)
  if (rowErr) ok = false
  return ok
}

function extractPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`
  const i = publicUrl.indexOf(marker)
  return i >= 0 ? decodeURIComponent(publicUrl.slice(i + marker.length)) : null
}

// ============================================
// CAT-03: canonical product image flow (contract §6)
// Storage bmb-images → media_assets metadata → products.image_url = public URL.
// No Base64 for NEW/REPLACED images. Client validates; server policies gate writes.
// ============================================

export const IMAGE_MIME_WHITELIST = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export interface ImageValidation {
  ok: boolean
  error?: string
}

export function validateImageFile(file: File): ImageValidation {
  if (!IMAGE_MIME_WHITELIST.includes(file.type)) {
    return { ok: false, error: `ERR_INVALID_MIME (${file.type || 'unknown'} — รองรับ JPEG/PNG/WebP/GIF)` }
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: `ERR_INVALID_SIZE (${(file.size / 1024 / 1024).toFixed(2)} MB — สูงสุด 5 MB)` }
  }
  return { ok: true }
}

export interface ProductImageResult {
  ok: boolean
  url?: string
  assetId?: string
  error?: string
}

/**
 * Upload a product image: validate → Storage → media_assets row → return
 * public URL for products.image_url. Attachment (updateProduct image_url) is
 * done by the caller so a failed product update leaves the asset reusable.
 */
export async function uploadProductImage(file: File, alt = ''): Promise<ProductImageResult> {
  const v = validateImageFile(file)
  if (!v.ok) return { ok: false, error: v.error }
  const row = await uploadMediaAsset(file, 'image', alt || file.name)
  if (!row) return { ok: false, error: 'ERR_UPLOAD_FAILED (ตรวจ storage policy / การล็อกอิน admin)' }
  return { ok: true, url: row.url, assetId: row.id }
}

// ============================================
// CAT-03A helpers — Base64 data-URL parsing (migration contract §7)
// ============================================

export interface ParsedBase64Image {
  mime: string
  ext: string
  bytes: Uint8Array
}

/** Parse a data:image/*;base64 URL — null if not an image data URL or malformed. */
export function parseBase64Image(url: string): ParsedBase64Image | null {
  const m = /^data:image\/([\w.+-]+);base64,(.+)$/.exec(url)
  if (!m) return null
  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
  return { mime: `image/${m[1]}`, ext: m[1], bytes }
}

/** RIFF....WEBP magic check (CAT-03A: all legacy product images are WebP). */
export function isValidWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
  return riff === 'RIFF' && webp === 'WEBP'
}

// ============================================
// G2-A: Asset Registry (migration 105 — Option A, additive columns on media_assets)
// Canonical chain: Admin Command Center -> registry row -> Storage object -> runtime
// ============================================

export const ASSET_CATEGORIES = [
  'product', 'brand', 'mascot', 'social', 'review', 'pwa', 'seo', 'payment', 'system',
] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export interface RegistryFields {
  asset_key?: string | null
  category?: string | null
  tenant_id?: string | null
  brand_id?: string | null
  is_active?: boolean
  is_mock?: boolean
  sort_order?: number
  version?: number
  updated_at?: string
  updated_by?: string | null
}

export type RegistryAssetRow = MediaAssetRow & RegistryFields

export interface UploadAssetOptions {
  assetKey?: string
  category?: AssetCategory
  tenantId?: string
  brandId?: string
  isMock?: boolean
  sortOrder?: number
}

/**
 * Derives the caller's tenant_id server-side (profiles row of the authenticated
 * admin; RLS-protected own read). media_assets scope constraints (migration 107)
 * require tenant_id for non-global rows — NULL is NOT global per G2-RV Option 3.
 */
export async function getCallerTenantId(): Promise<string | null> {
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user?.id) return null
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.user.id)
    .single()
  return (data?.tenant_id as string) ?? null
}

/**
 * Upload + register with optional registry fields. Backward compatible:
 * existing callers (uploadProductImage, AdminMedia generic upload) keep working.
 */
export async function uploadRegisteredAsset(
  file: File,
  kind: MediaAssetRow['kind'],
  alt: string,
  opts: UploadAssetOptions = {},
): Promise<RegistryAssetRow | null> {
  const v = validateImageFile(file)
  if (!v.ok) return null
  const { data: user } = await supabase.auth.getUser()
  const callerTenant = await getCallerTenantId()
  const path = `uploads/${Date.now()}-${sanitizeName(file.name)}`
  const { data: up, error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (upErr || !up) { console.error('[uploadRegisteredAsset] storage error:', upErr); return null }
  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  const id = `media-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const row = {
    id,
    url: urlData.publicUrl,
    alt,
    kind,
    created_by: user?.user?.id,
    asset_key: opts.assetKey ?? null,
    category: opts.category ?? null,
    tenant_id: opts.tenantId ?? callerTenant,
    brand_id: opts.brandId ?? null,
    is_active: true,
    is_mock: opts.isMock ?? false,
    sort_order: opts.sortOrder ?? 0,
    version: 1,
    updated_by: user?.user?.id,
  }
  const { data, error } = await supabase.from('media_assets').insert(row).select().single()
  if (error) {
    console.error('[uploadRegisteredAsset] insert error:', error)
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
    return null
  }
  return data as RegistryAssetRow
}

export async function listRegistryAssets(category?: AssetCategory): Promise<RegistryAssetRow[]> {
  let q = supabase.from('media_assets').select('*').order('sort_order', { ascending: true })
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) { console.error('[listRegistryAssets] error:', error); return [] }
  return (data || []) as RegistryAssetRow[]
}

/** Admin activate/deactivate (runtime fallback policy reads is_active). */
export async function setRegistryAssetActive(id: string, isActive: boolean): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('media_assets')
    .update({ is_active: isActive, updated_at: new Date().toISOString(), updated_by: user?.user?.id })
    .eq('id', id)
  return !error
}

/**
 * Runtime consumer lookup — canonical selection policy:
 *   1. active + NOT mock (production-approved) — lowest sort_order wins
 *   2. active + mock (explicit placeholder) — lowest sort_order wins
 *   3. null (consumer falls back to its own static default)
 * Stale/mock assets can never silently outrank an approved active asset (Test J).
 */
export function selectRuntimeAssetUrl(assets: RegistryAssetRow[]): string | null {
  const eligible = assets.filter((a) => a.is_active && a.url)
  const approved = eligible.filter((a) => !a.is_mock)
  if (approved.length > 0) {
    return approved.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].url
  }
  if (eligible.length > 0) {
    return eligible.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0].url
  }
  return null
}

/** Fetch + select in one call (runtime consumer helper). */
export async function getRuntimeAssetUrl(assetKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('asset_key', assetKey)
    .eq('is_active', true)
  if (error || !data || data.length === 0) return null
  return selectRuntimeAssetUrl(data as RegistryAssetRow[])
}