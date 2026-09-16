import { Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FloatingAiButton } from './components/ai/FloatingAiButton'
import { SeoHelmet } from './components/SeoHelmet'
import { getHomeMeta, getMenuMeta, getCartMeta, getCheckoutMeta, getOrderTrackMeta, getAboutMeta, getFaqMeta, getBlogMeta, getContactMeta, getPrivacyMeta, getTermsMeta, getPromotionsMeta, getRewardsMeta, getVoteMeta, getRandomMenuMeta, getShareMeta, getViralMeta, getProfileMeta, getAdminMeta, getLoginMeta } from './lib/seo'

// Core pages (must load immediately)
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderTrackPage } from './pages/OrderTrackPage'
import { PromotionsPage } from './pages/PromotionsPage'
import { ReviewPage } from './pages/ReviewPage'
import { VotePage } from './pages/VotePage'
import { RandomMenuPage } from './pages/RandomMenuPage'
import { SharePage } from './pages/SharePage'
import { LoginPage } from './pages/login/LoginPage'
import { RegisterPage } from './pages/login/RegisterPage'
import { PaymentConfirmationPage } from './pages/PaymentConfirmationPage'

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
        {/* Public Routes */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/login" element={<Layout hideBottomNav={true}><LoginPage /></Layout>} />
        <Route path="/register" element={<Layout hideBottomNav={true}><RegisterPage /></Layout>} />
        <Route path="/menu" element={<Layout><MenuPage /></Layout>} />
        <Route path="/cart" element={<Layout><CartPage /></Layout>} />
        <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
        <Route path="/track/:orderNumber" element={<Layout><OrderTrackPage /></Layout>} />
        <Route path="/payment/:orderNumber" element={<Layout><PaymentConfirmationPage /></Layout>} />
        <Route path="/promotions" element={<Layout><PromotionsPage /></Layout>} />
        <Route path="/reviews/:productId" element={<Layout><ReviewPage /></Layout>} />
        <Route path="/vote" element={<Layout><VotePage /></Layout>} />
        <Route path="/random-menu" element={<Layout><RandomMenuPage /></Layout>} />
        <Route path="/share" element={<Layout><SharePage /></Layout>} />
        
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