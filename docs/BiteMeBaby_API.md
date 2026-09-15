# API & Internal Module Reference — เอกสารอ้างอิง API และโมดูลภายใน

## ภาพรวม
Bite Me Baby ใช้ **localStorage-based storage layer** เป็นหลัก (ในระยะพัฒนา) แทน Supabase ซึ่งเป็นแผน future-state

> **หมายเหตุจาก Code จริง:** ไฟล์ `supabase.ts` มีอยู่แต่ใช้งานจริงใน `bmbAdminApi_*.ts` และ `storage.ts` ใช้ localStorage แทน

## Storage Layer — ชั้นการจัดเก็บข้อมูล

### bmbStorage.ts
```typescript
Prefix: 'bmb_' (ป้องกัน collision กับโปรเจกต์อื่น)
```

#### ฟังก์ชันหลัก

| Function | คำอธิบาย | ไฟล์ |
|----------|---------|------|
| `storageGet<T>(key, defaultValue)` | อ่านค่าจาก localStorage | `src/lib/bmbStorage.ts` |
| `storageSet<T>(key, value)` | เขียนค่าไปยัง localStorage | `src/lib/bmbStorage.ts` |
| `storageRemove(key)` | ลบค่าจาก localStorage | `src/lib/bmbStorage.ts` |
| `storageClear()` | ล้างทุกค่าที่ขึ้น `bmb_` prefix | `src/lib/bmbStorage.ts` |
| `fileToBase64(file)` | แปลงไฟล์เป็น Base64 (upload helper) | `src/lib/bmbStorage.ts` |
| `generateId(prefix)` | สร้าง ID แบบ unique | `src/lib/bmbStorage.ts` |
| `hashPassword(password)` | Hash รหัสผ่าน (NOT production-grade) | `src/lib/bmbStorage.ts` |
| `verifyPassword(password, hash)` | ตรวจสอบรหัสผ่าน | `src/lib/bmbStorage.ts` |

#### Keys ที่ใช้ใน localStorage

| Key | วัตถุประสงค์ | จากไฟล์ |
|-----|-------------|------|
| `bmb_orders` | เก็บออเดอร์ทั้งหมด | `bmbAdminApi_orders.ts` |
| `bmb_products` | เก็บสินค้า/เมนู | `bmbAdminApi_products.ts` |
| `bmb_categories` | เก็บหมวดหมู่ | `bmbAdminApi_products.ts` |
| `bmb_inventory` | เก็บสินค้าคงเหลือ | `bmbAdminApi_inventory.ts` |
| `bmb_users` | เก็บข้อมูลผู้ใช้ | `bmbAdminApi_users.ts` |
| `bmb_auth` | เก็บสถานะ auth | `authStore.ts` |

---

## Order API (`bmbAdminApi_orders.ts`)

### Interface: OrderForm

```typescript
export interface OrderForm {
  id?: string
  order_number: string
  customer_id: string
  customer_name: string
  customer_phone: string
  delivery_round: string
  status: string
  total_amount: number
  delivery_fee: number
  payment_method: string
  payment_status: string
  delivery_address: string
  dropoff_latitude: number
  dropoff_longitude: number
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
  }>
  created_at: string
  updated_at: string
}
```

### Functions

| Function | Parameters | Returns | คำอธิบาย |
|----------|------------|---------|---------|
| `getOrders()` | none | `OrderForm[]` | ดึงออเดอร์ทั้งหมด |
| `getOrder(orderNumber)` | `orderNumber: string` | `OrderForm \| undefined` | ค้นหาออเดอร์ |
| `createOrder(data)` | `data: OrderForm` | `OrderForm` | สร้างออเดอร์ใหม่ |
| `updateOrderStatus(orderNumber, status)` | `orderNumber: string, status: string` | `OrderForm \| null` | อัปเดตสถานะออเดอร์ |
| `updateOrderPayment(orderNumber, paymentStatus)` | `orderNumber: string, paymentStatus: string` | `OrderForm \| null` | อัปเดตสถานะการชำระเงิน |

### Order Status Values

```
pending → confirmed → preparing → ready_for_dispatch → dispatched → in_transit → arrived → delivered
                                                               → cancelled / failed
```

---

## Product API (`bmbAdminApi_products.ts`)

### Interface: ProductForm

```typescript
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
```

### Functions

| Function | Parameters | Returns | คำอธิบาย |
|----------|------------|---------|---------|
| `getProducts()` | none | `Product[]` | ดึงสินค้าทั้งหมด (พร้อม seed data 4 รายการ) |
| `getProduct(id)` | `id: string` | `Product \| undefined` | ค้นหาสินค้า |
| `createProduct(data)` | `data: ProductForm` | `Product` | สร้างสินค้า |
| `updateProduct(id, data)` | `id: string, data: Partial<ProductForm>` | `Product \| null` | อัปเดตสินค้า |
| `deleteProduct(id)` | `id: string` | `boolean` | ลบสินค้า |
| `getCategories()` | none | `ProductCategory[]` | ดึงหมวดหมู่ (พร้อม seed data 5 หมวด) |

---

## Inventory API (`bmbAdminApi_inventory.ts`)

### Functions

| Function | Parameters | Returns | คำอธิบาย |
|----------|------------|---------|---------|
| `getInventory()` | none | `Ingredient[]` | ดึงสินค้าคงเหลือทั้งหมด (พร้อม seed data 4 รายการ) |
| `getInventoryByName(name)` | `name: string` | `Ingredient \| undefined` | ค้นหาด้วยชื่อ |
| `createInventory(data)` | `data: InventoryForm` | `Ingredient` | เพิ่มสินค้าคงเหลือ |
| `updateInventoryStock(id, quantity, reason)` | `id, quantity, reason` | `Ingredient \| null` | ปรับปรุง stock |
| `deleteInventory(id)` | `id: string` | `boolean` | ลบสินค้าคงเหลือ |
| `getLowStockAlerts()` | none | `Ingredient[]` | แจ้งเตือน stock ต่ำ |

### Seed Inventory

- ing-1: ข้าว (10 kg, status: in_stock)
- ing-2: ไก่ (5 kg, status: in_stock)
- ing-3: ไข่ไก่ (2 piece, status: low_stock)
- ing-4: น้ำมัน (3 liter, status: in_stock)

---

## User API (`bmbAdminApi_users.ts`)

### Interface: User

```typescript
export interface User {
  id: string
  email: string
  phone: string
  name: string
  password_hash: string
  role: 'customer' | 'admin'
  is_active: boolean
  created_at: string
}
```

### Functions

| Function | Parameters | Returns | คำอธิบาย |
|----------|------------|---------|---------|
| `getUsers()` | none | `User[]` | ดึงผู้ใช้ทั้งหมด |
| `getUserByEmail(email)` | `email: string` | `User \| undefined` | ค้นหาด้วย email |
| `getUserByPhone(phone)` | `phone: string` | `User \| undefined` | ค้นหาด้วย phone |
| `getUserById(id)` | `id: string` | `User \| undefined` | ค้นหาด้วย ID |
| `createUser(data)` | `data` | `User \| null` | สร้างผู้ใช้ใหม่ |
| `authenticateUser(email, password)` | `email, password` | `User \| null` | Auth ด้วย email |
| `authenticateUserByPhone(phone, password)` | `phone, password` | `User \| null` | Auth ด้วย phone |
| `updateUser(id, data)` | `id, data` | `User \| null` | อัปเดตข้อมูล |
| `initializeAdmin()` | none | `void` | สร้าง admin เริ่มต้น |
| `getDashboardStats()` | none | `DashboardStats` | สถิติแดชบอร์ด |

### Auto-Initialize Admin

```
email: admin@bmb.co.th
phone: 0812345678
password: admin123
id: admin-001
role: admin
```

---

## Dashboard Stats

| Metric | คำอธิบาย |
|--------|---------|
| `todayOrders` | ออเดอร์วันนี้ |
| `todayRevenue` | รายได้วันนี้ |
| `pendingOrders` | ออเดอร์ที่รอดำเนินการ |
| `completionRate` | อัตราการสำเร็จ (%) |
| `lowStockItems` | จำนวนสินค้าใกล้หมด |
| `totalOrders` | ออเดอร์ทั้งหมด |
| `totalRevenue` | รายได้ทั้งหมด |
| `totalCustomers` | ลูกค้าทั้งหมด |
| `createCategory(data)` | `data: CategoryForm` | `ProductCategory` | สร้างหมวดหมู่ |
| `updateCategory(id, data)` | `id: string, data: Partial<CategoryForm>` | `ProductCategory \| null` | อัปเดตหมวดหมู่ |

---

## AI Service (`aiService.ts`)

### OpenRouter Integration

| Configuration | Value |
|--------------|-------|
| API URL | `https://openrouter.ai/api/v1/chat/completions` |
| API Key | Hardcoded — ควรย้ายเป็น env variable |
| Model | `google/gemini-2.0-flash-lite:free` |
| Max Tokens | 500 |
| Temperature | 0.7 |
| History | Last 10 messages + system prompt |

### Functions

| Function | Parameters | Returns | คำอธิบาย |
|----------|------------|---------|---------|
| `chatWithAI(userMessage)` | `userMessage: string` | `Promise<string>` | ส่งข้อความไปยัง AI |
| `resetConversation()` | none | `void` | รีเซตการสนทนา |
| `getConversationHistory()` | none | `Message[]` | ดึงประวัติการสนทนา |

### AI Persona

```
ชื่อ: Bime (บีมี)
ภาษา: ไทย
บุคลิกภาพ: Friendly, เป็นมิตร
หน้าที่:
- แนะนำเมนูและร้านอาหาร
- ตอบคำถามเกี่ยวกับการจัดส่ง
- ช่วยเลือกอาหารตามความชอบ
```

---

## Utilities (`utils.ts`)

| Function | คำอธิบาย |
|----------|---------|
| `formatCurrency(amount)` | จัดรูปแบบสกุลเงิน (THB, th-TH) |
| `formatDate(date)` | จัดรูปแบบวันที่ |
| `formatTime(date)` | จัดรูปแบบเวลา |
| `formatDateTime(date)` | จัดรูปแบบวันที่และเวลา |
| `calculateDistance(lat1, lon1, lat2, lon2)` | คำนวณระยะห่าง (กม.) |
| `isWithinRadius(...)` | ตรวจสอบอยู่ในรัศมีหรือไม่ |
| `generateOrderNumber()` | สร้างเลขที่ออเดอร์ (BM-YYYYMMDD-XXX) |
| `debounce(func, wait)` | Debounce function |
| `truncateText(text, maxLength)` | ย่อข้อความ |
| `getStars(rating)` | แสดงดาว rating |

---

## State Stores

### authStore.ts
- จัดการสถานะ authentication (customer, isAuthenticated, isLoading, loyaltyPoints, referralCode)
- Actions: login, loginByPhone, logout, checkAuth
- Storage: localStorage 'bmb_auth'

### cartStore.ts
- จัดการตะกร้าสินค้า (items, couponCode, appliedPromotion, subtotal, discount, deliveryFee, total)
- Actions: addItem, removeItem, updateQuantity, clearCart, recalculate

### inventoryStore.ts
- จัดการสินค้าคงเหลือ (admin panel)

### rewardsStore.ts
- จัดการระบบคะแนนสะสมและรางวัล (loyaltyPoints, totalEarned, totalRedeemed, pointsHistory, badges, streakDays)
- Actions: addPoints, redeemPoints, updateActivityProgress, completeActivity, addBadge, updateStreak, resetStreak

---

## Router Routes

| Path | Component | Auth Required | คำอธิบาย |
|------|-----------|---------------|---------|
| `/` | HomePage | No | หน้าแรก |
| `/login` | LoginPage | No | หน้าเข้าสู่ระบบ |
| `/register` | RegisterPage | No | หน้าลงทะเบียน |
| `/menu` | MenuPage | No | หน้าเมนู |
| `/cart` | CartPage | No | ตะกร้าสินค้า |
| `/checkout` | CheckoutPage | No | หน้าชำระเงิน |
| `/track/:orderNumber` | OrderTrackPage | No | ติดตามออเดอร์ |
| `/profile` | ProfilePage | Yes | ประวัติส่วนตัว |
| `/rewards` | RewardsPage | Yes | รางวัล |
| `/viral` | ViralPage | Yes | หน้าร่วมสร้างเนื้อหา |
| `/promotions` | PromotionsPage | No | โปรโมชั่น |
| `/reviews/:productId` | ReviewPage | No | รีวิว |
| `/vote` | VotePage | No | โหวตเมนู |
| `/random-menu` | RandomMenuPage | No | สุ่มเมนู |
| `/share` | SharePage | No | แชร์/เชิญ |
| `/ai-chat` | AiChatPage | Yes | แชทกับ AI |
| `/admin` | AdminDashboard | Admin | แดชบอร์ดผู้ดูแล |
| `/admin/inventory` | InventoryPage | Admin | จัดการสินค้าคงเหลือ |
| `/admin/orders` | AdminOrders | Admin | จัดการออเดอร์ |
| `/admin/products` | AdminProducts | Admin | จัดการสินค้า |

---

## SEO Configuration (`seo.ts`)

| Function | Page | Title |
|----------|------|-------|
| `getHomeMeta()` | Home | "Bite Me Baby - สั่งอาหารจัดส่งเมืองจันทบุรี รัศมี 5 กม." |
| `getMenuMeta()` | Menu | "เมนู - Bite Me Baby \| อาหารจัดส่งจันทบุรี" |
| `getProfileMeta()` | Profile | "โปรไฟล์ - Bite Me Baby" |
| `getAdminMeta()` | Admin | "Admin Dashboard - Bite Me Baby" |
| `deleteCategory(id)` | `id: string` | `boolean` | ลบหมวดหมู่ |

### Seed Products

- prod-1: ผัดไทยกุ้งสด (65 บาท, จานเดียว)
- prod-2: ข้าวหมูทอดกระเทียม (70 บาท, ข้าว)
- prod-3: แกงเขียวหวานไก่ (75 บาท, แกง)
- prod-4: กาแฟเย็น (35 บาท, เครื่องดื่ม)

### Seed Categories

- cat-1: จานเดียว (🍜)
- cat-2: ข้าว (🍚)
- cat-3: แกง (🍛)
- cat-4: เครื่องดื่ม (🥤)
- cat-5: ของหวาน (🍰)

