import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'
import { installGlobalErrorReporter } from './lib/errorReporter'
import { hydratePlatformConfigFromServer } from './lib/platformConfigBootstrap'

// ⚡ PERF (2026-09-17): admin seeding hashes a bcrypt password at boot, which is
// heavy on the main thread. Defer it until after first paint / idle so LCP and
// TBT for the landing page are not blocked.
function afterFirstPaint(cb: () => void): void {
  const run = () => setTimeout(cb, 1500)
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => run(), { timeout: 4000 })
  } else {
    run()
  }
}

afterFirstPaint(() => {
  // ADM-01: report uncaught errors to the server-side feed.
  if (typeof window !== 'undefined') installGlobalErrorReporter()
})

// W-1.4b: ดึงค่าปกครอง (delivery_policy/brand) จาก server ทับ bootstrap fallback
// (fire-and-forget — ถ้า fail คงค่า default ไว้ ดู platformConfigBootstrap.ts)
void hydratePlatformConfigFromServer()

// F-02 FIX (Wave 1): restore the Supabase Auth session BEFORE first render.
// ก่อนหน้า: checkAuth ถูก defer 1.5s → บน reload ของ /admin/* ทุก route guard
// เห็น isAuthenticated=false ช่วงแรกแล้ว redirect ไป /login ทันที (16/16 routes)
// ตอนนี้: checkAuth เริ่มตรงนี้ (sync ตอน module load) และ guards รอผ่าน
// authStore.isInitializing จนกว่า session restore เสร็จจริง
void useAuthStore.getState().checkAuth()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)