// ============================================
// Bite Me Baby — In-memory Supabase client mock
// ============================================
// Offline replacement for the real Supabase REST client, used by api.test.ts.
// Implements the postgrest-js fluent surface the app's API layer actually
// uses: from().select().eq().order().insert().update().delete().single().
//
// The seed data mirrors supabase/migrations/004_fix_uuid_to_text.sql, so the
// API tests exercise the real code paths deterministically without a DB.
// The user is planning a full Supabase reset + rebuild later (001→004); until
// then the whole suite must be green offline.

export interface MockRow {
  [key: string]: any
}

// Canonical seed (TEXT ids — same rows as migration 004 Section 10)
export const seed: Record<string, MockRow[]> = {
  product_categories: [
    { id: 'cat-1', name: 'จานเดียว', slug: 'dish', icon: '🍜', sort_order: 1, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-2', name: 'ข้าว', slug: 'rice', icon: '🍚', sort_order: 2, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-3', name: 'แกง', slug: 'curry', icon: '', sort_order: 3, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-4', name: 'เครื่องดื่ม', slug: 'drink', icon: '🥤', sort_order: 4, is_active: true, created_at: new Date().toISOString() },
    { id: 'cat-5', name: 'ของหวาน', slug: 'dessert', icon: '🍰', sort_order: 5, is_active: true, created_at: new Date().toISOString() },
  ],
  delivery_rounds: [
    { id: 'round-1', round_key: 'morning', display_name: 'เช้า (07:00-10:00)', cutoff_time: '06:00', delivery_start: '07:00', delivery_end: '10:00', max_capacity: 60, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'morning', status: 'active' },
    { id: 'round-2', round_key: 'midday', display_name: 'เที่ยง (11:00-14:00)', cutoff_time: '10:00', delivery_start: '11:00', delivery_end: '14:00', max_capacity: 80, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'midday', status: 'active' },
    { id: 'round-3', round_key: 'evening', display_name: 'เย็น (17:00-20:00)', cutoff_time: '16:00', delivery_start: '17:00', delivery_end: '20:00', max_capacity: 100, current_count: 0, date: new Date().toISOString().slice(0, 10), scheduled_date: new Date().toISOString().slice(0, 10), name: 'evening', status: 'active' },
  ],
  products: [
    { id: 'prod-1', name: 'ผัดไทยกุ้งสด', description: 'ผัดไทยกุ้งสดสดใหม่', price: 65.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 15, sort_order: 1, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-2', name: 'ข้าวหมูทอดกระเทียม', description: 'ข้าวหมูทอดกระเทียมหอมๆ', price: 70.00, category_id: 'cat-2', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 10, sort_order: 2, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-3', name: 'แกงเขียวหวานไก่', description: 'แกงเขียวหวานไก่ creamy', price: 75.00, category_id: 'cat-3', image_url: '', is_available: true, is_featured: true, is_preorder: false, prep_minutes: 20, sort_order: 3, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-4', name: 'กาแฟเย็น', description: 'กาแฟเย็นหอมๆ', price: 35.00, category_id: 'cat-4', image_url: '', is_available: true, is_featured: false, is_preorder: false, prep_minutes: 5, sort_order: 4, delivery_round_id: null, scheduled_date: null },
    { id: 'prod-5', name: 'เมนูโหวต: ต้มยำกุ้งสด', description: 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', price: 85.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 25, sort_order: 5, delivery_round_id: 'round-2', scheduled_date: null },
    { id: 'prod-6', name: 'เมนูใหม่: ผัดไทยทะเล', description: 'โหวตเมนูนี้เพื่อจองล่วงหน้า — ส่งรอบหน้า', price: 95.00, category_id: 'cat-1', image_url: '', is_available: true, is_featured: true, is_preorder: true, prep_minutes: 20, sort_order: 6, delivery_round_id: 'round-3', scheduled_date: null },
  ],
  inventory: [
    { id: 'ing-1', name: 'ข้าว', category: 'carb', unit: 'kg', current_stock: 10, min_stock: 5, max_stock: 20, unit_price: 45.00, supplier_name: 'ร้านข้าวจันทบุรี', supplier_phone: '0812345678' },
    { id: 'ing-2', name: 'ไก่', category: 'protein', unit: 'kg', current_stock: 5, min_stock: 3, max_stock: 15, unit_price: 85.00, supplier_name: 'ฟาร์มไก่จันทบุรี', supplier_phone: '0812345679' },
    { id: 'ing-3', name: 'ไข่ไก่', category: 'protein', unit: 'piece', current_stock: 2, min_stock: 10, max_stock: 50, unit_price: 3.00, supplier_name: 'ฟาร์มไข่จันทบุรี', supplier_phone: '0812345680' },
    { id: 'ing-4', name: 'น้ำมัน', category: 'sauce', unit: 'liter', current_stock: 3, min_stock: 2, max_stock: 10, unit_price: 40.00, supplier_name: 'ร้านน้ำมันจันทบุรี', supplier_phone: '0812345681' },
  ],
  customers: [
    { id: 'cust-1', full_name: 'สมชาย รักดี', phone: '0812345678', email: 'somchai@example.com', address: '123 สุขสันต์ ซอย 1 กรุงเทพฯ 10100', loyalty_points: 50 },
    { id: 'cust-2', full_name: 'สมหญิง ดีใจ', phone: '0898765432', email: 'somying@example.com', address: '456 ใหม่ ถนนเพชรบุรี กรุงเทพฯ 10400', loyalty_points: 120 },
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
        return { data: null, error: NOT_FOUND }
      }
      return { data: rows, error: null }
    }

    const builder: any = {
      eq(col: string, val: any) { filters.push({ col, val }); return builder },
      order(col: string, opts?: { ascending?: boolean }) { orderSpec = { col, ascending: opts?.ascending ?? true }; return builder },
      select() { return builder },
      insert(rows: MockRow | MockRow[]) { action = { type: 'insert', rows: Array.isArray(rows) ? rows : [rows] }; return builder },
      update(patch: MockRow) { action = { type: 'update', patch }; return builder },
      delete() { action = { type: 'delete' }; return builder },
      single() { singleMode = true; return builder },
      then(resolve: any, reject: any) { run().then(resolve, reject) },
    }
    return builder
  }

  // RPC mock — mirrors migration 007 `create_order_with_items` server-authoritative
  // contract (for client-contract tests: client payload must NOT carry financial
  // fields; server always computes from products.price / delivery rules).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function rpc(name: string, params: any): Promise<{ data: any; error: any }> {
    if (name === 'create_order_with_items') {
      const p = params ?? {}
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
    return { data: null, error: { code: 'PGRST202', message: 'rpc not mocked' } }
  }

  return { from, rpc }
}