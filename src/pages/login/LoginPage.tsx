import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, fetchProfileRole } from '@/store/authStore'
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
    showToast('লগইন সফল!', 'success')
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
        setError('ইমেইল অথবা পাসওয়ার্ড ভুল')
        setIsLoading(false)
        return
      }
      await finishLogin(email)
    } catch (err) {
      console.error('Login error:', err)
      setError('একটি ত্রুটি হয়েছে, আবার চেষ্টা করুন')
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
        setError(res.error || 'দ্রুত লগইন ব্যর্থ হয়েছে')
        setIsLoading(false)
        return
      }
      await finishLogin('quick:' + qPhone)
    } catch (err) {
      console.error('Quick login error:', err)
      setError('একটি ত্রুটি হয়েছে, আবার চেষ্টা করুন')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch GPS and remember it for the quick login
  async function handleLocate() {
    setIsLocating(true)
    setLocationBadge('অবস্থান খোঁজা হচ্ছে...')
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
        loc.source === 'gps' ? 'GPS অবস্থান' :
        loc.source === 'ip' ? 'IP অনুযায়ী (আনুমানিক)' :
        loc.source === 'saved' ? 'আগের সংরক্ষিত অবস্থান' : 'রান্নাঘরের অবস্থান (ডিফল্ট)'
      setLocationBadge('আমার অবস্থান: ' + label + ' · ' + loc.latitude.toFixed(4) + ', ' + loc.longitude.toFixed(4))
    } catch {
      setLocationBadge('অবস্থান পাওয়া যায়নি — ডিফল্ট ব্যবহার হবে: ' + KITCHEN_LAT + ', ' + KITCHEN_LNG)
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
          <p className="text-brand-muted mt-2">α╕íα╕▓α╕üα╕üα╕ºα╣êα╕▓α╕äα╕│α╕ºα╣êα╕▓α╕¡α╕úα╣êα╕¡α╕ó</p>
        </div>

        {/* Mode switch: email login OR quick login (name + phone + location) */}
        <div className="card bg-brand-surface">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-brand-surface mb-4">
            <button
              type="button"
              onClick={() => { setMode('email'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'email' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              📧 ইমেইল / পাসওয়ার্ড
            </button>
            <button
              type="button"
              onClick={() => { setMode('quick'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg ${mode === 'quick' ? 'bg-brand-primary text-white' : 'bg-white/60 text-brand-accent'}`}
            >
              ⚡ নাম + ফোন + অবস্থান
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
                <label className="block text-sm font-medium text-brand-accent mb-2">ইমেইল</label>
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
                <label className="block text-sm font-medium text-brand-accent mb-2">পাসওয়ার্ড</label>
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
                {isLoading ? 'লগইন হচ্ছে...' : 'লগইন'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div className="rounded-lg bg-brand-bg border border-brand-border p-3 text-xs text-brand-muted">
                দ্রুত লগইন: শুধু নাম + ফোন নম্বর + অবস্থান (GPS) — সিস্টেম আপনার
                আসল অবস্থান দিয়ে দূরত্ব / রুট / ডেলিভারি চার্জ হিসাব করে।
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">নাম</label>
                <input
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  className="input"
                  placeholder="আপনার নাম"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">ফোন নম্বর</label>
                <input
                  type="tel"
                  value={qPhone}
                  onChange={(e) => setQPhone(e.target.value)}
                  className="input"
                  placeholder="যেমন 0812345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-accent mb-2">ডেলিভারি ঠিকানা (ঐচ্ছিক)</label>
                <textarea
                  value={qAddress}
                  onChange={(e) => setQAddress(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder="বাসা/দোকান নম্বর ইত্যাদি"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={isLocating}
                  className="btn btn-outline text-sm"
                >
                  {isLocating ? 'খোঁজা হচ্ছে...' : 'আমার অবস্থান (GPS)'}
                </button>
                {locationBadge && <span className="text-xs text-brand-muted">{locationBadge}</span>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}
              >
                {isLoading ? 'লগইন হচ্ছে...' : 'দ্রুত লগইন'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-brand-muted text-sm">
              এখনও অ্যাকাউন্ট নেই?{' '}
              <Link to="/register" className="text-brand-primary font-medium hover:underline">
                নিবন্ধন করুন
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-brand-primary hover:underline">
            ← হোম পেজে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  )
}