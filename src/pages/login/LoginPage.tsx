import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authenticateUser } from '@/lib/bmbAdminApi_users'
import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import { writeAuditLog } from '@/lib/auditLog'

export function LoginPage() {
  const navigate = useNavigate()
  const setCustomer = useAuthStore((s) => s.setCustomer)
  const setIsAuthenticated = useAuthStore((s) => s.setIsAuthenticated)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const user = await authenticateUser(email, password)
      if (!user) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        setIsLoading(false)
        return
      }
      
      if (!user.is_active) {
        setError('บัญชีนี้ถูกปิดใช้งาน')
        setIsLoading(false)
        return
      }
      
      // Set auth state & admin role flag for routing
      localStorage.setItem('bmb_admin_role', user.role === 'admin' ? 'true' : 'false')
      
      // Audit log: successful login
      writeAuditLog({
        action: 'user_login',
        entity_type: 'user',
        entity_id: user.id,
        description: `${user.name} (${user.email}) เข้าสู่ระบบสำเร็จ`
      })
      
      setCustomer({
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        line_id: '',
        default_latitude: 0,
        default_longitude: 0,
        default_address_detail: '',
        loyalty_points: 0,
        total_orders: 0,
        total_spent: 0,
        created_at: user.created_at,
        updated_at: user.created_at
      })
      setIsAuthenticated(true)
      
      showToast('เข้าสู่ระบบสำเร็จ!', 'success')
      
      // Redirect based on role
      if (user.role === 'admin') {
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
          
          <div className="mt-4 p-4 bg-brand-bg rounded-lg">
            <p className="text-sm text-brand-accent font-medium mb-2">🔑 Demo Admin:</p>
            <p className="text-sm text-brand-muted">อีเมล: admin@bmb.co.th</p>
            <p className="text-sm text-brand-muted">รหัสผ่าน: admin123</p>
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