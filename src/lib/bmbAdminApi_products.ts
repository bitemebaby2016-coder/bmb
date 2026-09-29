// ============================================
// Bite Me Baby Admin API - Products & Categories
// ✅ v3.1: Using Supabase (replaces localStorage)
// TEN-05: Catalog queries are tenant-scoped via brandContextStore
// ============================================

import { supabase } from './supabase'
import type { Product, ProductCategory, ProductAddon, RoundPeriod, DeliveryRound, MenuSection } from '@/types'
import { useBrandContextStore } from '@/store/resolvedBrandStore'


/** JSON shape stored in products.addons (no product_id inside the JSON array). */
export type AddonJson = Omit<ProductAddon, 'product_id'>

export interface ProductForm {
  id?: string
  name: string
  description: string
  price: number
  category_id: string
  image_url: string
  is_available: boolean
  is_featured: boolean
  is_preorder?: boolean
  available_same_day?: boolean
  available_preorder?: boolean
  prep_minutes: number
  sort_order?: number
  delivery_round_id?: string
  scheduled_date?: string
  addons?: AddonJson[]
}

// ============================================
// Products API — Supabase-backed + TEN-05 tenant-scoped
// ============================================

/** Get products with optional tenant filter (TEN-05: auto-scope from resolved brand context) */
export async function getProducts(tenantHint?: string): Promise<Product[]> {
  let query = supabase.from('products').select('*').order('sort_order', { ascending: true })
  
  // TEN-05: Auto-scope catalog to resolved brand's tenant if no hint provided
  if (!tenantHint) {
    const currentTenant = useBrandContextStore.getState().resolved?.tenant_id
    if (currentTenant && currentTenant !== 'tenant-bmb-001') {
      query = query.eq('tenant_id', currentTenant)
    }
  } else if (tenantHint !== 'all') {
    // Explicit admin/admin-side query with tenant scope
    query = query.eq('tenant_id', tenantHint)
  }
  
  const { data, error } = await query
  if (error) { console.error('[getProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function getProductsAdmin(): Promise<Product[]> {
  // Admin sees ALL products (admin operates globally within their tenant scope)
  const { data, error } = await supabase.from('products').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('[getProductsAdmin] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  if (error) { console.error('[getProduct] Error:', error); return null }
  return data as Product
}

export async function getSameDayProducts(): Promise<Product[]> {
  // Canonical mode column (migration 023). Fallback keeps legacy rows working:
  // a product without the column defaults to same-day-orderable (DB default true).
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getSameDayProducts] Error:', error); return [] }
  return ((data || []) as Product[]).filter((p) => p.available_same_day ?? !p.is_preorder)
}

export async function getPreorderProducts(): Promise<Product[]> {
  // Canonical mode column (migration 023). Fallback = deprecated alias mirror.
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getPreorderProducts] Error:', error); return [] }
  return ((data || []) as Product[]).filter((p) => p.available_preorder ?? p.is_preorder)
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).eq('is_featured', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getFeaturedProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function createProduct(data: ProductForm): Promise<Product | null> {
  const productData = {
    // Unique even for rapid consecutive creations (Date.now() alone can
    // collide within the same millisecond → duplicate TEXT PK error).
    id: data.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: data.name, description: data.description, price: data.price,
    category_id: data.category_id, image_url: data.image_url,
    is_available: data.is_available, is_featured: data.is_featured,
    is_preorder: data.is_preorder ?? false,
    available_same_day: data.available_same_day ?? true,
    available_preorder: data.available_preorder ?? data.is_preorder ?? false,
    prep_minutes: data.prep_minutes,
    sort_order: data.sort_order || 0, delivery_round_id: data.delivery_round_id,
    scheduled_date: data.scheduled_date,
    addons: Array.isArray(data.addons) ? data.addons : [],
  }
  const { data: result, error } = await supabase.from('products').insert(productData).select().single()
  if (error) { console.error('[createProduct] Error:', error); return null }
  return result as Product
}

export async function updateProduct(id: string, data: Partial<ProductForm>): Promise<Product | null> {
  const updateData: any = { ...data }
  const { data: result, error } = await supabase.from('products').update(updateData).eq('id', id).select().single()
  if (error) { console.error('[updateProduct] Error:', error); return null }
  return result as Product
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) { console.error('[deleteProduct] Error:', error); return false }
  return true
}

// ============================================
// Delivery Rounds API — Supabase-backed (v3.1+)
// ============================================

export interface DeliveryRoundForm {
  id?: string
  round_key: RoundPeriod
  display_name: string
  cutoff_time: string
  delivery_start: string
  delivery_end: string
  max_capacity: number
  date: string
}

export async function getDeliveryRounds(): Promise<DeliveryRound[]> {
  // DB columns: scheduled_date (not 'date'), name (not 'round_key')
  const { data, error } = await supabase.from('delivery_rounds').select('*').order('scheduled_date').order('name', { ascending: true })
  if (error) { console.error('[getDeliveryRounds] Error:', error); return [] }
  return (data || []) as DeliveryRound[]
}

export async function getActiveDeliveryRounds(): Promise<DeliveryRound[]> {
  const today = new Date().toISOString().split('T')[0]
  // DB columns: scheduled_date (not 'date'), name (not 'round_key')
  const { data, error } = await supabase.from('delivery_rounds').select('*').eq('scheduled_date', today).eq('status', 'active').order('name', { ascending: true })
  if (error) { console.error('[getActiveDeliveryRounds] Error:', error); return [] }
  return (data || []) as DeliveryRound[]
}

export async function createDeliveryRound(data: DeliveryRoundForm): Promise<DeliveryRound | null> {
  // DB columns: scheduled_date (not 'date'), name/round_key (not 'round_key')
  const { data: result, error } = await supabase.from('delivery_rounds').insert({ id: data.id || `round-${Date.now()}`, name: data.round_key, round_key: data.round_key, display_name: data.display_name, cutoff_time: data.cutoff_time, delivery_start: data.delivery_start, delivery_end: data.delivery_end, max_capacity: data.max_capacity, scheduled_date: data.date, date: data.date, status: 'active', current_count: 0 }).select().single()
  if (error) { console.error('[createDeliveryRound] Error:', error); return null }
  return result as DeliveryRound
}

export async function closeDeliveryRound(id: string): Promise<DeliveryRound | null> {
  const { data: result, error } = await supabase.from('delivery_rounds').update({ status: 'closed' }).eq('id', id).select().single()
  if (error) { console.error('[closeDeliveryRound] Error:', error); return null }
  return result as DeliveryRound
}

// ============================================
// Categories API — Supabase-backed
// ============================================

export interface CategoryForm {
  id?: string
  name: string
  slug: string
  icon: string
  sort_order: number
  is_active: boolean
}

export async function getCategories(): Promise<ProductCategory[]> {
  // TEN-05: Tenant-scope via resolved brand context
  const currentTenant = useBrandContextStore.getState().resolved?.tenant_id
  let query = supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true })
  if (currentTenant && currentTenant !== 'tenant-bmb-001') {
    query = query.eq('tenant_id', currentTenant)
  }
  const { data, error } = await query
  if (error) { console.error('[getCategories] Error:', error); return [] }
  return (data || []) as ProductCategory[]
}

export async function getCategoriesAdmin(): Promise<ProductCategory[]> {
  const { data, error } = await supabase.from('product_categories').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('[getCategoriesAdmin] Error:', error); return [] }
  return (data || []) as ProductCategory[]
}

export async function createCategory(data: { id?: string; name: string; slug: string; icon: string; sort_order: number; is_active: boolean; menu_section_id?: string | null }): Promise<ProductCategory | null> {
  const { data: result, error } = await supabase.from('product_categories').insert({ id: data.id || `cat-${Date.now()}`, name: data.name, slug: data.slug, icon: data.icon, sort_order: data.sort_order, is_active: data.is_active, menu_section_id: data.menu_section_id ?? null }).select().single()
  if (error) { console.error('[createCategory] Error:', error); return null }
  return result as ProductCategory
}

export async function updateCategory(id: string, data: Partial<{ name: string; icon: string; sort_order: number; is_active: boolean; menu_section_id: string | null }>): Promise<ProductCategory | null> {
  const { data: result, error } = await supabase.from('product_categories').update(data).eq('id', id).select().single()
  if (error) { console.error('[updateCategory] Error:', error); return null }
  return result as ProductCategory
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase.from('product_categories').delete().eq('id', id)
  if (error) { console.error('[deleteCategory] Error:', error); return false }
  return true
}

// ============================================
// Sections (migration 055 — CAT-01: Menu → Section → Category → Product)
// Tenant-owned catalog (TEN-D01=A) — section is a real catalog entity.
// ============================================

export interface SectionForm {
  id?: string
  name: string
  slug: string
  description?: string
  sort_order: number
  is_active: boolean
}

export async function getSections(): Promise<MenuSection[]> {
  // TEN-05: Tenant-scope via resolved brand context
  const currentTenant = useBrandContextStore.getState().resolved?.tenant_id
  let query = supabase.from('menu_sections').select('*').eq('is_active', true).order('sort_order', { ascending: true })
  if (currentTenant && currentTenant !== 'tenant-bmb-001') {
    query = query.eq('tenant_id', currentTenant)
  }
  const { data, error } = await query
  if (error) { console.error('[getSections] Error:', error); return [] }
  return (data || []) as MenuSection[]
}

export async function getSectionsAdmin(): Promise<MenuSection[]> {
  const { data, error } = await supabase.from('menu_sections').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('[getSectionsAdmin] Error:', error); return [] }
  return (data || []) as MenuSection[]
}

export async function createSection(data: SectionForm): Promise<MenuSection | null> {
  const { data: result, error } = await supabase.from('menu_sections').insert({
    id: data.id || `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: data.name, slug: data.slug, description: data.description ?? '',
    sort_order: data.sort_order, is_active: data.is_active,
  }).select().single()
  if (error) { console.error('[createSection] Error:', error); return null }
  return result as MenuSection
}

export async function updateSection(id: string, data: Partial<SectionForm>): Promise<MenuSection | null> {
  const { data: result, error } = await supabase.from('menu_sections').update(data).eq('id', id).select().single()
  if (error) { console.error('[updateSection] Error:', error); return null }
  return result as MenuSection
}

// Archive (CAT-D04=B): deactivate — NOT a hard delete.
export async function archiveSection(id: string): Promise<MenuSection | null> {
  return updateSection(id, { is_active: false })
}

export async function restoreSection(id: string): Promise<MenuSection | null> {
  return updateSection(id, { is_active: true })
}

// ============================================
// Soft archive (migration 055 — CAT-D04=B)
// archive = archived:true + is_available:false → RLS hides from customers,
// server gate (trg_catalog_visibility_gate) rejects new orders.
// restore = archived:false (availability stays OFF; admin re-enables explicitly).
// ============================================

export async function archiveProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').update({ archived: true, is_available: false }).eq('id', id).select().single()
  if (error) { console.error('[archiveProduct] Error:', error); return null }
  return data as Product
}

export async function restoreProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from('products').update({ archived: false }).eq('id', id).select().single()
  if (error) { console.error('[restoreProduct] Error:', error); return null }
  return data as Product
}

export async function archiveCategory(id: string): Promise<ProductCategory | null> {
  const { data, error } = await supabase.from('product_categories').update({ archived: true, is_active: false }).eq('id', id).select().single()
  if (error) { console.error('[archiveCategory] Error:', error); return null }
  return data as ProductCategory
}

export async function restoreCategory(id: string): Promise<ProductCategory | null> {
  const { data, error } = await supabase.from('product_categories').update({ archived: false }).eq('id', id).select().single()
  if (error) { console.error('[restoreCategory] Error:', error); return null }
  return data as ProductCategory
}
