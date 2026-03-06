import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: '60vh', padding: '24px', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: 420, textAlign: 'center',
            background: 'var(--bg-card, #fff)', borderRadius: 12,
            padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>:(</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary, #111)' }}>
              Algo salió mal
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary, #666)' }}>
              Ha ocurrido un error inesperado. Puedes intentar volver a cargar esta sección.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--accent, #2563eb)', color: '#fff', fontSize: 14, fontWeight: 500,
                }}
              >
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary, #666)',
                  fontSize: 14, border: '1px solid var(--border, #ddd)',
                }}
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
