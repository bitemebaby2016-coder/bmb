import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, fetchProfileRole } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import { writeAuditLog } from '@/lib/auditLog'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // P0-2: login ผ่าน Supabase Auth (ไม่ใช่ localStorage users)
      const ok = await login(email, password)
      if (!ok) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        setIsLoading(false)
        return
      }

      // Admin role อ่านจาก DB (profiles) ไม่ใช่ localStorage flag
      const role = await fetchProfileRole()

      writeAuditLog({
        action: 'user_login',
        entity_type: 'user',
        entity_id: email,
        description: `${email} เข้าสู่ระบบสำเร็จ`
      })

      showToast('เข้าสู่ระบบสำเร็จ!', 'success')

      // Redirect based on DB role
      if (role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧡</div>
          <h1 className="text-4xl font-bold text-brand-accent font-display">Bite Me Baby</h1>
          <p className="text-brand-muted mt-2">มากกว่าคำว่าอร่อย</p>
        </div>

        {/* Login Form */}
        <div className="card bg-brand-surface">
          <h2 className="text-2xl font-bold text-brand-accent mb-6 text-center">เข้าสู่ระบบ</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">อีเมล</label>
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
              <label className="block text-sm font-medium text-brand-accent mb-2">รหัสผ่าน</label>
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
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-brand-muted text-sm">
              ยังไม่มีบัญชี?{' '}
              <Link to="/register" className="text-brand-primary font-medium hover:underline">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
        
        <div className="text-center mt-6">
          <Link to="/" className="text-brand-primary hover:underline">
            ← กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  )
}