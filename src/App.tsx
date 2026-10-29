import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { useAuthStore, probeProfileRole } from './store/authStore'
import { isAdminCapableRole } from './lib/adminUi'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminNav } from './components/admin/AdminNav'
// Bite / AI accessibility lives in BottomNav ('Bite' → /ai-chat) + BiteHero quick actions (UI v5)
import { SeoHelmet, TrackOrderSeo, ReviewDetailSeo, PaymentSeo } from './components/SeoHelmet'
import { MascotBadge } from './components/MascotBadge'
import { getHomeMeta, getShopMeta, getMenuMeta, getCartMeta, getCheckoutMeta, getOrdersMeta, getNotificationsMeta, getReviewsMeta, getAboutMeta, getFaqMeta, getBlogMeta, getContactMeta, getPrivacyMeta, getTermsMeta, getPromotionsMeta, getRewardsMeta, getVoteMeta, getRandomMenuMeta, getShareMeta, getViralMeta, getProfileMeta, getAdminMeta, getLoginMeta } from './lib/seo'
import { BrandProvider } from './components/BrandProvider'
import { subscribeSeoSettings, getSeoSettingsVersion } from './lib/seoSettings'
import { subscribeSocialLinks, getSocialVersion } from './lib/socialLinks'
import { useAdminTenantContextStore } from './lib/adminTenantContext'
// N3 (R19 · QA 1.6): listener auth กลาง — SIGNED_OUT → clear + /login · TOKEN_REFRESHED → refreshRole
import { AuthSessionSync } from './components/AuthSessionSync'
// R21 · เฟส 1 A1: AdminRoute ต้องฟ้องเมื่อ probe สิทธิ์ล้มเหลว (ห้ามเตะ admin ออก)
import { LoadErrorBanner } from './components/ui/LoadErrorBanner'
import { listTenants } from './lib/adminTenantApi'

// Core page (must load immediately — it is the LCP page)
import { HomePage } from './pages/HomePage'

// ⚡ PERF (2026-09-17): all non-home pages are now code-split (React.lazy) to keep
// the initial JS bundle small. bcryptjs is also a dynamic import now (see bmbStorage).
const MenuPage = lazy(() => import('./pages/MenuPage').then(m => ({ default: m.MenuPage })))
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })))
const OrderTrackPage = lazy(() => import('./pages/OrderTrackPage').then(m => ({ default: m.OrderTrackPage })))
const OrdersPage = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })))
const PromotionsPage = lazy(() => import('./pages/PromotionsPage').then(m => ({ default: m.PromotionsPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then(m => ({ default: m.ReviewPage })))
const VotePage = lazy(() => import('./pages/VotePage').then(m => ({ default: m.VotePage })))
const RandomMenuPage = lazy(() => import('./pages/RandomMenuPage').then(m => ({ default: m.RandomMenuPage })))
const SharePage = lazy(() => import('./pages/SharePage').then(m => ({ default: m.SharePage })))
const LoginPage = lazy(() => import('./pages/login/LoginPage').then(m => ({ default: m.LoginPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const RegisterPage = lazy(() => import('./pages/login/RegisterPage').then(m => ({ default: m.RegisterPage })))
const PaymentConfirmationPage = lazy(() => import('./pages/PaymentConfirmationPage').then(m => ({ default: m.PaymentConfirmationPage })))

// Lazy loaded: Admin routes (12 pages)
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage').then(m => ({ default: m.InventoryPage })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })))
const MenuScheduleRedirect = () => <Navigate to="/admin/products?tab=schedule" replace />
const AdminKitchen = lazy(() => import('./pages/admin/AdminKitchen').then(m => ({ default: m.AdminKitchen })))
const AdminRecipes = lazy(() => import('./pages/admin/AdminRecipes').then(m => ({ default: m.AdminRecipes })))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotifications').then(m => ({ default: m.AdminNotificationsPage })))
const DeliveryManagement = lazy(() => import('./pages/admin/DeliveryManagement').then(m => ({ default: m.DeliveryManagement })))
// D1 (Owner 2026-10-25): lazy ที่ไม่มี route ใช้ถูกถอดออก — component จริง import ตรงใน AdminHubs
// R4 (2026-10-23): Hubs ยุบรวมหน้าจอแอดมินที่ฟีเจอร์ซ้ำ/ใกล้เคียง (logic เดิมไม่ถูกแตะ)
const OrdersHub = lazy(() => import('./components/admin/AdminHubs').then(m => ({ default: m.OrdersHub })))
const DeliveryHub = lazy(() => import('./components/admin/AdminHubs').then(m => ({ default: m.DeliveryHub })))
const SettingsHub = lazy(() => import('./components/admin/AdminHubs').then(m => ({ default: m.SettingsHub })))
const MenuHub = lazy(() => import('./components/admin/AdminHubs').then(m => ({ default: m.MenuHub })))
const OrgHub = lazy(() => import('./components/admin/AdminHubs').then(m => ({ default: m.OrgHub })))
// [Task 2 · T2-b] Onboarding Wizard — เปิดร้านใหม่ (tenant+brand) ที่เดียวจบ
const AdminOnboarding = lazy(() => import('./pages/admin/AdminOnboarding').then(m => ({ default: m.AdminOnboarding })))
// [Task 2] Billing — หน้าดูงวดบริการร้านพาร์ทเนอร์ (billing_subscriptions · m175)
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling').then(m => ({ default: m.AdminBilling })))
const AdminPromotions = lazy(() => import('./pages/admin/AdminPromotions').then(m => ({ default: m.AdminPromotions })))
// D2 (2026-10-25): AdminRounds เป็นแท็บใน DeliveryHub (/admin/delivery?tab=rounds) — ไม่มี route ตรงแล้ว
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })))
const AdminMedia = lazy(() => import('./pages/admin/AdminMedia').then(m => ({ default: m.AdminMedia })))
// C7/Q4: AdminAssetAudit ถูกรวมเป็นแท็บใน AdminMedia (?tab=audit) — ไม่มี lazy route แล้ว

// Lazy loaded: Protected pages (4 pages)
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const RewardsPage = lazy(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })))
const ViralPage = lazy(() => import('./pages/ViralPage').then(m => ({ default: m.ViralPage })))
const TalkToBitePage = lazy(() => import('./pages/TalkToBitePage').then(m => ({ default: m.TalkToBitePage })))
const TalkToBiteHomePage = lazy(() => import('./pages/TalkToBiteHomePage').then(m => ({ default: m.TalkToBiteHomePage })))
const VoiceDemoPage = lazy(() => import('./pages/VoiceDemoPage').then(m => ({ default: m.VoiceDemoPage })))
const RiderPwaPage = lazy(() => import('./pages/RiderPwaPage').then(m => ({ default: m.RiderPwaPage })))
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })))
const AdminErrorsPage = lazy(() => import('./pages/admin/AdminErrorsPage').then(m => ({ default: m.AdminErrorsPage })))
// D1: MascotSettingsPage/AdminPaymentExceptions/AdminPrintSettings lazy ถูกถอด (ใช้ใน AdminHubs ตรง ๆ)
const AdminMarketing = lazy(() => import('./pages/admin/AdminMarketing').then(m => ({ default: m.AdminMarketing })))
const AdminPortfolioPage = lazy(() => import('./pages/admin/AdminPortfolio').then(m => ({ default: m.AdminPortfolioPage })))
// C7/Q5: AdminAiStudio ถูกรวมเป็นแท็บใน AdminMarketing (แท็บ 'ai') — ไม่มี lazy route แล้ว
// BACKEND-CAPABILITY-CLOSURE-2026-10-19: Web POS + Finance reports + Printer settings
const AdminPos = lazy(() => import('./pages/admin/AdminPos').then(m => ({ default: m.AdminPos })))
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })))
// D1: AdminPrintSettings lazy ถูกถอดแล้วด้านบน (ใช้ใน AdminHubs)

// Lazy loaded: Info pages (6 pages)
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })))
const FaqPage = lazy(() => import('./pages/FaqPage').then(m => ({ default: m.FaqPage })))
const BlogPage = lazy(() => import('./pages/BlogPage').then(m => ({ default: m.BlogPage })))
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))

// Loading component for Suspense — มาสคอตน้อง Bite รอโหลด (แทน spinner วงกลม)
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
      <MascotBadge pose="ready" size="md" alt="น้อง Bite กำลังโหลด" className="animate-bounce" loading="eager" />
      <span className="text-sm text-brand-muted">น้อง Bite กำลังจัดเตรียมของ…</span>
    </div>
  )
}

// F-02 FIX (Wave 1): ProtectedRoute รอ session restore (isInitializing) ก่อนตัดสิน
// — reload ต้องไม่พาผู้ใช้ไป /login ขณะ Supabase กำลัง restore session
// Launch-closure: ส่ง `from` เพื่อพาผู้ใช้กลับหน้าที่ตั้งใจหลัง login (case B/D)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const location = useLocation()
  if (isInitializing) return <LoadingSpinner />
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  return <>{children}</>
}


// P0-3 FIX: AdminRoute ตรวจ role จาก DB (profiles) ผ่าน RLS
// F-02 FIX (Wave 1): รอ isInitializing ก่อน — reload/deep-link /admin/* ต้องคง
// session จาก Supabase Auth (persistSession) ไม่ redirect ไป /login ระหว่าง restore
// R21 · เฟส 1 A1/A2/A6:
//   A1 = probeProfileRole() คืน 3 สถานะ — เน็ตขัดข้องห้ามเตะ admin ออก (โชว์ banner ลองใหม่)
//   A2 = ส่ง state.from เหมือน ProtectedRoute — deep-link /admin/orders?tab=x กลับหลัง login
//   A6 = store มี role อยู่แล้ว → เข้าหน้าทันที + verify background (ไม่กระพริบ spinner)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const storeRole = useAuthStore((s) => s.role)
  const setStoreRole = useAuthStore((s) => s.setRole)
  const location = useLocation()
  const [probeDone, setProbeDone] = useState(false)
  const [probeError, setProbeError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (isInitializing) return
    if (!isAuthenticated) { setProbeDone(true); setProbeError(false); return }
    probeProfileRole().then((probe) => {
      if (cancelled) return
      if (probe.status === 'ok') {
        const r = probe.role
        setStoreRole(r) // 146: sync เข้า store ด้วย — AdminNav ใช้ role นี้ซ่อนเมนูตามสิทธิ์ (per-role nav)
        setProbeError(false)
      } else {
        // A1: "โหลดไม่ได้" ต่างจาก "ไม่มีสิทธิ์" — เก็บ role เดิมไว้ ห้าม Navigate เตะออก
        console.error('[AdminRoute] role probe failed:', probe.message)
        setProbeError(true)
      }
      setProbeDone(true)
    })
    return () => { cancelled = true }
  }, [isAuthenticated, isInitializing, setStoreRole, retryKey])

  if (isInitializing) return <LoadingSpinner />
  if (!isAuthenticated) {
    // A2 (R21): เก็บเส้นทางที่ตั้งใจไว้ — หลัง login กลับหน้าเดิม (รวม query string)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  // A6 (R21): store มี role แล้ว → ผ่านเลย (probe background ยังวิ่ง — ไม่กระพริบ spinner)
  const role = storeRole
  if (!probeDone && !role) return <LoadingSpinner />
  // A1: โหลด role ไม่สำเร็จ + ไม่มี role เก่า → ฟ้อง + ลองใหม่ได้ (ห้ามเงียบ/เตะออก)
  if (probeError && !role) {
    return (
      <div className="p-4">
        <LoadErrorBanner
          message='ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ — ตรวจสอบการเชื่อมต่อแล้วกด "ลองใหม่"'
          onRetry={() => { setProbeDone(false); setProbeError(false); setRetryKey((n) => n + 1) }}
          testId="admin-route-role-error"
        />
      </div>
    )
  }
  // 146 (Owner signed P1): 11 admin-capable roles (rider/customer ไม่ผ่าน)
  if (!isAdminCapableRole(role)) return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  // R12 (Owner 2026-10-28): SEO copy/social ใช้ค่าจริงจาก business_settings —
  // subscribe → re-render meta/JSON-LD ทันทีเมื่อค่าจริง (ก admin แก้) เปลี่ยน
  useSyncExternalStore(
    (cb) => {
      const u1 = subscribeSeoSettings(cb)
      const u2 = subscribeSocialLinks(cb)
      return () => { u1(); u2() }
    },
    () => `seo:${getSeoSettingsVersion()}:social:${getSocialVersion()}`,
  )
  return (
    <BrandProvider>
    <HelmetProvider>
      <ErrorBoundary>
        {/* N3: auth session sync กลาง (mount ครั้งเดียว · ไม่ render อะไร) */}
        <AuthSessionSync />
        {/* SEO Helmet — per-page meta tags */}
        <Routes>
        <Route path="/" element={<SeoHelmet seo={getHomeMeta()} />} />
        {/* P0 fix: /shop must be registered in EVERY <Routes> block — a block
            with no match logs "No routes matched location" (production warning). */}
        <Route path="/shop" element={<SeoHelmet seo={getShopMeta()} />} />
        <Route path="/menu" element={<SeoHelmet seo={getMenuMeta()} />} />
        <Route path="/cart" element={<SeoHelmet seo={getCartMeta()} />} />
        <Route path="/checkout" element={<SeoHelmet seo={getCheckoutMeta()} />} />
        <Route path="/track/:orderNumber" element={<TrackOrderSeo />} />
        <Route path="/payment/:orderNumber" element={<PaymentSeo />} />
        <Route path="/about" element={<SeoHelmet seo={getAboutMeta()} />} />
        <Route path="/faq" element={<SeoHelmet seo={getFaqMeta()} />} />
        <Route path="/blog" element={<SeoHelmet seo={getBlogMeta()} />} />
        <Route path="/contact" element={<SeoHelmet seo={getContactMeta()} />} />
        <Route path="/privacy" element={<SeoHelmet seo={getPrivacyMeta()} />} />
        <Route path="/terms" element={<SeoHelmet seo={getTermsMeta()} />} />
        <Route path="/promotions" element={<SeoHelmet seo={getPromotionsMeta()} />} />
        <Route path="/rewards" element={<SeoHelmet seo={getRewardsMeta()} />} />
        <Route path="/vote" element={<SeoHelmet seo={getVoteMeta()} />} />
        <Route path="/random-menu" element={<SeoHelmet seo={getRandomMenuMeta()} />} />
        <Route path="/share" element={<SeoHelmet seo={getShareMeta()} />} />
        <Route path="/viral" element={<SeoHelmet seo={getViralMeta()} />} />
        <Route path="/profile" element={<SeoHelmet seo={getProfileMeta()} />} />
        <Route path="/admin/*" element={<SeoHelmet seo={getAdminMeta()} />} />
        <Route path="/login" element={<SeoHelmet seo={getLoginMeta()} />} />
        <Route path="/register" element={<SeoHelmet seo={getLoginMeta()} />} />
        {/* Account/UGC routes — meta was missing entirely (no SeoHelmet entry) */}
        <Route path="/orders" element={<SeoHelmet seo={getOrdersMeta()} />} />
        <Route path="/notifications" element={<SeoHelmet seo={getNotificationsMeta()} />} />
        <Route path="/reviews" element={<SeoHelmet seo={getReviewsMeta()} />} />
        <Route path="/reviews/:productId" element={<ReviewDetailSeo />} />
      </Routes>
      
      <Routes>
        {/* Public Routes — Home eager (LCP); the rest Suspense-wrapped lazy chunks */}
        <Route path="/" element={<Suspense fallback={<LoadingSpinner />}><Layout><TalkToBiteHomePage /></Layout></Suspense>} />
        <Route path="/shop" element={<Suspense fallback={<LoadingSpinner />}><Layout><HomePage /></Layout></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav={true}><LoginPage /></Layout></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav={true}><RegisterPage /></Layout></Suspense>} />
      {/* P1/SF-04 — ตั้งรหัสผ่านใหม่หลังกดลิงก์จากอีเมล (ไม่ครอบ ProtectedRoute:
          ผู้ใช้มี session ชั่วคราวจากลิงก์อีเมลและ detectSessionInUrl จะแปลงให้เอง) */}
      <Route path="/reset-password" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav={true}><ResetPasswordPage /></Layout></Suspense>} />
        <Route path="/menu" element={<Suspense fallback={<LoadingSpinner />}><Layout><MenuPage /></Layout></Suspense>} />
        <Route path="/cart" element={<Suspense fallback={<LoadingSpinner />}><Layout><CartPage /></Layout></Suspense>} />
        <Route path="/checkout" element={<Suspense fallback={<LoadingSpinner />}><Layout><CheckoutPage /></Layout></Suspense>} />
        <Route path="/track" element={<Suspense fallback={<LoadingSpinner />}><Layout><OrderTrackPage /></Layout></Suspense>} />
        <Route path="/track/:orderNumber" element={<Suspense fallback={<LoadingSpinner />}><Layout><OrderTrackPage /></Layout></Suspense>} />
        <Route path="/orders" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><OrdersPage /></Layout></ProtectedRoute></Suspense>} />
        {/* Phase 3B: legacy /profile/orders link — canonical history lives at /orders */}
        <Route path="/profile/orders" element={<Navigate to="/orders" replace />} />
        <Route path="/payment/:orderNumber" element={<Suspense fallback={<LoadingSpinner />}><Layout><PaymentConfirmationPage /></Layout></Suspense>} />
        <Route path="/promotions" element={<Suspense fallback={<LoadingSpinner />}><Layout><PromotionsPage /></Layout></Suspense>} />
        <Route path="/reviews" element={<Suspense fallback={<LoadingSpinner />}><Layout><ReviewPage /></Layout></Suspense>} />
        <Route path="/reviews/:productId" element={<Suspense fallback={<LoadingSpinner />}><Layout><ReviewPage /></Layout></Suspense>} />
        <Route path="/vote" element={<Suspense fallback={<LoadingSpinner />}><Layout><VotePage /></Layout></Suspense>} />
        <Route path="/random-menu" element={<Suspense fallback={<LoadingSpinner />}><Layout><RandomMenuPage /></Layout></Suspense>} />
        <Route path="/share" element={<Suspense fallback={<LoadingSpinner />}><Layout><SharePage /></Layout></Suspense>} />
        
        {/* Info Pages (SEO/GEO/AEO) — Lazy Loaded */}
        <Route path="/about" element={<Suspense fallback={<LoadingSpinner />}><Layout><AboutPage /></Layout></Suspense>} />
        <Route path="/faq" element={<Suspense fallback={<LoadingSpinner />}><Layout><FaqPage /></Layout></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<LoadingSpinner />}><Layout><BlogPage /></Layout></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={<LoadingSpinner />}><Layout><ContactPage /></Layout></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<LoadingSpinner />}><Layout><PrivacyPage /></Layout></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<LoadingSpinner />}><Layout><TermsPage /></Layout></Suspense>} />
        
        {/* Protected Routes — Lazy Loaded */}
        <Route path="/profile" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute></Suspense>} />
        <Route path="/notifications" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><NotificationCenterPage /></Layout></ProtectedRoute></Suspense>} />
        <Route path="/rewards" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><RewardsPage /></Layout></ProtectedRoute></Suspense>} />
        <Route path="/viral" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><ViralPage /></Layout></ProtectedRoute></Suspense>} />
        
        {/* AI Routes — Lazy Loaded */}
        {/* Talk to Bite is the unified AI-Waiter experience. Public route so guests
            get safe capabilities (chat/menu/recommend); personal actions prompt
            auth inside the conversation. Legacy /ai-chat redirects here. */}
        <Route path="/talk-to-bite" element={<Suspense fallback={<LoadingSpinner />}><Layout><TalkToBitePage /></Layout></Suspense>} />
        <Route path="/ai-chat" element={<Navigate to="/talk-to-bite" replace />} />
        <Route path="/voice-demo" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><VoiceDemoPage /></Layout></ProtectedRoute></Suspense>} />
        
        {/* Ops Routes — Rider PWA (public demo) + Admin Control (admin-only) */}
        <Route path="/rider" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav><RiderPwaPage /></Layout></Suspense>} />
        <Route path="/admin/control" element={<Navigate to="/admin" replace />} />
        
        {/* Admin Routes — Lazy Loaded (AdminNav = persistent admin sidebar across every /admin page) */}
        <Route path="/admin" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminDashboard /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/inventory" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><InventoryPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/orders" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><OrdersHub /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/products" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><MenuHub /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/menu-schedule" element={<MenuScheduleRedirect />} />
        {/* Phase 4 (RC-6): /admin/pre-orders = redirect ไป AdminOrders + preset filter (bookmark เดิมไม่ตาย) */}
        <Route path="/admin/pre-orders" element={<Navigate to="/admin/orders?mode=PRE_ORDER" replace />} />
        <Route path="/admin/kitchen" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminKitchen /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/recipes" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminRecipes /></AdminNav></Layout></AdminRoute></Suspense>} />

        <Route path="/admin/content-approvals" element={<Navigate to="/admin/marketing?tab=approval" replace />} />
        <Route path="/admin/audit-log" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AuditLogPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/asset-audit" element={<Navigate to="/admin/media?tab=audit" replace />} />
<Route path="/admin/payment-exceptions" element={<Navigate to="/admin/orders?tab=payment" replace />} />
        <Route path="/admin/marketing" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminMarketing /></AdminNav></Layout></AdminRoute></Suspense>} />
            <Route path="/admin/notifications" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminNotificationsPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/delivery" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><DeliveryHub /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/route-optimization" element={<Navigate to="/admin/delivery?tab=routes" replace />} />
        <Route path="/admin/promotions" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminPromotions /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/rounds" element={<Navigate to="/admin/delivery?tab=rounds" replace />} />
        <Route path="/admin/customers" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminCustomers /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/settings" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><SettingsHub /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/pos" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminPos /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/reports" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminReports /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/print-settings" element={<Navigate to="/admin/settings?tab=print" replace />} />
        <Route path="/admin/media" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminMedia /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/errors" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminErrorsPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/mascot" element={<Navigate to="/admin/settings?tab=mascot" replace />} />
        
        {/* TEN-05: Brand Management */}
        <Route path="/admin/brands" element={<Navigate to="/admin/tenants?tab=brands" replace />} />
        
        {/* TEN-06: Tenant Management */}
        <Route path="/admin/tenants" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><OrgHub /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/onboarding" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminOnboarding /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/billing" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminBilling /></AdminNav></Layout></AdminRoute></Suspense>} />
        
        {/* CAT-04: Admin Portfolio / Past Works */}
        <Route path="/admin/portfolio" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminPortfolioPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        {/* AI-EXT: Admin AI Content Studio */}
        <Route path="/admin/ai-studio" element={<Navigate to="/admin/marketing?tab=ai" replace />} />
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Bite / AI entry moved to BottomNav ('Bite') + BiteHero quick actions (UI v5) */}
    </ErrorBoundary>
    </HelmetProvider>
    </BrandProvider>
  )
}



