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
  // ⚡ PERF (2026-09-17): dynamic import keeps the supabase chunk OFF the initial
  // landing critical path (admin seeding no longer needs it at boot).
  Promise.all([
    import('./lib/bmbAdminApi_users').then(({ initializeAdmin }) => initializeAdmin()),
    Promise.resolve().then(() => useAuthStore.getState().checkAuth()),
  ]).then(() => {
    console.log('[BMB] App initialized — bcrypt password hashing active, admin ready')
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