import { Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useAuthStore } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FloatingAiButton } from './components/ai/FloatingAiButton'
import { SeoHelmet } from './components/SeoHelmet'
import { getHomeMeta, getMenuMeta, getCartMeta, getCheckoutMeta, getOrderTrackMeta, getAboutMeta, getFaqMeta, getBlogMeta, getContactMeta, getPrivacyMeta, getTermsMeta, getPromotionsMeta, getRewardsMeta, getVoteMeta, getRandomMenuMeta, getShareMeta, getViralMeta, getProfileMeta, getAdminMeta, getLoginMeta } from './lib/seo'
import { HomePage } from './pages/HomePage'
import { MenuPage } from './pages/MenuPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderTrackPage } from './pages/OrderTrackPage'
import { ProfilePage } from './pages/ProfilePage'
import { PromotionsPage } from './pages/PromotionsPage'
import { ReviewPage } from './pages/ReviewPage'
import { VotePage } from './pages/VotePage'
import { RandomMenuPage } from './pages/RandomMenuPage'
import { RewardsPage } from './pages/RewardsPage'
import { SharePage } from './pages/SharePage'
import { ViralPage } from './pages/ViralPage'
import { InventoryPage } from './pages/admin/InventoryPage'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminOrders } from './pages/admin/AdminOrders'
import { AdminProducts } from './pages/admin/AdminProducts'
import { AuditLogPage } from './pages/admin/AuditLogPage'
import { DeliveryManagement } from './pages/admin/DeliveryManagement'
import { RouteOptimizationPage } from './pages/admin/RouteOptimizationPage'
import { LoginPage } from './pages/login/LoginPage'
import { RegisterPage } from './pages/login/RegisterPage'
import { AiChatPage } from './pages/ai/AiChatPage'
import { PaymentConfirmationPage } from './pages/PaymentConfirmationPage'
import { AboutPage } from './pages/AboutPage'
import { FaqPage } from './pages/FaqPage'
import { BlogPage } from './pages/BlogPage'
import { ContactPage } from './pages/ContactPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'

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
        
        {/* Info Pages (SEO/GEO/AEO) */}
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
        <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
        <Route path="/blog" element={<Layout><BlogPage /></Layout>} />
        <Route path="/contact" element={<Layout><ContactPage /></Layout>} />
        <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
        <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
        
        {/* Protected Routes */}
        <Route path="/profile" element={<ProtectedRoute><Layout><ProfilePage /></Layout></ProtectedRoute>} />
        <Route path="/rewards" element={<ProtectedRoute><Layout><RewardsPage /></Layout></ProtectedRoute>} />
        <Route path="/viral" element={<ProtectedRoute><Layout><ViralPage /></Layout></ProtectedRoute>} />
        
        {/* AI Routes */}
        <Route path="/ai-chat" element={<ProtectedRoute><Layout><AiChatPage /></Layout></ProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><Layout><AdminDashboard /></Layout></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><Layout><InventoryPage /></Layout></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><Layout><AdminOrders /></Layout></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><Layout><AdminProducts /></Layout></AdminRoute>} />
        <Route path="/admin/audit-log" element={<AdminRoute><Layout><AuditLogPage /></Layout></AdminRoute>} />
        <Route path="/admin/delivery" element={<AdminRoute><Layout><DeliveryManagement /></Layout></AdminRoute>} />
        <Route path="/admin/route-optimization" element={<AdminRoute><Layout><RouteOptimizationPage /></Layout></AdminRoute>} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Floating AI Button */}
      <FloatingAiButton />
    </ErrorBoundary>
    </HelmetProvider>
  )
}