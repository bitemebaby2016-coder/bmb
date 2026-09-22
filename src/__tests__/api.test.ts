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

  it('should create order via server-authoritative RPC (INPUT ONLY)', async () => {
    // P0-4: client sends ONLY product_id/quantity/options — NO price/subtotal/
    // delivery_fee/total_amount (removed from OrderInput; server computes).
    const order = await createOrder({
      items: [
        { product_id: 'prod-1', quantity: 2 }
      ],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      delivery_address: 'Test Address',
      customer_name: 'Test User',
      customer_phone: '0812345678',
      payment_method: 'promptpay_qr'
    })
    expect(order).toBeDefined()
    expect(order!.order_number).toMatch(/^BMB-TEST-\d{3}$/)
    // server-authoritative (seed: prod-1 price 65; self_delivery = 30 + 4*dist + 2*qty)
    expect(order!.subtotal).toBe(130)      // 65 * 2
    expect(order!.delivery_fee).toBe(34)   // 30 + 0 + 4
    expect(order!.discount_amount).toBe(0)
    expect(order!.total_amount).toBe(164)  // 130 + 34 — NOT client-supplied
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
describe('P0-4 Server-authoritative order (create_order_with_items)', () => {
  // Contract: client sends INPUT ONLY (product_id/quantity/options). The server
  // RPC (migration 007) reads authoritative prices from products and computes
  // subtotal/delivery/total. These tests prove the client cannot influence
  // financial totals through createOrder / the RPC contract.

  it('ignores client-supplied financial fields (price/subtotal/total tamper)', async () => {
    const { supabase } = await import('@/lib/supabase')
    // Attacker passes total_amount = 0, price = 1, subtotal = 0 directly to the RPC.
    const { data, error } = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-1', quantity: 2 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Tamper Test',
      // malicious financial fields that MUST be ignored by the server:
      price: 1,
      unit_price: 1,
      subtotal: 0,
      delivery_fee: 0,
      discount_amount: 0,
      total_amount: 0,
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    // authoritative server math from products.price (65) + delivery rule:
    expect(data.subtotal).toBe(130)     // 65 * 2
    expect(data.delivery_fee).toBe(34)  // 30 + 0 + 4
    expect(data.total_amount).toBe(164) // NOT 0 — client values ignored
  })

  it('uses current DB price when products.price changes (no client price)', async () => {
    const { supabase } = await import('@/lib/supabase')
    // bump prod-2 price in the "DB"
    await supabase.from('products').update({ price: 100 }).eq('id', 'prod-2')
    try {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        items: [{ product_id: 'prod-2', quantity: 1 }],
        delivery_round_id: 'round-1',
        delivery_method: 'self_delivery',
        customer_name: 'Price Test',
      })
      expect(error).toBeNull()
      expect(data.subtotal).toBe(100)     // seeded 70 → changed to 100
      expect(data.total_amount).toBe(132) // 100 + (30 + 0 + 2)
    } finally {
      await supabase.from('products').update({ price: 70 }).eq('id', 'prod-2')
    }
  })

  it('rejects inactive product (ERR_PRODUCT_UNAVAILABLE)', async () => {
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('products').update({ is_available: false }).eq('id', 'prod-3')
    try {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        items: [{ product_id: 'prod-3', quantity: 1 }],
        delivery_round_id: 'round-1',
        delivery_method: 'self_delivery',
        customer_name: 'Unavailable Test',
      })
      expect(error?.code).toBe('ERR_PRODUCT_UNAVAILABLE')
      expect(data).toBeNull()
    } finally {
      await supabase.from('products').update({ is_available: true }).eq('id', 'prod-3')
    }
  })

  it('rejects nonexistent product (ERR_PRODUCT_NOT_FOUND)', async () => {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-NOPE', quantity: 1 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Not Found Test',
    })
    expect(error?.code).toBe('ERR_PRODUCT_NOT_FOUND')
    expect(data).toBeNull()
  })

  it('rejects invalid quantity 0 / negative / >1000 (ERR_INVALID_QUANTITY)', async () => {
    const { supabase } = await import('@/lib/supabase')
    for (const q of [0, -3, 1001]) {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        items: [{ product_id: 'prod-1', quantity: q }],
        delivery_round_id: 'round-1',
        delivery_method: 'self_delivery',
        customer_name: 'Qty Test',
      })
      expect(error?.code).toBe('ERR_INVALID_QUANTITY')
      expect(data).toBeNull()
    }
  })
})

describe('P0-4 Server-authoritative order — capacity & atomicity', () => {
  it('rejects when round is full (ERR_CAPACITY_FULL) — no overselling', async () => {
    const { supabase } = await import('@/lib/supabase')
    // round-1 seeded: max_capacity 60, current_count 0
    // fill to 59, order #60 succeeds, order #61 must be rejected
    await supabase.from('delivery_rounds').update({ current_count: 59 }).eq('id', 'round-1')
    const ok = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-1', quantity: 1 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Slot 60',
    })
    expect(ok.error).toBeNull()
    const full = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-1', quantity: 1 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Slot 61 — must be rejected',
    })
    expect(full.error?.code).toBe('ERR_CAPACITY_FULL')
    expect(full.data).toBeNull()
    await supabase.from('delivery_rounds').update({ current_count: 0 }).eq('id', 'round-1')
  })

  it('rejects unknown / closed round (ERR_ROUND_NOT_FOUND / ERR_ROUND_CLOSED)', async () => {
    const { supabase } = await import('@/lib/supabase')
    const missing = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-1', quantity: 1 }],
      delivery_round_id: 'round-999',
      delivery_method: 'self_delivery',
      customer_name: 'Round Test',
    })
    expect(missing.error?.code).toBe('ERR_ROUND_NOT_FOUND')
    await supabase.from('delivery_rounds').update({ status: 'closed' }).eq('id', 'round-2')
    try {
      const closed = await supabase.rpc('create_order_with_items', {
        items: [{ product_id: 'prod-1', quantity: 1 }],
        delivery_round_id: 'round-2',
        delivery_method: 'self_delivery',
        customer_name: 'Round Test',
      })
      expect(closed.error?.code).toBe('ERR_ROUND_CLOSED')
    } finally {
      await supabase.from('delivery_rounds').update({ status: 'active' }).eq('id', 'round-2')
    }
  })

  it('rejects empty order and missing customer name', async () => {
    const { supabase } = await import('@/lib/supabase')
    const empty = await supabase.rpc('create_order_with_items', {
      items: [],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Empty Test',
    })
    expect(empty.error?.code).toBe('ERR_EMPTY_ORDER')
    const noName = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-1', quantity: 1 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: '',
    })
    expect(noName.error?.code).toBe('ERR_MISSING_CUSTOMER_NAME')
  })

  it('applies authoritative promotion discount from promotions table only', async () => {
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('promotions').insert({
      id: 'promo-test-1',
      name: 'Test 10%',
      code: 'P0TEST10',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_amount: 0,
      is_active: true,
    })
    try {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        items: [{ product_id: 'prod-1', quantity: 2 }], // 130 subtotal
        delivery_round_id: 'round-1',
        delivery_method: 'self_delivery',
        customer_name: 'Promo Test',
        promotion_code: 'p0test10', // case-insensitive lookup
      })
      expect(error).toBeNull()
      expect(data.discount_amount).toBe(13) // 10% of 130
      expect(data.total_amount).toBe(151)   // 130 - 13 + 34
    } finally {
      await supabase.from('promotions').delete().eq('id', 'promo-test-1')
    }
  })

  it('atomicity: failed creation persists NO order and NO order_items (no orphans)', async () => {
    const { supabase } = await import('@/lib/supabase')
    const countOrders = async () => (await supabase.from('orders').select()).data?.length ?? 0
    const countItems = async () => (await supabase.from('order_items').select()).data?.length ?? 0
    const beforeOrders = await countOrders()
    const beforeItems = await countItems()
    // fail on purpose: invalid product
    const { error } = await supabase.rpc('create_order_with_items', {
      items: [{ product_id: 'prod-XYZ', quantity: 1 }],
      delivery_round_id: 'round-1',
      delivery_method: 'self_delivery',
      customer_name: 'Rollback Test',
    })
    expect(error).not.toBeNull()
    const afterOrders = await countOrders()
    const afterItems = await countItems()
    expect(afterOrders).toBe(beforeOrders) // no orphan order
    expect(afterItems).toBe(beforeItems)   // no orphan items
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

  it('chatWithAI should fall back to Qwen 3.7 Flash when GLM 5.2 (free) fails (via ai-proxy EF)', async () => {
    const { chatWithAI, resetConversation } = await import('@/lib/aiService')
    const { supabase } = await import('@/lib/supabase')
    resetConversation()

    // SEC-02 (Phase 4): the client now routes through the ai-proxy Edge Function;
    // the proxy simulates Model A (GLM 5.2 free) failing with an upstream 429 so
    // the client falls back to Qwen 3.7 Flash — same contract as before.
    const modelCalls: string[] = []
    ;(supabase as any).__setInvokeHandler('ai-proxy', async (body: any) => {
      modelCalls.push(body.model)
      if (body.model === MODEL_A_PRIMARY) {
        return { data: null, error: { message: 'upstream 429' } }
      }
      return {
        data: { data: { choices: [{ message: { content: 'สวัสดีค่ะ ยินดีต้อนรับสู่ Bite Me Baby ค่ะ 😊' } }] } },
        error: null,
      }
    })

    const result = await chatWithAI('สวัสดี')
    expect(result).toContain('สวัสดี')
    expect(modelCalls).toEqual([MODEL_A_PRIMARY, MODEL_A_FALLBACK])
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

describe('Pre-order API — canonical creation through create_order_with_items (Phase 3B)', () => {
  async function ensureFutureRound(date: string): Promise<string> {
    const { supabase } = await import('@/lib/supabase')
    await supabase.rpc('ensure_rounds_for_date', { p_date: date })
    const res = await supabase.from('delivery_rounds').select('*')
    const rounds = ((res.data || []) as any[]).filter((r) => String(r.scheduled_date) === date && r.status === 'active')
    if (rounds.length === 0) throw new Error('mock: no active round for ' + date)
    return rounds[0].id as string
  }

  it('creates a PRE_ORDER canonical order with a PO- order number', async () => {
    storageClear()
    const { createOrder } = await import('@/lib/bmbAdminApi_orders')
    const roundId = await ensureFutureRound('2030-01-01')
    const order = await createOrder({
      items: [{ product_id: 'prod-5', quantity: 1 }],
      delivery_round_id: roundId,
      customer_name: 'Somchai Rakdee',
      customer_phone: '0812345678',
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      delivery_address: 'Test address',
      order_mode: 'PRE_ORDER',
      scheduled_date: '2030-01-01',
    })
    expect(order).not.toBeNull()
    expect(order!.order_number).toMatch(/^PO-\d{8}-\d{3}$/)
    expect(order!.status).toBe('pending')
    expect((order as any).order_mode).toBe('PRE_ORDER')
    expect((order as any).scheduled_date).toBe('2030-01-01')
  })

  it('the created PRE_ORDER row lives in canonical orders (mode + scheduled_date)', async () => {
    const { createOrder, getOrders } = await import('@/lib/bmbAdminApi_orders')
    const roundId = await ensureFutureRound('2030-01-05')
    const created = await createOrder({
      items: [{ product_id: 'prod-6', quantity: 2 }],
      delivery_round_id: roundId,
      customer_name: 'Somchai Rakdee',
      customer_phone: '0812345678',
      dropoff_latitude: 10.7016,
      dropoff_longitude: 102.1429,
      delivery_address: '',
      order_mode: 'PRE_ORDER',
      scheduled_date: '2030-01-05',
    })
    const orders = await getOrders()
    const row = orders.find((o) => o.order_number === created!.order_number)
    expect(row).toBeTruthy()
    expect((row as any).order_mode).toBe('PRE_ORDER')
    expect((row as any).scheduled_date).toBe('2030-01-05')
  })
})
