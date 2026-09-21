import { Component, ErrorInfo, ReactNode } from 'react'
import { reportError } from '@/lib/errorReporter'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    // ADM-01: surfacing render errors to the admin errors feed.
    reportError(error?.message || String(error), { componentStack: String(errorInfo?.componentStack || '').slice(0, 400) })
  }

  public retry = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFF7ED',
            padding: '2rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              maxWidth: '600px',
              width: '100%',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>️</div>
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#92400E',
                  marginBottom: '0.5rem',
                }}
              >
                เกิดข้อผิดพลาด
              </h1>
              <p style={{ color: '#78716C', marginBottom: '1rem' }}>
                เกิดปัญหาในการโหลดหน้าเว็บ กรุณาลองรีเฟรชหน้าใหม่
              </p>
              <button
                type='button'
                onClick={this.retry}
                style={{
                  display: 'block',
                  margin: '0 auto 1rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '9999px',
                  background: '#F97316',
                  color: '#fff',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔄 ลองใหม่อีกครั้ง
              </button>
              <details
                style={{
                  textAlign: 'left',
                  backgroundColor: '#FFFBEB',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#F59E0B' }}>
                  รายละเอียด error
                </summary>
                <pre
                  style={{
                    marginTop: '0.5rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#92400E',
                  }}
                >
                  {this.state.error?.message}
                </pre>
              </details>
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#F97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔄 รีเฟรชหน้า
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
