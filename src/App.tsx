import { Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FloatingAiButton } from './components/ai/FloatingAiButton'
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

// Lazy loaded: Protected pages (4 pages)
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const RewardsPage = lazy(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })))
const ViralPage = lazy(() => import('./pages/ViralPage').then(m => ({ default: m.ViralPage })))
const AiChatPage = lazy(() => import('./pages/ai/AiChatPage').then(m => ({ default: m.AiChatPage })))

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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const customer = useAuthStore((s) => s.customer)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  
  if (!isAuthenticated || !customer) return <Navigate to="/login" replace />
  
  // Check if user has admin role from stored data (from profiles table or users API)
  const isAdminUser = localStorage.getItem('bmb_admin_role') === 'true' 
    || customer.email === 'admin@bmb.co.th' // fallback for local mode
  
  if (!isAdminUser) return <Navigate to="/" replace />
  
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
        <Route path="/rewards" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><RewardsPage /></Layout></ProtectedRoute></Suspense>} />
        <Route path="/viral" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><ViralPage /></Layout></ProtectedRoute></Suspense>} />
        
        {/* AI Routes — Lazy Loaded */}
        <Route path="/ai-chat" element={<Suspense fallback={<LoadingSpinner />}><ProtectedRoute><Layout><AiChatPage /></Layout></ProtectedRoute></Suspense>} />
        
        {/* Admin Routes — Lazy Loaded */}
        <Route path="/admin" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminDashboard /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/inventory" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><InventoryPage /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/orders" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminOrders /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/products" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AdminProducts /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/audit-log" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><AuditLogPage /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/delivery" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><DeliveryManagement /></Layout></AdminRoute></Suspense>} />
        <Route path="/admin/route-optimization" element={<Suspense fallback={<LoadingSpinner />}><AdminRoute><Layout><RouteOptimizationPage /></Layout></AdminRoute></Suspense>} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Floating AI Button */}
      <FloatingAiButton />
    </ErrorBoundary>
    </HelmetProvider>
  )
}