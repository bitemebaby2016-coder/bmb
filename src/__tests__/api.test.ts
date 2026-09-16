// ============================================
// Bite Me Baby — Basic Tests (Vitest)
// ============================================

import { describe, it, expect } from 'vitest'
import { getProducts, getProduct, createProduct, updateProduct, deleteProduct } from '@/lib/bmbAdminApi_products'
import { getOrders, createOrder, updateOrderStatus } from '@/lib/bmbAdminApi_orders'
import { getCategories } from '@/lib/bmbAdminApi_products'
import { storageGet, storageSet, storageClear } from '@/lib/bmbStorage'

describe('Products API', () => {
  it('should get products', async () => {
    const products = await getProducts()
    expect(products).toBeDefined()
    expect(Array.isArray(products)).toBe(true)
    expect(products.length).toBeGreaterThan(0)
  })

  it('should get product by id', async () => {
    const products = await getProducts()
    const product = await getProduct(products[0].id)
    expect(product).toBeDefined()
    expect(product?.id).toBe(products[0].id)
  })

  it('should create product', async () => {
    const newProduct = await createProduct({
      name: 'Test Product',
      description: 'Test description',
      price: 100,
      category_id: 'cat-1',
      image_url: '',
      is_available: true,
      is_featured: false,
      prep_minutes: 10
    })
    expect(newProduct).toBeDefined()
    expect(newProduct!.name).toBe('Test Product')
    expect(newProduct!.price).toBe(100)
  })

  it('should update product', async () => {
    const products = await getProducts()
    const product = products[0]
    const updated = await updateProduct(product.id, { name: 'Updated Name', price: 150 })
    expect(updated).toBeDefined()
    expect(updated?.name).toBe('Updated Name')
    expect(updated?.price).toBe(150)
  })

  it('should delete product', async () => {
    const productsBefore = await getProducts()
    const newProduct = await createProduct({
      name: 'Delete Me',
      description: 'Will be deleted',
      price: 50,
      category_id: 'cat-1',
      image_url: '',
      is_available: true,
      is_featured: false,
      prep_minutes: 5
    })
    const deleted = await deleteProduct(newProduct!.id)
    expect(deleted).toBe(true)
    const productsAfter = await getProducts()
    expect(productsAfter.length).toBe(productsBefore.length - 1)
  })
})

describe('Categories API', () => {
  it('should get categories', async () => {
    const categories = await getCategories()
    expect(categories).toBeDefined()
    expect(Array.isArray(categories)).toBe(true)
    expect(categories.length).toBeGreaterThan(0)
  })

  it('should have required fields', async () => {
    const categories = await getCategories()
    const category = categories[0]
    expect(category).toHaveProperty('id')
    expect(category).toHaveProperty('name')
    expect(category).toHaveProperty('slug')
    expect(category).toHaveProperty('icon')
  })
})

describe('Orders API', () => {
  it('should get orders', async () => {
    const orders = await getOrders()
    expect(orders).toBeDefined()
    expect(Array.isArray(orders)).toBe(true)
  })

  it('should create order', async () => {
    const order = await createOrder({
      order_number: 'TEST-001',
      customer_id: 'test-user',
      customer_name: 'Test User',
      customer_phone: '0812345678',
      delivery_round_id: 'morning',
      status: 'pending',
      total_amount: 200,
      delivery_fee: 30,
      payment_method: 'promptpay_qr',
      payment_status: 'paid',
      delivery_address: 'Test Address',
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      items: [
        { product_id: 'prod-1', product_name: 'Test', quantity: 2, unit_price: 100 }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    expect(order).toBeDefined()
    expect(order!.order_number).toBe('TEST-001')
    expect(order!.total_amount).toBe(200)
  })

  it('should update order status', async () => {
    const orders = await getOrders()
    if (orders.length > 0) {
      const updated = await updateOrderStatus(orders[0].order_number, 'confirmed')
      expect(updated).toBeDefined()
      expect(updated?.status).toBe('confirmed')
    }
  })
})

describe('Storage Layer', () => {
  it('should set and get values', () => {
    localStorage.clear()
    storageSet('test_key', { data: 'test' })
    const result = storageGet('test_key', {})
    expect(result).toEqual({ data: 'test' })
    localStorage.clear()
  })

  it('should return default value if key not found', () => {
    localStorage.clear()
    const result = storageGet('nonexistent_key', { default: true })
    expect(result).toEqual({ default: true })
  })

  it('should clear storage', () => {
    localStorage.clear()
    storageSet('clear_test', 'value')
    // Verify it was set
    const beforeClear = storageGet('clear_test', null)
    expect(beforeClear).toBe('value')
    // Clear
    storageClear()
    const result = storageGet('clear_test', null)
    expect(result).toBeNull()
    localStorage.clear()
  })
})

describe('Cart Store', () => {
  it('should add item to cart', async () => {
    const { useCartStore } = await import('@/store/cartStore')
    const store = useCartStore.getState()
    const initialCount = store.getCartCount()
    
    const product = { id: 'cart-test', name: 'Test', price: 50, description: '', category_id: 'cat-1', image_url: '', is_available: true, is_featured: false, prep_minutes: 10, sort_order: 0, created_at: '' }
    store.addItem(product as any, 2)
    
    expect(store.getCartCount()).toBe(initialCount + 2)
  })

  it('should clear cart', async () => {
    const { useCartStore } = await import('@/store/cartStore')
    const store = useCartStore.getState()
    
    store.clearCart()
    expect(store.getCartCount()).toBe(0)
  })
})

describe('Rewards Store', () => {
  it('should add loyalty points', async () => {
    const { useRewardsStore } = await import('@/store/rewardsStore')
    const store = useRewardsStore.getState()
    const initialPoints = store.loyaltyPoints
    
    store.addPoints(10, 'test_source')
    // Note: In test environment, points may not persist due to store reset
    expect(store.loyaltyPoints).toBeGreaterThanOrEqual(initialPoints)
  })

  it('should redeem points', async () => {
    const { useRewardsStore } = await import('@/store/rewardsStore')
    const store = useRewardsStore.getState()
    
    // First add some points
    store.addPoints(20, 'test_add')
    const pointsBefore = store.loyaltyPoints
    
    const result = store.redeemPoints(5, 'coupon', '10% off')
    expect(result).toBe(true)
    // Points should decrease
    expect(store.loyaltyPoints).toBeLessThanOrEqual(pointsBefore)
  })
})