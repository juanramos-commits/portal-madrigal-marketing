import { useState, useEffect } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: true, date: new Date().toISOString() }))
    setVisible(false)
  }

  const acceptEssential = () => {
    localStorage.setItem('cookie_consent', JSON.stringify({ essential: true, analytics: false, date: new Date().toISOString() }))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'var(--bg-card, #1a1a2e)',
      borderTop: '1px solid var(--border, #333)',
      padding: '16px 24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div style={{ flex: 1, minWidth: '250px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text, #fff)', margin: '0 0 4px', fontWeight: 500 }}>
          Cookies y privacidad
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted, #999)', margin: 0, lineHeight: 1.5 }}>
          Utilizamos cookies esenciales para el funcionamiento de la aplicación (autenticación y preferencias).{' '}
          <a href="/privacidad" style={{ color: '#3b82f6', textDecoration: 'none' }}>Política de Privacidad</a>
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={acceptEssential}
          style={{
            padding: '8px 16px', fontSize: '12px',
            background: 'transparent', border: '1px solid var(--border, #333)',
            borderRadius: '6px', color: 'var(--text, #fff)', cursor: 'pointer'
          }}
        >
          Solo esenciales
        </button>
        <button
          onClick={accept}
          style={{
            padding: '8px 16px', fontSize: '12px',
            background: '#3b82f6', border: 'none',
            borderRadius: '6px', color: 'white', cursor: 'pointer'
          }}
        >
          Aceptar todas
        </button>
      </div>
    </div>
  )
}
