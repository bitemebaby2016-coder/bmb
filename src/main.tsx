import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'
import { initializeAdmin } from './lib/bmbAdminApi_users'

// Initialize admin account & auth check on app startup
Promise.all([
  initializeAdmin(),
  new Promise<void>((resolve) => {
    useAuthStore.getState().checkAuth()
    resolve()
  })
]).then(() => {
  console.log('[BMB] App initialized — bcrypt password hashing active, admin ready')
}).catch(err => {
  console.error('[BMB] Init error:', err)
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