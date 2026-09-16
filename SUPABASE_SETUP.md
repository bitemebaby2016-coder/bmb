# 🚀 Bite Me Baby — Supabase Integration Guide (v3.1)

## ✅ สิ่งที่ทำแล้ว

### 1. SQL Migration (`supabase-migration.sql`)
- ✅ Tables: `products`, `product_categories`, `delivery_rounds`, `orders`, `order_items`, `inventory`, `preorder_votes`, `profiles`
- ✅ RLS policies, triggers, functions, seed data

### 2. Environment Variables
- ✅ `.env` — Supabase URL: `https://ivkdfognyiwjcmrhcnwz.supabase.co`
- ✅ `.env.local` — Template สำหรับ API keys

### 3. Supabase Client (`src/lib/supabase.ts`)
- ✅ Public client + Admin client + Helper functions

### 4. API Layer (localStorage → Supabase)
- ✅ `bmbAdminApi_products.ts` — Products, Categories, Delivery Rounds
- ✅ `bmbAdminApi_orders.ts` — Orders, Order Items, Dashboard Stats
- ✅ `bmbAdminApi_inventory.ts` — Inventory, Low Stock Alerts

---

## 📋 Next Steps (ต้องทำต่อ)

### Step 1: รัน SQL Migration
1. เปิด https://ivkdfognyiwjcmrhcnwz.supabase.co/editor
2. Copy `supabase-migration.sql` → Paste → Run
3. ตรวจสอบ tables: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`

### Step 2: สร้าง Storage Bucket
- Name: `bmb-images`
- Policy: Public read, Authenticated write

### Step 3: ใส่ API Keys ใน `.env.local`
```env
VITE_SUPABASE_URL=https://ivkdfognyiwjcmrhcnwz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # จาก Dashboard > Settings > API
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Service role secret
```

### Step 4: สร้าง Admin User (optional)
- Authentication > Users > Add user: `admin@bmb.co.th` / `admin123`
- หรือ SQL: `INSERT INTO profiles (...) VALUES ((SELECT id FROM auth.users WHERE email = 'admin@bmb.co.th'), ...)`

### Step 5: ทดสอบ Connection
```bash
npm run dev
# Browser console: ไม่มี warning = connection สำเร็จ
```

### Step 6: Update Pages → async/await
- `MenuPage.tsx` — `getProducts()` → `await getProducts()`
- `HomePage.tsx` — `getFeaturedProducts()` → `await getFeaturedProducts()`
- `VotePage.tsx` — `createProduct()` → `await createProduct()`
- `AdminDashboard.tsx` — `getDashboardStats()` → `await getDashboardStats()`
- `AdminOrders.tsx` — `getOrders()` → `await getOrders()`
- `InventoryPage.tsx` — `getInventory()` → `await getInventory()`

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `VITE_SUPABASE_ANON_KEY not configured` | ใส่ใน `.env.local` (ไม่ใช่ `.env`) |
| `RLS policy denied` | ตรวจสอบ user login + RLS policies |
| `Table doesn't exist` | รัน `supabase-migration.sql` |
| `supabaseAdmin is null` | ไม่มี `SERVICE_ROLE_KEY` — ใช้ `supabase` (public) แทน |

---

## 📊 Database Schema

```
products ← category_id → product_categories
products ← delivery_round_id → delivery_rounds (pre-order)
orders ← customer_id → auth.users
orders ← delivery_round_id → delivery_rounds
order_items ← order_id → orders
order_items ← product_id → products
inventory (auto status: in_stock/low_stock/out_of_stock)
preorder_votes ← product_id → products
preorder_votes ← customer_id → auth.users
profiles ← id → auth.users (role: customer/admin)
```

---

## ✅ Checklist

- [ ] รัน `supabase-migration.sql`
- [ ] สร้าง Storage bucket `bmb-images`
- [ ] ใส่ API keys ใน `.env.local`
- [ ] สร้าง admin user
- [ ] ทดสอบ connection
- [ ] Update pages → async/await
- [ ] Test pre-order flow
- [ ] Test delivery round flow

---

**URLs:**
- Dashboard: https://ivkdfognyiwjcmrhcnwz.supabase.co
- SQL Editor: https://ivkdfognyiwjcmrhcnwz.supabase.co/editor
- Docs: https://supabase.com/docs

**Version:** v3.1 | **Date:** 2026-09-15