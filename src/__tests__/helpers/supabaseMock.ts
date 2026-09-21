// ============================================
// Bite Me Baby â€” In-memory Supabase client mock
// ============================================
// Offline replacement for the real Supabase REST client, used by api.test.ts.
// Implements the postgrest-js fluent surface the app's API layer actually
// uses: from().select().eq().order().insert().update().delete().single().
//
// The seed data mirrors supabase/migrations/004_fix_uuid_to_text.sql, so the
// API tests exercise the real code paths deterministically without a DB.
// The user is planning a full Supabase reset + rebuild later (001â†’004); until
// then the whole suite must be green offline.

export interface MockRow {
  [key: string]: any
}

// Canonical seed (TEXT ids â€” same rows as migration 004 Section 10)
export const seed: Record<string, MockRow[]> = {
  product_categories: [
    { id: 'cat-1', name: 'à¸ˆà¸²à¸™à¹€à¸”à¸µà¸¢à¸§', slug: 'dish', icon: 'ðŸœ', sort_order: 1, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-2', name: 'à¸‚à¹‰à¸²à¸§', slug: 'rice', icon: 'ðŸš', sort_order: 2, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-3', name: 'à¹à¸à¸‡', slug: 'curry', icon: '', sort_order: 3, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-4', name: 'à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸”à¸·à¹ˆà¸¡', slug: 'drink', icon: 'ðŸ¥¤', sort_order: 4, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-5', name: 'à¸‚à¸­à¸‡à¸«à¸§à¸²à¸™', slug: 'dessert', icon: 'ðŸ°', sort_order: 5, is_active: true, created_at: new Date().toISOString() },
  ],
  delivery_rounds: [
    { id: 'round-1', round_key: 'morning', display_name: 'à¹€à¸Šà¹‰à¸² (07:00-10:00)', cutoff_time: '06:00', delivery_start: '07:00', delivery_end: '10:00', max_capacity: 60, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'morning', status: 'active' },
    { id: 'round-2', round_key: 'midday', display_name: 'à¹€à¸—à¸µà¹ˆà¸¢à¸‡ (11:00-14:00)', cutoff_time: '10:00', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 80, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'midday', status: 'active' },
    { id: 'round-3', round_key: 'evening', display_name: 'à¹€à¸¢à¹‡à¸™ (17:00-20:00)', cutoff_time: '16:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 100, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'evening', status: 'active' },
  ],
  products: [
    { id: 'prod-1', name: 'à¸œà¸±à¸”à¹„à¸—à¸¢à¸à¸¸à¹‰à¸‡à¸ªà¸”', description: 'à¸œà¸±à¸”à¹„à¸—à¸¢à¸à¸¸à¹‰à¸‡à¸ªà¸”à¸ªà¸”à¹ƒà¸«à¸¡à¹ˆ', price: 65.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 15, sort_order: 1, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-2', name: 'à¸‚à¹‰à¸²à¸§à¸«à¸¡à¸¹à¸—à¸­à¸”à¸à¸£à¸°à¹€à¸—à¸µà¸¢à¸¡', description: 'à¸‚à¹‰à¸²à¸§à¸«à¸¡à¸¹à¸—à¸­à¸”à¸à¸£à¸°à¹€à¸—à¸µà¸¢à¸¡à¸«à¸­à¸¡à¹†', price: 70.00, category_id: 'cat-2', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 10, sort_order: 2, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-3', name: 'à¹à¸à¸‡à¹€à¸‚à¸µà¸¢à¸§à¸«à¸§à¸²à¸™à¹„à¸à¹ˆ', description: 'à¹à¸à¸‡à¹€à¸‚à¸µà¸¢à¸§à¸«à¸§à¸²à¸™à¹„à¸à¹ˆ creamy', price: 75.00, category_id: 'cat-3', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 20, sort_order: 3, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-4', name: 'à¸à¸²à¹à¸Ÿà¹€à¸¢à¹‡à¸™', description: 'à¸à¸²à¹à¸Ÿà¹€à¸¢à¹‡à¸™à¸«à¸­à¸¡à¹†', price: 35.00, category_id: 'cat-4', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5, sort_order: 4, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-5', name: 'à¹€à¸¡à¸™à¸¹à¹‚à¸«à¸§à¸•: à¸•à¹‰à¸¡à¸¢à¸³à¸à¸¸à¹‰à¸‡à¸ªà¸”', description: 'à¹‚à¸«à¸§à¸•à¹€à¸¡à¸™à¸¹à¸™à¸µà¹‰à¹€à¸žà¸·à¹ˆà¸­à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸² â€” à¸ªà¹ˆà¸‡à¸£à¸­à¸šà¸«à¸™à¹‰à¸²', price: 85.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 25, sort_order: 5, delivery_round_id: 'round-2', scheduled_date: null },
    { id: 'prod-6', name: 'à¹€à¸¡à¸™à¸¹à¹ƒà¸«à¸¡à¹ˆ: à¸œà¸±à¸”à¹„à¸—à¸¢à¸—à¸°à¹€à¸¥', description: 'à¹‚à¸«à¸§à¸•à¹€à¸¡à¸™à¸¹à¸™à¸µà¹‰à¹€à¸žà¸·à¹ˆà¸­à¸ˆà¸­à¸‡à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸² â€” à¸ªà¹ˆà¸‡à¸£à¸­à¸šà¸«à¸™à¹‰à¸²', price: 95.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 20, sort_order: 6, delivery_round_id: 'round-3', scheduled_date: null },
  ],
  inventory: [
    { id: 'ing-1', name: 'à¸‚à¹‰à¸²à¸§', category: 'carb', unit: 'kg', current_stock: 10, min_stock: 5, max_stock: 20, unit_price: 45.00, supplier_name: 'à¸£à¹‰à¸²à¸™à¸‚à¹‰à¸²à¸§à¸ˆà¸±à¸™à¸—à¸šà¸¸à¸£à¸µ', supplier_phone: '0812345678' },
    { id: 'ing-2', name: 'à¹„à¸à¹ˆ', category: 'protein', unit: 'kg', current_stock: 5, min_stock: 3, max_stock: 15, unit_price: 85.00, supplier_name: 'à¸Ÿà¸²à¸£à¹Œà¸¡à¹„à¸à¹ˆà¸ˆà¸±à¸™à¸—à¸šà¸¸à¸£à¸µ', supplier_phone: '0812345679' },
    { id: 'ing-3', name: 'à¹„à¸‚à¹ˆà¹„à¸à¹ˆ', category: 'protein', unit: 'piece', current_stock: 2, min_stock: 10, max_stock: 50, unit_price: 3.00, supplier_name: 'à¸Ÿà¸²à¸£à¹Œà¸¡à¹„à¸‚à¹ˆà¸ˆà¸±à¸™à¸—à¸šà¸¸à¸£à¸µ', supplier_phone: '0812345680' },
    { id: 'ing-4', name: 'à¸™à¹‰à¸³à¸¡à¸±à¸™', category: 'sauce', unit: 'liter', current_stock: 3, min_stock: 2, max_stock: 10, unit_price: 40.00, supplier_name: 'à¸£à¹‰à¸²à¸™à¸™à¹‰à¸³à¸¡à¸±à¸™à¸ˆà¸±à¸™à¸—à¸šà¸¸à¸£à¸µ', supplier_phone: '0812345681' },
  ],
  customers: [
    { id: 'cust-1', full_name: 'à¸ªà¸¡à¸Šà¸²à¸¢ à¸£à¸±à¸à¸”à¸µ', phone: '0812345678', email: 'somchai@example.com', address: '123 à¸ªà¸¸à¸‚à¸ªà¸±à¸™à¸•à¹Œ à¸‹à¸­à¸¢ 1 à¸à¸£à¸¸à¸‡à¹€à¸—à¸žà¸¯ 10100', loyalty_points: 50 },
    { id: 'cust-2', full_name: 'à¸ªà¸¡à¸«à¸à¸´à¸‡ à¸”à¸µà¹ƒà¸ˆ', phone: '0898765432', email: 'somying@example.com', address: '456 à¹ƒà¸«à¸¡à¹ˆ à¸–à¸™à¸™à¹€à¸žà¸Šà¸£à¸šà¸¸à¸£à¸µ à¸à¸£à¸¸à¸‡à¹€à¸—à¸žà¸¯ 10400', loyalty_points: 120 },
  ],
  orders: [],
  order_items: [],
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const NOT_FOUND = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }

export function createSupabaseMock() {
  const tables: Record<string, MockRow[]> = clone(seed)

  function from(table: string) {
    let filters: Array<{ col: string; val: any }> = []
    let orderSpec: { col: string; ascending: boolean } | null = null
    let action: { type: 'insert'; rows: MockRow[] } | { type: 'update'; patch: MockRow } | { type: 'delete' } | null = null
    let singleMode = false
    let maybeMode = false

    const matches = (row: MockRow) => filters.every(f => row[f.col] === f.val)

    async function run(): Promise<{ data: any; error: any }> {
      if (action?.type === 'insert') {
        const arr = tables[table] || (tables[table] = [])
        arr.push(...clone(action.rows))
        if (singleMode) return { data: clone(arr[arr.length - 1]), error: null }
        return { data: null, error: null }
      }
      if (action?.type === 'delete') {
        if (tables[table]) tables[table] = tables[table].filter(r => !matches(r))
        return { data: null, error: null }
      }
      if (action?.type === 'update') {
        const rows = (tables[table] || []).filter(matches)
        for (const r of rows) Object.assign(r, clone(action.patch))
        if (singleMode) {
          if (rows.length === 1) return { data: clone(rows[0]), error: null }
          return { data: null, error: NOT_FOUND }
        }
        return { data: clone(rows), error: null }
      }
      // read path
      let rows = clone(tables[table] || [])
      rows = rows.filter(matches)
      if (orderSpec) {
        const { col, ascending } = orderSpec
        rows.sort((a, b) => {
          const av = a[col]
          const bv = b[col]
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return ascending ? cmp : -cmp
        })
      }
      if (singleMode) {
        if (rows.length === 1) return { data: rows[0], error: null }
        if (maybeMode) return { data: null, error: null }
        return { data: null, error: NOT_FOUND }
      }
      return { data: rows, error: null }
    }

    const builder: any = {
      eq(col: string, val: any) { filters.push({ col, val }); return builder },
      order(col: string, opts?: { ascending?: boolean }) { orderSpec = { col, ascending: opts?.ascending ?? true }; return builder },
      limit(_n: number) { return builder },
      select() { return builder },
      insert(rows: MockRow | MockRow[]) { action = { type: 'insert', rows: Array.isArray(rows) ? rows : [rows] }; return builder },
      update(patch: MockRow) { action = { type: 'update', patch }; return builder },
      delete() { action = { type: 'delete' }; return builder },
      single() { singleMode = true; return builder },
      maybeSingle() { singleMode = true; maybeMode = true; return builder },
      then(resolve: any, reject: any) { run().then(resolve, reject) },
    }
    return builder
  }

  // RPC mock â€” mirrors migration 007 `create_order_with_items` server-authoritative
  // contract (for client-contract tests: client payload must NOT carry financial
  // fields; server always computes from products.price / delivery rules).
  async function rpc(name: string, params: any): Promise<{ data: any; error: any }> {
    if (name === 'create_order_with_items') {
      const p: any = { ...(params ?? {}) }
      // Client sends p_* prefixed keys matching the real RPC signature (2026-09-19 fix).
      // Normalize so the rest of the mock (written against the old args) keeps working.
      if (params && !('items' in params) && typeof params === 'object') {
        for (const key of Object.keys(params)) {
          if (key.startsWith('p_')) p[key.slice(2)] = params[key]
        }
      }
      const items: any[] = Array.isArray(p.items) ? p.items : []
      if (items.length === 0) {
        return { data: null, error: { code: 'ERR_EMPTY_ORDER', message: 'ERR_EMPTY_ORDER' } }
      }
      if (!p.delivery_round_id) {
        return { data: null, error: { code: 'ERR_MISSING_ROUND', message: 'ERR_MISSING_ROUND' } }
      }
      const round = (tables['delivery_rounds'] || []).find((r: any) => r.id === p.delivery_round_id)
      if (!round) return { data: null, error: { code: 'ERR_ROUND_NOT_FOUND', message: 'ERR_ROUND_NOT_FOUND' } }
      if (round.status !== 'active') {
        return { data: null, error: { code: 'ERR_ROUND_CLOSED', message: 'ERR_ROUND_CLOSED' } }
      }
      if (Number(round.current_count) >= Number(round.max_capacity)) {
        return { data: null, error: { code: 'ERR_CAPACITY_FULL', message: 'ERR_CAPACITY_FULL' } }
      }
      if (!p.customer_name || String(p.customer_name).trim() === '') {
        return { data: null, error: { code: 'ERR_MISSING_CUSTOMER_NAME', message: 'ERR_MISSING_CUSTOMER_NAME' } }
      }
      // authoritative price lookup from seeded products (ignores any client price)
      const products = tables['products'] || []
      let subtotal = 0
      let totalQty = 0
      for (const it of items) {
        const prod = products.find((x: any) => x.id === it.product_id)
        if (!prod) return { data: null, error: { code: 'ERR_PRODUCT_NOT_FOUND', message: 'ERR_PRODUCT_NOT_FOUND' } }
        if (!prod.is_available) return { data: null, error: { code: 'ERR_PRODUCT_UNAVAILABLE', message: 'ERR_PRODUCT_UNAVAILABLE' } }
        const q = Number(it.quantity ?? 0)
        if (q <= 0 || q > 1000) return { data: null, error: { code: 'ERR_INVALID_QUANTITY', message: 'ERR_INVALID_QUANTITY' } }
        subtotal += q * Number(prod.price)
        totalQty += q
      }
      // delivery fee mirrors server rules (self_delivery = 30 + km*4 + items*2)
      const method = p.delivery_method || 'self_delivery'
      const dist = Number(p.distance_km ?? 0)
      const feeBase: Record<string, number> = {
        self_delivery: 30,
        grab_rider: 40,
        linemen_rider: 35,
        foodpanda_rider: 38,
      }
      const feePerKm: Record<string, number> = { self_delivery: 4, grab_rider: 8, linemen_rider: 7, foodpanda_rider: 7.5 }
      const delivery_fee = Math.min((feeBase[method] ?? 30) + dist * (feePerKm[method] ?? 4) + totalQty * 2, 9999)
      // authoritative promotion discount (mirrors migration 007 promotions table)
      let discount = 0
      if (p.promotion_code) {
        const promo = (tables['promotions'] || []).find((pr: any) =>
          String(pr.code || '').toUpperCase() === String(p.promotion_code).toUpperCase() && pr.is_active === true)
        if (promo) {
          if (subtotal >= Number(promo.min_order_amount || 0)) {
            if (promo.discount_type === 'percentage') {
              discount = Math.min(subtotal * Number(promo.discount_value || 0) / 100, subtotal)
            } else if (promo.discount_type === 'fixed_amount') {
              discount = Math.min(Number(promo.discount_value || 0), subtotal)
            }
          }
        }
      }
      const total = Math.max(0, subtotal - discount + delivery_fee)
      const orderId = `ord-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const orderNumber = `BMB-TEST-${String(Math.floor(Math.random() * 900) + 100)}`
      // atomic persist mirrors server: order + order_items + capacity increment
      const orderRow = {
        id: orderId,
        order_number: orderNumber,
        customer_id: 'auth-test-user',
        customer_name: String(p.customer_name ?? ''),
        customer_phone: String(p.customer_phone ?? ''),
        delivery_round_id: p.delivery_round_id,
        status: 'pending',
        delivery_method: method,
        dropoff_detail: String(p.delivery_address ?? ''),
        dropoff_latitude: p.dropoff_latitude,
        dropoff_longitude: p.dropoff_longitude,
        subtotal,
        delivery_fee,
        service_fee: 0,
        discount_amount: discount,
        tax_amount: 0,
        total_amount: total,
        payment_status: 'pending',
        payment_method: p.payment_method || 'promptpay_qr',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      ;(tables['orders'] ||= []).push(clone(orderRow))
      const oi = tables['order_items'] || (tables['order_items'] = [])
      items.forEach((it: any, idx: number) => {
        const prod = products.find((x: any) => x.id === it.product_id)!
        oi.push(clone({
          id: `oi-test-${orderId}-${idx + 1}`,
          order_id: orderId,
          product_id: it.product_id,
          product_name: prod.name ?? '',
          quantity: Number(it.quantity),
          unit_price: Number(prod.price),
          customizations: it.options ?? {},
          special_request: it.special_request ?? '',
          item_total: Number(it.quantity) * Number(prod.price),
          created_at: new Date().toISOString(),
        }))
      })
      round.current_count = Number(round.current_count) + 1
      return {
        data: {
          id: orderId,
          order_number: orderNumber,
          status: 'pending',
          subtotal,
          discount_amount: discount,
          delivery_fee,
          service_fee: 0,
          tax_amount: 0,
          total_amount: total,
          payment_status: 'pending',
          payment_method: p.payment_method || 'promptpay_qr',
          delivery_round_id: p.delivery_round_id,
          customer_ref: 'auth-test-user',
        },
        error: null,
      }
    }
    // ============ P0-5 / P0-6 RPC handlers (migration 008 contract) ============
    if (name === 'create_payment_intent_record') {
      const p = params ?? {}
      const order = (tables['orders'] || []).find((o: any) => o.order_number === p.p_order_number)
      if (!order) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      if (Number(p.p_amount) !== Number(order.total_amount)) {
        return { data: null, error: { code: 'ERR_AMOUNT_MISMATCH', message: 'ERR_AMOUNT_MISMATCH' } }
      }
      const piId = `pi-mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      const row = {
        id: piId,
        order_number: p.p_order_number,
        amount: Number(p.p_amount),
        currency: 'thb',
        status: 'pending',
        method: p.p_method || 'promptpay_qr',
        provider: p.p_provider || 'promptpay',
        metadata: p.p_metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      ;(tables['payment_intents'] ||= []).push(row)
      return {
        data: { id: piId, order_number: p.p_order_number, amount: Number(p.p_amount), status: 'pending', method: p.p_method || 'promptpay_qr' },
        error: null,
      }
    }

    if (name === 'submit_offline_payment_reference') {
      const p = params ?? {}
      const intents = tables['payment_intents'] || []
      const pi = intents.find((x: any) => x.order_number === p.p_order_number && x.method === 'promptpay_qr' && x.status === 'pending')
      if (!pi) return { data: null, error: { code: 'ERR_NO_PENDING_PROMPTPAY', message: 'ERR_NO_PENDING_PROMPTPAY' } }
      pi.status = 'processing'
      pi.metadata = { ...(pi.metadata || {}), reference: String(p.p_reference) }
      pi.updated_at = new Date().toISOString()
      return { data: { ok: true, order_number: p.p_order_number, intent_status: 'processing' }, error: null }
    }

    if (name === 'confirm_offline_payment') {
      const p = params ?? {}
      const order = (tables['orders'] || []).find((o: any) => o.order_number === p.p_order_number)
      if (!order) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      if (order.payment_status === 'paid') {
        return { data: { ok: true, idempotent: true, order_number: p.p_order_number }, error: null }
      }
      if (order.payment_method === 'cash_on_delivery') {
        if (order.status !== 'delivered') {
          return { data: null, error: { code: 'ERR_COD_NOT_DELIVERED', message: 'ERR_COD_NOT_DELIVERED' } }
        }
      } else {
        const intents = tables['payment_intents'] || []
        const cands = intents
          .filter((x: any) => x.order_number === p.p_order_number && x.method === order.payment_method)
          .sort((a: any, b: any) => (a.created_at > b.created_at ? -1 : 1))
        const pi = cands[0]
        if (!pi) return { data: null, error: { code: 'ERR_NO_PAYMENT_INTENT', message: 'ERR_NO_PAYMENT_INTENT' } }
        if (pi.status !== 'processing') {
          return { data: null, error: { code: 'ERR_INTENT_NOT_PROCESSING', message: 'ERR_INTENT_NOT_PROCESSING' } }
        }
        pi.status = 'completed'
        pi.completed_at = new Date().toISOString()
      }
      order.payment_status = 'paid'
      order.updated_at = new Date().toISOString()
      return { data: { ok: true, idempotent: false, order_number: p.p_order_number, payment_status: 'paid' }, error: null }
    }

    if (name === 'mark_payment_failed') {
      const p = params ?? {}
      const intents = tables['payment_intents'] || []
      intents
        .filter((x: any) => x.order_number === p.p_order_number && (x.status === 'pending' || x.status === 'processing'))
        .forEach((x: any) => {
          x.status = 'failed'
          x.failure_reason = p.p_reason || 'admin'
          x.updated_at = new Date().toISOString()
        })
      return { data: { ok: true, order_number: p.p_order_number }, error: null }
    }

    if (name === 'record_payment_result') {
      const p = params ?? {}
      const order = (tables['orders'] || []).find((o: any) => o.order_number === p.p_order_number)
      if (!order) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      const intents = tables['payment_intents'] || []
      // 010: only a TERMINAL recorded result short-circuits (idempotent replay).
      // A row still pending (created by create-checkout without payment_intent_id,
      // or with one) must fall through so the first real webhook delivery applies.
      const existing = intents.find((x: any) => x.payment_intent_id === p.p_payment_intent_id && (x.status === 'completed' || x.status === 'failed'))
      if (existing) {
        return { data: { ok: true, idempotent: true, order_number: p.p_order_number, intent_status: existing.status }, error: null }
      }
      if (Number(p.p_amount) !== Number(order.total_amount)) {
        return { data: null, error: { code: 'ERR_AMOUNT_MISMATCH', message: 'ERR_AMOUNT_MISMATCH' } }
      }
      intents
        .filter((x: any) => x.order_number === p.p_order_number)
        .forEach((x: any) => {
          x.status = p.p_status || 'completed'
          x.payment_intent_id = p.p_payment_intent_id
          x.amount = Number(p.p_amount)
          if ((p.p_status || 'completed') === 'completed') x.completed_at = new Date().toISOString()
          if (p.p_failure_reason) x.failure_reason = p.p_failure_reason
          x.updated_at = new Date().toISOString()
        })
      order.payment_status = (p.p_status || 'completed') === 'completed' ? 'paid' : 'pending'
      order.updated_at = new Date().toISOString()
      return { data: { ok: true, idempotent: false, order_number: p.p_order_number, payment_status: order.payment_status }, error: null }
    }

    if (name === 'transition_order_status') {
      const p = params ?? {}
      const order = (tables['orders'] || []).find((o: any) => o.order_number === p.p_order_number)
      if (!order) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      const from = String(order.status)
      const to = String(p.p_new_status)
      if (from === to) return { data: { ok: true, order_number: p.p_order_number, from, to }, error: null }
      const chain: Array<[string, string]> = [
        ['pending', 'confirmed'],
        ['confirmed', 'preparing'],
        ['preparing', 'ready_for_dispatch'],
        ['ready_for_dispatch', 'dispatched'],
        ['dispatched', 'in_transit'],
        ['in_transit', 'arrived'],
        ['arrived', 'delivered'],
      ]
      const cancelFrom = ['pending', 'confirmed', 'preparing', 'ready_for_dispatch', 'dispatched', 'in_transit', 'arrived']
      const adminOk =
        chain.some(([a, b]) => a === from && b === to) ||
        (cancelFrom.includes(from) && (to === 'cancelled' || to === 'failed'))
      if (!adminOk) {
        return { data: null, error: { code: 'ERR_INVALID_TRANSITION', message: `ERR_INVALID_TRANSITION: ${from} -> ${to}` } }
      }
      order.status = to
      order.updated_at = new Date().toISOString()
      return { data: { ok: true, order_number: p.p_order_number, from, to }, error: null }
    }

// ============ PHASE 1 RPC handlers (migration 017 pre-order + 018 audit) ============
    if (name === 'create_pre_order_with_items') {
      const p = params ?? {}
      const products = tables['products'] || []
      const prod = products.find((x: any) => x.id === p.p_product_id)
      if (!prod) return { data: null, error: { code: 'ERR_PRODUCT_NOT_FOUND', message: 'ERR_PRODUCT_NOT_FOUND' } }
      if (!prod.is_preorder) return { data: null, error: { code: 'ERR_NOT_PREORDER_PRODUCT', message: 'ERR_NOT_PREORDER_PRODUCT' } }
      if (!prod.is_available) return { data: null, error: { code: 'ERR_PRODUCT_UNAVAILABLE', message: 'ERR_PRODUCT_UNAVAILABLE' } }
      const qty = Number(p.p_quantity || 0)
      if (qty < 1) return { data: null, error: { code: 'ERR_QUANTITY_INVALID', message: 'ERR_QUANTITY_INVALID' } }
      const rounds = tables['delivery_rounds'] || []
      const round = rounds.find((r: any) => r.id === p.p_delivery_round_id)
      if (!round) return { data: null, error: { code: 'ERR_ROUND_NOT_FOUND', message: 'ERR_ROUND_NOT_FOUND' } }
      if (!['active', 'open', 'scheduled'].includes(String(round.status))) {
        return { data: null, error: { code: 'ERR_ROUND_CLOSED', message: 'ERR_ROUND_CLOSED' } }
      }
      if (Number(round.current_count) >= Number(round.max_capacity)) {
        return { data: null, error: { code: 'ERR_ROUND_FULL', message: 'ERR_ROUND_FULL' } }
      }
      // authoritative price from seeded products â€” client price (if any) is ignored
      const unit = Number(prod.price)
      const total = Math.round(unit * qty * 100) / 100
      const orderNumber = `PO-${String(p.p_scheduled_date || '').replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`
      const row: any = {
        id: `po-test-${Date.now()}`,
        order_number: orderNumber,
        customer_id: 'auth-test-user',
        customer_ref: 'auth-test-user',
        customer_name: String(p.p_customer_name || 'Guest'),
        customer_phone: String(p.p_customer_phone || ''),
        product_id: prod.id,
        product_name: prod.name,
        quantity: qty,
        unit_price: unit,
        total_amount: total,
        delivery_round_id: String(p.p_delivery_round_id),
        scheduled_date: String(p.p_scheduled_date || round.scheduled_date || ''),
        delivery_latitude: p.p_delivery_latitude,
        delivery_longitude: p.p_delivery_longitude,
        delivery_address: String(p.p_delivery_address || ''),
        status: 'pending',
        special_instructions: String(p.p_special_instructions || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      ;(tables['pre_orders'] ||= []).push(clone(row))
      round.current_count = Number(round.current_count) + 1
      return {
        data: {
          id: row.id,
          order_number: orderNumber,
          product_id: prod.id,
          product_name: prod.name,
          quantity: qty,
          unit_price: unit,
          total_amount: total,
          delivery_round_id: String(p.p_delivery_round_id),
          round_display_name: round.display_name,
          scheduled_date: String(row.scheduled_date),
          status: 'pending',
          customer_ref: 'auth-test-user',
        },
        error: null,
      }
    }

    if (name === 'quote_pre_order') {
      const p = params ?? {}
      const prod = (tables['products'] || []).find((x: any) => x.id === p.p_product_id)
      if (!prod) return { data: null, error: { code: 'ERR_PRODUCT_NOT_FOUND', message: 'ERR_PRODUCT_NOT_FOUND' } }
      const q = Math.max(Number(p.p_quantity || 1), 1)
      const unit = Number(prod.price)
      return { data: { product_id: prod.id, unit_price: unit, quantity: q, total_amount: Math.round(unit * q * 100) / 100 }, error: null }
    }

    if (name === 'cancel_pre_order') {
      const p = params ?? {}
      const orders = tables['pre_orders'] || []
      const po = orders.find((o: any) => o.order_number === p.p_order_number)
      if (!po) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      if (['cancelled', 'expired', 'delivered', 'picked_up'].includes(String(po.status))) {
        return { data: null, error: { code: 'ERR_ORDER_TERMINAL', message: 'ERR_ORDER_TERMINAL' } }
      }
      po.status = 'cancelled'
      po.cancelled_at = new Date().toISOString()
      po.updated_at = new Date().toISOString()
      if (po.delivery_round_id) {
        const round = (tables['delivery_rounds'] || []).find((r: any) => r.id === po.delivery_round_id)
        if (round) round.current_count = Math.max(Number(round.current_count) - 1, 0)
      }
      return { data: { ok: true, order_number: p.p_order_number, status: 'cancelled' }, error: null }
    }

    if (name === 'append_audit_log') {
      const p = params ?? {}
      ;(tables['audit_logs'] ||= []).push(clone({
        id: `alog-test-${Date.now()}`,
        user_id: 'auth-test-user',
        user_email: p.p_user_email || null,
        action: p.p_action,
        entity_type: p.p_entity_type || '',
        entity_id: p.p_entity_id || null,
        description: p.p_description || '',
        metadata: p.p_metadata || {},
        created_at: new Date().toISOString(),
      }))
      return { data: { ok: true, id: `alog-test-${Date.now()}`, user_id: 'auth-test-user' }, error: null }
    }
// ============ PHASE 2 KITCHEN RPC handlers (migration 019 contract) ============
    if (name === 'get_inventory_requirements') {
      const p = params ?? {}
      const prod = (tables['products'] || []).find((x: any) => x.id === p.p_product_id)
      if (!prod) return { data: null, error: { code: 'ERR_PRODUCT_NOT_FOUND', message: 'ERR_PRODUCT_NOT_FOUND' } }
      const qty = Math.max(Number(p.p_quantity || 1), 1)
      // DEMO recipe map (mirrors migration 019 seed) — prod-1 requires ing-1 0.25 + ing-3 1
      const reqs: Array<[string, number]> = prod.id === 'prod-1' ? [['ing-1', 0.25], ['ing-3', 1]] : []
      const requirements = reqs.map(([ing, per]) => {
        const inv = (tables['inventory'] || []).find((i: any) => i.id === ing)
        return {
          ingredient_id: ing,
          ingredient_name: inv ? inv.name : ing,
          unit: inv ? inv.unit : 'unit',
          quantity_per_unit: per,
          required: per * qty,
          current_stock: inv ? Number(inv.current_stock) : 0,
          min_stock: inv ? Number(inv.min_stock) : 0,
          feasible: inv ? Number(inv.current_stock) >= per * qty : false,
        }
      })
      return {
        data: {
          ok: true, product_id: prod.id, quantity: qty,
          feasible: requirements.every((r: any) => r.feasible),
          requirements,
        },
        error: null,
      }
    }

    if (name === 'kitchen_queue') {
      const p = params ?? {}
      const batches = (tables['production_batches'] || []).filter((b: any) =>
        (p.p_delivery_round_id == null || b.delivery_round_id === p.p_delivery_round_id))
      const items = tables['production_batch_items'] || []
      return {
        data: {
          ok: true,
          batches: batches.map((b: any) => ({
            batch_id: b.id,
            delivery_round_id: b.delivery_round_id,
            scheduled_date: b.scheduled_date,
            status: b.status,
            items: items.filter((i: any) => i.batch_id === b.id).map((i: any) => ({
              item_id: i.id, order_number: i.order_number, product_name: i.product_name,
              quantity: i.quantity, status: i.status,
            })),
          })),
        },
        error: null,
      }
    }

    if (name === 'create_production_batch') {
      const p = params ?? {}
      const round = (tables['delivery_rounds'] || []).find((r: any) => r.id === p.p_delivery_round_id)
      if (!round) return { data: null, error: { code: 'ERR_ROUND_NOT_FOUND', message: 'ERR_ROUND_NOT_FOUND' } }
      const batchId = `batch-mock-${Date.now()}`
      const orders = (tables['orders'] || []).filter((o: any) => o.delivery_round_id === p.p_delivery_round_id && (o.status === 'confirmed' || o.status === 'preparing'))
      let n = 0
      for (const o of orders) {
        for (const oi of (tables['order_items'] || []).filter((x: any) => x.order_id === o.id)) {
          ;(tables['production_batch_items'] ||= []).push({
            id: `pbi-${batchId}-${n}`, batch_id: batchId, order_id: o.id,
            order_number: o.order_number, product_id: oi.product_id,
            product_name: oi.product_name, quantity: oi.quantity, status: 'queued',
            created_at: new Date().toISOString(),
          })
          n++
        }
      }
      ;(tables['production_batches'] ||= []).push({
        id: batchId, delivery_round_id: p.p_delivery_round_id,
        scheduled_date: p.p_scheduled_date || new Date().toISOString().slice(0, 10),
        status: 'open', created_by: 'auth-test-user', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      return { data: { ok: true, batch_id: batchId, delivery_round_id: p.p_delivery_round_id, items_count: n }, error: null }
    }
if (name === 'deduct_inventory_for_order') {
      const p = params ?? {}
      const order = (tables['orders'] || []).find((o: any) => o.order_number === p.p_order_number)
      if (!order) return { data: null, error: { code: 'ERR_ORDER_NOT_FOUND', message: 'ERR_ORDER_NOT_FOUND' } }
      const already = (tables['inventory_transactions'] || []).some((t: any) => t.reference_type === 'order' && t.reference_id === p.p_order_number)
      if (already) return { data: { ok: true, idempotent: true, order_number: p.p_order_number }, error: null }
      for (const oi of (tables['order_items'] || []).filter((x: any) => x.order_id === order.id)) {
        if (oi.product_id === 'prod-1') {
          const ing = (tables['inventory'] || []).find((i: any) => i.id === 'ing-1')
          if (ing) {
            ing.current_stock = Number(ing.current_stock) - Number(oi.quantity) * 0.25
            ;(tables['inventory_transactions'] ||= []).push({
              id: `itx-${Date.now()}`, inventory_id: 'ing-1', type: 'out',
              quantity: Number(oi.quantity) * 0.25, reference_type: 'order',
              reference_id: p.p_order_number, notes: 'auto-deduct', created_by: 'auth-test-user',
              created_at: new Date().toISOString(),
            })
          }
        }
      }
      return { data: { ok: true, idempotent: false, order_number: p.p_order_number }, error: null }
    }

    if (name === 'restore_inventory_for_order') {
      const p = params ?? {}
      const tx = (tables['inventory_transactions'] || []).filter((t: any) => t.reference_type === 'order' && t.reference_id === p.p_order_number)
      if (tx.length === 0) return { data: { ok: true, idempotent: true, order_number: p.p_order_number, restored_amount: 0 }, error: null }
      for (const t of tx) {
        const ing = (tables['inventory'] || []).find((i: any) => i.id === t.inventory_id)
        if (ing) ing.current_stock = Number(ing.current_stock) + Number(t.quantity)
      }
      tables['inventory_transactions'] = (tables['inventory_transactions'] || []).filter((t: any) => !(t.reference_type === 'order' && t.reference_id === p.p_order_number))
      return { data: { ok: true, idempotent: false, order_number: p.p_order_number, restored_amount: tx.length }, error: null }
    }
// ============ PHASE 4 RPC handlers (migration 021 contract) ============
    if (name === 'get_ai_memory') {
      const mem = (tables['ai_customer_memory'] || []).find((m: any) => m.user_id === 'auth-test-user')
      return { data: { ok: true, memory: mem ? mem.memory : {} }, error: null }
    }

    if (name === 'save_ai_memory') {
      const p = params ?? {}
      const i = (tables['ai_customer_memory'] || []).findIndex((m: any) => m.user_id === 'auth-test-user')
      if (i >= 0) (tables['ai_customer_memory'] as any[])[i].memory = { ...((tables['ai_customer_memory'] as any[])[i].memory || {}), ...(p.p_memory || {}) }
      else (tables['ai_customer_memory'] ||= []).push({ user_id: 'auth-test-user', memory: { ...(p.p_memory || {}) }, updated_at: new Date().toISOString() })
      return { data: { ok: true, user_id: 'auth-test-user' }, error: null }
    }

    if (name === 'record_system_error') {
      const p = params ?? {}
      ;(tables['system_errors'] ||= []).push({
        id: `err-mock-${Date.now()}`, source: p.p_source || 'client', level: p.p_level || 'error',
        message: p.p_message || '', details: p.p_details || {}, user_id: 'auth-test-user',
        created_at: new Date().toISOString(),
      })
      return { data: { ok: true, id: `err-mock-${Date.now()}` }, error: null }
    }

    if (name === 'create_notification') {
      const p = params ?? {}
      ;(tables['notifications'] ||= []).push({
        id: `notif-mock-${Date.now()}`, customer_id: p.p_customer_id || 'auth-test-user',
        user_id: 'auth-test-user', title: p.p_title || '', message: p.p_message || '',
        is_read: false, notification_type: p.p_category || 'Transactional',
        category: p.p_category || 'Transactional', created_at: new Date().toISOString(),
      })
      return { data: { ok: true, id: `notif-mock-${Date.now()}`, suppressed: false, category: p.p_category || 'Transactional' }, error: null }
    }

    if (name === 'set_notification_pref') {
      return { data: { ok: true, channels: { [params?.p_channel || 'Marketing']: params?.p_enabled ?? true } }, error: null }
    }
if (name === 'customer_intelligence') {
      const p = params ?? {}
      const orders = tables['orders'] || []
      const mine = orders.filter((o: any) => o.customer_ref === 'auth-test-user' && o.payment_status === 'paid')
      const row = {
        user_id: 'auth-test-user', total_orders: mine.length, total_revenue: mine.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
        average_order_value: mine.length ? Math.round((mine.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0) / mine.length) * 100) / 100 : 0,
        days_since_last_order: mine.length ? 1 : null, last_order_at: mine.length ? mine[0].created_at : null,
        segment: mine.length >= 2 ? 'regular' : 'new',
      }
      if (p.p_user_id) return { data: { ok: true, customer: row }, error: null }
      return { data: { ok: true, customers: [row] }, error: null }
    }

    if (name === 'submit_content_for_approval') {
      const p = params ?? {}
      const id = `cap-mock-${Date.now()}`
      ;(tables['content_approvals'] ||= []).push({
        id, content_type: p.p_content_type || 'promotion', title: p.p_title || '', body: p.p_body || '',
        status: 'pending', created_by: 'auth-test-user', created_at: new Date().toISOString(),
      })
      return { data: { ok: true, id, status: 'pending' }, error: null }
    }

    if (name === 'review_content') {
      const p = params ?? {}
      const row = (tables['content_approvals'] || []).find((x: any) => x.id === p.p_approval_id)
      if (!row || row.status !== 'pending') return { data: null, error: { code: 'ERR_APPROVAL_NOT_PENDING', message: 'ERR_APPROVAL_NOT_PENDING' } }
      row.status = p.p_decision
      row.reviewed_at = new Date().toISOString()
      return { data: { ok: true, id: p.p_approval_id, status: p.p_decision }, error: null }
    }
    return { data: null, error: { code: 'PGRST202', message: 'rpc not mocked' } }
  }

  // ============ Edge Function mock (supabase.functions.invoke) ============
  const invokeHandlers: Record<string, (body: any) => Promise<{ data: any; error: any }>> = {}

  function setInvokeHandler(name: string, handler: (body: any) => Promise<{ data: any; error: any }>) {
    invokeHandlers[name] = handler
  }

  const functions = {
    async invoke(fnName: string, options: { body?: any } = {}): Promise<{ data: any; error: any }> {
      const handler = invokeHandlers[fnName]
      if (!handler) return { data: null, error: { message: `Function '${fnName}' not mocked` } }
      return handler(options?.body ?? {})
    },
  }

  return {
    from,
    rpc,
    functions,
    __setInvokeHandler: setInvokeHandler,
    __tables: tables,
    __reset() {
      const fresh = clone(seed) as Record<string, MockRow[]>
      for (const k of Object.keys(fresh)) tables[k] = fresh[k]
      for (const k of Object.keys(tables)) {
        if (!(k in fresh)) delete tables[k]
      }
    },
  }
}