import { useState, useEffect } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

const toastColors = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { message, type = 'info' } = event.data || {}
      if (message) {
        addToast(message, type)
      }
    }

    window.addEventListener('toast', handler as EventListener)
    return () => window.removeEventListener('toast', handler as EventListener)
  }, [])

  function addToast(message: string, type: Toast['type'] = 'info') {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast border ${toastColors[toast.type]} cursor-pointer`}
          onClick={() => dismissToast(toast.id)}
        >
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function showToast(message: string, type: Toast['type'] = 'info') {
  window.dispatchEvent(new MessageEvent('toast', { data: { message, type } }))
}