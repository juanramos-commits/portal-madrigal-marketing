import { useState, useEffect } from 'react'

export default function ConnectionBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => { setIsOffline(true); setWasOffline(true) }
    const goOnline = () => {
      setIsOffline(false)
      // Auto-hide "back online" after 3s
      setTimeout(() => setWasOffline(false), 3000)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline && !wasOffline) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      padding: '8px 16px', textAlign: 'center', fontSize: 13, fontWeight: 500,
      background: isOffline ? '#dc2626' : '#16a34a', color: '#fff',
      transition: 'all 0.3s ease',
    }}>
      {isOffline ? 'Sin conexión — Los cambios no se guardarán' : 'Conexión restaurada'}
    </div>
  )
}
