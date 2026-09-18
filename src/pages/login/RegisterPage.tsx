import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpWithEmail } from '@/store/authStore'
import { showToast } from '@/components/ui/ToastContainer'
import { writeAuditLog } from '@/lib/auditLog'

export function RegisterPage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('รหัสผ่านต้อง至少有 6 ตัวอักษร')
      setIsLoading(false)
      return
    }

    try {
      // P0-2: สมัครผ่าน Supabase Auth (trigger on_auth_user_created จะ
      // สร้าง profile ด้วย role=customer ให้อัตโนมัติ) — ไม่มี localStorage users
      const result = await signUpWithEmail({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })

      if (!result.ok) {
        setError(result.error || 'อีเมลนี้ถูกใช้แล้ว')
        setIsLoading(false)
        return
      }

      showToast('สมัครสมาชิกสำเร็จ! กรุณายืนยันอีเมล (ถ้าจำเป็น)', 'success')

      // Audit log: user registered
      writeAuditLog({
        action: 'user_register',
        entity_type: 'user',
        entity_id: formData.email,
        description: `ผู้ใช้ใหม่ ${formData.name} (${formData.email}) ลงทะเบียนสำเร็จ`
      })

      navigate('/login')
    } catch (err) {
      console.error('Register error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setIsLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧡</div>
          <h1 className="text-4xl font-bold text-brand-accent font-display">Bite Me Baby</h1>
          <p className="text-brand-muted mt-2">มากกว่าคำว่าอร่อย</p>
        </div>

        <div className="card bg-brand-surface">
          <h2 className="text-2xl font-bold text-brand-accent mb-6 text-center">สมัครสมาชิก</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ชื่อ-นามสกุล</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="input" placeholder="ชื่อของคุณ" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">อีเมล</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="your@email.com" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">เบอร์โทรศัพท์</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input" placeholder="0812345678" required />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">รหัสผ่าน</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="input" placeholder="至少有 6 ตัวอักษร" required minLength={6} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-accent mb-2">ยืนยันรหัสผ่าน</label>
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="input" placeholder="กรอกอีกครั้ง" required />
            </div>
            
            <button type="submit" disabled={isLoading} className={`btn btn-primary w-full ${isLoading ? 'btn-disabled' : ''}`}>
              {isLoading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-brand-muted text-sm">
              มีบัญชีแล้ว?{' '}
              <Link to="/login" className="text-brand-primary font-medium hover:underline">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
        
        <div className="text-center mt-6">
          <Link to="/" className="text-brand-primary hover:underline">← กลับหน้าแรก</Link>
        </div>
      </div>
    </div>
  )
}