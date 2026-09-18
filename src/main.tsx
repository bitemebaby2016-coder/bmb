import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'

// ⚡ PERF (2026-09-17): admin seeding hashes a bcrypt password at boot, which is
// heavy on the main thread. Defer it until after first paint / idle so LCP and
// TBT for the landing page are not blocked. Auth check is also non-blocking now.
function afterFirstPaint(cb: () => void): void {
  const run = () => setTimeout(cb, 1500)
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => run(), { timeout: 4000 })
  } else {
    run()
  }
}

afterFirstPaint(() => {
  // P0-2 FIX (2026-09-18): ไม่มี admin seeding/localStorage user อีกต่อไป
  // Authentication อยู่ที่ Supabase Auth; profile/role ถูกสร้างโดย trigger
  // `on_auth_user_created` (migration 006) — client แค่ตรวจ session
  useAuthStore.getState().checkAuth().then(() => {
    console.log('[BMB] App initialized — Supabase Auth session checked')
  }).catch(err => {
    console.error('[BMB] Init error:', err)
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)