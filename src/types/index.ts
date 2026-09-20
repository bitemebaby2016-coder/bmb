// ============================================
// Core Types
// ============================================

export type PromoStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
export type PromoTrigger = 'code' | 'automatic' | 'manual_apply';
export type PromoType = 'fixed_discount' | 'percentage_discount' | 'free_shipping' | 'spend_threshold' | 'buy_x_get_y' | 'combo' | 'loyalty' | 'referral' | 'birthday' | 'flash_sale' | 'round_based';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready_for_dispatch' | 'dispatched' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled' | 'failed';
export type DeliveryMethod = 'self_delivery' | 'grab_rider' | 'linemen_rider' | 'foodpanda_rider';
export type PaymentStatus = 'pending' | 'paid' | 'refund' | 'partially_refunded';
export type PaymentMethod = 'promptpay_qr' | 'credit_card' | 'cash_on_delivery';
export type RoundPeriod = 'morning' | 'midday' | 'evening';

// ============================================
// Product & Menu Types
// ============================================

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  image_url: string;
  is_available: boolean;
  is_featured: boolean;
  is_preorder: boolean;           // ✅ v3.1: Pre-order menu (โหวต/จองล่วงหน้า)
  prep_minutes: number;
  sort_order: number;
  delivery_round_id?: string;     // ✅ v3.1: Delivery round ID (สำหรับ pre-order)
  scheduled_date?: string;        // ✅ v3.1: Scheduled delivery date (สำหรับ pre-order)
  stock?: number;                 // migration 012 — display stock (not authoritative capacity)
  rating?: number;                // migration 012 — display rating (1–5)
  review_count?: number;          // migration 012 — display review count
  addons?: ProductAddon[];        // migration 016 — add-ons / toppings (server-priced)
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  type: 'radio' | 'checkbox' | 'text';
  options: string[];
  max_selections: number;
}

// ============================================
// Order Types
// ============================================

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  delivery_round_id: string;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_latitude: number;
  dropoff_longitude: number;
  dropoff_detail: string;
  is_outside_self_zone: boolean;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  special_instructions: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  customizations: Record<string, string | string[]>;
  special_request: string;
  item_total: number;
}

export interface DeliveryRound {
  id: string;
  round_key: RoundPeriod;         // TypeScript property (DB column: 'name')
  display_name: string;
  cutoff_time: string;
  delivery_start: string;
  delivery_end: string;
  max_capacity: number;
  current_count: number;
  date: string;                   // TypeScript property (DB column: 'scheduled_date')
  status: string;
  // Note: Supabase returns DB column names as object keys:
  // - 'scheduled_date' (not 'date')
  // - 'name' (not 'round_key')
  // Access via: data.scheduled_date, data.name
}

// ============================================
// Customer Types
// ============================================

export interface Customer {
  id: string;
  email: string;
  phone: string;
  name: string;
  line_id: string;
  default_latitude: number;
  default_longitude: number;
  default_address_detail: string;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  name: string;
  phone: string;
  latitude: number;
  longitude: number;
  detail: string;
  is_default: boolean;
}

// ============================================
// Promotion Types
// ============================================

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: PromoType;
  status: PromoStatus;
  trigger: PromoTrigger;
  discount_value: number;
  max_discount_cap?: number;
  min_cart_total: number;
  usage_limit?: number;
  current_uses: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until?: string;
  is_stackable: boolean;
  priority: number;
}

export interface UserCoupon {
  id: string;
  code: string;
  promotion_id: string;
  uses_remaining: number;
  expires_at?: string;
  is_active: boolean;
}

export interface ComboSet {
  id: string;
  name: string;
  description: string;
  image_url: string;
  original_price: number;
  combo_price: number;
  max_quantity_per_order: number;
  is_available: boolean;
  valid_from: string;
  valid_until: string;
}

export interface ComboSetItem {
  id: string;
  combo_set_id: string;
  product_id: string;
  quantity: number;
}

// ============================================
// Review & Rating Types
// ============================================

export interface Review {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  rating: number; // 1-5
  comment: string;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface MenuVote {
  id: string;
  product_id: string;
  customer_id: string;
  vote_type: 'upvote' | 'downvote' | 'favorite';
  created_at: string;
}

export interface MenuPoll {
  id: string;
  title: string;
  description: string;
  options: PollOption[];
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  total_votes: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  product_id: string;
  name: string;
  image_url: string;
  vote_count: number;
}

// ============================================
// Random Menu Types
// ============================================

export interface RandomMenuDraw {
  id: string;
  customer_id: string;
  selected_product_id: string;
  discount_code: string;
  used: boolean;
  created_at: string;
}

// ============================================
// Rewards & Points Types
// ============================================

export interface LoyaltyPoint {
  id: string;
  user_id: string;
  points: number;
  points_type: 'earned' | 'redeemed' | 'expired';
  source: string;
  order_id?: string;
  expires_at?: string;
  is_used: boolean;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  user_id: string;
  points_used: number;
  reward_type: string;
  reward_value: string;
  redeemed_at: string;
  status: 'pending' | 'completed' | 'cancelled';
}

// ============================================
// Share & Viral Types
// ============================================

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referrer_reward: number;
  referred_reward: number;
  status: 'pending' | 'completed' | 'expired';
  referred_order_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface ShareEvent {
  id: string;
  user_id: string;
  platform: 'line' | 'facebook' | 'twitter' | 'whatsapp' | 'copy_link';
  content_type: 'menu' | 'order' | 'promotion' | 'profile';
  content_id: string;
  created_at: string;
}

export interface ViralActivity {
  id: string;
  name: string;
  type: 'daily_challenge' | 'streak' | 'leaderboard' | 'spin_wheel' | 'badge';
  description: string;
  points_reward: number;
  is_active: boolean;
  starts_at: string;
  ends_at?: string;
  metadata: Record<string, any>;
}

export interface ViralActivityProgress {
  id: string;
  user_id: string;
  activity_id: string;
  progress: number;
  target: number;
  completed: boolean;
  completed_at?: string;
}

// ============================================
// Inventory & Ingredient Types (NEW!)
// ============================================

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'critical';
export type IngredientUnit = 'kg' | 'g' | 'liter' | 'ml' | 'piece' | 'dozen' | 'pack' | 'bunch';

export interface Ingredient {
  id: string;
  name: string;
  category: string; // 'protein', 'vegetable', 'carbohydrate', 'sauce', 'seasoning', 'beverage', 'other'
  unit: IngredientUnit;
  current_stock: number;
  min_stock: number; // reorder point
  max_stock: number; // max capacity
  unit_price: number;
  supplier_name: string;
  supplier_phone: string;
  last_restocked_at: string;
  next_expected_date?: string;
  expiration_date?: string;
  status: InventoryStatus;
  image_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface IngredientUsage {
  id: string;
  ingredient_id: string;
  product_id: string;
  quantity_per_unit: number; // how much ingredient per product unit
  last_updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  ingredient_id: string;
  type: 'in' | 'out' | 'adjustment' | 'waste';
  quantity: number;
  reason: string;
  reference_type: 'order' | 'purchase' | 'manual' | 'waste' | 'adjustment';
  reference_id?: string;
  performed_by: string;
  performed_at: string;
}

export interface ReorderAlert {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  current_stock: number;
  min_stock: number;
  recommended_quantity: number;
  estimated_cost: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  generated_at: string;
  is_resolved: boolean;
  resolved_at?: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_name: string;
  supplier_phone: string;
  items: PurchaseOrderItem[];
  total_amount: number;
  status: 'draft' | 'pending' | 'ordered' | 'received' | 'cancelled';
  expected_date: string;
  actual_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: IngredientUnit;
  unit_price: number;
  total_price: number;
  received_quantity?: number;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 'order_status' | 'promo' | 'reminder' | 'inventory_alert' | 'achievement' | 'system';

// Event-based notification triggers for automation
export type NotificationEventType = 
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready_for_dispatch'
  | 'order_dispatched'
  | 'order_delivered'
  | 'payment_confirmed'
  | 'payment_pending'
  | 'low_stock_alert'
  | 'promotion_expired'
  | 'referral_awarded'
  | 'loyalty_points_earned'
  | 'system_announcement';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, any>;
  channel: 'push' | 'email' | 'sms' | 'line' | 'in_app';
  is_read: boolean;
  sent_at: string;
  read_at?: string;
  created_at: string;
}

// ============================================
// Delivery Zone Types
// ============================================

export interface ServiceZone {
  id: string;
  shop_name: string;
  shop_address: string;
  shop_lat: number;
  shop_lng: number;
  self_delivery_radius_km: number;
  rider_overlay_min_km: number;
  rider_overlay_max_km: number;
  min_order_amount: number;
  self_delivery_fee: number;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
}

// ============================================
// AI & SEO Types
// ============================================

export interface AIParsedOrder {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    customizations?: Record<string, string | string[]>;
  }>;
  deliveryAddress: {
    detail: string;
    latitude: number;
    longitude: number;
  };
  round?: RoundPeriod;
  specialInstructions?: string;
}

export interface DailyReport {
  date: string;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  new_customers: number;
  returning_customers: number;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  round_summary: Array<{ round: RoundPeriod; orders: number; revenue: number }>;
  low_stock_items: string[];
  insights: string[];
  generated_at: string;
}

export interface SEOMeta {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  url?: string;                 // canonical path (e.g. '/menu') for hreflang/canonical
  ogLocale?: string;
  schema: Record<string, any>;
}

// ============================================
// AI Chat Types
// ============================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================
// UI Component Types
// ============================================

export type OrderMode = 'same-day' | 'pre-order';

export type AvailabilityState =
  | 'available'
  | 'limited'
  | 'sold_out'
  | 'temporarily_unavailable'
  | 'store_closed'
  | 'delivery_unavailable';

// ============================================
// Social Proof Review Feed Types (UI v4.0)
// @see docs/COMPONENT_SPEC_UI.md §12 CustomerReviewCard + Glassmorphism Spec
// ============================================

export type SocialProofSource = 'facebook' | 'grabfood' | 'website';

export interface SocialProofReview {
  id: string;
  customerName: string;
  rating: number;              // 1-5 (curated integers — whole stars for 3D rating)
  comment: string;             // real review copy from Facebook / GrabFood
  source: SocialProofSource;
  sourceLabel: string;         // e.g. "Facebook", "GrabFood"
  dateLabel: string;           // e.g. "2 สัปดาห์ที่แล้ว"
  foodName: string;            // อะไรของร้านที่ลูกค้าสั่ง
  productId: string;           // deep link → real product (products.id)
}

export interface MenuHighlightClip {
  id: string;
  title: string;
  subtitle?: string;
  videoUrl: string;            // mp4/webm — short clip only (max 2 clips, see video policy)
  posterUrl?: string;          // WebP poster (lazy)
}

// ============================================
// Mascot "น้อง Bite" — Pose System (Mascot Asset System v1.0)
// @see docs/COMPONENT_SPEC_UI.md §18 Mascot Asset System (Scale & Placement Guide)
// ============================================

export type MascotPose =
  | 'greeting'  // ถือถาดอาหาร / กวักมือทักทาย — Hero Banner Header / Splash
  | 'heart'     // Mini Heart — Customer Review Cards (มุมการ์ดรีวิว)
  | 'thumbsup'  // การันตีความอร่อย — Featured Menu Badges
  | 'running'   // ถือกล่องอาหาร / วิ่งส่งของ — Delivery Round Cards / Tracking
  | 'pointing'  // ชี้ไปที่ปุ่ม — Call-to-Action Buttons
  | 'peeking'   // โผล่มาจากมุมการ์ด — Glassmorphism Overlay Cards
  | 'thinking'  // ถือลูกเต๋า 3D ครุ่นคิด — Random Menu Feature
  | 'empty'     // หน้าหงอย / จานว่าง — Empty Cart / Sold Out State
  | 'bye';      // โบกมือลา / ขอบคุณ — Delivery Complete / Payment Success
                // (asset: /assets/mascot/bite_good bye.webp — ตัดสินใจ 2026-09-17)

export type MascotSize = 'sm' | 'md' | 'lg' | 'fluid'

export interface FoodMenuCardProps {
  product: Product;
  category?: ProductCategory;
  mode: OrderMode;
  availability: AvailabilityState;
  studioImageUrl?: string;
  onSameDayOrder: (payload: SameDayOrderPayload) => void;
  onPreOrder: (payload: PreOrderPayload) => void;
}

export interface SameDayOrderPayload {
  productId: string;
  quantity: number;
  timestamp: string;
  availabilitySnapshot: {
    isAvailable: boolean;
    engineState: AvailabilityState;
    source: string;
    snapshotAt: string;
  };
}

export interface PreOrderPayload {
  productId: string;
  quantity: number;
  deliveryRoundId: string;
  scheduledDate: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  customizations: Record<string, string | string[]>;
  subtotal: number;
}

export interface CartState {
  items: CartItem[];
  couponCode: string;
  appliedPromotion: Promotion | null;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export interface UIConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  shadow: string;
}

export const UI_CONFIG: UIConfig = {
  primaryColor: '#F97316',    // ส้มหลัก (Bite Me Baby brand)
  secondaryColor: '#FBBF24',  // เหลือง (secondary)
  accentColor: '#92400E',     // น้ำตาลเข้ม (text/accents)
  bgColor: '#FFF7ED',         // Cream/Beige background
  textColor: '#1C1917',       // Dark text
  fontFamily: "'Nunito', 'Quicksand', sans-serif",
  borderRadius: '16px',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
}
// ============================================
// HOME UI/UX v5 — Data Contracts (View Model)
// Mock providers feed these → real provider (Supabase/Admin) later WITHOUT UI change.
// ============================================

export type HomeMode = 'same-day' | 'pre-order'

export interface HomeProduct {
  id: string
  name: string
  image: string
  price: number
  description: string
  category_id: string
  categoryName?: string
  categoryIcon?: string
  mode: HomeMode
  availability: AvailabilityState
  stock?: number
  badge?: string
  rating?: number
  reviewCount?: number
  cta: string
  scheduledDate?: string // pre-order only
}

export interface HomeReview {
  id: string
  displayName: string
  rating: number
  text: string
  source: 'grabfood' | 'facebook' | 'website'
  sourceLabel: string
  dateLabel: string
  image?: string
  relatedProduct?: Product
  relatedProductName?: string
  visible: boolean
}

export interface HomePromotion {
  id: string
  title: string
  description: string
  image?: string
  coupon?: string
  expiry?: string
  eligibility?: string
  cta: string
}

export interface StoreStatus {
  isOpen: boolean
  state: 'open' | 'same_day_closed' | 'preorder_only' | 'closed'
  currentRoundLabel?: string
  cutoff?: string
  deliveryWindowLabel?: string
  capacityPct?: number
  message: string
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  to: string
  mascotPose?: MascotPose
}

export interface BiteMessage {
  greeting: string
  statusLine: string
  recommendLabel: string
  quickActions: QuickAction[]
}

export interface BiteContext {
  storeStatus: StoreStatus
  sameDayCount: number
  preOrderCount: number
}