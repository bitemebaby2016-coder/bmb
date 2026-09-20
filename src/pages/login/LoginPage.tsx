import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, fetchProfileRole, describeLoginError } from '@/store/authStore'
import { useLocationStore, KITCHEN_LAT, KITCHEN_LNG } from '@/store/locationStore'
import { getGpsLocation } from '@/lib/locationLogin'
import { showToast } from '@/components/ui/ToastContainer'
import { writeAuditLog } from '@/lib/auditLog'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const loginByLocation = useAuthStore((s) => s.loginByLocation)
  const [mode, setMode] = useState<'email' | 'quick'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [qName, setQName] = useState('')
  const [qPhone, setQPhone] = useState('')
  const [qAddress, setQAddress] = useState('')
  const [locationBadge, setLocationBadge] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState('')

  // Redirect after login based on DB role
  async function finishLogin(userLabel: string) {
    const role = await fetchProfileRole()
    writeAuditLog({
      action: 'user_login',
      entity_type: 'user',
      entity_id: userLabel,
      description: userLabel + ' - login success',
    })
    showToast('Login successful!', 'success')
    navigate(role === 'admin' ? '/admin' : '/')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // P0-2: login through Supabase Auth (not localStorage users)
      const ok = await login(email, password)
      if (!ok) {
        // Show the REAL reason (email not confirmed / wrong password / rate limit)
        // instead of a blanket "Invalid email or password".
        setError(describeLoginError(useAuthStore.getState().lastLoginError))
        setIsLoading(false)
        return
      }
      await finishLogin(email)
    } catch (err) {
      console.error('Login error:', err)
      setError('Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  // New quick login — name + phone + GPS location (Edge Function phone-auto-login)
  async function handleQuickLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const st = useLocationStore.getState()
      st.setLocation({
        latitude: st.location.latitude,
        longitude: st.location.longitude,
        addressDetail: qAddress,
        source: st.location.source || 'manual',
      })
      const res = await loginByLocation({
        name: qName,
        phone: qPhone,
        addressDetail: qAddress,
      })
      if (!res.ok) {
        setError(res.error || 'Quick login failed')
        setIsLoading(false)
        return
      }
      await finishLogin('quick:' + qPhone)
    } catch (err) {
      console.error('Quick login error:', err)
      setError('Something went wrong, please try again')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch GPS and remember it for the quick login
  async function handleLocate() {
    setIsLocating(true)
    setLocationBadge('Locating your position...')
    try {
      const loc = await getGpsLocation()
      useLocationStore.getState().setLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        addressDetail: qAddress,
        name: qName,
        phone: qPhone,
        source: loc.source,
      })
      const label =
        loc.source === 'gps' ? 'GPS location' :
        loc.source === 'ip' ? 'IP-based (approximate)' :
        loc.source === 'saved' ? 'Previously saved location' : 'Kitchen location (default)'
      setLocationBadge('My location: ' + label + ' · ' + loc.latitude.toFixed(4) + ', ' + loc.longitude.toFixed(4))
    } catch {
      setLocationBadge('Location not found — using default: ' + KITCHEN_LAT + ', ' + KITCHEN_LNG)
    } finally {
      setIsLocating(false)
    }
  }
return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧡</div>
          <h1 className="text-4xl font-bold text-brand-accent font-display">Bite Me Baby</h1>
          <p className="text-brand-muted mt-2">More than just delicious food</p>
        </div>

        {/* Mode switch: email login OR quick login (name + phone + location) */}
        <div className="card bg-brand-surface">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-brand-surface mb-4">
            <button
              type="button"
              onClick={() => { setMode('email'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'email' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              📧 Email / Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('quick'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'quick' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              ⚡ Name + Phone + Location
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {mode === 'email' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div className="rounded-lg bg-brand-bg border border-brand-border p-3 text-xs text-brand-muted">
                Quick login: just name + phone number + location (GPS) — the system
                uses your real location to calculate distance / route / delivery charge.
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">Name</label>
                <input
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">Phone number</label>
                <input
                  type="tel"
                  value={qPhone}
                  onChange={(e) => setQPhone(e.target.value)}
                  className="input"
                  placeholder="e.g. 0812345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">Delivery address (optional)</label>
                <textarea
                  value={qAddress}
                  onChange={(e) => setQAddress(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="House/shop number etc."
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="btn btn-outline text-sm"
                >
                  {isLocating ? 'Locating...' : '📍 My location (GPS)'}
                </button>
                {locationBadge && <span className="text-xs text-brand-muted">{locationBadge}</span>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
              >
                {isLoading ? 'Logging in...' : 'Quick login'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-brand-muted text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-brand-primary font-medium hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-brand-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}