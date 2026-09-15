// ============================================
// Bite Me Baby Admin API - Products & Categories
// ============================================

import { storageGet, storageSet, generateId } from './bmbStorage'
import type { Product, ProductCategory } from '@/types'

export interface ProductForm {
  id?: string
  name: string
  description: string
  price: number
  category_id: string
  image_url: string
  is_available: boolean
  is_featured: boolean
  prep_minutes: number
  sort_order?: number
}

export function getProducts(): Product[] {
  return storageGet<Product[]>('bmb_products', [
    { id: 'prod-1', name: 'ผัดไทยกุ้งสด', description: 'ผัดไทยกุ้งสดสดใหม่', price: 65, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, prep_minutes: 15, sort_order: 1, created_at: new Date().toISOString() },
    { id: 'prod-2', name: 'ข้าวหมูทอดกระเทียม', description: 'ข้าวหมูทอดกระเทียมหอมๆ', price: 70, category_id: 'cat-2', image_url: '', is_available: true, is_featured: false, prep_minutes: 10, sort_order: 2, created_at: new Date().toISOString() },
    { id: 'prod-3', name: 'แกงเขียวหวานไก่', description: 'แกงเขียวหวานไก่ creamy', price: 75, category_id: 'cat-3', image_url: '', is_available: true, is_featured: true, prep_minutes: 20, sort_order: 3, created_at: new Date().toISOString() },
    { id: 'prod-4', name: 'กาแฟเย็น', description: 'กาแฟเย็นหอมๆ', price: 35, category_id: 'cat-4', image_url: '', is_available: true, is_featured: false, prep_minutes: 5, sort_order: 4, created_at: new Date().toISOString() },
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
    prep_minutes: data.prep_minutes,
    sort_order: data.sort_order || products.length,
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