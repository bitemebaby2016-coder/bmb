// ============================================
// Bite Me Baby Admin API - Products & Categories
// ✅ v3.1: Using Supabase (replaces localStorage)
// ============================================

import { supabase } from './supabase'
import type { Product, ProductCategory, RoundPeriod, DeliveryRound } from '@/types'

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
  prep_minutes: number
  sort_order?: number
  delivery_round_id?: string
  scheduled_date?: string
}

// ============================================
// Products API — Supabase-backed
// ============================================

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('[getProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function getProductsAdmin(): Promise<Product[]> {
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
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).eq('is_preorder', false).order('sort_order', { ascending: true })
  if (error) { console.error('[getSameDayProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function getPreorderProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).eq('is_preorder', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getPreorderProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').eq('is_available', true).eq('is_featured', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getFeaturedProducts] Error:', error); return [] }
  return (data || []) as Product[]
}

export async function createProduct(data: ProductForm): Promise<Product | null> {
  const productData = {
    id: data.id || `prod-${Date.now()}`,
    name: data.name, description: data.description, price: data.price,
    category_id: data.category_id, image_url: data.image_url,
    is_available: data.is_available, is_featured: data.is_featured,
    is_preorder: data.is_preorder ?? false, prep_minutes: data.prep_minutes,
    sort_order: data.sort_order || 0, delivery_round_id: data.delivery_round_id,
    scheduled_date: data.scheduled_date,
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
  const { data, error } = await supabase.from('delivery_rounds').select('*').order('date').order('round_key', { ascending: true })
  if (error) { console.error('[getDeliveryRounds] Error:', error); return [] }
  return (data || []) as DeliveryRound[]
}

export async function getActiveDeliveryRounds(): Promise<DeliveryRound[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase.from('delivery_rounds').select('*').eq('date', today).eq('status', 'active').order('round_key', { ascending: true })
  if (error) { console.error('[getActiveDeliveryRounds] Error:', error); return [] }
  return (data || []) as DeliveryRound[]
}

export async function createDeliveryRound(data: DeliveryRoundForm): Promise<DeliveryRound | null> {
  const { data: result, error } = await supabase.from('delivery_rounds').insert({ id: data.id || `round-${Date.now()}`, round_key: data.round_key, display_name: data.display_name, cutoff_time: data.cutoff_time, delivery_start: data.delivery_start, delivery_end: data.delivery_end, max_capacity: data.max_capacity, date: data.date, status: 'active', current_count: 0 }).select().single()
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
  const { data, error } = await supabase.from('product_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true })
  if (error) { console.error('[getCategories] Error:', error); return [] }
  return (data || []) as ProductCategory[]
}

export async function getCategoriesAdmin(): Promise<ProductCategory[]> {
  const { data, error } = await supabase.from('product_categories').select('*').order('sort_order', { ascending: true })
  if (error) { console.error('[getCategoriesAdmin] Error:', error); return [] }
  return (data || []) as ProductCategory[]
}

export async function createCategory(data: { id?: string; name: string; slug: string; icon: string; sort_order: number; is_active: boolean }): Promise<ProductCategory | null> {
  const { data: result, error } = await supabase.from('product_categories').insert({ id: data.id || `cat-${Date.now()}`, name: data.name, slug: data.slug, icon: data.icon, sort_order: data.sort_order, is_active: data.is_active }).select().single()
  if (error) { console.error('[createCategory] Error:', error); return null }
  return result as ProductCategory
}

export async function updateCategory(id: string, data: Partial<{ name: string; icon: string; sort_order: number; is_active: boolean }>): Promise<ProductCategory | null> {
  const { data: result, error } = await supabase.from('product_categories').update(data).eq('id', id).select().single()
  if (error) { console.error('[updateCategory] Error:', error); return null }
  return result as ProductCategory
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase.from('product_categories').delete().eq('id', id)
  if (error) { console.error('[deleteCategory] Error:', error); return false }
  return true
}