const GOOGLE_COLOR = '#4285f4'

const estadoColores = {
  agendada: 'var(--status-onboarding-text)',
  realizada: 'var(--success)',
  'no show': 'var(--warning)',
  cancelada: 'var(--text-muted)',
  reagendada: 'var(--warning)',
}

function getColorCita(cita) {
  if (cita._isGoogleEvent) return GOOGLE_COLOR
  if (cita.estado_reunion?.color) return cita.estado_reunion.color
  const estado = (cita.estado || 'agendada').toLowerCase()
  return estadoColores[estado] || 'var(--status-onboarding-text)'
}

function formatHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const GoogleIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function CalendarioCita({ cita, onClick, mostrarCloser, compacto }) {
  const color = getColorCita(cita)
  const isGoogle = cita._isGoogleEvent

  if (compacto) {
    return (
      <button
        className={`vc-cita-dot${isGoogle ? ' vc-google-event' : ''}`}
        style={{ background: color }}
        onClick={e => { e.stopPropagation(); onClick?.(cita) }}
        aria-label={`${formatHora(cita.fecha_hora)} - ${cita.lead?.nombre || 'Sin nombre'}`}
      />
    )
  }

  return (
    <button
      className={`vc-cita-bloque${isGoogle ? ' vc-google-event' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={e => { e.stopPropagation(); onClick?.(cita) }}
      aria-label={`${formatHora(cita.fecha_hora)} - ${cita.lead?.nombre || 'Sin nombre'}`}
    >
      {isGoogle && <GoogleIcon />}
      <span className="vc-cita-hora">{formatHora(cita.fecha_hora)}</span>
      <span className="vc-cita-nombre">{cita.lead?.nombre || 'Sin nombre'}</span>
      {mostrarCloser && !isGoogle && cita.closer && (
        <span className="vc-cita-closer">{cita.closer.nombre || cita.closer.email}</span>
      )}
    </button>
  )
}

export { getColorCita }
