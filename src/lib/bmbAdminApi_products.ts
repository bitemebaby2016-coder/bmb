// ============================================
// Bite Me Baby Admin API - Products & Categories
// ============================================

import { storageGet, storageSet, generateId } from './bmbStorage'
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
  is_preorder?: boolean           // ✅ v3.1: Pre-order menu
  prep_minutes: number
  sort_order?: number
  delivery_round_id?: string      // ✅ v3.1: Delivery round ID
  scheduled_date?: string         // ✅ v3.1: Scheduled delivery date
}

export function getProducts(): Product[] {
  return storageGet<Product[]>('bmb_products', [
    // ✅ Same-day products (ขายวันนี้)
    { id: 'prod-1', name: 'ผัดไทยกุ้งสด', description: 'ผัดไทยกุ้งสดสดใหม่', price: 65, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 15, sort_order: 1, created_at: new Date().toISOString() },
    { id: 'prod-2', name: 'ข้าวหมูทอดกระเทียม', description: 'ข้าวหมูทอดกระเทียมหอมๆ', price: 70, category_id: 'cat-2', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 10, sort_order: 2, created_at: new Date().toISOString() },
    { id: 'prod-3', name: 'แกงเขียวหวานไก่', description: 'แกงเขียวหวานไก่ creamy', price: 75, category_id: 'cat-3', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 20, sort_order: 3, created_at: new Date().toISOString() },
    { id: 'prod-4', name: 'กาแฟเย็น', description: 'กาแฟเย็นหอมๆ', price: 35, category_id: 'cat-4', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5, sort_order: 4, created_at: new Date().toISOString() },
    // ✅ Pre-order products (จองล่วงหน้า / โหวต)
    { id: 'prod-5', name: 'เมนูโหวต: ต้มยำกุ้งสด', description: 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', price: 85, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 25, sort_order: 5, delivery_round_id: 'round-2', scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: new Date().toISOString() },
    { id: 'prod-6', name: 'เมนูใหม่: ผัดไทยทะเล', description: 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', price: 95, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 20, sort_order: 6, delivery_round_id: 'round-3', scheduled_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], created_at: new Date().toISOString() },
  ])
}

export function getProduct(id: string): Product | undefined {
  return getProducts().find(p => p.id === id)
}

export function createProduct(data: ProductForm): Product {
  const products = getProducts()
  const product: Product = {
    id: data.id || generateId('prod'),
    name: data.name,
    description: data.description,
    price: data.price,
    category_id: data.category_id,
    image_url: data.image_url,
    is_available: data.is_available,
    is_featured: data.is_featured,
    is_preorder: data.is_preorder ?? false,  // ✅ v3.1: Default false
    prep_minutes: data.prep_minutes,
    sort_order: data.sort_order || products.length,
    delivery_round_id: data.delivery_round_id,  // ✅ v3.1: Optional
    scheduled_date: data.scheduled_date,        // ✅ v3.1: Optional
    created_at: new Date().toISOString()
  }
  products.push(product)
  storageSet('bmb_products', products)
  return product
}

export function updateProduct(id: string, data: Partial<ProductForm>): Product | null {
  const products = getProducts()
  const index = products.findIndex(p => p.id === id)
  if (index === -1) return null
  products[index] = { ...products[index], ...data }
  storageSet('bmb_products', products)
  return products[index]
}

// ============================================
// Delivery Rounds API (v3.1 — Pre-order System)
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

export function getDeliveryRounds(): DeliveryRound[] {
  return storageGet<DeliveryRound[]>('bmb_delivery_rounds', [
    {
      id: 'round-1',
      round_key: 'morning',
      display_name: 'เช้า (08:00-11:00)',
      cutoff_time: '07:00',
      delivery_start: '08:00',
      delivery_end: '11:00',
      max_capacity: 50,
      current_count: 12,
      date: new Date().toISOString().split('T')[0],
      status: 'active'
    },
    {
      id: 'round-2',
      round_key: 'midday',
      display_name: 'เที่ยง (11:00-14:00)',
      cutoff_time: '10:00',
      delivery_start: '11:00',
      delivery_end: '14:00',
      max_capacity: 80,
      current_count: 35,
      date: new Date().toISOString().split('T')[0],
      status: 'active'
    },
    {
      id: 'round-3',
      round_key: 'evening',
      display_name: 'เย็น (17:00-20:00)',
      cutoff_time: '16:00',
      delivery_start: '17:00',
      delivery_end: '20:00',
      max_capacity: 100,
      current_count: 48,
      date: new Date().toISOString().split('T')[0],
      status: 'active'
    }
  ])
}

export function getActiveDeliveryRounds(): DeliveryRound[] {
  return getDeliveryRounds().filter(r => r.status === 'active')
}

export function createDeliveryRound(data: DeliveryRoundForm): DeliveryRound {
  const rounds = getDeliveryRounds()
  const round: DeliveryRound = {
    id: data.id || generateId('round'),
    round_key: data.round_key,
    display_name: data.display_name,
    cutoff_time: data.cutoff_time,
    delivery_start: data.delivery_start,
    delivery_end: data.delivery_end,
    max_capacity: data.max_capacity,
    current_count: 0,
    date: data.date,
    status: 'active'
  }
  rounds.push(round)
  storageSet('bmb_delivery_rounds', rounds)
  return round
}

export function deleteProduct(id: string): boolean {
  const products = getProducts()
  const filtered = products.filter(p => p.id !== id)
  if (filtered.length === products.length) return false
  storageSet('bmb_products', filtered)
  return true
}

export interface CategoryForm {
  id?: string
  name: string
  slug: string
  icon: string
  sort_order: number
  is_active: boolean
}

export function getCategories(): ProductCategory[] {
  return storageGet<ProductCategory[]>('bmb_categories', [
    { id: 'cat-1', name: 'จานเดียว', slug: 'dish', icon: '🍜', sort_order: 1, is_active: true },
    { id: 'cat-2', name: 'ข้าว', slug: 'rice', icon: '🍚', sort_order: 2, is_active: true },
    { id: 'cat-3', name: 'แกง', slug: 'curry', icon: '🍛', sort_order: 3, is_active: true },
    { id: 'cat-4', name: 'เครื่องดื่ม', slug: 'drink', icon: '🥤', sort_order: 4, is_active: true },
    { id: 'cat-5', name: 'ของหวาน', slug: 'dessert', icon: '🍰', sort_order: 5, is_active: true },
  ])
}

export function createCategory(data: CategoryForm): ProductCategory {
  const categories = getCategories()
  const category: ProductCategory = {
    id: data.id || generateId('cat'),
    name: data.name,
    slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
    icon: data.icon,
    sort_order: data.sort_order || categories.length,
    is_active: data.is_active
  }
  categories.push(category)
  storageSet('bmb_categories', categories)
  return category
}

export function updateCategory(id: string, data: Partial<CategoryForm>): ProductCategory | null {
  const categories = getCategories()
  const index = categories.findIndex(c => c.id === id)
  if (index === -1) return null
  categories[index] = { ...categories[index], ...data }
  storageSet('bmb_categories', categories)
  return categories[index]
}

export function deleteCategory(id: string): boolean {
  const categories = getCategories()
  const filtered = categories.filter(c => c.id !== id)
  if (filtered.length === categories.length) return false
  storageSet('bmb_categories', filtered)
  return true
}