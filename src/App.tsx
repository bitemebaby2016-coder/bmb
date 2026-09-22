import { Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthStore, fetchProfileRole } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminNav } from './components/admin/AdminNav'
// Bite / AI accessibility lives in BottomNav ('ไบต์' → /ai-chat) + BiteHero quick actions (UI v5)
import { SeoHelmet } from './components/SeoHelmet'
import { getHomeMeta, getMenuMeta, getCartMeta, getCheckoutMeta, getOrderTrackMeta, getAboutMeta, getFaqMeta, getBlogMeta, getContactMeta, getPrivacyMeta, getTermsMeta, getPromotionsMeta, getRewardsMeta, getVoteMeta, getRandomMenuMeta, getShareMeta, getViralMeta, getProfileMeta, getAdminMeta, getLoginMeta } from './lib/seo'

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
const RegisterPage = lazy(() => import('./pages/login/RegisterPage').then(m => ({ default: m.RegisterPage })))
const PaymentConfirmationPage = lazy(() => import('./pages/PaymentConfirmationPage').then(m => ({ default: m.PaymentConfirmationPage })))

// Lazy loaded: Admin routes (7 pages)
const InventoryPage = lazy(() => import('./pages/admin/InventoryPage').then(m => ({ default: m.InventoryPage })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const DeliveryManagement = lazy(() => import('./pages/admin/DeliveryManagement').then(m => ({ default: m.DeliveryManagement })))
const RouteOptimizationPage = lazy(() => import('./pages/admin/RouteOptimizationPage').then(m => ({ default: m.RouteOptimizationPage })))
const AdminPromotions = lazy(() => import('./pages/admin/AdminPromotions').then(m => ({ default: m.AdminPromotions })))
const AdminRounds = lazy(() => import('./pages/admin/AdminRounds').then(m => ({ default: m.AdminRounds })))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })))
const AdminMedia = lazy(() => import('./pages/admin/AdminMedia').then(m => ({ default: m.AdminMedia })))

// Lazy loaded: Protected pages (4 pages)
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const RewardsPage = lazy(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })))
const ViralPage = lazy(() => import('./pages/ViralPage').then(m => ({ default: m.ViralPage })))
const AiChatPage = lazy(() => import('./pages/ai/AiChatPage').then(m => ({ default: m.AiChatPage })))
const RiderPwaPage = lazy(() => import('./pages/RiderPwaPage').then(m => ({ default: m.RiderPwaPage })))
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })))
const AdminErrorsPage = lazy(() => import('./pages/admin/AdminErrorsPage').then(m => ({ default: m.AdminErrorsPage })))
const MascotSettingsPage = lazy(() => import('./pages/admin/MascotSettingsPage').then(m => ({ default: m.MascotSettingsPage })))
const AdminControlPage = lazy(() => import('./pages/AdminControlPage').then(m => ({ default: m.AdminControlPage })))
const AdminContentApprovals = lazy(() => import('./pages/admin/AdminContentApprovals').then(m => ({ default: m.AdminContentApprovals })))

// Lazy loaded: Info pages (6 pages)
const AboutPage = lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })))
const FaqPage = lazy(() => import('./pages/FaqPage').then(m => ({ default: m.FaqPage })))
const BlogPage = lazy(() => import('./pages/BlogPage').then(m => ({ default: m.BlogPage })))
const ContactPage = lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })))

// Loading component for Suspense
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}


// P0-3 FIX: AdminRoute ตรวจ role จาก DB (profiles) ผ่าน RLS
function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [role, setRole] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated) { setChecking(false); return }
    fetchProfileRole().then((r) => {
      if (cancelled) return
      setRole(r)
      setChecking(false)
    })
    return () => { cancelled = true }
  }, [isAuthenticated])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (checking) return <LoadingSpinner />
  if (role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <HelmetProvider>
    <ErrorBoundary>
      {/* SEO Helmet — per-page meta tags */}
      <Routes>
        <Route path="/" element={<SeoHelmet seo={getHomeMeta()} />} />
        <Route path="/menu" element={<SeoHelmet seo={getMenuMeta()} />} />
        <Route path="/cart" element={<SeoHelmet seo={getCartMeta()} />} />
        <Route path="/checkout" element={<SeoHelmet seo={getCheckoutMeta()} />} />
        <Route path="/track/:orderNumber" element={<SeoHelmet seo={getOrderTrackMeta(':orderNumber')} />} />
        <Route path="/payment/:orderNumber" element={<SeoHelmet seo={getCheckoutMeta()} />} />
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
      </Routes>
      
      <Routes>
        {/* Public Routes — Home eager (LCP); the rest Suspense-wrapped lazy chunks */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/login" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav={true}><LoginPage /></Layout></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav={true}><RegisterPage /></Layout></Suspense>} />
        <Route path="/menu" element={<Suspense fallback={<LoadingSpinner />}><Layout><MenuPage /></Layout></Suspense>} />
        <Route path="/cart" element={<Suspense fallback={<LoadingSpinner />}><Layout><CartPage /></Layout></Suspense>} />
        <Route path="/checkout" element={<Suspense fallback={<LoadingSpinner />}><Layout><CheckoutPage /></Layout></Suspense>} />
        <Route path="/track/:orderNumber" element={<Suspense fallback={<LoadingSpinner />}><Layout><OrderTrackPage /></Layout></Suspense>} />
        <Route path="/orders" element={<Suspense fallback={<LoadingSpinner />}><Layout><OrdersPage /></Layout></Suspense>} />
        {/* Phase 3B: legacy /profile/orders link — canonical history lives at /orders */}
        <Route path="/profile/orders" element={<Navigate to="/orders" replace />} />
        <Route path="/payment/:orderNumber" element={<Suspense fallback={<LoadingSpinner />}><Layout><PaymentConfirmationPage /></Layout></Suspense>} />
        <Route path="/promotions" element={<Suspense fallback={<LoadingSpinner />}><Layout><PromotionsPage /></Layout></Suspense>} />
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
        <Route path="/ai-chat" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><AiChatPage /></Layout></ProtectedRoute></Suspense>} />
        
        {/* Ops Routes — Rider PWA (public demo) + Admin Control (admin-only) */}
        <Route path="/rider" element={<Suspense fallback={<LoadingSpinner />}><Layout hideBottomNav><RiderPwaPage /></Layout></Suspense>} />
        <Route path="/admin/control" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminControlPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        
        {/* Admin Routes — Lazy Loaded (AdminNav = persistent admin sidebar across every /admin page) */}
        <Route path="/admin" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminDashboard /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/inventory" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><InventoryPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/orders" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminOrders /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/products" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminProducts /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/content-approvals" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminContentApprovals /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/audit-log" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AuditLogPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/delivery" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><DeliveryManagement /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/route-optimization" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><RouteOptimizationPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/promotions" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminPromotions /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/rounds" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminRounds /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/customers" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminCustomers /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/settings" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminSettings /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/media" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminMedia /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/errors" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><AdminErrorsPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/mascot" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminNav><MascotSettingsPage /></AdminNav></Layout></AdminRoute></Suspense>} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Bite / AI entry moved to BottomNav ('ไบต์') + BiteHero quick actions (UI v5) */}
    </ErrorBoundary>
    </HelmetProvider>
  )
}
