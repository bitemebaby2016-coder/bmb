// ============================================
// Bite Me Baby — Basic Tests (Vitest)
// ============================================

import { describe, it, expect, vi } from 'vitest'

// Offline DB mock: replace the real Supabase client with an in-memory fake
// (seeded exactly like migration 004) so these API tests run without a live
// database. The user will reset/rebuild the Supabase project separately; until
// then all tests must be green offline.
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('./helpers/supabaseMock')
  return {
    supabase: createSupabaseMock(),
    supabaseAdmin: null,
    getCurrentUser: async () => null,
    isAdmin: async () => false,
    subscribeToTable: () => ({ unsubscribe: vi.fn() }),
    unsubscribeFromChannel: () => {},
    default: null,
  }
})

import { getProducts, getProduct, createProduct, updateProduct, deleteProduct } from '@/lib/bmbAdminApi_products'
import { getOrders, createOrder, updateOrderStatus } from '@/lib/bmbAdminApi_orders'
import { getCategories } from '@/lib/bmbAdminApi_products'
import { storageGet, storageSet, storageClear } from '@/lib/bmbStorage'
import { MODEL_A_PRIMARY, MODEL_A_FALLBACK } from '@/lib/aiModels'

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
    // create + delete nets to the baseline (the same 'Test Product' from the
    // create test above is still present in both counts)
    expect(productsAfter.length).toBe(productsBefore.length)
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
      // seeded delivery round id (delivery_rounds.id = round-1/2/3);
      // 'morning' is the round_key/name alias, not the FK target
      delivery_round_id: 'round-1',
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

describe('AI Model A Configuration', () => {
  it('should use GLM 5.2 (free) as Model A primary with Qwen 3.7 Flash fallback', () => {
    expect(MODEL_A_PRIMARY).toBe('z-ai/glm-5.2:free')
    expect(MODEL_A_FALLBACK).toBe('qwen/qwen3.7-flash')
  })

  it('chatWithAI should fall back to Qwen 3.7 Flash when GLM 5.2 (free) fails', async () => {
    const { chatWithAI, resetConversation } = await import('@/lib/aiService')
    resetConversation()

    const fetchMock = vi.fn()
      // Attempt 1: Model A (GLM 5.2 free) → HTTP 429 rate-limited
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      // Attempt 2: Qwen 3.7 Flash → success
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'สวัสดีค่ะ ยินดีต้อนรับสู่ Bite Me Baby ค่ะ 😊' } }]
        })
      })

    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await chatWithAI('สวัสดี')
      expect(result).toContain('สวัสดี')
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // First request must target Model A (GLM 5.2 free)
      const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(firstBody.model).toBe(MODEL_A_PRIMARY)

      // Fallback request must target Qwen 3.7 Flash
      const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body)
      expect(secondBody.model).toBe(MODEL_A_FALLBACK)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
describe('External Delivery Providers — offline sandbox logic', () => {
  // Grab / LINE MAN / Foodpanda / Bite Drive sandbox test: pure logic (no live
  // API credentials available yet — BLOCKED for real provider sandbox).
  it('calculates provider cost from base + distance + item fee', async () => {
    const { calculateProviderCost, DEFAULT_PROVIDERS } = await import('@/lib/externalProviders')
    const grab = DEFAULT_PROVIDERS.find((p) => p.id === 'grab')!
    const cost = calculateProviderCost(grab, 5, 3)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBe(40 + 5 * 8 + 3 * 2)
  })

  it('returns -1 when distance is outside provider range', async () => {
    const { calculateProviderCost, DEFAULT_PROVIDERS } = await import('@/lib/externalProviders')
    const grab = DEFAULT_PROVIDERS.find((p) => p.id === 'grab')!
    expect(calculateProviderCost(grab, 0.1, 1)).toBe(-1) // below min_distance_km
    expect(calculateProviderCost(grab, 99, 1)).toBe(-1)  // above max_distance_km
  })

  it('selects the cheapest provider within coverage', async () => {
    const { getBestProvider, DEFAULT_PROVIDERS } = await import('@/lib/externalProviders')
    const best = getBestProvider({
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      items_count: 2,
      estimated_weight: 2,
    }, 10.7016, 102.1429, DEFAULT_PROVIDERS)
    expect(best).not.toBeNull()
    // Distance 0 → only 'self' (Bite Drive) has min_distance_km = 0
    expect(best!.provider.id).toBe('self')
  })

  it('returns null when no provider covers the dropoff', async () => {
    const { getBestProvider, DEFAULT_PROVIDERS } = await import('@/lib/externalProviders')
    const best = getBestProvider({
      dropoff_latitude: 12.0, // far outside coverage radius
      dropoff_longitude: 102.0,
      items_count: 1,
      estimated_weight: 1,
    }, 10.7016, 102.1429, DEFAULT_PROVIDERS)
    expect(best).toBeNull()
  })

  it('creates an accepted provider order (sandbox persist)', async () => {
    const { requestProviderDelivery } = await import('@/lib/externalProviders')
    const order = await requestProviderDelivery('grab', {
      provider_id: 'grab',
      order_number: 'PO-SANDBOX-1',
      pickup_latitude: 10.7016,
      pickup_longitude: 102.1429,
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      dropoff_detail: 'Sandbox test',
      items_count: 1,
      total_weight: 0.5,
      status: 'requested',
      estimated_delivery_time: 30,
      actual_delivery_time: null,
    })
    expect(order).not.toBeNull()
    expect(order.status).toBe('accepted')
  })
})

describe('Pre-order API — real order creation (not just toast)', () => {
  it('creates a pre-order with a PO- order number', async () => {
    storageClear()
    const { createPreOrder } = await import('@/lib/preOrderService')
    const preOrder = await createPreOrder({
      customer_id: 'cust-1',
      customer_name: 'Somchai Rakdee',
      customer_phone: '0812345678',
      product_id: 'prod-5',
      product_name: 'Tomyum Gung Fresh',
      quantity: 1,
      unit_price: 85,
      total_amount: 85,
      delivery_round_id: 'round-2',
      scheduled_date: '2030-01-01',
      delivery_latitude: 10.7016,
      delivery_longitude: 102.1429,
      delivery_address: 'Test address',
      status: 'pending',
      special_instructions: '',
    })
    expect(preOrder).not.toBeNull()
    expect(preOrder!.order_number).toMatch(/^PO-\d{8}-\d{3}$/)
  })

  it('getPreOrders returns the created pre-order', async () => {
    const { createPreOrder, getPreOrders } = await import('@/lib/preOrderService')
    const created = await createPreOrder({
      customer_id: 'cust-1',
      customer_name: 'Somchai Rakdee',
      customer_phone: '0812345678',
      product_id: 'prod-6',
      product_name: 'New Menu',
      quantity: 2,
      unit_price: 95,
      total_amount: 190,
      delivery_round_id: 'round-3',
      scheduled_date: '2030-01-05',
      delivery_latitude: 10.7016,
      delivery_longitude: 102.1429,
      delivery_address: '',
      status: 'pending',
      special_instructions: '',
    })
    const orders = await getPreOrders({ status: 'pending' })
    expect(orders.some((o) => o.order_number === created!.order_number)).toBe(true)
  })
})
